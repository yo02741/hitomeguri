"""番外篇從台灣出發（pipeline/game_taiwan.py）：降落的地方（鎮的機場大廳、自己的大廳、沒有大廳）、
機場到鎮的路（鐵路 km 的上限、沒有車站時的巴士、遊戲裡的機場大廳照縣內的交通）、航線的排序。"""

import math

from pipeline.game_taiwan import ACCESS_RAIL_KM, CITIES, taiwan_index
from pipeline.game_world import Stop, Town
from pipeline.geo import haversine_m
from pipeline.rail_graph import from_bundle


def _graph() -> dict:
    """一條線：機場站 kix —40— 大阪 osk —80— 京都 kyo；成田站 nrt —60— 東京 tok；中部站 ngo —300— kyo"""
    nodes = [
        ["kix", "関西空港", 34.43, 135.24, "osaka", 0],
        ["osk", "大阪", 34.70, 135.50, "osaka", 0],
        ["kyo", "京都", 34.98, 135.76, "kyoto", 0],
        ["nrt", "成田空港", 35.76, 140.39, "chiba", 0],
        ["tok", "東京", 35.68, 139.77, "tokyo", 0],
        ["ngo", "中部国際空港", 34.86, 136.81, "aichi", 0],
        ["nah", "県庁前", 26.21, 127.68, "okinawa", 0],
    ]
    ix = {n[0]: i for i, n in enumerate(nodes)}
    edges = [
        ("kix", "osk", 40.0, 0),
        ("osk", "kyo", 80.0, 1),
        ("nrt", "tok", 60.0, 0),
        ("ngo", "kyo", 300.0, 1),
    ]
    return {"nodes": nodes, "edges": [[ix[a], ix[b], km, k] for a, b, km, k in edges]}


def _town(
    code: str, pref: str, main: Stop, extra: list[Stop] | None = None, island: bool = False
) -> Town:
    return Town(code, pref, {"ja": f"町{code}"}, None, main, island, [main, *(extra or [])])


def _rail(sid: str, name: str, lat: float, lng: float) -> Stop:
    return Stop("main", "rail", name, lat, lng, station_id=sid)


def _towns() -> dict[str, list[Town]]:
    naha_ap = Stop("airport", "airport", "那覇空港", 26.20, 127.65, spot_id="wd-OKA")
    naha_bus = Stop("bus", "bus", "那覇市", 26.21, 127.68)
    return {
        "osaka": [_town("OS", "osaka", _rail("osk", "大阪", 34.70, 135.50))],
        "kyoto": [_town("KY", "kyoto", _rail("kyo", "京都", 34.98, 135.76))],
        "tokyo": [_town("TK", "tokyo", _rail("tok", "東京", 35.68, 139.77))],
        "okinawa": [
            _town(
                "NH",
                "okinawa",
                Stop("main", "monorail", "県庁前", 26.21, 127.68, station_id="nah"),
                [naha_ap, naha_bus],
            ),
            _town("NG", "okinawa", Stop("main", "bus", "町NG", 26.59, 127.98)),
            _town(
                "MY",
                "okinawa",
                Stop("main", "airport", "下地島空港", 24.83, 125.14, spot_id="wd-SHI"),
                island=True,
            ),
        ],
        "hokkaido": [_town("HK", "hokkaido", _rail("hkd", "函館", 41.77, 140.73))],
    }


AIRPORTS = {
    "wd-KIX": {
        "id": "wd-KIX",
        "n": "関西国際空港",
        "c": "機場",
        "lat": 34.43,
        "lng": 135.23,
        "st": "kix",
    },
    "wd-NRT": {
        "id": "wd-NRT",
        "n": "成田国際空港",
        "c": "機場",
        "lat": 35.76,
        "lng": 140.39,
        "st": "nrt",
    },
    "wd-NGO": {
        "id": "wd-NGO",
        "n": "中部国際空港",
        "c": "機場",
        "lat": 34.86,
        "lng": 136.81,
        "st": "ngo",
    },
    "wd-OKA": {"id": "wd-OKA", "n": "那覇空港", "c": "機場", "lat": 26.20, "lng": 127.65},
    "wd-HKD": {"id": "wd-HKD", "n": "函館空港", "c": "機場", "lat": 41.77, "lng": 140.82},
    "wd-ISG": {"id": "wd-ISG", "n": "石垣空港", "c": "機場", "lat": 24.40, "lng": 124.25},
    "wd-SDJ": {"id": "wd-SDJ", "n": "仙台空港", "c": "機場", "lat": 38.14, "lng": 140.92},
}


def _route(city: str, aid: str, iata: str, short: str, pref: str, weekly: float) -> dict:
    return {
        "city": city,
        "airport": aid,
        "iata": iata,
        "name_ja": short,
        "prefecture": pref,
        "airlines": [{"code": "XX", "name": "テスト航空", "weekly": weekly}],
        "weekly": weekly,
    }


ROUTES = {
    "source": {"url": "https://www.mlit.go.jp/koku/content/x.xlsx", "fetched_at": "2026-10-17"},
    "season": "2026夏ダイヤ",
    "routes": [
        _route("台中", "wd-NGO", "NGO", "中部", "aichi", 3),
        _route("台中", "wd-NRT", "NRT", "成田", "chiba", 4),
        _route("台中", "wd-OKA", "OKA", "那覇", "okinawa", 16),
        _route("台北", "wd-KIX", "KIX", "関西", "osaka", 107),
        _route("台北", "wd-OKA", "OKA", "那覇", "okinawa", 70),
        _route("台北", "wd-HKD", "HKD", "函館", "hokkaido", 8),
        _route("台北", "wd-ISG", "ISG", "石垣", "okinawa", 2),
        _route("台北", "wd-SDJ", "SDJ", "仙台", "miyagi", 17),
        _route("香港", "wd-KIX", "KIX", "関西", "osaka", 50),
    ],
}


def _index() -> dict:
    out = taiwan_index(ROUTES, _towns(), AIRPORTS, from_bundle(_graph()))
    assert out is not None
    return out


def _airport(idx: dict, iata: str) -> dict:
    return next(a for a in idx["airports"] if a["iata"] == iata)


def test_no_routes() -> None:
    assert taiwan_index(None, _towns(), AIRPORTS, from_bundle(_graph())) is None
    assert taiwan_index({"routes": []}, _towns(), AIRPORTS, from_bundle(_graph())) is None


def test_source_cities_and_route_order() -> None:
    idx = _index()
    assert idx["source"] == {
        "url": ROUTES["source"]["url"],
        "fetched_at": "2026-10-17",
        "season": "2026夏ダイヤ",
    }
    # 台灣的城市（北到南；表上沒有的不列）；香港這種不是台灣的城市不收
    assert idx["cities"] == ["台北", "台中"]
    assert list(CITIES) == ["台北", "台中", "高雄"]
    keys = [(r["city"], r["airport"]) for r in idx["routes"]]
    assert keys[0] == ("台北", "wd-KIX") and keys[-1] == ("台中", "wd-NGO")
    # 每週班次多的在前
    tc = [r["weekly"] for r in idx["routes"] if r["city"] == "台中"]
    assert tc == sorted(tc, reverse=True)
    assert idx["routes"][0]["airlines"] == [{"code": "XX", "name": "テスト航空", "weekly": 107}]


def test_airline_names_zh() -> None:
    """航空公司的繁體中文名（data/flights/airline_names.json）：代碼對得上的加 zh，表裡的名字照舊"""
    out = taiwan_index(ROUTES, _towns(), AIRPORTS, from_bundle(_graph()), {"XX": "測試航空"})
    assert out is not None
    assert out["routes"][0]["airlines"] == [
        {"code": "XX", "name": "テスト航空", "zh": "測試航空", "weekly": 107}
    ]
    # 對不上的不加（畫面上照表的名字）
    out = taiwan_index(ROUTES, _towns(), AIRPORTS, from_bundle(_graph()), {"YY": "別的航空"})
    assert out is not None
    assert "zh" not in out["routes"][0]["airlines"][0]


def test_airline_names_file() -> None:
    """data/flights/airline_names.json：代碼不重複、照代碼排、每一筆有出處與取得的日期"""
    import json

    from pipeline.paths import AIRLINE_NAMES_JSON, TAIWAN_ROUTES_JSON

    body = json.loads(AIRLINE_NAMES_JSON.read_text(encoding="utf-8"))
    rows = body["airlines"]
    codes = [a["code"] for a in rows]
    assert codes == sorted(set(codes))
    for a in rows:
        assert a["name_zh"] and a["source_url"].startswith("https://") and a["fetched_at"]
    # 表裡出現的航空公司都有中文名
    routes = json.loads(TAIWAN_ROUTES_JSON.read_text(encoding="utf-8"))
    used = {x["code"] for r in routes["routes"] for x in r.get("airlines", []) if x.get("code")}
    assert used <= set(codes)


def test_halls() -> None:
    idx = _index()
    # 鎮的機場：降在那一鎮的機場大廳
    assert _airport(idx, "OKA")["hall"] == {"town": "NH", "stop": "airport"}
    # 遊戲的縣裡、不是哪一鎮的機場：自己的大廳
    assert _airport(idx, "KIX")["hall"] == "own"
    assert _airport(idx, "HKD")["hall"] == "own"
    # 不在遊戲的縣裡：沒有大廳（飛到之後直接坐電車）
    assert _airport(idx, "NGO")["hall"] is None
    assert _airport(idx, "SDJ")["hall"] is None
    kix = _airport(idx, "KIX")
    assert kix["name"] == "関西国際空港" and kix["short"] == "関西" and kix["pref"] == "osaka"


def test_rail_access_and_cap() -> None:
    idx = _index()
    kix = _airport(idx, "KIX")["access"]
    assert [a["town"] for a in kix] == ["OS", "KY"]
    assert kix[0]["legs"] == [{"mode": "rail", "km": 40.0, "kmKind": "rail", "to": "大阪"}]
    # 新幹線（kind 1）≥ 20 km 的路徑標 shinkansen
    assert kix[1]["km"] == 120.0 and kix[1]["legs"][0]["shinkansen"] is True
    nrt = _airport(idx, "NRT")["access"]
    assert nrt == [
        {
            "town": "TK",
            "legs": [{"mode": "rail", "km": 60.0, "kmKind": "rail", "to": "東京"}],
            "km": 60.0,
        }
    ]
    # 中部 → 京都 300 km：超過上限，接不到（看板上是灰的）
    assert 300.0 > ACCESS_RAIL_KM
    assert _airport(idx, "NGO")["access"] == []


def test_bus_access_and_unreachable() -> None:
    idx = _index()
    hkd = _airport(idx, "HKD")["access"]
    km = math.floor(haversine_m(41.77, 140.82, 41.77, 140.73) / 100 + 0.5) / 10
    assert hkd == [
        {
            "town": "HK",
            "legs": [{"mode": "bus", "km": km, "kmKind": "straight", "to": "町HK"}],
            "km": km,
        }
    ]
    # 石垣、仙台：沒有車站、附近沒有遊戲的鎮
    assert _airport(idx, "ISG")["access"] == []
    assert _airport(idx, "SDJ")["access"] == []


def test_in_town_hall_uses_pref_transit() -> None:
    idx = _index()
    oka = {a["town"]: a for a in _airport(idx, "OKA")["access"]}
    # 自己的鎮：0 km
    assert oka["NH"] == {"town": "NH", "legs": [], "km": 0}
    # 沖繩本島：巴士（那覇市的巴士站 → 那一鎮的巴士站，直線 km）
    bus = math.floor(haversine_m(26.21, 127.68, 26.59, 127.98) / 100 + 0.5) / 10
    assert oka["NG"]["legs"] == [{"mode": "bus", "km": bus, "kmKind": "straight", "to": "町NG"}]
    # 離島：飛機（機場 → 離島的機場，直線 km）
    fly = math.floor(haversine_m(26.20, 127.65, 24.83, 125.14) / 100 + 0.5) / 10
    assert oka["MY"]["legs"] == [
        {"mode": "plane", "km": fly, "kmKind": "straight", "to": "下地島空港"}
    ]
