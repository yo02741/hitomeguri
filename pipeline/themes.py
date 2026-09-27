"""主題小店（PLAN.md §5.2）：seed-themes 指令。

OSM 撈茶、酒、拉麵、溫泉、寶可夢中心 → kind="theme" 景點，寫進 data/spots/{pref}.json。
- 掛了 wikidata 且對得到既有大點的，只把主題加到大點上。
- 寺社大點加上 goshuin 主題（授與與限定款的細節之後由 agent 查官網補進 goshuin 欄位）。
- 每縣每主題有上限，依資料完整度（名稱讀音、網站、營業時間等）排序。
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any

from pipeline import config, geo
from pipeline.kana import is_kana, is_romaji, normalize_kana, romaji_with_spacing
from pipeline.major import log, nearest_stations, station_index
from pipeline.models import ExternalIds, LocalizedName, Location, Source, Spot
from pipeline.paths import SPOTS_DIR
from pipeline.sources import osm
from pipeline.sources.osm import OsmElement

QUALITY_KEYS = ("website", "opening_hours", "name:en", "name:ja-Hira", "name:ja-Latn", "wikidata",
                "phone", "addr:full", "brand")  # fmt: skip
GOSHUIN_CATEGORIES = {"神社", "寺院"}


def quality(el: OsmElement) -> float:
    return sum(1 for k in QUALITY_KEYS if el.tags.get(k)) + (0.5 if el.tags.get("name:zh") else 0)


def _names(t: dict[str, str]) -> tuple[LocalizedName, str | None]:
    ja = t.get("name:ja") or t["name"]
    kana, src = None, None
    for key in ("name:ja-Hira", "name:ja_kana", "name:ja-Kana"):
        if t.get(key) and is_kana(t[key]):
            kana, src = normalize_kana(t[key]), "osm"
            break
    en = t.get("name:en")
    romaji = next((t[k] for k in ("name:ja-Latn", "name:ja_rm") if is_romaji(t.get(k))), None)
    if not romaji and kana:
        romaji = romaji_with_spacing(kana, en)
    zh = t.get("name:zh-Hant") or t.get("name:zh_TW") or t.get("name:zh") or ja
    return LocalizedName(ja=ja, kana=kana, romaji=romaji, zh_tw=zh, en=en), src


def theme_spot(pref: str, theme: str, el: OsmElement, stations, today: str) -> Spot:  # noqa: ANN001
    kind, num = el.osm_id.split("/")
    name, kana_source = _names(el.tags)
    from pipeline.major import Draft

    d = Draft(key=el.osm_id, lat=el.lat, lng=el.lng, osm_els=[el])
    return Spot(
        id=f"osm-{kind}-{num}",
        name=name,
        kana_source=kana_source,
        location=Location(lat=round(el.lat, 6), lng=round(el.lng, 6)),
        prefecture=pref,
        city=el.tags.get("addr:city"),
        kind="theme",
        themes=[theme],
        tags=[],
        featured=False,
        score=round(quality(el), 2),
        nearest_stations=nearest_stations(d, stations) or None,
        external_ids=ExternalIds(osm=el.osm_id, wikidata=el.tags.get("wikidata")),
        sources=[Source(url=el.url, fetched_at=today)],
        updated_at=today,
    )


def seed_themes(pref: str) -> str:
    today = dt.date.today().isoformat()
    path = SPOTS_DIR / f"{pref}.json"
    if not path.exists():
        raise SystemExit(f"{path} 不存在：先跑 seed-region {pref}")
    spots: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
    majors = [s for s in spots if s["kind"] == "major"]
    old_theme = {s["id"]: s for s in spots if s["kind"] == "theme"}
    by_qid = {
        s["external_ids"].get("wikidata"): s for s in majors if s["external_ids"].get("wikidata")
    }
    by_osm = {s["external_ids"].get("osm"): s for s in majors if s["external_ids"].get("osm")}

    for s in majors:  # 重新計算大點上的主題：保留種子給的，其餘重算
        s["themes"] = [t for t in s.get("themes", []) if t not in osm.THEME_FILTERS]
        if set(s.get("tags", [])) & GOSHUIN_CATEGORIES and "goshuin" not in s["themes"]:
            s["themes"].append("goshuin")

    log(f"[{pref}] OSM 主題小店…")
    found = osm.themed(geo.iso_code(pref))
    stations = station_index(pref)
    new: dict[str, dict[str, Any]] = {}
    counts: dict[str, int] = {}
    attached: dict[str, int] = {}
    for theme, els in found.items():
        els = sorted(els, key=lambda e: (-quality(e), e.osm_id))
        kept = 0
        for el in els:
            major = by_qid.get(el.tags.get("wikidata")) or by_osm.get(el.osm_id)
            if major:
                if theme not in major["themes"]:
                    major["themes"].append(theme)
                    attached[theme] = attached.get(theme, 0) + 1
                continue
            if kept >= config.THEME_SPOTS_PER_PREF.get(theme, 200):
                continue
            spot = theme_spot(pref, theme, el, stations, today)
            sid = spot.id
            if sid in new:  # 同一家店屬於多個主題
                if theme not in new[sid]["themes"]:
                    new[sid]["themes"].append(theme)
                continue
            data = spot.model_dump(mode="json", exclude_none=True)
            prev = old_theme.get(sid)
            if prev:
                for k in ("summary_zh", "best_months", "stay_minutes", "verification"):
                    if prev.get(k) and not data.get(k):
                        data[k] = prev[k]
                if prev.get("kana_source") == "llm" and not data["name"].get("kana"):
                    data["name"].update(
                        {k: prev["name"][k] for k in ("kana", "romaji") if k in prev["name"]}
                    )
                    data["kana_source"] = "llm"
            new[sid] = data
            kept += 1
        counts[theme] = kept

    for s in [*majors, *new.values()]:
        s["themes"] = sorted(set(s["themes"]))
    out = sorted(majors + list(new.values()), key=lambda s: s["id"])
    out = [Spot.model_validate(s).model_dump(mode="json", exclude_none=True) for s in out]
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    goshuin = sum(1 for s in majors if "goshuin" in s["themes"])
    lines = [f"## {pref} 主題", "", "| 主題 | 新增小店 | 加到大點 |", "|---|---|---|"]
    for theme in osm.THEME_FILTERS:
        lines.append(f"| {theme} | {counts.get(theme, 0)} | {attached.get(theme, 0)} |")
    lines += [f"| goshuin（寺社大點） | — | {goshuin} |", ""]
    return "\n".join(lines)
