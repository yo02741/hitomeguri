"""Overpass 的回應檢查（不連網）：回應不完整時換鏡像，全部不行就丟 RuntimeError。"""

import pytest

from pipeline.sources import osm


def _fake(monkeypatch, replies: list[dict]) -> list[str]:
    calls: list[str] = []

    def post_json(url, **_kw):
        calls.append(url)
        return replies[min(len(calls), len(replies)) - 1]

    monkeypatch.setattr(osm, "post_json", post_json)
    monkeypatch.setattr(osm, "ROUND_WAITS", (0,))
    return calls


def test_rail_routes_without_relations_tries_next_mirror(monkeypatch):
    # seed-rail #77 的福岡：沒有 remark、0 筆，原本被當成「縣內沒有鐵路」寫進去
    ok = {"elements": [{"type": "relation", "id": 1, "members": []}]}
    calls = _fake(monkeypatch, [{"elements": []}, ok])
    assert osm.rail_routes("JP-40") == ok
    assert calls == osm.ENDPOINTS


def test_rail_routes_empty_everywhere_raises(monkeypatch):
    _fake(monkeypatch, [{"elements": []}])
    with pytest.raises(RuntimeError, match="relation"):
        osm.rail_routes("JP-40")
