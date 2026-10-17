"""番外篇的小 bundle（pipeline/game_bundle.py）：讀寫好的 bundle，抽出遊戲要的那一點。"""

import json
from pathlib import Path

from pipeline.game_bundle import build_game, game_pref


def _w(p: Path, data: object) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _square(x0: float, y0: float, x1: float, y1: float) -> list:
    return [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]]


def _bundles(tmp: Path) -> Path:
    b = tmp / "bundles"
    _w(
        b / "map" / "kyoto.json",
        [
            {
                "id": "wd-Q1",
                "n": "甲寺",
                "s": 50,
                "m": "100",
                "lat": 35.05,
                "lng": 135.05,
                "i": "x.jpg",
            },
            {"id": "wd-Q2", "n": "乙城", "s": 1, "m": "200", "lat": 35.05, "lng": 135.15},
            {
                "id": "wd-Q3",
                "n": "空港",
                "s": 1,
                "m": "300",
                "c": "機場",
                "lat": 35.0,
                "lng": 135.3,
            },
        ],
    )
    _w(
        b / "detail" / "kyoto.json",
        [
            {
                "id": "wd-Q1",
                "name": {"ja": "甲寺"},
                "summary": {
                    "text": "一" * 300,
                    "lang": "zh",
                    "source_url": "https://zh.wikipedia.org/x",
                    "license": "CC",
                },
                "sources": [{"url": "https://www.wikidata.org/wiki/Q1"}],
            }
        ],
    )
    _w(
        b / "municipalities" / "kyoto.json",
        {
            "features": [
                {
                    "properties": {"m": "100", "n": "東区"},
                    "geometry": {"coordinates": _square(135.0, 35.0, 135.1, 35.1)},
                },
                {
                    "properties": {"m": "200", "n": "西区"},
                    "geometry": {"coordinates": _square(135.1, 35.0, 135.2, 35.1)},
                },
            ]
        },
    )
    _w(
        b / "festivals" / "kyoto.json",
        [
            {
                "id": "f1",
                "name": {"ja": "祭"},
                "months": [5],
                "location": {"lat": 35.05, "lng": 135.15},
                "images": [1],
                "sources": [],
                "views": 1,
            }
        ],
    )
    _w(
        b / "packs" / "castle.json",
        [{"id": "c1", "p": "kyoto", "n": "乙城", "s": "wd-Q2", "st": ["休憩所"]}],
    )
    _w(
        b / "packs" / "shinise.json",
        [
            {"id": "s1", "p": "kyoto", "n": "老舖", "lat": 35.02, "lng": 135.02},
            {"id": "s2", "p": "kyoto", "n": "はろうきてぃ茶寮", "lat": 35.02, "lng": 135.02},
        ],
    )
    _w(
        b / "rail-graph.json",
        {
            "attribution": "OSM",
            "nodes": [["n1", "甲", 35.0, 135.0, "kyoto", 0], ["n2", "乙", 34.0, 135.0, "osaka", 0]],
            "edges": [[0, 1, 50.0, 0]],
        },
    )
    return b


def test_game_pref_subset(tmp_path: Path) -> None:
    b = _bundles(tmp_path)
    g = json.loads((b / "rail-graph.json").read_text(encoding="utf-8"))
    out = game_pref(b, "kyoto", g)
    assert out is not None
    ids = [s["id"] for s in out["spots"]]
    # 名城的市区町村、機場都在；地圖用的照片欄位不帶
    assert ids == ["wd-Q1", "wd-Q2", "wd-Q3"]
    q1 = out["spots"][0]
    assert "i" not in q1 and len(q1["summary"]["text"]) == 160 and q1["src"].endswith("Q1")
    # 區界：外框、相鄰；祭典、老舖在哪一區（point-in-polygon）
    assert out["municipalities"][0]["bbox"] == [135.0, 35.0, 135.1, 35.1]
    assert out["municipalities"][0]["touches"] == ["200"]
    assert out["festivals"][0]["m"] == "200" and "images" not in out["festivals"][0]
    assert [s["n"] for s in out["shinise"]] == ["老舖"] and out["shinise"][0]["m"] == "100"
    # 路網：只有這一縣的節點
    assert [n[0] for n in out["railGraph"]["nodes"]] == ["n1"] and out["railGraph"]["edges"] == []


def test_build_game_writes_versioned_files(tmp_path: Path) -> None:
    b = _bundles(tmp_path)
    out = build_game(b)
    assert set(out) == {"kyoto"}
    path, meta = out["kyoto"]
    assert path == b / "game" / "kyoto.json" and len(meta["version"]) == 10
    assert json.loads(path.read_text(encoding="utf-8"))["pref"] == "kyoto"
