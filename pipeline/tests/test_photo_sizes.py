import json
from pathlib import Path
from typing import Any

from pipeline import photo_sizes
from pipeline.build_bundles import map_entry
from pipeline.models import Spot
from pipeline.season_photos import to_image
from pipeline.sources import commons

FIXTURES = Path(__file__).parent / "fixtures"


def _img(name: str, **extra: Any) -> dict[str, Any]:
    return {
        "url": f"https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/{name}/960px-{name}",
        "author": "Someone",
        "license": "CC BY-SA 4.0",
        "source_url": f"https://commons.wikimedia.org/wiki/File:{name}",
        **extra,
    }


def _spot(
    sid: str, images: list[dict[str, Any]], season: dict[str, Any] | None = None
) -> dict[str, Any]:
    s: dict[str, Any] = {
        "id": sid,
        "name": {"ja": sid, "zh_tw": sid},
        "location": {"lat": 35.0, "lng": 135.7},
        "prefecture": "kyoto",
        "kind": "major",
        "featured": False,
        "score": 80,
        "images": images,
        "updated_at": "2026-01-01",
    }
    if season is not None:
        s["season_images"] = season
    return s


def test_file_title() -> None:
    url = "https://commons.wikimedia.org/wiki/File:Kiyomizu_dera.jpg"
    assert commons.file_title(url) == "Kiyomizu dera.jpg"
    url = "https://commons.wikimedia.org/wiki/File:%E6%B8%85%E6%B0%B4.jpg"
    assert commons.file_title(url) == "清水.jpg"
    assert commons.file_title("https://example.com/a.jpg") is None


def test_image_sizes_maps_back_through_normalize_and_redirect(monkeypatch) -> None:
    data = json.loads((FIXTURES / "commons_sizes.json").read_text(encoding="utf-8"))
    calls: list[dict[str, Any]] = []

    def fake(url: str, **kw: Any) -> Any:
        calls.append(kw["params"])
        return data

    monkeypatch.setattr(commons, "get_json", fake)
    got = commons.image_sizes(
        ["Kiyomizu dera.jpg", "kinkaku night.jpg", "Old name.jpg", "Gone.jpg"], batch=50
    )
    assert got == {
        "Kiyomizu dera.jpg": (4000, 2250),
        "kinkaku night.jpg": (2000, 3000),
        "Old name.jpg": (1200, 1000),
    }
    assert len(calls) == 1
    assert calls[0]["iiprop"] == "size" and calls[0]["redirects"] == 1


def test_image_sizes_batches(monkeypatch) -> None:
    seen: list[int] = []

    def fake(url: str, **kw: Any) -> Any:
        seen.append(len(kw["params"]["titles"].split("|")))
        return {"query": {"pages": {}}}

    monkeypatch.setattr(commons, "get_json", fake)
    commons.image_sizes([f"F{i}.jpg" for i in range(120)], batch=50)
    assert seen == [50, 50, 20]


def test_image_info_records_original_size(monkeypatch) -> None:
    data = {
        "query": {
            "pages": {
                "1": {
                    "title": "File:A.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg",
                            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/A.jpg/640px-A.jpg",
                            "width": 3000,
                            "height": 2000,
                            "descriptionurl": "https://commons.wikimedia.org/wiki/File:A.jpg",
                            "extmetadata": {},
                        }
                    ],
                }
            }
        }
    }
    monkeypatch.setattr(commons, "get_json", lambda url, **kw: data)
    info = commons.image_info(["A.jpg"])["A.jpg"]
    assert (info.width, info.height) == (3000, 2000)


def test_seed_photo_sizes_fills_only_changed(tmp_path: Path) -> None:
    spots = [
        _spot(
            "a",
            [_img("Kiyomizu_dera.jpg")],
            {"night": _img("Kinkaku_night.jpg"), "spring": _img("Gone.jpg")},
        ),
        _spot("b", [_img("Same.jpg", width=800, height=600)]),
    ]
    (tmp_path / "kyoto.json").write_text(json.dumps(spots, ensure_ascii=False, indent=2) + "\n")
    other = json.dumps([_spot("c", [_img("Same.jpg", width=800, height=600)])], indent=2) + "\n"
    (tmp_path / "nara.json").write_text(other)
    asked: list[list[str]] = []
    sizes = {
        "Kiyomizu dera.jpg": (4000, 2250),
        "Kinkaku night.jpg": (2000, 3000),
        "Same.jpg": (800, 600),
    }

    def lookup(titles: list[str]) -> dict[str, tuple[int, int]]:
        asked.append(titles)
        return sizes

    report = photo_sizes.seed_photo_sizes(["kyoto", "nara"], src=tmp_path, lookup=lookup)
    # 已經有寬高的不查；沒有要查的縣不呼叫 API、不寫檔
    assert asked == [["Gone.jpg", "Kinkaku night.jpg", "Kiyomizu dera.jpg"]]
    assert (tmp_path / "nara.json").read_text() == other
    out = json.loads((tmp_path / "kyoto.json").read_text())
    assert out[0]["images"][0]["width"] == 4000 and out[0]["images"][0]["height"] == 2250
    assert out[0]["season_images"]["night"]["height"] == 3000
    assert "width" not in out[0]["season_images"]["spring"]
    assert list(out[0]["images"][0])[-2:] == ["width", "height"]
    for s in out:
        Spot.model_validate(s)
    assert "補上 2 張" in report and "查不到 1 張" in report

    # 再跑一次：沒有變更，不寫檔
    before = (tmp_path / "kyoto.json").read_text()
    photo_sizes.seed_photo_sizes(["kyoto"], src=tmp_path, lookup=lookup)
    assert (tmp_path / "kyoto.json").read_text() == before


def test_seed_photo_sizes_refresh_updates(tmp_path: Path) -> None:
    spots = [_spot("a", [_img("X.jpg", width=10, height=10)])]
    (tmp_path / "kyoto.json").write_text(json.dumps(spots, indent=2) + "\n")
    report = photo_sizes.seed_photo_sizes(
        ["kyoto"], src=tmp_path, lookup=lambda t: {"X.jpg": (3000, 2000)}, refresh=True
    )
    out = json.loads((tmp_path / "kyoto.json").read_text())
    assert out[0]["images"][0]["width"] == 3000
    assert "更新 1 張" in report and "橫的 1 張" in report


def test_map_entry_carries_aspect() -> None:
    s = _spot(
        "a",
        [_img("Main.jpg", width=4000, height=2250)],
        {"night": _img("Night.jpg", width=2000, height=3000), "autumn": _img("Autumn.jpg")},
    )
    e = map_entry(Spot.model_validate(s).model_dump(mode="json", exclude_none=True))
    assert e["ia"] == 1.78
    assert e["si"]["night"][3] == 0.67
    # 寬高還沒補的照片：照舊三個欄位（前端當成直卡）
    assert len(e["si"]["autumn"]) == 3
    assert "ia" not in map_entry(_spot("b", [_img("Main.jpg")]))


def test_season_to_image_records_size() -> None:
    f = {
        "title": "X.jpg",
        "width": 3000,
        "height": 2000,
        "url": "https://upload.wikimedia.org/X.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:X.jpg",
        "extmetadata": {"LicenseShortName": {"value": "CC BY 4.0"}},
    }
    img = to_image(f)
    assert img["width"] == 3000 and img["height"] == 2000
    assert "width" not in to_image({**f, "width": 0})
