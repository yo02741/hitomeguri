"""おきなわ物語（沖繩觀光會議局的官方觀光網站）：依瀏覽次數排序的景點清單。

只取事實資料（名稱、座標、類型、熱門排名）與頁面網址，不取介紹文字與照片。
robots.txt 不存在（404）、條款未禁止取得；每秒最多一次請求。
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

from pipeline.http import get_text

BASE = "https://www.okinawastory.jp"
# 路徑式分頁（/page:N）會被忽略，要用查詢參數
LIST_URL = BASE + "/spot/list?page={page}&sort=AccessLogSumResult_COUNT&direction=desc"

_ITEM = re.compile(r'<a class="os-c-list-cmn__title-link" href="/spot/(\d+)">\s*([^<]+?)\s*</a>')
_H1 = re.compile(r'<h1 class="os-c-title-cmn-main">\s*([^<]+?)\s*</h1>')
_LATLNG = re.compile(r"maps/embed/v1/place\?q=(-?\d+\.\d+),(-?\d+\.\d+)")
# 景點自己的類型標籤（頁面上另有全站搜尋選單的類型清單，不能一起抓）
_CATEGORY = re.compile(r'class="p-detail-tag__link" href="/spot/list\?category=\d+">([^<]+)</a>')


@dataclass
class OfficialSpot:
    source: str
    id: str
    name: str
    url: str
    rank: int
    lat: float | None = None
    lng: float | None = None
    categories: list[str] = field(default_factory=list)


def ranked_ids(limit: int, max_pages: int = 80) -> list[tuple[str, str]]:
    """熱門排序的 (id, 名稱)，最多 limit 筆。"""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for page in range(1, max_pages + 1):
        text = get_text(LIST_URL.format(page=page))
        if not text:
            break
        new = 0
        for sid, name in _ITEM.findall(text):
            if sid not in seen:
                seen.add(sid)
                out.append((sid, html.unescape(name)))
                new += 1
        if not new or len(out) >= limit:
            break
    return out[:limit]


def parse_detail(text: str) -> tuple[str | None, float | None, float | None, list[str]]:
    name = _H1.search(text)
    ll = _LATLNG.search(text)
    cats = [html.unescape(c).strip() for c in _CATEGORY.findall(text)]
    return (
        html.unescape(name.group(1)) if name else None,
        float(ll.group(1)) if ll else None,
        float(ll.group(2)) if ll else None,
        list(dict.fromkeys(cats)),
    )


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    for rank, (sid, list_name) in enumerate(ranked_ids(limit), start=1):
        url = f"{BASE}/spot/{sid}"
        text = get_text(url)
        if not text:
            continue
        name, lat, lng, cats = parse_detail(text)
        out.append(OfficialSpot("okinawastory", sid, name or list_name, url, rank, lat, lng, cats))
    return out
