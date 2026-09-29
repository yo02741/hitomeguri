"""氣象廳「生物季節観測」累年値 CSV：各觀測站的平年值（櫻花開花、楓葉等）。

https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html
一個現象一個 CSV（Shift_JIS）：第一列是現象名稱，第二列是欄位名稱（番号, 地点名, 各年與 rm…,
平年値, rm, 最早値, rm, 最早年, 最晩値, rm, 最晩年），之後每站一列。日期寫成月日相連的整數
（521 = 5 月 21 日），0 表示沒有資料。
利用條件：公共データ利用規約（第1.0版），須標示出處（https://www.jma.go.jp/jma/kishou/info/coment.html）。
robots.txt 不存在；每秒最多一次請求。
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass

from pipeline.http import _throttle, client

INDEX_URL = "https://www.data.jma.go.jp/sakura/data/index.html"
CSV_URL = "https://www.data.jma.go.jp/sakura/data/ruinenchi/{code}.csv"


@dataclass
class Normal:
    station: str
    month: int
    day: int


def parse_mmdd(v: str) -> tuple[int, int] | None:
    try:
        n = int(v)
    except ValueError:
        return None
    month, day = divmod(n, 100)
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return month, day


def parse_normals(text: str) -> list[Normal]:
    """每站的平年值；沒有平年值（0 或空白）的站略過。"""
    rows = list(csv.reader(io.StringIO(text)))
    header = next((r for r in rows if r and r[0].strip() == "番号"), None)
    if header is None or "平年値" not in header:
        return []
    # 平年值離最後一欄的距離（各年欄位數可能變動，從後面數比較穩）
    from_end = len(header) - header.index("平年値")
    out = []
    for r in rows[rows.index(header) + 1 :]:
        if len(r) < from_end + 2 or not r[0].strip().isdigit():
            continue
        name = r[1].replace("　", "").strip()
        md = parse_mmdd(r[len(r) - from_end].strip())
        if name and md:
            out.append(Normal(name, *md))
    return out


def fetch_csv(code: str) -> str | None:
    url = CSV_URL.format(code=code)
    _throttle("www.data.jma.go.jp", 1.0)
    resp = client().get(url, headers={"Accept": "text/csv"})
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.content.decode("cp932", errors="replace")


def normals(code: str) -> list[Normal]:
    text = fetch_csv(code)
    return parse_normals(text) if text else []


# ── 本季的觀測（期間限定，Phase 4）────────────────────────────────────────────
# さくら：sakura_kaika.html／sakura_mankai.html（12 月到 6 月每天更新三次），
#   每站一列 <th scope='row'>地點</th><td>観測日</td><td>平年差</td><td>平年日</td>…
# いちょう黄葉 phn_012.html、かえで紅葉 phn_014.html：標題「(2025年-2026年)」，
#   每站一列 <td>地點</td> 之後每年三欄（観測日、平年差、昨年差），取最後一年；還沒觀測寫「-」。
PAGE_URL = "https://www.data.jma.go.jp/sakura/data/{page}.html"

_TAGS = re.compile(r"<[^>]+>")
_MD = re.compile(r"(\d{1,2})\s*月\s*(\d{1,2})\s*日")
_SAKURA_ROW = re.compile(
    r"<th scope='row'>([^<]+)</th>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>", re.S
)
_TR = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_TD = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
_YEAR = re.compile(r"(\d{4})年")


@dataclass
class Observation:
    station: str
    date: str  # YYYY-MM-DD
    diff_normal: int | None  # 平年差（日）：負的是比平年早


def _station(s: str) -> str:
    return _TAGS.sub("", s).replace("　", "").replace("　", "").strip()


def _diff(s: str) -> int | None:
    s = _TAGS.sub("", s).strip()
    try:
        return int(s)
    except ValueError:
        return None


def _date(year: int, s: str, rollover: bool = False) -> str | None:
    """「11月 6日」→ YYYY-MM-DD。rollover：秋季表格的 1–3 月屬於隔年。"""
    m = _MD.search(_TAGS.sub("", s))
    if not m:
        return None
    month, day = int(m.group(1)), int(m.group(2))
    if rollover and month <= 3:
        year += 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def parse_sakura(html: str) -> tuple[int | None, list[Observation]]:
    """さくら開花／満開頁：（年, 已觀測的站）。"""
    title = re.search(r"<title>[^<]*?(\d{4})年", html)
    year = int(title.group(1)) if title else None
    out: list[Observation] = []
    if year is None:
        return None, out
    for name, obs, diff in _SAKURA_ROW.findall(html):
        date = _date(year, obs)
        if date:
            out.append(Observation(_station(name), date, _diff(diff)))
    return year, out


def parse_autumn(html: str) -> tuple[int | None, list[Observation]]:
    """いちょう黄葉／かえで紅葉頁：取最後一年的欄位（本季）。"""
    h1 = re.search(r"<h1>(.*?)</h1>", html, re.S)
    years = [int(y) for y in _YEAR.findall(h1.group(1))] if h1 else []
    if not years:
        return None, []
    year = years[-1]
    out: list[Observation] = []
    for row in _TR.findall(html):
        tds = _TD.findall(row)
        # 地點 + 兩年各三欄 + 代替種目
        if len(tds) < 7:
            continue
        name = _station(tds[0])
        date = _date(year, tds[4], rollover=True)
        if name and date:
            out.append(Observation(name, date, _diff(tds[5])))
    return year, out


def fetch_page(page: str) -> str | None:
    _throttle("www.data.jma.go.jp", 1.0)
    resp = client().get(PAGE_URL.format(page=page))
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.content.decode("utf-8", errors="replace")
