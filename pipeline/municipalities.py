"""市区町村界（TODO.md「縣內規劃」2：小區塊）：seed-municipalities、assign-municipalities。

來源：国土数値情報（行政区域データ）N03，国土交通省（pipeline/sources/n03.py）。
授權（2026-10-11 查）：N03 資料頁的使用許諾條件是「オープンデータ（CC_BY_4.0）」，並附註
「※本データを二次利用する場合には、国土地理院に申請等必要な場合があります。」；
國土數值情報下載網站的利用規約（2026-03-23 施行，2026-10-11 用 probe.yml 確認）
是公共データ利用規約（第 1.0 版，PDL1.0，與 CC BY 4.0 相容）；要標示出處、
註明有加工。國土地理院的測量成果利用手續（令和元年 12 月改訂）：網站上插入地圖比照書籍的插圖，
原則上不必申請、標示出處即可；本專案只在網頁地圖上畫簡化後的區界，不做測量用途。
出處標示：「国土数値情報（行政区域データ）」（国土交通省）（https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html）をもとにひとめぐり作成
（沙箱連不到 nlftp.mlit.go.jp，以上由搜尋結果與引用該頁的公開專案確認；第一次跑之前用 probe.yml
看一次資料頁與 robots.txt。）
沒有用 OSM 的行政界（admin_level 7/8）：ODbL、沒有全国地方公共団体コード、多邊形要自己由 way 拼。

層級：政令指定都市用「區」（京都市東山区），東京 23 區是特別區本身。旅客想的是東山、中央、台東，
不是整個京都市、名古屋市。
代碼：全国地方公共団体コード 6 碼 = N03_007 的 5 碼（JIS X 0402）＋檢查碼（總務省的算法）。
念法：N03 沒有。取 Wikidata 以 P429（団体コード）對到、沒有廢止日（P576）的項目的 P1814，
一個代碼只對到一個項目、念法只有一種才用。羅馬拼音：兩個來源都沒有，不寫。

輸出：
- data/municipalities/{縣}.json：簡化後的 GeoJSON（拓撲保持，相鄰區共用邊界，見 pipeline/topo.py），
  座標小數 5 位；容許誤差從約 20 m 起，整檔放不進 DATA_BUDGET 就放大。一個區一行，diff 讀得懂。
- 景點的 municipality：點在哪個區裡（簡化後的海岸、縣界附近落在區外的，取 3 km 內最近的區）。
- web bundle（build-bundles）：再簡化到約 80 m、小數 4 位，一縣一檔。
"""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from pipeline import topo
from pipeline.models import (
    MultiPolygonGeometry,
    MunicipalityData,
    MunicipalityFeature,
    MunicipalityProps,
    Source,
    Spot,
)
from pipeline.paths import MUNICIPALITIES_DIR, SPOTS_DIR

LICENSE = (
    "CC BY 4.0（N03 資料頁）／公共データ利用規約（第1.0版）"
    "（国土数値情報ダウンロードサイト利用規約）"
)
ATTRIBUTION = (
    "「国土数値情報（行政区域データ）」（国土交通省）"
    "（https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html）をもとにひとめぐり作成"
)

# data/：容許誤差（度）從約 20 m 起；一縣的座標超過 DATA_BUDGET 位元組就放大
DATA_TOL = 0.0002
DATA_BUDGET = 400_000
DATA_DIGITS = 5
# 不和別區相連、比這還小的島拿掉（度²；約 0.01 km²）
DATA_MIN_AREA = 1e-6
# web bundle：約 80 m 起，一縣 200 KB 以內，小數 4 位（約 10 m）
WEB_TOL = 0.0008
WEB_BUDGET = 200_000
WEB_DIGITS = 4
WEB_MIN_AREA = 2e-5
# 景點落在每個區外時（簡化後的海岸線、縣界附近），取這個距離以內最近的區
FALLBACK_M = 3000


def lg_code(code5: str) -> str:
    """JIS X 0402 的 5 碼 → 全国地方公共団体コード 6 碼（加檢查碼）。

    檢查碼：各位數依序乘 6、5、4、3、2 加總，除以 11 的餘數，11 減餘數的個位數。
    """
    digits = [int(c) for c in code5]
    s = sum(d * w for d, w in zip(digits, (6, 5, 4, 3, 2), strict=True))
    return f"{code5}{(11 - s % 11) % 10}"


def pref_no(pref: str) -> int:
    from pipeline.geo import pref_slugs

    return pref_slugs().index(pref) + 1


# ---------- N03 ----------


def names_of(props: dict[str, Any]) -> tuple[str, str | None] | None:
    """（區名或市町村名, 政令指定都市的市名）；所属未定地等沒有名稱時 None。"""
    ward = (props.get("N03_005") or "").strip() if isinstance(props.get("N03_005"), str) else ""
    muni = (props.get("N03_004") or "").strip()
    county = (props.get("N03_003") or "").strip()
    if ward.endswith("区"):  # 2024 年版起：政令指定都市的區在 N03_005
        city = muni if muni.endswith("市") else county if county.endswith("市") else None
        return ward, city
    if muni.endswith("区") and county.endswith("市"):  # 舊版：區在 N03_004、市在 N03_003
        return muni, county
    return (muni, None) if muni else None


def _polygons(geom: dict[str, Any]) -> list[Any]:
    if geom.get("type") == "Polygon":
        return [geom["coordinates"]]
    if geom.get("type") == "MultiPolygon":
        return list(geom["coordinates"])
    return []


def parse_n03(
    data: dict[str, Any], pref_number: int
) -> tuple[dict[str, topo.MultiPolygon], dict[str, tuple[str, str | None]], int]:
    """N03 GeoJSON → （代碼 → 多邊形, 代碼 → 名稱, 略過的 feature 數）。

    N03 一個島一個 feature，同一個代碼的合併。
    """
    shapes: dict[str, topo.MultiPolygon] = {}
    names: dict[str, tuple[str, str | None]] = {}
    skipped = 0
    for f in data.get("features", []):
        props = f.get("properties") or {}
        raw = props.get("N03_007")
        code5 = str(raw).strip().zfill(5) if raw not in (None, "") else ""
        named = names_of(props)
        if not re.fullmatch(r"\d{5}", code5) or not named or int(code5[:2]) != pref_number:
            skipped += 1
            continue
        code = lg_code(code5)
        names.setdefault(code, named)
        shapes.setdefault(code, []).extend(
            [[[(float(p[0]), float(p[1])) for p in ring] for ring in poly]
             for poly in _polygons(f.get("geometry") or {})]
        )  # fmt: skip
    return shapes, names, skipped


# ---------- 念法（Wikidata） ----------

KANA_QUERY = """SELECT ?item ?code ?kana ?end WHERE {
  ?item wdt:P429 ?code .
  OPTIONAL { ?item wdt:P1814 ?kana . }
  OPTIONAL { ?item wdt:P576 ?end . }
}"""


def kana_from_bindings(rows: list[dict[str, Any]]) -> dict[str, tuple[str, str]]:
    """SPARQL 結果 → 代碼 → （平假名, Wikidata 項目網址）。"""
    from pipeline.kana import is_kana, normalize_kana

    items: dict[str, dict[str, set[str]]] = {}
    dissolved: set[str] = set()
    for b in rows:
        code = re.sub(r"\D", "", b["code"]["value"])
        if len(code) == 5:
            code = lg_code(code)
        if len(code) != 6 or lg_code(code[:5]) != code:
            continue
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        if "end" in b:
            dissolved.add(qid)
        kana = items.setdefault(code, {}).setdefault(qid, set())
        if "kana" in b and is_kana(b["kana"]["value"]):
            kana.add(normalize_kana(b["kana"]["value"]))
    out: dict[str, tuple[str, str]] = {}
    for code, by_item in items.items():
        live = {q: k for q, k in by_item.items() if q not in dissolved}
        if len(live) != 1:
            continue
        ((qid, kana),) = live.items()
        if len(kana) == 1:
            out[code] = (next(iter(kana)), f"https://www.wikidata.org/wiki/{qid}")
    return out


def fetch_kana() -> dict[str, tuple[str, str]]:
    from pipeline.sources.wikidata import sparql

    return kana_from_bindings(sparql(KANA_QUERY))


# ---------- 輸出 ----------


def build_data(
    pref: str,
    shapes: dict[str, topo.MultiPolygon],
    names: dict[str, tuple[str, str | None]],
    kana: dict[str, tuple[str, str]],
    dataset: str,
    page: str,
    today: str,
    budget: int = DATA_BUDGET,
) -> MunicipalityData:
    simplified, tol = topo.simplify_to_budget(
        topo.build(shapes), DATA_TOL, budget, DATA_DIGITS, DATA_MIN_AREA
    )
    features = []
    for code in sorted(simplified):
        mp = simplified[code]
        if not mp:
            continue
        name, city = names[code]
        k = kana.get(code)
        features.append(
            MunicipalityFeature(
                type="Feature",
                id=code,
                properties=MunicipalityProps(
                    name=name,
                    city=city,
                    kana=k[0] if k else None,
                    kana_source_url=k[1] if k else None,
                    source_url=page,
                    retrieved=today,
                ),
                geometry=MultiPolygonGeometry(
                    type="MultiPolygon",
                    coordinates=[[[list(p) for p in ring] for ring in poly] for poly in mp],
                ),
            )
        )
    return MunicipalityData(
        type="FeatureCollection",
        prefecture=pref,
        dataset=dataset,
        source=Source(url=page, fetched_at=today),
        license=LICENSE,
        attribution=ATTRIBUTION,
        tolerance=float(f"{tol:.6g}"),
        features=features,
    )


def render(data: MunicipalityData) -> str:
    """一個區一行（座標陣列很長，逐層縮排會讓 diff 讀不懂）。"""
    body = data.model_dump(mode="json", exclude_none=True)
    feats = body.pop("features")
    rows = ["{"]
    rows += [f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}," for k, v in body.items()]
    rows.append('  "features": [')
    rows += [
        "    "
        + json.dumps(f, ensure_ascii=False, separators=(",", ":"))
        + ("," if i < len(feats) - 1 else "")
        for i, f in enumerate(feats)
    ]
    rows += ["  ]", "}"]
    return "\n".join(rows) + "\n"


def write(data: MunicipalityData, root: Path = MUNICIPALITIES_DIR) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    path = root / f"{data.prefecture}.json"
    path.write_text(render(data), encoding="utf-8")
    return path


def load(pref: str, root: Path = MUNICIPALITIES_DIR) -> MunicipalityData | None:
    path = root / f"{pref}.json"
    if not path.exists():
        return None
    return MunicipalityData.model_validate_json(path.read_text(encoding="utf-8"))


def seed_municipalities(prefs: list[str], root: Path = MUNICIPALITIES_DIR) -> str:
    from pipeline.major import log
    from pipeline.sources import n03

    today = dt.date.today().isoformat()
    try:
        kana = fetch_kana()
    except Exception as e:  # noqa: BLE001 — 念法取不到仍寫區界
        log(f"Wikidata 念法取不到：{e}")
        kana = {}
    lines = [
        "## 市区町村界（国土数値情報 N03）",
        "",
        f"Wikidata 念法：{len(kana)} 個代碼。",
        "",
        "| 縣 | 版本 | 區 | 有念法 | 略過 | 容許誤差（度） | 大小 |",
        "|---|---|---|---|---|---|---|",
    ]
    for pref in prefs:
        no = pref_no(pref)
        log(f"[{pref}] N03…")
        raw, year = n03.download(no)
        shapes, names, skipped = parse_n03(raw, no)
        data = build_data(pref, shapes, names, kana, f"N03-{year}0101", n03.page_url(year), today)
        path = write(data, root)
        areas.cache_clear()
        with_kana = sum(1 for f in data.features if f.properties.kana)
        size = path.stat().st_size
        lines.append(
            f"| {pref} | N03-{year}0101 | {len(data.features)} | {with_kana} | {skipped} "
            f"| {data.tolerance} | {size // 1024} KB |"
        )
        log(f"[{pref}]   {len(data.features)} 區、{size // 1024} KB（容許誤差 {data.tolerance}）")
    return "\n".join(lines) + "\n"


# ---------- 景點所在的區 ----------


@dataclass
class Area:
    code: str
    box: tuple[float, float, float, float]
    shape: list[Any]


class Areas:
    """一縣的區界（點在哪個區）。"""

    def __init__(self, data: MunicipalityData) -> None:
        self.areas = [
            Area(f.id, topo.bbox(f.geometry.coordinates), f.geometry.coordinates)
            for f in sorted(data.features, key=lambda f: f.id)
        ]

    def code_at(self, lat: float, lng: float, fallback_m: float = FALLBACK_M) -> str | None:
        for a in self.areas:
            w, s, e, n = a.box
            if w <= lng <= e and s <= lat <= n and topo.contains(a.shape, lng, lat):
                return a.code
        pad = fallback_m / 90_000  # 度（緯度 1 度約 111 km、經度在日本約 90 km 以上）
        best: tuple[float, str] | None = None
        for a in self.areas:
            w, s, e, n = a.box
            if w - pad <= lng <= e + pad and s - pad <= lat <= n + pad:
                d = topo.distance_m(a.shape, lat, lng)
                if d <= fallback_m and (best is None or d < best[0]):
                    best = (d, a.code)
        return best[1] if best else None


@cache
def areas(pref: str, root: Path = MUNICIPALITIES_DIR) -> Areas | None:
    data = load(pref, root)
    return Areas(data) if data else None


def code_for(pref: str, lat: float, lng: float, root: Path = MUNICIPALITIES_DIR) -> str | None:
    """景點所在的區代碼；這縣還沒有區界資料時 None。"""
    a = areas(pref, root)
    return a.code_at(lat, lng) if a else None


def with_code(spot: dict[str, Any], code: str | None) -> dict[str, Any]:
    """寫上（或拿掉）municipality，放在 city（沒有就 prefecture）之後，其他欄位的順序不動。"""
    anchor = "city" if "city" in spot else "prefecture"
    out: dict[str, Any] = {}
    for k, v in spot.items():
        if k == "municipality":
            continue
        out[k] = v
        if k == anchor and code:
            out["municipality"] = code
    if code and "municipality" not in out:
        out["municipality"] = code
    return out


def assign_spots(spots: list[dict[str, Any]], area: Areas) -> tuple[list[dict[str, Any]], int]:
    """每個景點寫上 municipality；回傳（景點, 有變的筆數）。"""
    out = []
    changed = 0
    for s in spots:
        loc = s["location"]
        code = area.code_at(loc["lat"], loc["lng"])
        if code != s.get("municipality"):
            changed += 1
        new = with_code(s, code)
        Spot.model_validate(new)
        out.append(new)
    return out, changed


def assign_municipalities(
    prefs: list[str], spots_dir: Path = SPOTS_DIR, root: Path = MUNICIPALITIES_DIR
) -> str:
    lines = [
        "## 景點所在的市区町村",
        "",
        "| 縣 | 景點 | 有區 | 沒有區 | 有變更 |",
        "|---|---|---|---|---|",
    ]
    for pref in prefs:
        path = spots_dir / f"{pref}.json"
        data = load(pref, root)
        if not path.exists() or data is None:
            lines.append(f"| {pref} | 沒有{'景點' if not path.exists() else '區界'}資料 | | | |")
            continue
        raw = path.read_text(encoding="utf-8")
        spots, changed = assign_spots(json.loads(raw), Areas(data))
        if changed:
            text = json.dumps(spots, ensure_ascii=False, indent=2)
            path.write_text(text + "\n", encoding="utf-8")
        has = sum(1 for s in spots if s.get("municipality"))
        lines.append(f"| {pref} | {len(spots)} | {has} | {len(spots) - has} | {changed} |")
    return "\n".join(lines) + "\n"


# ---------- web bundle ----------


UNASSIGNED = "所属未定地"


def unassigned(code: str, name: str) -> bool:
    """所属未定地（埋立地など、どの市区町村にも属さない）：代碼是縣本身（第 3–5 碼 000）。"""
    return name == UNASSIGNED or code[2:5] == "000"


def web_bundle(data: MunicipalityData) -> dict[str, Any]:
    """前端用：再簡化一次（約 80 m、小數 4 位）；所属未定地不放（地圖不畫、不能選）。

    properties：m 代碼、n 名稱、h 念法、c 政令指定都市名、l 區名的位置 [經度, 緯度]
    （面積最大的那一塊裡離邊界最遠的點）。feature id 是數字（MapLibre 的 feature-state 要數字）。"""
    shapes = {
        f.id: [[[(p[0], p[1]) for p in ring] for ring in poly] for poly in f.geometry.coordinates]
        for f in data.features
        if not unassigned(f.id, f.properties.name)
    }
    simplified, _ = topo.simplify_to_budget(
        topo.build(shapes), WEB_TOL, WEB_BUDGET, WEB_DIGITS, WEB_MIN_AREA
    )
    features = []
    for f in data.features:
        mp = simplified.get(f.id)
        if not mp:
            continue
        p = f.properties
        lng, lat = topo.label_point(mp)
        label = [round(lng, WEB_DIGITS), round(lat, WEB_DIGITS)]
        props = {
            k: v
            for k, v in {"m": f.id, "n": p.name, "h": p.kana, "c": p.city, "l": label}.items()
            if v
        }
        coords = [[[list(pt) for pt in ring] for ring in poly] for poly in mp]
        features.append({
            "type": "Feature", "id": int(f.id), "properties": props,
            "geometry": {"type": "MultiPolygon", "coordinates": coords},
        })  # fmt: skip
    return {"type": "FeatureCollection", "attribution": data.attribution, "features": features}
