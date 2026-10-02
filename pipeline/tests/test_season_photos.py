from typing import Any

from pipeline import season_photos as sp


def test_season_of():
    assert sp.season_of("Kiyomizu-dera in autumn") == "autumn"
    assert sp.season_of("Cherry blossoms at Himeji Castle") == "spring"
    assert sp.season_of("Kinkaku-ji in snow") == "winter"
    assert sp.season_of("Hot springs in Beppu") is None
    assert sp.season_of("Kasuga-taisha") is None
    assert sp.season_of("Kegon Falls") is None
    assert sp.season_of("Interior of the main hall") is None


def _file(
    title: str, w: int = 2000, h: int = 1333, mime: str = "image/jpeg", lic: str = "CC BY-SA 4.0"
) -> dict[str, Any]:
    return {
        "title": title,
        "width": w,
        "height": h,
        "mime": mime,
        "url": f"https://upload.wikimedia.org/{title}",
        "thumburl": f"https://upload.wikimedia.org/thumb/{title}/960px",
        "descriptionurl": f"https://commons.wikimedia.org/wiki/File:{title}",
        "extmetadata": {"Artist": {"value": "<a>Someone</a>"}, "LicenseShortName": {"value": lic}},
    }


def test_best_prefers_large_landscape_jpeg():
    files = [
        _file("a.jpg", 900, 600),
        _file("b.jpg", 1600, 1067),
        _file("c.jpg", 1200, 1600),
        _file("d.png", 4000, 2600, "image/png"),
    ]
    assert sp.best(files, set())["title"] == "b.jpg"
    assert sp.best(files, {"b.jpg"}) is None


def test_find_season_photos(monkeypatch):
    def fake_subcats(cat: str) -> list[str]:
        return ["Kiyomizu-dera in autumn", "Kiyomizu-dera at night"]

    def fake_files(cat: str, limit: int = 50) -> list[dict[str, Any]]:
        if cat == "Kiyomizu-dera in autumn":
            return [_file("Kiyomizu autumn leaves.jpg")]
        return [
            _file("Kiyomizu sakura 2019.jpg"),
            _file("Kiyomizu main.jpg"),
            _file("Kiyomizu-dera in snow.jpg", lic="CC BY-NC 2.0"),
        ]

    monkeypatch.setattr(sp, "subcategories", fake_subcats)
    monkeypatch.setattr(sp, "files_in", fake_files)
    got = sp.find_season_photos("Kiyomizu-dera", "Kiyomizu main.jpg")
    assert set(got) == {"autumn", "spring"}
    assert got["autumn"]["author"] == "Someone"
    assert got["spring"]["source_url"].endswith("Kiyomizu sakura 2019.jpg")
