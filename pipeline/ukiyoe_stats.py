"""浮世繪統計（ukiyoe-stats，只產報告、不改資料）：有幾個景點找得到描繪它的真實浮世繪。

Wikidata 上「類型（P136）是浮世繪」或「作者的藝術運動（P135）是浮世繪」的作品，
有「描繪（P180）」與 Commons 圖（P18）的，對到我們景點的 Wikidata 項目。
作品多半是公有領域（廣重、北齋等），之後若做浮世繪卡，圖與作者、出處都從這裡取。
輸出 reports/ukiyoe-stats.json（每個景點的作品清單）與 Markdown 摘要。
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from pipeline.paths import SPOTS_DIR
from pipeline.sources import wikidata

QUERY = """
SELECT DISTINCT ?art ?depicts ?img ?creatorLabel WHERE {
  ?ukiyoe rdfs:label "ukiyo-e"@en .
  { ?art wdt:P136 ?ukiyoe } UNION { ?art wdt:P170 ?c . ?c wdt:P135 ?ukiyoe }
  ?art wdt:P180 ?depicts ; wdt:P18 ?img .
  OPTIONAL { ?art wdt:P170 ?creator }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
"""


def ukiyoe_stats(prefs: list[str], out_dir: Path) -> str:
    spots: dict[str, dict[str, str]] = {}
    for pref in prefs:
        data = json.loads((SPOTS_DIR / f"{pref}.json").read_text(encoding="utf-8"))
        for s in data["spots"] if isinstance(data, dict) else data:
            if qid := (s.get("external_ids") or {}).get("wikidata"):
                spots[qid] = {"pref": pref, "name": s["name"]["ja"], "featured": s.get("featured")}
    rows = wikidata.sparql(QUERY)
    hits: dict[str, list[dict[str, str]]] = {}
    for r in rows:
        q = r["depicts"]["value"].rsplit("/", 1)[1]
        if q in spots:
            hits.setdefault(q, []).append(
                {
                    "art": r["art"]["value"].rsplit("/", 1)[1],
                    "img": r["img"]["value"],
                    "creator": r.get("creatorLabel", {}).get("value", ""),
                }
            )
    out_dir.mkdir(parents=True, exist_ok=True)
    detail = [
        {**spots[q], "id": q, "works": sorted(w, key=lambda x: x["art"])}
        for q, w in sorted(hits.items())
    ]
    (out_dir / "ukiyoe-stats.json").write_text(
        json.dumps(detail, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    by_pref = Counter(d["pref"] for d in detail)
    creators = Counter(w["creator"] for d in detail for w in d["works"])
    lines = [
        "## 浮世繪統計",
        "",
        f"- 有描繪對象與圖的浮世繪作品：{len(rows)} 筆（對到所有項目）",
        f"- 找得到浮世繪的景點：{len(detail)} 個（精選 {sum(1 for d in detail if d['featured'])}）",
        f"- 作品數：{sum(len(d['works']) for d in detail)}",
        "- 依縣：" + "、".join(f"{p} {n}" for p, n in by_pref.most_common()),
        "- 作者前 8：" + "、".join(f"{c or '不明'} {n}" for c, n in creators.most_common(8)),
        "",
        "### 作品最多的景點",
        "",
    ]
    for d in sorted(detail, key=lambda d: -len(d["works"]))[:30]:
        lines.append(f"- {d['name']}（{d['pref']}）{len(d['works'])} 幅")
    return "\n".join(lines) + "\n"
