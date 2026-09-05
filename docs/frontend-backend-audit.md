# Tijori Dashboard — Frontend ↔ Backend Honesty Audit

_Audit date: 2026-09-05 · Scope: `tijori/` (FastAPI backend) vs `dashboard/src/` (React frontend)_

**Goal:** find every place the frontend shows a number that is *invented* (hardcoded / synthetic)
rather than sourced from the deterministic backend, and — where a real metric already exists —
say what to bind to instead. This matters for the buildathon video: the whole pitch is
"deterministic, cited, honest," so a fabricated figure on screen undercuts the strongest claim.

---

## TL;DR

- **The backend is clean.** Every `/batch`, `/learn`, `/exceptions`, `/churn`, `/audit`,
  `/verify`, `/pipeline`, `/outcome-model` endpoint is a pure, deterministic projection of the
  scored ledger. No wall clock, no invented numbers in the scored path.
- **~85% of the frontend is correctly bound** to those endpoints (hero, Sankey, funnel, gauge,
  learning curve, exceptions, churn, outcome matrix, audit ledger, verification, pipeline).
- **The invented content is concentrated in the competitive-benchmark surface** (the
  "Multi-Infrastructure Reconciliation & Impact Benchmark" panel and its 3D radar / velocity
  trend), plus a handful of **hardcoded caption strings** that sit next to live numbers and drift
  away from them.

Findings are ranked HIGH → LOW below. Line numbers are current as of this audit.

---

## HIGH — fabricated data where a *real* endpoint already exists

### 1. "Velocity Trend" chart is synthetic noise
`dashboard/src/components/charts/recon-radar.tsx:188-203`

```ts
// Image 3: Synthetic dynamic multi-batch trend data derived from active seed & n
const trendPoints = useMemo(() => {
  const noise = (((seed * 7 + idx * 13) % 20) - 10) / 1000;
  const rate = Math.min(0.999, Math.max(0.65, baseRate + (... idx*0.001 : -idx*0.002) + noise));
```

The per-batch reconciliation curve is invented from a seed hash — the code comment says so
outright ("Synthetic dynamic multi-batch trend data"). It is presented as measured
"batch-over-batch" performance.

**Real metric to use instead:** the `/learn` endpoint already returns a genuine per-batch series
(`LearnResponse.on[]` with `efficiency`, `mean_brier`, `regret_paise` for each batch). That is the
real "gets better over batches" story and it is far more defensible than a noise function. Bind the
trend chart to `/learn`, or if you want to keep it purely presentational, label it
"illustrative."

### 2. Radar "Netting" and "Determinism" scores are hardcoded per competitor
`dashboard/src/components/charts/recon-radar.tsx:62-95`

```ts
if (i.id === "tijori") return 1.0;
if (i.id === "adyen") return 0.72;
if (i.id === "stripe") return 0.68;
if (i.id === "razorpay_default") return 0.42;
```

The netting-recall and SHA-256-determinism axes are literal constants per competitor. Tijori's own
two values are actually *provable*:
- **Netting recall** → `exceptions.summary.netting_reconciled` vs injected netting count from
  `/pipeline` (`summary.injected_exceptions.netting`).
- **Determinism** → `/verify` already returns `identical: true` with the two SHA-256 digests.

The competitor values on these two axes have no basis at all and should be labeled as estimates
(see Finding 9).

---

## MEDIUM — hardcoded caption strings that drift from the live number beside them

### 3. "+15.2% vs standard default" is a static string
`dashboard/src/panels.tsx:993`

```tsx
<div className="mt-1 font-mono text-xl font-bold text-navy">{pct(tijoriRate)}</div>
<div className="text-[10.5px] text-money-dim font-medium">+15.2% vs standard default</div>
```

`tijoriRate` above it is dynamic (99.1–99.8% depending on seed/n), but the delta caption is frozen
at "15.2%". **Fix:** compute it — `signed((tijoriRate - 0.842) * 100)` (percentage points vs the
Razorpay-default rate).

### 4. "−96%" manual-touch and "0.6% vs 15.8%" are hardcoded
`dashboard/src/panels.tsx:1013-1014`

The −96% and the two percentages are literals. They *are* derivable from the infra objects already
in scope (`tijori.manual_touch_pct` = 0.6, `razorpay_default.manual_touch_pct` = 15.8 →
1 − 0.6/15.8 = 96.2%). Compute from those fields so they can't fall out of sync.

### 5. "~6 µs per decision" / "~160,000 ops/sec" / "1.42% revenue leakage"
`dashboard/src/panels.tsx:1032` and `dashboard/src/panels.tsx:1799-1800`

These are the most clearly **invented** figures in the app:
- **Nothing in the backend measures per-decision latency.** There is no timing field on `/verify`
  or anywhere else, so "~6 µs" / "~160,000 ops/sec" are made up.
- "1.42% revenue leakage" is just the fabricated 142-bps competitor figure restated as a fact.

**Two honest options:**
- **(a) Make it real:** wrap `_scored_digest` / `_compute_batch` in `time.perf_counter()` inside
  `/verify`, return `micros_per_decision`, and render that. Then it's a measured claim.
- **(b) Soften it:** replace with a defensible qualitative claim — "in-process evaluation, no
  network or model call in the scored path" — and drop the specific µs / ops-per-sec / % numbers.

---

## LOW — labels, duplicates, and proxy volumes

### 6. Two pipeline KPIs show the same number under different labels
`dashboard/src/panels.tsx:1951` ("Customer Orders") and `:1958` ("Gateway Declines") both render
`data.summary.n_onetime_failures`. In this model every generated failure *is* the order, so it
isn't false — but showing one value twice reads as a copy-paste mismatch. Either relabel the first
"Failed Orders," or source true order count (failures + mandates + successful substrate orders).

### 7. "Total volume" is a flat ₹600 × n proxy
`tijori/api/app.py:294` → `total_volume_paise = n * 60000`. The real summed at-risk volume already
exists (`at_risk_paise`, the sum of actual failure amounts) and is used elsewhere. The
"Recovered Leakage ₹ saved" KPI (`panels.tsx:999`) is therefore _proxy volume × invented bps_ —
two soft inputs multiplied. Prefer `at_risk_paise` for the volume term.

### 8. Asserted "100%" badges
"Netting Recall 100%" (`panels.tsx:1006`), "100% Detection Recall ✓" (`:2286`), "100%
Cryptographic Match ✓" (`:1035`). The detection-recall one is genuinely verifiable (injected count
== detected count) but is asserted rather than computed. Cheap to make real by comparing
`/pipeline` injected totals to `/exceptions` `total_exceptions`.

---

## Context — the competitor benchmark set (not a bug, but a credibility risk)

### 9. Named-competitor numbers are fabricated marketing data
The full competitor row — Stripe 0.918, Adyen 0.925, Razorpay-default 0.842, Legacy 0.710, plus
every `leakage_basis_points`, `latency_hours`, and `manual_touch_pct` — is invented, and it is
hardcoded **twice** (backend `tijori/api/app.py:300-391` `_benchmarks_payload`, and frontend
`dashboard/src/panels.tsx:874-960` `defaultInfrastructures`, kept byte-identical as a fallback).

This is inherent to a competitive slide, but you are pitching **to Razorpay** with invented
Razorpay/Stripe/Adyen precision. Recommendation for the video:
- Relabel the panel's numbers as "illustrative industry estimates" and give them a `PREFERENCE`/
  citation tier (the `Cite` component already exists for exactly this), **or**
- Drop the two-decimal precision and named-competitor certainty; keep Tijori's own numbers (which
  are real) front-and-center.

Everything Tijori claims about *itself* can be made real from the ledger. Everything it claims
about *competitors* cannot — so the honest move is to visibly mark that boundary.

---

## What is already correct (no action)

`BatchPanel`, `InsightCard`, `SankeyPanel`, `RecoveryFlowPanel`, `LearnPanel`, `ExceptionsPanel`,
`ChurnPanel`, `OutcomeModelPanel`, `AuditPanel`, `VerifyPanel` (hash half), `PipelinePanel`,
`PipelineSummaryCard` — all bound to live endpoints. Cohort split (15/35/50), median ₹600,
MDR 2%+GST, 3-attempt cap, T+1/T+2/T+3 baseline, and the 109-code taxonomy all trace to
`tijori/config/constants.py` and `tijori/simulator/generator.py` correctly.

---

## Suggested fix order for the video

1. **Finding 5** (fake µs latency) — highest embarrassment risk if a judge asks "how did you
   measure that?"
2. **Finding 1** (synthetic velocity trend) — swap to `/learn`, which tells a *better* real story.
3. **Findings 3 & 4** (drifting caption strings) — 10-minute compute-from-data fixes.
4. **Finding 9** (competitor labeling) — one honesty label flips the whole panel from risky to
   impressive.
5. Findings 2, 6, 7, 8 — polish.
