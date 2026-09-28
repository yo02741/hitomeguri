"""ポケふた（ポケモンマンホール）官方網站 local.pokemon.jp：各縣頁的人孔蓋清單與個別頁面。

只取事實資料（所在縣市、寶可夢名稱與圖鑑編號、地址、座標）與頁面網址；
不取人孔蓋圖片與市町村介紹文字（著作權屬 The Pokémon Company 與各自治體）。
robots.txt 不存在（404）；每秒最多一次請求。
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

from pipeline.http import get_text

BASE = "https://local.pokemon.jp"
PREF_URL = BASE + "/manhole/{slug}.html"
# 個別頁只有 modal 版（不帶 ?is_modal=1 會回首頁），對外連結也用這個網址
DETAIL_URL = BASE + "/manhole/desc/{id}/?is_modal=1"

_DESC = re.compile(r'href="/manhole/desc/(\d+)/\?is_modal=1"')
_H1 = re.compile(r"<h1>\s*([^<]+?)\s*</h1>")
_POKEMON = re.compile(
    r'<a href="https://zukan\.pokemon\.co\.jp/detail/([\w-]+)"[^>]*><span>([^<]+)</span>'
)
_ADDRESS = re.compile(r"<h2>マンホール場所</h2>\s*<p>\s*([^<]*?)\s*</p>")
_LATLNG = re.compile(r"maps\.google\.com/maps\?q=(-?\d+\.\d+),(-?\d+\.\d+)")


@dataclass
class Lid:
    id: str
    prefecture: str
    municipality: str
    url: str
    lat: float | None = None
    lng: float | None = None
    address: str = ""
    # (圖鑑編號, 日文名稱)
    pokemon: list[tuple[str, str]] = field(default_factory=list)


def lid_ids(slug: str) -> list[str]:
    """縣頁列出的人孔蓋 id（依頁面順序、去重）；沒有這個縣的頁面時回傳空清單。"""
    text = get_text(PREF_URL.format(slug=slug))
    if not text:
        return []
    return list(dict.fromkeys(_DESC.findall(text)))


def parse_detail(text: str) -> tuple[str, float | None, float | None, str, list[tuple[str, str]]]:
    """回傳（標題「縣/市町村」、緯度、經度、地址、寶可夢）。"""
    title = _H1.search(text)
    ll = _LATLNG.search(text)
    addr = _ADDRESS.search(text)
    mons = [(no, html.unescape(name).strip()) for no, name in _POKEMON.findall(text)]
    return (
        html.unescape(title.group(1)) if title else "",
        float(ll.group(1)) if ll else None,
        float(ll.group(2)) if ll else None,
        html.unescape(addr.group(1)) if addr else "",
        list(dict.fromkeys(mons)),
    )


def municipality_of(title: str) -> str:
    """「沖縄県/那覇市」→「那覇市」。"""
    return title.split("/", 1)[1].strip() if "/" in title else title.strip()


def lids(slug: str) -> list[Lid]:
    out = []
    for lid in lid_ids(slug):
        url = DETAIL_URL.format(id=lid)
        text = get_text(url)
        if not text:
            continue
        title, lat, lng, address, mons = parse_detail(text)
        out.append(Lid(lid, slug, municipality_of(title), url, lat, lng, address, mons))
    return out
