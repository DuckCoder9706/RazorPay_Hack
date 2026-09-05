from __future__ import annotations

import sqlite3

from sonic.config.constants import (
    BELIEF_TABLE,
    C_CHURN_PAISE,
    C_RETRY_PAISE,
    MAX_RETRY_ATTEMPTS,
    NET_VALUE_FLOOR_PAISE,
    WORLD_TABLE,
    Action,
    Cause,
    Timing,
)
from sonic.ledger.audit import append as audit_append
from sonic.recover.diagnose import diagnose
from sonic.recover.policy import Decision, choose_baseline, choose_smart, marginal_cost
from sonic.simulator.clock import EPOCH
from sonic.simulator.rng import uniform

_TS = EPOCH.isoformat()

def _load_onetime_failures(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT p.id AS pid, p.amount AS amount, p.reason_code AS reason,"
        "       o.customer_value AS cv "
        "FROM payments p JOIN orders o ON p.order_id = o.id "
        "WHERE p.status = 'failed' AND p.id LIKE 'pay_f%' "
        "ORDER BY p.id"
    ).fetchall()
    return [dict(r) for r in rows]

def _decide(policy: str, cause: Cause, amount: int, attempt: int, cv: str,
            c_retry: int, c_churn: int, belief: dict[Cause, dict[Timing, float]]) -> Decision:
    if policy == "smart":
        return choose_smart(cause, amount, attempt, cv, belief=belief, c_retry=c_retry, c_churn=c_churn)
    return choose_baseline(cause, attempt)

def run_policy(
    conn: sqlite3.Connection, *, seed: int, policy: str,
    c_retry: int = C_RETRY_PAISE, c_churn: int = C_CHURN_PAISE,
    belief: dict[Cause, dict[Timing, float]] | None = None, commit: bool = True,
) -> list[dict]:
    belief = belief if belief is not None else BELIEF_TABLE
    failures = _load_onetime_failures(conn)
    actions: list[dict] = []

    audit_append(conn, ts=_TS, actor="R", event=f"policy_config:{policy}",
                 payload={"c_retry_paise": c_retry, "c_churn_paise": c_churn,
                          "net_value_floor_paise": NET_VALUE_FLOOR_PAISE,
                          "max_attempts": MAX_RETRY_ATTEMPTS}, seed=seed, commit=False)

    for f in failures:
        pid, amount, cv = f["pid"], f["amount"], f["cv"]
        cause = diagnose(f["reason"])

        attempts = 0
        total_cost = 0
        recovered = False
        timing_used: str | None = None
        predicted: float | None = None
        strategy = "stop"

        for attempt_no in range(1, MAX_RETRY_ATTEMPTS + 1):
            decision = _decide(policy, cause, amount, attempt_no, cv, c_retry, c_churn, belief)
            if decision.action is Action.RETRY:
                attempts += 1
                strategy = "retry"
                timing_used = decision.timing.value if decision.timing else None
                predicted = decision.predicted_prob
                total_cost += marginal_cost(attempt_no, cv, c_retry, c_churn)
                u = uniform(seed, pid, attempt_no)
                if u < WORLD_TABLE[cause][decision.timing]:
                    recovered = True
                    break
                continue
            strategy = decision.action.value
            break

        if recovered:
            outcome = "recovered"
        elif attempts >= MAX_RETRY_ATTEMPTS:
            outcome = "exhausted"
        else:
            outcome = "abandoned"

        amount_recovered = amount if recovered else 0
        net_value = amount_recovered - total_cost

        actions.append({
            "id": f"ra_{policy}_{pid}",
            "ref": pid,
            "cause": cause.value,
            "strategy": strategy,
            "timing_bucket": timing_used,
            "predicted_prob": predicted,
            "outcome": outcome,
            "reconciled": 0,
            "amount_recovered": amount_recovered,
            "net_value": net_value,
            "policy": policy,
            "seed": seed,
            "attempts": attempts,
        })

    conn.executemany(
        "INSERT INTO recovery_actions (id, ref, cause, strategy, timing_bucket, predicted_prob,"
        " outcome, reconciled, amount_recovered, net_value, attempts, policy, seed, created_at)"
        " VALUES (:id,:ref,:cause,:strategy,:timing_bucket,:predicted_prob,:outcome,:reconciled,"
        " :amount_recovered,:net_value,:attempts,:policy,:seed, '" + _TS + "')",
        actions,
    )
    audit_append(conn, ts=_TS, actor="R", event=f"policy_run:{policy}",
                 payload={"n": len(actions), "recovered": sum(a["outcome"] == "recovered" for a in actions)},
                 seed=seed, commit=False)
    if commit:
        conn.commit()
    return actions

def run_mandate_policy(conn: sqlite3.Connection, *, seed: int, policy: str) -> list[dict]:
    raise NotImplementedError("Week 2b · mandate DEMO branch (reuses run_policy loop)")
