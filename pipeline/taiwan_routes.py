"""台灣出發的直飛航線（seed-taiwan-routes 指令）：番外篇（/play）從台灣的機場出發用。

來源：国土交通省每季發表的「各空港における国際線就航状況調べ」Excel（seed-airports 用的同一份），
工作表「直行＜データ＞」一列是一條航線的一家航空公司：空港、地域、国・地域、都市、航空会社コード、
航空会社、便数／週。這裡只取「国・地域」是台灣的列（都市是台北、台中、高雄；台北不分桃園、松山），
日本的機場用表上的名字對到 data/seed/airports.json（seed-airports 對出來的 matched 字串）。

不寫時刻、票價：表上沒有。航空公司、每週班次照表寫。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any

from pipeline import major
from pipeline.airports import DEFAULT_PDF_URL, xlsx_rows
from pipeline.http import get_bytes
from pipeline.models import RouteAirline, Source, TaiwanRoute, TaiwanRoutes
from pipeline.paths import AIRPORTS_JSON, TAIWAN_ROUTES_JSON

log = major.log

TAIWAN = ("台湾", "臺灣", "台灣")
#: 表頭的欄名（找欄位用；欄的順序變了也找得到）
HEADERS = {
    "airport": "空港",
    "country": "国・地域",
    "city": "都市",
    "code": "コード",
    "airline": "航空会社",
    "weekly": "便数",
}


def _header(rows: list[list[str]]) -> tuple[int, dict[str, int]] | None:
    """表頭那一列與各欄的位置。

    航空会社コード 的儲存格裡有換行（「航空会社」換行「コード」），用包含比對。"""
    for i, row in enumerate(rows[:10]):
        cols: dict[str, int] = {}
        for j, cell in enumerate(row):
            text = cell.replace("\n", "")
            if text == "空港":
                cols["airport"] = j
            elif text == "国・地域":
                cols["country"] = j
            elif text == "都市":
                cols["city"] = j
            elif "コード" in text:
                cols["code"] = j
            elif text == "航空会社":
                cols["airline"] = j
            elif text.startswith("便数"):
                cols["weekly"] = j
        if set(HEADERS) <= set(cols):
            return i, cols
    return None


def _number(text: str) -> float | None:
    try:
        return float(text.replace(",", "").strip())
    except ValueError:
        return None


def parse_routes(
    sheets: list[tuple[str, list[list[str]]]], airports: list[dict[str, Any]]
) -> tuple[str, list[TaiwanRoute], list[str]]:
    """Excel 的工作表 → (表的標題, 航線, 對不到機場的名字)。

    只看有完整表頭的工作表（「直行＜データ＞」）；同一個 (都市, 機場) 的各家航空公司併成一條。"""
    by_name = {a["matched"]: a for a in airports}
    by_name.update({a["name_ja"].removesuffix("空港"): a for a in airports})
    title = ""
    merged: dict[tuple[str, str], TaiwanRoute] = {}
    unmatched: set[str] = set()
    for _, rows in sheets:
        head = _header(rows)
        if head is None:
            continue
        at, c = head
        if at > 0 and rows[0] and not title:
            title = re.sub(r"\s+", " ", rows[0][0]).strip()
            # 標題後面有全形空白隔開的註記（※直行便…），只留前面的季與期間
            title = title.split("※")[0].strip()
        for row in rows[at + 1 :]:
            got = {k: (row[j].strip() if j < len(row) else "") for k, j in c.items()}
            if got["country"] not in TAIWAN:
                continue
            name, city = got["airport"], got["city"]
            weekly = _number(got["weekly"])
            if not name or not city or weekly is None:
                continue
            ap = by_name.get(name)
            if ap is None:
                unmatched.add(name)
                continue
            key = (city, ap["id"])
            route = merged.get(key)
            if route is None:
                route = merged[key] = TaiwanRoute(
                    city=city,
                    airport=ap["id"],
                    iata=ap["iata"],
                    name_ja=name,
                    prefecture=ap["prefecture"],
                    airlines=[],
                    weekly=0,
                )
            airline = RouteAirline(code=got["code"], name=got["airline"], weekly=weekly)
            route.airlines.append(airline)
            route.weekly = round(route.weekly + weekly, 1)
    routes = sorted(merged.values(), key=lambda r: (r.city, r.airport))
    for r in routes:
        r.airlines.sort(key=lambda a: (-a.weekly, a.code))
    return title, routes, sorted(unmatched)


def seed_taiwan_routes(url: str | None = None) -> str:
    """回傳 markdown 報告；寫 data/flights/taiwan_routes.json。"""
    url = url or DEFAULT_PDF_URL
    log(f"[taiwan-routes] 下載國際線就航資料：{url}")
    data = get_bytes(url, min_interval=1.0)
    if data is None:
        raise RuntimeError(f"檔案不存在（404）：{url}")
    if data[:2] != b"PK":
        raise RuntimeError("不是 Excel（.xlsx）：台灣出發的航線要用 Excel 那一份")
    _, airports = major.load_airport_seed()
    if not airports:
        raise RuntimeError(f"{AIRPORTS_JSON} 沒有機場：先跑 seed-airports")
    title, routes, unmatched = parse_routes(xlsx_rows(data), airports)
    if not routes:
        raise RuntimeError("表裡找不到台灣出發的航線：格式可能變了，沒有寫檔")
    out = TaiwanRoutes(
        source=Source(url=url, fetched_at=dt.date.today().isoformat()), season=title, routes=routes
    )
    TAIWAN_ROUTES_JSON.parent.mkdir(parents=True, exist_ok=True)
    TAIWAN_ROUTES_JSON.write_text(
        json.dumps(out.model_dump(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    log(f"[taiwan-routes] 寫入 {TAIWAN_ROUTES_JSON.name}：{len(routes)} 條")

    lines = [f"# 台灣出發的直飛航線（{title or url}）", ""]
    for city in sorted({r.city for r in routes}):
        rs = [r for r in routes if r.city == city]
        lines.append(f"## {city}：{len(rs)} 個機場")
        lines += [
            f"- {r.name_ja}（{r.iata}，{r.prefecture}）每週 {r.weekly:g} 班："
            + "、".join(f"{a.name} {a.weekly:g}" for a in r.airlines)
            for r in rs
        ]
        lines.append("")
    if unmatched:
        lines.append("對不到 airports.json 的機場（沒有收）：" + "、".join(unmatched))
    return "\n".join(lines)
