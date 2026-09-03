"""Diagnosis: Razorpay reason string -> Cause (ARCHITECTURE.md §07).

A pure deterministic table lookup — this is inside the scored path, so NO LLM.
Unknown/unmapped reasons fall back to ISSUER_SOFT_DECLINE (retryable, conservative)
and are surfaced so the mapping table can be extended.
"""

from __future__ import annotations

from tijori.config.constants import REASON_TO_CAUSE, Cause

_FALLBACK = Cause.ISSUER_SOFT_DECLINE


def diagnose(reason_code: str | None) -> Cause:
    """Map a Razorpay reason string to a modeled Cause. Deterministic."""
    if reason_code is None:
        return _FALLBACK
    return REASON_TO_CAUSE.get(reason_code.strip().lower(), _FALLBACK)


def is_mapped(reason_code: str) -> bool:
    """True if the reason is explicitly in the frozen mapping (not the fallback)."""
    return reason_code.strip().lower() in REASON_TO_CAUSE
