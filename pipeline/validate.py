"""資料檢查（validate-data 指令）：自動採集的 PR 合併前跑，結果寫進 PR 描述與 commit 狀態。

檢查項目：
- 格式：JSON 可讀、固定縮排（indent=2）、依 id 排序、id 不重複（PR diff 才讀得懂）。
- 結構：以 pipeline/models.py 的 schema 驗證（景點、地區特色、祭典、期間限定、會話、鐵路、季節、
  浮世繪、市区町村界）；擴充包檢查 id、縣、座標與來源。
- 鐵路：車站的路線、相鄰站的兩端都要存在，距離合理；新幹線站要有新幹線停靠。
- 市区町村界：代碼（含檢查碼）與縣相符、依代碼排序、環要封閉、座標在日本；景點的 municipality
  要是那一縣的區。
- 機場清單（data/seed/airports.json）：schema、依 id 排序、縣存在；清單上的機場要是那一縣的景點。
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


def check_ukiyoe(data_dir: Path, res: Result) -> None:
    """浮世繪裡的景點（data/ukiyoe.json）：schema、依景點與作品 id 排序、景點存在、授權與出處。"""
    from pipeline.ukiyoe import license_ok

    path = data_dir / "ukiyoe.json"
    if not path.exists():
        return
    res.files += 1
    text = path.read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        res.errors.append(f"{_rel(path)}：JSON 讀不了（{e}）")
        return
    check_format(path, text, data, res)
    if not isinstance(data, list):
        res.errors.append(f"{_rel(path)}：應該是清單")
        return
    res.records += len(data)
    check_models(path, data, models.UkiyoeSpot, res)
    keys = [r.get("spot", "") for r in data]
    if keys != sorted(keys) or len(set(keys)) != len(keys):
        res.errors.append(f"{_rel(path)}：沒有依景點 id 排序或景點重複")
    spots: dict[str, str] = {}
    for sp in sorted((data_dir / "spots").glob("*.json")):
        for s in json.loads(sp.read_text(encoding="utf-8")):
            if s.get("status", "published") == "published":
                spots[s["id"]] = s.get("prefecture", sp.stem)
    problems: list[str] = []
    works = 0
    for r in data:
        sid = r.get("spot")
        if sid not in spots:
            problems.append(f"{sid}：不是已發布的景點")
        elif spots[sid] != r.get("pref"):
            problems.append(f"{sid}：縣 {r.get('pref')} 和景點的 {spots[sid]} 不同")
        ids = [w.get("id", "") for w in r.get("works", [])]
        if ids != sorted(ids):
            problems.append(f"{sid}：作品沒有依 id 排序")
        for w in r.get("works", []):
            works += 1
            if not license_ok(w.get("license", "")):
                problems.append(f"{sid} {w.get('id')}：授權 {w.get('license')!r} 不是公有領域或 CC")
            if not (w.get("source_url") and w.get("retrieved") and w.get("image")):
                problems.append(f"{sid} {w.get('id')}：缺圖、來源網址或取得時間")
    for p in problems[:MAX_ERRORS_PER_FILE]:
        res.errors.append(f"{_rel(path)}（{p}）")
    if len(problems) > MAX_ERRORS_PER_FILE:
        res.errors.append(f"{_rel(path)}：另有 {len(problems) - MAX_ERRORS_PER_FILE} 項有問題")
    res.warnings.append(f"浮世繪：{len(data)} 個景點、{works} 幅")


def check_airports(data_dir: Path, prefs: set[str], res: Result) -> None:
    """有國際定期航班的機場（seed-airports）：schema、依 id 排序、縣；清單上的機場是不是景點。"""
    path = data_dir / "seed" / "airports.json"
    if not path.exists():
        return
    res.files += 1
    text = path.read_text(encoding="utf-8")
    try:
        data = json.loads(text)
        seed = models.AirportSeed.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as e:
        res.errors.append(f"{_rel(path)}：讀不了或不符合 schema（{str(e).splitlines()[0]}）")
        return
    check_format(path, text, data, res)
    res.records += len(seed.airports)
    problems: list[str] = []
    ids = [a.id for a in seed.airports]
    if ids != sorted(ids) or len(set(ids)) != len(ids):
        problems.append("沒有依 id 排序或 id 重複")
    for a in seed.airports:
        if a.id != f"wd-{a.wikidata}":
            problems.append(f"{a.id}：id 和 wikidata {a.wikidata} 不符")
        if a.prefecture not in prefs:
            problems.append(f"{a.id}：縣 {a.prefecture!r} 不存在")
    for p in problems[:MAX_ERRORS_PER_FILE]:
        res.errors.append(f"{_rel(path)}（{p}）")
    missing = []
    for a in seed.airports:
        spots = data_dir / "spots" / f"{a.prefecture}.json"
        found = spots.exists() and any(
            s.get("id") == a.id for s in json.loads(spots.read_text(encoding="utf-8"))
        )
        if not found:
            missing.append(f"{a.name_ja}（{a.prefecture}）")
    if missing:
        res.warnings.append(f"機場清單上、還不是景點的：{'、'.join(missing)}（跑 seed-airports）")
    res.warnings.append(f"機場：{len(seed.airports)} 個（{seed.source.url}）")


def check_rail(path: Path, data: models.RailData, res: Result) -> None:
    """鐵路的參照：車站的路線、相鄰站的兩端存在；距離在 0–150 km；新幹線站有新幹線停靠。"""
    problems: list[str] = []
    line_ids = [x.id for x in data.lines]
    if line_ids != sorted(line_ids) or len(set(line_ids)) != len(line_ids):
        problems.append("路線沒有依 id 排序或 id 重複")
    st_ids = [st.id for st in data.stations]
    if st_ids != sorted(st_ids) or len(set(st_ids)) != len(st_ids):
        problems.append("車站沒有依 id 排序或 id 重複")
    known = set(st_ids) | {st.id for st in data.extra_stations}
    shinkansen = {x.id for x in data.lines if x.shinkansen}
    for st in data.stations:
        if missing := [i for i in st.lines if i not in set(line_ids)]:
            problems.append(f"{st.id} {st.name}：路線 {missing[0]} 不存在")
        if st.shinkansen and not shinkansen & set(st.lines):
            problems.append(f"{st.id} {st.name}：標新幹線但沒有新幹線停靠")
    for x in data.lines:
        for a, b, km in x.edges:
            if a not in known or b not in known:
                problems.append(f"{x.id} {x.name}：相鄰站 {a}–{b} 不在車站清單")
            elif not (0 < km <= 150) or a >= b:
                problems.append(f"{x.id} {x.name}：相鄰站 {a}–{b} 的距離 {km} 或順序不對")
    for p in problems[:MAX_ERRORS_PER_FILE]:
        res.errors.append(f"{_rel(path)}（{p}）")
    if len(problems) > MAX_ERRORS_PER_FILE:
        res.errors.append(f"{_rel(path)}：另有 {len(problems) - MAX_ERRORS_PER_FILE} 項有問題")


def check_municipalities(data_dir: Path, prefs: list[str], res: Result) -> dict[str, set[str]]:
    """市区町村界；回傳 縣 → 區代碼（檢查景點的 municipality 用）。"""
    from pipeline.municipalities import lg_code, render

    codes: dict[str, set[str]] = {}
    for path in sorted((data_dir / "municipalities").glob("*.json")):
        res.files += 1
        text = path.read_text(encoding="utf-8")
        try:
            data = models.MunicipalityData.model_validate_json(text)
        except ValidationError as e:
            first = e.errors()[0]
            loc = ".".join(str(x) for x in first["loc"])
            res.errors.append(f"{_rel(path)}：{loc} {first['msg']}")
            continue
        res.records += len(data.features)
        problems: list[str] = []
        if render(data) != text:
            problems.append("格式不是 pipeline 的寫法（請用 seed-municipalities 輸出）")
        if data.prefecture != path.stem or path.stem not in prefs:
            problems.append(f"縣 {data.prefecture!r} 和檔名不符")
        ids = [f.id for f in data.features]
        if ids != sorted(ids) or len(set(ids)) != len(ids):
            problems.append("沒有依代碼排序或代碼重複")
        no = prefs.index(path.stem) + 1 if path.stem in prefs else 0
        if not (data.source.url and data.source.fetched_at):
            problems.append("缺來源網址或取得時間")
        for f in data.features:
            if lg_code(f.id[:5]) != f.id or int(f.id[:2]) != no:
                problems.append(f"{f.id} {f.properties.name}：代碼的檢查碼或縣碼不對")
            if not (f.properties.source_url and f.properties.retrieved):
                problems.append(f"{f.id}：缺來源網址或取得時間")
            if f.properties.kana and not f.properties.kana_source_url:
                problems.append(f"{f.id}：念法沒有來源")
            for poly in f.geometry.coordinates:
                for ring in poly:
                    if len(ring) < 4 or ring[0] != ring[-1]:
                        problems.append(f"{f.id}：有沒有封閉或少於 3 點的環")
                        break
                    if not all(122 <= x <= 154 and 20 <= y <= 46 for x, y in ring):
                        problems.append(f"{f.id}：座標不在日本")
                        break
        for p in problems[:MAX_ERRORS_PER_FILE]:
            res.errors.append(f"{_rel(path)}（{p}）")
        if len(problems) > MAX_ERRORS_PER_FILE:
            res.errors.append(f"{_rel(path)}：另有 {len(problems) - MAX_ERRORS_PER_FILE} 項有問題")
        codes[path.stem] = set(ids)
    if codes:
        res.warnings.append(f"市区町村界：{len(codes)} 縣、{sum(map(len, codes.values()))} 區")
    return codes


def check_spot_municipalities(data_dir: Path, codes: dict[str, set[str]], res: Result) -> None:
    """景點的 municipality 要是那一縣的區（那一縣有區界資料時）。"""
    n = 0
    for path in sorted((data_dir / "spots").glob("*.json")):
        try:
            spots = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        for s in spots if isinstance(spots, list) else []:
            code = s.get("municipality") if isinstance(s, dict) else None
            if not code:
                continue
            pref = s.get("prefecture", path.stem)
            if pref in codes and code not in codes[pref]:
                n += 1
                if n <= MAX_ERRORS_PER_FILE:
                    where = f"{_rel(path)}（{s.get('id')}）"
                    res.errors.append(f"{where}：區 {code} 不在 {pref} 的區界裡")
    if n > MAX_ERRORS_PER_FILE:
        res.errors.append(f"景點的區：另有 {n - MAX_ERRORS_PER_FILE} 筆對不到")


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
    pref_list = [
        r["prefecture"] for r in json.loads(REGIONS_JSON.read_text(encoding="utf-8"))["regions"]
    ]
    prefs = set(pref_list)
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
    edges = served = stations = 0
    for path in sorted((data_dir / "rail").glob("*.json")):
        res.files += 1
        try:
            rail = models.RailData.model_validate_json(path.read_text(encoding="utf-8"))
        except ValidationError as e:
            res.errors.append(f"{_rel(path)}：{e.errors()[0]['msg']}")
            continue
        check_rail(path, rail, res)
        edges += sum(len(x.edges) for x in rail.lines)
        stations += len(rail.stations)
        served += sum(1 for st in rail.stations if st.lines)
    if stations:
        res.warnings.append(f"鐵路：車站 {stations}（有停靠路線 {served}）、相鄰站 {edges}")
    check_spot_municipalities(data_dir, check_municipalities(data_dir, pref_list, res), res)
    check_ukiyoe(data_dir, res)
    check_airports(data_dir, prefs, res)
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
