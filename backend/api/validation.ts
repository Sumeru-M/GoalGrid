/**
 * Hand-rolled validators (zero dependencies). Each returns the typed value or
 * throws ValidationError with a field-scoped message. Kept small and explicit
 * so request parsing is auditable and safe to run on-device.
 */

import { ValidationError } from "../services/plannerService";
import {
  CommitmentBlock,
  Goal,
  Occupation,
  PriorityLevel,
  Recurrence,
  TimeOfDay,
  UserProfile,
} from "../../src/types";

function fail(msg: string): never {
  throw new ValidationError(msg);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) fail(`${field} must be a non-empty string`);
  return v;
}
function num(v: unknown, field: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== "number" || Number.isNaN(v)) fail(`${field} must be a number`);
  if (v < min || v > max) fail(`${field} must be between ${min} and ${max}`);
  return v;
}
function optNum(v: unknown, field: string, min = -Infinity, max = Infinity): number | undefined {
  return v === undefined ? undefined : num(v, field, min, max);
}

const OCCUPATIONS: Occupation[] = [
  "student", "professional", "self-employed", "unemployed", "retired", "other",
];
const TIMES: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(v: unknown, field: string): string {
  const s = str(v, field);
  if (!ISO_DATE.test(s)) fail(`${field} must be an ISO date (YYYY-MM-DD)`);
  return s;
}

export function priorityLevel(v: unknown, field: string): PriorityLevel {
  const n = num(v, field, 1, 5);
  if (!Number.isInteger(n)) fail(`${field} must be an integer 1..5`);
  return n as PriorityLevel;
}

export function categoryPath(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.length === 0) fail(`${field} must be a non-empty array`);
  return v.map((x, i) => str(x, `${field}[${i}]`).toLowerCase());
}

function commitment(v: unknown, i: number): CommitmentBlock {
  if (!isObj(v)) fail(`commitments[${i}] must be an object`);
  const kinds = ["work", "school", "sleep", "meal", "custom"];
  const kind = str(v.kind, `commitments[${i}].kind`);
  if (!kinds.includes(kind)) fail(`commitments[${i}].kind invalid`);
  const start = num(v.start, `commitments[${i}].start`, 0, 1440);
  const end = num(v.end, `commitments[${i}].end`, 0, 1440);
  if (end <= start) fail(`commitments[${i}].end must be after start`);
  return {
    id: str(v.id, `commitments[${i}].id`),
    label: str(v.label, `commitments[${i}].label`),
    start,
    end,
    kind: kind as CommitmentBlock["kind"],
    daysOfWeek: Array.isArray(v.daysOfWeek)
      ? v.daysOfWeek.map((d, j) => num(d, `commitments[${i}].daysOfWeek[${j}]`, 0, 6))
      : undefined,
  };
}

const ACTIVITY_LEVELS = ["low", "moderate", "high"];

export function userProfile(v: unknown): UserProfile {
  if (!isObj(v)) fail("body must be an object");
  const occupation = str(v.occupation, "occupation");
  if (!OCCUPATIONS.includes(occupation as Occupation)) fail("occupation invalid");
  if (!Array.isArray(v.commitments)) fail("commitments must be an array");
  if (v.activityLevel !== undefined && !ACTIVITY_LEVELS.includes(v.activityLevel as string))
    fail("activityLevel must be low | moderate | high");
  return {
    occupation: occupation as Occupation,
    age: num(v.age, "age", 5, 120),
    sleepHours: num(v.sleepHours, "sleepHours", 0, 16),
    commitments: v.commitments.map(commitment),
    maxPlanningHoursPerDay: optNum(v.maxPlanningHoursPerDay, "maxPlanningHoursPerDay", 0, 24),
    wakeTime: optNum(v.wakeTime, "wakeTime", 0, 1440),
    activityLevel: v.activityLevel as UserProfile["activityLevel"],
  };
}

function recurrence(v: unknown): Recurrence | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v)) fail("recurrence must be an object");
  switch (v.kind) {
    case "once": return { kind: "once" };
    case "daily": return { kind: "daily" };
    case "weekdays": return { kind: "weekdays" };
    case "weekly":
      if (!Array.isArray(v.daysOfWeek) || v.daysOfWeek.length === 0)
        fail("recurrence.daysOfWeek must be a non-empty array for weekly");
      return { kind: "weekly", daysOfWeek: v.daysOfWeek.map((d, i) => num(d, `recurrence.daysOfWeek[${i}]`, 0, 6)) };
    default: return fail("recurrence.kind invalid");
  }
}

export function goal(v: unknown, idFromPath?: string): Goal {
  if (!isObj(v)) fail("body must be an object");
  const timePreference = v.timePreference;
  if (timePreference !== undefined && !TIMES.includes(timePreference as TimeOfDay))
    fail("timePreference invalid");
  return {
    id: idFromPath ?? str(v.id, "id"),
    title: str(v.title, "title"),
    category: categoryPath(v.category, "category"),
    declaredPriority: v.declaredPriority === undefined ? undefined : priorityLevel(v.declaredPriority, "declaredPriority"),
    estimatedMinutes: num(v.estimatedMinutes, "estimatedMinutes", 1, 24 * 60),
    preferredSessionMinutes: optNum(v.preferredSessionMinutes, "preferredSessionMinutes", 1, 24 * 60),
    minSessionMinutes: optNum(v.minSessionMinutes, "minSessionMinutes", 1, 24 * 60),
    timePreference: timePreference as TimeOfDay | undefined,
    deadline: v.deadline === undefined ? undefined : isoDate(v.deadline, "deadline"),
    recurrence: recurrence(v.recurrence),
    droppable: typeof v.droppable === "boolean" ? v.droppable : undefined,
  };
}

export function horizon(v: unknown, field: string): "daily" | "weekly" | "monthly" | "yearly" {
  const s = str(v, field);
  if (!["daily", "weekly", "monthly", "yearly"].includes(s)) fail(`${field} invalid`);
  return s as "daily" | "weekly" | "monthly" | "yearly";
}

export function requireBoolean(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") fail(`${field} must be a boolean`);
  return v;
}

export function requireArray(v: unknown, field: string): unknown[] {
  if (!Array.isArray(v)) fail(`${field} must be an array`);
  return v;
}

export { num as requireNumber, str as requireString };
