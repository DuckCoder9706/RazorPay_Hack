from __future__ import annotations

import json
import sqlite3
from typing import Any

from tijori.config.constants import DEFAULT_SEED

def append(
    conn: sqlite3.Connection,
    *,
    ts: str,
    actor: str,
    event: str,
    payload: dict[str, Any] | None = None,
    seed: int = DEFAULT_SEED,
    commit: bool = True,
) -> None:
    conn.execute(
        "INSERT INTO audit_log (ts, actor, event, payload, seed) VALUES (?, ?, ?, ?, ?)",
        (ts, actor, event, json.dumps(payload or {}, sort_keys=True), seed),
    )
    if commit:
        conn.commit()

def replay(conn: sqlite3.Connection, *, event: str | None = None) -> list[sqlite3.Row]:
    if event is None:
        return conn.execute("SELECT * FROM audit_log ORDER BY id").fetchall()
    return conn.execute(
        "SELECT * FROM audit_log WHERE event = ? ORDER BY id", (event,)
    ).fetchall()
