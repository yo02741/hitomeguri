from pathlib import Path

from pipeline import pack_castles, pack_chara, pack_shinise
from pipeline.sources import meijo, wikidata
from pipeline.sources.osm import OsmElement

FIXTURE = Path(__file__).parent / "fixtures" / "meijo_100.wiki"


def test_meijo_parse_both_formats():
    rows = {c.no: c for c in meijo.parse(FIXTURE.read_text(encoding="utf-8"), "100", "日本100名城")}
    # 所在地欄有 rowspan、欄數不固定：スタンプ設置場所取倒數第二欄
    assert rows[16].stamp == ["高崎市箕郷支所1階ロビー", "高崎市箕郷公民館", "高崎市立箕郷図書館"]
    assert rows[37].title == "一乗谷朝倉氏遺跡" and rows[37].name == "一乗谷城"
    assert rows[63].stamp[0] == "仁風閣 ※長期休館中"
    assert rows[100].title == "首里城"
    # 続日本100名城的格式（style 屬性、名稱不全在連結裡）
    assert rows[124].name == "品川台場" and rows[124].title == "台場"
    assert rows[162].name == "出石城・有子山城"
    assert rows[182].stamp == ["水城館", "JR水城駅"]


def test_castle_record_links_spot(monkeypatch):
    monkeypatch.setattr(pack_castles, "_pref_of", lambda lat, lng: "aichi")
    c = meijo.Castle(44, "100", "名古屋城", "名古屋城", ["正門改札所"], "日本100名城")
    ent = wikidata.Entity("Q648629", labels={"zh-tw": "名古屋城"}, lat=35.18, lng=136.9)
    spot = {"id": "wd-Q648629", "prefecture": "aichi", "name": {"kana": "なごやじょう"},
            "location": {"lat": 35.1, "lng": 136.8}}  # fmt: skip
    rec = pack_castles.castle_record(c, "Q648629", ent, None, spot, "d")
    assert rec["id"] == "castle-044" and rec["spot"] == "wd-Q648629"
    assert rec["name"]["kana"] == "なごやじょう"
    assert rec["location"] == {"lat": 35.18, "lng": 136.9}
    # 沒有任何座標就不收
    assert pack_castles.castle_record(c, None, None, None, None, "d") is None


def test_founded_takes_earliest():
    cats = ["16世紀の日本の設立", "1947年設立の日本企業", "和菓子の店舗・メーカー"]
    assert pack_shinise.founded(cats, []) == (1501, "16世紀")
    assert pack_shinise.founded(["1832年設立の企業"], [1840]) == (1832, "1832年")
    assert pack_shinise.founded(["京都市の菓子"], []) is None


def test_pick_store_prefers_main_store(monkeypatch):
    prefs = {"node/1": "kyoto", "node/2": "kyoto", "node/3": "tokyo"}
    monkeypatch.setattr(pack_shinise, "_pref_of", lambda lat, lng: prefs[f"node/{int(lat)}"])
    els = [
        OsmElement("node/1", 1, 0, {"name": "鶴屋吉信 本店"}),
        OsmElement("node/2", 2, 0, {"name": "鶴屋吉信 IRODORI"}),
        OsmElement("node/3", 3, 0, {"name": "鶴屋吉信 東京店"}),
    ]
    assert pack_shinise.pick_store("鶴屋吉信", "kyoto", els).osm_id == "node/1"
    # 沒有本店、同縣又有好幾家：不猜
    assert pack_shinise.pick_store("鶴屋吉信", "kyoto", els[1:2] + [
        OsmElement("node/2", 2, 0, {"name": "鶴屋吉信 京都駅店"})]) is None  # fmt: skip
    assert pack_shinise.pick_store("鶴屋吉信", "tokyo", els).osm_id == "node/3"
    assert pack_shinise.pick_store("鶴屋吉信", None, els) is None


def test_chara_brand_and_record(monkeypatch):
    monkeypatch.setattr(pack_chara, "_pref_of", lambda lat, lng: "tokyo")
    assert pack_chara.brand_of("Nintendo TOKYO") == "nintendo"
    assert pack_chara.brand_of("どんぐり共和国 そらのうえ店") == "ghibli"
    assert pack_chara.brand_of("ワンピース専門店") is None
    rec = pack_chara.chara_record(
        OsmElement("node/9", 35.6, 139.7, {"name": "サンリオギフトゲート", "shop": "gift"}), "d"
    )
    assert rec["id"] == "chara-node-9" and rec["kind"] == "sanrio"
    hotel = OsmElement("way/1", 35.6, 139.7, {"name": "ハローキティルーム", "tourism": "hotel"})
    assert pack_chara.chara_record(hotel, "d") is None
