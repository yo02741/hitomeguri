"""期間限定（PLAN.md §5.4、Phase 4）：harvest-timed 指令。

目前的來源只有氣象廳本季的生物季節觀測（公共データ利用規約 第1.0版，須標示出典）：
- さくら：開花日到「滿開日（還沒滿開時用開花日＋7 天）＋7 天」
- いちょう黄葉、かえで紅葉：觀測日到觀測日＋14 天
這個期間是本站的顯示規則（觀測後一段時間內列在期間限定），不是氣象廳發表的「見頃」。

超商、麥當勞、PR TIMES 的使用條款禁止私人使用以外的轉載（7-Eleven 規約「著作権について」、
PR TIMES 一般規約第 6 條），不收。

每筆依 valid_from 的月份寫進 data/timed/{yyyy-mm}.json；同 id 覆蓋，其他保留。
過期項目留在 data/ 當紀錄，build-bundles 只輸出沒過期的。
"""

from __future__ import annotations

import datetime as dt
import json
from collections import defaultdict
from typing import Any

from pipeline.models import TimedItem, TimedTitle
from pipeline.paths import TIMED_DIR
from pipeline.seasons import STATION_PREF
from pipeline.sources import jma

SOURCE_LABEL = "出典：気象庁ホームページ（生物季節観測）を加工して作成"

# (key, 氣象廳頁面, 日文名, 中文名, 分類, 顯示天數)
AUTUMN = [
    ("ichou", "phn_012", "いちょう黄葉", "銀杏轉黃", "autumn_leaves", 14),
    ("kaede", "phn_014", "かえで紅葉", "楓葉轉紅", "autumn_leaves", 14),
]


def _add(date: str, days: int) -> str:
    return (dt.date.fromisoformat(date) + dt.timedelta(days=days)).isoformat()


def _diff_zh(diff: int | None) -> str:
    if diff is None:
        return ""
    if diff == 0:
        return "，與平年同日"
    return f"，比平年{'早' if diff < 0 else '晚'} {abs(diff)} 天"


def _md(date: str) -> str:
    d = dt.date.fromisoformat(date)
    return f"{d.month}月{d.day}日"


def autumn_items(spec: tuple[str, str, str, str, str, int], html: str, now: str) -> list[TimedItem]:
    key, page, ja, zh, category, days = spec
    year, obs = jma.parse_autumn(html)
    out = []
    for o in obs:
        pref = STATION_PREF.get(o.station)
        if not pref or year is None:
            continue
        out.append(
            TimedItem(
                id=f"jma-{key}-{year}-{o.station}",
                kind="seasonal",
                category=category,
                brand="気象庁",
                title=TimedTitle(ja=f"{o.station}　{ja}", zh_tw=f"{o.station} {zh}"),
                summary_zh=(
                    f"{o.station}的氣象台 {_md(o.date)} 觀測到{zh}{_diff_zh(o.diff_normal)}。"
                ),
                scope="regional",
                prefectures=[pref],
                valid_from=o.date,
                valid_to=_add(o.date, days),
                source_url=jma.PAGE_URL.format(page=page),
                source_label=SOURCE_LABEL,
                updated_at=now,
            )
        )
    return out


def sakura_items(kaika_html: str, mankai_html: str, now: str) -> list[TimedItem]:
    year, kaika = jma.parse_sakura(kaika_html)
    _, mankai = jma.parse_sakura(mankai_html)
    full = {o.station: o for o in mankai}
    out = []
    for o in kaika:
        pref = STATION_PREF.get(o.station)
        if not pref or year is None:
            continue
        m = full.get(o.station)
        end = _add(m.date if m else _add(o.date, 7), 7)
        summary = f"{o.station}的氣象台 {_md(o.date)} 觀測到櫻花開花{_diff_zh(o.diff_normal)}"
        summary += f"；{_md(m.date)} 滿開{_diff_zh(m.diff_normal)}。" if m else "。"
        out.append(
            TimedItem(
                id=f"jma-sakura-{year}-{o.station}",
                kind="seasonal",
                category="sakura",
                brand="気象庁",
                title=TimedTitle(
                    ja=f"{o.station}　さくら{'満開' if m else '開花'}",
                    zh_tw=f"{o.station} 櫻花{'滿開' if m else '開花'}",
                ),
                summary_zh=summary,
                scope="regional",
                prefectures=[pref],
                valid_from=o.date,
                valid_to=end,
                source_url=jma.PAGE_URL.format(page="sakura_mankai" if m else "sakura_kaika"),
                source_label=SOURCE_LABEL,
                updated_at=now,
            )
        )
    return out


def load_all() -> dict[str, dict[str, Any]]:
    items: dict[str, dict[str, Any]] = {}
    for path in sorted(TIMED_DIR.glob("*.json")) if TIMED_DIR.exists() else []:
        for x in json.loads(path.read_text(encoding="utf-8")):
            items[x["id"]] = x
    return items


def write_all(items: dict[str, dict[str, Any]]) -> list[str]:
    """依 valid_from 的月份分檔（依 id 排序）；回傳寫了哪些檔。"""
    by_month: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for x in items.values():
        by_month[x["valid_from"][:7]].append(x)
    TIMED_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for month, xs in sorted(by_month.items()):
        path = TIMED_DIR / f"{month}.json"
        body = json.dumps(sorted(xs, key=lambda x: x["id"]), ensure_ascii=False, indent=2) + "\n"
        if not path.exists() or path.read_text(encoding="utf-8") != body:
            path.write_text(body, encoding="utf-8")
            written.append(path.name)
    return written


def harvest_timed() -> str:
    now = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    new: list[TimedItem] = []
    lines = ["## 期間限定（氣象廳生物季節觀測）"]
    kaika, mankai = jma.fetch_page("sakura_kaika"), jma.fetch_page("sakura_mankai")
    if kaika and mankai:
        got = sakura_items(kaika, mankai, now)
        lines.append(f"- さくら：{len(got)} 站已開花")
        new += got
    for spec in AUTUMN:
        html = jma.fetch_page(spec[1])
        got = autumn_items(spec, html, now) if html else []
        lines.append(f"- {spec[2]}：{len(got)} 站已觀測")
        new += got

    items = load_all()
    changed = 0
    for it in new:
        x = it.model_dump(mode="json", exclude_none=True)
        old = items.get(it.id)
        # 只有內容變了才更新（updated_at 不算）
        if old is None or {k: v for k, v in old.items() if k != "updated_at"} != {
            k: v for k, v in x.items() if k != "updated_at"
        }:
            items[it.id] = x
            changed += 1
    written = write_all(items)
    today = dt.date.today().isoformat()
    current = sum(1 for x in items.values() if x["valid_to"] >= today)
    lines += [
        f"- 新增或更新 {changed} 筆，目前沒過期 {current} 筆",
        f"- 寫入：{'、'.join(written) or '沒有變更'}",
    ]
    return "\n".join(lines) + "\n"
