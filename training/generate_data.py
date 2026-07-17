#!/usr/bin/env python3
"""
GoalGrid — synthetic population generator for training the planner's priors.

Design goals (senior AI trainer notes):
  * ~600k rows, ages 14-70, both genders, balanced by age & gender so per-stratum
    estimates have low variance and no age/gender coverage bias.
  * Distributions consistent with real-world norms: schooling years, college
    attendance, unemployment by age, retirement ages, corporate vs non-corporate
    work culture, and age-appropriate sleep/commitment hours.
  * Activity level is a latent that rises the priority of physical categories.
    Crucially it has an UPPER-TAIL boost at every age, so "unusually active"
    people exist across the lifespan — the trainer must reward, not penalise them.
  * Priorities are generated INDEPENDENT of gender, so a fair model learns no
    gender bias (a deliberate low-bias property we later verify).

Output: training/data/population.csv  (1 row per synthetic user)
Priority scale is numeric: 1 = highest ... 5 = lowest.
"""
import csv
import math
import os
import random

SEED = 20260717
random.seed(SEED)

N_ROWS = 600_000
OUT = os.path.join(os.path.dirname(__file__), "data", "population.csv")

CATEGORIES = ["study", "work", "health", "sports", "gym",
              "hobbies", "social", "chores", "rest"]

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def rlevel(mean, sd=0.7):
    """Sample an integer priority level 1..5 (1 = highest) around a mean."""
    return int(round(clamp(random.gauss(mean, sd), 1, 5)))

def age_bucket(age):
    if age <= 17: return "14-17"
    if age <= 22: return "18-22"
    if age <= 29: return "23-29"
    if age <= 39: return "30-39"
    if age <= 49: return "40-49"
    if age <= 59: return "50-59"
    if age <= 64: return "60-64"
    return "65-70"

# ---------------------------------------------------------------------------
# occupation & education — schooling years, college attendance, unemployment,
# retirement, work culture, all age-conditioned to match current norms.
# ---------------------------------------------------------------------------
def youth_unemployment_rate(age):
    # Higher for the young, easing into prime age, small bump near pre-retirement.
    if age <= 24: return 0.15
    if age <= 34: return 0.065
    if age <= 44: return 0.045
    if age <= 54: return 0.04
    return 0.05

def retirement_prob(age):
    # Ramp: negligible before 58, ~0.5 by 63, most retired by 67, some work to 70.
    if age < 58: return 0.0
    return clamp((age - 57) / 9.0, 0.0, 0.95)

def sample_occupation(age):
    """Returns (occupation, in_education, work_culture)."""
    # --- School years (14-17): almost all in school ---
    if age <= 17:
        r = random.random()
        if r < 0.94: return "student", True, "none"
        if r < 0.97: return "other", False, "non_corporate"   # early workers
        return "unemployed", False, "none"

    # --- College years (18-22): ~55% attend college ---
    if age <= 22:
        if random.random() < 0.55:
            return "college_student", True, "none"
        # not in college -> labour force
        if random.random() < youth_unemployment_rate(age):
            return "unemployed", False, "none"
        return _employed(age)

    # --- Prime working age (23-59) ---
    if age <= 59:
        # small tail still studying (grad school) for 23-27
        if age <= 27 and random.random() < 0.06:
            return "college_student", True, "none"
        if random.random() < youth_unemployment_rate(age):
            return "unemployed", False, "none"
        return _employed(age)

    # --- Pre/around retirement (60-70) ---
    if random.random() < retirement_prob(age):
        return "retired", False, "none"
    if random.random() < 0.04:
        return "unemployed", False, "none"
    return _employed(age)

def _employed(age):
    """Split employed people into corporate vs non-corporate cultures."""
    r = random.random()
    # ~48% corporate professionals, ~30% non-corporate/informal, ~22% self-employed
    if r < 0.48:
        return "professional", False, "corporate"
    if r < 0.78:
        return "other", False, "non_corporate"
    return "self-employed", False, "non_corporate"

# ---------------------------------------------------------------------------
# context features: sleep, commitments, wake time, activity
# ---------------------------------------------------------------------------
def sample_sleep(age):
    # Teens need more; gently declines and flattens; elderly a touch less/variable.
    base = 8.6 - (age - 14) * 0.028
    base = clamp(base, 6.6, 8.8)
    return round(clamp(random.gauss(base, 0.6), 5.0, 10.0), 1)

def sample_commitment(occupation, work_culture):
    if occupation == "student":         m, sd, lo, hi = 6.5, 0.6, 4, 8
    elif occupation == "college_student": m, sd, lo, hi = 4.5, 1.2, 2, 7
    elif occupation == "retired":       m, sd, lo, hi = 0.5, 0.8, 0, 3
    elif occupation == "unemployed":    m, sd, lo, hi = 1.0, 1.0, 0, 4
    elif work_culture == "corporate":   m, sd, lo, hi = 8.5, 0.7, 7, 11
    elif occupation == "self-employed": m, sd, lo, hi = 7.5, 2.4, 2, 13
    else:                               m, sd, lo, hi = 7.0, 2.0, 3, 12   # non_corporate
    return round(clamp(random.gauss(m, sd), lo, hi), 1)

def sample_wake(occupation, work_culture):
    if work_culture == "corporate":     m = 6.7
    elif occupation in ("student", "college_student"): m = 6.9
    elif occupation == "retired":       m = 8.0
    elif occupation == "unemployed":    m = 8.2
    else:                               m = 7.2
    return int(clamp(random.gauss(m, 0.6), 4.5, 10.5) * 60)

def sample_activity(age):
    """
    Latent physical-activity propensity in [0,1]. Declines gently with age, wide
    variance, plus an upper-tail boost that can fire at ANY age so we always have
    highly-active teens *and* seniors in the data.
    """
    base = clamp(0.72 - (age - 14) * 0.0055, 0.22, 0.82)
    a = random.gauss(base, 0.18)
    if random.random() < 0.09:                 # "unusually active" outliers
        a += random.uniform(0.20, 0.42)
    return clamp(a, 0.02, 1.0)

def activity_label(a):
    if a >= 0.66: return "high"
    if a >= 0.42: return "moderate"
    return "low"

# ---------------------------------------------------------------------------
# priority generation (1 = highest .. 5 = lowest), gender-independent
# ---------------------------------------------------------------------------
def sample_priorities(age, occupation, in_education, work_culture, activity):
    p = {}

    # STUDY: high while in education, moderate upskilling when young workers, low later.
    if in_education:                       p["study"] = rlevel(1.6)
    elif occupation == "unemployed" and age <= 30: p["study"] = rlevel(2.6)
    elif age < 30:                         p["study"] = rlevel(3.2)
    elif age < 45:                         p["study"] = rlevel(3.9)
    else:                                  p["study"] = rlevel(4.4)

    # WORK: top priority for the employed (corporate slightly higher), low otherwise.
    if work_culture == "corporate":        p["work"] = rlevel(1.5)
    elif occupation == "self-employed":    p["work"] = rlevel(1.7)
    elif work_culture == "non_corporate":  p["work"] = rlevel(1.9)
    elif occupation == "unemployed":       p["work"] = rlevel(2.4)   # job-seeking
    else:                                  p["work"] = rlevel(4.6)   # students/retired

    # HEALTH: importance rises with age (lower number), boosted by being active.
    health_mean = clamp(3.3 - (age - 14) * 0.021 - activity * 0.6, 1.4, 3.6)
    if occupation == "retired": health_mean = min(health_mean, 1.9)
    p["health"] = rlevel(health_mean)

    # SPORTS & GYM: driven mainly by ACTIVITY, only mildly by age. High-activity
    # people keep them high-priority regardless of age (the key anti-bias property).
    sports_mean = clamp(4.6 - activity * 3.4 + (age - 14) * 0.010, 1.0, 5.0)
    gym_mean    = clamp(4.4 - activity * 3.0 + (age - 14) * 0.008, 1.0, 5.0)
    p["sports"] = rlevel(sports_mean)
    p["gym"]    = rlevel(gym_mean)

    # HOBBIES / LEISURE: moderate; higher for retired and teens (more discretionary time).
    hob = 3.0
    if occupation == "retired": hob = 2.3
    elif age <= 17: hob = 2.7
    p["hobbies"] = rlevel(hob)

    # SOCIAL: strongest for the young, tapering with age.
    p["social"] = rlevel(clamp(2.2 + (age - 20) * 0.02, 2.0, 3.9))

    # CHORES: more salient with independence/age.
    chores = 3.8 if age <= 17 else (2.6 if age >= 60 else 2.9)
    p["chores"] = rlevel(chores)

    # REST/RECOVERY: moderate, a touch more important for the oldest.
    p["rest"] = rlevel(clamp(3.3 - max(0, age - 60) * 0.03, 2.6, 3.4))

    return p

# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    header = (["user_id", "age", "age_bucket", "gender", "occupation",
               "in_education", "work_culture", "sleep_hours", "commitment_hours",
               "wake_min", "activity_score", "activity_level"]
              + [f"prio_{c}" for c in CATEGORIES])

    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for i in range(N_ROWS):
            age = random.randint(14, 70)              # balanced coverage
            gender = "female" if random.random() < 0.5 else "male"
            occ, in_edu, culture = sample_occupation(age)
            sleep = sample_sleep(age)
            commit = sample_commitment(occ, culture)
            wake = sample_wake(occ, culture)
            act = sample_activity(age)
            alabel = activity_label(act)
            prios = sample_priorities(age, occ, in_edu, culture, act)
            w.writerow([i, age, age_bucket(age), gender, occ, int(in_edu), culture,
                        sleep, commit, wake, round(act, 3), alabel]
                       + [prios[c] for c in CATEGORIES])
            if (i + 1) % 100_000 == 0:
                print(f"  ...{i + 1:,} rows")

    size_mb = os.path.getsize(OUT) / 1e6
    print(f"Wrote {N_ROWS:,} rows -> {OUT}  ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()
