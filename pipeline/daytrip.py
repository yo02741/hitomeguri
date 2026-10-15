"""日帰り的目的地（docs/PROGRESS.md「縣內規劃」4）：build-bundles 產生 bundles/daytrip.json。

行程裡設定住的車站之後，前端（web/src/services/daytrip.ts）從那一站沿鐵路算到各地的距離
（和 pipeline/rail_graph.py 同一個 Dijkstra），列出可以單日來回的地方。這個檔只放目的地：

- 一個市区町村一筆（政令指定都市是區）：有已發布的景點、而且至少一個景點對得到路網車站
  （map bundle 的 st）。所属未定地、沒有區界資料的景點不算。
- m 代碼、n 名稱、c 政令指定都市名、p 縣、lat/lng 區名的位置（市区町村 web bundle 的 l）。
- s 分數最高的景點（最多 3 個，同分依 id）：[id, 日文名, 最近車站的路網節點 id 或 None, 分數]。
- x 這一區其餘景點的最近車站（不重複、不含 s 的，依 id）：一區的鐵路距離取它所有車站裡最近的一站。

公開資料沒有時刻表：介面只寫「鐵路約 n km」與能否搭新幹線，不寫時間。
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from pipeline.models import DaytripBundle

TOP_SPOTS = 3


def areas(
    spots: dict[str, list[dict[str, Any]]],
    munis: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """spots：縣 → map bundle 的景點（id、n、s、m、st）；munis：縣 → 市区町村 web bundle。"""
    labels: dict[str, tuple[str, dict[str, Any]]] = {}
    for pref, body in munis.items():
        for f in body.get("features", []):
            p = f["properties"]
            if p.get("l"):
                labels[p["m"]] = (pref, p)
    by_area: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for pref_spots in spots.values():
        for s in pref_spots:
            if s.get("m") in labels:
                by_area[s["m"]].append(s)
    out = []
    for code in sorted(by_area):
        group = by_area[code]
        if not any(s.get("st") for s in group):
            continue
        group.sort(key=lambda s: (-s["s"], s["id"]))
        top = group[:TOP_SPOTS]
        own = {s["st"] for s in top if s.get("st")}
        extra = sorted({s["st"] for s in group[TOP_SPOTS:] if s.get("st")} - own)
        pref, p = labels[code]
        lng, lat = p["l"]
        entry: dict[str, Any] = {"m": code, "n": p["n"]}
        if p.get("c"):
            entry["c"] = p["c"]
        entry |= {"p": pref, "lat": lat, "lng": lng}
        entry["s"] = [[s["id"], s["n"], s.get("st"), s["s"]] for s in top]
        if extra:
            entry["x"] = extra
        out.append(entry)
    return out


def bundle(
    spots: dict[str, list[dict[str, Any]]], munis: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    # exclude_none 只拿掉欄位；景點陣列裡的 None（對不到車站）照樣留著，位置不會跑掉
    return DaytripBundle.model_validate({
        "attribution": "© OpenStreetMap contributors",
        "areas": areas(spots, munis),
    }).model_dump(mode="json", exclude_none=True)  # fmt: skip


def write(
    dst: Path, spots: dict[str, list[dict[str, Any]]], munis: dict[str, dict[str, Any]]
) -> tuple[Path, dict[str, Any]] | None:
    """寫 dst/daytrip.json；沒有任何目的地時不輸出。回傳（路徑, 索引資訊）。"""
    body = bundle(spots, munis)
    if not body["areas"]:
        return None
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    path = dst / "daytrip.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    meta = {
        "areas": len(body["areas"]),
        "version": hashlib.sha1(text.encode()).hexdigest()[:10],
    }
    return path, meta
