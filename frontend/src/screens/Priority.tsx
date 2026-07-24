import { useEffect, useState } from "react";
import type { AppData } from "../lib/useAppData";
import { api } from "../lib/api";
import { todayISO, PRIORITY_COLOR, PRIORITY_NAME } from "../lib/format";
import type { Goal, PriorityLevel } from "../../../src/types";

/**
 * Priority screen — reorder goals; the engine learns a level per category.
 * Reordering declares new priorities (top = highest) and re-plans on the fly.
 */
export function Priority({ data }: { data: AppData }) {
  const [ordered, setOrdered] = useState<Goal[]>([]);
  const [levels, setLevels] = useState<Record<string, PriorityLevel>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Initial order: by the engine's current score (desc).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
      const today = todayISO();
      const scored = await Promise.all(
        data.goals.map(async (g) => ({ g, ex: await api.explainGoal(g.id, today) })),
      );
      scored.sort((a, b) => b.ex.score - a.ex.score);
      setOrdered(scored.map((s) => s.g));
      if (cancelled) return;
      setLevels(Object.fromEntries(scored.map((s) => [s.g.id, s.ex.priorityLevel])));
      } catch (e) {
        if (!cancelled) setToast(e instanceof Error ? e.message : "Couldn't load priorities.");
      }
    })();
    return () => { cancelled = true; };
  }, [data.goals]);

  async function commit(next: Goal[]) {
    setOrdered(next);
    setBusy(true);
    try {
      // Explicit ordering is authoritative: set declaredPriority per position,
      // which the engine honours over inference. We persist only the goals whose
      // rank actually changed — no repeated learning signals that would
      // otherwise stiffen the model on every drag.
      const newLevels: Record<string, PriorityLevel> = {};
      for (let i = 0; i < next.length; i++) {
        const level = Math.min(5, i + 1) as PriorityLevel;
        newLevels[next[i].id] = level;
        if (next[i].declaredPriority !== level) {
          await api.updateGoal({ ...next[i], declaredPriority: level });
        }
      }
      setLevels(newLevels);
      await data.reload();
      setToast("Priorities updated — schedule re-planned");
      setTimeout(() => setToast(null), 1800);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Couldn't update priorities.");
      setTimeout(() => setToast(null), 1800);
    } finally {
      setBusy(false);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const copy = [...ordered];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    commit(copy);
  }

  return (
    <div className="screen">
      <div className="header-row"><h1>Priority</h1></div>
      <div className="subtle" style={{ marginBottom: 18 }}>
        Drag to reorder priority. The planner schedules higher-priority tasks first,
        and learns your preference across each category.
      </div>

      {ordered.map((g, i) => {
        const lvl = levels[g.id] ?? 3;
        return (
          <div key={g.id} className="prio-item">
            <span className="rank">{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div className="name">{g.title}</div>
              <div className="lvl" style={{ color: PRIORITY_COLOR[lvl] }}>{PRIORITY_NAME[lvl]}</div>
            </div>
            <div className="reorder">
              <button disabled={busy} onClick={() => move(i, -1)}>▲</button>
              <button disabled={busy} onClick={() => move(i, 1)}>▼</button>
            </div>
          </div>
        );
      })}
      {ordered.length === 0 && <div className="empty">Add goals to set priorities.</div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
