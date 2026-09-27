import json

from pipeline.paths import REGIONS_CSS, REGIONS_JSON
from pipeline.region_css import TOKEN_ORDER, render


def test_regions_json_has_47_prefectures():
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    assert len(data["regions"]) == 47
    assert len({r["prefecture"] for r in data["regions"]}) == 47
    for r in data["regions"]:
        for key, _ in TOKEN_ORDER:
            assert r["color"][key].startswith("#"), (r["prefecture"], key)


def test_regions_css_matches_generator():
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    assert REGIONS_CSS.read_text(encoding="utf-8") == render(data)
