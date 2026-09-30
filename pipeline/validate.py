"""資料檢查（validate-data 指令）：自動採集的 PR 合併前跑，結果寫進 PR 描述與 commit 狀態。

檢查項目：
- 格式：JSON 可讀、固定縮排（indent=2）、依 id 排序、id 不重複（PR diff 才讀得懂）。
- 結構：以 pipeline/models.py 的 schema 驗證（景點、地區特色、祭典、期間限定、會話、鐵路、季節）；
  擴充包檢查 id、縣、座標與來源。
- 來源：每筆都要有來源網址與取得時間（CLAUDE.md）。
- 文風：翻譯的簡介不能有 §6a 的禁用句型。
- bundle：data/ 能建出前端的 bundle。
"""

from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ValidationError

from pipeline import models
from pipeline.paths import DATA, REGIONS_JSON

# 目錄 → (模型, 是否為依 id 排序的清單)
LIST_MODELS: dict[str, type[BaseModel]] = {
    "spots": models.Spot,
    "specialties": models.Specialty,
    "festivals": models.Festival,
    "timed": models.TimedItem,
    "phrases": models.Phrase,
}
MAX_ERRORS_PER_FILE = 5


@dataclass
class Result:
    files: int = 0
    records: int = 0
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def _rel(path: Path) -> str:
    """顯示用路徑：data/ 之後的部分（測試時 data 目錄不在 repo 裡）。"""
    parts = path.parts
    return "/".join(parts[-2:]) if len(parts) >= 2 else str(path)


def check_format(path: Path, text: str, data: Any, res: Result) -> None:
    if json.dumps(data, ensure_ascii=False, indent=2) + "\n" != text:
        res.errors.append(f"{_rel(path)}：格式不是 indent=2（請用 pipeline 的寫檔函式輸出）")
    if isinstance(data, list) and data and all(isinstance(x, dict) and "id" in x for x in data):
        ids = [x["id"] for x in data]
        if ids != sorted(ids):
            res.errors.append(f"{_rel(path)}：沒有依 id 排序")
        dup = sorted({i for i in ids if ids.count(i) > 1})
        if dup:
            res.errors.append(f"{_rel(path)}：id 重複 {', '.join(dup[:5])}")


def check_models(path: Path, data: Any, model: type[BaseModel], res: Result) -> None:
    n = 0
    for i, rec in enumerate(data if isinstance(data, list) else []):
        try:
            model.model_validate(rec)
        except ValidationError as e:
            n += 1
            if n <= MAX_ERRORS_PER_FILE:
                first = e.errors()[0]
                loc = ".".join(str(x) for x in first["loc"])
                res.errors.append(
                    f"{_rel(path)} #{i}（{rec.get('id', '?')}）：{loc} {first['msg']}"
                )
    if n > MAX_ERRORS_PER_FILE:
        res.errors.append(f"{_rel(path)}：另有 {n - MAX_ERRORS_PER_FILE} 筆不符合 schema")


def check_pack(path: Path, data: Any, prefs: set[str], res: Result) -> None:
    n = 0
    for rec in data if isinstance(data, list) else []:
        problems = []
        if rec.get("prefecture") not in prefs:
            problems.append(f"縣 {rec.get('prefecture')!r} 不存在")
        loc = rec.get("location") or {}
        if not (20 <= loc.get("lat", 0) <= 46 and 122 <= loc.get("lng", 0) <= 154):
            problems.append("座標不在日本")
        srcs = rec.get("sources") or []
        if not srcs or not all(s.get("url") and s.get("fetched_at") for s in srcs):
            problems.append("缺來源網址或取得時間")
        if problems:
            n += 1
            if n <= MAX_ERRORS_PER_FILE:
                res.errors.append(f"{_rel(path)}（{rec.get('id', '?')}）：{'、'.join(problems)}")
    if n > MAX_ERRORS_PER_FILE:
        res.errors.append(f"{_rel(path)}：另有 {n - MAX_ERRORS_PER_FILE} 筆有問題")


def check_banned(res: Result) -> None:
    from pipeline.translate import BANNED, TRANSLATIONS_JSON

    if not TRANSLATIONS_JSON.exists():
        return
    data = json.loads(TRANSLATIONS_JSON.read_text(encoding="utf-8"))
    hits = [
        f"{k}：{v.get('zh', '')[:40]}"
        for k, v in (data.items() if isinstance(data, dict) else [])
        if isinstance(v, dict) and BANNED.search(v.get("zh", ""))
    ]
    for h in hits[:10]:
        res.errors.append(f"翻譯有禁用句型 {h}")


def check_bundles(res: Result) -> None:
    from pipeline import build_bundles

    with tempfile.TemporaryDirectory() as tmp:
        try:
            written = build_bundles.build(dst=Path(tmp))
        except Exception as e:  # noqa: BLE001 — 任何錯誤都要回報
            res.errors.append(f"bundle 建不出來：{type(e).__name__}: {e}")
            return
    res.warnings.append(f"bundle：{len(written)} 個檔案")


def validate(data_dir: Path = DATA, bundles: bool = True) -> Result:
    res = Result()
    prefs = {
        r["prefecture"] for r in json.loads(REGIONS_JSON.read_text(encoding="utf-8"))["regions"]
    }
    targets = [(d, LIST_MODELS.get(d)) for d in [*LIST_MODELS, "packs"]]
    for name, model in targets:
        for path in sorted((data_dir / name).glob("*.json")):
            res.files += 1
            text = path.read_text(encoding="utf-8")
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                res.errors.append(f"{_rel(path)}：JSON 讀不了（{e}）")
                continue
            res.records += len(data) if isinstance(data, list) else 1
            check_format(path, text, data, res)
            if model:
                check_models(path, data, model, res)
            else:
                check_pack(path, data, prefs, res)
    for path in sorted((data_dir / "rail").glob("*.json")):
        res.files += 1
        try:
            models.RailData.model_validate_json(path.read_text(encoding="utf-8"))
        except ValidationError as e:
            res.errors.append(f"{_rel(path)}：{e.errors()[0]['msg']}")
    check_banned(res)
    if bundles:
        check_bundles(res)
    return res


def report(res: Result) -> str:
    head = "通過" if res.ok else f"沒有通過（{len(res.errors)} 項）"
    lines = [f"## 資料檢查：{head}", "", f"{res.files} 個檔案、{res.records} 筆。"]
    if res.errors:
        lines += ["", *[f"- {e}" for e in res.errors]]
    if res.warnings:
        lines += ["", *[f"- {w}" for w in res.warnings]]
    return "\n".join(lines) + "\n"
