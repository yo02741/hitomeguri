"""番外篇的世界索引（pipeline/game_world.py）：選鎮（名城上限、北海道分散、同站不選、巴士的鎮）、
縣之間的交通（鐵路 km、新幹線、經機場的飛機）、build_game 寫出 game/_world.json。"""

import json
import math
from pathlib import Path
from typing import Any

from pipeline.game_bundle import P2_PREFS, _bridges, _pair_paths, build_game, game_body, game_pref
from pipeline.game_world import (
    RULES,
    AirLink,
    RailLink,
    Rule,
    cross_links,
    select_towns,
    town_json,
    world_index,
)
from pipeline.geo import haversine_m
from pipeline.rail_graph import from_bundle

# ---------- 假的一縣（PrefRaw 的形狀） ----------


def _mun(code: str, lng: float, lat: float, city: str | None = None, touches=()) -> dict:
    m = {
        "m": code,
        "n": f"町{code}",
        "l": [lng, lat],
        "bbox": [lng - 0.05, lat - 0.05, lng + 0.05, lat + 0.05],
    }
    if city:
        m["c"] = city
    m["touches"] = list(touches)
    return m


def _spot(
    i: str, m: str, s: float, lat: float, lng: float, st: str | None = None, c: str | None = None
) -> dict:
    out: dict[str, Any] = {"id": i, "n": f"景點{i}", "s": s, "m": m, "lat": lat, "lng": lng}
    if st:
        out["st"] = st
    if c:
        out["c"] = c
    return out


def _body(
    pref: str,
    muns: list[dict],
    spots: list[dict],
    stations: list[tuple[str, float, float]],
    edges: list[tuple[str, str, float, int]],
    castles: list[dict] | None = None,
) -> dict:
    nodes = [[sid, f"站{sid}", lat, lng, pref, 0] for sid, lat, lng in stations]
    ix = {n[0]: i for i, n in enumerate(nodes)}
    return {
        "pref": pref,
        "spots": sorted(spots, key=lambda s: s["id"]),
        "municipalities": muns,
        "lines": [],
        "stations": [
            {"id": sid, "n": f"站{sid}", "lat": lat, "lng": lng} for sid, lat, lng in stations
        ],
        "festivals": [],
        "specialties": [],
        "shinise": [],
        "castles": castles or [],
        "seasons": {"source": {"url": "", "fetched_at": ""}, "stations": []},
        "railGraph": {"nodes": nodes, "edges": [[ix[a], ix[b], km, k] for a, b, km, k in edges]},
    }


def _castle_pref() -> dict:
    """起點 A＋6 個有名城的鎮（分數低到高）＋2 個分數最高的沒有城的鎮；全部在同一條鐵路上"""
    muns = [_mun("A", 135.0, 35.0)]
    spots = [_spot("a", "A", 10, 35.0, 135.0, st="sA")]
    stations = [("sA", 35.0, 135.0)]
    edges = []
    castles = []
    for i in range(8):
        code = f"T{i}"
        lng = 135.0 + 0.1 * (i + 1)
        muns.append(_mun(code, lng, 35.0))
        stations.append((f"s{code}", 35.0, lng))
        edges.append((stations[-2][0], f"s{code}", 9.0, 0))
        spots.append(_spot(f"x{i}", code, 100 + i * 10, 35.0, lng, st=f"s{code}"))
        if i < 6:
            castles.append(
                {"id": f"c{i}", "p": "test", "n": f"城{i}", "s": f"x{i}", "st": ["休憩所"]}
            )
    return _body("test", muns, spots, stations, edges, castles)


def test_castle_towns_capped() -> None:
    body = _castle_pref()
    rule = Rule(start="A", start_station="sA", count=9, max_castles=4)
    ids = [t.id for t in select_towns(body, rule)]
    # 起點 → 名城的鎮（分數高的 4 個）→ 其餘照分數；名城的鎮 T0、T1 排不進來
    assert ids[:5] == ["A", "T5", "T4", "T3", "T2"]
    assert ids[5:] == ["T7", "T6", "T1", "T0"]
    # 沒有上限：6 個名城的鎮都先放
    ids = [t.id for t in select_towns(body, Rule(start="A", start_station="sA", count=7))]
    assert ids == ["A", "T5", "T4", "T3", "T2", "T1", "T0"]


def test_castle_town_station_fallback() -> None:
    """名城的鎮：景點都沒有最近車站（城在山上）時，代表點 castle_station_km 內、連得到起點的車站（高取城）"""
    body = _castle_pref()
    for s in body["spots"]:
        if s["m"] == "T5":
            s.pop("st")
    rule = Rule(start="A", start_station="sA", count=9, max_castles=4)
    assert "T5" not in [t.id for t in select_towns(body, rule)]
    with_fallback = Rule(
        start="A", start_station="sA", count=9, max_castles=4, castle_station_km=2.0
    )
    towns = select_towns(body, with_fallback)
    t5 = next(t for t in towns if t.id == "T5")
    assert t5.main.kind == "rail" and t5.station_id == "sT5"
    # 太遠（2 km 外）的車站不算
    body2 = _castle_pref()
    for s in body2["spots"]:
        if s["m"] == "T5":
            s.pop("st")
    for st in body2["stations"]:
        if st["id"] == "sT5":
            st["lat"] += 0.05
    assert "T5" not in [t.id for t in select_towns(body2, with_fallback)]
    # 京都、沖繩不設（已經上線的鎮不變）；P3 的鐵路縣都設
    assert RULES["kyoto"].castle_station_km is None and RULES["okinawa"].castle_station_km is None
    assert all(RULES[p].castle_station_km for p in ("nara", "osaka", "hyogo", "tokyo"))


def _spread_pref() -> dict:
    """北海道那樣：起點 S、include 的 C（市的一區）＋同一個市的另一區 C2；起點附近一群分數高的鎮、遠方幾個"""
    muns = [
        _mun("S", 141.65, 42.82),
        _mun("C", 141.35, 43.06, city="市"),
        _mun("C2", 141.36, 42.99, city="市"),
        # 起點 20 km 內（分數最高）
        _mun("N1", 141.80, 42.75),
        # 札幌（C）30 km 左右：可以
        _mun("N2", 141.00, 43.20),
        # 遠方（東、北、南）
        _mun("E1", 144.38, 42.99),
        _mun("E2", 144.75, 43.85),
        _mun("E3", 144.27, 44.02),
        _mun("E4", 144.40, 43.55),
        _mun("X1", 142.49, 43.80),
    ]
    scores = {
        "S": 50,
        "C": 900,
        "C2": 800,
        "N1": 1000,
        "N2": 700,
        "E1": 600,
        "E2": 590,
        "E3": 580,
        "E4": 570,
        "X1": 500,
    }
    spots = []
    stations = []
    edges = []
    prev = None
    for m in muns:
        lng, lat = m["l"]
        spots.append(
            _spot(
                f"p{m['m']}",
                m["m"],
                scores[m["m"]],
                lat,
                lng,
                st=f"s{m['m']}" if m["m"] != "E2" else None,
            )
        )
        stations.append((f"s{m['m']}", lat, lng))
        if prev:
            edges.append((prev, f"s{m['m']}", 50.0, 0))
        prev = f"s{m['m']}"
    return _body("hokkaido", muns, spots, stations, edges)


def test_spread_towns_like_hokkaido() -> None:
    body = _spread_pref()
    rule = Rule(
        start="S", transit="mixed", include=("C",), min_km=30, cluster=(120, 3), max_per_city=1
    )
    towns = select_towns(body, rule)
    ids = [t.id for t in towns]
    # 起點、include 一定在；N1（離起點 15 km）太近、C2（同一個市）不放；
    # 東邊 E1–E4 半徑 120 km 內最多 3 鎮：E4 擠不進去
    assert ids[:2] == ["S", "C"]
    assert "N1" not in ids and "C2" not in ids and "E4" not in ids
    assert set(ids) == {"S", "C", "N2", "E1", "E2", "E3", "X1"}
    # 每兩鎮至少隔 30 km（起點與 include 不算）
    pts = {t.id: (t.main.lat, t.main.lng) for t in towns}
    for a in ids[2:]:
        for b in ids:
            if a != b:
                assert haversine_m(*pts[a], *pts[b]) / 1000 >= 30
    # 沒有車站的鎮（E2）坐巴士：代表點是區名的位置
    e2 = next(t for t in towns if t.id == "E2")
    assert (
        e2.main.kind == "bus"
        and e2.station_id == "bus:E2"
        and (e2.main.lat, e2.main.lng) == (43.85, 144.75)
    )
    # 不分散：N1、C2 都進來
    plain = [t.id for t in select_towns(body, Rule(start="S", transit="mixed", include=("C",)))]
    assert "N1" in plain and "C2" in plain


def test_same_station_not_twice() -> None:
    body = _castle_pref()
    # T6、T7 的景點的最近車站都是 sT6：分數高的 T7 先選到，T6 不選
    for s in body["spots"]:
        if s["m"] == "T7":
            s["st"] = "sT6"
    ids = [t.id for t in select_towns(body, Rule(start="A", start_station="sA", count=9))]
    assert "T7" in ids and "T6" not in ids


def test_rail_rule_skips_unreachable() -> None:
    body = _castle_pref()
    # T7 的車站沒有接上路網：鐵路的縣不選，mixed 的縣坐巴士
    body["railGraph"]["edges"] = [
        e for e in body["railGraph"]["edges"] if body["railGraph"]["nodes"][e[1]][0] != "sT7"
    ]
    assert "T7" not in [t.id for t in select_towns(body, Rule(start="A", start_station="sA"))]
    mixed = select_towns(body, Rule(start="A", start_station="sA", transit="mixed"))
    t7 = next(t for t in mixed if t.id == "T7")
    assert t7.main.kind == "bus"


# ---------- 縣之間 ----------


def _graph() -> dict:
    """京都 —(新幹線 300)— 東京；京都 — 奈良 40；京都 — 空港 80；東京 — 羽田 20"""
    nodes = [
        ["kA", "京都", 35.0, 135.75, "kyoto", 1],
        ["nA", "奈良", 34.68, 135.82, "nara", 0],
        ["tA", "東京", 35.68, 139.77, "tokyo", 1],
        ["kix", "関西空港", 34.43, 135.24, "osaka", 0],
        ["hnd", "羽田空港", 35.55, 139.78, "tokyo", 0],
        ["mid", "途中", 35.2, 137.0, "", 0],
    ]
    edges = [[0, 1, 40.0, 0], [0, 5, 150.0, 1], [5, 2, 150.0, 1], [0, 3, 80.0, 0], [2, 4, 20.0, 0]]
    return {"attribution": "OSM", "nodes": nodes, "edges": edges}


def _one(
    pref: str, code: str, lat: float, lng: float, st: str | None, airport: dict | None = None
) -> dict:
    spots = [_spot(f"{pref}1", code, 100, lat, lng, st=st)]
    if airport:
        spots.append(airport)
    stations = [(st, lat, lng)] if st else []
    return _body(pref, [_mun(code, lng, lat)], spots, stations, [])


def test_cross_links_km() -> None:
    g = _graph()
    ap = {"id": "apN", "n": "那覇空港", "s": 10, "m": "OK", "lat": 26.2, "lng": 127.65, "c": "機場"}
    bodies = {
        "kyoto": _one("kyoto", "KY", 35.0, 135.75, "kA"),
        "nara": _one("nara", "NA", 34.68, 135.82, "nA"),
        "tokyo": _one("tokyo", "TK", 35.68, 139.77, "tA"),
        "okinawa": _one("okinawa", "OK", 26.21, 127.68, None, airport=ap),
    }
    towns = {
        "kyoto": select_towns(bodies["kyoto"], Rule(start="KY", start_station="kA")),
        "nara": select_towns(bodies["nara"], Rule(start="NA", start_station="nA")),
        "tokyo": select_towns(bodies["tokyo"], Rule(start="TK", start_station="tA")),
        "okinawa": select_towns(
            bodies["okinawa"], Rule(start="OK", start_stop="airport", transit="bus")
        ),
    }
    kix = {"id": "wd-K", "n": "関西国際空港", "c": "機場", "lat": 34.43, "lng": 135.23, "st": "kix"}
    hnd = {"id": "wd-H", "n": "東京国際空港", "c": "機場", "lat": 35.55, "lng": 139.78, "st": "hnd"}
    maps = {"osaka": [kix], "tokyo": [hnd]}
    cross = [
        AirLink("kyoto", "関西国際空港", "okinawa"),
        RailLink("kyoto", "nara"),
        RailLink("kyoto", "tokyo", shinkansen=True),
        AirLink("tokyo", "東京国際空港", "okinawa"),
        AirLink("nara", "どこにもない空港", "okinawa"),
    ]
    links = {x["id"]: x for x in cross_links(towns, maps, from_bundle(g), cross)}
    # 電車：鐵路 km、兩個方向一樣；京都 ↔ 奈良沒有新幹線
    kn = links["KY.main>NA.main"]
    assert kn["mode"] == "rail" and kn["legs"] == [
        {"mode": "rail", "km": 40.0, "kmKind": "rail", "to": "站nA"}
    ]
    assert (
        links["NA.main>KY.main"]["legs"][0]["km"] == 40.0
        and links["NA.main>KY.main"]["name"] == "站kA"
    )
    # 京都 ↔ 東京：新幹線
    kt = links["KY.main>TK.main"]["legs"][0]
    assert kt["km"] == 300.0 and kt["shinkansen"] is True
    # 經機場：鐵路到機場（km）＋飛機（兩個機場的直線 km，小數一位）
    ko = links["KY.main>OK.airport"]
    fly = math.floor(haversine_m(34.43, 135.23, 26.2, 127.65) / 100 + 0.5) / 10
    assert ko["mode"] == "rail" and [x["mode"] for x in ko["legs"]] == ["rail", "plane"]
    assert ko["legs"][0] == {"mode": "rail", "km": 80.0, "kmKind": "rail", "to": "関西国際空港"}
    assert ko["legs"][1] == {"mode": "plane", "km": fly, "kmKind": "straight", "to": "那覇空港"}
    back = links["OK.airport>KY.main"]
    assert back["mode"] == "plane" and back["fromPref"] == "okinawa" and back["toPref"] == "kyoto"
    assert [x["to"] for x in back["legs"]] == ["関西国際空港", "站kA"]
    assert links["TK.main>OK.airport"]["legs"][0]["km"] == 20.0
    # 轉乘的機場的資料沒有：直接飛，不寫機場名
    na = links["NA.main>OK.airport"]
    assert na["mode"] == "plane" and len(na["legs"]) == 1 and na["legs"][0]["to"] == "那覇空港"


def test_town_json_shape() -> None:
    body = _castle_pref()
    t = select_towns(body, Rule(start="A", start_station="sA"))[0]
    j = town_json(t)
    assert j["id"] == "A" and j["station"] == {"id": "sA", "name": "站sA", "kind": "rail"}
    assert j["center"] == {"lat": 35.0, "lng": 135.0} and j["stops"][0]["id"] == "main"


def test_rules_cover_game_prefs() -> None:
    from pipeline.game_bundle import GAME_PREFS

    assert set(RULES) == set(GAME_PREFS) and GAME_PREFS[0] == "kyoto"
    # 名城的鎮最多 4 個（北海道 1 個）
    assert all((RULES[p].max_castles or 0) <= 4 for p in GAME_PREFS if p not in P2_PREFS)


# ---------- build_game ----------


def test_bridges_path_through_unassigned_node() -> None:
    g = {
        "nodes": [
            ["a", "甲", 43, 141, "hokkaido", 0],
            ["x", "石倉", 42, 140, "", 0],
            ["b", "乙", 41.8, 140.7, "hokkaido", 0],
        ],
        "edges": [[0, 1, 100.0, 0], [1, 2, 50.0, 0]],
    }
    assert _bridges(g, "hokkaido", "a", {"b"}) == ["a", "b", "x"]
    assert _bridges(g, "hokkaido", "a", {"a"}) == []


def test_pair_paths_skip_long_detour() -> None:
    # 札幌 → 小樽：海邊的停靠點沒有縣，縣內只剩繞一大圈的路；選好的鎮之間的最短路徑要放進來
    g = {
        "nodes": [
            ["s", "札幌", 43.07, 141.35, "hokkaido", 0],
            ["x", "銭函", 43.13, 141.2, "", 0],
            ["o", "小樽", 43.2, 141.0, "hokkaido", 0],
            ["n", "長万部", 42.5, 140.4, "hokkaido", 0],
            ["c", "千歳", 42.8, 141.65, "hokkaido", 0],
        ],
        "edges": [
            [0, 1, 20.0, 0],
            [1, 2, 14.0, 0],
            [0, 3, 200.0, 0],
            [3, 2, 100.0, 0],
            [0, 4, 27.0, 0],
        ],
    }
    assert _pair_paths(g, ["s", "o", "c"]) == ["c", "o", "s", "x"]
    assert _pair_paths(g, ["s"]) == []
    assert _pair_paths(g, ["s", "zz"]) == []


def _w(p: Path, data: object) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def test_build_game_writes_world_index(tmp_path: Path) -> None:
    b = tmp_path / "bundles"

    def sq(x0: float, y0: float) -> list:
        return [[[[x0, y0], [x0 + 0.1, y0], [x0 + 0.1, y0 + 0.1], [x0, y0 + 0.1], [x0, y0]]]]

    _w(
        b / "map" / "kyoto.json",
        [
            {
                "id": "wd-1",
                "n": "甲寺",
                "s": 50,
                "m": "261068",
                "lat": 35.05,
                "lng": 135.05,
                "st": "node-267316272",
            }
        ],
    )
    _w(
        b / "map" / "nara.json",
        [
            {
                "id": "wd-2",
                "n": "乙寺",
                "s": 50,
                "m": "292010",
                "lat": 34.65,
                "lng": 135.85,
                "st": "node-4452353501",
            },
            {
                "id": "wd-3",
                "n": "丙寺",
                "s": 40,
                "m": "292036",
                "lat": 34.62,
                "lng": 135.75,
                "st": "nb",
            },
        ],
    )
    _w(
        b / "municipalities" / "kyoto.json",
        {
            "features": [
                {
                    "properties": {"m": "261068", "n": "下京区"},
                    "geometry": {"coordinates": sq(135.0, 35.0)},
                }
            ]
        },
    )
    _w(
        b / "municipalities" / "nara.json",
        {
            "features": [
                {
                    "properties": {"m": "292010", "n": "奈良市"},
                    "geometry": {"coordinates": sq(135.8, 34.6)},
                },
                {
                    "properties": {"m": "292036", "n": "大和郡山市"},
                    "geometry": {"coordinates": sq(135.7, 34.6)},
                },
            ]
        },
    )
    _w(
        b / "rail-graph.json",
        {
            "attribution": "OSM",
            "nodes": [
                ["node-267316272", "京都", 35.0, 135.75, "kyoto", 1],
                ["node-4452353501", "近鉄奈良", 34.68, 135.83, "nara", 0],
                ["nb", "近鉄郡山", 34.65, 135.78, "nara", 0],
            ],
            "edges": [[0, 1, 35.0, 0], [1, 2, 6.0, 0]],
        },
    )
    out = build_game(b)
    assert set(out) == {"kyoto", "nara", "_world"}
    path, meta = out["_world"]
    assert path == b / "game" / "_world.json" and len(meta["version"]) == 10
    w = json.loads(path.read_text(encoding="utf-8"))
    assert w["v"] == 1 and w["start"] == "kyoto"
    assert [p["pref"] for p in w["prefs"]] == ["kyoto", "nara"]
    nara = w["prefs"][1]
    assert nara["kit"] == "kinki" and [t["id"] for t in nara["towns"]] == ["292010", "292036"]
    assert {x["id"] for x in w["links"]} == {"261068.main>292010.main", "292010.main>261068.main"}
    assert w["links"][0]["legs"][0]["km"] == 35.0
    # P2 的縣：bundle 跟以前一樣（game_pref 照舊）；P3 的縣只留選到的鎮
    g = json.loads((b / "rail-graph.json").read_text(encoding="utf-8"))
    assert game_body(b, "kyoto", g) == game_pref(b, "kyoto", g)
    nb = json.loads((b / "game" / "nara.json").read_text(encoding="utf-8"))
    assert {s["m"] for s in nb["spots"]} == {"292010", "292036"}


def test_world_index_orders_prefs(tmp_path: Path) -> None:
    body = _castle_pref()
    body["pref"] = "kyoto"
    index, towns = world_index({"kyoto": body}, {}, {"nodes": [], "edges": []}, ("kyoto",))
    # 規則是京都的（start 261068）：假的資料沒有那一區 → 沒有鎮
    assert index["prefs"] == [] and towns == {}
