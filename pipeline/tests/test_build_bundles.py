from pipeline.build_bundles import map_thumb, spot_type


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
