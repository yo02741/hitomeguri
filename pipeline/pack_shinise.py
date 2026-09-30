"""擴充包「老舖・茶屋」（seed-shinise 指令）。

- 香舖、和菓子、茶舖：日文維基百科分類裡的店家條目，只收創業在 FOUNDED_MAX 年以前的（老舖）。
  創業年取條目資訊框的「創業」、Wikidata 的創立（P571）與條目分類（「16世紀設立の企業」
  「1832年設立の企業」）中最早的；公司登記（設立）常比創業晚很多，資訊框的創業才是老舖的年份。
  座標依序取 Wikidata、條目的座標；都沒有時到 OSM 找名稱含店名的店（限總部所在的縣，優先本店）。
- 香舖另外從 OSM 找名稱是香老舗、香舗、香木店或知名香舖的店，補維基沒有條目的店。
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
from pipeline.paths import PACKS_DIR, REGIONS_JSON
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

# 香舖：名稱是香老舗、香舗、香木店，或知名的香舖（「お香」「線香」太寬，會撈到雜貨、化妝品、佛具店）
# 「松栄堂」這類店名很常見（樂器行、書店也叫松栄堂），不放進來；維基有條目的香舖另外依本店所在地找
INCENSE_NAME = "香老舗|香舗|香木店|薫玉堂|山田松香木店|香十|林龍昇堂|玉初堂"
TEAHOUSE_NAME = "茶屋|茶寮|茶房|甘味|甘党"
# 名稱像茶屋但其實是咖啡店、酒館、料理店
TEAHOUSE_EXCLUDE = re.compile(
    r"珈琲|コーヒー|カフェ|cafe|coffee|喫茶|居酒屋|酒場|ラーメン|そば|蕎麦|うどん|寿司|焼肉|茶屋町|茶屋ヶ坂|茶屋が坂"
    # 第二次試跑：中華料理、食堂、餐廳、酒吧、咖哩、連鎖店的分店、道の駅
    r"|中華|酒家|飯店|食堂|レストラン|(?<![a-z])bar(?![a-z])|バー|カレー|号店|道の駅",
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


def _plain(wikitext: str) -> str:
    """條目開頭（第一個章節標題以前，含資訊框）的純文字：去掉註腳、註解、樣板引用與連結語法。"""
    head = re.split(r"\n==[^=]", wikitext, maxsplit=1)[0]
    head = re.sub(r"<ref[^>]*/>|<ref.*?</ref>|<!--.*?-->|\{\{R\|[^}]*\}\}", "", head, flags=re.S)
    head = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", head)
    return head.replace("<br />", " ").replace("<br>", " ").replace("<br/>", " ")


# 「1705年（宝永2年）創業」「享保2年（1717年）、近江屋として創業し」：
# 年份與「創業」之間沒有別的數字。「創業は」「創業：」的前面多半是設立的年份，不算
_YEAR_THEN = re.compile(
    r"(?<!\d)(\d{3,4})年(?:（[^）]{0,15}）)?[^。\d（]{0,20}創業(?![者家は：:=])"
)
# 「創業：1690年」「創業は1862年」「創業 = 1717年」
_THEN_YEAR = re.compile(r"創業(?![者家])[^。\d]{0,8}?(\d{3,4})年")


# 「歴史」「沿革」「概要」章節的第一段
_HISTORY = re.compile(r"\n==\s*(?:歴史|沿革|概要)\s*==\s*\n(.{0,600}?)(?:\n\n|\n==)", re.S)


def _years(text: str) -> list[int]:
    ys = [int(y) for rx in (_YEAR_THEN, _THEN_YEAR) for y in rx.findall(text)]
    return [y for y in ys if 600 <= y <= dt.date.today().year]


def text_founded(wikitext: str) -> tuple[int, str] | None:
    """條目寫的創業年（資訊框的「設立」多是公司登記，創業常寫在設立欄的括號或第一段）。
    先看開頭（第一個章節以前）；沒有再看「歴史」「沿革」「概要」章節的第一段。"""
    years = _years(_plain(wikitext))
    if not years:
        m = _HISTORY.search(wikitext)
        if m:
            years = _years(_plain(m.group(1)))
    return (min(years), f"{min(years)}年") if years else None


def _pref_names() -> dict[str, str]:
    """「京都府」「東京都」「北海道」「秋田県」→ 縣 slug。"""
    raw = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for r in raw["regions"]:
        slug, ja = r["prefecture"], r["name"]["ja"]
        full = (
            ja
            if slug == "hokkaido"
            else f"{ja}都"
            if slug == "tokyo"
            else f"{ja}府"
            if slug in ("kyoto", "osaka")
            else f"{ja}県"
        )
        out[full] = slug
    return out


# 所在地沒寫都道府縣、只寫大城市時
CITY_PREF = {
    "京都市": "kyoto", "大阪市": "osaka", "名古屋市": "aichi", "横浜市": "kanagawa",
    "神戸市": "hyogo", "札幌市": "hokkaido", "福岡市": "fukuoka", "仙台市": "miyagi",
    "広島市": "hiroshima", "金沢市": "ishikawa",
}  # fmt: skip


def hq_pref(wikitext: str) -> str | None:
    """資訊框的本店所在地（沒有時用本社所在地）寫在哪個都道府縣。"""
    names = _pref_names()
    box = re.sub(r"<!--.*?-->", "", wikitext, flags=re.S)
    for key in ("本店所在地", "本社所在地"):
        m = re.search(rf"^\s*\|\s*{key}\s*=\s*(.+?)\s*$", box, re.M)
        if not m or not m.group(1).strip():
            continue
        v = _plain(m.group(1))
        hits = [(v.find(n), slug) for n, slug in {**names, **CITY_PREF}.items() if n in v]
        if hits:
            return min(hits)[1]
    return None


def founded(
    categories: list[str], inception: list[int], wikitext: str = ""
) -> tuple[int, str] | None:
    """最早的創業年與顯示文字：(1600, "1600年") 或 (1501, "16世紀")。"""
    cands: list[tuple[int, str]] = [(y, f"{y}年") for y in inception]
    if wikitext and (since := text_founded(wikitext)):
        cands.append(since)
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


# OSM 店名前面常加的字（「香老舗 松栄堂」「御菓子司 鶴屋吉信」）
SHOP_PREFIX = re.compile(r"^(香老舗|御菓子司|京菓子司|菓子司|京菓子|御茶|元祖|本家|総本家)")


def _same_shop(key: str, osm_name: str) -> bool:
    """OSM 店名去掉「香老舗」「御菓子司」等前綴後，以這個店名開頭（「香老舗 松栄堂 京都本店」）。
    不用「含」：恵那川上屋 不是 川上屋。"""
    n = SHOP_PREFIX.sub("", _norm(osm_name))
    return n.startswith(key)


SAME_PLACE_M = 150


def _places(els: list[osm.OsmElement]) -> list[osm.OsmElement]:
    """同一個地方的重複（OSM 常同時有店的點與建築物）只留一筆：店家標籤多的優先。"""
    out: list[osm.OsmElement] = []
    for el in sorted(els, key=lambda e: (-len(e.tags), e.osm_id)):
        if not any(geo.haversine_m(el.lat, el.lng, o.lat, o.lng) <= SAME_PLACE_M for o in out):
            out.append(el)
    return out


def pick_store(name: str, pref: str | None, els: list[osm.OsmElement]) -> osm.OsmElement | None:
    """OSM 上的店：限同縣（不知道縣時要全部同縣，或只有一家本店）；
    同一個地方的重複算一家；有本店用本店，只有一家用那一家，其他情況不猜。"""
    key = _norm(name)
    cands = _places(
        [
            el
            for el in els
            if _same_shop(key, el.tags.get("name", ""))
            and (pref is None or _pref_of(el.lat, el.lng) == pref)
        ]
    )
    # 「聖護院八ツ橋総本店」這種店名本身含「総本店」的，要看店名以外的部分
    def is_main(el: osm.OsmElement) -> bool:
        rest = _norm(el.tags.get("name", "")).replace(key, "")
        return any(w in rest for w in MAIN_STORE)

    main = [el for el in cands if is_main(el)]
    if pref is None and len({_pref_of(el.lat, el.lng) for el in cands}) > 1:
        return main[0] if len(main) == 1 else None
    if len(main) == 1:
        return main[0]
    return cands[0] if len(cands) == 1 else None


def _rx(names: list[str]) -> str:
    """Overpass 的名稱正規表示式（跳脫特殊字元）：店名開頭，前面可以有「香老舗」「御菓子司」等。"""
    esc = [re.sub(r'([\\.^$|?*+()\[\]{}"])', r"\\\1", n) for n in names if n]
    return "^((" + SHOP_PREFIX.pattern[2:-1] + ")[ 　]*)?(" + "|".join(esc) + ")"


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
            if is_kana(el.tags.get(k) or "")
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


def _incense_label(r: dict[str, Any]) -> str:
    since = f"・{r['founded']}" if r.get("founded") else ""
    return f"{r['name']['ja']}（{r['prefecture']}{since}）"


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
    texts = wikipedia.wikitexts("jawiki", titles)
    for s in shops:
        s.categories = cats.get(s.title, [])
        s.qid = qids.get(s.title)
        s.ent = ents.get(s.qid or "")

    # 老舖：創業年
    kept: list[tuple[Shop, tuple[int, str]]] = []
    too_new: list[str] = []
    unknown: list[str] = []
    for s in shops:
        since = founded(s.categories, s.ent.inception if s.ent else [], texts.get(s.title, ""))
        if since is None:
            unknown.append(s.name)
        elif since[0] > FOUNDED_MAX:
            too_new.append(s.name)
        else:
            kept.append((s, since))

    # 座標：Wikidata → 條目座標 → OSM 同名店（本店所在縣）
    for s, _ in kept:
        if s.ent and s.ent.lat is not None:
            s.lat, s.lng = s.ent.lat, s.ent.lng
    need = [s for s, _ in kept if s.lat is None]
    coords = wikipedia.coordinates("jawiki", [s.title for s in need]) if need else {}
    for s in need:
        if s.title in coords:
            s.lat, s.lng = coords[s.title]
    # 座標和本店所在縣不同（例：座標是東京的分店、本店在京都）：也到本店所在縣找一次
    def elsewhere(s: Shop) -> bool:
        hq = hq_pref(texts.get(s.title, ""))
        return bool(hq and s.lat is not None and s.lng is not None and hq != _pref_of(s.lat, s.lng))

    need = [s for s, _ in kept if s.lat is None or elsewhere(s)]
    hq_ids = [h for s in need if s.ent for h in s.ent.headquarters[:1]]
    hq = wikidata.entities(hq_ids) if hq_ids else {}

    # OSM：同名的店、香舖、茶屋，各縣一次查詢（全國一次查會逾時）
    filters = [
        f'["shop"]["name"~"{INCENSE_NAME}"]',
        f'["amenity"~"^(cafe|restaurant)$"]["name"~"{TEAHOUSE_NAME}"]',
    ]
    if need:
        rx = _rx([s.name for s in need])
        filters += [
            f'["shop"]["name"~"{rx}"]',
            f'["amenity"~"^(cafe|restaurant)$"]["name"~"{rx}"]',
            # 老舖常標成工藝品店（京都的鳩居堂 craft=handicraft）
            f'["craft"]["name"~"{rx}"]',
        ]
    elements, failed_prefs = osm.by_prefecture(filters)

    no_place: list[str] = []
    for s in need:
        # 縣：資訊框的本店／本社所在地，沒有再用 Wikidata 的總部
        pref = hq_pref(texts.get(s.title, ""))
        h = hq.get(s.ent.headquarters[0]) if s.ent and s.ent.headquarters else None
        if not pref and h and h.lat is not None and h.lng is not None:
            pref = _pref_of(h.lat, h.lng)
        el = pick_store(s.name, pref, elements)
        if el:
            s.osm, s.lat, s.lng = el, el.lat, el.lng
        elif s.lat is None:
            no_place.append(s.name)

    out: list[dict[str, Any]] = []
    # 同一家店的兩個條目（「ういろう (企業)」與「ういろう (薬品)」都在和菓子分類）：留創業早的
    placed: set[tuple[str, float, float]] = set()
    for s, since in sorted(kept, key=lambda x: (x[1][0], x[0].title)):
        rec = shop_record(s, since, today)
        if not rec:
            continue
        key = (rec["name"]["ja"], rec["location"]["lat"], rec["location"]["lng"])
        if key not in placed:
            placed.add(key)
            out.append(_clean(rec))

    # 香舖：OSM 補維基沒有條目的店（同名的店 1 km 內已有就略過）
    incense = [
        el
        for el in elements
        if el.tags.get("shop")
        and el.tags["shop"] not in SHOP_EXCLUDE
        and re.search(INCENSE_NAME, el.tags.get("name", ""))
    ]
    added_incense = 0
    for el in incense:
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
        for el in elements
        if el.tags.get("amenity") in ("cafe", "restaurant")
        and re.search(TEAHOUSE_NAME, el.tags.get("name", ""))
        and not TEAHOUSE_EXCLUDE.search(osm_name(el.tags) + " " + el.tags.get("cuisine", ""))
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
        "香舖：" + "、".join(_incense_label(r) for r in out if r["kind"] == "incense"),
        "",
        f"創業晚於 {FOUNDED_MAX} 年而不收（{len(too_new)}）：{'、'.join(too_new)}",
        "",
        f"查不到創業年而不收（{len(unknown)}）：{'、'.join(unknown)}",
    ]
    if failed_prefs:
        lines += ["", f"OSM 查詢失敗的縣（這次沒有 OSM 的店）：{'、'.join(failed_prefs)}"]
    if no_place:
        lines += ["", f"找不到店的位置而略過（{len(no_place)}）：{'、'.join(no_place)}"]
    lines += ["", "| 縣 | 家數 |", "|---|---|"]
    for pref in geo.pref_slugs():
        n = sum(1 for r in out if r["prefecture"] == pref)
        if n:
            lines.append(f"| {pref} | {n} |")
    return "\n".join(lines) + "\n"
