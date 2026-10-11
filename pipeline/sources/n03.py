"""国土数値情報（行政区域データ）N03：一縣一個 zip，內含 GeoJSON。

網址（2024、2025 年版的實際檔名）：
  https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_13_GML.zip
  → zip 裡的 N03-20250101_13.geojson
資料頁：https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html
每年 1 月 1 日時點的版本，隔年春夏公開；從新的年份往回試，404 就換前一年。
屬性（2025 年版）：N03_001 都道府縣名、N03_002 北海道的振興局名、N03_003 郡・政令指定都市名、
N03_004 市区町村名（含東京的特別區）、N03_005 政令指定都市的區名、
N03_007 全国地方公共団体コード（5 碼，不含檢查碼）。
舊版沒有 N03_005，政令指定都市的區名在 N03_004、市名在 N03_003。
所属未定地（境界未定的湖面等）沒有代碼，略過。
每秒最多一次請求；只下載官方下載頁連結的 zip。
"""

from __future__ import annotations

import io
import json
import zipfile
from typing import Any

from pipeline.http import get_bytes

YEARS = (2026, 2025, 2024)
BASE = "https://nlftp.mlit.go.jp/ksj/gml"


def zip_url(year: int, pref_no: int) -> str:
    return f"{BASE}/data/N03/N03-{year}/N03-{year}0101_{pref_no:02d}_GML.zip"


def page_url(year: int) -> str:
    return f"{BASE}/datalist/KsjTmplt-N03-{year}.html"


def read_zip(blob: bytes) -> dict[str, Any] | None:
    """zip 裡的 GeoJSON（取第一個 .geojson）；沒有時 None。"""
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = sorted(n for n in zf.namelist() if n.lower().endswith(".geojson"))
        if not names:
            return None
        return json.loads(zf.read(names[0]).decode("utf-8-sig"))


def download(pref_no: int) -> tuple[dict[str, Any], int]:
    """最新一年的 GeoJSON 與年份；每一年都拿不到就丟出例外。"""
    tried = []
    for year in YEARS:
        url = zip_url(year, pref_no)
        blob = get_bytes(url)
        if blob is None:
            tried.append(f"{year}: 404")
            continue
        data = read_zip(blob)
        if data is None:
            tried.append(f"{year}: zip 裡沒有 GeoJSON")
            continue
        return data, year
    raise RuntimeError(f"N03 {pref_no:02d} 取不到（{'、'.join(tried)}）")
