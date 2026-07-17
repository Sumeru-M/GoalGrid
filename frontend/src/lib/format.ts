import type { PriorityLevel } from "../../../src/types";

export function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function dur(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export function todayISO(): string {
  // Local calendar date — using UTC here would roll a user in a negative-offset
  // timezone into "tomorrow" during their evening.
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Add (or subtract) whole days to an ISO date, treating it as a calendar date. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

export const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  1: "var(--p1)", 2: "var(--p2)", 3: "var(--p3)", 4: "var(--p4)", 5: "var(--p5)",
};

// Numeric priority labels (P1 = highest .. P5 = lowest) — no qualitative words.
export const PRIORITY_NAME: Record<PriorityLevel, string> = {
  1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5",
};
