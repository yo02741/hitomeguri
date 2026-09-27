"""由 data/regions.json 產生 web/src/styles/regions.css。

輸出格式固定（一縣一行），讓 git diff 容易讀；規則見 DESIGN.md §3、UX-FLOW.md §2。
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


def _rule(selector: str, color: dict[str, str]) -> str:
    decls = " ".join(f"{var}: {color[key]};" for key, var in TOKEN_ORDER)
    return f"{selector} {{ {decls} }}\n"


def render(regions: dict) -> str:
    out = [HEADER, _rule(":root", regions["national"]["color"])]
    for r in regions["regions"]:
        out.append(_rule(f'[data-pref="{r["prefecture"]}"]', r["color"]))
    return "".join(out)


def build(src: Path = REGIONS_JSON, dst: Path = REGIONS_CSS) -> Path:
    regions = json.loads(src.read_text(encoding="utf-8"))
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(render(regions), encoding="utf-8")
    return dst
