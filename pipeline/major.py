"""大點採集（PLAN.md §5.1、§5.0、§5.6）：seed-region 指令的主體。

流程：OSM + Wikidata 候選 → 種子清單對齊 → 去重 → 精選分數 → 照片 credit、最近車站
→ data/spots/{pref}.json。LLM 補全（簡介、缺漏的假名）是另一個步驟，不在這裡。
"""

from __future__ import annotations

import datetime as dt
import json
import math
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from pipeline import config, geo
from pipeline.kana import is_kana, is_romaji, normalize_kana, romaji_with_spacing
from pipeline.models import (
    ExternalIds,
    Image,
    LocalizedName,
    Location,
    NearestStation,
    Source,
    Spot,
    StationName,
)
from pipeline.paths import REGIONS_JSON, SEED_DIR, SPOTS_DIR
from pipeline.sources import (
    commons,
    crossroadfukuoka,
    okinawastory,
    osm,
    pageviews,
    wikidata,
    wikipedia,
)
from pipeline.sources.okinawastory import OfficialSpot
from pipeline.sources.osm import OsmElement
from pipeline.sources.wikidata import Entity

QID_RE = re.compile(r"^Q\d+$")


def log(msg: str) -> None:
    print(msg, flush=True)


def norm_name(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"[\s・･\-‐（）()「」]", "", s)


def name_variants_strict(s: str) -> list[str]:
    """部分相符用：只取全名與括號內外，不含空白拆出的片段（避免「中部電力」誤配）。"""
    s = unicodedata.normalize("NFKC", s)
    out = [s, re.sub(r"[（(].*?[）)]", "", s)] + re.findall(r"[（(](.*?)[）)]", s)
    return [v for v in dict.fromkeys(norm_name(x) for x in out) if len(v) >= 2]


def name_variants(s: str) -> list[str]:
    s = unicodedata.normalize("NFKC", s)
    out = [s, re.sub(r"[（(].*?[）)]", "", s)]
    out += re.findall(r"[（(](.*?)[）)]", s)
    out += s.split()
    return [v for v in dict.fromkeys(norm_name(x) for x in out) if len(v) >= 2]


@dataclass
class Draft:
    key: str
    lat: float
    lng: float
    ent: Entity | None = None
    osm_els: list[OsmElement] = field(default_factory=list)
    tier: str | None = None
    seed_themes: list[str] = field(default_factory=list)
    views: dict[str, int] = field(default_factory=dict)
    heritage_tags: list[str] = field(default_factory=list)
    score: float = 0.0
    listed: bool = False  # 列在維基「{縣}の観光地」
    official: OfficialSpot | None = None  # 縣的官方觀光網站

    @property
    def qid(self) -> str | None:
        return self.ent.qid if self.ent else None

    @property
    def osm_tags(self) -> dict[str, str]:
        """只採用名稱與主體相符的 OSM 物件的 tag。

        同一個 wikidata 常掛在寺內的博物館、寶物館等物件上（例：東大寺ミュージアム），
        混進來會讓分類、假名、羅馬拼音變成別的設施。
        """
        els = self.osm_els
        if self.ent:
            target = norm_name(self.ent.labels.get("ja", ""))
            els = [
                el
                for el in els
                if norm_name(el.tags.get("name:ja") or el.tags.get("name", "")) == target
            ]
        merged: dict[str, str] = {}
        for el in els:
            for k, v in el.tags.items():
                merged.setdefault(k, v)
        return merged

    @property
    def name_ja(self) -> str | None:
        if self.ent and self.ent.labels.get("ja"):
            return self.ent.labels["ja"]
        t = self.osm_tags
        if t.get("name:ja") or t.get("name"):
            return t.get("name:ja") or t.get("name")
        if self.official:  # 官方名稱去掉括號裡的讀音、說明
            clean = re.sub(r"\s*[（(][^）)]*[）)]", "", self.official.name).strip()
            return clean or self.official.name
        return None

    def all_names(self) -> list[str]:
        names = [self.name_ja or ""]
        t = self.osm_tags
        names += [t.get("name", ""), t.get("name:ja", "")]
        if self.official:
            names.append(self.official.name)
        return [n for n in names if n]


# ---------- 候選 ----------


class PrefResolver:
    """Wikidata 項目屬於哪個縣：沿 P131（所在行政區）往上找到都道府縣；找不到才用縣界判斷。

    縣界資料精度有限，河川邊的景點（例：犬山城）容易判錯，行政區鏈比較可靠。
    """

    def __init__(self) -> None:
        iso_to_slug = {geo.iso_code(p): p for p in geo.pref_slugs()}
        items = wikidata.prefecture_items()
        self.pref_items = {q: iso_to_slug[i] for q, i in items.items() if i in iso_to_slug}
        self.parents: dict[str, list[str]] = {}

    def prefetch(self, ents: list[Entity]) -> None:
        frontier = {q for e in ents for q in e.located_in}
        for _ in range(5):
            todo = [q for q in frontier if q not in self.parents and q not in self.pref_items]
            if not todo:
                break
            self.parents.update(wikidata.parents(todo))
            frontier = {p for q in todo for p in self.parents.get(q, [])}

    def resolve(self, ent: Entity) -> str | None:
        seen: set[str] = set()
        level = list(ent.located_in)
        for _ in range(6):
            nxt = []
            for q in level:
                if q in self.pref_items:
                    return self.pref_items[q]
                if q not in seen:
                    seen.add(q)
                    nxt += self.parents.get(q, [])
            level = nxt
        return None


_resolver: PrefResolver | None = None
_resolver_seen: set[str] = set()


def _entity_in_pref(ent: Entity, pref: str) -> bool:
    if ent.lat is None or ent.lng is None:
        return False
    if _resolver is not None:
        if ent.qid not in _resolver_seen:
            _resolver.prefetch([ent])
            _resolver_seen.add(ent.qid)
        found = _resolver.resolve(ent)
        if found:
            return found == pref
    return geo.contains_fine(pref, ent.lat, ent.lng)


def pref_full_name(pref: str) -> str:
    """含「都道府県」字尾的正式名稱（沖縄 → 沖縄県）。"""
    regions = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))["regions"]
    ja = next(r["name"]["ja"] for r in regions if r["prefecture"] == pref)
    if pref == "hokkaido":
        return ja
    if pref == "tokyo":
        return f"{ja}都"
    if pref in ("kyoto", "osaka"):
        return f"{ja}府"
    return f"{ja}県"


def tourism_qids(pref: str) -> set[str]:
    """日文維基「{縣}の観光地」分類（含子分類）與同名清單條目裡連到的地點 → Wikidata QID。

    這是人工整理的觀光地，涵蓋沒有文化指定的熱門地點（街道、島、購物中心、市場）。
    清單條目也會連到市町村、概念條目，之後由 drop_non_spots 與「沒有座標」排除。
    """
    name = pref_full_name(pref)
    titles = wikipedia.category_members("jawiki", f"{name}の観光地", config.TOURISM_CATEGORY_DEPTH)
    listed = wikipedia.page_links("jawiki", f"{name}の観光地")
    log(f"[{pref}]   維基觀光地：分類 {len(titles)} 條、清單條目連結 {len(listed)} 條")
    ids = wikipedia.wikidata_ids("jawiki", titles + listed)
    return set(ids.values())


def extra_category_qids(pref: str) -> set[str]:
    """購物中心、市場、島、橋、岬等維基分類裡的地點（不加分，靠瀏覽量排序）。"""
    name = pref_full_name(pref)
    titles: list[str] = []
    for tpl in config.EXTRA_CATEGORIES:
        cat = tpl.format(name=name)
        got = wikipedia.category_members("jawiki", cat, 1)
        if got:
            log(f"[{pref}]   {cat}：{len(got)} 條")
        titles += got
    return set(wikipedia.wikidata_ids("jawiki", titles).values())


# 有官方觀光網站熱門排行的縣
OFFICIAL_SOURCES = {"okinawa": okinawastory.spots, "fukuoka": crossroadfukuoka.spots}
OFFICIAL_HOSTS = ("okinawastory.jp", "crossroadfukuoka.jp")


def _names_overlap(a: set[str], b: set[str]) -> bool:
    """名稱互相包含，或結尾相同 5 字以上。

    例：美浜アメリカンビレッジ／美浜タウンリゾート・アメリカンビレッジ
    """
    for x in a:
        for y in b:
            if len(x) < 3 or len(y) < 3:
                continue
            if x in y or y in x:
                return True
            n = 0
            while n < min(len(x), len(y)) and x[-1 - n] == y[-1 - n]:
                n += 1
            if n >= 5:
                return True
    return False


def official_names(name: str) -> set[str]:
    """官方名稱的比對用變體：去掉括號（讀音、說明）、拆開「A／B」「A / B」合寫。"""
    base = re.sub(r"[（(][^）)]*[）)]", "", unicodedata.normalize("NFKC", name)).strip()
    parts = [p.strip() for p in re.split(r"[／/]", base)]
    return {norm_name(p) for p in [base, *parts] if p} - {""}


def merge_official(pref: str, drafts: dict[str, Draft]) -> None:
    """官方觀光網站的熱門排行：名稱相同且在附近的併入既有候選，其餘新增。"""
    fetch = OFFICIAL_SOURCES.get(pref)
    if not fetch:
        return
    log(f"[{pref}] 官方觀光網站熱門排行…")
    items = fetch(config.OFFICIAL_TOP_N)
    matched = added = 0
    skipped: dict[str, list[str]] = {"沒有座標": [], "縣外": [], "住宿等": [], "活動、花況": []}
    south, west, north, east = geo.bbox(pref)
    for o in items:
        if o.lat is None or o.lng is None:
            # 頁面沒有地圖：名稱完全相同的既有候選才併入
            names = official_names(o.name)
            same = [
                d for d in drafts.values()
                if not d.official and names & {norm_name(n) for n in d.all_names()}
            ]  # fmt: skip
            if same:
                same[0].official = o
                matched += 1
            else:
                skipped["沒有座標"].append(o.name)
            continue
        # 官方網站只收本縣：用範圍框判斷就好（簡化縣界不含海岸線，橋、海灘、岬會被誤判在縣外）
        if not (south <= o.lat <= north and west <= o.lng <= east):
            skipped["縣外"].append(o.name)
            continue
        if any(x in c for c in o.categories for x in config.OFFICIAL_EXCLUDE_CATEGORY):
            skipped["住宿等"].append(o.name)
            continue
        # 熱門清單混有活動與季節花況（「【宇美八幡宮】放生会」「矢部川沿いの彼岸花」）：不是景點
        if config.OFFICIAL_EXCLUDE_NAME_RE.search(o.name):
            skipped["活動、花況"].append(o.name)
            continue
        names = official_names(o.name)
        # 名稱完全相同的優先，其次名稱重疊的；各自取最近的
        exact: list[tuple[float, Draft]] = []
        loose: list[tuple[float, Draft]] = []
        for d in drafts.values():
            if d.official:
                continue
            dist = geo.haversine_m(d.lat, d.lng, o.lat, o.lng)
            if dist > config.OFFICIAL_MATCH_DISTANCE_M:
                continue
            mine = {norm_name(n) for n in d.all_names()} - {""}
            if names & mine:
                exact.append((dist, d))
            elif dist <= 800 and _names_overlap(names, mine):
                loose.append((dist, d))
        pool = exact or loose
        target = min(pool, key=lambda x: x[0])[1] if pool else None
        # 同名的只是 OSM 點（首里城公園）、附近有 Wikidata 景點（首里城）：
        # 官方資訊給 Wikidata 景點，OSM 點併進去
        if target and not target.ent:
            wd = [(dist, d) for dist, d in exact + loose if d.ent and dist <= 800]
            if wd:
                wd_target = min(wd, key=lambda x: x[0])[1]
                for _, d in exact:
                    if not d.ent and d.key in drafts:
                        wd_target.osm_els += d.osm_els
                        del drafts[d.key]
                target = wd_target
        if target:
            target.official = o
            matched += 1
        else:
            key = f"{o.source}-{o.id}"
            drafts[key] = Draft(key=key, lat=o.lat, lng=o.lng, official=o)
            added += 1
    n_skip = sum(len(v) for v in skipped.values())
    log(f"[{pref}]   官方 {len(items)} 筆：併入 {matched}、新增 {added}、略過 {n_skip}")
    for why, names in skipped.items():
        if names:
            log(f"[{pref}]     略過（{why}）：{'、'.join(names[:40])}")


def collect(pref: str) -> tuple[dict[str, Draft], dict[str, Entity]]:
    iso = geo.iso_code(pref)
    south, west, north, east = geo.bbox(pref)

    global _resolver
    _resolver = PrefResolver()

    log(f"[{pref}] OSM 大點候選（{iso}）…")
    try:
        osm_els = osm.attractions(iso)
    except RuntimeError as e:
        log(f"[{pref}]   area 查詢失敗：{e}")
        osm_els = []
    if not osm_els:
        log(f"[{pref}]   改用範圍框查詢")
        osm_els = [
            e
            for e in osm.attractions_bbox((south, west, north, east))
            if geo.contains_fine(pref, e.lat, e.lng)
        ]
    log(f"[{pref}]   OSM {len(osm_els)} 筆")

    log(f"[{pref}] Wikidata 文化指定候選…")
    wd_qids = wikidata.heritage_items_in_box(
        south, west, north, east, config.MIN_SITELINKS_HERITAGE
    )
    log(f"[{pref}]   Wikidata {len(wd_qids)} 筆（框內）")

    log(f"[{pref}] 維基「{pref_full_name(pref)}の観光地」…")
    tour_qids = sorted(tourism_qids(pref))
    extra_qids = sorted(extra_category_qids(pref) - set(tour_qids))

    osm_qids = [e.tags["wikidata"] for e in osm_els if QID_RE.match(e.tags.get("wikidata", ""))]
    ents = wikidata.entities(osm_qids + wd_qids + tour_qids + extra_qids)
    _resolver.prefetch(list(ents.values()))
    _resolver_seen.update(ents)

    drafts: dict[str, Draft] = {}
    for qid in [*wd_qids, *tour_qids, *extra_qids]:
        ent = ents.get(qid)
        if qid not in drafts and ent and _entity_in_pref(ent, pref):
            drafts[qid] = Draft(key=qid, lat=ent.lat, lng=ent.lng, ent=ent)  # type: ignore[arg-type]
    for qid in tour_qids:
        if qid in drafts:
            drafts[qid].listed = True
    log(f"[{pref}]   維基觀光地在縣內且有座標：{sum(d.listed for d in drafts.values())} 筆")

    loose: list[OsmElement] = []
    for el in osm_els:
        qid = el.tags.get("wikidata", "")
        if QID_RE.match(qid) and qid in ents:
            ent = ents[qid]
            other = _resolver.resolve(ent)
            if other and other != pref:
                continue  # 例：延暦寺在滋賀，京都境內也有它的 OSM 物件
            if qid not in drafts:
                inside = _entity_in_pref(ent, pref)
                lat, lng = (ent.lat, ent.lng) if inside else (el.lat, el.lng)
                drafts[qid] = Draft(key=qid, lat=lat, lng=lng, ent=ent)  # type: ignore[arg-type]
            drafts[qid].osm_els.append(el)
        else:
            loose.append(el)

    # 沒有 wikidata tag 的 OSM：距離近且名稱相同就併入，否則自成一筆。
    for el in loose:
        name = norm_name(el.tags.get("name:ja") or el.tags.get("name", ""))
        target = None
        for d in drafts.values():
            dist = geo.haversine_m(d.lat, d.lng, el.lat, el.lng)
            if dist > config.LABEL_MERGE_DISTANCE_M:
                continue
            if (
                any(norm_name(n) == name for n in d.all_names())
                and dist <= config.DEDUPE_DISTANCE_M
            ):
                target = d
                break
            # Wikidata 的任一語言標籤相同（大坂城／大阪城）：城郭、公園範圍大，放寬距離
            labels = d.ent.labels.values() if d.ent else []
            if any(norm_name(x) == name for x in labels):
                target = d
                break
        if target:
            target.osm_els.append(el)
        else:
            drafts[el.osm_id] = Draft(key=el.osm_id, lat=el.lat, lng=el.lng, osm_els=[el])
    merge_official(pref, drafts)
    return drafts, ents


# ---------- 種子清單 ----------


def load_seeds(pref: str) -> list[dict[str, Any]]:
    data = json.loads((SEED_DIR / "seed_from_guides.json").read_text(encoding="utf-8"))
    return [s for s in data["spots"] if s["prefecture"] == pref and s["kind"] == "major"]


def apply_seeds(pref: str, drafts: dict[str, Draft]) -> list[str]:
    """把種子對到候選上（找不到就用 Wikidata 搜尋補查）。回傳對不上的種子名稱。"""
    unmatched = []
    for seed in load_seeds(pref):
        variants = name_variants(seed["name_ja"])
        best: Draft | None = None
        for d in drafts.values():
            names = [norm_name(n) for n in d.all_names()]
            names += [norm_name(x) for x in (d.ent.labels.values() if d.ent else [])]
            if any(v == n for v in variants for n in names):
                # 有 Wikidata 的優先（「大阪城」要對到 Wikidata 的大坂城，不是 OSM 的同名物件）
                rank = (bool(d.ent), _sitelinks(d))
                if best is None or rank > (bool(best.ent), _sitelinks(best)):
                    best = d
        if best is None:
            best = _substring_match(name_variants_strict(seed["name_ja"]), drafts)
        if best is None:
            best = _search_seed(pref, name_variants_strict(seed["name_ja"]), drafts)
        if best is None:
            unmatched.append(seed["name_ja"])
            continue
        tier = seed.get("guide_tier")
        if tier and (best.tier is None or tier < best.tier):
            best.tier = tier
        best.seed_themes = sorted(set(best.seed_themes) | set(seed.get("themes", [])))
    return unmatched


def _substring_match(variants: list[str], drafts: dict[str, Draft]) -> Draft | None:
    """「美山かやぶきの里」對「かやぶきの里」這類部分相符（至少 4 字）。"""
    best: Draft | None = None
    for d in drafts.values():
        for n in (norm_name(x) for x in d.all_names()):
            if len(n) < 4:
                continue
            if any((len(v) >= 4 and v in n) or n in v for v in variants):
                if best is None or _sitelinks(d) > _sitelinks(best):
                    best = d
    return best


def _sitelinks(d: Draft) -> int:
    return len(d.ent.sitelinks) if d.ent else 0


def _search_seed(pref: str, variants: list[str], drafts: dict[str, Draft]) -> Draft | None:
    for v in variants:
        qids = wikidata.search(v)
        if not qids:
            continue
        ents = wikidata.entities(qids)
        for qid in qids:
            ent = ents.get(qid)
            if not ent or not _entity_in_pref(ent, pref):
                continue
            label = norm_name(ent.labels.get("ja", ""))
            # 搜尋結果名稱必須和種子相符（「大須商店街」不能對到附近的「ふれあい広場」）
            if not label or not (label == v or v in label or label in v):
                continue
            if qid in drafts:
                return drafts[qid]
            d = Draft(key=qid, lat=ent.lat, lng=ent.lng, ent=ent)  # type: ignore[arg-type]
            drafts[qid] = d
            return d
    return None


# ---------- 附屬建物合併 ----------


def drop_subparts(drafts: dict[str, Draft]) -> int:
    """「伏見稲荷大社本殿」這類附屬建物併進主體（名稱以主體開頭、距離很近）。"""
    items = sorted(drafts.values(), key=lambda d: -_sitelinks(d))
    removed = 0
    for parent in items:
        pname = norm_name(parent.name_ja or "")
        # 主體名稱太短（「古宇利」「知念」這類地名）會把「古宇利大橋」「知念岬」吞掉
        if len(pname) < 4 or parent.key not in drafts:
            continue
        for child in items:
            # 種子、官方網站、維基觀光地清單列出的是獨立景點，不併入
            if child is parent or child.key not in drafts or child.tier:
                continue
            if child.official or child.listed:
                continue
            cname = norm_name(child.name_ja or "")
            if cname != pname and cname.startswith(pname):
                dist = geo.haversine_m(parent.lat, parent.lng, child.lat, child.lng)
                if dist <= config.SUBPART_DISTANCE_M:
                    del drafts[child.key]
                    removed += 1
    return removed


# ---------- 排除非景點 ----------

# P31（性質）日文標籤命中這些就不是景點：縣市本身、世界遺產的總稱條目等。
# 行政區本身：即使是攻略種子對到的也排除（種子「西尾市」指的是地區，不是景點）。
ADMIN_P31 = {
    "都道府県", "日本の都道府県", "府", "県", "市", "日本の市", "町", "村", "特別区",
    "政令指定都市", "中核市", "特例市", "行政区", "郡", "日本の町", "日本の村",
}  # fmt: skip
# 其他非景點：總稱條目、車站、事件、可移動文化財（畫作等）、地質構造。
EXCLUDE_P31_EXACT = {"世界遺産", "文化遺産", "自然遺産", "複合遺産"}
EXCLUDE_P31_SUBSTR = (
    "世界遺産", "遺産群", "構成資産", "古墳群", "駅", "停留場", "事故", "事件",
    "災害", "戦い", "絵画", "屏風",
    "絵巻", "美術作品", "彫刻作品", "書跡", "典籍", "古文書", "工芸品", "刀剣", "写本",
    "断層", "構造線", "路線", "街道", "宗教団体", "新宗教", "遊廓", "遊郭", "企業", "会社",
    # 人物、物品、園區內遊樂設施、住宿（全國擴展時發現混入精選）
    "人間", "ヒト", "妖怪", "機関車", "航空機", "軍艦", "戦艦", "艦船", "舞楽", "郷土芸能",
    "アトラクション", "コースター", "ダークライド", "ホテル", "印章", "土偶", "出土品", "飛行隊",
    "空港", "飛行場", "港湾", "フェリーターミナル",
    "airport", "aerodrome",
    "human", "yōkai", "locomotive", "aircraft", "battleship", "amusement ride", "roller coaster",
    "dark ride", "hotel",
    # 沒有日文標籤時 labels_ja 會回傳英文
    "station", "accident", "incident", "disaster", "painting", "folding screen",
    "organization", "religious movement", "World Heritage", "red-light", "company",
)  # fmt: skip


# 以 P31 標籤的部分文字判斷（Wikidata 的標籤寫法不一：「政令指定都市の区」「廃止市町村」…）
# 行政區（區、已廢止的市町村）、令制國。不用「市町村」「行政区画」做部分比對：
# 會誤殺市町村道（天神西通り）、市町村營的水壩、銀座這類街區
ADMIN_P31_SUBSTR = ("廃止市町村", "都市の区", "日本の区", "令制国", "旧国")
# 活動、事件：祭典之後放在深度探索頁，不當景點
EVENT_P31_SUBSTR = (
    "祭り", "祭礼", "例祭", "年中行事", "行事", "戦闘", "合戦", "紛争", "事変", "政変", "反乱",
    "festival", "battle", "recurring event",
)  # fmt: skip
# 廣域地名：地圖上一個點代表不了。以名稱結尾判斷（P31 判斷會誤殺六甲山、上高地這類景點）；
# 世界遺產例外（白神山地）
REGION_NAME_RE = re.compile(
    r"(国立公園|国定公園|半島|山地|山脈|山系|連峰|連山|丘陵|平野|盆地|諸島|列島|群島)$"
)


def non_spot_reason(kinds: set[str], name: str = "", world_heritage: bool = False) -> str | None:
    """不是景點的理由（命中的 P31 標籤或名稱規則）；是景點回傳 None。

    行政區、事件與活動、既有的排除類型看 P31；廣域地名看名稱結尾。
    """
    for k in sorted(kinds & (ADMIN_P31 | EXCLUDE_P31_EXACT)):
        return k
    for k in sorted(kinds):
        if any(s in k for s in ADMIN_P31_SUBSTR + EVENT_P31_SUBSTR):
            return k
        # 道の駅是景點，不當車站排除
        if any(s in k and not (s == "駅" and "道の駅" in k) for s in EXCLUDE_P31_SUBSTR):
            return k
    if not world_heritage and REGION_NAME_RE.search(strip_disambiguation(name)):
        return "廣域地名"
    return None


def non_spot_kind(kinds: set[str], world_heritage: bool = False, name: str = "") -> bool:
    return non_spot_reason(kinds, name, world_heritage) is not None


# 總稱條目（世界遺產登錄名、古墳群）：以名稱判斷
COLLECTIVE_NAME_RE = re.compile(
    r"(の文化財|古墳群|世界遺産|関連遺産群?|構成資産|の社寺|産業革命遺産.*|の古都.*)$"
)


# OSM 標籤明確是景點類型（海灘、博物館、主題樂園、市場、購物中心…）
_OSM_SPOT_TAGS = {
    ("natural", "beach"), ("natural", "cape"), ("tourism", "museum"), ("tourism", "gallery"),
    ("tourism", "theme_park"), ("tourism", "zoo"), ("tourism", "aquarium"),
    ("amenity", "marketplace"), ("shop", "mall"), ("leisure", "park"), ("leisure", "garden"),
    ("natural", "waterfall"), ("waterway", "waterfall"), ("natural", "cave_entrance"),
}  # fmt: skip
# 通用名稱（「展望台」「神社」）不是可辨識的景點
GENERIC_NAME_RE = re.compile(
    r"^(展望台|展望所|展望広場|展示広場|展示室|神社|寺|水族館|美術館|博物館|資料館|公園|ビーチ|海岸|"
    r"church|shrine|temple|museum|welcome|view ?point|observatory|beach|park)$",
    re.IGNORECASE,
)


def _osm_spot_like(d: Draft) -> bool:
    t = d.osm_tags
    return any(t.get(k) == v for k, v in _OSM_SPOT_TAGS)


def excluded_ids() -> set[str]:
    """人工排除清單（data/seed/exclude.json）的景點 id。"""
    path = SEED_DIR / "exclude.json"
    if not path.exists():
        return set()
    return {x["id"] for x in json.loads(path.read_text(encoding="utf-8"))["items"]}


def name_excluded(name_ja: str | None) -> bool:
    """以名稱判斷的排除：總稱條目、古墳（使用者決定：一般旅客不會專程去）。"""
    name = strip_disambiguation(unicodedata.normalize("NFKC", name_ja or ""))
    return bool(
        COLLECTIVE_NAME_RE.search(name) or KOFUN_DROP_RE.search(name) or GENERIC_NAME_RE.match(name)
    )


def drop_non_spots(drafts: dict[str, Draft]) -> list[str]:
    qids = sorted({q for d in drafts.values() if d.ent for q in d.ent.instance_of})
    labels = wikidata.labels_ja(qids) if qids else {}
    hq = sorted({h for d in drafts.values() if d.ent for h in d.ent.heritage})
    labels_h = wikidata.labels_ja(hq) if hq else {}
    manual = excluded_ids()
    dropped = []
    for key, d in list(drafts.items()):
        # 只有 OSM、沒有 Wikidata 項目的點大多是遊樂設施、動物舍、店家等（分數也都是 0）；
        # 攻略種子、官方觀光網站列出的、OSM 標籤明確是景點類型的例外
        if not d.ent:
            keep = d.tier or d.official or _osm_spot_like(d)
            if not keep or name_excluded(d.name_ja):
                dropped.append(d.name_ja or key)
                del drafts[key]
            continue
        if f"wd-{d.ent.qid}" in manual:
            dropped.append(d.name_ja or key)
            del drafts[key]
            continue
        kinds = {labels.get(q, "") for q in d.ent.instance_of} - {""}
        heritage = {labels_h.get(h, "") for h in d.ent.heritage}
        world = any("世界遺産" in h for h in heritage)
        if non_spot_kind(kinds, world, d.name_ja or "") or name_excluded(d.name_ja):
            dropped.append(d.name_ja or key)
            del drafts[key]
    return dropped


# ---------- 評分 ----------


def score(drafts: dict[str, Draft]) -> None:
    heritage_qids = sorted({h for d in drafts.values() if d.ent for h in d.ent.heritage})
    heritage_labels = wikidata.labels_ja(heritage_qids) if heritage_qids else {}

    with_wiki = [d for d in drafts.values() if d.ent and d.ent.sitelinks]
    log(f"  瀏覽量：{len(with_wiki)} 筆")
    for i, d in enumerate(with_wiki):
        for site in config.PAGEVIEW_WEIGHTS:
            title = d.ent.sitelinks.get(site)  # type: ignore[union-attr]
            if title:
                d.views[site] = pageviews.yearly_views(site, title)
        if (i + 1) % 100 == 0:
            log(f"    {i + 1}/{len(with_wiki)}")

    for d in drafts.values():
        weighted = sum(d.views.get(s, 0) * w for s, w in config.PAGEVIEW_WEIGHTS.items())
        s = config.PAGEVIEW_FACTOR * math.log10(1 + weighted)
        s += config.SITELINK_FACTOR * math.sqrt(_sitelinks(d))
        bonus = 0.0
        tags: list[str] = []
        for hq in d.ent.heritage if d.ent else []:
            label = heritage_labels.get(hq, "")
            for key, tag, pts in config.HERITAGE_RULES:
                if key in label:
                    if tag not in tags:
                        tags.append(tag)
                        bonus += pts
                    break
        d.heritage_tags = tags
        s += min(bonus, config.HERITAGE_BONUS_CAP)
        if d.tier:
            s += config.GUIDE_TIER_BONUS.get(d.tier, 0.0)
        if d.listed:
            s += config.TOURISM_LIST_BONUS
        if d.official:
            share = max(1 - (d.official.rank - 1) / config.OFFICIAL_TOP_N, 0)
            span = config.OFFICIAL_BONUS_MAX - config.OFFICIAL_BONUS_MIN
            s += config.OFFICIAL_BONUS_MIN + span * share
        d.score = round(s, 2)


# ---------- 組成 Spot ----------

_CATEGORY_BY_TAG = [
    (("historic", "castle"), "城"),
    (("tourism", "museum"), "博物館"),
    (("tourism", "gallery"), "美術館"),
    (("tourism", "zoo"), "動物園"),
    (("tourism", "aquarium"), "水族館"),
    (("tourism", "theme_park"), "主題樂園"),
    (("leisure", "garden"), "庭園"),
    (("leisure", "park"), "公園"),
    (("tourism", "viewpoint"), "展望"),
    (("historic", "ruins"), "遺跡"),
    (("historic", "archaeological_site"), "遺跡"),
    (("shop", "mall"), "購物"),
    (("shop", "department_store"), "購物"),
    (("amenity", "marketplace"), "市場"),
    (("natural", "beach"), "海灘"),
    (("natural", "cape"), "岬"),
    (("place", "island"), "島"),
    (("place", "islet"), "島"),
    (("man_made", "bridge"), "橋"),
]
_CATEGORY_BY_NAME = [
    (re.compile(r"(神社|大社|神宮|天満宮|八幡宮|稲荷)$"), "神社"),
    (re.compile(r"(寺|院|堂)$"), "寺院"),
    (re.compile(r"城$"), "城"),
    (re.compile(r"(古墳|天皇陵|御陵)$"), "古墳"),
    (re.compile(r"美術館$"), "美術館"),
    (re.compile(r"(博物館|資料館|記念館|科学館)$"), "博物館"),
    (re.compile(r"(庭園|御苑)$"), "庭園"),
    (re.compile(r"公園$"), "公園"),
    (re.compile(r"(商店街|横丁|通り|外人住宅|アメリカンビレッジ|町並み?)$"), "街區"),
    (re.compile(r"(市場|いゆまち|漁港|朝市)$"), "市場"),
    (
        re.compile(
            r"(パルコシティ|PARCO CITY|モール|アウトレット|イーアス.*|ショッピングセンター)$"
        ),
        "購物",
    ),
    (re.compile(r"(ビーチ|海水浴場|海浜|浜)$"), "海灘"),
    (re.compile(r"(岬|崎)$"), "岬"),
    (re.compile(r"(大橋|橋)$"), "橋"),
    (re.compile(r"島$"), "島"),
]


# 官方觀光網站的類型名稱 → 本站類型（依序比對關鍵字）
_CATEGORY_BY_OFFICIAL = [
    ("ビーチ", "海灘"),
    ("海水浴", "海灘"),
    ("岬", "岬"),
    ("島", "島"),
    ("市場", "市場"),
    ("直売", "市場"),
    ("ショッピング", "購物"),
    ("商業施設", "購物"),
    ("水族館", "水族館"),
    ("動物園", "動物園"),
    ("美術館", "美術館"),
    ("博物館", "博物館"),
    ("資料館", "博物館"),
    ("テーマパーク", "主題樂園"),
    ("城", "城"),
    ("グスク", "城"),
    ("御嶽", "神社"),
    ("神社", "神社"),
    ("寺", "寺院"),
    ("公園", "公園"),
    ("庭園", "庭園"),
    ("展望", "展望"),
    ("街並", "街區"),
    ("通り", "街區"),
]

KOFUN_RE = re.compile(r"(古墳|天皇陵|御陵)$")
# 排除用：另外涵蓋古墳群；名稱先去掉消歧義括號（「亀塚古墳 (野洲市)」）
KOFUN_DROP_RE = re.compile(r"(古墳群?|天皇陵|御陵)$")


def category(d: Draft) -> str | None:
    if KOFUN_RE.search(unicodedata.normalize("NFKC", d.name_ja or "")):
        return "古墳"
    t = d.osm_tags
    if t.get("amenity") == "place_of_worship":
        if t.get("religion") == "shinto":
            return "神社"
        if t.get("religion") == "buddhist":
            return "寺院"
    for (k, v), cat in _CATEGORY_BY_TAG:
        if t.get(k) == v:
            return cat
    name = unicodedata.normalize("NFKC", d.name_ja or "")
    if name.endswith("病院"):
        return None
    for rx, cat in _CATEGORY_BY_NAME:
        if rx.search(name):
            return cat
    # 官方觀光網站的類型（名稱與 OSM 都判斷不出來時）
    for label in d.official.categories if d.official else []:
        for key, cat in _CATEGORY_BY_OFFICIAL:
            if key in label:
                return cat
    return None


def strip_disambiguation(label: str) -> str:
    """維基標籤的消歧義括號：「竹林 (京都)」→「竹林」。"""
    return re.sub(r"\s*[（(][^）)]*[）)]\s*$", "", label).strip()


def build_names(d: Draft) -> tuple[LocalizedName, str | None]:
    t = d.osm_tags
    labels = d.ent.labels if d.ent else {}
    ja = d.name_ja or ""
    en = labels.get("en") or t.get("name:en")
    kana, kana_source = None, None
    wd_kana = next((k for k in (d.ent.kana_all if d.ent else []) if is_kana(k)), None)
    if is_kana(ja):  # 名稱本身就是假名
        kana, kana_source = normalize_kana(ja), "wikidata" if d.ent else "osm"
    elif wd_kana:
        kana, kana_source = normalize_kana(wd_kana), "wikidata"
    else:
        for key in ("name:ja-Hira", "name:ja_kana", "name:ja-Kana"):
            if t.get(key) and is_kana(t[key]):
                kana, kana_source = normalize_kana(t[key]), "osm"
                break
    romaji = next((t[k] for k in ("name:ja-Latn", "name:ja_rm") if is_romaji(t.get(k))), None)
    if not romaji and kana:
        romaji = romaji_with_spacing(kana, en)
    zh_tw = (
        labels.get("zh-tw")
        or labels.get("zh-hant")
        or labels.get("zh-hk")
        or t.get("name:zh-Hant")
        or t.get("name:zh_TW")
        or labels.get("zh")
        or t.get("name:zh")
        or ja
    )
    zh_tw = strip_disambiguation(zh_tw) or ja
    return LocalizedName(ja=ja, kana=kana, romaji=romaji, zh_tw=zh_tw, en=en), kana_source


def station_index(pref: str) -> list[OsmElement]:
    els = osm.stations(geo.bbox(pref, pad=0.05))
    log(f"[{pref}]   車站 {len(els)} 筆")
    return els


def nearest_stations(d: Draft, stations: list[OsmElement]) -> list[NearestStation]:
    # 同名車站常有多個節點（不同路線），距離取最近的，tag 合併（有的節點才有假名）。
    best: dict[str, float] = {}
    tags_by_name: dict[str, dict[str, str]] = {}
    for st in stations:
        name = st.tags.get("name:ja") or st.tags["name"]
        merged = tags_by_name.setdefault(name, {})
        for k, v in st.tags.items():
            merged.setdefault(k, v)
        dist = geo.haversine_m(d.lat, d.lng, st.lat, st.lng)
        if dist <= config.STATION_MAX_DISTANCE_M and dist < best.get(name, math.inf):
            best[name] = dist
    out = []
    for name, dist in sorted(best.items(), key=lambda kv: kv[1])[: config.STATION_MAX_COUNT]:
        t = tags_by_name[name]
        kana = next(
            (normalize_kana(t[k]) for k in ("name:ja-Hira", "name:ja_kana") if t.get(k)), None
        )
        romaji = next((t[k] for k in ("name:ja-Latn", "name:ja_rm") if is_romaji(t.get(k))), None)
        if not romaji and kana:
            romaji = romaji_with_spacing(kana, t.get("name:en"))
        out.append(
            NearestStation(
                name=StationName(ja=name, kana=kana, romaji=romaji, en=t.get("name:en")),
                distance_m=int(round(dist / 10) * 10),
            )
        )
    return out


def spot_id(d: Draft) -> str:
    if d.qid:
        return f"wd-{d.qid}"
    if not d.osm_els and d.official:
        return f"{d.official.source}-{d.official.id}"
    kind, num = d.osm_els[0].osm_id.split("/")
    return f"osm-{kind}-{num}"


def to_spot(
    pref: str,
    d: Draft,
    featured: bool,
    images: dict[str, commons.ImageInfo],
    stations: list[OsmElement],
    today: str,
) -> Spot:
    name, kana_source = build_names(d)
    sources = []
    if d.ent:
        sources.append(Source(url=d.ent.url, fetched_at=today))
    for el in d.osm_els[:3]:
        sources.append(Source(url=el.url, fetched_at=today))
    if d.official:
        sources.append(Source(url=d.official.url, fetched_at=today))
    img_list = []
    if d.ent and d.ent.image and d.ent.image in images:
        info = images[d.ent.image]
        img_list.append(
            Image(
                url=info.url, author=info.author, license=info.license, source_url=info.source_url
            )
        )
    tags = []
    cat = category(d)
    if cat:
        tags.append(cat)
    tags += d.heritage_tags
    if d.tier:
        tags.append(f"guide-{d.tier}")
    return Spot(
        id=spot_id(d),
        name=name,
        kana_source=kana_source,
        location=Location(lat=round(d.lat, 6), lng=round(d.lng, 6)),
        prefecture=pref,
        city=d.osm_tags.get("addr:city"),
        kind="major",
        themes=d.seed_themes,
        tags=tags,
        featured=featured,
        score=d.score,
        nearest_stations=nearest_stations(d, stations) or None,
        images=img_list,
        external_ids=ExternalIds(wikidata=d.qid, osm=d.osm_els[0].osm_id if d.osm_els else None),
        sources=sources,
        status="published",
        updated_at=today,
    )


# ---------- 與既有檔案合併、輸出 ----------

# pipeline 不產生、由 enrich / verify / 人工維護的欄位：重跑時保留。
PRESERVED = ("summary", "best_months", "stay_minutes", "goshuin", "omamori", "verification")


def _comparable(d: dict[str, Any]) -> dict[str, Any]:
    c = {k: v for k, v in d.items() if k != "updated_at"}
    c["sources"] = [{"url": s["url"]} for s in c.get("sources", [])]
    return c


def merge_existing(spots: list[Spot], path) -> list[dict[str, Any]]:  # noqa: ANN001
    old: dict[str, dict[str, Any]] = {}
    if path.exists():
        old = {s["id"]: s for s in json.loads(path.read_text(encoding="utf-8"))}
    out = []
    for spot in spots:
        new = spot.model_dump(mode="json", exclude_none=True)
        prev = old.get(spot.id)
        if prev:
            for k in PRESERVED:
                if prev.get(k) and not new.get(k):
                    new[k] = prev[k]
            if prev.get("kana_source") == "wikipedia" and not new["name"].get("kana"):
                new["name"]["kana"] = prev["name"].get("kana")
                new["name"]["romaji"] = prev["name"].get("romaji")
                new["kana_source"] = "wikipedia"
            # 維基百科的來源由 pipeline.wiki 加上（簡介、念法），重新採集時沿用
            urls = {s["url"] for s in new["sources"]}
            wiki_sources = [s for s in prev.get("sources", []) if "wikipedia.org" in s["url"]]
            new["sources"] += [s for s in wiki_sources if s["url"] not in urls]
            prev_fetch = {s["url"]: s["fetched_at"] for s in prev.get("sources", [])}
            for s in new["sources"]:
                s["fetched_at"] = prev_fetch.get(s["url"], s["fetched_at"])
            if _comparable(prev) == _comparable(new):
                new["updated_at"] = prev["updated_at"]
        if prev:  # 主題由 seed-themes 維護：保留既有的
            new["themes"] = sorted(set(new.get("themes", [])) | set(prev.get("themes", [])))
        out.append(Spot.model_validate(new).model_dump(mode="json", exclude_none=True))
    # 主題小店（kind=theme）由 seed-themes 產生，這裡原樣保留
    ids = {s["id"] for s in out}
    out += [s for s in old.values() if s.get("kind") == "theme" and s["id"] not in ids]
    return sorted(out, key=lambda s: s["id"])


def write_spots(pref: str, spots: list[dict[str, Any]]) -> None:
    SPOTS_DIR.mkdir(parents=True, exist_ok=True)
    path = SPOTS_DIR / f"{pref}.json"
    path.write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def pick_featured(ranked: list[Draft]) -> set[str]:
    """分數高到低挑精選，同一分類設上限，避免整片都是古墳或寺院；S 級種子一律列入。"""
    chosen = {d.key for d in ranked if d.tier == "S"}
    counts: dict[str, int] = {}
    for d in ranked:
        if len(chosen) >= config.FEATURED_PER_PREF:
            break
        if d.key in chosen:
            continue
        cat = category(d) or ""
        cap = config.FEATURED_CATEGORY_CAP.get(cat, config.FEATURED_CATEGORY_CAP_DEFAULT)
        if counts.get(cat, 0) >= cap:
            continue
        counts[cat] = counts.get(cat, 0) + 1
        chosen.add(d.key)
    return chosen


def seed_region(pref: str) -> str:
    """回傳 markdown 報告。"""
    today = dt.date.today().isoformat()
    drafts, _ = collect(pref)
    unmatched = apply_seeds(pref, drafts)
    merged = drop_subparts(drafts)
    excluded = drop_non_spots(drafts)
    if excluded:
        log(f"[{pref}] 排除非景點：{'、'.join(excluded)}")
    drafts = {k: d for k, d in drafts.items() if d.name_ja}
    log(f"[{pref}] 候選 {len(drafts)} 筆（附屬建物併入 {merged} 筆）")

    score(drafts)
    ranked = sorted(drafts.values(), key=lambda d: (-d.score, d.key))
    keep = ranked[: config.MAX_SPOTS_PER_PREF]
    keep += [d for d in ranked[config.MAX_SPOTS_PER_PREF :] if d.tier]
    featured_keys = pick_featured(keep)

    files = [d.ent.image for d in keep if d.ent and d.ent.image]
    log(f"[{pref}] 照片資訊 {len(files)} 筆…")
    images = commons.image_info(files)
    stations = station_index(pref)

    spots = [to_spot(pref, d, d.key in featured_keys, images, stations, today) for d in keep]
    path = SPOTS_DIR / f"{pref}.json"
    out = merge_existing(spots, path)
    # 簡介與缺漏念法取自維基百科（pipeline.wiki），與採集同一次完成
    from pipeline.wiki import apply_wiki

    apply_wiki(out, today)
    out = [Spot.model_validate(s).model_dump(mode="json", exclude_none=True) for s in out]
    write_spots(pref, out)
    return report(pref, out, unmatched)


def _official_url(s: dict[str, Any]) -> bool:
    return any(h in x["url"] for x in s.get("sources", []) for h in OFFICIAL_HOSTS)


def report(pref: str, spots: list[dict[str, Any]], unmatched: list[str]) -> str:
    featured = [s for s in spots if s["featured"]]
    featured.sort(key=lambda s: -s["score"])
    no_kana = [s for s in spots if not s["name"].get("kana")]
    no_image = [s for s in spots if not s["images"]]
    no_station = [s for s in spots if not s.get("nearest_stations")]
    seed_hits = [s for s in spots if any(t.startswith("guide-") for t in s["tags"])]
    lines = [
        f"## {pref}",
        "",
        "| 項目 | 筆數 |",
        "|---|---|",
        f"| 全部景點 | {len(spots)} |",
        f"| 精選 | {len(featured)} |",
        f"| 對上的種子景點 | {len(seed_hits)} |",
        f"| 官方觀光網站列出 | {sum(1 for s in spots if _official_url(s))} |",
        f"| 缺假名 | {len(no_kana)} |",
        f"| 沒有照片 | {len(no_image)} |",
        f"| 1.5 km 內沒有車站 | {len(no_station)} |",
        "",
        "精選：" + "、".join(f"{s['name']['ja']}（{s['score']:.0f}）" for s in featured),
        "",
    ]
    if unmatched:
        lines += ["對不上的種子景點（需人工確認）：" + "、".join(unmatched), ""]
    return "\n".join(lines)
