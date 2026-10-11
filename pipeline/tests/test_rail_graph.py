"""全國車站路網（pipeline/rail_graph.py）：跨縣合併、最短距離、N km 以內、新幹線。"""

import json

import pytest

from pipeline import rail_graph as rg
from pipeline.models import RailData, RailLine, RailStation, Source
from pipeline.rail import render_rail

SRC = Source(url="https://www.openstreetmap.org/", fetched_at="2026-10-11")


def _st(sid, name, lat, lng, lines=(), shinkansen=False):
    return RailStation(id=sid, name=name, lat=lat, lng=lng, lines=list(lines),
                       shinkansen=shinkansen)  # fmt: skip


def _line(lid, name, edges, shinkansen=False):
    return RailLine(id=lid, name=name, kind="train", coords=[], shinkansen=shinkansen,
                    edges=[tuple(e) for e in edges])  # fmt: skip


def _write(root, pref, data):
    root.mkdir(parents=True, exist_ok=True)
    (root / f"{pref}.json").write_text(render_rail(data), encoding="utf-8")


@pytest.fixture
def rail_dir(tmp_path):
    """東京都：東京、品川、上野、京成上野、府中（縣界上，兩縣都收）；神奈川：新横浜、小田原、府中。"""
    root = tmp_path / "rail"
    _write(root, "tokyo", RailData(source=SRC, lines=[
        _line("osm-relation-1", "東海道新幹線", [
            ("node-1", "node-2", 6.8), ("node-2", "node-900", 22.0)], shinkansen=True),
        _line("osm-relation-2", "東海道線", [
            ("node-1", "node-2", 6.7), ("node-2", "node-950", 18.0)]),
        _line("osm-relation-3", "山手線", [("node-1", "node-3", 3.6)]),
        _line("osm-relation-4", "京成本線", [("node-4", "stop-6", 30.0)]),
    ], stations=[
        _st("node-1", "東京", 35.6812, 139.7671, ["osm-relation-1"], True),
        _st("node-2", "品川", 35.6285, 139.7387, ["osm-relation-1"], True),
        _st("node-3", "上野", 35.7138, 139.7773),
        _st("node-4", "京成上野", 35.7114, 139.7740),
        _st("node-5", "府中", 35.6720, 139.4770),
    ], extra_stations=[
        _st("node-900", "新横浜", 35.5075, 139.6176),  # 神奈川那邊的 id 不同
        _st("node-950", "川崎", 35.5313, 139.6969),
        _st("stop-6", "成田空港", 35.7647, 140.3863),
    ]))  # fmt: skip
    _write(root, "kanagawa", RailData(source=SRC, lines=[
        _line("osm-relation-1", "東海道新幹線", [("node-901", "node-902", 60.0)], shinkansen=True),
        _line("osm-relation-2", "東海道線", [("node-950", "node-902", 66.0)]),
    ], stations=[
        _st("node-901", "新横浜", 35.5077, 139.6178, ["osm-relation-1"], True),
        _st("node-902", "小田原", 35.2564, 139.1551, ["osm-relation-1"], True),
        _st("node-950", "川崎", 35.5313, 139.6969),
        _st("node-951", "府中", 35.6721, 139.4772),
    ]))  # fmt: skip
    return root


def test_nodes_merge_across_prefectures(rail_dir):
    g = rg.build_graph(rail_dir)
    ids = [n.id for n in g.nodes]
    assert ids == sorted(ids)
    # 府中：兩縣都收到、同名 500 m 內 → 一個節點；新横浜：縣外站的 id 不同，同名對到
    assert g.node_id("node-951") == "node-5"
    assert g.node_id("node-900") == "node-901"
    # 成田空港：哪一縣都沒有 → 自成節點（縣空白）
    narita = g.nodes[g.index["stop-6"]]
    assert narita.pref == "" and not narita.shinkansen
    assert g.nodes[g.index["node-901"]].pref == "kanagawa"


def test_shortest_prefers_shinkansen_and_reports_real_km(rail_dir):
    g = rg.build_graph(rail_dir)
    r = rg.shortest(g, "node-1", "node-902")
    assert r is not None
    assert r.path == ["node-1", "node-2", "node-901", "node-902"]
    assert r.km == pytest.approx(6.8 + 22.0 + 60.0)
    assert r.shinkansen_km == pytest.approx(88.8) and r.shinkansen
    # 東京→品川：新幹線 6.8 km × 0.97 < 在來線 6.7 km，走新幹線，但不到 20 km 不算「搭新幹線」
    short = rg.shortest(g, "node-1", "node-2")
    assert short and short.km == 6.8 and not short.shinkansen
    # 東京→川崎：在來線
    kawasaki = rg.shortest(g, "node-1", "node-950")
    assert kawasaki and kawasaki.path[-1] == "node-950" and not kawasaki.shinkansen
    assert rg.shortest(g, "node-1", "node-5") is None  # 府中沒有路線
    assert rg.shortest(g, "node-1", "nowhere") is None


def test_walk_transfer_between_different_names(rail_dir):
    g = rg.build_graph(rail_dir)
    walks = [(g.nodes[a].name, g.nodes[b].name) for a, b, _, k in g.edges if k == rg.WALK]
    assert walks == [("上野", "京成上野")]
    r = rg.shortest(g, "node-1", "stop-6")
    assert r and r.path == ["node-1", "node-3", "node-4", "stop-6"]
    assert r.km == pytest.approx(3.6 + 0.4 + 30.0, abs=0.1)


def test_within_n_km(rail_dir):
    g = rg.build_graph(rail_dir)
    near = rg.within(g, "node-1", 30)
    assert set(near) == {"node-1", "node-2", "node-3", "node-4", "node-901", "node-950"}
    assert near["node-901"].km == pytest.approx(28.8) and near["node-901"].shinkansen
    assert near["node-1"].km == 0
    assert "node-902" not in near
    assert rg.within(g, "nowhere", 30) == {}


def test_nearest_node_by_name(rail_dir):
    g = rg.build_graph(rail_dir)
    assert g.nearest_node("東京駅", 35.68, 139.767, 500) == "node-1"
    assert g.nearest_node("東京", 35.0, 139.0, 500) is None
    assert g.nearest_node("新横浜", 35.508, 139.618, 1000) == "node-901"


def test_bundle_roundtrip_and_report(rail_dir, tmp_path):
    g = rg.build_graph(rail_dir)
    path = rg.write_bundle(g, tmp_path / "bundles")
    body = json.loads(path.read_text(encoding="utf-8"))
    assert body["nodes"][0][:2] == ["node-1", "東京"]
    assert all(len(e) == 4 and e[0] < e[1] for e in body["edges"])
    again = rg.from_bundle(body)
    assert rg.shortest(again, "node-1", "node-902").km == rg.shortest(g, "node-1", "node-902").km
    text = rg.report(g, path.stat().st_size)
    assert "在來線 5、新幹線 3、步行轉乘 1" in text
    assert "連通：2 塊，最大 8 站；沒有邊的站 1" in text  # 府中沒有路線


def test_empty_rail_dir(tmp_path):
    g = rg.build_graph(tmp_path / "none")
    assert g.nodes == [] and rg.components(g) == []
