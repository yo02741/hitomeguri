"""縣界：簡化後的都道府縣 GeoJSON，以及點落在哪個縣的判斷。

來源：地球地図日本（国土地理院）經 dataofjapan/land 轉成 GeoJSON。使用時需標示出處。
輸出 web/public/geo/prefectures.json，前端用來判斷目前焦點縣（UX-FLOW.md §1.3），
pipeline 用來確認候選景點是否在該縣內。
"""

from __future__ import annotations

import json
import math
from functools import cache
from pathlib import Path

from pipeline.paths import GEO_JSON, REGIONS_JSON

SOURCE_URL = "https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson"
ATTRIBUTION = "出典：地球地図日本（国土地理院）"

Ring = list[tuple[float, float]]
Polygon = list[Ring]  # 第一個是外環，其餘是洞


def _pref_slugs() -> list[str]:
    data = json.loads(REGIONS_JSON.read_text(encoding="utf-8"))
    return [r["prefecture"] for r in data["regions"]]  # JIS X 0401 順序，index+1 = 都道府縣碼


def iso_code(pref: str) -> str:
    """都道府縣 slug → ISO 3166-2 代碼（例：kyoto → JP-26）。"""
    return f"JP-{_pref_slugs().index(pref) + 1:02d}"


# ---------- 簡化 ----------


def _perp_dist(p: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def _dp(points: Ring, tol: float) -> Ring:
    # 迭代版 Douglas–Peucker，避免長海岸線遞迴過深。
    n = len(points)
    if n < 3:
        return points
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        s, e = stack.pop()
        best, idx = 0.0, -1
        for i in range(s + 1, e):
            d = _perp_dist(points[i], points[s], points[e])
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack.append((s, idx))
            stack.append((idx, e))
    return [p for p, k in zip(points, keep, strict=True) if k]


def _ring_area(ring: Ring) -> float:
    return (
        abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:], strict=False))) / 2
    )


def simplify(src: Path, dst: Path, tol: float = 0.004, min_area: float = 0.0004) -> Path:
    raw = json.loads(src.read_text(encoding="utf-8"))
    slugs = _pref_slugs()
    features = []
    for f in sorted(raw["features"], key=lambda f: f["properties"]["id"]):
        pid = int(f["properties"]["id"])
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        out_polys = []
        for poly in polys:
            outer = [tuple(p) for p in poly[0]]
            if _ring_area(outer) < min_area:
                continue
            rings = []
            for ring in poly:
                simp = _dp([tuple(p) for p in ring], tol)
                if len(simp) >= 4:
                    rings.append([[round(x, 3), round(y, 3)] for x, y in simp])
            if rings:
                out_polys.append(rings)
        features.append(
            {
                "type": "Feature",
                "id": pid,
                "properties": {"pref": slugs[pid - 1], "code": pid},
                "geometry": {"type": "MultiPolygon", "coordinates": out_polys},
            }
        )
    fc = {"type": "FeatureCollection", "attribution": ATTRIBUTION, "features": features}
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return dst


# ---------- 查詢 ----------


@cache
def _polygons() -> dict[str, list[Polygon]]:
    fc = json.loads(GEO_JSON.read_text(encoding="utf-8"))
    out: dict[str, list[Polygon]] = {}
    for f in fc["features"]:
        out[f["properties"]["pref"]] = [
            [[(x, y) for x, y in ring] for ring in poly] for poly in f["geometry"]["coordinates"]
        ]
    return out


def _in_ring(x: float, y: float, ring: Ring) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def contains(pref: str, lat: float, lng: float) -> bool:
    for poly in _polygons()[pref]:
        if _in_ring(lng, lat, poly[0]) and not any(_in_ring(lng, lat, h) for h in poly[1:]):
            return True
    return False


def prefecture_at(lat: float, lng: float) -> str | None:
    for pref in _polygons():
        if contains(pref, lat, lng):
            return pref
    return None


def bbox(pref: str, pad: float = 0.02) -> tuple[float, float, float, float]:
    """(south, west, north, east)"""
    xs = [x for poly in _polygons()[pref] for x, _ in poly[0]]
    ys = [y for poly in _polygons()[pref] for _, y in poly[0]]
    return min(ys) - pad, min(xs) - pad, max(ys) + pad, max(xs) + pad


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
