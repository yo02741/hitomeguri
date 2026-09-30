"""擴充包「城」：日本100名城・続日本100名城（seed-castles 指令）。

名單、名城番號與スタンプ設置場所取自日文維基百科的一覽條目；座標、念法、中文名取自各城的
Wikidata 項目（沒有座標時用維基條目的座標）。已經是景點的城，記下景點 id，前端可以打開景點卡片。
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

from pipeline import geo
from pipeline.kana import is_kana, normalize_kana
from pipeline.packs import _pref_of, log
from pipeline.paths import PACKS_DIR, SPOTS_DIR
from pipeline.sources import meijo, wikidata, wikipedia

GROUP_LABEL = {"100": "日本100名城", "zoku": "続日本100名城"}


def spot_index(spots_dir: Path = SPOTS_DIR) -> dict[str, dict[str, Any]]:
    """Wikidata QID → 景點（只看大點）。"""
    out: dict[str, dict[str, Any]] = {}
    for path in sorted(spots_dir.glob("*.json")):
        for s in json.loads(path.read_text(encoding="utf-8")):
            qid = (s.get("external_ids") or {}).get("wikidata")
            if qid and s.get("kind") == "major" and s.get("status", "published") == "published":
                out[qid] = s
    return out


def castle_record(
    c: meijo.Castle,
    qid: str | None,
    ent: wikidata.Entity | None,
    wiki_coord: tuple[float, float] | None,
    spot: dict[str, Any] | None,
    today: str,
) -> dict[str, Any] | None:
    from pipeline.wiki import zh_label

    if ent and ent.lat is not None and ent.lng is not None:
        lat, lng = ent.lat, ent.lng
    elif spot:
        lat, lng = spot["location"]["lat"], spot["location"]["lng"]
    elif wiki_coord:
        lat, lng = wiki_coord
    else:
        return None
    pref = (spot or {}).get("prefecture") or _pref_of(lat, lng)
    if not pref:
        return None
    kana = (spot or {}).get("name", {}).get("kana")
    if not kana and ent:
        kana = next((normalize_kana(k) for k in ent.kana_all if is_kana(k)), None)
    # 表格上的名稱與條目不同時（「足利氏館（鑁阿寺）」「品川台場」），中文名沿用日文
    zh = zh_label(ent.labels, c.name) if ent and c.name == c.title else c.name
    rec: dict[str, Any] = {
        "id": f"castle-{c.no:03d}",
        "no": c.no,
        "group": c.group,
        "prefecture": pref,
        "name": {"ja": c.name, "kana": kana, "zh_tw": zh},
        "location": {"lat": round(lat, 6), "lng": round(lng, 6)},
        "stamp": c.stamp,
        "wikidata": qid,
        "spot": spot["id"] if spot else None,
        "sources": [{"url": c.url, "fetched_at": today}],
    }
    if qid:
        rec["sources"].append({"url": f"https://www.wikidata.org/wiki/{qid}", "fetched_at": today})
    return rec


def seed_castles() -> str:
    """回傳 markdown 報告；結果寫到 data/packs/castles.json。"""
    today = dt.date.today().isoformat()
    castles = meijo.castles()
    log(f"[castles] 一覽表 {len(castles)} 座")
    titles = [c.title for c in castles]
    qids = wikipedia.qids("jawiki", titles)
    ents = wikidata.entities(list(qids.values()))
    missing_coord = [
        t for t in titles if not (ents.get(qids.get(t, "")) and ents[qids[t]].lat is not None)
    ]
    wiki_coords = wikipedia.coordinates("jawiki", missing_coord) if missing_coord else {}
    spots = spot_index()

    out: list[dict[str, Any]] = []
    skipped: list[str] = []
    for c in castles:
        qid = qids.get(c.title)
        ent = ents.get(qid) if qid else None
        rec = castle_record(c, qid, ent, wiki_coords.get(c.title), spots.get(qid or ""), today)
        if rec:
            out.append({k: v for k, v in rec.items() if v not in (None, [])})
        else:
            skipped.append(f"{c.no} {c.name}")
    out.sort(key=lambda r: r["id"])
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    path = PACKS_DIR / "castles.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    by_group = {g: sum(1 for r in out if r["group"] == g) for g in GROUP_LABEL}
    linked = sum(1 for r in out if r.get("spot"))
    no_stamp = [f"{r['no']} {r['name']['ja']}" for r in out if not r.get("stamp")]
    wrong_pref = [
        f"{r['no']} {r['name']['ja']}（{r['prefecture']}）"
        for r in out
        if not geo.contains(r["prefecture"], r["location"]["lat"], r["location"]["lng"])
    ]
    lines = [
        "## 城（日本100名城・続日本100名城）",
        "",
        f"共 {len(out)} 座：" + "、".join(f"{GROUP_LABEL[g]} {n}" for g, n in by_group.items()),
        f"對到既有景點 {linked} 座；沒有對到的會以擴充包的點顯示。",
    ]
    if skipped:
        lines.append(f"沒有座標而略過：{'、'.join(skipped)}")
    if no_stamp:
        lines.append(f"沒有スタンプ設置場所：{'、'.join(no_stamp)}")
    if wrong_pref:
        lines.append(f"座標不在縣界內（請檢查）：{'、'.join(wrong_pref)}")
    return "\n".join(lines) + "\n"
