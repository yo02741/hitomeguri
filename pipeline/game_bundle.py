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
from pipeline.game_world import RULES, select_towns, start_station_of, world_index
from pipeline.major import excluded_ids

#: 遊戲的縣（web/src/game/world/index 的 _world.json 照這個順序；京都是起點）
GAME_PREFS = ("kyoto", "okinawa", "nara", "osaka", "hyogo", "tokyo", "hokkaido")
#: P2 就上線的縣：bundle 的內容不能變（已經生成的鎮不能變）
P2_PREFS = ("kyoto", "okinawa")
#: 每個市区町村取分數前 TOP 個景點，市区町村取分數總和前 TOWNS 個（再加有名城蓋章地點的）
TOWNS = 12
TOP = 16
#: P3 的縣：先用分數前 TOWNS_WIDE 個市区町村選鎮（北海道要分散，候選要多一點），
#: bundle 只留選到的鎮的景點（下載量少一點；前端照同一份資料選鎮會得到一樣的結果）
TOWNS_WIDE = 40
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
#: P3 的縣的茶屋（老舖 pack 的 g teahouse）：名字是「茶屋」「茶寮」但其實是餐廳的
#: （丼、鰻、海鮮、料理、自助餐、連鎖店）遊戲不當茶屋（不然會賣「どんぶり茶屋のお茶」）。
#: 京都、沖繩照舊（P2 的 bundle 不變）
NOT_TEAHOUSE = re.compile(
    r"どんぶり|丼|うなぎ|鰻|海鮮|料理|ビュッフェ|バイキング|洋麺|点心|なか卯|SOLVIVA", re.I
)
#: 評論網站（食べログ…）的網址不當出處：老舖的 u 是 OSM 的 website 標籤，是評論網站時改用 OSM 的節點
REVIEW_SITE = re.compile(r"tabelog\.com|retty\.me|hotpepper\.jp|gnavi\.co\.jp", re.I)
#: 一家公司的泡麵（ダブルラーメン、円山動物園白クマラーメン）不當地區特色賣（P3 的縣）
INSTANT = re.compile(r"インスタント|袋麺|カップ麺|即席麺|泡麵|即食麵|速食麵")
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


def _pair_paths(graph: dict[str, Any], ids: list[str]) -> list[str]:
    """ids 兩兩之間在全國路網上的最短路徑經過的節點（daytrip.ts 一樣的權重）。

    縣內的路網少了沒有縣的停靠點時（北海道：札幌 → 小樽的海邊幾站），縣內算出來會繞一大圈；
    選好的鎮的車站之間的路徑放進來，縣內算的 km 就跟全國的一樣。
    """
    nodes = graph["nodes"]
    idx = {n[0]: i for i, n in enumerate(nodes)}
    want = sorted({idx[i] for i in ids if i in idx})
    adj: list[list[tuple[int, float, int]]] = [[] for _ in nodes]
    for a, b, km, k in graph["edges"]:
        adj[a].append((b, km, k))
        adj[b].append((a, km, k))
    out: set[str] = set()
    for n, s in enumerate(want):
        rest = set(want[n + 1 :])
        dist = {s: 0.0}
        prev: dict[int, int] = {}
        heap = [(0.0, s)]
        left = set(rest)
        while heap and left:
            d, u = heapq.heappop(heap)
            if d > dist.get(u, math.inf):
                continue
            left.discard(u)
            for v, km, k in adj[u]:
                w = d + km * (SHINKANSEN_WEIGHT if k == SHINKANSEN else 1)
                if w < dist.get(v, math.inf):
                    dist[v] = w
                    prev[v] = u
                    heapq.heappush(heap, (w, v))
        for t in rest:
            if t not in dist:
                continue
            u: int | None = t
            while u is not None:
                out.add(nodes[u][0])
                u = prev.get(u)
    return sorted(out)


def _bridges(graph: dict[str, Any], pref: str, src: str, targets: set[str]) -> list[str]:
    """targets 裡縣內的路網連不到 src、全國的路網連得到的：全國路網上 src → 那一站的路徑的節點"""
    nodes = graph["nodes"]
    idx = {n[0]: i for i, n in enumerate(nodes)}
    if src not in idx:
        return []
    inside = {i for i, n in enumerate(nodes) if n[4] == pref}
    adj: list[list[int]] = [[] for _ in nodes]
    for a, b, _km, _k in graph["edges"]:
        if a in inside and b in inside:
            adj[a].append(b)
            adj[b].append(a)
    seen = {idx[src]}
    todo = [idx[src]]
    while todo:
        for v in adj[todo.pop()]:
            if v not in seen:
                seen.add(v)
                todo.append(v)
    lost = sorted(t for t in targets if t in idx and idx[t] not in seen)
    out: list[str] = []
    for t in lost:
        out += _path_nodes(graph, src, t)
    return sorted(set(out))


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _read_or(path: Path, default: Any) -> Any:
    return _read(path) if path.exists() else default


def game_pref(
    bundles: Path,
    pref: str,
    graph: dict[str, Any],
    towns_n: int = TOWNS,
    only: list[str] | None = None,
    bridge: str | None = None,
    paths: list[str] | None = None,
) -> dict[str, Any] | None:
    """一縣的遊戲資料（PrefRaw 的形狀：web/src/game/world/types.ts）；少了必要的檔回 None。

    towns_n：候選的市区町村取分數前幾個（再加有名城蓋章地點的）；
    only：只留這些市区町村的景點（P3 的縣）；
    bridge：起點的車站（P3 的縣）：景點的最近車站在縣內的路網連不到起點、全國的路網連得到時，
    把全國路網上的那條路徑也放進來（北海道：千歳 → 函館經過一個沒有縣的停靠點「石倉」）；
    paths：選好的鎮的車站（P3 的縣）：兩兩之間全國路網上的最短路徑也放進來（_pair_paths）。
    """
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
    towns = [m for m, _ in ranked[:towns_n]]
    castles = sorted((c for c in castles_all if c.get("p") == pref), key=lambda c: c["id"])
    for c in castles:
        if not c.get("st"):
            continue
        s = next((x for x in mp if x["id"] == c.get("s")), None)
        if s and s.get("m") and s["m"] not in towns:
            towns.append(s["m"])
    if only is not None:
        towns = [m for m in towns if m in only]

    spots: list[dict[str, Any]] = []
    # P3 的縣：資料的人工排除清單（不是景點：事件、總稱…；data/seed/exclude.json）先擋，
    # 網站的資料下一次重採時才拿掉（京都、沖繩照舊：bundle 不變）
    gone = excluded_ids() if pref not in P2_PREFS else set()
    for m in towns:
        in_town = sorted(
            (s for s in mp if s.get("m") == m and s["id"] not in gone), key=lambda s: -s["s"]
        )[:TOP]
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
    if pref not in P2_PREFS:
        # P3 的縣：資料的人工排除清單（data/seed/exclude.json，pipeline 下一次重採之前先擋）、
        # 別的縣的料理、泡麵；是餐廳的茶屋；評論網站的出處（京都、沖繩照舊：bundle 不變）
        excluded = excluded_ids()
        names = _pref_names()
        specialties = [
            x for x in specialties if x["id"] not in excluded and _local_specialty(x, pref, names)
        ]
        shinise = [
            _shinise_source(x)
            for x in shinise
            if not (x.get("g") == "teahouse" and NOT_TEAHOUSE.search(x.get("n", "")))
        ]

    seasons_all = _read_or(
        bundles / "seasons.json", {"source": {"url": "", "fetched_at": ""}, "stations": []}
    )
    seasons = {
        "source": seasons_all["source"],
        "stations": [s for s in seasons_all["stations"] if s.get("prefecture") == pref],
    }
    if not seasons["stations"]:
        # 這一縣沒有氣象台的平年值：用同一個地方（regions.json 的 area）的縣的
        near = _area_prefs(pref)
        seasons["stations"] = [s for s in seasons_all["stations"] if s.get("prefecture") in near]

    # 鐵路路網：這一縣的節點＋相鄰的邊（京都另外加到関西国際空港的路徑）
    osaka_path = bundles / "map" / "osaka.json"
    kix = None
    extra: list[str] = []
    if pref == "kyoto" and osaka_path.exists():
        kix = next((s for s in _read(osaka_path) if s.get("n") == "関西国際空港"), None)
        if kix and kix.get("st"):
            extra = _path_nodes(graph, KYOTO_STATION, kix["st"])
    if bridge:
        extra += _bridges(graph, pref, bridge, {s["st"] for s in spots if s.get("st")})
    if paths:
        extra += _pair_paths(graph, paths)
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


def _pref_names() -> dict[str, list[str]]:
    """縣 → 名字（日文、中文：北海道、山形県、山形縣）"""
    path = Path(__file__).resolve().parent.parent / "data" / "regions.json"
    if not path.exists():
        return {}
    return {
        r["prefecture"]: [n for n in {r["name"]["ja"], r["name"].get("zh_tw", "")} if n]
        for r in _read(path)["regions"]
    }


def _first_sentence(text: str) -> str:
    return re.split(r"(?<=[。．.])\s*", text or "", maxsplit=1)[0]


def _local_specialty(x: dict[str, Any], pref: str, names: dict[str, list[str]]) -> bool:
    """P3 的縣的地區特色：簡介的第一句寫的是別的縣（沒提到這一縣）的不算

    （冷やしラーメン：山形縣、福島縣的料理）；一家公司的泡麵不算。
    """
    s = x.get("summary") or {}
    text = " ".join(t for t in (s.get("text"), s.get("text_zh")) if t)
    if INSTANT.search(text):
        return False
    first = " ".join(_first_sentence(t) for t in (s.get("text"), s.get("text_zh")) if t)
    own = [re.sub(r"[都道府県縣]$", "", n) or n for n in names.get(pref, [])]
    if any(o and o in first for o in own):
        return True
    return not any(n in first for p, ns in names.items() if p != pref for n in ns)


def _shinise_source(x: dict[str, Any]) -> dict[str, Any]:
    """老舖、茶屋的出處：u 是評論網站的，改用 OSM 的節點

    （資料本來就是 OSM 來的：id 是 shinise-node-…）
    """
    m = re.match(r"shinise-(node|way|relation)-(\d+)$", x["id"])
    if m and REVIEW_SITE.search(x.get("u") or ""):
        return {**x, "u": f"https://www.openstreetmap.org/{m.group(1)}/{m.group(2)}"}
    return x


def _area_prefs(pref: str) -> set[str]:
    """同一個地方（regions.json 的 area：近畿、關東…）的其他縣"""
    path = Path(__file__).resolve().parent.parent / "data" / "regions.json"
    if not path.exists():
        return set()
    regions = _read(path)["regions"]
    area = next((r["area"] for r in regions if r["prefecture"] == pref), None)
    return {r["prefecture"] for r in regions if r["area"] == area and r["prefecture"] != pref}


def game_body(bundles: Path, pref: str, graph: dict[str, Any]) -> dict[str, Any] | None:
    """一縣的 game bundle：P2 的縣照舊；P3 的縣先用比較多的候選選鎮，再只留選到的鎮"""
    if pref in P2_PREFS or pref not in RULES:
        return game_pref(bundles, pref, graph)
    rule = RULES[pref]
    first = game_pref(bundles, pref, graph, towns_n=TOWNS_WIDE)
    if first is None:
        return None
    # 起點的車站：規則寫的，沒寫就是起點那一區景點最常見的最近車站
    src = rule.start_station or start_station_of(first, rule)
    wide = game_pref(bundles, pref, graph, towns_n=TOWNS_WIDE, bridge=src) if src else first
    assert wide is not None
    chosen = select_towns(wide, rule)
    picked = [t.id for t in chosen]
    rail = [
        t.main.station_id
        for t in chosen
        if t.main.kind in ("rail", "monorail") and t.main.station_id
    ]
    return game_pref(bundles, pref, graph, towns_n=TOWNS_WIDE, only=picked, bridge=src, paths=rail)


def _write_json(path: Path, body: Any) -> str:
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return hashlib.sha1(text.encode()).hexdigest()[:10]


#: 世界索引的檔名（game/_world.json；_index.json 的 game._world 帶版本）
WORLD_KEY = "_world"


def build_game(bundles: Path) -> dict[str, tuple[Path, dict[str, Any]]]:
    """game/{縣}.json 與世界索引 game/_world.json。

    回傳 {縣或 _world: (路徑, 索引資訊)}（_index.json 的 game）。
    """
    graph_path = bundles / "rail-graph.json"
    if not graph_path.exists():
        return {}
    graph = _read(graph_path)
    out: dict[str, tuple[Path, dict[str, Any]]] = {}
    bodies: dict[str, dict[str, Any]] = {}
    for pref in GAME_PREFS:
        body = game_body(bundles, pref, graph)
        if body is None:
            continue
        bodies[pref] = body
        path = bundles / "game" / f"{pref}.json"
        out[pref] = (path, {"version": _write_json(path, body)})
    if bodies:
        maps = {
            p: _read(bundles / "map" / f"{p}.json")
            for p in bodies
            if (bundles / "map" / f"{p}.json").exists()
        }
        index, _ = world_index(bodies, maps, graph, GAME_PREFS)
        path = bundles / "game" / f"{WORLD_KEY}.json"
        out[WORLD_KEY] = (path, {"version": _write_json(path, index)})
    return out
