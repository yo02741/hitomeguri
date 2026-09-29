"""地區特色（PLAN.md §5.3）：seed-specialties 指令。

來源（全部是實際網站，不用 LLM 產生內容）：
- 農林水產省「うちの郷土料理」：各縣郷土料理（pipeline/sources/maff.py）
- 日文維基百科分類：ご当地ラーメン（特色拉麵）、名古屋めし、{縣}の郷土料理
- 攻略種子清單（已對齊 Wikidata 的）
每一項盡量對到 Wikidata／維基條目，取中文名、念法、照片與維基百科簡介（中文優先，沒有則日文）。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from typing import Any

from pipeline import geo
from pipeline.kana import is_kana, normalize_kana, romaji_with_spacing
from pipeline.major import (
    PrefResolver,
    excluded_ids,
    log,
    name_variants,
    norm_name,
    pref_full_name,
    strip_disambiguation,
)
from pipeline.models import Image, LocalizedName, Source, Specialty
from pipeline.paths import SEED_DIR, SPECIALTIES_DIR
from pipeline.sources import maff, wikidata, wikipedia

CATEGORY_ALIASES = {"food": "food", "drink": "drink", "craft": "craft", "fruit": "fruit"}

# 維基分類 → 類別；{name} 換成縣的全名（例：愛知県）
WIKI_CATEGORIES: list[tuple[str, str | None, str]] = [
    # (分類, 固定的縣（None 表示由項目本身判斷）, 類別提示)
    ("ご当地ラーメン", None, "ramen"),
    ("名古屋めし", "aichi", "food"),
]
PREF_WIKI_CATEGORIES = ["{name}の郷土料理"]

# Wikidata P31 的標籤（沒有日文時是英文）含這些字才算食物（分類裡混有公司、店家、歌曲）
FOOD_P31 = (
    "料理", "食品", "食べ物", "食物", "菓子", "麺", "丼", "鍋", "寿司", "飲料", "飲み物",
    "茶", "酒", "焼", "漬", "餅", "うどん", "そば", "ラーメン", "パン", "調味料", "味噌",
    "スープ", "汁", "揚げ物", "ご飯", "米", "牛", "肉", "果物", "野菜",
    "dish", "food", "cuisine", "noodle", "soup", "sushi", "confection", "dessert", "sweet",
    "snack", "beverage", "drink", "tea", "sake", "wine", "beer", "liquor", "shōchū", "beef",
    "pork", "meat", "fruit", "vegetable", "rice", "bread", "pickle", "seasoning", "condiment",
    "ramen", "udon", "soba", "wagashi", "mochi", "cake",
)  # fmt: skip
# 這些優先判斷為「不是食物」（喫茶店的「茶」、ラーメン店）
NOT_FOOD_P31 = (
    "店", "企業", "会社", "チェーン", "楽曲", "歌", "アルバム", "番組", "書籍", "漫画",
    "キャラクター", "イベント", "インスタント", "商品", "restaurant", "company", "business",
    "song", "album", "television", "book", "manga", "character", "event", "instant", "product",
)  # fmt: skip
SWEETS_WORDS = (
    "まんじゅう",
    "饅頭",
    "餅",
    "もち",
    "団子",
    "だんご",
    "羊羹",
    "ようかん",
    "菓子",
    "せんべい",
    "おこし",
)
SAKE_WORDS = ("酒", "焼酎", "泡盛", "ビール", "ワイン")


def log_pref(pref: str, msg: str) -> None:
    log(f"[{pref}] {msg}")


@dataclass
class Draft:
    """一項地區特色的候選（合併同縣同名的郷土料理、維基條目）。"""

    prefecture: str
    name: str
    category: str
    maff: maff.Dish | None = None
    qid: str | None = None
    ent: wikidata.Entity | None = None
    aliases: list[str] = field(default_factory=list)
    source: str = "kyodo_ryori"


def is_food(p31_labels: list[str]) -> bool:
    labels = [lab.lower() for lab in p31_labels if lab]
    if any(w in lab for lab in labels for w in NOT_FOOD_P31):
        return False
    return any(w in lab for lab in labels for w in FOOD_P31)


def is_overview(title: str, category: str) -> bool:
    """分類的主條目、總論條目（「名古屋めし」「北海道のラーメン」「ラーメン」）不算一項特色。"""
    t = strip_disambiguation(title)
    return t == category or t == "ラーメン" or t.endswith("のラーメン")


def category_for(name: str, p31_labels: list[str], hint: str) -> str:
    """類別：分類提示優先（拉麵）；其次看 P31 與名稱。"""
    if hint == "ramen" or "ラーメン" in name or any("ラーメン" in x for x in p31_labels):
        return "ramen"
    text = name + " ".join(p31_labels)
    if any(w in text for w in SWEETS_WORDS):
        return "sweets"
    # 「宇治茶」這類茶葉；「茶ごめ」「奈良茶飯」是料理
    if name.endswith("茶") or any(x.endswith("茶") for x in p31_labels):
        return "tea"
    if any(w in text for w in SAKE_WORDS):
        return "sake"
    return hint if hint in ("food", "kyodo") else "food"


_PREF_NAME_RE: re.Pattern[str] | None = None


def pref_from_text(text: str) -> str | None:
    """維基開頭段落裡第一個出現的都道府縣名（「徳島県で…」「北海道札幌市」）。"""
    global _PREF_NAME_RE
    names = {pref_full_name(p): p for p in geo.pref_slugs()}
    if _PREF_NAME_RE is None:
        _PREF_NAME_RE = re.compile("|".join(sorted(map(re.escape, names), key=len, reverse=True)))
    m = _PREF_NAME_RE.search(text[:200])
    return names.get(m.group(0)) if m else None


def _match(
    name_ja: str, p31_cache: dict[str, str], require_food: bool = True
) -> wikidata.Entity | None:
    """名稱搜尋 Wikidata：候選裡第一個名稱相符（且 P31 是食物）的項目。"""
    for v in name_variants(name_ja):
        qids = wikidata.search(v)
        if not qids:
            continue
        ents = wikidata.entities(qids)
        need = sorted({q for e in ents.values() for q in e.instance_of} - set(p31_cache))
        if need:
            p31_cache.update(wikidata.labels_ja(need))
        for q in qids:
            e = ents.get(q)
            label = norm_name(e.labels.get("ja", "")) if e else ""
            if not (e and label and (label == v or v in label or label in v)):
                continue
            if is_overview(e.labels.get("ja", ""), ""):
                continue
            if require_food and not is_food([p31_cache.get(x, "") for x in e.instance_of]):
                continue
            return e
    return None


def wiki_drafts(prefs: list[str]) -> list[Draft]:
    """維基分類裡的項目：拉麵、名古屋めし、各縣郷土料理。縣由分類、P131 或開頭段落判斷。"""
    hints: dict[str, tuple[str | None, str]] = {}
    for cat, fixed, hint in WIKI_CATEGORIES:
        if fixed and fixed not in prefs:
            continue
        for t in wikipedia.category_members("jawiki", cat, depth=1):
            if is_overview(t, cat):
                continue
            prev = hints.get(t)
            # 同一條目在多個分類：固定的縣（名古屋めし→愛知）與拉麵類別都保留
            hints[t] = (
                (prev[0] if prev else None) or fixed,
                "ramen" if hint == "ramen" or (prev and prev[1] == "ramen") else hint,
            )
    for p in prefs:
        for pat in PREF_WIKI_CATEGORIES:
            for t in wikipedia.category_members("jawiki", pat.format(name=pref_full_name(p)), 0):
                prev = hints.get(t)
                hints[t] = (p, prev[1] if prev else "food")
    log(f"維基分類：{len(hints)} 條")
    qids = wikipedia.wikidata_ids("jawiki", list(hints))
    ents = wikidata.entities(sorted(set(qids.values()))) if qids else {}
    p31 = wikidata.labels_ja(sorted({q for e in ents.values() for q in e.instance_of}))
    leads = wikipedia.intro_extracts("jawiki", list(hints)) if hints else {}
    resolver = PrefResolver()
    resolver.prefetch(list(ents.values()))

    out: list[Draft] = []
    for title, (fixed, hint) in hints.items():
        ent = ents.get(qids.get(title, ""))
        if not ent:
            continue
        labels = [p31.get(q, "") for q in ent.instance_of]
        # 分類裡混有店家、公司、歌曲：P31 是食物才收（沒有 P31 的拉麵條目看名稱）
        # 沒有 P31 的條目：名稱是麵類的拉麵、或列在固定縣的食文化分類（名古屋めし）裡的才收
        named_ramen = hint == "ramen" and re.search(r"(ラーメン|拉麺|そば|麺)$", title)
        untyped_ok = not ent.instance_of and (named_ramen or fixed)
        if not (is_food(labels) or untyped_ok):
            continue
        if is_overview(ent.labels.get("ja") or title, ""):
            continue
        pref = fixed or resolver.resolve(ent) or pref_from_text(leads.get(title, ""))
        if pref not in prefs:
            continue
        name = strip_disambiguation(ent.labels.get("ja") or title)
        cat = category_for(name, labels, hint)
        out.append(Draft(pref, name, cat, qid=ent.qid, ent=ent, source="wikipedia"))
    return out


def maff_drafts(prefs: list[str]) -> list[Draft]:
    out = []
    for p in prefs:
        dishes = maff.dishes(p)
        log_pref(p, f"郷土料理 {len(dishes)} 道")
        for d in dishes:
            out.append(
                Draft(p, d.name, category_for(d.name, [], "kyodo"), maff=d, aliases=d.aliases)
            )
    return out


def seed_drafts(prefs: list[str]) -> list[Draft]:
    seeds = json.loads((SEED_DIR / "seed_from_guides.json").read_text(encoding="utf-8"))
    out = []
    for s in seeds["specialties"]:
        if s["prefecture"] in prefs:
            cat = CATEGORY_ALIASES.get(s["category"], s["category"])
            out.append(Draft(s["prefecture"], s["name_ja"], cat, source="wikidata"))
    return out


def merge_drafts(drafts: list[Draft]) -> list[Draft]:
    """同縣同名（含別名）或同一個 Wikidata 項目的合併；郷土料理的名稱與來源優先保留。"""
    merged: list[Draft] = []
    by_key: dict[tuple[str, str], Draft] = {}
    for d in drafts:
        keys = [(d.prefecture, norm_name(n)) for n in [d.name, *d.aliases]]
        if d.qid:
            keys.append((d.prefecture, d.qid))
        target = next((by_key[k] for k in keys if k in by_key), None)
        if target is None:
            merged.append(d)
            target = d
        else:
            target.maff = target.maff or d.maff
            target.qid = target.qid or d.qid
            target.ent = target.ent or d.ent
            if d.category == "ramen":
                target.category = "ramen"
        for k in keys:
            by_key.setdefault(k, target)
        if target.qid:
            by_key.setdefault((target.prefecture, target.qid), target)
    return merged


def maff_summary(
    detail: maff.Detail | None, url: str | None, lang: str, today: str
) -> dict[str, str] | None:
    if not detail or not detail.summary or not url:
        return None
    return {
        "text": detail.summary,
        "lang": lang,
        "source_url": url,
        "license": maff.LICENSE,
        "fetched_at": today,
    }


def seed_specialties(prefs: list[str]) -> str:
    from pipeline.wiki import (
        lead_images,
        pick_summary,
        reading_from_lead,
        summary_extracts,
        zh_label,
    )

    today = dt.date.today().isoformat()
    # 人工排除清單（data/seed/exclude.json）也用在地區特色：id 為 {縣}-{QID}
    manual = excluded_ids()
    drafts = merge_drafts(maff_drafts(prefs) + wiki_drafts(prefs) + seed_drafts(prefs))

    # 還沒對到 Wikidata 的（郷土料理、攻略種子）用名稱搜尋
    unmatched = [d for d in drafts if not d.ent]
    log(f"Wikidata 名稱比對：{len(unmatched)} 項")
    p31_cache: dict[str, str] = {}
    for i, d in enumerate(unmatched):
        # 攻略種子有工藝品（常滑焼）：不要求是食物
        ent = _match(d.name, p31_cache, require_food=d.source != "wikidata")
        if ent:
            d.ent, d.qid = ent, ent.qid
        if (i + 1) % 100 == 0:
            log(f"  {i + 1}/{len(unmatched)}")
    # 對到同一項目的再合併一次
    drafts = merge_drafts(drafts)
    # 攻略種子對不上的不收（攻略是 AI 生成）
    dropped = [d.name for d in drafts if d.source == "wikidata" and not d.ent and not d.maff]
    drafts = [d for d in drafts if d.ent or d.maff]

    ents = [d.ent for d in drafts if d.ent]
    extracts = summary_extracts(ents)
    images = lead_images(ents)

    # 郷土料理：農林水產省料理頁的念法與介紹，以及英文版的英文名與介紹（PDL1.0，標示出處）
    maff_ja: dict[str, maff.Detail] = {}
    maff_en: dict[str, maff.Detail] = {}
    with_maff = [d for d in drafts if d.maff]
    log(f"農林水產省料理頁：{len(with_maff)} 道")
    for i, d in enumerate(with_maff):
        assert d.maff
        ja_detail = maff.detail(d.maff.url)
        if ja_detail:
            maff_ja[d.maff.id] = ja_detail
            if ja_detail.en_url:
                en_detail = maff.detail(ja_detail.en_url)
                if en_detail:
                    maff_en[d.maff.id] = en_detail
        if (i + 1) % 100 == 0:
            log(f"  {i + 1}/{len(with_maff)}")

    by_pref: dict[str, list[dict[str, Any]]] = {p: [] for p in prefs}
    for d in drafts:
        ent = d.ent
        labels = ent.labels if ent else {}
        ja = d.name
        kana, kana_source = None, None
        ja_detail = maff_ja.get(d.maff.id) if d.maff else None
        en_detail = maff_en.get(d.maff.id) if d.maff else None
        if is_kana(ja):
            kana = normalize_kana(ja)
        elif ja_detail and ja_detail.reading and is_kana(ja_detail.reading):
            kana = normalize_kana(ja_detail.reading)
            kana_source = "maff"
        elif ent:
            kana = next((normalize_kana(k) for k in ent.kana_all if is_kana(k)), None)
            kana_source = "wikidata" if kana else None
            ja_title = ent.sitelinks.get("jawiki")
            if not kana and ja_title:
                kana = reading_from_lead(extracts["jawiki"].get(ja_title, ""), ja)
                kana_source = "wikipedia" if kana else None
        zh = zh_label(labels, ja)
        summary = None
        sources: list[Source] = []
        if d.maff:
            sources.append(Source(url=d.maff.url, fetched_at=today))
        if en_detail and ja_detail and ja_detail.en_url:
            sources.append(Source(url=ja_detail.en_url, fetched_at=today))
        wiki_summary = pick_summary(ent, extracts, today) if ent else None
        if ent:
            sources.append(Source(url=ent.url, fetched_at=today))
        # 簡介：中文維基 → 農林水產省英文版 → 英文維基 → 農林水產省 → 日文維基（都是原文，不翻譯）
        maff_en_summary = maff_summary(
            en_detail, ja_detail.en_url if ja_detail else None, "en", today
        )
        maff_ja_summary = maff_summary(ja_detail, d.maff.url if d.maff else None, "ja", today)
        for cand in (
            wiki_summary if wiki_summary and wiki_summary["lang"] == "zh" else None,
            maff_en_summary,
            wiki_summary if wiki_summary and wiki_summary["lang"] == "en" else None,
            maff_ja_summary,
            wiki_summary,
        ):
            if cand:
                summary = cand
                break
        if summary and summary is wiki_summary:
            sources.append(Source(url=summary["source_url"], fetched_at=today))
        img = []
        if ent and ent.qid in images:
            i = images[ent.qid]
            img = [Image(url=i.url, author=i.author, license=i.license, source_url=i.source_url)]
        # 對到 Wikidata 的用 QID；只有郷土料理的用料理頁 id
        key = d.qid or (f"maff-{d.maff.id}" if d.maff else "")
        if f"{d.prefecture}-{key}" in manual:
            continue
        spec = Specialty(
            id=f"{d.prefecture}-{key}",
            name=LocalizedName(
                ja=ja,
                kana=kana,
                romaji=romaji_with_spacing(kana, labels.get("en")) if kana else None,
                zh_tw=zh,
                en=labels.get("en") or (en_detail.name if en_detail else None),
            ),
            kana_source=kana_source,
            prefecture=d.prefecture,
            category=d.category,
            summary=summary,
            source_type="kyodo_ryori" if d.maff else d.source,
            sources=sources,
            images=img,
            updated_at=today,
        )
        by_pref[d.prefecture].append(spec.model_dump(mode="json", exclude_none=True))

    SPECIALTIES_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["## 地區特色", "", "| 縣 | 筆數 | 拉麵 | 有維基條目 |", "|---|---|---|---|"]
    for pref, items in by_pref.items():
        items.sort(key=lambda s: s["id"])
        path = SPECIALTIES_DIR / f"{pref}.json"
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ramen = sum(1 for s in items if s["category"] == "ramen")
        wiki = sum(1 for s in items if s.get("summary"))
        lines.append(f"| {pref} | {len(items)} | {ramen} | {wiki} |")
    if dropped:
        lines += ["", "攻略種子對不上來源、未收錄：" + "、".join(dropped)]
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
