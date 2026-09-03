"""Synthetic-data generators (ARCHITECTURE.md §10, Week 1).

Produces the seeded populations, all as pure data (dicts) — persistence lives in
tijori.simulator.seed. Everything is a pure function of the passed `rng`, so a fixed
seed yields byte-identical output (determinism rule #1).

Three populations:
  * one-time failures   — HERO / measured input to R (drawn ~ REASON_CODE_DISTRIBUTION)
  * mandate failures    — DEMO recurring path
  * settlement substrate— the successful money flow W reconciles, with embedded
                          fee / timing / missing exceptions + one many-to-many netting case
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from tijori.config.constants import (
    CAUSE_TO_SAMPLE_REASON,
    PAISE_PER_RUPEE,
    REASON_CODE_DISTRIBUTION,
    Cause,
)
from tijori.simulator.clock import EPOCH

_CAUSES: list[Cause] = list(REASON_CODE_DISTRIBUTION.keys())
_WEIGHTS: list[float] = [REASON_CODE_DISTRIBUTION[c] for c in _CAUSES]

# Realistic INR order-value tiers (rupees) and customer-value tiers.
_AMOUNT_TIERS: list[tuple[tuple[int, int], float]] = [
    ((50, 500), 0.50),
    ((500, 2000), 0.35),
    ((2000, 10000), 0.15),
]
_VALUE_TIERS: list[tuple[str, float]] = [("low", 0.50), ("mid", 0.35), ("high", 0.15)]

# Causes that plausibly hit a UPI-Autopay mandate renewal (DEMO population).
_MANDATE_CAUSES: list[Cause] = [
    Cause.INSUFFICIENT_FUNDS,
    Cause.HARD_DECLINE,
    Cause.TECHNICAL_TRANSIENT,
    Cause.ISSUER_SOFT_DECLINE,
]
_MANDATE_WEIGHTS: list[float] = [0.50, 0.20, 0.20, 0.10]


# --------------------------------------------------------------------------- #
# small deterministic draws
# --------------------------------------------------------------------------- #
def draw_cause(rng: random.Random) -> Cause:
    """Draw one failure cause from the frozen distribution. Seeded via `rng`."""
    return rng.choices(_CAUSES, weights=_WEIGHTS, k=1)[0]


def sample_reason(cause: Cause) -> str:
    """A representative Razorpay reason string for a cause (real vocabulary in the demo)."""
    return CAUSE_TO_SAMPLE_REASON[cause]


def _draw_amount_paise(rng: random.Random) -> int:
    (lo, hi) = rng.choices([t[0] for t in _AMOUNT_TIERS], weights=[t[1] for t in _AMOUNT_TIERS])[0]
    return rng.randint(lo, hi) * PAISE_PER_RUPEE


def _draw_value(rng: random.Random) -> str:
    return rng.choices([t[0] for t in _VALUE_TIERS], weights=[t[1] for t in _VALUE_TIERS])[0]


def _draw_created_at(rng: random.Random) -> str:
    return (EPOCH + timedelta(days=rng.randint(0, 27), hours=rng.randint(0, 23))).isoformat()


def _fee_paise(gross: int) -> int:
    """Razorpay-style MDR: ~2% + 18% GST on the fee. Modeled."""
    return round(gross * 0.02 * 1.18)


# --------------------------------------------------------------------------- #
# populations
# --------------------------------------------------------------------------- #
def generate_onetime_failures(n: int, rng: random.Random) -> list[dict]:
    """Generate `n` synthetic one-time payment failures (HERO population).

    Stable schema: {id, order_id, amount_paise, reason_code, cause, customer_value, created_at}.
    Reproducible under a fixed seed; cause mix ~ REASON_CODE_DISTRIBUTION.
    """
    out: list[dict] = []
    for i in range(n):
        cause = draw_cause(rng)
        out.append(
            {
                "id": f"pay_f{i:05d}",
                "order_id": f"order_f{i:05d}",
                "amount_paise": _draw_amount_paise(rng),
                "reason_code": sample_reason(cause),
                "cause": cause.value,
                "customer_value": _draw_value(rng),
                "created_at": _draw_created_at(rng),
            }
        )
    return out


def generate_mandate_failures(n: int, rng: random.Random) -> list[dict]:
    """Generate `n` synthetic UPI-Autopay mandate-renewal failures (DEMO population)."""
    out: list[dict] = []
    for i in range(n):
        cause = rng.choices(_MANDATE_CAUSES, weights=_MANDATE_WEIGHTS, k=1)[0]
        created = _draw_created_at(rng)
        next_debit = (EPOCH + timedelta(days=rng.randint(28, 35))).isoformat()
        out.append(
            {
                "id": f"sub_{i:05d}",
                "order_id": f"order_m{i:05d}",
                "amount_paise": _draw_amount_paise(rng),
                "mandate_status": "pending",
                "next_debit": next_debit,
                "reason_code": sample_reason(cause),
                "cause": cause.value,
                "customer_value": _draw_value(rng),
                "created_at": created,
            }
        )
    return out


def generate_settlement_substrate(n: int, rng: random.Random) -> dict:
    """Generate the SUCCESSFUL money flow W reconciles (orders/payments/settlements/bank_rows).

    Embeds a controlled number of exceptions for W to later detect (Week 3):
      * fee     — bank credit short of settlement net (unexplained deduction)
      * timing  — bank credit present but value_date delayed
      * missing — settlement with no bank credit at all
      * netting — one many-to-many case: several settlements → one lump-sum bank credit

    Returns {orders, payments, settlements, bank_rows, injected}. `injected` is the
    ground-truth exception map so tests (and W's eval) can check detection.
    """
    n_fee = max(1, n // 20)
    n_timing = max(1, n // 20)
    n_missing = max(1, n // 25)
    n_net = 3 if n >= 6 else 0

    idxs = list(range(n))
    rng.shuffle(idxs)
    fee_idx = set(idxs[:n_fee])
    timing_idx = set(idxs[n_fee : n_fee + n_timing])
    missing_idx = set(idxs[n_fee + n_timing : n_fee + n_timing + n_missing])
    net_idx = idxs[n_fee + n_timing + n_missing : n_fee + n_timing + n_missing + n_net]
    net_set = set(net_idx)

    orders: list[dict] = []
    payments: list[dict] = []
    settlements: list[dict] = []
    bank_rows: list[dict] = []

    net_members: list[tuple[str, int, str]] = []  # (settlement_id, net, settled_at)

    for i in range(n):
        amount = _draw_amount_paise(rng)
        created = _draw_created_at(rng)
        value = _draw_value(rng)
        fee = _fee_paise(amount)
        net = amount - fee
        settled_at = (datetime.fromisoformat(created) + timedelta(days=1)).isoformat()

        oid, pid, sid = f"order_s{i:05d}", f"pay_s{i:05d}", f"setl_{i:05d}"
        orders.append({"id": oid, "amount": amount, "status": "paid",
                       "created_at": created, "customer_value": value})
        payments.append({"id": pid, "order_id": oid, "amount": amount, "status": "captured",
                         "reason_code": None, "attempt_no": 1, "created_at": created})
        settlements.append({"id": sid, "batch_id": "SETL_0001", "gross": amount,
                            "fee": fee, "net": net, "settled_at": settled_at})

        if i in missing_idx:
            continue  # no bank credit — a 'missing' exception
        if i in net_set:
            net_members.append((sid, net, settled_at))
            continue  # rolled into the lump-sum credit below
        if i in fee_idx:
            short = round(net * 0.01) + 100  # unexplained extra deduction
            bank_rows.append({"id": f"bank_{i:05d}", "credit_amount": net - short,
                              "value_date": settled_at, "ref": sid})
        elif i in timing_idx:
            delayed = (datetime.fromisoformat(settled_at) + timedelta(days=rng.randint(2, 5))).isoformat()
            bank_rows.append({"id": f"bank_{i:05d}", "credit_amount": net,
                              "value_date": delayed, "ref": sid})
        else:
            bank_rows.append({"id": f"bank_{i:05d}", "credit_amount": net,
                              "value_date": settled_at, "ref": sid})

    if net_members:
        lump = sum(m[1] for m in net_members)
        last_date = max(m[2] for m in net_members)
        bank_rows.append({"id": "bank_netA", "credit_amount": lump,
                          "value_date": last_date, "ref": "BATCH_NET_A"})

    return {
        "orders": orders,
        "payments": payments,
        "settlements": settlements,
        "bank_rows": bank_rows,
        "injected": {
            "fee": sorted(fee_idx),
            "timing": sorted(timing_idx),
            "missing": sorted(missing_idx),
            "netting": [m[0] for m in net_members],
        },
    }
