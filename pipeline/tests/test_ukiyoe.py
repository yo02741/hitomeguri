"""seed-ukiyoe：SPARQL、Wikidata、Commons 都用 fixture（不連網路）。"""

import json
from pathlib import Path

import pytest

from pipeline import build_bundles, ukiyoe, validate
from pipeline.models import UkiyoeSpot
from pipeline.sources import commons, wikidata

FIXTURE = Path(__file__).parent / "fixtures" / "ukiyoe_sparql.json"
THUMB = "https://thumb.wikimedia.org/wikipedia/commons/thumb/"


def _spot(qid: str, pref: str, ja: str, zh: str, score: float) -> dict:
    return {
        "id": f"wd-{qid}",
        "name": {"ja": ja, "zh_tw": zh},
        "location": {"lat": 35.36, "lng": 138.73},
        "prefecture": pref,
        "kind": "major",
        "themes": [],
        "tags": [],
        "featured": True,
        "score": score,
        "images": [],
        "external_ids": {"wikidata": qid},
        "sources": [{"url": f"https://www.wikidata.org/wiki/{qid}", "fetched_at": "2026-10-01"}],
        "status": "published",
        "updated_at": "2026-10-01",
    }


@pytest.fixture
def spots_dir(tmp_path: Path) -> Path:
    d = tmp_path / "spots"
    d.mkdir()
    for pref, items in {
        "shizuoka": [_spot("Q39231", "shizuoka", "富士山", "富士山", 99.0)],
        "tokyo": [_spot("Q222149", "tokyo", "隅田川", "隅田川", 80.0)],
    }.items():
        (d / f"{pref}.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    return d


def _entities(qids: list[str]) -> dict[str, wikidata.Entity]:
    data = {
        "Q252485": wikidata.Entity(
            qid="Q252485",
            labels={"ja": "神奈川沖浪裏", "en": "The Great Wave off Kanagawa"},
            series=["Q1"],
            creators=["Q5586"],
            inception=[1831],
        ),
        "Q227494": wikidata.Entity(
            qid="Q227494", labels={"en": "Fine Wind, Clear Morning"}, creators=["Q5586"]
        ),
        "Q900": wikidata.Entity(qid="Q900", labels={"ja": "不明"}, creators=["Q200798"]),
        "Q901": wikidata.Entity(qid="Q901", labels={}, creators=["Q200798"], inception=[1856]),
    }
    return {q: data[q] for q in qids if q in data}


def _labels(qids: list[str]) -> dict[str, str]:
    data = {"Q1": "冨嶽三十六景", "Q5586": "葛飾北斎", "Q200798": "歌川広重"}
    return {q: data[q] for q in qids if q in data}


def _info(files: list[str], width: int = 960) -> dict[str, commons.ImageInfo]:
    assert width == 960
    lic = {
        "Great Wave a.jpg": "Public domain",
        "Red Fuji.jpg": "CC0",
        "Unknown licence.jpg": "不明",
        "100 views edo 004.jpg": "Public domain",
    }
    return {
        f: commons.ImageInfo(
            url=f"{THUMB}a/ab/{f.replace(' ', '_')}/960px-{f.replace(' ', '_')}?utm_source=x",
            author="Katsushika Hokusai",
            license=lic[f],
            source_url=f"https://commons.wikimedia.org/wiki/File:{f.replace(' ', '_')}",
        )
        for f in files
        if f in lic
    }


def test_license_ok() -> None:
    assert ukiyoe.license_ok("Public domain")
    assert ukiyoe.license_ok("PD-Japan")
    assert ukiyoe.license_ok("CC0")
    assert ukiyoe.license_ok("CC BY-SA 4.0")
    assert not ukiyoe.license_ok("不明")
    assert not ukiyoe.license_ok("")
    assert not ukiyoe.license_ok("Copyrighted")


def test_match_rows_keeps_our_spots_and_stable_file(spots_dir: Path) -> None:
    spots = ukiyoe.spot_index(spots_dir)
    hits = ukiyoe.match_rows(json.loads(FIXTURE.read_text(encoding="utf-8")), spots)
    assert set(hits) == {"Q39231", "Q222149"}
    # 同一幅作品兩張圖：取檔名排序第一張
    assert hits["Q39231"]["Q252485"] == "Great Wave a.jpg"


def test_seed_ukiyoe_with_fixtures(
    spots_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        wikidata, "sparql", lambda q: json.loads(FIXTURE.read_text(encoding="utf-8"))
    )
    monkeypatch.setattr(wikidata, "entities", _entities)
    monkeypatch.setattr(wikidata, "labels_ja", _labels)
    monkeypatch.setattr(commons, "image_info", _info)
    out = tmp_path / "ukiyoe.json"
    report = ukiyoe.seed_ukiyoe(out, spots_dir)
    data = json.loads(out.read_text(encoding="utf-8"))
    assert out.read_text(encoding="utf-8") == json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    assert [r["spot"] for r in data] == ["wd-Q222149", "wd-Q39231"]
    fuji = data[1]
    assert fuji["pref"] == "shizuoka"
    # 授權不明的不收；作品依 id 排序
    assert [w["id"] for w in fuji["works"]] == ["Q227494", "Q252485"]
    wave = fuji["works"][1]
    assert wave["title"] == "神奈川沖浪裏"
    assert wave["series"] == "冨嶽三十六景" and wave["year"] == 1831
    assert wave["creator"] == "葛飾北斎" and wave["license"] == "Public domain"
    assert wave["wikidata_url"] == "https://www.wikidata.org/wiki/Q252485"
    assert wave["source_url"].startswith("https://commons.wikimedia.org/wiki/File:")
    assert wave["retrieved"]
    # 沒有日文標籤用英文；沒有系列、年份時不寫
    red = fuji["works"][0]
    assert red["title"] == "Fine Wind, Clear Morning"
    assert "series" not in red and "year" not in red
    # 沒有任何標籤：題名留空
    assert data[0]["works"][0]["title"] == ""
    for r in data:
        UkiyoeSpot.model_validate(r)
    assert "收進 data/ukiyoe.json：3 幅、2 個景點" in report
    assert "授權不明或不符（不明） 1" in report


def test_build_ukiyoe_bundle(spots_dir: Path, tmp_path: Path) -> None:
    src = tmp_path / "ukiyoe.json"
    rec = {
        "spot": "wd-Q39231",
        "pref": "shizuoka",
        "works": [
            {
                "id": "Q252485",
                "title": "神奈川沖浪裏",
                "series": "冨嶽三十六景",
                "year": 1831,
                "creator": "葛飾北斎",
                "file": "Great Wave.jpg",
                "image": f"{THUMB}a/ab/Great_Wave.jpg/960px-Great_Wave.jpg?utm_source=x",
                "license": "Public domain",
                "author": "Katsushika Hokusai",
                "source_url": "https://commons.wikimedia.org/wiki/File:Great_Wave.jpg",
                "wikidata_url": "https://www.wikidata.org/wiki/Q252485",
                "retrieved": "2026-10-09",
            }
        ],
    }
    gone = {**rec, "spot": "wd-Q404"}
    src.write_text(json.dumps([rec, gone], ensure_ascii=False), encoding="utf-8")
    out = build_bundles.build_ukiyoe(src, spots_dir)
    assert out == [
        {
            "s": "wd-Q39231",
            "p": "shizuoka",
            "n": "富士山",
            "sc": 99.0,
            "w": [
                {
                    "i": "Q252485",
                    "t": "神奈川沖浪裏",
                    "se": "冨嶽三十六景",
                    "y": 1831,
                    "c": "葛飾北斎",
                    "f": "a/ab/Great_Wave.jpg/960px-Great_Wave.jpg",
                    "a": "Katsushika Hokusai",
                    "l": "Public domain",
                    "u": "https://commons.wikimedia.org/wiki/File:Great_Wave.jpg",
                }
            ],
        }
    ]


def test_validate_checks_ukiyoe(spots_dir: Path) -> None:
    data_dir = spots_dir.parent
    work = {
        "id": "Q2",
        "title": "",
        "creator": "葛飾北斎",
        "file": "x.jpg",
        "image": "https://upload.wikimedia.org/x.jpg",
        "license": "",
        "author": "",
        "source_url": "https://commons.wikimedia.org/wiki/File:x.jpg",
        "wikidata_url": "https://www.wikidata.org/wiki/Q2",
        "retrieved": "2026-10-09",
    }
    recs = [
        {"spot": "wd-Q39231", "pref": "tokyo", "works": [work, {**work, "id": "Q1"}]},
        {"spot": "wd-Q1", "pref": "kyoto", "works": []},
    ]
    (data_dir / "ukiyoe.json").write_text(
        json.dumps(recs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    res = validate.validate(data_dir, bundles=False)
    text = "\n".join(res.errors)
    assert "沒有依景點 id 排序" in text
    assert "縣 tokyo 和景點的 shizuoka 不同" in text
    assert "作品沒有依 id 排序" in text
    assert "不是公有領域或 CC" in text
    assert "wd-Q1：不是已發布的景點" in text
