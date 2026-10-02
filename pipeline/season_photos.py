"""收集卡的季節、夜景照片（DESIGN.md §7.19a）。

從景點的 Commons 分類（Wikidata P373）找春夏秋冬與夜晚的照片。

1. 子分類名稱有季節字樣的（例：Kiyomizu-dera in autumn、Cherry blossoms at …）→ 取裡面最合適的一張；
2. 沒有就在主分類的檔名裡找季節字樣。
「最合適」：JPEG、橫幅（寬高比 1.2–2.1）、寬 1000px 以上，取像素最多的。
照片一律附作者、授權、Commons 頁面網址（卡片背面顯示）。只動 data/spots 的 season_images 欄位。
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from pipeline.http import get_json
from pipeline.paths import SPOTS_DIR
from pipeline.sources import commons, wikidata

API = commons.API
SEASONS = ("spring", "summer", "autumn", "winter", "night")
SEASON_RE: dict[str, re.Pattern[str]] = {
    "night": re.compile(
        r"\bnights?\b|\bevening\b|illuminat|light[ _-]?up|ライトアップ|夜景|夜", re.I
    ),
    "spring": re.compile(r"cherry[ _-]?blossoms?|sakura|\bspring\b|桜|春", re.I),
    "summer": re.compile(r"\bsummer\b|夏", re.I),
    "autumn": re.compile(r"\bautumn\b|fall[ _]foliage|\bfall\b|紅葉|momiji|秋", re.I),
    "winter": re.compile(r"\bwinter\b|\bsnow(y|fall)?\b|冬|雪", re.I),
}
# 季節字樣但不是季節：溫泉（hot spring）、春日大社、秋葉原、雪舟…
NOT_SEASON = re.compile(
    r"hot[ _]springs?|onsen|kasuga|akihabara|akiba|sesshu|雪舟|春日|秋葉|springs\b", re.I
)


def season_of(title: str) -> str | None:
    """標題屬於哪一季或夜景；「Autumn illumination」這種算夜景（夜景優先）。"""
    if NOT_SEASON.search(title):
        return None
    for s in ("night", *SEASONS[:4]):
        if SEASON_RE[s].search(title):
            return s
    return None


def commons_categories(qids: list[str]) -> dict[str, str]:
    """Wikidata P373（Commons category）"""
    out: dict[str, str] = {}
    for i in range(0, len(qids), 200):
        values = " ".join(f"wd:{q}" for q in qids[i : i + 200])
        q = f"SELECT ?item ?cat WHERE {{ VALUES ?item {{ {values} }} ?item wdt:P373 ?cat }}"
        rows = wikidata.sparql(q)
        for r in rows:
            out[r["item"]["value"].rsplit("/", 1)[-1]] = r["cat"]["value"]
    return out


def subcategories(cat: str) -> list[str]:
    data = get_json(
        API,
        params={
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{cat}",
            "cmtype": "subcat",
            "cmlimit": 500,
            "format": "json",
        },
        min_interval=0.5,
    )
    members = data.get("query", {}).get("categorymembers", [])
    return [m["title"].removeprefix("Category:") for m in members]


def files_in(cat: str, limit: int = 50) -> list[dict[str, Any]]:
    """分類裡的檔案（含尺寸、網址、授權）"""
    data = get_json(
        API,
        params={
            "action": "query",
            "generator": "categorymembers",
            "gcmtitle": f"Category:{cat}",
            "gcmtype": "file",
            "gcmlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": 960,
            "format": "json",
        },
        min_interval=0.5,
    )
    out = []
    for page in data.get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [None])[0]
        if info:
            out.append({"title": page["title"].removeprefix("File:"), **info})
    return out


def best(files: list[dict[str, Any]], exclude: set[str]) -> dict[str, Any] | None:
    ok = [
        f
        for f in files
        if f.get("mime") == "image/jpeg"
        and f["title"] not in exclude
        and f.get("width", 0) >= 1000
        and 1.2 <= f["width"] / max(f.get("height", 1), 1) <= 2.1
    ]
    return max(ok, key=lambda f: f["width"] * f["height"], default=None)


def to_image(f: dict[str, Any]) -> dict[str, str]:
    meta = f.get("extmetadata", {})
    author = commons._plain(meta.get("Artist", {}).get("value", "")) or "不明"  # noqa: SLF001
    lic = commons._plain(meta.get("LicenseShortName", {}).get("value", "")) or "不明"  # noqa: SLF001
    return {
        "url": f.get("thumburl") or f["url"],
        "author": author[:120],
        "license": lic,
        "source_url": f.get("descriptionurl", ""),
    }


def free_license(img: dict[str, str]) -> bool:
    lic = img["license"].lower()
    free = any(k in lic for k in ("cc by", "cc0", "public domain", "pd"))
    return free and "nc" not in re.split(r"[\s-]", lic)


def find_season_photos(cat: str, main_file: str | None) -> dict[str, dict[str, str]]:
    found: dict[str, dict[str, str]] = {}
    used = {main_file} if main_file else set()
    subs = subcategories(cat)
    for s in SEASONS:
        for sub in subs:
            if season_of(sub) != s:
                continue
            f = best(files_in(sub), used)
            if f and free_license(img := to_image(f)):
                found[s] = img
                used.add(f["title"])
                break
    missing = [s for s in SEASONS if s not in found]
    if missing:
        files = files_in(cat, 500)
        for s in missing:
            f = best([x for x in files if season_of(x["title"]) == s], used)
            if f and free_license(img := to_image(f)):
                found[s] = img
                used.add(f["title"])
    return found


def _main_file(spot: dict[str, Any]) -> str | None:
    src = (spot.get("images") or [{}])[0].get("source_url", "")
    return src.rsplit("File:", 1)[-1].replace("_", " ") if "File:" in src else None


def seed_season_photos(prefs: list[str], min_score: float = 70, refresh: bool = False) -> str:
    lines = ["## 收集卡季節照片", ""]
    today = date.today().isoformat()
    total = 0
    for pref in prefs:
        path: Path = SPOTS_DIR / f"{pref}.json"
        spots: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
        targets = [
            s
            for s in spots
            if s.get("kind") == "major"
            and s.get("status") == "published"
            and s.get("score", 0) >= min_score
            and s.get("external_ids", {}).get("wikidata")
            and (refresh or "season_images" not in s)
        ]
        cats = commons_categories([s["external_ids"]["wikidata"] for s in targets])
        n = 0
        for s in targets:
            cat = cats.get(s["external_ids"]["wikidata"])
            if not cat:
                continue
            try:
                photos = find_season_photos(cat, _main_file(s))
            except Exception as e:  # 一筆失敗不影響其他
                lines.append(f"- {pref} {s['name']['ja']}：{e}")
                continue
            s["season_images"] = photos
            if photos:
                n += 1
                s["updated_at"] = today
        path.write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        lines.append(f"- {pref}：{len(targets)} 筆查詢，{n} 筆找到季節照片")
        total += n
    lines.insert(2, f"共 {total} 筆景點有季節照片（分數 ≥ {min_score}）。")
    return "\n".join(lines)
