from __future__ import annotations

import json

from fastapi.testclient import TestClient

from sonic.api.app import app

client = TestClient(app)

_SEED = 42
_N = 200

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
    assert body["summary"]["netting_reconciled"] >= 1

def test_learn_flips_issuer_soft_and_shrinks_regret():
    r = client.get("/learn", params={"seed": _SEED, "n": _N, "batches": 5})
    assert r.status_code == 200
    body = r.json()
    on = body["on"]
    assert on[0]["issuer_timing"] == "fast"
    assert on[-1]["issuer_timing"] == "short"
    assert on[-1]["regret_paise"] <= on[0]["regret_paise"]
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
    assert by_cause["issuer_soft_decline"]["belief_wrong"] is True
    assert by_cause["issuer_soft_decline"]["world_best_timing"] == "short"
    assert by_cause["issuer_soft_decline"]["belief_best_timing"] == "fast"
    assert by_cause["technical_transient"]["belief_wrong"] is False

def test_n_is_clamped():
    r = client.get("/batch", params={"seed": _SEED, "n": 10_000_000})
    assert r.status_code == 200
    assert r.json()["n"] <= 5000

def test_verify_is_deterministic():
    r = client.get("/verify", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    assert body["identical"] is True
    assert body["hash_a"] == body["hash_b"]
    assert len(body["hash_a"]) == 64

def test_verify_hash_tracks_seed():
    a = client.get("/verify", params={"seed": 42, "n": _N}).json()["hash_a"]
    b = client.get("/verify", params={"seed": 7, "n": _N}).json()["hash_a"]
    assert a != b

def test_batch_stream_ends_on_exact_batch_totals():
    r = client.get("/batch/stream", params={"seed": _SEED, "n": _N, "secs": 0})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    text = r.text
    assert "event: meta" in text and "event: progress" in text and "event: done" in text

    done = None
    for block in text.strip().split("\n\n"):
        if block.startswith("event: done"):
            done = json.loads(block.split("data: ", 1)[1])
    assert done is not None
    batch = client.get("/batch", params={"seed": _SEED, "n": _N}).json()
    stream_smart = next(p for p in done["policies"] if p["policy"] == "smart")
    batch_smart = next(p for p in batch["policies"] if p["policy"] == "smart")
    assert stream_smart["gross_recovered_paise"] == batch_smart["gross_recovered_paise"]
    assert done["oracle_paise"] == batch["oracle_paise"]

def test_batch_stream_carries_sankey_flows():
    r = client.get("/batch/stream", params={"seed": _SEED, "n": _N, "secs": 0})
    done = None
    for block in r.text.strip().split("\n\n"):
        if block.startswith("event: done"):
            done = json.loads(block.split("data: ", 1)[1])
    assert done is not None
    flows = done["flows"]
    assert flows["cause_mid"] and flows["mid_out"]
    assert all("|" in k for k in flows["cause_mid"])
    assert all(v > 0 for v in flows["mid_out"].values())
    recovered = sum(v for k, v in flows["mid_out"].items() if k.endswith("|recovered"))
    batch = client.get("/batch", params={"seed": _SEED, "n": _N}).json()
    smart = next(p for p in batch["policies"] if p["policy"] == "smart")
    assert recovered == smart["n_recovered"]

def test_razorpay_link_falls_back_to_fixture(monkeypatch):
    import sonic.razorpay_client.client as rc

    monkeypatch.setattr(rc, "create_payment_link", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("no keys")))
    r = client.post("/razorpay/link", json={"amount_paise": 50000})
    assert r.status_code == 200
    body = r.json()
    if body["ok"]:
        assert body["live"] is False
        assert body["id"]
    else:
        assert body["reason"] == "no_keys_no_fixture"

def test_pipeline_endpoint():
    r = client.get("/pipeline", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    assert body["seed"] == _SEED
    assert body["n"] == _N
    assert "fingerprint" in body
    assert "customer_cohorts" in body
    assert set(body["customer_cohorts"]) == {"high", "mid", "low"}
    assert len(body["sample_failures"]) > 0
    assert len(body["sample_substrate"]) > 0
    assert len(body["injected_details"]) > 0

def test_reconciliation_benchmarks():
    r = client.get("/reconciliation/benchmarks", params={"seed": _SEED, "n": _N})
    assert r.status_code == 200
    body = r.json()
    assert body["seed"] == _SEED
    assert body["n"] == _N
    assert "infrastructures" in body
    infras = {i["id"]: i for i in body["infrastructures"]}
    assert set(infras) == {"sonic", "razorpay_default", "stripe", "adyen", "legacy_erp"}
    assert infras["sonic"]["reconciliation_rate"] > infras["razorpay_default"]["reconciliation_rate"]
    assert infras["sonic"]["leakage_basis_points"] == 0
