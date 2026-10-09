"""浮世繪裡的景點（seed-ukiyoe 指令）→ data/ukiyoe.json。

和 ukiyoe-stats 同一個 SPARQL：Wikidata 上類型（P136）是浮世繪、或作者的藝術運動（P135）是浮世繪，
有描繪（P180）與 Commons 圖（P18）的作品，對到我們已發布的大點。
每幅作品再查：
- 作品項目（wbgetentities）：日文標籤（沒有用英文）、系列（P179）、年份（P571）、作者（P170）；
- 系列與作者的日文標籤；
- Commons：縮圖網址、作者、授權（image_info，寬 960，Commons 的標準縮圖寬度之一）。
只留授權是公有領域、CC0、CC 的圖；查不到授權的不收。內容都取自 Wikidata 與 Commons，不自己寫。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from pipeline.models import UkiyoeSpot
from pipeline.paths import SPOTS_DIR, UKIYOE_JSON
from pipeline.sources import commons, wikidata
from pipeline.ukiyoe_stats import QUERY

THUMB_WIDTH = 960
ALLOWED_LICENSE = re.compile(r"public domain|^pd\b|^pd-|^cc0|^cc[ -]by", re.IGNORECASE)


def license_ok(name: str) -> bool:
    return bool(ALLOWED_LICENSE.search(name.strip()))


def file_from_url(url: str) -> str:
    """Special:FilePath 網址 → Commons 檔名（空白分隔，和 P18 相同）。"""
    return unquote(url.rsplit("/", 1)[1]).replace("_", " ")


def commons_page(file: str) -> str:
    return "https://commons.wikimedia.org/wiki/File:" + file.replace(" ", "_")


def spot_index(spots_dir: Path = SPOTS_DIR) -> dict[str, dict[str, Any]]:
    """Wikidata QID → 已發布的大點。"""
    out: dict[str, dict[str, Any]] = {}
    for path in sorted(spots_dir.glob("*.json")):
        for s in json.loads(path.read_text(encoding="utf-8")):
            qid = (s.get("external_ids") or {}).get("wikidata")
            if qid and s.get("kind") == "major" and s.get("status", "published") == "published":
                out[qid] = s
    return out


def match_rows(
    rows: list[dict[str, Any]], spots: dict[str, dict[str, Any]]
) -> dict[str, dict[str, str]]:
    """SPARQL 結果 → {景點 QID: {作品 QID: 檔名}}。

    同一幅作品有好幾張圖時取檔名排序第一張，結果才穩定。
    """
    out: dict[str, dict[str, str]] = {}
    for r in rows:
        q = r["depicts"]["value"].rsplit("/", 1)[1]
        if q not in spots:
            continue
        art = r["art"]["value"].rsplit("/", 1)[1]
        file = file_from_url(r["img"]["value"])
        works = out.setdefault(q, {})
        works[art] = min(works.get(art, file), file)
    return out


def build_records(
    hits: dict[str, dict[str, str]],
    spots: dict[str, dict[str, Any]],
    ents: dict[str, wikidata.Entity],
    labels: dict[str, str],
    infos: dict[str, commons.ImageInfo],
    today: str,
) -> tuple[list[dict[str, Any]], Counter[str]]:
    """組成 data/ukiyoe.json 的紀錄；回傳 (紀錄, 不收的原因統計)。"""
    dropped: Counter[str] = Counter()
    records: list[dict[str, Any]] = []
    for q, arts in hits.items():
        spot = spots[q]
        works: list[dict[str, Any]] = []
        for art, file in sorted(arts.items()):
            ent = ents.get(art)
            info = infos.get(file)
            if not info:
                dropped["Commons 查不到"] += 1
                continue
            if not license_ok(info.license):
                dropped[f"授權不明或不符（{info.license}）"] += 1
                continue
            lab = ent.labels if ent else {}
            work: dict[str, Any] = {
                "id": art,
                "title": lab.get("ja") or lab.get("en") or "",
                "series": next(
                    (labels[s] for s in (ent.series if ent else []) if s in labels), None
                ),
                "year": min(ent.inception) if ent and ent.inception else None,
                "creator": next(
                    (labels[c] for c in (ent.creators if ent else []) if c in labels), ""
                ),
                "file": file,
                "image": info.url,
                "license": info.license,
                "author": info.author,
                "source_url": info.source_url or commons_page(file),
                "wikidata_url": f"https://www.wikidata.org/wiki/{art}",
                "retrieved": today,
            }
            works.append({k: v for k, v in work.items() if v is not None})
        if works:
            rec = {"spot": spot["id"], "pref": spot["prefecture"], "works": works}
            UkiyoeSpot.model_validate(rec)
            records.append(rec)
    records.sort(key=lambda r: r["spot"])
    return records, dropped


def write_ukiyoe(records: list[dict[str, Any]], path: Path = UKIYOE_JSON) -> None:
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def seed_ukiyoe(path: Path = UKIYOE_JSON, spots_dir: Path = SPOTS_DIR) -> str:
    spots = spot_index(spots_dir)
    hits = match_rows(wikidata.sparql(QUERY), spots)
    arts = sorted({a for works in hits.values() for a in works})
    ents = wikidata.entities(arts)
    linked = sorted({x for e in ents.values() for x in (*e.series, *e.creators)})
    labels = wikidata.labels_ja(linked)
    files = sorted({f for works in hits.values() for f in works.values()})
    infos = commons.image_info(files, width=THUMB_WIDTH)
    today = dt.date.today().isoformat()
    records, dropped = build_records(hits, spots, ents, labels, infos, today)
    write_ukiyoe(records, path)
    n_works = sum(len(r["works"]) for r in records)
    by_pref = Counter(r["pref"] for r in records)
    lics = Counter(w["license"] for r in records for w in r["works"])
    lines = [
        "## 浮世繪裡的景點（seed-ukiyoe）",
        "",
        f"- 對到景點的作品：{sum(len(a) for a in hits.values())} 幅、{len(hits)} 個景點",
        f"- 收進 data/ukiyoe.json：{n_works} 幅、{len(records)} 個景點",
        "- 依縣：" + "、".join(f"{p} {n}" for p, n in by_pref.most_common()),
        "- 授權：" + "、".join(f"{k} {n}" for k, n in lics.most_common()),
        "- 沒有題名：" + str(sum(1 for r in records for w in r["works"] if not w["title"])),
    ]
    if dropped:
        lines.append("- 不收：" + "、".join(f"{k} {n}" for k, n in dropped.most_common()))
    return "\n".join(lines) + "\n"
