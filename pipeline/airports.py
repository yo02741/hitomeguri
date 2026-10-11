"""有國際定期航班的機場（seed-airports 指令）：機場當成景點。

哪些機場算數：国土交通省每季發表的「各空港における国際線就航状況調べ」（定期便，Excel；
同一份表的 PDF 取不出文字）裡列出的日本機場。
Wikidata、OSM 的「國際機場」標記不可靠（那覇空港在 Wikidata 只標「空港」，OSM 只標了成田、羽田），
所以這份表只用來判斷「有沒有國際定期航班」；機場的名稱、座標、念法、簡介、照片和其他景點一樣
取自 Wikidata、維基百科、Commons、OSM（major.to_spot、wiki.apply_wiki）。

流程：下載 Excel（PDF 也可以）→ 取出文字
→ 和 Wikidata 的日本機場（有 IATA 代碼、沒有廢止、有座標與日文名）
比對名稱 → data/seed/airports.json（每個機場附對到的字串，審核用）
→ 機場景點寫進 data/spots/{縣}.json。
seed-region 重採時也讀這份清單（major.apply_airports）；清單以外的機場照樣當成非景點排除。
"""

from __future__ import annotations

import datetime as dt
import io
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pipeline import geo, major
from pipeline.http import get_bytes
from pipeline.models import AirportSeed, Spot
from pipeline.paths import AIRPORTS_JSON, SPOTS_DIR
from pipeline.sources import commons, osm, wikidata

# 2026年夏期スケジュール（SOURCE_PAGE「国際線就航状況」的 Excel）。新的一季發表後用 --url 或
# 環境變數 AIRPORTS_PDF_URL 指定新的檔案
DEFAULT_PDF_URL = "https://www.mlit.go.jp/koku/content/002000600.xlsx"
SOURCE_PAGE = "https://www.mlit.go.jp/koku/koku_tk1_000013.html"

# 對到的機場太少：PDF 文字取不出來（掃描檔、字型沒有對應表）或格式大改，不寫檔
MIN_MATCHED = 8

log = major.log

# ---------- Wikidata 的日本機場 ----------

# 有 IATA 代碼（P238）、國家是日本（P17）、有座標與日文名；沒有廢止（P576）、關閉（P3999）。
# 類型（P31）的標籤用來排除軍用機場與「都市」這類掛著 IATA 都市代碼的項目；
# 所在行政區（P131）往上找到都道府縣的 ISO 代碼（P300），座標不在縣界內時用
AIRPORTS_QUERY = """
SELECT ?item ?iata ?coord ?ja ?alias ?typeLabel ?iso WHERE {
  ?item wdt:P238 ?iata ;
        wdt:P17 wd:Q17 ;
        wdt:P625 ?coord ;
        rdfs:label ?ja .
  FILTER(LANG(?ja) = "ja")
  FILTER NOT EXISTS { ?item wdt:P576 ?end }
  FILTER NOT EXISTS { ?item wdt:P3999 ?closed }
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "ja") }
  OPTIONAL {
    ?item wdt:P31 ?type .
    ?type rdfs:label ?typeLabel .
    FILTER(LANG(?typeLabel) IN ("ja", "en"))
  }
  OPTIONAL {
    ?item wdt:P131+ ?admin .
    ?admin wdt:P300 ?iso .
    FILTER(STRSTARTS(?iso, "JP-"))
  }
}"""

_POINT_RE = re.compile(r"Point\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)")

# 類型標籤（小寫比對）。軍民共用的（「軍民共用空港」、joint-use）算民用
_MILITARY_KW = ("基地", "軍", "自衛隊", "military", "air base", "air force", "naval", "air station")
_CIVIL_KW = ("共用", "joint", "civil")
_AERODROME_KW = ("空港", "飛行場", "airport", "aerodrome", "airfield", "ヘリポート", "heliport")


@dataclass
class Candidate:
    qid: str
    iata: str
    name_ja: str
    lat: float
    lng: float
    kinds: set[str] = field(default_factory=set)  # P31 的標籤（日文、英文）
    aliases: set[str] = field(default_factory=set)  # 日文別名（skos:altLabel）
    admin_prefs: set[str] = field(default_factory=set)  # P131 鏈上的縣（slug）


def fetch_candidates() -> list[dict[str, Any]]:
    return wikidata.sparql(AIRPORTS_QUERY)


def parse_candidates(rows: list[dict[str, Any]]) -> dict[str, Candidate]:
    """SPARQL 結果（一個機場會有好幾列：別名 × 類型 × 縣）→ QID → Candidate。"""
    iso_to_slug = {geo.iso_code(p): p for p in geo.pref_slugs()}
    out: dict[str, Candidate] = {}
    for r in rows:
        qid = r["item"]["value"].rsplit("/", 1)[1]
        c = out.get(qid)
        if c is None:
            m = _POINT_RE.search(r["coord"]["value"])
            if not m:
                continue
            lng, lat = float(m.group(1)), float(m.group(2))
            c = out[qid] = Candidate(
                qid=qid, iata=r["iata"]["value"], name_ja=r["ja"]["value"], lat=lat, lng=lng
            )
        if "alias" in r:
            c.aliases.add(r["alias"]["value"])
        if "typeLabel" in r:
            c.kinds.add(r["typeLabel"]["value"])
        if "iso" in r and r["iso"]["value"] in iso_to_slug:
            c.admin_prefs.add(iso_to_slug[r["iso"]["value"]])
    return out


def exclusion_reason(c: Candidate) -> str | None:
    """不是民用機場的理由：只有軍用的類型（自衛隊、米軍基地），或類型不是機場（IATA 都市代碼）。"""
    if not c.kinds:
        return None  # 沒有類型：有 IATA 機場代碼就當成機場
    low = {k.lower() for k in c.kinds}
    military = [k for k in low if any(w in k for w in _MILITARY_KW)]
    civil = [
        k
        for k in low
        if any(w in k for w in _CIVIL_KW)
        or (any(w in k for w in ("空港", "airport")) and not any(w in k for w in _MILITARY_KW))
    ]
    if military and not civil:
        return "軍用：" + "、".join(sorted(military))
    if not any(w in k for k in low for w in _AERODROME_KW) and not military:
        return "不是機場：" + "、".join(sorted(c.kinds))
    return None


def resolve_prefecture(c: Candidate) -> tuple[str | None, str]:
    """座標在哪個縣（縣界）；不在任何縣界內（海上、埋立地）時用 Wikidata 所在地，
    再沒有就取最近的縣界。回傳 (縣, 判斷方式)。"""
    inside = [p for p in geo.pref_slugs() if geo.contains_fine(p, c.lat, c.lng)]
    if len(inside) == 1:
        return inside[0], "縣界"
    if inside:  # 縣界重疊（不應該發生）：以 Wikidata 所在地為準
        both = [p for p in inside if p in c.admin_prefs]
        return (both or inside)[0], "縣界"
    if len(c.admin_prefs) == 1:
        return next(iter(c.admin_prefs)), "Wikidata 所在地"
    candidates = sorted(c.admin_prefs) or None
    return geo.nearest_prefecture(c.lat, c.lng, candidates), "最近的縣界"


# ---------- PDF 的文字 ----------


def fetch_pdf_text(url: str) -> tuple[str, int]:
    """下載 PDF 或 Excel（.xlsx），取出文字；回傳 (文字, 頁數或工作表數)。

    「各空港における国際線就航状況調べ」的 PDF 表格取不出文字（只有表頭），
    同一份資料的 Excel 可以。"""
    data = get_bytes(url, min_interval=1.0)
    if data is None:
        raise RuntimeError(f"檔案不存在（404）：{url}")
    if data[:2] == b"PK":  # .xlsx 是 zip
        return xlsx_text(data)
    return pdf_text(data)


def xlsx_text(data: bytes) -> tuple[str, int]:
    """Excel（.xlsx）的文字：共用字串表與各工作表的行內字串，一個儲存格一行；回傳 (文字, 工作表數)。

    只用標準函式庫（zipfile、ElementTree；ElementTree 不展開外部實體）。"""
    import xml.etree.ElementTree as ET
    import zipfile

    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    z = zipfile.ZipFile(io.BytesIO(data))
    names = z.namelist()
    out: list[str] = []
    if "xl/sharedStrings.xml" in names:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.iter(f"{ns}si"):
            out.append("".join(t.text or "" for t in si.iter(f"{ns}t")))
    sheets = sorted(n for n in names if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"))
    for n in sheets:
        root = ET.fromstring(z.read(n))
        for cell in root.iter(f"{ns}is"):
            out.append("".join(t.text or "" for t in cell.iter(f"{ns}t")))
    return "\n".join(out), len(sheets)


def pdf_text(data: bytes) -> tuple[str, int]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:  # 只設了使用限制（空的開啟密碼）的 PDF
        reader.decrypt("")
    pages = []
    for i, page in enumerate(reader.pages):
        try:
            pages.append(page.extract_text() or "")
        except Exception as e:  # noqa: BLE001 — 一頁取不出來不影響其他頁
            log(f"  第 {i + 1} 頁取不出文字：{type(e).__name__}: {e}")
            pages.append("")
    return "\n".join(pages), len(reader.pages)


# PDF 的文字常把漢字取成部首字元（「⻑崎」）：NFKC 會換掉康熙部首（U+2F00–），
# CJK 部首補充（U+2E80–）要另外換
_RADICALS = str.maketrans({
    "\u2ea0": "民", "\u2ec1": "虎", "\u2ec4": "西", "\u2ed1": "長", "\u2ed8": "青",
    "\u2edd": "食", "\u2ee4": "鬼", "\u2ee8": "麦", "\u2ee9": "黄", "\u2eeb": "斉",
    "\u2eed": "歯", "\u2eef": "竜", "\u2ef2": "亀",
})  # fmt: skip


def normalize_text(text: str) -> str:
    return unicodedata.normalize("NFKC", text).translate(_RADICALS)


_KANJI = "\u3005\u3006\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff"
_KATA = "\u30a1-\u30fa\u30fc"  # 不含「・」（U+30FB）
_HIRA = "\u3041-\u3096"
_SPACE = " \u3000"
# 漢字・片假名的一段（比對、切分用）；含平假名的一段（「みやこ下地島」這類通稱）
RUN_RE = re.compile(f"[{_KANJI}{_KATA}]+")
RUN_HIRA_RE = re.compile(f"[{_KANJI}{_KATA}{_HIRA}]+")
_HIRA_RE = re.compile(f"[{_HIRA}]")
_TRAILING_HIRA_RE = re.compile(f"[{_HIRA}]+$")
IATA_RE = re.compile(r"(?<![A-Za-z])[A-Z]{3}(?![A-Za-z])")
# 表格的列名：行首或空白、括號後的一段漢字・片假名，後面接數字（「新千歳 210」）
ROW_LABEL_RE = re.compile(
    f"(?:^|(?<=[\\s(、,]))([{_KANJI}{_KATA}]{{2,8}})[{_SPACE}]*(?=\\d)", re.MULTILINE
)
# 字與字之間的空白（「仙 台」）：去掉後再比對一次
_INNER_SPACE_RE = re.compile(f"(?<=[{_KANJI}{_KATA}])[{_SPACE}]+(?=[{_KANJI}{_KATA}])")

SUFFIX_RE = re.compile(r"(国際空港|空港|飛行場)$")
SUFFIXES = ("", "空港", "国際空港", "飛行場")
# 機場名稱後面常接的字（「那覇発着」「羽田便」）
CONNECTORS = ("発着", "発", "着", "便", "線", "国際線", "国際便", "直行便", "就航")

# 通稱：PDF 用地名稱呼、和 Wikidata 標籤去掉「空港」不同的（以 IATA 代碼對應，標籤寫法不同也對得到）
ALIASES: dict[str, tuple[str, ...]] = {
    "HND": ("羽田",),
    "NRT": ("成田",),
    "ITM": ("伊丹",),
    "KIX": ("関西", "関空"),
    "NGO": ("中部", "セントレア"),
    "NKM": ("小牧", "県営名古屋"),
    "OKD": ("丘珠",),
    "CTS": ("新千歳",),
    "FSZ": ("静岡", "富士山静岡"),
    "ISG": ("石垣", "新石垣", "南ぬ島石垣"),
    "SHI": ("下地島", "みやこ下地島"),
    "KMJ": ("熊本", "阿蘇くまもと"),
    "HSG": ("佐賀", "九州佐賀"),
    "TKS": ("徳島", "徳島阿波おどり"),
    "HNA": ("花巻", "いわて花巻"),
    "OBO": ("帯広", "とかち帯広"),
    "KUH": ("釧路", "たんちょう釧路"),
    "TOY": ("富山", "富山きときと"),
    "OKJ": ("岡山", "岡山桃太郎"),
    "YGJ": ("米子", "米子鬼太郎"),
    "KCZ": ("高知", "高知龍馬"),
    "KMI": ("宮崎", "宮崎ブーゲンビリア"),
    "IZO": ("出雲", "出雲縁結び"),
    "TTJ": ("鳥取", "鳥取砂丘コナン"),
    "NTQ": ("能登", "のと里山"),
    "IBR": ("茨城",),
}
# 去掉「空港」後是都市名、同一個都市有好幾個機場的：不單獨拿來比對
# （「大阪（関西）」不能對到大阪国際空港＝伊丹，「札幌（新千歳）」不能對到札幌飛行場＝丘珠）
AMBIGUOUS = {"東京", "大阪", "名古屋", "札幌", "沖縄", "北海道", "九州", "日本", "首都圏", "地方"}


def _clean(name: str) -> str:
    name = normalize_text(name)
    name = re.sub(r"\s*[(][^)]*[)]\s*$", "", name)  # 消歧義括號
    return re.sub(r"[\s・]", "", name)


def name_variants(c: Candidate) -> set[str]:
    """比對用的名稱：日文名、別名、去掉「空港」「国際空港」「飛行場」的地名、通稱（各加上字尾）。"""
    bases: set[str] = set()
    full: set[str] = set()
    for n in {c.name_ja, *c.aliases}:
        n = _clean(n)
        if len(n) < 2:
            continue
        base = SUFFIX_RE.sub("", n)
        if base == n:  # 沒有字尾的別名（「セントレア」）
            if n not in AMBIGUOUS:
                full.add(n)
                bases.add(n)
            continue
        full.add(n)
        if len(base) >= 2 and base not in AMBIGUOUS:
            bases.add(base)
    bases |= {_clean(a) for a in ALIASES.get(c.iata, ())}
    return full | {b + s for b in bases for s in SUFFIXES}


@dataclass
class Match:
    qid: str
    matched: str  # 對到的名稱或 IATA 代碼
    token: str  # PDF 裡的那一段
    context: str


def _context(text: str, s: str, before: int = 12, after: int = 24) -> str:
    i = text.find(s)
    if i < 0:
        return s
    snippet = text[max(0, i - before) : i + len(s) + after]
    return re.sub(r"\s+", " ", snippet).strip()


def _segment(token: str, by_first: dict[str, list[str]], names: set[str]) -> list[str] | None:
    """一段字全部切成機場名稱與連接字（「成田羽田」「那覇発着」）；至少要有一個機場名稱。"""
    if len(token) > 40:
        return None
    best: list[list[str] | None] = [None] * (len(token) + 1)
    best[0] = []
    for i in range(len(token)):
        cur = best[i]
        if cur is None:
            continue
        for piece in by_first.get(token[i], []):
            if token.startswith(piece, i):
                j = i + len(piece)
                cand = [*cur, piece]
                if best[j] is None or len(cand) < len(best[j]):  # type: ignore[arg-type]
                    best[j] = cand
    out = best[len(token)]
    if not out or not any(p in names for p in out):
        return None
    return [p for p in out if p in names]


@dataclass
class MatchResult:
    matches: dict[str, list[Match]]  # QID → 對到的地方
    ambiguous: dict[str, list[str]]  # 對到多個機場的字串 → QID
    unmatched_airport_like: list[str]  # 以「空港」「飛行場」結尾但沒有對到的
    unmatched_rows: list[str]  # 表格列名（後面接數字）沒有對到的


def match_airports(text: str, cands: dict[str, Candidate]) -> MatchResult:
    text = normalize_text(text)
    collapsed = _INNER_SPACE_RE.sub("", text)
    index: dict[str, set[str]] = {}
    for c in cands.values():
        for v in name_variants(c):
            index.setdefault(v, set()).add(c.qid)
    names = set(index)
    by_first: dict[str, list[str]] = {}
    for p in sorted(names | set(CONNECTORS), key=lambda x: (-len(x), x)):
        by_first.setdefault(p[0], []).append(p)
    by_iata: dict[str, set[str]] = {}
    for c in cands.values():
        by_iata.setdefault(c.iata, set()).add(c.qid)

    matches: dict[str, list[Match]] = {}
    ambiguous: dict[str, list[str]] = {}
    hit_tokens: set[str] = set()

    def add(name: str, qids: set[str], token: str, src: str) -> None:
        hit_tokens.add(token)
        if len(qids) > 1:
            ambiguous[name] = sorted(qids)
        for q in sorted(qids):
            ms = matches.setdefault(q, [])
            if not any(m.matched == name and m.token == token for m in ms):
                ms.append(Match(q, name, token, _context(src, token)))

    for src in (text, collapsed):
        for m in RUN_RE.finditer(src):
            token = m.group(0)
            pieces = [token] if token in index else _segment(token, by_first, names)
            for p in pieces or []:
                add(p, index[p], token, src)
        # 含平假名的通稱（「阿蘇くまもと」「みやこ下地島」）：前後常接助詞，直接找字串
        for name in sorted(n for n in names if _HIRA_RE.search(n)):
            if name in src:
                add(name, index[name], name, src)
    for m in IATA_RE.finditer(text):
        code = m.group(0)
        if code in by_iata:
            add(code, by_iata[code], code, text)

    airport_like = []
    for src in (text, collapsed):
        for m in RUN_HIRA_RE.finditer(src):
            token = _TRAILING_HIRA_RE.sub("", m.group(0))  # 後面的助詞（「…空港は」）
            # 太長的是一整句（「…を運航する空港」）、只有「空港」兩個字的，不列
            if len(token) > 15 or not SUFFIX_RE.search(token) or SUFFIX_RE.fullmatch(token):
                continue
            if token not in hit_tokens and not any(t in hit_tokens for t in RUN_RE.findall(token)):
                airport_like.append(token)
    rows = []
    for src in (text, collapsed):
        for m in ROW_LABEL_RE.finditer(src):
            label = m.group(1)
            if label not in hit_tokens and not SUFFIX_RE.fullmatch(label):
                rows.append(label)
    return MatchResult(
        matches=matches,
        ambiguous=ambiguous,
        unmatched_airport_like=list(dict.fromkeys(airport_like)),
        unmatched_rows=list(dict.fromkeys(rows)),
    )


def military_fallback(
    civil: dict[str, list[Match]],
    hidden: dict[str, list[Match]],
    cands: dict[str, Candidate],
    reasons: dict[str, str],
) -> dict[str, list[Match]]:
    """類型只有軍用、但 PDF 有列出的機場：沒有同名（或同 IATA 代碼）的民用機場對到時才收錄。

    軍民共用的機場在 Wikidata 有時只標了基地的類型（百里飛行場＝茨城空港）；
    同名的民用項目已經對到時，軍用的是另一個項目（基地本身），不收。
    """
    names = {m.matched for ms in civil.values() for m in ms}
    codes = {cands[q].iata for q in civil}
    return {
        q: ms
        for q, ms in hidden.items()
        if reasons[q].startswith("軍用")
        and cands[q].iata not in codes
        and not any(m.matched in names for m in ms)
    }


# ---------- 清單 ----------


def civil_name(c: Candidate, matched: str) -> str:
    """軍民共用的機場：Wikidata 的標籤是自衛隊的「○○飛行場」時，改用別名裡的「○○空港」
    （百里飛行場 → 茨城空港、美保飛行場 → 米子鬼太郎空港）。
    含對到的字串的優先，再取最長的（正式愛稱）。"""
    if c.name_ja.endswith("空港"):
        return c.name_ja
    civil = [a for a in c.aliases if a.endswith("空港")]
    if not civil:
        return c.name_ja
    return sorted(civil, key=lambda a: (matched not in a, -len(a), a))[0]


def airport_records(
    matched: dict[str, list[Match]], cands: dict[str, Candidate]
) -> tuple[list[dict[str, Any]], list[str]]:
    """data/seed/airports.json 的 airports（依 id 排序）；第二個值是縣的判斷要人工檢查的。"""
    out = []
    check = []
    for qid, ms in matched.items():
        c = cands[qid]
        pref, how = resolve_prefecture(c)
        if not pref:
            check.append(f"{c.name_ja}（{c.iata}）：判斷不出縣")
            continue
        if c.admin_prefs and pref not in c.admin_prefs:
            where = "、".join(sorted(c.admin_prefs))
            check.append(f"{c.name_ja}（{c.iata}）：{how}是 {pref}，Wikidata 所在地是 {where}")
        elif how != "縣界":
            check.append(f"{c.name_ja}（{c.iata}）：座標不在縣界內，用{how}判斷為 {pref}")
        # 名稱優先（IATA 代碼比較容易誤配）
        best = sorted(ms, key=lambda m: (bool(IATA_RE.fullmatch(m.matched)), -len(m.matched)))[0]
        out.append({
            "id": f"wd-{qid}",
            "wikidata": qid,
            "iata": c.iata,
            "name_ja": civil_name(c, best.matched),
            "prefecture": pref,
            "matched": best.matched,
        })  # fmt: skip
    out.sort(key=lambda a: a["id"])
    return out, check


def write_seed(url: str, fetched_at: str, airports: list[dict[str, Any]], path: Path) -> None:
    data = {"source": {"url": url, "fetched_at": fetched_at}, "airports": airports}
    AirportSeed.model_validate(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------- 景點 ----------


def build_airport_spots(
    airports: list[dict[str, Any]], source: dict[str, str], today: str
) -> tuple[dict[str, list[Spot]], list[str]]:
    """清單上的機場 → 景點（和 seed-region 同一套：Wikidata 名稱與念法、P18 照片、最近車站、
    瀏覽量分數）。回傳 (縣 → 景點, 沒有 Wikidata 座標而略過的名稱)。"""
    ents = wikidata.entities([a["wikidata"] for a in airports])
    drafts: dict[str, major.Draft] = {}
    skipped = []
    for a in airports:
        ent = ents.get(a["wikidata"])
        if not ent or ent.lat is None or ent.lng is None:
            skipped.append(a["name_ja"])
            continue
        d = major.Draft(key=ent.qid, lat=ent.lat, lng=ent.lng, ent=ent, airport=True)
        d.extra_sources.append((source["url"], source["fetched_at"]))
        if not ent.labels.get("ja"):
            d.seed_name = a["name_ja"]
        elif ent.labels["ja"] != a["name_ja"]:  # 軍民共用：用民航的名稱（civil_name）
            d.seed_name = a["name_ja"]
            d.seed_override = True
        drafts[ent.qid] = d
    major.score(drafts)
    files = [d.ent.image for d in drafts.values() if d.ent and d.ent.image]
    images = commons.image_info(files) if files else {}
    out: dict[str, list[Spot]] = {}
    for a in airports:
        d = drafts.get(a["wikidata"])
        if d is None:
            continue
        pad = 0.02  # 約 2 km：最近車站只看 1.5 km 以內
        stations = osm.stations((d.lat - pad, d.lng - pad, d.lat + pad, d.lng + pad))
        spot = major.to_spot(a["prefecture"], d, False, images, stations, today)
        out.setdefault(a["prefecture"], []).append(spot)
    return out, skipped


def is_airport_spot(s: dict[str, Any]) -> bool:
    return "機場" in s.get("tags", [])


def write_airport_spots(
    by_pref: dict[str, list[Spot]], listed_ids: set[str], today: str
) -> dict[str, list[str]]:
    """機場景點併進 data/spots/{縣}.json（其他景點不動）。清單上已經沒有的機場、換了縣的機場
    從原本的檔案移除。回傳 {"added": …, "updated": …, "removed": …}（名稱）。"""
    from pipeline.wiki import apply_wiki

    spots_dir = SPOTS_DIR
    merged: dict[str, list[dict[str, Any]]] = {}
    for pref, spots in by_pref.items():
        merged[pref] = major.merge_existing(spots, spots_dir / f"{pref}.json")
    # 簡介、缺漏的念法：維基百科（一次查全部）
    apply_wiki([s for recs in merged.values() for s in recs], today)

    result: dict[str, list[str]] = {"added": [], "updated": [], "removed": []}
    prefs = sorted({p.stem for p in spots_dir.glob("*.json")} | set(merged))
    for pref in prefs:
        path = spots_dir / f"{pref}.json"
        old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        new = [
            Spot.model_validate(s).model_dump(mode="json", exclude_none=True)
            for s in merged.get(pref, [])
        ]
        new_ids = {s["id"] for s in new}
        old_by_id = {s["id"]: s for s in old}
        keep = []
        for s in old:
            if s["id"] in new_ids:
                continue
            if s["id"] in listed_ids or is_airport_spot(s):
                result["removed"].append(f"{s['name']['ja']}（{pref}）")
                continue
            keep.append(s)
        for s in new:
            prev = old_by_id.get(s["id"])
            if prev is None:
                result["added"].append(f"{s['name']['ja']}（{pref}）")
            elif prev != s:
                result["updated"].append(f"{s['name']['ja']}（{pref}）")
        out = sorted(keep + new, key=lambda s: s["id"])
        if out != old:
            # 和 major.write_spots 相同的格式（indent=2、依 id 排序）
            path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


# ---------- 指令 ----------


def _cell(s: str) -> str:
    return s.replace("|", "｜")


def seed_airports(url: str | None = None, *, write_spots: bool = True) -> str:
    """回傳 markdown 報告；寫 data/seed/airports.json 與 data/spots 的機場景點。"""
    url = url or DEFAULT_PDF_URL
    today = dt.date.today().isoformat()
    log(f"[airports] 下載國際線就航資料：{url}")
    text, pages = fetch_pdf_text(url)
    log(f"[airports]   {pages} 頁（工作表）、{len(text)} 字")
    log("[airports] Wikidata 的日本機場…")
    all_cands = parse_candidates(fetch_candidates())
    excluded = {q: r for q, c in all_cands.items() if (r := exclusion_reason(c))}
    cands = {q: c for q, c in all_cands.items() if q not in excluded}
    log(f"[airports]   {len(all_cands)} 個（排除 {len(excluded)} 個）")

    res = match_airports(text, cands)
    # 排除的機場在 PDF 裡有沒有出現：只標了軍用類型的軍民共用機場補回來，其他列在報告
    hidden = match_airports(text, {q: all_cands[q] for q in excluded}).matches
    promoted = military_fallback(res.matches, hidden, all_cands, excluded)
    excluded_hits = {q: ms for q, ms in hidden.items() if q not in promoted}
    matches = {**res.matches, **promoted}
    if len(matches) < MIN_MATCHED:
        raise RuntimeError(
            f"PDF 只對到 {len(matches)} 個機場（少於 {MIN_MATCHED}）："
            "文字可能取不出來或格式變了，沒有寫檔。開頭：" + re.sub(r"\s+", " ", text[:300])
        )
    airports, check = airport_records(matches, all_cands)

    prev_source, prev = major.load_airport_seed()
    prev_ids = {a["id"] for a in prev}
    new_ids = {a["id"] for a in airports}
    write_seed(url, today, airports, AIRPORTS_JSON)
    log(f"[airports] 寫入 {AIRPORTS_JSON.name}：{len(airports)} 個")

    spot_result: dict[str, list[str]] = {}
    skipped: list[str] = []
    if write_spots:
        by_pref, skipped = build_airport_spots(airports, {"url": url, "fetched_at": today}, today)
        spot_result = write_airport_spots(by_pref, new_ids, today)

    lines = [
        "## 國際機場（国土交通省「各空港における国際線就航状況調べ」）",
        "",
        f"來源：{url}（{pages} 頁、{len(text)} 字）",
        f"Wikidata 的日本機場（有 IATA 代碼）：{len(all_cands)} 個，"
        f"排除軍用與非機場 {len(excluded)} 個",
        "",
        f"對到 {len(airports)} 個機場：",
        "",
        "| 機場 | IATA | 縣 | 對到的字串 | PDF 原文 |",
        "|---|---|---|---|---|",
    ]
    by_id = {f"wd-{q}": ms for q, ms in matches.items()}
    for a in sorted(airports, key=lambda a: (geo.pref_slugs().index(a["prefecture"]), a["iata"])):
        ms = by_id[a["id"]]
        found = "、".join(dict.fromkeys(m.matched for m in ms))
        ctx = " ／ ".join(dict.fromkeys(m.context for m in ms[:2]))
        lines.append(
            f"| {a['name_ja']} | {a['iata']} | {a['prefecture']} | {_cell(found)} | {_cell(ctx)} |"
        )
    lines.append("")
    added = sorted(new_ids - prev_ids)
    gone = sorted(prev_ids - new_ids)
    if prev_source:
        names = {a["id"]: a["name_ja"] for a in [*prev, *airports]}
        lines.append(f"上一份清單：{prev_source.get('url')}（{prev_source.get('fetched_at')}）")
        lines.append("新列入：" + ("、".join(names[i] for i in added) or "（無）"))
        gone_names = "、".join(names[i] for i in gone) or "（無）"
        lines.append(f"這次沒有列出（從景點移除）：{gone_names}")
        lines.append("")
    if check:
        lines += ["縣的判斷（請檢查）：", *[f"- {x}" for x in check], ""]
    if res.ambiguous:
        amb = [f"{k} → {'、'.join(cands[q].name_ja for q in v)}" for k, v in res.ambiguous.items()]
        lines += ["同一個字串對到好幾個機場（請檢查）：" + "；".join(amb), ""]
    if promoted:
        names_p = [f"{all_cands[q].name_ja}（{excluded[q]}）" for q in promoted]
        lines += [
            "類型只有軍用、但 PDF 有列出，也沒有同名的民用機場，所以收錄（請檢查）："
            + "、".join(names_p),
            "",
        ]
    if excluded_hits:
        hits = [f"{all_cands[q].name_ja}（{excluded[q]}）" for q in excluded_hits]
        lines += ["PDF 裡有出現、但當成軍用或非機場排除的：" + "、".join(hits), ""]
    if res.unmatched_airport_like:
        lines += [
            "PDF 裡像機場名稱、沒有對到的字串：" + "、".join(res.unmatched_airport_like[:60]),
            "",
        ]
    if res.unmatched_rows:
        lines += [
            "表格列名（後面接數字）沒有對到機場的（多半是國家、地區、航空公司）："
            + "、".join(res.unmatched_rows[:80]),
            "",
        ]
    if write_spots:
        lines.append(
            f"景點：新增 {len(spot_result['added'])}、更新 {len(spot_result['updated'])}、"
            f"移除 {len(spot_result['removed'])}"
        )
        for key, label in (("added", "新增"), ("removed", "移除")):
            if spot_result[key]:
                lines.append(f"- {label}：{'、'.join(spot_result[key])}")
        if skipped:
            lines.append(f"- Wikidata 沒有座標而略過：{'、'.join(skipped)}")
    return "\n".join(lines) + "\n"
