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


def cmd_seed_themes(args: argparse.Namespace) -> int:
    from pipeline.themes import seed_themes

    _emit("\n".join(seed_themes(p) for p in args.prefectures), args.report)
    return 0


def cmd_seed_specialties(args: argparse.Namespace) -> int:
    from pipeline.specialties import flight_candidates, seed_specialties

    _emit(seed_specialties(args.prefectures) + "\n" + flight_candidates(), args.report)
    return 0


def cmd_verify_flights(args: argparse.Namespace) -> int:
    from pipeline.verify_flights import verify_flights

    _emit(verify_flights(), args.report)
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


def cmd_prune_spots(args: argparse.Namespace) -> int:
    from pipeline.curate import prune_spots
    from pipeline.paths import SPOTS_DIR

    prefs = args.prefectures or sorted(p.stem for p in SPOTS_DIR.glob("*.json"))
    _emit("\n".join(prune_spots(p) for p in prefs), args.report)
    return 0


def cmd_seed_wiki(args: argparse.Namespace) -> int:
    from pipeline.wiki import seed_wiki

    _emit("\n".join(seed_wiki(p) for p in args.prefectures), args.report)
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

    p = sub.add_parser(
        "seed-themes", help="採集主題小店（茶、酒、拉麵、溫泉、寶可夢），寫入 data/spots/"
    )
    p.add_argument("prefectures", nargs="+")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_themes)

    p = sub.add_parser("seed-specialties", help="地區特色（種子 × Wikidata）與直飛航線候選")
    p.add_argument("prefectures", nargs="+")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_specialties)

    p = sub.add_parser("verify-flights", help="以 Claude + 網頁搜尋驗證台灣直飛航線")
    p.add_argument("--report")
    p.set_defaults(func=cmd_verify_flights)

    p = sub.add_parser("prune-spots", help="套用排除規則到既有資料並補足精選（不連網）")
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--report")
    p.set_defaults(func=cmd_prune_spots)

    p = sub.add_parser("seed-wiki", help="由維基百科補簡介與缺漏念法（已有大點的縣）")
    p.add_argument("prefectures", nargs="+")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_wiki)

    p = sub.add_parser("build-bundles", help="data/ → web/public/bundles/")
    p.set_defaults(func=cmd_build_bundles)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
