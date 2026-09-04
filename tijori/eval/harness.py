"""The batch runner (ARCHITECTURE.md §09, §10).

run_batch(seed, n): seed the ledger, run baseline + smart over the SAME failures with the
SAME keyed WORLD luck, compute the distributional-oracle ceiling (F2), and return the
metrics table. Fully reproducible: same (seed, n) -> identical numbers.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from tijori.config.constants import DEFAULT_BATCH_SIZE, DEFAULT_SEED, MAX_RETRY_ATTEMPTS
from tijori.eval.metrics import BatchMetrics, summarise
from tijori.eval.oracle import oracle_recovers
from tijori.ledger.db import init_db, get_conn, memory_db
from tijori.recover.diagnose import diagnose
from tijori.recover.executor import run_policy
from tijori.simulator.seed import seed_ledger


@dataclass(slots=True)
class BatchResult:
    seed: int
    n: int
    oracle_paise: int
    metrics: dict[str, BatchMetrics] = field(default_factory=dict)


def _oracle_ceiling(conn, seed: int) -> int:
    """Clairvoyant-timing reachable maximum under identical luck (F2). A true ceiling."""
    rows = conn.execute(
        "SELECT p.id AS pid, p.amount AS amount, p.reason_code AS reason "
        "FROM payments p WHERE p.status='failed' AND p.id LIKE 'pay_f%'"
    ).fetchall()
    total = 0
    for r in rows:
        if oracle_recovers(diagnose(r["reason"]), seed, r["pid"], MAX_RETRY_ATTEMPTS):
            total += r["amount"]
    return total


def run_batch(
    seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE, *, db_path: str | None = None
) -> BatchResult:
    """Run one fully-reproducible scored batch. Persists to db_path if given, else memory."""
    if db_path is None:
        conn = memory_db()
    else:
        init_db(db_path, fresh=True)
        conn = get_conn(db_path)

    try:
        seed_ledger(conn, seed=seed, n=n)
        oracle = _oracle_ceiling(conn, seed)
        result = BatchResult(seed=seed, n=n, oracle_paise=oracle)
        for policy in ("baseline", "smart"):
            rows = run_policy(conn, seed=seed, policy=policy)
            result.metrics[policy] = summarise(policy, rows, oracle_paise=oracle)
        return result
    finally:
        conn.close()
