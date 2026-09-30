"""擴充包「角色商店」（seed-chara 指令）：任天堂、吉卜力、三麗鷗…的官方店與咖啡廳。

全國一次查 OSM（店名比對品牌），依品牌分組。寶可夢另有擴充包，不在這裡。
介面不使用角色圖、logo 或官方圖片；只存店名、座標與官方網站連結。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any

from pipeline import geo
from pipeline.packs import _pref_of, log, osm_address, osm_name
from pipeline.paths import PACKS_DIR
from pipeline.sources import osm

# (組別, 店名比對)；比對不分大小寫
BRANDS: list[tuple[str, str]] = [
    ("nintendo", r"Nintendo (TOKYO|OSAKA|KYOTO|FUKUOKA)|ニンテンドー(ミュージアム|トウキョウ|オオサカ|キョウト|フクオカ)|Nintendo Museum"),  # noqa: E501
    ("ghibli", r"どんぐり共和国|Donguri Republic|ジブリ美術館|ジブリパーク|Ghibli Museum|Ghibli Park"),  # noqa: E501
    ("sanrio", r"サンリオ|Sanrio|ハローキティ|Hello Kitty"),
    ("chiikawa", r"ちいかわ|Chiikawa"),
    ("kirby", r"カービィ|Kirby Caf"),
    ("onepiece", r"麦わらストア|Mugiwara Store|ONE PIECE"),
    ("jump", r"ジャンプショップ|JUMP SHOP"),
    ("snoopy", r"スヌーピー|Snoopy|PEANUTS Cafe"),
    ("disney", r"ディズニーストア|Disney Store"),
]  # fmt: skip
GROUP_LABEL = {
    "nintendo": "任天堂",
    "ghibli": "吉卜力",
    "sanrio": "三麗鷗",
    "chiikawa": "吉伊卡哇",
    "kirby": "星之卡比",
    "onepiece": "航海王",
    "jump": "Jump Shop",
    "snoopy": "史努比",
    "disney": "迪士尼",
}
# 住宿、停車場等名稱剛好含品牌的不收
EXCLUDE_TOURISM = {"hotel", "motel", "guest_house", "hostel", "apartment"}
# tourism=attraction 只收園區、博物館（主題樂園裡的遊樂設施、看板不收）
ATTRACTION_OK = re.compile(
    r"パーク|ランド|ミュージアム|美術館|ワールド|Museum|Park|Land|World", re.I
)
# 同品牌、這個距離內視為同一家（OSM 常同時有建築物與店家節點、日文與英文各一筆）
SAME_PLACE_M = 60
SAME_NAME_M = 300


def brand_of(name: str) -> str | None:
    for key, rx in BRANDS:
        if re.search(rx, name, re.I):
            return key
    return None


def chara_record(el: osm.OsmElement, today: str) -> dict[str, Any] | None:
    t = el.tags
    names = " ".join(v for k, v in t.items() if k.startswith(("name", "brand")))
    kind = brand_of(names)
    pref = _pref_of(el.lat, el.lng)
    name = osm_name(t)
    if not kind or not pref or not name or t.get("tourism") in EXCLUDE_TOURISM:
        return None
    # 遊樂設施（attraction=*）、園區裡的看板等
    if "attraction" in t or (
        t.get("tourism") == "attraction" and not t.get("shop") and not ATTRACTION_OK.search(name)
    ):
        return None
    rec = {
        "id": f"chara-{el.osm_id.replace('/', '-')}",
        "kind": kind,
        "prefecture": pref,
        "name": {k: v for k, v in {"ja": name, "en": t.get("name:en")}.items() if v},
        "address": osm_address(t) or None,
        "location": {"lat": round(el.lat, 6), "lng": round(el.lng, 6)},
        "website": t.get("website") or t.get("contact:website"),
        "sources": [{"url": el.url, "fetched_at": today}],
    }
    return {k: v for k, v in rec.items() if v is not None}


# Overpass 查詢用：不分大小寫的比對（,i）在 Overpass 很慢，改列出常見寫法
OSM_NAMES = "|".join(
    [
        "Nintendo",
        "NINTENDO",
        "ニンテンドー",
        "任天堂",
        "どんぐり共和国",
        "Donguri",
        "ジブリ",
        "Ghibli",
        "GHIBLI",
        "サンリオ",
        "Sanrio",
        "SANRIO",
        "ハローキティ",
        "Hello Kitty",
        "HELLO KITTY",
        "ちいかわ",
        "Chiikawa",
        "カービィ",
        "Kirby",
        "KIRBY",
        "麦わらストア",
        "Mugiwara",
        "ONE PIECE",
        "ジャンプショップ",
        "JUMP SHOP",
        "Jump Shop",
        "スヌーピー",
        "Snoopy",
        "SNOOPY",
        "PEANUTS",
        "ディズニーストア",
        "Disney Store",
        "DISNEY STORE",
    ]
)


def _richness(r: dict[str, Any]) -> int:
    return len(r.get("address") or "") + (10 if r.get("website") else 0) + len(r["name"])


def dedupe(recs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """同品牌的同一個地方只留一筆：60 m 內，或 300 m 內且店名相同；留資料多的那筆。"""

    def norm(r: dict[str, Any]) -> str:
        return re.sub(r"\s", "", r["name"]["ja"]).lower()

    kept: list[dict[str, Any]] = []
    for r in sorted(recs, key=lambda r: (-_richness(r), r["id"])):
        la, ln = r["location"]["lat"], r["location"]["lng"]
        dup = any(
            k["kind"] == r["kind"]
            and (d := geo.haversine_m(la, ln, k["location"]["lat"], k["location"]["lng"]))
            <= SAME_NAME_M
            and (d <= SAME_PLACE_M or norm(k) == norm(r))
            for k in kept
        )
        if not dup:
            kept.append(r)
    return kept


def seed_chara() -> str:
    today = dt.date.today().isoformat()
    rx = OSM_NAMES
    # 品牌的判斷（brand_of）在本機做，這裡只撈候選
    elements, failed = osm.by_prefecture([
        f'["shop"]["name"~"{rx}"]',
        f'["amenity"~"^(cafe|restaurant)$"]["name"~"{rx}"]',
        f'["tourism"~"^(museum|attraction|theme_park)$"]["name"~"{rx}"]',
    ])  # fmt: skip
    out = [r for el in elements if (r := chara_record(el, today))]
    out = dedupe(list({r["id"]: r for r in out}.values()))
    out.sort(key=lambda r: r["id"])
    log(f"[chara] OSM {len(elements)} 筆 → {len(out)} 家")
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    path = PACKS_DIR / "charashop.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = ["## 角色商店", "", f"共 {len(out)} 家（OSM {len(elements)} 筆）", ""]
    if failed:
        lines += [f"OSM 查詢失敗的縣（這次沒有資料）：{'、'.join(failed)}", ""]
    for key, label in GROUP_LABEL.items():
        rows = [r for r in out if r["kind"] == key]
        lines.append(f"### {label}（{len(rows)}）")
        lines += [f"- {r['name']['ja']}（{r['prefecture']}）" for r in rows]
        lines.append("")
    return "\n".join(lines)
