"""BELIEF — what R *thinks* is true and plans against (docs/outcome-model.md §4).

Initialised deliberately biased vs WORLD so F1 (recon-as-ground-truth) has something
to correct. This module owns the mutable, recalibratable copy of the belief table.
"""

from __future__ import annotations

import copy

from tijori.config.constants import (
    BELIEF_TABLE,
    CALIBRATION_EMA_ALPHA,
    Cause,
    Timing,
)


class Belief:
    """A mutable belief table. `recalibrate` moves a cell toward an observed rate (F1)."""

    def __init__(self) -> None:
        self._table: dict[Cause, dict[Timing, float]] = copy.deepcopy(BELIEF_TABLE)

    def prob(self, cause: Cause, timing: Timing) -> float:
        return self._table[cause][timing]

    def best_timing(self, cause: Cause) -> Timing:
        return max(Timing, key=lambda t: self._table[cause][t])

    def recalibrate(
        self, cause: Cause, timing: Timing, realized: float, *, alpha: float = CALIBRATION_EMA_ALPHA
    ) -> None:
        """EMA update toward the realized (reconciled) rate. Guarded by n_min in F1 caller."""
        old = self._table[cause][timing]
        self._table[cause][timing] = (1 - alpha) * old + alpha * realized

    def snapshot(self) -> dict[Cause, dict[Timing, float]]:
        return copy.deepcopy(self._table)
