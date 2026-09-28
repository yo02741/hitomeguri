"""把排除規則套用到既有的 data/spots，並補足精選。

seed-region 採集時已套用同樣規則；這個指令用在規則更新後整理既有資料，不必重跑整個採集。
預設不連網（名稱規則、人工排除清單）；--wikidata 另外重新查 Wikidata 的類型（P31），
用 major.non_spot_kind 排除行政區、事件、廣域地名（要連網，在 Actions 上跑）。
"""

from __future__ import annotations

import json
from typing import Any

from pipeline import config
from pipeline.build_bundles import spot_type
from pipeline.major import excluded_ids, log, name_excluded, non_spot_reason
from pipeline.paths import SPOTS_DIR

OFFICIAL_HOSTS = ("okinawastory.jp",)
SPOT_LIKE_TYPES = {
    "海灘",
    "岬",
    "博物館",
    "美術館",
    "主題樂園",
    "動物園",
    "水族館",
    "市場",
    "購物",
    "公園",
    "庭園",
}


def is_excluded(s: dict[str, Any], manual: set[str]) -> bool:
    if s["kind"] != "major":
        # 寶可夢店家改由擴充包提供（data/packs），主題層的舊資料移除
        return "pokemon" in s.get("themes", [])
    if s["id"] in manual or name_excluded(s["name"]["ja"]):
        return True
    seeded = any(t.startswith("guide-") for t in s.get("tags", []))
    # 與 major.drop_non_spots 一致：官方觀光網站列出的、類型明確是景點的，沒有 Wikidata 也保留
    official = any(x in src["url"] for src in s.get("sources", []) for x in OFFICIAL_HOSTS)
    spot_like = spot_type(s.get("tags", [])) in SPOT_LIKE_TYPES
    has_wd = bool(s.get("external_ids", {}).get("wikidata"))
    return not (has_wd or seeded or official or spot_like)


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


def wikidata_non_spots(spots: list[dict[str, Any]]) -> dict[str, str]:
    """重新查 Wikidata 的 P31，回傳不是景點的 spot id → 理由（命中的標籤）。"""
    from pipeline.sources import wikidata

    by_qid = {
        s["external_ids"]["wikidata"]: s["id"]
        for s in spots
        if s["kind"] == "major" and s.get("external_ids", {}).get("wikidata")
    }
    ents = wikidata.entities(sorted(by_qid)) if by_qid else {}
    p31 = sorted({q for e in ents.values() for q in e.instance_of})
    labels = wikidata.labels_ja(p31) if p31 else {}
    info = {s["id"]: s for s in spots}
    out: dict[str, str] = {}
    for qid, e in ents.items():
        s = info[by_qid[qid]]
        kinds = {labels.get(q, "") for q in e.instance_of} - {""}
        reason = non_spot_reason(kinds, s["name"]["ja"], "世界遺產" in s.get("tags", []))
        if reason:
            out[s["id"]] = reason
    return out


def prune_spots(pref: str, recheck: bool = False) -> str:
    path = SPOTS_DIR / f"{pref}.json"
    spots = json.loads(path.read_text(encoding="utf-8"))
    manual = excluded_ids()
    reasons: dict[str, str] = {}
    if recheck:
        log(f"[{pref}] 重新查 Wikidata 類型…")
        reasons = wikidata_non_spots(spots)
        manual |= set(reasons)
    removed = [s for s in spots if is_excluded(s, manual)]
    kept = [s for s in spots if not is_excluded(s, manual)]
    added = refill_featured(kept)
    path.write_text(json.dumps(kept, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    removed_featured = [s["name"]["ja"] for s in removed if s["featured"]]
    lines = [
        f"## {pref}",
        f"- 排除 {len(removed)} 筆（剩 {sum(s['kind'] == 'major' for s in kept)} 個大點）",
    ]
    names = [
        s["name"]["ja"] + (f"（{reasons[s['id']]}）" if s["id"] in reasons else "")
        for s in removed
        if s["kind"] == "major"
    ]
    if names:
        lines.append(f"- 排除：{'、'.join(names)}")
    if removed_featured:
        lines.append(f"- 排除的精選：{'、'.join(removed_featured)}")
    if added:
        lines.append(f"- 遞補精選：{'、'.join(added)}")
    return "\n".join(lines) + "\n"
