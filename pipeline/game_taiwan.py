"""番外篇（/play）從台灣出發（P4）：世界索引 game/_world.json 的 taiwan 段。

使用者決定（2026-10-17）：新遊戲先選出發的城市（台北、台中、高雄），從那個城市的機場出發大廳
（遊戲裡只做機場，不做城市）飛到日本。航線照 data/flights/taiwan_routes.json（国土交通省
「各空港における国際線就航状況調べ」的直飛航線：航空公司、每週班次；台北不分桃園、松山）。

這裡把航線接到遊戲的鎮：
- 降落的地方（hall）：
  - 機場是遊戲裡某一鎮的機場（那覇空港＝那覇市、新千歳空港＝千歳市）：降在那一鎮的機場大廳。
  - 機場在遊戲的縣裡、但不是哪一鎮的機場（関西国際空港、東京国際空港、函館空港）：遊戲另外做一間
    這個機場的大廳（own），從那裡坐電車或巴士到鎮上。
  - 不在遊戲的縣裡（成田国際空港、中部国際空港…）：沒有大廳，飛到之後直接坐電車到鎮上
    （「飛到成田 → 坐電車到東京」一段路線）。
- 到各鎮的路（access）：
  - 鐵路：機場景點的最近車站（地圖 bundle 的 st）到鎮的代表站，全國 rail-graph 的鐵路 km
    （新幹線權重同日帰り；路徑上新幹線 ≥ 20 km 標 shinkansen）。只收 ACCESS_RAIL_KM 以內的鎮
    （遊戲規則：再遠就不算「接得到」，例：仙台空港 → 東京 約 326 km、
  福岡空港 → 姫路 約 469 km 不收）。
  - 機場沒有車站（函館空港）：ACCESS_BUS_KM 內的鎮坐巴士（直線 km）。
  - 遊戲裡的機場大廳（那覇、新千歳）：那一縣的鎮照遊戲裡的交通走（towns.ts 的 prefLinks 同一套：
    沖繩坐巴士、離島坐飛機；北海道有鐵路的坐電車、沒有的先坐電車到最近的鐵路鎮再坐巴士）。
  接不到任何鎮的機場（石垣空港、仙台空港、小松空港…）出發看板上是灰的。
- 台灣那一邊沒有座標資料（台北也不分桃園、松山），飛機那一段不寫 km；不寫時刻、票價。
km 的小數照前端（鐵路：round(x, 1)；直線：JS 的 Math.round(x * 10) / 10）。
"""

from __future__ import annotations

from typing import Any

from pipeline.game_world import RULES, Town, _km_between, _round_js1
from pipeline.rail_graph import SHINKANSEN_MIN_KM, Graph, _search

#: 台灣的城市（北到南）→ 遊戲裡的 id（地圖 tw:<id>）
CITIES: dict[str, str] = {"台北": "taipei", "台中": "taichung", "高雄": "kaohsiung"}
#: 機場到鎮的鐵路最多幾 km（遊戲規則）
ACCESS_RAIL_KM = 250.0
#: 機場沒有車站時，巴士最多幾 km（直線）
ACCESS_BUS_KM = 30.0
#: 鐵路的鎮（代表站是電車、單軌的站）
RAIL_KINDS = ("rail", "monorail")


def _leg(mode: str, km: float, kind: str, to: str, shinkansen: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {"mode": mode, "km": km, "kmKind": kind, "to": to}
    if shinkansen:
        out["shinkansen"] = True
    return out


def _access(town: Town, legs: list[dict[str, Any]]) -> dict[str, Any]:
    return {"town": town.id, "legs": legs, "km": round(sum(x["km"] for x in legs), 1)}


class _Reach:
    """全國路網上一個起點到各站的鐵路 km（一次 Dijkstra）"""

    def __init__(self, full: Graph, src: str) -> None:
        self.full = full
        self.km: dict[int, float] = {}
        self.skm: dict[int, float] = {}
        if src in full.index:
            self.km, self.skm, _ = _search(full, full.index[src])

    def to(self, dst: str) -> tuple[float, bool] | None:
        i = self.full.index.get(dst)
        if i is None or i not in self.km:
            return None
        return round(self.km[i], 1), self.skm[i] >= SHINKANSEN_MIN_KM


def _bus_stop(t: Town) -> tuple[float, float]:
    """巴士站：有 bus 這個停靠點（那覇市在車站前）就用它，沒有就是代表點（巴士的鎮）"""
    s = next((x for x in t.stops if x.kind == "bus"), t.main)
    return s.lat, s.lng


def _hub(towns: list[Town], t: Town) -> Town | None:
    """巴士的鎮接到哪一個鐵路的鎮（towns.ts 的 hubOf：代表點最近的；一樣近取 id 小的）"""
    best: Town | None = None
    bd = float("inf")
    for x in towns:
        if x is t or x.main.kind in ("bus", "airport"):
            continue
        d = _km_between(
            {"lat": t.stops[0].lat, "lng": t.stops[0].lng},
            {"lat": x.stops[0].lat, "lng": x.stops[0].lng},
        )
        if d < bd or (d == bd and best is not None and x.id < best.id):
            best, bd = x, d
    return best


def _in_town_access(home: Town, towns: list[Town], full: Graph) -> list[dict[str, Any]]:
    """遊戲裡的機場大廳（那覇市、千歳市）到同一縣的鎮：照遊戲裡的交通（towns.ts 的 prefLinks）"""
    rule = RULES.get(home.pref)
    transit = rule.transit if rule else "rail"
    ap = next((s for s in home.stops if s.id == "airport"), home.main)
    reach = _Reach(full, home.main.station_id) if home.main.station_id else None
    out = [_access(home, [])]
    for t in towns:
        if t is home:
            continue
        if t.island:
            km = _round_js1(
                _km_between({"lat": ap.lat, "lng": ap.lng}, {"lat": t.main.lat, "lng": t.main.lng})
            )
            out.append(_access(t, [_leg("plane", km, "straight", t.main.name)]))
            continue
        if transit == "bus":
            a, b = _bus_stop(home), _bus_stop(t)
            km = _round_js1(_km_between({"lat": a[0], "lng": a[1]}, {"lat": b[0], "lng": b[1]}))
            out.append(_access(t, [_leg("bus", km, "straight", t.name["ja"])]))
            continue
        if t.main.kind in RAIL_KINDS and t.main.station_id and reach:
            r = reach.to(t.main.station_id)
            if r:
                out.append(_access(t, [_leg("rail", r[0], "rail", t.main.name, r[1])]))
            continue
        if transit == "mixed" and t.main.kind == "bus":
            hub = _hub(towns, t)
            if hub is None:
                continue
            legs: list[dict[str, Any]] = []
            if hub is not home:
                r = reach.to(hub.main.station_id) if reach and hub.main.station_id else None
                if r is None:
                    continue
                legs.append(_leg("rail", r[0], "rail", hub.main.name, r[1]))
            km = _round_js1(
                _km_between(
                    {"lat": hub.main.lat, "lng": hub.main.lng},
                    {"lat": t.main.lat, "lng": t.main.lng},
                )
            )
            legs.append(_leg("bus", km, "straight", t.name["ja"]))
            out.append(_access(t, legs))
    return out


def _station_access(
    spot: dict[str, Any], all_towns: list[Town], full: Graph
) -> list[dict[str, Any]]:
    """機場的車站（或巴士）到遊戲的鎮"""
    out: list[dict[str, Any]] = []
    st = spot.get("st")
    if st and st in full.index:
        reach = _Reach(full, st)
        for t in all_towns:
            if t.main.kind not in RAIL_KINDS or not t.main.station_id:
                continue
            r = reach.to(t.main.station_id)
            if r and r[0] <= ACCESS_RAIL_KM:
                out.append(_access(t, [_leg("rail", r[0], "rail", t.main.name, r[1])]))
    else:
        for t in all_towns:
            if t.island:
                continue
            km = _round_js1(_km_between(spot, {"lat": t.main.lat, "lng": t.main.lng}))
            if km <= ACCESS_BUS_KM:
                out.append(_access(t, [_leg("bus", km, "straight", t.name["ja"])]))
    return out


def taiwan_index(
    routes: dict[str, Any] | None,
    towns: dict[str, list[Town]],
    airports: dict[str, dict[str, Any]],
    full: Graph,
    names_zh: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    """routes：data/flights/taiwan_routes.json；towns：縣 → 鎮（world_index 選好的）；
    airports：機場景點的 id → 地圖 bundle 的景點（各縣的 map/{縣}.json）；
    names_zh：航空公司的 IATA 代碼 → 繁體中文名（data/flights/airline_names.json，各公司的網站；
    表裡的名字 name 照舊留著）。沒有航線回 None。"""
    zh = names_zh or {}
    if not routes or not routes.get("routes"):
        return None
    all_towns = [t for lst in towns.values() for t in lst]
    order = {c: i for i, c in enumerate(CITIES)}
    rows = [r for r in routes["routes"] if r.get("city") in CITIES]
    out_airports: list[dict[str, Any]] = []
    seen: set[str] = set()
    for r in sorted(rows, key=lambda x: x["airport"]):
        aid = r["airport"]
        if aid in seen:
            continue
        seen.add(aid)
        spot = airports.get(aid)
        pref = r.get("prefecture", "")
        name = spot["n"] if spot else f"{r['name_ja']}空港"
        home = next(
            (t for t in all_towns if any(s.id == "airport" and s.spot_id == aid for s in t.stops)),
            None,
        )
        hall: Any
        if home is not None:
            hall = {"town": home.id, "stop": "airport"}
            access = _in_town_access(home, towns.get(home.pref, []), full)
        else:
            hall = "own" if pref in towns else None
            access = _station_access(spot, all_towns, full) if spot else []
        access.sort(key=lambda a: (a["km"], a["town"]))
        out_airports.append(
            {
                "id": aid,
                "iata": r["iata"],
                "name": name,
                "short": r["name_ja"],
                "pref": pref,
                "hall": hall,
                "access": access,
            }
        )
    routes_out = [
        {
            "city": r["city"],
            "airport": r["airport"],
            "weekly": r["weekly"],
            "airlines": [
                {
                    "code": a.get("code", ""),
                    "name": a["name"],
                    **({"zh": zh[a["code"]]} if a.get("code") in zh else {}),
                    "weekly": a["weekly"],
                }
                for a in r.get("airlines", [])
            ],
        }
        for r in sorted(rows, key=lambda x: (order[x["city"]], -x["weekly"], x["airport"]))
    ]
    src = routes.get("source") or {}
    return {
        "source": {
            "url": src.get("url", ""),
            "fetched_at": src.get("fetched_at", ""),
            "season": routes.get("season", ""),
        },
        "cities": [c for c in CITIES if any(r["city"] == c for r in rows)],
        "airports": out_airports,
        "routes": routes_out,
    }
