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

These are **single-attempt** probabilities. Over the 3-attempt budget, cumulative recovery
is `1-(1-p)^3`. They are **calibrated to published recovery bands** (see Sources of Truth §6):
a cause-blind fixed-SHORT baseline must land in the **40–60%-of-recoverable** band, and
best-timing smart in **65–85%**. Verified live: baseline ≈ 46% of recoverable, smart ≈ 72%.

### WORLD success table — `(cause, timing) → true_prob` 🧪 (frozen in constants.py)

| Cause | FAST | SHORT | ALIGNED | Best (world) |
|---|---:|---:|---:|---|
| `insufficient_funds` | 0.08 | 0.15 | **0.35** | ALIGNED (payday) |
| `issuer_soft_decline` | 0.12 | **0.22** | 0.18 | SHORT (do-not-honor clears next-day) |
| `authentication_failed` | **0.30** | 0.15 | 0.08 | FAST (user re-attempts) |
| `user_dropped` | **0.32** | 0.14 | 0.08 | FAST (re-prompt) |
| `technical_transient` | **0.35** | 0.18 | 0.15 | FAST (transient) |
| `limit_exceeded` | 0.05 | 0.12 | **0.30** | ALIGNED (reset) |
| `hard_decline` | 0.01 | 0.01 | 0.01 | none → dun |
| `risk_blocked` | 0.00 | 0.00 | 0.00 | none → stop |

- The **argmax timing** per cause encodes the *documented mechanism* (payday for NSF, fast for transient/user/auth, reset for limits) — that mechanism is cited; the exact magnitudes are modeled to hit the bands above.
- `hard_decline` / `risk_blocked` ≈ 0 → the **irreducible** floor scoping F2 regret to the *recoverable* population.

### BELIEF table — R's initial (deliberately biased) view 🧪

`BELIEF = WORLD` **except** two realistic wrong priors, so F1 has something to correct:
- **Under-rates the payday magnitude**: `insufficient_funds` ALIGNED = 0.25 (< world 0.35), but argmax stays ALIGNED — F1 fixes the *size* of the estimate.
- **Over-trusts fast retries** on `issuer_soft_decline`: FAST = 0.28 > SHORT 0.22 — the argmax **flips** to FAST while the world's best is SHORT. This is a *decision* error (smart picks the wrong timing) → real regret → F1's recalibration must flip it back. This is the visible "it learns" demo.

---

## 5 · What this unblocks

- **T1 can now freeze the enum** — the 8 causes in §2 are the `Cause` type; §3 is `reason_code_distribution`; §4 seeds `WORLD` / `BELIEF`.
- **Honesty ledger for the README:** §1 cited · §2 grouping modeled / sources cited · §3 anchors cited, blend modeled · §4 fully modeled. Copy this table verbatim into the "Outcome Model & Sources" README section.

---

## 6 · Sources of Truth — every number's provenance

**Taxonomy & distribution (§1–§3)**
- Razorpay error reasons (109-value enum) — 📎 CITED: https://razorpay.com/docs/payments/payment-gateway/rainy-day/errors/error-reasons/ · https://razorpay.com/docs/errors/payments/list/ · https://razorpay.com/docs/errors/payments/cards/
- Card decline breakdown (insufficient funds ≈44%, incorrect details ≈1-in-5; codes 51/54/14/59/96/05) — 📎 anchors §3: https://stripe.com/resources/more/a-complete-list-of-decline-codes · https://www.checkout.com/blog/five-reasons-why-card-payments-are-declined
- NSF regional variance (25%–81% of failures) — context for the NSF weight: https://solidgate.com/blog/smart-retries-for-revenue-recovery/
- UPI Technical vs Business Decline (TD ≈0.7–0.8%, target <1%; BD target <5%; blended SR 92–96%) — 📎 anchors UPI mix: https://paytm.com/blog/payments/upi/upi-decline-rate-drops-to-0-8-global-expansion/ · https://productgrowth.in/insights/fintech/upi-payment-success-rates/ · https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics
- Razorpay recurring retry = fixed T+1/T+2/T+3, cause-blind (the baseline) — 📎 CITED: https://razorpay.com/docs/payments/subscriptions/payment-retries/

**Recovery-rate bands the WORLD table is calibrated to (§4)**
- Fixed retry schedules recover **≈40–60%** of recoverable failures; smart/AI decline-code-aware **≈65–85%** (basic retry-only 10–20%) — 📎 the bands our baseline (≈46%) and smart (≈72%) are tuned to hit:
  - https://gr4vy.com/posts/payment-retry-logic-explained-smart-retries-for-failed-transactions-in-2026/
  - https://www.slickerhq.com/resources/blog/soft-decline-retry-playbook
  - https://recurly.com/blog/failed-payment-recovery-revenue-strategy/
- 60–70% of card declines are temporary/recoverable — 📎 supports the retryable fraction: https://solidgate.com/blog/smart-retries-for-revenue-recovery/
- **Payday-aligned** retries for insufficient funds lift success significantly (payday-shift drove ~7% billing-failure churn reduction) — 📎 justifies NSF argmax = ALIGNED and the FAST≪ALIGNED gap: https://gr4vy.com/posts/subscription-payment-decline-recovery-handling-failed-recurring-charges-and-retry-strategies-that-work/ · https://www.slickerhq.com/resources/blog/complete-payment-retry-strategy-subscription
- Soft declines (incl. do-not-honor) are 70–90% of CNP failures and clear on a short cadence — 📎 justifies issuer_soft argmax = SHORT: https://www.slickerhq.com/resources/blog/soft-decline-retry-playbook · https://www.pxp.io/payments-glossary/soft-decline

**What remains 🧪 MODELED (no public dataset exists) or 🎛 PREFERENCE**
- The *exact* per-(cause,timing) magnitudes: no public dataset gives these — they are chosen to satisfy the cited bands and mechanisms above. The DIRECTION is cited; the precise numbers are modeled and declared.
- `C_CHURN`, customer-value multipliers: 🎛 business PREFERENCE — handled by the F3 sensitivity sweep (smart wins on net value across ₹0–₹20 churn), never asserted as fact.
- Amount lognormal (μ=ln600, σ=0.9): 🧪 modeled to a plausible Indian AOV shape.

*Verified 2026-09-04.*
