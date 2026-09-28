"""クロスロードふくおか（福岡縣觀光連盟的官方觀光網站）：依瀏覽次數排序的景點清單。

只取事實資料（名稱、座標、類型、熱門排名）與頁面網址，不取介紹文字與照片。
robots.txt 允許全部（User-agent: * / Disallow: 空白）；每秒最多一次請求。
清單 `/spot?st=acs`（st=acs 為瀏覽次數排序）；詳細頁的 Google 地圖嵌入網址帶座標。
"""

from __future__ import annotations

import html
import re

from pipeline.http import get_text
from pipeline.sources.okinawastory import OfficialSpot

BASE = "https://www.crossroadfukuoka.jp"
LIST_URL = BASE + "/spot?st=acs&vw=tile&page={page}"

# 清單的每一項：<li class="o-digest--tile__item"> … /spot/{id} … <h2 class="o-digest--tile__title">
_ITEM_SPLIT = re.compile(r'<li class="o-digest--tile__item">')
_ITEM_ID = re.compile(r'href="(?:https://www\.crossroadfukuoka\.jp)?/spot/(\d+)"')
_ITEM_TITLE = re.compile(r'<h2 class="o-digest--tile__title">\s*([^<]+?)\s*</h2>')
_H1 = re.compile(r'<h1 class="o-heading-low-type4">\s*(?:<[^>]+>\s*)*([^<]+?)\s*<', re.S)
_LATLNG = re.compile(r"maps/embed/v1/place\?[^\"]*?q=(-?\d+\.\d+),(-?\d+\.\d+)")
_CATEGORY = re.compile(
    r'class="o-button o-button--category-tag"[^>]*>\s*(?:<[^>]+>\s*)*([^<]+?)\s*<', re.S
)


def parse_list(text: str) -> list[tuple[str, str]]:
    """清單頁的 (id, 名稱)，依頁面順序。"""
    out = []
    for chunk in _ITEM_SPLIT.split(text)[1:]:
        sid = _ITEM_ID.search(chunk)
        title = _ITEM_TITLE.search(chunk)
        if sid and title:
            out.append((sid.group(1), html.unescape(title.group(1))))
    return out


def ranked_ids(limit: int, max_pages: int = 80) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for page in range(1, max_pages + 1):
        text = get_text(LIST_URL.format(page=page))
        if not text:
            break
        new = 0
        for sid, name in parse_list(text):
            if sid not in seen:
                seen.add(sid)
                out.append((sid, name))
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
        list(dict.fromkeys(c for c in cats if c)),
    )


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    for rank, (sid, list_name) in enumerate(ranked_ids(limit), start=1):
        url = f"{BASE}/spot/{sid}"
        text = get_text(url)
        if not text:
            continue
        name, lat, lng, cats = parse_detail(text)
        out.append(
            OfficialSpot("crossroadfukuoka", sid, name or list_name, url, rank, lat, lng, cats)
        )
    return out
