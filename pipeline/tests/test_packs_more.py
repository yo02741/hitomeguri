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
        OsmElement("node/2", 2.02, 0, {"name": "鶴屋吉信 京都駅店"})]) is None  # fmt: skip
    assert pack_shinise.pick_store("鶴屋吉信", "tokyo", els).osm_id == "node/3"
    # 不知道縣、各縣都有：只有一家本店時用本店
    assert pack_shinise.pick_store("鶴屋吉信", None, els).osm_id == "node/1"
    assert pack_shinise.pick_store("鶴屋吉信", None, els[1:]) is None
    # 前面有「香老舗」「御菓子司」也算；名稱只是剛好含這幾個字的別家不算
    shop = [OsmElement("node/1", 1, 0, {"name": "香老舗 松栄堂 京都本店"})]
    assert pack_shinise.pick_store("松栄堂", "kyoto", shop).osm_id == "node/1"
    assert pack_shinise.pick_store("虎屋", "kyoto", [OsmElement("node/1", 1, 0, {"name": "大虎屋"})]) is None
    ena = [OsmElement("node/1", 1, 0, {"name": "恵那川上屋 本社恵那峡店"})]
    assert pack_shinise.pick_store("川上屋", "kyoto", ena) is None


def test_text_founded_from_real_articles():
    # 設立欄括號裡的創業（山本山）
    yamamotoyama = (
        "{{基礎情報 会社\n|本社所在地 = 東京都中央区日本橋2丁目5番1号\n"
        "|設立 = [[1941年]]（[[昭和]]16年）[[5月7日]]<br />（創業：[[1690年]]（[[元禄]]3年））\n}}\n"
        "創業者の嘉兵衛は宇治で茶を作っていた。創業330年を迎えた。"
    )
    assert pack_shinise.text_founded(yamamotoyama) == (1690, "1690年")
    # 第一段：年份在「創業」前面，中間有和曆的括號
    harimaya = "播磨屋本店は、[[1862年]]（[[文久]]2年）に油屋として創業した<ref>x</ref>。設立は[[1947年]]。"
    assert pack_shinise.text_founded(harimaya) == (1862, "1862年")
    ippodo = "享保2年（1717年）、近江屋として創業し、茶や陶器を商う。\n== 歴史 ==\n1990年に創業した分家"
    assert pack_shinise.text_founded(ippodo) == (1717, "1717年")
    # 沒有年份（室町時代後期）查不到；「創業者」不算
    assert pack_shinise.text_founded("設立 = [[1947年]]<br />創業は[[室町時代]]後期") is None
    assert pack_shinise.text_founded("1985年、創業者の孫が社長に就任した。") is None
    # 章節以後的內容不看（別家的創業）；開頭沒有時看「歴史」章節的第一段
    assert pack_shinise.text_founded("和菓子店。\n== 関連 ==\n1650年に創業した分家がある。") is None
    akafuku = "赤福は和菓子屋。\n== 歴史 ==\n1707年（宝永4年）を創業年としている。\n\n1954年に株式会社となる。"
    assert pack_shinise.text_founded(akafuku) == (1707, "1707年")
    # 公司登記（設立）比創業晚：取創業
    assert pack_shinise.founded(["1941年設立の企業"], [1941], yamamotoyama) == (1690, "1690年")


def test_hq_pref_from_infobox():
    shoeido = (
        "|本社所在地 = [[京都府]][[京都市]][[中京区]]車屋町通夷川下る真如堂町306番地\n"
        "|本店所在地 = <!-- 本社と登記上の本店所在地が異なる場合に記載 -->\n"
    )
    assert pack_shinise.hq_pref(shoeido) == "kyoto"
    # 本店所在地有寫就用本店
    assert pack_shinise.hq_pref("|本社所在地 = [[東京都]]港区\n|本店所在地 = [[大阪府]]大阪市\n") == "osaka"
    assert pack_shinise.hq_pref("|本社所在地 = [[名古屋市]]中区\n") == "aichi"
    assert pack_shinise.hq_pref("|社名 = 松栄堂\n") is None


def test_pick_store_same_place_and_own_name(monkeypatch):
    monkeypatch.setattr(pack_shinise, "_pref_of", lambda lat, lng: "kyoto")
    # 同一個地方的點與建築物：一家
    kyukyodo = [
        OsmElement("node/1", 35.0100, 135.7680, {"name": "鳩居堂", "craft": "handicraft"}),
        OsmElement("way/2", 35.0101, 135.7681, {"name": "鳩居堂", "craft": "handicraft", "building": "yes"}),
    ]
    assert pack_shinise.pick_store("鳩居堂", "kyoto", kyukyodo).osm_id == "way/2"
    # 店名本身含「総本店」：兩家同名在不同地方，不猜
    shogoin = [
        OsmElement("node/3", 35.0200, 135.7800, {"name": "聖護院八ツ橋総本店"}),
        OsmElement("node/4", 34.9900, 135.7700, {"name": "聖護院八ツ橋総本店"}),
    ]
    assert pack_shinise.pick_store("聖護院八ツ橋総本店", "kyoto", shogoin) is None
    ippodo = [OsmElement("node/5", 35.0150, 135.7670, {"name": "一保堂茶舗 京都本店", "shop": "tea"})]
    assert pack_shinise.pick_store("一保堂茶舗", "kyoto", ippodo).osm_id == "node/5"


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
    cats["和菓子の店舗・メーカー"] += ["鶴屋吉信 (薬)"]
    monkeypatch.setattr(pack_shinise.wikipedia, "page_categories", lambda site, titles: {
        "松栄堂": ["18世紀設立の企業"], "鶴屋吉信": ["19世紀の日本の設立"], "新しい店": ["1990年設立の企業"],
        "鶴屋吉信 (薬)": ["1850年設立の企業"],
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
        OsmElement("node/6", 35.0, 135.781, {"name": "お茶屋Bar 一葉", "amenity": "cafe"}),
        OsmElement("node/7", 35.0, 135.782, {"name": "中華麺飯茶屋 佳", "amenity": "restaurant"}),
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
    # 名稱有茶屋但是酒吧、中華料理
    assert "shinise-node-6" not in out and "shinise-node-7" not in out
    assert "新しい店" in report and "okinawa" in report
    # 同一家店的兩個條目（同名、同一個位置）只留創業早的
    assert [r["id"] for r in out.values() if r["name"]["ja"] == "鶴屋吉信"] == ["shinise-q2"]


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
