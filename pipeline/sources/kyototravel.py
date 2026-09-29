"""京都観光Navi（京都市觀光協會的官方觀光網站）：觀光設施頁。

網站沒有熱門排序，只取「官方網站有收」這個事實（rank=None）。只取名稱、座標與頁面網址，
不取介紹文字與照片。robots.txt 不存在；每秒最多一次請求。
景點取自各類別的清單頁 `/tourism/search.php?category_id=N`（一頁列出該類別全部；sitemap.xml
是 2023 年產生的，幾乎沒有景點頁），詳細頁 `single01.php?category_id=N&tourism_id=M` 有座標。
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
LIST_URL = BASE + "/tourism/search.php?category_id={cat}"
# 清單的每一項：<h3 class="tit"><a href="/tourism/single01.php?category_id=7&tourism_id=535">本経寺
_ITEM = re.compile(
    r'<h3 class="tit"><a href="/tourism/single01\.php\?'
    r'category_id=(\d+)&(?:amp;)?tourism_id=(\d+)">\s*([^<]+?)\s*<'
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


def parse_list(text: str) -> list[tuple[int, str, str]]:
    """(類別, id, 名稱)。"""
    return [(int(c), tid, html.unescape(n).strip()) for c, tid, n in _ITEM.findall(text)]


def spot_urls() -> list[tuple[str, int, str]]:
    """(網址, 類別, id)：收錄類別的清單頁上的全部景點，同一景點只留一次。"""
    out: dict[str, tuple[str, int, str]] = {}
    for cat in CATEGORIES:
        for c, tid, _ in parse_list(get_text(LIST_URL.format(cat=cat)) or ""):
            if c in CATEGORIES and tid not in out:
                url = f"{BASE}/tourism/single01.php?category_id={c}&tourism_id={tid}"
                out[tid] = (url, c, tid)
    print(f"  京都観光Navi：{len(out)} 個景點", flush=True)
    return list(out.values())


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    todo = spot_urls()[:limit]
    for i, (url, cat, tid) in enumerate(todo):
        sitemap.progress(i, len(todo))
        text = get_text(url)
        if not text:
            continue
        name, lat, lng = parse_detail(text)
        if name:
            out.append(
                OfficialSpot("kyototravel", tid, name, url, None, lat, lng, [CATEGORIES[cat]])
            )
    return out
