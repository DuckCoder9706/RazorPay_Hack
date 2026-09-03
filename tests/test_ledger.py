"""T1 acceptance tests for the ledger DDL + audit log."""

from __future__ import annotations

from tijori.ledger.audit import append, replay
from tijori.ledger.db import get_conn, init_db, table_names

EXPECTED_TABLES = {
    "orders", "payments", "subscriptions", "settlements", "bank_rows",
    "exceptions", "recovery_actions", "calibration_report", "audit_log",
}


def test_init_db_creates_all_tables(tmp_path):
    db = tmp_path / "t.db"
    init_db(db, fresh=True)
    conn = get_conn(db)
    try:
        assert EXPECTED_TABLES.issubset(set(table_names(conn)))
    finally:
        conn.close()


def test_init_db_idempotent(tmp_path):
    db = tmp_path / "t.db"
    init_db(db, fresh=True)
    init_db(db)  # second run must not raise
    conn = get_conn(db)
    try:
        assert EXPECTED_TABLES.issubset(set(table_names(conn)))
    finally:
        conn.close()


def test_audit_append_is_ordered_and_readable(tmp_path):
    db = tmp_path / "t.db"
    init_db(db, fresh=True)
    conn = get_conn(db)
    try:
        append(conn, ts="2026-01-01T00:00:00", actor="sim", event="batch_start", payload={"n": 500})
        append(conn, ts="2026-01-01T00:00:01", actor="R", event="retry", payload={"cause": "insufficient_funds"})
        rows = replay(conn)
        assert [r["event"] for r in rows] == ["batch_start", "retry"]
        assert replay(conn, event="retry")[0]["actor"] == "R"
    finally:
        conn.close()
