"""F2 · Oracle bounds (docs/differentiation.md).

Distributional oracle (primary): knows WORLD probabilities, picks the timing that
maximises expected ₹ per failure — the reachable maximum. Clairvoyant oracle
(secondary, loose): knows each realized outcome. Both computed over the RECOVERABLE
population only (excludes hard_decline / risk_blocked).

STATUS: interfaces fixed; bodies land in Week 3 (F2).
"""

from __future__ import annotations

from tijori.config.constants import Cause, is_retryable
from tijori.simulator.world import best_timing, true_prob


def distributional_oracle_value(cause: Cause, amount_paise: int) -> int:
    """Expected recovered paise if we retried at WORLD-optimal timing (recoverable only)."""
    if not is_retryable(cause):
        return 0
    t = best_timing(cause)
    return round(true_prob(cause, t) * amount_paise)


def recoverable(cause: Cause) -> bool:
    """Whether a cause counts toward the regret denominator."""
    return is_retryable(cause)
