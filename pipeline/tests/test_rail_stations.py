"""停靠的路線、新幹線、相鄰站與沿軌道距離（tests/fixtures/overpass_rail_sample.json）。"""

import json
from pathlib import Path

import pytest

from pipeline.rail import build_rail, build_stations, in_box
from pipeline.sources.osm import OsmElement

FIXTURES = Path(__file__).parent / "fixtures"
# 測試用的「縣」：經度 139.65–139.85、緯度 34.9–35.1（新横浜在縣外）
PREF_BOX = in_box((34.9, 139.65, 35.1, 139.85))


def _stations():
    els = [
        OsmElement("node/11", 35.0003, 139.8001, {"name": "東京", "operator": "東日本旅客鉄道"}),
        OsmElement("node/12", 35.0006, 139.8003, {"name": "東京", "operator": "東京地下鉄"}),
        OsmElement("node/13", 35.0012, 139.7801, {"name": "有楽町"}),
        OsmElement("node/14", 35.0004, 139.7502, {"name": "品川"}),
        OsmElement("node/15", 35.05, 139.7505, {"name": "北駅", "operator": "東日本旅客鉄道"}),
        OsmElement("node/16", 35.03, 139.7508, {"name": "私鉄駅", "operator": "京王電鉄"}),
        OsmElement("node/17", 35.06, 139.76, {"name": "遠い駅"}),
        OsmElement("node/18", 35.0003, 139.6001, {"name": "新横浜"}),
    ]
    operators: dict[str, set[str]] = {}
    return build_stations(els, operators), operators


def _built():
    data = json.loads((FIXTURES / "overpass_rail_sample.json").read_text(encoding="utf-8"))
    stations, operators = _stations()
    return build_rail(data, stations, PREF_BOX, operators)


def test_station_operators_merge():
    stations, operators = _stations()
    assert [s.id for s in stations][:2] == ["node-11", "node-13"]
    assert operators["node-11"] == {"東日本旅客鉄道", "東京地下鉄"}


def test_lines_flags_and_overlapped_line_kept():
    lines, _, _ = _built()
    by_id = {x.id: x for x in lines}
    # テスト支線 的軌道不在營運中的清單：沒有路段、沒有站，不留
    assert sorted(by_id) == [
        "osm-relation-100", "osm-relation-200", "osm-relation-300", "osm-relation-400",
    ]  # fmt: skip
    assert by_id["osm-relation-100"].shinkansen and by_id["osm-relation-300"].shinkansen
    assert not by_id["osm-relation-200"].shinkansen and not by_id["osm-relation-400"].shinkansen
    # 東北新幹線的軌道全被東海道新幹線畫掉了，但還是要留（車站查得到）
    assert by_id["osm-relation-300"].coords == []
    assert by_id["osm-relation-100"].coords
    assert by_id["osm-relation-200"].name == "テスト本線"


def test_station_lines_from_stops_names_and_track_proximity():
    _, stations, _ = _built()
    got = {st.name: (st.lines, st.shinkansen) for st in stations}
    # 東京：停靠點「東京駅」也對到；地下鐵的同名點已合併
    assert got["東京"] == (["osm-relation-100", "osm-relation-200", "osm-relation-300"], True)
    # 品川：「品川駅 3番線」對到品川；軌道 relation（テスト線）沒有停靠點，用距離判斷
    assert got["品川"] == (
        ["osm-relation-100", "osm-relation-200", "osm-relation-300", "osm-relation-400"],
        True,
    )
    assert got["有楽町"] == (["osm-relation-200"], False)
    assert got["北駅"] == (["osm-relation-400"], False)
    # 私鉄駅：在軌道旁但營運者不同；遠い駅：離軌道太遠
    assert got["私鉄駅"] == ([], False) and got["遠い駅"] == ([], False)
    # 縣外的新横浜不在車站清單
    assert "新横浜" not in got


def test_edges_follow_track_and_cross_border():
    lines, _, extra = _built()
    by_id = {x.id: {(a, b): km for a, b, km in x.edges} for x in lines}
    tokaido = by_id["osm-relation-100"]
    # 新駅沒有車站點：停靠點自成一站（stop-1005）；新横浜在縣外
    assert set(tokaido) == {
        ("node-11", "node-14"), ("node-14", "stop-1005"), ("node-18", "stop-1005"),
    }  # fmt: skip
    assert tokaido[("node-11", "node-14")] == pytest.approx(4.56, abs=0.03)
    # 兩段路段之間差 1 m 沒接上，也要接起來
    assert tokaido[("node-18", "stop-1005")] == pytest.approx(10.94, abs=0.05)
    # 在來線繞了一個彎：沿軌道比直線（約 1.8 km）長
    honsen = by_id["osm-relation-200"]
    assert set(honsen) == {("node-11", "node-13"), ("node-13", "node-14")}
    assert honsen[("node-11", "node-13")] == pytest.approx(2.70, abs=0.05)
    assert by_id["osm-relation-300"] == {("node-11", "node-14"): tokaido[("node-11", "node-14")]}
    assert by_id["osm-relation-400"] == {("node-14", "node-15"): pytest.approx(5.51, abs=0.03)}
    assert [(s.id, s.name) for s in extra] == [("node-18", "新横浜"), ("stop-1005", "新駅")]


def test_render_rail_roundtrip():
    from pipeline.models import RailData, Source
    from pipeline.rail import render_rail

    lines, stations, extra = _built()
    data = RailData(
        source=Source(url="https://www.openstreetmap.org/", fetched_at="2026-10-11"),
        lines=lines,
        stations=stations,
        extra_stations=extra,
    )
    text = render_rail(data)
    assert RailData.model_validate_json(text) == data
    # 預設值不寫：沒有停靠路線的站只有基本欄位
    assert '{"id":"node-17","name":"遠い駅","lat":35.06,"lng":139.76}' in text
    assert json.loads(text)["extra_stations"][0]["id"] == "node-18"


def test_render_rail_without_extra_keeps_old_shape():
    from pipeline.models import RailData, Source
    from pipeline.rail import render_rail

    data = RailData(source=Source(url="u", fetched_at="d"), lines=[], stations=[])
    assert json.loads(render_rail(data)) == {
        "source": {"url": "u", "fetched_at": "d"},
        "lines": [],
        "stations": [],
    }


def test_shinkansen_from_tags_and_highspeed_ways():
    from pipeline.rail import is_shinkansen

    assert is_shinkansen({"name": "x線", "network": "JR新幹線"})
    assert is_shinkansen({"name": "博多南線", "service": "high_speed"})
    assert not is_shinkansen({"name": "博多南線"})
    rel = {
        "type": "relation",
        "id": 1,
        "tags": {"name": "博多南線", "route": "train"},
        "members": [
            {"type": "way", "ref": 7, "role": "",
             "geometry": [{"lat": 26.2, "lon": 127.65}, {"lat": 26.21, "lon": 127.66}]},
        ],
    }  # fmt: skip
    hs = {"type": "way", "id": 7, "tags": {"highspeed": "yes"}}
    lines, _, _ = build_rail({"elements": [rel, {"type": "way", "id": 7}, hs]}, [], in_box(
        (26.0, 127.0, 27.0, 128.0)
    ))
    assert lines[0].shinkansen


def test_norm_station_and_operator_ok():
    from pipeline.rail import norm_station, operator_ok

    assert norm_station("東京駅") == "東京"
    assert norm_station("品川駅 3番線") == "品川"
    assert norm_station("新宿（JR）") == "新宿"
    assert norm_station("梅田 1・2番のりば") == "梅田"
    assert norm_station("駅") == "駅"
    assert operator_ok("東日本旅客鉄道", {"JR東日本"})
    assert operator_ok("西日本旅客鉄道;京阪電気鉄道", {"京阪電気鉄道株式会社"})
    assert operator_ok(None, {"京王電鉄"}) and operator_ok("京王電鉄", ())
    assert not operator_ok("東日本旅客鉄道", {"京王電鉄"})


def test_track_branch_neighbours():
    """支線：分歧點兩邊的站都和本線的站相鄰；分歧點上有站時不越過它。"""
    from pipeline.rail import Track

    trunk = [(139.0, 35.0), (139.01, 35.0), (139.02, 35.0)]
    north = [(139.02, 35.0), (139.03, 35.01)]
    south = [(139.02, 35.0), (139.03, 34.99)]
    t = Track([trunk, north, south])
    t.snap("A", 35.0, 139.0)
    t.snap("B", 35.01, 139.03)
    t.snap("C", 34.99, 139.03)
    t.finish()
    a = t.neighbours("A")
    assert set(a) == {"B", "C"}
    assert a["B"] == pytest.approx(1.83 + 1.42, abs=0.05)
    assert set(t.neighbours("B")) == {"A", "C"}
    t2 = Track([trunk, north, south])
    for key, lat, lng in (
        ("A", 35.0, 139.0), ("M", 35.0, 139.02), ("B", 35.01, 139.03), ("C", 34.99, 139.03),
    ):  # fmt: skip
        t2.snap(key, lat, lng)
    t2.finish()
    assert set(t2.neighbours("B")) == {"M"}
    assert set(t2.neighbours("M")) == {"A", "B", "C"}


def test_seed_rail_offline(tmp_path, monkeypatch):
    """seed-rail 的接線：車站查詢的範圍框加大、營運者傳進去、報告與寫檔。"""
    from pipeline import rail
    from pipeline.models import RailData

    data = json.loads((FIXTURES / "overpass_rail_sample.json").read_text(encoding="utf-8"))
    boxes = []
    els = [
        OsmElement("node/11", 35.0003, 139.8001, {"name": "東京"}),
        OsmElement("node/14", 35.0004, 139.7502, {"name": "品川"}),
        OsmElement("node/15", 35.05, 139.7505, {"name": "北駅", "operator": "京王電鉄"}),
    ]

    def stations(box):
        boxes.append(box)
        return els

    monkeypatch.setattr(rail, "RAIL_DIR", tmp_path)
    monkeypatch.setattr(rail, "in_pref", lambda pref: PREF_BOX)
    monkeypatch.setattr(rail.geo, "bbox", lambda pref, pad=0.02: (34.9 - pad, 139.65 - pad, 35.1 + pad, 139.85 + pad))
    monkeypatch.setattr(rail.geo, "iso_code", lambda pref: "JP-13")
    monkeypatch.setattr(rail.osm, "rail_routes", lambda iso: data)
    monkeypatch.setattr(rail.osm, "stations", stations)
    report = rail.seed_rail(["tokyo"])
    assert boxes == [pytest.approx((34.7, 139.45, 35.3, 140.05))]
    # 路線 4、新幹線 2、車站 3（有停靠路線 2：北駅的營運者和テスト線不同）
    assert "| tokyo | 4 | 2 | 3 | 2 |" in report
    out = RailData.model_validate_json((tmp_path / "tokyo.json").read_text(encoding="utf-8"))
    assert [st.id for st in out.extra_stations] == ["stop-1004", "stop-1005", "stop-2002"]


def test_track_snap_splits_long_segment():
    """站投影在很長的一段軌道中間：在投影點切開，距離不會被拉到端點。"""
    from pipeline.rail import Track

    t = Track([[(139.0, 35.0), (139.1, 35.0)]])
    assert t.snap("A", 35.0005, 139.02)
    assert t.snap("B", 34.9995, 139.05)
    assert not t.snap("far", 35.1, 139.05)
    t.finish()
    assert t.neighbours("A")["B"] == pytest.approx(0.03 * 91.29, abs=0.02)
