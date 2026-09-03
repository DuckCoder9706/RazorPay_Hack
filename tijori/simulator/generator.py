"""Synthetic-data generators (ARCHITECTURE.md §10, Week 1).

Produces the seeded failure batch (one-time = HERO/measured, mandates = DEMO) plus the
modeled settlement/bank rows W reconciles. Draws causes from REASON_CODE_DISTRIBUTION.

STATUS: `draw_cause` is implemented (validates the frozen distribution). Full batch and
settlement synthesis land in Week 1 proper — interfaces are fixed here.
"""

from __future__ import annotations

import random

from tijori.config.constants import (
    CAUSE_TO_SAMPLE_REASON,
    REASON_CODE_DISTRIBUTION,
    Cause,
)

_CAUSES: list[Cause] = list(REASON_CODE_DISTRIBUTION.keys())
_WEIGHTS: list[float] = [REASON_CODE_DISTRIBUTION[c] for c in _CAUSES]


def draw_cause(rng: random.Random) -> Cause:
    """Draw one failure cause from the frozen distribution. Seeded via `rng`."""
    return rng.choices(_CAUSES, weights=_WEIGHTS, k=1)[0]


def sample_reason(cause: Cause) -> str:
    """A representative Razorpay reason string for a cause (real vocabulary in the demo)."""
    return CAUSE_TO_SAMPLE_REASON[cause]


def generate_onetime_failures(n: int, rng: random.Random) -> list[dict]:
    """Generate `n` synthetic one-time payment failures (HERO population).

    Acceptance (Week 1): returns n dicts with a stable schema
    {id, order_id, amount_paise, reason_code, cause, customer_value, created_at},
    reproducible under a fixed seed, cause mix ~ REASON_CODE_DISTRIBUTION.
    """
    raise NotImplementedError("Week 1 · T-gen-onetime")


def generate_mandate_failures(n: int, rng: random.Random) -> list[dict]:
    """Generate `n` synthetic UPI-Autopay mandate-renewal failures (DEMO population)."""
    raise NotImplementedError("Week 1 · T-gen-mandate")


def synthesize_settlements(payments: list[dict], rng: random.Random) -> tuple[list[dict], list[dict]]:
    """Produce modeled (settlements, bank_rows) for W to reconcile, incl. one netting case."""
    raise NotImplementedError("Week 1 · T-gen-settlements")
