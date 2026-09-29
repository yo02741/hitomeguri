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
    assert kyototravel._SPOT.match(
        "https://ja.kyoto.travel/tourism/single01.php?category_id=7&tourism_id=12"
    )
    assert not kyototravel._SPOT.match(
        "https://ja.kyoto.travel/tourism/single-hotel01.php?category_id=13&tourism_id=2168"
    )


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
    major.merge_official("osaka", drafts)
    assert existing.official and existing.official.rank is None
    assert set(drafts) == {"Q1"}
