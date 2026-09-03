"""Recovery policy: choose action + timing to maximise NET VALUE (F3), under gates.

Two policies share this module:
  * baseline — Razorpay's cited cause-blind T+1/T+2/T+3 (BASELINE_RETRY_DAYS).
  * smart    — cause-aware argmax over (action, timing) of expected net value on BELIEF.

Expected net value for a retry at timing t:
    E[recovered] * amount  -  C_RETRY  -  C_CHURN * annoyance(attempt) * value_mult
Terminal causes (hard_decline -> dun, risk_blocked -> stop) bypass the argmax.

STATUS: interfaces + net-value formula fixed here; argmax body lands in Week 2.
Everything in this module is deterministic (scored path) — NO LLM.
"""

from __future__ import annotations

from dataclasses import dataclass

from tijori.config.constants import (
    Action,
    Cause,
    Timing,
    is_retryable,
)


@dataclass(slots=True)
class Decision:
    action: Action
    timing: Timing | None
    predicted_prob: float | None
    expected_net_value: int


def choose_smart(cause: Cause, amount_paise: int, attempt_no: int, customer_value: str) -> Decision:
    """Cause-aware net-value argmax on the BELIEF table (smart policy). Week 2."""
    if not is_retryable(cause):
        raise NotImplementedError("Week 2 · T-policy-terminal (dun/stop path)")
    raise NotImplementedError("Week 2 · T-policy-smart (net-value argmax)")


def choose_baseline(cause: Cause, attempt_no: int) -> Decision:
    """Razorpay's cited fixed schedule: retry on T+1/T+2/T+3, cause-blind. Week 2."""
    raise NotImplementedError("Week 2 · T-policy-baseline")
