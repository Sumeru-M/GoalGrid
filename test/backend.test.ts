/**
 * Backend integration tests — drive the real router end to end over an
 * in-memory device store. Run with: npm run test:backend
 */

import { createBackend, MemoryKVStore } from "../backend/index";

let passed = 0, failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.error("  ✗ " + name); }
}

const profile = {
  occupation: "student", age: 19, sleepHours: 8, wakeTime: 390,
  maxPlanningHoursPerDay: 8,
  commitments: [{ id: "c", label: "College", kind: "school", start: 540, end: 900, daysOfWeek: [1,2,3,4,5] }],
};

async function main() {
  const kv = new MemoryKVStore();
  const { client, store } = createBackend(kv);

  console.log("Profile lifecycle:");
  {
    const before = await client.get("/profile");
    ok("no profile initially", (before.body as any).profile === null);
    const put = await client.put("/profile", profile);
    ok("PUT /profile succeeds", put.status === 200);
    const bad = await client.put("/profile", { ...profile, age: 999 });
    ok("invalid age rejected with 400", bad.status === 400);
    const persisted = await store.profile.get();
    ok("profile persisted to device store", persisted?.age === 19);
  }

  console.log("\nGoal CRUD + validation:");
  {
    const create = await client.post("/goals", {
      id: "calc", title: "Calculus", category: ["study", "exams", "calculus"],
      estimatedMinutes: 120, timePreference: "morning", recurrence: { kind: "weekdays" },
    });
    ok("POST /goals returns 201", create.status === 201);
    const missing = await client.post("/goals", { id: "x", title: "X" });
    ok("goal without category/minutes rejected", missing.status === 400);
    const list = await client.get("/goals");
    ok("goal appears in list", (list.body as any).goals.length === 1);
    const notFound = await client.get("/goals/nope");
    ok("unknown goal → 404", notFound.status === 404);
    const del = await client.del("/goals/calc");
    ok("DELETE /goals/:id works", del.status === 200);
    const delAgain = await client.del("/goals/calc");
    ok("deleting twice → 404", delAgain.status === 404);
  }

  console.log("\nLearning + scheduling through the API:");
  {
    await client.post("/priorities", { category: ["study", "exams"], level: 1 });
    await client.post("/priorities", { category: ["sports", "football"], level: 3 });
    // Unseen sport should inherit the learned sports prior in its explanation.
    await client.post("/goals", {
      id: "cricket", title: "Cricket", category: ["sports", "cricket"],
      estimatedMinutes: 60, recurrence: { kind: "weekly", daysOfWeek: [6] },
    });
    await client.post("/goals", {
      id: "study", title: "Study", category: ["study", "exams"],
      estimatedMinutes: 120, timePreference: "morning", recurrence: { kind: "weekdays" },
    });
    const explain = await client.get("/goals/cricket/explain?today=2024-05-22");
    const lvl = (explain.body as any).explanation.priorityLevel;
    ok("unseen sport inherits learned priority (≈3)", lvl >= 2 && lvl <= 4);

    const plan = await client.post("/schedule/plan", { horizon: "weekly", from: "2024-05-20" });
    ok("POST /schedule/plan returns a schedule", plan.status === 200 && (plan.body as any).schedule.days.length === 7);

    const cached = await client.get("/schedule?horizon=weekly");
    ok("GET /schedule returns the cached plan", (cached.body as any).schedule.horizon === "weekly");

    // Priority ordering: study (P1) placed before cricket in the week.
    const days = (plan.body as any).schedule.days;
    const hasStudy = days.some((d: any) => d.blocks.some((b: any) => b.goalId === "study"));
    ok("high-priority study is scheduled", hasStudy);
  }

  console.log("\nOutcomes + reschedule + privacy erase:");
  {
    // Completed on Fri 17th (a real session), then genuinely missed Mon 20th.
    const out = await client.post("/outcomes", { goalId: "study", completed: true, date: "2024-05-17" });
    ok("POST /outcomes records completion", out.status === 200);
    const badOut = await client.post("/outcomes", { goalId: "study", completed: "yes", date: "2024-05-17" });
    ok("non-boolean completed rejected", badOut.status === 400);

    const resched = await client.post("/schedule/reschedule", {
      horizon: "weekly", from: "2024-05-20", replanFrom: "2024-05-21", missedDates: ["2024-05-20"],
    });
    ok("reschedule returns schedule + summary", resched.status === 200 && Array.isArray((resched.body as any).result.summary));
    const summary = (resched.body as any).result.summary as string[];
    ok("reschedule recovers missed recurring work (not 'on track')", summary.some((l) => /catch-up/i.test(l)));

    const outcomes = await client.get("/outcomes");
    ok("GET /outcomes returns recorded history", (outcomes.body as any).outcomes.length >= 1);

    // Rapid multi-outcome backfill must not collide (same-ms key overwrite bug).
    await client.post("/goals", { id: "g-a", title: "A", category: ["study"], estimatedMinutes: 30, recurrence: { kind: "daily" } });
    await client.post("/goals", { id: "g-b", title: "B", category: ["health"], estimatedMinutes: 30, recurrence: { kind: "daily" } });
    const nBefore = ((await client.get("/outcomes")).body as any).outcomes.length;
    await Promise.all([
      client.post("/outcomes", { goalId: "g-a", completed: true, date: "2024-05-18" }),
      client.post("/outcomes", { goalId: "g-b", completed: true, date: "2024-05-18" }),
    ]);
    const nAfter = ((await client.get("/outcomes")).body as any).outcomes.length;
    ok("two same-instant completions both persist", nAfter === nBefore + 2);

    const erase = await client.del("/data");
    ok("DELETE /data erases device store", erase.status === 200);
    const after = await client.get("/goals");
    ok("goals empty after erase", (after.body as any).goals.length === 0);
  }

  console.log("\nCorrupt-record resilience:");
  {
    const kv2 = new MemoryKVStore();
    const { client } = createBackend(kv2);
    await client.put("/profile", profile);
    await client.post("/goals", { id: "ok", title: "OK", category: ["study"], estimatedMinutes: 60, recurrence: { kind: "daily" } });
    // Simulate a corrupted record written directly to the device store.
    await kv2.set("goal:bad", "{not valid json");
    const list = await client.get("/goals");
    ok("corrupt goal is skipped, valid goals still load", (list.body as any).goals.length === 1);
    const health = await client.get("/health");
    ok("app stays responsive despite corruption", health.status === 200);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
