"""把排除規則套用到既有的 data/spots，並補足精選（不需連網）。

seed-region 採集時已套用同樣規則；這個指令用在規則更新後整理既有資料，
不必重跑整個採集。
"""

from __future__ import annotations

import json
from typing import Any

from pipeline import config
from pipeline.build_bundles import spot_type
from pipeline.major import excluded_ids, name_excluded
from pipeline.paths import SPOTS_DIR


def is_excluded(s: dict[str, Any], manual: set[str]) -> bool:
    if s["kind"] != "major":
        return False
    if s["id"] in manual or name_excluded(s["name"]["ja"]):
        return True
    seeded = any(t.startswith("guide-") for t in s.get("tags", []))
    return not s.get("external_ids", {}).get("wikidata") and not seeded


def refill_featured(spots: list[dict[str, Any]]) -> list[str]:
    """精選不足 FEATURED_PER_PREF 時，依分數由高到低遞補；同類型有上限，類型不明的不遞補。"""
    majors = [s for s in spots if s["kind"] == "major" and s["status"] == "published"]
    featured = [s for s in majors if s["featured"]]
    counts: dict[str, int] = {}
    for s in featured:
        t = spot_type(s["tags"]) or ""
        counts[t] = counts.get(t, 0) + 1
    added = []
    for s in sorted((s for s in majors if not s["featured"]), key=lambda s: -s["score"]):
        if len(featured) >= config.FEATURED_PER_PREF:
            break
        t = spot_type(s["tags"])
        if not t:
            continue
        cap = config.FEATURED_CATEGORY_CAP.get(t, config.FEATURED_CATEGORY_CAP_DEFAULT)
        if counts.get(t, 0) >= cap:
            continue
        counts[t] = counts.get(t, 0) + 1
        s["featured"] = True
        featured.append(s)
        added.append(s["name"]["ja"])
    return added


def prune_spots(pref: str) -> str:
    path = SPOTS_DIR / f"{pref}.json"
    spots = json.loads(path.read_text(encoding="utf-8"))
    manual = excluded_ids()
    removed = [s for s in spots if is_excluded(s, manual)]
    kept = [s for s in spots if not is_excluded(s, manual)]
    added = refill_featured(kept)
    path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    removed_featured = [s["name"]["ja"] for s in removed if s["featured"]]
    lines = [
        f"## {pref}",
        f"- 排除 {len(removed)} 筆（剩 {sum(s['kind'] == 'major' for s in kept)} 個大點）",
    ]
    if removed_featured:
        lines.append(f"- 排除的精選：{'、'.join(removed_featured)}")
    if added:
        lines.append(f"- 遞補精選：{'、'.join(added)}")
    return "\n".join(lines) + "\n"
