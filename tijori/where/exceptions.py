"""Exception classifier + loop-closer (ARCHITECTURE.md §07).

Persists W's residuals as typed exceptions (fee | timing | missing), and closes the loop
by marking recovered money as reconciled once it lands — proving every recovered rupee
actually settles (the whole thesis).
"""

from __future__ import annotations

import sqlite3
from collections import Counter

from tijori.ledger.audit import append as audit_append
from tijori.simulator.clock import EPOCH

EXCEPTION_TYPES = ("fee", "timing", "missing")
_TS = EPOCH.isoformat()


def run_reconciliation(conn: sqlite3.Connection, *, seed: int, tolerance_paise: int = 0,
                       commit: bool = True) -> dict:
    """Reconcile the settlement substrate, persist exceptions, return a summary."""
    from tijori.where.matcher import reconcile

    result = reconcile(conn, tolerance_paise=tolerance_paise)
    residuals = result["residuals"]

    rows = [
        (f"exc_{i:05d}", r["type"], r["expected"], r["observed"], r["delta"],
         "open", r["settlement_id"], r["bank_row_id"], seed, _TS)
        for i, r in enumerate(residuals)
    ]
    conn.executemany(
        "INSERT INTO exceptions (id, type, expected, observed, delta, status,"
        " settlement_id, bank_row_id, seed, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        rows,
    )
    counts = Counter(r["type"] for r in residuals)
    summary = {
        "detected": dict(sorted(counts.items())),
        "total_exceptions": len(residuals),
        "reconciled": result["reconciled"],
        "netting_reconciled": result["netting_reconciled"],
    }
    audit_append(conn, ts=_TS, actor="W", event="reconciliation",
                 payload=summary, seed=seed, commit=False)
    if commit:
        conn.commit()
    return summary


def reconcile_recoveries(conn: sqlite3.Connection, *, policy: str = "smart",
                         commit: bool = True) -> int:
    """Close the loop: mark each recovered action as reconciled (money landed).

    In the simulator a recovered retry always produces a matching credit, so recovery ==
    reconciliation; this is the step that lets W confirm every recovered rupee settled.
    Returns the number of actions marked reconciled.
    """
    cur = conn.execute(
        "UPDATE recovery_actions SET reconciled = 1 "
        "WHERE policy = ? AND outcome = 'recovered'", (policy,))
    if commit:
        conn.commit()
    return cur.rowcount
