from __future__ import annotations

from collections import defaultdict

from tijori.config.constants import CALIBRATION_N_MIN, Cause, Timing
from tijori.simulator.belief import Belief

def brier_score(predicted: float, outcome: bool) -> float:
    return (predicted - (1.0 if outcome else 0.0)) ** 2

def build_report(action_rows: list[dict], belief: Belief) -> list[dict]:
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
    for cell in report:
        if cell["n_attempts"] >= n_min:
            belief.recalibrate(Cause(cell["cause"]), Timing(cell["timing"]), cell["realized"])
    return belief

def mean_brier(report: list[dict]) -> float:
    total_n = sum(c["n_attempts"] for c in report)
    if not total_n:
        return 0.0
    return sum(c["brier"] * c["n_attempts"] for c in report) / total_n
