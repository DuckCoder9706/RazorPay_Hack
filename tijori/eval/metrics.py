"""Scored metrics (ARCHITECTURE.md §09).

Gross ₹ recovered (headline, D7), net value (F3), efficiency = policy_₹ / oracle_₹,
regret = oracle_₹ - smart_₹, and mean Brier (F1). Pure functions over action rows.

STATUS: interfaces fixed; aggregations land in Week 2-3.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class BatchMetrics:
    policy: str
    gross_recovered_paise: int
    net_value_paise: int
    n_attempts: int
    n_recovered: int
    efficiency: float | None = None   # policy_₹ / oracle_₹ over recoverable
    regret_paise: int | None = None
    mean_brier: float | None = None


def summarise(action_rows: list[dict], oracle_paise: int | None = None) -> BatchMetrics:
    """Aggregate recovery_action rows for one policy into a BatchMetrics. Week 2-3."""
    raise NotImplementedError("Week 2 · T-metrics-summarise")
