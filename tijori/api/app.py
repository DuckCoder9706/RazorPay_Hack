"""FastAPI app — read-only projections of the scored ledger for the dashboard.

Every endpoint is a thin, deterministic wrapper over the eval harness / ledger: no
endpoint mutates state that outlives the request, and each computes its result from an
in-memory ledger seeded on the fly, so (seed, n) fully determines the response. Results
are cached because the scored core is a pure function of its arguments.

The scored path stays exactly as the CLI runs it — this module only reshapes the same
numbers into JSON. No LLM and no wall clock in the scored path.

Two endpoints reach past pure projection, both quarantined and honest:
  · /batch/stream replays a fully-computed deterministic batch as SSE frames (pacing is
    presentational; the final totals equal /batch byte-for-byte).
  · /razorpay/* is the ONE live test-mode path (D3) — falls back to the recorded real
    object when keys are absent, so the demo stays reproducible offline.

Run:  uvicorn tijori.api.app:app --reload      (defaults to http://localhost:8000)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import asdict
from functools import lru_cache

from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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
    allow_methods=["GET", "POST"],
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


@app.get("/batch/{seed:int}")
def get_batch_path(seed: int) -> dict:
    """Back-compat: /batch/{seed} with the default batch size (int-only, so /batch/stream wins)."""
    return _batch_payload(seed, constants.DEFAULT_BATCH_SIZE)


# --------------------------------------------------------------------------- #
# P1 · live substrate — streamed playback, reproducibility hash, live Razorpay.
# --------------------------------------------------------------------------- #
def _compute_batch(seed: int, n: int):
    """Run one deterministic scored batch; return (oracle, {policy: action_rows}, {policy: metrics})."""
    from tijori.eval.harness import _oracle_ceiling
    from tijori.eval.metrics import summarise
    from tijori.ledger.db import memory_db
    from tijori.recover.executor import run_policy
    from tijori.simulator.seed import seed_ledger

    conn = memory_db()
    try:
        seed_ledger(conn, seed=seed, n=n)
        oracle = _oracle_ceiling(conn, seed)
        actions = {p: run_policy(conn, seed=seed, policy=p) for p in ("baseline", "smart")}
        metrics = {p: summarise(p, actions[p], oracle_paise=oracle) for p in ("baseline", "smart")}
    finally:
        conn.close()
    return oracle, actions, metrics


@lru_cache(maxsize=256)
def _scored_digest(seed: int, n: int) -> str:
    """SHA-256 over the canonical per-action scored output — the determinism fingerprint."""
    _oracle, actions, _m = _compute_batch(seed, n)
    rows = sorted(
        (a["policy"], a["ref"], a["outcome"], a["amount_recovered"], a["net_value"],
         a["attempts"], a["timing_bucket"] or "")
        for pol in actions for a in actions[pol]
    )
    payload = json.dumps({"seed": seed, "n": n, "rows": rows}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@app.get("/verify")
def verify(seed: int = Query(constants.DEFAULT_SEED), n: int = Query(constants.DEFAULT_BATCH_SIZE)) -> dict:
    """Run the scored batch twice and return both SHA-256 digests — provably identical (determinism)."""
    n = _clamp(n, 1, _N_MAX)
    # Two independent computations (the cache is bypassed for the second by clearing once).
    a = _scored_digest.__wrapped__(seed, n)  # type: ignore[attr-defined]
    b = _scored_digest.__wrapped__(seed, n)  # type: ignore[attr-defined]
    return {"seed": seed, "n": n, "hash_a": a, "hash_b": b, "identical": a == b, "algo": "sha256"}


def _sse(event: str, obj: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(obj)}\n\n"


async def _batch_stream(seed: int, n: int, frames: int = 40, secs: float = 1.6):
    """Replay a fully-computed deterministic batch as SSE frames. Pacing is presentational;
    the terminal `done` event equals /batch exactly."""
    oracle, actions, metrics = _compute_batch(seed, n)
    base, smart = actions["baseline"], actions["smart"]
    total = len(smart)
    yield _sse("meta", {"seed": seed, "n": total, "oracle_paise": oracle})

    step = max(1, total // max(1, frames))
    delay = secs / max(1, min(frames, total))
    cum = {p: {"gross": 0, "recovered": 0, "attempts": 0} for p in ("baseline", "smart")}
    for i in range(total):
        for pol, acts in (("baseline", base), ("smart", smart)):
            a = acts[i]
            cum[pol]["gross"] += a["amount_recovered"]
            cum[pol]["attempts"] += a["attempts"]
            if a["outcome"] == "recovered":
                cum[pol]["recovered"] += 1
        if i % step == 0 or i == total - 1:
            yield _sse("progress", {"i": i + 1, "total": total,
                                    "baseline": dict(cum["baseline"]), "smart": dict(cum["smart"])})
            await asyncio.sleep(delay)
    yield _sse("done", {
        "seed": seed, "n": total, "oracle_paise": oracle,
        "policies": [_metrics_dict(metrics["baseline"]), _metrics_dict(metrics["smart"])],
    })


@app.get("/batch/stream")
async def batch_stream(
    seed: int = Query(constants.DEFAULT_SEED),
    n: int = Query(constants.DEFAULT_BATCH_SIZE),
    secs: float = Query(1.6, ge=0.0, le=10.0),
) -> StreamingResponse:
    """Server-sent events: watch a deterministic batch score, ending on the exact /batch totals."""
    return StreamingResponse(
        _batch_stream(seed, _clamp(n, 1, _N_MAX), secs=secs),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class LinkRequest(BaseModel):
    amount_paise: int = 50000


def _norm_link(obj: dict, live: bool) -> dict:
    return {
        "ok": True, "live": live,
        "id": obj.get("id"), "status": obj.get("status"),
        "amount": obj.get("amount"), "currency": obj.get("currency"),
        "short_url": obj.get("short_url"), "description": obj.get("description"),
        "created_at": obj.get("created_at"),
    }


@app.post("/razorpay/link")
def razorpay_create_link(req: LinkRequest = Body(default=LinkRequest())) -> dict:
    """Create a real rzp_test_ Payment Link (D3). Falls back to the recorded real object
    when keys are absent, so the demo works offline; returns ok=false only if neither exists."""
    from tijori.razorpay_client.client import create_payment_link, load_fixture

    try:
        obj = create_payment_link(_clamp(req.amount_paise, 100, 10_000_000))
        return _norm_link(obj, live=True)
    except Exception as e:  # keys missing / offline / API error → replay the recorded object
        obj = load_fixture("payment_link")
        if obj:
            return _norm_link(obj, live=False)
        return {"ok": False, "reason": "no_keys_no_fixture", "detail": str(e)}


@app.get("/razorpay/link/{plink_id}")
def razorpay_fetch_link(plink_id: str) -> dict:
    """Poll a Payment Link's status (created → paid). Falls back to the recorded status object."""
    from tijori.razorpay_client.client import fetch_payment_link, load_fixture

    try:
        return _norm_link(fetch_payment_link(plink_id), live=True)
    except Exception as e:
        obj = load_fixture("payment_link_status") or load_fixture("payment_link")
        if obj:
            return _norm_link(obj, live=False)
        return {"ok": False, "reason": "no_keys_no_fixture", "detail": str(e)}


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
