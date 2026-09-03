"""3-way matcher: settlement <-> bank <-> orders (ARCHITECTURE.md §07, W).

Exact + tolerance matching, plus ONE many-to-many netting case (a settlement batch
vs a lump-sum bank credit). Purely deterministic — NO LLM (optional fuzzy hints live
in tijori.llm and stay OUTSIDE scoring).

STATUS: interfaces fixed; matching logic lands in Week 3 (2-way fallback if W2 slips).
"""

from __future__ import annotations

import sqlite3


def reconcile(conn: sqlite3.Connection, *, tolerance_paise: int = 0) -> list[dict]:
    """Match settlements to bank rows to orders; return unmatched/mismatched records. Week 3."""
    raise NotImplementedError("Week 3 · T-match-3way")


def net_batch(conn: sqlite3.Connection) -> list[dict]:
    """Resolve the many-to-many netting case (settlement batch vs lump-sum credit). Week 3."""
    raise NotImplementedError("Week 3 · T-match-netting")
