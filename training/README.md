# GoalGrid — Training pipeline

Trains the planner's **priors** from a synthetic population so the engine makes
age / occupation / activity-aware decisions out of the box, before it has seen
any of a real user's behaviour.

```bash
python3 training/generate_data.py   # -> training/data/population.csv (600k rows)
python3 training/train.py           # -> src/model/trained-priors.json (+ review report)
npm run test:engine                 # proves the trained decisions
```

## What the data contains (`generate_data.py`)

600,000 rows, ages **14–70**, both genders, **balanced by age & gender** so every
stratum is well-estimated (low variance) with no coverage bias. Per row:

- demographics: `age`, `age_bucket`, `gender`, `occupation`, `in_education`, `work_culture`
- context: `sleep_hours`, `commitment_hours`, `wake_min`, `activity_score`, `activity_level`
- **numeric priorities** (1 = highest … 5 = lowest) for 9 categories: study, work,
  health, sports, gym, hobbies, social, chores, rest

### Norm-consistency (verified by the review pass)

| Norm | Modelled | Reviewed value |
|------|----------|----------------|
| Schooling years | ~94% of 14–17 in school | PASS |
| College attendance | ~55% of 18–22 in college | 0.553 |
| Retirement | ramps 58→67; >80% retired by 65–70 | 0.940 |
| Unemployment | youth > prime-age, realistic rates | 0.068 > 0.041 |
| Work culture | corporate (fixed 8–9h) vs non-corporate (variable) | split ~50/50 |
| Activity by age | declines gently, **upper-tail boost at every age** | active seniors exist (p90 65–70 = 0.72) |

Priorities are generated **independent of gender** → a fair model learns **no
gender bias** (verified: max gender gap across categories = 0.003).

## What training produces (`train.py`)

`src/model/trained-priors.json` — shrunk cell means `E[priority | stratum, category]`:

- `byOccupationAge` — non-physical categories keyed by occupation × age bucket
- `byAgeActivity` — physical categories (health/sports/gym) keyed by age × **activity**
- `activityNormsByAgeBucket` — mean/p50/p90 activity per age, so "unusually active" is contextual
- `globalCategoryMean` — final fallback

**Low bias / low variance:** each cell is shrunk toward its parent mean via
`shrunk = (n·raw + K·parent)/(n+K)` (K = 50). Balanced 600k data keeps the
smallest cell at n = 145, so estimates are already tight; shrinkage further
reduces spread-around-parent on the thinnest cells. **11/11 norm checks pass.**

## How the engine uses it

Priority resolution order in [`src/priority.ts`](../src/priority.ts):

```
declaredPriority  →  learned-from-behaviour  →  TRAINED PRIOR  →  neutral
```

The trained prior seeds inference as a light pseudo-observation
([`src/model/trainedPriors.ts`](../src/model/trainedPriors.ts)), so a brand-new
user starts from data-calibrated knowledge and their own behaviour overrides it
over time. The old hand-tuned occupation/age heuristic is retired.

### Activity is an asset, never a penalty

Physical-category priors are keyed by age **× activity level**. An active
65-year-old inherits the *high-activity* sport prior, not the age average — so
the engine schedules sport for them ahead of a sedentary peer. Verified:

```
active senior ranks sport above sedentary peer          ✓
active senior's sport is genuinely high priority (≤P3)  ✓
```

> Note: `population.csv` (52 MB) is a build artifact — regenerate with the
> generator rather than committing it.
