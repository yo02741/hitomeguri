"""停靠站的補強：只列了幾站的軌道 relation、新幹線軌道旁的在來線站、軌道缺段、漏列的終點站。"""

from pipeline.models import RailStation
from pipeline.rail import build_rail, in_box

ALL = in_box((30.0, 130.0, 40.0, 140.0))


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
