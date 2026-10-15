"""鐵路路網（docs/PROGRESS.md「縣內規劃」4：日帰り）：build-rail-graph，離線由 data/rail/*.json 建置。

- 節點：各縣的車站。比對用站名相同（rail.norm_station）且相距 500 m 內的合併成一個（縣界附近
  兩縣都收到的站）。edges 另一端的站（extra_stations：縣外、沒有車站點的停靠點）先依 id，
  再依同名 800 m 內對到節點；都對不到就自成一個節點（地圖上不顯示，只用來連路網）。
- 邊：每條線相鄰兩站的沿軌道距離（km），同一對站取最短；新幹線與在來線分開記。
  不同名、相距 400 m 內的站加步行轉乘邊（大阪と梅田、上野と京成上野），距離取直線距離。
- 最短距離：Dijkstra。新幹線的邊權重乘 0.97，和在來線距離差不多時走新幹線；回報實際的 km
  （最多比真正的最短距離多 3%）。路徑上新幹線的距離 ≥ 20 km 才算「可以搭新幹線」
  （東京→品川一站的新幹線不算）。
- 公開資料沒有時刻表，所以只有距離：介面寫「鐵路約 n km」與能否搭新幹線，不寫時間。

輸出 web/public/bundles/rail-graph.json：
  nodes：[id, 站名, 緯度, 經度, 縣（縣外的停靠點為 ""）, 新幹線 1/0]，依 id 排序
  edges：[a, b, km, 種類]，a < b 是 nodes 的 index；種類 0 在來線、1 新幹線、2 步行轉乘
"""

from __future__ import annotations

import heapq
import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pipeline.geo import haversine_m
from pipeline.models import RailData
from pipeline.paths import BUNDLES_DIR, RAIL_DIR
from pipeline.rail import norm_station

MERGE_M = 500
EXTRA_MATCH_M = 800
TRANSFER_M = 400
SHINKANSEN_WEIGHT = 0.97
SHINKANSEN_MIN_KM = 20.0
RAIL, SHINKANSEN, WALK = 0, 1, 2


@dataclass
class Node:
    id: str
    name: str
    lat: float
    lng: float
    pref: str
    shinkansen: bool = False


@dataclass
class Route:
    km: float
    shinkansen_km: float
    path: list[str] = field(default_factory=list)

    @property
    def shinkansen(self) -> bool:
        return self.shinkansen_km >= SHINKANSEN_MIN_KM


@dataclass
class Graph:
    nodes: list[Node]
    edges: list[tuple[int, int, float, int]]
    # 車站 id（含合併掉的、縣外站的 id）→ 節點 index
    alias: dict[str, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.index = {n.id: i for i, n in enumerate(self.nodes)}
        for k, v in self.index.items():
            self.alias.setdefault(k, v)
        self.adj: list[list[tuple[int, float, int]]] = [[] for _ in self.nodes]
        for a, b, km, kind in self.edges:
            self.adj[a].append((b, km, kind))
            self.adj[b].append((a, km, kind))
        self.by_name: dict[str, list[int]] = defaultdict(list)
        for i, n in enumerate(self.nodes):
            self.by_name[norm_station(n.name)].append(i)

    def node_id(self, station_id: str) -> str | None:
        """車站 id → 路網節點 id（合併過的站回傳代表站）。"""
        i = self.alias.get(station_id)
        return self.nodes[i].id if i is not None else None

    def nearest_node(self, name: str, lat: float, lng: float, max_m: float) -> str | None:
        """同名、max_m 以內最近的節點 id（景點的最近車站對到路網）。"""
        best: tuple[float, str] | None = None
        for i in self.by_name.get(norm_station(name), ()):
            n = self.nodes[i]
            d = haversine_m(lat, lng, n.lat, n.lng)
            if d <= max_m and (best is None or (d, n.id) < best):
                best = (d, n.id)
        return best[1] if best else None


def _merge_close(items: list[tuple[str, str, float, float]], radius: float) -> dict[str, str]:
    """同名（正規化）且 radius 內的併成一組：id → 組代表（id 最小的）。"""
    parent: dict[str, str] = {i[0]: i[0] for i in items}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_name: dict[str, list[tuple[str, float, float]]] = defaultdict(list)
    for sid, name, lat, lng in items:
        by_name[norm_station(name)].append((sid, lat, lng))
    for group in by_name.values():
        for i, (a, la, lo) in enumerate(group):
            for b, lb, lob in group[i + 1 :]:
                if haversine_m(la, lo, lb, lob) <= radius:
                    ra, rb = find(a), find(b)
                    if ra != rb:
                        parent[max(ra, rb)] = min(ra, rb)
    return {sid: find(sid) for sid in parent}


def build_graph(rail_dir: Path = RAIL_DIR) -> Graph:
    files = sorted(rail_dir.glob("*.json")) if rail_dir.exists() else []
    datas = [(p.stem, RailData.model_validate_json(p.read_text(encoding="utf-8"))) for p in files]
    stations = {st.id: (st, pref) for pref, d in datas for st in d.stations}
    rep = _merge_close([(s.id, s.name, s.lat, s.lng) for s, _ in stations.values()], MERGE_M)
    nodes: list[Node] = []
    alias: dict[str, int] = {}
    for sid in sorted(stations):
        if rep[sid] != sid:
            continue
        st, pref = stations[sid]
        alias[sid] = len(nodes)
        nodes.append(Node(sid, st.name, st.lat, st.lng, pref, st.shinkansen))
    for sid in sorted(stations):
        node = alias[rep[sid]]
        alias[sid] = node
        nodes[node].shinkansen |= stations[sid][0].shinkansen
    # 縣外站與停靠點：先依 id，再依同名 EXTRA_MATCH_M 內；都對不到就自成節點
    by_name: dict[str, list[int]] = defaultdict(list)
    for i, n in enumerate(nodes):
        by_name[norm_station(n.name)].append(i)
    extras = {st.id: st for _, d in datas for st in d.extra_stations}
    for eid in sorted(extras):
        if eid in alias:
            continue
        st = extras[eid]
        near = [
            (haversine_m(st.lat, st.lng, nodes[i].lat, nodes[i].lng), nodes[i].id, i)
            for i in by_name[norm_station(st.name)]
        ]
        near = [x for x in near if x[0] <= EXTRA_MATCH_M]
        if near:
            alias[eid] = min(near)[2]
            continue
        alias[eid] = len(nodes)
        by_name[norm_station(st.name)].append(len(nodes))
        nodes.append(Node(eid, st.name, st.lat, st.lng, ""))
    # 邊：同一對站、同一種類取最短
    best: dict[tuple[int, int, int], float] = {}
    for _, d in datas:
        for line in d.lines:
            kind = SHINKANSEN if line.shinkansen else RAIL
            for a, b, km in line.edges:
                if a not in alias or b not in alias:
                    continue
                i, j = sorted((alias[a], alias[b]))
                if i != j:
                    best[(i, j, kind)] = min(best.get((i, j, kind), math.inf), km)
    for i, j in _transfers(nodes):
        km = round(haversine_m(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng) / 1000, 2)
        best[(i, j, WALK)] = max(km, 0.01)
    # 節點依 id 排序，邊依 index 排序（輸出穩定）
    order = sorted(range(len(nodes)), key=lambda i: nodes[i].id)
    new = {old: k for k, old in enumerate(order)}
    edges = sorted(
        (min(new[i], new[j]), max(new[i], new[j]), km, kind) for (i, j, kind), km in best.items()
    )
    return Graph(
        nodes=[nodes[i] for i in order],
        edges=edges,
        alias={sid: new[i] for sid, i in alias.items()},
    )


def _transfers(nodes: list[Node]) -> list[tuple[int, int]]:
    """不同名、相距 TRANSFER_M 內的站（步行轉乘）。"""
    cell = 0.01
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, n in enumerate(nodes):
        grid[(math.floor(n.lat / cell), math.floor(n.lng / cell))].append(i)
    names = [norm_station(n.name) for n in nodes]
    out = []
    for i, n in enumerate(nodes):
        ci, cj = math.floor(n.lat / cell), math.floor(n.lng / cell)
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for j in grid.get((ci + di, cj + dj), ()):
                    if j <= i or names[i] == names[j]:
                        continue
                    if haversine_m(n.lat, n.lng, nodes[j].lat, nodes[j].lng) <= TRANSFER_M:
                        out.append((i, j))
    return sorted(out)


# ---------- 查詢 ----------


def _search(
    g: Graph, src: int, max_km: float | None = None, target: int | None = None
) -> tuple[dict[int, float], dict[int, float], dict[int, int]]:
    """Dijkstra（新幹線權重 SHINKANSEN_WEIGHT）：回傳（實際 km, 新幹線 km, 前一站）。"""
    weight = {src: 0.0}
    km = {src: 0.0}
    skm = {src: 0.0}
    prev: dict[int, int] = {}
    heap = [(0.0, src)]
    done: set[int] = set()
    while heap:
        w, v = heapq.heappop(heap)
        if v in done:
            continue
        done.add(v)
        if v == target:
            break
        for u, d, kind in g.adj[v]:
            nw = w + d * (SHINKANSEN_WEIGHT if kind == SHINKANSEN else 1.0)
            if max_km is not None and nw > max_km:
                continue
            if nw < weight.get(u, math.inf):
                weight[u] = nw
                km[u] = km[v] + d
                skm[u] = skm[v] + (d if kind == SHINKANSEN else 0.0)
                prev[u] = v
                heapq.heappush(heap, (nw, u))
    return (
        {v: km[v] for v in done},
        {v: skm[v] for v in done},
        {v: p for v, p in prev.items() if v in done},
    )


def shortest(g: Graph, a: str, b: str) -> Route | None:
    """兩站間的鐵路距離；a、b 是車站 id（合併掉的 id 也可以）。連不到時 None。"""
    if a not in g.alias or b not in g.alias:
        return None
    src, dst = g.alias[a], g.alias[b]
    km, skm, prev = _search(g, src, target=dst)
    if dst not in km:
        return None
    path = [dst]
    while path[-1] != src:
        path.append(prev[path[-1]])
    return Route(
        round(km[dst], 1), round(skm[dst], 1), [g.nodes[i].id for i in reversed(path)]
    )


def within(g: Graph, base: str, max_km: float) -> dict[str, Route]:
    """從 base 站沿鐵路 max_km 以內的站（含 base 本身）→ 距離（path 不填）。"""
    if base not in g.alias:
        return {}
    km, skm, _ = _search(g, g.alias[base], max_km=max_km)
    return {
        g.nodes[v].id: Route(round(d, 1), round(skm[v], 1))
        for v, d in sorted(km.items())
        if d <= max_km
    }


# ---------- bundle ----------


def to_bundle(g: Graph) -> dict[str, Any]:
    return {
        "attribution": "© OpenStreetMap contributors",
        "nodes": [
            [n.id, n.name, round(n.lat, 5), round(n.lng, 5), n.pref, int(n.shinkansen)]
            for n in g.nodes
        ],
        "edges": [[a, b, km, kind] for a, b, km, kind in g.edges],
    }


def from_bundle(data: dict[str, Any]) -> Graph:
    return Graph(
        nodes=[Node(i, n, la, lo, p, bool(s)) for i, n, la, lo, p, s in data["nodes"]],
        edges=[(a, b, km, kind) for a, b, km, kind in data["edges"]],
    )


def components(g: Graph) -> list[int]:
    """連通的大小（大到小）。"""
    seen = [False] * len(g.nodes)
    sizes = []
    for s in range(len(g.nodes)):
        if seen[s]:
            continue
        seen[s] = True
        stack, size = [s], 0
        while stack:
            v = stack.pop()
            size += 1
            for u, _, _ in g.adj[v]:
                if not seen[u]:
                    seen[u] = True
                    stack.append(u)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def report(g: Graph, size: int | None = None) -> str:
    kinds = [sum(1 for e in g.edges if e[3] == k) for k in (RAIL, SHINKANSEN, WALK)]
    comps = components(g)
    lonely = sum(1 for a in g.adj if not a)
    lines = [
        "## 鐵路路網",
        "",
        f"- 節點 {len(g.nodes)}（新幹線站 {sum(1 for n in g.nodes if n.shinkansen)}、"
        f"縣外或沒有車站點的停靠點 {sum(1 for n in g.nodes if not n.pref)}）",
        f"- 邊：在來線 {kinds[0]}、新幹線 {kinds[1]}、步行轉乘 {kinds[2]}",
        f"- 連通：{len(comps)} 塊，最大 {comps[0] if comps else 0} 站；沒有邊的站 {lonely}",
    ]
    if size is not None:
        lines.append(f"- rail-graph.json：{size // 1024} KB")
    return "\n".join(lines) + "\n"


def write_bundle(g: Graph, dst: Path = BUNDLES_DIR) -> Path:
    path = dst / "rail-graph.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(to_bundle(g), ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    return path
