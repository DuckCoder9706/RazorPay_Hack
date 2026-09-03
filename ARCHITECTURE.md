# Tijori — Architecture & Decision Map (v3)

> **A closed loop that finds missing money, gets it back, proves it landed — and corrects its own recovery model.**
> One platform, one ledger, one seeded simulator. **W** senses money that failed to arrive; **R** acts to recover it; every rupee recovered flows back through reconciliation to *prove* it settled, and that proof recalibrates R's beliefs.
> **Submission:** Track 3 — Revenue Recovery. **Companion:** [docs/differentiation.md](docs/differentiation.md) (Razorpay overlap + feature stress-tests).

| | |
|---|---|
| **Stack** | Python · FastAPI · SQLite · Claude · React/Tailwind |
| **Window** | ~3 weeks, solo |
| **Mode** | Razorpay test-mode |
| **Status** | **v3** — supersedes v2 in place. Folds in the belief≠world simulator + three new features (F1–F3). |

### How to read this doc (status tags)

| Tag | Meaning |
|-----|---------|
| 🔒 **LOCKED** | decided this session |
| ✎ **UPDATED** | changed from an earlier version |
| 🆕 **NEW** | added in v3 |
| 📎 **CITED** | grounded in real sources |
| 🧪 **MODELED** | declared assumption |
| ★ **HERO** | measured / headline |
| ◐ **DEMO** | built to demo depth |
| ⏸ **DEFERRED** | decide later |

### What changed v2 → v3 (so nothing stale is left)
- **Baseline is no longer a strawman.** It is Razorpay's *own documented* cause-blind **T+1/T+2/T+3** subscription retry (cited). See §03, §09.
- **Simulator gains a belief≠world split** (§06) — the enabling change for all three new features.
- **Three new features folded in** (§03): F1 recon-as-ground-truth, F2 regret-vs-oracle, F3 cost/churn-aware objective.
- **R's objective changed** from *maximize P(success)* → *maximize net value* (§07).
- **Data model, eval, and build order extended** accordingly (§05, §09, §10).
- **Existing features kept** (optimal-retry-date, 3-way recon) but re-positioned as table-stakes executed well, not the pitch (§03).

---

## 01 · The thesis: a closed *learning* loop

The differentiator is **not** an algorithm — Razorpay already ships smart retry (Optimizer) and reconciliation (settlement reports). The whitespace is the **seam between them**: nobody closes recovery and reconciliation into one loop on one ledger where **recovery is proven by reconciliation, and that proof teaches the recovery model.**

```
        ┌───────────── recovered ₹ re-reconciled → exception closed ─────────────┐
        │                                                                         │
        ▼                                                                         │
 ┌──────────────┐  emits   ┌────────────┐ consumes ┌───────────────┐ →ledger ┌──────────────┐
 │  W · SENSOR  │ ───────▶ │ Typed      │ ───────▶ │  R · ACTUATOR │ ──────▶ │ Recovery     │
 │  3-way match │          │ exception  │          │ diagnose·time │         │ event        │
 │  settlement  │          │ fee·timing │          │ net-value gate│         │ + predicted  │
 │  ↔ bank      │          │ ·missing   │          │ → act         │         │ prob         │
 │  ↔ orders    │          │            │          │ (BELIEF tbl)  │         │              │
 └──────┬───────┘          └────────────┘          └──────┬────────┘         └──────┬───────┘
        │                                                  ▲                         │
        │   realized outcomes recalibrate BELIEF (F1)      │                         │
        └──────────────────────────────────────────────────┘◀────────────────────── ┘
        ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │  APPEND-ONLY AUDIT LOG — every decision, gate, prediction & outcome, replayable by ₹      │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

Two feedback arrows carry the thesis: **(top)** recovered money re-reconciles and closes its own exception; **(bottom)** the realized, reconciled outcomes correct R's BELIEF table so its next predictions are better.

---

## 02 · Decisions locked — and what each changed

Six core decisions (D1–D6). Everything marked ✎ differs from an earlier version.

### D1 · Grounding the numbers — 🔒 LOCKED
**Choice:** *Hybrid* — cite the reason-code **distribution** taxonomy; model the retry-success **probabilities**.
- Outcome model splits: `reason_code_distribution` (📎 CITED) and success **probabilities** (🧪 MODELED). In v3 the probabilities live in two tables — WORLD and BELIEF (§06).
- New up-front task **T0.5 — taxonomy research + cited distribution**, before config constants.
- The reason-code enum **cannot be frozen** until T0.5 lands — it keys both WORLD and BELIEF tables and R's diagnosis.

### D2 · What R recovers — 🔒 LOCKED
**Choice:** *Both* one-time payments + subscription mandates — **one-time is the hero**.
- Data model gains a `subscriptions/mandates` family beside `payments`.
- Two failure generators; R executor gets two branches: `retry_payment` + `retry_mandate_debit/dun`.
- **Scored metric measures one-time only** (★ HERO); mandates ship at ◐ DEMO depth.

### D3 · The "real object" path — 🔒 LOCKED
**Choice:** *One live test-mode Payment Link* — create, pay with test card, read back the payment object.
- Razorpay client wrapper needs only `create_payment_link` + `fetch_payment`.
- All live-API non-determinism is **quarantined to one path**, pre-recorded for the video.
- Mandate failures are therefore **100% simulated** (test-mode UPI Autopay is thin).

### D4 · W's scope — 🔒 LOCKED
**Choice:** *Three exception categories* (fee / timing / missing) + one many-to-many netting case. **No NL Q&A.**
- NL Q&A module **removed from the repo**. Dashboard shows an exceptions table, not a chat.
- W is a purely deterministic exact + tolerance matcher — **no LLM in its scored path**.

### D5 · Smart-policy sophistication — 🔒 LOCKED · ✎ UPDATED (v3)
**Choice:** *Cause-aware + optimal-retry-date timing*, now optimizing **net value** (see F3), not raw success.
- BELIEF success table is **2-D**: `(cause, timing-bucket) → prob`. WORLD mirrors it (§06).
- Simulator needs timing features (days-since-fail, payday proximity, attempt #) on a **simulated clock**.
- Smart policy = an **argmax of net value** over (action, timing) under gates; baseline walks Razorpay's fixed schedule.

### D6 · Track 1 teaser — 🔒 LOCKED
**Choice:** *Include* the ≤90s agent-buyable teaser, filmed **after** R-W.
- Isolated `track1_teaser/` surface — **touches none of the shared spine**.
- Fenced to end of W3, conditional: **first thing to drop** if R-W runs long.

---

## 03 · Differentiation & new features 🆕

### Razorpay overlap map (verified 2026-09-03 — full version in [docs/differentiation.md](docs/differentiation.md))

| Capability | On Razorpay today? | Verdict |
|---|---|---|
| Smart retry of failed payments | ✅ Optimizer (ML routing, ~+10% SR) | Table stakes — optimizes *routing*, not *timing* |
| Recurring retry | ✅ Fixed **T+1/T+2/T+3**, **cause-blind** (their docs) | **This is our cited baseline** |
| Dunning outreach | ✅ Auto-email + card-update link | Table stakes |
| Settlement reconciliation | ✅ Downloadable reports; Optimizer cross-PG recon | Table stakes — *reporting*, not an action loop |
| Cause-aware retry **timing** | ❌ | Open lane |
| **Closed loop: recovery proven by recon** | ❌ separate products | **Our core whitespace** |
| **Recon as feedback recalibrating recovery** | ❌ | **Genuinely novel** |
| **Regret-vs-oracle headroom** | ❌ | **Novel** |
| **Cost/churn-aware objective** | ❌ optimizes SR, not net value | **Novel** |

### The enabling change: **belief ≠ world**
The simulator holds two probability tables (§06). **WORLD** generates outcomes; **BELIEF** is what R plans against (allowed to be wrong). This single split is what makes F1–F3 real rather than circular.

### F1 · Reconciliation as ground truth (the headline) 🆕
W's reconciliation is the **label**. Per batch we compare R's `predicted_prob` (BELIEF) to the realized reconciled rate (WORLD), report **calibration error (Brier + drift)**, and — off the scored path — recalibrate BELIEF via EMA for cells with `n ≥ n_min`. Demo: calibration error shrinks across batches.

### F2 · Regret vs. an oracle 🆕
A **distributional oracle** that knows WORLD probs and maximizes expected ₹ gives a headroom bound. Report `smart_₹ / oracle_₹`, `baseline_₹ / oracle_₹`, and `regret = oracle − smart`, over the **recoverable** population only.

### F3 · Cost/churn-aware objective 🆕
R optimizes **net value = E[recovered] − c_retry·attempts − c_churn·annoyance·customer_value**, not raw success. Smart may stop earlier than success-maximizing. Ship a **c_churn sensitivity sweep** so no headline hinges on a guessed constant.

### Differentiation stack (strongest first)
1. Closed loop with **recon-as-ground-truth** (F1) — novel core.
2. **Regret-vs-oracle** (F2) — cheap, honest rigor.
3. **Cost/churn-aware net-value** (F3) — smarter than success-rate incumbents.
4. Beats Razorpay's **own cited** cause-blind T+1/T+2/T+3 baseline.
5. Optimal-retry-date + 3-way recon — **table stakes executed well**, not the pitch.

**Pitch:** *"Razorpay already retries and reconciles — separately. Tijori closes the loop: it recovers, reconciles to prove the money landed, uses that proof to correct its own model, and reports how close it gets to the theoretical maximum."*

---

## 04 · The layered architecture ✎

R and W are two capabilities over **one shared spine**. The LLM sits beside the spine, wired in only where decisions are *not* scored.

```
                 ┌───────────────────────────────────────────────┐
                 │        React + Tailwind dashboard              │
                 │  ₹ recovered · net value · exceptions ·        │
                 │  regret vs oracle · calibration · audit trail  │
                 └───────────────────────┬───────────────────────┘
                                         │ REST
        ┌────────────────────────────────────────────────────────────┐
        │ FastAPI                                                      │
        │   ┌─────────────────────────┐   ┌────────────────────────┐  │
        │   │ R · RECOVER             │   │ W · WHERE'S MY MONEY    │  │
        │   │ diagnose · optimal-date │   │ 3-way matcher          │  │
        │   │ net-value gate·executor │   │ exception classifier   │  │
        │   └─────────────────────────┘   └────────────────────────┘  │
        └────────────────────────────────┬───────────────────────────┘
                                         │
        ┌────────────────────────────────────────────────────────────┐        ┌──────────────────┐
        │ SHARED SPINE                                                 │        │ CLAUDE           │
        │  [Razorpay client] [seeded simulator: WORLD | BELIEF]       │◀──────▶│ narration ·      │
        │  [agent core + net-value gates] [append-only audit log]     │ dashed │ dunning copy ·   │
        │  [eval harness: baseline · smart · oracle · calibration]    │        │ fuzzy hints      │
        └────────────────────────────────┬───────────────────────────┘        │ temp 0 · cached  │
                                         │ read / write                        │ NEVER in scored  │
                                         ▼                                     │ path             │
                           ┌─────────────────────────────┐                    └──────────────────┘
                           │ SQLite — the one ledger      │
                           │ R and W share these tables   │
                           └─────────────────────────────┘
```

The dashed LLM link is deliberately thin — it carries language, never a scored decision. Calibration, oracle and net-value are all **deterministic** and live inside the spine.

---

## 05 · The one ledger — data model ✎

Every table lives in one SQLite file. The loop works because W and R read and write the **same** rows. Ownership: **[W]** sensor · **[R]** actuator · **[shared]**.

| Table | Owner | Purpose | Key columns |
|-------|-------|---------|-------------|
| `orders` | shared | Merchant orders — source of truth for what was owed | `id` · amount · currency · status · created_at · **customer_value** 🆕 |
| `payments` | shared | One-time payment attempts; reason-code on failure | `id` · order_id · amount · status · **reason_code** · attempt_no |
| `subscriptions / mandates` | R | Recurring path (◐ DEMO). UPI-Autopay mandates + renewals | `id` · order_id · mandate_status · next_debit · reason_code |
| `settlements` | W | What Razorpay *would* pay out (🧪 MODELED, labelled synthetic) | `id` · batch_id · gross · fee · net · settled_at |
| `bank_rows` | W | Modeled bank-statement credits reconciled vs settlements | `id` · credit_amount · value_date · ref |
| `exceptions` | W | W's output — the sensor signal R consumes | `id` · type (fee·timing·missing) · expected · observed · delta · status |
| `recovery_actions` | R | R's output — one row per decision incl. gate results | `id` · ref · cause · strategy · timing_bucket · **predicted_prob** 🆕 · outcome · **reconciled** 🆕 · amount_recovered · **net_value** 🆕 |
| `calibration_report` 🆕 | shared | Per-batch belief-vs-realized comparison | batch_id · cell(cause,timing) · n · belief · realized · brier · drift |
| `audit_log` | shared | Append-only — the replayable trail | `id` · ts · actor · event · payload · seed |

---

## 06 · The outcome model — cited distribution + belief≠world ✎

The credibility crux. **Reproducibility comes not from the numbers being "true" but from being fixed, seeded, and declared** — the same tables drive every policy under the same seed, so *deltas* are real even where absolute ₹ is a model output.

| | 📎 CITED — reason-code distribution | 🧪 MODELED — WORLD table | 🧪 MODELED — BELIEF table |
|---|---|---|---|
| **What** | which causes occur, how often | the *true* success prob (generates outcomes) | what R *thinks* is true (plans against) |
| **Source** | Razorpay error codes + public card/UPI taxonomy (RBI/NPCI); produced by **T0.5** | anchored to ~50%→60% literature | initialized from WORLD, deliberately biased |
| **Form** | `reason_code → weight` (source-commented) | `(cause, timing) → true_prob` | `(cause, timing) → belief_prob` |
| **Role** | drives the failure generator | drives outcome draws + the oracle bound | drives R's decisions + gets recalibrated by F1 |

> **🔑 Reproducibility contract:** Same seed → byte-identical scored output. The README ships an "Outcome Model & Sources" section: distribution cites sources; WORLD, BELIEF and every constant are honestly declared. **Honest simulation, never claimed production.**
>
> **Why two tables:** if outcomes were drawn from the same table R predicts with, F1 calibration and F2 regret would be trivially zero (fake). belief≠world models the real situation — "our assumptions were wrong and the loop found out."

---

## 07 · R and W, in detail ✎

**R — Recover (actuator)**
- **Diagnose:** reason-code → cause via deterministic table lookup.
- **Predict:** attach `predicted_prob` from the **BELIEF** table.
- **Decide:** retry vs. dun vs. stop — argmax of **net value** (F3) over timing buckets.
- **Gate:** attempt caps, spend caps, confirmation, net-value floor — all deterministic.
- **Execute:** two branches — `retry_payment` (hero) + `retry_mandate_debit/dun` (demo).
- **Emit:** a recovery event (with predicted_prob) → ledger → back to W.

**W — Where's my money (sensor + teacher)**
- **Match:** exact + tolerance across settlement ↔ bank ↔ orders.
- **Classify:** three exception types — fee / timing / missing.
- **Net:** one many-to-many case (settlement batch vs. lump-sum credit).
- **Re-reconcile:** ingest R's recovered events, mark `reconciled`, **close** exceptions.
- **Teach (F1):** emit the per-cell realized rate → `calibration_report` → recalibrate BELIEF.
- **No LLM** in the scored path; fuzzy-match hints only, outside scoring.

---

## 08 · The LLM boundary & determinism ✎

| Inside the scored path — **NO LLM** (all deterministic) | Outside — **LLM welcome** |
|---|---|
| reason-code → cause lookup | decision narration ("retried on the 1st because…") |
| net-value argmax + policy gates | Hinglish dunning copy |
| optimal-retry-date selection | fuzzy fee/timing recon hints |
| ₹-recovered, net-value, regret, calibration/EMA | all at temp 0 + response cache |

**⚙️ Determinism to account for**
1. **RNG** → one seed threaded through generator, distribution, WORLD outcome draws, and any EMA order.
2. **LLM** → temp 0 + prompt-keyed cache.
3. **Clock** → simulated, never `now()`.
4. **Live API** → quarantined to the one Payment Link, pre-recorded.
5. **Ordering** → deterministic batch order (by id); calibration cells iterated in fixed order.

Rule of thumb: **same seed → byte-identical scored output, every run.**

---

## 09 · Scoring — baseline vs. smart vs. oracle ✎

| Baseline (Razorpay's cited default) 📎 | Smart policy | Oracle (bound) 🆕 |
|---|---|---|
| Fixed **T+1/T+2/T+3**, cause-blind (their docs) | Cause-aware; net-value argmax; optimal timing | Knows WORLD probs; maximizes expected ₹ |
| Retries regardless of reason | Payday-aware, transient-fast, hard-decline-stop | The reachable maximum |
| — | Recalibrates via F1 across batches | Distributional (primary); clairvoyant (loose, labelled) |

> **📊 The score:** run one seeded batch through all three; draw each retry's success from the **WORLD** table; report:
> - **Gross ₹ recovered** — headline (D7), smart vs baseline **delta**, targeting a beat over Razorpay's cited baseline.
> - **Net value** — smart's margin over baseline widens (baseline over-retries).
> - **Efficiency** — `smart_₹ / oracle_₹` vs `baseline_₹ / oracle_₹`, over the recoverable population.
> - **Calibration** — Brier + drift shrinking across batches (F1).
> - **Sensitivity** — policy ranking stable across a `c_churn` sweep (F3).
>
> Shared seed + shared tables ⇒ every comparison is apples-to-apples and reproducible.

---

## 10 · Build order — ~3 weeks ✎

```
T0.5 taxonomy research  →  T1 config constants (freeze enum + WORLD/BELIEF)  →  T… → T23
   (blocking)
```

| Week 1 · spine | Week 2 · R | Week 3 · W + loop |
|---|---|---|
| **T0.5** cited reason-code distribution | executor + net-value gates | 3-way matcher + exception list |
| records model + append-only audit | optimal-retry-date model | loop wiring (re-reconcile) |
| batch runner | one live Payment Link | **F1** calibration + BELIEF recalibration 🆕 |
| synthetic generators (one-time + mandate) | measured recovery batch (hero ₹) | **F2** oracle + regret reporting 🆕 |
| **WORLD/BELIEF split** in simulator 🆕 | **F3** net-value objective + `c_churn` sweep 🆕 | Track 1 teaser (if time) · 5-min video |

> **⚠ Fallback trigger ⏸ (confirm D10):** if W2 slips, W degrades 3-way → **2-way** recon, and F1/F2 degrade to *report-only* (no BELIEF recalibration). Track 1 teaser drops first — shares no spine, zero structural cost.

---

## 11 · Still deferred — tuning, not structure

The architecture is effectively locked once these are confirmed.

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D7 | Metric headline | Gross ₹ delta as headline; net value + efficiency as support | **yes** |
| D8 | Baseline schedule | Razorpay's cited fixed T+1/T+2/T+3, cause-blind | **yes** |
| D9 | Eval batch size | 100 / 500 / 1000 synthetic failures | **500** |
| D10 | Fallback | 3-way → 2-way; F1/F2 report-only if W2 slips | **yes** |
| D11 🆕 | BELIEF recalibration | report-only vs. EMA auto-update (`n_min` gate) | **EMA, guarded** |
| D12 🆕 | Oracle type | distributional (headline) + clairvoyant (loose bound) | **both, distributional headline** |

---

*Tijori (working name) · Razorpay AI Buildathon · Track 3 — Revenue Recovery. v3 supersedes v2 in place; companion detail in [docs/differentiation.md](docs/differentiation.md). No plans from v1/v2 remain except where carried forward above; the T1–T23 DAG and exact SQLite DDL are regenerated to match this file before coding begins.*
