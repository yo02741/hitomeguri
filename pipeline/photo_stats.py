"""照片來源統計（只統計、不改資料）：主照片有沒有別的來源可以換、現在的照片拍的是不是別的東西。

主照片目前只取 Wikidata P18 的第一張。這裡另外看：
- Wikidata P18 的其他張、夜景（P3451）、冬景（P5252）、全景（P4291）、空拍（P8592）
- 日、英、中維基百科條目的代表圖（pageimages，只算自由授權）
- 每張照片在 Commons 的分類：分類顯示主體是人、警察、活動、店家、食物、車輛、招牌、室內、
  地圖、老照片的，算「可能不適合」（景點本身就是那類東西時不算，例：老舖就是店）
輸出 Markdown 報告與 JSON 明細（reports/photo-stats.*），不改 data/。
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from pipeline.http import get_json
from pipeline.paths import SPOTS_DIR
from pipeline.sources import commons, wikidata, wikipedia

VIEW_PROPS = {"P3451": "夜景", "P5252": "冬景", "P4291": "全景", "P8592": "空拍"}
WIKI_SITES = ("jawiki", "enwiki", "zhwiki")

# 照片自己的分類 → 主體不是景點（分類名比對；景點名稱裡有同一個字時不算）
SUBJECT = {
    "人物": r"\b(people|persons?|men|women|children|girls?|boys?|portraits?|selfies?"
    r"|crowds?|tourists)\b",
    "警察": r"\b(police|officers?)\b",
    "活動": r"\b(halloween|parades?|protests?|demonstrations?|ceremon(y|ies)|concerts?"
    r"|events? in)\b",
    "店家": r"\b(shops?|stores?|bakeries|bakery|restaurants?|cafes?|caf[eé]s?|izakaya|bars?)\b",
    "食物": r"\b(food|dishes|cuisine|ramen|sushi|menus?|desserts?|sweets)\b",
    "車輛": r"\b(buses|bus|trains?|cars?|taxis?|trucks?|vehicles?|rolling stock)\b",
    "招牌": r"\b(signs?|signboards?|billboards?|posters?|advertisements?)\b",
    "室內": r"\b(interiors?)\b",
    "地圖": r"\b(maps?|diagrams?|plans?|logos?)\b",
    "老照片": r"\b(1[89]\d0s photographs|meiji|taish[oō]|photographs from the 19th century)\b",
}
SUBJECT_RE = {k: re.compile(v, re.I) for k, v in SUBJECT.items()}


@dataclass
class SpotPhotos:
    id: str
    pref: str
    name: str
    en: str
    main: str | None
    p18: list[str] = field(default_factory=list)
    views: dict[str, list[str]] = field(default_factory=dict)
    wiki: dict[str, str] = field(default_factory=dict)
    cats: dict[str, list[str]] = field(default_factory=dict)  # 檔名 → 分類


def file_of(url: str) -> str | None:
    return unquote(url.rsplit("File:", 1)[-1]).replace("_", " ") if "File:" in url else None


def norm(name: str) -> str:
    return name.removeprefix("File:").replace("_", " ").strip()


def subject_flags(cats: list[str], own: str) -> list[str]:
    """照片分類顯示的主體（景點自己的名稱裡出現的字不算：老舖的「店」、看板的 sign）"""
    own_l = own.lower()
    out = []
    for key, rx in SUBJECT_RE.items():
        hits = [c for c in cats if (m := rx.search(c)) and m.group(0).lower() not in own_l]
        if hits:
            out.append(key)
    return out


# 景點本身就是那類東西時，那個原因不算
# （纜車、觀光列車拍到車；美術館、教會拍室內；商店街拍到店家與招牌）
EXEMPT = {
    "車輛": re.compile(
        r"ケーブル|ロープウェ|鉄道|電鉄|線$|号$|物語|サーキット|スピードウェイ|駅"
        r"|cable|ropeway|railway|line$|circuit|speedway|station",
        re.I,
    ),
    "室內": re.compile(r"博物館|美術館|教会|ホール|館$|museum|church|hall", re.I),
    "店家": re.compile(r"購物|市場|街區|商店街|横丁|通り?$|村$|market|street|arcade", re.I),
    "招牌": re.compile(r"購物|市場|街區|商店街|横丁|通り?$|交差点|market|street|crossing", re.I),
    "活動": re.compile(r"スタジアム|球場|stadium|arena", re.I),
}


def exempt(flags: list[str], name: str, en: str, tags: list[str]) -> list[str]:
    text = " ".join([name, en, *tags])
    return [f for f in flags if not (f in EXEMPT and EXEMPT[f].search(text))]


def verdict(sp: SpotPhotos) -> dict[str, Any]:
    """每個景點的判讀：主照片有沒有問題、各來源有沒有別張、來源之間同不同意。"""
    own = f"{sp.name} {sp.en}"
    main = sp.main
    wiki_files = {norm(v) for v in sp.wiki.values()}
    others = list(dict.fromkeys(sp.p18[1:] + sorted(wiki_files - {main} if main else wiki_files)))
    flags = subject_flags(sp.cats.get(main, []), own) if main else []
    # 兩個以上的維基條目選了同一張、而且不是現在的主照片
    counts = Counter(norm(v) for v in sp.wiki.values())
    agreed = [f for f, n in counts.items() if n >= 2 and f != main]
    return {
        "id": sp.id,
        "pref": sp.pref,
        "name": sp.name,
        "main": main,
        "main_flags": flags,
        "main_in_wiki": bool(main and main in wiki_files),
        "alt_count": len(others),
        "alts": others[:5],
        "alt_flags": {f: subject_flags(sp.cats.get(f, []), own) for f in others[:5]},
        "wiki_agree_other": agreed[:1],
        "views": {VIEW_PROPS[k]: v[:1] for k, v in sp.views.items() if v},
    }


def load_spots(prefs: list[str]) -> list[SpotPhotos]:
    out = []
    for pref in prefs:
        path = SPOTS_DIR / f"{pref}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for s in data["spots"] if isinstance(data, dict) else data:
            qid = (s.get("external_ids") or {}).get("wikidata")
            if not qid:
                continue
            imgs = s.get("images") or []
            out.append(
                SpotPhotos(
                    id=qid,
                    pref=pref,
                    name=s["name"]["ja"],
                    en=s["name"].get("en") or "",
                    main=file_of(imgs[0].get("source_url", "")) if imgs else None,
                )
            )
    return out


def fetch_claims(spots: list[SpotPhotos]) -> None:
    by = {s.id: s for s in spots}
    ids = list(by)
    for i in range(0, len(ids), 50):
        data = get_json(
            wikidata.API,
            params={
                "action": "wbgetentities",
                "ids": "|".join(ids[i : i + 50]),
                "props": "claims|sitelinks",
                "format": "json",
            },
            min_interval=0.5,
        )
        for qid, e in data.get("entities", {}).items():
            sp = by.get(qid)
            if not sp or "missing" in e:
                continue
            claims = e.get("claims", {})
            sp.p18 = [norm(v) for v in wikidata._claim_values(claims, "P18")]
            sp.views = {p: [norm(v) for v in wikidata._claim_values(claims, p)] for p in VIEW_PROPS}
            for site in WIKI_SITES:
                if t := e.get("sitelinks", {}).get(site, {}).get("title"):
                    sp.wiki[site] = t  # 先放標題，下面換成代表圖


def fetch_wiki_images(spots: list[SpotPhotos]) -> None:
    for site in WIKI_SITES:
        titles = [s.wiki[site] for s in spots if site in s.wiki]
        imgs = wikipedia.page_images(site, titles) if titles else {}
        for s in spots:
            if site in s.wiki:
                if name := imgs.get(s.wiki[site]):
                    s.wiki[site] = name
                else:
                    del s.wiki[site]


def fetch_categories(files: list[str]) -> dict[str, list[str]]:
    """檔案 → 非隱藏分類（不含 Category: 前綴）"""
    out: dict[str, list[str]] = {}
    uniq = list(dict.fromkeys(files))
    for i in range(0, len(uniq), 50):
        params: dict[str, Any] = {
            "action": "query",
            "prop": "categories",
            "clshow": "!hidden",
            "cllimit": "max",
            "titles": "|".join(f"File:{f}" for f in uniq[i : i + 50]),
            "format": "json",
        }
        while True:
            data = get_json(commons.API, params=params, min_interval=0.5)
            q = data.get("query", {})
            back = {n["to"]: n["from"] for n in q.get("normalized", [])}
            for page in q.get("pages", {}).values():
                name = norm(back.get(page["title"], page["title"]))
                cats = [c["title"].removeprefix("Category:") for c in page.get("categories", [])]
                out.setdefault(name, []).extend(cats)
            if "continue" not in data:
                break
            params = {**params, **data["continue"]}
    return out


def summarize(rows: list[dict[str, Any]], n_all: int, n_missing_qid: int) -> str:
    with_main = [r for r in rows if r["main"]]
    no_main = [r for r in rows if not r["main"]]
    flagged = [r for r in with_main if r["main_flags"]]
    flag_count = Counter(f for r in flagged for f in r["main_flags"])
    fillable = [r for r in no_main if r["alt_count"]]
    has_alt = [r for r in with_main if r["alt_count"]]
    flagged_with_alt = [r for r in flagged if r["alt_count"]]
    agree_other = [r for r in with_main if r["wiki_agree_other"]]
    views = Counter(k for r in rows for k in r["views"])

    def link(f: str) -> str:
        return f"[{f[:60]}](https://commons.wikimedia.org/wiki/File:{f.replace(' ', '_')})"

    lines = [
        "## 照片來源統計（只統計，沒有改資料）",
        "",
        "| 項目 | 景點數 |",
        "|---|---|",
        f"| 全部景點 | {n_all} |",
        f"| 有 Wikidata 項目（能查） | {len(rows)} |",
        f"| 沒有 Wikidata 項目（查不到） | {n_missing_qid} |",
        f"| 有主照片 | {len(with_main)} |",
        f"| 主照片也是維基條目的代表圖 | {sum(r['main_in_wiki'] for r in with_main)} |",
        f"| 主照片有別張可換（P18 其他張或維基條目代表圖） | {len(has_alt)} |",
        f"| 兩個以上維基條目選了同一張、跟主照片不同 | {len(agree_other)} |",
        f"| 主照片的分類顯示主體可能不是景點 | {len(flagged)} |",
        f"| └ 其中有別張可換 | {len(flagged_with_alt)} |",
        f"| 沒有主照片 | {len(no_main)} |",
        f"| └ 其中找得到照片 | {len(fillable)} |",
        "",
        "Wikidata 的專用照片欄位："
        + ("、".join(f"{k} {v}" for k, v in views.most_common()) or "無"),
        "",
        "主照片可能不適合的原因（一張可能有多個）："
        + "、".join(f"{k} {v}" for k, v in flag_count.most_common()),
        "",
        "### 主照片可能不適合（前 40 筆）",
        "",
        "| 景點 | 縣 | 原因 | 主照片 | 別張 |",
        "|---|---|---|---|---|",
    ]
    for r in sorted(flagged, key=lambda r: (-r["alt_count"], r["pref"]))[:40]:
        alt = link(r["alts"][0]) if r["alts"] else "—"
        why = "、".join(r["main_flags"])
        lines.append(f"| {r['name']} | {r['pref']} | {why} | {link(r['main'])} | {alt} |")
    lines += ["", "### 兩個維基條目都選了別張（前 30 筆）", ""]
    lines += ["| 景點 | 主照片 | 條目選的 |", "|---|---|---|"]
    for r in agree_other[:30]:
        lines.append(f"| {r['name']} | {link(r['main'])} | {link(r['wiki_agree_other'][0])} |")
    return "\n".join(lines) + "\n"


def photo_stats(prefs: list[str], out_dir: Path) -> str:
    n_all = 0
    for pref in prefs:
        data = json.loads((SPOTS_DIR / f"{pref}.json").read_text(encoding="utf-8"))
        n_all += len(data["spots"] if isinstance(data, dict) else data)
    spots = load_spots(prefs)
    fetch_claims(spots)
    fetch_wiki_images(spots)
    files = [f for s in spots for f in [s.main, *s.p18, *s.wiki.values()] if f]
    cats = fetch_categories([norm(f) for f in files])
    for s in spots:
        s.cats = {f: cats.get(norm(f), []) for f in {s.main, *s.p18, *s.wiki.values()} if f}
    rows = [verdict(s) for s in spots]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "photo-stats.json").write_text(
        json.dumps(sorted(rows, key=lambda r: r["id"]), ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    report = summarize(rows, n_all, n_all - len(spots))
    (out_dir / "photo-stats.md").write_text(report, encoding="utf-8")
    return report
