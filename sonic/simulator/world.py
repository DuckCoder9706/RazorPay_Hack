from __future__ import annotations

import random

from sonic.config.constants import WORLD_TABLE, Cause, Timing

def true_prob(cause: Cause, timing: Timing) -> float:
    return WORLD_TABLE[cause][timing]

def draw_outcome(cause: Cause, timing: Timing, rng: random.Random) -> bool:
    return rng.random() < true_prob(cause, timing)

def best_timing(cause: Cause) -> Timing:
    return max(Timing, key=lambda t: WORLD_TABLE[cause][t])

def best_world_prob(cause: Cause) -> float:
    return WORLD_TABLE[cause][best_timing(cause)]
