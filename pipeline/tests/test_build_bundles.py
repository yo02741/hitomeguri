from pipeline.build_bundles import designation, map_thumb, spot_type


def test_map_thumb_rewrites_width_and_strips_prefix() -> None:
    url = (
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4e/Nijo_Castle.jpg/"
        "960px-Nijo_Castle.jpg?utm_source=commons.wikimedia.org"
    )
    assert map_thumb(url) == "4/4e/Nijo_Castle.jpg/250px-Nijo_Castle.jpg"


def test_map_thumb_keeps_small_originals() -> None:
    url = "https://upload.wikimedia.org/wikipedia/commons/c/c5/Suika.jpg?utm_source=x"
    assert map_thumb(url) == "https://upload.wikimedia.org/wikipedia/commons/c/c5/Suika.jpg"


def test_map_thumb_ignores_non_thumbnail_urls() -> None:
    assert map_thumb("https://example.com/a.jpg") is None


def test_spot_type_skips_designations() -> None:
    assert spot_type(["重要文化財", "神社"]) == "神社"
    assert spot_type(["世界遺產", "特別史跡"]) == "史跡"
    assert spot_type(["guide-S"]) is None


def test_search_entry_drops_same_zh_name() -> None:
    from pipeline.build_bundles import search_entry

    e = {"id": "wd-Q1", "n": "清水寺", "z": "清水寺", "h": "きよみずでら", "r": "Kiyomizu-dera", "s": 90.0}
    assert search_entry("kyoto", e) == ["wd-Q1", "kyoto", "清水寺", "きよみずでら", "", "Kiyomizu-dera", 90.0]


def test_designation_picks_highest() -> None:
    assert designation(["寺院", "國寶", "世界遺產"]) == "世界遺產"
    assert designation(["城", "重要文化財", "特別史跡", "國寶"]) == "國寶"
    assert designation(["庭園", "特別名勝"]) == "特別名勝"
    assert designation(["神社", "重要文化財", "史跡"]) is None
