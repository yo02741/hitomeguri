"""停靠站的補強：只列了幾站的軌道 relation、新幹線軌道旁的在來線站、軌道缺段、漏列的終點站。"""

from pipeline.models import RailStation
from pipeline.rail import build_rail, in_box

ALL = in_box((30.0, 125.0, 46.0, 146.0))


def _st(i: int, name: str, lat: float, lng: float) -> RailStation:
    return RailStation(id=f"node-{i}", name=name, lat=lat, lng=lng)


def _way(i: int, pts: list[tuple[float, float]]) -> tuple[dict, dict]:
    member = {
        "type": "way",
        "ref": i,
        "role": "",
        "geometry": [{"lat": a, "lon": b} for a, b in pts],
    }
    return member, {"type": "way", "id": i}


def _stop(ref: int, lat: float, lng: float) -> dict:
    return {"type": "node", "ref": ref, "role": "stop", "lat": lat, "lon": lng}


def _lines(elements: list[dict], stations: list[RailStation], operators=None):
    lines, kept, _ = build_rail({"elements": elements}, stations, ALL, operators or {})
    names = {s.id: s.name for s in stations}
    edges = {
        x.name: {(names.get(a, a), names.get(b, b)): km for a, b, km in x.edges} for x in lines
    }
    return edges, {s.name: s.lines for s in kept}


def test_railway_relation_with_a_few_station_members_still_uses_track():
    # 山陰本線：軌道 relation 只列了遠處一站當成員，其他站要靠軌道旁的距離找到
    stations = [
        _st(1, "鳥取", 35.0, 134.0),
        _st(2, "湖山", 35.0, 133.9),
        _st(3, "京都", 35.0, 135.5),
    ]
    w, a = _way(11, [(35.0, 134.05), (35.0, 133.85)])
    rel = {
        "type": "relation", "id": 1, "tags": {"name": "山陰本線", "route": "railway"},
        "members": [w, {"type": "node", "ref": 3, "role": "station", "lat": 35.0, "lon": 135.5}],
    }  # fmt: skip
    edges, lines = _lines([rel, a], stations)
    assert ("鳥取", "湖山") in edges["山陰本線"] or ("湖山", "鳥取") in edges["山陰本線"]
    assert lines["鳥取"] and lines["湖山"]


def test_shinkansen_track_only_takes_shinkansen_stops():
    # 新幹線的軌道 relation：旁邊在來線的站（浮間舟渡）不算，新幹線列車停的站（大宮）才算
    stations = [
        _st(1, "大宮", 35.9, 139.62),
        _st(2, "浮間舟渡", 35.8, 139.62),
        _st(3, "上野", 35.7, 139.62),
    ]
    w, a = _way(11, [(35.95, 139.62), (35.65, 139.62)])
    track = {
        "type": "relation", "id": 1, "tags": {"name": "東北新幹線", "route": "railway"},
        "members": [w],
    }  # fmt: skip
    train = {
        "type": "relation", "id": 2,
        "tags": {"name": "東北新幹線 はやぶさ", "route": "train", "public_transport:version": "2"},
        "members": [_stop(101, 35.7, 139.62), _stop(102, 35.9, 139.62), w],
    }  # fmt: skip
    edges, lines = _lines([track, train, a], stations)
    tohoku = edges["東北新幹線"]
    assert set(tohoku) == {("node-1", "node-3")} or set(tohoku) == {("大宮", "上野")}
    assert lines["浮間舟渡"] == []


def test_stop_sequence_bridges_a_track_gap():
    # 北陸新幹線：高崎の先の軌道がこの relation に入っていない（缺段）。停靠順で補う
    stations = [
        _st(1, "高崎", 36.32, 139.01),
        _st(2, "安中榛名", 36.36, 138.85),
        _st(3, "軽井沢", 36.34, 138.63),
    ]
    w, a = _way(11, [(36.35, 138.90), (36.36, 138.85), (36.34, 138.63)])
    rel = {
        "type": "relation", "id": 1,
        "tags": {"name": "北陸新幹線", "route": "train", "public_transport:version": "2"},
        "members": [_stop(101, 36.32, 139.01), _stop(102, 36.36, 138.85), _stop(103, 36.34, 138.63), w],
    }  # fmt: skip
    edges, _ = _lines([rel, a], stations)
    hok = edges["北陸新幹線"]
    pair = ("安中榛名", "高崎") if ("安中榛名", "高崎") in hok else ("高崎", "安中榛名")
    assert pair in hok
    # 直線約 15 km × 1.1
    assert 15 < hok[pair] < 19
    # 軌道接得起來的不補（安中榛名—軽井沢 是沿軌道距離）
    assert any("軽井沢" in p for p in hok)


def test_unordered_stops_are_not_used_for_gaps():
    stations = [_st(1, "A", 35.0, 139.0), _st(2, "B", 35.0, 139.1), _st(3, "C", 35.0, 139.2)]
    rel = {
        "type": "relation", "id": 1, "tags": {"name": "テスト線", "route": "train"},
        "members": [_stop(1, 35.0, 139.0), _stop(3, 35.0, 139.2), _stop(2, 35.0, 139.1)],
    }  # fmt: skip
    edges, _ = _lines([rel], stations)
    assert edges.get("テスト線", {}) == {}


def test_terminal_missing_from_stops_found_at_track_end():
    # JR日光線：停靠點沒有列日光，軌道盡頭旁的日光算終點站；別家的東武日光不算
    stations = [
        _st(1, "今市", 36.72, 139.687), _st(2, "日光", 36.746, 139.6215),
        _st(3, "東武日光", 36.7475, 139.6205),
    ]  # fmt: skip
    operators = {"node-1": {"東日本旅客鉄道"}, "node-2": {"東日本旅客鉄道"}, "node-3": {"東武鉄道"}}
    w, a = _way(11, [(36.70, 139.75), (36.72, 139.687), (36.746, 139.622)])
    rel = {
        "type": "relation", "id": 1,
        "tags": {"name": "JR日光線", "route": "train", "operator": "東日本旅客鉄道"},
        "members": [_stop(101, 36.72, 139.687), w],
    }  # fmt: skip
    edges, lines = _lines([rel, a], stations, operators)
    nikko = edges["JR日光線"]
    assert any("日光" in p and "今市" in p for p in nikko)
    assert lines["東武日光"] == []


def test_service_named_trains_count_as_shinkansen_stops():
    # 山陽新幹線：軌道 relation 沒有停靠點，列車只有「のぞみ」這種列車名稱的 relation（不合併成路線），
    # 它停的站（新神戸）照樣算新幹線的站；旁邊在來線的站（灘）不算
    stations = [
        _st(1, "新神戸", 34.7, 135.19),
        _st(2, "灘", 34.7, 135.22),
        _st(3, "西明石", 34.7, 135.0),
    ]
    w, a = _way(11, [(34.7, 135.25), (34.7, 134.95)])
    hs = {"type": "way", "id": 11, "tags": {"highspeed": "yes"}}
    track = {
        "type": "relation", "id": 1, "tags": {"name": "山陽新幹線", "route": "railway"},
        "members": [w],
    }  # fmt: skip
    nozomi = {
        "type": "relation", "id": 2, "tags": {"name": "のぞみ", "route": "train"},
        "members": [_stop(101, 34.7, 135.19), _stop(102, 34.7, 135.0), w],
    }  # fmt: skip
    edges, lines = _lines([track, nozomi, a, hs], stations)
    assert lines["新神戸"] and lines["西明石"]
    assert lines["灘"] == []
    assert ("新神戸", "西明石") in edges["山陽新幹線"] or ("西明石", "新神戸") in edges[
        "山陽新幹線"
    ]


def test_orphan_station_found_with_wider_radius():
    # 鳥取：車站點畫在離軌道 220 m 的地方，第一輪（150 m）找不到，第二輪（300 m）找到
    stations = [
        _st(1, "鳥取", 35.002, 134.0),
        _st(2, "湖山", 35.0, 133.9),
        _st(3, "福部", 35.0, 134.1),
    ]
    w, a = _way(11, [(35.0, 134.15), (35.0, 133.85)])
    rel = {
        "type": "relation", "id": 1, "tags": {"name": "山陰本線", "route": "railway"},
        "members": [w],
    }  # fmt: skip
    edges, lines = _lines([rel, a], stations)
    assert lines["鳥取"]
    sanin = edges["山陰本線"]
    assert any("鳥取" in p and "湖山" in p for p in sanin)
    assert any("鳥取" in p and "福部" in p for p in sanin)


def test_station_members_of_railway_relation_bridge_gap():
    # 北海道新幹線：軌道 relation 依序列了車站，車站點離軌道太遠（snap 不到）時照順序補邊
    stations = [
        _st(1, "新青森", 40.83, 140.69),
        _st(2, "奥津軽いまべつ", 41.145, 140.516),
        _st(3, "木古内", 41.679, 140.434),
    ]
    w, a = _way(11, [(40.83, 140.70), (41.145, 140.53)])
    rel = {
        "type": "relation", "id": 1, "tags": {"name": "北海道新幹線", "route": "railway"},
        "members": [
            {"type": "node", "ref": 1, "role": "station", "lat": 40.83, "lon": 140.69},
            {"type": "node", "ref": 2, "role": "station", "lat": 41.145, "lon": 140.516},
            {"type": "node", "ref": 3, "role": "station", "lat": 41.679, "lon": 140.434},
            w,
        ],
    }  # fmt: skip
    edges, _ = _lines([rel, a], stations)
    hk = edges["北海道新幹線"]
    pair = (
        ("奥津軽いまべつ", "木古内")
        if ("奥津軽いまべつ", "木古内") in hk
        else ("木古内", "奥津軽いまべつ")
    )
    assert pair in hk and 55 < hk[pair] < 70


# ---- seed-rail #77 之後的修正（用 dump-rail-osm 的原始回應重現） ----


def test_parallel_track_does_not_bypass_station():
    # 上下行分開畫：B 的停靠點在上行軌道，沿下行軌道從 A 走到 C 不能越過 B（高崎→越後湯沢）
    stations = [_st(1, "A", 35.0, 139.0), _st(2, "B", 35.0, 139.15), _st(3, "C", 35.0, 139.3)]
    up, a1 = _way(11, [(35.0, 139.0), (35.0, 139.3)])
    down, a2 = _way(12, [(35.0, 139.0), (35.0002, 139.01), (35.0002, 139.29), (35.0, 139.3)])
    rel = {
        "type": "relation", "id": 1,
        "tags": {"name": "テスト線", "route": "train", "public_transport:version": "2"},
        "members": [_stop(1, 35.0, 139.0), _stop(2, 35.0, 139.15), _stop(3, 35.0, 139.3), up, down],
    }  # fmt: skip
    edges, _ = _lines([rel, a1, a2], stations)
    pairs = {frozenset(p) for p in edges["テスト線"]}
    assert pairs == {frozenset(("A", "B")), frozenset(("B", "C"))}


def test_track_gap_of_80m_is_joined():
    # 米子站東側：站區的一段路段沒放進 relation，軌道斷了約 80 m
    stations = [_st(1, "米子", 35.0, 139.0), _st(2, "東山公園", 35.0, 139.2)]
    w1, a1 = _way(11, [(35.0, 138.99), (35.0, 139.1)])
    w2, a2 = _way(12, [(35.0, 139.10088), (35.0, 139.21)])
    rel = {
        "type": "relation", "id": 1, "tags": {"name": "山陰本線", "route": "railway"},
        "members": [w1, w2],
    }  # fmt: skip
    edges, _ = _lines([rel, a1, a2], stations)
    assert {frozenset(p) for p in edges["山陰本線"]} == {frozenset(("米子", "東山公園"))}


def test_outside_stations_count_for_connectivity():
    # 伯耆大山（縣內）—米子（縣外）—西出雲（縣外）：軌道接得起來，
    # 不能因為縣外兩站之間的邊不輸出，就用停靠順序補一條伯耆大山—西出雲
    stations = [
        _st(1, "伯耆大山", 35.0, 139.0), _st(2, "米子", 35.0, 138.9), _st(3, "西出雲", 35.0, 138.5),
    ]  # fmt: skip
    w, a = _way(11, [(35.0, 139.05), (35.0, 138.45)])
    rel = {
        "type": "relation", "id": 1, "tags": {"name": "山陰本線", "route": "railway"},
        "members": [_stop(3, 35.0, 138.5), _stop(1, 35.0, 139.0), w],
    }  # fmt: skip
    inside = in_box((34.9, 138.95, 35.1, 139.1))
    lines, _, _ = build_rail({"elements": [rel, a]}, stations, inside, {})
    names = {s.id: s.name for s in stations}
    pairs = {frozenset((names[x], names[y])) for x, y, _ in lines[0].edges}
    assert pairs == {frozenset(("伯耆大山", "米子"))}


def test_station_members_without_role_count_as_stops():
    # 北陸新幹線：軌道 relation 用沒有角色的成員依序列車站；高崎的車站點離軌道 200 m
    # （超過軌道旁找站的 150 m）。號誌、信號場這類對不到車站的 node 不當成停靠點
    stations = [_st(1, "高崎", 36.3218, 139.0), _st(2, "安中榛名", 36.32, 138.85)]
    w, a = _way(11, [(36.32, 139.05), (36.32, 138.8)])
    rel = {
        "type": "relation", "id": 1,
        "tags": {"name": "北陸新幹線", "route": "railway", "public_transport:version": "2"},
        "members": [
            {"type": "node", "ref": 1, "role": "", "lat": 36.3218, "lon": 139.0},
            {"type": "node", "ref": 9, "role": "", "lat": 36.32, "lon": 138.95},
            {"type": "node", "ref": 2, "role": "", "lat": 36.32, "lon": 138.85},
            w,
        ],
    }  # fmt: skip
    named = [
        {"type": "node", "id": i, "tags": {"name": n}}
        for i, n in ((1, "高崎"), (2, "安中榛名"), (9, "某信号場"))
    ]
    edges, lines = _lines([rel, a, *named], stations)
    assert {frozenset(p) for p in edges["北陸新幹線"]} == {frozenset(("高崎", "安中榛名"))}
    assert lines["高崎"]


def test_shinkansen_train_stops_snap_far_station_to_track():
    # 九州新幹線：軌道 relation 沒列車站，博多的車站點離高架軌道 400 m；
    # 列車（さくら）的停車位置在軌道上，用它把博多投影到軌道
    stations = [_st(1, "博多", 33.5936, 130.42), _st(2, "新鳥栖", 33.4, 130.42)]
    w, a = _way(11, [(33.59, 130.42), (33.39, 130.42)])
    hs = {"type": "way", "id": 11, "tags": {"highspeed": "yes"}}
    track = {
        "type": "relation", "id": 1, "tags": {"name": "九州新幹線", "route": "railway"},
        "members": [w],
    }  # fmt: skip
    sakura = {
        "type": "relation", "id": 2, "tags": {"name": "さくら", "route": "train"},
        "members": [_stop(101, 33.59, 130.42), _stop(102, 33.4, 130.42), w],
    }  # fmt: skip
    named = [{"type": "node", "id": 101, "tags": {"name": "博多"}}]
    edges, lines = _lines([track, sakura, a, hs, *named], stations)
    assert {frozenset(p) for p in edges["九州新幹線"]} == {frozenset(("博多", "新鳥栖"))}
    assert lines["博多"]
