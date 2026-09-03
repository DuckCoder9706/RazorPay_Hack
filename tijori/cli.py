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


def _cmd_run(args: argparse.Namespace) -> int:
    from tijori.eval.harness import run_batch  # imported lazily; body lands W2-3

    try:
        run_batch(seed=args.seed, n=args.n)
    except NotImplementedError as e:
        print(f"run pending: {e}", file=sys.stderr)
        return 2
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tijori", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init-db", help="create the SQLite ledger from schema.sql")
    p_init.add_argument("--path", default=str(DEFAULT_DB_PATH))
    p_init.add_argument("--fresh", action="store_true", help="delete any existing DB first")
    p_init.set_defaults(func=_cmd_init_db)

    p_val = sub.add_parser("validate", help="validate frozen constants")
    p_val.set_defaults(func=_cmd_validate)

    p_run = sub.add_parser("run", help="run a scored batch (W2-3)")
    p_run.add_argument("--seed", type=int, default=constants.DEFAULT_SEED)
    p_run.add_argument("--n", type=int, default=constants.DEFAULT_BATCH_SIZE)
    p_run.set_defaults(func=_cmd_run)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
