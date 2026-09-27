"""pipeline 指令入口：python -m pipeline.cli <command>

Phase 0 只有 build-region-css；其餘指令（seed-region、refresh、poll…）依 PLAN.md §9 逐階段加入。
"""

from __future__ import annotations

import argparse
import sys


def cmd_build_region_css(_: argparse.Namespace) -> int:
    from pipeline.region_css import build

    dst = build()
    print(f"wrote {dst}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("build-region-css", help="由 data/regions.json 產生 regions.css")
    p.set_defaults(func=cmd_build_region_css)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
