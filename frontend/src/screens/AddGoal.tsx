import { useState } from "react";
import type { AppData } from "../lib/useAppData";
import { api } from "../lib/api";
import type { Goal, TimeOfDay } from "../../../src/types";

const TIMES: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];

/** Lightweight goal creator. Category is entered as "domain > sub" so the
 *  engine's taxonomy learning applies (e.g. "sports > tennis"). */
export function AddGoal({ data, back }: { data: AppData; back: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("study > general");
  const [hours, setHours] = useState(1);
  const [time, setTime] = useState<TimeOfDay>("morning");
  const [recurrence, setRecurrence] = useState<"daily" | "weekdays" | "once">("daily");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      // Always append a short unique suffix so two goals with the same title
      // don't collide and silently overwrite one another.
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20).replace(/^-|-$/g, "");
      const goal: Goal = {
        id: `${slug || "goal"}-${Math.random().toString(36).slice(2, 7)}`,
        title: title.trim(),
        category: category.split(">").map((s) => s.trim().toLowerCase()).filter(Boolean),
        estimatedMinutes: Math.round(hours * 60),
        timePreference: time,
        recurrence: { kind: recurrence } as Goal["recurrence"],
      };
      await api.createGoal(goal);
      await data.reload();
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save goal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="header-row">
        <button className="back-btn" onClick={back}>←</button>
        <h1>New Goal</h1>
        <span style={{ width: 20 }} />
      </div>

      <label className="field">Title</label>
      <input className="text" value={title} placeholder="e.g. Tennis practice"
             onChange={(e) => setTitle(e.target.value)} />

      <label className="field">Category (domain &gt; specific)</label>
      <input className="text" value={category} placeholder="sports > tennis"
             onChange={(e) => setCategory(e.target.value)} />

      <label className="field">Time per session: <b>{hours}h</b></label>
      <input type="range" min={0.5} max={6} step={0.5} value={hours}
             onChange={(e) => setHours(Number(e.target.value))} />

      <label className="field">Preferred time of day</label>
      <div className="seg">
        {TIMES.map((t) => (
          <button key={t} className={time === t ? "on" : ""} onClick={() => setTime(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <label className="field">Repeats</label>
      <div className="seg">
        {(["daily", "weekdays", "once"] as const).map((r) => (
          <button key={r} className={recurrence === r ? "on" : ""} onClick={() => setRecurrence(r)}>
            {r[0].toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="subtle" style={{ color: "var(--red)", marginTop: 12 }}>{error}</div>}

      <button className="btn" style={{ marginTop: 22 }} disabled={saving || !title.trim()} onClick={save}>
        {saving ? "Saving…" : "Add Goal"}
      </button>
    </div>
  );
}
