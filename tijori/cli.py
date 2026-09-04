"""Tijori CLI.

    tijori init-db [--path data/tijori.db] [--fresh]   create the ledger
    tijori validate                                     check frozen constants
    tijori run [--seed 42] [--n 500]                    run a scored batch (W2-3)

Only `init-db` and `validate` are live at T1; `run` is wired as the eval harness fills in.
"""

from __future__ import annotations

import argparse
import sys

from tijori.config import constants
from tijori.ledger.db import DEFAULT_DB_PATH, init_db, get_conn, table_names


def _cmd_init_db(args: argparse.Namespace) -> int:
    path = init_db(args.path, fresh=args.fresh)
    with get_conn(path) as conn:
        tables = table_names(conn)
    print(f"ledger ready at {path}")
    print(f"tables ({len(tables)}): {', '.join(tables)}")
    return 0


def _cmd_validate(_args: argparse.Namespace) -> int:
    constants.validate()
    dist_total = round(sum(constants.REASON_CODE_DISTRIBUTION.values()), 9)
    print("constants OK")
    print(f"  causes: {len(list(constants.Cause))}")
    print(f"  reason->cause mappings: {len(constants.REASON_TO_CAUSE)}")
    print(f"  distribution sum: {dist_total}")
    return 0


def _fmt_rupees(paise: int) -> str:
    return f"₹{paise / 100:,.2f}"


def _cmd_generate(args: argparse.Namespace) -> int:
    from tijori.simulator.seed import seed_ledger

    init_db(args.path, fresh=True)
    conn = get_conn(args.path)
    try:
        s = seed_ledger(conn, seed=args.seed, n=args.n)
    finally:
        conn.close()
    print(f"seeded ledger at {args.path}  (seed={s['seed']})")
    print(f"  one-time failures : {s['n_onetime_failures']}  "
          f"(at risk {_fmt_rupees(s['total_at_risk_paise'])})")
    print(f"  mandate failures  : {s['n_mandate_failures']}")
    print(f"  settlements       : {s['n_settlements']}   bank rows: {s['n_bank_rows']}")
    print(f"  injected exceptions: {s['injected_exceptions']}")
    print("  cause mix:")
    for cause, cnt in s["cause_mix"].items():
        print(f"    {cause:<22} {cnt:>4}  ({cnt / s['n_onetime_failures']:.0%})")
    return 0


def _cmd_sweep(args: argparse.Namespace) -> int:
    from tijori.eval.sweep import default_seeds, run_sweep

    seeds = default_seeds(args.batches)
    r = run_sweep(seeds, n=args.n)
    ar = r["at_risk_rupees"]
    print(f"sweep: {r['n_batches']} batches x n={r['n_per_batch']}  "
          f"(seeds {seeds[0]}..{seeds[-1]}) = {r['total_failures']} failures")
    print(f"  ₹ at risk / batch : mean ₹{ar['mean']:,.0f}  std ₹{ar['std']:,.0f}  "
          f"[₹{ar['min']:,.0f} – ₹{ar['max']:,.0f}]")
    print(f"  ₹ at risk total   : ₹{ar['total']:,.0f}")
    print(f"  retryable / terminal (pooled): {r['retryable_pooled']} / {r['terminal_pooled']} "
          f"({r['retryable_pooled'] / r['total_failures']:.0%} recoverable)")
    print(f"  injected exceptions / batch  : {r['injected_per_batch']}")
    print("  cause-mix stability (mean share ± std, pooled count):")
    for cause, st in sorted(r["cause_share_stats"].items(), key=lambda kv: -kv[1]["mean_share"]):
        flag = "" if st["retryable"] else "  [terminal]"
        print(f"    {cause:<22} {st['mean_share']:6.1%} ± {st['std_share']:4.1%}"
              f"   pooled {st['pooled_count']:>5}{flag}")
    return 0


def _cmd_payment_link(args: argparse.Namespace) -> int:
    from tijori.razorpay_client.client import create_payment_link, fetch_payment_link

    link = create_payment_link(args.amount_paise, save_as="payment_link")
    print("created a LIVE test-mode Payment Link (real Razorpay object):")
    print(f"  id       : {link.get('id')}")
    print(f"  status   : {link.get('status')}")
    print(f"  amount   : ₹{link.get('amount', 0) / 100:,.2f} {link.get('currency')}")
    print(f"  short_url: {link.get('short_url')}")
    print(f"  fixture  : tijori/razorpay_client/fixtures/payment_link.json")
    if link.get("id"):
        status = fetch_payment_link(link["id"])
        print(f"  re-fetched status: {status.get('status')}  "
              f"(pay it at the short_url with test card 4111 1111 1111 1111 to mark it paid)")
    return 0


def _cmd_churn_sweep(args: argparse.Namespace) -> int:
    from tijori.eval.harness import churn_sweep

    rows = churn_sweep(seed=args.seed, n=args.n)
    print(f"F3 churn sensitivity  seed={args.seed}  n={args.n}")
    print(f"  {'c_churn':>9} {'base net₹':>12} {'smart net₹':>12} {'smart wins?':>12} {'attempts':>9}")
    for r in rows:
        print(f"  ₹{r['c_churn_paise'] / 100:>7.2f} {r['baseline_net'] / 100:>12,.0f} "
              f"{r['smart_net'] / 100:>12,.0f} {'yes' if r['smart_wins_net'] else 'NO':>12} "
              f"{r['smart_attempts']:>9}")
    always = all(r["smart_wins_net"] for r in rows)
    print(f"  --> smart wins on net value across the ENTIRE churn range: {always}")
    return 0


def _cmd_bench(args: argparse.Namespace) -> int:
    import time
    from tijori.config.constants import BELIEF_TABLE, Cause
    from tijori.recover.policy import choose_smart
    from tijori.eval.harness import run_batch

    # Per-decision latency (the hot path: diagnose + net-value argmax, no I/O, no LLM).
    reps = 200_000
    t0 = time.perf_counter()
    for i in range(reps):
        choose_smart(Cause.INSUFFICIENT_FUNDS, 50000, (i % 3) + 1, "mid")
    per = (time.perf_counter() - t0) / reps * 1e6  # microseconds
    print(f"per-decision latency : {per:.2f} µs  ({1e6 / per:,.0f} decisions/sec, single core)")

    # End-to-end scored batch throughput.
    t0 = time.perf_counter()
    r = run_batch(seed=args.seed, n=args.n)
    dt = time.perf_counter() - t0
    print(f"scored batch (n={args.n}) : {dt * 1000:.0f} ms  "
          f"({args.n / dt:,.0f} failures/sec, both policies + oracle)")
    print(f"  (smart recovered ₹{r.metrics['smart'].gross_recovered_paise / 100:,.0f})")
    return 0


def _cmd_run(args: argparse.Namespace) -> int:
    from tijori.eval.harness import run_batch

    r = run_batch(seed=args.seed, n=args.n, db_path=args.path)
    base, smart = r.metrics["baseline"], r.metrics["smart"]
    oracle_r = r.oracle_paise / 100

    def rup(paise: int) -> str:
        return f"₹{paise / 100:,.0f}"

    delta = smart.gross_recovered_paise - base.gross_recovered_paise
    delta_pct = (delta / base.gross_recovered_paise * 100) if base.gross_recovered_paise else 0.0
    net_delta = smart.net_value_paise - base.net_value_paise

    print(f"scored batch  seed={r.seed}  n={r.n}   (oracle ceiling {rup(r.oracle_paise)})")
    print(f"  {'policy':<9} {'recov%':>7} {'gross₹':>12} {'net₹':>12} {'attempts':>9} {'eff':>6}")
    for m in (base, smart):
        print(f"  {m.policy:<9} {m.recovery_rate:>6.1%} {rup(m.gross_recovered_paise):>12} "
              f"{rup(m.net_value_paise):>12} {m.n_attempts:>9} {m.efficiency:>6.1%}")
    print(f"  --> smart beats baseline: +{rup(delta)} gross ({delta_pct:+.1f}%), "
          f"+{rup(net_delta)} net")
    print(f"  --> smart captures {smart.efficiency:.1%} of the reachable maximum "
          f"(baseline {base.efficiency:.1%})")
    return 0


def main(argv: list[str] | None = None) -> int:
    # Windows consoles default to cp1252; force UTF-8 so ₹ and friends print.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass

    parser = argparse.ArgumentParser(prog="tijori", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init-db", help="create the SQLite ledger from schema.sql")
    p_init.add_argument("--path", default=str(DEFAULT_DB_PATH))
    p_init.add_argument("--fresh", action="store_true", help="delete any existing DB first")
    p_init.set_defaults(func=_cmd_init_db)

    p_val = sub.add_parser("validate", help="validate frozen constants")
    p_val.set_defaults(func=_cmd_validate)

    p_gen = sub.add_parser("generate", help="seed the ledger with a reproducible batch (W1)")
    p_gen.add_argument("--path", default=str(DEFAULT_DB_PATH))
    p_gen.add_argument("--seed", type=int, default=constants.DEFAULT_SEED)
    p_gen.add_argument("--n", type=int, default=constants.DEFAULT_BATCH_SIZE)
    p_gen.set_defaults(func=_cmd_generate)

    p_sweep = sub.add_parser("sweep", help="build many seeded batches and report data metrics (W1)")
    p_sweep.add_argument("--batches", type=int, default=20)
    p_sweep.add_argument("--n", type=int, default=constants.DEFAULT_BATCH_SIZE)
    p_sweep.set_defaults(func=_cmd_sweep)

    p_pl = sub.add_parser("payment-link", help="create a LIVE test-mode Razorpay Payment Link (D3)")
    p_pl.add_argument("--amount-paise", type=int, default=50000, help="amount in paise (default ₹500)")
    p_pl.set_defaults(func=_cmd_payment_link)

    p_cs = sub.add_parser("churn-sweep", help="F3: smart-vs-baseline across churn costs")
    p_cs.add_argument("--seed", type=int, default=constants.DEFAULT_SEED)
    p_cs.add_argument("--n", type=int, default=constants.DEFAULT_BATCH_SIZE)
    p_cs.set_defaults(func=_cmd_churn_sweep)

    p_bench = sub.add_parser("bench", help="measure per-decision latency + batch throughput")
    p_bench.add_argument("--seed", type=int, default=constants.DEFAULT_SEED)
    p_bench.add_argument("--n", type=int, default=constants.DEFAULT_BATCH_SIZE)
    p_bench.set_defaults(func=_cmd_bench)

    p_run = sub.add_parser("run", help="run a scored batch: baseline vs smart vs oracle")
    p_run.add_argument("--seed", type=int, default=constants.DEFAULT_SEED)
    p_run.add_argument("--n", type=int, default=constants.DEFAULT_BATCH_SIZE)
    p_run.add_argument("--path", default=str(DEFAULT_DB_PATH), help="persist the scored ledger here")
    p_run.set_defaults(func=_cmd_run)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
