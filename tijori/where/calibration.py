"""F1 · Reconciliation as ground truth (the novel headline; docs/differentiation.md).

W's reconciliation is the LABEL. Per batch, compare R's predicted_prob (BELIEF) to the
realized reconciled rate (WORLD), write a calibration_report, and — guarded by n_min —
recalibrate BELIEF via EMA so next batch's predictions improve.

STATUS: interfaces + Brier formula fixed; body lands in Week 3.
"""

from __future__ import annotations

import sqlite3

from tijori.simulator.belief import Belief


def brier_score(predicted: float, outcome: bool) -> float:
    """Single-sample Brier score = (predicted - outcome)^2. Lower is better-calibrated."""
    return (predicted - (1.0 if outcome else 0.0)) ** 2


def build_report(conn: sqlite3.Connection, batch_id: str) -> list[dict]:
    """Aggregate recovery_actions into per-(cause,timing) belief-vs-realized cells. Week 3."""
    raise NotImplementedError("Week 3 · T-cal-report")


def recalibrate(conn: sqlite3.Connection, batch_id: str, belief: Belief) -> Belief:
    """Update BELIEF toward realized rates for cells with n >= n_min (F1). Week 3."""
    raise NotImplementedError("Week 3 · T-cal-recalibrate")
