"""京都観光Navi（京都市觀光協會的官方觀光網站）：觀光設施頁。

網站沒有熱門排序，只取「官方網站有收」這個事實（rank=None）。只取名稱、座標與頁面網址，
不取介紹文字與照片。robots.txt 不存在；每秒最多一次請求。
網址取自 sitemap.xml 的 `/tourism/single01.php?category_id=N&tourism_id=M`（住宿是另一種頁面
single-hotel01.php，不會列進來），只收下列類別。
"""

from __future__ import annotations

import html
import re

from pipeline.http import get_text
from pipeline.sources import sitemap
from pipeline.sources.okinawastory import OfficialSpot

BASE = "https://ja.kyoto.travel"
# 網站的類別（/tourism/search.php?category_id=N）：只收觀光景點類
CATEGORIES = {
    2: "アクティビティ",
    3: "工房・体験施設",
    7: "寺院・神社",
    8: "名所・旧跡",
    11: "美術館・博物館",
}
# 不收：4 食・グルメ・ショッピング、5 お土産・伝統工芸、9 駒札・歌碑、12 レンタル、13 宿泊、
# 14 その他・サービス
_SPOT = re.compile(
    r"^https://ja\.kyoto\.travel/tourism/single01\.php\?category_id=(\d+)&tourism_id=(\d+)$"
)
_H1 = re.compile(r'<h1 class="mod_tit06">\s*([^<]+?)\s*<')
_LATLNG = re.compile(r"maps/embed/v1/place\?[^\"]*?q=(-?\d+\.\d+),\s*(-?\d+\.\d+)")


def parse_detail(text: str) -> tuple[str | None, float | None, float | None]:
    name = _H1.search(text)
    ll = _LATLNG.search(text)
    return (
        html.unescape(name.group(1)).replace("　", " ").strip() if name else None,
        float(ll.group(1)) if ll else None,
        float(ll.group(2)) if ll else None,
    )


def spot_urls() -> list[tuple[str, int, str]]:
    """(網址, 類別, id)：只留收錄的類別。"""
    out = []
    for url in sitemap.urls(BASE + "/sitemap.xml", _SPOT):
        m = _SPOT.match(url)
        if m and int(m.group(1)) in CATEGORIES:
            out.append((url, int(m.group(1)), m.group(2)))
    return out


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    for url, cat, tid in spot_urls()[:limit]:
        text = get_text(url)
        if not text:
            continue
        name, lat, lng = parse_detail(text)
        if name:
            out.append(
                OfficialSpot("kyototravel", tid, name, url, None, lat, lng, [CATEGORIES[cat]])
            )
    return out
