/**
 * Route table: maps the REST surface onto PlannerService calls, validating
 * every request body at the boundary. This is the complete public API.
 *
 *   Profile
 *     GET    /profile
 *     PUT    /profile
 *   Goals
 *     GET    /goals
 *     POST   /goals
 *     GET    /goals/:id
 *     PUT    /goals/:id
 *     DELETE /goals/:id
 *     GET    /goals/:id/explain?today=YYYY-MM-DD
 *   Learning
 *     POST   /priorities            { category: string[], level: 1..5 }
 *     POST   /outcomes              { goalId, completed, date }
 *     GET    /outcomes              (completion history)
 *   Scheduling
 *     POST   /schedule/plan         { horizon, from }
 *     GET    /schedule?horizon=weekly
 *     POST   /schedule/reschedule   { horizon, from, replanFrom, missedDates[] }
 *   Privacy
 *     DELETE /data                  (erase everything on this device)
 *     GET    /health
 */

import { PlannerService } from "../services/plannerService";
import { ApiRequest, ok, Router } from "./router";
import * as v from "./validation";

export function buildRouter(service: PlannerService): Router {
  const r = new Router();

  // --- Health ---------------------------------------------------------
  r.get("/health", async () => ok({ status: "ok", storage: "on-device", time: new Date().toISOString() }));

  // --- Profile --------------------------------------------------------
  r.get("/profile", async () => {
    const p = await service.getProfile();
    return ok({ profile: p });
  });
  r.put("/profile", async (req: ApiRequest) => {
    const profile = v.userProfile(req.body);
    return ok({ profile: await service.saveProfile(profile) });
  });

  // --- Goals ----------------------------------------------------------
  r.get("/goals", async () => ok({ goals: await service.listGoals() }));

  r.post("/goals", async (req) => {
    const goal = v.goal(req.body);
    return ok({ goal: await service.upsertGoal(goal) }, 201);
  });

  r.get("/goals/:id", async (req) => ok({ goal: await service.getGoal(req.params.id) }));

  r.put("/goals/:id", async (req) => {
    const goal = v.goal(req.body, req.params.id);
    return ok({ goal: await service.upsertGoal(goal) });
  });

  r.delete("/goals/:id", async (req) => {
    await service.deleteGoal(req.params.id);
    return ok({ deleted: req.params.id });
  });

  r.get("/goals/:id/explain", async (req) => {
    const today = v.isoDate(req.query.today, "today");
    return ok({ explanation: await service.explainGoal(req.params.id, today) });
  });

  // --- Learning -------------------------------------------------------
  r.post("/priorities", async (req) => {
    const body = req.body as Record<string, unknown>;
    const category = v.categoryPath(body?.category, "category");
    const level = v.priorityLevel(body?.level, "level");
    await service.declarePriority(category, level);
    return ok({ learned: { category, level } });
  });

  r.post("/outcomes", async (req) => {
    const body = req.body as Record<string, unknown>;
    const goalId = v.requireString(body?.goalId, "goalId");
    const date = v.isoDate(body?.date, "date");
    const completed = v.requireBoolean(body?.completed, "completed");
    await service.recordOutcome({ goalId, completed, date });
    return ok({ recorded: { goalId, completed, date } });
  });

  r.get("/outcomes", async () => ok({ outcomes: await service.listOutcomes() }));

  // --- Scheduling -----------------------------------------------------
  r.post("/schedule/plan", async (req) => {
    const body = req.body as Record<string, unknown>;
    const horizon = v.horizon(body?.horizon, "horizon");
    const from = v.isoDate(body?.from, "from");
    return ok({ schedule: await service.plan(horizon, from) });
  });

  r.get("/schedule", async (req) => {
    const horizon = v.horizon(req.query.horizon ?? "weekly", "horizon");
    return ok({ schedule: await service.getLatestSchedule(horizon) });
  });

  r.post("/schedule/reschedule", async (req) => {
    const body = req.body as Record<string, unknown>;
    const horizon = v.horizon(body?.horizon, "horizon");
    const from = v.isoDate(body?.from, "from");
    const replanFrom = v.isoDate(body?.replanFrom, "replanFrom");
    const missedDates = v.requireArray(body?.missedDates, "missedDates").map((d, i) => v.isoDate(d, `missedDates[${i}]`));
    return ok({ result: await service.reschedule({ horizon, from, replanFrom, missedDates }) });
  });

  // --- Privacy --------------------------------------------------------
  r.delete("/data", async () => {
    await service.eraseAllData();
    return ok({ erased: true });
  });

  return r;
}
