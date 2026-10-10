"""Wikimedia Commons：縮圖網址、作者、授權（UI 必須顯示 credit）。"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from urllib.parse import unquote

from pipeline.http import get_json

API = "https://commons.wikimedia.org/w/api.php"


@dataclass
class ImageInfo:
    url: str
    author: str
    license: str
    source_url: str
    # 原圖的寬高（px）。收集卡用來在顯示前決定直卡或橫卡（web/src/services/card.ts）
    width: int | None = None
    height: int | None = None


# Commons 的標準縮圖寬度；原圖網址（upload.wikimedia.org 不經縮圖）常被限流（429），能用縮圖就存縮圖
COMMONS_WIDTHS = (250, 330, 500, 960, 1280, 1920)
THUMB_PREFIX = "https://thumb.wikimedia.org/wikipedia/commons/thumb/"
_ORIGINAL_RE = re.compile(
    r"^https://upload\.wikimedia\.org/wikipedia/commons/([0-9a-f])/([0-9a-f]{2})/([^/?]+)"
)
_RASTER = {"jpg", "jpeg", "png", "gif", "webp"}


def thumb_url(url: str, file_width: int, want: int) -> str:
    """API 給原圖網址（原圖比要的縮圖寬度小）時，改成不超過原圖寬、不超過 want 的最大標準寬度縮圖。

    檔名段沿用 API 給的編碼（縮圖名與資料夾名一致）；原圖比 250px 還小、寬度不明、不是點陣圖時原樣。
    """
    m = _ORIGINAL_RE.match(url)
    if not m or file_width <= 0:
        return url
    a, ab, name = m.groups()
    if name.rsplit(".", 1)[-1].lower() not in _RASTER:
        return url
    fits = [w for w in COMMONS_WIDTHS if w <= min(file_width, want)]
    if not fits:
        return url
    return f"{THUMB_PREFIX}{a}/{ab}/{name}/{fits[-1]}px-{name}"


def _plain(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def image_info(filenames: list[str], width: int = 640) -> dict[str, ImageInfo]:
    out: dict[str, ImageInfo] = {}
    uniq = list(dict.fromkeys(filenames))
    for i in range(0, len(uniq), 40):
        chunk = uniq[i : i + 40]
        data = get_json(
            API,
            params={
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "url|size|extmetadata",
                "iiurlwidth": width,
                "titles": "|".join(f"File:{f}" for f in chunk),
                "format": "json",
            },
            min_interval=0.5,
        )
        pages = data.get("query", {}).get("pages", {})
        norm = {n["to"]: n["from"] for n in data.get("query", {}).get("normalized", [])}
        for page in pages.values():
            infos = page.get("imageinfo")
            if not infos:
                continue
            info = infos[0]
            meta = info.get("extmetadata", {})
            title = page["title"]
            original = norm.get(title, title).removeprefix("File:")
            author = _plain(meta.get("Artist", {}).get("value", "")) or "不明"
            lic = _plain(meta.get("LicenseShortName", {}).get("value", "")) or "不明"
            out[original] = ImageInfo(
                url=thumb_url(
                    info.get("thumburl") or info["url"], int(info.get("width") or 0), width
                ),
                author=author[:120],
                license=lic,
                source_url=info.get("descriptionurl", ""),
                width=_dim(info.get("width")),
                height=_dim(info.get("height")),
            )
    return out


def _dim(v: object) -> int | None:
    """API 的寬高；沒有或是 0（音訊、PDF 以外的特殊檔）時 None"""
    try:
        n = int(v)  # type: ignore[call-overload]
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def file_title(source_url: str) -> str | None:
    """Commons 檔案頁網址 → 檔名（不含 File:，底線換空白）；不是 Commons 檔案頁時 None"""
    if "commons.wikimedia.org" not in source_url or "File:" not in source_url:
        return None
    name = unquote(source_url.split("?", 1)[0].rsplit("File:", 1)[-1]).replace("_", " ").strip()
    return name or None


def image_sizes(titles: list[str], batch: int = 50) -> dict[str, tuple[int, int]]:
    """檔名 → 原圖（寬, 高）。一次查 batch 個；查不到（刪除、不是圖）的不在結果裡。

    檔名經過正規化（大小寫、底線）或重新導向（改名）時，結果用呼叫時給的檔名。
    """
    out: dict[str, tuple[int, int]] = {}
    uniq = list(dict.fromkeys(titles))
    for i in range(0, len(uniq), batch):
        chunk = uniq[i : i + batch]
        data = get_json(
            API,
            params={
                "action": "query",
                "prop": "imageinfo",
                "iiprop": "size",
                "redirects": 1,
                "titles": "|".join(f"File:{f}" for f in chunk),
                "format": "json",
            },
            min_interval=0.5,
        )
        query = data.get("query", {})
        # 查詢的標題 → API 最後的標題（正規化、重新導向各一層）
        back: dict[str, str] = {}
        for f in chunk:
            back[f"File:{f}"] = f
        for n in query.get("normalized", []):
            if n.get("from") in back:
                back[n["to"]] = back[n["from"]]
        for r in query.get("redirects", []):
            if r.get("from") in back:
                back[r["to"]] = back[r["from"]]
        for page in query.get("pages", {}).values():
            infos = page.get("imageinfo")
            asked = back.get(page.get("title", ""))
            if not infos or asked is None:
                continue
            w, h = _dim(infos[0].get("width")), _dim(infos[0].get("height"))
            if w and h:
                out[asked] = (w, h)
    return out
