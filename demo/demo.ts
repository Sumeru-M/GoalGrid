/**
 * End-to-end demo mirroring the "AI Planner" app screens (Arjun, a student).
 * Run with: npm run demo
 */

import { AIPlannerEngine } from "../src/engine";
import { CommitmentBlock, Goal, MinuteOfDay, UserProfile } from "../src/types";

function hm(m: MinuteOfDay): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${ap}`;
}

// --- 1. User profile (Setup screens 1–4) ----------------------------------
const commitments: CommitmentBlock[] = [
  { id: "college", label: "College", kind: "school", start: 9 * 60, end: 15 * 60, daysOfWeek: [1, 2, 3, 4, 5] },
  { id: "lunch", label: "Lunch", kind: "meal", start: 13 * 60, end: 13 * 60 + 30 },
];

const profile: UserProfile = {
  occupation: "student",
  age: 19,
  sleepHours: 8,
  wakeTime: 6 * 60 + 30,
  commitments,
  maxPlanningHoursPerDay: 8, // "How many hours can you dedicate per day?"
};

const engine = new AIPlannerEngine(profile);

// --- 2. User declares priorities (Setup step 4 / Priority screen) ---------
// Note we teach only the *specific* activities; the engine infers the domains.
engine.declarePriority(["study", "exams"], 1);       // Study = Highest
engine.declarePriority(["health", "gym"], 2);        // Gym / Health = High
engine.declarePriority(["sports", "football"], 3);   // Football = Medium
engine.declarePriority(["hobbies", "reading"], 4);   // Hobbies = Low

// The engine now has a prior for "sports" as a whole. A brand-new sport with
// no explicit priority inherits it:
const cricket: Goal = {
  id: "cricket", title: "Cricket practice", category: ["sports", "cricket"],
  estimatedMinutes: 60, timePreference: "evening", recurrence: { kind: "weekly", daysOfWeek: [6] },
};
console.log("Inferred priority for an unseen sport (cricket):",
  engine.explain(cricket, "2024-05-22").priorityLevel, "(learned from football → sports)\n");

// --- 3. Goals ------------------------------------------------------------
const goals: Goal[] = [
  { id: "calculus", title: "Calculus Study", category: ["study", "exams", "calculus"],
    estimatedMinutes: 120, preferredSessionMinutes: 120, timePreference: "morning",
    deadline: "2024-05-25", recurrence: { kind: "weekdays" } },
  { id: "physics", title: "Physics Study", category: ["study", "exams", "physics"],
    estimatedMinutes: 90, timePreference: "morning", recurrence: { kind: "weekdays" } },
  { id: "gym", title: "Gym", category: ["health", "gym"],
    estimatedMinutes: 90, timePreference: "afternoon", recurrence: { kind: "daily" } },
  { id: "football", title: "Football Practice", category: ["sports", "football"],
    estimatedMinutes: 120, timePreference: "evening", recurrence: { kind: "weekly", daysOfWeek: [1, 3, 5] } },
  { id: "revision", title: "Revision", category: ["study", "exams"],
    estimatedMinutes: 60, timePreference: "night", recurrence: { kind: "daily" } },
  cricket,
];

// --- 4. Weekly plan ------------------------------------------------------
const schedule = engine.plan(goals, { horizon: "weekly", from: "2024-05-22" });

console.log("═══ WEEKLY SCHEDULE ═══");
for (const day of schedule.days) {
  const used = (day.usedMinutes / 60).toFixed(1);
  const cap = (day.capacityMinutes / 60).toFixed(1);
  console.log(`\n${day.date}  (${used}h / ${cap}h used)`);
  for (const b of day.blocks) {
    console.log(`  ${hm(b.start)}–${hm(b.end)}  ${b.title.padEnd(18)} [P${b.priorityLevel}]`);
  }
}
if (schedule.unscheduled.length) {
  console.log("\nUnscheduled:", schedule.unscheduled);
}

// --- 5. Reschedule after a missed day (Reschedule screen) -----------------
console.log("\n\n═══ RESCHEDULE (missed Tue 21 May) ═══");
const { summary } = engine.reschedule(
  goals,
  { horizon: "weekly", from: "2024-05-22" },
  { missedDates: ["2024-05-22"], replanFrom: "2024-05-23", completedMinutes: {} },
);
for (const line of summary) console.log("  ✓ " + line);
