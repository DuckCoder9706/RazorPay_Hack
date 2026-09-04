"""Week-3b acceptance tests for the read-only dashboard API.

Every endpoint is a deterministic projection of the same scored core the CLI runs, so the
tests assert both shape and the headline facts (smart beats baseline; F1 flips the arm;
F3 ranking is robust; the loop leaves an audit trail).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tijori.api.app import app

client = TestClient(app)

_SEED = 42
_N = 200  # small n keeps the suite fast; the facts hold at any size


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_batch_smart_beats_baseline():
    r = client.get("/batch", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    policies = {p["policy"]: p for p in body["policies"]}
    assert set(policies) == {"baseline", "smart"}
    assert policies["smart"]["gross_recovered_paise"] > policies["baseline"]["gross_recovered_paise"]
    assert policies["smart"]["net_value_paise"] > policies["baseline"]["net_value_paise"]
    # every policy sits under the oracle ceiling
    assert 0.0 <= policies["smart"]["efficiency"] <= 1.0
    assert body["delta"]["gross_paise"] > 0


def test_batch_is_deterministic():
    a = client.get("/batch", params={"seed": _SEED, "n": _N}).json()
    b = client.get("/batch", params={"seed": _SEED, "n": _N}).json()
    assert a == b


def test_batch_path_backcompat():
    r = client.get(f"/batch/{_SEED}")
    assert r.status_code == 200
    assert r.json()["seed"] == _SEED


def test_exceptions_detected():
    r = client.get("/exceptions", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    assert set(body["summary"]["detected"]).issubset({"fee", "timing", "missing"})
    assert body["summary"]["total_exceptions"] == len(body["exceptions"])
    assert body["summary"]["netting_reconciled"] >= 1  # the many-to-many case reconciles


def test_learn_flips_issuer_soft_and_shrinks_regret():
    r = client.get("/learn", params={"seed": _SEED, "n": _N, "batches": 5})
    assert r.status_code == 200
    body = r.json()
    on = body["on"]
    assert on[0]["issuer_timing"] == "fast"   # starts on the biased (wrong) arm
    assert on[-1]["issuer_timing"] == "short"  # F1 flips it to the world-optimal
    assert on[-1]["regret_paise"] <= on[0]["regret_paise"]
    # ablation: with recalibration off it never leaves the wrong arm
    assert body["off"][-1]["issuer_timing"] == "fast"


def test_churn_smart_always_wins():
    r = client.get("/churn", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    assert body["smart_always_wins_net"] is True
    assert all(row["smart_wins_net"] for row in body["rows"])


def test_audit_trail_records_the_loop():
    r = client.get("/audit", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    events = {e["event"] for e in body["events"]}
    assert "policy_run:baseline" in events
    assert "policy_run:smart" in events
    assert "reconciliation" in events
    assert body["total"] >= len(body["events"])


def test_outcome_model_marks_the_biased_arm():
    r = client.get("/outcome-model")
    assert r.status_code == 200
    body = r.json()
    by_cause = {c["cause"]: c for c in body["causes"]}
    # issuer_soft_decline is the injected wrong prior: belief argmax != world argmax
    assert by_cause["issuer_soft_decline"]["belief_wrong"] is True
    assert by_cause["issuer_soft_decline"]["world_best_timing"] == "short"
    assert by_cause["issuer_soft_decline"]["belief_best_timing"] == "fast"
    # a cause with no injected bias is not flagged
    assert by_cause["technical_transient"]["belief_wrong"] is False


def test_n_is_clamped():
    r = client.get("/batch", params={"seed": _SEED, "n": 10_000_000})
    assert r.status_code == 200
    assert r.json()["n"] <= 5000
