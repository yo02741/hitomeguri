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
