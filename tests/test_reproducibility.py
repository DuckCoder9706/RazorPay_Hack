"""Reproducibility tests: RNG substreams (#1) + golden snapshot (#2) + sweep determinism."""

from __future__ import annotations

from tijori.eval.sweep import default_seeds, run_sweep
from tijori.simulator.generator import generate_onetime_failures
from tijori.simulator.rng import derive_seed, make_streams
from tijori.simulator.seed import batch_fingerprint

# Golden snapshot (#2): if this changes, determinism changed — investigate before updating.
GOLDEN_42_100 = "733cf18fd8913e203da269787ac58df1e74b818db8e099eca55919631c2833a0"


def test_golden_fingerprint_stable():
    assert batch_fingerprint(42, 100) == GOLDEN_42_100
    assert batch_fingerprint(42, 100) == batch_fingerprint(42, 100)


def test_derive_seed_deterministic_and_distinct():
    assert derive_seed(42, "generator") == derive_seed(42, "generator")
    assert derive_seed(42, "generator") != derive_seed(42, "outcome")
    assert derive_seed(1, "generator") != derive_seed(2, "generator")


def test_substreams_are_independent():
    # Consuming the 'outcome' stream must NOT change what 'generator' produces (#1).
    s = make_streams(42)
    first = generate_onetime_failures(50, s.generator)
    s2 = make_streams(42)
    for _ in range(1000):
        s2.outcome.random()  # burn the outcome stream heavily
    second = generate_onetime_failures(50, s2.generator)
    assert first == second


def test_sweep_is_reproducible():
    seeds = default_seeds(5)
    a = run_sweep(seeds, n=100)
    b = run_sweep(seeds, n=100)
    assert a == b
    assert a["n_batches"] == 5
    assert a["total_failures"] == 500


def test_sweep_recoverable_fraction_reasonable():
    r = run_sweep(default_seeds(10), n=200)
    frac = r["retryable_pooled"] / r["total_failures"]
    assert 0.75 <= frac <= 0.85  # ~80% recoverable (hard_decline+risk_blocked ~20%)
