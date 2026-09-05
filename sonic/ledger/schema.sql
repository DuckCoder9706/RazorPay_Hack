PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,
    amount         INTEGER NOT NULL,
    currency       TEXT    NOT NULL DEFAULT 'INR',
    status         TEXT    NOT NULL,
    created_at     TEXT    NOT NULL,
    customer_value TEXT    NOT NULL DEFAULT 'mid'
);

CREATE TABLE IF NOT EXISTS payments (
    id          TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL REFERENCES orders(id),
    amount      INTEGER NOT NULL,
    status      TEXT NOT NULL,
    reason_code TEXT,
    attempt_no  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id             TEXT PRIMARY KEY,
    order_id       TEXT REFERENCES orders(id),
    mandate_status TEXT NOT NULL,
    next_debit     TEXT,
    reason_code    TEXT,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settlements (
    id         TEXT PRIMARY KEY,
    batch_id   TEXT NOT NULL,
    gross      INTEGER NOT NULL,
    fee        INTEGER NOT NULL DEFAULT 0,
    net        INTEGER NOT NULL,
    settled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_rows (
    id            TEXT PRIMARY KEY,
    credit_amount INTEGER NOT NULL,
    value_date    TEXT NOT NULL,
    ref           TEXT
);

CREATE TABLE IF NOT EXISTS exceptions (
    id            TEXT PRIMARY KEY,
    type          TEXT NOT NULL,
    expected      INTEGER NOT NULL,
    observed      INTEGER,
    delta         INTEGER,
    status        TEXT NOT NULL DEFAULT 'open',
    settlement_id TEXT REFERENCES settlements(id),
    bank_row_id   TEXT REFERENCES bank_rows(id),
    seed          INTEGER,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_actions (
    id               TEXT PRIMARY KEY,
    ref              TEXT NOT NULL,
    cause            TEXT NOT NULL,
    strategy         TEXT NOT NULL,
    timing_bucket    TEXT,
    predicted_prob   REAL,
    outcome          TEXT NOT NULL,
    reconciled       INTEGER NOT NULL DEFAULT 0,
    amount_recovered INTEGER NOT NULL DEFAULT 0,
    net_value        INTEGER NOT NULL DEFAULT 0,
    attempts         INTEGER NOT NULL DEFAULT 0,
    policy           TEXT NOT NULL,
    seed             INTEGER,
    created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calibration_report (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    seed     INTEGER,
    cause    TEXT NOT NULL,
    timing   TEXT NOT NULL,
    n        INTEGER NOT NULL,
    belief   REAL NOT NULL,
    realized REAL NOT NULL,
    brier    REAL,
    drift    REAL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      TEXT NOT NULL,
    actor   TEXT NOT NULL,
    event   TEXT NOT NULL,
    payload TEXT,
    seed    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order   ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_recovery_ref     ON recovery_actions(ref);
CREATE INDEX IF NOT EXISTS idx_recovery_policy  ON recovery_actions(policy);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_audit_event      ON audit_log(event);
