import { useState } from "react";
import type { AppData } from "../lib/useAppData";
import { dur, hm } from "../lib/format";
import { PRIORITY_COLOR } from "../lib/format";

export function Calendar({ data }: { data: AppData }) {
  const days = data.schedule?.days ?? [];
  const [selected, setSelected] = useState(0);
  const day = days[selected];

  return (
    <div className="screen">
      <div className="header-row"><h1>Calendar</h1></div>

      <div className="row gap" style={{ overflowX: "auto", paddingBottom: 8 }}>
        {days.map((d, i) => {
          const date = new Date(d.date + "T00:00:00Z");
          const on = i === selected;
          return (
            <button key={d.date} onClick={() => setSelected(i)}
              style={{
                minWidth: 52, padding: "10px 6px", borderRadius: 14, cursor: "pointer",
                border: on ? "1px solid var(--accent)" : "1px solid var(--stroke)",
                background: on ? "var(--accent)" : "var(--card)",
                color: on ? "#fff" : "var(--muted)", textAlign: "center",
              }}>
              <div style={{ fontSize: 11 }}>{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()]}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{date.getUTCDate()}</div>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        {day && day.blocks.length > 0 ? day.blocks.map((b, i) => (
          <div className="plan-item" key={i}>
            <span className="time">{hm(b.start)}</span>
            <div style={{ flex: 1, background: "var(--card-2)", borderLeft: `3px solid ${PRIORITY_COLOR[b.priorityLevel]}`, borderRadius: 8, padding: "10px 12px" }}>
              <div className="row between">
                <span style={{ fontWeight: 600 }}>{b.title}</span>
                <span className="dur">{dur(b.end - b.start)}</span>
              </div>
              <div className="subtle" style={{ fontSize: 12 }}>{b.category.join(" › ")}</div>
            </div>
          </div>
        )) : <div className="empty">Nothing scheduled this day.</div>}
      </div>

      {day && (
        <div className="subtle" style={{ textAlign: "center" }}>
          {dur(day.usedMinutes)} planned of {dur(day.capacityMinutes)} free
        </div>
      )}
    </div>
  );
}
