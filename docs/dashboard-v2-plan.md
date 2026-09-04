# Tijori Dashboard v2 — Build Plan

> **Status:** planned, not started. Branch `dashboard-redesign`.
> **Goal:** turn the static, scroll-heavy board into a **live, verifiable, component-rich
> recovery terminal** — where the frontend itself carries every assurance a judge needs
> (reproducibility, real Razorpay object, no-LLM scored path), because the frontend is all
> they see.

## Decisions locked
| # | Decision | Choice |
|---|---|---|
| S1 | Component stack | **shadcn/ui + TypeScript** (Option 42) — cleanest bklit integration + accessible Tabs/Sheet/Dialog/Tooltip/Popover/Command in one move; TS de-risks a bigger live board. |
| S2 | Charts | **bklit-ui** via shadcn registry (`@bklit/*`, MIT). Recharts underneath. Studio is proprietary — not used. |
| S3 | Sequencing | **Pure phased P0→P7** — strict order, never a broken state, each phase independently demoable. |
| S4 | Live model | Streamed batch playback (SSE) + live Razorpay Payment Link poll + client-visible reproducibility hash. |
| S5 | Data layer | **TanStack Query** for fetch/poll/cache (added P1). |

> Honesty carries forward: numbers stay tagged CITED / MODELED / PREFERENCE; the scored core
> stays stdlib-only and deterministic; the live Razorpay path stays quarantined (D3).

---

## Current baseline (what we're building on)
- `dashboard/`: Vite + React 18, **plain JS**, Tailwind v3 with custom tokens (`canvas`/`surface`/`money`/`azure`/`amber`/`rose`/…). Files: `src/{main,App,panels}.jsx`, `src/lib.js`, `src/index.css`, `tailwind.config.js`, `index.html` (Inter + JetBrains Mono).
- Backend: `tijori/api/app.py` (FastAPI) — read-only `/health /batch /learn /exceptions /churn /outcome-model /audit`, mounts `dashboard/dist` at `/`.
- Harness: `run_batch`, `learning_run`, `churn_sweep` (`tijori/eval/harness.py`).
- Razorpay: `create_payment_link`, `fetch_payment_link` (`tijori/razorpay_client/client.py`); `rzp_test_` keys in gitignored `.env`.

---

## Phases

### P0 · Stack setup — shadcn + TypeScript
**Do:** add TS (`typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `tsconfig.json`, `vite.config.ts`); shadcn deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`); `components.json`; `src/lib/utils.ts` (`cn()`); `@/*` path alias (tsconfig + vite resolve). Rename `*.jsx→*.tsx`, `lib.js→lib.ts`; add `src/types.ts` (typed API payloads for every endpoint). Keep the **terminal palette as source of truth** and map shadcn's CSS vars (`--background`, `--foreground`, `--primary`…) onto it so shadcn components inherit the look — additive, not a rewrite.
**Deps:** typescript, @types/*, class-variance-authority, clsx, tailwind-merge, tailwindcss-animate, lucide-react.
**Demoable / accept:** pixel-parity with today's board; `npm run build` clean; Python tests still 55 green.
**Est:** ~0.5 day.

### P1 · Thin backend (the live substrate)
**Add endpoints (all keep scored numbers identical to `/batch`):**
- `GET /batch/stream?seed=&n=` → `StreamingResponse` (`text/event-stream`). New generator in `harness.py` yielding progress (running ₹, per-batch F1 points, exception counts) then a final `done` event. Scored output byte-identical to `/batch`.
- `POST /razorpay/link` → creates a real `rzp_test_` Payment Link (wraps `create_payment_link`), returns the real object. `GET /razorpay/link/{id}` → status (wraps `fetch_payment_link`). Clear "keys not configured" response when `.env` is absent.
- `GET /verify?seed=&n=` → runs the scored batch **twice**, returns `{hash_a, hash_b, identical:true}` (SHA-256 over canonical scored output). Backs the reproducibility widget.
- `GET /learn?...&recalibrate=false` → expose the ablation via query (harness already supports `recalibrate_on`).
**Deps:** none new server-side (stdlib `hashlib`, existing razorpay).
**Demoable / accept:** curl the stream and see events; create/fetch a real link; `/verify` returns identical hashes. New API tests added, suite green.
**Est:** ~1 day.

### P2 · Layout — tabs / bento + drawers (kills the scroll)
**shadcn add:** `tabs`, `sheet`, `dialog`, `tooltip`, `popover`, `command`, `button`, `badge`, `scroll-area`, `separator`.
**Do:** restructure `App` into a tabbed shell — **Overview** (bento of compact live tiles) + **Recover (R)** · **Reconcile (W)** · **Learn (F1)** · **Ledger**. Tiles open **Sheets** for detail. ⌘K command palette to jump tabs / set seed+n / trigger a run.
**Demoable / accept:** whole board in one viewport per tab; no long scroll; keyboard-navigable.
**Est:** ~1 day.

### P3 · Charts — bklit-ui
**shadcn add (verify exact registry names):** `@bklit/funnel-chart`, `@bklit/gauge-chart`, `@bklit/ring-chart`, `@bklit/sankey-chart`, `@bklit/live-line-chart`, `@bklit/radar-chart`. Recharts pulled in transitively.
**Map data:**
| Chart | Data |
|---|---|
| Funnel | at-risk → recoverable → recovered → reconciled |
| Gauge / Ring | efficiency = % of oracle ceiling (smart vs baseline) |
| Sankey | cause → chosen timing → outcome (also shows belief≠world routing) |
| Radar | per-cause smart-vs-baseline recovery profile |
| Live Line | recovery rate per batch (streamed) |
| Reliability plot | belief vs realized scatter + diagonal (upgrades the F1 line) |
**Demoable / accept:** charts render in both themes, responsive, no console errors.
**Est:** ~1–1.5 days.

### P4 · Live playback + ticker
**Do:** `useEventSource` hook consuming `/batch/stream`; **Run** triggers a streamed run with a progress bar; ₹ ticker animates, exceptions populate, F1 curve draws batch-by-batch, Live Line moves. All gated on `prefers-reduced-motion`.
**Demoable / accept:** press Run → watch the 500 decisions score live to the final totals that match `/batch`.
**Est:** ~1 day.

### P5 · Razorpay live panel + poll
**Do:** panel with **Create test Payment Link** → shows the real object + `short_url` + QR; polls `GET /razorpay/link/{id}` every ~3 s; card flips `created → paid` when paid with the test card `4111 1111 1111 1111`. Graceful "configure `rzp_test_` keys" empty state.
**Deps (frontend):** a small QR lib (or render Razorpay's own `short_url`).
**Demoable / accept:** real Razorpay object on screen; pay it; card flips to paid live.
**Est:** ~0.5–1 day.

### P6 · Verification (the "actual assurances")
**Widgets:**
- **Reproducibility proof** — calls `/verify`, shows two identical SHA-256 hashes side by side.
- **Provenance popovers** — every number has an ⓘ → CITED / MODELED / PREFERENCE + source link (data from `outcome-model` + a small provenance map).
- **Seed permalink** — URL syncs `?seed=&n=&tab=`; reload reproduces the exact view.
- **Ablation toggle** — recalibration ON/OFF re-runs F1 live so judges watch it stop learning.
- **No-LLM latency badge** — visible chip with ~6 µs/decision as proof the scored path can't be calling a model.
- **Oracle-bound assertion** — visibly asserts `smart ≤ oracle`, flags green.
**Demoable / accept:** a judge can verify determinism, provenance, and the F1 causal claim without leaving the page.
**Est:** ~1 day.

### P7 · Readability, motion & a11y polish
**Do:** plain-language "what am I looking at" strips; glossary (R/W/F1-3, cause enum); number formatting (lakh/crore, compact ₹ with full value on hover); motion easing/stagger refinement + full `prefers-reduced-motion` path; a11y audit (keyboard, focus-visible, contrast ≥4.5:1); responsive 320px→wide; empty/error/loading skeletons everywhere; final screenshot pass across breakpoints.
**Demoable / accept:** meets the web-design craft floor; clean at 320px; zero console errors.
**Est:** ~1 day.

---

## Cross-cutting
- **Testing:** extend `tests/test_api.py` for `/batch/stream` (first + final event), `/verify` (identical hashes), `/razorpay/link` (mock the client — never hit live in CI). Keep Python suite green each phase.
- **Serving:** single-origin `uvicorn tijori.api.app:app` still serves the built SPA + API; SSE works under uvicorn. Vite dev (`npm run dev`, proxy) for live editing.
- **Determinism/honesty invariants (must not regress):** scored core stdlib-only; same seed → identical hash (now provable in-UI via P6); LLM never in scored path; live Razorpay quarantined to the P5 panel.

## Risk register
| Risk | Mitigation |
|---|---|
| bklit registry name/version drift | verify each `@bklit/*` name against ui.bklit.com before P3; vendor the chart source (MIT) if the registry misbehaves. |
| Razorpay live non-determinism / rate limits / missing keys | quarantined to P5; graceful empty state; never in scored path or CI. |
| SSE + static mount edge cases | test the stream endpoint before wiring the UI; fall back to chunked polling if needed. |
| shadcn CSS-var theme vs our named tokens | keep named tokens authoritative, map shadcn vars onto them (additive) — verified in P0. |
| Scope creep on "all" | strict P0→P7 gate; each phase shippable; stop anywhere and the board is coherent. |

## Rough total
~7–8 focused days across P0–P7. Each phase leaves a demoable artifact, so it can be paused for the pitch video at any boundary.

---
*Companion to [ARCHITECTURE.md](../ARCHITECTURE.md). Supersedes the Week-3b dashboard once P0 begins.*
