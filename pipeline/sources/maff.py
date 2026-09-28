"""農林水產省「うちの郷土料理」：各縣的郷土料理一覽（地域検索頁）。

只取事實資料（料理名稱、所屬縣、料理頁網址）；介紹文字與照片不取（照片可能有第三方提供者）。
一縣一個請求（地域検索頁就列出全部料理）；robots.txt 不存在；每秒最多一次請求。
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass

from pipeline.http import get_text

BASE = "https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/search_menu/"
AREA_URL = BASE + "area/{slug}.html"
MENU_URL = BASE + "menu/{id}.html"
# 網站上的縣名拼法和我們的 slug 不同的
SLUG = {"yamanashi": "yamanasi"}

# 每道料理：連到 ../menu/{id}.html，後面第一個 <p class="tit"> 是名稱
_ITEM = re.compile(r'href="\.\./menu/([\w-]+)\.html".*?<p class="tit">\s*([^<]+?)\s*</p>', re.S)


@dataclass
class Dish:
    id: str
    prefecture: str
    name: str  # 第一個名稱（「あぶらげずし/いなりずし」→「あぶらげずし」）
    aliases: list[str]
    url: str


def split_names(title: str) -> list[str]:
    return [n.strip() for n in re.split(r"[/／]", html.unescape(title)) if n.strip()]


def parse_area(text: str, pref: str) -> list[Dish]:
    out: dict[str, Dish] = {}
    for mid, title in _ITEM.findall(text):
        names = split_names(title)
        if not names or mid in out:
            continue
        out[mid] = Dish(mid, pref, names[0], names[1:], MENU_URL.format(id=mid))
    return list(out.values())


def dishes(pref: str) -> list[Dish]:
    text = get_text(AREA_URL.format(slug=SLUG.get(pref, pref)))
    return parse_area(text, pref) if text else []
