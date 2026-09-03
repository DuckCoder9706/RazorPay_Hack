"""Build + persist the seeded populations (ARCHITECTURE.md §05, §10 W1).

`build_batch` is the pure data step (uses independent RNG substreams — reproducibility
#1). `seed_ledger` persists it and logs one append-only audit event. `batch_fingerprint`
gives a stable content hash for golden-snapshot testing (#2). Same seed -> identical
everything.
"""

from __future__ import annotations

import hashlib
import json
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
from tijori.simulator.rng import make_streams


def build_batch(seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE, n_mandate: int | None = None) -> dict:
    """Pure data build — no DB. Each population draws from its OWN substream (#1),
    so adding a draw in one population never perturbs the others."""
    streams = make_streams(seed)
    n_mandate = n_mandate if n_mandate is not None else max(10, n // 10)
    return {
        "seed": seed,
        "n": n,
        "failures": generate_onetime_failures(n, streams.generator),
        "mandates": generate_mandate_failures(n_mandate, streams.mandate),
        "substrate": generate_settlement_substrate(n, streams.substrate),
    }


def summarise(batch: dict) -> dict:
    """Deterministic summary of a built batch (counts, cause mix, ₹ at risk, injected)."""
    failures = batch["failures"]
    cause_mix = Counter(f["cause"] for f in failures)
    return {
        "seed": batch["seed"],
        "n_onetime_failures": len(failures),
        "n_mandate_failures": len(batch["mandates"]),
        "n_settlements": len(batch["substrate"]["settlements"]),
        "n_bank_rows": len(batch["substrate"]["bank_rows"]),
        "total_at_risk_paise": sum(f["amount_paise"] for f in failures),
        "cause_mix": dict(sorted(cause_mix.items())),
        "injected_exceptions": {k: len(v) for k, v in batch["substrate"]["injected"].items()},
    }


def batch_fingerprint(seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE) -> str:
    """Stable SHA-256 over the built batch content (golden-snapshot anchor, #2)."""
    batch = build_batch(seed, n)
    payload = {k: batch[k] for k in ("seed", "n", "failures", "mandates", "substrate")}
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def seed_ledger(
    conn: sqlite3.Connection,
    *,
    seed: int = DEFAULT_SEED,
    n: int = DEFAULT_BATCH_SIZE,
    n_mandate: int | None = None,
    commit: bool = True,
) -> dict:
    """Populate the ledger for one reproducible batch. Returns the summary dict."""
    batch = build_batch(seed, n, n_mandate)
    failures, mandates, substrate = batch["failures"], batch["mandates"], batch["substrate"]

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

    summary = summarise(batch)
    audit_append(conn, ts=EPOCH.isoformat(), actor="sim", event="batch_generated",
                 payload=summary, seed=seed, commit=False)
    if commit:
        conn.commit()
    return summary
