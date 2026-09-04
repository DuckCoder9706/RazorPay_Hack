"""Frozen configuration constants for Tijori (T1).

This module is the single source of truth for the seeded, reproducible model.
Every value here is either 📎 CITED or 🧪 MODELED per docs/outcome-model.md (T0.5).
Nothing here reads the wall clock, the network, or the environment at import time.

See ARCHITECTURE.md §06 (outcome model) and docs/outcome-model.md for provenance.
"""

from __future__ import annotations

import enum

# --------------------------------------------------------------------------- #
# Determinism
# --------------------------------------------------------------------------- #
#: The one seed. Threaded through generator, distribution draws, WORLD outcome
#: draws, and any calibration ordering. Same seed -> byte-identical scored output.
DEFAULT_SEED: int = 42

#: Default number of synthetic one-time failures in a scored batch (D9 rec: 500).
DEFAULT_BATCH_SIZE: int = 500

#: All monetary amounts are integer paise (₹1 = 100 paise) for exact arithmetic.
PAISE_PER_RUPEE: int = 100


# --------------------------------------------------------------------------- #
# The frozen cause enum  (docs/outcome-model.md §2)
# 109 documented Razorpay `reason` values collapse into these 8 causes,
# each defined by a distinct recovery behaviour.
# --------------------------------------------------------------------------- #
class Cause(str, enum.Enum):
    INSUFFICIENT_FUNDS = "insufficient_funds"
    ISSUER_SOFT_DECLINE = "issuer_soft_decline"
    AUTHENTICATION_FAILED = "authentication_failed"
    USER_DROPPED = "user_dropped"
    TECHNICAL_TRANSIENT = "technical_transient"
    LIMIT_EXCEEDED = "limit_exceeded"
    HARD_DECLINE = "hard_decline"      # not retryable -> dun (needs new instrument)
    RISK_BLOCKED = "risk_blocked"      # not retryable -> stop


class Timing(str, enum.Enum):
    FAST = "fast"        # minutes-to-hours (transient conditions, user re-attempt)
    SHORT = "short"      # next-day (~ Razorpay's T+1) — the cause-blind default
    ALIGNED = "aligned"  # wait for salary credit (~month-end/1st) or a limit reset


class Action(str, enum.Enum):
    RETRY = "retry"
    DUN = "dun"          # send a card-update / payment message; do not auto-retry
    STOP = "stop"        # give up (irreducible)


# --------------------------------------------------------------------------- #
# Razorpay reason -> Cause mapping  (docs/outcome-model.md §2)
# Source reason strings are 📎 CITED (Razorpay error-reasons enum);
# the grouping into causes is 🧪 MODELED. Representative subset of the 109.
# --------------------------------------------------------------------------- #
REASON_TO_CAUSE: dict[str, Cause] = {
    # insufficient funds
    "insufficient_funds": Cause.INSUFFICIENT_FUNDS,
    "credit_limit_exceeded": Cause.INSUFFICIENT_FUNDS,
    # issuer soft decline (do-not-honor / code 05)
    "card_declined": Cause.ISSUER_SOFT_DECLINE,
    "payment_declined": Cause.ISSUER_SOFT_DECLINE,
    "debit_declined": Cause.ISSUER_SOFT_DECLINE,
    "authorisation_declined_by_psp": Cause.ISSUER_SOFT_DECLINE,
    # authentication (OTP / PIN)
    "authentication_failed": Cause.AUTHENTICATION_FAILED,
    "incorrect_otp": Cause.AUTHENTICATION_FAILED,
    "otp_expired": Cause.AUTHENTICATION_FAILED,
    "incorrect_pin": Cause.AUTHENTICATION_FAILED,
    "pin_attempts_exceeded": Cause.AUTHENTICATION_FAILED,
    "otp_attempts_exceeded": Cause.AUTHENTICATION_FAILED,
    # user dropped / expired
    "payment_cancelled": Cause.USER_DROPPED,
    "payment_collect_request_expired": Cause.USER_DROPPED,
    "payment_session_expired": Cause.USER_DROPPED,
    "payment_timed_out": Cause.USER_DROPPED,
    "collect_request_pending": Cause.USER_DROPPED,
    # transient technical
    "gateway_technical_error": Cause.TECHNICAL_TRANSIENT,
    "issuer_technical_error": Cause.TECHNICAL_TRANSIENT,
    "bank_not_available": Cause.TECHNICAL_TRANSIENT,
    "bank_technical_error": Cause.TECHNICAL_TRANSIENT,
    "server_error": Cause.TECHNICAL_TRANSIENT,
    "payment_declined_due_to_high_traffic": Cause.TECHNICAL_TRANSIENT,
    "psp_not_available": Cause.TECHNICAL_TRANSIENT,
    "upi_app_technical_error": Cause.TECHNICAL_TRANSIENT,
    # limits
    "transaction_daily_limit_exceeded": Cause.LIMIT_EXCEEDED,
    "transaction_limit_exceeded": Cause.LIMIT_EXCEEDED,
    "transaction_frequency_limit_exceeded": Cause.LIMIT_EXCEEDED,
    # hard decline (needs a new instrument)
    "card_expired": Cause.HARD_DECLINE,
    "card_number_invalid": Cause.HARD_DECLINE,
    "incorrect_card_details": Cause.HARD_DECLINE,
    "card_not_enrolled": Cause.HARD_DECLINE,
    "debit_instrument_blocked": Cause.HARD_DECLINE,
    "international_transaction_not_allowed": Cause.HARD_DECLINE,
    # risk / compliance
    "payment_risk_check_failed": Cause.RISK_BLOCKED,
    "compliance_violation": Cause.RISK_BLOCKED,
}

#: One representative Razorpay reason string to emit per cause when generating
#: synthetic failures (keeps the demo speaking Razorpay's own vocabulary).
CAUSE_TO_SAMPLE_REASON: dict[Cause, str] = {
    Cause.INSUFFICIENT_FUNDS: "insufficient_funds",
    Cause.ISSUER_SOFT_DECLINE: "card_declined",
    Cause.AUTHENTICATION_FAILED: "incorrect_otp",
    Cause.USER_DROPPED: "payment_collect_request_expired",
    Cause.TECHNICAL_TRANSIENT: "gateway_technical_error",
    Cause.LIMIT_EXCEEDED: "transaction_daily_limit_exceeded",
    Cause.HARD_DECLINE: "card_expired",
    Cause.RISK_BLOCKED: "payment_risk_check_failed",
}


# --------------------------------------------------------------------------- #
# Reason-code distribution  (docs/outcome-model.md §3) — HYBRID
# Anchors 📎 CITED (Ethoca card declines, NPCI UPI TD/BD); blend 🧪 MODELED.
# Weights MUST sum to 1.0 (asserted in validate()).
# --------------------------------------------------------------------------- #
REASON_CODE_DISTRIBUTION: dict[Cause, float] = {
    Cause.INSUFFICIENT_FUNDS: 0.34,   # NSF ~44% of card declines (Ethoca), blended
    Cause.HARD_DECLINE: 0.18,         # "incorrect details" ~1-in-5 + expired/invalid
    Cause.ISSUER_SOFT_DECLINE: 0.12,  # do-not-honor (code 05)
    Cause.AUTHENTICATION_FAILED: 0.12,  # UPI business-decline dominant (wrong PIN)
    Cause.USER_DROPPED: 0.10,         # collect expiry / cancellations / timeouts
    Cause.TECHNICAL_TRANSIENT: 0.08,  # NPCI TD ~0.7-0.8% of txns; card code 96
    Cause.LIMIT_EXCEEDED: 0.04,       # daily/txn/frequency caps
    Cause.RISK_BLOCKED: 0.02,         # suspected fraud (code 59)
}


# --------------------------------------------------------------------------- #
# WORLD table — the *true* generative success probabilities  🧪 MODELED
# (cause, timing) -> P(retry succeeds). Drives outcome draws AND the oracle bound.
# docs/outcome-model.md §4. Anchored so the retryable population lands ~50%->60%.
# --------------------------------------------------------------------------- #
WORLD_TABLE: dict[Cause, dict[Timing, float]] = {
    Cause.INSUFFICIENT_FUNDS:   {Timing.FAST: 0.15, Timing.SHORT: 0.30, Timing.ALIGNED: 0.62},
    Cause.ISSUER_SOFT_DECLINE:  {Timing.FAST: 0.35, Timing.SHORT: 0.55, Timing.ALIGNED: 0.50},
    Cause.AUTHENTICATION_FAILED:{Timing.FAST: 0.70, Timing.SHORT: 0.45, Timing.ALIGNED: 0.30},
    Cause.USER_DROPPED:         {Timing.FAST: 0.72, Timing.SHORT: 0.40, Timing.ALIGNED: 0.25},
    Cause.TECHNICAL_TRANSIENT:  {Timing.FAST: 0.75, Timing.SHORT: 0.50, Timing.ALIGNED: 0.42},
    Cause.LIMIT_EXCEEDED:       {Timing.FAST: 0.10, Timing.SHORT: 0.35, Timing.ALIGNED: 0.60},
    Cause.HARD_DECLINE:         {Timing.FAST: 0.02, Timing.SHORT: 0.02, Timing.ALIGNED: 0.02},
    Cause.RISK_BLOCKED:         {Timing.FAST: 0.00, Timing.SHORT: 0.00, Timing.ALIGNED: 0.00},
}

# BELIEF table — R's INITIAL (deliberately biased) view  🧪 MODELED
# Seeded = WORLD except injected wrong priors, so F1 (recon-as-ground-truth) has
# something visible to correct across batches. docs/outcome-model.md §4.
BELIEF_TABLE: dict[Cause, dict[Timing, float]] = {
    Cause.INSUFFICIENT_FUNDS:   {Timing.FAST: 0.15, Timing.SHORT: 0.30, Timing.ALIGNED: 0.45},  # under-rates payday (magnitude, argmax still ALIGNED)
    Cause.ISSUER_SOFT_DECLINE:  {Timing.FAST: 0.60, Timing.SHORT: 0.55, Timing.ALIGNED: 0.50},  # over-trusts fast → argmax FLIPS to FAST (world says SHORT); F1 must fix this
    Cause.AUTHENTICATION_FAILED:{Timing.FAST: 0.70, Timing.SHORT: 0.45, Timing.ALIGNED: 0.30},
    Cause.USER_DROPPED:         {Timing.FAST: 0.72, Timing.SHORT: 0.40, Timing.ALIGNED: 0.25},
    Cause.TECHNICAL_TRANSIENT:  {Timing.FAST: 0.75, Timing.SHORT: 0.50, Timing.ALIGNED: 0.42},
    Cause.LIMIT_EXCEEDED:       {Timing.FAST: 0.10, Timing.SHORT: 0.35, Timing.ALIGNED: 0.60},
    Cause.HARD_DECLINE:         {Timing.FAST: 0.02, Timing.SHORT: 0.02, Timing.ALIGNED: 0.02},
    Cause.RISK_BLOCKED:         {Timing.FAST: 0.00, Timing.SHORT: 0.00, Timing.ALIGNED: 0.00},
}


# --------------------------------------------------------------------------- #
# Terminal (non-retryable) causes and their forced action
# --------------------------------------------------------------------------- #
TERMINAL_ACTION: dict[Cause, Action] = {
    Cause.HARD_DECLINE: Action.DUN,
    Cause.RISK_BLOCKED: Action.STOP,
}


def is_retryable(cause: Cause) -> bool:
    """A cause is retryable unless it has a forced terminal action."""
    return cause not in TERMINAL_ACTION


# --------------------------------------------------------------------------- #
# Timing-bucket -> day offset from the failure (used by the simulated clock)
# ALIGNED resolves to the next salary/reset date at plan time, not a fixed offset.
# --------------------------------------------------------------------------- #
TIMING_DAY_OFFSET: dict[Timing, int] = {
    Timing.FAST: 0,     # same day (hours later)
    Timing.SHORT: 1,    # T+1
    Timing.ALIGNED: -1,  # sentinel: resolved dynamically to next payday/reset
}

#: Days of month treated as salary-credit windows for the ALIGNED bucket.
PAYDAY_DAYS: tuple[int, ...] = (1, 2, 28, 29, 30, 31)


# --------------------------------------------------------------------------- #
# Baseline policy — Razorpay's OWN documented default (📎 CITED)
# Fixed T+1/T+2/T+3, cause-blind. https://razorpay.com/docs/payments/subscriptions/payment-retries/
# --------------------------------------------------------------------------- #
BASELINE_RETRY_DAYS: tuple[int, ...] = (1, 2, 3)


# --------------------------------------------------------------------------- #
# Cost / churn objective  (F3, docs/differentiation.md) — 🧪 MODELED
# R optimizes NET VALUE = E[recovered] - C_RETRY*attempts - C_CHURN*annoyance*value
# --------------------------------------------------------------------------- #
C_RETRY_PAISE: int = 200          # per-attempt rail/gateway cost (₹2), modeled
C_CHURN_PAISE: int = 500          # goodwill cost unit (₹5), swept for sensitivity
CHURN_SWEEP_PAISE: tuple[int, ...] = (0, 250, 500, 1000, 2000)  # F3 sensitivity sweep

#: Customer-value tiers (multiplier on the churn penalty).
CUSTOMER_VALUE_MULTIPLIER: dict[str, float] = {"low": 0.5, "mid": 1.0, "high": 2.0}


# --------------------------------------------------------------------------- #
# Policy gates (deterministic; inside the scored path)  ARCHITECTURE.md §07
# --------------------------------------------------------------------------- #
MAX_RETRY_ATTEMPTS: int = 3        # attempt cap (matches baseline horizon)
SPEND_CAP_PAISE: int = 0          # 0 = unused for one-time; reserved for mandates
NET_VALUE_FLOOR_PAISE: int = 0     # stop retrying once marginal net value <= this


# --------------------------------------------------------------------------- #
# F1 calibration
# --------------------------------------------------------------------------- #
CALIBRATION_N_MIN: int = 20        # min samples in a (cause,timing) cell to recalibrate
CALIBRATION_EMA_ALPHA: float = 0.3  # EMA weight when updating BELIEF toward realized


# --------------------------------------------------------------------------- #
# Integrity check — imported by tests/test_constants.py
# --------------------------------------------------------------------------- #
def validate() -> None:
    """Assert the frozen constants are internally consistent. Raises on failure."""
    total = round(sum(REASON_CODE_DISTRIBUTION.values()), 9)
    assert total == 1.0, f"reason-code distribution must sum to 1.0, got {total}"

    for cause in Cause:
        assert cause in REASON_CODE_DISTRIBUTION, f"missing distribution weight: {cause}"
        assert cause in WORLD_TABLE, f"missing WORLD row: {cause}"
        assert cause in BELIEF_TABLE, f"missing BELIEF row: {cause}"
        for timing in Timing:
            for name, table in (("WORLD", WORLD_TABLE), ("BELIEF", BELIEF_TABLE)):
                p = table[cause][timing]
                assert 0.0 <= p <= 1.0, f"{name}[{cause}][{timing}] out of range: {p}"

    # every mapped reason resolves to a real Cause
    for reason, cause in REASON_TO_CAUSE.items():
        assert isinstance(cause, Cause), f"bad mapping for {reason}"

    # every cause has a sample reason that maps back to itself
    for cause, reason in CAUSE_TO_SAMPLE_REASON.items():
        assert REASON_TO_CAUSE.get(reason) == cause, f"sample reason mismatch for {cause}"


if __name__ == "__main__":  # pragma: no cover
    validate()
    print("constants OK — distribution sums to 1.0, WORLD/BELIEF/mapping consistent")
