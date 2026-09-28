"""維基百科：景點簡介與假名念法（使用者決策：內容一律來自實際來源，不用 LLM 產生）。

- 簡介：中文維基開頭段落（轉繁體）；沒有中文條目時用日文維基。保留來源網址、授權、取得時間。
- 念法：日文維基開頭「名稱（よみがな）」括號內的讀音；Wikidata／OSM 已有念法時不覆蓋。
- 條目由景點的 Wikidata sitelinks 對應，不以名稱搜尋，避免對錯條目。
"""

from __future__ import annotations

import datetime as dt
import json
import re
import unicodedata
from typing import Any
from urllib.parse import quote

from opencc import OpenCC

from pipeline.kana import is_kana, normalize_kana, romaji_with_spacing
from pipeline.major import log
from pipeline.models import Spot
from pipeline.paths import SPOTS_DIR
from pipeline.sources import wikidata, wikipedia

LICENSE = "CC BY-SA 4.0"
# 中文維基的 API 轉換不一定套用到內文：一律再做一次簡→繁（臺灣字形）字元轉換，不改用語
_TO_TW = OpenCC("s2tw")
SUMMARY_MAX = 220

# 「名稱（よみ、英語: …）」「名稱 (よみ)」：取開頭括號，括號前不能太長（避免抓到內文的括號）
_LEAD_PAREN = re.compile(r"^([^（(。\n]{1,40})[（(]([^）)]{1,120})[）)]")
# 中文維基開頭常見「（日語：…／…，羅馬化：…）」：與卡片上的名稱、念法重複，刪去
_ZH_JA_NOTE = re.compile(r"[（(](?:日語|日文|日本語|日语)[:：]")
_SENTENCE_END = re.compile(r"(?<=。)")


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"\s*[（(][^）)]*[）)]\s*$", "", s)  # 消歧義括號
    return re.sub(r"[\s・]", "", s)


def reading_from_lead(text: str, name: str | None = None) -> str | None:
    """日文維基開頭括號裡的讀音；括號內有多段（、；）時取第一段是假名的。

    name：括號前的詞必須就是這個名稱（條目可能是上位概念，例如「元離宮二条城」對到「二条城」），
    不一致就不用，避免念法少一截。
    """
    m = _LEAD_PAREN.match(text.strip())
    if not m:
        return None
    if name is not None and _norm(m.group(1)) != _norm(name):
        return None
    for part in re.split(r"[、，,；;／/]", m.group(2)):
        part = part.strip().replace(" ", "").replace("　", "")
        if part and is_kana(part):
            return normalize_kana(part)
    return None


def strip_ja_note(text: str) -> str:
    """刪去中文維基開頭的日語名稱註記（含巢狀括號），其餘文字不動。"""
    m = _ZH_JA_NOTE.search(text[:80])
    if not m:
        return text
    depth = 0
    for i in range(m.start(), len(text)):
        if text[i] in "（(":
            depth += 1
        elif text[i] in "）)":
            depth -= 1
            if depth == 0:
                return text[: m.start()] + text[i + 1 :]
    return text


def first_paragraph(text: str, limit: int = SUMMARY_MAX) -> str:
    """開頭第一段；超過長度時在句號處截斷（不在句中截斷，找不到句號就整段不用）。"""
    para = next((p.strip() for p in text.split("\n") if p.strip()), "")
    if len(para) <= limit:
        return para
    out = ""
    for sentence in _SENTENCE_END.split(para):
        if len(out) + len(sentence) > limit:
            break
        out += sentence
    return out.strip()


def page_url(site: str, title: str) -> str:
    lang = wikipedia.SITES[site]
    return f"https://{lang}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"


def apply_wiki(spots: list[dict[str, Any]], today: str) -> dict[str, int]:
    """就地更新 spots（大點）的 summary 與缺漏的念法；回傳統計。"""
    majors = [
        s for s in spots if s["kind"] == "major" and s.get("external_ids", {}).get("wikidata")
    ]
    qids = [s["external_ids"]["wikidata"] for s in majors]
    ents = wikidata.entities(qids) if qids else {}
    titles: dict[str, list[str]] = {"zhwiki": [], "jawiki": []}
    for e in ents.values():
        for site in titles:
            if e.sitelinks.get(site):
                titles[site].append(e.sitelinks[site])
    log(f"  維基條目：中文 {len(titles['zhwiki'])}、日文 {len(titles['jawiki'])}")
    extracts = {site: wikipedia.intro_extracts(site, t) if t else {} for site, t in titles.items()}

    stats = {"summary_zh": 0, "summary_ja": 0, "kana": 0}
    for s in majors:
        ent = ents.get(s["external_ids"]["wikidata"])
        if not ent:
            continue
        # 簡介：中文優先，沒有就日文
        for site, lang in (("zhwiki", "zh"), ("jawiki", "ja")):
            title = ent.sitelinks.get(site)
            text = first_paragraph(extracts[site].get(title, "")) if title else ""
            if lang == "zh":
                text = _TO_TW.convert(strip_ja_note(text))
            if not text:
                continue
            url = page_url(site, title)
            prev = s.get("summary") or {}
            s["summary"] = {
                "text": text,
                "lang": lang,
                "source_url": url,
                "license": LICENSE,
                "fetched_at": prev.get("fetched_at", today) if prev.get("text") == text else today,
            }
            stats[f"summary_{lang}"] += 1
            break
        # 念法：只補缺漏的（之前由維基補的每次重算，規則修正時才會更新）
        ja_title = ent.sitelinks.get("jawiki")
        if s.get("kana_source") == "wikipedia":
            s["name"].pop("kana", None)
            s["name"].pop("romaji", None)
            s.pop("kana_source", None)
        if not s["name"].get("kana") and ja_title:
            kana = reading_from_lead(extracts["jawiki"].get(ja_title, ""), s["name"]["ja"])
            if kana:
                s["name"]["kana"] = kana
                s["name"]["romaji"] = s["name"].get("romaji") or romaji_with_spacing(
                    kana, s["name"].get("en")
                )
                s["kana_source"] = "wikipedia"
                url = page_url("jawiki", ja_title)
                if url not in {x["url"] for x in s.get("sources", [])}:
                    s.setdefault("sources", []).append({"url": url, "fetched_at": today})
                stats["kana"] += 1
    return stats


def seed_wiki(pref: str) -> str:
    today = dt.date.today().isoformat()
    path = SPOTS_DIR / f"{pref}.json"
    spots = json.loads(path.read_text(encoding="utf-8"))
    stats = apply_wiki(spots, today)
    out = [Spot.model_validate(s).model_dump(mode="json", exclude_none=True) for s in spots]
    out.sort(key=lambda s: s["id"])
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    majors = [s for s in out if s["kind"] == "major"]
    with_kana = sum(1 for s in majors if s["name"].get("kana"))
    with_summary = sum(1 for s in majors if s.get("summary"))
    return (
        f"## {pref}（維基百科）\n"
        f"- 簡介：中文 {stats['summary_zh']}、日文 {stats['summary_ja']}；"
        f"有簡介 {with_summary}/{len(majors)}\n"
        f"- 念法：這次補 {stats['kana']}；有念法 {with_kana}/{len(majors)}\n"
    )
