"""Week-2 acceptance tests for the scored batch runner."""

from __future__ import annotations

from tijori.eval.harness import run_batch


def test_run_batch_reproducible():
    a = run_batch(seed=42, n=200)
    b = run_batch(seed=42, n=200)
    assert a.oracle_paise == b.oracle_paise
    assert a.metrics["smart"].gross_recovered_paise == b.metrics["smart"].gross_recovered_paise
    assert a.metrics["baseline"].gross_recovered_paise == b.metrics["baseline"].gross_recovered_paise


def test_smart_beats_baseline_gross_and_net():
    r = run_batch(seed=42, n=300)
    assert r.metrics["smart"].gross_recovered_paise > r.metrics["baseline"].gross_recovered_paise
    assert r.metrics["smart"].net_value_paise > r.metrics["baseline"].net_value_paise


def test_oracle_is_a_valid_ceiling():
    r = run_batch(seed=42, n=300)
    for m in r.metrics.values():
        assert 0.0 <= m.efficiency <= 1.0  # no policy can beat the reachable maximum


def test_smart_has_nonzero_regret_for_f1():
    # The argmax-flipping bias leaves headroom for F1 to close in Week 3.
    r = run_batch(seed=42, n=500)
    assert r.metrics["smart"].efficiency < 1.0


def test_baseline_over_retries():
    r = run_batch(seed=42, n=300)
    assert r.metrics["baseline"].n_attempts > r.metrics["smart"].n_attempts


def test_churn_sweep_smart_always_wins():
    # F3: whatever the (unknowable) churn cost, smart should still beat baseline on net
    # value — the ranking is robust, not tuned to one guessed constant.
    from tijori.eval.harness import churn_sweep

    rows = churn_sweep(seed=42, n=300, churns=(0, 250, 500, 1000, 2000))
    assert all(r["smart_wins_net"] for r in rows)
    # higher churn should not increase smart's retry count (it stops earlier, never more)
    attempts = [r["smart_attempts"] for r in rows]
    assert attempts == sorted(attempts, reverse=True)


def test_recovery_actions_persisted():
    from tijori.ledger.db import memory_db
    from tijori.simulator.seed import seed_ledger
    from tijori.recover.executor import run_policy

    conn = memory_db()
    try:
        seed_ledger(conn, seed=42, n=100)
        run_policy(conn, seed=42, policy="smart")
        n = conn.execute("SELECT COUNT(*) FROM recovery_actions WHERE policy='smart'").fetchone()[0]
        assert n == 100
    finally:
        conn.close()
