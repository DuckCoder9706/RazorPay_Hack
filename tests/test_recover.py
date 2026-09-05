from __future__ import annotations

from sonic.config.constants import Action, Cause, Timing
from sonic.recover.policy import choose_baseline, choose_smart

def test_smart_duns_hard_decline():
    assert choose_smart(Cause.HARD_DECLINE, 100_000, 1, "mid").action is Action.DUN

def test_smart_stops_risk_blocked():
    assert choose_smart(Cause.RISK_BLOCKED, 100_000, 1, "mid").action is Action.STOP

def test_smart_picks_aligned_for_insufficient_funds():
    d = choose_smart(Cause.INSUFFICIENT_FUNDS, 100_000, 1, "mid")
    assert d.action is Action.RETRY and d.timing is Timing.ALIGNED

def test_smart_argmax_flips_on_issuer_soft_bias():
    assert choose_smart(Cause.ISSUER_SOFT_DECLINE, 100_000, 1, "mid").timing is Timing.FAST

def test_smart_stops_chasing_tiny_amount(f3="net-value floor"):
    assert choose_smart(Cause.INSUFFICIENT_FUNDS, 100, 3, "high").action is Action.STOP

def test_baseline_is_cause_blind_short_then_stops():
    d1 = choose_baseline(Cause.HARD_DECLINE, 1)
    assert d1.action is Action.RETRY and d1.timing is Timing.SHORT
    assert choose_baseline(Cause.HARD_DECLINE, 4).action is Action.STOP
