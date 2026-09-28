"""data/ → web/public/bundles/（PLAN.md §4.2）。

- _index.json：各縣筆數與版本（內容雜湊），前端依此決定要載入哪些縣。
- map/{pref}.json：地圖用精簡資料。
- detail/{pref}.json：完整景點資料，點選景點時才載入。
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from pipeline import config
from pipeline.models import FlightRoute, Specialty, Spot
from pipeline.paths import BUNDLES_DIR, FLIGHTS_JSON, SPECIALTIES_DIR, SPOTS_DIR


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
        "lat": s["location"]["lat"],
        "lng": s["location"]["lng"],
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
    for path in sorted(src.glob("*.json")):
        pref = path.stem
        raw = json.loads(path.read_text(encoding="utf-8"))
        spots = [Spot.model_validate(s).model_dump(mode="json", exclude_none=True) for s in raw]
        published = [s for s in spots if s["status"] == "published"]
        version = hashlib.sha1(path.read_bytes()).hexdigest()[:10]
        # 地圖 bundle 只放大點（主題層暫停，PLAN.md §5）；主題小店仍在 detail
        majors = [map_entry(s) for s in published if s["kind"] == "major"]
        written.append(_write(dst / "map" / f"{pref}.json", majors))
        featured[pref] = [e for e in majors if e["f"] == 1]
        written.append(_write(dst / "detail" / f"{pref}.json", published))
        index["prefectures"][pref] = {
            "count": len(published),
            "featured": sum(1 for s in published if s["featured"]),
            "version": version,
        }
    written.append(_write(dst / "_index.json", index))
    # 首頁只需要各縣精選：一個小檔，不必先載入全部縣的地圖 bundle
    written.append(_write(dst / "featured.json", featured))
    written += build_extras(dst)
    return written


def build_extras(dst: Path = BUNDLES_DIR) -> list[Path]:
    """地區特色（全部縣一個檔）與直飛航線（只含已驗證，PLAN.md §5.2b）。"""
    specs: list[dict[str, Any]] = []
    for path in sorted(SPECIALTIES_DIR.glob("*.json")) if SPECIALTIES_DIR.exists() else []:
        for s in json.loads(path.read_text(encoding="utf-8")):
            specs.append(Specialty.model_validate(s).model_dump(mode="json", exclude_none=True))
    flights: list[dict[str, Any]] = []
    if FLIGHTS_JSON.exists():
        for r in json.loads(FLIGHTS_JSON.read_text(encoding="utf-8")):
            route = FlightRoute.model_validate(r)
            if route.verified:
                flights.append(route.model_dump(mode="json", exclude_none=True))
    return [_write(dst / "specialties.json", specs), _write(dst / "flights.json", flights)]
