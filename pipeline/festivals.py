"""深度探索「祭典」：seed-festivals 指令。

來源：日文維基百科分類「{縣}の祭り」（含一層子分類）的條目，經 Wikidata 取名稱、念法、座標與照片；
簡介取維基百科開頭段落（中文優先）。舉行月份依序取：
1. Wikidata P837（day in year for periodic occurrence）／P2922（month of the year）的標籤「○月…」
2. 日文維基開頭段落的「毎年○月」「○月に行われる」等（舊曆的不取）
都沒有就不寫月份。不用 LLM 補內容。
"""

from __future__ import annotations

import datetime as dt
import json
import re
import unicodedata
from typing import Any

from pipeline.kana import is_kana, normalize_kana, romaji_with_spacing
from pipeline.major import excluded_ids, log, pref_full_name, strip_disambiguation
from pipeline.models import Festival, Image, LocalizedName, Location, Source, Summary
from pipeline.paths import FESTIVALS_DIR
from pipeline.sources import commons, pageviews, wikidata, wikipedia

CATEGORY = "{name}の祭り"
# 每縣最多收幾個（依日文維基瀏覽量）
MAX_PER_PREF = 60

# P31 標籤含這些字才算祭典（分類裡混有山車、神社、人物、團體）
FESTIVAL_P31 = (
    "祭", "まつり", "行事", "神事", "祭礼", "盆踊", "踊り", "花火", "イベント", "催し",
    "festival", "event", "ritual", "ceremony", "celebration", "parade", "fireworks", "dance",
)  # fmt: skip
NOT_FESTIVAL_P31 = (
    "山車", "鉾", "神輿", "神社", "寺", "人", "団体", "組織", "会社", "楽曲", "歌", "書籍",
    "施設", "建造物", "公園", "shrine", "temple", "human", "organization", "company", "song",
    "building", "float",
)  # fmt: skip
# 沒有 P31 的條目看名稱結尾
FESTIVAL_NAME_RE = re.compile(
    r"(祭|まつり|祭り|花火大会|踊り|踊|神事|くんち|山笠|七夕|ねぶた|ねぷた|竿燈|行列|会式|フェスティバル)$"
)

# 「毎年8月」「例年7月下旬」「8月3日から6日にかけて行われる」；舊曆（旧暦・陰暦）的月份不取
_MONTH_PATTERNS = [
    re.compile(
        r"(?<!旧暦)(?<!陰暦)(?:毎年|例年)(?:[^。]{0,12}?)(?<!旧暦)(?<!陰暦)(?<!\d)(\d{1,2})月"
    ),
    re.compile(
        r"(?<!旧暦)(?<!陰暦)(?<!\d)(\d{1,2})月[^。]{0,24}?"
        r"(?:行われ|開催され|催され|実施され|開かれ)"
    ),
    # 「4月下旬から5月上旬まで」
    re.compile(r"(?<!旧暦)(?<!陰暦)(?<!\d)(\d{1,2})月(?:上旬|中旬|下旬|初旬|末)"),
]
_MONTH_LABEL = re.compile(r"^(\d{1,2})月")


def is_festival(title: str, p31_labels: list[str]) -> bool:
    # 一覧、「京都三大祭り」這類總論條目
    if "一覧" in title or "三大" in title:
        return False
    labels = [lab.lower() for lab in p31_labels if lab]
    if any(w in lab for lab in labels for w in NOT_FESTIVAL_P31):
        return False
    if any(w in lab for lab in labels for w in FESTIVAL_P31):
        return True
    return not labels and bool(FESTIVAL_NAME_RE.search(strip_disambiguation(title)))


def months_from_labels(labels: list[str]) -> list[int]:
    out = set()
    for lab in labels:
        m = _MONTH_LABEL.match(unicodedata.normalize("NFKC", lab))
        if m and 1 <= int(m.group(1)) <= 12:
            out.add(int(m.group(1)))
    return sorted(out)


def months_from_text(text: str) -> list[int]:
    """日文維基開頭的舉行月份（最多 3 個）。"""
    text = unicodedata.normalize("NFKC", text)
    for pat in _MONTH_PATTERNS:
        found = [int(m) for m in pat.findall(text) if 1 <= int(m) <= 12]
        if found:
            return sorted(set(found))[:3]
    return []


def location_of(ent: wikidata.Entity, places: dict[str, wikidata.Entity]) -> Location | None:
    """活動本身的座標（P625），沒有則用第一個舉行地點（P276）的座標。"""
    for e in [ent, *(places[q] for q in ent.location_items[:1] if q in places)]:
        if e.lat is not None and e.lng is not None:
            return Location(lat=e.lat, lng=e.lng)
    return None


def _summary(
    ent: wikidata.Entity, extracts: dict[str, dict[str, str]], today: str
) -> Summary | None:
    from pipeline.wiki import _TO_TW, LICENSE, first_paragraph, page_url, strip_ja_note

    for site, lang in (("zhwiki", "zh"), ("jawiki", "ja")):
        title = ent.sitelinks.get(site)
        text = first_paragraph(extracts[site].get(title, "")) if title else ""
        if lang == "zh":
            text = _TO_TW.convert(strip_ja_note(text))
        if text:
            return Summary(
                text=text,
                lang=lang,
                source_url=page_url(site, title or ""),
                license=LICENSE,
                fetched_at=today,
            )
    return None


def seed_festivals(prefs: list[str]) -> str:
    from pipeline.wiki import _TO_TW, page_url, reading_from_lead

    today = dt.date.today().isoformat()
    manual = excluded_ids()
    lines = ["## 祭典", "", "| 縣 | 分類條目 | 收錄 | 有月份 |", "|---|---|---|---|"]
    details: list[str] = []
    FESTIVALS_DIR.mkdir(parents=True, exist_ok=True)
    for pref in prefs:
        titles = wikipedia.category_members("jawiki", CATEGORY.format(name=pref_full_name(pref)), 1)
        qids = wikipedia.wikidata_ids("jawiki", titles) if titles else {}
        ents = wikidata.entities(sorted(set(qids.values()))) if qids else {}
        p31 = wikidata.labels_ja(sorted({q for e in ents.values() for q in e.instance_of}))
        cands = []
        for t in titles:
            ent = ents.get(qids.get(t, ""))
            if ent and is_festival(t, [p31.get(q, "") for q in ent.instance_of]):
                cands.append((t, ent))
        # 同一項目（重新導向）只留一次
        cands = list({e.qid: (t, e) for t, e in cands}.values())
        views = {t: pageviews.yearly_views("jawiki", t) for t, _ in cands}
        cands.sort(key=lambda te: -views[te[0]])
        cands = [te for te in cands if f"{pref}-{te[1].qid}" not in manual][:MAX_PER_PREF]

        ents_kept = [e for _, e in cands]
        occurs = wikidata.labels_ja(sorted({q for e in ents_kept for q in e.occurs}))
        extracts = {
            s: wikipedia.intro_extracts(
                s, [e.sitelinks[s] for e in ents_kept if e.sitelinks.get(s)]
            )
            for s in ("zhwiki", "jawiki")
        }
        images = commons.image_info([e.image for e in ents_kept if e.image])
        # 沒有座標的用舉行地點（P276，例：神社）的座標
        places = wikidata.entities(
            sorted({q for e in ents_kept if e.lat is None for q in e.location_items[:1]})
        )

        items: list[dict[str, Any]] = []
        for title, ent in cands:
            labels = ent.labels
            ja = strip_disambiguation(labels.get("ja") or title)
            lead = extracts["jawiki"].get(ent.sitelinks.get("jawiki", ""), "")
            months = months_from_labels([occurs.get(q, "") for q in ent.occurs])
            months_source = "wikidata" if months else None
            if not months:
                months = months_from_text(lead)
                months_source = "wikipedia" if months else None
            kana, kana_source = None, None
            if is_kana(ja):
                kana = normalize_kana(ja)
            else:
                kana = next((normalize_kana(k) for k in ent.kana_all if is_kana(k)), None)
                kana_source = "wikidata" if kana else None
                if not kana and lead:
                    kana = reading_from_lead(lead, ja)
                    kana_source = "wikipedia" if kana else None
            zh = labels.get("zh-tw") or labels.get("zh-hant")
            zh = strip_disambiguation(
                zh or (_TO_TW.convert(labels["zh"]) if labels.get("zh") else ja)
            )
            summary = _summary(ent, extracts, today)
            sources = [Source(url=page_url("jawiki", title), fetched_at=today)]
            sources.append(Source(url=ent.url, fetched_at=today))
            img = []
            if ent.image and ent.image in images:
                i = images[ent.image]
                img = [
                    Image(url=i.url, author=i.author, license=i.license, source_url=i.source_url)
                ]
            fest = Festival(
                id=f"{pref}-{ent.qid}",
                name=LocalizedName(
                    ja=ja,
                    kana=kana,
                    romaji=romaji_with_spacing(kana, labels.get("en")) if kana else None,
                    zh_tw=zh,
                    en=labels.get("en"),
                ),
                prefecture=pref,
                months=months,
                months_source=months_source,
                location=location_of(ent, places),
                summary=summary,
                kana_source=kana_source,
                images=img,
                sources=sources,
                views=views[title],
                updated_at=today,
            )
            items.append(fest.model_dump(mode="json", exclude_none=True))
        items.sort(key=lambda f: f["id"])
        path = FESTIVALS_DIR / f"{pref}.json"
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        with_month = sum(1 for f in items if f.get("months"))
        lines.append(f"| {pref} | {len(titles)} | {len(items)} | {with_month} |")
        log(f"[{pref}] 祭典 {len(items)}（有月份 {with_month}）")
        # 報告：依瀏覽量列出（月份），方便抽查
        named = [
            f"{f['name']['ja']}（{'・'.join(map(str, f.get('months', []))) or '—'}）"
            for f in sorted(items, key=lambda f: -f["views"])
        ]
        details.append(f"- {pref}：{'、'.join(named)}")
    return "\n".join(lines + ["", *details]) + "\n"
