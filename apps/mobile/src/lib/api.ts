import { createBackend } from "goalgrid-backend/index";
import type { ApiResponse } from "goalgrid-backend/api/router";
import type { OutcomeRecord } from "goalgrid-backend/storage/repositories";
import type { Goal, PriorityLevel, Schedule, UserProfile } from "goalgrid-core/types";
import type { ScoreBreakdown } from "goalgrid-core/priority";
import { AsyncStorageKV } from "../AsyncStorageKV";

/**
 * The mobile app talks to the SAME backend as the web app, in-process, against
 * an AsyncStorage device store. The only platform difference from the web
 * client is the KVStore implementation passed here.
 */
const backend = createBackend(new AsyncStorageKV());
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
  getProfile: () => unwrap<{ profile: UserProfile | null }>(client.get("/profile")),
  saveProfile: (p: UserProfile) => unwrap<{ profile: UserProfile }>(client.put("/profile", p)),

  listGoals: () => unwrap<{ goals: Goal[] }>(client.get("/goals")),
  createGoal: (g: Goal) => unwrap<{ goal: Goal }>(client.post("/goals", g)),
  updateGoal: (g: Goal) => unwrap<{ goal: Goal }>(client.put(`/goals/${g.id}`, g)),
  deleteGoal: (id: string) => unwrap<{ deleted: string }>(client.del(`/goals/${id}`)),
  explainGoal: async (id: string, today: string) =>
    (await unwrap<{ explanation: ScoreBreakdown }>(client.get(`/goals/${id}/explain?today=${today}`))).explanation,

  declarePriority: (category: string[], level: PriorityLevel) =>
    unwrap(client.post("/priorities", { category, level })),
  recordOutcome: (goalId: string, completed: boolean, date: string) =>
    unwrap(client.post("/outcomes", { goalId, completed, date })),
  listOutcomes: () => unwrap<{ outcomes: OutcomeRecord[] }>(client.get("/outcomes")),

  plan: (horizon: Schedule["horizon"], from: string) =>
    unwrap<{ schedule: Schedule }>(client.post("/schedule/plan", { horizon, from })),
  latestSchedule: (horizon: Schedule["horizon"]) =>
    unwrap<{ schedule: Schedule | null }>(client.get(`/schedule?horizon=${horizon}`)),
  reschedule: (params: { horizon: Schedule["horizon"]; from: string; replanFrom: string; missedDates: string[] }) =>
    unwrap<{ result: { schedule: Schedule; summary: string[] } }>(client.post("/schedule/reschedule", params)),

  eraseData: () => unwrap(client.del("/data")),
};

export type Api = typeof api;
