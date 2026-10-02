from pipeline.build_bundles import build_achievements, designation, map_thumb, spot_type


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

    e = {
        "id": "wd-Q1",
        "n": "清水寺",
        "z": "清水寺",
        "h": "きよみずでら",
        "r": "Kiyomizu-dera",
        "s": 90.0,
    }
    assert search_entry("kyoto", e) == [
        "wd-Q1",
        "kyoto",
        "清水寺",
        "きよみずでら",
        "",
        "Kiyomizu-dera",
        90.0,
    ]


def test_designation_picks_highest() -> None:
    assert designation(["寺院", "國寶", "世界遺產"]) == "世界遺產"
    assert designation(["城", "重要文化財", "特別史跡", "國寶"]) == "國寶"
    assert designation(["庭園", "特別名勝"]) == "特別名勝"
    assert designation(["神社", "重要文化財", "史跡"]) is None


def test_build_achievements_lists_every_designation() -> None:
    spots = [
        {"id": "wd-Q2", "tags": ["寺院", "世界遺產", "國寶"]},
        {"id": "wd-Q1", "tags": ["庭園", "特別名勝", "特別史跡"]},
        {"id": "wd-Q3", "tags": ["神社"]},
    ]
    out = build_achievements(spots, [])
    assert out["tags"] == {
        "世界遺產": ["wd-Q2"],
        "國寶": ["wd-Q2"],
        "特別史跡": ["wd-Q1"],
        "特別名勝": ["wd-Q1"],
    }


def test_build_achievements_sorted() -> None:
    spots = [{"id": f"wd-Q{n}", "tags": ["國寶"]} for n in (30, 4, 100, 12)]
    castles = [
        {"id": "castle-003", "g": "100", "s": "wd-Q3"},
        {"id": "castle-001", "g": "100", "s": "wd-Q1"},
        {"id": "castle-002", "g": "100"},
    ]
    out = build_achievements(spots, castles)
    assert out["tags"]["國寶"] == sorted(out["tags"]["國寶"])
    assert [c[0] for c in out["castle"]["100"]] == ["castle-001", "castle-002", "castle-003"]


def test_build_achievements_castle_groups() -> None:
    castles = [
        {"id": "castle-101", "g": "zoku", "s": "wd-Q9"},
        {"id": "castle-123", "g": "zoku"},
        {"id": "castle-001", "g": "100", "s": "wd-Q1"},
    ]
    out = build_achievements([], castles)
    assert out["castle"] == {
        "100": [["castle-001", "wd-Q1"]],
        "zoku": [["castle-101", "wd-Q9"], ["castle-123", None]],
    }
    assert set(out) == {"tags", "castle"}
    assert all(v == [] for v in out["tags"].values())
