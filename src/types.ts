/**
 * GoalGrid AI Planner — Core domain types
 *
 * The engine ingests a UserProfile + a set of Goals/Tasks and produces a
 * prioritised, time-allocated Schedule. A LearningStore persists what the
 * engine infers about the user over time (category affinities, completion
 * behaviour) so that priority inference improves with use.
 */

// ---------------------------------------------------------------------------
// Time primitives
// ---------------------------------------------------------------------------

/** Minutes since local midnight (0 = 00:00, 1439 = 23:59). */
export type MinuteOfDay = number;

/** ISO date string, `YYYY-MM-DD`, interpreted in the user's local timezone. */
export type ISODate = string;

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/** Default local-time bounds for each part of the day, in minutes. */
export const TIME_OF_DAY_WINDOWS: Record<TimeOfDay, [MinuteOfDay, MinuteOfDay]> = {
  morning: [5 * 60, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 21 * 60],
  night: [21 * 60, 24 * 60],
};

/** A fixed, non-negotiable block in the day (work, class, sleep, meals). */
export interface CommitmentBlock {
  id: string;
  label: string;
  start: MinuteOfDay;
  end: MinuteOfDay;
  /** Days of week this recurs on (0 = Sunday). Empty = every day. */
  daysOfWeek?: number[];
  kind: "work" | "school" | "sleep" | "meal" | "custom";
}

// ---------------------------------------------------------------------------
// Priority taxonomy
// ---------------------------------------------------------------------------

/**
 * Numeric priority levels. Lower number = more important; 1 is the top priority.
 * Displayed to users as "P1".."P5" (numbers, not qualitative words).
 */
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
  5: "P5",
};

/**
 * A category path expresses the taxonomy the learner reasons over, from broad
 * domain to specific activity, e.g. ["sports", "football"] or
 * ["study", "exams", "calculus"]. The engine learns a weight at every node and
 * lets specifics inherit from their ancestors (a "football" preference informs
 * "sports" as a whole, and vice-versa).
 */
export type CategoryPath = string[];

// ---------------------------------------------------------------------------
// Goals & tasks
// ---------------------------------------------------------------------------

export type Recurrence =
  | { kind: "once" }
  | { kind: "daily" }
  | { kind: "weekly"; daysOfWeek: number[] }
  | { kind: "weekdays" };

/**
 * A Goal is what the user wants to achieve. It is expressed independently of
 * any particular day; the scheduler instantiates it into concrete TimeBlocks.
 */
export interface Goal {
  id: string;
  title: string;
  category: CategoryPath;

  /**
   * User-declared priority, if any. Optional on purpose: the engine can infer
   * priority from the category taxonomy + learned behaviour when omitted.
   */
  declaredPriority?: PriorityLevel;

  /** Total minutes of effort the goal needs to be considered complete. */
  estimatedMinutes: number;

  /** Preferred slice length per session (default = whole thing). */
  preferredSessionMinutes?: number;

  /** Minimum useful session length; the scheduler won't split below this. */
  minSessionMinutes?: number;

  timePreference?: TimeOfDay;

  /** Hard deadline. Goals past due are dropped with a warning. */
  deadline?: ISODate;

  recurrence?: Recurrence;

  /** If false, the scheduler may drop it under time pressure. Default true. */
  droppable?: boolean;
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

export type Occupation =
  | "student"
  | "professional"
  | "self-employed"
  | "unemployed"
  | "retired"
  | "other";

export interface UserProfile {
  occupation: Occupation;
  age: number;
  sleepHours: number;
  /** Fixed daily obligations (work/school/etc). Sleep may be provided here too. */
  commitments: CommitmentBlock[];
  /**
   * Optional cap on hours of *discretionary* planning time per day. If omitted
   * the engine derives it from 24h − sleep − commitments − buffer.
   */
  maxPlanningHoursPerDay?: number;
  /** Local wake time; used to bound the earliest schedulable minute. */
  wakeTime?: MinuteOfDay;
  /**
   * Self-reported physical activity level. Feeds the trained priors for physical
   * categories (sports/gym/health) so an unusually-active person — at ANY age —
   * inherits a high-priority prior instead of the age average. Defaults to
   * "moderate" when unset.
   */
  activityLevel?: ActivityLevel;
}

export type ActivityLevel = "low" | "moderate" | "high";

// ---------------------------------------------------------------------------
// Learning store
// ---------------------------------------------------------------------------

/** One learned node in the category tree. */
export interface CategoryAffinity {
  /** Running mean of the priority level the user assigns here (1..5). */
  priorityMean: number;
  /** How many observations back this mean (drives Bayesian shrinkage). */
  observations: number;
  /** Completion rate for goals in this category (0..1). */
  completionRate: number;
  completionSamples: number;
}

export interface LearningStore {
  /** Keyed by category path joined with "/". */
  affinities: Record<string, CategoryAffinity>;
  /** Global default priority when nothing else is known. */
  version: number;
}

export function emptyLearningStore(): LearningStore {
  return { affinities: {}, version: 1 };
}

// ---------------------------------------------------------------------------
// Scheduler output
// ---------------------------------------------------------------------------

export interface TimeBlock {
  goalId: string;
  title: string;
  category: CategoryPath;
  date: ISODate;
  start: MinuteOfDay;
  end: MinuteOfDay;
  /** Priority score the scheduler used to place this block (higher = sooner). */
  score: number;
  priorityLevel: PriorityLevel;
}

export interface DaySchedule {
  date: ISODate;
  blocks: TimeBlock[];
  /** Minutes of discretionary capacity that day. */
  capacityMinutes: number;
  usedMinutes: number;
}

export interface UnscheduledGoal {
  goalId: string;
  title: string;
  reason: "past-deadline" | "insufficient-capacity" | "no-slot-in-window";
  minutesShort: number;
}

export interface Schedule {
  horizon: "daily" | "weekly" | "monthly" | "yearly";
  from: ISODate;
  to: ISODate;
  days: DaySchedule[];
  unscheduled: UnscheduledGoal[];
}
