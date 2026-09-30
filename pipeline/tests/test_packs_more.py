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
    # 不知道縣、各縣都有：只有一家本店時用本店
    assert pack_shinise.pick_store("鶴屋吉信", None, els).osm_id == "node/1"
    assert pack_shinise.pick_store("鶴屋吉信", None, els[1:]) is None
    # 店名前後有其他字（香老舗 松栄堂 京都本店）也算；兩個字的短名只比開頭
    shop = [OsmElement("node/1", 1, 0, {"name": "香老舗 松栄堂 京都本店"})]
    assert pack_shinise.pick_store("松栄堂", "kyoto", shop).osm_id == "node/1"
    assert pack_shinise.pick_store("虎屋", "kyoto", [OsmElement("node/1", 1, 0, {"name": "大虎屋"})]) is None


def test_infobox_founded():
    box = "{{基礎情報 会社\n| 社名 = 一保堂茶舗\n| 創業 = [[1717年]]（[[享保]]2年）<ref>社史</ref>\n| 設立 = 1948年\n}}"
    assert pack_shinise.infobox_founded(box) == (1717, "1717年")
    assert pack_shinise.infobox_founded("| 創業 = 寛永年間（1624年 - 1644年）") == (1624, "1624年")
    assert pack_shinise.infobox_founded("| 創業 = 17世紀初め") == (1601, "17世紀")
    assert pack_shinise.infobox_founded("| 創業 = 享保2年") is None
    # 公司登記（設立）比創業晚：取資訊框的創業
    assert pack_shinise.founded(["1948年設立の企業"], [1948], box) == (1717, "1717年")


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
    # 遊樂設施、園區裡的看板不收；園區本身收
    ride = {"name": "フライング・スヌーピー", "tourism": "attraction", "attraction": "roller_coaster"}
    assert pack_chara.chara_record(OsmElement("node/2", 34.6, 135.4, ride), "d") is None
    sign = {"name": "キャラクター身長計（ONE PIECE）", "tourism": "attraction"}
    assert pack_chara.chara_record(OsmElement("node/3", 34.6, 135.4, sign), "d") is None
    park = {"name": "サンリオピューロランド", "tourism": "attraction"}
    assert pack_chara.chara_record(OsmElement("node/4", 35.6, 139.4, park), "d")["kind"] == "sanrio"


def test_chara_dedupe():
    def rec(i, kind, name, lat, lng, **kw):
        return {"id": f"chara-node-{i}", "kind": kind, "name": {"ja": name},
                "location": {"lat": lat, "lng": lng}, **kw}  # fmt: skip

    recs = [
        rec(1, "ghibli", "三鷹の森ジブリ美術館", 35.6962, 139.5704),
        rec(2, "ghibli", "三鷹の森ジブリ美術館", 35.6963, 139.5706, website="x"),
        rec(3, "sanrio", "HELLO KITTY HAPPY FLIGHT", 42.7876, 141.6800),
        rec(4, "sanrio", "ハローキティハッピーフライト", 42.7877, 141.6801),
        # 同名但在不同地方：兩家
        rec(5, "sanrio", "Sanrio Gift Gate", 35.690, 139.700),
        rec(6, "sanrio", "Sanrio Gift Gate", 35.660, 139.700),
    ]
    out = {r["id"] for r in pack_chara.dedupe(recs)}
    assert out == {"chara-node-2", "chara-node-4", "chara-node-5", "chara-node-6"} or out == {
        "chara-node-2", "chara-node-3", "chara-node-5", "chara-node-6"}  # fmt: skip


def test_new_pack_bundles(tmp_path):
    import json

    from pipeline import build_bundles

    castle = {"id": "castle-044", "no": 44, "group": "100", "prefecture": "aichi",
              "name": {"ja": "名古屋城", "kana": "なごやじょう", "zh_tw": "名古屋城"},
              "location": {"lat": 35.185556, "lng": 136.898611}, "stamp": ["正門改札所"],
              "spot": "wd-Q648629", "sources": [{"url": "https://ja.wikipedia.org/wiki/日本100名城"}]}  # fmt: skip
    shop = {"id": "shinise-q1", "kind": "incense", "prefecture": "kyoto",
            "name": {"ja": "松栄堂", "zh_tw": "松榮堂"}, "founded": "1705年",
            "location": {"lat": 35.0, "lng": 135.7}, "wikipedia": "https://ja.wikipedia.org/wiki/松栄堂",
            "sources": [{"url": "https://ja.wikipedia.org/wiki/松栄堂"}]}  # fmt: skip
    (tmp_path / "castles.json").write_text(json.dumps([castle]), encoding="utf-8")
    (tmp_path / "shinise.json").write_text(json.dumps([shop]), encoding="utf-8")
    [c] = build_bundles.pack_items_castle(tmp_path)
    # 中文名與日文相同時不重複
    assert c == {"id": "castle-044", "g": "100", "p": "aichi", "n": "名古屋城", "h": "なごやじょう",
                 "lat": 35.18556, "lng": 136.89861, "u": "https://ja.wikipedia.org/wiki/日本100名城",
                 "no": 44, "st": ["正門改札所"], "s": "wd-Q648629"}  # fmt: skip
    [s] = build_bundles.pack_items_shinise(tmp_path)
    assert s["g"] == "incense" and s["z"] == "松榮堂" and s["f"] == "1705年"
    assert build_bundles.pack_items_chara(tmp_path) == []


def test_seed_shinise_end_to_end(tmp_path, monkeypatch):
    """外部來源換成假資料，整個流程跑一遍（Actions 上 OSM 查詢要一小時，錯在最後很貴）。"""
    import json

    from pipeline.sources import wikidata as wd

    monkeypatch.setattr(pack_shinise, "PACKS_DIR", tmp_path)
    monkeypatch.setattr(pack_shinise, "_pref_of", lambda lat, lng: "kyoto" if lat > 34.9 else "tokyo")
    cats = {"日本の線香メーカー": ["松栄堂"], "和菓子の店舗・メーカー": ["鶴屋吉信", "新しい店"],
            "日本の製茶メーカー": []}  # fmt: skip
    monkeypatch.setattr(pack_shinise.wikipedia, "category_members", lambda site, cat, depth=0: cats[cat])
    monkeypatch.setattr(pack_shinise.wikipedia, "page_categories", lambda site, titles: {
        "松栄堂": ["18世紀設立の企業"], "鶴屋吉信": ["19世紀の日本の設立"], "新しい店": ["1990年設立の企業"],
    })  # fmt: skip
    monkeypatch.setattr(pack_shinise.wikipedia, "qids", lambda site, titles: {"松栄堂": "Q1", "鶴屋吉信": "Q2"})
    monkeypatch.setattr(pack_shinise.wikipedia, "wikitexts", lambda site, titles: {"鶴屋吉信": "| 創業 = 1803年"})
    monkeypatch.setattr(pack_shinise.wikipedia, "coordinates", lambda site, titles: {})
    ents = {
        "Q1": wd.Entity("Q1", labels={"zh-tw": "松榮堂"}, lat=35.01, lng=135.76),
        "Q2": wd.Entity("Q2", headquarters=["Q9"]),
        "Q9": wd.Entity("Q9", lat=35.02, lng=135.75),
    }
    monkeypatch.setattr(pack_shinise.wikidata, "entities", lambda ids: {i: ents[i] for i in ids if i in ents})
    els = [
        OsmElement("node/1", 35.03, 135.75, {"name": "鶴屋吉信 本店", "shop": "confectionery"}),
        OsmElement("node/2", 35.0, 135.7, {"name": "山田松香木店", "shop": "gift"}),
        OsmElement("node/3", 35.0, 135.77, {"name": "茶寮 都", "amenity": "cafe", "website": "x"}),
        OsmElement("node/4", 35.0, 135.78, {"name": "茶屋カフェ", "amenity": "cafe"}),
        OsmElement("node/5", 35.0, 135.79, {"name": "香草ヘア", "shop": "hairdresser"}),
    ]
    monkeypatch.setattr(pack_shinise.osm, "by_prefecture", lambda filters: (els, ["okinawa"]))
    report = pack_shinise.seed_shinise()
    out = {r["id"]: r for r in json.loads((tmp_path / "shinise.json").read_text(encoding="utf-8"))}
    assert out["shinise-q1"]["kind"] == "incense" and out["shinise-q1"]["name"]["zh_tw"] == "松榮堂"
    # 沒有座標的老舖：總部所在縣的 OSM 本店
    assert out["shinise-q2"]["location"] == {"lat": 35.03, "lng": 135.75}
    assert out["shinise-node-2"]["kind"] == "incense"
    assert out["shinise-node-3"]["kind"] == "teahouse"
    # 咖啡店、美容院不收；1990 年創業的不是老舖
    assert "shinise-node-4" not in out and "shinise-node-5" not in out
    assert "新しい店" in report and "okinawa" in report


def test_seed_chara_end_to_end(tmp_path, monkeypatch):
    import json

    monkeypatch.setattr(pack_chara, "PACKS_DIR", tmp_path)
    monkeypatch.setattr(pack_chara, "_pref_of", lambda lat, lng: "tokyo")
    els = [
        OsmElement("node/1", 35.6, 139.7, {"name": "Nintendo TOKYO", "shop": "video_games"}),
        OsmElement("node/2", 35.6, 139.7, {"name": "ちいかわらんど", "shop": "gift"}),
        OsmElement("node/3", 35.6, 139.7, {"name": "ワンピース", "shop": "clothes"}),
    ]
    monkeypatch.setattr(pack_chara.osm, "by_prefecture", lambda filters: (els, []))
    report = pack_chara.seed_chara()
    out = json.loads((tmp_path / "charashop.json").read_text(encoding="utf-8"))
    assert [(r["id"], r["kind"]) for r in out] == [("chara-node-1", "nintendo"), ("chara-node-2", "chiikawa")]
    assert "任天堂（1）" in report


def test_seed_castles_end_to_end(tmp_path, monkeypatch):
    import json

    from pipeline.sources import wikidata as wd

    monkeypatch.setattr(pack_castles, "PACKS_DIR", tmp_path)
    monkeypatch.setattr(pack_castles, "_pref_of", lambda lat, lng: "tokyo")
    monkeypatch.setattr(pack_castles, "spot_index", lambda: {})
    castles = [
        meijo.Castle(21, "100", "江戸城", "江戸城", ["楠公休憩場"], "日本100名城"),
        meijo.Castle(124, "zoku", "台場", "品川台場", ["潮風公園"], "続日本100名城"),
    ]
    monkeypatch.setattr(pack_castles.meijo, "castles", lambda: castles)
    monkeypatch.setattr(pack_castles.wikipedia, "qids", lambda site, titles: {"江戸城": "Q1", "台場": "Q2"})
    monkeypatch.setattr(pack_castles.wikipedia, "coordinates", lambda site, titles: {})
    monkeypatch.setattr(pack_castles.wikidata, "entities", lambda ids: {
        "Q1": wd.Entity("Q1", lat=35.68, lng=139.75), "Q2": wd.Entity("Q2"),
    })  # fmt: skip
    seen = {}

    def fake_japan(filters):
        seen["filters"] = filters
        return [OsmElement("way/7", 35.63, 139.77, {"name": "品川台場", "historic": "fort"})]

    monkeypatch.setattr(pack_castles.osm, "japan", fake_japan)
    pack_castles.seed_castles()
    out = {r["no"]: r for r in json.loads((tmp_path / "castles.json").read_text(encoding="utf-8"))}
    # 泛稱的條目標題「台場」不拿去比對
    assert '["name"="台場"]' not in seen["filters"]
    assert out[124]["location"] == {"lat": 35.63, "lng": 139.77}
    assert out[124]["sources"][-1]["url"] == "https://www.openstreetmap.org/way/7"
    assert out[21]["location"] == {"lat": 35.68, "lng": 139.75}
