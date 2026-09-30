"""資料變更報告（diff-report 指令）：自動採集的 PR 描述。

和基準（預設 origin/main）比較 data/ 底下依 id 排列的 JSON：各檔新增、刪除、修改幾筆，
列出新增與刪除的名稱，修改裡簡介、念法、座標各改了幾筆（附例子）。
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from pipeline.paths import DATA, ROOT

DIRS = ["spots", "specialties", "festivals", "packs", "timed"]
MAX_NAMES = 12
# 只有這些欄位變了不算修改（每次採集都會更新）
VOLATILE = {"updated_at", "fetched_at"}


def _base_text(base: str, rel: str) -> str | None:
    r = subprocess.run(
        ["git", "show", f"{base}:{rel}"], cwd=ROOT, capture_output=True, text=True, check=False
    )
    return r.stdout if r.returncode == 0 else None


def _strip(v: Any) -> Any:
    if isinstance(v, dict):
        return {k: _strip(x) for k, x in v.items() if k not in VOLATILE}
    if isinstance(v, list):
        return [_strip(x) for x in v]
    return v


def _name(rec: dict[str, Any]) -> str:
    n = rec.get("name")
    if isinstance(n, dict):
        return n.get("ja") or n.get("zh_tw") or rec.get("id", "")
    if isinstance(rec.get("title"), dict):
        return rec["title"].get("ja") or rec["title"].get("zh") or rec.get("id", "")
    return str(n or rec.get("municipality") or rec.get("id", ""))


def _field(rec: dict[str, Any], path: str) -> Any:
    cur: Any = rec
    for k in path.split("."):
        cur = cur.get(k) if isinstance(cur, dict) else None
    return cur


FIELDS = [
    ("簡介", "summary.text"),
    ("念法", "name.kana"),
    ("中文名", "name.zh_tw"),
    ("座標", "location"),
]


def compare(old: list[dict[str, Any]], new: list[dict[str, Any]]) -> dict[str, Any]:
    a = {r["id"]: r for r in old if isinstance(r, dict) and "id" in r}
    b = {r["id"]: r for r in new if isinstance(r, dict) and "id" in r}
    added = [b[i] for i in sorted(b.keys() - a.keys())]
    removed = [a[i] for i in sorted(a.keys() - b.keys())]
    changed = [i for i in sorted(a.keys() & b.keys()) if _strip(a[i]) != _strip(b[i])]
    fields: dict[str, list[str]] = {label: [] for label, _ in FIELDS}
    for i in changed:
        for label, path in FIELDS:
            before, after = _field(a[i], path), _field(b[i], path)
            if before != after:
                if label == "念法":
                    fields[label].append(
                        f"{_name(b[i])}：{before or '（無）'} → {after or '（無）'}"
                    )
                else:
                    fields[label].append(_name(b[i]))
    return {"added": added, "removed": removed, "changed": changed, "fields": fields}


def _names(recs: list[dict[str, Any]]) -> str:
    names = [_name(r) for r in recs[:MAX_NAMES]]
    more = f" 等 {len(recs)} 筆" if len(recs) > MAX_NAMES else ""
    return "、".join(names) + more


def diff_report(base: str = "origin/main", data_dir: Path = DATA) -> str:
    rows: list[str] = []
    details: list[str] = []
    totals = [0, 0, 0]
    for d in DIRS:
        for path in sorted((data_dir / d).glob("*.json")):
            rel = str(path.relative_to(ROOT))
            new_text = path.read_text(encoding="utf-8")
            old_text = _base_text(base, rel)
            if old_text == new_text:
                continue
            new = json.loads(new_text)
            old = json.loads(old_text) if old_text else []
            if not isinstance(new, list) or not isinstance(old, list):
                continue
            c = compare(old, new)
            n_add, n_rm, n_ch = len(c["added"]), len(c["removed"]), len(c["changed"])
            if not (n_add or n_rm or n_ch):
                continue
            totals = [totals[0] + n_add, totals[1] + n_rm, totals[2] + n_ch]
            rows.append(f"| `{rel}` | {len(new)} | +{n_add} | -{n_rm} | {n_ch} |")
            parts = []
            if c["added"]:
                parts.append(f"- 新增：{_names(c['added'])}")
            if c["removed"]:
                parts.append(f"- 刪除：{_names(c['removed'])}")
            for label, items in c["fields"].items():
                if items:
                    ex = "、".join(items[:MAX_NAMES]) + (
                        f" 等 {len(items)} 筆" if len(items) > MAX_NAMES else ""
                    )
                    parts.append(f"- {label}改了 {len(items)} 筆：{ex}")
            if parts:
                details += [f"### {rel}", *parts, ""]
    if not rows:
        return "## 資料變更\n\n和 main 相比沒有變更。\n"
    head = [
        "## 資料變更",
        "",
        f"新增 {totals[0]}、刪除 {totals[1]}、修改 {totals[2]} 筆（和 `{base}` 比較）。",
        "",
        "| 檔案 | 筆數 | 新增 | 刪除 | 修改 |",
        "|---|---|---|---|---|",
    ]
    return "\n".join([*head, *rows, "", *details])
