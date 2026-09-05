from __future__ import annotations

import pytest

from sonic.razorpay_client import client

def test_rejects_non_test_mode_key(monkeypatch):
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_shouldnotrun")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "whatever")
    with pytest.raises(RuntimeError, match="TEST-mode"):
        client._keys()

def test_load_fixture_missing_returns_none():
    assert client.load_fixture("definitely_not_a_saved_fixture") is None

def test_saved_payment_link_fixture_is_a_real_object():
    obj = client.load_fixture("payment_link")
    if obj is not None:
        assert obj["id"].startswith("plink_")
        assert obj["currency"] == "INR"
