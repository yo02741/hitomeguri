import pytest

from pipeline import photo_stats as ps


def test_subject_flags_skip_words_in_the_spot_name() -> None:
    cats = ["Bakeries in Osaka", "Dōtonbori at night", "Police of Japan", "Halloween in Shibuya"]
    assert ps.subject_flags(cats, "道頓堀グリコサイン Glico Man") == ["警察", "活動", "店家"]
    # 看板本身就是 sign：sign 不算
    assert "招牌" not in ps.subject_flags(["Glico sign"], "Glico sign")
    assert "招牌" in ps.subject_flags(["Signs in Osaka"], "Kinkaku-ji")


def test_verdict_agreement_and_alternatives() -> None:
    sp = ps.SpotPhotos(id="Q1", pref="tokyo", name="渋谷", en="Shibuya crossing", main="A.jpg")
    sp.p18 = ["A.jpg", "B.jpg"]
    sp.wiki = {"jawiki": "C.jpg", "enwiki": "C.jpg"}
    sp.cats = {"A.jpg": ["Police in Tokyo"], "B.jpg": [], "C.jpg": []}
    v = ps.verdict(sp)
    assert v["main_flags"] == ["警察"]
    assert v["alts"] == ["B.jpg", "C.jpg"]
    assert v["wiki_agree_other"] == ["C.jpg"]


def test_exempt_keeps_flags_unless_the_spot_is_that_kind() -> None:
    assert ps.exempt(["車輛"], "十国鋼索線", "Jukkoku cable car", []) == []
    assert ps.exempt(["車輛"], "伊吹山", "Mount Ibuki", ["自然"]) == ["車輛"]
    assert ps.exempt(["室內"], "秋田市立千秋美術館", "", ["美術館"]) == []
    assert ps.exempt(["招牌", "店家"], "竹下通り", "Takeshita Street", ["購物"]) == []


def test_pick_skips_excluded_and_non_photos(monkeypatch) -> None:
    from pipeline import photos

    monkeypatch.setattr(photos, "EXCLUDED", {"Bad.jpg"})
    assert photos.pick(["Map.svg", "Bad.jpg", "Good.jpg"], lambda f: True) == "Good.jpg"
    assert photos.pick(["Good.jpg"], lambda f: False) is None


def test_photo_check_flags() -> None:
    from pipeline.photo_check import flags, keep_ratio

    assert keep_ratio(4000, 3000) == pytest.approx(0.536, abs=0.01)
    assert flags(4000, 3000) == []
    assert flags(640, 480) == ["糊"]
    assert flags(6000, 2000) == ["裁"]
    assert flags(2000, 3000) == []
    assert flags(0, 0) == []


def test_sharp_candidates_keep_only_big() -> None:
    from pipeline.photo_review import sharp_candidates
    from pipeline.photo_stats import SpotPhotos

    sp = SpotPhotos("Q1", "kyoto", "x", "x", "Small.jpg", p18=["Small.jpg", "Big.jpg", "Tiny.jpg"])
    sizes = {"Big.jpg": (4000, 3000, ""), "Tiny.jpg": (800, 600, "")}
    cats = {"Cat big.jpg": (3000, 2000), "Pano.jpg": (9000, 2000), "Map.png": (4000, 3000)}
    got = [f for f, _ in sharp_candidates(sp, sizes, cats)]
    assert got == ["Small.jpg", "Big.jpg", "Cat big.jpg"]
