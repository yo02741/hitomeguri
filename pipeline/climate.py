"""深度探索「天氣」：各縣代表氣象台最近 10 年每月的平均氣溫、日最高、日最低、降水量與降水日數
（data/climate.json，seed-climate 指令）。

來源：氣象廳「過去の気象データ検索」的月ごとの値（https://www.data.jma.go.jp/stats/etrn/）。
- 主な要素（view=p1）：月、気圧 2 欄、降水量（合計、最大日、1時間、10分間）、
  気温（日平均、日最高、日最低、最高、最低）…
- 詳細（気圧・降水量）（view=a1）：最後 8 欄是降水量各階級の日数
  （≧0.0、≧0.5、≧1.0、≧10.0、≧30.0、≧50.0、≧70.0、≧100.0mm）
值的後面可能有品質記號：「)」準正常值（缺測少，照用）、「]」資料不足值、
「×」「///」「#」缺測或疑問值（都不用）。
用使用者決定的最近 10 個完整年份（不用 1991–2020 平年值：較舊、比近年冷），
有 7 年以上的有效值才算。
利用條件：公共データ利用規約（第1.0版），須標示出處（https://www.jma.go.jp/jma/kishou/info/coment.html）。
www.data.jma.go.jp 沒有 robots.txt（404）；每秒最多一次請求。
"""

from __future__ import annotations

import datetime as dt
import html
import json
import re
from collections.abc import Callable

from pipeline.http import get_text
from pipeline.models import ClimateData, ClimateMonth, ClimatePref, ClimateStation, Source
from pipeline.packs import log
from pipeline.paths import CLIMATE_JSON

YEARS = 10
MIN_YEARS = 7
INDEX_URL = "https://www.data.jma.go.jp/stats/etrn/index.php"
MONTHLY_URL = (
    "https://www.data.jma.go.jp/stats/etrn/view/monthly_s1.php"
    "?prec_no={prec}&block_no={block}&year={year}&month=&day=&view={view}"
)

# 縣 → (府県番号 prec_no, 地点番号 block_no, 氣象台名)。縣廳所在地的氣象台；
# 縣廳所在地沒有氣象台的用縣內主要的氣象台（埼玉：熊谷、滋賀：彦根）。
# 代碼取自各縣的地点選択頁（https://www.data.jma.go.jp/stats/etrn/select/prefecture.php?prec_no=…）
STATIONS: dict[str, tuple[int, str, str]] = {
    "hokkaido": (14, "47412", "札幌"), "aomori": (31, "47575", "青森"),
    "iwate": (33, "47584", "盛岡"), "miyagi": (34, "47590", "仙台"),
    "akita": (32, "47582", "秋田"), "yamagata": (35, "47588", "山形"),
    "fukushima": (36, "47595", "福島"), "ibaraki": (40, "47629", "水戸"),
    "tochigi": (41, "47615", "宇都宮"), "gunma": (42, "47624", "前橋"),
    "saitama": (43, "47626", "熊谷"), "chiba": (45, "47682", "千葉"),
    "tokyo": (44, "47662", "東京"), "kanagawa": (46, "47670", "横浜"),
    "niigata": (54, "47604", "新潟"), "toyama": (55, "47607", "富山"),
    "ishikawa": (56, "47605", "金沢"), "fukui": (57, "47616", "福井"),
    "yamanashi": (49, "47638", "甲府"), "nagano": (48, "47610", "長野"),
    "gifu": (52, "47632", "岐阜"), "shizuoka": (50, "47656", "静岡"),
    "aichi": (51, "47636", "名古屋"), "mie": (53, "47651", "津"),
    "shiga": (60, "47761", "彦根"), "kyoto": (61, "47759", "京都"),
    "osaka": (62, "47772", "大阪"), "hyogo": (63, "47770", "神戸"),
    "nara": (64, "47780", "奈良"), "wakayama": (65, "47777", "和歌山"),
    "tottori": (69, "47746", "鳥取"), "shimane": (68, "47741", "松江"),
    "okayama": (66, "47768", "岡山"), "hiroshima": (67, "47765", "広島"),
    "yamaguchi": (81, "47784", "山口"), "tokushima": (71, "47895", "徳島"),
    "kagawa": (72, "47891", "高松"), "ehime": (73, "47887", "松山"),
    "kochi": (74, "47893", "高知"), "fukuoka": (82, "47807", "福岡"),
    "saga": (85, "47813", "佐賀"), "nagasaki": (84, "47817", "長崎"),
    "kumamoto": (86, "47819", "熊本"), "oita": (83, "47815", "大分"),
    "miyazaki": (87, "47830", "宮崎"), "kagoshima": (88, "47827", "鹿児島"),
    "okinawa": (91, "47936", "那覇"),
}  # fmt: skip

# 主な要素（p1）的欄位：0 月、3 降水量合計、7 気温日平均、8 日最高、9 日最低
P1_COLS = {"precip": 3, "temp": 7, "high": 8, "low": 9}
# 詳細（a1）：降水量≧1.0mm の日数 是倒數第 6 欄
A1_RAIN_DAYS = -6


def parse_value(cell: str) -> float | None:
    """表格的一格 → 數值；資料不足、缺測、疑問值為 None。「)」準正常值照用。"""
    s = cell.strip()
    if not s or "]" in s or "×" in s or "#" in s or "/" in s or s in ("--", "-"):
        # 「--」是「該當現象なし」（例：雪），降水量、氣溫不會出現；當缺測
        return None
    s = s.replace(")", "").replace("*", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def parse_table(page: str) -> dict[int, list[str]]:
    """月ごとの値的表格（id='tablefix1'）→ 月 → 各欄文字（含月份那欄）。"""
    m = re.search(r"<table id='tablefix1'.*?</table>", page, re.S)
    if not m:
        return {}
    out: dict[int, list[str]] = {}
    for row in re.findall(r"<tr.*?</tr>", m.group(0), re.S):
        cells = [
            html.unescape(re.sub(r"<.*?>", "", c)).strip()
            for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        ]
        if cells and cells[0].isdigit() and 1 <= int(cells[0]) <= 12:
            out[int(cells[0])] = cells
    return out


def _mean(xs: list[float], digits: int = 1) -> float | None:
    return round(sum(xs) / len(xs), digits) if len(xs) >= MIN_YEARS else None


def station_months(
    prec: int, block: str, years: list[int], fetch: Callable[[str], str | None] = get_text
) -> tuple[list[ClimateMonth], list[str]]:
    """一個氣象台各年的月值 → 12 個月的平均（有效年數不足的欄位留空），和用到的網址。"""
    vals: dict[int, dict[str, list[float]]] = {
        m: {k: [] for k in (*P1_COLS, "rain_days")} for m in range(1, 13)
    }
    urls: list[str] = []
    for y in years:
        p1_url = MONTHLY_URL.format(prec=prec, block=block, year=y, view="p1")
        a1_url = MONTHLY_URL.format(prec=prec, block=block, year=y, view="a1")
        p1 = parse_table(fetch(p1_url) or "")
        a1 = parse_table(fetch(a1_url) or "")
        urls += [p1_url, a1_url]
        for m in range(1, 13):
            if row := p1.get(m):
                for key, col in P1_COLS.items():
                    if len(row) > col and (v := parse_value(row[col])) is not None:
                        vals[m][key].append(v)
            if (row := a1.get(m)) and len(row) >= 9:
                if (v := parse_value(row[A1_RAIN_DAYS])) is not None:
                    vals[m]["rain_days"].append(v)
    months = [
        ClimateMonth(
            month=m,
            temp=_mean(vals[m]["temp"]),
            high=_mean(vals[m]["high"]),
            low=_mean(vals[m]["low"]),
            precip=_mean(vals[m]["precip"], 0),
            rain_days=_mean(vals[m]["rain_days"]),
            years=min(len(v) for v in vals[m].values()),
        )
        for m in range(1, 13)
    ]
    return months, urls


def seed_climate(prefs: list[str] | None = None, today: dt.date | None = None) -> str:
    today = today or dt.date.today()
    years = list(range(today.year - YEARS, today.year))
    now = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    # 只重做指定的縣：其他縣保留現有的資料
    old: dict[str, ClimatePref] = {}
    if prefs and CLIMATE_JSON.exists():
        prev = ClimateData.model_validate_json(CLIMATE_JSON.read_text(encoding="utf-8"))
        if prev.years == [years[0], years[-1]]:
            old = {p.prefecture: p for p in prev.prefectures}
    out: list[ClimatePref] = []
    gaps: list[str] = []
    for pref, (prec, block, name) in STATIONS.items():
        if prefs and pref not in prefs:
            if pref in old:
                out.append(old[pref])
            continue
        log(f"[climate] {pref} {name}")
        months, urls = station_months(prec, block, years)
        thin = [m.month for m in months if m.years < MIN_YEARS]
        if thin:
            gaps.append(f"{pref}（{name}）{'、'.join(f'{m}月' for m in thin)}")
        out.append(
            ClimatePref(
                prefecture=pref,
                station=ClimateStation(name=name, prec_no=prec, block_no=block),
                months=months,
                source=Source(url=urls[0], fetched_at=now),
            )
        )
    data = ClimateData(
        years=[years[0], years[-1]],
        source=Source(url=INDEX_URL, fetched_at=now),
        prefectures=sorted(out, key=lambda p: p.prefecture),
    )
    CLIMATE_JSON.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=2)
    CLIMATE_JSON.write_text(body + "\n", encoding="utf-8")
    lines = [
        f"## 天氣（氣象廳 {years[0]}–{years[-1]} 年月值的平均）",
        f"- {len(out)} 縣",
        f"- 有效年數不足 {MIN_YEARS} 年而留空的月份：{'；'.join(gaps) if gaps else '沒有'}",
    ]
    return "\n".join(lines)
