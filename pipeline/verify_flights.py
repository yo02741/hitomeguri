"""台灣直飛航線驗證（PLAN.md §5.2b、§5.7）：Claude + 網頁搜尋查航空公司與機場官網。

- 每條候選航線各問一次；只接受附官網來源網址、明確確認有定期直飛的結果。
- 已驗證的航線寫入 verified=true、checked_at、sources；查不到或已停飛的標 verified=false。
- 不存票價、不做比價。需要 ANTHROPIC_API_KEY。
"""

from __future__ import annotations

import datetime as dt
import json
import re

import anthropic
from pydantic import BaseModel, ValidationError

from pipeline.paths import FLIGHTS_JSON

# PLAN.md §2：驗證用 Sonnet + web search
MODEL = "claude-sonnet-5"
AIRPORTS = {
    "TPE": "桃園國際機場", "TSA": "台北松山機場", "RMQ": "台中國際機場",
    "KHH": "高雄國際機場", "TNN": "台南機場",
    "NGO": "中部國際機場（名古屋）", "KIX": "關西國際機場", "UKB": "神戶機場", "ITM": "大阪伊丹機場",
}  # fmt: skip

PROMPT = """請用網頁搜尋確認下列航線目前（{today} 起的當季班表）是否有定期直飛班機，以及由哪些航空公司執飛。

航線：{origin}（{origin_name}）→ {dest}（{dest_name}）
候選航空公司（未經確認，可能有錯）：{airlines}

規則：
- 只以航空公司官網、機場官網的航班或航線資訊為依據；新聞只能作為線索。
- 不要查票價。
- 查不到官網依據時，operating 回傳 false，airlines 為空陣列。

最後只輸出一個 JSON 區塊（```json 包起來），格式：
{{"operating": true/false, "airlines": [{{"name_zh": "中文航空公司名", "iata": "兩碼代號"}}], "frequency_note_zh": "例：每日多班、每週約 3 班；不確定就空字串", "season": "例：2026 冬季班表；不確定就空字串", "sources": ["官網網址", ...]}}"""


class Airline(BaseModel):
    name_zh: str
    iata: str | None = None


class Verdict(BaseModel):
    operating: bool
    airlines: list[Airline]
    frequency_note_zh: str = ""
    season: str = ""
    sources: list[str]


def _ask(client: anthropic.Anthropic, prompt: str) -> tuple[str, int, int]:
    messages: list[dict] = [{"role": "user", "content": prompt}]
    tokens_in = tokens_out = 0
    for _ in range(5):  # pause_turn 最多續 5 次
        resp = client.messages.create(
            model=MODEL,
            max_tokens=16000,
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 8}],
            messages=messages,
        )
        tokens_in += resp.usage.input_tokens
        tokens_out += resp.usage.output_tokens
        if resp.stop_reason == "pause_turn":
            messages = [messages[0], {"role": "assistant", "content": resp.content}]
            continue
        text = "".join(b.text for b in resp.content if b.type == "text")
        return text, tokens_in, tokens_out
    return "", tokens_in, tokens_out


def _parse(text: str) -> Verdict | None:
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.S) or re.search(r"(\{.*\})", text, re.S)
    if not m:
        return None
    try:
        return Verdict.model_validate_json(m.group(1))
    except ValidationError:
        return None


def verify_flights() -> str:
    client = anthropic.Anthropic()
    today = dt.date.today().isoformat()
    routes = json.loads(FLIGHTS_JSON.read_text(encoding="utf-8"))
    lines = ["## 直飛航線驗證", "", "| 航線 | 結果 | 航空公司 |", "|---|---|---|"]
    total_in = total_out = 0
    for r in routes:
        prompt = PROMPT.format(
            today=today,
            origin=r["origin"],
            origin_name=AIRPORTS.get(r["origin"], r["origin"]),
            dest=r["dest"],
            dest_name=AIRPORTS.get(r["dest"], r["dest"]),
            airlines="、".join(a["name_zh"] for a in r["airlines"]) or "（無）",
        )
        text, tin, tout = _ask(client, prompt)
        total_in += tin
        total_out += tout
        v = _parse(text)
        key = f"{r['origin']} → {r['dest']}"
        official = [u for u in (v.sources if v else []) if u.startswith("http")]
        if v and v.operating and v.airlines and official:
            r["verified"] = True
            r["airlines"] = [a.model_dump(exclude_none=True) for a in v.airlines]
            r["frequency_note_zh"] = v.frequency_note_zh or None
            r["season"] = v.season or None
            r["sources"] = [{"url": u, "fetched_at": today} for u in official]
            result = "確認"
        else:
            r["verified"] = False
            result = "未確認" if v else "輸出無法解析"
        r["checked_at"] = today
        r = {k: val for k, val in r.items() if val is not None}
        lines.append(f"| {key} | {result} | {'、'.join(a['name_zh'] for a in r['airlines'])} |")
    routes = [{k: v for k, v in r.items() if v is not None} for r in routes]
    FLIGHTS_JSON.write_text(
        json.dumps(routes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    lines += ["", f"tokens：input {total_in}、output {total_out}", ""]
    return "\n".join(lines)
