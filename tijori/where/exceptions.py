"""Exception classifier: turn match residuals into typed exceptions (fee | timing |
missing) and close them when recovered money re-reconciles (ARCHITECTURE.md §07).

STATUS: interfaces fixed; classification + close logic land in Week 3.
"""

from __future__ import annotations

import sqlite3

EXCEPTION_TYPES = ("fee", "timing", "missing")


def classify(conn: sqlite3.Connection, residuals: list[dict]) -> list[dict]:
    """Classify each match residual into fee/timing/missing; persist to `exceptions`. Week 3."""
    raise NotImplementedError("Week 3 · T-exc-classify")


def close_on_recovery(conn: sqlite3.Connection, recovery_action_id: str) -> bool:
    """Re-reconcile a recovered event and close the matching exception (the loop). Week 3."""
    raise NotImplementedError("Week 3 · T-exc-close")
