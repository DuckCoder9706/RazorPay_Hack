from __future__ import annotations

import statistics
from collections import Counter, defaultdict

from sonic.config.constants import DEFAULT_BATCH_SIZE, Cause, is_retryable
from sonic.simulator.seed import build_batch, summarise

def default_seeds(k: int) -> list[int]:
    return list(range(1000, 1000 + k))

def _mean_std(xs: list[float]) -> tuple[float, float]:
    if not xs:
        return 0.0, 0.0
    return statistics.fmean(xs), (statistics.pstdev(xs) if len(xs) > 1 else 0.0)

def run_sweep(seeds: list[int], n: int = DEFAULT_BATCH_SIZE) -> dict:
    summaries: list[dict] = []
    pooled_causes: Counter = Counter()
    per_cause_counts: dict[str, list[int]] = defaultdict(list)

    for seed in seeds:
        batch = build_batch(seed, n)
        s = summarise(batch)
        summaries.append(s)
        for cause, cnt in s["cause_mix"].items():
            pooled_causes[cause] += cnt
            per_cause_counts[cause].append(cnt)

    at_risk = [s["total_at_risk_paise"] for s in summaries]
    ar_mean, ar_std = _mean_std([x / 100 for x in at_risk])

    cause_share_stats: dict[str, dict] = {}
    total_fail = sum(s["n_onetime_failures"] for s in summaries)
    for cause in (c.value for c in Cause):
        shares = [
            s["cause_mix"].get(cause, 0) / s["n_onetime_failures"] for s in summaries
        ]
        m, sd = _mean_std(shares)
        cause_share_stats[cause] = {
            "mean_share": m,
            "std_share": sd,
            "pooled_count": pooled_causes.get(cause, 0),
            "retryable": is_retryable(Cause(cause)),
        }

    retryable_pooled = sum(
        v["pooled_count"] for v in cause_share_stats.values() if v["retryable"]
    )

    return {
        "seeds": seeds,
        "n_per_batch": n,
        "n_batches": len(seeds),
        "total_failures": total_fail,
        "at_risk_rupees": {"mean": ar_mean, "std": ar_std,
                           "min": min(at_risk) / 100, "max": max(at_risk) / 100,
                           "total": sum(at_risk) / 100},
        "retryable_pooled": retryable_pooled,
        "terminal_pooled": total_fail - retryable_pooled,
        "cause_share_stats": cause_share_stats,
        "injected_per_batch": summaries[0]["injected_exceptions"] if summaries else {},
    }
