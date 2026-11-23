"""祭典的舉行月份：festival-months 指令。

seed-festivals 只看 Wikidata 與維基開頭段落，約三成祭典沒有月份。這裡讀整篇日文維基條目，
請 Claude 只「擷取」條目裡寫的舉行月份（CLAUDE.md：LLM 只做查證與擷取），
並要它附上條目原文的那一句。
寫進資料前用程式檢查：引文必須逐字出現在條目裡，每個月份都要以「○月」寫在引文裡；不合的不收。
只寫舊曆（旧暦・陰暦）月份的不寫月份（seed-festivals 的規則）。

- 結果存在 data/seed/festival_months.json（以祭典 id 為鍵，含引文與來源網址；
  查過沒有的也記下，不重問）
- seed-festivals 重採時，Wikidata 與開頭段落都沒有月份就用這份
- 需要 ANTHROPIC_API_KEY，在 GitHub Actions 上跑（seed-pack.yml）
"""

from __future__ import annotations

import datetime as dt
import json
import unicodedata
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from pipeline.major import log
from pipeline.paths import DATA, FESTIVALS_DIR

MONTHS_JSON = DATA / "seed" / "festival_months.json"
MODEL = "claude-opus-5-5"
WORKERS = 4

SYSTEM = """你從日文維基百科的祭典條目擷取「現在每年在新曆幾月舉行」。
只根據提供的條目原文，不要用你自己的知識補。

規則：
- months：條目寫明現在舉行的月份（1–12）。
  跨月就列出每個月（例：「7月下旬から8月上旬」→ [7, 8]）。最多 3 個月。
- 只寫舊曆（旧暦・陰暦）日期、沒有寫新曆月份的：months 為空陣列，lunar 為 true。
- 已經停辦、只有歷史上的月份、或條目沒有寫月份：months 為空陣列。
- quote：條目裡寫著這些月份的那一句，逐字照抄（不要改字、不要省略、不要加字）。
  months 為空時 quote 為空字串。
- defunct：條目寫明已停辦或廢止時為 true。"""

SCHEMA = {
    "type": "object",
    "properties": {
        "months": {"type": "array", "items": {"type": "integer"}},
        "quote": {"type": "string"},
        "lunar": {"type": "boolean"},
        "defunct": {"type": "boolean"},
    },
    "required": ["months", "quote", "lunar", "defunct"],
    "additionalProperties": False,
}


def _nfkc(s: str) -> str:
    return "".join(unicodedata.normalize("NFKC", s).split())


def grounded(months: list[int], quote: str, article: str) -> list[int]:
    """引文逐字出現在條目裡、每個月份都以「○月」寫在引文裡才收；舊曆的月份不收。"""
    q = _nfkc(quote)
    if not q or q not in _nfkc(article):
        return []
    out = []
    for m in sorted(set(months)):
        if not 1 <= m <= 12:
            return []
        hits = [
            i for i in range(len(q)) if q.startswith(f"{m}月", i) and not q[i - 1 : i].isdigit()
        ]
        # 「旧暦8月」「陰暦8月」這種寫法的月份不算
        if not any(q[max(0, i - 2) : i] not in ("旧暦", "陰暦") for i in hits):
            return []
        out.append(m)
    return out[:3]


def load_cache() -> dict[str, dict[str, Any]]:
    if not MONTHS_JSON.exists():
        return {}
    return json.loads(MONTHS_JSON.read_text(encoding="utf-8"))["items"]


def write_cache(items: dict[str, dict[str, Any]]) -> None:
    body = {
        "_readme": "祭典的舉行月份，從日文維基整篇條目擷取（festival-months，Claude API）。"
        "quote 是條目原文；months 為空表示條目沒有寫新曆月份（lunar：只有舊曆）。",
        "items": dict(sorted(items.items())),
    }
    MONTHS_JSON.parent.mkdir(parents=True, exist_ok=True)
    MONTHS_JSON.write_text(json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def cached_months(fest_id: str) -> list[int]:
    """seed-festivals 用：查過、有月份的就回傳。"""
    return list(load_cache().get(fest_id, {}).get("months") or [])


def _jawiki_title(fest: dict[str, Any]) -> str | None:
    for url in [s.get("url", "") for s in fest.get("sources", [])]:
        if url.startswith("https://ja.wikipedia.org/wiki/"):
            return urllib.parse.unquote(url.removeprefix("https://ja.wikipedia.org/wiki/"))
    return None


def _ask(client: Any, name: str, article: str) -> tuple[dict[str, Any] | None, Any]:
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=SYSTEM,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": f"祭典：{name}\n\n條目原文：\n{article}"}],
    )
    if response.stop_reason in ("refusal", "max_tokens"):
        return None, response.usage
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text), response.usage


def festival_months(limit: int | None = None) -> str:
    import anthropic

    from pipeline.sources import wikipedia

    today = dt.date.today().isoformat()
    cache = load_cache()
    files = sorted(FESTIVALS_DIR.glob("*.json"))
    data = {p: json.loads(p.read_text(encoding="utf-8")) for p in files}
    todo = [
        f
        for items in data.values()
        for f in items
        if not f.get("months") and f["id"] not in cache and _jawiki_title(f)
    ]
    if limit is not None:
        todo = todo[:: max(1, len(todo) // limit)][:limit]  # 試跑：平均取樣到各縣
    log(f"沒有月份、還沒查過的祭典 {len(todo)} 個（已查過 {len(cache)} 個）")

    client = anthropic.Anthropic()
    tokens_in = tokens_out = 0
    rejected: list[str] = []

    # 維基百科依序抓（http 的節流不是 thread-safe），問 Claude 才平行
    articles = {f["id"]: wikipedia.full_extract("jawiki", _jawiki_title(f) or "") for f in todo}

    def work(f: dict[str, Any]) -> tuple[dict[str, Any], str, dict[str, Any] | None, Any]:
        title = _jawiki_title(f) or ""
        article = articles[f["id"]]
        if not article:
            return f, title, None, None
        got, usage = _ask(client, f["name"]["ja"], article)
        if got is not None:
            got["_article"] = article
        return f, title, got, usage

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(work, f) for f in todo]
        for n, fut in enumerate(as_completed(futures), 1):
            try:
                f, title, got, usage = fut.result()
            except Exception as e:  # noqa: BLE001  一筆失敗不影響其他筆，下次再跑會補
                log(f"  失敗（{type(e).__name__}: {e}），略過")
                continue
            if usage is not None:
                tokens_in += usage.input_tokens
                tokens_out += usage.output_tokens
            if got is None:
                continue
            months = grounded(got["months"], got["quote"], got.pop("_article"))
            if got["months"] and not months:
                rejected.append(f"- {f['name']['ja']}：{got['months']}「{got['quote'][:80]}」")
            cache[f["id"]] = {
                "months": months,
                "quote": got["quote"] if months else "",
                "lunar": got["lunar"],
                "defunct": got["defunct"],
                "source_url": "https://ja.wikipedia.org/wiki/" + urllib.parse.quote(title),
                "checked_at": today,
                "model": MODEL,
            }
            if n % 20 == 0:
                write_cache(cache)
                log(f"  {n}/{len(todo)}（輸入 {tokens_in}、輸出 {tokens_out} tokens）")
    write_cache(cache)

    # 寫回祭典資料
    added: list[str] = []
    for path, items in data.items():
        changed = False
        for f in items:
            hit = cache.get(f["id"], {})
            if not f.get("months") and hit.get("months"):
                f["months"] = hit["months"]
                f["months_source"] = "wikipedia"
                changed = True
                ms = "・".join(map(str, hit["months"]))
                added.append(f"- {f['name']['ja']}（{ms}）：「{hit['quote'][:100]}」")
        if changed:
            body = json.dumps(items, ensure_ascii=False, indent=2) + "\n"
            path.write_text(body, encoding="utf-8")

    done = [cache[f["id"]] for f in todo if f["id"] in cache]
    lines = [
        "## 祭典月份（整篇維基條目擷取）",
        "",
        f"- 查了 {len(done)}/{len(todo)} 個（{MODEL}，effort low）",
        f"- 補上月份 {sum(1 for c in done if c['months'])} 個；"
        f"只有舊曆 {sum(1 for c in done if c['lunar'] and not c['months'])} 個；"
        f"條目寫已停辦 {sum(1 for c in done if c['defunct'])} 個",
        f"- 引文對不上條目、不收 {len(rejected)} 個",
        f"- token：輸入 {tokens_in}、輸出 {tokens_out}",
        "",
        "補上的（人工抽查）：",
        *sorted(added),
    ]
    if rejected:
        lines += ["", "不收的：", *rejected]
    defunct = [
        f"- {f['name']['ja']}（{f['id']}）" for f in todo if cache.get(f["id"], {}).get("defunct")
    ]
    if defunct:
        lines += ["", "條目寫已停辦（考慮加進 data/seed/exclude.json）：", *defunct]
    return "\n".join(lines) + "\n"
