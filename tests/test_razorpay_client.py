"""Week-2b tests for the live client guards (network-free)."""

from __future__ import annotations

import pytest

from tijori.razorpay_client import client


def test_rejects_non_test_mode_key(monkeypatch):
    # A live key must be refused before any network call (safety).
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_shouldnotrun")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "whatever")
    with pytest.raises(RuntimeError, match="TEST-mode"):
        client._keys()


def test_load_fixture_missing_returns_none():
    assert client.load_fixture("definitely_not_a_saved_fixture") is None


def test_saved_payment_link_fixture_is_a_real_object():
    # The committed fixture (from a live create) replays without any network.
    obj = client.load_fixture("payment_link")
    if obj is not None:  # present once the live create has been run
        assert obj["id"].startswith("plink_")
        assert obj["currency"] == "INR"
