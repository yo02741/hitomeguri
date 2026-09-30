"""擴充包「老舖・茶屋」（seed-shinise 指令）。

- 香舖、和菓子、茶舖：日文維基百科分類裡的店家條目，只收創業在 FOUNDED_MAX 年以前的（老舖）。
  創業年取 Wikidata 的創立（P571）與條目分類（「16世紀設立の企業」「1832年設立の企業」）中最早的。
  座標依序取 Wikidata、條目的座標；都沒有時到 OSM 找同名的店（限總部所在的縣，優先本店）。
- 香舖另外從 OSM 找名稱像香舖的店（「香老舗」「香木店」…），補維基沒有條目的店。
- 茶屋・甘味處：OSM 名稱含「茶屋」「茶寮」「茶房」「甘味」的店，
  依資料完整度每縣最多 TEAHOUSE_PER_PREF 家。
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any

from pipeline import geo
from pipeline.kana import is_kana, normalize_kana
from pipeline.major import strip_disambiguation
from pipeline.packs import _pref_of, log, osm_address, osm_name
from pipeline.paths import PACKS_DIR
from pipeline.sources import osm, wikidata, wikipedia
from pipeline.themes import quality

# (組別, 維基分類)
CATEGORIES = [
    ("incense", "日本の線香メーカー"),
    ("wagashi", "和菓子の店舗・メーカー"),
    ("tea", "日本の製茶メーカー"),
]
KIND_LABEL = {"incense": "香舖", "wagashi": "和菓子", "tea": "茶舖", "teahouse": "茶屋・甘味處"}
# 創業在這一年以前才算老舖（大正以前，約一百年）
FOUNDED_MAX = 1926
TEAHOUSE_PER_PREF = 12

INCENSE_NAME = "香老舗|香舗|香木店|御香|お香|線香|薫玉堂|山田松香木店|香十"
TEAHOUSE_NAME = "茶屋|茶寮|茶房|甘味|甘党"
# 名稱像茶屋但其實是咖啡店、酒館、料理店
TEAHOUSE_EXCLUDE = re.compile(
    r"珈琲|コーヒー|カフェ|cafe|coffee|喫茶|居酒屋|酒場|ラーメン|そば|蕎麦|うどん|寿司|焼肉|茶屋町|茶屋ヶ坂|茶屋が坂",
    re.I,
)
# 店家以外的 shop（美容院等名稱剛好有「香」）
SHOP_EXCLUDE = {
    "hairdresser",
    "beauty",
    "massage",
    "clothes",
    "supermarket",
    "convenience",
    "chemist",
}
MAIN_STORE = ("総本店", "総本家", "本店", "本舗", "本家")


def founded(categories: list[str], inception: list[int]) -> tuple[int, str] | None:
    """最早的創業年與顯示文字：(1600, "1600年") 或 (1501, "16世紀")。"""
    cands: list[tuple[int, str]] = [(y, f"{y}年") for y in inception]
    for c in categories:
        if m := re.match(r"^(\d{1,2})世紀(?:の日本の)?設立", c):
            cent = int(m.group(1))
            cands.append(((cent - 1) * 100 + 1, f"{cent}世紀"))
        elif m := re.match(r"^(\d{4})年設立", c):
            cands.append((int(m.group(1)), f"{m.group(1)}年"))
    return min(cands) if cands else None


@dataclass
class Shop:
    kind: str
    title: str
    qid: str | None = None
    ent: wikidata.Entity | None = None
    categories: list[str] = field(default_factory=list)
    lat: float | None = None
    lng: float | None = None
    osm: osm.OsmElement | None = None

    @property
    def name(self) -> str:
        return strip_disambiguation(self.title)

    @property
    def url(self) -> str:
        return f"https://ja.wikipedia.org/wiki/{self.title.replace(' ', '_')}"


def _norm(s: str) -> str:
    return re.sub(r"[\s・　]", "", s)


def pick_store(name: str, pref: str | None, els: list[osm.OsmElement]) -> osm.OsmElement | None:
    """OSM 上同名的店：限同縣；有本店用本店，只有一家用那一家，其他情況不猜。"""
    key = _norm(name)
    cands = [
        el
        for el in els
        if _norm(el.tags.get("name", "")).startswith(key)
        and (pref is None or _pref_of(el.lat, el.lng) == pref)
    ]
    if pref is None and len({_pref_of(el.lat, el.lng) for el in cands}) > 1:
        return None
    main = [el for el in cands if any(w in el.tags.get("name", "") for w in MAIN_STORE)]
    if len(main) == 1:
        return main[0]
    return cands[0] if len(cands) == 1 else None


def _rx(names: list[str]) -> str:
    """Overpass 的名稱正規表示式（跳脫特殊字元）。"""
    esc = [re.sub(r'([\\.^$|?*+()\[\]{}"])', r"\\\1", n) for n in names if n]
    return "^(" + "|".join(esc) + ")"


def shop_record(s: Shop, since: tuple[int, str], today: str) -> dict[str, Any] | None:
    from pipeline.wiki import zh_label

    if s.lat is None or s.lng is None:
        return None
    pref = _pref_of(s.lat, s.lng)
    if not pref:
        return None
    kana = next((normalize_kana(k) for k in (s.ent.kana_all if s.ent else []) if is_kana(k)), None)
    zh = zh_label(s.ent.labels, "") if s.ent else ""
    sources = [{"url": s.url, "fetched_at": today}]
    if s.qid:
        sources.append({"url": f"https://www.wikidata.org/wiki/{s.qid}", "fetched_at": today})
    if s.osm:
        sources.append({"url": s.osm.url, "fetched_at": today})
    t = s.osm.tags if s.osm else {}
    if s.qid:
        rid = f"shinise-{s.qid.lower()}"
    elif s.osm:
        rid = f"shinise-{s.osm.osm_id.replace('/', '-')}"
    else:
        rid = "shinise-w" + hashlib.sha1(s.title.encode()).hexdigest()[:10]
    return {
        "id": rid,
        "kind": s.kind,
        "prefecture": pref,
        "name": {"ja": s.name, "kana": kana, "zh_tw": zh if zh and zh != s.name else None},
        "founded": since[1],
        "address": osm_address(t) or None,
        "location": {"lat": round(s.lat, 6), "lng": round(s.lng, 6)},
        "website": t.get("website") or t.get("contact:website"),
        "wikipedia": s.url,
        "sources": sources,
    }


def osm_record(el: osm.OsmElement, kind: str, today: str) -> dict[str, Any] | None:
    pref = _pref_of(el.lat, el.lng)
    name = osm_name(el.tags)
    if not pref or not name:
        return None
    kana = next(
        (
            normalize_kana(el.tags[k])
            for k in ("name:ja-Hira", "name:ja_kana")
            if is_kana(el.tags.get(k))
        ),
        None,
    )
    return {
        "id": f"shinise-{el.osm_id.replace('/', '-')}",
        "kind": kind,
        "prefecture": pref,
        "name": {"ja": name, "kana": kana, "en": el.tags.get("name:en")},
        "address": osm_address(el.tags) or None,
        "location": {"lat": round(el.lat, 6), "lng": round(el.lng, 6)},
        "website": el.tags.get("website") or el.tags.get("contact:website"),
        "sources": [{"url": el.url, "fetched_at": today}],
    }


def _clean(rec: dict[str, Any]) -> dict[str, Any]:
    rec["name"] = {k: v for k, v in rec["name"].items() if v}
    return {k: v for k, v in rec.items() if v not in (None, [], "")}


def _near(a: dict[str, Any], lat: float, lng: float, m: float) -> bool:
    return geo.haversine_m(a["location"]["lat"], a["location"]["lng"], lat, lng) <= m


def seed_shinise() -> str:
    today = dt.date.today().isoformat()
    shops: list[Shop] = []
    for kind, cat in CATEGORIES:
        titles = wikipedia.category_members("jawiki", cat, depth=0)
        log(f"[shinise] {cat}：{len(titles)} 條")
        shops += [Shop(kind, t) for t in titles]
    titles = [s.title for s in shops]
    cats = wikipedia.page_categories("jawiki", titles)
    qids = wikipedia.qids("jawiki", titles)
    ents = wikidata.entities(list(qids.values()))
    for s in shops:
        s.categories = cats.get(s.title, [])
        s.qid = qids.get(s.title)
        s.ent = ents.get(s.qid or "")

    # 老舖：創業年
    kept: list[tuple[Shop, tuple[int, str]]] = []
    too_new: list[str] = []
    unknown: list[str] = []
    for s in shops:
        since = founded(s.categories, s.ent.inception if s.ent else [])
        if since is None:
            unknown.append(s.name)
        elif since[0] > FOUNDED_MAX:
            too_new.append(s.name)
        else:
            kept.append((s, since))

    # 座標：Wikidata → 條目座標 → OSM 同名店（總部所在縣）
    for s, _ in kept:
        if s.ent and s.ent.lat is not None:
            s.lat, s.lng = s.ent.lat, s.ent.lng
    need = [s for s, _ in kept if s.lat is None]
    coords = wikipedia.coordinates("jawiki", [s.title for s in need]) if need else {}
    for s in need:
        if s.title in coords:
            s.lat, s.lng = coords[s.title]
    need = [s for s in need if s.lat is None]
    hq_ids = [h for s in need if s.ent for h in s.ent.headquarters[:1]]
    hq = wikidata.entities(hq_ids) if hq_ids else {}
    stores = osm.japan([
        f'["shop"]["name"~"{_rx([s.name for s in need])}"]',
        f'["amenity"~"^(cafe|restaurant)$"]["name"~"{_rx([s.name for s in need])}"]',
    ]) if need else []  # fmt: skip
    no_place: list[str] = []
    for s in need:
        h = hq.get(s.ent.headquarters[0]) if s.ent and s.ent.headquarters else None
        pref = _pref_of(h.lat, h.lng) if h and h.lat is not None and h.lng is not None else None
        el = pick_store(s.name, pref, stores)
        if el:
            s.osm, s.lat, s.lng = el, el.lat, el.lng
        else:
            no_place.append(s.name)

    out: list[dict[str, Any]] = []
    for s, since in kept:
        rec = shop_record(s, since, today)
        if rec:
            out.append(_clean(rec))

    # 香舖：OSM 補維基沒有條目的店（同名的店 1 km 內已有就略過）
    incense = osm.japan([
        f'["shop"]["name"~"{INCENSE_NAME}"]',
        '["shop"~"^(religion|incense|perfumery)$"]["name"~"香"]',
    ])  # fmt: skip
    added_incense = 0
    for el in incense:
        if el.tags.get("shop") in SHOP_EXCLUDE:
            continue
        name = _norm(osm_name(el.tags))
        if any(
            r["kind"] == "incense"
            and (_norm(r["name"]["ja"]) in name or name in _norm(r["name"]["ja"]))
            and _near(r, el.lat, el.lng, 1000)
            for r in out
        ):
            continue
        rec = osm_record(el, "incense", today)
        if rec:
            out.append(_clean(rec))
            added_incense += 1

    # 茶屋・甘味處：OSM，依資料完整度每縣取前幾家
    teahouses = [
        el
        for el in osm.japan([f'["amenity"~"^(cafe|restaurant)$"]["name"~"{TEAHOUSE_NAME}"]'])
        if not TEAHOUSE_EXCLUDE.search(osm_name(el.tags) + " " + el.tags.get("cuisine", ""))
    ]
    by_pref: dict[str, list[osm.OsmElement]] = {}
    for el in teahouses:
        pref = _pref_of(el.lat, el.lng)
        if pref:
            by_pref.setdefault(pref, []).append(el)
    for els in by_pref.values():
        els.sort(key=lambda el: (-quality(el), el.osm_id))
        for el in els[:TEAHOUSE_PER_PREF]:
            if any(_near(r, el.lat, el.lng, 30) for r in out):
                continue
            rec = osm_record(el, "teahouse", today)
            if rec:
                out.append(_clean(rec))

    out = sorted({r["id"]: r for r in out}.values(), key=lambda r: r["id"])
    PACKS_DIR.mkdir(parents=True, exist_ok=True)
    path = PACKS_DIR / "shinise.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = {k: sum(1 for r in out if r["kind"] == k) for k in KIND_LABEL}
    lines = [
        "## 老舖・茶屋",
        "",
        f"共 {len(out)} 家：" + "、".join(f"{KIND_LABEL[k]} {n}" for k, n in counts.items()),
        f"香舖其中 {added_incense} 家來自 OSM（維基沒有條目）。",
        f"茶屋・甘味處：OSM 符合的 {len(teahouses)} 家，每縣最多 {TEAHOUSE_PER_PREF} 家。",
        "",
        f"創業晚於 {FOUNDED_MAX} 年而不收（{len(too_new)}）：{'、'.join(too_new)}",
        "",
        f"查不到創業年而不收（{len(unknown)}）：{'、'.join(unknown)}",
    ]
    if no_place:
        lines += ["", f"找不到店的位置而略過（{len(no_place)}）：{'、'.join(no_place)}"]
    lines += ["", "| 縣 | 家數 |", "|---|---|"]
    for pref in geo.pref_slugs():
        n = sum(1 for r in out if r["prefecture"] == pref)
        if n:
            lines.append(f"| {pref} | {n} |")
    return "\n".join(lines) + "\n"
