"""pipeline 指令入口：python -m pipeline.cli <command>"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def cmd_build_region_css(_: argparse.Namespace) -> int:
    from pipeline.region_css import build

    print(f"wrote {build()}")
    return 0


def cmd_build_geo(args: argparse.Namespace) -> int:
    from pipeline.geo import simplify
    from pipeline.paths import GEO_JSON

    print(f"wrote {simplify(Path(args.source), GEO_JSON)}")
    return 0


def cmd_seed_region(args: argparse.Namespace) -> int:
    from pipeline.major import seed_region

    reports = []
    for pref in args.prefectures:
        reports.append(seed_region(pref))
    text = "\n".join(reports)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    if args.report:
        Path(args.report).write_text(text, encoding="utf-8")
    return 0


def cmd_build_bundles(_: argparse.Namespace) -> int:
    from pipeline.build_bundles import build

    for path in build():
        print(f"wrote {path}")
    return 0


def _emit(text: str, report: str | None) -> None:
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(text + "\n")
    if report:
        Path(report).write_text(text, encoding="utf-8")


def cmd_enrich(args: argparse.Namespace) -> int:
    from pipeline import enrich

    if args.action in ("submit", "run"):
        enrich.submit(args.prefectures, args.limit)
    if args.action in ("poll", "run"):
        _emit(enrich.wait_and_collect(max_wait_s=args.max_wait), args.report)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pipeline", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("build-region-css", help="由 data/regions.json 產生 regions.css")
    p.set_defaults(func=cmd_build_region_css)

    p = sub.add_parser("build-geo", help="由原始縣界 GeoJSON 產生簡化版 prefectures.json")
    p.add_argument("source", help="dataofjapan/land 的 japan.geojson 路徑")
    p.set_defaults(func=cmd_build_geo)

    p = sub.add_parser("seed-region", help="採集指定都道府縣的大點，寫入 data/spots/")
    p.add_argument("prefectures", nargs="+", help="都道府縣 slug，例 kyoto aichi")
    p.add_argument("--report", help="把 markdown 報告另存到這個路徑")
    p.set_defaults(func=cmd_seed_region)

    p = sub.add_parser("enrich", help="LLM 補全（Batch API）：簡介、假名、季節、停留時間")
    p.add_argument("action", choices=["submit", "poll", "run"])
    p.add_argument("prefectures", nargs="*", help="都道府縣 slug")
    p.add_argument("--limit", type=int, help="每縣最多送出幾筆（先小量驗證 prompt）")
    p.add_argument("--max-wait", type=int, default=3 * 3600, help="poll 最多等幾秒")
    p.add_argument("--report", help="把 markdown 報告另存到這個路徑")
    p.set_defaults(func=cmd_enrich)

    p = sub.add_parser("build-bundles", help="data/ → web/public/bundles/")
    p.set_defaults(func=cmd_build_bundles)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
