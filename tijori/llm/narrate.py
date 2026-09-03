"""LLM narration + dunning copy — OUTSIDE the scored path, temp 0 + response cache.

The scored engine decides; the LLM only explains ("retried on the 1st because the
failure was insufficient_funds and success peaks at payday") and writes customer copy.

STATUS: interfaces + cache contract fixed; Anthropic calls land later. Falls back to a
deterministic template string when no API key is configured, so the pipeline never
depends on the network.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

CACHE_DIR = Path(".llm_cache")
TEMPERATURE = 0.0


def _cache_key(kind: str, payload: dict) -> str:
    raw = json.dumps({"kind": kind, "payload": payload}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def narrate_decision(decision: dict) -> str:
    """One-line human explanation of a scored decision. Deterministic template fallback."""
    cause = decision.get("cause", "unknown")
    timing = decision.get("timing", "n/a")
    action = decision.get("action", "n/a")
    return f"{action} at {timing} — diagnosed {cause}."  # LLM upgrade later, cached


def dunning_copy(cause: str, customer_value: str) -> str:
    """Hinglish dunning message for a hard-decline path. Template fallback for now."""
    return "Aapka payment fail ho gaya. Please apna card update karein to continue."
