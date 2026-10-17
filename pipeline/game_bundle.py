"""番外篇（/play 的像素遊戲）用的小 bundle：一縣一檔 game/{縣}.json。

遊戲只用到選得到的鎮的景點（每鎮前幾個）、簡介的第一句、縣內的路網，整份地圖、簡介、全國路網、
大阪的地圖（只取関西国際空港一筆）合起來 gzip 約 740 KB，這裡只留遊戲要的（約 120 KB）。
做法跟 web/src/game/fixtures/build-fixtures.mjs 以前的算法一樣，fixture 也改成從這裡拷
（測試與執行時同一份）。讀的是 build_bundles 剛寫好的 bundle（map、detail、rail、municipalities、
festivals、specialties、packs、seasons、rail-graph），所以要在那些之後跑。
"""

from __future__ import annotations

import hashlib
import heapq
import json
import math
import re
from pathlib import Path
from typing import Any

from pipeline import topo

#: 遊戲的縣（web/src/game/play/world.ts 的 PLAY_PREFS）
GAME_PREFS = ("kyoto", "okinawa")
#: 每個市区町村取分數前 TOP 個景點，市区町村取分數總和前 TOWNS 個（再加有名城蓋章地點的）
TOWNS = 12
TOP = 16
#: 簡介只留前幾個字（遊戲只說第一句）
SUMMARY_CUT = 160
#: 京都駅（京都 → 関西国際空港的路徑從這裡算）
KYOTO_STATION = "node-267316272"
#: 角色主題的店不放進遊戲（web/src/game/world/data.ts 的 CHARACTER_SHOP）
CHARACTER_SHOP = re.compile(
    r"キティ|きてぃ|kitty|サンリオ|sanrio|スヌーピー|snoopy|ミッフィー|miffy|リラックマ|rilakkuma"
    r"|ポケモン|pokemon|ピカチュウ|ジブリ|ghibli|トトロ|totoro|ムーミン|moomin",
    re.I,
)
#: 新幹線的權重（services/daytrip.ts 的 SHINKANSEN_WEIGHT）
SHINKANSEN = 1
SHINKANSEN_WEIGHT = 0.97


def _r5(v: float) -> float:
    """小數 5 位（JS 的 Math.round：.5 往上）"""
    return math.floor(v * 1e5 + 0.5) / 1e5


def _cut(s: str | None) -> str | None:
    return s[:SUMMARY_CUT] if s and len(s) > SUMMARY_CUT else s


def _slim_summary(s: dict[str, Any] | None) -> dict[str, Any] | None:
    if not s:
        return None
    out = {**s, "text": _cut(s.get("text"))}
    if s.get("text_zh"):
        out["text_zh"] = _cut(s["text_zh"])
    return out


def _drop(d: dict[str, Any], *keys: str) -> dict[str, Any]:
    return {k: v for k, v in d.items() if k not in keys}


def _bbox(geom: dict[str, Any]) -> list[float]:
    x0 = y0 = math.inf
    x1 = y1 = -math.inf
    for poly in geom["coordinates"]:
        for ring in poly:
            for x, y in ring:
                x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
    return [_r5(x0), _r5(y0), _r5(x1), _r5(y1)]


def _touching(features: list[dict[str, Any]]) -> dict[str, list[str]]:
    """相鄰的市区町村：兩個區界有 2 個以上共用的點（小數 5 位）"""
    at: dict[str, set[str]] = {}
    for f in features:
        for poly in f["geometry"]["coordinates"]:
            for ring in poly:
                for x, y in ring:
                    k = f"{math.floor(x * 1e5 + 0.5)},{math.floor(y * 1e5 + 0.5)}"
                    at.setdefault(k, set()).add(f["properties"]["m"])
    pairs: dict[tuple[str, str], int] = {}
    for codes in at.values():
        if len(codes) < 2:
            continue
        lst = sorted(codes)
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                pairs[(lst[i], lst[j])] = pairs.get((lst[i], lst[j]), 0) + 1
    out: dict[str, list[str]] = {}
    for (a, b), n in pairs.items():
        if n < 2:
            continue
        out.setdefault(a, []).append(b)
        out.setdefault(b, []).append(a)
    return {k: sorted(v) for k, v in out.items()}


def _code_at(
    features: list[dict[str, Any]], boxes: dict[str, list[float]], lat: float, lng: float
) -> str | None:
    """這個點在哪一個市区町村（point-in-polygon；外框先篩）"""
    for f in features:
        b = boxes.get(f["properties"]["m"])
        if b and not (b[0] <= lng <= b[2] and b[1] <= lat <= b[3]):
            continue
        if topo.contains(f["geometry"]["coordinates"], lng, lat):
            return str(f["properties"]["m"])
    return None


def _path_nodes(graph: dict[str, Any], src: str, dst: str) -> list[str]:
    """路網上 src → dst 的最短路徑經過的節點（daytrip.ts 一樣的權重）"""
    nodes = graph["nodes"]
    idx = {n[0]: i for i, n in enumerate(nodes)}
    if src not in idx or dst not in idx:
        return []
    adj: list[list[tuple[int, float, int]]] = [[] for _ in nodes]
    for a, b, km, k in graph["edges"]:
        adj[a].append((b, km, k))
        adj[b].append((a, km, k))
    s, t = idx[src], idx[dst]
    dist = {s: 0.0}
    prev: dict[int, int] = {}
    heap = [(0.0, s)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, math.inf):
            continue
        if u == t:
            break
        for v, km, k in adj[u]:
            w = d + km * (SHINKANSEN_WEIGHT if k == SHINKANSEN else 1)
            if w < dist.get(v, math.inf):
                dist[v] = w
                prev[v] = u
                heapq.heappush(heap, (w, v))
    if t not in dist:
        return []
    out = []
    u: int | None = t
    while u is not None:
        out.append(nodes[u][0])
        u = prev.get(u)
    return out


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _read_or(path: Path, default: Any) -> Any:
    return _read(path) if path.exists() else default


def game_pref(bundles: Path, pref: str, graph: dict[str, Any]) -> dict[str, Any] | None:
    """一縣的遊戲資料（PrefRaw 的形狀：web/src/game/world/types.ts）；少了必要的檔回 None"""
    need = [bundles / "map" / f"{pref}.json", bundles / "municipalities" / f"{pref}.json"]
    if not all(p.exists() for p in need):
        return None
    mp: list[dict[str, Any]] = _read(bundles / "map" / f"{pref}.json")
    detail_path = bundles / "detail" / f"{pref}.json"
    detail = {s["id"]: s for s in _read(detail_path)} if detail_path.exists() else {}
    castles_all = _read_or(bundles / "packs" / "castle.json", [])
    shinise_all = _read_or(bundles / "packs" / "shinise.json", [])

    total: dict[str, float] = {}
    for s in mp:
        total[s.get("m")] = total.get(s.get("m"), 0) + s["s"]
    ranked = sorted(total.items(), key=lambda kv: -kv[1])
    towns = [m for m, _ in ranked[:TOWNS]]
    castles = sorted((c for c in castles_all if c.get("p") == pref), key=lambda c: c["id"])
    for c in castles:
        if not c.get("st"):
            continue
        s = next((x for x in mp if x["id"] == c.get("s")), None)
        if s and s.get("m") and s["m"] not in towns:
            towns.append(s["m"])

    spots: list[dict[str, Any]] = []
    for m in towns:
        in_town = sorted((s for s in mp if s.get("m") == m), key=lambda s: -s["s"])[:TOP]
        for s in in_town:
            rest = _drop(s, "i", "ia", "si")
            d = detail.get(s["id"])
            if d:
                rest["name"] = d["name"]
                summary = _slim_summary(d.get("summary"))
                if summary:
                    rest["summary"] = summary
                rest["nearest"] = (d.get("nearest_stations") or [])[:2]
                if d.get("sources"):
                    rest["src"] = d["sources"][0]["url"]
            spots.append(rest)
    # 機場一定放（飛機的起降）
    have = {s["id"] for s in spots}
    for s in mp:
        if s.get("c") == "機場" and s["id"] not in have:
            spots.append(_drop(s, "i", "ia", "si"))
    spots.sort(key=lambda s: s["id"])

    mun = _read(bundles / "municipalities" / f"{pref}.json")
    touches = _touching(mun["features"])
    municipalities = sorted(
        (
            {
                **f["properties"],
                "bbox": _bbox(f["geometry"]),
                "touches": touches.get(f["properties"]["m"], []),
            }
            for f in mun["features"]
        ),
        key=lambda m: m["m"],
    )
    boxes = {m["m"]: m["bbox"] for m in municipalities}

    def code_at(p: dict[str, Any]) -> str | None:
        return _code_at(mun["features"], boxes, p["lat"], p["lng"])

    rail_path = bundles / "rail" / f"{pref}.json"
    rail = _read(rail_path) if rail_path.exists() else {"lines": [], "stations": []}
    lines = [_drop(line, "g", "c") for line in rail["lines"]]
    stations = sorted(rail["stations"], key=lambda s: s["id"])

    def slim_list(path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        out = []
        for x in _read(path):
            item = _drop(x, "images", "summary")
            summary = _slim_summary(x.get("summary"))
            if summary:
                item["summary"] = summary
            out.append(item)
        return sorted(out, key=lambda x: x["id"])

    festivals = slim_list(bundles / "festivals" / f"{pref}.json")
    for f in festivals:
        if f.get("location"):
            f["m"] = code_at(f["location"])
    specialties = slim_list(bundles / "specialties" / f"{pref}.json")
    shinise = sorted(
        (
            {**x, "m": code_at(x)}
            for x in shinise_all
            if x.get("p") == pref and not CHARACTER_SHOP.search(x.get("n", ""))
        ),
        key=lambda x: x["id"],
    )

    seasons_all = _read_or(
        bundles / "seasons.json", {"source": {"url": "", "fetched_at": ""}, "stations": []}
    )
    seasons = {
        "source": seasons_all["source"],
        "stations": [s for s in seasons_all["stations"] if s.get("prefecture") == pref],
    }

    # 鐵路路網：這一縣的節點＋相鄰的邊（京都另外加到関西国際空港的路徑）
    osaka_path = bundles / "map" / "osaka.json"
    kix = None
    extra: list[str] = []
    if pref == "kyoto" and osaka_path.exists():
        kix = next((s for s in _read(osaka_path) if s.get("n") == "関西国際空港"), None)
        if kix and kix.get("st"):
            extra = _path_nodes(graph, KYOTO_STATION, kix["st"])
    keep = [i for i, n in enumerate(graph["nodes"]) if n[4] == pref or n[0] in extra]
    remap = {old: i for i, old in enumerate(keep)}
    rail_graph = {
        "attribution": graph.get("attribution"),
        "nodes": [graph["nodes"][i] for i in keep],
        "edges": [
            [remap[a], remap[b], km, k]
            for a, b, km, k in graph["edges"]
            if a in remap and b in remap
        ],
    }

    out: dict[str, Any] = {
        "pref": pref,
        "spots": spots,
        "municipalities": municipalities,
        "lines": lines,
        "stations": stations,
        "festivals": festivals,
        "specialties": specialties,
        "shinise": shinise,
        "castles": castles,
        "seasons": seasons,
        "railGraph": rail_graph,
    }
    if kix:
        out["kix"] = _drop(kix, "i", "ia", "si")
    return out


def build_game(bundles: Path) -> dict[str, tuple[Path, dict[str, Any]]]:
    """game/{縣}.json；回傳 {縣: (路徑, 索引資訊)}（_index.json 的 game）"""
    graph_path = bundles / "rail-graph.json"
    if not graph_path.exists():
        return {}
    graph = _read(graph_path)
    out = {}
    for pref in GAME_PREFS:
        body = game_pref(bundles, pref, graph)
        if body is None:
            continue
        text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
        path = bundles / "game" / f"{pref}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        out[pref] = (path, {"version": hashlib.sha1(text.encode()).hexdigest()[:10]})
    return out
