"""英文簡介翻成繁體中文：translate-summaries 指令。

使用者決定：翻譯實際來源的原文可以，不可無中生有（自己寫介紹）。

- 對象：景點、祭典、地區特色中 lang=en 的簡介（維基百科、農林水產省英文版的原文）
- 譯文存在 data/translations/summary_zh.json，以原文的雜湊為鍵；原文沒變就不重翻，新資料只翻新增的
- build-bundles 把譯文附在簡介上（text_zh），介面英文一行、中文一行
- 用 Claude API（需要 ANTHROPIC_API_KEY，在 GitHub Actions 上跑）；每批 20 筆，記錄 token 用量
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from typing import Any

from pipeline.major import log
from pipeline.paths import DATA, FESTIVALS_DIR, SPECIALTIES_DIR, SPOTS_DIR

TRANSLATIONS_JSON = DATA / "translations" / "summary_zh.json"
MODEL = "claude-opus-5-5"
BATCH = 20

SYSTEM = """你是日本旅遊資料的譯者，把英文簡介翻成台灣慣用的繁體中文。

規則：
- 只翻原文有的內容，不增加、不刪減、不解釋，也不加評語或結論句。
- 語氣平實，像旅遊書或博物館說明牌；不用驚嘆號、不用「宛如」「讓人流連忘返」「必訪」這類誇飾。
- 每筆附有日文名稱（name_ja）。原文用羅馬拼音寫這個名稱時（例：Zunda mochi），
  譯文直接用日文名稱（ずんだ餅）。
  其他日本的地名、料理名、祭典名，有漢字寫法的用漢字（Kesennuma → 氣仙沼），只有假名的保留假名。
- 度量、年份、人名照原文。原文不通順或有錯字時，照意思翻，不要猜原文沒寫的事。
- 回傳每一筆的 id 與譯文 zh，id 照原樣。"""

SCHEMA = {
    "type": "object",
    "properties": {
        "translations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "string"}, "zh": {"type": "string"}},
                "required": ["id", "zh"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["translations"],
    "additionalProperties": False,
}

# PLAN.md §6a 的禁用句型：譯文出現時列在報告裡人工檢查（原文本身有時照翻不算錯）
BANNED = re.compile(r"(不僅.{0,20}更是|值得一提的是|絕對不能錯過|必訪|宛如|流連忘返|完美融合|！|!)")


def key_of(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]


def load_cache() -> dict[str, dict[str, str]]:
    if not TRANSLATIONS_JSON.exists():
        return {}
    return json.loads(TRANSLATIONS_JSON.read_text(encoding="utf-8"))["items"]


def write_cache(items: dict[str, dict[str, str]]) -> None:
    TRANSLATIONS_JSON.parent.mkdir(parents=True, exist_ok=True)
    body = {
        "_readme": "英文簡介的繁體中文翻譯（translate-summaries，Claude API）。"
        "鍵為原文 SHA-1 前 16 碼。",
        "items": dict(sorted(items.items())),
    }
    TRANSLATIONS_JSON.write_text(
        json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )


def english_summaries() -> dict[str, dict[str, str]]:
    """全部 lang=en 的簡介：鍵 → {en, name_ja}（同一段原文只翻一次）。"""
    out: dict[str, dict[str, str]] = {}
    for folder in (SPECIALTIES_DIR, FESTIVALS_DIR, SPOTS_DIR):
        for path in sorted(folder.glob("*.json")):
            for item in json.loads(path.read_text(encoding="utf-8")):
                s = item.get("summary")
                if s and s.get("lang") == "en" and s.get("text"):
                    out.setdefault(
                        key_of(s["text"]), {"en": s["text"], "name_ja": item["name"]["ja"]}
                    )
    return out


def _translate_batch(
    client: Any, batch: list[tuple[str, dict[str, str]]]
) -> tuple[dict[str, str], Any]:
    payload = [{"id": k, "name_ja": v["name_ja"], "en": v["en"]} for k, v in batch]
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        system=SYSTEM,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    if response.stop_reason in ("refusal", "max_tokens"):
        log(f"  這批沒有完成（{response.stop_reason}），略過")
        return {}, response.usage
    text = next(b.text for b in response.content if b.type == "text")
    got = {t["id"]: t["zh"].strip() for t in json.loads(text)["translations"]}
    wanted = {k for k, _ in batch}
    return {k: v for k, v in got.items() if k in wanted and v}, response.usage


def translate_summaries(limit: int | None = None) -> str:
    import anthropic

    today = dt.date.today().isoformat()
    cache = load_cache()
    todo = [(k, v) for k, v in english_summaries().items() if k not in cache]
    if limit is not None:
        todo = todo[:limit]
    log(f"英文簡介待翻 {len(todo)} 筆（已有譯文 {len(cache)} 筆）")
    client = anthropic.Anthropic()
    tokens_in = tokens_out = 0
    done = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        got, usage = _translate_batch(client, batch)
        tokens_in += usage.input_tokens
        tokens_out += usage.output_tokens
        for k, v in batch:
            if k in got:
                cache[k] = {"en": v["en"], "zh": got[k], "model": MODEL, "translated_at": today}
                done += 1
        write_cache(cache)  # 每批都存，中途失敗不會白跑
        log(
            f"  {min(i + BATCH, len(todo))}/{len(todo)}"
            f"（輸入 {tokens_in}、輸出 {tokens_out} tokens）"
        )

    flagged = [
        f"- {cache[k]['zh'][:80]}" for k, _ in todo if k in cache and BANNED.search(cache[k]["zh"])
    ]
    samples = [
        f"- {v['name_ja']}：{v['en'][:120]}\n  → {cache[k]['zh'][:120]}"
        for k, v in todo[:5]
        if k in cache
    ]
    lines = [
        "## 英文簡介翻譯",
        "",
        f"- 翻譯 {done}/{len(todo)} 筆（{MODEL}，effort low）",
        f"- token：輸入 {tokens_in}、輸出 {tokens_out}",
        f"- 禁用句型命中 {len(flagged)} 筆（人工檢查）",
        "",
        "抽樣：",
        *samples,
    ]
    if flagged:
        lines += ["", "禁用句型：", *flagged[:30]]
    return "\n".join(lines) + "\n"
