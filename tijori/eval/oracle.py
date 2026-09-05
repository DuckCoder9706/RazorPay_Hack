from __future__ import annotations

from tijori.config.constants import Cause, is_retryable
from tijori.simulator.rng import uniform
from tijori.simulator.world import best_timing, best_world_prob, true_prob

def recoverable(cause: Cause) -> bool:
    return is_retryable(cause)

def oracle_recovers(cause: Cause, seed: int, payment_id: str, max_attempts: int) -> bool:
    if not is_retryable(cause):
        return False
    p = best_world_prob(cause)
    return any(uniform(seed, payment_id, k) < p for k in range(1, max_attempts + 1))

def distributional_oracle_value(cause: Cause, amount_paise: int) -> int:
    if not is_retryable(cause):
        return 0
    return round(true_prob(cause, best_timing(cause)) * amount_paise)
