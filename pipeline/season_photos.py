"""收集卡的季節、夜景照片（DESIGN.md §7.19a）。

從景點的 Commons 分類（Wikidata P373）與「描繪這個景點」的檔案（Commons 結構化資料 P180）
找春夏秋冬與夜晚的照片。

候選：
1. 子分類名稱有季節字樣的（例：Kiyomizu-dera in autumn、Cherry blossoms at …）裡的檔案；
2. 主分類裡檔名有季節字樣的；
3. 標了「描繪：這個景點」的檔案，檔名或分類有季節字樣的。
只收拍得到景點的：要「描繪」標的是這個景點，或檔名有景點名稱
（只在「姬路城的櫻花」分類裡、檔名只寫 sakura 的不算）。
畫、版畫、明信片、館藏掃描、老照片不收；檔名像特寫、室內、看板、地圖、人潮的扣分；
Commons 的優質圖片（Quality images）、精選圖片（Featured pictures）加分。
JPEG、寬 1000px 以上、橫幅（寬高比 1.2–2.1）。分數最高的一張；沒有合格的就不放（寧缺勿濫）。
照片一律附作者、授權、Commons 頁面網址（卡片背面顯示）。只動 data/spots 的 season_images 欄位。
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from pipeline.http import get_json
from pipeline.paths import SPOTS_DIR
from pipeline.sources import commons, wikidata

API = commons.API
SEASONS = ("spring", "summer", "autumn", "winter", "night")
SEASON_RE: dict[str, re.Pattern[str]] = {
    "night": re.compile(
        r"\bnights?\b|\bevening\b|illuminat|light[ _-]?up|ライトアップ|夜景|夜", re.I
    ),
    "spring": re.compile(r"cherry[ _-]?blossoms?|sakura|\bspring\b|桜|春", re.I),
    "summer": re.compile(r"\bsummer\b|夏", re.I),
    "autumn": re.compile(r"\bautumn\b|fall[ _]foliage|\bfall\b|紅葉|momiji|秋", re.I),
    "winter": re.compile(r"\bwinter\b|\bsnow(y|fall)?\b|冬|雪", re.I),
}
# 季節字樣但不是季節：溫泉（hot spring）、春日大社、秋葉原、雪舟…
NOT_SEASON = re.compile(
    r"hot[ _]springs?|onsen|kasuga|akihabara|akiba|sesshu|雪舟|春日|秋葉|springs\b", re.I
)


def season_of(title: str, own: str = "") -> str | None:
    """標題屬於哪一季或夜景；「Autumn illumination」這種算夜景（夜景優先）。

    own 是景點自己的名稱（例：SPring-8、春日山），名稱裡的季節字樣不算。
    """
    if own:
        title = re.sub(re.escape(own), " ", title, flags=re.I)
    if NOT_SEASON.search(title):
        return None
    for s in ("night", *SEASONS[:4]):
        if SEASON_RE[s].search(title):
            return s
    return None


def commons_categories(qids: list[str]) -> dict[str, str]:
    """Wikidata P373（Commons category）"""
    out: dict[str, str] = {}
    for i in range(0, len(qids), 200):
        values = " ".join(f"wd:{q}" for q in qids[i : i + 200])
        q = f"SELECT ?item ?cat WHERE {{ VALUES ?item {{ {values} }} ?item wdt:P373 ?cat }}"
        rows = wikidata.sparql(q)
        for r in rows:
            out[r["item"]["value"].rsplit("/", 1)[-1]] = r["cat"]["value"]
    return out


def subcategories(cat: str) -> list[str]:
    data = get_json(
        API,
        params={
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{cat}",
            "cmtype": "subcat",
            "cmlimit": 500,
            "format": "json",
        },
        min_interval=0.5,
    )
    members = data.get("query", {}).get("categorymembers", [])
    return [m["title"].removeprefix("Category:") for m in members]


def files_in(cat: str, limit: int = 50) -> list[dict[str, Any]]:
    """分類裡的檔案（含尺寸、網址、授權）"""
    data = get_json(
        API,
        params={
            "action": "query",
            "generator": "categorymembers",
            "gcmtitle": f"Category:{cat}",
            "gcmtype": "file",
            "gcmlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": 960,
            "format": "json",
        },
        min_interval=0.5,
    )
    out = []
    for page in data.get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [None])[0]
        if info:
            out.append({"title": page["title"].removeprefix("File:"), **info})
    return out


def best(files: list[dict[str, Any]], exclude: set[str]) -> dict[str, Any] | None:
    """格式與尺寸合格的裡面像素最多的（測試與沒有名稱可比對時用）"""
    ok = [f for f in files if usable(f) and f["title"] not in exclude]
    return max(ok, key=lambda f: f["width"] * f["height"], default=None)


def usable(f: dict[str, Any]) -> bool:
    return (
        f.get("mime") == "image/jpeg"
        and f.get("width", 0) >= 1000
        and 1.2 <= f["width"] / max(f.get("height", 1), 1) <= 2.1
    )


# 名稱裡不能用來辨認景點的字
GENERIC = {
    "castle",
    "temple",
    "shrine",
    "mount",
    "park",
    "lake",
    "river",
    "bridge",
    "garden",
    "gardens",
    "japan",
    "japanese",
    "prefecture",
    "station",
    "tower",
    "museum",
    "falls",
    "waterfall",
    "island",
    "islands",
    "ruins",
    "site",
    "hall",
    "gate",
    "pond",
    "beach",
    "road",
    "street",
    "onsen",
    "jinja",
    "jingu",
    "taisha",
    "dera",
    "tera",
    "national",
    "city",
    "town",
    "village",
    "area",
    "district",
    "main",
    "great",
    "grand",
    "old",
    "new",
    "north",
    "south",
    "east",
    "west",
    "upper",
    "lower",
}
JA_SUFFIX = re.compile(
    r"(城跡|城址|城|寺|神社|大社|神宮|宮|公園|庭園|山|岳|湖|川|橋|滝|島|温泉|駅|塔|タワー|美術館|博物館|遺跡|跡)$"
)
# 拍的不是景點本身
DETAIL = re.compile(
    r"detail|close[ _-]?up|macro|interior|inside|ceiling|signboard|\bsigns?\b|\bmaps?\b|"
    r"ticket|menu|plaque|"
    r"information[ _]board|\bomamori\b|\bema\b|goshuin|stamp|poster|内部|看板|案内",
    re.I,
)
# 不是現代的照片：畫、版畫、明信片、館藏掃描、老照片
NOT_PHOTO = re.compile(
    r"painting|\bprints?\b|ukiyo|woodblock|illustration|drawing|engraving|lithograph|postcard|"
    r"\bDPLA\b|library of congress|\bLOC\b|NYPL|brooklyn museum|rijksmuseum|"
    r"metropolitan museum|smithsonian|hiroshige|hokusai|"
    r"\b1[0-8]\d\d\b|\b19[0-6]\d\b|浮世絵|錦絵|版画|絵葉書|名所江戸|名所図会|百景|三十六景|岷雪",
    re.I,
)
# 人潮、遊客是主角
CROWD = re.compile(r"crowd|throngs?|tourists|people|visitors|人出|混雑", re.I)
QUALITY = {
    "Category:Featured pictures on Wikimedia Commons": 50,
    "Category:Quality images": 40,
}


def name_tokens(cat: str, ja: str) -> list[str]:
    """用來確認檔名拍的是這個景點。

    Commons 分類名的特徵字（Himeji Castle → himeji）與日文名去掉字尾（姫路城 → 姫路）。
    """
    words = re.split(r"[\s_,()\-–.']+", cat.lower())
    toks = [w for w in words if len(w) >= 4 and w not in GENERIC]
    core = JA_SUFFIX.sub("", ja or "")
    if len(core) >= 2:
        toks.append(core)
    return toks


def mentions(title: str, toks: list[str]) -> bool:
    t = title.lower().replace("_", " ")
    return any(k in t for k in toks)


def score(
    f: dict[str, Any], toks: list[str], depicts: set[str], quality: dict[str, int]
) -> float | None:
    """拍得到景點才有分；None 表示不收"""
    relevant = f["title"] in depicts or mentions(f["title"], toks)
    if not relevant or not usable(f):
        return None
    if NOT_PHOTO.search(f["title"]) or any(NOT_PHOTO.search(c) for c in f.get("cats", [])):
        return None
    sc = 0.0
    if f["title"] in depicts:
        sc += 50
    if mentions(f["title"], toks):
        sc += 35
    sc += quality.get(f["title"], 0)
    if DETAIL.search(f["title"]):
        sc -= 60
    if CROWD.search(f["title"]):
        sc -= 25
    sc += min(10.0, f["width"] * f["height"] / 1e6)
    if 1.3 <= f["width"] / f["height"] <= 1.8:
        sc += 5
    return sc


SEASON_WORDS = (
    "spring OR sakura OR cherry OR summer OR autumn OR foliage OR winter OR snow OR night "
    "OR illumination OR 桜 OR 紅葉 OR 雪 OR 夜景 OR ライトアップ"
)


def depicting_files(qid: str, seasonal: bool = False) -> list[dict[str, Any]]:
    """Commons 結構化資料標了「描繪」（P180）這個景點的檔案，附分類（找季節用）。

    seasonal=True 時只找說明或分類有季節字樣的（富士山這種檔案多的景點，前 50 筆不一定有季節照片）。
    """
    search = f"haswbstatement:P180={qid}" + (f" ({SEASON_WORDS})" if seasonal else "")
    data = get_json(
        API,
        params={
            "action": "query",
            "generator": "search",
            "gsrsearch": search,
            "gsrnamespace": 6,
            "gsrlimit": 50,
            "prop": "imageinfo|categories",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": 960,
            "cllimit": "max",
            "clshow": "!hidden",
            "format": "json",
        },
        min_interval=0.5,
    )
    out = []
    for page in data.get("query", {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [None])[0]
        if info:
            cats = [c["title"].removeprefix("Category:") for c in page.get("categories", [])]
            out.append({"title": page["title"].removeprefix("File:"), "cats": cats, **info})
    return out


def quality_of(titles: list[str]) -> dict[str, int]:
    """優質、精選圖片的加分"""
    out: dict[str, int] = {}
    for i in range(0, len(titles), 50):
        data = get_json(
            API,
            params={
                "action": "query",
                "titles": "|".join(f"File:{t}" for t in titles[i : i + 50]),
                "prop": "categories",
                "clcategories": "|".join(QUALITY),
                "cllimit": "max",
                "format": "json",
            },
            min_interval=0.5,
        )
        for page in data.get("query", {}).get("pages", {}).values():
            for c in page.get("categories", []):
                t = page["title"].removeprefix("File:")
                out[t] = max(out.get(t, 0), QUALITY.get(c["title"], 0))
    return out


def to_image(f: dict[str, Any]) -> dict[str, str]:
    meta = f.get("extmetadata", {})
    author = commons._plain(meta.get("Artist", {}).get("value", "")) or "不明"  # noqa: SLF001
    lic = commons._plain(meta.get("LicenseShortName", {}).get("value", "")) or "不明"  # noqa: SLF001
    return {
        "url": f.get("thumburl") or f["url"],
        "author": author[:120],
        "license": lic,
        "source_url": f.get("descriptionurl", ""),
    }


def free_license(img: dict[str, str]) -> bool:
    lic = img["license"].lower()
    free = any(k in lic for k in ("cc by", "cc0", "public domain", "pd"))
    return free and "nc" not in re.split(r"[\s-]", lic)


def find_season_photos(
    cat: str, main_file: str | None, qid: str = "", ja: str = ""
) -> dict[str, dict[str, str]]:
    toks = name_tokens(cat, ja)
    own = cat  # 景點自己的名稱（分類名）裡的季節字樣不算
    pool: dict[str, tuple[dict[str, Any], str]] = {}
    # 1. 季節子分類（每季最多看兩個）
    subs = subcategories(cat)
    for s in SEASONS:
        for sub in [x for x in subs if season_of(x, own) == s][:2]:
            for f in files_in(sub):
                pool.setdefault(f["title"], (f, s))
    # 2. 主分類裡檔名有季節字樣的
    for f in files_in(cat, 500):
        if s := season_of(f["title"], own):
            pool.setdefault(f["title"], (f, s))
    # 3. 描繪這個景點的檔案（全部的前 50 筆＋有季節字樣的前 50 筆）
    depicts: set[str] = set()
    if qid:
        found_files = depicting_files(qid)
        try:
            found_files += depicting_files(qid, seasonal=True)
        except Exception:  # 搜尋語法不支援時只用第一批
            pass
        for f in found_files:
            depicts.add(f["title"])
            s = season_of(f["title"], own) or next(
                (x for c in f.get("cats", []) if (x := season_of(c, own))), None
            )
            if s:
                pool.setdefault(f["title"], (f, s))
    used = {main_file} if main_file else set()
    relevant = [
        t
        for t, (f, _) in pool.items()
        if t not in used and (t in depicts or mentions(t, toks)) and usable(f)
    ]
    quality = quality_of(relevant[:100]) if relevant else {}
    found: dict[str, dict[str, str]] = {}
    for s in SEASONS:
        ranked = sorted(
            (
                (sc, f)
                for t, (f, fs) in pool.items()
                if fs == s
                and t not in used
                and (sc := score(f, toks, depicts, quality)) is not None
            ),
            key=lambda x: -x[0],
        )
        for sc, f in ranked:
            if sc < 40:
                break
            if free_license(img := to_image(f)):
                found[s] = img
                used.add(f["title"])
                break
    return found


def _main_file(spot: dict[str, Any]) -> str | None:
    src = (spot.get("images") or [{}])[0].get("source_url", "")
    return src.rsplit("File:", 1)[-1].replace("_", " ") if "File:" in src else None


def seed_season_photos(prefs: list[str], min_score: float = 70, refresh: bool = False) -> str:
    lines = ["## 收集卡季節照片", ""]
    today = date.today().isoformat()
    total = 0
    for pref in prefs:
        path: Path = SPOTS_DIR / f"{pref}.json"
        spots: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
        targets = [
            s
            for s in spots
            if s.get("kind") == "major"
            and s.get("status") == "published"
            and s.get("score", 0) >= min_score
            and s.get("external_ids", {}).get("wikidata")
            and (refresh or "season_images" not in s)
        ]
        cats = commons_categories([s["external_ids"]["wikidata"] for s in targets])
        n = 0
        for s in targets:
            cat = cats.get(s["external_ids"]["wikidata"])
            if not cat:
                continue
            try:
                photos = find_season_photos(
                    cat, _main_file(s), s["external_ids"]["wikidata"], s["name"]["ja"]
                )
            except Exception as e:  # 一筆失敗不影響其他
                lines.append(f"- {pref} {s['name']['ja']}：{e}")
                continue
            s["season_images"] = photos
            if photos:
                n += 1
                s["updated_at"] = today
        path.write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        lines.append(f"- {pref}：{len(targets)} 筆查詢，{n} 筆找到季節照片")
        total += n
    lines.insert(2, f"共 {total} 筆景點有季節照片（分數 ≥ {min_score}）。")
    return "\n".join(lines)
