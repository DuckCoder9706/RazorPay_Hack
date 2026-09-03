"""Typed row models mirroring schema.sql. Lightweight dataclasses (not an ORM).

Amounts are integer paise. These exist so modules pass typed objects, not raw tuples.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class Order:
    id: str
    amount: int
    status: str
    created_at: str
    currency: str = "INR"
    customer_value: str = "mid"  # low | mid | high


@dataclass(slots=True)
class Payment:
    id: str
    order_id: str
    amount: int
    status: str            # captured | failed
    created_at: str
    reason_code: str | None = None
    attempt_no: int = 1


@dataclass(slots=True)
class Settlement:
    id: str
    batch_id: str
    gross: int
    net: int
    settled_at: str
    fee: int = 0


@dataclass(slots=True)
class BankRow:
    id: str
    credit_amount: int
    value_date: str
    ref: str | None = None


@dataclass(slots=True)
class Exception_:
    id: str
    type: str              # fee | timing | missing
    expected: int
    created_at: str
    observed: int | None = None
    delta: int | None = None
    status: str = "open"
    settlement_id: str | None = None
    bank_row_id: str | None = None


@dataclass(slots=True)
class RecoveryAction:
    id: str
    ref: str
    cause: str
    strategy: str          # retry | dun | stop
    outcome: str           # recovered | exhausted | abandoned
    policy: str            # baseline | smart | oracle
    created_at: str
    timing_bucket: str | None = None
    predicted_prob: float | None = None
    reconciled: bool = False
    amount_recovered: int = 0
    net_value: int = 0


@dataclass(slots=True)
class CalibrationCell:
    batch_id: str
    cause: str
    timing: str
    n: int
    belief: float
    realized: float
    brier: float | None = None
    drift: float | None = None
