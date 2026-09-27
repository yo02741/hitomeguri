"""data/ → web/public/bundles/（PLAN.md §4.2）。

- _index.json：各縣筆數與版本（內容雜湊），前端依此決定要載入哪些縣。
- map/{pref}.json：地圖用精簡資料。
- detail/{pref}.json：完整景點資料，點選景點時才載入。
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pipeline.models import FlightRoute, Specialty, Spot
from pipeline.paths import BUNDLES_DIR, FLIGHTS_JSON, SPECIALTIES_DIR, SPOTS_DIR


def _write(path: Path, data: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path


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
    cats = [t for t in s.get("tags", []) if not t.startswith("guide-")]
    if cats:
        entry["c"] = cats[0]
    return entry


def build(src: Path = SPOTS_DIR, dst: Path = BUNDLES_DIR) -> list[Path]:
    written = []
    index: dict[str, Any] = {"prefectures": {}}
    for path in sorted(src.glob("*.json")):
        pref = path.stem
        raw = json.loads(path.read_text(encoding="utf-8"))
        spots = [Spot.model_validate(s).model_dump(mode="json", exclude_none=True) for s in raw]
        published = [s for s in spots if s["status"] == "published"]
        version = hashlib.sha1(path.read_bytes()).hexdigest()[:10]
        written.append(_write(dst / "map" / f"{pref}.json", [map_entry(s) for s in published]))
        written.append(_write(dst / "detail" / f"{pref}.json", published))
        index["prefectures"][pref] = {
            "count": len(published),
            "featured": sum(1 for s in published if s["featured"]),
            "version": version,
        }
    written.append(_write(dst / "_index.json", index))
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
