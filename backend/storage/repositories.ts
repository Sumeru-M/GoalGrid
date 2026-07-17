/**
 * Repositories — typed, domain-aware views over the KVStore.
 *
 * Each repository owns a key namespace and is responsible for (de)serialising
 * its documents. Nothing above this layer touches raw keys or JSON. All data
 * is per-device and per-user; a single device store holds one user's world.
 *
 * Key layout:
 *   profile                     → UserProfile
 *   learning                    → LearningStore (the AI's learned model)
 *   goal:{id}                   → Goal
 *   schedule:{horizon}          → Schedule (latest cached plan per horizon)
 *   outcome:{isoTimestamp}      → OutcomeRecord (append-only history)
 */

import {
  Goal,
  ISODate,
  LearningStore,
  Schedule,
  UserProfile,
  emptyLearningStore,
} from "../../src/types";
import { KVStore } from "./kvstore";

export interface OutcomeRecord {
  goalId: string;
  category: string[];
  completed: boolean;
  /** ISO timestamp of when it was recorded. */
  at: string;
  date: ISODate;
}

const K = {
  profile: "profile",
  learning: "learning",
  goal: (id: string) => `goal:${id}`,
  goalPrefix: "goal:",
  schedule: (h: string) => `schedule:${h}`,
  outcome: (at: string) => `outcome:${at}`,
  outcomePrefix: "outcome:",
};

/**
 * Defensive JSON parse. On-device stores can be corrupted (interrupted writes,
 * manual edits, version skew); a single bad record must not throw and take down
 * the whole app. We log and fall back rather than propagate.
 */
function safeParse<T>(raw: string | null, fallback: T | null = null): T | null {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[storage] dropping corrupt record");
    return fallback;
  }
}

export class ProfileRepository {
  constructor(private kv: KVStore) {}
  async get(): Promise<UserProfile | null> {
    const raw = await this.kv.get(K.profile);
    return safeParse<UserProfile>(raw);
  }
  async save(profile: UserProfile): Promise<void> {
    await this.kv.set(K.profile, JSON.stringify(profile));
  }
}

export class LearningRepository {
  constructor(private kv: KVStore) {}
  async load(): Promise<LearningStore> {
    const raw = await this.kv.get(K.learning);
    return safeParse<LearningStore>(raw, emptyLearningStore())!;
  }
  async save(store: LearningStore): Promise<void> {
    await this.kv.set(K.learning, JSON.stringify(store));
  }
}

export class GoalRepository {
  constructor(private kv: KVStore) {}
  async list(): Promise<Goal[]> {
    const keys = await this.kv.keys(K.goalPrefix);
    const goals: Goal[] = [];
    for (const k of keys) {
      const raw = await this.kv.get(k);
      const g = safeParse<Goal>(raw);
      if (g) goals.push(g);
    }
    return goals.sort((a, b) => a.id.localeCompare(b.id));
  }
  async get(id: string): Promise<Goal | null> {
    const raw = await this.kv.get(K.goal(id));
    return safeParse<Goal>(raw);
  }
  async save(goal: Goal): Promise<void> {
    await this.kv.set(K.goal(goal.id), JSON.stringify(goal));
  }
  async delete(id: string): Promise<boolean> {
    const existing = await this.kv.get(K.goal(id));
    if (!existing) return false;
    await this.kv.delete(K.goal(id));
    return true;
  }
}

export class ScheduleRepository {
  constructor(private kv: KVStore) {}
  async getLatest(horizon: string): Promise<Schedule | null> {
    const raw = await this.kv.get(K.schedule(horizon));
    return safeParse<Schedule>(raw);
  }
  async saveLatest(schedule: Schedule): Promise<void> {
    await this.kv.set(K.schedule(schedule.horizon), JSON.stringify(schedule));
  }
}

export class OutcomeRepository {
  constructor(private kv: KVStore) {}
  async append(record: OutcomeRecord): Promise<void> {
    // Append-only log: the key must be unique even when several outcomes are
    // recorded in the same millisecond (e.g. backfilling a day's tasks). Keying
    // by timestamp alone collides and silently drops records, so add a random
    // suffix. `record.at` still drives ordering in list().
    const uniq = `${record.at}-${Math.random().toString(36).slice(2, 8)}`;
    await this.kv.set(K.outcome(uniq), JSON.stringify(record));
  }
  async list(): Promise<OutcomeRecord[]> {
    const keys = await this.kv.keys(K.outcomePrefix);
    const out: OutcomeRecord[] = [];
    for (const k of keys) {
      const raw = await this.kv.get(k);
      const rec = safeParse<OutcomeRecord>(raw);
      if (rec) out.push(rec);
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }
}

/** Bundle of all repositories bound to one device store. */
export class DeviceStore {
  readonly profile: ProfileRepository;
  readonly learning: LearningRepository;
  readonly goals: GoalRepository;
  readonly schedules: ScheduleRepository;
  readonly outcomes: OutcomeRepository;

  constructor(private kv: KVStore) {
    this.profile = new ProfileRepository(kv);
    this.learning = new LearningRepository(kv);
    this.goals = new GoalRepository(kv);
    this.schedules = new ScheduleRepository(kv);
    this.outcomes = new OutcomeRepository(kv);
  }

  /** Full local wipe — backs a privacy "delete all my data" action. */
  async eraseAll(): Promise<void> {
    await this.kv.clear();
  }
}
