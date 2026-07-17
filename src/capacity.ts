/**
 * Day-capacity model: turns a UserProfile into the concrete free intervals
 * available for planning on a given date, after removing sleep and commitments.
 */

import {
  CommitmentBlock,
  ISODate,
  MinuteOfDay,
  TimeOfDay,
  TIME_OF_DAY_WINDOWS,
  UserProfile,
} from "./types";

export interface FreeInterval {
  start: MinuteOfDay;
  end: MinuteOfDay;
}

const DAY = 24 * 60;

function dayOfWeek(date: ISODate): number {
  // UTC-based so date arithmetic and weekday checks never disagree across
  // machine timezones. Dates are calendar dates, not instants.
  return new Date(date + "T00:00:00Z").getUTCDay();
}

function appliesOn(block: CommitmentBlock, date: ISODate): boolean {
  if (!block.daysOfWeek || block.daysOfWeek.length === 0) return true;
  return block.daysOfWeek.includes(dayOfWeek(date));
}

/** Subtract a busy interval from a set of free intervals. */
function subtract(free: FreeInterval[], busyStart: number, busyEnd: number): FreeInterval[] {
  const out: FreeInterval[] = [];
  for (const f of free) {
    if (busyEnd <= f.start || busyStart >= f.end) {
      out.push(f); // no overlap
      continue;
    }
    if (busyStart > f.start) out.push({ start: f.start, end: busyStart });
    if (busyEnd < f.end) out.push({ start: busyEnd, end: f.end });
  }
  return out;
}

/**
 * Compute the discretionary free intervals for a date.
 *
 * Sleep is modelled as a block anchored at wakeTime: the day runs from wakeTime
 * for (24h − sleep), and everything outside that window is unavailable. Then
 * each applicable commitment is carved out. If maxPlanningHoursPerDay is set,
 * the returned capacity is additionally capped (see freeCapacityMinutes).
 */
export function freeIntervals(profile: UserProfile, date: ISODate): FreeInterval[] {
  const wake = profile.wakeTime ?? 7 * 60;
  const awakeMinutes = Math.max(0, DAY - profile.sleepHours * 60);
  const wakeEnd = Math.min(DAY, wake + awakeMinutes);

  let free: FreeInterval[] = [{ start: wake, end: wakeEnd }];

  for (const block of profile.commitments) {
    if (block.kind === "sleep") continue; // sleep already handled via wake window
    if (!appliesOn(block, date)) continue;
    free = subtract(free, block.start, block.end);
  }

  return free.filter((f) => f.end > f.start);
}

export function intervalMinutes(free: FreeInterval[]): number {
  return free.reduce((sum, f) => sum + (f.end - f.start), 0);
}

/**
 * Total discretionary minutes for the date, honouring an explicit
 * maxPlanningHoursPerDay cap if the user set one.
 */
export function freeCapacityMinutes(profile: UserProfile, date: ISODate): number {
  const raw = intervalMinutes(freeIntervals(profile, date));
  if (profile.maxPlanningHoursPerDay != null) {
    return Math.min(raw, profile.maxPlanningHoursPerDay * 60);
  }
  return raw;
}

/** Intersect free intervals with a time-of-day preference window. */
export function windowFor(pref: TimeOfDay | undefined, free: FreeInterval[]): FreeInterval[] {
  if (!pref) return free;
  const [ws, we] = TIME_OF_DAY_WINDOWS[pref];
  const out: FreeInterval[] = [];
  for (const f of free) {
    const s = Math.max(f.start, ws);
    const e = Math.min(f.end, we);
    if (e > s) out.push({ start: s, end: e });
  }
  return out;
}
