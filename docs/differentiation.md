# Tijori — Differentiation, New Features & Stress Tests

> Companion to [ARCHITECTURE.md](../ARCHITECTURE.md). This doc answers three things:
> 1. **What Razorpay already ships** (so we don't rebuild it).
> 2. **The three new features** we're adding on top of the existing ones — specified concretely.
> 3. **A stress test** of each new feature: where it breaks, and the mitigation.
>
> Verified against Razorpay's live docs on 2026-09-03 (sources at the bottom).

---

## Part A · What Razorpay already has (the overlap map)

Since this is Razorpay's own hackathon, anything they already ship is a losing pitch. Here's the honest overlap, from their docs:

| Feature | On Razorpay today? | What it actually does | Verdict for us |
|---|---|---|---|
| **Smart retry of failed payments** | ✅ **Yes — Optimizer** | AI/ML *routing* across gateways/providers (150+ params), ~+10% success rate; retries by re-routing failed txns to an alternate provider. | **Table stakes.** Do not pitch "smart retry." Note: it optimizes *routing*, not retry *timing*. |
| **Recurring/subscription retry** | ✅ **Yes** | Fixed **T+1 / T+2 / T+3** retries after a failed charge, then `halted`. **Explicitly cause-blind** — "doesn't adjust based on specific decline reasons like insufficient funds versus expired cards." | **This is literally our baseline** — and it's Razorpay's *own documented default*, not a strawman. |
| **Dunning outreach** | ✅ **Yes** | Auto-email to customer with a card-update link on failure. | Table stakes; we can layer smarter copy but it's not the pitch. |
| **Settlement reconciliation** | ✅ **Yes** | Downloadable settlement **reports** (CSV/XLS) mapping transactions ↔ settlement IDs. | Table stakes as *reporting*. It's a human report, **not** an automated exception→action loop. |
| **Cross-PG reconciliation** | ✅ **Yes — Optimizer Single View Recon** | Unified settlement view across payment aggregators; saves finance teams 20–40 hrs/month. | Table stakes; still reporting, still no action loop. |
| **Cause-aware / optimal retry *timing*** | ❌ **No** (for subscriptions; Optimizer does routing, not timing) | — | **Open lane.** |
| **A closed loop: recovery *proven* by reconciliation** | ❌ **No** | Recovery (Optimizer) and recon (reports) are **separate products, separate teams.** | **Our core whitespace.** |
| **Reconciliation as feedback that recalibrates the recovery model** | ❌ **No** | — | **Genuinely novel.** |
| **Regret-vs-oracle / headroom reporting** | ❌ **No** | — | **Novel, cheap credibility.** |
| **Cost/churn-aware retry objective** | ❌ **No** (optimizes success rate, not net value) | — | **Novel.** |

### The two things this buys us

1. **Our baseline is no longer a strawman.** Razorpay's *own* recurring-retry is a documented, cause-blind **T+1/T+2/T+3** schedule. Beating it with a cause-aware policy is a legitimate, on-target contribution we can cite to their docs — not "we beat a dumb thing we made up."
2. **The differentiation must move up a level** — from *algorithms* (retry, recon; both exist) to the **loop + learning + honesty layer** (Part B). That's where nothing exists.

---

## Part B · The features (existing kept + three new)

### Kept (now positioned as table-stakes we execute well, not the pitch)
- **Optimal-retry-date timing** (D5) — kept, but framed as "beats Razorpay's cited cause-blind T+1/T+2/T+3."
- **3-way reconciliation** (D4) — kept, but it's the *sensor* that feeds the loop, not a standalone report.

### The enabling change that makes all three new features possible: **belief ≠ world**

Split the simulator into two tables:
- **WORLD table** — the *true* generative process. Outcomes are drawn from this. `(cause, timing) → true_prob`.
- **BELIEF table** — what R *thinks* is true and plans against. Initialized from the cited-distribution + modeled-probabilities, deliberately allowed to be **biased/wrong**.

This one split is what lets recon *teach*, lets regret *be non-zero*, and models the real situation (your assumptions ≠ reality). Without it, every new feature collapses (see stress tests).

---

### Feature 1 · Reconciliation as ground truth (closed-loop calibration) — the headline

**Idea:** W reconciles what R *claims* to recover. That reconciliation is a **label**. So the recon layer can measure — and correct — R's own prediction error. No incumbent can do this because their recovery model never sees whether the money actually landed.

**Concrete mechanism**
1. R logs, per action: `predicted_prob` (from BELIEF table) and the action taken.
2. Outcome is drawn from the **WORLD table**; recovered money creates a settlement + bank row.
3. W reconciles → marks each recovery `reconciled` / `not_reconciled` (the realized label).
4. Per batch, compute per-cell realized rate `reconciled / attempts` and compare to BELIEF `predicted_prob`:
   - **Calibration error** (Brier score + a reliability table).
   - **Drift report**: for each `(cause, timing)` cell, `belief_prob − realized_prob`.
5. **Learning layer (separate from the scored path):** update BELIEF toward realized via EMA, only for cells with `n ≥ n_min`. Re-run and show calibration error shrinking across batches.

**Data-model additions**
- `recovery_actions.predicted_prob`, `recovery_actions.reconciled` (bool)
- `calibration_report` artifact per batch: `{cell, n, belief, realized, brier, drift}`

**Why it wins:** deepens *three* judged criteria at once — meaningful AI (real feedback learning), closed loop (the loop now *learns*), evidence of value (visible drift shrinking).

#### 🔴 Stress test — Feature 1
- **Circularity (fatal if ignored):** if outcomes are drawn from the *same* table R predicts with, recon is a trivially perfect teacher and calibration is fake.
  → **Mitigation = the belief≠world split.** WORLD generates; BELIEF plans. Recon reveals a *real* gap. This is honest — it models "our model was wrong and we found out."
- **Sparse cells:** 500 failures ÷ (~6 causes × 3 timing buckets = 18 cells) → some cells too thin to calibrate; noise looks like drift.
  → **Mitigation:** report confidence intervals; only recalibrate cells with `n ≥ n_min` (e.g. 20); use hierarchical shrinkage toward the cause-level mean.
- **Live-path honesty:** genuine bank recon only exists for the one live Payment Link; the rest is simulated.
  → **Mitigation:** label the calibration demo as simulated; the live link is the "this is real" anchor, the sim is the "here's the mechanism at scale."
- **Over-claiming "learning":** one EMA update is not ML.
  → **Mitigation:** call it *calibration*, not "training a model." Honest framing beats inflated framing with judges.

---

### Feature 2 · Regret vs. an oracle (headroom reporting)

**Idea:** because the sim is deterministic and seeded, we can compute what a perfectly-informed policy would recover, and report how close we got. Almost no tool quantifies its own headroom.

**Concrete mechanism**
- **Distributional oracle** = a policy that knows the **WORLD** probabilities and maximizes expected ₹ per failure (primary bound).
- Report, over the **recoverable** population:
  - `oracle_₹`, `smart_₹`, `baseline_₹`
  - `smart_efficiency = smart_₹ / oracle_₹`, `baseline_efficiency = baseline_₹ / oracle_₹`
  - `regret = oracle_₹ − smart_₹`
- Optional loose upper bound: a **clairvoyant** oracle that knows each realized outcome (shown as a secondary, looser line).

**Why it wins:** reframes the headline from "we recovered ₹X" (unverifiable) to "we captured Z% of the reachable maximum, vs Razorpay's baseline at W%." Reads as rigor + honesty. Nearly free — the simulator already exists.

#### 🔴 Stress test — Feature 2
- **Oracle definition ambiguity:** a clairvoyant oracle (knows realized outcomes) is unbeatable and makes regret look terrible.
  → **Mitigation:** headline on the **distributional** oracle (knows true probs, still stochastic); clairvoyant only as a labelled loose bound.
- **Regret dominated by irreducible failures:** hard declines never recover; including them inflates the denominator and flatters everyone.
  → **Mitigation:** compute regret/efficiency over the **recoverable** subset only; report irreducible-fraction separately.
- **Trivial regret if belief=world:** if smart already argmaxes on belief and belief=world, regret→0 and the metric says nothing.
  → **Mitigation:** the belief≠world split (again) makes regret a real, non-zero quantity — it measures the cost of R's wrong assumptions, which Feature 1 then shrinks. The two features tell one story.

---

### Feature 3 · Cost / churn-aware objective

**Idea:** incumbents (incl. Optimizer) optimize **success rate**. We optimize **net value** — recovery minus retry cost minus over-dunning/churn risk. "Don't burn ₹200 of goodwill chasing ₹40."

**Concrete mechanism**
- Per-failure objective, replacing "maximize P(success)":
  ```
  maximize   E[amount_recovered]
           − c_retry · n_attempts
           − c_churn · annoyance(n_attempts, n_dun_msgs) · customer_value
  subject to policy gates
  ```
- `c_retry` = per-attempt rail/gateway cost (a constant). `c_churn` = modeled goodwill cost. `customer_value` = simple tier on `orders`.
- Effect: smart policy may **stop earlier** than success-maximizing — sacrificing marginal gross recovery for higher *net*.

**Data-model additions**
- `orders.customer_value` (tier), constants `c_retry`, `c_churn`
- `recovery_actions.net_value = amount_recovered − costs`

**Eval:** report **gross ₹** (headline, D7) *and* **net value** (secondary). Show smart beats baseline by an even wider margin on **net**, because the baseline over-retries blindly.

#### 🔴 Stress test — Feature 3
- **`c_churn` is unobservable / invented:** a fragile constant carrying the story is a red flag.
  → **Mitigation:** declare it as modeled; ship a **sensitivity sweep** — vary `c_churn` across a range, show the policy ranking is stable. Never let the headline hinge on one guessed number.
- **Complexity dilutes the pitch:** two objectives can confuse.
  → **Mitigation:** gross ₹ stays the single headline; net value is a "and we don't burn goodwill" supporting panel, not a co-headline.
- **Gaming:** a churn penalty could make "do nothing" look optimal and suppress all retries.
  → **Mitigation:** validate against the oracle (Feature 2) — if net-optimal ≈ "never retry," the penalty is miscalibrated; the oracle bound catches it.

---

## Part C · Revised differentiation stack (strongest first)

1. **Closed loop with reconciliation-as-ground-truth** (Feature 1) — the genuinely novel core; nothing on Razorpay does it.
2. **Regret-vs-oracle headroom** (Feature 2) — cheap, honest rigor.
3. **Cost/churn-aware net-value objective** (Feature 3) — smarter than the success-rate incumbents.
4. **Beats Razorpay's *own cited* cause-blind T+1/T+2/T+3 baseline** — on-target, non-redundant, documented.
5. Optimal-retry-date + 3-way recon — **table stakes we execute well**, not the pitch.

**The one-line pitch becomes:** *"Razorpay already retries and reconciles separately. Tijori closes the loop — it recovers, then reconciles to prove the money landed, and uses that proof to correct its own recovery model — reporting how close it gets to the theoretical maximum."*

---

## Part D · Architectural impact summary (what to change in the build)

- **Simulator:** add the **WORLD vs BELIEF** two-table split (enables F1–F3). *This is the key new task.*
- **Data model:** `recovery_actions.predicted_prob`, `.reconciled`, `.net_value`; `orders.customer_value`; new `calibration_report`.
- **Constants:** `c_retry`, `c_churn`, `n_min`.
- **Eval harness:** add oracle computation, regret/efficiency, calibration/Brier, net-value, and a `c_churn` sensitivity sweep.
- **Objective:** swap R's argmax from P(success) to net-value.
- **README:** cite Razorpay's docs for the baseline + overlap; declare WORLD/BELIEF and all modeled constants.

> ⚠ These are **spec changes, not code** — code still waits on **T0.5** (freezing the reason-code enum), because the WORLD/BELIEF tables are both keyed on that enum.

---

## Sources (verified 2026-09-03)
- Razorpay Optimizer (AI/ML routing, ~+10% SR): https://razorpay.com/docs/payments/optimizer/ · https://razorpay.com/blog/razorpay-optimizer-ai-powered-payments-router/
- Subscription payment retries (fixed T+1/T+2/T+3, cause-blind): https://razorpay.com/docs/payments/subscriptions/payment-retries/
- Settlement reconciliation reports: https://razorpay.com/docs/payments/settlements/faqs/
- Optimizer Single View Reconciliation (cross-PG): https://razorpay.com/blog/single-view-recon/ · https://razorpay.com/docs/payments/optimizer/reconciliation/
- UPI Autopay (recurring): https://razorpay.com/upi-autopay/
