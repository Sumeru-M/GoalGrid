// Pure formatting helpers, ported from the web app (colours live in theme.ts).

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
  // Local calendar date (avoids UTC off-by-one in the evening).
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function weekdayLetter(iso: string): string {
  return ["S", "M", "T", "W", "T", "F", "S"][new Date(iso + "T00:00:00Z").getUTCDay()];
}
