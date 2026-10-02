"""由 data/regions.json 產生 web/src/styles/regions.css。

輸出格式固定（一縣一行），讓 git diff 容易讀；規則見 DESIGN.md §3、UX-FLOW.md §2。
另外輸出各年代主題（DESIGN.md §13，`:root[data-theme="showa"]` 等）的地區色，
以及開場畫面、分享圖用的 theme-colors.json。
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.paths import REGIONS_CSS, REGIONS_JSON, THEME_COLORS_JSON

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


# ---------- 年代主題（DESIGN.md §13） ----------
# 每個年代：中性色固定（紙、墨），紙類再滲一點地區色；強調色依年代換算（往古紙色混、或加彩度）。
# 強調色的換算：("mix", 顏色, 比例) 在 OKLab 混入；("chroma", 倍數) 放大彩度。
Op = tuple[str, str, float] | tuple[str, float]


class EraTheme:
    def __init__(
        self, key: str, label: str, neutral: dict[str, str], tint: float, accent: dict[str, Op]
    ) -> None:
        self.key, self.label, self.neutral, self.tint, self.accent = (
            key,
            label,
            neutral,
            tint,
            accent,
        )


TINTED = ("paper", "surface", "map", "header", "placeholder", "line", "line_soft")


def _neutral(*values: str) -> dict[str, str]:
    keys = ("paper", "surface", "map", "header", "placeholder", "line", "line_soft")
    keys += ("ink", "ink_2", "sub")
    return dict(zip(keys, values, strict=True))


ERA_THEMES: list[EraTheme] = [
    # 江戶：和紙、墨、藍（浮世繪的ベロ藍）
    EraTheme(
        "edo",
        "江戶",
        _neutral(
            "#EFE6D3", "#E5DAC2", "#E9DFC9", "#ECE2CC", "#DDD0B6",
            "#B9AA8E", "#D9CCB2", "#1E1A17", "#2F2823", "#5A4E44",
        ),
        0.04,
        {
            "base": ("mix", "#8A7F6A", 0.35),
            "accent": ("mix", "#CFC3A8", 0.35),
            "tint": ("mix", "#EFE6D3", 0.5),
            "strong": ("mix", "#1F3554", 0.3),
        },
    ),
    # 明治：洋紙、濃紺、金
    EraTheme(
        "meiji",
        "明治",
        _neutral(
            "#F1EBDD", "#E6DECB", "#EAE3D2", "#EDE5D3", "#DED4BF",
            "#B5AB98", "#D8CFBC", "#1F2430", "#2C3242", "#4E5566",
        ),
        0.04,
        {
            "base": ("mix", "#9A8F7A", 0.3),
            "accent": ("mix", "#D3C9B2", 0.3),
            "tint": ("mix", "#F1EBDD", 0.5),
            "strong": ("mix", "#1F2A44", 0.3),
        },
    ),
    # 大正：淡紅的紙、海老茶、紫
    EraTheme(
        "taisho",
        "大正",
        _neutral(
            "#F4EDE6", "#EADFD6", "#EFE6DE", "#F1E7DF", "#E3D5CB",
            "#C3AFA6", "#DFD0C7", "#2B1E24", "#3B2A31", "#5E4652",
        ),
        0.05,
        {
            "base": ("mix", "#C9A9B0", 0.25),
            "accent": ("mix", "#E2CCD0", 0.25),
            "tint": ("mix", "#F4EDE6", 0.5),
            "strong": ("mix", "#4A1F33", 0.25),
        },
    ),
    # 昭和：生成り紙、焦茶墨，往古紙色混
    EraTheme(
        "showa",
        "昭和",
        _neutral(
            "#F2E8D2", "#E8DCC0", "#EADFC3", "#EFE3C8", "#E2D4B4",
            "#BFAE8E", "#DDCFAF", "#2A2019", "#3C2F24", "#5E4E3F",
        ),
        0.05,
        {
            "base": ("mix", "#B9A27A", 0.3),
            "accent": ("mix", "#D9C7A0", 0.3),
            "tint": ("mix", "#F2E8D2", 0.5),
            "strong": ("mix", "#3C2F24", 0.25),
        },
    ),
    # 平成：白、亮的顏色（彩度放大）
    EraTheme(
        "heisei",
        "平成",
        _neutral(
            "#F7F7FB", "#EEEFF6", "#F0F1F8", "#FFFFFF", "#E4E6F0",
            "#CDD0E0", "#E4E6F0", "#1F2233", "#2C3050", "#4C5170",
        ),
        0.06,
        {
            "base": ("chroma", 1.35),
            "accent": ("chroma", 1.3),
            "tint": ("chroma", 1.2),
            "strong": ("chroma", 1.25),
        },
    ),
]

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


def _chroma(c: str, factor: float) -> str:
    L, a, b = _oklab(c)
    return _hex((L, a * factor, b * factor))


def era_color(theme: EraTheme, color: dict[str, str]) -> dict[str, str]:
    out = dict(theme.neutral)
    for key in TINTED:
        out[key] = mix(theme.neutral[key], color["base"], theme.tint)
    for key, op in theme.accent.items():
        if op[0] == "mix":
            out[key] = mix(color[key], op[1], op[2])  # type: ignore[misc]
        else:
            out[key] = _chroma(color[key], op[1])  # type: ignore[arg-type]
    out["on_base"] = theme.neutral["ink"]
    return out


def showa_color(color: dict[str, str]) -> dict[str, str]:
    return era_color(next(t for t in ERA_THEMES if t.key == "showa"), color)


def _rule(selector: str, color: dict[str, str]) -> str:
    decls = " ".join(f"{var}: {color[key]};" for key, var in TOKEN_ORDER)
    return f"{selector} {{ {decls} }}\n"


def render(regions: dict) -> str:
    out = [HEADER, _rule(":root", regions["national"]["color"])]
    for r in regions["regions"]:
        out.append(_rule(f'[data-pref="{r["prefecture"]}"]', r["color"]))
    for theme in ERA_THEMES:
        out.append(f"/* {theme.label}主題（DESIGN.md §13）：由上面的地區色換算 */\n")
        national = era_color(theme, regions["national"]["color"])
        out.append(_rule(f':root[data-theme="{theme.key}"]', national))
        for r in regions["regions"]:
            selector = f'[data-theme="{theme.key}"] [data-pref="{r["prefecture"]}"]'
            out.append(_rule(selector, era_color(theme, r["color"])))
    return "".join(out)


# 開場畫面（index.html）與分享圖（canvas）用：CSS 變數讀不到的地方，各年代的地區色
COLORS_KEYS = ("base", "accent", "strong", "paper", "map", "line", "ink", "sub")


def render_colors(regions: dict) -> str:
    def pick(c: dict[str, str]) -> dict[str, str]:
        return {k: c[k] for k in COLORS_KEYS}

    out: dict[str, dict] = {}
    for theme in ERA_THEMES:
        out[theme.key] = {
            "national": pick(era_color(theme, regions["national"]["color"])),
            "regions": {
                r["prefecture"]: pick(era_color(theme, r["color"])) for r in regions["regions"]
            },
        }
    return json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def build(src: Path = REGIONS_JSON, dst: Path = REGIONS_CSS) -> Path:
    regions = json.loads(src.read_text(encoding="utf-8"))
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(render(regions), encoding="utf-8")
    THEME_COLORS_JSON.write_text(render_colors(regions), encoding="utf-8")
    return dst
