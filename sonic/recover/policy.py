from __future__ import annotations

from dataclasses import dataclass

from sonic.config.constants import (
    BASELINE_RETRY_DAYS,
    BELIEF_TABLE,
    C_CHURN_PAISE,
    C_RETRY_PAISE,
    CUSTOMER_VALUE_MULTIPLIER,
    MAX_RETRY_ATTEMPTS,
    NET_VALUE_FLOOR_PAISE,
    TERMINAL_ACTION,
    Action,
    Cause,
    Timing,
    is_retryable,
)

BeliefTable = dict[Cause, dict[Timing, float]]

@dataclass(slots=True)
class Decision:
    action: Action
    timing: Timing | None
    predicted_prob: float | None
    expected_net_value: int

def marginal_cost(
    attempt_no: int,
    customer_value: str,
    c_retry: int = C_RETRY_PAISE,
    c_churn: int = C_CHURN_PAISE,
) -> int:
    vmult = CUSTOMER_VALUE_MULTIPLIER[customer_value]
    return round(c_retry + c_churn * vmult * attempt_no)

def choose_smart(
    cause: Cause,
    amount_paise: int,
    attempt_no: int,
    customer_value: str,
    belief: BeliefTable = BELIEF_TABLE,
    c_retry: int = C_RETRY_PAISE,
    c_churn: int = C_CHURN_PAISE,
) -> Decision:
    if not is_retryable(cause):
        return Decision(TERMINAL_ACTION[cause], None, None, 0)

    if attempt_no > MAX_RETRY_ATTEMPTS:
        return Decision(Action.STOP, None, None, 0)

    cost = marginal_cost(attempt_no, customer_value, c_retry, c_churn)
    best_t = max(Timing, key=lambda t: belief[cause][t])
    best_net = round(belief[cause][best_t] * amount_paise - cost)

    if best_net > NET_VALUE_FLOOR_PAISE:
        return Decision(Action.RETRY, best_t, belief[cause][best_t], best_net)
    return Decision(Action.STOP, None, None, best_net)

def choose_baseline(cause: Cause, attempt_no: int) -> Decision:
    if attempt_no <= len(BASELINE_RETRY_DAYS):
        return Decision(Action.RETRY, Timing.SHORT, None, 0)
    return Decision(Action.STOP, None, None, 0)
