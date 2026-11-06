"""地區特色的照片：seed-specialty-photos 指令。

地區特色多半來自農林水產省「うちの郷土料理」，那邊的照片有第三方提供者，
不能直接用（見 sources/maff.py）。
這裡改從 Wikimedia Commons 找：

1. 用日文名稱（與英文名稱）在 Commons 搜尋檔案，留下自由授權（CC BY／BY-SA／CC0／PD）、
   夠大的點陣圖，最多 4 張候選。
2. Claude 看候選的縮圖，只在照片清楚拍到這道料理（或這項特產）本身時選一張；拿不準就不選。
   這是查證（看實際存在的照片是不是這個東西），不產生內容；照片、作者、授權都取自 Commons。
3. 選到的寫進 data/specialties/{縣}.json 的 images（已經有圖的不動）。

需要 ANTHROPIC_API_KEY（在 GitHub Actions 上跑）；記錄 token 用量。
"""

from __future__ import annotations

import base64
import datetime as dt
import json
import re
from typing import Any

from pipeline.http import get_bytes, get_json
from pipeline.major import log
from pipeline.paths import DATA, SPECIALTIES_DIR
from pipeline.season_photos import free_license, to_image

API = "https://commons.wikimedia.org/w/api.php"
MODEL = "claude-opus-5-5"
MAX_CANDIDATES = 4
THUMB = 640

SYSTEM = """你幫日本旅遊網站確認照片。每次給你一項地區特色（郷土料理、特產、工藝品等）的名稱、縣、
簡介，以及幾張 Wikimedia Commons 的候選照片（附檔名）。

選一張照片的條件：照片主體清楚是這一項本身（料理就是那道料理盛好的樣子，工藝品就是那件東西）。
不要選：只有招牌、菜單、包裝盒、店面外觀、食材原料、做法過程、地圖、插畫、同名但不同的東西、
看不出是不是這一項的照片。料理照片裡有其他小菜可以，但主角要是這一道。

拿不準就回傳 -1，不要猜。回傳候選編號 choice（從 0 開始，沒有合適的回傳 -1）與一句理由 reason。"""

SCHEMA = {
    "type": "object",
    "properties": {"choice": {"type": "integer"}, "reason": {"type": "string"}},
    "required": ["choice", "reason"],
    "additionalProperties": False,
}

_PAREN = re.compile(r"[（(].*?[）)]")


def pref_names() -> dict[str, str]:
    data = json.loads((DATA / "regions.json").read_text(encoding="utf-8"))
    return {r["prefecture"]: r["name"]["ja"] for r in data["regions"]}


def queries(item: dict[str, Any]) -> list[str]:
    """搜尋字：日文名稱，再加英文名稱（去掉括號裡的說明）"""
    name = item["name"]
    out = [name["ja"]]
    en = _PAREN.sub("", name.get("en") or "").strip()
    if en and en.lower() != name["ja"].lower():
        out.append(en)
    return out


def search(query: str, limit: int = 8) -> list[dict[str, Any]]:
    data = get_json(
        API,
        params={
            "action": "query",
            "generator": "search",
            "gsrsearch": f'"{query}" filetype:bitmap',
            "gsrnamespace": 6,
            "gsrlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": THUMB,
            "format": "json",
        },
        min_interval=0.5,
    )
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    out = []
    for page in pages:
        info = (page.get("imageinfo") or [None])[0]
        if info:
            out.append({"title": page["title"].removeprefix("File:"), **info})
    return out


def usable(f: dict[str, Any]) -> bool:
    return f.get("mime") in ("image/jpeg", "image/png") and f.get("width", 0) >= 500


def candidates(item: dict[str, Any]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for q in queries(item):
        for f in search(q):
            if f["title"] in seen or not usable(f) or not free_license(to_image(f)):
                continue
            seen.add(f["title"])
            out.append(f)
            if len(out) >= MAX_CANDIDATES:
                return out
    return out


def _media_type(url: str) -> str:
    return "image/png" if url.lower().endswith(".png") else "image/jpeg"


def judge(
    client: Any, item: dict[str, Any], pref_ja: str, cands: list[dict[str, Any]]
) -> tuple[int, str, Any]:
    s = item.get("summary") or {}
    about = (s.get("text_zh") or s.get("text") or item.get("summary_zh") or "")[:300]
    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": f"名稱：{item['name']['ja']}（{item['name'].get('kana', '')}）\n"
            f"縣：{pref_ja}\n分類：{item['category']}\n簡介：{about}",
        }
    ]
    for i, f in enumerate(cands):
        url = f.get("thumburl") or f["url"]
        data = get_bytes(url, min_interval=0.5)
        if not data:
            continue
        content.append({"type": "text", "text": f"候選 {i}：{f['title']}"})
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": _media_type(url),
                    "data": base64.b64encode(data).decode(),
                },
            }
        )
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=1000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=SYSTEM,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": content}],
    )
    if response.stop_reason in ("refusal", "max_tokens"):
        return -1, response.stop_reason, response.usage
    text = next(b.text for b in response.content if b.type == "text")
    got = json.loads(text)
    choice = got["choice"] if 0 <= got["choice"] < len(cands) else -1
    return choice, got["reason"], response.usage


def seed_specialty_photos(prefs: list[str], limit: int | None = None) -> str:
    import anthropic

    names = pref_names()
    files = {p.stem: p for p in sorted(SPECIALTIES_DIR.glob("*.json"))}
    if prefs:
        files = {k: v for k, v in files.items() if k in prefs}
    data = {k: json.loads(p.read_text(encoding="utf-8")) for k, p in files.items()}
    todo = [(pref, it) for pref, items in data.items() for it in items if not it.get("images")]
    if limit is not None:
        # 試跑：平均間隔取樣，各縣都抽得到
        todo = todo[:: max(1, len(todo) // limit)][:limit]
    log(f"沒有照片的地區特色 {len(todo)} 項")

    client = anthropic.Anthropic()
    today = dt.date.today().isoformat()
    tokens_in = tokens_out = 0
    picked: list[str] = []
    rejected: list[str] = []
    no_cand = 0
    for n, (pref, it) in enumerate(todo, 1):
        cands = candidates(it)
        if not cands:
            no_cand += 1
            continue
        choice, reason, usage = judge(client, it, names.get(pref, pref), cands)
        tokens_in += usage.input_tokens
        tokens_out += usage.output_tokens
        label = f"{names.get(pref, pref)} {it['name']['ja']}"
        if choice < 0:
            rejected.append(f"- {label}：{len(cands)} 張都不選（{reason}）")
        else:
            f = cands[choice]
            it["images"] = [to_image(f)]
            it["updated_at"] = today
            picked.append(f"- {label}：{f['title']}（{reason}）")
        if n % 20 == 0:
            log(f"  {n}/{len(todo)}（選到 {len(picked)}；輸入 {tokens_in}、輸出 {tokens_out}）")
            _write(data, files)
    _write(data, files)

    lines = [
        "## 地區特色的照片（Commons＋看圖確認）",
        "",
        f"- 沒有照片的 {len(todo)} 項：選到 {len(picked)}、候選都不合適 {len(rejected)}、"
        f"Commons 找不到候選 {no_cand}",
        f"- token：輸入 {tokens_in}、輸出 {tokens_out}（{MODEL}，effort low）",
        "",
        "選到的：",
        *picked[:200],
    ]
    if rejected:
        lines += ["", "都不選的：", *rejected[:100]]
    return "\n".join(lines) + "\n"


def _write(data: dict[str, list[dict[str, Any]]], files: dict[str, Any]) -> None:
    for pref, items in data.items():
        items.sort(key=lambda s: s["id"])
        files[pref].write_text(
            json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
