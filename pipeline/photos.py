"""照片補齊（seed-photos）：沒有主照片的景點用維基條目的代表圖補；
夜景、冬景、全景改用 Wikidata 的專用欄位。

來源都是編輯者挑過的照片，不靠檔名猜：
- 主照片（只補沒有的）：日文 → 英文 → 中文維基條目的代表圖（pageimages，自由授權），
  分類看起來主體是人、警察、活動、店家、地圖等的不收（景點本身就是那類東西時不算，photo_stats.exempt）
- 夜景 P3451、冬景 P5252：有就用它（蓋掉依檔名找到的）
- 全景 P4291，沒有時空拍 P8592：放在 season_images.panorama（收集卡目前不用，全景卡用主照片）
data/seed/photo_exclude.json 列的檔案一律不用。
data/seed/photo_choices.json 是使用者在照片審核頁選的主照片（file 為 null 表示都不適合、不放照片），
一律照它。
"""

from __future__ import annotations

import json
from typing import Any

from pipeline.paths import SEED_DIR, SPOTS_DIR
from pipeline.photo_stats import (
    SpotPhotos,
    exempt,
    fetch_categories,
    fetch_claims,
    fetch_wiki_images,
    file_of,
    norm,
    subject_flags,
)
from pipeline.season_photos import EXCLUDED
from pipeline.sources import commons

USABLE_EXT = (".jpg", ".jpeg", ".png", ".webp")
VIEW_KEYS = {"P3451": "night", "P5252": "winter", "P4291": "panorama", "P8592": "panorama"}


def usable_file(name: str) -> bool:
    return name.lower().endswith(USABLE_EXT) and norm(name) not in EXCLUDED


def pick(cands: list[str], ok: Any) -> str | None:
    for f in cands:
        if usable_file(f) and ok(f):
            return norm(f)
    return None


def load_choices() -> dict[str, str | None]:
    path = SEED_DIR / "photo_choices.json"
    if not path.exists():
        return {}
    return {r["spot"]: r["file"] for r in json.loads(path.read_text(encoding="utf-8"))}


def seed_photos(prefs: list[str]) -> str:
    stats = {"main_added": 0, "night": 0, "winter": 0, "panorama": 0, "rejected": 0, "chosen": 0}
    choices = load_choices()
    lines = ["## 照片補齊（主照片、夜景・冬景・全景）", ""]
    for pref in prefs:
        path = SPOTS_DIR / f"{pref}.json"
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        rows = data["spots"] if isinstance(data, dict) else data
        by_qid: dict[str, dict[str, Any]] = {}
        sps: list[SpotPhotos] = []
        for s in rows:
            qid = (s.get("external_ids") or {}).get("wikidata")
            if not qid:
                continue
            imgs = s.get("images") or []
            main = file_of(imgs[0].get("source_url", "")) if imgs else None
            by_qid[qid] = s
            sps.append(SpotPhotos(qid, pref, s["name"]["ja"], s["name"].get("en") or "", main))
        if not sps:
            continue
        fetch_claims(sps)
        fetch_wiki_images(sps)
        need = [f for sp in sps if not sp.main for f in sp.wiki.values()]
        cats = fetch_categories([norm(f) for f in need]) if need else {}
        chosen: dict[str, dict[str, str]] = {}  # qid → {key: file}
        cleared = 0
        for sp in sps:
            s = by_qid[sp.id]
            pick_for: dict[str, str] = {}
            if sp.id in choices:
                if (c := choices[sp.id]) is None:
                    if s.get("images"):
                        s["images"] = []
                        stats["chosen"] += 1
                        cleared += 1
                elif norm(c) != sp.main:
                    pick_for["main"] = norm(c)
                    stats["chosen"] += 1
            elif not sp.main:
                # png 多半是地圖、空拍圖或古畫，主照片不收
                cands = [
                    sp.wiki[k]
                    for k in ("jawiki", "enwiki", "zhwiki")
                    if k in sp.wiki and not sp.wiki[k].lower().endswith(".png")
                ]

                def clean(
                    f: str,
                    sp: SpotPhotos = sp,
                    s: dict[str, Any] = s,
                    cats: dict[str, list[str]] = cats,
                ) -> bool:
                    flags = subject_flags(cats.get(norm(f), []), f"{sp.name} {sp.en}")
                    return not exempt(flags, sp.name, sp.en, s.get("tags") or [])

                if f := pick(cands, clean):
                    pick_for["main"] = f
                elif cands:
                    stats["rejected"] += 1
            for prop, key in VIEW_KEYS.items():
                if key in pick_for:
                    continue
                if f := pick(sp.views.get(prop, []), lambda _f: True):
                    pick_for[key] = f
            if pick_for:
                chosen[sp.id] = pick_for
        files = [f for d in chosen.values() for f in d.values()]
        infos = commons.image_info(files, width=960) if files else {}
        changed = cleared
        for qid, d in chosen.items():
            s = by_qid[qid]
            for key, f in d.items():
                info = infos.get(f)
                if not info:
                    continue
                img = {
                    "url": info.url,
                    "author": info.author,
                    "license": info.license,
                    "source_url": info.source_url,
                }
                # 原圖寬高：收集卡在顯示前決定直卡或橫卡
                if info.width and info.height:
                    img |= {"width": info.width, "height": info.height}
                if key == "main":
                    if not s.get("images"):
                        stats["main_added"] += 1
                    s["images"] = [img]
                else:
                    si = s.get("season_images") or {}
                    if si.get(key, {}).get("source_url") == img["source_url"]:
                        continue
                    si[key] = img
                    s["season_images"] = si
                    stats[key] += 1
                changed += 1
        if changed:
            text = json.dumps(data, ensure_ascii=False, indent=2)
            path.write_text(text + ("\n" if raw.endswith("\n") else ""), encoding="utf-8")
        lines.append(f"- {pref}：{changed} 處")
    lines[2:2] = [
        f"- 補上主照片：{stats['main_added']} 個景點（候選都被分類擋掉的 {stats['rejected']} 個）",
        f"- 照審核頁的選擇換掉或拿掉主照片：{stats['chosen']} 個景點",
        f"- 夜景改用 Wikidata 夜景欄位：{stats['night']}",
        f"- 冬景改用 Wikidata 冬景欄位：{stats['winter']}",
        f"- 全景（全景或空拍欄位）：{stats['panorama']}",
        "",
    ]
    return "\n".join(lines) + "\n"
