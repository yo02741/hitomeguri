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


def _area(iso: str) -> str:
    return f'area["ISO3166-2"="{iso}"]["admin_level"="4"]->.a;'


def attractions(iso: str) -> list[OsmElement]:
    q = f"""[out:json][timeout:300];
{_area(iso)}
(
  nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium|theme_park)$"]["name"](area.a);
  nwr["historic"~"^(castle|ruins|archaeological_site|monument|city_gate|fort|palace)$"]["name"](area.a);
  nwr["amenity"="place_of_worship"]["wikidata"]["name"](area.a);
  nwr["leisure"~"^(park|garden)$"]["wikidata"]["name"](area.a);
);
out center tags;"""
    return _run(q)


def stations(iso: str) -> list[OsmElement]:
    q = f"""[out:json][timeout:300];
{_area(iso)}
(
  node["railway"="station"]["name"](area.a);
  node["railway"="halt"]["name"](area.a);
);
out tags;"""
    return _run(q)
