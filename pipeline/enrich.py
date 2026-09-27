"""LLM 補全（PLAN.md §5.7）：繁中簡介、缺漏的假名、最佳季節、建議停留。

- 以 Message Batches API 送出（半價、非同步），batch id 記在 data/_state/batch_jobs.json。
- 簡介只根據附上的 Wikipedia 導言撰寫，不讓模型憑記憶編造。
- 文風遵守 PLAN.md §6a；回來後做禁用詞檢查，命中的不寫入，下次重跑。
- LLM 補的假名標記 kana_source="llm"（待人工確認）。
"""

from __future__ import annotations

import datetime as dt
import json
import re
import time
from typing import Any

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from pydantic import BaseModel, ValidationError

from pipeline.kana import is_kana, normalize_kana, romaji_with_spacing
from pipeline.paths import SPOTS_DIR, STATE_DIR
from pipeline.sources import wikidata, wikipedia

# PLAN.md §2：大量補全用 Haiku 4.5，走 Batch API。
MODEL = "claude-haiku-4-5"
JOBS_FILE = STATE_DIR / "batch_jobs.json"

BANNED = [
    "不僅",
    "更是",
    "值得一提",
    "無論你",
    "無論您",
    "絕對不能錯過",
    "必訪",
    "宛如",
    "流連忘返",
    "完美融合",
    "你可以",
    "您可以",
    "推薦大家",
    "！",
    "!",
    "？",
    "?",
]
EMOJI = re.compile("[\U0001f300-\U0001faff☀-➿⭐✨]")

SYSTEM = """你替一本給台灣旅客看的日本旅遊指南撰寫景點資料。只輸出指定的 JSON。

簡介（summary_zh）的寫法：
- 繁體中文（台灣用語），60–100 字，一段。
- 只寫「來源文字」裡有的事實：年代、由來、看什麼、有什麼特色、什麼季節最好。來源沒有提到的不要寫，寧可短。
- 用具體資訊取代形容詞。語氣像旅遊書或車站標示：事實、具體、短。
- 不對讀者說話（不用「你可以」「推薦大家」），不用反問句、驚嘆號、emoji，不寫結尾總結句。
- 禁用：「不僅…更是…」「值得一提的是」「無論你是…都能…」「絕對不能錯過」「必訪」「宛如」「讓人流連忘返」「完美融合」。
- 來源文字不足以寫出任何具體事實時，summary_zh 回傳空字串。

其他欄位：
- kana：只有在要求時填寫，為日文名稱的平假名讀音（不含空白）；沒把握時回傳空字串。
- name_zh_tw：台灣慣用的繁體中文名稱；日本漢字名稱在台灣通常照用時，改成繁體字形即可。
- best_months：來源文字明確提到的最佳月份（1–12），沒有就回傳空陣列。
- stay_minutes：一般旅客的建議停留分鐘數（15 的倍數），無法判斷時回傳 0。"""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary_zh": {"type": "string"},
        "kana": {"type": "string"},
        "name_zh_tw": {"type": "string"},
        "best_months": {"type": "array", "items": {"type": "integer"}},
        "stay_minutes": {"type": "integer"},
    },
    "required": ["summary_zh", "kana", "name_zh_tw", "best_months", "stay_minutes"],
    "additionalProperties": False,
}


class Enrichment(BaseModel):
    summary_zh: str
    kana: str
    name_zh_tw: str
    best_months: list[int]
    stay_minutes: int


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------- 挑選與組 prompt ----------


def load_spots(pref: str) -> list[dict[str, Any]]:
    return json.loads((SPOTS_DIR / f"{pref}.json").read_text(encoding="utf-8"))


def needs_enrich(s: dict[str, Any]) -> bool:
    return not s.get("summary_zh") or not s["name"].get("kana")


def gather_sources(spots: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    """spot id → {site: 導言文字}"""
    qids = {s["id"]: s["external_ids"].get("wikidata") for s in spots}
    ents = wikidata.entities([q for q in qids.values() if q])
    titles: dict[str, dict[str, str]] = {site: {} for site in wikipedia.SITES}
    for sid, q in qids.items():
        ent = ents.get(q) if q else None
        for site in wikipedia.SITES:
            if ent and ent.sitelinks.get(site):
                titles[site][sid] = ent.sitelinks[site]
    out: dict[str, dict[str, str]] = {sid: {} for sid in qids}
    for site, by_spot in titles.items():
        extracts = wikipedia.intro_extracts(site, list(by_spot.values()))
        for sid, title in by_spot.items():
            if title in extracts:
                out[sid][site] = extracts[title]
    return out


def user_prompt(s: dict[str, Any], sources: dict[str, str]) -> str:
    facts = {
        "日文名稱": s["name"]["ja"],
        "目前的中文名稱": s["name"]["zh_tw"],
        "英文名稱": s["name"].get("en"),
        "都道府縣": s["prefecture"],
        "分類": [t for t in s["tags"] if not t.startswith("guide-")],
    }
    parts = ["景點資料：", json.dumps(facts, ensure_ascii=False)]
    if not s["name"].get("kana"):
        parts.append("需要填寫 kana。")
    else:
        parts.append("kana 回傳空字串。")
    labels = {"jawiki": "日文維基百科", "zhwiki": "中文維基百科", "enwiki": "英文維基百科"}
    if sources:
        parts.append("來源文字：")
        for site, text in sources.items():
            parts.append(f"【{labels[site]}】\n{text}")
    else:
        parts.append("來源文字：（無）")
    return "\n\n".join(parts)


def build_requests(pref: str, limit: int | None) -> list[Request]:
    spots = [s for s in load_spots(pref) if needs_enrich(s)]
    spots.sort(key=lambda s: -s["score"])
    if limit:
        spots = spots[:limit]
    log(f"[{pref}] 待補全 {len(spots)} 筆，抓 Wikipedia 導言…")
    sources = gather_sources(spots)
    return [
        Request(
            custom_id=s["id"],
            params=MessageCreateParamsNonStreaming(
                model=MODEL,
                max_tokens=1024,
                system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": user_prompt(s, sources[s["id"]])}],
                output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
            ),
        )
        for s in spots
    ]


# ---------- 狀態檔 ----------


def load_jobs() -> list[dict[str, Any]]:
    if not JOBS_FILE.exists():
        return []
    return json.loads(JOBS_FILE.read_text(encoding="utf-8"))


def save_jobs(jobs: list[dict[str, Any]]) -> None:
    JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    JOBS_FILE.write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------- 送出、等待、寫回 ----------


def submit(prefs: list[str], limit: int | None) -> list[dict[str, Any]]:
    client = anthropic.Anthropic()
    jobs = load_jobs()
    created = []
    for pref in prefs:
        reqs = build_requests(pref, limit)
        if not reqs:
            log(f"[{pref}] 沒有需要補全的景點")
            continue
        batch = client.messages.batches.create(requests=reqs)
        job = {
            "id": batch.id,
            "prefecture": pref,
            "count": len(reqs),
            "created_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        }
        log(f"[{pref}] 送出 batch {batch.id}（{len(reqs)} 筆）")
        jobs.append(job)
        created.append(job)
    save_jobs(jobs)
    return created


def banned_hits(text: str) -> list[str]:
    hits = [w for w in BANNED if w in text]
    if EMOJI.search(text):
        hits.append("emoji")
    return hits


def apply_result(spot: dict[str, Any], e: Enrichment, today: str) -> list[str]:
    """把一筆結果寫進 spot，回傳需要人工看的問題。"""
    issues = []
    summary = e.summary_zh.strip()
    hits = banned_hits(summary)
    if hits:
        issues.append(f"禁用詞 {'、'.join(hits)}，未寫入")
    elif summary:
        spot["summary_zh"] = summary
    if not spot["name"].get("kana") and e.kana and is_kana(e.kana):
        kana = normalize_kana(e.kana)
        spot["name"]["kana"] = kana
        spot["kana_source"] = "llm"
        if not spot["name"].get("romaji"):
            spot["name"]["romaji"] = romaji_with_spacing(kana, spot["name"].get("en"))
        issues.append(f"LLM 補假名：{kana}")
    if e.name_zh_tw.strip() and spot["name"]["zh_tw"] == spot["name"]["ja"]:
        spot["name"]["zh_tw"] = e.name_zh_tw.strip()
    months = sorted({m for m in e.best_months if 1 <= m <= 12})
    if months and not spot.get("best_months"):
        spot["best_months"] = months
    if 0 < e.stay_minutes <= 600 and not spot.get("stay_minutes"):
        spot["stay_minutes"] = e.stay_minutes
    spot["updated_at"] = today
    return issues


def collect(job: dict[str, Any], client: anthropic.Anthropic) -> str:
    pref = job["prefecture"]
    path = SPOTS_DIR / f"{pref}.json"
    spots = load_spots(pref)
    by_id = {s["id"]: s for s in spots}
    today = dt.date.today().isoformat()
    usage = {"input": 0, "output": 0, "cache_read": 0}
    ok, failed, issues = 0, [], []
    for result in client.messages.batches.results(job["id"]):
        sid = result.custom_id
        if result.result.type != "succeeded":
            failed.append(f"{sid}（{result.result.type}）")
            continue
        msg = result.result.message
        usage["input"] += msg.usage.input_tokens
        usage["output"] += msg.usage.output_tokens
        usage["cache_read"] += msg.usage.cache_read_input_tokens or 0
        if msg.stop_reason != "end_turn":
            failed.append(f"{sid}（{msg.stop_reason}）")
            continue
        text = next((b.text for b in msg.content if b.type == "text"), "")
        try:
            e = Enrichment.model_validate_json(text)
        except ValidationError:
            failed.append(f"{sid}（輸出格式不符）")
            continue
        spot = by_id.get(sid)
        if not spot:
            continue
        for issue in apply_result(spot, e, today):
            issues.append(f"{spot['name']['ja']}：{issue}")
        ok += 1
    path.write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        f"## enrich {pref}（{job['id']}）",
        "",
        "| 項目 | 數值 |",
        "|---|---|",
        f"| 成功 | {ok} |",
        f"| 失敗 | {len(failed)} |",
        f"| input tokens | {usage['input']} |",
        f"| cache read tokens | {usage['cache_read']} |",
        f"| output tokens | {usage['output']} |",
        "",
    ]
    if failed:
        lines += ["失敗：" + "、".join(failed), ""]
    if issues:
        lines += ["需要看的項目："] + [f"- {i}" for i in issues] + [""]
    return "\n".join(lines)


def wait_and_collect(max_wait_s: int = 3 * 3600, interval_s: int = 60) -> str:
    client = anthropic.Anthropic()
    jobs = load_jobs()
    reports = []
    deadline = time.monotonic() + max_wait_s
    pending = list(jobs)
    while pending and time.monotonic() < deadline:
        still = []
        for job in pending:
            batch = client.messages.batches.retrieve(job["id"])
            if batch.processing_status == "ended":
                reports.append(collect(job, client))
                jobs = [j for j in jobs if j["id"] != job["id"]]
                save_jobs(jobs)
            else:
                c = batch.request_counts
                log(f"{job['id']}：處理中 {c.processing}，完成 {c.succeeded}")
                still.append(job)
        pending = still
        if pending:
            time.sleep(interval_s)
    if pending:
        reports.append("尚未完成的 batch：" + "、".join(j["id"] for j in pending))
    return "\n".join(reports)
