"""擴充包：疊在大點上的全國性小點（PLAN.md §1 主題層）。

目前只有寶可夢：人孔蓋（ポケふた）、寶可夢中心與商店。

每個擴充包寫成 data/packs/<key>.json，依 id 排序；每筆保留來源網址與取得時間。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any

from pipeline import geo
from pipeline.paths import PACKS_DIR, REGIONS_JSON
from pipeline.sources import osm, pokefuta


def log(msg: str) -> None:
    print(msg, flush=True)


def pref_slugs() -> list[str]:
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    return [r["prefecture"] for r in data["regions"]]


def lid_record(lid: pokefuta.Lid, today: str) -> dict[str, Any]:
    return {
        "id": f"pokefuta-{lid.id}",
        "prefecture": lid.prefecture,
        "municipality": lid.municipality,
        "pokemon": [{"dex": no, "ja": name} for no, name in lid.pokemon],
        "address": lid.address,
        "location": {"lat": lid.lat, "lng": lid.lng},
        "sources": [{"url": lid.url, "fetched_at": today}],
    }


def seed_pokefuta(prefs: list[str] | None = None) -> str:
    """回傳 markdown 報告。只重抓指定縣時，其他縣的既有資料保留。"""
    today = dt.date.today().isoformat()
    targets = prefs or pref_slugs()
    path = PACKS_DIR / "pokefuta.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    keep = [r for r in old if r["prefecture"] not in targets]

    rows: list[str] = []
    new: list[dict[str, Any]] = []
    no_coords: list[str] = []
    for slug in targets:
        found = pokefuta.lids(slug)
        for lid in found:
            if lid.lat is None or lid.lng is None:
                no_coords.append(f"{lid.municipality}（{lid.url}）")
                continue
            new.append(lid_record(lid, today))
        log(f"[pokefuta] {slug}：{len(found)} 個")
        rows.append(f"| {slug} | {len(found)} |")

    out = sorted({r["id"]: r for r in keep + new}.values(), key=lambda r: r["id"])
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = ["## ポケふた", "", f"共 {len(out)} 個（本次 {len(new)} 個）", ""]
    report += ["| 縣 | 個數 |", "|---|---|", *rows]
    if no_coords:
        report += ["", f"沒有座標而略過：{'、'.join(no_coords)}"]
    return "\n".join(report) + "\n"


def _pref_of(lat: float, lng: float) -> str | None:
    """簡化縣界外的海岸埋立地：退回範圍框判斷。"""
    pref = geo.prefecture_at(lat, lng)
    if pref:
        return pref
    for slug in pref_slugs():
        s, w, n, e = geo.bbox(slug, pad=0.0)
        if s <= lat <= n and w <= lng <= e:
            return slug
    return None


def osm_name(tags: dict[str, str]) -> str:
    """店名；很多店的 name 只有品牌（「ポケモンセンター」），分店名在 branch。"""
    name = tags.get("name:ja") or tags.get("name", "")
    branch = tags.get("branch", "")
    if name and branch and branch not in name:
        name = f"{name} {branch}"
    return name


# OSM 日本的地址標籤：addr:full 多半已經是完整地址（含縣、市）；沒有時由各層組起來
_ADDR_UPPER = ("addr:province", "addr:county", "addr:city")
_ADDR_LOWER = ("addr:suburb", "addr:quarter", "addr:neighbourhood")
_PREF_RE = re.compile(r"北海道|東京都|(?:京都|大阪)府|[^\s都道府県]{2,3}県")


def collapse_repeated_address(addr: str) -> str:
    """開頭的縣名在後面又出現一次（上層標籤＋完整地址接在一起）時，只留最後一段完整的地址。

    「京都府京都市祇園町北側京都府京都市東山区祇園町北側264」→「京都府京都市東山区祇園町北側264」
    """
    m = _PREF_RE.match(addr)
    # 括號、空白裡另外寫的地址（「〇〇公園内（宮城県…）」）是原文的補充，不動
    if not m or any(c in addr for c in "（()　 "):
        return addr
    last = addr.rfind(m.group(0))
    return addr[last:] if last > 0 else addr


def osm_address(tags: dict[str, str]) -> str:
    full = tags.get("addr:full", "").strip()
    upper = [v for k in _ADDR_UPPER if (v := tags.get(k, "").strip())]
    if full:
        # 只補 addr:full 裡沒有的上層（縣、郡、市），不重複接
        addr = "".join(v for v in upper if v not in full) + full
    else:
        lower = [v for k in _ADDR_LOWER if (v := tags.get(k, "").strip())]
        block = tags.get("addr:block_number", "").strip()
        house = tags.get("addr:housenumber", "").strip()
        number = f"{block}-{house}" if block and house else block or house
        addr = "".join(upper + lower) + number
    return collapse_repeated_address(addr)


def shop_record(el: osm.OsmElement, today: str) -> dict[str, Any] | None:
    pref = _pref_of(el.lat, el.lng)
    t = el.tags
    name = osm_name(t)
    if not pref or not name:
        return None
    address = osm_address(t)
    return {
        # 前綴與景點（osm-…）區分，前端依前綴判斷是擴充包的點
        "id": f"pokecen-{el.osm_id.replace('/', '-')}",
        "prefecture": pref,
        # ポケモンストア（小型店）與ポケモンセンター分開
        "kind": "store" if ("ストア" in name or "Store" in name) else "center",
        "name": {"ja": name, "en": t.get("name:en")},
        "address": address,
        "location": {"lat": round(el.lat, 6), "lng": round(el.lng, 6)},
        "website": t.get("website") or t.get("contact:website"),
        "sources": [{"url": el.url, "fetched_at": today}],
    }


def seed_pokecen() -> str:
    """全國的寶可夢中心與寶可夢商店（OSM）→ data/packs/pokecen.json。"""
    today = dt.date.today().isoformat()
    elements = osm.pokemon_shops()
    out = [r for el in elements if (r := shop_record(el, today))]
    out.sort(key=lambda r: r["id"])
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    path = PACKS_DIR / "pokecen.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [f"- {r['name']['ja']}（{r['prefecture']}）" for r in out]
    head = ["## 寶可夢中心・商店", "", f"共 {len(out)} 家（OSM {len(elements)} 筆）", ""]
    return "\n".join([*head, *lines]) + "\n"
