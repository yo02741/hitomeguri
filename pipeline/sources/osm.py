"""OpenStreetMap（Overpass API）：大點候選與車站。

以都道府縣 relation 的 ISO3166-2 tag 圈定範圍，不需要寫死 OSM id。
OSM 資料以 ODbL 授權，UI 需標示「© OpenStreetMap contributors」。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from pipeline.http import post_json

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


@dataclass
class OsmElement:
    osm_id: str  # 例 "node/123"
    lat: float
    lng: float
    tags: dict[str, str] = field(default_factory=dict)

    @property
    def url(self) -> str:
        return f"https://www.openstreetmap.org/{self.osm_id}"


def _run(query: str) -> list[OsmElement]:
    last_err: Exception | None = None
    for url in ENDPOINTS:
        try:
            data = post_json(url, data={"data": query}, min_interval=2.0, retries=3)
            remark = data.get("remark", "")
            if "runtime error" in remark or "timed out" in remark:
                raise RuntimeError(remark)
            break
        except Exception as e:  # noqa: BLE001 — 換下一個鏡像
            last_err = e
    else:
        raise RuntimeError(f"Overpass 全部失敗：{last_err}")
    out = []
    for el in data.get("elements", []):
        if "lat" in el:
            lat, lng = el["lat"], el["lon"]
        elif "center" in el:
            lat, lng = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        out.append(OsmElement(f"{el['type']}/{el['id']}", lat, lng, el.get("tags", {})))
    return out


def raw(query: str) -> dict:
    """Overpass 原始回應（需要幾何的查詢用，例如鐵路路線）。"""
    last_err: Exception | None = None
    for url in ENDPOINTS:
        try:
            data = post_json(url, data={"data": query}, min_interval=2.0, retries=3)
            remark = data.get("remark", "")
            if "runtime error" in remark or "timed out" in remark:
                raise RuntimeError(remark)
            return data
        except Exception as e:  # noqa: BLE001 — 換下一個鏡像
            last_err = e
    raise RuntimeError(f"Overpass 全部失敗：{last_err}")


# route=railway 是軌道本身（「函館本線」「山陰本線」）：地方的 JR 線多半沒有 route=train 的列車路線
RAIL_ROUTES = "^(train|subway|light_rail|monorail|tram|railway)$"


# 營運中的旅客線軌道：廃線（railway=abandoned|disused）、建設中、貨物線、站場內的側線不算
RAIL_ACTIVE_WAY = (
    '["railway"~"^(rail|light_rail|subway|monorail|narrow_gauge|tram)$"]'
    '["usage"!~"^(freight|industrial|military)$"]["service"!~"."]'
)


def rail_routes(iso: str) -> dict:
    """縣內的鐵路路線 relation（含成員路段的幾何），以及營運中的旅客線路段 id（way）。"""
    q = f"""[out:json][timeout:900];
{_area(iso)}
relation["type"="route"]["route"~"{RAIL_ROUTES}"](area.a)->.rels;
.rels out geom;
way(r.rels){RAIL_ACTIVE_WAY};
out ids;"""
    return raw(q)


def _area(iso: str) -> str:
    return f'area["ISO3166-2"="{iso}"]["admin_level"="4"]->.a;'


_ATTRACTION_FILTERS = [
    '["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium|theme_park)$"]["name"]',
    '["historic"~"^(castle|ruins|archaeological_site|monument|city_gate|fort|palace)$"]["name"]',
    '["amenity"="place_of_worship"]["wikidata"]["name"]',
    '["leisure"~"^(park|garden)$"]["wikidata"]["name"]',
]


def attractions(iso: str) -> list[OsmElement]:
    """以縣的 area 查詢；OSM 內已確定在縣內。"""
    body = "\n".join(f"  nwr{f}(area.a);" for f in _ATTRACTION_FILTERS)
    q = f"""[out:json][timeout:300];
{_area(iso)}
(
{body}
);
out center tags;"""
    return _run(q)


def attractions_bbox(bbox: tuple[float, float, float, float]) -> list[OsmElement]:
    """area 查詢失敗或回傳 0 筆時的備援：範圍框查詢，呼叫端再用縣界過濾。"""
    s, w, n, e = bbox
    body = "\n".join(f"  nwr{f}({s},{w},{n},{e});" for f in _ATTRACTION_FILTERS)
    q = f"""[out:json][timeout:300];
(
{body}
);
out center tags;"""
    return _run(q)


def stations(bbox: tuple[float, float, float, float]) -> list[OsmElement]:
    """車站用範圍框查詢（比 area 查詢快很多；縣界附近的鄰縣車站也一併納入）。"""
    s, w, n, e = bbox
    q = f"""[out:json][timeout:180];
node["railway"~"^(station|halt)$"]["name"]({s},{w},{n},{e});
out;"""
    return _run(q)


# 擴充包：寶可夢中心與寶可夢商店（全國一次查詢，pipeline.packs）
POKEMON_SHOP_FILTER = (
    '["shop"]["name"~"ポケモンセンター|ポケモンストア|Pokémon Center|Pokémon Store"]'
)


def pokemon_shops() -> list[OsmElement]:
    q = f"""[out:json][timeout:300];
area["ISO3166-1"="JP"]["admin_level"="2"]->.a;
nwr{POKEMON_SHOP_FILTER}(area.a);
out center tags;"""
    return _run(q)


def japan(filters: list[str], timeout: int = 300) -> list[OsmElement]:
    """全國一次查詢：filters 是 Overpass 的 tag 條件（例 '["shop"]["name"~"…"]'），取聯集。"""
    body = "\n".join(f"  nwr{f}(area.a);" for f in filters)
    q = f"""[out:json][timeout:{timeout}];
area["ISO3166-1"="JP"]["admin_level"="2"]->.a;
(
{body}
);
out center tags;"""
    return _run(q)


def by_prefecture(filters: list[str], timeout: int = 180) -> tuple[list[OsmElement], list[str]]:
    """各縣分開查（全國一次查名稱比對太重，Overpass 會逾時）；縣的 area 查詢失敗就改用範圍框。

    回傳（去重後的物件, 兩種查詢都失敗的縣）。範圍框的結果會含鄰縣的點，呼叫端依座標判斷所屬縣。
    """
    from pipeline import geo

    seen: dict[str, OsmElement] = {}
    failed: list[str] = []
    for pref in geo.pref_slugs():
        body = "\n".join(f"  nwr{f}(area.a);" for f in filters)
        q = f"""[out:json][timeout:{timeout}];
{_area(geo.iso_code(pref))}
(
{body}
);
out center tags;"""
        try:
            els = _run(q)
        except RuntimeError:
            s, w, n, e = geo.bbox(pref)
            body = "\n".join(f"  nwr{f}({s},{w},{n},{e});" for f in filters)
            try:
                els = _run(f"[out:json][timeout:{timeout}];\n(\n{body}\n);\nout center tags;")
            except RuntimeError:
                failed.append(pref)
                continue
        for el in els:
            seen.setdefault(el.osm_id, el)
    return list(seen.values()), failed
