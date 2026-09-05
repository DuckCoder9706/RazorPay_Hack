"""SQLite connection + schema initialisation for the one ledger."""

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


def init_schema(conn: sqlite3.Connection) -> sqlite3.Connection:
    """Apply the DDL to an already-open connection (used for in-memory sweep DBs)."""
    conn.executescript(_SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.commit()
    return conn


def init_db(db_path: str | Path = DEFAULT_DB_PATH, *, fresh: bool = False) -> Path:
    """Create the ledger from schema.sql. With fresh=True, delete any existing file first.

    Returns the resolved DB path. Idempotent: re-running against an existing DB is a no-op
    because every DDL statement uses IF NOT EXISTS.
    """
    path = Path(db_path)
    if fresh and path.exists():
        path.unlink()
    conn = get_conn(path)
    try:
        init_schema(conn)
    finally:
        conn.close()
    return path


def memory_db() -> sqlite3.Connection:
    """An in-memory ledger with the schema applied (fast, for sweeps/tests)."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return init_schema(conn)


def table_names(conn: sqlite3.Connection) -> list[str]:
    """Return user table names present in the connected DB (for verification/tests)."""
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    return [r["name"] for r in rows]
