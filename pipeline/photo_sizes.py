"""景點照片的原圖寬高（seed-photo-sizes）。

收集卡的全景、特別全景、夜景照片鋪滿整張卡；照片是橫的（寬/高 ≥ 1.2）時
卡片做成橫卡（DESIGN.md §7.19a）。前端要在顯示前就知道直橫，所以寬高存在資料裡：
主照片（images）與季節照片（season_images）各記原圖的 width、height（Commons API
imageinfo 的 size）。新採的照片在 seed-region、seed-photos、seed-season-photos 就會記；
這個指令補齊既有資料。只改寬高有變的照片，沒有變更的縣不寫檔。
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

from pipeline.paths import SPOTS_DIR
from pipeline.sources import commons

SizeLookup = Callable[[list[str]], dict[str, tuple[int, int]]]


def _images(spot: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """景點的主照片與季節照片（照片記錄本身，改了就是改資料）"""
    yield from spot.get("images") or []
    yield from (spot.get("season_images") or {}).values()


def seed_photo_sizes(
    prefs: list[str],
    src: Path = SPOTS_DIR,
    lookup: SizeLookup | None = None,
    refresh: bool = False,
) -> str:
    """各縣景點照片補上原圖寬高。refresh=False 時已經有寬高的照片不再查。"""
    find = lookup or (lambda titles: commons.image_sizes(titles, batch=50))
    lines = ["## 照片原圖寬高", ""]
    total = {"filled": 0, "changed": 0, "missing": 0, "landscape": 0}
    for pref in prefs:
        path = src / f"{pref}.json"
        if not path.exists():
            continue
        raw = path.read_text(encoding="utf-8")
        spots: list[dict[str, Any]] = json.loads(raw)
        todo: list[tuple[dict[str, Any], str]] = []
        for s in spots:
            for img in _images(s):
                title = commons.file_title(img.get("source_url", ""))
                if title and (refresh or not (img.get("width") and img.get("height"))):
                    todo.append((img, title))
        sizes = find(sorted({t for _, t in todo})) if todo else {}
        filled = changed = missing = 0
        for img, title in todo:
            size = sizes.get(title)
            if not size:
                missing += 1
                continue
            w, h = size
            if img.get("width") == w and img.get("height") == h:
                continue
            if img.get("width") or img.get("height"):
                changed += 1
            else:
                filled += 1
            img["width"], img["height"] = w, h
        if filled or changed:
            text = json.dumps(spots, ensure_ascii=False, indent=2)
            path.write_text(text + ("\n" if raw.endswith("\n") else ""), encoding="utf-8")
        wide = sum(
            1
            for s in spots
            for img in _images(s)
            if img.get("width") and img.get("height") and img["width"] / img["height"] >= 1.2
        )
        total["filled"] += filled
        total["changed"] += changed
        total["missing"] += missing
        total["landscape"] += wide
        lines.append(
            f"- {pref}：查 {len(todo)} 張，補上 {filled}、更新 {changed}、"
            f"查不到 {missing}；橫的 {wide} 張"
        )
    lines[2:2] = [
        f"補上 {total['filled']} 張、更新 {total['changed']} 張、查不到 {total['missing']} 張；"
        f"橫的照片（寬/高 ≥ 1.2）共 {total['landscape']} 張。",
        "",
    ]
    return "\n".join(lines) + "\n"
