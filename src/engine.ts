/**
 * GoalGrid AI Engine — the public façade.
 *
 * Wraps the learning store, priority scoring and scheduler into one stateful
 * object the app talks to. It ingests user signals (declared priorities,
 * completions, misses) and emits schedules over any horizon, rescheduling
 * around missed days.
 */

import { buildSchedule, BuildOptions } from "./scheduler";
import {
  learnCompletion,
  learnPriority,
  scoreGoal,
  ScoreBreakdown,
} from "./priority";
import {
  emptyLearningStore,
  Goal,
  ISODate,
  LearningStore,
  PriorityLevel,
  Schedule,
  UserProfile,
} from "./types";

export interface RescheduleResult {
  schedule: Schedule;
  /** Human-readable summary lines, mirroring the app's "Reschedule Summary". */
  summary: string[];
}

export class AIPlannerEngine {
  private store: LearningStore;

  constructor(
    private profile: UserProfile,
    store?: LearningStore,
  ) {
    this.store = store ?? emptyLearningStore();
  }

  // -- Persistence -------------------------------------------------------

  getLearningStore(): LearningStore {
    return this.store;
  }

  updateProfile(profile: UserProfile): void {
    this.profile = profile;
  }

  // -- Learning signals --------------------------------------------------

  /**
   * User declared (or reordered) a category's priority. Propagates up the
   * taxonomy: e.g. declarePriority(["sports","football"], 2) also teaches the
   * engine that "sports" leans toward level 2.
   */
  declarePriority(category: string[], level: PriorityLevel): void {
    this.store = learnPriority(this.store, category, level);
  }

  /** Record that a goal was completed (or missed) to refine follow-through. */
  recordOutcome(goal: Goal, completed: boolean): void {
    this.store = learnCompletion(this.store, goal.category, completed);
  }

  /** Inspect how the engine currently scores a goal (for UI/debug). */
  explain(goal: Goal, today: ISODate): ScoreBreakdown {
    return scoreGoal(this.store, this.profile, goal, today);
  }

  // -- Scheduling --------------------------------------------------------

  plan(goals: Goal[], opts: BuildOptions): Schedule {
    return buildSchedule(this.store, this.profile, goals, opts);
  }

  /**
   * Rebuild the plan after one or more days were missed. Uncompleted work from
   * the missed span is folded back into the remaining horizon in priority
   * order; higher-priority goals reclaim time first. Returns the new schedule
   * plus a summary of what moved.
   */
  reschedule(
    goals: Goal[],
    opts: BuildOptions,
    params: {
      /** Days the user did not act on (their planned work is now outstanding). */
      missedDates: ISODate[];
      /** Minutes completed per goal, keyed by date → { goalId: minutes }. */
      completedMinutes?: Record<ISODate, Record<string, number>>;
      /**
       * Aggregate minutes already completed per goal across all history
       * (goalId → minutes), the same shape `plan()` takes. Without this, a
       * one-off finished on an earlier day would resurface in both the
       * before/after plans — and could even spawn a phantom catch-up clone.
       */
      aggregateCompleted?: Record<string, number>;
      /** The date to replan from (usually "today"). */
      replanFrom: ISODate;
    },
  ): RescheduleResult {
    // Tally the minutes that were planned on the missed day(s) but not
    // completed, per goal. This is the work that must be recovered.
    const missedMinutes: Record<string, number> = {};
    const before = this.plan(goals, {
      ...opts,
      completedMinutes: params.aggregateCompleted,
    });
    for (const day of before.days) {
      if (!params.missedDates.includes(day.date)) continue;
      const doneOnDay = params.completedMinutes?.[day.date] ?? {};
      for (const b of day.blocks) {
        const outstanding = (b.end - b.start) - (doneOnDay[b.goalId] ?? 0);
        if (outstanding > 0) missedMinutes[b.goalId] = (missedMinutes[b.goalId] ?? 0) + outstanding;
      }
    }

    // Feed the misses back into the learner so chronically-skipped categories
    // lose a little weight over time.
    for (const g of goals) {
      if (missedMinutes[g.id] > 0) this.recordOutcome(g, false);
    }

    // Inject the outstanding work as one-off "catch-up" goals so the replan
    // actually redistributes it across the remaining horizon — recurring goals
    // alone would simply regenerate and hide the miss. Catch-up work carries an
    // urgent deadline so it's protected ahead of routine sessions.
    const byId = new Map(goals.map((g) => [g.id, g]));
    const catchUp: Goal[] = [];
    for (const [goalId, minutes] of Object.entries(missedMinutes)) {
      const src = byId.get(goalId);
      if (!src || minutes <= 0) continue;
      catchUp.push({
        id: `${goalId}__catchup`,
        title: `${src.title} (catch-up)`,
        category: src.category,
        estimatedMinutes: minutes,
        preferredSessionMinutes: src.preferredSessionMinutes,
        minSessionMinutes: src.minSessionMinutes,
        timePreference: src.timePreference,
        declaredPriority: src.declaredPriority,
        deadline: addDaysISO(params.replanFrom, 2),
        recurrence: { kind: "once" },
        droppable: true,
      });
    }

    // Credit all history (so finished one-offs stay finished), plus anything
    // already done on the replan day itself.
    const after = this.plan([...goals, ...catchUp], {
      ...opts,
      from: params.replanFrom,
      completedMinutes: {
        ...(params.aggregateCompleted ?? {}),
        ...(params.completedMinutes?.[params.replanFrom] ?? {}),
      },
    });

    const summary = diffSummary(before, after, [...goals, ...catchUp], params.replanFrom);
    return { schedule: after, summary };
  }
}

// ---------------------------------------------------------------------------
// Reschedule summary
// ---------------------------------------------------------------------------

/** UTC-based date arithmetic, consistent with the scheduler's calendar dates. */
function addDaysISO(date: ISODate, n: number): ISODate {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function minutesByGoal(s: Schedule): Record<string, number> {
  const m: Record<string, number> = {};
  for (const day of s.days)
    for (const b of day.blocks) m[b.goalId] = (m[b.goalId] ?? 0) + (b.end - b.start);
  return m;
}

function fmtH(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function diffSummary(
  before: Schedule,
  after: Schedule,
  goals: Goal[],
  replanFrom: ISODate,
): string[] {
  const title = new Map(goals.map((g) => [g.id, g.title]));
  const mb = minutesByGoal(before);
  const ma = minutesByGoal(after);
  const lines: string[] = [];

  const ids = new Set([...Object.keys(mb), ...Object.keys(ma)]);
  for (const id of ids) {
    const delta = (ma[id] ?? 0) - (mb[id] ?? 0);
    if (Math.abs(delta) < 15) continue;
    const name = title.get(id) ?? id;
    if (delta > 0) lines.push(`${name} time increased by ${fmtH(delta)}`);
    else lines.push(`${name} reduced by ${fmtH(-delta)}`);
  }

  for (const u of after.unscheduled) {
    lines.push(`⚠ ${u.title} could not be fully scheduled (${fmtH(u.minutesShort)} short, ${u.reason})`);
  }

  if (lines.length === 0) lines.push("No changes needed — you're on track.");
  return lines;
}

export * from "./types";
export { scoreGoal } from "./priority";
