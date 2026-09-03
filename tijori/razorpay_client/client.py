"""The single live test-mode path (ARCHITECTURE.md §02 D3): create a Payment Link,
read back the payment object. Needs RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env.

STATUS: interfaces fixed; SDK calls land in Week 2. Pre-record the response for the video.
"""

from __future__ import annotations

import os


def _keys() -> tuple[str, str]:
    kid, secret = os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")
    if not kid or not secret:
        raise RuntimeError("Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env (test-mode).")
    return kid, secret


def create_payment_link(amount_paise: int, description: str) -> dict:
    """Create a test-mode Payment Link and return the created object. Week 2."""
    raise NotImplementedError("Week 2 · T-live-payment-link")


def fetch_payment(payment_id: str) -> dict:
    """Fetch a payment object by id (the real object for the demo). Week 2."""
    raise NotImplementedError("Week 2 · T-live-fetch")
