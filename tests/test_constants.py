from __future__ import annotations

import math

import pytest

from sonic.config import constants as C
from sonic.recover.diagnose import diagnose, is_mapped

def test_validate_passes():
    C.validate()

def test_distribution_sums_to_one():
    assert math.isclose(sum(C.REASON_CODE_DISTRIBUTION.values()), 1.0, abs_tol=1e-9)

def test_every_cause_has_distribution_world_belief():
    for cause in C.Cause:
        assert cause in C.REASON_CODE_DISTRIBUTION
        assert set(C.WORLD_TABLE[cause]) == set(C.Timing)
        assert set(C.BELIEF_TABLE[cause]) == set(C.Timing)

def test_probabilities_in_range():
    for table in (C.WORLD_TABLE, C.BELIEF_TABLE):
        for cause in C.Cause:
            for timing in C.Timing:
                assert 0.0 <= table[cause][timing] <= 1.0

def test_terminal_causes_not_retryable():
    assert not C.is_retryable(C.Cause.HARD_DECLINE)
    assert not C.is_retryable(C.Cause.RISK_BLOCKED)
    assert C.is_retryable(C.Cause.INSUFFICIENT_FUNDS)

def test_belief_differs_from_world_somewhere():
    diffs = [
        C.WORLD_TABLE[c][t] != C.BELIEF_TABLE[c][t]
        for c in C.Cause
        for t in C.Timing
    ]
    assert any(diffs), "BELIEF must differ from WORLD or F1 calibration is trivial"

@pytest.mark.parametrize(
    "reason,expected",
    [
        ("insufficient_funds", C.Cause.INSUFFICIENT_FUNDS),
        ("card_expired", C.Cause.HARD_DECLINE),
        ("gateway_technical_error", C.Cause.TECHNICAL_TRANSIENT),
        ("payment_risk_check_failed", C.Cause.RISK_BLOCKED),
    ],
)
def test_diagnose_known_reasons(reason, expected):
    assert diagnose(reason) is expected
    assert is_mapped(reason)

def test_diagnose_unknown_falls_back():
    assert diagnose("some_new_reason_razorpay_added") is C.Cause.ISSUER_SOFT_DECLINE
    assert diagnose(None) is C.Cause.ISSUER_SOFT_DECLINE
