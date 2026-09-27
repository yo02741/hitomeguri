"""地區特色（PLAN.md §5.3）：seed-specialties 指令。

目前以攻略種子清單為候選，用 Wikidata 對齊名稱、假名、中文名、照片與來源；
官方結構化來源（GI、地域團體商標、うちの郷土料理）確認網址與格式後再接上。
簡介、產季由 enrich 補。對不上 Wikidata 的不收錄（攻略是 AI 生成，不能直接上線）。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from typing import Any

from pipeline.kana import is_kana, normalize_kana, romaji_with_spacing
from pipeline.major import log, name_variants, norm_name, strip_disambiguation
from pipeline.models import Image, LocalizedName, Source, Specialty
from pipeline.paths import SEED_DIR, SPECIALTIES_DIR
from pipeline.sources import commons, wikidata

CATEGORY_ALIASES = {"food": "food", "drink": "drink", "craft": "craft", "fruit": "fruit"}


def _match(name_ja: str) -> wikidata.Entity | None:
    for v in name_variants(name_ja):
        qids = wikidata.search(v)
        if not qids:
            continue
        ents = wikidata.entities(qids)
        for q in qids:
            e = ents.get(q)
            label = norm_name(e.labels.get("ja", "")) if e else ""
            if e and label and (label == v or v in label or label in v):
                return e
    return None


def seed_specialties(prefs: list[str]) -> str:
    today = dt.date.today().isoformat()
    seeds = json.loads((SEED_DIR / "seed_from_guides.json").read_text(encoding="utf-8"))
    rows = [s for s in seeds["specialties"] if s["prefecture"] in prefs]
    by_pref: dict[str, list[dict[str, Any]]] = {p: [] for p in prefs}
    unmatched = []
    matched: list[tuple[dict[str, Any], wikidata.Entity]] = []
    for seed in rows:
        ent = _match(seed["name_ja"])
        if not ent:
            unmatched.append(seed["name_ja"])
            continue
        matched.append((seed, ent))
    images = commons.image_info([e.image for _, e in matched if e.image])
    for seed, ent in matched:
        labels = ent.labels
        kana = next((normalize_kana(k) for k in ent.kana_all if is_kana(k)), None)
        zh = strip_disambiguation(
            labels.get("zh-tw") or labels.get("zh-hant") or labels.get("zh") or seed["name_zh"]
        )
        img = []
        if ent.image and ent.image in images:
            i = images[ent.image]
            img = [Image(url=i.url, author=i.author, license=i.license, source_url=i.source_url)]
        spec = Specialty(
            id=f"wd-{ent.qid}",
            name=LocalizedName(
                ja=labels.get("ja", seed["name_ja"]),
                kana=kana,
                romaji=romaji_with_spacing(kana, labels.get("en")) if kana else None,
                zh_tw=zh,
                en=labels.get("en"),
            ),
            kana_source="wikidata" if kana else None,
            prefecture=seed["prefecture"],
            area=seed.get("area"),
            category=CATEGORY_ALIASES.get(seed["category"], seed["category"]),
            summary_zh="",
            source_type="wikidata",
            sources=[Source(url=ent.url, fetched_at=today)],
            images=img,
            updated_at=today,
        )
        by_pref[seed["prefecture"]].append(spec.model_dump(mode="json", exclude_none=True))

    SPECIALTIES_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["## 地區特色", "", "| 縣 | 筆數 |", "|---|---|"]
    for pref, items in by_pref.items():
        path = SPECIALTIES_DIR / f"{pref}.json"
        old = {}
        if path.exists():
            old = {s["id"]: s for s in json.loads(path.read_text(encoding="utf-8"))}
        for it in items:
            prev = old.get(it["id"])
            if prev:
                for k in ("summary_zh", "season_months", "related_spot_ids"):
                    if prev.get(k) and not it.get(k):
                        it[k] = prev[k]
        items.sort(key=lambda s: s["id"])
        if items:
            path.write_text(
                json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        lines.append(f"| {pref} | {len(items)} |")
    if unmatched:
        lines += ["", "對不上 Wikidata、未收錄：" + "、".join(unmatched)]
    log("\n".join(lines))
    return "\n".join(lines) + "\n"


def flight_candidates() -> str:
    """把種子清單的直飛航線寫成候選（verified: false）。已驗證的保留不動。"""
    from pipeline.models import Airline, FlightRoute
    from pipeline.paths import FLIGHTS_JSON

    today = dt.date.today().isoformat()
    seeds = json.loads((SEED_DIR / "seed_from_guides.json").read_text(encoding="utf-8"))
    existing = []
    if FLIGHTS_JSON.exists():
        existing = json.loads(FLIGHTS_JSON.read_text(encoding="utf-8"))
    keyed = {(r["origin"], r["dest"]): r for r in existing}
    for f in seeds["flights"]:
        key = (f["origin"], f["dest"])
        if key in keyed:
            continue
        route = FlightRoute(
            origin=f["origin"],
            dest=f["dest"],
            airlines=[Airline(name_zh=re.sub(r"\s+", "", a)) for a in f["airlines_claimed"]],
            verified=False,
            checked_at=today,
        )
        keyed[key] = route.model_dump(mode="json", exclude_none=True)
    out = sorted(keyed.values(), key=lambda r: (r["dest"], r["origin"]))
    FLIGHTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    FLIGHTS_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return f"航線候選 {len(out)} 條（已驗證 {sum(1 for r in out if r['verified'])} 條）\n"
