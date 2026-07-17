import { useEffect, useMemo, useState } from "react";
import type { AppData } from "../lib/useAppData";
import { api } from "../lib/api";
import { addDaysISO, dur, prettyDate, todayISO } from "../lib/format";

interface MissedDay {
  date: ISODateStr;
  outstandingMinutes: number;
  count: number;
  goalIds: string[];   // distinct goals with outstanding work that day
}
type ISODateStr = string;

/** Per-day decision: recover the work, or record it as already-done. */
type Decision = "reschedule" | "done";

const LOOKBACK_DAYS = 7; // how far back we reconstruct to look for missed days

/**
 * Reschedule screen. We only offer days that have *actually elapsed* (strictly
 * before today) and still have uncompleted work. Today is never treated as
 * missed — it isn't over yet. If nothing is outstanding, we say so.
 */
export function Reschedule({ data, back }: { data: AppData; back: () => void }) {
  const today = todayISO();
  const lookbackFrom = addDaysISO(today, -LOOKBACK_DAYS);

  const [loading, setLoading] = useState(true);
  const [missed, setMissed] = useState<MissedDay[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [summary, setSummary] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which (goalId) were completed on which past date.
  const completedByDate = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const o of data.outcomes) {
      if (!o.completed) continue;
      (map[o.date] ??= new Set()).add(o.goalId);
    }
    return map;
  }, [data.outcomes]);

  // Only count days from when the user actually started engaging with the app
  // (their earliest recorded activity). Without this, a user who onboarded today
  // would be told they "missed" every prior day — days they never used the app.
  const trackingStart = useMemo(() => {
    const dates = data.outcomes.map((o) => o.date).sort();
    return dates[0] ?? null;
  }, [data.outcomes]);

  // Reconstruct the plan over the recent past and find elapsed days that still
  // have outstanding (uncompleted) work.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // No history yet → nothing to reschedule (don't fabricate a backlog).
        if (!trackingStart) { if (!cancelled) { setMissed([]); setDecisions({}); } return; }
        const { schedule } = await api.plan("weekly", lookbackFrom);
        const days: MissedDay[] = [];
        for (const day of schedule.days) {
          if (day.date >= today) continue;          // only elapsed days
          if (day.date < trackingStart) continue;   // only since the user started
          const done = completedByDate[day.date] ?? new Set<string>();
          const outstanding = day.blocks.filter((b) => !done.has(b.goalId));
          const minutes = outstanding.reduce((s, b) => s + (b.end - b.start), 0);
          if (minutes > 0) {
            const goalIds = [...new Set(outstanding.map((b) => b.goalId))];
            days.push({ date: day.date, outstandingMinutes: minutes, count: goalIds.length, goalIds });
          }
        }
        if (cancelled) return;
        setMissed(days);
        // Default each day to "reschedule"; the user can flip any to "already did it".
        setDecisions(Object.fromEntries(days.map((d) => [d.date, "reschedule" as Decision])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't check your recent days.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lookbackFrom, today, completedByDate, trackingStart]);

  function setDecision(date: string, d: Decision) {
    setDecisions((prev) => ({ ...prev, [date]: d }));
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const doneDays = missed.filter((m) => decisions[m.date] === "done");
      const rescheduleDays = missed
        .filter((m) => decisions[m.date] !== "done")
        .map((m) => m.date)
        .sort();

      // "I already did it" → backfill completions for that date so the work is
      // NOT rescheduled and won't resurface as missed next time.
      let markedTasks = 0;
      for (const d of doneDays) {
        for (const goalId of d.goalIds) {
          await api.recordOutcome(goalId, true, d.date);
          markedTasks++;
        }
      }

      const lines: string[] = [];
      if (doneDays.length) {
        lines.push(`Marked ${markedTasks} task${markedTasks > 1 ? "s" : ""} across ` +
          `${doneDays.length} day${doneDays.length > 1 ? "s" : ""} as already completed`);
      }

      if (rescheduleDays.length) {
        const { result } = await api.reschedule({
          horizon: "weekly", from: lookbackFrom, replanFrom: today, missedDates: rescheduleDays,
        });
        data.setSchedule(result.schedule);
        lines.push(...result.summary);
      } else {
        lines.push("Nothing to reschedule — your upcoming days are unchanged.");
      }

      // Refresh completion history (without re-planning) so re-entry reflects the marks.
      await data.refreshOutcomes();
      setSummary(lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="header-row">
      <button className="back-btn" onClick={back}>←</button>
      <h1>Reschedule</h1>
      <span style={{ width: 20 }} />
    </div>
  );

  if (loading) {
    return <div className="screen">{header}<div className="empty">Checking your recent days…</div></div>;
  }

  // Nothing elapsed is outstanding → all caught up.
  if (!summary && missed.length === 0) {
    return (
      <div className="screen">
        {header}
        <div className="empty" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>You're all caught up</div>
          <div>No missed days in the past week — nothing to reschedule.</div>
        </div>
        {error && <div className="subtle" style={{ color: "var(--danger)", textAlign: "center" }}>{error}</div>}
      </div>
    );
  }

  const rescheduleCount = missed.filter((m) => decisions[m.date] !== "done").length;
  const doneCount = missed.filter((m) => decisions[m.date] === "done").length;
  const rescheduleMinutes = missed
    .filter((m) => decisions[m.date] !== "done")
    .reduce((s, m) => s + m.outstandingMinutes, 0);

  function actionLabel(): string {
    if (busy) return "Applying…";
    if (rescheduleCount && doneCount) return `Reschedule ${dur(rescheduleMinutes)} · mark ${doneCount} done`;
    if (rescheduleCount) return `Recover ${dur(rescheduleMinutes)} across upcoming days`;
    return `Mark ${doneCount} day${doneCount > 1 ? "s" : ""} as already done`;
  }

  return (
    <div className="screen">
      {header}

      {summary ? (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 6 }}>Reschedule Summary</div>
          {summary.map((line, i) => (
            <div className="summary-item" key={i}>
              <span className="check">✔</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="banner">
            <span className="ic">⚠️</span>
            <div>
              <div className="t">
                {missed.length === 1
                  ? `1 day looks unfinished (${prettyDate(missed[0].date)})`
                  : `${missed.length} days look unfinished in the past week`}
              </div>
              <div className="s">
                For each day, reschedule the work — or if you actually did it and just
                forgot to mark it, choose “I already did it” so it isn’t moved.
              </div>
            </div>
          </div>

          {missed.map((m) => {
            const dec = decisions[m.date] ?? "reschedule";
            return (
              <div key={m.date} className="prio-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                <div>
                  <div className="name">{prettyDate(m.date)}</div>
                  <div className="lvl">{m.count} task{m.count > 1 ? "s" : ""} · {dur(m.outstandingMinutes)} outstanding</div>
                </div>
                <div className="seg">
                  <button className={dec === "reschedule" ? "on" : ""} onClick={() => setDecision(m.date, "reschedule")}>
                    Reschedule
                  </button>
                  <button className={dec === "done" ? "on" : ""} onClick={() => setDecision(m.date, "done")}>
                    I already did it
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {error && <div className="subtle" style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      <button className="btn" disabled={busy} onClick={summary ? back : apply}>
        {summary ? "Done" : actionLabel()}
      </button>
    </div>
  );
}
