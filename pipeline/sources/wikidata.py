"""Wikidata：候選項目、實體資料（標籤、假名、圖片、文化指定、sitelinks）與名稱搜尋。

文化財 / 世界遺產等的判斷以指定項目的日文標籤比對，不寫死 QID。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pipeline.http import get_json

SPARQL = "https://query.wikidata.org/sparql"
API = "https://www.wikidata.org/w/api.php"
LANGS = ["ja", "zh-tw", "zh-hant", "zh-hk", "zh", "en"]


@dataclass
class Entity:
    qid: str
    labels: dict[str, str] = field(default_factory=dict)
    lat: float | None = None
    lng: float | None = None
    kana_all: list[str] = field(default_factory=list)  # P1814（可能多筆）
    image: str | None = None  # P18 檔名
    heritage: list[str] = field(default_factory=list)  # P1435 的 QID
    instance_of: list[str] = field(default_factory=list)  # P31
    located_in: list[str] = field(default_factory=list)  # P131
    location_items: list[str] = field(default_factory=list)  # P276（活動的舉行地點）
    sitelinks: dict[str, str] = field(default_factory=dict)  # 例 {"jawiki": "伏見稲荷大社"}
    # 定期活動的日期與月份（P837 day in year for periodic occurrence、P2922 month of the year）
    occurs: list[str] = field(default_factory=list)

    @property
    def url(self) -> str:
        return f"https://www.wikidata.org/wiki/{self.qid}"


def sparql(query: str) -> list[dict[str, Any]]:
    data = get_json(SPARQL, params={"query": query, "format": "json"}, min_interval=1.0, retries=4)
    return data["results"]["bindings"]


def heritage_items_in_box(
    south: float, west: float, north: float, east: float, min_sitelinks: int
) -> list[str]:
    """框內有座標、有文化指定（P1435）且 sitelinks 夠多的項目 QID。"""
    q = f"""
SELECT DISTINCT ?item WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?c .
    bd:serviceParam wikibase:cornerSouthWest "Point({west} {south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point({east} {north})"^^geo:wktLiteral .
  }}
  ?item wdt:P1435 [] ;
        wikibase:sitelinks ?sl .
  FILTER(?sl >= {min_sitelinks})
}}"""
    return [b["item"]["value"].rsplit("/", 1)[1] for b in sparql(q)]


def _claim_values(claims: dict[str, Any], prop: str) -> list[Any]:
    out = []
    for c in claims.get(prop, []):
        snak = c.get("mainsnak", {})
        if snak.get("snaktype") == "value" and c.get("rank") != "deprecated":
            out.append(snak["datavalue"]["value"])
    return out


def entities(qids: list[str]) -> dict[str, Entity]:
    out: dict[str, Entity] = {}
    uniq = list(dict.fromkeys(qids))
    for i in range(0, len(uniq), 50):
        chunk = uniq[i : i + 50]
        data = get_json(
            API,
            params={
                "action": "wbgetentities",
                "ids": "|".join(chunk),
                "props": "labels|claims|sitelinks",
                "languages": "|".join(LANGS),
                "format": "json",
            },
            min_interval=0.5,
        )
        for qid, e in data.get("entities", {}).items():
            if "missing" in e:
                continue
            claims = e.get("claims", {})
            ent = Entity(qid=qid)
            ent.labels = {k: v["value"] for k, v in e.get("labels", {}).items()}
            coords = _claim_values(claims, "P625")
            if coords:
                ent.lat, ent.lng = coords[0]["latitude"], coords[0]["longitude"]
            ent.kana_all = [v for v in _claim_values(claims, "P1814") if isinstance(v, str)]
            imgs = _claim_values(claims, "P18")
            ent.image = imgs[0] if imgs else None
            ent.heritage = [v["id"] for v in _claim_values(claims, "P1435")]
            ent.instance_of = [v["id"] for v in _claim_values(claims, "P31")]
            ent.located_in = [v["id"] for v in _claim_values(claims, "P131")]
            ent.location_items = [v["id"] for v in _claim_values(claims, "P276")]
            ent.sitelinks = {k: v["title"] for k, v in e.get("sitelinks", {}).items()}
            ent.occurs = [
                v["id"]
                for prop in ("P837", "P2922")
                for v in _claim_values(claims, prop)
                if isinstance(v, dict) and "id" in v
            ]
            out[qid] = ent
    return out


def labels_ja(qids: list[str]) -> dict[str, str]:
    """只取日文標籤（用於文化指定等分類項目）。"""
    out: dict[str, str] = {}
    uniq = list(dict.fromkeys(qids))
    for i in range(0, len(uniq), 50):
        data = get_json(
            API,
            params={
                "action": "wbgetentities",
                "ids": "|".join(uniq[i : i + 50]),
                "props": "labels",
                "languages": "ja|en",
                "format": "json",
            },
            min_interval=0.5,
        )
        for qid, e in data.get("entities", {}).items():
            labels = e.get("labels", {})
            lab = labels.get("ja") or labels.get("en")
            if lab:
                out[qid] = lab["value"]
    return out


def search(name: str, lang: str = "ja", limit: int = 7) -> list[str]:
    data = get_json(
        API,
        params={
            "action": "wbsearchentities",
            "search": name,
            "language": lang,
            "uselang": lang,
            "type": "item",
            "limit": limit,
            "format": "json",
        },
        min_interval=0.5,
    )
    return [r["id"] for r in data.get("search", [])]


def prefecture_items() -> dict[str, str]:
    """都道府縣的 QID → ISO 3166-2 代碼（以 P300 查詢，不寫死 QID）。"""
    rows = sparql("""SELECT ?p ?iso WHERE { ?p wdt:P300 ?iso . FILTER(STRSTARTS(?iso, "JP-")) }""")
    return {r["p"]["value"].rsplit("/", 1)[1]: r["iso"]["value"] for r in rows}


def parents(qids: list[str]) -> dict[str, list[str]]:
    """行政區項目的 P131（上一層行政區）。"""
    out: dict[str, list[str]] = {}
    uniq = list(dict.fromkeys(qids))
    for i in range(0, len(uniq), 50):
        data = get_json(
            API,
            params={
                "action": "wbgetentities",
                "ids": "|".join(uniq[i : i + 50]),
                "props": "claims",
                "format": "json",
            },
            min_interval=0.5,
        )
        for qid, e in data.get("entities", {}).items():
            out[qid] = [v["id"] for v in _claim_values(e.get("claims", {}), "P131")]
    return out
