from pipeline import wiki
from pipeline.wiki import first_paragraph, reading_from_lead


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
