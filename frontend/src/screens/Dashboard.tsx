import { useMemo } from "react";
import type { AppData } from "../lib/useAppData";
import type { Tab } from "../App";
import { dur, hm, todayISO } from "../lib/format";
import { PRIORITY_COLOR } from "../lib/format";

export function Dashboard({ data, go }: { data: AppData; go: (t: Tab) => void }) {
  const today = todayISO();
  const day = data.schedule?.days.find((d) => d.date === today) ?? data.schedule?.days[0];

  // Success score = today's follow-through: minutes completed ÷ minutes planned.
  const done = data.completedTodayByGoal;
  const { score, plannedCount, doneCount } = useMemo(() => {
    const blocks = day?.blocks ?? [];
    let planned = 0, completed = 0, dc = 0;
    for (const b of blocks) {
      const mins = b.end - b.start;
      planned += mins;
      if (done[b.goalId]) { completed += mins; dc++; }
    }
    return {
      score: planned === 0 ? 0 : Math.round((completed / planned) * 100),
      plannedCount: blocks.length,
      doneCount: dc,
    };
  }, [day, done]);

  const weekMax = Math.max(1, ...(data.schedule?.days.map((d) => d.usedMinutes) ?? [1]));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="screen">
      <div className="header-row">
        <div>
          <div className="greeting">{greet} 👋</div>
          <div className="subtle">Let's crush your goals today.</div>
        </div>
      </div>

      <div className="card card-purple">
        <div className="row between">
          <div>
            <div className="card-title">Today's Plan</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{day ? new Date(day.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "—"}</div>
          </div>
          <div className="pill" style={{ background: "var(--accent-soft)", color: "var(--accent-2)" }}>
            {day?.blocks.length ?? 0} tasks
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          {day && day.blocks.length > 0 ? day.blocks.slice(0, 6).map((b, i) => {
            const isDone = !!done[b.goalId];
            return (
              <div className="plan-item" key={i} style={{ opacity: isDone ? 0.55 : 1 }}>
                <span className="dot" style={{ background: PRIORITY_COLOR[b.priorityLevel] }} />
                <span className="time">{hm(b.start)}</span>
                <span className="plan-title" style={{ textDecoration: isDone ? "line-through" : "none" }}>{b.title}</span>
                {isDone ? <span className="dur">✓</span> : <span className="dur">{dur(b.end - b.start)}</span>}
              </div>
            );
          }) : <div className="empty">No tasks scheduled today.</div>}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => go("calendar")}>
          View Full Schedule →
        </button>
      </div>

      <div className="card">
        <div className="ring-wrap">
          <Ring pct={score} />
          <div>
            <div style={{ fontWeight: 700 }}>Today's Progress</div>
            <div className="subtle">
              {plannedCount === 0
                ? "Nothing scheduled today."
                : `${doneCount} of ${plannedCount} done · ${score >= 70 ? "great follow-through!" : "keep going!"}`}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">This Week Overview</div>
        <div className="week-bars">
          {(data.schedule?.days ?? []).map((d, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div className="bar" style={{ height: `${Math.max(6, (d.usedMinutes / weekMax) * 60)}px` }} />
              <div className="lbl">{["S", "M", "T", "W", "T", "F", "S"][new Date(d.date + "T00:00:00Z").getUTCDay()]}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-ghost" onClick={() => go("reschedule")}>
        Recover missed days
      </button>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg width="58" height="58">
        <circle cx="29" cy="29" r={r} stroke="var(--stroke)" strokeWidth="6" fill="none" />
        <circle cx="29" cy="29" r={r} stroke="var(--accent)" strokeWidth="6" fill="none"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" />
      </svg>
      <div className="pct">{pct}%</div>
    </div>
  );
}
