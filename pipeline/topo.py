"""多邊形的拓撲保持簡化，以及點與多邊形的判斷（市区町村界用）。

相鄰的市区町村共用同一段邊界。各自用 Douglas–Peucker 簡化時，同一段邊界在兩邊會留下不同的點，
地圖上就出現縫隙或重疊。這裡的做法同 TopoJSON：
1. 每個環在「接點」切開成弧。接點是三條以上邊界交會的點（頂點度數 ≥ 3），或環在這一點前後
   鄰接的對象不同（例：從和 A 區的邊界轉到海岸線）。
2. 同一條弧（不論方向）只簡化一次、端點固定，各環再用簡化後的弧接回去：共用的邊界兩邊完全相同。
3. 沒有接點的環（島、飛地）整圈是一條封閉弧：從最小的頂點起算，方向取字典序小的一邊，
   所以飛地的外環和外面那一區的洞是同一條弧。封閉弧至少留三個點。
4. 兩條弧夾成的小區簡化後只剩一條線時，那幾條弧改用較小的容許誤差重做（最後退回原始的弧）。
很小、不和別區共用邊界的島（面積 < min_area）拿掉；每個區至少留面積最大的那一塊。
座標一律 (經度, 緯度)，容許誤差的單位是度。
"""

from __future__ import annotations

import json
import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

Pt = tuple[float, float]
Ring = list[Pt]  # 封閉：首尾相同
Polygon = list[Ring]  # 第一個是外環，其餘是洞
MultiPolygon = list[Polygon]
ArcRef = tuple[int, bool]  # (弧 index, 是否反向)


def _dedupe(points: Iterable[Pt]) -> list[Pt]:
    out: list[Pt] = []
    for p in points:
        if not out or out[-1] != p:
            out.append(p)
    return out


def open_ring(ring: Sequence[Sequence[float]]) -> list[Pt]:
    """GeoJSON 的環 → 不重複首尾、沒有連續重複點的頂點清單。"""
    pts = _dedupe((float(p[0]), float(p[1])) for p in ring)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    return pts


def ring_area(ring: Sequence[Pt]) -> float:
    """面積（度²，不分方向）。"""
    n = len(ring)
    s = 0.0
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


@dataclass
class Topology:
    arcs: list[tuple[Pt, ...]]
    closed: list[bool]
    # 每個 feature：多邊形 → 環（外環在前）→ 弧的參照
    shapes: dict[str, list[list[list[ArcRef]]]]
    # 每個 feature 每個多邊形的原始外環面積（拿掉小島、保留最大一塊用）
    areas: dict[str, list[float]]
    # 弧被幾個環用到（1 = 不和別區共用）
    refs: list[int]


def _seg(a: Pt, b: Pt) -> tuple[Pt, Pt]:
    return (a, b) if a < b else (b, a)


def build(features: dict[str, MultiPolygon]) -> Topology:
    """把各 feature 的多邊形切成共用的弧。"""
    rings: list[list[Pt]] = []
    layout: dict[str, list[list[int]]] = {}  # feature → 多邊形 → 環在 rings 的 index
    areas: dict[str, list[float]] = {}
    for key in sorted(features):
        polys: list[list[int]] = []
        for poly in features[key]:
            outer = open_ring(poly[0]) if poly else []
            if len(outer) < 3:
                continue
            idx = [len(rings)]
            rings.append(outer)
            for hole in poly[1:]:
                pts = open_ring(hole)
                if len(pts) >= 3:
                    idx.append(len(rings))
                    rings.append(pts)
            polys.append(idx)
            areas.setdefault(key, []).append(ring_area(outer))
        layout[key] = polys
    # 每段邊屬於哪些環；頂點度數（不重複的邊）
    owners: dict[tuple[Pt, Pt], list[int]] = {}
    for r, pts in enumerate(rings):
        n = len(pts)
        for i in range(n):
            k = _seg(pts[i], pts[(i + 1) % n])
            lst = owners.get(k)
            if lst is None:
                owners[k] = [r]
            elif lst[-1] != r:
                lst.append(r)
    degree: dict[Pt, int] = {}
    for a, b in owners:
        degree[a] = degree.get(a, 0) + 1
        degree[b] = degree.get(b, 0) + 1
    junction = {p for p, d in degree.items() if d >= 3}
    for pts in rings:
        n = len(pts)
        prev = owners[_seg(pts[-1], pts[0])]
        for i in range(n):
            nxt = owners[_seg(pts[i], pts[(i + 1) % n])]
            if nxt != prev:
                junction.add(pts[i])
            prev = nxt
    del owners, degree

    arcs: list[tuple[Pt, ...]] = []
    closed: list[bool] = []
    refs: list[int] = []
    index: dict[tuple[Pt, ...], int] = {}

    def add(seq: tuple[Pt, ...], is_closed: bool) -> ArcRef:
        rev = seq[::-1]
        canon, flipped = (seq, False) if seq <= rev else (rev, True)
        i = index.get(canon)
        if i is None:
            i = len(arcs)
            index[canon] = i
            arcs.append(canon)
            closed.append(is_closed)
            refs.append(0)
        refs[i] += 1
        return i, flipped

    ring_refs: list[list[ArcRef]] = []
    for pts in rings:
        n = len(pts)
        cuts = [i for i in range(n) if pts[i] in junction]
        if not cuts:
            m = min(range(n), key=lambda i: pts[i])
            ring_refs.append([add(tuple(pts[m:] + pts[:m] + [pts[m]]), True)])
            continue
        start = cuts[0]
        rot = pts[start:] + pts[:start] + [pts[start]]
        marks = [j for j, p in enumerate(rot) if p in junction]
        if marks[-1] != len(rot) - 1:
            marks.append(len(rot) - 1)
        ring_refs.append(
            [add(tuple(rot[a : b + 1]), False) for a, b in zip(marks, marks[1:], strict=False)]
        )
    shapes = {
        key: [[ring_refs[r] for r in poly] for poly in polys] for key, polys in layout.items()
    }
    return Topology(arcs=arcs, closed=closed, shapes=shapes, areas=areas, refs=refs)


def _radial(points: Sequence[Pt], r: float) -> list[Pt]:
    """離上一個留下的點不到 r 的點先拿掉（長海岸線先減量，DP 才不會太慢）；首尾保留。"""
    if len(points) < 3 or r <= 0:
        return list(points)
    out = [points[0]]
    r2 = r * r
    for p in points[1:-1]:
        q = out[-1]
        if (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= r2:
            out.append(p)
    out.append(points[-1])
    return out


def _dp(points: Sequence[Pt], tol: float) -> list[Pt]:
    """Douglas–Peucker（迭代、平方距離、迴圈內不呼叫函式；長海岸線也不會太慢）。首尾保留。"""
    n = len(points)
    if n < 3:
        return list(points)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    keep = [False] * n
    keep[0] = keep[-1] = True
    tol2 = tol * tol
    stack = [(0, n - 1)]
    while stack:
        s, e = stack.pop()
        if e - s < 2:
            continue
        x1, y1, x2, y2 = xs[s], ys[s], xs[e], ys[e]
        dx, dy = x2 - x1, y2 - y1
        seg2 = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(s + 1, e):
            px, py = xs[i] - x1, ys[i] - y1
            if seg2 == 0:
                d = px * px + py * py
            else:
                t = (px * dx + py * dy) / seg2
                if t <= 0:
                    d = px * px + py * py
                elif t >= 1:
                    qx, qy = xs[i] - x2, ys[i] - y2
                    d = qx * qx + qy * qy
                else:
                    c = px * dy - py * dx
                    d = c * c / seg2
            if d > best:
                best, idx = d, i
        if best > tol2:
            keep[idx] = True
            stack.append((s, idx))
            stack.append((idx, e))
    return [p for p, k in zip(points, keep, strict=True) if k]


def _triangle(points: Sequence[Pt]) -> list[Pt]:
    """封閉弧至少三個不同的點：起點、離起點最遠的點、離這兩點連線最遠的點（照原順序）。"""
    s = points[0]
    body = list(range(1, len(points) - 1))
    if len(body) < 2:
        return list(points)
    a = max(body, key=lambda i: (points[i][0] - s[0]) ** 2 + (points[i][1] - s[1]) ** 2)
    (x1, y1), (x2, y2) = s, points[a]

    def off(i: int) -> float:
        x, y = points[i]
        return abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1))

    b = max((i for i in body if i != a), key=off)
    return [points[i] for i in sorted({0, a, b})] + [s]


def simplify_arc(
    points: Sequence[Pt], tol: float, is_closed: bool, ndigits: int | None = None
) -> list[Pt]:
    pts = list(points)
    if tol > 0 and len(pts) > 2:
        pts = _dp(_radial(pts, tol / 2), tol)
    if ndigits is not None:
        pts = _dedupe((round(x, ndigits), round(y, ndigits)) for x, y in pts)
        if is_closed and pts[0] != pts[-1]:
            pts.append(pts[0])
    if is_closed and len(set(pts)) < 3:
        pts = _triangle(list(points))
        if ndigits is not None:
            pts = _dedupe((round(x, ndigits), round(y, ndigits)) for x, y in pts)
    return pts


def _join(parts: list[list[Pt]]) -> list[Pt]:
    out: list[Pt] = list(parts[0])
    for part in parts[1:]:
        out += part[1:] if out and part and part[0] == out[-1] else part
    return _dedupe(out)


def _ring_ok(ring: list[Pt]) -> bool:
    return len(ring) >= 4 and ring[0] == ring[-1] and len(set(ring)) >= 3


def simplify(
    topo: Topology, tol: float, ndigits: int | None = None, min_area: float = 0.0
) -> dict[str, MultiPolygon]:
    """依容許誤差簡化；回傳 feature → MultiPolygon（環首尾相同）。"""
    return _simplify(topo, tol, ndigits, min_area)[0]


def _simplify(
    topo: Topology, tol: float, ndigits: int | None, min_area: float
) -> tuple[dict[str, MultiPolygon], list[float]]:
    """（結果, 每條弧實際用的容許誤差）。"""
    # 不和別區共用、面積很小的島先拿掉（每區留面積最大的一塊）
    skip: dict[str, set[int]] = {}
    for key, polys in topo.shapes.items():
        if not polys:
            continue
        areas = topo.areas[key]
        biggest = max(range(len(polys)), key=lambda i: areas[i])
        skip[key] = {
            pi
            for pi, poly in enumerate(polys)
            if pi != biggest
            and areas[pi] < min_area
            and all(topo.closed[a] and topo.refs[a] == 1 for ring in poly for a, _ in ring)
        }
    tols = [tol] * len(topo.arcs)
    cache: dict[int, tuple[float, list[Pt]]] = {}
    for attempt in range(4):
        simp: dict[int, list[Pt]] = {}
        out: dict[str, MultiPolygon] = {}
        bad: set[int] = set()
        for key, polys in topo.shapes.items():
            mp: MultiPolygon = []
            for pi, poly in enumerate(polys):
                if pi in skip.get(key, set()):
                    continue
                rings: list[Ring] = []
                for ri, ring in enumerate(poly):
                    parts = []
                    for a, flipped in ring:
                        if a not in simp:
                            t = tols[a]
                            hit = cache.get(a)
                            if hit is None or hit[0] != t:
                                hit = (t, simplify_arc(topo.arcs[a], t, topo.closed[a], ndigits))
                                cache[a] = hit
                            simp[a] = hit[1]
                        parts.append(simp[a][::-1] if flipped else simp[a])
                    pts = _join(parts)
                    if not _ring_ok(pts):
                        bad.update(a for a, _ in ring)
                        if ri == 0:
                            break
                        continue
                    rings.append(pts)
                else:
                    mp.append(rings)
            out[key] = mp
        if not bad:
            break
        # 變成一條線的環：那幾條弧改用 1/4 的容許誤差，第三次起用原始的點
        for a in bad:
            tols[a] = 0.0 if attempt >= 2 else tols[a] / 4
    return out, tols


def size_of(shapes: dict[str, MultiPolygon]) -> int:
    """寫成 JSON 時座標的大約位元組數（決定容許誤差用）。"""
    return sum(len(json.dumps(mp, separators=(",", ":"))) for mp in shapes.values())


def simplify_to_budget(
    topo: Topology,
    tol: float,
    budget: int,
    ndigits: int | None = None,
    min_area: float = 0.0,
    max_tol: float = 0.01,
) -> tuple[dict[str, MultiPolygon], float]:
    """從 tol 開始，放不進 budget（位元組）就把容許誤差乘 1.5 再做；回傳（結果, 用的容許誤差）。

    下一輪從這一輪簡化過的弧（不四捨五入）接著簡化，不必每輪都從原始的點做起。
    """
    while True:
        out, used = _simplify(topo, tol, ndigits, min_area)
        if size_of(out) <= budget or tol >= max_tol:
            return out, tol
        topo = Topology(
            arcs=[
                tuple(simplify_arc(a, t, c))
                for a, t, c in zip(topo.arcs, used, topo.closed, strict=True)
            ],
            closed=topo.closed,
            shapes=topo.shapes,
            areas=topo.areas,
            refs=topo.refs,
        )
        tol = min(tol * 1.5, max_tol)


# ---------- 點與多邊形 ----------


def in_ring(x: float, y: float, ring: Sequence[Sequence[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def contains(mp: Sequence[Sequence[Sequence[Sequence[float]]]], lng: float, lat: float) -> bool:
    for poly in mp:
        if poly and in_ring(lng, lat, poly[0]) and not any(in_ring(lng, lat, h) for h in poly[1:]):
            return True
    return False


def bbox(mp: Sequence[Sequence[Sequence[Sequence[float]]]]) -> tuple[float, float, float, float]:
    """(west, south, east, north)"""
    xs = [p[0] for poly in mp for p in poly[0]] if mp else [0.0]
    ys = [p[1] for poly in mp for p in poly[0]] if mp else [0.0]
    return min(xs), min(ys), max(xs), max(ys)


def distance_m(mp: Sequence[Sequence[Sequence[Sequence[float]]]], lat: float, lng: float) -> float:
    """點到多邊形邊界的最短距離（公尺，等距圓柱近似；幾公里內夠準）。"""
    kx = 111_320.0 * math.cos(math.radians(lat))
    ky = 110_540.0
    best = math.inf
    for poly in mp:
        for ring in poly:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:], strict=False):
                ax, ay = (x1 - lng) * kx, (y1 - lat) * ky
                bx, by = (x2 - lng) * kx, (y2 - lat) * ky
                dx, dy = bx - ax, by - ay
                L = dx * dx + dy * dy
                t = 0.0 if L == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / L))
                d = math.hypot(ax + t * dx, ay + t * dy)
                if d < best:
                    best = d
    return best
