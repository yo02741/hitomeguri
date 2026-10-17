"""台灣出發的直飛航線：国土交通省「国際線就航状況」Excel 的列 → data/flights/taiwan_routes.json。

表的格式照 2026 夏ダイヤ 的實際內容（dump-airports 在 Actions 上印出來的前幾列與台灣的列）。"""

from __future__ import annotations

import json

from pipeline import taiwan_routes
from pipeline.taiwan_routes import parse_routes

TITLE = "2026夏ダイヤ　国際定期便（３月29日～10月24日）　※直行便ナツコクサイテイキビンチョッコウビン"
HEAD = ["空港", "地域", "国・地域", "都市", "航空会社\nコード", "航空会社", "便数／週"]
ROWS = [
    [TITLE, "", "", "", "", "", ""],
    HEAD,
    ["新千歳", "アジア", "韓国", "ソウル", "KE", "大韓航空", "14"],
    ["新千歳", "アジア", "台湾", "高雄", "IT", "タイガーエア台湾", "3"],
    ["新千歳", "アジア", "台湾", "台北", "BR", "エバー航空", "8"],
    ["新千歳", "アジア", "台湾", "台北", "CI", "チャイナ エアライン", "7"],
    ["成田", "アジア", "台湾", "台北", "MM", "ピーチアビエーション", "16.5"],
    ["成田", "アジア", "台湾", "台中", "JX", "スターラックス航空", "4"],
    ["松山", "アジア", "韓国", "ソウル", "7C", "済州航空", "14"],  # 愛媛の松山：台北の松山空港ではない
    ["中部", "アジア", "台湾", "台中", "IT", "タイガーエア台湾", "3"],
    ["どこか", "アジア", "台湾", "台北", "XX", "架空航空", "1"],
]
AIRPORTS = [
    {"id": "wd-CTS", "iata": "CTS", "name_ja": "新千歳空港", "prefecture": "hokkaido", "matched": "新千歳"},
    {"id": "wd-NRT", "iata": "NRT", "name_ja": "成田国際空港", "prefecture": "chiba", "matched": "成田"},
    {"id": "wd-NGO", "iata": "NGO", "name_ja": "中部国際空港", "prefecture": "aichi", "matched": "中部"},
    {"id": "wd-MYJ", "iata": "MYJ", "name_ja": "松山空港", "prefecture": "ehime", "matched": "松山"},
]


def test_parse_routes_taiwan_only_and_merged() -> None:
    title, routes, unmatched = parse_routes([("直行＜データ＞", ROWS)], AIRPORTS)
    assert title == "2026夏ダイヤ 国際定期便（３月29日～10月24日）"
    got = {(r.city, r.iata): r for r in routes}
    assert set(got) == {("台中", "NGO"), ("台中", "NRT"), ("台北", "CTS"), ("台北", "NRT"), ("高雄", "CTS")}
    cts = got[("台北", "CTS")]
    assert [a.code for a in cts.airlines] == ["BR", "CI"]  # 班次多的在前
    assert cts.weekly == 15
    assert got[("台北", "NRT")].airlines[0].weekly == 16.5
    assert unmatched == ["どこか"]
    # 愛媛的松山（韓國線）不會混進來
    assert all(r.iata != "MYJ" for r in routes)


def test_sheet_without_header_is_skipped() -> None:
    _, routes, _ = parse_routes([("注記", [["定期便のみ"]]), ("直行＜データ＞", ROWS)], AIRPORTS)
    assert len(routes) == 5


def test_seed_writes_sorted_json(tmp_path, monkeypatch) -> None:
    from pipeline.tests.test_airports import _xlsx

    data = _xlsx({"直行＜データ＞": ROWS})
    out = tmp_path / "taiwan_routes.json"
    monkeypatch.setattr(taiwan_routes, "get_bytes", lambda url, min_interval=1.0: data)
    monkeypatch.setattr(taiwan_routes, "TAIWAN_ROUTES_JSON", out)
    monkeypatch.setattr(taiwan_routes.major, "load_airport_seed", lambda: ({}, AIRPORTS))
    report = taiwan_routes.seed_taiwan_routes("https://example.invalid/x.xlsx")
    body = json.loads(out.read_text(encoding="utf-8"))
    assert body["source"]["url"] == "https://example.invalid/x.xlsx"
    keys = [(r["city"], r["airport"]) for r in body["routes"]]
    assert keys == sorted(keys)
    assert "## 台北" in report and "新千歳（CTS" in report
