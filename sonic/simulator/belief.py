from __future__ import annotations

import copy

from sonic.config.constants import (
    BELIEF_TABLE,
    CALIBRATION_EMA_ALPHA,
    Cause,
    Timing,
)

class Belief:

    def __init__(self) -> None:
        self._table: dict[Cause, dict[Timing, float]] = copy.deepcopy(BELIEF_TABLE)

    def prob(self, cause: Cause, timing: Timing) -> float:
        return self._table[cause][timing]

    def best_timing(self, cause: Cause) -> Timing:
        return max(Timing, key=lambda t: self._table[cause][t])

    def recalibrate(
        self, cause: Cause, timing: Timing, realized: float, *, alpha: float = CALIBRATION_EMA_ALPHA
    ) -> None:
        old = self._table[cause][timing]
        self._table[cause][timing] = (1 - alpha) * old + alpha * realized

    def snapshot(self) -> dict[Cause, dict[Timing, float]]:
        return copy.deepcopy(self._table)
