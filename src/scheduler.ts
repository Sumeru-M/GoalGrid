/**
 * The scheduler. Given scored goals and per-day capacity, it packs work blocks
 * into free intervals in strict priority order, honouring session sizing, time
 * preferences and deadlines, and rolling overflow forward across the horizon.
 */

import {
  freeIntervals,
  freeCapacityMinutes,
  intervalMinutes,
  windowFor,
  FreeInterval,
} from "./capacity";
import { scoreGoal } from "./priority";
import {
  DaySchedule,
  Goal,
  ISODate,
  LearningStore,
  Recurrence,
  Schedule,
  TimeBlock,
  UnscheduledGoal,
  UserProfile,
} from "./types";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(date: ISODate, n: number): ISODate {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dow(date: ISODate): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

function horizonDays(horizon: Schedule["horizon"]): number {
  switch (horizon) {
    case "daily": return 1;
    case "weekly": return 7;
    case "monthly": return 30;
    case "yearly": return 365;
  }
}

function occursOn(rec: Recurrence | undefined, date: ISODate): boolean {
  if (!rec || rec.kind === "once") return true; // "once" handled by remaining-work tracking
  switch (rec.kind) {
    case "daily": return true;
    case "weekdays": return dow(date) >= 1 && dow(date) <= 5;
    case "weekly": return rec.daysOfWeek.includes(dow(date));
  }
}

// ---------------------------------------------------------------------------
// Internal working state per goal
// ---------------------------------------------------------------------------

interface Work {
  goal: Goal;
  score: number;
  priorityLevel: TimeBlock["priorityLevel"];
  /** Minutes still needed. For recurring goals this is refilled each occurrence. */
  remaining: number;
}

// ---------------------------------------------------------------------------
// Slot placement within one day
// ---------------------------------------------------------------------------

/**
 * Try to place up to `remaining` minutes of a goal into the day's free
 * intervals, preferring its time-of-day window but falling back to any free
 * time. Returns the blocks placed and mutates `free` to reserve them.
 */
function placeInDay(
  work: Work,
  date: ISODate,
  free: FreeInterval[],
  capacityLeft: number,
): { blocks: TimeBlock[]; placed: number; free: FreeInterval[] } {
  const goal = work.goal;
  // Never let the default floor exceed the goal itself, or short goals
  // (estimatedMinutes < 15) could never be placed and would be reported as
  // permanently unscheduled.
  const minSession = Math.min(goal.minSessionMinutes ?? 15, goal.estimatedMinutes);
  const preferred = goal.preferredSessionMinutes ?? goal.estimatedMinutes;

  let remaining = Math.min(work.remaining, capacityLeft);
  const blocks: TimeBlock[] = [];
  if (remaining < minSession) return { blocks, placed: 0, free };

  // Ordered candidate intervals: preference window first, then the rest.
  const preferredWindows = windowFor(goal.timePreference, free);
  const candidateOrder = dedupeIntervals([...preferredWindows, ...free]);

  let working = free.map((f) => ({ ...f }));

  for (const cand of candidateOrder) {
    if (remaining < minSession) break;
    // Re-find this candidate inside the (mutating) working set.
    for (const slot of working) {
      if (remaining < minSession) break;
      const s = Math.max(slot.start, cand.start);
      const e = Math.min(slot.end, cand.end);
      const avail = e - s;
      if (avail < minSession) continue;

      const take = Math.min(avail, Math.max(minSession, Math.min(preferred, remaining)));
      const blockStart = s;
      const blockEnd = s + take;
      blocks.push({
        goalId: goal.id,
        title: goal.title,
        category: goal.category,
        date,
        start: blockStart,
        end: blockEnd,
        score: work.score,
        priorityLevel: work.priorityLevel,
      });
      // Reserve within the working set.
      working = reserve(working, blockStart, blockEnd);
      remaining -= take;
    }
  }

  const placed = blocks.reduce((sum, b) => sum + (b.end - b.start), 0);
  return { blocks, placed, free: working };
}

function reserve(free: FreeInterval[], start: number, end: number): FreeInterval[] {
  const out: FreeInterval[] = [];
  for (const f of free) {
    if (end <= f.start || start >= f.end) { out.push(f); continue; }
    if (start > f.start) out.push({ start: f.start, end: start });
    if (end < f.end) out.push({ start: end, end: f.end });
  }
  return out.filter((f) => f.end > f.start);
}

function dedupeIntervals(list: FreeInterval[]): FreeInterval[] {
  const seen = new Set<string>();
  const out: FreeInterval[] = [];
  for (const f of list) {
    const k = `${f.start}-${f.end}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export interface BuildOptions {
  horizon: Schedule["horizon"];
  from: ISODate;
  /** Goals already partially done: map goalId → minutes already completed. */
  completedMinutes?: Record<string, number>;
}

/**
 * Build a full schedule across the horizon.
 *
 * Algorithm per day:
 *   1. compute free intervals + discretionary capacity,
 *   2. sort outstanding work by score (priority) descending,
 *   3. greedily place each goal's next session, highest priority first,
 *   4. carry any unfinished work to the next day.
 * Anything still outstanding at the horizon's end (or past deadline) is
 * reported as unscheduled with the shortfall.
 */
export function buildSchedule(
  store: LearningStore,
  profile: UserProfile,
  goals: Goal[],
  opts: BuildOptions,
): Schedule {
  const nDays = horizonDays(opts.horizon);
  const to = addDays(opts.from, nDays - 1);
  const days: DaySchedule[] = [];

  // Seed working state for non-recurring goals (once). Recurring goals are
  // instantiated per applicable day below.
  const completed = opts.completedMinutes ?? {};
  const oneOff: Work[] = [];
  for (const g of goals) {
    const rec = g.recurrence ?? { kind: "once" };
    if (rec.kind === "once") {
      const already = completed[g.id] ?? 0;
      const remaining = Math.max(0, g.estimatedMinutes - already);
      if (remaining <= 0) continue;
      const sb = scoreGoal(store, profile, g, opts.from);
      oneOff.push({ goal: g, score: sb.score, priorityLevel: sb.priorityLevel, remaining });
    }
  }

  const droppedPastDeadline = new Set<string>();

  for (let i = 0; i < nDays; i++) {
    const date = addDays(opts.from, i);
    const free = freeIntervals(profile, date);
    const capacity = freeCapacityMinutes(profile, date);

    // Build today's work list: recurring occurrences (fresh each day) + carried
    // one-offs. Drop one-offs whose deadline has passed.
    const todaysWork: Work[] = [];

    for (const g of goals) {
      const rec = g.recurrence ?? { kind: "once" };
      if (rec.kind === "once") continue;
      if (!occursOn(rec, date)) continue;
      const sb = scoreGoal(store, profile, g, date);
      todaysWork.push({
        goal: g,
        score: sb.score,
        priorityLevel: sb.priorityLevel,
        remaining: g.estimatedMinutes,
      });
    }

    for (const w of oneOff) {
      if (w.remaining <= 0) continue;
      if (w.goal.deadline && date > w.goal.deadline) {
        droppedPastDeadline.add(w.goal.id);
        continue;
      }
      // Re-score against today (urgency shifts as deadline nears).
      const sb = scoreGoal(store, profile, w.goal, date);
      w.score = sb.score;
      w.priorityLevel = sb.priorityLevel;
      todaysWork.push(w);
    }

    // Priority order: highest score first; deadline breaks ties (sooner first).
    todaysWork.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ad = a.goal.deadline ?? "9999-12-31";
      const bd = b.goal.deadline ?? "9999-12-31";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });

    let workingFree = free.map((f) => ({ ...f }));
    let usedMinutes = 0;
    const blocks: TimeBlock[] = [];

    for (const w of todaysWork) {
      const capacityLeft = capacity - usedMinutes;
      if (capacityLeft <= 0) break;
      if (intervalMinutes(workingFree) <= 0) break;
      const res = placeInDay(w, date, workingFree, capacityLeft);
      if (res.placed > 0) {
        blocks.push(...res.blocks);
        workingFree = res.free;
        usedMinutes += res.placed;
        w.remaining -= res.placed; // only meaningful for carried one-offs
      }
    }

    blocks.sort((a, b) => a.start - b.start);
    days.push({ date, blocks, capacityMinutes: capacity, usedMinutes });
  }

  // Report leftovers.
  const unscheduled: UnscheduledGoal[] = [];
  for (const w of oneOff) {
    if (w.remaining > 0) {
      unscheduled.push({
        goalId: w.goal.id,
        title: w.goal.title,
        reason: droppedPastDeadline.has(w.goal.id) ? "past-deadline" : "insufficient-capacity",
        minutesShort: w.remaining,
      });
    }
  }

  return { horizon: opts.horizon, from: opts.from, to, days, unscheduled };
}
