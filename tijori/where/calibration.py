"""F1 · Reconciliation as ground truth (the novel headline; docs/differentiation.md).

R's reconciled retry outcomes are the LABEL. Per (cause, timing) cell we estimate the
realized single-attempt success rate = recovered_actions / total_attempts, compare it to
R's BELIEF, and — guarded by n_min — move BELIEF toward reality via EMA. Over batches this
corrects R's wrong priors: crucially, when a mistaken arm (issuer_soft FAST, over-trusted)
is pulled down below the correct arm (SHORT), the argmax FLIPS back and regret shrinks —
learning the right decision through pure exploitation.
"""

from __future__ import annotations

from collections import defaultdict

from tijori.config.constants import CALIBRATION_N_MIN, Cause, Timing
from tijori.simulator.belief import Belief


def brier_score(predicted: float, outcome: bool) -> float:
    """Single-sample Brier score = (predicted - outcome)^2. Lower is better-calibrated."""
    return (predicted - (1.0 if outcome else 0.0)) ** 2


def build_report(action_rows: list[dict], belief: Belief) -> list[dict]:
    """Aggregate smart retry actions into per-(cause,timing) belief-vs-realized cells.

    realized single-attempt rate = (# recovered) / (# total attempts) in the cell.
    """
    attempts: dict[tuple[str, str], int] = defaultdict(int)
    recovered: dict[tuple[str, str], int] = defaultdict(int)

    for a in action_rows:
        if a["strategy"] != "retry" or not a["timing_bucket"] or a["attempts"] == 0:
            continue
        key = (a["cause"], a["timing_bucket"])
        attempts[key] += a["attempts"]
        if a["outcome"] == "recovered":
            recovered[key] += 1

    report: list[dict] = []
    for (cause, timing), n_att in sorted(attempts.items()):
        n_rec = recovered[(cause, timing)]
        realized = n_rec / n_att if n_att else 0.0
        b = belief.prob(Cause(cause), Timing(timing))
        report.append({
            "cause": cause, "timing": timing, "n_attempts": n_att, "n_recovered": n_rec,
            "belief": b, "realized": realized, "drift": b - realized,
            "brier": (b - realized) ** 2,
        })
    return report


def recalibrate(belief: Belief, report: list[dict], *, n_min: int = CALIBRATION_N_MIN) -> Belief:
    """Move BELIEF toward realized rates via EMA for cells with enough samples (F1)."""
    for cell in report:
        if cell["n_attempts"] >= n_min:
            belief.recalibrate(Cause(cell["cause"]), Timing(cell["timing"]), cell["realized"])
    return belief


def mean_brier(report: list[dict]) -> float:
    """Attempt-weighted mean Brier across cells (overall calibration quality)."""
    total_n = sum(c["n_attempts"] for c in report)
    if not total_n:
        return 0.0
    return sum(c["brier"] * c["n_attempts"] for c in report) / total_n
