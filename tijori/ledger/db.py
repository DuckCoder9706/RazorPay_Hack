"""SQLite connection + schema initialisation for the one ledger (ARCHITECTURE.md §05)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")
DEFAULT_DB_PATH = Path("data") / "tijori.db"


def get_conn(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Open a connection with foreign keys on and Row access by column name."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: str | Path = DEFAULT_DB_PATH, *, fresh: bool = False) -> Path:
    """Create the ledger from schema.sql. With fresh=True, delete any existing file first.

    Returns the resolved DB path. Idempotent: re-running against an existing DB is a no-op
    because every DDL statement uses IF NOT EXISTS.
    """
    path = Path(db_path)
    if fresh and path.exists():
        path.unlink()
    ddl = _SCHEMA_PATH.read_text(encoding="utf-8")
    conn = get_conn(path)
    try:
        conn.executescript(ddl)
        conn.commit()
    finally:
        conn.close()
    return path


def table_names(conn: sqlite3.Connection) -> list[str]:
    """Return user table names present in the connected DB (for verification/tests)."""
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [r["name"] for r in rows]
