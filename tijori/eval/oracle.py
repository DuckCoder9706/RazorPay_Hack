"""F2 · Oracle bounds.

The oracle is the reachable-maximum ceiling given IDENTICAL luck (same keyed draws).
Because a policy gets up to MAX_RETRY_ATTEMPTS attempts and outcomes are keyed by
(seed, payment_id, attempt), the true ceiling is the CLAIRVOYANT-TIMING oracle: retry
at the WORLD-optimal timing on every attempt in the budget, and recover the amount if
ANY of those attempts would succeed. No policy facing the same draws can beat it, so
efficiency = policy_₹ / oracle_₹ ∈ [0, 1]. Computed over the RECOVERABLE population only
(hard_decline / risk_blocked never recover).

`distributional_oracle_value` (expected single-attempt value) is kept for reference/
reporting but is NOT the ceiling under a multi-attempt budget.
"""

from __future__ import annotations

from tijori.config.constants import Cause, is_retryable
from tijori.simulator.rng import uniform
from tijori.simulator.world import best_timing, best_world_prob, true_prob


def recoverable(cause: Cause) -> bool:
    """Whether a cause counts toward the regret denominator."""
    return is_retryable(cause)


def oracle_recovers(cause: Cause, seed: int, payment_id: str, max_attempts: int) -> bool:
    """True if a best-timing, full-budget clairvoyant oracle recovers this failure."""
    if not is_retryable(cause):
        return False
    p = best_world_prob(cause)
    return any(uniform(seed, payment_id, k) < p for k in range(1, max_attempts + 1))


def distributional_oracle_value(cause: Cause, amount_paise: int) -> int:
    """Expected recovered paise from a single retry at WORLD-optimal timing (reference)."""
    if not is_retryable(cause):
        return 0
    return round(true_prob(cause, best_timing(cause)) * amount_paise)
