"""照片審核圖（photo-review）：精選景點裡主照片有疑慮的，把主照片與別張候選拼成一張對照圖。

對象：精選景點、有主照片，且（主照片的分類看起來主體不是景點，或兩個以上維基條目選了同一張別的）。
候選順序：A 現在的主照片 → 維基條目共同選的 → 日英中維基條目的代表圖
→ Wikidata P18 的其他張，最多 4 張。
輸出 reports/photo-review/<QID>.jpg（每格 360×270，左上角是字母）
與 review.json（每格的檔名、出處）。
審核頁（Artifact）用這些圖給使用者選；選的結果由 apply 寫回 data/spots。不改 data/。
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from pipeline.http import _throttle, client
from pipeline.paths import SPOTS_DIR
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
from pipeline.photos import usable_file
from pipeline.sources import commons

TILE_W, TILE_H, GAP = 360, 270, 6
LETTERS = "ABCD"


def candidates(sp: SpotPhotos) -> list[tuple[str, str]]:
    """(檔名, 出處)；第一個是現在的主照片"""
    out: list[tuple[str, str]] = [(sp.main or "", "現在")]
    counts: dict[str, int] = {}
    for f in sp.wiki.values():
        counts[norm(f)] = counts.get(norm(f), 0) + 1
    for f, n in counts.items():
        if n >= 2:
            out.append((f, "維基條目共同"))
    for site, label in (("jawiki", "日文維基"), ("enwiki", "英文維基"), ("zhwiki", "中文維基")):
        if site in sp.wiki:
            out.append((norm(sp.wiki[site]), label))
    out += [(f, "Wikidata") for f in sp.p18[1:]]
    seen: set[str] = set()
    uniq = []
    for f, src in out:
        if f and f not in seen and (src == "現在" or usable_file(f)):
            seen.add(f)
            uniq.append((f, src))
    return uniq[:4]


def sheet(images: list[bytes]) -> bytes:
    from PIL import Image, ImageDraw, ImageFont, ImageOps

    n = len(images)
    canvas = Image.new("RGB", (n * TILE_W + (n - 1) * GAP, TILE_H), (40, 40, 44))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=22)
    for i, data in enumerate(images):
        x = i * (TILE_W + GAP)
        try:
            im = Image.open(io.BytesIO(data)).convert("RGB")
            canvas.paste(ImageOps.fit(im, (TILE_W, TILE_H)), (x, 0))
        except Exception:
            draw.rectangle([x, 0, x + TILE_W, TILE_H], fill=(90, 90, 96))
        draw.rectangle([x, 0, x + 34, 34], fill=(20, 20, 24))
        draw.text((x + 10, 5), LETTERS[i], fill=(255, 255, 255), font=font)
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=72, optimize=True)
    return buf.getvalue()


def download(url: str) -> bytes:
    _throttle("upload.wikimedia.org", 0.3)
    r = client().get(url, headers={"Accept": "image/*"})
    r.raise_for_status()
    return r.content


def photo_review(prefs: list[str], out_dir: Path, featured: bool = True) -> str:
    """featured=False：非精選景點（已在 photo_choices.json 審過的跳過）"""
    from pipeline.photos import load_choices

    decided = load_choices()
    spots: list[SpotPhotos] = []
    meta: dict[str, dict[str, Any]] = {}
    for pref in prefs:
        data = json.loads((SPOTS_DIR / f"{pref}.json").read_text(encoding="utf-8"))
        for s in data["spots"] if isinstance(data, dict) else data:
            qid = (s.get("external_ids") or {}).get("wikidata")
            imgs = s.get("images") or []
            if not (qid and bool(s.get("featured")) == featured and imgs) or qid in decided:
                continue
            main = file_of(imgs[0].get("source_url", ""))
            spots.append(SpotPhotos(qid, pref, s["name"]["ja"], s["name"].get("en") or "", main))
            meta[qid] = s
    fetch_claims(spots)
    fetch_wiki_images(spots)
    cats = fetch_categories([norm(s.main) for s in spots if s.main])
    picked = []
    for sp in spots:
        s = meta[sp.id]
        flags = subject_flags(cats.get(norm(sp.main or ""), []), f"{sp.name} {sp.en}")
        flags = exempt(flags, sp.name, sp.en, s.get("tags") or [])
        counts: dict[str, int] = {}
        for f in sp.wiki.values():
            counts[norm(f)] = counts.get(norm(f), 0) + 1
        agree_other = any(n >= 2 and f != sp.main for f, n in counts.items())
        if not (flags or agree_other):
            continue
        cands = candidates(sp)
        if len(cands) < 2:
            continue
        picked.append((sp, flags, agree_other, cands))
    files = [f for _, _, _, cands in picked for f, _ in cands]
    infos = commons.image_info(files, width=TILE_W)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for sp, flags, agree_other, cands in picked:
        tiles = [(f, src, infos.get(f)) for f, src in cands]
        tiles = [t for t in tiles if t[2]]
        if len(tiles) < 2:
            continue
        images = []
        for _, _, info in tiles:
            try:
                images.append(download(info.url))
            except Exception:
                images.append(b"")
        (out_dir / f"{sp.id}.jpg").write_bytes(sheet(images))
        rows.append(
            {
                "id": sp.id,
                "pref": sp.pref,
                "name": sp.name,
                "en": sp.en,
                "why": flags + (["維基條目選了別張"] if agree_other else []),
                "tiles": [
                    {"file": f, "source": src, "author": info.author, "license": info.license}
                    for f, src, info in tiles
                ],
            }
        )
    rows.sort(key=lambda r: (r["pref"], r["id"]))
    (out_dir / "review.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    scope = "精選" if featured else "非精選"
    return f"## 照片審核圖\n\n- {scope}景點裡要審的：{len(rows)} 個\n"
