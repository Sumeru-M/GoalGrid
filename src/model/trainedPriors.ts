/**
 * Loads the trained priors (produced by training/train.py) and exposes lookups
 * the scoring layer uses as its data-driven fallback.
 *
 * The engine's priority resolution order is:
 *   declaredPriority  →  learned-from-behaviour  →  TRAINED PRIOR (here)  →  neutral
 *
 * Trained priors encode, from ~600k synthetic users, "how important is this
 * category, typically, for someone of this age / occupation / activity level".
 * Physical categories are keyed by age × activity so active people (any age)
 * inherit a high-priority prior rather than the age average.
 */
import model from "./trained-priors.json";
import { ActivityLevel, CategoryPath, Occupation, UserProfile } from "../types";

type CatMap = Record<string, number>;

const PHYSICAL = new Set(model.physicalCatsKeyedByAgeActivity);
const KNOWN = new Set<string>([
  ...model.occCatsKeyedByOccupationAge,
  ...model.physicalCatsKeyedByAgeActivity,
]);

export function ageBucketOf(age: number): string {
  if (age <= 17) return "14-17";
  if (age <= 22) return "18-22";
  if (age <= 29) return "23-29";
  if (age <= 39) return "30-39";
  if (age <= 49) return "40-49";
  if (age <= 59) return "50-59";
  if (age <= 64) return "60-64";
  return "65-70";
}

/**
 * Map the app's coarse Occupation onto the trained occupation labels. The model
 * distinguishes school "student" from "college_student"; the profile does not,
 * so we disambiguate by age.
 */
function occupationKey(profile: UserProfile): string {
  if (profile.occupation === "student" && profile.age >= 18) return "college_student";
  return profile.occupation as Occupation;
}

/** First element of the category path that the model actually knows about. */
function domainOf(category: CategoryPath): string | null {
  for (const part of category) {
    const p = part.toLowerCase();
    if (KNOWN.has(p)) return p;
  }
  return null;
}

/**
 * Trained prior priority level (1..5) for a goal, or null if the category is
 * outside the model's known set (caller then falls back to neutral).
 */
export function trainedPriorLevel(profile: UserProfile, category: CategoryPath): number | null {
  const domain = domainOf(category);
  if (!domain) return null;

  const bucket = ageBucketOf(profile.age);

  if (PHYSICAL.has(domain)) {
    const activity: ActivityLevel = profile.activityLevel ?? "moderate";
    const cell = (model.byAgeActivity as Record<string, Record<string, CatMap>>)[bucket]?.[activity];
    return cell?.[domain] ?? model.globalCategoryMean[domain as keyof typeof model.globalCategoryMean] ?? null;
  }

  const occ = occupationKey(profile);
  const cell = (model.byOccupationAge as Record<string, Record<string, CatMap>>)[occ]?.[bucket];
  return cell?.[domain] ?? model.globalCategoryMean[domain as keyof typeof model.globalCategoryMean] ?? null;
}

/** Typical activity score for an age bucket (mean/p50/p90), for "unusually active" context. */
export function activityNorm(age: number): { mean: number; p50: number; p90: number } | null {
  return (model.activityNormsByAgeBucket as Record<string, { mean: number; p50: number; p90: number }>)[
    ageBucketOf(age)
  ] ?? null;
}

export const trainedModelMeta = {
  version: model.version,
  trainedOn: model.trainedOn,
  scale: model.priorityScale,
};
