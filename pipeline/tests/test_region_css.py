import json

from pipeline.paths import REGIONS_CSS, REGIONS_JSON
from pipeline.region_css import TOKEN_ORDER, mix, render, showa_color


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


def test_mix_matches_endpoints():
    assert mix("#A597BB", "#B9A27A", 0) == "#A597BB"
    assert mix("#A597BB", "#B9A27A", 1) == "#B9A27A"
    assert mix("#000000", "#FFFFFF", 0.5) == "#636363"


def test_showa_rules_cover_every_prefecture():
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    css = render(data)
    assert ':root[data-theme="showa"] {' in css
    for r in data["regions"]:
        assert f'[data-theme="showa"] [data-pref="{r["prefecture"]}"]' in css
    showa = showa_color(data["national"]["color"])
    assert set(showa) == {key for key, _ in TOKEN_ORDER}
    assert showa["ink"] == "#2A2019"


def test_theme_colors_json_matches_generator():
    from pipeline.paths import THEME_COLORS_JSON
    from pipeline.region_css import ERA_THEMES, render_colors

    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    assert THEME_COLORS_JSON.read_text(encoding="utf-8") == render_colors(data)
    css = render(data)
    for theme in ERA_THEMES:
        assert f':root[data-theme="{theme.key}"] {{' in css
