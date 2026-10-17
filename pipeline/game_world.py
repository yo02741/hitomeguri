"""番外篇（/play）的世界索引 game/_world.json：7 縣的鎮與縣之間的交通（P3）。

遊戲一開始只抓這一份（幾 KB）與起點的縣（京都）；坐車到別的縣時才抓那一縣的 game/{縣}.json。
所以「有哪些鎮、代表站在哪、縣與縣之間多遠」要在 pipeline 先算好：

- 選鎮：web/src/game/world/towns.ts 的 selectTowns 的移植（同一份 game bundle、同一個規則，
  結果要一樣；web 的 vitest 拿京都、沖繩的 fixture 對過）。規則 D1：起點 → 有名城蓋章地點的
  市区町村（P3：最多 4 個）→ 沖繩一個離島 → 其餘照景點分數總和補滿；鐵路的縣要連得到起點。P3 加：
  - include：起點之後一定放的鎮（北海道＝札幌市中央区）；
  - min_km、cluster：鎮與鎮的代表點至少隔多遠、半徑 n km 內最多幾鎮（北海道太大，9 鎮不要
    都在札幌一帶；資料沒有振興局，用距離分散：「半徑 120 km 內最多 3 鎮」）；
  - transit 'mixed'：有連得到起點的車站就坐電車，沒有就坐巴士（北海道）；
  - 代表站跟已經選到的鎮一樣的不選（大阪的天王寺区、阿倍野区都是「天王寺」站）。
- 縣之間的交通（只有距離，不寫時刻）：電車＝rail-graph 的鐵路 km（新幹線權重 0.97，同日帰り；
  京都 ↔ 東京標 shinkansen：路徑上新幹線 ≥ 20 km）；飛機＝兩個機場景點的直線 km
  （經関西国際空港、東京国際空港的那一段是鐵路 km）。轉乘的機場的景點資料裡沒有時，
  從車站直接飛、不寫轉乘的機場名（P2 的京都 → 那覇一樣）。
km 的小數照前端（鐵路：Python round(x, 1)＝daytrip.ts 的 round1；
直線：JS 的 Math.round(x * 10) / 10）。
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Literal

from pipeline.geo import haversine_m
from pipeline.rail_graph import SHINKANSEN_MIN_KM, Graph, _search, from_bundle

#: 世界索引的格式版本（web/src/game/world/index.ts 的 WORLD_INDEX_VERSION）
WORLD_VERSION = 1
#: 新遊戲的縣
START_PREF = "kyoto"

Transit = Literal["rail", "bus", "mixed"]
Kit = Literal["kinki", "okinawa", "kanto", "hokkaido"]


@dataclass(frozen=True)
class Rule:
    """一縣的選鎮規則（towns.ts 的 TownRule）"""

    start: str
    start_stop: Literal["main", "airport"] = "main"
    start_station: str | None = None
    count: int = 9
    islands: int = 0
    max_per_city: int | None = None
    transit: Transit = "rail"
    #: 有名城蓋章地點的鎮最多幾個（不寫＝不限）
    max_castles: int | None = None
    #: 起點之後一定放的鎮
    include: tuple[str, ...] = ()
    #: 鎮與鎮（代表點）至少隔幾 km（起點與 include 不算）
    min_km: float | None = None
    #: （半徑 km, 最多幾鎮）：新的鎮的半徑內（含自己）最多幾鎮（起點與 include 不算）
    cluster: tuple[float, int] | None = None
    #: 名城的鎮：景點都沒有最近車站（1.5 km 內）時，
    #: 市区町村代表點這麼多 km 內、連得到起點的車站當代表站
    #: （高取城在山上，最近的車站 3.7 km；高取町的壺阪山、市尾）。
    #: 京都、沖繩不設（已經上線的鎮不變）
    castle_station_km: float | None = None


#: towns.ts 的 TOWN_RULES（兩邊要一樣）
RULES: dict[str, Rule] = {
    "kyoto": Rule(start="261068", start_station="node-267316272"),
    "okinawa": Rule(start="472018", start_stop="airport", islands=1, transit="bus"),
    # 奈良市（近鉄奈良：奈良公園、東大寺、興福寺的最近車站）
    "nara": Rule(
        start="292010", start_station="node-4452353501", max_castles=4, castle_station_km=2.0
    ),
    # 大阪市北区（大阪駅）
    "osaka": Rule(
        start="271276", start_station="node-346685291", max_castles=4, castle_station_km=2.0
    ),
    # 神戸市中央区（JR 三ノ宮）
    "hyogo": Rule(
        start="281107", start_station="node-3999683422", max_castles=4, castle_station_km=2.0
    ),
    # 千代田区（東京駅）
    "tokyo": Rule(
        start="131016", start_station="node-11329319854", max_castles=4, castle_station_km=2.0
    ),
    # 千歳市（新千歳空港）＋札幌市中央区；鎮與鎮隔 30 km 以上、半徑 120 km 內最多 3 鎮、
    # 札幌只放一區；
    # 名城只放一鎮（根室、松前、上ノ国都在遠處又沒有鐵路，四個都放會把 9 鎮的一半用掉）
    "hokkaido": Rule(
        start="012246",
        start_stop="airport",
        transit="mixed",
        include=("011011",),
        min_km=30,
        cluster=(120, 3),
        max_per_city=1,
        max_castles=1,
    ),
}

#: 縣 → 地方 kit（towns.ts 的 KIT_OF；沒寫的用近畿）
KIT_OF: dict[str, Kit] = {"okinawa": "okinawa", "tokyo": "kanto", "hokkaido": "hokkaido"}


def kit_of(pref: str) -> Kit:
    return KIT_OF.get(pref, "kinki")


def _round_js1(v: float) -> float:
    """JS 的 Math.round(v * 10) / 10（.5 往上）"""
    return math.floor(v * 10 + 0.5) / 10


def _km_between(a: dict[str, Any], b: dict[str, Any]) -> float:
    return haversine_m(a["lat"], a["lng"], b["lat"], b["lng"]) / 1000


# ---------- 一縣：鐵路 km ----------
class _Pref:
    """一縣的 game bundle（PrefRaw）＋查詢；鐵路 km 用這一縣的子路網（前端的 railKm 一樣）"""

    def __init__(self, body: dict[str, Any]) -> None:
        self.body = body
        self.pref: str = body["pref"]
        self.spots: list[dict[str, Any]] = body["spots"]
        self.spot_by_id = {s["id"]: s for s in self.spots}
        self.muns = {m["m"]: m for m in body["municipalities"]}
        self.stations = {s["id"]: s for s in body["stations"]}
        self.lines: list[dict[str, Any]] = body["lines"]
        rg = body.get("railGraph") or {"nodes": [], "edges": []}
        self.graph: Graph | None = from_bundle(rg) if rg["nodes"] else None
        self._reach: dict[int, dict[int, float]] = {}

    def rail_km(self, a: str, b: str) -> float | None:
        g = self.graph
        if g is None or a not in g.index or b not in g.index:
            return None
        ia, ib = g.index[a], g.index[b]
        if ia == ib:
            return 0.0
        if ia not in self._reach:
            self._reach[ia] = _search(g, ia)[0]
        km = self._reach[ia].get(ib)
        return None if km is None else round(km, 1)

    def node(self, sid: str) -> dict[str, Any] | None:
        st = self.stations.get(sid)
        if st:
            return {"id": sid, "name": st["n"], "lat": st["lat"], "lng": st["lng"]}
        g = self.graph
        if g is None or sid not in g.index:
            return None
        n = g.nodes[g.index[sid]]
        return {"id": sid, "name": n.name, "lat": n.lat, "lng": n.lng}

    def station_kind(self, sid: str) -> str:
        st = self.stations.get(sid)
        kinds = [self.lines[i].get("k") for i in (st or {}).get("l", []) if i < len(self.lines)]
        return "monorail" if kinds and all(k == "monorail" for k in kinds) else "rail"

    def castle_spots(self) -> set[str]:
        return {c["s"] for c in self.body["castles"] if c.get("s") and c.get("st")}


# ---------- 選鎮（towns.ts 的移植） ----------
@dataclass
class _Cand:
    code: str
    score: float
    spots: list[dict[str, Any]]


@dataclass
class Stop:
    id: str
    kind: str
    name: str
    lat: float
    lng: float
    station_id: str | None = None
    spot_id: str | None = None


@dataclass
class Town:
    id: str
    pref: str
    name: dict[str, str]
    city: str | None
    main: Stop
    island: bool
    stops: list[Stop] = field(default_factory=list)

    @property
    def station_id(self) -> str:
        m = self.main
        return m.station_id or m.spot_id or f"bus:{self.id}"


def _candidates(p: _Pref) -> list[_Cand]:
    by: dict[str, list[dict[str, Any]]] = {}
    for s in p.spots:
        if s.get("m"):
            by.setdefault(s["m"], []).append(s)
    out = []
    for code, spots in by.items():
        if code not in p.muns:
            continue
        score = 0.0
        for s in spots:
            score += s["s"]
        out.append(_Cand(code, score, sorted(spots, key=lambda s: (-s["s"], s["id"]))))
    return sorted(out, key=lambda c: (-c.score, c.code))


def _common_station(p: _Pref, spots: list[dict[str, Any]], frm: str | None) -> str | None:
    count: dict[str, list[float]] = {}
    for s in spots:
        st = s.get("st")
        if not st:
            continue
        if frm and p.rail_km(frm, st) is None:
            continue
        if not frm and p.node(st) is None:
            continue
        c = count.setdefault(st, [0, 0.0])
        c[0] += 1
        c[1] += s["s"]
    best: str | None = None
    bc = [0, 0.0]
    for sid, c in count.items():
        if (
            best is None
            or c[0] > bc[0]
            or (c[0] == bc[0] and (c[1] > bc[1] or (c[1] == bc[1] and sid < best)))
        ):
            best, bc = sid, c
    return best


def _land_of(p: _Pref, start: str) -> set[str] | None:
    if not any(m.get("touches") for m in p.muns.values()):
        return None
    seen = {start}
    todo = [start]
    while todo:
        m = p.muns.get(todo.pop())
        for n in (m or {}).get("touches", []):
            if n not in seen:
                seen.add(n)
                todo.append(n)
    return seen


def _airport_of(spots: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((s for s in spots if s.get("c") == "機場"), None)


def _label_point(p: _Pref, c: _Cand) -> tuple[float, float]:
    m = p.muns[c.code]
    if m.get("l"):
        return m["l"][1], m["l"][0]
    top = c.spots[:8]
    w = sum(s["s"] for s in top) or 1
    return sum(s["lat"] * s["s"] for s in top) / w, sum(s["lng"] * s["s"] for s in top) / w


def _station_stop(p: _Pref, sid: str, stop_id: str) -> Stop:
    n = p.node(sid)
    assert n is not None
    return Stop(stop_id, p.station_kind(sid), n["name"], n["lat"], n["lng"], station_id=sid)


def _bus_stop(p: _Pref, c: _Cand) -> Stop:
    lat, lng = _label_point(p, c)
    return Stop("main", "bus", p.muns[c.code]["n"], lat, lng)


def _nearest_station(p: _Pref, pt: dict[str, Any], max_km: float, frm: str) -> str | None:
    best: str | None = None
    bd = max_km
    for st in p.body["stations"]:
        d = _km_between(pt, st)
        if d <= bd and p.rail_km(frm, st["id"]) is not None:
            best, bd = st["id"], d
    return best


def _town(p: _Pref, c: _Cand, main: Stop, island: bool, extra: list[Stop]) -> Town:
    m = p.muns[c.code]
    name = {"ja": m["n"]}
    if m.get("h"):
        name["kana"] = m["h"]
    return Town(c.code, p.pref, name, m.get("c"), main, island, [main, *extra])


def start_station_of(body: dict[str, Any], rule: Rule) -> str | None:
    """起點的車站（規則沒寫時：起點那一區景點最常見的最近車站）"""
    p = _Pref(body)
    if rule.start_station and p.node(rule.start_station):
        return rule.start_station
    start = next((c for c in _candidates(p) if c.code == rule.start), None)
    return _common_station(p, start.spots, None) if start else None


def select_towns(body: dict[str, Any], rule: Rule) -> list[Town]:
    """一縣的鎮（起點在第一個）。towns.ts 的 selectTowns 一樣的順序與判斷。"""
    p = _Pref(body)
    cands = _candidates(p)
    start = next((c for c in cands if c.code == rule.start), None)
    if start is None:
        return []
    land = _land_of(p, rule.start)
    out: list[Town] = []

    start_station = (
        rule.start_station
        if rule.start_station and p.node(rule.start_station)
        else _common_station(p, start.spots, None)
    )
    if rule.transit == "rail" and not start_station:
        return []
    start_main = _station_stop(p, start_station, "main") if start_station else _bus_stop(p, start)
    extra: list[Stop] = []
    if rule.start_stop == "airport":
        ap = _airport_of(start.spots)
        if ap:
            extra.append(
                Stop("airport", "airport", ap["n"], ap["lat"], ap["lng"], spot_id=ap["id"])
            )
            near = _nearest_station(p, ap, 1.5, start_station) if start_station else None
            if near and near != start_station:
                extra.append(_station_stop(p, near, f"st:{near}"))
    if start_main.kind == "monorail" and start_station:
        far = next(
            (
                s
                for s in start.spots
                if s.get("st")
                and s["st"] != start_station
                and p.rail_km(start_station, s["st"]) is not None
                and _km_between(s, {"lat": start_main.lat, "lng": start_main.lng}) > 1.5
            ),
            None,
        )
        if far and not any(e.station_id == far["st"] for e in extra):
            extra.append(_station_stop(p, far["st"], f"st:{far['st']}"))
    if rule.transit == "bus" and start_main.kind != "bus":
        extra.append(Stop("bus", "bus", p.muns[start.code]["n"], start_main.lat, start_main.lng))
    out.append(_town(p, start, start_main, False, extra))

    per_city: dict[str, int] = {}

    def bump(code: str) -> None:
        city = p.muns[code].get("c")
        if city:
            per_city[city] = per_city.get(city, 0) + 1

    bump(start.code)
    #: 分散的時候不算的鎮（起點、include）
    fixed = {rule.start, *rule.include}

    def far_enough(main: Stop) -> bool:
        here = {"lat": main.lat, "lng": main.lng}
        dists = [_km_between(here, {"lat": t.main.lat, "lng": t.main.lng}) for t in out]
        if rule.min_km and any(d < rule.min_km for d in dists):
            return False
        if rule.cluster and sum(1 for d in dists if d <= rule.cluster[0]) + 1 > rule.cluster[1]:
            return False
        return True

    def add_land(c: _Cand, cap_city: bool, castle: bool = False) -> bool:
        if len(out) >= rule.count or any(t.id == c.code for t in out):
            return False
        if land is not None and c.code not in land:
            return False
        city = p.muns[c.code].get("c")
        if cap_city and rule.max_per_city and city and per_city.get(city, 0) >= rule.max_per_city:
            return False
        if rule.transit in ("rail", "mixed"):
            st = _common_station(p, c.spots, start_station)
            if not st and castle and rule.castle_station_km and start_station:
                lat, lng = _label_point(p, c)
                st = _nearest_station(
                    p, {"lat": lat, "lng": lng}, rule.castle_station_km, start_station
                )
            if st:
                main = _station_stop(p, st, "main")
            elif rule.transit == "mixed":
                main = _bus_stop(p, c)
            else:
                return False
        else:
            main = _bus_stop(p, c)
        if main.station_id and any(t.main.station_id == main.station_id for t in out):
            return False
        if c.code not in fixed and not far_enough(main):
            return False
        out.append(_town(p, c, main, False, []))
        bump(c.code)
        return True

    # 起點之後一定放的鎮
    for code in rule.include:
        c = next((x for x in cands if x.code == code), None)
        if c:
            add_land(c, False)

    # 有名城蓋章地點的市区町村（分數高的先；P3 最多 max_castles 個）
    castle_towns = {p.spot_by_id[sid].get("m") for sid in p.castle_spots() if sid in p.spot_by_id}
    castles = 0
    for c in cands:
        if c.code in castle_towns:
            if rule.max_castles is not None and castles >= rule.max_castles:
                break
            if add_land(c, False, True):
                castles += 1

    # 離島
    if rule.islands > 0 and land is not None:
        for c in cands:
            if len(out) >= rule.count or sum(1 for t in out if t.island) >= rule.islands:
                break
            if c.code in land:
                continue
            ap = _airport_of(c.spots)
            if not ap:
                continue
            main = Stop("main", "airport", ap["n"], ap["lat"], ap["lng"], spot_id=ap["id"])
            out.append(_town(p, c, main, True, []))

    # 其他（照分數）
    for c in cands:
        if len(out) >= rule.count:
            break
        add_land(c, True)
    return out


# ---------- 縣之間的交通 ----------
@dataclass(frozen=True)
class RailLink:
    a: str
    b: str
    #: 坐新幹線（車窗畫新幹線；路徑上新幹線也要 ≥ 20 km）
    shinkansen: bool = False


@dataclass(frozen=True)
class AirLink:
    """a 的起點（鐵路的鎮）坐電車到 gateway（a 縣的機場景點的名字）→ 飛到 b 的起點的機場"""

    a: str
    gateway: str
    b: str


#: 順序就是剪票口、機場櫃台的目的地順序（京都 ↔ 沖繩是 P2 就有的，排最前面）
CROSS: list[RailLink | AirLink] = [
    AirLink("kyoto", "関西国際空港", "okinawa"),
    RailLink("kyoto", "nara"),
    RailLink("kyoto", "osaka"),
    RailLink("kyoto", "tokyo", shinkansen=True),
    RailLink("osaka", "hyogo"),
    RailLink("osaka", "nara"),
    AirLink("osaka", "関西国際空港", "okinawa"),
    AirLink("osaka", "関西国際空港", "hokkaido"),
    AirLink("tokyo", "東京国際空港", "hokkaido"),
    AirLink("tokyo", "東京国際空港", "okinawa"),
]


def _leg(mode: str, km: float, kind: str, to: str, shinkansen: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {"mode": mode, "km": km, "kmKind": kind, "to": to}
    if shinkansen:
        out["shinkansen"] = True
    return out


def _link(
    a: Town, a_stop: str, b: Town, b_stop: str, mode: str, legs: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": f"{a.id}.{a_stop}>{b.id}.{b_stop}",
        "from": a.id,
        "fromPref": a.pref,
        "fromStop": a_stop,
        "to": b.id,
        "toPref": b.pref,
        "toStop": b_stop,
        "mode": mode,
        "legs": legs,
        "name": legs[-1]["to"],
    }


def _rail(full: Graph, a: str, b: str) -> tuple[float, bool] | None:
    """全國路網上 a → b 的鐵路 km、有沒有搭新幹線（≥ 20 km）"""
    if a not in full.index or b not in full.index:
        return None
    src, dst = full.index[a], full.index[b]
    km, skm, _ = _search(full, src, target=dst)
    if dst not in km:
        return None
    return round(km[dst], 1), skm[dst] >= SHINKANSEN_MIN_KM


def cross_links(
    towns: dict[str, list[Town]],
    maps: dict[str, list[dict[str, Any]]],
    full: Graph,
    cross: list[RailLink | AirLink] | None = None,
) -> list[dict[str, Any]]:
    """縣與縣之間（單向，兩個方向都有）：電車、經機場的飛機。maps：縣 → 地圖 bundle（轉乘的機場）"""
    out: list[dict[str, Any]] = []
    for c in CROSS if cross is None else cross:
        ta = (towns.get(c.a) or [None])[0]
        tb = (towns.get(c.b) or [None])[0]
        if ta is None or tb is None or ta.main.kind != "rail":
            continue
        sa = ta.main
        if isinstance(c, RailLink):
            if tb.main.kind != "rail":
                continue
            r = _rail(full, ta.station_id, tb.station_id)
            if r is None:
                continue
            shin = c.shinkansen and r[1]
            out.append(
                _link(
                    ta, "main", tb, "main", "rail", [_leg("rail", r[0], "rail", tb.main.name, shin)]
                )
            )
            out.append(
                _link(tb, "main", ta, "main", "rail", [_leg("rail", r[0], "rail", sa.name, shin)])
            )
            continue
        ap = next((s for s in tb.stops if s.id == "airport"), None)
        if ap is None:
            continue
        # 轉乘的機場：景點（類型 機場、名字對得上；京都的是大阪的関西国際空港）
        gw = next(
            (
                s
                for spots in maps.values()
                for s in spots
                if s.get("c") == "機場" and s.get("n") == c.gateway
            ),
            None,
        )
        dst = {"lat": ap.lat, "lng": ap.lng}
        via = _rail(full, ta.station_id, gw["st"]) if gw and gw.get("st") else None
        if gw and via:
            back = via
            fly = _round_js1(_km_between(gw, dst))
            out.append(
                _link(
                    ta,
                    "main",
                    tb,
                    "airport",
                    "rail",
                    [
                        _leg("rail", via[0], "rail", gw["n"]),
                        _leg("plane", fly, "straight", ap.name),
                    ],
                )
            )
            out.append(
                _link(
                    tb,
                    "airport",
                    ta,
                    "main",
                    "plane",
                    [
                        _leg("plane", fly, "straight", gw["n"]),
                        _leg("rail", back[0], "rail", sa.name),
                    ],
                )
            )
        else:
            # 轉乘的機場的資料沒有：從車站直接飛（直線 km 從車站算），不寫轉乘的機場名
            # （towns.ts 的 crossLinks 一樣）
            fly = _round_js1(_km_between({"lat": sa.lat, "lng": sa.lng}, dst))
            out.append(
                _link(ta, "main", tb, "airport", "plane", [_leg("plane", fly, "straight", ap.name)])
            )
            out.append(
                _link(tb, "airport", ta, "main", "plane", [_leg("plane", fly, "straight", sa.name)])
            )
    return out


def _stop_json(s: Stop) -> dict[str, Any]:
    out: dict[str, Any] = {"id": s.id, "kind": s.kind, "name": s.name}
    if s.station_id:
        out["stationId"] = s.station_id
    if s.spot_id:
        out["spotId"] = s.spot_id
    return out


def town_json(t: Town) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": t.id,
        "name": t.name,
        "station": {"id": t.station_id, "name": t.main.name, "kind": t.main.kind},
        "center": {"lat": round(t.main.lat, 5), "lng": round(t.main.lng, 5)},
        "stops": [_stop_json(s) for s in t.stops],
    }
    if t.city:
        out["city"] = t.city
    if t.island:
        out["island"] = True
    return out


def world_index(
    bodies: dict[str, dict[str, Any]],
    maps: dict[str, list[dict[str, Any]]],
    graph: dict[str, Any],
    order: tuple[str, ...],
) -> tuple[dict[str, Any], dict[str, list[Town]]]:
    """bodies：縣 → game bundle；maps：縣 → 地圖 bundle（機場的景點）；回傳（索引, 縣 → 鎮）"""
    towns: dict[str, list[Town]] = {}
    for pref in order:
        body = bodies.get(pref)
        rule = RULES.get(pref)
        if body is None or rule is None:
            continue
        lst = select_towns(body, rule)
        if lst:
            towns[pref] = lst
    full = from_bundle(graph)
    links = cross_links(towns, maps, full)
    index = {
        "v": WORLD_VERSION,
        "start": START_PREF if START_PREF in towns else next(iter(towns), ""),
        "attribution": {
            "rail": graph.get("attribution", "© OpenStreetMap contributors"),
            "straight": "国土数値情報（行政区域データ）",
        },
        "prefs": [
            {
                "pref": pref,
                "kit": kit_of(pref),
                "startStop": RULES[pref].start_stop,
                "towns": [town_json(t) for t in towns[pref]],
            }
            for pref in order
            if pref in towns
        ],
        "links": links,
    }
    return index, towns
