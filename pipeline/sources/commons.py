"""Wikimedia Commons：縮圖網址、作者、授權（UI 必須顯示 credit）。"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass

from pipeline.http import get_json

API = "https://commons.wikimedia.org/w/api.php"


@dataclass
class ImageInfo:
    url: str
    author: str
    license: str
    source_url: str


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
                "iiprop": "url|extmetadata",
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
                url=info.get("thumburl") or info["url"],
                author=author[:120],
                license=lic,
                source_url=info.get("descriptionurl", ""),
            )
    return out
