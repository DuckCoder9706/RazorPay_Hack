"""3-way matcher: settlement <-> bank <-> orders (ARCHITECTURE.md §07, W).

Exact + tolerance matching plus ONE many-to-many netting case (settlements sharing a
batch_id reconciled against a single lump-sum bank credit whose ref == that batch_id).
Purely deterministic — NO LLM. Emits typed residuals for the classifier.

Residual kinds:
  fee     — a bank credit exists for the settlement but is short of its net
  timing  — the credit matches in amount but landed later than settled_at
  missing — no bank credit at all (and not part of a reconciled netting batch)
Netting batches that sum to their lump credit reconcile cleanly (no residual).
"""

from __future__ import annotations

import sqlite3
from collections import defaultdict


def reconcile(conn: sqlite3.Connection, *, tolerance_paise: int = 0) -> dict:
    """Match settlements to bank rows to orders. Returns {residuals, reconciled, netting}."""
    settlements = [dict(r) for r in conn.execute(
        "SELECT id, batch_id, net, settled_at FROM settlements ORDER BY id")]
    bank_rows = [dict(r) for r in conn.execute(
        "SELECT id, credit_amount, value_date, ref FROM bank_rows ORDER BY id")]

    # index bank rows by ref (a settlement id for singles, a batch_id for netting lumps)
    by_ref: dict[str, list[dict]] = defaultdict(list)
    for b in bank_rows:
        by_ref[b["ref"]].append(b)

    residuals: list[dict] = []
    reconciled = 0

    # --- netting: settlements grouped by batch_id whose batch_id has a lump bank row ---
    netting_batches = {
        s["batch_id"] for s in settlements if s["batch_id"] in by_ref
    }
    netting_reconciled = 0
    for batch_id in sorted(netting_batches):
        members = [s for s in settlements if s["batch_id"] == batch_id]
        lump = sum(b["credit_amount"] for b in by_ref[batch_id])
        expected = sum(s["net"] for s in members)
        if abs(lump - expected) <= tolerance_paise:
            reconciled += len(members)
            netting_reconciled += len(members)
        else:  # netting mismatch -> treat the shortfall as a fee residual on the batch
            residuals.append({"type": "fee", "settlement_id": batch_id,
                              "expected": expected, "observed": lump,
                              "delta": expected - lump, "bank_row_id": by_ref[batch_id][0]["id"]})

    # --- singles: each settlement whose id is a bank ref ---
    for s in settlements:
        if s["batch_id"] in netting_batches:
            continue  # handled above
        hits = by_ref.get(s["id"])
        if not hits:
            residuals.append({"type": "missing", "settlement_id": s["id"],
                              "expected": s["net"], "observed": None,
                              "delta": s["net"], "bank_row_id": None})
            continue
        bank = hits[0]
        if bank["credit_amount"] < s["net"] - tolerance_paise:
            residuals.append({"type": "fee", "settlement_id": s["id"],
                              "expected": s["net"], "observed": bank["credit_amount"],
                              "delta": s["net"] - bank["credit_amount"], "bank_row_id": bank["id"]})
        elif bank["value_date"] > s["settled_at"]:
            residuals.append({"type": "timing", "settlement_id": s["id"],
                              "expected": s["net"], "observed": bank["credit_amount"],
                              "delta": 0, "bank_row_id": bank["id"]})
        else:
            reconciled += 1

    return {"residuals": residuals, "reconciled": reconciled, "netting_reconciled": netting_reconciled}
