"""對比自動檢查（DESIGN.md §3.1、§3.5）：47 縣＋全國 × 令和與 5 個年代。

地區色用和 render() 同一套換算（令和＝reiwa_color()，年代＝era_color()）；
固定值（去過、白、danger、主題色）從 web/src/styles/theme.css 讀出來。
只斷言現在已經成立的條件：出問題時擋下，不改任何外觀。失敗訊息列出縣與年代。
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from pathlib import Path

import pytest

from pipeline.paths import REGIONS_JSON
from pipeline.region_css import ERA_THEMES, era_color, reiwa_color

THEME_CSS = Path(__file__).resolve().parents[2] / "web" / "src" / "styles" / "theme.css"
ERAS = ["reiwa", *(t.key for t in ERA_THEMES)]


def _linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = (_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _regions() -> dict:
    return json.loads(REGIONS_JSON.read_text(encoding="utf-8"))


def palettes() -> Iterator[tuple[str, str, dict[str, str]]]:
    """(年代, 縣, 地區色)：全國＋47 縣 × 令和與各年代，共 48 × 6 組（含中性色層次，§3.1a）。"""
    data = _regions()
    rows = [("national", data["national"]["color"])]
    rows += [(r["prefecture"], r["color"]) for r in data["regions"]]
    for era in ERAS:
        theme = next((t for t in ERA_THEMES if t.key == era), None)
        for pref, color in rows:
            yield era, pref, reiwa_color(color) if theme is None else era_color(theme, color)


def _css_block(css: str, selector_re: str) -> str:
    m = re.search(selector_re + r"\s*\{(.*?)\n\}", css, re.S)
    assert m, f"theme.css 找不到 {selector_re}"
    return m.group(1)


def _vars(block: str) -> dict[str, str]:
    return {k: v.upper() for k, v in re.findall(r"--color-([\w-]+):\s*(#[0-9A-Fa-f]{6})\b", block)}


def fixed_colors() -> dict[str, dict[str, str]]:
    """各年代的固定色：令和讀 @theme static，年代讀 :root[data-theme='x']（沒覆寫的沿用令和）。"""
    css = THEME_CSS.read_text(encoding="utf-8")
    base = {"white": "#FFFFFF"}  # Tailwind 預設的 --color-white
    base |= _vars(_css_block(css, r"@theme static"))
    out = {"reiwa": base}
    for t in ERA_THEMES:
        out[t.key] = base | _vars(_css_block(css, rf":root\[data-theme=['\"]{t.key}['\"]\]"))
    return out


def _fail(rows: list[str], what: str) -> None:
    assert not rows, f"{what}：{len(rows)} 組不合格\n" + "\n".join(rows[:30])


# ---------- 地區色（regions.css） ----------
# 文字 ≥ 4.5:1
TEXT_PAIRS = [
    ("ink", "paper"),
    ("ink_2", "paper"),
    ("sub", "paper"),
    ("sub", "surface"),
    ("sub", "header"),
    ("sub", "tint"),
    ("on_base", "base"),
]
# 非文字（focus ring、選取外框）≥ 3:1
UI_PAIRS = [("strong", "paper"), ("strong", "surface")]


@pytest.mark.parametrize(("fg", "bg"), TEXT_PAIRS)
def test_region_text_contrast(fg: str, bg: str) -> None:
    bad = [
        f"{era} {pref}: {fg} {c[fg]} / {bg} {c[bg]} = {contrast(c[fg], c[bg]):.2f}"
        for era, pref, c in palettes()
        if contrast(c[fg], c[bg]) < 4.5
    ]
    _fail(bad, f"文字 {fg} 對 {bg} < 4.5:1")


@pytest.mark.parametrize(("fg", "bg"), UI_PAIRS)
def test_region_ui_contrast(fg: str, bg: str) -> None:
    bad = [
        f"{era} {pref}: {fg} {c[fg]} / {bg} {c[bg]} = {contrast(c[fg], c[bg]):.2f}"
        for era, pref, c in palettes()
        if contrast(c[fg], c[bg]) < 3
    ]
    _fail(bad, f"非文字 {fg} 對 {bg} < 3:1")


def test_white_on_strong() -> None:
    """主按鈕：年代的 --color-white 字對 region-strong ≥ 4.5:1（§3.5 白字只放在 strong、ink、danger 上）。"""
    fixed = fixed_colors()
    bad = [
        f"{era} {pref}: white {fixed[era]['white']} / strong {c['strong']} = {contrast(fixed[era]['white'], c['strong']):.2f}"
        for era, pref, c in palettes()
        if contrast(fixed[era]["white"], c["strong"]) < 4.5
    ]
    _fail(bad, "白字對 strong < 4.5:1")


# ---------- 固定色（theme.css） ----------


def test_visited_contrast() -> None:
    """去過的字與印章：對 visited-tint（Toggle 底）與 paper ≥ 4.5:1。"""
    fixed = fixed_colors()
    bad = []
    for era, pref, c in palettes():
        v, vt = fixed[era]["visited"], fixed[era]["visited-tint"]
        for name, bg in (("visited-tint", vt), ("paper", c["paper"])):
            if contrast(v, bg) < 4.5:
                bad.append(f"{era} {pref}: visited {v} / {name} {bg} = {contrast(v, bg):.2f}")
    _fail(bad, "去過色 < 4.5:1")


# 例外的下限（主題色, 底）→ 比值。目前沒有例外。
MARKER_FLOOR: dict[tuple[str, str], float] = {}


def test_theme_marker_contrast() -> None:
    """主題色（景點圓點外框、符號）對 paper 與地圖陸地 ≥ 3:1（MARKER_FLOOR 的例外守現況下限）。"""
    fixed = fixed_colors()
    bad = []
    for era, pref, c in palettes():
        for key, value in fixed[era].items():
            if not key.startswith("t-"):
                continue
            for name in ("paper", "map"):
                if contrast(value, c[name]) < MARKER_FLOOR.get((key, name), 3):
                    bad.append(
                        f"{era} {pref}: {key} {value} / {name} {c[name]} = {contrast(value, c[name]):.2f}"
                    )
    _fail(bad, "主題色 < 3:1")


def test_white_on_danger() -> None:
    """NEW 小牌：年代的 --color-white 字對 --color-danger ≥ 4.5:1。"""
    fixed = fixed_colors()
    bad = [
        f"{era}: white {f['white']} / danger {f['danger']} = {contrast(f['white'], f['danger']):.2f}"
        for era, f in fixed.items()
        if contrast(f["white"], f["danger"]) < 4.5
    ]
    _fail(bad, "白字對 danger < 4.5:1")


def test_fixed_colors_are_read() -> None:
    """regex 真的讀到值（theme.css 改寫法時不會變成空檢查）。"""
    fixed = fixed_colors()
    assert set(fixed) == set(ERAS)
    for era, f in fixed.items():
        for key in ("visited", "visited-tint", "white", "danger", "t-pokemon"):
            assert key in f, (era, key)
    assert sum(1 for k in fixed["reiwa"] if k.startswith("t-")) >= 4
