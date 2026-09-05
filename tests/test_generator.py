from __future__ import annotations

import random

from sonic.config.constants import Cause
from sonic.ledger.db import get_conn, init_db
from sonic.simulator.generator import (
    generate_onetime_failures,
    generate_settlement_substrate,
)
from sonic.simulator.seed import seed_ledger

def test_onetime_failures_reproducible():
    a = generate_onetime_failures(200, random.Random(42))
    b = generate_onetime_failures(200, random.Random(42))
    assert a == b
    assert len(a) == 200
    assert {f["cause"] for f in a}.issubset({c.value for c in Cause})

def test_onetime_failures_seed_sensitive():
    a = generate_onetime_failures(200, random.Random(1))
    b = generate_onetime_failures(200, random.Random(2))
    assert a != b

def test_cause_mix_reasonable_at_scale():
    fails = generate_onetime_failures(5000, random.Random(7))
    counts = {c.value: 0 for c in Cause}
    for f in fails:
        counts[f["cause"]] += 1
    assert all(v > 0 for v in counts.values())
    top = max(counts, key=counts.get)
    assert top == Cause.INSUFFICIENT_FUNDS.value

def test_settlement_substrate_injects_expected_exceptions():
    sub = generate_settlement_substrate(500, random.Random(42))
    inj = sub["injected"]
    assert len(inj["fee"]) == 500 // 20
    assert len(inj["timing"]) == 500 // 20
    assert len(inj["missing"]) == 500 // 25
    assert len(inj["netting"]) == 3
    assert sum(1 for b in sub["bank_rows"] if b["ref"] == "NET_A") == 1
    hidden = set(inj["missing"]) | {int(s.split("setl_")[1]) for s in inj["netting"]}
    bank_refs = {b["ref"] for b in sub["bank_rows"]}
    for i in hidden:
        assert f"setl_{i:05d}" not in bank_refs

def test_seed_ledger_persists_and_is_reproducible(tmp_path):
    db1, db2 = tmp_path / "a.db", tmp_path / "b.db"
    init_db(db1, fresh=True)
    init_db(db2, fresh=True)
    c1, c2 = get_conn(db1), get_conn(db2)
    try:
        s1 = seed_ledger(c1, seed=42, n=100)
        s2 = seed_ledger(c2, seed=42, n=100)
        assert s1 == s2
        n_pay = c1.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        assert n_pay == s1["n_onetime_failures"] + s1["n_settlements"]
        ev = c1.execute("SELECT event FROM audit_log ORDER BY id").fetchall()
        assert ("batch_generated",) in [tuple(r) for r in ev]
    finally:
        c1.close()
        c2.close()
