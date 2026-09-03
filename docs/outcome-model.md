# Tijori — Outcome Model & Sources (T0.5 output)

> **Status:** T0.5 complete (2026-09-03). This doc **freezes the reason-code enum** that keys the WORLD + BELIEF tables and R's diagnosis, and is the prerequisite for T1.
> **Grounding rule (D1 · hybrid):** the failure *taxonomy* and *distribution anchors* are 📎 **CITED**; the collapse into causes, the cross-rail blend, and all success probabilities are 🧪 **MODELED** and declared here. Nothing below is claimed as production truth.

---

## 1 · The cited taxonomy — Razorpay's documented `reason` enum 📎

Razorpay's payment error object exposes a `reason` field. Its documented enum has **109 values** (full list: [Razorpay error-reasons docs](https://razorpay.com/docs/payments/payment-gateway/rainy-day/errors/error-reasons/), downloadable [error_reasons.xlsx](https://razorpay.com/docs/build/browser/assets/images/payments_error_reasons.xlsx)). Representative values we build on:

`insufficient_funds` · `card_declined` · `payment_declined` · `debit_declined` · `authorisation_declined_by_psp` · `card_expired` · `card_number_invalid` · `incorrect_card_details` · `card_not_enrolled` · `debit_instrument_blocked` · `international_transaction_not_allowed` · `authentication_failed` · `incorrect_otp` · `otp_expired` · `incorrect_pin` · `pin_attempts_exceeded` · `otp_attempts_exceeded` · `payment_cancelled` · `payment_collect_request_expired` · `payment_session_expired` · `payment_timed_out` · `collect_request_pending` · `gateway_technical_error` · `issuer_technical_error` · `bank_not_available` · `bank_technical_error` · `server_error` · `payment_declined_due_to_high_traffic` · `psp_not_available` · `upi_app_technical_error` · `transaction_daily_limit_exceeded` · `transaction_limit_exceeded` · `transaction_frequency_limit_exceeded` · `credit_limit_exceeded` · `payment_risk_check_failed` · `compliance_violation` · `funds_blocked_by_mandate` · `mandate_creation_declined` · `mandate_creation_failed`

> These are the **real objects** our synthetic `payments.reason_code` values are drawn from, so the demo speaks Razorpay's own vocabulary.

---

## 2 · The frozen cause enum (the model's reason-code) 🧪 *(grouping) · 📎 (source reasons)*

109 raw reasons are too many to model. We collapse them into **8 causes**, each defined by a distinct *recovery behaviour*. **This is the enum T1 freezes.**

| Cause (enum) | Razorpay reasons it groups (cited) | Recovery behaviour |
|---|---|---|
| `insufficient_funds` | `insufficient_funds`, `credit_limit_exceeded`, UPI `Z9` | Retryable; **payday-sensitive** |
| `issuer_soft_decline` | `card_declined`, `payment_declined`, `debit_declined`, `authorisation_declined_by_psp` (do-not-honor / code 05) | Retryable; often clears next-day |
| `authentication_failed` | `authentication_failed`, `incorrect_otp`, `otp_expired`, `incorrect_pin`, `pin_attempts_exceeded`, `otp_attempts_exceeded` | Retryable **fast** (user re-attempts) |
| `user_dropped` | `payment_cancelled`, `payment_collect_request_expired`, `payment_session_expired`, `payment_timed_out`, `collect_request_pending` | Retryable **fast** (re-prompt) |
| `technical_transient` | `gateway_technical_error`, `issuer_technical_error`, `bank_not_available`, `bank_technical_error`, `server_error`, `payment_declined_due_to_high_traffic`, `psp_not_available`, `upi_app_technical_error` | Retryable **fast** (transient) |
| `limit_exceeded` | `transaction_daily_limit_exceeded`, `transaction_limit_exceeded`, `transaction_frequency_limit_exceeded` | Retryable **after reset** |
| `hard_decline` | `card_expired`, `card_number_invalid`, `incorrect_card_details`, `card_not_enrolled`, `debit_instrument_blocked`, `international_transaction_not_allowed` | **Not** retryable → **dun** (needs new instrument) |
| `risk_blocked` | `payment_risk_check_failed`, `compliance_violation` | **Not** retryable → **stop** |

---

## 3 · Reason-code distribution (the generator's weights) — HYBRID

The synthetic failure generator draws a cause per failure from this distribution. **Anchors are cited; the blend is modeled** (per D1).

| Cause | Weight | Grounding |
|---|---:|---|
| `insufficient_funds` | **0.34** | 📎 Insufficient funds ≈ **44%** of card declines (Ethoca study, widely cited); UPI `Z9` a top business decline. Blended down for cross-rail mix. |
| `hard_decline` | **0.18** | 📎 "Incorrect card details" ≈ **1 in 5** declines (Ethoca) + expired/invalid/blocked. |
| `issuer_soft_decline` | **0.12** | 📎 Do-not-honor (code 05) a common soft decline. |
| `authentication_failed` | **0.12** | 📎 UPI is **business-decline dominant** (wrong PIN); NPCI BD target <5% vs TD <1%. |
| `user_dropped` | **0.10** | 🧪 Collect-request expiry / cancellations / session timeouts (UPI collect flows). |
| `technical_transient` | **0.08** | 📎 NPCI **TD ≈ 0.7–0.8%** of all UPI txns → a minority of *failures*; card system-error (code 96). |
| `limit_exceeded` | **0.04** | 🧪 Daily/txn/frequency limits; bank UPI caps ₹25k–₹1L. |
| `risk_blocked` | **0.02** | 📎 Suspected-fraud (code 59) a small share. |
| **Total** | **1.00** | |

> Two rail-specific distributions (`card`, `upi`) can be derived from the same anchors; the table above is the **blended one-time default**. UPI failures skew harder to `authentication_failed` + `user_dropped` (BD-dominant); card failures skew to `insufficient_funds` + `hard_decline`.

---

## 4 · Retryability & timing sensitivity → the WORLD table 🧪

This is what makes the **optimal-retry-date** policy (D5) and **regret** (F2) meaningful. Three timing buckets:

- **FAST** — minutes-to-hours (transient conditions, user re-attempt)
- **SHORT** — next-day (≈ Razorpay's T+1), the cause-blind default
- **ALIGNED** — wait for a salary credit (≈ month-end / 1st) or a limit reset

### WORLD success table — `(cause, timing) → true_prob` 🧪 (illustrative, to finalize in T1)

| Cause | FAST | SHORT | ALIGNED | Best bucket |
|---|---:|---:|---:|---|
| `insufficient_funds` | 0.15 | 0.30 | **0.62** | ALIGNED (payday) |
| `issuer_soft_decline` | 0.35 | **0.55** | 0.50 | SHORT |
| `authentication_failed` | **0.70** | 0.45 | 0.30 | FAST |
| `user_dropped` | **0.72** | 0.40 | 0.25 | FAST |
| `technical_transient` | **0.75** | 0.50 | 0.42 | FAST |
| `limit_exceeded` | 0.10 | 0.35 | **0.60** | ALIGNED (reset) |
| `hard_decline` | 0.02 | 0.02 | 0.02 | none → dun |
| `risk_blocked` | 0.00 | 0.00 | 0.00 | none → stop |

- Probabilities anchored so the **retryable population** lands near the literature's **~50%→60%** smart-retry band, while the **cause-blind SHORT-only** baseline (Razorpay's default) leaves the payday/reset/transient gains on the table.
- `hard_decline` / `risk_blocked` ≈ 0 → they define the **irreducible** floor used to scope F2 regret to the *recoverable* population.

### BELIEF table — R's initial (deliberately biased) view 🧪

Initialize `BELIEF = WORLD` **except** inject realistic wrong priors, so F1 has something to correct:
- BELIEF **under-rates the payday effect**: `insufficient_funds` ALIGNED set to ~0.45 (thinks SHORT is fine).
- BELIEF **over-trusts fast retries** on `issuer_soft_decline`: FAST ~0.50.
Recon (F1) then reveals the gap and recalibrates toward WORLD across batches — the visible "it learns" demo.

---

## 5 · What this unblocks

- **T1 can now freeze the enum** — the 8 causes in §2 are the `Cause` type; §3 is `reason_code_distribution`; §4 seeds `WORLD` / `BELIEF`.
- **Honesty ledger for the README:** §1 cited · §2 grouping modeled / sources cited · §3 anchors cited, blend modeled · §4 fully modeled. Copy this table verbatim into the "Outcome Model & Sources" README section.

---

## Sources (verified 2026-09-03)
- Razorpay error reasons (109-value enum): https://razorpay.com/docs/payments/payment-gateway/rainy-day/errors/error-reasons/ · list: https://razorpay.com/docs/errors/payments/list/ · cards: https://razorpay.com/docs/errors/payments/cards/
- Card decline reason breakdown (insufficient funds ≈44%, incorrect details ≈1-in-5; codes 51/54/14/59/96/05): https://stripe.com/resources/more/a-complete-list-of-decline-codes · https://www.checkout.com/blog/five-reasons-why-card-payments-are-declined
- UPI Technical vs Business Decline (TD ≈0.7–0.8%, target <1%; BD target <5%; blended SR 92–96%): https://paytm.com/blog/payments/upi/upi-decline-rate-drops-to-0-8-global-expansion/ · https://productgrowth.in/insights/fintech/upi-payment-success-rates/ · NPCI: https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics
- Razorpay UPI failure categories (business vs technical decline): https://razorpay.com/blog/tackling-upi-payment-failures-with-razorpay/
- Smart-retry uplift (~50%→60%) baseline band: carried from v1 competitive research; to be re-cited before final README.
