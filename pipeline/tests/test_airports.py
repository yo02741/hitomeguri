"""seed-airports（不連網）：国土交通省「国際定期便の概要」的文字（仿 PDF 取出的文字）
× Wikidata 的日本機場（SPARQL 結果；QID 是測試用的佔位值，座標是各機場的大約位置）。"""

import datetime as dt
import json
from pathlib import Path

import pytest

from pipeline import airports, curate, geo, major, validate, wiki
from pipeline.models import AirportSeed, Spot
from pipeline.sources import wikidata
from pipeline.sources.commons import ImageInfo
from pipeline.sources.osm import OsmElement
from pipeline.sources.wikidata import Entity

FIXTURES = Path(__file__).parent / "fixtures"
TEXT = (FIXTURES / "mlit_kokusai_teikibin.txt").read_text(encoding="utf-8")
ROWS = json.loads((FIXTURES / "wikidata_airports_sparql.json").read_text(encoding="utf-8"))
PDF_URL = "https://www.mlit.go.jp/report/press/content/001998668.pdf"

# 文字裡有國際定期航班的機場
EXPECTED = {
    "OKA", "HND", "NRT", "KIX", "NGO", "CTS", "FUK", "SDJ", "HIJ", "KMQ", "FSZ", "KKJ", "ISG",
    "KOJ", "NGS", "HSG", "TAK", "MYJ", "KMJ", "IBR",
}  # fmt: skip


@pytest.fixture(autouse=True)
def coarse_borders(monkeypatch):
    # 不下載原始縣界：用 repo 裡的簡化縣界（關西、中部的人工島在裡面；長崎、北九州不在）
    monkeypatch.setattr(geo, "contains_fine", geo.contains)


def _candidates():
    return airports.parse_candidates(ROWS)


def _civil():
    return {q: c for q, c in _candidates().items() if not airports.exclusion_reason(c)}


def test_parse_candidates_and_exclusions():
    cands = _candidates()
    assert len(cands) == 28
    naha = cands["Q9000001"]
    assert (naha.iata, naha.name_ja, naha.lat, naha.lng) == ("OKA", "那覇空港", 26.1958, 127.6459)
    assert naha.kinds == {"空港", "airport"}
    assert naha.admin_prefs == {"okinawa"}
    assert cands["Q9000005"].aliases == {"セントレア"}
    assert cands["Q9000012"].admin_prefs == {"osaka", "hyogo"}  # 伊丹：跨兩縣

    reasons = {q: airports.exclusion_reason(c) for q, c in cands.items()}
    assert reasons["Q9000024"].startswith("軍用")  # 航空自衛隊の基地
    assert reasons["Q9000025"].startswith("不是機場")  # IATA 都市代碼（東京 TYO）
    assert reasons["Q9000010"] is None  # 軍民共用空港
    assert reasons["Q9000027"] is None  # 沒有類型：有 IATA 代碼就當成機場
    assert reasons["Q9000028"].startswith("軍用")  # 百里飛行場：只標了基地的類型
    assert sum(r is not None for r in reasons.values()) == 3


def test_name_variants():
    cands = _candidates()
    haneda = airports.name_variants(cands["Q9000002"])
    assert {"東京国際空港", "羽田", "羽田空港"} <= haneda
    assert "東京" not in haneda and "東京空港" not in haneda  # 東京有兩個機場
    itami = airports.name_variants(cands["Q9000012"])
    assert "伊丹" in itami and "大阪" not in itami
    assert "丘珠" in airports.name_variants(cands["Q9000014"])
    assert "札幌" not in airports.name_variants(cands["Q9000014"])
    assert {"セントレア", "中部", "中部国際空港"} <= airports.name_variants(cands["Q9000005"])
    assert {"那覇", "那覇空港"} <= airports.name_variants(cands["Q9000001"])


def test_match_pdf_text():
    cands = _civil()
    res = airports.match_airports(TEXT, cands)
    by_iata = {cands[q].iata: {m.matched for m in ms} for q, ms in res.matches.items()}
    assert set(by_iata) == EXPECTED - {"IBR"}  # 百里飛行場是軍用類型，見 test_military_fallback
    # 「大阪（関西）」「名古屋（中部）」「札幌（新千歳）」「宮古島市」：伊丹、小牧、丘珠、宮古不算
    assert not {"ITM", "NKM", "OKD", "MMY", "UKB", "HAC"} & set(by_iata)
    assert {"羽田"} <= by_iata["HND"] and {"成田"} <= by_iata["NRT"]
    assert "関西国際空港" in by_iata["KIX"]
    assert "仙台" in by_iata["SDJ"]  # 「仙 台」：字間有空白
    assert "長崎" in by_iata["NGS"]  # 「⻑崎」：取成部首字元
    assert by_iata["HSG"] == {"HSG"}  # 只有 IATA 代碼（全形）
    assert res.ambiguous == {}
    naha = res.matches["Q9000001"][0]
    assert naha.matched == "那覇" and "160" in naha.context

    # 給人檢查：像機場名稱但沒對到的、表格列名沒對到的
    assert res.unmatched_airport_like == ["首都圏空港", "下地島空港", "徳島阿波おどり空港"]
    assert {"釧路", "韓国", "台湾"} <= set(res.unmatched_rows)
    assert not {"那覇", "成田", "仙台"} & set(res.unmatched_rows)


def test_military_fallback():
    cands = _candidates()
    reasons = {q: r for q, c in cands.items() if (r := airports.exclusion_reason(c))}
    civil = {q: c for q, c in cands.items() if q not in reasons}
    res = airports.match_airports(TEXT, civil)
    hidden = airports.match_airports(TEXT, {q: cands[q] for q in reasons}).matches
    # 小松飛行場（基地）：同名的小松空港已經對到，不收；百里飛行場：「茨城」沒有民用機場對到，收錄
    assert set(hidden) == {"Q9000024", "Q9000028"}
    assert set(airports.military_fallback(res.matches, hidden, cands, reasons)) == {"Q9000028"}


def test_segment_and_boundaries():
    cands = {
        "Q1": airports.Candidate("Q1", "NRT", "成田国際空港", 35.76, 140.39),
        "Q2": airports.Candidate("Q2", "HND", "東京国際空港", 35.55, 139.78),
        "Q3": airports.Candidate("Q3", "OIT", "大分空港", 33.48, 131.74),
        "Q4": airports.Candidate("Q4", "KMJ", "熊本空港", 32.84, 130.86),
    }
    hit = lambda text: set(airports.match_airports(text, cands).matches)  # noqa: E731
    assert hit("成田羽田") == {"Q1", "Q2"}  # 表格的格子黏在一起
    assert hit("羽田発着の路線") == {"Q2"}
    assert hit("大分県") == set()  # 縣名
    assert hit("大分増加した") == set()  # 「大分」當副詞
    assert hit("大分 12 10 2") == {"Q3"}
    assert hit("阿蘇くまもと空港は週4便") == {"Q4"}  # 含平假名的通稱


def test_resolve_prefecture():
    cands = _candidates()
    assert airports.resolve_prefecture(cands["Q9000004"]) == ("osaka", "縣界")  # 関西（人工島）
    assert airports.resolve_prefecture(cands["Q9000005"]) == ("aichi", "縣界")  # 中部
    assert airports.resolve_prefecture(cands["Q9000002"]) == ("tokyo", "縣界")  # 羽田
    # 長崎空港（大村灣的島）：不在簡化縣界內 → Wikidata 所在地
    assert airports.resolve_prefecture(cands["Q9000019"]) == ("nagasaki", "Wikidata 所在地")
    # 所在地也沒有：最近的縣界
    kkj = cands["Q9000016"]
    kkj.admin_prefs = set()
    assert airports.resolve_prefecture(kkj) == ("fukuoka", "最近的縣界")


def _tiny_pdf(text: str) -> bytes:
    content = f"BT /F1 12 Tf 10 50 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return out


def test_pdf_text():
    text, pages = airports.pdf_text(_tiny_pdf("NRT OKA"))
    assert pages == 1
    assert "NRT OKA" in text


# ---------- seed-airports 全流程 ----------


def _spot(sid, ja, pref, lat, lng, **kw):
    return Spot.model_validate({
        "id": sid, "name": {"ja": ja, "zh_tw": ja}, "location": {"lat": lat, "lng": lng},
        "prefecture": pref, "kind": "major", "updated_at": "2026-01-01",
        "sources": [{"url": "https://www.wikidata.org/wiki/" + sid[3:], "fetched_at": "2026-01-01"}],
        **kw,
    }).model_dump(mode="json", exclude_none=True)  # fmt: skip


def _entities():
    out = {}
    for c in _candidates().values():
        e = Entity(qid=c.qid, labels={"ja": c.name_ja}, lat=c.lat, lng=c.lng)
        e.instance_of = ["QAIRPORT"]
        e.sitelinks = {"jawiki": c.name_ja}
        out[c.qid] = e
    naha = out["Q9000001"]
    naha.labels.update({"zh-tw": "那霸機場", "en": "Naha Airport"})
    naha.kana_all = ["なはくうこう"]
    naha.image = "Naha Airport.jpg"
    naha.sitelinks["zhwiki"] = "那霸機場"
    return out


@pytest.fixture
def offline(monkeypatch, tmp_path):
    seed = tmp_path / "seed" / "airports.json"
    spots = tmp_path / "spots"
    spots.mkdir()
    (spots / "okinawa.json").write_text(
        json.dumps(
            [
                _spot("wd-Q9000015", "宮古空港", "okinawa", 24.7828, 125.295, tags=["機場"]),
                _spot("wd-Q9100001", "首里城", "okinawa", 26.217, 127.7195, tags=["城"]),
            ],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    ents = _entities()
    monkeypatch.setattr(airports, "AIRPORTS_JSON", seed)
    monkeypatch.setattr(major, "AIRPORTS_JSON", seed)
    monkeypatch.setattr(airports, "SPOTS_DIR", spots)
    monkeypatch.setattr(airports, "fetch_pdf_text", lambda url: (TEXT, 3))
    monkeypatch.setattr(airports, "fetch_candidates", lambda: ROWS)
    monkeypatch.setattr(wikidata, "entities", lambda qids: {q: ents[q] for q in qids if q in ents})
    monkeypatch.setattr(wikidata, "labels_ja", lambda qids: {"QAIRPORT": "空港"})
    monkeypatch.setattr(major.pageviews, "yearly_views", lambda site, title: 5000)
    monkeypatch.setattr(
        airports.commons,
        "image_info",
        lambda files: {
            "Naha Airport.jpg": ImageInfo(
                "https://u/naha.jpg", "Someone", "CC BY-SA 4.0", "https://commons/File:Naha", 800, 600
            )
        },
    )
    station = OsmElement(
        "node/1", 26.2064, 127.6522, {"name": "那覇空港", "name:ja-Hira": "なはくうこう", "name:en": "Naha Airport"}
    )
    monkeypatch.setattr(airports.osm, "stations", lambda bbox: [station])
    monkeypatch.setattr(
        wiki.wikipedia,
        "intro_extracts",
        lambda site, titles: {"zhwiki": {"那霸機場": "那霸機場是位於沖繩縣那霸市的機場。"}}.get(site, {}),
    )
    return tmp_path


def test_seed_airports_end_to_end(offline):
    report = airports.seed_airports(PDF_URL)
    today = dt.date.today().isoformat()

    # data/seed/airports.json：schema、依 id 排序、縣、對到的字串
    path = offline / "seed" / "airports.json"
    text = path.read_text(encoding="utf-8")
    data = json.loads(text)
    seed = AirportSeed.model_validate(data)
    assert text == json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    assert data["source"] == {"url": PDF_URL, "fetched_at": today}
    ids = [a.id for a in seed.airports]
    assert ids == sorted(ids)
    assert {a.iata for a in seed.airports} == EXPECTED
    pref = {a.iata: a.prefecture for a in seed.airports}
    assert pref["OKA"] == "okinawa" and pref["KIX"] == "osaka" and pref["NGO"] == "aichi"
    assert pref["HND"] == "tokyo" and pref["NRT"] == "chiba" and pref["NGS"] == "nagasaki"
    assert pref["KKJ"] == "fukuoka" and pref["CTS"] == "hokkaido" and pref["KMQ"] == "ishikawa"
    assert pref["IBR"] == "ibaraki"
    assert next(a for a in seed.airports if a.iata == "OKA").matched == "那覇"
    assert next(a for a in seed.airports if a.iata == "HSG").matched == "HSG"

    # 景點：機場加進各縣（其他景點不動），不再列出的機場移除
    okinawa = json.loads((offline / "spots" / "okinawa.json").read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in okinawa}
    assert set(by_id) == {"wd-Q9000001", "wd-Q9000017", "wd-Q9100001"}  # 宮古空港移除
    assert by_id["wd-Q9100001"]["tags"] == ["城"]
    naha = by_id["wd-Q9000001"]
    assert naha["tags"] == ["機場"]
    assert naha["featured"] is False
    assert naha["name"] | {"romaji": ""} == {
        "ja": "那覇空港", "kana": "なはくうこう", "romaji": "", "zh_tw": "那霸機場",
        "en": "Naha Airport",
    }  # fmt: skip
    assert naha["name"]["romaji"]  # 由念法轉寫（kana.romaji_with_spacing）
    assert naha["kana_source"] == "wikidata"
    assert naha["summary"]["lang"] == "zh"
    assert naha["images"][0]["author"] == "Someone"
    assert naha["nearest_stations"][0]["name"]["ja"] == "那覇空港"
    assert {"url": PDF_URL, "fetched_at": today} in naha["sources"]
    assert naha["sources"][0]["url"] == "https://www.wikidata.org/wiki/Q9000001"
    assert naha["score"] > 0
    osaka = json.loads((offline / "spots" / "osaka.json").read_text(encoding="utf-8"))
    assert [s["id"] for s in osaka] == ["wd-Q9000004"]

    # 報告：對到的機場與原文、排除的軍用機場、沒對到的字串、景點的增減
    assert "| 那覇空港 | OKA | okinawa | 那覇 |" in report
    assert "小松飛行場（軍用" in report
    assert "所以收錄（請檢查）：百里飛行場（軍用" in report
    assert "下地島空港" in report and "徳島阿波おどり空港" in report
    assert "釧路" in report
    assert "移除 1" in report and "宮古空港（okinawa）" in report

    # 資料檢查：清單與景點都過
    res = validate.Result()
    validate.check_airports(offline, set(geo.pref_slugs()), res)
    assert res.errors == []
    assert not any("還不是景點" in w for w in res.warnings)
    for p in sorted((offline / "spots").glob("*.json")):
        t = p.read_text(encoding="utf-8")
        validate.check_format(p, t, json.loads(t), res)
        validate.check_models(p, json.loads(t), Spot, res)
    assert res.errors == []

    # 再跑一次：檔案不變（取得日期、updated_at 沿用）
    before = {p.name: p.read_bytes() for p in (offline / "spots").glob("*.json")}
    seed_before = path.read_bytes()
    again = airports.seed_airports(PDF_URL)
    assert {p.name: p.read_bytes() for p in (offline / "spots").glob("*.json")} == before
    assert path.read_bytes() == seed_before
    assert "新列入：（無）" in again


def test_seed_airports_refuses_garbage_text(offline, monkeypatch):
    monkeypatch.setattr(airports, "fetch_pdf_text", lambda url: ("\x00\x01 (cid:12)(cid:34)", 2))
    with pytest.raises(RuntimeError, match="沒有寫檔"):
        airports.seed_airports(PDF_URL)
    assert not (offline / "seed" / "airports.json").exists()


# ---------- 例外只給清單上的機場 ----------


def _write_seed(path, *airports_):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "source": {"url": PDF_URL, "fetched_at": "2026-10-11"},
        "airports": [
            {"id": f"wd-{q}", "wikidata": q, "iata": iata, "name_ja": ja, "prefecture": pref,
             "matched": ja}
            for q, iata, ja, pref in airports_
        ],
    }  # fmt: skip
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def test_drop_non_spots_exempts_only_listed_airports(monkeypatch, tmp_path):
    seed = tmp_path / "airports.json"
    _write_seed(seed, ("QA", "AAA", "テスト空港", "kyoto"))
    monkeypatch.setattr(major, "AIRPORTS_JSON", seed)
    monkeypatch.setattr(major.wikidata, "labels_ja", lambda qids: {"QAIR": "空港"})
    monkeypatch.setattr(major, "SEED_DIR", tmp_path)  # 沒有 exclude.json

    def draft(qid, airport):
        ent = Entity(qid=qid, labels={"ja": f"{qid}空港"}, lat=35.0, lng=135.75)
        ent.instance_of = ["QAIR"]
        return major.Draft(key=qid, lat=35.0, lng=135.75, ent=ent, airport=airport)

    drafts = {"QA": draft("QA", True), "QB": draft("QB", True), "QC": draft("QC", False)}
    dropped = major.drop_non_spots(drafts)
    assert set(drafts) == {"QA"}  # QB 有旗標但不在清單上、QC 是一般機場：都排除
    assert sorted(dropped) == ["QB空港", "QC空港"]


def test_prune_wikidata_skips_listed_airports(monkeypatch, tmp_path):
    seed = tmp_path / "airports.json"
    _write_seed(seed, ("QA", "AAA", "テスト空港", "kyoto"))
    monkeypatch.setattr(major, "AIRPORTS_JSON", seed)
    ents = {}
    for q in ("QA", "QB"):
        ents[q] = Entity(qid=q, labels={"ja": q}, lat=35.0, lng=135.75, instance_of=["QAIR"])
    monkeypatch.setattr(wikidata, "entities", lambda qids: {q: ents[q] for q in qids if q in ents})
    monkeypatch.setattr(wikidata, "labels_ja", lambda qids: {"QAIR": "空港"})
    spots = [
        _spot("wd-QA", "テスト空港", "kyoto", 35.0, 135.75, tags=["機場"],
              external_ids={"wikidata": "QA"}),
        _spot("wd-QB", "テスト飛行場", "kyoto", 35.0, 135.75, external_ids={"wikidata": "QB"}),
    ]  # fmt: skip
    assert curate.wikidata_non_spots(spots) == {"wd-QB": "空港"}


def test_seed_region_keeps_listed_airports(monkeypatch, tmp_path):
    seed = tmp_path / "seed" / "airports.json"
    _write_seed(seed, ("QA", "AAA", "テスト国際空港", "kyoto"))
    ents = {
        "QA": Entity("QA", labels={"ja": "テスト国際空港"}, lat=35.0, lng=135.75,
                     instance_of=["QAIR"], sitelinks={"jawiki": "テスト国際空港"}),
        "QB": Entity("QB", labels={"ja": "テスト飛行場"}, lat=35.01, lng=135.76,
                     instance_of=["QAIR"], sitelinks={"jawiki": "テスト飛行場"}),
        "QT": Entity("QT", labels={"ja": "テスト寺"}, lat=35.02, lng=135.77,
                     sitelinks={"jawiki": "テスト寺"}),
    }  # fmt: skip
    monkeypatch.setattr(major, "AIRPORTS_JSON", seed)
    monkeypatch.setattr(major, "SPOTS_DIR", tmp_path / "spots")
    monkeypatch.setattr(major, "OFFICIAL_SOURCES", {})
    monkeypatch.setattr(major.osm, "attractions", lambda iso: [])
    monkeypatch.setattr(major.osm, "attractions_bbox", lambda bbox: [])
    monkeypatch.setattr(major.osm, "stations", lambda bbox: [])
    monkeypatch.setattr(major.wikidata, "heritage_items_in_box", lambda *a: ["QB", "QT"])
    monkeypatch.setattr(
        major.wikidata, "entities", lambda qids: {q: ents[q] for q in qids if q in ents}
    )
    monkeypatch.setattr(major.wikidata, "labels_ja", lambda qids: {"QAIR": "空港"})
    monkeypatch.setattr(major.wikidata, "search", lambda name, **kw: [])
    monkeypatch.setattr(major.wikidata, "prefecture_items", lambda: {})
    monkeypatch.setattr(major.wikidata, "parents", lambda qids: {})
    monkeypatch.setattr(major.pageviews, "yearly_views", lambda site, title: 1000)
    monkeypatch.setattr(major.commons, "image_info", lambda files: {})
    monkeypatch.setattr(major, "load_seeds", lambda pref: [])
    monkeypatch.setattr(major, "tourism_qids", lambda pref: set())
    monkeypatch.setattr(major, "extra_category_qids", lambda pref: set())
    monkeypatch.setattr(wiki.wikipedia, "intro_extracts", lambda site, titles: {})

    major.seed_region("kyoto")
    spots = json.loads((tmp_path / "spots" / "kyoto.json").read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in spots}
    # 清單上的機場收錄（不在 Wikidata 候選裡也補查）；其他機場照樣排除
    assert set(by_id) == {"wd-QA", "wd-QT"}
    assert by_id["wd-QA"]["tags"] == ["機場"]
    assert by_id["wd-QA"]["featured"] is False  # 機場不列入精選
    assert {"url": PDF_URL, "fetched_at": "2026-10-11"} in by_id["wd-QA"]["sources"]


def test_validate_airports_errors(tmp_path):
    seed = tmp_path / "seed" / "airports.json"
    _write_seed(seed, ("Q2", "BBB", "B空港", "kyoto"), ("Q1", "AAA", "A空港", "nowhere"))
    res = validate.Result()
    validate.check_airports(tmp_path, set(geo.pref_slugs()), res)
    assert any("沒有依 id 排序" in e for e in res.errors)
    assert any("nowhere" in e for e in res.errors)
    assert any("還不是景點" in w for w in res.warnings)


def test_xlsx_text_reads_shared_and_inline_strings():
    import io
    import zipfile

    from pipeline.airports import xlsx_text

    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(
            "xl/sharedStrings.xml",
            f'<sst {ns}><si><t>那覇</t></si><si><r><t>新</t></r><r><t>千歳</t></r></si></sst>',
        )
        z.writestr(
            "xl/worksheets/sheet1.xml",
            f'<worksheet {ns}><sheetData><row><c t="inlineStr"><is><t>福岡</t></is></c></row>'
            "</sheetData></worksheet>",
        )
    text, sheets = xlsx_text(buf.getvalue())
    assert text.split("\n") == ["那覇", "新千歳", "福岡"]
    assert sheets == 1
