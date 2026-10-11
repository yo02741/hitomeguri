"""鐵路路線圖層（TODO.md「鐵路路線圖層」）：seed-rail 指令。

來源：OpenStreetMap 的鐵路路線 relation（route=train|subway|light_rail|monorail|tram，
以及軌道本身的 route=railway：地方的 JR 線多半只有這種）與車站
（railway=station|halt）。ODbL 授權，UI 已標示「© OpenStreetMap contributors」。
- 同一條路線的上下行、內外回り是不同 relation：以營運者＋去掉方向的名稱合併，路段不重複
- 路線顏色取 OSM 的 colour（多為官方路線色），沒有就由前端用預設的鐵路色
- 只留縣界內的路段（跨縣的新幹線不會把整條線放進每個縣），並簡化線形；車站也只留縣界內的
- 新幹線：路線名稱、network 有「新幹線」，或 relation 標 highspeed=yes、service=high_speed，
  或這條線過半的軌道（way）標 highspeed=yes
- 車站停靠的路線：route relation 的停靠點（stop、platform 角色）對到車站（同名 1 km 內，或 300 m 內
  名稱互相包含；沒有名稱的停靠點取 300 m 內最近的站）。對不到車站點的有名稱停靠點另外成站
  （id「stop-…」，只放 extra_stations）。沒有停靠點的軌道 relation（route=railway）取軌道 150 m 內、
  營運者相容的車站。
- 相鄰站與距離（edges）：一條線的全部軌道（未簡化、不切縣界）接成路網，車站投影到最近的軌道上，
  從每個站沿軌道走到碰到別的站為止，走過的距離就是兩站間的距離（支線、雙線、快車都不影響）。
  公開資料沒有時刻表，所以只有距離，沒有時間。
寫 data/rail/{縣}.json。
"""

from __future__ import annotations

import datetime as dt
import heapq
import json
import math
import re
import unicodedata
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
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
# 車站查詢的範圍框比縣界多這麼多（度，約 20 km）：跨縣的下一站也要在候選裡
STATION_PAD = 0.2
# 停靠點對到車站：同名在這個距離內；名稱互相包含或沒有名稱時在 STOP_NEAR_M 內
STOP_SAME_NAME_M = 1000
STOP_NEAR_M = 300
# 有名稱、對不到車站的停靠點：同名在這個距離內的當成同一站
PSEUDO_MERGE_M = 500
# 沒有停靠點的軌道 relation：車站離軌道這麼近（且營運者相容）才算這條線的站
PROXIMITY_M = 150
# 停靠點投影到軌道的距離上限
SNAP_M = 300
# 軌道的斷點（OSM 的路段偶有沒接上的）在這個距離內就接起來
GAP_M = 50
# 相鄰兩站沿軌道的距離上限（km）；超過就不連
MAX_EDGE_KM = 100
# 停靠點的角色（PTv2 的 stop、platform 與 _entry_only／_exit_only；舊式的 forward_stop 等）
STOP_ROLE = re.compile(
    r"^(forward_|backward_)?(stop|platform|station)(_entry_only|_exit_only)?(_\d+)?$"
)
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


# 路段標籤仍是營運中軌道、但不是旅客路線的：貨物線、建設中（山梨實驗線是現役軌道）、
# 廃線與現役線共用車站附近路段的（志布志線）
NOT_PASSENGER = re.compile(r"(貨物|^中央新幹線$|^志布志線$)")


def is_defunct(tags: dict[str, str]) -> bool:
    """廃線、休止中的線（route=railway 裡有，軌道已不在或沒有列車）。"""
    name = tags.get("name:ja") or tags.get("name") or ""
    return (
        any(k in tags for k in ("disused", "abandoned", "razed"))
        or any(k.startswith(("disused:", "abandoned:")) for k in tags)
        or bool(re.search(r"(廃線|旧線|休止|跡$)", name))
        or bool(NOT_PASSENGER.search(name))
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


def is_shinkansen(tags: dict[str, str]) -> bool:
    """relation 的標籤看得出是新幹線。"""
    text = " ".join(tags.get(k, "") for k in ("name", "name:ja", "network", "network:ja"))
    return "新幹線" in text or tags.get("highspeed") == "yes" or tags.get("service") == "high_speed"


_STATION_SUFFIX = re.compile(
    r"\s*(\([^)]*\)|[0-9][0-9・,、]*番(線|のりば|ホーム)?.*|(のりば|乗り場|乗車口|ホーム)[0-9]*)$"
)


def norm_station(name: str) -> str:
    """比對用的站名：全形半形統一，去掉括號、「1番線」「のりば」與結尾的「駅」。"""
    name = unicodedata.normalize("NFKC", name).strip()
    prev = None
    while prev != name:
        prev = name
        name = _STATION_SUFFIX.sub("", name).strip()
    if len(name) > 1 and name.endswith("駅"):
        name = name[:-1]
    return name


_JR = {
    "北海道旅客鉄道": "JR北海道",
    "東日本旅客鉄道": "JR東日本",
    "東海旅客鉄道": "JR東海",
    "西日本旅客鉄道": "JR西日本",
    "四国旅客鉄道": "JR四国",
    "九州旅客鉄道": "JR九州",
}


def _operators(text: str) -> set[str]:
    out = set()
    for part in re.split(r"[;；]", unicodedata.normalize("NFKC", text)):
        part = part.replace("株式会社", "").strip()
        if part:
            out.add(_JR.get(part, part))
    return out


def operator_ok(line_operator: str | None, station_operators: Iterable[str]) -> bool:
    """營運者相容（任一邊沒有標就算相容）；JR 的正式名稱與簡稱視為相同。"""
    a = _operators(line_operator or "")
    b: set[str] = set()
    for op in station_operators:
        b |= _operators(op)
    if not a or not b:
        return True
    return any(x in y or y in x for x in a for y in b)


Pt = tuple[float, float]  # (經度, 緯度)


def _project(p: Pt, a: Pt, b: Pt) -> tuple[float, float]:
    """點 p 到線段 ab 的（距離 m, 投影位置 t∈[0,1]），等距圓柱近似。"""
    kx, ky = 111_320.0 * math.cos(math.radians(p[1])), 110_540.0
    ax, ay = (a[0] - p[0]) * kx, (a[1] - p[1]) * ky
    bx, by = (b[0] - p[0]) * kx, (b[1] - p[1]) * ky
    dx, dy = bx - ax, by - ay
    seg2 = dx * dx + dy * dy
    t = 0.0 if seg2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg2))
    return math.hypot(ax + t * dx, ay + t * dy), t


def _km(a: Pt, b: Pt) -> float:
    return geo.haversine_m(a[1], a[0], b[1], b[0]) / 1000


class StationIndex:
    """車站的格網索引：停靠點對到車站、找軌道附近的車站。"""

    CELL = 0.01

    def __init__(self, stations: list[RailStation]) -> None:
        self.stations = stations
        self.norm = [norm_station(st.name) for st in stations]
        self.grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        for i, st in enumerate(stations):
            self.grid[self._cell(st.lat, st.lng)].append(i)

    def _cell(self, lat: float, lng: float) -> tuple[int, int]:
        return math.floor(lat / self.CELL), math.floor(lng / self.CELL)

    def near(self, lat: float, lng: float, radius_m: float) -> list[tuple[float, int]]:
        """半徑內的車站 (距離 m, index)，近的在前。"""
        r = int(radius_m / (self.CELL * 80_000)) + 1
        ci, cj = self._cell(lat, lng)
        out = []
        for di in range(-r, r + 1):
            for dj in range(-r, r + 1):
                for i in self.grid.get((ci + di, cj + dj), ()):
                    st = self.stations[i]
                    d = geo.haversine_m(lat, lng, st.lat, st.lng)
                    if d <= radius_m:
                        out.append((d, i))
        return sorted(out)

    def match(self, lat: float, lng: float, name: str | None) -> int | None:
        """停靠點對到哪個車站（index）；對不到時 None。"""
        near = self.near(lat, lng, STOP_SAME_NAME_M if name else STOP_NEAR_M)
        if not name:
            return near[0][1] if near else None
        n = norm_station(name)
        same = [i for _, i in near if self.norm[i] == n]
        if same:
            return same[0]
        close = [
            i for d, i in near if d <= STOP_NEAR_M and (self.norm[i] in n or n in self.norm[i])
        ]
        return close[0] if close else None


class Track:
    """一條線的軌道路網：頂點是 OSM 的點（座標相同就是同一點），邊是軌道的每一段。

    snap() 把站投影到最近的軌道段（finish() 時在投影點切開），neighbours() 從一站沿軌道走到別的站。
    """

    CELL = 0.005

    def __init__(self, ways: Iterable[list[Pt]]) -> None:
        self.pos: list[Pt] = []
        vid: dict[Pt, int] = {}
        segs: set[tuple[int, int]] = set()
        for pts in ways:
            prev: int | None = None
            for p in pts:
                v = vid.get(p)
                if v is None:
                    v = vid[p] = len(self.pos)
                    self.pos.append(p)
                if prev is not None and prev != v:
                    segs.add((min(prev, v), max(prev, v)))
                prev = v
        self.segs = sorted(segs | self._gaps(segs))
        self.grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        c = self.CELL
        for si, (a, b) in enumerate(self.segs):
            (x1, y1), (x2, y2) = self.pos[a], self.pos[b]
            for i in range(math.floor(min(y1, y2) / c), math.floor(max(y1, y2) / c) + 1):
                for j in range(math.floor(min(x1, x2) / c), math.floor(max(x1, x2) / c) + 1):
                    self.grid[(i, j)].append(si)
        self.snaps: dict[int, list[tuple[float, str]]] = defaultdict(list)
        self.adj: list[list[tuple[int, float]]] = []
        self.owner: dict[int, set[str]] = {}

    def _gaps(self, segs: set[tuple[int, int]]) -> set[tuple[int, int]]:
        """路段的端點（度數 1）接到 GAP_M 內最近的其他點。"""
        nbr: dict[int, set[int]] = defaultdict(set)
        for a, b in segs:
            nbr[a].add(b)
            nbr[b].add(a)
        cell = 0.001
        grid: dict[tuple[int, int], list[int]] = defaultdict(list)
        for v, (x, y) in enumerate(self.pos):
            grid[(math.floor(y / cell), math.floor(x / cell))].append(v)
        extra: set[tuple[int, int]] = set()
        for v in sorted(v for v, ws in nbr.items() if len(ws) == 1):
            x, y = self.pos[v]
            ci, cj = math.floor(y / cell), math.floor(x / cell)
            best: tuple[float, int] | None = None
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    for w in grid.get((ci + di, cj + dj), ()):
                        if w == v or w in nbr[v]:
                            continue
                        d = _km(self.pos[v], self.pos[w]) * 1000
                        if d <= GAP_M and (best is None or (d, w) < best):
                            best = (d, w)
            if best:
                extra.add((min(v, best[1]), max(v, best[1])))
        return extra

    def snap(self, key: str, lat: float, lng: float, radius_m: float = SNAP_M) -> bool:
        """把站投影到 radius_m 內最近的軌道段；沒有軌道就 False。"""
        c = self.CELL
        ci, cj = math.floor(lat / c), math.floor(lng / c)
        r = int(radius_m / (c * 80_000)) + 1
        best: tuple[float, int, float] | None = None
        for di in range(-r, r + 1):
            for dj in range(-r, r + 1):
                for si in self.grid.get((ci + di, cj + dj), ()):
                    a, b = self.segs[si]
                    d, t = _project((lng, lat), self.pos[a], self.pos[b])
                    if d <= radius_m and (best is None or (d, si) < best[:2]):
                        best = (d, si, t)
        if best is None:
            return False
        self.snaps[best[1]].append((round(best[2], 9), key))
        return True

    def finish(self) -> None:
        """在投影點切開軌道段，建好鄰接表。"""
        n = len(self.pos)
        owner: dict[int, set[str]] = defaultdict(set)
        adj: dict[int, list[tuple[int, float]]] = defaultdict(list)
        for si, (a, b) in enumerate(self.segs):
            chain = [a]
            for t, key in sorted(self.snaps.get(si, ())):
                if t <= 1e-9 or t >= 1 - 1e-9:
                    owner[a if t <= 1e-9 else b].add(key)
                    continue
                (x1, y1), (x2, y2) = self.pos[a], self.pos[b]
                p = (x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)
                if chain[-1] >= n and self.pos[chain[-1]] == p:
                    owner[chain[-1]].add(key)
                    continue
                v = len(self.pos)
                self.pos.append(p)
                owner[v].add(key)
                chain.append(v)
            chain.append(b)
            for u, w in zip(chain, chain[1:], strict=False):
                km = _km(self.pos[u], self.pos[w])
                adj[u].append((w, km))
                adj[w].append((u, km))
        self.adj = [adj.get(v, []) for v in range(len(self.pos))]
        self.owner = dict(owner)

    def neighbours(self, key: str, max_km: float = MAX_EDGE_KM) -> dict[str, float]:
        """從 key 這站沿軌道走，碰到別的站就停（不越過）：別的站 → 沿軌道距離（km）。"""
        sources = sorted(v for v, keys in self.owner.items() if key in keys)
        dist = {v: 0.0 for v in sources}
        heap = [(0.0, v) for v in sources]
        found: dict[str, float] = {}
        done: set[int] = set()
        while heap:
            d, v = heapq.heappop(heap)
            if v in done:
                continue
            done.add(v)
            others = self.owner.get(v, set()) - {key}
            for t in others:
                found[t] = min(found.get(t, math.inf), d)
            if others and d > 0:
                continue
            for w, km in self.adj[v]:
                nd = d + km
                if nd <= max_km and nd < dist.get(w, math.inf):
                    dist[w] = nd
                    heapq.heappush(heap, (nd, w))
        return found


@dataclass
class _Group:
    """同一條線（去掉方向、種別後同名）的 relation。"""

    name: str
    tags: dict[str, str]
    ids: list[int] = field(default_factory=list)
    rels: list[dict[str, Any]] = field(default_factory=list)
    ways: dict[int, list[Pt]] = field(default_factory=dict)
    operator: str | None = None
    colour: str | None = None
    name_en: str | None = None


def _stops(
    rel: dict[str, Any], names: dict[tuple[str, int], str]
) -> list[tuple[float, float, str | None, int]]:
    """relation 的停靠點：(緯度, 經度, 名稱, 成員 id)；平台是 way 時取幾何的平均。"""
    out = []
    for m in rel.get("members", []):
        if not STOP_ROLE.match(m.get("role") or ""):
            continue
        if m.get("type") == "node" and "lat" in m:
            lat, lng = m["lat"], m["lon"]
        elif m.get("type") == "way" and m.get("geometry"):
            g = m["geometry"]
            lat = sum(p["lat"] for p in g) / len(g)
            lng = sum(p["lon"] for p in g) / len(g)
        else:
            continue
        out.append((lat, lng, names.get((m["type"], m["ref"])), m["ref"]))
    return out


def _groups(elements: list[dict[str, Any]]) -> dict[str, _Group]:
    # 營運中的旅客線路段（查詢另外回傳的 way id）；沒有這份清單時（測試）全部都算
    active = {el["id"] for el in elements if el.get("type") == "way"}
    # 以去掉方向的名稱合併：營運者的標法常不一致（「西日本旅客鉄道」與空白），同名視為同一條線
    groups: dict[str, _Group] = {}
    for el in elements:
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        name = tags.get("name:ja") or tags.get("name")
        if not name or is_service(name) or is_defunct(tags):
            continue
        g = groups.setdefault(base_name(name), _Group(name=base_name(name), tags=tags))
        g.operator = g.operator or tags.get("operator") or tags.get("network")
        g.ids.append(el["id"])
        g.rels.append(el)
        # 路線色、英文名：上下行只有一邊有標時也要用到
        g.colour = g.colour or colour(tags.get("colour"))
        g.name_en = g.name_en or tags.get("name:en")
        # 路段（成員 way）：站台、車站等其他角色不要
        for m in el.get("members", []):
            if m.get("type") != "way" or m.get("role") not in ("", "forward", "backward"):
                continue
            geom = m.get("geometry") or []
            if active and m["ref"] not in active:
                continue
            if len(geom) >= 2 and m["ref"] not in g.ways:
                g.ways[m["ref"]] = [(p["lon"], p["lat"]) for p in geom]
    return groups


Snaps = dict[str, list[tuple[float, float, float]]]  # 站 → [(緯度, 經度, 投影距離上限 m)]


def build_rail(
    data: dict[str, Any],
    stations: list[RailStation],
    inside: Inside,
    operators: dict[str, set[str]] | None = None,
) -> tuple[list[RailLine], list[RailStation], list[RailStation]]:
    """（路線, 縣內的車站（含停靠的路線）, edges 用到的其他站）。

    stations 是範圍框內（含縣外）全部的車站；operators 是各站的營運者（軌道附近的站要相容）。
    """
    elements = data.get("elements", [])
    operators = operators or {}
    highspeed = {
        el["id"]
        for el in elements
        if el.get("type") == "way" and (el.get("tags") or {}).get("highspeed") == "yes"
    }
    # 停靠點的名稱（查詢另外回傳有名稱的成員 node）
    names = {
        (el["type"], el["id"]): el["tags"].get("name:ja") or el["tags"]["name"]
        for el in elements
        if el.get("type") == "node" and (el.get("tags") or {}).get("name")
    }
    groups = _groups(elements)

    # ---- 每條線停靠的站 ----
    index = StationIndex(stations)
    coords: dict[str, tuple[float, float, str]] = {
        st.id: (st.lat, st.lng, st.name) for st in stations
    }
    pseudo: dict[str, list[tuple[float, float, str]]] = defaultdict(list)

    def pseudo_key(lat: float, lng: float, name: str, ref: int) -> str:
        """對不到車站點的停靠點：同名 PSEUDO_MERGE_M 內算同一站。"""
        n = norm_station(name)
        for plat, plng, key in pseudo[n]:
            if geo.haversine_m(lat, lng, plat, plng) <= PSEUDO_MERGE_M:
                return key
        key = f"stop-{ref}"
        pseudo[n].append((lat, lng, key))
        coords[key] = (lat, lng, name)
        return key

    served: dict[str, Snaps] = {}
    for key, g in sorted(groups.items(), key=lambda kv: min(kv[1].ids)):
        snaps: Snaps = defaultdict(list)
        for rel in sorted(g.rels, key=lambda r: r["id"]):
            stops = _stops(rel, names)
            for lat, lng, name, ref in stops:
                i = index.match(lat, lng, name)
                if i is not None:
                    snaps[stations[i].id].append((lat, lng, SNAP_M))
                elif name:
                    snaps[pseudo_key(lat, lng, name, ref)].append((lat, lng, SNAP_M))
            if not stops:
                _near_track(g, rel, index, operators, snaps)
        served[key] = snaps

    # ---- 路線：同一段軌道只畫一次（直通運轉、多個營運者各有一份 relation） ----
    # 有官方路線色的先、名稱短的先（「京都市営地下鉄烏丸線」先於「京都地下鉄烏丸線・近鉄京都線」）
    here = {st.id for st in stations if inside(st.lng, st.lat)}
    used: set[int] = set()
    lines: list[RailLine] = []
    line_of: dict[str, str] = {}
    for key, g in sorted(
        groups.items(), key=lambda kv: (kv[1].colour is None, len(kv[0]), min(kv[1].ids))
    ):
        segs: list[list[list[float]]] = []
        for ref, pts in g.ways.items():
            if ref in used:
                continue
            used.add(ref)
            for seg in clip(pts, inside):
                simple = geo._dp(seg, SIMPLIFY_TOL)
                segs.append([[round(x, 5), round(y, 5)] for x, y in simple])
        edges = line_edges(g, served[key], coords, inside)
        # 軌道全被別的線畫掉的線（東京都內的東北新幹線）也要留：車站要查得到它
        if not segs and not edges and not any(sid in here for sid in served[key]):
            continue
        hs = sum(1 for ref in g.ways if ref in highspeed)
        line = RailLine(
            id=f"osm-relation-{min(g.ids)}",
            name=g.name,
            name_en=g.name_en,
            ref=g.tags.get("ref"),
            operator=g.operator,
            kind="train" if g.tags.get("route") == "railway" else g.tags.get("route", "train"),
            colour=g.colour,
            shinkansen=any(is_shinkansen(r.get("tags", {})) for r in g.rels)
            or (bool(g.ways) and hs * 2 >= len(g.ways)),
            coords=segs,
            edges=edges,
        )
        lines.append(line)
        line_of[key] = line.id
    lines.sort(key=lambda x: x.id)

    # ---- 縣內車站：停靠的路線、新幹線 ----
    lines_at: dict[str, set[str]] = defaultdict(set)
    for key, snaps in served.items():
        if key in line_of:
            for sid in snaps:
                lines_at[sid].add(line_of[key])
    shinkansen = {x.id for x in lines if x.shinkansen}
    kept = []
    for st in stations:
        if st.id in here:
            ids = sorted(lines_at.get(st.id, ()))
            kept.append(
                st.model_copy(update={"lines": ids, "shinkansen": bool(shinkansen & set(ids))})
            )
    kept_ids = {st.id for st in kept}
    extra = [
        RailStation(id=i, name=coords[i][2], lat=round(coords[i][0], 6), lng=round(coords[i][1], 6))
        for i in sorted({e for x in lines for a, b, _ in x.edges for e in (a, b)} - kept_ids)
    ]
    return lines, sorted(kept, key=lambda x: x.id), extra


def _near_track(
    g: _Group,
    rel: dict[str, Any],
    index: StationIndex,
    operators: dict[str, set[str]],
    snaps: Snaps,
) -> None:
    """沒有停靠點的軌道 relation（route=railway）：軌道 PROXIMITY_M 內、營運者相容的車站。"""
    refs = sorted({m["ref"] for m in rel.get("members", []) if m.get("type") == "way"})
    for ref in refs:
        pts = g.ways.get(ref) or []
        for a, b in zip(pts, pts[1:], strict=False):
            half = _km(a, b) * 500
            for _, i in index.near((a[1] + b[1]) / 2, (a[0] + b[0]) / 2, half + PROXIMITY_M):
                st = index.stations[i]
                if any(p[2] == PROXIMITY_M for p in snaps.get(st.id, ())):
                    continue
                d, _ = _project((st.lng, st.lat), a, b)
                if d <= PROXIMITY_M and operator_ok(g.operator, operators.get(st.id, ())):
                    snaps[st.id].append((st.lat, st.lng, PROXIMITY_M))


def line_edges(
    g: _Group, snaps: Snaps, coords: dict[str, tuple[float, float, str]], inside: Inside
) -> list[tuple[str, str, float]]:
    """一條線的相鄰站與沿軌道距離（km，小數 2 位）；只留至少一端在縣內的。"""
    if not g.ways or len(snaps) < 2:
        return []
    track = Track(g.ways.values())
    for key in sorted(snaps):
        for lat, lng, radius in snaps[key]:
            track.snap(key, lat, lng, radius)
    track.finish()
    snapped = sorted({k for keys in track.owner.values() for k in keys})
    out: dict[tuple[str, str], float] = {}
    for key in snapped:
        if not inside(coords[key][1], coords[key][0]):
            continue
        for other, d in track.neighbours(key).items():
            if d <= 0:  # 投影到同一點：用兩站的直線距離
                d = geo.haversine_m(*coords[key][:2], *coords[other][:2]) / 1000
            pair = (key, other) if key < other else (other, key)
            out[pair] = min(out.get(pair, math.inf), max(round(d, 2), 0.01))
    return [(a, b, km) for (a, b), km in sorted(out.items())]


def build_lines(data: dict[str, Any], inside: Inside) -> list[RailLine]:
    """只要路線（沒有車站資料時）。"""
    return build_rail(data, [], inside)[0]


def build_stations(
    elements: list[osm.OsmElement], operators: dict[str, set[str]] | None = None
) -> list[RailStation]:
    """車站；同名且相距 STATION_MERGE_M 以內的只留一個（東京駅有 JR、地下鐵各自的點）。

    operators 有給時，記下每個留下的站（含合併進來的點）的營運者（operator 標籤）。
    """
    kept: list[RailStation] = []
    by_name: dict[str, list[RailStation]] = {}
    for el in sorted(elements, key=lambda e: e.osm_id):
        name = el.tags.get("name:ja") or el.tags.get("name")
        if not name:
            continue
        same = by_name.setdefault(name, [])
        st = next(
            (s for s in same if geo.haversine_m(s.lat, s.lng, el.lat, el.lng) <= STATION_MERGE_M),
            None,
        )
        if st is None:
            st = RailStation(
                id=el.osm_id.replace("/", "-"),
                name=name,
                name_en=el.tags.get("name:en"),
                lat=round(el.lat, 6),
                lng=round(el.lng, 6),
            )
            same.append(st)
            kept.append(st)
        if operators is not None and el.tags.get("operator"):
            operators.setdefault(st.id, set()).add(el.tags["operator"])
    return sorted(kept, key=lambda x: x.id)


def render_rail(data: RailData) -> str:
    """一條路線、一個車站各一行：座標陣列太長，逐層縮排會讓檔案變得很難看 diff。
    預設值（沒有停靠路線、不是新幹線、沒有 edges）不寫。"""
    body = data.model_dump(mode="json", exclude_none=True, exclude_defaults=True)
    rows = ["{", f'  "source": {json.dumps(body["source"], ensure_ascii=False)},']
    keys = ["lines", "stations"] + (["extra_stations"] if data.extra_stations else [])
    for n, key in enumerate(keys):
        items = body.get(key, [])
        rows.append(f'  "{key}": [')
        rows += [
            f"    {json.dumps(x, ensure_ascii=False, separators=(',', ':'))}"
            + ("," if i < len(items) - 1 else "")
            for i, x in enumerate(items)
        ]
        rows.append("  ]" + ("," if n < len(keys) - 1 else ""))
    rows.append("}")
    return "\n".join(rows) + "\n"


def write_rail(pref: str, data: RailData) -> None:
    RAIL_DIR.mkdir(parents=True, exist_ok=True)
    (RAIL_DIR / f"{pref}.json").write_text(render_rail(data), encoding="utf-8")


def seed_rail(prefs: list[str]) -> str:
    today = dt.date.today().isoformat()
    lines = [
        "## 鐵路路線",
        "",
        "| 縣 | 路線 | 新幹線 | 車站 | 有停靠路線 | 相鄰站 | 縣外站 | 有路線色 |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for pref in prefs:
        inside = in_pref(pref)
        log(f"[{pref}] 鐵路路線…")
        operators: dict[str, set[str]] = {}
        nearby = build_stations(osm.stations(geo.bbox(pref, pad=STATION_PAD)), operators)
        rail, stations, extra = build_rail(
            osm.rail_routes(geo.iso_code(pref)), nearby, inside, operators
        )
        data = RailData(
            source=Source(url="https://www.openstreetmap.org/", fetched_at=today),
            lines=rail,
            stations=stations,
            extra_stations=extra,
        )
        write_rail(pref, data)
        coloured = sum(1 for x in rail if x.colour)
        hs = sum(1 for x in rail if x.shinkansen)
        served = sum(1 for st in stations if st.lines)
        edges = sum(len(x.edges) for x in rail)
        lines.append(
            f"| {pref} | {len(rail)} | {hs} | {len(stations)} | {served} | {edges} "
            f"| {len(extra)} | {coloured} |"
        )
        log(
            f"[{pref}]   路線 {len(rail)}（新幹線 {hs}、有顏色 {coloured}）、車站 {len(stations)}"
            f"（有停靠路線 {served}）、相鄰站 {edges}"
        )
    return "\n".join(lines) + "\n"
