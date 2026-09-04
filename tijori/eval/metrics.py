"""Scored metrics (ARCHITECTURE.md §09).

Gross ₹ recovered (headline, D7), net value (F3), efficiency = policy_₹ / oracle_₹,
and regret = oracle_₹ - policy_₹. Pure functions over recovery_action rows.
(Calibration / Brier is computed in Week 3 with F1.)
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class BatchMetrics:
    policy: str
    n_failures: int
    n_attempts: int
    n_recovered: int
    gross_recovered_paise: int
    net_value_paise: int
    recovery_rate: float
    efficiency: float | None = None   # gross_₹ / oracle_₹ (recoverable ceiling)
    regret_paise: int | None = None


def summarise(policy: str, action_rows: list[dict], oracle_paise: int | None = None) -> BatchMetrics:
    """Aggregate one policy's recovery_action rows into a BatchMetrics."""
    n = len(action_rows)
    n_recovered = sum(1 for a in action_rows if a["outcome"] == "recovered")
    gross = sum(a["amount_recovered"] for a in action_rows)
    net = sum(a["net_value"] for a in action_rows)
    attempts = sum(a.get("attempts", 0) for a in action_rows)

    efficiency = (gross / oracle_paise) if oracle_paise else None
    regret = (oracle_paise - gross) if oracle_paise is not None else None

    return BatchMetrics(
        policy=policy,
        n_failures=n,
        n_attempts=attempts,
        n_recovered=n_recovered,
        gross_recovered_paise=gross,
        net_value_paise=net,
        recovery_rate=(n_recovered / n) if n else 0.0,
        efficiency=efficiency,
        regret_paise=regret,
    )
