"""The single live test-mode path (ARCHITECTURE.md §02 D3).

Creates a real Razorpay Payment Link and reads back real objects — the "this is a genuine
Razorpay object, not a mock" credibility anchor for the demo. This is the ONLY code that
touches the network; the scored batch never calls it, so reproducibility of the ₹ numbers
is unaffected.

Every live response is saved as a JSON fixture under fixtures/ so the demo can replay the
real object without re-hitting the API (keeping the video reproducible). Needs
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).with_name("fixtures")


def _keys() -> tuple[str, str]:
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:  # dotenv optional; env may already be set
        pass
    kid, secret = os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")
    if not kid or not secret:
        raise RuntimeError("Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env (test-mode).")
    if not kid.startswith("rzp_test_"):
        raise RuntimeError(f"Refusing to run: key '{kid[:12]}...' is not a TEST-mode key.")
    return kid, secret


def _client() -> Any:
    import razorpay

    return razorpay.Client(auth=_keys())


def _save_fixture(name: str, obj: dict) -> Path:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIXTURES_DIR / f"{name}.json"
    path.write_text(json.dumps(obj, indent=2, sort_keys=True), encoding="utf-8")
    return path


def load_fixture(name: str) -> dict | None:
    """Replay a saved live response (for the reproducible demo, no network)."""
    path = FIXTURES_DIR / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def create_payment_link(
    amount_paise: int,
    description: str = "Tijori recovery — test-mode Payment Link",
    *,
    save_as: str = "payment_link",
) -> dict:
    """Create a real test-mode Payment Link. Returns the created object (real plink_...)."""
    link = _client().payment_link.create({
        "amount": amount_paise,
        "currency": "INR",
        "accept_partial": False,
        "description": description,
        "notes": {"source": "tijori", "path": "hero-live-object"},
        "reminder_enable": False,
    })
    _save_fixture(save_as, link)
    return link


def fetch_payment_link(plink_id: str, *, save_as: str = "payment_link_status") -> dict:
    """Fetch a Payment Link by id (status: created | paid | ...)."""
    obj = _client().payment_link.fetch(plink_id)
    _save_fixture(save_as, obj)
    return obj


def fetch_payment(payment_id: str, *, save_as: str = "payment") -> dict:
    """Fetch a payment object by id (the real captured/failed object for the demo)."""
    obj = _client().payment.fetch(payment_id)
    _save_fixture(save_as, obj)
    return obj
