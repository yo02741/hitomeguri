"""照片尺寸檢查（photo-check，只產報告、不改資料）：主照片與季節、夜景照片的原圖大小與長寬比。

收集卡有兩種照片框：
- 基本卡、季節卡：4:3 的照片窗，橫拍的照片幾乎不裁
- 全景、特別全景、夜景卡：照片鋪滿 5:7 的直向卡，橫拍的照片只留中間一段
所以標兩件事：
- 糊：原圖寬不到 800 或高不到 600（大卡在手機上會放大）
- 裁：照片太寬，鋪滿直向卡時留下不到 45% 的寬度（長寬比大於約 1.6），主體在側邊就會被裁掉
輸出 reports/photo-check.md、photo-check.json，以及被標「裁」的照片預覽
（reports/photo-check/<QID>.jpg：整張照片，框出卡片看得到的範圍）。
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from pipeline.http import get_json
from pipeline.paths import SPOTS_DIR
from pipeline.photo_stats import file_of, norm

API = "https://commons.wikimedia.org/w/api.php"
MIN_W, MIN_H = 800, 600
CARD = 5 / 7  # 全景卡的寬高比
MIN_KEEP = 0.45  # 鋪滿直向卡時至少要留下的寬度比例
PREVIEW_W = 480
MAX_PREVIEWS = 300


def keep_ratio(w: int, h: int) -> float:
    """照片鋪滿 5:7 直向卡時，留下的寬度比例（1 表示整張都看得到）"""
    if not w or not h:
        return 1.0
    return min(1.0, CARD * h / w)


def flags(w: int, h: int) -> list[str]:
    out = []
    if w and h and (w < MIN_W or h < MIN_H):
        out.append("糊")
    if keep_ratio(w, h) < MIN_KEEP:
        out.append("裁")
    return out


def fetch_sizes(files: list[str]) -> dict[str, tuple[int, int, str]]:
    """檔名 → (寬, 高, 預覽縮圖網址)"""
    out: dict[str, tuple[int, int, str]] = {}
    uniq = list(dict.fromkeys(files))
    for i in range(0, len(uniq), 40):
        chunk = uniq[i : i + 40]
        data = get_json(
            API,
            params={
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "size|url",
                "iiurlwidth": PREVIEW_W,
                "titles": "|".join(f"File:{f}" for f in chunk),
                "format": "json",
            },
            min_interval=0.5,
        )
        q = data.get("query", {})
        back = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for page in q.get("pages", {}).values():
            infos = page.get("imageinfo")
            if not infos:
                continue
            info = infos[0]
            name = back.get(page["title"], page["title"]).removeprefix("File:")
            out[norm(name)] = (
                int(info.get("width") or 0),
                int(info.get("height") or 0),
                info.get("thumburl") or info.get("url", ""),
            )
    return out


def preview(data: bytes, keep: float) -> bytes:
    """整張照片，卡片看得到的範圍以外調暗並畫框"""
    from PIL import Image, ImageDraw

    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    kw = int(w * keep)
    x0 = (w - kw) // 2
    dark = Image.new("RGB", im.size, (0, 0, 0))
    mask = Image.new("L", im.size, 150)
    ImageDraw.Draw(mask).rectangle([x0, 0, x0 + kw, h], fill=0)
    im = Image.composite(dark, im, mask)
    ImageDraw.Draw(im).rectangle([x0, 0, x0 + kw - 1, h - 1], outline=(255, 255, 255), width=3)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=75, optimize=True)
    return buf.getvalue()


def photo_check(prefs: list[str], out_dir: Path) -> str:
    from pipeline.photo_review import download

    rows: list[dict[str, Any]] = []
    for pref in prefs:
        data = json.loads((SPOTS_DIR / f"{pref}.json").read_text(encoding="utf-8"))
        for s in data["spots"] if isinstance(data, dict) else data:
            imgs = s.get("images") or []
            pics = [("主照片", imgs[0])] if imgs else []
            pics += [(k, v) for k, v in sorted((s.get("season_images") or {}).items())]
            for kind, img in pics:
                if kind == "panorama":  # 收集卡不用
                    continue
                f = file_of(img.get("source_url", ""))
                if f:
                    rows.append(
                        {
                            "id": (s.get("external_ids") or {}).get("wikidata") or s["id"],
                            "pref": pref,
                            "name": s["name"]["ja"],
                            "featured": bool(s.get("featured")),
                            "kind": kind,
                            "file": norm(f),
                        }
                    )
    sizes = fetch_sizes([r["file"] for r in rows])
    for r in rows:
        w, h, thumb = sizes.get(r["file"], (0, 0, ""))
        r.update(width=w, height=h, keep=round(keep_ratio(w, h), 2), flags=flags(w, h))
        r["_thumb"] = thumb
    flagged = [r for r in rows if r["flags"]]
    out_dir.mkdir(parents=True, exist_ok=True)
    prev_dir = out_dir / "photo-check"
    crop = sorted(
        (r for r in flagged if "裁" in r["flags"] and r["kind"] == "主照片"),
        key=lambda r: (not r["featured"], r["keep"]),
    )
    for r in crop[:MAX_PREVIEWS]:
        try:
            prev_dir.mkdir(exist_ok=True)
            (prev_dir / f"{r['id']}.jpg").write_bytes(preview(download(r["_thumb"]), r["keep"]))
        except Exception:
            pass
    for r in rows:
        r.pop("_thumb", None)
    (out_dir / "photo-check.json").write_text(
        json.dumps(flagged, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    def count(kind: str | None, flag: str, featured: bool | None = None) -> int:
        return sum(
            1
            for r in flagged
            if flag in r["flags"]
            and (kind is None or (r["kind"] == "主照片") == (kind == "主照片"))
            and (featured is None or r["featured"] == featured)
        )

    no_size = sum(1 for r in rows if not r["width"])
    lines = [
        "## 照片尺寸檢查",
        "",
        f"- 檢查的照片：{len(rows)} 張（主照片 {sum(r['kind'] == '主照片' for r in rows)}）"
        f"，取不到尺寸 {no_size}",
        f"- 糊（原圖寬 < {MIN_W} 或高 < {MIN_H}）：主照片 {count('主照片', '糊')}"
        f"（精選 {count('主照片', '糊', True)}），季節・夜景 {count('季節', '糊')}",
        f"- 裁（鋪滿直向卡留不到 {int(MIN_KEEP * 100)}% 寬）：主照片 {count('主照片', '裁')}"
        f"（精選 {count('主照片', '裁', True)}），季節・夜景 {count('季節', '裁')}",
        f"- 預覽圖：{min(len(crop), MAX_PREVIEWS)} 張"
        "（reports/photo-check/，框內是全景卡看得到的範圍）",
        "",
        "### 精選景點裡被標的主照片",
        "",
    ]
    for r in flagged:
        if r["featured"] and r["kind"] == "主照片":
            lines.append(
                f"- {r['name']}（{r['pref']}）{r['width']}×{r['height']}"
                f" 留 {int(r['keep'] * 100)}%：{'、'.join(r['flags'])}"
            )
    return "\n".join(lines) + "\n"
