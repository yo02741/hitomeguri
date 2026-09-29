"""縣官方觀光網站的景點清單：seed-official 指令，結果存在 data/seed/official/{縣}.json。

東京（GO TOKYO）要逐頁取數千頁（每秒一頁），和 seed-region 一起跑會超過時限，所以分開採集、
存檔；seed-region 有存檔就讀存檔，沒有才即時取。只存名稱、座標、類型、熱門排名與頁面網址。
"""

from __future__ import annotations

import dataclasses
import datetime as dt
import json

from pipeline.major import OFFICIAL_SOURCES, log
from pipeline.paths import OFFICIAL_DIR
from pipeline.sources.okinawastory import OfficialSpot


def _order(o: OfficialSpot) -> tuple[int, str]:
    return (o.rank if o.rank is not None else 10**9, o.id)


def write_official(pref: str, items: list[OfficialSpot], fetched_at: str) -> None:
    OFFICIAL_DIR.mkdir(parents=True, exist_ok=True)
    rows = [dataclasses.asdict(o) for o in sorted(items, key=_order)]
    body = {"fetched_at": fetched_at, "items": rows}
    (OFFICIAL_DIR / f"{pref}.json").write_text(
        json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )


def load_official(pref: str) -> list[OfficialSpot] | None:
    path = OFFICIAL_DIR / f"{pref}.json"
    if not path.exists():
        return None
    body = json.loads(path.read_text(encoding="utf-8"))
    return [OfficialSpot(**row) for row in body["items"]]


def seed_official(prefs: list[str]) -> str:
    from pipeline import config

    today = dt.date.today().isoformat()
    lines = ["## 官方觀光網站", "", "| 縣 | 筆數 | 有座標 | 有熱門排名 |", "|---|---|---|---|"]
    for pref in prefs:
        fetch = OFFICIAL_SOURCES.get(pref)
        if not fetch:
            continue
        log(f"[{pref}] 官方觀光網站…")
        items = fetch(config.OFFICIAL_TOP_N)
        write_official(pref, items, today)
        with_ll = sum(1 for o in items if o.lat is not None)
        ranked = sum(1 for o in items if o.rank is not None)
        lines.append(f"| {pref} | {len(items)} | {with_ll} | {ranked} |")
        log(f"[{pref}]   {len(items)} 筆（有座標 {with_ll}）")
    return "\n".join(lines) + "\n"
