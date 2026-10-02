from typing import Any

from pipeline import season_photos as sp


def test_season_of():
    assert sp.season_of("Kiyomizu-dera in autumn") == "autumn"
    assert sp.season_of("Cherry blossoms at Himeji Castle") == "spring"
    assert sp.season_of("Kinkaku-ji in snow") == "winter"
    assert sp.season_of("Kiyomizu-dera at night") == "night"
    assert sp.season_of("Autumn illumination at Kodai-ji") == "night"
    assert sp.season_of("Hot springs in Beppu") is None
    assert sp.season_of("Kasuga-taisha") is None
    assert sp.season_of("Kegon Falls") is None
    assert sp.season_of("Interior of the main hall") is None
    # 景點名稱裡的季節字樣不算
    assert sp.season_of("SPring-8 central administration building", "SPring-8") is None
    assert sp.season_of("SPring-8 at night", "SPring-8") == "night"


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


def test_name_tokens():
    assert sp.name_tokens("Himeji Castle", "姫路城") == ["himeji", "姫路"]
    assert sp.name_tokens("Mount Fuji", "富士山") == ["fuji", "富士"]
    assert sp.name_tokens("Kiyomizu-dera", "清水寺") == ["kiyomizu", "清水"]


def test_score_requires_the_spot():
    toks = sp.name_tokens("Himeji Castle", "姫路城")
    # 「姬路城的櫻花」分類裡只寫 sakura 的：拍不拍得到城不知道，不收
    assert sp.score(_file("Sakura 2019 03.jpg"), toks, set(), {}) is None
    # 檔名有景點名稱、或標了描繪這個景點：收
    assert sp.score(_file("Himeji Castle with cherry blossoms.jpg"), toks, set(), {}) is not None
    assert sp.score(_file("DSC0001.jpg"), toks, {"DSC0001.jpg"}, {}) is not None
    # 特寫扣分；優質圖片加分
    near = sp.score(_file("Himeji castle roof detail.jpg"), toks, set(), {})
    far = sp.score(_file("Himeji castle in spring.jpg"), toks, set(), {})
    qi = sp.score(
        _file("Himeji castle in spring 2.jpg"), toks, set(), {"Himeji castle in spring 2.jpg": 40}
    )
    assert near is not None and far is not None and qi is not None
    assert near < 40 <= far < qi
    # 畫、老照片不收；人潮扣分
    fuji = sp.name_tokens("Mount Fuji", "富士山")
    assert sp.score(_file("Minsetsu Fuji 1767.jpg"), fuji, {"Minsetsu Fuji 1767.jpg"}, {}) is None
    assert sp.score(_file("Mt. Fuji framed by cherry blossoms - DPLA.jpg"), fuji, set(), {}) is None
    assert (
        sp.score({**_file("Fuji view.jpg"), "cats": ["Ukiyo-e of Mount Fuji"]}, fuji, set(), {})
        is None
    )
    crowd = sp.score(_file("Crowds walking to Himeji Castle in spring.jpg"), toks, set(), {})
    assert crowd is not None and far is not None and crowd < far


def test_find_season_photos(monkeypatch):
    def fake_subcats(cat: str) -> list[str]:
        return [
            "Kiyomizu-dera in autumn",
            "Kiyomizu-dera at night",
            "Cherry blossoms at Kiyomizu-dera",
        ]

    def fake_files(cat: str, limit: int = 50) -> list[dict[str, Any]]:
        if cat == "Kiyomizu-dera in autumn":
            return [_file("Kiyomizu autumn leaves.jpg"), _file("Momiji 2020.jpg", 4000, 2667)]
        if cat == "Kiyomizu-dera at night":
            return [_file("Kiyomizu-dera illumination 2018.jpg")]
        if cat == "Cherry blossoms at Kiyomizu-dera":
            # 只有花的特寫（檔名沒有景點名稱）
            return [_file("Sakura macro.jpg", 5000, 3333)]
        return [
            _file("Kiyomizu main.jpg"),
            _file("Kiyomizu-dera in snow.jpg", lic="CC BY-NC 2.0"),
        ]

    def fake_depicts(qid: str, seasonal: bool = False) -> list[dict[str, Any]]:
        return [{**_file("IMG_2041.jpg"), "cats": ["Kiyomizu-dera in summer"]}]

    monkeypatch.setattr(sp, "subcategories", fake_subcats)
    monkeypatch.setattr(sp, "files_in", fake_files)
    monkeypatch.setattr(sp, "depicting_files", fake_depicts)
    monkeypatch.setattr(sp, "quality_of", lambda titles: {})
    got = sp.find_season_photos("Kiyomizu-dera", "Kiyomizu main.jpg", "Q123", "清水寺")
    # 春：只有沒寫名稱的花特寫 → 不放；冬：非商用授權 → 不放；夏：描繪這個景點、分類是夏天
    assert set(got) == {"autumn", "night", "summer"}
    assert got["autumn"]["source_url"].endswith("Kiyomizu autumn leaves.jpg")
    assert "illumination" in got["night"]["source_url"]
    assert got["summer"]["source_url"].endswith("IMG_2041.jpg")
    assert got["autumn"]["author"] == "Someone"
