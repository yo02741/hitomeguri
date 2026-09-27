from pipeline.enrich import Enrichment, apply_result, banned_hits, user_prompt


def _spot(**kw):
    s = {
        "id": "wd-Q1",
        "name": {"ja": "清水寺", "zh_tw": "清水寺", "en": "Kiyomizu-dera"},
        "prefecture": "kyoto",
        "tags": ["寺院", "世界遺產", "guide-S"],
        "summary_zh": "",
        "updated_at": "2000-01-01",
    }
    s.update(kw)
    return s


def test_banned_words_block_summary():
    assert banned_hits("值得一提的是這裡很美！") == ["值得一提", "！"]
    spot = _spot()
    e = Enrichment(summary_zh="宛如仙境。", kana="", name_zh_tw="", best_months=[], stay_minutes=0)
    issues = apply_result(spot, e, "2026-09-27")
    assert spot["summary_zh"] == "" and issues


def test_llm_kana_is_flagged_and_romanized():
    spot = _spot()
    e = Enrichment(
        summary_zh="778 年創建的寺院，懸空的本堂舞台以 139 根櫸木支撐。",
        kana="キヨミズデラ",
        name_zh_tw="清水寺",
        best_months=[4, 11, 13],
        stay_minutes=90,
    )
    apply_result(spot, e, "2026-09-27")
    assert spot["name"]["kana"] == "きよみずでら"
    assert spot["kana_source"] == "llm"
    assert spot["name"]["romaji"] == "Kiyomizu Dera"
    assert spot["best_months"] == [4, 11]
    assert spot["stay_minutes"] == 90
    assert spot["summary_zh"].startswith("778")


def test_prompt_only_asks_kana_when_missing():
    with_kana = _spot(name={"ja": "清水寺", "zh_tw": "清水寺", "kana": "きよみずでら"})
    assert "kana 回傳空字串" in user_prompt(with_kana, {})
    assert "需要填寫 kana" in user_prompt(_spot(), {"jawiki": "清水寺は…"})
