"""OSAKA-INFO（大阪觀光局的官方觀光網站）：景點頁。

網站沒有熱門排序，只取「官方網站有收」這個事實（rank=None），名稱與座標取自各頁的 JSON-LD。
只取事實資料，不取介紹文字與照片。robots.txt 不存在；每秒最多一次請求。
景點網址取自 sitemap.xml 的 `/spot/{slug}/`；JSON-LD 的 @type 是商店、餐廳、住宿的不收。
"""

from __future__ import annotations

import re

from pipeline.http import get_text
from pipeline.sources import sitemap
from pipeline.sources.okinawastory import OfficialSpot

BASE = "https://osaka-info.jp"
_SPOT = re.compile(r"^https://osaka-info\.jp/spot/([A-Za-z0-9_-]+)/$")
# schema.org 的商店、餐飲、住宿類型（ElectronicsStore、Restaurant、Hotel…）
_NOT_SPOT_TYPE = re.compile(
    r"(Store|Shop|Restaurant|FoodEstablishment|CafeOrCoffeeShop|BarOrPub|Bakery|Lodging|Hotel"
    r"|Hostel|Motel|Resort|TravelAgency|AutoRental)$"
)


def parse_detail(text: str) -> tuple[str | None, float | None, float | None, list[str]]:
    """(名稱, 緯度, 經度, JSON-LD 的 @type)。"""
    for obj in sitemap.ld_json(text):
        geo = obj.get("geo")
        if not isinstance(geo, dict):
            continue
        types = obj.get("@type")
        types = [types] if isinstance(types, str) else list(types or [])
        try:
            lat, lng = float(geo["latitude"]), float(geo["longitude"])
        except (KeyError, TypeError, ValueError):
            lat = lng = None
        name = obj.get("name")
        return (name.strip() if isinstance(name, str) else None, lat, lng, types)
    return None, None, None, []


def is_spot_type(types: list[str]) -> bool:
    return not any(_NOT_SPOT_TYPE.search(t) for t in types)


def spots(limit: int) -> list[OfficialSpot]:
    out = []
    urls = sitemap.urls(BASE + "/sitemap.xml", _SPOT)[:limit]
    for i, url in enumerate(urls):
        sitemap.progress(i, len(urls))
        text = get_text(url)
        if not text:
            continue
        name, lat, lng, types = parse_detail(text)
        if not name or not is_spot_type(types):
            continue
        slug = _SPOT.match(url).group(1)  # type: ignore[union-attr]
        out.append(OfficialSpot("osakainfo", slug, name, url, None, lat, lng, []))
    return out
