from pipeline import major
from pipeline.sources import gotokyo, kyototravel, osakainfo, sitemap
from pipeline.sources.okinawastory import OfficialSpot
from pipeline.sources.osm import OsmElement


def test_sitemap_locs_unescape():
    text = (
        "<url><loc>https://ja.kyoto.travel/tourism/single01.php?category_id=7&amp;tourism_id=1"
        "</loc></url>"
    )
    assert sitemap.locs(text) == [
        "https://ja.kyoto.travel/tourism/single01.php?category_id=7&tourism_id=1"
    ]


def test_osakainfo_json_ld():
    page = """
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"TouristAttraction","name":"四天王寺",
 "geo":{"@type":"GeoCoordinates","latitude":34.654,"longitude":135.516}}
</script>"""
    name, lat, lng, types = osakainfo.parse_detail(page)
    assert (name, lat, lng, types) == ("四天王寺", 34.654, 135.516, ["TouristAttraction"])
    assert osakainfo.is_spot_type(types)
    assert not osakainfo.is_spot_type(["ElectronicsStore"])
    assert not osakainfo.is_spot_type(["Restaurant"])
    assert not osakainfo.is_spot_type(["Hotel"])


def test_kyototravel_detail():
    page = (
        '<h1 class="mod_tit06">京料理　清和荘</h1>'
        '<iframe src="https://www.google.com/maps/embed/v1/place?key=K&q=34.949058,135.762544">'
    )
    assert kyototravel.parse_detail(page) == ("京料理 清和荘", 34.949058, 135.762544)


def test_gotokyo_title():
    page = "<title>雷門（風雷神門）／東京の観光公式サイトGO TOKYO</title>"
    assert gotokyo.parse_detail(page) == "雷門（風雷神門）"


def test_unranked_official_only_matches(monkeypatch):
    monkeypatch.setattr(major.geo, "contains_fine", lambda pref, lat, lng: True)
    existing = major.Draft(
        key="Q1", lat=34.6545, lng=135.5163,
        osm_els=[OsmElement("way/1", 34.6545, 135.5163, {"name": "四天王寺"})],
    )  # fmt: skip
    drafts = {"Q1": existing}
    items = [
        OfficialSpot("osakainfo", "shitennoji", "四天王寺", "https://x/1", None, 34.654, 135.516),
        OfficialSpot("osakainfo", "x", "どこかの施設", "https://x/2", None, 34.66, 135.52),
    ]
    monkeypatch.setattr(major, "OFFICIAL_SOURCES", {"osaka": lambda n: items})
    # data/seed/official 的存檔不讀，用上面的假資料
    monkeypatch.setattr("pipeline.official.load_official", lambda pref: None)
    major.merge_official("osaka", drafts)
    assert existing.official and existing.official.rank is None
    assert set(drafts) == {"Q1"}


def test_official_cache_roundtrip(monkeypatch, tmp_path):
    from pipeline import official

    monkeypatch.setattr(official, "OFFICIAL_DIR", tmp_path)
    items = [
        OfficialSpot("gotokyo", "14", "雷門（風雷神門）", "https://x/14", None),
        OfficialSpot("okinawastory", "2", "b", "https://x/2", 2, 26.2, 127.6, ["市場"]),
        OfficialSpot("okinawastory", "1", "a", "https://x/1", 1, 26.1, 127.5),
    ]
    official.write_official("tokyo", items, "2026-09-29")
    got = official.load_official("tokyo")
    assert [o.id for o in got] == ["1", "2", "14"]
    assert got[1].categories == ["市場"]
    assert official.load_official("kyoto") is None


def test_kyototravel_list():
    page = (
        '<p class="cat"><a href="search.php?category_id=7">寺院・神社</a></p>'
        '<h3 class="tit"><a href="/tourism/single01.php?category_id=7&tourism_id=535">本経寺</a></h3>'
        '<h3 class="tit"><a href="/tourism/single01.php?category_id=7&amp;tourism_id=518">'
        "法観寺（八坂の塔）</a></h3>"
    )
    assert kyototravel.parse_list(page) == [(7, "535", "本経寺"), (7, "518", "法観寺（八坂の塔）")]
