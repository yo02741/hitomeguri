"""農林水產省「うちの郷土料理」：各縣的郷土料理一覽（地域検索頁）。

取料理名稱、所屬縣、料理頁網址，以及料理頁的念法與介紹文字（「歴史・由来・関連行事」等段落）。
介紹文字依「公共データ利用規約（第1.0版）」（PDL1.0）使用，顯示時標示「出典：農林水產省」與料理頁網址；
照片、食譜有第三方提供者（「画像提供元」「レシピ提供元」），條款要求事先向負責單位確認，所以不取。
一縣一個請求（地域検索頁就列出全部料理），料理頁一道一個請求；robots.txt 不存在；每秒最多一次請求。
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


# 料理頁：<h2 class="tit06"><span class="name">ずんだ餅（ずんだもち）
_NAME = re.compile(r'<span class="name">\s*([^<]+?)\s*<')
# 介紹段落：<h3 class="tit06 mb10"><span class="pref">歴史・由来・関連行事</span></h3> 後面的 <p>
_SECTION = re.compile(r'<span class="pref">\s*([^<]+?)\s*</span>\s*</h3>\s*<p[^>]*>(.*?)</p>', re.S)
# 簡介用的段落，依序取第一個有內容的（日文頁、英文頁）
SUMMARY_SECTIONS = (
    "歴史・由来・関連行事",
    "飲食方法",
    "食習の機会や時季",
    "History/origin/related events",
    "How to eat",
    "Opportunities and times of eating habits",
)
LICENSE = "出典：農林水產省（公共データ利用規約 第1.0版）"


# 英文版（Our Regional Cuisines）的同一道料理
_EN_LINK = re.compile(
    r'href="(https://www\.maff\.go\.jp/e/policies/market/k_ryouri/search_menu/\d+/index\.html)"'
)


@dataclass
class Detail:
    reading: str | None
    sections: dict[str, str]
    en_url: str | None = None

    name: str | None = None

    @property
    def summary(self) -> str | None:
        return next((self.sections[k] for k in SUMMARY_SECTIONS if self.sections.get(k)), None)


def _clean(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def parse_detail(text: str) -> Detail:
    reading, name = None, None
    m = _NAME.search(text)
    if m:
        name = html.unescape(m.group(1)).strip()
        r = re.search(r"[（(]([^）)]+)[）)]\s*$", name)
        reading = r.group(1).strip() if r else None
    # 英文頁沒填的段落是「(Outline of …)」這類括號說明，不算內容
    sections = {
        k.strip(): t
        for k, v in _SECTION.findall(text)
        if (t := _clean(v)) and not t.startswith("(")
    }
    en = _EN_LINK.search(text)
    return Detail(reading, sections, en.group(1) if en else None, name)


def detail(url: str) -> Detail | None:
    text = get_text(url)
    return parse_detail(text) if text else None


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
