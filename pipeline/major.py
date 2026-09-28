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
from pipeline.paths import SEED_DIR, SPOTS_DIR
from pipeline.sources import commons, osm, pageviews, wikidata
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
        return t.get("name:ja") or t.get("name")

    def all_names(self) -> list[str]:
        names = [self.name_ja or ""]
        t = self.osm_tags
        names += [t.get("name", ""), t.get("name:ja", "")]
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

    osm_qids = [e.tags["wikidata"] for e in osm_els if QID_RE.match(e.tags.get("wikidata", ""))]
    ents = wikidata.entities(osm_qids + wd_qids)
    _resolver.prefetch(list(ents.values()))
    _resolver_seen.update(ents)

    drafts: dict[str, Draft] = {}
    for qid in wd_qids:
        ent = ents.get(qid)
        if ent and _entity_in_pref(ent, pref):
            drafts[qid] = Draft(key=qid, lat=ent.lat, lng=ent.lng, ent=ent)  # type: ignore[arg-type]

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
        if len(pname) < 3 or parent.key not in drafts:
            continue
        for child in items:
            if child is parent or child.key not in drafts or child.tier:
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
    "human", "yōkai", "locomotive", "aircraft", "battleship", "amusement ride", "roller coaster",
    "dark ride", "hotel",
    # 沒有日文標籤時 labels_ja 會回傳英文
    "station", "accident", "incident", "disaster", "painting", "folding screen",
    "organization", "religious movement", "World Heritage", "red-light", "company",
)  # fmt: skip


# 總稱條目（世界遺產登錄名、古墳群）：以名稱判斷
COLLECTIVE_NAME_RE = re.compile(
    r"(の文化財|古墳群|世界遺産|関連遺産群?|構成資産|の社寺|産業革命遺産.*|の古都.*)$"
)


def excluded_ids() -> set[str]:
    """人工排除清單（data/seed/exclude.json）的景點 id。"""
    path = SEED_DIR / "exclude.json"
    if not path.exists():
        return set()
    return {x["id"] for x in json.loads(path.read_text(encoding="utf-8"))["items"]}


def name_excluded(name_ja: str | None) -> bool:
    """以名稱判斷的排除：總稱條目、古墳（使用者決定：一般旅客不會專程去）。"""
    name = strip_disambiguation(unicodedata.normalize("NFKC", name_ja or ""))
    return bool(COLLECTIVE_NAME_RE.search(name) or KOFUN_DROP_RE.search(name))


def drop_non_spots(drafts: dict[str, Draft]) -> list[str]:
    qids = sorted({q for d in drafts.values() if d.ent for q in d.ent.instance_of})
    labels = wikidata.labels_ja(qids) if qids else {}
    manual = excluded_ids()
    dropped = []
    for key, d in list(drafts.items()):
        # 只有 OSM、沒有 Wikidata 項目的點大多是遊樂設施、動物舍、店家等（分數也都是 0）；
        # 攻略種子例外
        if not d.ent:
            if not d.tier or name_excluded(d.name_ja):
                dropped.append(d.name_ja or key)
                del drafts[key]
            continue
        if f"wd-{d.ent.qid}" in manual:
            dropped.append(d.name_ja or key)
            del drafts[key]
            continue
        kinds = {labels.get(q, "") for q in d.ent.instance_of} - {""}
        admin = bool(kinds & ADMIN_P31)
        other = bool(kinds & EXCLUDE_P31_EXACT) or any(
            sub in k for k in kinds for sub in EXCLUDE_P31_SUBSTR
        )
        if admin or other or name_excluded(d.name_ja):
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
    (re.compile(r"(商店街|横丁|通り)$"), "街區"),
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
        f"| 缺假名（待 LLM 補） | {len(no_kana)} |",
        f"| 沒有照片 | {len(no_image)} |",
        f"| 1.5 km 內沒有車站 | {len(no_station)} |",
        "",
        "精選：" + "、".join(f"{s['name']['ja']}（{s['score']:.0f}）" for s in featured),
        "",
    ]
    if unmatched:
        lines += ["對不上的種子景點（需人工確認）：" + "、".join(unmatched), ""]
    return "\n".join(lines)
