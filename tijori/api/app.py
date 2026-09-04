"""FastAPI app — read-only projections of the scored ledger for the dashboard.

Every endpoint is a thin, deterministic wrapper over the eval harness / ledger: no
endpoint mutates state that outlives the request, and each computes its result from an
in-memory ledger seeded on the fly, so (seed, n) fully determines the response. Results
are cached because the scored core is a pure function of its arguments.

The scored path stays exactly as the CLI runs it — this module only reshapes the same
numbers into JSON. No LLM, no wall clock, no live API here.

Run:  uvicorn tijori.api.app:app --reload      (defaults to http://localhost:8000)
"""

from __future__ import annotations

import json
from dataclasses import asdict
from functools import lru_cache

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from tijori import __version__
from tijori.config import constants
from tijori.config.constants import (
    BASELINE_RETRY_DAYS,
    BELIEF_TABLE,
    CALIBRATION_EMA_ALPHA,
    CALIBRATION_N_MIN,
    C_CHURN_PAISE,
    C_RETRY_PAISE,
    MAX_RETRY_ATTEMPTS,
    REASON_CODE_DISTRIBUTION,
    WORLD_TABLE,
    Cause,
    Timing,
    is_retryable,
)

app = FastAPI(
    title="Tijori",
    version=__version__,
    description="Closed detect→act→audit→reconcile loop — read-only API for the dashboard.",
)

# The dashboard dev server (Vite) proxies /health, /batch, … to :8000, but allowing
# localhost origins lets it also run un-proxied. Read-only API, local demo → safe.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Clamp n so a stray query can't ask for a million-failure batch on the demo box.
_N_MAX = 5000
_BATCHES_MAX = 20


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


# --------------------------------------------------------------------------- #
# Serialisation helpers — paise stay integers; the frontend formats ₹.
# --------------------------------------------------------------------------- #
def _metrics_dict(m) -> dict:
    d = asdict(m)
    d["gross_recovered_rupees"] = round(m.gross_recovered_paise / 100, 2)
    d["net_value_rupees"] = round(m.net_value_paise / 100, 2)
    return d


@lru_cache(maxsize=256)
def _batch_payload(seed: int, n: int) -> dict:
    from tijori.eval.harness import run_batch

    r = run_batch(seed=seed, n=n)
    base, smart = r.metrics["baseline"], r.metrics["smart"]
    delta_gross = smart.gross_recovered_paise - base.gross_recovered_paise
    delta_net = smart.net_value_paise - base.net_value_paise
    pct = (delta_gross / base.gross_recovered_paise * 100) if base.gross_recovered_paise else 0.0
    return {
        "seed": r.seed,
        "n": r.n,
        "oracle_paise": r.oracle_paise,
        "oracle_rupees": round(r.oracle_paise / 100, 2),
        "policies": [_metrics_dict(base), _metrics_dict(smart)],
        "delta": {
            "gross_paise": delta_gross,
            "gross_rupees": round(delta_gross / 100, 2),
            "gross_pct": round(pct, 1),
            "net_paise": delta_net,
            "net_rupees": round(delta_net / 100, 2),
        },
    }


@lru_cache(maxsize=256)
def _exceptions_payload(seed: int, n: int) -> dict:
    from tijori.ledger.db import memory_db
    from tijori.simulator.seed import seed_ledger
    from tijori.where.exceptions import run_reconciliation

    conn = memory_db()
    try:
        seed_ledger(conn, seed=seed, n=n)
        summary = run_reconciliation(conn, seed=seed)
        rows = conn.execute(
            "SELECT id, type, expected, observed, delta, status, settlement_id, bank_row_id "
            "FROM exceptions ORDER BY id"
        ).fetchall()
    finally:
        conn.close()
    return {"seed": seed, "n": n, "summary": summary, "exceptions": [dict(r) for r in rows]}


@lru_cache(maxsize=256)
def _learn_payload(seed: int, n: int, batches: int) -> dict:
    from tijori.eval.harness import learning_run

    on = learning_run(seed=seed, n=n, batches=batches, recalibrate_on=True)
    off = learning_run(seed=seed, n=n, batches=batches, recalibrate_on=False)
    return {
        "seed": seed,
        "n": n,
        "batches": batches,
        "n_min": CALIBRATION_N_MIN,
        "ema_alpha": CALIBRATION_EMA_ALPHA,
        "on": on,   # recalibration on — BELIEF flips issuer_soft fast→short, regret→0
        "off": off,  # control — never learns; the ablation that proves F1 is the cause
    }


@lru_cache(maxsize=256)
def _churn_payload(seed: int, n: int) -> dict:
    from tijori.eval.harness import churn_sweep

    rows = churn_sweep(seed=seed, n=n)
    return {
        "seed": seed,
        "n": n,
        "rows": rows,
        "smart_always_wins_net": all(r["smart_wins_net"] for r in rows),
    }


@lru_cache(maxsize=128)
def _audit_payload(seed: int, n: int, limit: int) -> dict:
    from tijori.ledger.audit import replay
    from tijori.ledger.db import memory_db
    from tijori.recover.executor import run_policy
    from tijori.simulator.seed import seed_ledger
    from tijori.where.exceptions import reconcile_recoveries, run_reconciliation

    conn = memory_db()
    try:
        seed_ledger(conn, seed=seed, n=n)
        run_policy(conn, seed=seed, policy="baseline")
        run_policy(conn, seed=seed, policy="smart")
        run_reconciliation(conn, seed=seed)
        reconcile_recoveries(conn, policy="smart")
        rows = replay(conn)
    finally:
        conn.close()
    events = [
        {
            "id": r["id"],
            "ts": r["ts"],
            "actor": r["actor"],
            "event": r["event"],
            "seed": r["seed"],
            "payload": json.loads(r["payload"]),
        }
        for r in rows
    ]
    total = len(events)
    return {"seed": seed, "n": n, "total": total, "events": events[:limit]}


@lru_cache(maxsize=1)
def _outcome_model_payload() -> dict:
    """WORLD vs BELIEF tables + the cited cause distribution (a static reference panel)."""
    causes = []
    for c in Cause:
        world = {t.value: WORLD_TABLE[c][t] for t in Timing}
        belief = {t.value: BELIEF_TABLE[c][t] for t in Timing}
        world_best = max(Timing, key=lambda t: WORLD_TABLE[c][t]).value
        belief_best = max(Timing, key=lambda t: BELIEF_TABLE[c][t]).value
        causes.append({
            "cause": c.value,
            "weight": REASON_CODE_DISTRIBUTION[c],
            "retryable": is_retryable(c),
            "world": world,
            "belief": belief,
            "world_best_timing": world_best,
            "belief_best_timing": belief_best,
            "belief_wrong": belief_best != world_best,  # the arm F1 must flip back
        })
    return {
        "timings": [t.value for t in Timing],
        "causes": causes,
        "baseline_schedule": list(BASELINE_RETRY_DAYS),
        "max_attempts": MAX_RETRY_ATTEMPTS,
        "c_retry_paise": C_RETRY_PAISE,
        "c_churn_paise": C_CHURN_PAISE,
    }


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/batch")
def get_batch(
    seed: int = Query(constants.DEFAULT_SEED),
    n: int = Query(constants.DEFAULT_BATCH_SIZE),
) -> dict:
    """Headline scored batch: baseline vs smart vs oracle, gross + net + efficiency (D7, F2, F3)."""
    return _batch_payload(seed, _clamp(n, 1, _N_MAX))


@app.get("/exceptions")
def get_exceptions(
    seed: int = Query(constants.DEFAULT_SEED),
    n: int = Query(constants.DEFAULT_BATCH_SIZE),
) -> dict:
    """W's 3-way reconciliation output: typed fee/timing/missing exceptions + netting (D4)."""
    return _exceptions_payload(seed, _clamp(n, 1, _N_MAX))


@app.get("/learn")
def get_learn(
    seed: int = Query(constants.DEFAULT_SEED),
    n: int = Query(constants.DEFAULT_BATCH_SIZE),
    batches: int = Query(5),
) -> dict:
    """F1 learning curve: BELIEF recalibrates across batches (on vs off ablation)."""
    return _learn_payload(seed, _clamp(n, 1, _N_MAX), _clamp(batches, 1, _BATCHES_MAX))


@app.get("/churn")
def get_churn(
    seed: int = Query(constants.DEFAULT_SEED),
    n: int = Query(constants.DEFAULT_BATCH_SIZE),
) -> dict:
    """F3 sensitivity: smart beats baseline on net value across the whole c_churn sweep."""
    return _churn_payload(seed, _clamp(n, 1, _N_MAX))


@app.get("/audit")
def get_audit(
    seed: int = Query(constants.DEFAULT_SEED),
    n: int = Query(constants.DEFAULT_BATCH_SIZE),
    limit: int = Query(200),
) -> dict:
    """The append-only trail for one full loop (both policies + reconciliation)."""
    return _audit_payload(seed, _clamp(n, 1, _N_MAX), _clamp(limit, 1, 2000))


@app.get("/outcome-model")
def get_outcome_model() -> dict:
    """The WORLD/BELIEF tables + cited distribution — provenance for the demo."""
    return _outcome_model_payload()


@app.get("/batch/{seed}")
def get_batch_path(seed: int) -> dict:
    """Back-compat: /batch/{seed} with the default batch size."""
    return _batch_payload(seed, constants.DEFAULT_BATCH_SIZE)


# --------------------------------------------------------------------------- #
# Serve the built dashboard (dashboard/dist) at the same origin, if present.
# Mounted last so the JSON routes above win; then `uvicorn tijori.api.app:app`
# alone serves both the SPA and its API — no proxy, no CORS. Absent in dev
# (run `npm run dev` instead), so the mount is optional.
# --------------------------------------------------------------------------- #
def _mount_dashboard() -> None:
    from pathlib import Path

    from fastapi.staticfiles import StaticFiles

    dist = Path(__file__).resolve().parents[2] / "dashboard" / "dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="dashboard")


_mount_dashboard()
