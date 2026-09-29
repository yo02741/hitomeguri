from pipeline import wiki
from pipeline.wiki import first_paragraph, reading_from_lead, strip_ja_note


def test_reading_from_lead() -> None:
    assert reading_from_lead("清水寺（きよみずでら）は、京都市東山区にある寺院。") == "きよみずでら"
    assert reading_from_lead("東大寺（とうだいじ、英語: Tōdai-ji）は奈良市にある。") == "とうだいじ"
    assert reading_from_lead("金閣寺 (きんかくじ) は…") == "きんかくじ"
    # 括號裡第一段不是假名（旧字体など）時取後面的假名段
    assert reading_from_lead("大坂城（旧字体：大坂城、おおさかじょう）は") == "おおさかじょう"


def test_reading_from_lead_rejects_non_reading() -> None:
    assert reading_from_lead("二条城（1603年築城）は") is None
    assert reading_from_lead("本文にだけ括弧がある。後で（ふりがな）") is None


def test_first_paragraph_cuts_at_sentence() -> None:
    text = "一。" * 50 + "\n第二段"
    out = first_paragraph(text, limit=21)
    assert out == "一。" * 10
    assert first_paragraph("短い説明。\n次の段落。") == "短い説明。"


def test_zh_summary_converted_to_traditional() -> None:
    assert wiki._TO_TW.convert("位于京都市伏见区的神社") == "位於京都市伏見區的神社"


def test_reading_requires_matching_name() -> None:
    lead = "二条城（にじょうじょう）は、京都市中京区にある城。"
    assert reading_from_lead(lead, "二条城") == "にじょうじょう"
    assert reading_from_lead(lead, "元離宮二条城") is None
    assert reading_from_lead("金閣寺 (きんかくじ) は…", "金閣寺 (京都)") == "きんかくじ"


def test_strip_ja_note() -> None:
    text = "伏見稻荷大社（日語：伏見稲荷大社／ふしみいなりたいしゃ，羅馬化：Fushimi）是一座神社。"
    assert strip_ja_note(text) == "伏見稻荷大社是一座神社。"
    nested = "元離宮二條城（日語：元離宮二条城〔元離宮二條城〕（もとりきゅう）／x）是城堡。"
    assert strip_ja_note(nested) == "元離宮二條城是城堡。"
    assert strip_ja_note("清水寺是一座寺院（778年）。") == "清水寺是一座寺院（778年）。"


def test_zh_label_prefers_traditional_then_converts_simplified():
    from pipeline.wiki import zh_label

    assert zh_label({"zh-tw": "祇園祭", "zh": "祇园祭"}, "x") == "祇園祭"
    assert zh_label({"zh-hans": "长崎灯会"}, "x") == "長崎燈會"
    assert zh_label({"en": "Gion"}, "祇園祭") == "祇園祭"


def test_pick_summary_order_zh_en_ja():
    from pipeline.sources.wikidata import Entity
    from pipeline.wiki import pick_summary

    ent = Entity(qid="Q1", sitelinks={"jawiki": "祇園祭", "enwiki": "Gion Matsuri"})
    extracts = {
        "zhwiki": {},
        "enwiki": {"Gion Matsuri": "The Gion Festival takes place annually in Kyoto."},
        "jawiki": {"祇園祭": "祇園祭は、京都市東山区の八坂神社の祭礼。"},
    }
    s = pick_summary(ent, extracts, "2026-09-29")
    assert s and s["lang"] == "en" and s["source_url"].startswith("https://en.wikipedia.org/")


def test_first_paragraph_english_cuts_at_sentence():
    from pipeline.wiki import first_paragraph

    text = "First sentence here. " * 60
    out = first_paragraph(text, lang="en")
    assert out.endswith(".") and len(out) <= 550
