"""HOKKAIDO LOVE!（北海道觀光振興機構的官方觀光網站）：「人気順」的觀光景點清單。

只取事實資料（名稱、座標、熱門排名）與頁面網址，不取介紹文字與照片。
robots.txt 允許全部（User-agent: * / Disallow: 空白）；每秒最多一次請求。
清單網址 `/spot/index_{頁}_2,2.html`（網站的搜尋程式 commonSearch.js 組出的格式，2,2 為人気順）；
詳細頁的 `gConf = {lat:…, lng:…}` 是座標。
"""

from __future__ import annotations

import html
import re

from pipeline.http import get_text
from pipeline.sources.okinawastory import OfficialSpot

BASE = "https://www.visit-hokkaido.jp"
LIST_URL = BASE + "/spot/index_{page}_2,2.html"

# 清單的每一項：<a href="detail_{id}.html" alt="名稱" title="名稱">more</a>（相對或絕對網址）
# （頁首的精選區塊沒有 alt，不會被抓到）
_ITEM = re.compile(r'href="(?:[^"]*/)?detail_(\d+)\.html"\s+alt="([^"]+)"')
_LATLNG = re.compile(r"gConf\s*=\s*\{\s*lat:\s*(-?\d+\.\d+),\s*lng:\s*(-?\d+\.\d+)")


def parse_list(text: str) -> list[tuple[str, str]]:
    return [(sid, html.unescape(name).strip()) for sid, name in _ITEM.findall(text)]


def parse_latlng(text: str) -> tuple[float | None, float | None]:
    m = _LATLNG.search(text)
    return (float(m.group(1)), float(m.group(2))) if m else (None, None)


def ranked_ids(limit: int, max_pages: int = 60) -> list[tuple[str, str]]:
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


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    for rank, (sid, name) in enumerate(ranked_ids(limit), start=1):
        url = f"{BASE}/spot/detail_{sid}.html"
        text = get_text(url)
        if not text:
            continue
        lat, lng = parse_latlng(text)
        out.append(OfficialSpot("visithokkaido", sid, name, url, rank, lat, lng, []))
    return out
