"""Persist the seeded populations into the one ledger (ARCHITECTURE.md §05, §10 W1).

`seed_ledger` is the live Week-1 entry point: it writes failures (R's input), mandate
failures (DEMO), and the settlement substrate (W's input) into SQLite and logs one
append-only audit event. Reproducible: same (seed, n) → identical rows.
"""

from __future__ import annotations

import random
import sqlite3
from collections import Counter

from tijori.config.constants import DEFAULT_BATCH_SIZE, DEFAULT_SEED
from tijori.ledger.audit import append as audit_append
from tijori.simulator.clock import EPOCH
from tijori.simulator.generator import (
    generate_mandate_failures,
    generate_onetime_failures,
    generate_settlement_substrate,
)


def seed_ledger(
    conn: sqlite3.Connection,
    *,
    seed: int = DEFAULT_SEED,
    n: int = DEFAULT_BATCH_SIZE,
    n_mandate: int | None = None,
    commit: bool = True,
) -> dict:
    """Populate the ledger for one reproducible batch. Returns a summary dict."""
    rng = random.Random(seed)
    n_mandate = n_mandate if n_mandate is not None else max(10, n // 10)

    # Draw order is fixed (determinism): failures, then mandates, then substrate.
    failures = generate_onetime_failures(n, rng)
    mandates = generate_mandate_failures(n_mandate, rng)
    substrate = generate_settlement_substrate(n, rng)

    # --- failures: orders (failed) + payments (failed) ---
    conn.executemany(
        "INSERT INTO orders (id, amount, currency, status, created_at, customer_value)"
        " VALUES (?,?,?,?,?,?)",
        [(f["order_id"], f["amount_paise"], "INR", "failed", f["created_at"], f["customer_value"])
         for f in failures],
    )
    conn.executemany(
        "INSERT INTO payments (id, order_id, amount, status, reason_code, attempt_no, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        [(f["id"], f["order_id"], f["amount_paise"], "failed", f["reason_code"], 1, f["created_at"])
         for f in failures],
    )

    # --- mandate failures: orders + subscriptions ---
    conn.executemany(
        "INSERT INTO orders (id, amount, currency, status, created_at, customer_value)"
        " VALUES (?,?,?,?,?,?)",
        [(m["order_id"], m["amount_paise"], "INR", "failed", m["created_at"], m["customer_value"])
         for m in mandates],
    )
    conn.executemany(
        "INSERT INTO subscriptions (id, order_id, mandate_status, next_debit, reason_code, created_at)"
        " VALUES (?,?,?,?,?,?)",
        [(m["id"], m["order_id"], m["mandate_status"], m["next_debit"], m["reason_code"], m["created_at"])
         for m in mandates],
    )

    # --- settlement substrate: orders (paid) + payments (captured) + settlements + bank_rows ---
    conn.executemany(
        "INSERT INTO orders (id, amount, currency, status, created_at, customer_value)"
        " VALUES (?,?,?,?,?,?)",
        [(o["id"], o["amount"], "INR", "paid", o["created_at"], o["customer_value"])
         for o in substrate["orders"]],
    )
    conn.executemany(
        "INSERT INTO payments (id, order_id, amount, status, reason_code, attempt_no, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        [(p["id"], p["order_id"], p["amount"], "captured", None, 1, p["created_at"])
         for p in substrate["payments"]],
    )
    conn.executemany(
        "INSERT INTO settlements (id, batch_id, gross, fee, net, settled_at) VALUES (?,?,?,?,?,?)",
        [(s["id"], s["batch_id"], s["gross"], s["fee"], s["net"], s["settled_at"])
         for s in substrate["settlements"]],
    )
    conn.executemany(
        "INSERT INTO bank_rows (id, credit_amount, value_date, ref) VALUES (?,?,?,?)",
        [(b["id"], b["credit_amount"], b["value_date"], b["ref"]) for b in substrate["bank_rows"]],
    )

    cause_mix = Counter(f["cause"] for f in failures)
    total_at_risk = sum(f["amount_paise"] for f in failures)
    summary = {
        "seed": seed,
        "n_onetime_failures": len(failures),
        "n_mandate_failures": len(mandates),
        "n_settlements": len(substrate["settlements"]),
        "n_bank_rows": len(substrate["bank_rows"]),
        "total_at_risk_paise": total_at_risk,
        "cause_mix": dict(sorted(cause_mix.items())),
        "injected_exceptions": {k: len(v) for k, v in substrate["injected"].items()},
    }

    audit_append(conn, ts=EPOCH.isoformat(), actor="sim", event="batch_generated",
                 payload=summary, seed=seed, commit=False)
    if commit:
        conn.commit()
    return summary
