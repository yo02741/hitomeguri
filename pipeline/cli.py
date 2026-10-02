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
    from pipeline.geo import pref_slugs
    from pipeline.specialties import flight_candidates, seed_specialties

    prefs = args.prefectures or pref_slugs()
    _emit(seed_specialties(prefs) + "\n" + flight_candidates(), args.report)
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
    _emit("\n".join(prune_spots(p, args.wikidata) for p in prefs), args.report)
    return 0


def cmd_seed_season_photos(args: argparse.Namespace) -> int:
    from pipeline.paths import SPOTS_DIR
    from pipeline.season_photos import seed_season_photos

    prefs = args.prefectures or sorted(p.stem for p in SPOTS_DIR.glob("*.json"))
    _emit(seed_season_photos(prefs, args.min_score, args.refresh), args.report)
    return 0


def cmd_seed_pokefuta(args: argparse.Namespace) -> int:
    from pipeline.packs import seed_pokefuta

    _emit(seed_pokefuta(args.prefectures or None), args.report)
    return 0


def cmd_seed_pokecen(args: argparse.Namespace) -> int:
    from pipeline.packs import seed_pokecen

    _emit(seed_pokecen(), args.report)
    return 0


def cmd_seed_rail(args: argparse.Namespace) -> int:
    from pipeline.geo import pref_slugs
    from pipeline.rail import seed_rail

    _emit(seed_rail(args.prefectures or pref_slugs()), args.report)
    return 0


def cmd_seed_official(args: argparse.Namespace) -> int:
    from pipeline.major import OFFICIAL_SOURCES
    from pipeline.official import seed_official

    _emit(seed_official(args.prefectures or sorted(OFFICIAL_SOURCES)), args.report)
    return 0


def cmd_translate_summaries(args: argparse.Namespace) -> int:
    from pipeline.translate import translate_summaries

    _emit(translate_summaries(args.limit), args.report)
    return 0


def cmd_seed_festivals(args: argparse.Namespace) -> int:
    from pipeline.festivals import seed_festivals
    from pipeline.geo import pref_slugs

    _emit(seed_festivals(args.prefectures or pref_slugs()), args.report)
    return 0


def cmd_seed_seasons(args: argparse.Namespace) -> int:
    from pipeline.seasons import seed_seasons

    _emit(seed_seasons(), args.report)
    return 0


def cmd_harvest_timed(args: argparse.Namespace) -> int:
    from pipeline.timed import harvest_timed

    _emit(harvest_timed(), args.report)
    return 0


def cmd_seed_castles(args: argparse.Namespace) -> int:
    from pipeline.pack_castles import seed_castles

    _emit(seed_castles(), args.report)
    return 0


def cmd_seed_shinise(args: argparse.Namespace) -> int:
    from pipeline.pack_shinise import seed_shinise

    _emit(seed_shinise(), args.report)
    return 0


def cmd_seed_chara(args: argparse.Namespace) -> int:
    from pipeline.pack_chara import seed_chara

    _emit(seed_chara(), args.report)
    return 0


def cmd_validate_data(args: argparse.Namespace) -> int:
    from pipeline.validate import report, validate

    res = validate(bundles=not args.no_bundles)
    _emit(report(res), args.report)
    return 0 if res.ok else 1


def cmd_diff_report(args: argparse.Namespace) -> int:
    from pipeline.diff_report import diff_report

    _emit(diff_report(args.base), args.report)
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

    p = sub.add_parser(
        "seed-specialties", help="地區特色（郷土料理、維基分類、種子）與直飛航線候選"
    )
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_specialties)

    p = sub.add_parser("verify-flights", help="以 Claude + 網頁搜尋驗證台灣直飛航線")
    p.add_argument("--report")
    p.set_defaults(func=cmd_verify_flights)

    p = sub.add_parser("prune-spots", help="套用排除規則到既有資料並補足精選")
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--wikidata", action="store_true", help="重新查 Wikidata 類型（要連網）")
    p.add_argument("--report")
    p.set_defaults(func=cmd_prune_spots)

    p = sub.add_parser("seed-season-photos", help="收集卡的季節照片：Commons 分類裡春夏秋冬的照片")
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--min-score", type=float, default=70, help="只查分數以上的景點")
    p.add_argument("--refresh", action="store_true", help="已經查過的也重查")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_season_photos)

    p = sub.add_parser("seed-wiki", help="由維基百科補簡介與缺漏念法（已有大點的縣）")
    p.add_argument("prefectures", nargs="+")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_wiki)

    p = sub.add_parser("seed-pokefuta", help="擴充包：寶可夢人孔蓋（ポケふた）→ data/packs/")
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_pokefuta)

    p = sub.add_parser("seed-pokecen", help="擴充包：寶可夢中心與商店（OSM 全國）→ data/packs/")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_pokecen)

    for name, func, desc in [
        (
            "seed-castles",
            cmd_seed_castles,
            "擴充包：日本100名城・続日本100名城（維基）→ data/packs/",
        ),
        (
            "seed-shinise",
            cmd_seed_shinise,
            "擴充包：老舖（香舖、和菓子、茶舖）與茶屋 → data/packs/",
        ),
        ("seed-chara", cmd_seed_chara, "擴充包：角色商店（OSM 全國）→ data/packs/"),
    ]:
        p = sub.add_parser(name, help=desc)
        p.add_argument("prefectures", nargs="*", help="不使用（全國一次抓）")
        p.add_argument("--report")
        p.set_defaults(func=func)

    p = sub.add_parser("seed-rail", help="鐵路路線圖層：OSM 路線與車站 → data/rail/")
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_rail)

    p = sub.add_parser("seed-official", help="縣官方觀光網站景點清單 → data/seed/official/")
    p.add_argument("prefectures", nargs="*", help="省略時處理有官方網站來源的全部縣")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_official)

    p = sub.add_parser("translate-summaries", help="英文簡介翻成繁體中文 → data/translations/")
    p.add_argument("--limit", type=int, help="只翻前 N 筆（先小量驗證）")
    p.add_argument("--report")
    p.set_defaults(func=cmd_translate_summaries)

    p = sub.add_parser("seed-festivals", help="祭典：日文維基「{縣}の祭り」→ data/festivals/")
    p.add_argument("prefectures", nargs="*", help="省略時處理全部縣")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_festivals)

    p = sub.add_parser("seed-seasons", help="季節：氣象廳生物季節平年值 → data/seasons.json")
    p.add_argument("prefectures", nargs="*", help="不使用（全國一次抓）")
    p.add_argument("--report")
    p.set_defaults(func=cmd_seed_seasons)

    p = sub.add_parser("harvest-timed", help="期間限定：氣象廳本季觀測 → data/timed/")
    p.add_argument("prefectures", nargs="*", help="不使用（全國一次抓）")
    p.add_argument("--report")
    p.set_defaults(func=cmd_harvest_timed)

    p = sub.add_parser(
        "validate-data", help="檢查 data/ 的格式、schema、來源與禁用詞，並試建 bundle"
    )
    p.add_argument("--no-bundles", action="store_true", help="不試建 bundle")
    p.add_argument("--report")
    p.set_defaults(func=cmd_validate_data)

    p = sub.add_parser("diff-report", help="data/ 和基準分支比較的變更報告（PR 描述用）")
    p.add_argument("--base", default="origin/main")
    p.add_argument("--report")
    p.set_defaults(func=cmd_diff_report)

    p = sub.add_parser("build-bundles", help="data/ → web/public/bundles/")
    p.set_defaults(func=cmd_build_bundles)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
