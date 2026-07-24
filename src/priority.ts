/**
 * Priority scoring & hierarchical behaviour learning.
 *
 * Two responsibilities:
 *   1. learnPriority()  — ingest an explicit user signal (e.g. "football = 2")
 *      and propagate it up the taxonomy so that broader categories ("sports")
 *      absorb a prior, while the specific node keeps the sharpest estimate.
 *   2. scoreGoal()      — combine the learned/declared priority with deadline
 *      urgency and occupation/age heuristics into a single score used to order
 *      and allocate time.
 */

import {
  CategoryAffinity,
  CategoryPath,
  Goal,
  ISODate,
  LearningStore,
  PriorityLevel,
  UserProfile,
} from "./types";
import { trainedPriorLevel } from "./model/trainedPriors";

const NEUTRAL_PRIORITY = 3; // "Medium" when nothing is known.

function key(path: CategoryPath, depth?: number): string {
  return path.slice(0, depth).join("/");
}

function getNode(store: LearningStore, k: string): CategoryAffinity {
  return (
    store.affinities[k] ?? {
      priorityMean: NEUTRAL_PRIORITY,
      observations: 0,
      completionRate: 0.5,
      completionSamples: 0,
    }
  );
}

/**
 * Record an explicit priority the user assigned to a category path.
 *
 * The signal is applied to the specific node at full strength and to each
 * ancestor with geometrically decaying strength — so declaring
 * ["sports","football"] = 2 nudges "sports" toward 2 as well, but less firmly
 * than "football" itself. This is the "infer sports is level 2 from football"
 * behaviour, made bidirectional: a later ["sports","tennis"] = 4 signal will
 * pull the "sports" prior between the two, and a brand-new sport inherits that
 * blended prior until the user says otherwise.
 */
export function learnPriority(
  store: LearningStore,
  path: CategoryPath,
  level: PriorityLevel,
  ancestorDecay = 0.5,
): LearningStore {
  const affinities = { ...store.affinities };
  for (let depth = path.length; depth >= 1; depth--) {
    const k = key(path, depth);
    const node = getNode(store, k);
    // Strength of this observation at this depth: 1 at the leaf, decaying up.
    const strength = Math.pow(ancestorDecay, path.length - depth);
    const nextObs = node.observations + strength;
    const priorityMean =
      (node.priorityMean * node.observations + level * strength) / nextObs;
    affinities[k] = { ...node, priorityMean, observations: nextObs };
  }
  return { ...store, affinities };
}

/**
 * Record whether a goal in a category was completed. Feeds completionRate,
 * which subtly rewards categories the user actually follows through on.
 */
export function learnCompletion(
  store: LearningStore,
  path: CategoryPath,
  completed: boolean,
): LearningStore {
  const affinities = { ...store.affinities };
  for (let depth = path.length; depth >= 1; depth--) {
    const k = key(path, depth);
    const node = getNode(store, k);
    const n = node.completionSamples + 1;
    const completionRate =
      (node.completionRate * node.completionSamples + (completed ? 1 : 0)) / n;
    affinities[k] = { ...node, completionRate, completionSamples: n };
  }
  return { ...store, affinities };
}

/**
 * Resolve the effective priority level for a goal by walking the taxonomy from
 * specific to general with Bayesian shrinkage toward each ancestor's prior.
 * A declared priority on the goal itself wins outright.
 */
export function inferPriorityLevel(
  store: LearningStore,
  goal: Goal,
  trainedPrior: number | null = null,
): { level: number; completionRate: number } {
  if (goal.declaredPriority != null) {
    return {
      level: goal.declaredPriority,
      completionRate: getNode(store, key(goal.category)).completionRate,
    };
  }

  // Blend leaf → root. Deeper nodes carry more weight (their observations),
  // but a broad prior fills in when the leaf is unseen.
  let weightedSum = 0;
  let weightTotal = 0;
  let completionRate = 0.5;

  // Seed with the trained prior as a light pseudo-observation, so a brand-new
  // user starts from data-calibrated knowledge (their age/occupation/activity)
  // instead of a flat "neutral". Real behaviour accumulates real observations
  // and overrides this seed over time.
  if (trainedPrior != null) {
    const seed = TRAINED_SEED_WEIGHT;
    weightedSum += trainedPrior * seed;
    weightTotal += seed;
  }

  for (let depth = goal.category.length; depth >= 1; depth--) {
    const node = getNode(store, key(goal.category, depth));
    // Ancestors count less the further they are from the specific goal.
    const positional = Math.pow(0.6, goal.category.length - depth);
    const w = (node.observations + 0.001) * positional;
    weightedSum += node.priorityMean * w;
    weightTotal += w;
    if (node.completionSamples > 0 && depth === goal.category.length) {
      completionRate = node.completionRate;
    }
  }
  const fallback = trainedPrior ?? NEUTRAL_PRIORITY;
  const level = weightTotal > 0 ? weightedSum / weightTotal : fallback;
  return { level, completionRate };
}

/** How much a trained prior counts, in pseudo-observations, before real data. */
const TRAINED_SEED_WEIGHT = 1.5;

// ---------------------------------------------------------------------------
// Occupation / age heuristics
// ---------------------------------------------------------------------------

/**
 * Deprecated hand-tuned occupation/age nudges. Superseded by the trained priors
 * (see trainedPriorLevel), which learn these effects from ~600k users with far
 * less bias. Kept as a neutral no-op so the score breakdown shape is unchanged.
 */
export function contextMultiplier(
  _profile: UserProfile,
  _category: CategoryPath,
): number {
  return 1;
}

// ---------------------------------------------------------------------------
// Deadline urgency
// ---------------------------------------------------------------------------

function daysBetween(a: ISODate, b: ISODate): number {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

/** 1.0 when no deadline; grows as the deadline approaches, spikes when overdue. */
export function urgency(goal: Goal, today: ISODate): number {
  if (!goal.deadline) return 1;
  const remaining = daysBetween(today, goal.deadline);
  if (remaining < 0) {
    // A recurring goal's stale deadline is ignored (it would otherwise boost
    // every future occurrence forever); once-goals get the overdue spike.
    const recurring = goal.recurrence != null && goal.recurrence.kind !== "once";
    return recurring ? 1 : 3;
  }
  if (remaining === 0) return 2.5;
  // Smoothly ramp from ~1 (far) to ~2 (imminent) over a two-week horizon.
  return 1 + Math.min(1, 14 / (remaining + 14)) ;
}

// ---------------------------------------------------------------------------
// Final score
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  score: number;
  priorityLevel: PriorityLevel;
  priorityComponent: number;
  urgencyComponent: number;
  contextComponent: number;
  completionComponent: number;
}

/**
 * Combine everything into a single score. Higher = schedule sooner / protect
 * under time pressure. Priority level is the dominant term; urgency, context
 * and follow-through refine the ordering.
 */
export function scoreGoal(
  store: LearningStore,
  profile: UserProfile,
  goal: Goal,
  today: ISODate,
): ScoreBreakdown {
  // Data-driven prior from the trained model (age / occupation / activity).
  const trained = trainedPriorLevel(profile, goal.category);
  const { level, completionRate } = inferPriorityLevel(store, goal, trained);

  // Map priority level 1..5 → weight 5..1 so P1 scores highest.
  const priorityComponent = 6 - clamp(level, 1, 5);
  const urgencyComponent = urgency(goal, today);
  // Occupation/age/activity effects now come from the trained prior above, so
  // the old hand-tuned heuristic is neutral (kept for breakdown compatibility).
  const contextComponent = contextMultiplier(profile, goal.category);
  // Follow-through: mildly favour categories the user actually completes.
  const completionComponent = 0.85 + 0.3 * completionRate; // 0.85..1.15

  const score =
    priorityComponent *
    urgencyComponent *
    contextComponent *
    completionComponent;

  return {
    score,
    priorityLevel: clamp(Math.round(level), 1, 5) as PriorityLevel,
    priorityComponent,
    urgencyComponent,
    contextComponent,
    completionComponent,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
