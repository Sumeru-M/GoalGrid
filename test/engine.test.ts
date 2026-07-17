/**
 * Lightweight assertion tests (no framework). Run with: npm test
 */

import { AIPlannerEngine } from "../src/engine";
import { inferPriorityLevel, learnPriority } from "../src/priority";
import { emptyLearningStore, Goal, UserProfile } from "../src/types";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean) {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.error("  ✗ " + name); }
}
function approx(a: number, b: number, eps = 0.5) { return Math.abs(a - b) <= eps; }

const profile: UserProfile = {
  occupation: "student", age: 20, sleepHours: 8, wakeTime: 420,
  commitments: [{ id: "c", label: "College", kind: "school", start: 540, end: 900, daysOfWeek: [1,2,3,4,5] }],
};

console.log("Hierarchical priority learning:");
{
  let store = emptyLearningStore();
  store = learnPriority(store, ["sports", "football"], 2);
  // The domain "sports" should absorb a prior near 2.
  const domain = store.affinities["sports"];
  ok("declaring football=2 nudges the sports domain toward 2", approx(domain.priorityMean, 2, 1));

  // An unseen sport inherits the domain prior.
  const tennis: Goal = { id: "t", title: "Tennis", category: ["sports", "tennis"], estimatedMinutes: 60 };
  const inferred = inferPriorityLevel(store, tennis).level;
  ok("unseen sport (tennis) inherits ~level 2 from sports", approx(inferred, 2, 1));

  // A second, different signal pulls the domain between the two.
  store = learnPriority(store, ["sports", "chess"], 4);
  const domain2 = store.affinities["sports"].priorityMean;
  ok("adding chess=4 moves the sports prior between 2 and 4", domain2 > 2 && domain2 < 4);

  // Declared priority always overrides inference.
  const declared: Goal = { id: "d", title: "X", category: ["sports", "tennis"], estimatedMinutes: 60, declaredPriority: 5 };
  ok("declared priority overrides learned inference", inferPriorityLevel(store, declared).level === 5);
}

console.log("\nScheduling respects priority order & capacity:");
{
  const engine = new AIPlannerEngine(profile);
  engine.declarePriority(["study"], 1);
  engine.declarePriority(["hobbies"], 5);
  const goals: Goal[] = [
    { id: "study", title: "Study", category: ["study"], estimatedMinutes: 120, recurrence: { kind: "daily" } },
    { id: "hobby", title: "Hobby", category: ["hobbies"], estimatedMinutes: 120, recurrence: { kind: "daily" } },
  ];
  const s = engine.plan(goals, { horizon: "daily", from: "2024-05-20" }); // a Monday
  const day = s.days[0];
  const studyBlock = day.blocks.find((b) => b.goalId === "study");
  const hobbyBlock = day.blocks.find((b) => b.goalId === "hobby");
  ok("higher-priority study is placed", !!studyBlock);
  ok("study starts no later than hobby", !!studyBlock && (!hobbyBlock || studyBlock.start <= hobbyBlock.start));
  ok("used time never exceeds capacity", day.usedMinutes <= day.capacityMinutes);
}

console.log("\nCapacity math (sleep + commitments removed):");
{
  const engine = new AIPlannerEngine(profile);
  const g: Goal = { id: "x", title: "Big", category: ["study"], estimatedMinutes: 10000, recurrence: { kind: "once" }, minSessionMinutes: 30 };
  const s = engine.plan([g], { horizon: "daily", from: "2024-05-20" });
  // Monday: awake 16h (07:00–23:00), college 9–15 removed => 10h free.
  ok("free capacity on a weekday is ~10h", approx(s.days[0].capacityMinutes, 600, 1));
  ok("oversized goal reported as unscheduled shortfall", s.unscheduled.length === 1 && s.unscheduled[0].minutesShort > 0);
}

console.log("\nDeadline urgency ordering:");
{
  const engine = new AIPlannerEngine(profile);
  const soon: Goal = { id: "soon", title: "Soon", category: ["work"], estimatedMinutes: 60, deadline: "2024-05-21" };
  const later: Goal = { id: "later", title: "Later", category: ["work"], estimatedMinutes: 60, deadline: "2024-06-30" };
  const a = engine.explain(soon, "2024-05-20").score;
  const b = engine.explain(later, "2024-05-20").score;
  ok("nearer deadline scores higher at equal priority", a > b);
}

console.log("\nShort goals (< default min session) still schedule:");
{
  const engine = new AIPlannerEngine(profile);
  const g: Goal = { id: "vitamins", title: "Vitamins", category: ["health"], estimatedMinutes: 10, recurrence: { kind: "daily" } };
  const s = engine.plan([g], { horizon: "daily", from: "2024-05-20" });
  const placed = s.days[0].blocks.find((b) => b.goalId === "vitamins");
  ok("a 10-minute goal is scheduled", !!placed && placed.end - placed.start === 10);
  ok("short goal is not reported unscheduled", s.unscheduled.length === 0);
}

console.log("\nReschedule recovers missed recurring work:");
{
  const engine = new AIPlannerEngine(profile);
  engine.declarePriority(["study"], 1);
  const goals: Goal[] = [
    { id: "study", title: "Study", category: ["study"], estimatedMinutes: 120, recurrence: { kind: "daily" } },
  ];
  const from = "2024-05-20"; // Monday
  const { schedule, summary } = engine.reschedule(
    goals,
    { horizon: "weekly", from },
    { missedDates: [from], replanFrom: "2024-05-21", completedMinutes: {} },
  );
  const hasCatchUp = schedule.days.some((d) => d.blocks.some((b) => b.goalId === "study__catchup"));
  ok("missed study is re-injected as catch-up work", hasCatchUp);
  ok("summary reports the recovery (not 'on track')", summary.some((l) => /catch-up/i.test(l)));
}

console.log("\nTrained priors shape decisions by age / occupation / activity:");
{
  const base = (over: Partial<UserProfile>): UserProfile => ({
    occupation: "student", age: 16, sleepHours: 8, commitments: [], ...over,
  });
  const studyGoal: Goal = { id: "s", title: "Study", category: ["study", "exams"], estimatedMinutes: 60 };
  const healthGoal: Goal = { id: "h", title: "Health", category: ["health"], estimatedMinutes: 60 };
  const sportGoal: Goal = { id: "sp", title: "Football", category: ["sports", "football"], estimatedMinutes: 60 };

  // Fresh engines (no behaviour learned) — priorityLevel reflects the trained prior.
  const teen = new AIPlannerEngine(base({ occupation: "student", age: 16 }));
  ok("teen student: study is high priority (P1–P2)", teen.explain(studyGoal, "2024-05-20").priorityLevel <= 2);

  const retiree = new AIPlannerEngine(base({ occupation: "retired", age: 68 }));
  ok("retiree: health is high priority (P1–P2)", retiree.explain(healthGoal, "2024-05-20").priorityLevel <= 2);
  ok("retiree: study is low priority (P4–P5)", retiree.explain(studyGoal, "2024-05-20").priorityLevel >= 4);

  // Active outliers must NOT be penalised: an active 65-year-old should rank
  // sport higher than a sedentary peer of the same age.
  const activeSenior = new AIPlannerEngine(base({ occupation: "retired", age: 65, activityLevel: "high" }));
  const sedentarySenior = new AIPlannerEngine(base({ occupation: "retired", age: 65, activityLevel: "low" }));
  const activeScore = activeSenior.explain(sportGoal, "2024-05-20").score;
  const sedScore = sedentarySenior.explain(sportGoal, "2024-05-20").score;
  ok("active senior ranks sport above sedentary peer", activeScore > sedScore);
  ok("active senior's sport is genuinely high priority", activeSenior.explain(sportGoal, "2024-05-20").priorityLevel <= 3);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
