-- Tijori — the one ledger
-- All amounts are integer paise. Timestamps are ISO strings from the SIMULATED clock.
-- R and W share these tables; that shared ledger is the closed loop.

PRAGMA foreign_keys = ON;

-- Merchant orders — source of truth for what was owed. [shared]
CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,
    amount         INTEGER NOT NULL,               -- paise
    currency       TEXT    NOT NULL DEFAULT 'INR',
    status         TEXT    NOT NULL,               -- created | paid | failed
    created_at     TEXT    NOT NULL,
    customer_value TEXT    NOT NULL DEFAULT 'mid'  -- low | mid | high  (F3)
);

-- One-time payment attempts; carries the reason-code on failure. [shared]
CREATE TABLE IF NOT EXISTS payments (
    id          TEXT PRIMARY KEY,
    order_id    TEXT NOT NULL REFERENCES orders(id),
    amount      INTEGER NOT NULL,
    status      TEXT NOT NULL,                      -- captured | failed
    reason_code TEXT,                               -- Razorpay reason string when failed
    attempt_no  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
);

-- Recurring path (DEMO). UPI-Autopay mandates + renewal attempts. [R]
CREATE TABLE IF NOT EXISTS subscriptions (
    id             TEXT PRIMARY KEY,
    order_id       TEXT REFERENCES orders(id),
    mandate_status TEXT NOT NULL,                   -- active | pending | halted
    next_debit     TEXT,
    reason_code    TEXT,
    created_at     TEXT NOT NULL
);

-- What Razorpay WOULD pay out. MODELED, labelled synthetic. [W]
CREATE TABLE IF NOT EXISTS settlements (
    id         TEXT PRIMARY KEY,
    batch_id   TEXT NOT NULL,
    gross      INTEGER NOT NULL,
    fee        INTEGER NOT NULL DEFAULT 0,
    net        INTEGER NOT NULL,
    settled_at TEXT NOT NULL
);

-- Modeled bank-statement credits reconciled against settlements. [W]
CREATE TABLE IF NOT EXISTS bank_rows (
    id            TEXT PRIMARY KEY,
    credit_amount INTEGER NOT NULL,
    value_date    TEXT NOT NULL,
    ref           TEXT
);

-- W's output — the sensor signal R consumes. [W]
CREATE TABLE IF NOT EXISTS exceptions (
    id            TEXT PRIMARY KEY,
    type          TEXT NOT NULL,                    -- fee | timing | missing
    expected      INTEGER NOT NULL,
    observed      INTEGER,
    delta         INTEGER,
    status        TEXT NOT NULL DEFAULT 'open',     -- open | closed
    settlement_id TEXT REFERENCES settlements(id),
    bank_row_id   TEXT REFERENCES bank_rows(id),
    seed          INTEGER,                          -- provenance (#4)
    created_at    TEXT NOT NULL
);

-- R's output — one row per decision, incl. gate + prediction results. [R]
CREATE TABLE IF NOT EXISTS recovery_actions (
    id               TEXT PRIMARY KEY,
    ref              TEXT NOT NULL,                 -- payment_id or exception_id acted on
    cause            TEXT NOT NULL,                 -- Cause enum value
    strategy         TEXT NOT NULL,                 -- retry | dun | stop
    timing_bucket    TEXT,                          -- fast | short | aligned
    predicted_prob   REAL,                          -- BELIEF prob at decision time (F1)
    outcome          TEXT NOT NULL,                 -- recovered | exhausted | abandoned
    reconciled       INTEGER NOT NULL DEFAULT 0,    -- 0/1, set by W re-reconciliation (F1)
    amount_recovered INTEGER NOT NULL DEFAULT 0,
    net_value        INTEGER NOT NULL DEFAULT 0,    -- recovered - costs (F3)
    attempts         INTEGER NOT NULL DEFAULT 0,    -- retry attempts made (for F1 calibration)
    policy           TEXT NOT NULL,                 -- baseline | smart | oracle
    seed             INTEGER,                       -- provenance (#4)
    created_at       TEXT NOT NULL
);

-- Per-batch belief-vs-realized comparison (F1). [shared]
CREATE TABLE IF NOT EXISTS calibration_report (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    seed     INTEGER,                               -- provenance (#4)
    cause    TEXT NOT NULL,
    timing   TEXT NOT NULL,
    n        INTEGER NOT NULL,
    belief   REAL NOT NULL,
    realized REAL NOT NULL,
    brier    REAL,
    drift    REAL                                   -- belief - realized
);

-- Append-only replayable trail. Never UPDATE or DELETE rows here. [shared]
CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      TEXT NOT NULL,                          -- simulated clock
    actor   TEXT NOT NULL,                          -- R | W | eval | sim
    event   TEXT NOT NULL,
    payload TEXT,                                   -- JSON
    seed    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_order   ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_recovery_ref     ON recovery_actions(ref);
CREATE INDEX IF NOT EXISTS idx_recovery_policy  ON recovery_actions(policy);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_audit_event      ON audit_log(event);
