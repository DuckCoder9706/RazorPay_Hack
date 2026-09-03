"""Executor: apply a Decision against a failure, draw the outcome from WORLD, and
write the recovery_action + audit rows (ARCHITECTURE.md §07).

Two branches (D2): retry_payment (HERO, measured) and retry_mandate_debit/dun (DEMO).
The outcome is drawn from the WORLD table via simulator.world.draw_outcome — R never
sees WORLD directly; it only receives the realized result, exactly like production.

STATUS: interfaces fixed; bodies land in Week 2.
"""

from __future__ import annotations

import random
import sqlite3

from tijori.recover.policy import Decision


def retry_payment(
    conn: sqlite3.Connection, payment: dict, decision: Decision, rng: random.Random, policy: str
) -> dict:
    """Execute one recovery decision on a one-time failure; persist action + audit. Week 2."""
    raise NotImplementedError("Week 2 · T-exec-onetime")


def retry_mandate_debit(
    conn: sqlite3.Connection, mandate: dict, decision: Decision, rng: random.Random, policy: str
) -> dict:
    """Execute a mandate-renewal recovery (DEMO branch). Week 2."""
    raise NotImplementedError("Week 2 · T-exec-mandate")
