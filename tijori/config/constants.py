from __future__ import annotations

import enum
import os

def _cfg_int(name: str, default: int) -> int:
    v = os.getenv(name)
    return int(v) if v is not None and v.strip() else default

DEFAULT_SEED: int = 42

DEFAULT_BATCH_SIZE: int = 500

PAISE_PER_RUPEE: int = 100

class Cause(str, enum.Enum):
    INSUFFICIENT_FUNDS = "insufficient_funds"
    ISSUER_SOFT_DECLINE = "issuer_soft_decline"
    AUTHENTICATION_FAILED = "authentication_failed"
    USER_DROPPED = "user_dropped"
    TECHNICAL_TRANSIENT = "technical_transient"
    LIMIT_EXCEEDED = "limit_exceeded"
    HARD_DECLINE = "hard_decline"
    RISK_BLOCKED = "risk_blocked"

class Timing(str, enum.Enum):
    FAST = "fast"
    SHORT = "short"
    ALIGNED = "aligned"

class Action(str, enum.Enum):
    RETRY = "retry"
    DUN = "dun"
    STOP = "stop"

REASON_TO_CAUSE: dict[str, Cause] = {
    "insufficient_funds": Cause.INSUFFICIENT_FUNDS,
    "credit_limit_exceeded": Cause.INSUFFICIENT_FUNDS,
    "card_declined": Cause.ISSUER_SOFT_DECLINE,
    "payment_declined": Cause.ISSUER_SOFT_DECLINE,
    "debit_declined": Cause.ISSUER_SOFT_DECLINE,
    "authorisation_declined_by_psp": Cause.ISSUER_SOFT_DECLINE,
    "authentication_failed": Cause.AUTHENTICATION_FAILED,
    "incorrect_otp": Cause.AUTHENTICATION_FAILED,
    "otp_expired": Cause.AUTHENTICATION_FAILED,
    "incorrect_pin": Cause.AUTHENTICATION_FAILED,
    "pin_attempts_exceeded": Cause.AUTHENTICATION_FAILED,
    "otp_attempts_exceeded": Cause.AUTHENTICATION_FAILED,
    "payment_cancelled": Cause.USER_DROPPED,
    "payment_collect_request_expired": Cause.USER_DROPPED,
    "payment_session_expired": Cause.USER_DROPPED,
    "payment_timed_out": Cause.USER_DROPPED,
    "collect_request_pending": Cause.USER_DROPPED,
    "gateway_technical_error": Cause.TECHNICAL_TRANSIENT,
    "issuer_technical_error": Cause.TECHNICAL_TRANSIENT,
    "bank_not_available": Cause.TECHNICAL_TRANSIENT,
    "bank_technical_error": Cause.TECHNICAL_TRANSIENT,
    "server_error": Cause.TECHNICAL_TRANSIENT,
    "payment_declined_due_to_high_traffic": Cause.TECHNICAL_TRANSIENT,
    "psp_not_available": Cause.TECHNICAL_TRANSIENT,
    "upi_app_technical_error": Cause.TECHNICAL_TRANSIENT,
    "transaction_daily_limit_exceeded": Cause.LIMIT_EXCEEDED,
    "transaction_limit_exceeded": Cause.LIMIT_EXCEEDED,
    "transaction_frequency_limit_exceeded": Cause.LIMIT_EXCEEDED,
    "card_expired": Cause.HARD_DECLINE,
    "card_number_invalid": Cause.HARD_DECLINE,
    "incorrect_card_details": Cause.HARD_DECLINE,
    "card_not_enrolled": Cause.HARD_DECLINE,
    "debit_instrument_blocked": Cause.HARD_DECLINE,
    "international_transaction_not_allowed": Cause.HARD_DECLINE,
    "payment_risk_check_failed": Cause.RISK_BLOCKED,
    "compliance_violation": Cause.RISK_BLOCKED,
}

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

REASON_CODE_DISTRIBUTION: dict[Cause, float] = {
    Cause.INSUFFICIENT_FUNDS: 0.34,
    Cause.HARD_DECLINE: 0.18,
    Cause.ISSUER_SOFT_DECLINE: 0.12,
    Cause.AUTHENTICATION_FAILED: 0.12,
    Cause.USER_DROPPED: 0.10,
    Cause.TECHNICAL_TRANSIENT: 0.08,
    Cause.LIMIT_EXCEEDED: 0.04,
    Cause.RISK_BLOCKED: 0.02,
}

WORLD_TABLE: dict[Cause, dict[Timing, float]] = {
    Cause.INSUFFICIENT_FUNDS:   {Timing.FAST: 0.08, Timing.SHORT: 0.15, Timing.ALIGNED: 0.35},
    Cause.ISSUER_SOFT_DECLINE:  {Timing.FAST: 0.12, Timing.SHORT: 0.22, Timing.ALIGNED: 0.18},
    Cause.AUTHENTICATION_FAILED:{Timing.FAST: 0.30, Timing.SHORT: 0.15, Timing.ALIGNED: 0.08},
    Cause.USER_DROPPED:         {Timing.FAST: 0.32, Timing.SHORT: 0.14, Timing.ALIGNED: 0.08},
    Cause.TECHNICAL_TRANSIENT:  {Timing.FAST: 0.35, Timing.SHORT: 0.18, Timing.ALIGNED: 0.15},
    Cause.LIMIT_EXCEEDED:       {Timing.FAST: 0.05, Timing.SHORT: 0.12, Timing.ALIGNED: 0.30},
    Cause.HARD_DECLINE:         {Timing.FAST: 0.01, Timing.SHORT: 0.01, Timing.ALIGNED: 0.01},
    Cause.RISK_BLOCKED:         {Timing.FAST: 0.00, Timing.SHORT: 0.00, Timing.ALIGNED: 0.00},
}

BELIEF_TABLE: dict[Cause, dict[Timing, float]] = {
    Cause.INSUFFICIENT_FUNDS:   {Timing.FAST: 0.08, Timing.SHORT: 0.15, Timing.ALIGNED: 0.25},
    Cause.ISSUER_SOFT_DECLINE:  {Timing.FAST: 0.28, Timing.SHORT: 0.22, Timing.ALIGNED: 0.18},
    Cause.AUTHENTICATION_FAILED:{Timing.FAST: 0.30, Timing.SHORT: 0.15, Timing.ALIGNED: 0.08},
    Cause.USER_DROPPED:         {Timing.FAST: 0.32, Timing.SHORT: 0.14, Timing.ALIGNED: 0.08},
    Cause.TECHNICAL_TRANSIENT:  {Timing.FAST: 0.35, Timing.SHORT: 0.18, Timing.ALIGNED: 0.15},
    Cause.LIMIT_EXCEEDED:       {Timing.FAST: 0.05, Timing.SHORT: 0.12, Timing.ALIGNED: 0.30},
    Cause.HARD_DECLINE:         {Timing.FAST: 0.01, Timing.SHORT: 0.01, Timing.ALIGNED: 0.01},
    Cause.RISK_BLOCKED:         {Timing.FAST: 0.00, Timing.SHORT: 0.00, Timing.ALIGNED: 0.00},
}

TERMINAL_ACTION: dict[Cause, Action] = {
    Cause.HARD_DECLINE: Action.DUN,
    Cause.RISK_BLOCKED: Action.STOP,
}

def is_retryable(cause: Cause) -> bool:
    return cause not in TERMINAL_ACTION

TIMING_DAY_OFFSET: dict[Timing, int] = {
    Timing.FAST: 0,
    Timing.SHORT: 1,
    Timing.ALIGNED: -1,
}

PAYDAY_DAYS: tuple[int, ...] = (1, 2, 28, 29, 30, 31)

BASELINE_RETRY_DAYS: tuple[int, ...] = (1, 2, 3)

C_RETRY_PAISE: int = _cfg_int("TIJORI_C_RETRY_PAISE", 0)
C_CHURN_PAISE: int = _cfg_int("TIJORI_C_CHURN_PAISE", 500)
CHURN_SWEEP_PAISE: tuple[int, ...] = (0, 250, 500, 1000, 2000)

CUSTOMER_VALUE_MULTIPLIER: dict[str, float] = {"low": 0.5, "mid": 1.0, "high": 2.0}

MAX_RETRY_ATTEMPTS: int = _cfg_int("TIJORI_MAX_ATTEMPTS", 3)
SPEND_CAP_PAISE: int = _cfg_int("TIJORI_SPEND_CAP_PAISE", 0)
NET_VALUE_FLOOR_PAISE: int = _cfg_int("TIJORI_NET_FLOOR_PAISE", 0)

CALIBRATION_N_MIN: int = _cfg_int("TIJORI_CAL_N_MIN", 20)
CALIBRATION_EMA_ALPHA: float = 0.3

def validate() -> None:
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

    for reason, cause in REASON_TO_CAUSE.items():
        assert isinstance(cause, Cause), f"bad mapping for {reason}"

    for cause, reason in CAUSE_TO_SAMPLE_REASON.items():
        assert REASON_TO_CAUSE.get(reason) == cause, f"sample reason mismatch for {cause}"

if __name__ == "__main__":
    validate()
    print("constants OK — distribution sums to 1.0, WORLD/BELIEF/mapping consistent")
