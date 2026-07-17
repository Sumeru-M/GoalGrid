import { createBackend } from "../../../backend/index";
import type { ApiResponse } from "../../../backend/api/router";
import { LocalStorageKV } from "./localStorageKV";
import type {
  Goal,
  PriorityLevel,
  Schedule,
  UserProfile,
} from "../../../src/types";
import type { ScoreBreakdown } from "../../../src/priority";
import type { OutcomeRecord } from "../../../backend/storage/repositories";

/**
 * The frontend talks to the SAME backend the server uses, running in-process
 * against a localStorage device store. No network, no cloud — the exact
 * on-device architecture, just bound to a browser KVStore.
 */
const backend = createBackend(new LocalStorageKV());
const client = backend.client;

async function unwrap<T>(p: Promise<ApiResponse>): Promise<T> {
  const res = await p;
  if (res.status >= 400) {
    const msg = (res.body as { error?: string })?.error ?? `request failed (${res.status})`;
    throw new Error(msg);
  }
  return res.body as T;
}

export const api = {
  // Profile
  getProfile: () => unwrap<{ profile: UserProfile | null }>(client.get("/profile")),
  saveProfile: (p: UserProfile) => unwrap<{ profile: UserProfile }>(client.put("/profile", p)),

  // Goals
  listGoals: () => unwrap<{ goals: Goal[] }>(client.get("/goals")),
  createGoal: (g: Goal) => unwrap<{ goal: Goal }>(client.post("/goals", g)),
  updateGoal: (g: Goal) => unwrap<{ goal: Goal }>(client.put(`/goals/${g.id}`, g)),
  deleteGoal: (id: string) => unwrap<{ deleted: string }>(client.del(`/goals/${id}`)),
  explainGoal: async (id: string, today: string) =>
    (await unwrap<{ explanation: ScoreBreakdown }>(client.get(`/goals/${id}/explain?today=${today}`))).explanation,

  // Learning
  declarePriority: (category: string[], level: PriorityLevel) =>
    unwrap(client.post("/priorities", { category, level })),
  recordOutcome: (goalId: string, completed: boolean, date: string) =>
    unwrap(client.post("/outcomes", { goalId, completed, date })),
  listOutcomes: () =>
    unwrap<{ outcomes: OutcomeRecord[] }>(client.get("/outcomes")),

  // Scheduling
  plan: (horizon: Schedule["horizon"], from: string) =>
    unwrap<{ schedule: Schedule }>(client.post("/schedule/plan", { horizon, from })),
  latestSchedule: (horizon: Schedule["horizon"]) =>
    unwrap<{ schedule: Schedule | null }>(client.get(`/schedule?horizon=${horizon}`)),
  reschedule: (params: {
    horizon: Schedule["horizon"];
    from: string;
    replanFrom: string;
    missedDates: string[];
  }) =>
    unwrap<{ result: { schedule: Schedule; summary: string[] } }>(
      client.post("/schedule/reschedule", params),
    ),

  // Privacy
  eraseData: () => unwrap(client.del("/data")),
};

export type Api = typeof api;
