# Sonic

Sonic recovers failed payments. It figures out why a payment failed, decides how (and whether) to retry it, records what actually settled, and updates its own success estimates when they turn out wrong.

Built for the Razorpay AI Buildathon, Track 3 (Revenue Recovery).

## The problem

When a payment fails, most systems either give up or retry on a fixed schedule. Both lose money. A card that declined for insufficient funds does better on a retry timed near payday; retrying it a few minutes later usually just declines again. An expired card should not be retried at all and should go straight to dunning. If you treat those two failures the same way, recoverable revenue leaks.

Sonic keeps the cause of a failure separate from the action you take, times each retry to when it's actually likely to work, and keeps a ledger accurate enough to say in rupees whether the smart policy beat the naive one.

## How it works

The loop has four stages.

1. **Detect (R).** Map a raw failure reason (`insufficient_funds`, `incorrect_otp`, `card_expired`, and so on) to one of 8 root causes. Retryable causes get a recovery plan. Terminal ones, like a hard decline or a risk block, get dunned or stopped.
2. **Act.** For each recoverable failure, `choose_smart` picks a retry timing (fast, short, or aligned) from how likely that timing is to succeed, weighted by the amount at stake and the customer's value tier. A fixed-schedule baseline runs next to it as a control.
3. **Audit.** Every attempt and outcome goes into a SQLite ledger, so recovery is measurable and can be re-derived later.
4. **Reconcile (W).** Three-way match payments against settlements and bank credits, including the case where many settlements net into one lump credit, and surface whatever didn't reconcile as exceptions.

The model also learns. After each batch, observed success rates are folded back into the belief table with EMA smoothing and a minimum sample floor, so a bad prior gets pulled toward reality and regret drops from one batch to the next.

### An honest scoreboard

Every run is scored three ways so the numbers can't flatter themselves:

- **baseline**, a fixed retry schedule (the naive control)
- **smart**, the cause-aware, payday-aligned policy
- **oracle**, the best any policy could have done against the ground-truth world, which is the reachable ceiling

"Smart recovered X" only means something next to the ceiling it was measured against, so efficiency is reported as the fraction of that ceiling captured.

## Layout

```
sonic/
  config/constants.py      frozen tables: causes, reason->cause map, WORLD vs BELIEF, costs
  simulator/               reproducible failure generator + world model (seeded RNG)
  where/                   R-side: reason->cause matching, 3-way reconciliation, exceptions
  recover/                 policy (baseline vs smart), diagnosis, executor
  ledger/                  SQLite schema, audit trail, DB access
  eval/                    scoring harness, oracle, metrics, seed sweeps
  api/app.py               FastAPI read-only API for the dashboard
  cli.py                   sonic command
dashboard/                 React + Vite + Tailwind, visx charts, the 6-panel UI
tests/                     55 tests (determinism, reconciliation, policy, API, and more)
```

## Setup

Requires Python 3.11+ and Node 18+.

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env        # add Razorpay TEST-MODE keys if you want live Payment Links
```

## Running it

The CLI is the fastest way to watch the loop run end to end.

```bash
sonic validate            # sanity-check the frozen constants
sonic generate            # seed a reproducible batch, show the cause mix
sonic run                 # score baseline vs smart vs oracle, in rupees
sonic reconcile           # 3-way reconcile, list exceptions
sonic learn               # recalibrate belief across batches, watch regret shrink
sonic churn-sweep         # does smart still win as churn cost varies? (it does)
sonic sweep               # stability of the data across many seeds
sonic bench               # per-decision latency + batch throughput
```

Most commands take `--seed` and `--n` (default seed 42, batch size 500).

### API + dashboard

```bash
uvicorn sonic.api.app:app --reload        # http://localhost:8000
cd dashboard && npm install && npm run dev # http://localhost:5173
```

The API is read-only and feeds the dashboard: batch scoring at `/batch`, plus `/exceptions`, `/learn`, `/churn`, `/reconciliation/benchmarks`, `/audit`, `/pipeline`, `/verify`, a streaming `/batch/stream`, and live test-mode Razorpay Payment Links at `/razorpay/link`.

## Tests

```bash
pytest
```

They cover determinism (same seed gives the same ledger), the reason-to-cause mapping, reconciliation and netting, both policies against the oracle, and the API.

## Design notes

- Money is integer paise everywhere. There are no floats in the ledger; rupees exist only for display.
- Determinism is deliberate. Everything downstream of a seed is reproducible, which is what lets "smart beat baseline by X" be something you re-run instead of a screenshot.
- The belief model is allowed to start off wrong. `BELIEF_TABLE` deviates from the true `WORLD_TABLE` on purpose, and `learn` exists to show it converging.
