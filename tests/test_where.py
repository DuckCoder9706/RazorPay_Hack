from __future__ import annotations

from tijori.eval.harness import learning_run
from tijori.ledger.db import memory_db
from tijori.recover.executor import run_policy
from tijori.simulator.seed import build_batch, seed_ledger
from tijori.where.exceptions import reconcile_recoveries, run_reconciliation

def test_w_detects_exactly_the_injected_exceptions():
    conn = memory_db()
    try:
        seed_ledger(conn, seed=42, n=500)
        s = run_reconciliation(conn, seed=42)
    finally:
        conn.close()
    inj = build_batch(42, 500)["substrate"]["injected"]
    assert s["detected"].get("fee", 0) == len(inj["fee"])
    assert s["detected"].get("timing", 0) == len(inj["timing"])
    assert s["detected"].get("missing", 0) == len(inj["missing"])
    assert s["netting_reconciled"] == len(inj["netting"])

def test_exceptions_persisted_open():
    conn = memory_db()
    try:
        seed_ledger(conn, seed=42, n=200)
        run_reconciliation(conn, seed=42)
        n_open = conn.execute("SELECT COUNT(*) FROM exceptions WHERE status='open'").fetchone()[0]
        assert n_open > 0
    finally:
        conn.close()

def test_reconcile_recoveries_marks_recovered_actions():
    conn = memory_db()
    try:
        seed_ledger(conn, seed=42, n=200)
        rows = run_policy(conn, seed=42, policy="smart")
        n_marked = reconcile_recoveries(conn, policy="smart")
        n_recovered = sum(1 for r in rows if r["outcome"] == "recovered")
        assert n_marked == n_recovered
    finally:
        conn.close()

def test_f1_flips_argmax_and_shrinks_regret():
    traj = learning_run(seed=42, n=500, batches=5)
    assert traj[0]["issuer_timing"] == "fast"
    assert traj[-1]["issuer_timing"] == "short"
    assert traj[-1]["regret_paise"] <= traj[0]["regret_paise"]
    assert traj[-1]["mean_brier"] <= traj[0]["mean_brier"]

def test_f1_without_recalibration_never_learns():
    traj = learning_run(seed=42, n=500, batches=3, recalibrate_on=False)
    assert all(t["issuer_timing"] == "fast" for t in traj)
