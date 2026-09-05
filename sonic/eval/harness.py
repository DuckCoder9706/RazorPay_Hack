from __future__ import annotations

from dataclasses import dataclass, field

from sonic.config.constants import (
    C_CHURN_PAISE,
    C_RETRY_PAISE,
    DEFAULT_BATCH_SIZE,
    DEFAULT_SEED,
    MAX_RETRY_ATTEMPTS,
)
from sonic.eval.metrics import BatchMetrics, summarise
from sonic.eval.oracle import oracle_recovers
from sonic.ledger.db import init_db, get_conn, memory_db
from sonic.recover.diagnose import diagnose
from sonic.recover.executor import run_policy
from sonic.simulator.seed import seed_ledger

@dataclass(slots=True)
class BatchResult:
    seed: int
    n: int
    oracle_paise: int
    at_risk_paise: int = 0
    metrics: dict[str, BatchMetrics] = field(default_factory=dict)

def _oracle_ceiling(conn, seed: int) -> int:
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
    seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE, *, db_path: str | None = None,
    c_retry: int = C_RETRY_PAISE, c_churn: int = C_CHURN_PAISE,
) -> BatchResult:
    if db_path is None:
        conn = memory_db()
    else:
        init_db(db_path, fresh=True)
        conn = get_conn(db_path)

    try:
        seed_ledger(conn, seed=seed, n=n)
        oracle = _oracle_ceiling(conn, seed)
        at_risk = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM payments "
            "WHERE status='failed' AND id LIKE 'pay_f%'"
        ).fetchone()[0]
        result = BatchResult(seed=seed, n=n, oracle_paise=oracle, at_risk_paise=at_risk)
        for policy in ("baseline", "smart"):
            rows = run_policy(conn, seed=seed, policy=policy, c_retry=c_retry, c_churn=c_churn)
            result.metrics[policy] = summarise(policy, rows, oracle_paise=oracle)
        return result
    finally:
        conn.close()

def learning_run(
    seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE, batches: int = 5,
    *, recalibrate_on: bool = True,
) -> list[dict]:
    from sonic.config.constants import Cause
    from sonic.simulator.belief import Belief
    from sonic.where.calibration import build_report, mean_brier, recalibrate
    from sonic.where.exceptions import reconcile_recoveries

    belief = Belief()
    traj: list[dict] = []
    for b in range(batches):
        s = seed + b
        conn = memory_db()
        try:
            seed_ledger(conn, seed=s, n=n)
            oracle = _oracle_ceiling(conn, s)
            rows = run_policy(conn, seed=s, policy="smart", belief=belief.snapshot())
            m = summarise("smart", rows, oracle_paise=oracle)
            reconcile_recoveries(conn, policy="smart")
            report = build_report(rows, belief)
            traj.append({
                "batch": b, "seed": s,
                "issuer_timing": belief.best_timing(Cause.ISSUER_SOFT_DECLINE).value,
                "efficiency": m.efficiency,
                "regret_paise": m.regret_paise,
                "gross_paise": m.gross_recovered_paise,
                "mean_brier": mean_brier(report),
            })
            if recalibrate_on:
                recalibrate(belief, report)
        finally:
            conn.close()
    return traj

def churn_sweep(
    seed: int = DEFAULT_SEED, n: int = DEFAULT_BATCH_SIZE, churns: tuple[int, ...] | None = None
) -> list[dict]:
    from sonic.config.constants import CHURN_SWEEP_PAISE

    churns = churns if churns is not None else CHURN_SWEEP_PAISE
    out: list[dict] = []
    for c in churns:
        r = run_batch(seed=seed, n=n, c_churn=c)
        b, s = r.metrics["baseline"], r.metrics["smart"]
        out.append({
            "c_churn_paise": c,
            "baseline_net": b.net_value_paise,
            "smart_net": s.net_value_paise,
            "baseline_gross": b.gross_recovered_paise,
            "smart_gross": s.gross_recovered_paise,
            "smart_attempts": s.n_attempts,
            "smart_wins_net": s.net_value_paise > b.net_value_paise,
            "smart_wins_gross": s.gross_recovered_paise > b.gross_recovered_paise,
        })
    return out
