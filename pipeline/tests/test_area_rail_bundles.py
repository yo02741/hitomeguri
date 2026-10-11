"""bundle 與資料檢查：市区町村界、景點的區與最近車站、鐵路的停靠路線與路網節點。"""

import json
from pathlib import Path

from pipeline import build_bundles, rail_graph, topo, validate
from pipeline import municipalities as mu
from pipeline.models import RailData, RailLine, RailStation, ShinkansenBundle, Source
from pipeline.rail import render_rail

FIXTURES = Path(__file__).parent / "fixtures"
SRC = Source(url="https://www.openstreetmap.org/", fetched_at="2026-10-11")


def _kyoto_munis():
    raw = json.loads((FIXTURES / "n03_sample.geojson").read_text(encoding="utf-8"))
    shapes, names, _ = mu.parse_n03(raw, 26)
    return mu.build_data("kyoto", shapes, names, {}, "N03-20250101", "https://example.jp/n03",
                         "2026-10-11")  # fmt: skip


def _rail(tmp_path) -> Path:
    root = tmp_path / "rail"
    root.mkdir()
    data = RailData(
        source=SRC,
        lines=[
            RailLine(id="osm-relation-1", name="東海道新幹線", kind="train", shinkansen=True,
                     coords=[[[135.75, 34.98], [135.76, 34.99]]],
                     edges=[("node-1", "node-2", 4.2)]),
            RailLine(id="osm-relation-2", name="奈良線", kind="train", coords=[],
                     edges=[("node-1", "node-3", 2.0)]),
        ],
        stations=[
            RailStation(id="node-1", name="京都", lat=34.985, lng=135.758,
                        lines=["osm-relation-1", "osm-relation-2"], shinkansen=True),
            RailStation(id="node-3", name="東福寺", lat=34.98, lng=135.77, lines=["osm-relation-2"]),
        ],
        extra_stations=[RailStation(id="node-2", name="米原", lat=35.31, lng=136.29)],
    )  # fmt: skip
    (root / "kyoto.json").write_text(render_rail(data), encoding="utf-8")
    return root


def test_map_entry_carries_municipality_and_station():
    spot = {"id": "wd-Q1", "name": {"ja": "清水寺", "zh_tw": "清水寺"}, "kind": "major",
            "location": {"lat": 34.99, "lng": 135.77}, "featured": True, "score": 90.0,
            "municipality": "261050"}  # fmt: skip
    e = build_bundles.map_entry(spot, "node-3")
    assert e["m"] == "261050" and e["st"] == "node-3"
    assert "st" not in build_bundles.map_entry(spot)


def test_spot_station_uses_nearest_stations_names(tmp_path):
    g = rail_graph.build_graph(_rail(tmp_path))
    spot = {"location": {"lat": 34.982, "lng": 135.772}, "nearest_stations": [
        {"name": {"ja": "東福寺駅"}, "distance_m": 300},
        {"name": {"ja": "京都"}, "distance_m": 1400},
    ]}  # fmt: skip
    assert build_bundles.spot_station(g, spot) == "node-3"
    spot["nearest_stations"] = [{"name": {"ja": "京都"}, "distance_m": 1400}]
    assert build_bundles.spot_station(g, spot) == "node-1"
    assert build_bundles.spot_station(g, {"location": spot["location"]}) is None


def test_rail_bundle_station_ids_lines_and_flags(tmp_path):
    root = _rail(tmp_path)
    g = rail_graph.build_graph(root)
    out = build_bundles.build_rail(tmp_path / "dst", g, root)
    path, meta = out["kyoto"]
    body = json.loads(path.read_text(encoding="utf-8"))
    assert body["lines"][0]["s"] == 1 and "s" not in body["lines"][1]
    assert body["lines"][1]["g"] == []
    kyoto = body["stations"][0]
    assert (kyoto["id"], kyoto["l"], kyoto["s"]) == ("node-1", [0, 1], 1)
    assert body["stations"][1] == {"id": "node-3", "n": "東福寺", "lat": 34.98, "lng": 135.77,
                                   "l": [1]}  # fmt: skip
    assert len(meta["version"]) == 10


def test_municipalities_bundle(tmp_path):
    src = tmp_path / "municipalities"
    mu.write(_kyoto_munis(), src)
    out = build_bundles.build_municipalities(tmp_path / "dst", src)
    path, meta = out["kyoto"]
    assert meta["count"] == 3 and len(meta["version"]) == 10
    body = json.loads(path.read_text(encoding="utf-8"))
    assert [f["properties"]["m"] for f in body["features"]] == ["261050", "262048", "263222"]


def test_validate_municipalities_rail_and_spot_codes(tmp_path):
    data_dir = tmp_path / "data"
    (data_dir / "spots").mkdir(parents=True)
    good = _kyoto_munis()
    mu.write(good, data_dir / "municipalities")
    (data_dir / "rail").mkdir()
    (data_dir / "rail" / "kyoto.json").write_text(
        (_rail(tmp_path) / "kyoto.json").read_text(encoding="utf-8"), encoding="utf-8"
    )
    spots = [{"id": "wd-Q1", "name": {"ja": "x", "zh_tw": "x"}, "location": {"lat": 35.0, "lng": 135.7},
              "prefecture": "kyoto", "municipality": "261050", "kind": "major", "updated_at": "1"}]  # fmt: skip
    path = data_dir / "spots" / "kyoto.json"
    path.write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    res = validate.validate(data_dir, bundles=False)
    assert res.ok, res.errors
    assert any("市区町村界：1 縣、3 區" in w for w in res.warnings)
    assert any("有停靠路線 2" in w and "相鄰站 2" in w for w in res.warnings)
    # 景點的區不在那一縣；區的代碼檢查碼不對；相鄰站的另一端不存在
    spots[0]["municipality"] = "131016"
    path.write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bad = good.model_copy(deep=True)
    bad.features[0].id = "261051"
    (data_dir / "municipalities" / "kyoto.json").write_text(mu.render(bad), encoding="utf-8")
    rail = RailData.model_validate_json(
        (data_dir / "rail" / "kyoto.json").read_text(encoding="utf-8")
    )
    rail.lines[1].edges.append(("node-3", "node-9", 1.0))
    rail.stations[1].shinkansen = True
    (data_dir / "rail" / "kyoto.json").write_text(render_rail(rail), encoding="utf-8")
    res = validate.validate(data_dir, bundles=False)
    text = "\n".join(res.errors)
    assert "區 131016 不在 kyoto 的區界裡" in text
    assert "261051" in text and "檢查碼" in text
    assert "node-3–node-9 不在車站清單" in text
    assert "標新幹線但沒有新幹線停靠" in text
    # 格式不是 pipeline 的寫法
    (data_dir / "municipalities" / "kyoto.json").write_text(
        json.dumps(good.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    res = validate.validate(data_dir, bundles=False)
    assert any("格式不是 pipeline 的寫法" in e for e in res.errors)


def test_municipalities_bundle_skips_unassigned_and_places_labels():
    data = _kyoto_munis()
    extra = data.features[0].model_copy(deep=True)
    extra.id = mu.lg_code("26000")
    extra.properties.name = "所属未定地"
    extra.properties.kana = None
    data.features.append(extra)
    body = mu.web_bundle(data)
    codes = [f["properties"]["m"] for f in body["features"]]
    assert codes == ["261050", "262048", "263222"]
    for f in body["features"]:
        lng, lat = f["properties"]["l"]
        assert topo.contains(f["geometry"]["coordinates"], lng, lat)


def test_label_point_inside_concave_polygon():
    # コ字形：外框的中心（1.0, 1.0）落在缺口裡，名稱要放在多邊形裡面
    ring = [(0, 0), (2, 0), (2, 0.5), (0.5, 0.5), (0.5, 1.5), (2, 1.5), (2, 2), (0, 2), (0, 0)]
    lng, lat = topo.label_point([[ring]])
    assert topo.contains([[ring]], lng, lat)
    assert lng < 0.5
    # 很多塊時取面積最大的那一塊
    small = [(5, 5), (5.1, 5), (5.1, 5.1), (5, 5.1), (5, 5)]
    lng, lat = topo.label_point([[small], [ring]])
    assert topo.contains([[ring]], lng, lat)


def test_chain_segments_joins_pieces():
    segs = [
        [(0.0, 0.0), (1.0, 0.0)],
        [(2.0, 0.0), (1.0, 0.0)],
        [(2.0, 0.0), (3.0, 1.0)],
        [(9.0, 9.0), (9.5, 9.0)],
    ]
    out = build_bundles.chain_segments(segs)
    assert sorted(len(c) for c in out) == [2, 4]
    longest = max(out, key=len)
    path = [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0), (3.0, 1.0)]
    assert longest in (path, path[::-1])


def _shinkansen_rail(tmp_path) -> Path:
    """兩縣都有同一條新幹線（各畫自己那一段）、縣界附近的同一個站兩縣都收到、還有實驗線。"""
    root = tmp_path / "rail"
    root.mkdir()
    line = RailLine(
        id="osm-relation-1", name="東海道新幹線", kind="train", shinkansen=True, coords=[]
    )
    a = RailData(
        source=SRC,
        lines=[
            line.model_copy(update={"coords": [[[135.0, 35.0], [135.1, 35.0001]],
                                               [[135.1, 35.0001], [135.2, 35.0]]]}),
            RailLine(id="osm-relation-2", name="リニア実験線", kind="train", shinkansen=True,
                     coords=[[[138.8, 35.6], [138.9, 35.6]]]),
            RailLine(id="osm-relation-3", name="琵琶湖線", kind="train",
                     coords=[[[135.0, 35.1], [135.2, 35.1]]]),
        ],
        stations=[
            RailStation(id="node-1", name="米原", lat=35.0, lng=135.2, lines=["osm-relation-1"],
                        shinkansen=True),
            RailStation(id="node-5", name="彦根", lat=35.1, lng=135.1, lines=["osm-relation-3"]),
        ],
    )  # fmt: skip
    b = RailData(
        source=SRC,
        lines=[line.model_copy(update={"coords": [[[135.2, 35.0], [135.4, 35.0]]]})],
        stations=[
            RailStation(id="node-2", name="米原", lat=35.0003, lng=135.2002,
                        lines=["osm-relation-1"], shinkansen=True),
            RailStation(id="node-3", name="岐阜羽島", lat=35.0, lng=135.4,
                        name_en="Gifu-Hashima", lines=["osm-relation-1"], shinkansen=True),
        ],
    )  # fmt: skip
    (root / "shiga.json").write_text(render_rail(a), encoding="utf-8")
    (root / "gifu.json").write_text(render_rail(b), encoding="utf-8")
    return root


def test_shinkansen_bundle_merges_lines_and_dedupes_stations(tmp_path):
    root = _shinkansen_rail(tmp_path)
    g = rail_graph.build_graph(root)
    out = build_bundles.build_shinkansen(tmp_path / "dst", g, root)
    assert out is not None
    path, meta = out
    body = json.loads(path.read_text(encoding="utf-8"))
    ShinkansenBundle.model_validate(body)
    assert meta["lines"] == 1 and meta["stations"] == 2 and len(meta["version"]) == 10
    # 實驗線、在來線不放；兩縣的線段合併成一條線，碎段（縣界兩邊的也是）接起來再簡化
    (line,) = body["lines"]
    assert line["n"] == "東海道新幹線"
    assert line["g"] in ([[[135.0, 35.0], [135.4, 35.0]]], [[[135.4, 35.0], [135.0, 35.0]]])
    # 縣界附近兩縣都收到的米原只留一個（路網節點 id）
    ids = [s["id"] for s in body["stations"]]
    assert ids == sorted(ids) and len(set(ids)) == 2
    maibara = next(s for s in body["stations"] if s["n"] == "米原")
    assert maibara["id"] == g.node_id("node-2") == g.node_id("node-1")
    hashima = next(s for s in body["stations"] if s["n"] == "岐阜羽島")
    assert (hashima["e"], hashima["p"]) == ("Gifu-Hashima", "gifu")
    # 新幹線資料都沒有時不輸出
    empty = tmp_path / "empty"
    empty.mkdir()
    assert (
        build_bundles.build_shinkansen(tmp_path / "x", rail_graph.build_graph(empty), empty) is None
    )
