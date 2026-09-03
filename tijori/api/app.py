"""FastAPI app. Serves batch results, exceptions, calibration and the audit trail to
the dashboard. Endpoints are read-only over the ledger; the batch is run via the CLI.

Run:  uvicorn tijori.api.app:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI

from tijori import __version__

app = FastAPI(title="Tijori", version=__version__)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/batch/{seed}")
def get_batch(seed: int) -> dict:
    """Return the scored metrics table for a seed. Wired to eval.harness in Week 2-3."""
    return {"seed": seed, "status": "not_implemented", "detail": "eval.harness pending (W2-3)"}
