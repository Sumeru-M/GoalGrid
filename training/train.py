#!/usr/bin/env python3
"""
Train the GoalGrid planner priors from the synthetic population, with a built-in
data-review pass that checks the generated distributions against real-world norms.

Outputs:
  * console REVIEW report (norms + low-bias/variance diagnostics)
  * src/model/trained-priors.json  (the model the engine loads)

Method notes:
  * Priors are cell means E[priority_level | stratum, category], priority 1..5.
  * We apply hierarchical shrinkage toward the parent mean:
        shrunk = (n*raw + K*parent) / (n + K)
    which trades a little bias for a large variance reduction on thin cells
    (low-bias / low-variance). K is a pseudo-count.
  * Physical categories (sports/gym/health) are keyed by age x activity_level so
    that highly-active users — at any age — inherit a HIGH-priority prior rather
    than the age average. This is what stops the model penalising active outliers.
"""
import csv
import json
import os
from collections import defaultdict

HERE = os.path.dirname(__file__)
CSV = os.path.join(HERE, "data", "population.csv")
OUT = os.path.join(HERE, "..", "src", "model", "trained-priors.json")

CATEGORIES = ["study", "work", "health", "sports", "gym",
              "hobbies", "social", "chores", "rest"]
PHYSICAL = ["health", "sports", "gym"]          # keyed by age x activity
OCC_CATS = ["study", "work", "hobbies", "social", "chores", "rest"]  # keyed by occupation x age
K = 50.0                                          # shrinkage pseudo-count

def mean(sumv, n):
    return sumv / n if n else 0.0

def main():
    # accumulators
    g_sum = defaultdict(float); g_n = defaultdict(int)                     # category global
    occ_sum = defaultdict(float); occ_n = defaultdict(int)                 # (occ, cat)
    occage_sum = defaultdict(float); occage_n = defaultdict(int)           # (occ, bucket, cat)
    actage_sum = defaultdict(float); actage_n = defaultdict(int)          # (bucket, act, cat)
    agecat_sum = defaultdict(float); agecat_n = defaultdict(int)          # (bucket, cat)
    gender_sum = defaultdict(float); gender_n = defaultdict(int)          # (gender, cat) bias check

    occ_by_bucket = defaultdict(lambda: defaultdict(int))                 # bucket -> occ -> count
    bucket_n = defaultdict(int)
    sleep_sum = defaultdict(float)
    act_hist = defaultdict(lambda: [0] * 51)                              # bucket -> hist over activity*50

    total = 0
    with open(CSV) as f:
        r = csv.DictReader(f)
        for row in r:
            total += 1
            bucket = row["age_bucket"]; occ = row["occupation"]
            gender = row["gender"]; alabel = row["activity_level"]
            bucket_n[bucket] += 1
            occ_by_bucket[bucket][occ] += 1
            sleep_sum[bucket] += float(row["sleep_hours"])
            act_hist[bucket][int(round(float(row["activity_score"]) * 50))] += 1
            for c in CATEGORIES:
                v = int(row[f"prio_{c}"])
                g_sum[c] += v; g_n[c] += 1
                occ_sum[(occ, c)] += v; occ_n[(occ, c)] += 1
                occage_sum[(occ, bucket, c)] += v; occage_n[(occ, bucket, c)] += 1
                actage_sum[(bucket, alabel, c)] += v; actage_n[(bucket, alabel, c)] += 1
                agecat_sum[(bucket, c)] += v; agecat_n[(bucket, c)] += 1
                gender_sum[(gender, c)] += v; gender_n[(gender, c)] += 1

    g_mean = {c: mean(g_sum[c], g_n[c]) for c in CATEGORIES}

    # ---- shrunk priors ----------------------------------------------------
    def shrink(raw_sum, raw_n, parent):
        n = raw_n
        raw = mean(raw_sum, n)
        return round((n * raw + K * parent) / (n + K), 3)

    occAge = defaultdict(dict)
    buckets = sorted(bucket_n)
    occs = sorted({o for b in occ_by_bucket for o in occ_by_bucket[b]})
    for occ in occs:
        for b in buckets:
            cell = {}
            for c in OCC_CATS:
                parent = shrink(occ_sum[(occ, c)], occ_n[(occ, c)], g_mean[c])
                cell[c] = shrink(occage_sum[(occ, b, c)], occage_n[(occ, b, c)], parent)
            occAge[occ][b] = cell

    actAge = defaultdict(dict)
    for b in buckets:
        for a in ("low", "moderate", "high"):
            cell = {}
            for c in PHYSICAL:
                parent = shrink(agecat_sum[(b, c)], agecat_n[(b, c)], g_mean[c])
                cell[c] = shrink(actage_sum[(b, a, c)], actage_n[(b, a, c)], parent)
            actAge[b][a] = cell

    # activity norms (mean, p50, p90) per bucket, from the histogram
    act_norms = {}
    for b in buckets:
        h = act_hist[b]; n = sum(h)
        msum = sum(i / 50 * h[i] for i in range(51))
        def pct(p):
            target = p * n; cum = 0
            for i in range(51):
                cum += h[i]
                if cum >= target:
                    return round(i / 50, 3)
            return 1.0
        act_norms[b] = {"mean": round(msum / n, 3), "p50": pct(0.5), "p90": pct(0.9)}

    model = {
        "version": 1,
        "trainedOn": total,
        "priorityScale": "1=highest..5=lowest",
        "shrinkageK": K,
        "globalCategoryMean": {c: round(g_mean[c], 3) for c in CATEGORIES},
        "occCatsKeyedByOccupationAge": OCC_CATS,
        "physicalCatsKeyedByAgeActivity": PHYSICAL,
        "byOccupationAge": occAge,
        "byAgeActivity": actAge,
        "activityNormsByAgeBucket": act_norms,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(model, f, indent=1)

    # ===================================================================
    # REVIEW — consistency with real-world norms + bias/variance checks
    # ===================================================================
    print("=" * 68)
    print(f"DATA REVIEW  (n = {total:,})")
    print("=" * 68)

    def share(bucket, occ_set):
        d = occ_by_bucket[bucket]; n = bucket_n[bucket]
        return sum(d[o] for o in occ_set) / n if n else 0

    checks = []
    def check(label, value, cond, detail=""):
        ok = cond(value)
        checks.append(ok)
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {value:.3f} {detail}")

    print("\nSchooling / college / retirement:")
    check("14-17 in school", share("14-17", {"student"}), lambda v: v > 0.9, "(expect >0.90)")
    check("18-22 in college", share("18-22", {"college_student"}), lambda v: 0.50 <= v <= 0.62, "(expect ~0.55)")
    check("65-70 retired", share("65-70", {"retired"}), lambda v: v > 0.80, "(expect >0.80)")
    check("60-64 retired", share("60-64", {"retired"}), lambda v: 0.20 <= v <= 0.65, "(ramp)")

    print("\nUnemployment (share of bucket):")
    u_youth = share("18-22", {"unemployed"})
    u_prime = share("40-49", {"unemployed"})
    check("18-22 unemployed", u_youth, lambda v: v > u_prime, f"> prime-age ({u_prime:.3f})")

    print("\nWork culture (employed only):")
    emp = {"professional", "self-employed", "other"}
    corp = share("30-39", {"professional"}); noncorp = share("30-39", {"self-employed", "other"})
    print(f"        30-39 corporate={corp:.3f}  non-corporate={noncorp:.3f}")

    print("\nPriority signal (1=highest):")
    study_edu = mean(occage_sum[("student", "14-17", "study")], occage_n[("student", "14-17", "study")])
    study_old = mean(occage_sum[("professional", "40-49", "study")], occage_n[("professional", "40-49", "study")])
    check("study more important in school than for 40s workers",
          study_edu, lambda v: v < study_old, f"< {study_old:.2f}")
    health_young = mean(agecat_sum[("14-17", "health")], agecat_n[("14-17", "health")])
    health_old = mean(agecat_sum[("65-70", "health")], agecat_n[("65-70", "health")])
    check("health more important with age", health_old, lambda v: v < health_young, f"< young {health_young:.2f}")

    print("\nActivity-awareness (active outliers NOT penalised):")
    for b in ("18-22", "60-64", "65-70"):
        hi = actAge[b]["high"]["sports"]; lo = actAge[b]["low"]["sports"]
        ok = hi < lo
        checks.append(ok)
        print(f"  [{'PASS' if ok else 'FAIL'}] {b}: active sports-prior {hi:.2f} < sedentary {lo:.2f}")
    print(f"        activity norm 65-70: {act_norms['65-70']}  (p90 shows active seniors exist)")

    print("\nLow-bias check — gender independence (|Δ mean| per category):")
    max_gap = 0
    for c in CATEGORIES:
        mm = mean(gender_sum[("male", c)], gender_n[("male", c)])
        mf = mean(gender_sum[("female", c)], gender_n[("female", c)])
        max_gap = max(max_gap, abs(mm - mf))
    check("max gender gap across categories", max_gap, lambda v: v < 0.05, "(near 0 = unbiased)")

    print("\nLow-variance check — shrinkage pulls cell estimates toward their parent:")
    import statistics as st
    # For every occ×age×cat cell, measure how far the RAW estimate sits from its
    # parent (occupation mean) vs how far the SHRUNK estimate sits. Shrinkage
    # reduces this spread — most for the smallest cells — cutting estimator
    # variance while keeping bias low (parents are themselves well-estimated).
    raw_dev, shr_dev, min_n = [], [], 10**9
    for (occ, b, c), n in occage_n.items():
        if c not in OCC_CATS or n == 0:
            continue
        min_n = min(min_n, n)
        parent = mean(occ_sum[(occ, c)], occ_n[(occ, c)])
        raw_dev.append(mean(occage_sum[(occ, b, c)], n) - parent)
        shr_dev.append(occAge[occ][b][c] - parent)
    vr, vs = st.pvariance(raw_dev), st.pvariance(shr_dev)
    pct = f"{100*(1-vs/vr):.0f}% lower" if vr > 0 else "n/a"
    print(f"        {len(raw_dev)} cells (smallest n={min_n}); "
          f"spread-around-parent var {vr:.4f} -> {vs:.4f} ({pct})")

    print("\n" + "=" * 68)
    passed = sum(checks); n = len(checks)
    print(f"REVIEW: {passed}/{n} norm checks passed")
    print(f"Model written -> {os.path.relpath(OUT, os.path.join(HERE, '..'))}")
    print("=" * 68)

if __name__ == "__main__":
    main()
