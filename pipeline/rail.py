"""鐵路路線圖層（TODO.md「鐵路路線圖層」）：seed-rail 指令。

來源：OpenStreetMap 的鐵路路線 relation（route=train|subway|light_rail|monorail|tram，
以及軌道本身的 route=railway：地方的 JR 線多半只有這種）與車站
（railway=station|halt）。ODbL 授權，UI 已標示「© OpenStreetMap contributors」。
- 同一條路線的上下行、內外回り是不同 relation：以營運者＋去掉方向的名稱合併，路段不重複
- 路線顏色取 OSM 的 colour（多為官方路線色），沒有就由前端用預設的鐵路色
- 只留縣界內的路段（跨縣的新幹線不會把整條線放進每個縣），並簡化線形；車站也只留縣界內的
寫 data/rail/{縣}.json。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from collections.abc import Callable
from typing import Any

from pipeline import geo
from pipeline.major import log
from pipeline.models import RailData, RailLine, RailStation, Source
from pipeline.paths import RAIL_DIR
from pipeline.sources import osm

# 簡化容許誤差（度）：約 15 m，縮放 15 看不出差別
SIMPLIFY_TOL = 0.00015
# 同名車站合併的距離（公尺）
STATION_MERGE_M = 500
# 方向與區間的寫法：「（内回り）」「(上り)」「: 東京 => 大阪」「 三軒茶屋→下高井戸」
_DIRECTION = re.compile(
    r"(\s*[（(][^）)]*[）)]|\s*[:：].*|[\s\u3000]+\S*\s*(=>|->|→|⇒)\s*\S*|上り|下り)$"
)
_HEX = re.compile(r"^#?[0-9A-Fa-f]{6}$|^#?[0-9A-Fa-f]{3}$")
# 列車種別：「阪急京都本線 急行」與「阪急京都本線」是同一條線
# 有空白隔開時整個詞都是種別（「JR奈良線 みやこ路快速」）
_SERVICE = re.compile(
    r"([\s\u3000]+\S*)?(各駅停車|各駅|各停|普通|区間快速|新快速|快速|快特|通勤特急|準特急|特急|準急"
    r"|急行|ライナー)$"
)
# 去掉種別後仍沒有這些字的是列車名稱（のぞみ、サンダーバード、大和路快速），不是路線
_LINE_WORD = re.compile(r"(線|鉄道|モノレール|ライン|レール|電車|軌道|新幹線)")


def base_name(name: str) -> str:
    """去掉方向、區間、列車種別的路線名稱：「JR山手線（内回り）」「阪急京都本線 急行」。"""
    prev = None
    while prev != name:
        prev = name
        name = _SERVICE.sub("", _DIRECTION.sub("", name).strip()).strip()
    return name


def is_service(name: str) -> bool:
    """列車名稱（不是路線）：去掉種別後沒有「線」「鉄道」這類字；直通運轉的列車。"""
    return "直通" in name or not _LINE_WORD.search(base_name(name))


def is_defunct(tags: dict[str, str]) -> bool:
    """廃線、休止中的線（route=railway 裡有，軌道已不在或沒有列車）。"""
    name = tags.get("name:ja") or tags.get("name") or ""
    return (
        any(k in tags for k in ("disused", "abandoned", "razed"))
        or any(k.startswith(("disused:", "abandoned:")) for k in tags)
        or bool(re.search(r"(廃線|旧線|休止|跡$)", name))
    )


def colour(tag: str | None) -> str | None:
    """OSM colour 標籤：#rrggbb 才用（「red」這類名稱與格式不對的略過）。"""
    if not tag or not _HEX.match(tag.strip()):
        return None
    c = tag.strip().lstrip("#").lower()
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return f"#{c}"


Inside = Callable[[float, float], bool]


def in_box(box: tuple[float, float, float, float]) -> Inside:
    s, w, n, e = box
    return lambda lng, lat: s <= lat <= n and w <= lng <= e


def in_pref(pref: str) -> Inside:
    """在縣界內（先用範圍框篩，省下多邊形判斷）。東京的範圍框含小笠原，框內有整個神奈川。"""
    box = in_box(geo.bbox(pref))
    return lambda lng, lat: box(lng, lat) and geo.contains(pref, lat, lng)


def clip(points: list[tuple[float, float]], inside: Inside):
    """把線切成落在範圍內的幾段（範圍外的點丟掉，進出時各留一個點讓線接到縣界）。"""
    out: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    prev_out: tuple[float, float] | None = None
    for lng, lat in points:
        if inside(lng, lat):
            if not cur and prev_out is not None:
                cur.append(prev_out)
            cur.append((lng, lat))
            prev_out = None
        else:
            if cur:
                cur.append((lng, lat))
                out.append(cur)
                cur = []
            prev_out = (lng, lat)
    if cur:
        out.append(cur)
    return [seg for seg in out if len(seg) >= 2]


def build_lines(data: dict[str, Any], inside: Inside) -> list[RailLine]:
    # 以去掉方向的名稱合併：營運者的標法常不一致（「西日本旅客鉄道」與空白），同名視為同一條線
    groups: dict[str, dict[str, Any]] = {}
    # 營運中的旅客線路段（查詢另外回傳的 way id）；沒有這份清單時（測試）全部都算
    active = {el["id"] for el in data.get("elements", []) if el.get("type") == "way"}
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        name = tags.get("name:ja") or tags.get("name")
        if not name or is_service(name) or is_defunct(tags):
            continue
        g = groups.setdefault(
            base_name(name),
            {"ids": [], "name": base_name(name), "tags": tags, "ways": {}},
        )
        g["operator"] = g.get("operator") or tags.get("operator") or tags.get("network")
        g["ids"].append(el["id"])
        # 路線色、英文名：上下行只有一邊有標時也要用到
        g["colour"] = g.get("colour") or colour(tags.get("colour"))
        g["name_en"] = g.get("name_en") or tags.get("name:en")
        # 路段（成員 way）：站台、車站等其他角色不要
        for m in el.get("members", []):
            if m.get("type") != "way" or m.get("role") not in ("", "forward", "backward"):
                continue
            geom = m.get("geometry") or []
            if active and m["ref"] not in active:
                continue
            if len(geom) >= 2 and m["ref"] not in g["ways"]:
                g["ways"][m["ref"]] = [(p["lon"], p["lat"]) for p in geom]
    # 同一段軌道只畫一次（直通運轉、多個營運者各有一份 relation）：
    # 有官方路線色的先、名稱短的先（「京都市営地下鉄烏丸線」先於「京都地下鉄烏丸線・近鉄京都線」）
    used: set[int] = set()
    lines: list[RailLine] = []
    order = sorted(groups.items(), key=lambda kv: (kv[1].get("colour") is None, len(kv[0])))
    for _, g in order:
        segs: list[list[list[float]]] = []
        for ref, pts in g["ways"].items():
            if ref in used:
                continue
            used.add(ref)
            for seg in clip(pts, inside):
                simple = geo._dp(seg, SIMPLIFY_TOL)
                segs.append([[round(x, 5), round(y, 5)] for x, y in simple])
        if not segs:
            continue
        tags = g["tags"]
        lines.append(
            RailLine(
                id=f"osm-relation-{min(g['ids'])}",
                name=g["name"],
                name_en=g["name_en"],
                ref=tags.get("ref"),
                operator=g["operator"],
                kind="train" if tags.get("route") == "railway" else tags.get("route", "train"),
                colour=g["colour"],
                coords=segs,
            )
        )
    return sorted(lines, key=lambda x: x.id)


def build_stations(elements: list[osm.OsmElement]) -> list[RailStation]:
    """車站；同名且相距 STATION_MERGE_M 以內的只留一個（東京駅有 JR、地下鐵各自的點）。"""
    kept: list[RailStation] = []
    by_name: dict[str, list[RailStation]] = {}
    for el in sorted(elements, key=lambda e: e.osm_id):
        name = el.tags.get("name:ja") or el.tags.get("name")
        if not name:
            continue
        same = by_name.setdefault(name, [])
        if any(geo.haversine_m(st.lat, st.lng, el.lat, el.lng) <= STATION_MERGE_M for st in same):
            continue
        st = RailStation(
            id=el.osm_id.replace("/", "-"),
            name=name,
            name_en=el.tags.get("name:en"),
            lat=round(el.lat, 6),
            lng=round(el.lng, 6),
        )
        same.append(st)
        kept.append(st)
    return sorted(kept, key=lambda x: x.id)


def write_rail(pref: str, data: RailData) -> None:
    """一條路線、一個車站各一行：座標陣列太長，逐層縮排會讓檔案變得很難看 diff。"""
    RAIL_DIR.mkdir(parents=True, exist_ok=True)
    body = data.model_dump(mode="json", exclude_none=True)
    rows = ["{", f'  "source": {json.dumps(body["source"], ensure_ascii=False)},', '  "lines": [']
    rows += [
        f"    {json.dumps(x, ensure_ascii=False, separators=(',', ':'))}"
        + ("," if i < len(body["lines"]) - 1 else "")
        for i, x in enumerate(body["lines"])
    ]
    rows += ["  ],", '  "stations": [']
    rows += [
        f"    {json.dumps(x, ensure_ascii=False, separators=(',', ':'))}"
        + ("," if i < len(body["stations"]) - 1 else "")
        for i, x in enumerate(body["stations"])
    ]
    rows += ["  ]", "}"]
    (RAIL_DIR / f"{pref}.json").write_text("\n".join(rows) + "\n", encoding="utf-8")


def seed_rail(prefs: list[str]) -> str:
    today = dt.date.today().isoformat()
    lines = ["## 鐵路路線", "", "| 縣 | 路線 | 車站 | 有路線色 |", "|---|---|---|---|"]
    for pref in prefs:
        inside = in_pref(pref)
        log(f"[{pref}] 鐵路路線…")
        rail = build_lines(osm.rail_routes(geo.iso_code(pref)), inside)
        stations = [
            st for st in build_stations(osm.stations(geo.bbox(pref))) if inside(st.lng, st.lat)
        ]
        data = RailData(
            source=Source(url="https://www.openstreetmap.org/", fetched_at=today),
            lines=rail,
            stations=stations,
        )
        write_rail(pref, data)
        coloured = sum(1 for x in rail if x.colour)
        lines.append(f"| {pref} | {len(rail)} | {len(stations)} | {coloured} |")
        log(f"[{pref}]   路線 {len(rail)}（有顏色 {coloured}）、車站 {len(stations)}")
    return "\n".join(lines) + "\n"
