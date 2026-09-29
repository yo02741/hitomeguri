"""GO TOKYO（東京觀光財團的官方觀光網站）：景點頁。

網站沒有熱門排序，只取「官方網站有收」這個事實（rank=None）。只取名稱與頁面網址，
不取介紹文字與照片。robots.txt 只禁止 /*/travel-directory/result/index/；每秒最多一次請求。
網址取自 sitemap.xml 的 `/jp/spot/{id}/index.html`。頁面沒有座標（地圖是 Google 地點連結），
名稱取自 <title>「雷門（風雷神門）／東京の観光公式サイトGO TOKYO」；
沒有座標的官方資料只併入名稱完全相同的候選。
"""

from __future__ import annotations

import html
import re

from pipeline.http import get_text
from pipeline.sources import sitemap
from pipeline.sources.okinawastory import OfficialSpot

BASE = "https://www.gotokyo.org"
_SPOT = re.compile(r"^https://www\.gotokyo\.org/jp/spot/(\d+)/index\.html$")
_TITLE = re.compile(r"<title>\s*([^<]+?)\s*／\s*東京の観光公式サイト")


def parse_detail(text: str) -> str | None:
    m = _TITLE.search(text)
    return html.unescape(m.group(1)).strip() if m else None


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    for url in sitemap.urls(BASE + "/sitemap.xml", _SPOT)[:limit]:
        text = get_text(url)
        name = parse_detail(text) if text else None
        if name:
            sid = _SPOT.match(url).group(1)  # type: ignore[union-attr]
            out.append(OfficialSpot("gotokyo", sid, name, url, None, None, None, []))
    return out
