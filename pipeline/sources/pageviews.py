"""Wikimedia 瀏覽量（REST pageviews API），用於精選分數。"""

from __future__ import annotations

import datetime as dt
from urllib.parse import quote

from pipeline.http import get_json

BASE = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
PROJECTS = {"jawiki": "ja.wikipedia", "zhwiki": "zh.wikipedia", "enwiki": "en.wikipedia"}


def _range() -> tuple[str, str]:
    today = dt.date.today().replace(day=1)
    end = today - dt.timedelta(days=1)
    start = (end.replace(day=1) - dt.timedelta(days=330)).replace(day=1)
    return start.strftime("%Y%m0100"), end.strftime("%Y%m%d00")


def yearly_views(site: str, title: str) -> int:
    project = PROJECTS[site]
    start, end = _range()
    article = quote(title.replace(" ", "_"), safe="")
    url = f"{BASE}/{project}/all-access/user/{article}/monthly/{start}/{end}"
    data = get_json(url, min_interval=0.05, allow_404=True)
    if not data:
        return 0
    return sum(item.get("views", 0) for item in data.get("items", []))
