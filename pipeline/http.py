"""對外 HTTP：固定 User-Agent、逾時、重試與簡單的節流（PLAN.md §11）。"""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

USER_AGENT = os.environ.get(
    "HITOMEGURI_USER_AGENT",
    "hitomeguri-pipeline/0.1 (+https://github.com/yo02741/hitomeguri)",
)

_client: httpx.Client | None = None
_last_call: dict[str, float] = {}


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=httpx.Timeout(360.0, connect=30.0),
            follow_redirects=True,
        )
    return _client


def _throttle(host: str, min_interval: float) -> None:
    last = _last_call.get(host, 0.0)
    wait = last + min_interval - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last_call[host] = time.monotonic()


def request_json(
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
    min_interval: float = 0.2,
    retries: int = 4,
    allow_404: bool = False,
) -> Any:
    host = httpx.URL(url).host
    for attempt in range(retries + 1):
        _throttle(host, min_interval)
        try:
            resp = client().request(method, url, params=params, data=data)
        except httpx.TransportError:
            if attempt == retries:
                raise
            time.sleep(2**attempt * 2)
            continue
        if resp.status_code == 404 and allow_404:
            return None
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            retry_after = resp.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2**attempt * 5
            time.sleep(min(delay, 120))
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"unreachable: {url}")


def get_text(url: str, *, min_interval: float = 1.0, retries: int = 3) -> str | None:
    """取 HTML（官方觀光網站等）；預設每秒最多一次。404 回傳 None。"""
    host = httpx.URL(url).host
    for attempt in range(retries + 1):
        _throttle(host, min_interval)
        try:
            resp = client().get(url, headers={"Accept": "text/html"})
        except httpx.TransportError:
            if attempt == retries:
                raise
            time.sleep(2**attempt * 2)
            continue
        if resp.status_code == 404:
            return None
        if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries:
            time.sleep(2**attempt * 5)
            continue
        resp.raise_for_status()
        return resp.text
    raise RuntimeError(f"unreachable: {url}")


def get_json(url: str, **kw: Any) -> Any:
    return request_json("GET", url, **kw)


def post_json(url: str, **kw: Any) -> Any:
    return request_json("POST", url, **kw)
