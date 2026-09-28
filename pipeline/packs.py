"""擴充包：疊在大點上的全國性小點（PLAN.md §1 主題層）。目前只有寶可夢人孔蓋（ポケふた）。

每個擴充包寫成 data/packs/<key>.json，依 id 排序；每筆保留來源網址與取得時間。
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any

from pipeline.paths import PACKS_DIR, REGIONS_JSON
from pipeline.sources import pokefuta


def log(msg: str) -> None:
    print(msg, flush=True)


def pref_slugs() -> list[str]:
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    return [r["prefecture"] for r in data["regions"]]


def lid_record(lid: pokefuta.Lid, today: str) -> dict[str, Any]:
    return {
        "id": f"pokefuta-{lid.id}",
        "prefecture": lid.prefecture,
        "municipality": lid.municipality,
        "pokemon": [{"dex": no, "ja": name} for no, name in lid.pokemon],
        "address": lid.address,
        "location": {"lat": lid.lat, "lng": lid.lng},
        "sources": [{"url": lid.url, "fetched_at": today}],
    }


def seed_pokefuta(prefs: list[str] | None = None) -> str:
    """回傳 markdown 報告。只重抓指定縣時，其他縣的既有資料保留。"""
    today = dt.date.today().isoformat()
    targets = prefs or pref_slugs()
    path = PACKS_DIR / "pokefuta.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    keep = [r for r in old if r["prefecture"] not in targets]

    rows: list[str] = []
    new: list[dict[str, Any]] = []
    no_coords: list[str] = []
    for slug in targets:
        found = pokefuta.lids(slug)
        for lid in found:
            if lid.lat is None or lid.lng is None:
                no_coords.append(f"{lid.municipality}（{lid.url}）")
                continue
            new.append(lid_record(lid, today))
        log(f"[pokefuta] {slug}：{len(found)} 個")
        rows.append(f"| {slug} | {len(found)} |")

    out = sorted({r["id"]: r for r in keep + new}.values(), key=lambda r: r["id"])
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = ["## ポケふた", "", f"共 {len(out)} 個（本次 {len(new)} 個）", ""]
    report += ["| 縣 | 個數 |", "|---|---|", *rows]
    if no_coords:
        report += ["", f"沒有座標而略過：{'、'.join(no_coords)}"]
    return "\n".join(report) + "\n"
