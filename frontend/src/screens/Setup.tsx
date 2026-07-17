import { useState } from "react";
import { api } from "../lib/api";
import type {
  ActivityLevel,
  CommitmentBlock,
  Goal,
  Occupation,
  PriorityLevel,
  TimeOfDay,
  UserProfile,
} from "../../../src/types";

/** Activity templates the wizard can turn into goals. */
interface ActivityDraft {
  key: string;
  name: string;
  icon: string;
  color: string;
  category: string[];
  on: boolean;
  hours: number;
  time: TimeOfDay;
}

// Monochrome: icons sit on the neutral surface; the emoji itself carries identity.
const DEFAULT_ACTIVITIES: ActivityDraft[] = [
  { key: "study", name: "Study", icon: "📘", color: "var(--text)", category: ["study", "exams"], on: true, hours: 3, time: "morning" },
  { key: "gym", name: "Gym / Workout", icon: "🏋️", color: "var(--text)", category: ["health", "gym"], on: true, hours: 1, time: "afternoon" },
  { key: "football", name: "Football / Sports", icon: "⚽", color: "var(--text)", category: ["sports", "football"], on: true, hours: 1.5, time: "evening" },
  { key: "reading", name: "Hobbies / Leisure", icon: "🎨", color: "var(--text)", category: ["hobbies", "reading"], on: false, hours: 0.5, time: "night" },
];

const OCCUPATIONS: Occupation[] = ["student", "professional", "self-employed", "unemployed", "retired", "other"];
const TIMES: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — about you
  const [occupation, setOccupation] = useState<Occupation>("student");
  const [age, setAge] = useState(19);
  const [sleep, setSleep] = useState(8);
  const [commitHours, setCommitHours] = useState(6);
  const [activity, setActivity] = useState<ActivityLevel>("moderate");

  // Step 2 — hours per day
  const [hoursPerDay, setHoursPerDay] = useState(8);

  // Step 3 — activities
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);

  // Step 4 — priority order (top = highest). Derived from active activities.
  const active = activities.filter((a) => a.on);
  const [order, setOrder] = useState<string[]>(active.map((a) => a.key));

  const steps = ["About you", "Daily time", "Activities", "Priorities"];

  function toggleActivity(key: string) {
    setActivities((prev) => prev.map((a) => (a.key === key ? { ...a, on: !a.on } : a)));
  }
  function setHours(key: string, hours: number) {
    setActivities((prev) => prev.map((a) => (a.key === key ? { ...a, hours } : a)));
  }
  function setTime(key: string, time: TimeOfDay) {
    setActivities((prev) => prev.map((a) => (a.key === key ? { ...a, time } : a)));
  }

  function goStep3to4() {
    setOrder(activities.filter((a) => a.on).map((a) => a.key));
    setStep(3);
  }
  function move(key: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(key);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function finish() {
    setSaving(true);
    try {
      // Build a single work commitment block from declared commitment hours.
      const commitments: CommitmentBlock[] = commitHours > 0 ? [{
        id: "commit",
        label: occupation === "student" ? "College" : "Work",
        kind: occupation === "student" ? "school" : "work",
        start: 9 * 60,
        end: 9 * 60 + Math.round(commitHours * 60),
        daysOfWeek: [1, 2, 3, 4, 5],
      }] : [];

      const profile: UserProfile = {
        occupation, age, sleepHours: sleep,
        commitments,
        maxPlanningHoursPerDay: hoursPerDay,
        wakeTime: 7 * 60,
        activityLevel: activity,
      };
      await api.saveProfile(profile);

      // Create a goal per active activity.
      for (const a of activities.filter((x) => x.on)) {
        const goal: Goal = {
          id: a.key,
          title: a.name.split(" / ")[0],
          category: a.category,
          estimatedMinutes: Math.round(a.hours * 60),
          timePreference: a.time,
          recurrence: a.key === "study" ? { kind: "weekdays" } : { kind: "daily" },
        };
        await api.createGoal(goal);
      }

      // Teach the engine priorities from the ordered list (top = level 1).
      // We declare only the specific category; the engine infers the domain.
      const ordered = order
        .map((k) => activities.find((a) => a.key === k))
        .filter((a): a is ActivityDraft => !!a);
      for (let i = 0; i < ordered.length; i++) {
        const level = Math.min(5, i + 1) as PriorityLevel;
        await api.declarePriority(ordered[i].category, level);
      }

      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="header-row">
        <div className="logo">
          <span className="mark">✦</span>
          <h1>AI Planner Setup</h1>
        </div>
      </div>

      <div className="step-label">Step {step + 1} of 4 · {steps[step]}</div>
      <div className="stepper"><div style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>

      {step === 0 && (
        <div>
          <div className="q">Tell us about you</div>
          <label className="field">Occupation</label>
          <select value={occupation} onChange={(e) => setOccupation(e.target.value as Occupation)}>
            {OCCUPATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="field">Age</label>
          <input className="text" type="number" value={age} min={5} max={120}
                 onChange={(e) => setAge(Number(e.target.value))} />
          <label className="field">Sleep per night: <b>{sleep}h</b></label>
          <input type="range" min={4} max={12} step={0.5} value={sleep}
                 onChange={(e) => setSleep(Number(e.target.value))} />
          <label className="field">Daily commitments (work/school): <b>{commitHours}h</b></label>
          <input type="range" min={0} max={12} step={0.5} value={commitHours}
                 onChange={(e) => setCommitHours(Number(e.target.value))} />

          <label className="field">How active are you?</label>
          <div className="seg">
            {(["low", "moderate", "high"] as ActivityLevel[]).map((a) => (
              <button key={a} className={activity === a ? "on" : ""} onClick={() => setActivity(a)}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
          <div className="subtle">The AI tailors sport & fitness priority to this — being very active is always an asset, never a penalty.</div>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="q">How many hours can you dedicate per day?</div>
          <div className="card"><div className="card-title" style={{ textAlign: "center" }}>Total Available Time</div>
            <div className="counter">
              <button onClick={() => setHoursPerDay((h) => Math.max(2, h - 1))}>−</button>
              <div className="val">{hoursPerDay}<small>hours</small></div>
              <button onClick={() => setHoursPerDay((h) => Math.min(16, h + 1))}>+</button>
            </div>
            <input type="range" min={2} max={16} value={hoursPerDay}
                   onChange={(e) => setHoursPerDay(Number(e.target.value))} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="q">What are your main activities?</div>
          {activities.map((a) => (
            <div key={a.key} className="activity" style={{ opacity: a.on ? 1 : 0.5 }}>
              <span className="icon">{a.icon}</span>
              <span className="name">{a.name}</span>
              <input className="num-input" type="number" step={0.5} min={0} value={a.hours}
                     disabled={!a.on}
                     onChange={(e) => setHours(a.key, Number(e.target.value))} />
              <span className="dur">h</span>
              <input type="checkbox" checked={a.on} onChange={() => toggleActivity(a.key)}
                     style={{ width: 20, height: 20, accentColor: "var(--accent)" }} />
            </div>
          ))}
          <div className="subtle" style={{ marginTop: 8 }}>Set the time of day for each below.</div>
          {activities.filter((a) => a.on).map((a) => (
            <div key={a.key} style={{ marginTop: 12 }}>
              <div className="step-label">{a.name.split(" / ")[0]} time preference</div>
              <div className="seg">
                {TIMES.map((t) => (
                  <button key={t} className={a.time === t ? "on" : ""} onClick={() => setTime(a.key, t)}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="q">Set your priorities</div>
          <div className="subtle" style={{ marginBottom: 16 }}>Reorder — highest priority on top. The AI learns your preference per category.</div>
          {order.map((k, i) => {
            const a = activities.find((x) => x.key === k)!;
            return (
              <div key={k} className="prio-item">
                <span className="rank">{i + 1}</span>
                <span className="icon" style={{ color: a.color }}>{a.icon}</span>
                <span className="name">{a.name.split(" / ")[0]}</span>
                <div className="reorder">
                  <button onClick={() => move(k, -1)}>▲</button>
                  <button onClick={() => move(k, 1)}>▼</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 20 }}>
        {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 2 && <button className="btn" onClick={() => setStep(step + 1)}>Continue</button>}
        {step === 2 && <button className="btn" onClick={goStep3to4}>Continue</button>}
        {step === 3 && <button className="btn" disabled={saving} onClick={finish}>{saving ? "Building your plan…" : "Generate My Plan"}</button>}
      </div>
    </div>
  );
}
