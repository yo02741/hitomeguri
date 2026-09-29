"""data/ → web/public/bundles/（PLAN.md §4.2）。

- _index.json：各縣筆數與版本（內容雜湊），前端依此決定要載入哪些縣。
- map/{pref}.json：地圖用精簡資料。
- detail/{pref}.json：完整景點資料，點選景點時才載入。
- packs/{key}.json：擴充包（全國一個檔，data/packs/ 組合而成）。
- search.json：全國景點搜尋索引（第一次搜尋時才載入）。
"""

from __future__ import annotations

import datetime
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from pipeline import config
from pipeline.models import (
    Festival,
    FlightRoute,
    Phrase,
    RailData,
    SeasonData,
    Specialty,
    Spot,
    TimedItem,
)
from pipeline.paths import (
    BUNDLES_DIR,
    FESTIVALS_DIR,
    FLIGHTS_JSON,
    PACKS_DIR,
    PHRASES_DIR,
    RAIL_DIR,
    SEASONS_JSON,
    SPECIALTIES_DIR,
    SPOTS_DIR,
    TIMED_DIR,
)


def _translations() -> dict[str, str]:
    """英文簡介的中文譯文（translate-summaries）：原文雜湊 → 譯文。"""
    from pipeline.translate import TRANSLATIONS_JSON, load_cache

    return {k: v["zh"] for k, v in load_cache().items()} if TRANSLATIONS_JSON.exists() else {}


def _translation_tag() -> bytes:
    """譯文更新時 bundle 版本也要變（瀏覽器才會重新下載）。"""
    from pipeline.translate import TRANSLATIONS_JSON

    return TRANSLATIONS_JSON.read_bytes() if TRANSLATIONS_JSON.exists() else b""


def with_translation(item: dict[str, Any], zh: dict[str, str]) -> dict[str, Any]:
    """英文簡介附上中文譯文（summary.text_zh），介面英文一行、中文一行。"""
    from pipeline.translate import key_of

    s = item.get("summary")
    if s and s.get("lang") == "en" and (t := zh.get(key_of(s["text"]))):
        s["text_zh"] = t
    return item


def _write(path: Path, data: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path


COMMONS_THUMB_PREFIX = "https://thumb.wikimedia.org/wikipedia/commons/thumb/"
MAP_THUMB_WIDTH = 250


def map_thumb(url: str) -> str | None:
    """地圖 hover 用小圖：Commons 縮圖寬度換成 250px、去掉追蹤參數，省略固定前綴縮小 bundle。"""
    base = url.split("?", 1)[0]
    if not base.startswith(COMMONS_THUMB_PREFIX) or not re.search(r"/\d+px-[^/]+$", base):
        # 原圖本來就小於縮圖寬度時 Commons 給原圖網址：直接用
        return base if base.startswith("https://upload.wikimedia.org/") else None
    thumb = re.sub(r"/\d+px-([^/]+)$", rf"/{MAP_THUMB_WIDTH}px-\1", base)
    return thumb[len(COMMONS_THUMB_PREFIX) :]


# 文化指定（世界遺產、國寶…）是屬性不是類型，分類時跳過；只有指定沒有類型時退回史跡／名勝
DESIGNATION_TAGS = {label for _, label, _ in config.HERITAGE_RULES}
DESIGNATION_FALLBACK = {"特別史跡": "史跡", "史跡": "史跡", "特別名勝": "名勝", "名勝": "名勝"}


FEATURED_KEYS = {"id", "n", "lat", "lng", "k", "f", "s", "c", "i"}


def spot_type(tags: list[str]) -> str | None:
    tags = [t for t in tags if not t.startswith("guide-")]
    for t in tags:
        if t not in DESIGNATION_TAGS:
            return t
    for t in tags:
        if t in DESIGNATION_FALLBACK:
            return DESIGNATION_FALLBACK[t]
    return None


def map_entry(s: dict[str, Any]) -> dict[str, Any]:
    name = s["name"]
    entry: dict[str, Any] = {
        "id": s["id"],
        "n": name["ja"],
        "z": name["zh_tw"],
        # 小數 5 位約 1 公尺，縮小 bundle
        "lat": round(s["location"]["lat"], 5),
        "lng": round(s["location"]["lng"], 5),
        "k": s["kind"],
        "f": 1 if s["featured"] else 0,
        "s": round(s["score"], 1),
    }
    if name.get("kana"):
        entry["h"] = name["kana"]
    if name.get("romaji"):
        entry["r"] = name["romaji"]
    if s.get("themes"):
        entry["t"] = s["themes"]
    if cat := spot_type(s.get("tags", [])):
        entry["c"] = cat
    if s.get("images") and (thumb := map_thumb(s["images"][0]["url"])):
        entry["i"] = thumb
    return entry


def build(src: Path = SPOTS_DIR, dst: Path = BUNDLES_DIR) -> list[Path]:
    written = []
    index: dict[str, Any] = {"prefectures": {}}
    featured: dict[str, list[dict[str, Any]]] = {}
    search: list[list[Any]] = []
    zh = _translations()
    tag = _translation_tag()
    for path in sorted(src.glob("*.json")):
        pref = path.stem
        raw = json.loads(path.read_text(encoding="utf-8"))
        spots = [
            with_translation(Spot.model_validate(s).model_dump(mode="json", exclude_none=True), zh)
            for s in raw
        ]
        published = [s for s in spots if s["status"] == "published"]
        version = hashlib.sha1(path.read_bytes() + tag).hexdigest()[:10]
        # 地圖 bundle 只放大點（主題層暫停，PLAN.md §5）；主題小店仍在 detail
        majors = [map_entry(s) for s in published if s["kind"] == "major"]
        written.append(_write(dst / "map" / f"{pref}.json", majors))
        # 首頁用：只留地圖顯示需要的欄位（名稱、座標、類型、照片）
        featured[pref] = [
            {k: v for k, v in e.items() if k in FEATURED_KEYS} for e in majors if e["f"] == 1
        ]
        written.append(_write(dst / "detail" / f"{pref}.json", published))
        search += [search_entry(pref, e) for e in majors]
        index["prefectures"][pref] = {
            "count": len(published),
            "featured": sum(1 for s in published if s["featured"]),
            "version": version,
        }
    written.append(_write(dst / "search.json", search))
    index["search"] = hashlib.sha1(json.dumps(search).encode()).hexdigest()[:10]
    packs = build_packs(dst / "packs")
    index["packs"] = {key: meta for key, (_, meta) in packs.items()}
    written += [path for path, _ in packs.values()]
    rail = build_rail(dst / "rail")
    index["rail"] = {pref: meta for pref, (_, meta) in rail.items()}
    written += [path for path, _ in rail.values()]
    festivals = build_festivals(dst / "festivals")
    index["festivals"] = {pref: meta for pref, (_, meta) in festivals.items()}
    written += [path for path, _ in festivals.values()]
    timed = build_timed()
    written.append(_write(dst / "timed.json", timed))
    index["timed"] = {
        "count": len(timed),
        "version": hashlib.sha1(json.dumps(timed).encode()).hexdigest()[:10],
    }
    written.append(_write(dst / "_index.json", index))
    # 首頁只需要各縣精選：一個小檔，不必先載入全部縣的地圖 bundle
    written.append(_write(dst / "featured.json", featured))
    written += build_extras(dst)
    return written


def search_entry(pref: str, e: dict[str, Any]) -> list[Any]:
    """[id, 縣, 日文名, 假名, 繁中名, 羅馬拼音, 分數]：陣列比物件省一半大小。

    繁中名與日文名相同時為空字串。
    """
    zh = e.get("z", "")
    zh = "" if zh == e["n"] else zh
    return [e["id"], pref, e["n"], e.get("h", ""), zh, e.get("r", ""), e["s"]]


def _read(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def pack_items_pokemon(src: Path = PACKS_DIR) -> list[dict[str, Any]]:
    """寶可夢擴充包：人孔蓋（g=lid）、寶可夢中心（center）、寶可夢商店（store）。"""
    items: list[dict[str, Any]] = []
    for r in _read(src / "pokefuta.json"):
        items.append({
            "id": r["id"], "g": "lid", "p": r["prefecture"], "n": r["municipality"],
            "lat": round(r["location"]["lat"], 5), "lng": round(r["location"]["lng"], 5),
            "a": r.get("address") or None,
            "pk": [[m["dex"], m["ja"]] for m in r.get("pokemon", [])],
            "u": r["sources"][0]["url"],
        })  # fmt: skip
    for r in _read(src / "pokecen.json"):
        items.append({
            "id": r["id"], "g": r["kind"], "p": r["prefecture"], "n": r["name"]["ja"],
            "lat": round(r["location"]["lat"], 5), "lng": round(r["location"]["lng"], 5),
            "a": r.get("address") or None,
            "u": r.get("website") or r["sources"][0]["url"],
        })  # fmt: skip
    return [{k: v for k, v in it.items() if v not in (None, [])} for it in items]


PACK_BUILDERS = {"pokemon": pack_items_pokemon}


def build_packs(dst: Path) -> dict[str, tuple[Path, dict[str, Any]]]:
    """擴充包 bundle；回傳 {key: (路徑, 索引資訊)}，沒有資料的擴充包不輸出。"""
    out = {}
    for key, builder in PACK_BUILDERS.items():
        items = sorted(builder(), key=lambda it: it["id"])
        if not items:
            continue
        body = json.dumps(items, ensure_ascii=False, separators=(",", ":"))
        version = hashlib.sha1(body.encode()).hexdigest()[:10]
        out[key] = (_write(dst / f"{key}.json", items), {"count": len(items), "version": version})
    return out


def build_rail(dst: Path) -> dict[str, tuple[Path, dict[str, Any]]]:
    """鐵路路線圖層：一縣一檔（打開鐵路圖層時才載入）。欄位縮寫：n 名稱、e 英文、c 顏色、
    k 種類、o 營運者、g 線段座標；車站 n、e、lat、lng。"""
    out = {}
    for path in sorted(RAIL_DIR.glob("*.json")) if RAIL_DIR.exists() else []:
        data = RailData.model_validate_json(path.read_text(encoding="utf-8"))
        body = {
            "lines": [
                {k: v for k, v in {
                    "n": x.name, "e": x.name_en, "c": x.colour, "k": x.kind,
                    "o": x.operator, "g": x.coords,
                }.items() if v is not None}
                for x in data.lines
            ],
            "stations": [
                {k: v for k, v in {
                    "n": st.name, "e": st.name_en, "lat": st.lat, "lng": st.lng,
                }.items() if v is not None}
                for st in data.stations
            ],
        }  # fmt: skip
        version = hashlib.sha1(path.read_bytes()).hexdigest()[:10]
        out[path.stem] = (_write(dst / path.name, body), {"version": version})
    return out


def build_festivals(dst: Path) -> dict[str, tuple[Path, dict[str, Any]]]:
    """深度探索「祭典」：一縣一檔（開深度探索頁時才載入）；回傳 {縣: (路徑, 索引資訊)}。"""
    out = {}
    zh = _translations()
    tag = _translation_tag()
    for path in sorted(FESTIVALS_DIR.glob("*.json")) if FESTIVALS_DIR.exists() else []:
        raw = json.loads(path.read_text(encoding="utf-8"))
        items = [
            with_translation(
                Festival.model_validate(f).model_dump(mode="json", exclude_none=True), zh
            )
            for f in raw
        ]
        if not items:
            continue
        version = hashlib.sha1(path.read_bytes() + tag).hexdigest()[:10]
        out[path.stem] = (_write(dst / path.name, items), {"count": len(items), "version": version})
    return out


def build_timed(src: Path = TIMED_DIR, today: str | None = None) -> list[dict[str, Any]]:
    """期間限定：還沒過期的（valid_to ≥ 今天），依結束日排序。前端也會再依當天日期過濾。"""
    today = today or datetime.date.today().isoformat()
    out: list[dict[str, Any]] = []
    for path in sorted(src.glob("*.json")) if src.exists() else []:
        for x in json.loads(path.read_text(encoding="utf-8")):
            item = TimedItem.model_validate(x)
            if item.valid_to >= today:
                out.append(item.model_dump(mode="json", exclude_none=True, exclude={"updated_at"}))
    return sorted(out, key=lambda x: (x["valid_to"], x["id"]))


def load_phrases(src: Path = PHRASES_DIR) -> list[dict[str, Any]]:
    """旅前準備的會話（data/phrases/common.json、themes/*.json），依 id 排序；id 不可重複。"""
    out: list[dict[str, Any]] = []
    for path in sorted(src.rglob("*.json")) if src.exists() else []:
        for p in json.loads(path.read_text(encoding="utf-8")):
            out.append(Phrase.model_validate(p).model_dump(mode="json", exclude_none=True))
    ids = [p["id"] for p in out]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        raise ValueError(f"phrase id 重複：{sorted(dup)}")
    return sorted(out, key=lambda p: p["id"])


def build_extras(dst: Path = BUNDLES_DIR) -> list[Path]:
    """地區特色（全部縣一個檔）、旅前準備會話、季節平年值、直飛航線（只含已驗證，§5.2b）。"""
    specs: list[dict[str, Any]] = []
    zh = _translations()
    for path in sorted(SPECIALTIES_DIR.glob("*.json")) if SPECIALTIES_DIR.exists() else []:
        for s in json.loads(path.read_text(encoding="utf-8")):
            spec = Specialty.model_validate(s).model_dump(mode="json", exclude_none=True)
            specs.append(with_translation(spec, zh))
    flights: list[dict[str, Any]] = []
    if FLIGHTS_JSON.exists():
        for r in json.loads(FLIGHTS_JSON.read_text(encoding="utf-8")):
            route = FlightRoute.model_validate(r)
            if route.verified:
                flights.append(route.model_dump(mode="json", exclude_none=True))
    out = [
        _write(dst / "specialties.json", specs),
        _write(dst / "flights.json", flights),
        _write(dst / "phrases.json", load_phrases()),
    ]
    if SEASONS_JSON.exists():
        seasons = SeasonData.model_validate_json(SEASONS_JSON.read_text(encoding="utf-8"))
        out.append(_write(dst / "seasons.json", seasons.model_dump(mode="json")))
    return out
