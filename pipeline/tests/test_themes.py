import json

from pipeline import major, themes
from pipeline.sources.osm import OsmElement

from .test_seed_region import fake_sources  # noqa: F401 — pytest fixture


def test_seed_themes(fake_sources, monkeypatch):  # noqa: F811
    major.seed_region("kyoto")
    monkeypatch.setattr(themes, "SPOTS_DIR", fake_sources / "spots")
    monkeypatch.setattr(
        themes.osm,
        "themed",
        lambda iso: {
            "tea": [OsmElement("node/100", 35.0, 135.76, {"name": "一保堂茶舗", "shop": "tea",
                    "website": "https://x", "name:ja-Hira": "いっぽどうちゃほ"})],
            "sake": [OsmElement("node/101", 34.99, 135.785, {"name": "清水寺", "craft": "brewery",
                     "wikidata": "Q3"})],
            "ramen": [OsmElement("node/102", 35.0, 135.77, {"name": "ラーメン A", "cuisine": "ramen"}),
                      OsmElement("node/100", 35.0, 135.76, {"name": "一保堂茶舗", "cuisine": "ramen"})],
            "onsen": [], "pokemon": [],
        },
    )  # fmt: skip
    report = themes.seed_themes("kyoto")
    spots = {s["id"]: s for s in json.loads((fake_sources / "spots" / "kyoto.json").read_text())}

    tea = spots["osm-node-100"]
    assert tea["kind"] == "theme" and tea["themes"] == ["ramen", "tea"]
    assert tea["name"]["kana"] == "いっぽどうちゃほ"
    assert spots["osm-node-102"]["themes"] == ["ramen"]
    # 對得到大點的酒藏只加主題，不另立一筆
    assert "osm-node-101" not in spots
    assert "sake" in spots["wd-Q3"]["themes"]
    # 寺社大點加上 goshuin；種子給的主題保留
    assert "goshuin" in spots["wd-Q1"]["themes"]
    assert "| tea | 1 |" in report

    # 重跑結果相同
    themes.seed_themes("kyoto")
    again = {s["id"]: s for s in json.loads((fake_sources / "spots" / "kyoto.json").read_text())}
    assert again == spots
