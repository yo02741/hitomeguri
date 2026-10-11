"""市区町村界（tests/fixtures/n03_sample.geojson：京都府的幾個區，座標是假的）。"""

import io
import json
import zipfile
from pathlib import Path

import pytest

from pipeline import municipalities as mu
from pipeline.models import MunicipalityData

FIXTURES = Path(__file__).parent / "fixtures"
KYOTO = 26
TODAY = "2026-10-11"
PAGE = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html"


def _n03() -> dict:
    return json.loads((FIXTURES / "n03_sample.geojson").read_text(encoding="utf-8"))


def _data(kana=None) -> MunicipalityData:
    shapes, names, _ = mu.parse_n03(_n03(), KYOTO)
    return mu.build_data("kyoto", shapes, names, kana or {}, "N03-20250101", PAGE, TODAY)


def test_lg_code_check_digit():
    # 總務省「全国地方公共団体コード」：千代田区 131016、札幌市 011002、京都市東山区 261050
    assert mu.lg_code("13101") == "131016"
    assert mu.lg_code("01100") == "011002"
    assert mu.lg_code("26105") == "261050"
    assert mu.lg_code("26204") == "262048"


def test_names_of_both_schemas():
    # 2024 年版起：政令指定都市的區在 N03_005
    assert mu.names_of({"N03_003": "京都市", "N03_004": "京都市", "N03_005": "東山区"}) == (
        "東山区",
        "京都市",
    )
    assert mu.names_of({"N03_003": None, "N03_004": "京都市", "N03_005": "北区"}) == (
        "北区",
        "京都市",
    )
    # 舊版：區在 N03_004、市在 N03_003
    assert mu.names_of({"N03_003": "大阪市", "N03_004": "北区"}) == ("北区", "大阪市")
    # 東京的特別區、一般的市町村
    assert mu.names_of({"N03_003": None, "N03_004": "千代田区", "N03_005": None}) == (
        "千代田区",
        None,
    )
    assert mu.names_of({"N03_003": "久世郡", "N03_004": "久御山町"}) == ("久御山町", None)
    assert mu.names_of({"N03_004": None}) is None


def test_parse_n03_groups_islands_and_skips_unassigned():
    shapes, names, skipped = mu.parse_n03(_n03(), KYOTO)
    assert sorted(shapes) == ["261050", "262048", "263222"]
    assert names["261050"] == ("東山区", "京都市")
    assert len(shapes["262048"]) == 3  # 本體＋兩個島
    assert skipped == 2  # 所属未定地、別縣的區


def test_read_zip_and_download_falls_back_a_year(monkeypatch):
    from pipeline.sources import n03

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("N03-20250101_26.xml", "<gml/>")
        zf.writestr("N03-20250101_26.geojson", (FIXTURES / "n03_sample.geojson").read_bytes())
    blob = buf.getvalue()
    assert n03.read_zip(blob) == _n03()
    calls = []

    def fake(url):
        calls.append(url)
        return blob if "N03-2025/" in url else None

    monkeypatch.setattr(n03, "get_bytes", fake)
    data, year = n03.download(26)
    assert year == 2025 and data == _n03()
    assert calls[0] == "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_26_GML.zip"
    monkeypatch.setattr(n03, "get_bytes", lambda url: None)
    with pytest.raises(RuntimeError):
        n03.download(26)


def test_kana_from_wikidata_bindings():
    def row(qid, code, kana=None, end=None):
        b = {"item": {"value": f"http://www.wikidata.org/entity/{qid}"}, "code": {"value": code}}
        if kana:
            b["kana"] = {"value": kana}
        if end:
            b["end"] = {"value": end}
        return b

    rows = [
        row("Q1", "261050", "ひがしやまく"),
        row("Q2", "262048", "うじし"),
        row("Q3", "262048", "うじし", end="1951-01-01"),  # 廢止的舊項目不算
        row("Q4", "263222", "くみやまちょう"),
        row("Q5", "263222", "くみやまちょう"),  # 兩個現存項目：不確定，不用
        row("Q6", "13101", "チヨダク"),  # 5 碼、片假名
        row("Q7", "131017", "x"),  # 檢查碼不對
    ]
    got = mu.kana_from_bindings(rows)
    assert got == {
        "261050": ("ひがしやまく", "https://www.wikidata.org/wiki/Q1"),
        "262048": ("うじし", "https://www.wikidata.org/wiki/Q2"),
        "131016": ("ちよだく", "https://www.wikidata.org/wiki/Q6"),
    }


def test_build_data_keeps_topology_sources_and_drops_tiny_islets():
    data = _data({"261050": ("ひがしやまく", "https://www.wikidata.org/wiki/Q1")})
    feats = {f.id: f for f in data.features}
    assert [f.id for f in data.features] == ["261050", "262048", "263222"]
    hig = feats["261050"]
    assert (hig.properties.name, hig.properties.city, hig.properties.kana) == (
        "東山区",
        "京都市",
        "ひがしやまく",
    )
    assert hig.properties.kana_source_url == "https://www.wikidata.org/wiki/Q1"
    assert hig.properties.source_url == PAGE and hig.properties.retrieved == TODAY
    assert feats["262048"].properties.kana is None
    # 宇治市：本體（含飛地的洞）＋ 0.000004 度² 的島；更小的島拿掉
    uji = feats["262048"].geometry.coordinates
    assert len(uji) == 2 and len(uji[0]) == 2
    # 飛地的外環 = 宇治市的洞
    assert {tuple(p) for p in uji[0][1]} == {
        tuple(p) for p in feats["263222"].geometry.coordinates[0][0]
    }
    # 共用邊界兩邊一致；鋸齒（1 m）簡化掉
    def on_border(mp):
        return {tuple(p) for poly in mp for ring in poly for p in ring if abs(p[0] - 135.78) < 0.0001}

    assert on_border(hig.geometry.coordinates) == on_border(uji) == {(135.78, 34.98), (135.78, 35.0)}
    assert data.license.startswith("CC BY 4.0") and "国土数値情報" in data.attribution


def test_render_roundtrip_and_load(tmp_path):
    data = _data()
    path = mu.write(data, tmp_path)
    text = path.read_text(encoding="utf-8")
    assert text.startswith('{\n  "type": "FeatureCollection",\n  "prefecture": "kyoto",')
    assert len(text.splitlines()) == 9 + len(data.features) + 2
    assert mu.load("kyoto", tmp_path) == data
    assert mu.load("osaka", tmp_path) is None


def test_areas_point_in_polygon_enclave_and_fallback():
    areas = mu.Areas(_data())
    assert areas.code_at(34.99, 135.77) == "261050"
    assert areas.code_at(34.995, 135.79) == "262048"
    assert areas.code_at(34.9875, 135.7925) == "263222"  # 飛地：不是外面的宇治市
    assert areas.code_at(34.981, 135.811) == "262048"  # 島
    # 簡化後的海岸外 1 km：取最近的區；太遠就沒有
    assert areas.code_at(34.97, 135.77) == "261050"
    assert areas.code_at(34.9, 135.77) is None


def test_assign_municipalities_inserts_after_prefecture(tmp_path):
    spots_dir, root = tmp_path / "spots", tmp_path / "municipalities"
    spots_dir.mkdir()
    mu.write(_data(), root)
    base = {"name": {"ja": "x", "zh_tw": "x"}, "prefecture": "kyoto", "kind": "major",
            "updated_at": "2026-10-01"}  # fmt: skip
    spots = [
        {"id": "wd-Q1", **base, "location": {"lat": 34.99, "lng": 135.77}},
        {"id": "wd-Q2", "name": base["name"], "location": {"lat": 34.995, "lng": 135.79},
         "prefecture": "kyoto", "city": "宇治市", "kind": "major", "updated_at": "2026-10-01",
         "season_images": {}},
        {"id": "wd-Q3", **base, "location": {"lat": 30.0, "lng": 135.0}},
    ]  # fmt: skip
    (spots_dir / "kyoto.json").write_text(
        json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    report = mu.assign_municipalities(["kyoto", "nara"], spots_dir, root)
    assert "| kyoto | 3 | 2 | 1 | 2 |" in report and "nara" in report
    out = json.loads((spots_dir / "kyoto.json").read_text(encoding="utf-8"))
    assert list(out[0]) == ["id", "name", "prefecture", "municipality", "kind", "updated_at",
                            "location"]  # fmt: skip
    assert out[0]["municipality"] == "261050"
    # city 之後；其他欄位（season_images 在最後）的順序不動
    assert list(out[1])[4:6] == ["city", "municipality"] and list(out[1])[-1] == "season_images"
    assert "municipality" not in out[2]
    before = (spots_dir / "kyoto.json").read_text(encoding="utf-8")
    assert "| kyoto | 3 | 2 | 1 | 0 |" in mu.assign_municipalities(["kyoto"], spots_dir, root)
    assert (spots_dir / "kyoto.json").read_text(encoding="utf-8") == before


def test_web_bundle_is_coarser_with_numeric_ids():
    data = _data({"261050": ("ひがしやまく", "https://www.wikidata.org/wiki/Q1")})
    web = mu.web_bundle(data)
    assert web["type"] == "FeatureCollection" and "国土数値情報" in web["attribution"]
    first = web["features"][0]
    assert first["id"] == 261050
    assert first["properties"] == {"m": "261050", "n": "東山区", "h": "ひがしやまく", "c": "京都市"}
    uji = next(f for f in web["features"] if f["properties"]["m"] == "262048")
    assert len(uji["geometry"]["coordinates"]) == 1  # web 版拿掉小島


def test_seed_municipalities_offline(tmp_path, monkeypatch):
    from pipeline.sources import n03

    monkeypatch.setattr(n03, "download", lambda no: (_n03(), 2025))
    monkeypatch.setattr(mu, "fetch_kana", lambda: {"262048": ("うじし", "https://www.wikidata.org/wiki/Q2")})
    report = mu.seed_municipalities(["kyoto"], tmp_path)
    assert "| kyoto | N03-20250101 | 3 | 1 | 2 |" in report
    data = mu.load("kyoto", tmp_path)
    assert data and data.dataset == "N03-20250101" and data.source.url == PAGE
