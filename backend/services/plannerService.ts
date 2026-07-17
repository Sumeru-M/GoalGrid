/**
 * PlannerService — the business layer.
 *
 * It rehydrates an AIPlannerEngine from on-device state (profile + learned
 * model), performs an operation, and writes any learning/schedule changes back
 * to the device. The API layer calls only this service; it never touches the
 * engine or repositories directly.
 *
 * Because the engine is stateful only through the LearningStore, every mutation
 * that changes learning re-persists it, keeping the on-device model and the
 * in-memory engine in lockstep.
 */

import { AIPlannerEngine } from "../../src/engine";
import {
  Goal,
  ISODate,
  PriorityLevel,
  Schedule,
  UserProfile,
} from "../../src/types";
import { scoreGoal, ScoreBreakdown } from "../../src/priority";
import { DeviceStore, OutcomeRecord } from "../storage/repositories";

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export type Horizon = Schedule["horizon"];

export class PlannerService {
  constructor(private store: DeviceStore) {}

  // -- Profile -----------------------------------------------------------

  async getProfile(): Promise<UserProfile | null> {
    return this.store.profile.get();
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    await this.store.profile.save(profile);
    return profile;
  }

  // -- Goals -------------------------------------------------------------

  listGoals(): Promise<Goal[]> {
    return this.store.goals.list();
  }

  async getGoal(id: string): Promise<Goal> {
    const g = await this.store.goals.get(id);
    if (!g) throw new NotFoundError(`goal ${id} not found`);
    return g;
  }

  async upsertGoal(goal: Goal): Promise<Goal> {
    await this.store.goals.save(goal);
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    const ok = await this.store.goals.delete(id);
    if (!ok) throw new NotFoundError(`goal ${id} not found`);
  }

  // -- Learning signals --------------------------------------------------

  /** Declare/reorder a category's priority; persists the updated model. */
  async declarePriority(category: string[], level: PriorityLevel): Promise<void> {
    const engine = await this.buildEngine();
    engine.declarePriority(category, level);
    await this.store.learning.save(engine.getLearningStore());
  }

  /** Record a completion/miss; updates follow-through model + history. */
  async recordOutcome(input: {
    goalId: string;
    completed: boolean;
    date: ISODate;
  }): Promise<void> {
    const goal = await this.getGoal(input.goalId);
    const engine = await this.buildEngine();
    engine.recordOutcome(goal, input.completed);
    await this.store.learning.save(engine.getLearningStore());

    const record: OutcomeRecord = {
      goalId: goal.id,
      category: goal.category,
      completed: input.completed,
      date: input.date,
      at: new Date().toISOString(),
    };
    await this.store.outcomes.append(record);
  }

  async explainGoal(goalId: string, today: ISODate): Promise<ScoreBreakdown> {
    const goal = await this.getGoal(goalId);
    const profile = await this.requireProfile();
    const learning = await this.store.learning.load();
    return scoreGoal(learning, profile, goal, today);
  }

  // -- Scheduling --------------------------------------------------------

  async plan(horizon: Horizon, from: ISODate): Promise<Schedule> {
    const engine = await this.buildEngine();
    const goals = await this.store.goals.list();
    const completedMinutes = await this.completedMinutesFromHistory();
    const schedule = engine.plan(goals, { horizon, from, completedMinutes });
    await this.store.schedules.saveLatest(schedule);
    return schedule;
  }

  async getLatestSchedule(horizon: Horizon): Promise<Schedule | null> {
    return this.store.schedules.getLatest(horizon);
  }

  async reschedule(params: {
    horizon: Horizon;
    from: ISODate;
    replanFrom: ISODate;
    missedDates: ISODate[];
  }): Promise<{ schedule: Schedule; summary: string[] }> {
    const engine = await this.buildEngine();
    const goals = await this.store.goals.list();
    const completedMinutes = await this.completedByDate();
    const result = engine.reschedule(
      goals,
      { horizon: params.horizon, from: params.from },
      {
        missedDates: params.missedDates,
        replanFrom: params.replanFrom,
        completedMinutes,
      },
    );
    // reschedule() may have learned from the misses — persist model + schedule.
    await this.store.learning.save(engine.getLearningStore());
    await this.store.schedules.saveLatest(result.schedule);
    return result;
  }

  // -- Privacy -----------------------------------------------------------

  async eraseAllData(): Promise<void> {
    await this.store.eraseAll();
  }

  // -- internals ---------------------------------------------------------

  private async requireProfile(): Promise<UserProfile> {
    const profile = await this.store.profile.get();
    if (!profile)
      throw new ValidationError("no profile set — complete setup first");
    return profile;
  }

  private async buildEngine(): Promise<AIPlannerEngine> {
    const profile = await this.requireProfile();
    const learning = await this.store.learning.load();
    return new AIPlannerEngine(profile, learning);
  }

  /** Raw completion history (most recent first), for the UI. */
  async listOutcomes(): Promise<OutcomeRecord[]> {
    const all = await this.store.outcomes.list();
    return all.reverse();
  }

  /**
   * Aggregate minutes-completed per goal for *one-off* goals only.
   *
   * A `once` goal, once done, stays done — so crediting it across the whole
   * history is correct. Recurring goals are deliberately excluded here: their
   * completion is a per-date fact (see completedByDate) and crediting it into a
   * horizon-wide total would wrongly suppress future occurrences.
   */
  private async completedMinutesFromHistory(): Promise<Record<string, number>> {
    const outcomes = await this.store.outcomes.list();
    const goals = await this.store.goals.list();
    const byId = new Map(goals.map((g) => [g.id, g]));
    const acc: Record<string, number> = {};
    for (const o of outcomes) {
      if (!o.completed) continue;
      const g = byId.get(o.goalId);
      if (!g) continue;
      const rec = g.recurrence?.kind ?? "once";
      if (rec !== "once") continue; // recurring handled per-date
      const per = g.preferredSessionMinutes ?? g.estimatedMinutes;
      acc[o.goalId] = Math.min(g.estimatedMinutes, (acc[o.goalId] ?? 0) + per);
    }
    return acc;
  }

  /**
   * Minutes completed per goal, keyed by the date they were completed:
   * { "2026-07-17": { gym: 60 } }. Used by reschedule so a session the user
   * actually finished on a missed day isn't recovered as catch-up work.
   */
  private async completedByDate(): Promise<Record<string, Record<string, number>>> {
    const outcomes = await this.store.outcomes.list();
    const goals = await this.store.goals.list();
    const byId = new Map(goals.map((g) => [g.id, g]));
    const acc: Record<string, Record<string, number>> = {};
    for (const o of outcomes) {
      if (!o.completed) continue;
      const g = byId.get(o.goalId);
      if (!g) continue;
      const per = g.preferredSessionMinutes ?? g.estimatedMinutes;
      (acc[o.date] ??= {})[o.goalId] = Math.min(
        g.estimatedMinutes,
        (acc[o.date]?.[o.goalId] ?? 0) + per,
      );
    }
    return acc;
  }
}
