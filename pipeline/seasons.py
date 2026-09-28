"""深度探索「季節」：氣象廳生物季節観測的平年值，依觀測站對到都道府縣（data/seasons.json）。"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from pipeline.models import SeasonData, SeasonStation, Source
from pipeline.paths import SEASONS_JSON
from pipeline.sources import jma

# 旅行會看的現象（氣象廳種目代碼）；前端依 key 顯示中文名稱
PHENOMENA: list[tuple[str, str, str]] = [
    ("ume", "001", "うめ開花"),
    ("sakura_kaika", "004", "さくら開花"),
    ("sakura_mankai", "005", "さくら満開"),
    ("fuji", "007", "のだふじ開花"),
    ("ajisai", "009", "あじさい開花"),
    ("ichou", "013", "いちょう黄葉"),
    ("kaede", "015", "かえで紅葉"),
]

# 觀測站 → 都道府縣。每縣第一個是代表站（縣廳所在地的氣象台）
STATIONS: dict[str, list[str]] = {
    "hokkaido": ["札幌", "函館", "旭川", "釧路", "帯広", "網走", "稚内", "室蘭", "根室",
                 "留萌", "岩見沢", "倶知安", "寿都", "浦河", "江差", "紋別", "雄武", "羽幌",
                 "苫小牧", "広尾", "小樽"],
    "aomori": ["青森", "八戸", "むつ", "深浦"],
    "iwate": ["盛岡", "宮古", "大船渡"],
    "miyagi": ["仙台", "石巻"],
    "akita": ["秋田"],
    "yamagata": ["山形", "酒田", "新庄"],
    "fukushima": ["福島", "若松", "小名浜", "白河"],
    "ibaraki": ["水戸", "館野"],
    "tochigi": ["宇都宮", "日光"],
    "gunma": ["前橋"],
    "saitama": ["熊谷", "秩父"],
    "chiba": ["銚子", "千葉", "館山", "勝浦"],
    "tokyo": ["東京", "大島", "八丈島", "三宅島", "父島"],
    "kanagawa": ["横浜"],
    "niigata": ["新潟", "高田", "相川"],
    "toyama": ["富山", "伏木"],
    "ishikawa": ["金沢", "輪島"],
    "fukui": ["福井", "敦賀"],
    "yamanashi": ["甲府", "河口湖"],
    "nagano": ["長野", "松本", "飯田", "軽井沢", "諏訪"],
    "gifu": ["岐阜", "高山"],
    "shizuoka": ["静岡", "浜松", "網代", "三島", "御前崎", "石廊崎"],
    "aichi": ["名古屋", "伊良湖"],
    "mie": ["津", "四日市", "尾鷲", "上野"],
    "shiga": ["彦根"],
    "kyoto": ["京都", "舞鶴"],
    "osaka": ["大阪"],
    "hyogo": ["神戸", "姫路", "豊岡", "洲本"],
    "nara": ["奈良"],
    "wakayama": ["和歌山", "潮岬"],
    "tottori": ["鳥取", "米子", "境"],
    "shimane": ["松江", "浜田", "西郷"],
    "okayama": ["岡山", "津山"],
    "hiroshima": ["広島", "呉", "福山"],
    "yamaguchi": ["下関", "山口", "萩"],
    "tokushima": ["徳島"],
    "kagawa": ["高松", "多度津"],
    "ehime": ["松山", "宇和島"],
    "kochi": ["高知", "宿毛", "室戸岬", "清水"],
    "fukuoka": ["福岡", "飯塚"],
    "saga": ["佐賀"],
    "nagasaki": ["長崎", "佐世保", "厳原", "福江", "平戸", "雲仙岳"],
    "kumamoto": ["熊本", "人吉", "牛深", "阿蘇山"],
    "oita": ["大分", "日田"],
    "miyazaki": ["宮崎", "延岡", "都城", "油津"],
    "kagoshima": ["鹿児島", "名瀬", "種子島", "屋久島", "枕崎", "阿久根", "沖永良部"],
    "okinawa": ["那覇", "名護", "久米島", "宮古島", "石垣島", "南大東島", "与那国島", "西表島"],
}  # fmt: skip
STATION_PREF = {s: p for p, names in STATIONS.items() for s in names}


def build_stations(by_key: dict[str, list[jma.Normal]]) -> tuple[list[SeasonStation], set[str]]:
    """現象別的平年值 → 觀測站別；回傳（觀測站, 對不到縣的站名）。"""
    merged: dict[str, dict[str, str]] = {}
    unknown: set[str] = set()
    for key, rows in by_key.items():
        for n in rows:
            if n.station not in STATION_PREF:
                unknown.add(n.station)
                continue
            merged.setdefault(n.station, {})[key] = f"{n.month:02d}-{n.day:02d}"
    order = {s: (list(STATIONS).index(p), STATIONS[p].index(s)) for s, p in STATION_PREF.items()}
    stations = [
        SeasonStation(name=s, prefecture=STATION_PREF[s], normals=dict(sorted(v.items())))
        for s, v in sorted(merged.items(), key=lambda kv: order[kv[0]])
    ]
    return stations, unknown


def seed_seasons() -> str:
    by_key = {key: jma.normals(code) for key, code, _ in PHENOMENA}
    stations, unknown = build_stations(by_key)
    now = datetime.now(UTC).isoformat(timespec="seconds")
    data = SeasonData(
        source=Source(url=jma.INDEX_URL, fetched_at=now),
        stations=stations,
    )
    SEASONS_JSON.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data.model_dump(mode="json"), ensure_ascii=False, indent=2)
    SEASONS_JSON.write_text(body + "\n", encoding="utf-8")
    lines = ["## 季節（氣象廳生物季節平年值）"]
    for key, code, ja in PHENOMENA:
        lines.append(f"- {ja}（{code}）：{len(by_key[key])} 站")
    covered = {s.prefecture for s in stations}
    missing = [p for p in STATIONS if p not in covered]
    lines.append(f"- 對到 {len(stations)} 站、{len(covered)} 縣")
    if missing:
        lines.append(f"- 沒有資料的縣：{'、'.join(missing)}")
    if unknown:
        lines.append(f"- 對不到縣的站（略過）：{'、'.join(sorted(unknown))}")
    return "\n".join(lines)
