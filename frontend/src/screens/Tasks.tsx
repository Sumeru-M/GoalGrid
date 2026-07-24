import { useState } from "react";
import type { AppData } from "../lib/useAppData";
import type { Tab } from "../App";
import { api } from "../lib/api";
import { dur, todayISO, PRIORITY_COLOR } from "../lib/format";

export function Tasks({ data, go }: { data: AppData; go: (t: Tab) => void }) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function markDone(goalId: string) {
    setBusy(goalId);
    try {
      await api.recordOutcome(goalId, true, todayISO());
      // refreshOutcomes (not reload) so a just-applied catch-up plan survives.
      await data.refreshOutcomes();
      flash("Marked done — the AI noted your follow-through");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(goalId: string) {
    setBusy(goalId);
    try {
      await api.deleteGoal(goalId);
      await data.reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't delete. Try again.");
    } finally {
      setBusy(null);
    }
  }

  // Map goal → its level from the current schedule blocks.
  const levelOf: Record<string, number> = {};
  for (const d of data.schedule?.days ?? [])
    for (const b of d.blocks) levelOf[b.goalId] = b.priorityLevel;

  const done = data.completedTodayByGoal;

  return (
    <div className="screen">
      <div className="header-row">
        <h1>Tasks</h1>
        <button className="btn" style={{ width: "auto", padding: "9px 16px" }} onClick={() => go("add")}>+ Add</button>
      </div>

      {data.goals.length === 0 && <div className="empty">No goals yet. Tap “Add” to create one.</div>}

      {data.goals.map((g) => (
        <div key={g.id} className="card" style={{ padding: 14 }}>
          <div className="row between">
            <div className="row gap">
              <span className="dot" style={{ background: PRIORITY_COLOR[(levelOf[g.id] ?? 3) as 1] }} />
              <div>
                <div style={{ fontWeight: 600 }}>{g.title}</div>
                <div className="subtle" style={{ fontSize: 12 }}>
                  {g.category.join(" › ")} · {dur(g.estimatedMinutes)}{g.timePreference ? ` · ${g.timePreference}` : ""}
                </div>
              </div>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy === g.id || done[g.id]} onClick={() => markDone(g.id)}>
              {done[g.id] ? "✓ Done today" : "Mark as Done"}
            </button>
            <button className="btn btn-ghost" disabled={busy === g.id} onClick={() => remove(g.id)}>Delete</button>
          </div>
        </div>
      ))}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
