# Tijori

**A closed loop that finds missing money, recovers it, proves it settled — and corrects its own recovery model.**
Razorpay AI Buildathon · **Track 3 — Revenue Recovery**.

> Razorpay already retries (Optimizer) and reconciles (settlement reports) — *separately*.
> Tijori closes the loop: **W** senses money that failed to arrive, **R** acts to recover it,
> every recovered rupee re-reconciles to *prove* it landed, and that proof recalibrates R's
> beliefs. It also reports how close it gets to the theoretical maximum.

- Full design: [ARCHITECTURE.md](ARCHITECTURE.md)
- Differentiation + Razorpay overlap + feature stress-tests: [docs/differentiation.md](docs/differentiation.md)
- Cited outcome model (reason taxonomy, distribution, WORLD/BELIEF): [docs/outcome-model.md](docs/outcome-model.md)

## Stack
Python 3.11 · FastAPI · SQLite · Razorpay SDK (test-mode) · Claude (temp 0 + cache, **never in the scored path**) · React + Tailwind.

## Repo layout
```
tijori/
  config/constants.py     # T1 · frozen enum, distribution, WORLD/BELIEF, gates, costs
  ledger/                 # the one SQLite ledger: schema.sql, db, models, append-only audit
  simulator/              # seeded: clock, WORLD (truth) vs BELIEF (R's view), generators
  recover/                # R · diagnose → net-value policy → executor
  where/                  # W · 3-way matcher → exceptions → F1 calibration
  eval/                   # baseline · smart · oracle · metrics (regret, net value, Brier)
  llm/                    # narration + dunning copy — OUTSIDE the scored path
  razorpay_client/        # the one live test-mode Payment Link path
  api/app.py              # FastAPI for the dashboard
  cli.py                  # tijori init-db | validate | run
dashboard/                # React + Tailwind (Vite) — panels land Week 3
track1_teaser/            # isolated ≤90s agent-buyable teaser (conditional)
tests/                    # T1 acceptance tests
docs/                     # differentiation + outcome model
```

## Quickstart
```bash
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -e ".[dev]"
cp .env.example .env                                 # add your rzp_test_ keys

tijori validate            # check the frozen constants (T1)
tijori init-db --fresh     # build the SQLite ledger from schema.sql
pytest -q                  # run acceptance tests (55: core + API)
```

## Dashboard
The React/Tailwind dashboard is six read-only panels over the same scored core the CLI
runs — headline recovery (D7/F2/F3), the F1 learning curve, W's typed exceptions, the F3
churn sweep, the WORLD/BELIEF outcome model, and the append-only audit trail. One control
(seed, n) drives every panel; because every endpoint is a deterministic projection of the
ledger, the whole board is reproducible.

```bash
# 1 · build the dashboard once (outputs dashboard/dist)
cd dashboard && npm install && npm run build && cd ..

# 2 · serve the API + built dashboard from one origin
uvicorn tijori.api.app:app --port 8000      # open http://localhost:8000
```

The API mounts `dashboard/dist` at `/`, so a single `uvicorn` serves both — no proxy, no
CORS. For live dashboard development instead, run `uvicorn …` and `npm run dev` (port 5173,
which proxies the API). Endpoints: `/batch` `/learn` `/exceptions` `/churn` `/outcome-model`
`/audit` (`/docs` for the OpenAPI UI) — all `GET`, all keyed on `?seed=&n=`.

## Build status
| Task | State |
|---|---|
| **T0.5** cited reason-code distribution | ✅ done — [docs/outcome-model.md](docs/outcome-model.md) |
| **T1** repo scaffold + frozen constants + ledger DDL | ✅ done |
| **Week 1** · seeded generators + settlement substrate + audit + multi-seed sweep | ✅ done |
| **Reproducibility** · RNG substreams · golden snapshot · pinned env · seed provenance · lognormal | ✅ done |
| **Week 2** · R policy (net-value argmax) + executor + oracle + scored batch | ✅ done — `tijori run` |
| **Week 2b** · live test-mode Payment Link (real Razorpay object) | ✅ done — `tijori payment-link` |
| **Week 3** · W 3-way matcher + exceptions + **F1 recalibration** + loop wiring | ✅ done — `tijori reconcile` / `tijori learn` |
| **Week 3b** · FastAPI read-only API + React/Tailwind dashboard (6 panels) | ✅ done — `uvicorn tijori.api.app:app` |
| Week 3c · 5-min pitch video | next |

**F1 — the novel core, working** (`tijori learn --seed 42 --n 500 --batches 5`): R starts with a biased belief (over-trusts fast retries on soft declines) and picks the *wrong* timing; W reconciles the realized outcomes and recalibrates BELIEF; within 2 batches the timing **flips `fast → short`** (world-optimal), **regret ₹12,812 → ₹0**, Brier 0.012 → 0.001. With recalibration off, it never learns — proving F1 is the cause. **W reconciliation** (`tijori reconcile`) detects exactly the injected fee/timing/missing exceptions and reconciles the many-to-many netting case.

**First scored result** (`tijori run --seed 42 --n 500`), WORLD table calibrated to published recovery bands (fixed ≈40–60% of recoverable, smart ≈65–85%): baseline recovers **46% of recoverable** (₹163,184); **smart recovers ≈72% of recoverable** (₹268,379) — **+64.5% gross, +₹109k net**, at 95.4% of the oracle ceiling vs baseline's 58.0%. **F3 robustness:** smart wins on net value across the entire ₹0–₹20 churn range. **Latency:** ~6 µs/decision (160k decisions/sec, single core) — no LLM or I/O in the scored path.

## Honesty
The reason **taxonomy** is cited (Razorpay's 109-value error enum); the reason **distribution** is anchored to cited card/UPI decline data with a modeled blend; the **WORLD/BELIEF** success tables are modeled and declared. Same seed → byte-identical scored output. Honest simulation, never claimed production. Full provenance in [docs/outcome-model.md](docs/outcome-model.md).
