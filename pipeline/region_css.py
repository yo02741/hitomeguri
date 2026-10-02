"""由 data/regions.json 產生 web/src/styles/regions.css。

輸出格式固定（一縣一行），讓 git diff 容易讀；規則見 DESIGN.md §3、UX-FLOW.md §2。
另外輸出昭和主題（DESIGN.md §13，`:root[data-theme="showa"]`）：中性色換成生成り紙與焦茶墨，
只滲一點地區色；強調色往古紙色混，降低彩度。
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.paths import REGIONS_CSS, REGIONS_JSON

# JSON 欄位 → CSS 變數，順序即輸出順序。
TOKEN_ORDER: list[tuple[str, str]] = [
    ("base", "--region-base"),
    ("on_base", "--region-on"),
    ("accent", "--region-accent"),
    ("tint", "--region-tint"),
    ("strong", "--region-strong"),
    ("paper", "--region-paper"),
    ("surface", "--region-surface"),
    ("map", "--region-map"),
    ("header", "--region-header"),
    ("placeholder", "--region-placeholder"),
    ("line", "--region-line"),
    ("line_soft", "--region-line-soft"),
    ("ink", "--region-ink"),
    ("ink_2", "--region-ink-2"),
    ("sub", "--region-sub"),
]

HEADER = (
    "/* 自動產生：由 data/regions.json 產生，請勿手改。"
    "重新產生：python -m pipeline.cli build-region-css */\n"
    "/* :root＝全國色；[data-pref] 覆寫為該縣的強調色與中性色（地區色滲透） */\n"
)


# 昭和主題的中性色（DESIGN.md §13）：紙、墨固定，紙類再滲 5% 的地區色
SHOWA_NEUTRAL: dict[str, str] = {
    "paper": "#F2E8D2",
    "surface": "#E8DCC0",
    "map": "#EADFC3",
    "header": "#EFE3C8",
    "placeholder": "#E2D4B4",
    "line": "#BFAE8E",
    "line_soft": "#DDCFAF",
    "ink": "#2A2019",
    "ink_2": "#3C2F24",
    "sub": "#5E4E3F",
}
SHOWA_TINTED = ("paper", "surface", "map", "header", "placeholder", "line", "line_soft")
SHOWA_TINT_RATIO = 0.05
# 強調色：(混入的顏色, 比例)
SHOWA_ACCENT: dict[str, tuple[str, float]] = {
    "base": ("#B9A27A", 0.3),
    "accent": ("#D9C7A0", 0.3),
    "tint": ("#F2E8D2", 0.5),
    "strong": ("#3C2F24", 0.25),
}

HEADER_SHOWA = (
    "/* 昭和主題（DESIGN.md §13）：由上面的地區色換算，規則在 pipeline/region_css.py */\n"
)


def _to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _to_srgb(c: float) -> float:
    c = min(max(c, 0.0), 1.0)
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def _oklab(hex_color: str) -> tuple[float, float, float]:
    r, g, b = (_to_linear(int(hex_color[i : i + 2], 16) / 255) for i in (1, 3, 5))
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def _hex(lab: tuple[float, float, float]) -> str:
    L, a, b = lab
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    return "#" + "".join(f"{round(_to_srgb(c) * 255):02X}" for c in rgb)


def mix(a: str, b: str, ratio: float) -> str:
    """OKLab 中把 b 以 ratio 的比例混進 a（同 CSS color-mix(in oklab, a, b ratio)）。"""
    la, lb = _oklab(a), _oklab(b)
    return _hex(tuple(x + (y - x) * ratio for x, y in zip(la, lb, strict=True)))  # type: ignore[arg-type]


def showa_color(color: dict[str, str]) -> dict[str, str]:
    out = dict(SHOWA_NEUTRAL)
    for key in SHOWA_TINTED:
        out[key] = mix(SHOWA_NEUTRAL[key], color["base"], SHOWA_TINT_RATIO)
    for key, (other, ratio) in SHOWA_ACCENT.items():
        out[key] = mix(color[key], other, ratio)
    out["on_base"] = SHOWA_NEUTRAL["ink"]
    return out


def _rule(selector: str, color: dict[str, str]) -> str:
    decls = " ".join(f"{var}: {color[key]};" for key, var in TOKEN_ORDER)
    return f"{selector} {{ {decls} }}\n"


def render(regions: dict) -> str:
    out = [HEADER, _rule(":root", regions["national"]["color"])]
    for r in regions["regions"]:
        out.append(_rule(f'[data-pref="{r["prefecture"]}"]', r["color"]))
    out.append(HEADER_SHOWA)
    out.append(_rule(':root[data-theme="showa"]', showa_color(regions["national"]["color"])))
    for r in regions["regions"]:
        selector = f'[data-theme="showa"] [data-pref="{r["prefecture"]}"]'
        out.append(_rule(selector, showa_color(r["color"])))
    return "".join(out)


def build(src: Path = REGIONS_JSON, dst: Path = REGIONS_CSS) -> Path:
    regions = json.loads(src.read_text(encoding="utf-8"))
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(render(regions), encoding="utf-8")
    return dst
