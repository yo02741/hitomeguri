"""日帰り的目的地（pipeline/daytrip.py）與前端 Dijkstra 的對照資料（web/src/services/daytrip.test.ts）。"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from pipeline import daytrip
from pipeline import rail_graph as rg
from pipeline.models import DaytripBundle
from pipeline.paths import WEB

FIXTURES = WEB / "src" / "services" / "fixtures"
GRAPH = FIXTURES / "rail-graph-small.json"
EXPECTED = FIXTURES / "rail-graph-small.expected.json"
# 前端的測試用同樣的起點與距離上限（daytrip.test.ts 讀 EXPECTED）
# 小數 1 位的四捨五入也要相同：1.65（實際是 1.6499…）→ 1.6、0.25（剛好一半）→ 0.2（Python 取偶數）
CASES = [
    ("n-a", 450.0),
    ("n-a", 30.0),
    ("n-g", 80.0),
    ("n-i", 60.0),
    ("n-k", 450.0),
    ("n-x", 100.0),
]


def _spot(sid, name, m, st, score):
    s = {"id": sid, "n": name, "lat": 35.0, "lng": 139.0, "k": "major", "f": 0, "s": score}
    if m:
        s["m"] = m
    if st:
        s["st"] = st
    return s


def _munis():
    def f(code, name, label, city=None):
        props = {"m": code, "n": name, "l": label}
        if city:
            props["c"] = city
        return {"type": "Feature", "id": int(code), "properties": props, "geometry": {}}

    return {
        "saitama": {"features": [
            f("112011", "川越市", [139.4855, 35.9251]),
            f("111015", "西区", [139.58, 35.92], "さいたま市"),
            f("113433", "ときがわ町", [139.29, 36.0]),
        ]},
        "tokyo": {"features": [f("131016", "千代田区", [139.7516, 35.6856])]},
    }  # fmt: skip


def _spots():
    return {
        "saitama": [
            _spot("wd-Q1", "喜多院", "112011", "node-1", 70.0),
            _spot("wd-Q2", "川越氷川神社", "112011", None, 80.0),
            _spot("wd-Q3", "時の鐘", "112011", "node-1", 75.0),
            _spot("wd-Q4", "蓮馨寺", "112011", "node-2", 60.0),
            _spot("wd-Q5", "中院", "112011", "node-1", 60.0),
            _spot("wd-Q6", "大宮公園", "111015", "node-9", 50.0),
            # 景點都對不到車站：不列
            _spot("wd-Q7", "慈光寺", "113433", None, 65.0),
            # 不在任何區（還沒有區界）：不算
            _spot("wd-Q8", "どこか", None, "node-8", 99.0),
        ],
        "tokyo": [_spot("wd-Q9", "皇居", "131016", "node-0", 90.0)],
    }


def test_areas_pick_top_spots_and_other_stations():
    out = daytrip.areas(_spots(), _munis())
    assert [a["m"] for a in out] == ["111015", "112011", "131016"]
    kawagoe = out[1]
    assert kawagoe["n"] == "川越市" and kawagoe["p"] == "saitama" and "c" not in kawagoe
    assert (kawagoe["lat"], kawagoe["lng"]) == (35.9251, 139.4855)
    # 分數高的 3 個；對不到車站的景點照樣列，車站是 None
    assert kawagoe["s"] == [
        ["wd-Q2", "川越氷川神社", None, 80.0],
        ["wd-Q3", "時の鐘", "node-1", 75.0],
        ["wd-Q1", "喜多院", "node-1", 70.0],
    ]
    # 其餘景點的車站：不重複、不含前 3 個的（node-1）
    assert kawagoe["x"] == ["node-2"]
    assert out[0]["c"] == "さいたま市" and "x" not in out[0]


def test_bundle_validates_and_writes_version(tmp_path: Path):
    written = daytrip.write(tmp_path, _spots(), _munis())
    assert written is not None
    path, meta = written
    body = json.loads(path.read_text(encoding="utf-8"))
    DaytripBundle.model_validate(body)
    assert meta["areas"] == 3 and len(meta["version"]) == 10
    assert body["areas"][1]["s"][0][2] is None
    assert daytrip.write(tmp_path / "empty", {}, _munis()) is None


def test_model_rejects_too_many_spots():
    area = {"m": "112011", "n": "川越市", "p": "saitama", "lat": 35.9, "lng": 139.4,
            "s": [["a", "a", None, 1.0]] * 4}  # fmt: skip
    with pytest.raises(ValidationError):
        DaytripBundle.model_validate({"attribution": "x", "areas": [area]})


def expected_reach() -> dict:
    """對照資料：pipeline 的 within（實際 km、新幹線 km，小數 1 位）。"""
    g = rg.from_bundle(json.loads(GRAPH.read_text(encoding="utf-8")))
    cases = []
    for base, max_km in CASES:
        reach = rg.within(g, base, max_km)
        cases.append({
            "base": base,
            "max_km": max_km,
            "reach": {k: [r.km, r.shinkansen_km] for k, r in sorted(reach.items())},
        })  # fmt: skip
    return {"cases": cases}


def test_frontend_fixture_matches_pipeline():
    """web/src/services/daytrip.ts 是 rail_graph 的移植：兩邊對同一份對照資料。
    rail_graph 的演算法改了，這個測試會失敗；重新產生 EXPECTED 後前端的測試也要跟著過。"""
    want = expected_reach()
    assert json.loads(EXPECTED.read_text(encoding="utf-8")) == want
    first = want["cases"][0]["reach"]
    # 新幹線權重 0.97：東京→品川走新幹線一站（6.8 km），但不到 20 km 不算可以搭新幹線
    assert first["n-b"] == [6.8, 6.8]
    assert first["n-h"][1] >= rg.SHINKANSEN_MIN_KM
    assert "n-k" not in first


if __name__ == "__main__":
    EXPECTED.write_text(json.dumps(expected_reach(), ensure_ascii=False, indent=2) + "\n")
