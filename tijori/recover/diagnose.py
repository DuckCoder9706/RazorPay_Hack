from __future__ import annotations

from tijori.config.constants import REASON_TO_CAUSE, Cause

_FALLBACK = Cause.ISSUER_SOFT_DECLINE

def diagnose(reason_code: str | None) -> Cause:
    if reason_code is None:
        return _FALLBACK
    return REASON_TO_CAUSE.get(reason_code.strip().lower(), _FALLBACK)

def is_mapped(reason_code: str) -> bool:
    return reason_code.strip().lower() in REASON_TO_CAUSE
