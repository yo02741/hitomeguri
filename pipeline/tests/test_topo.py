"""拓撲保持簡化（pipeline/topo.py）：相鄰區的共用邊界簡化後仍相同。"""

import pytest

from pipeline import topo


def _wiggle(x0: float, y0: float, y1: float, n: int, amp: float) -> list[tuple[float, float]]:
    """x0 附近、從 y0 到 y1 的鋸齒線（振幅 amp，比容許誤差小就會被簡化掉）。"""
    step = (y1 - y0) / n
    return [(x0 + (amp if i % 2 else -amp) * (0 < i < n), y0 + i * step) for i in range(n + 1)]


def _pair(amp: float = 0.00005):
    shared = _wiggle(1.0, 0.0, 1.0, 40, amp)
    west = [(0.0, 0.0), *shared, (0.0, 1.0), (0.0, 0.0)]
    east = [(1.0, 0.0), (2.0, 0.0), (2.0, 1.0), *reversed(shared)]
    return {"west": [[west]], "east": [[east]]}


def _on_line(mp, x: float, tol: float) -> set[tuple[float, float]]:
    return {p for poly in mp for ring in poly for p in ring if abs(p[0] - x) <= tol}


def test_shared_boundary_simplified_identically():
    out = topo.simplify(topo.build(_pair()), tol=0.001)
    west = _on_line(out["west"], 1.0, 0.0002)
    east = _on_line(out["east"], 1.0, 0.0002)
    assert west == east
    # 鋸齒被簡化掉，只剩兩個接點
    assert west == {(1.0, 0.0), (1.0, 1.0)}
    for mp in out.values():
        ring = mp[0][0]
        assert ring[0] == ring[-1] and len(ring) >= 4


def test_three_way_junction_cuts_arcs():
    """三區交會點是弧的端點：每段共用邊界各自只簡化一次。"""
    a = [(0.0, 0.0), (1.0, 0.0), (1.0, 0.5), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]
    b = [(1.0, 0.0), (2.0, 0.0), (2.0, 0.5), (1.0, 0.5), (1.0, 0.0)]
    c = [(1.0, 0.5), (2.0, 0.5), (2.0, 1.0), (1.0, 1.0), (1.0, 0.5)]
    t = topo.build({"a": [[a]], "b": [[b]], "c": [[c]]})
    out = topo.simplify(t, tol=0.6)
    for key in "abc":
        assert (1.0, 0.5) in set(out[key][0][0])
    assert sum(1 for r in t.refs if r == 2) == 3  # a|b、a|c、b|c 三條共用弧


def test_enclave_hole_matches_inner_outer():
    outer = [(0.0, 0.0), (3.0, 0.0), (3.0, 3.0), (0.0, 3.0), (0.0, 0.0)]
    hole = [(1.0, 1.0), (2.0, 1.0), (2.0, 1.5), (2.0, 2.0), (1.0, 2.0), (1.0, 1.0)]
    inner = list(reversed(hole))
    out = topo.simplify(topo.build({"a": [[outer, hole]], "b": [[inner]]}), tol=0.01)
    assert set(out["a"][0][1]) == set(out["b"][0][0])
    assert (2.0, 1.5) not in set(out["b"][0][0])  # 直線上的點簡化掉


def test_small_islands_dropped_but_largest_kept():
    main = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]
    islet = [(2.0, 2.0), (2.0001, 2.0), (2.0001, 2.0001), (2.0, 2.0001), (2.0, 2.0)]
    lone = [(5.0, 5.0), (5.0001, 5.0), (5.0001, 5.0001), (5.0, 5.0)]
    out = topo.simplify(
        topo.build({"a": [[main], [islet]], "b": [[lone]]}), tol=0.00001, min_area=1e-6
    )
    assert len(out["a"]) == 1
    assert len(out["b"]) == 1  # 只有一塊：再小也留


def test_sliver_between_two_arcs_survives():
    """兩條幾乎是直線的弧夾成的細長區：簡化後不能變成一條線（改用較小的容許誤差重做）。"""
    j1, j2 = (0.0, 0.0), (1.0, 0.0)
    top = [j1, (0.5, 0.0004), j2]
    sliver = [j1, (0.5, -0.0004), j2, (0.5, 0.0004), j1]
    north = [j1, *top[1:], (1.0, 1.0), (0.0, 1.0), j1]
    south = [j1, (0.0, -1.0), (1.0, -1.0), j2, (0.5, -0.0004), j1]
    out = topo.simplify(
        topo.build({"n": [[north]], "s": [[south]], "x": [[sliver]]}), tol=0.01
    )
    ring = out["x"][0][0]
    assert len(set(ring)) >= 3
    assert set(ring) <= set(out["n"][0][0]) | set(out["s"][0][0])


def test_budget_raises_tolerance():
    feats = _pair(amp=0.003)
    full = topo.size_of(topo.simplify(topo.build(feats), tol=0.0))
    out, tol = topo.simplify_to_budget(topo.build(feats), 0.0001, full // 3)
    assert tol > 0.0001 and topo.size_of(out) <= full // 3


def test_rounding_keeps_shared_vertices_equal():
    out = topo.simplify(topo.build(_pair(amp=0.003)), tol=0.001, ndigits=2)
    assert _on_line(out["west"], 1.0, 0.01) == _on_line(out["east"], 1.0, 0.01)
    assert all(round(x, 2) == x for poly in out["west"] for ring in poly for x, _ in ring)


def test_contains_and_distance():
    square = [[[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)],
               [(0.4, 0.4), (0.6, 0.4), (0.6, 0.6), (0.4, 0.6), (0.4, 0.4)]]]  # fmt: skip
    assert topo.contains(square, 0.2, 0.2)
    assert not topo.contains(square, 0.5, 0.5)  # 洞裡
    assert not topo.contains(square, 1.5, 0.5)
    # 緯度 0.5、經度 1.001：離東邊 0.001 度
    assert topo.distance_m(square, 0.5, 1.001) == pytest.approx(111.3, rel=0.01)
    assert topo.bbox(square) == (0.0, 0.0, 1.0, 1.0)
