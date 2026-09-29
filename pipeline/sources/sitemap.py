"""sitemap.xml 的網址清單（沒有熱門排序的官方觀光網站：東京、京都、大阪）。"""

from __future__ import annotations

import html
import json
import re
from typing import Any

from pipeline.http import get_text

_LOC = re.compile(r"<loc>\s*([^<]+?)\s*</loc>")
_LD_JSON = re.compile(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.S)


def locs(text: str) -> list[str]:
    return [html.unescape(u) for u in _LOC.findall(text)]


def urls(index_url: str, keep: re.Pattern[str], max_files: int = 50) -> list[str]:
    """sitemap（或 sitemap index 底下各檔）中符合 keep 的網址，保持出現順序、去重。"""
    text = get_text(index_url) or ""
    found = locs(text)
    children = [u for u in found if u.endswith(".xml")]
    for child in children[:max_files]:
        found += locs(get_text(child) or "")
    out = list(dict.fromkeys(u for u in found if keep.search(u)))
    print(f"  sitemap {index_url}：{len(out)} 頁", flush=True)
    return out


def progress(i: int, total: int) -> None:
    """逐頁取的進度（每 200 頁一行）。"""
    if (i + 1) % 200 == 0 or i + 1 == total:
        print(f"    {i + 1}/{total}", flush=True)


def ld_json(text: str) -> list[dict[str, Any]]:
    """頁面上所有 JSON-LD 物件（@graph 與陣列攤平）。"""
    out: list[dict[str, Any]] = []
    for raw in _LD_JSON.findall(text):
        try:
            data = json.loads(raw.strip())
        except json.JSONDecodeError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            x = stack.pop(0)
            if isinstance(x, list):
                stack += x
            elif isinstance(x, dict):
                out.append(x)
                if isinstance(x.get("@graph"), list):
                    stack += x["@graph"]
    return out
