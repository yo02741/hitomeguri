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
