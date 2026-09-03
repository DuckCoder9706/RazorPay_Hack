"""WORLD — the *true* generative success process (docs/outcome-model.md §4).

Outcome draws AND the F2 oracle read from here. R must NOT read WORLD (it plans on
BELIEF); keeping them apart is what makes F1 calibration and F2 regret non-circular.
"""

from __future__ import annotations

import random

from tijori.config.constants import WORLD_TABLE, Cause, Timing


def true_prob(cause: Cause, timing: Timing) -> float:
    """Ground-truth P(retry succeeds) for a (cause, timing) pair."""
    return WORLD_TABLE[cause][timing]


def draw_outcome(cause: Cause, timing: Timing, rng: random.Random) -> bool:
    """Draw a single realized retry outcome from the WORLD probability. Seeded via `rng`."""
    return rng.random() < true_prob(cause, timing)


def best_timing(cause: Cause) -> Timing:
    """The timing bucket a clairvoyant-of-distribution oracle would choose (F2)."""
    return max(Timing, key=lambda t: WORLD_TABLE[cause][t])
