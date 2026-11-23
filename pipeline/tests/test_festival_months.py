from pipeline.festival_months import grounded

ARTICLE = "毎年7月下旬から8月上旬にかけて行われる。かつては旧暦6月に行われていた。"


def test_quote_must_appear_in_article() -> None:
    assert grounded([7, 8], "毎年7月下旬から8月上旬にかけて行われる。", ARTICLE) == [7, 8]
    assert grounded([7], "毎年7月に行われる。", ARTICLE) == []


def test_month_must_be_written_in_quote() -> None:
    assert grounded([9], "毎年7月下旬から8月上旬にかけて行われる。", ARTICLE) == []


def test_lunar_month_not_accepted() -> None:
    assert grounded([6], "かつては旧暦6月に行われていた。", ARTICLE) == []


def test_digit_boundary_and_width() -> None:
    article = "毎年１１月３日に行われる。"
    assert grounded([11], "毎年１１月３日に行われる。", article) == [11]
    assert grounded([1], "毎年１１月３日に行われる。", article) == []


def test_empty() -> None:
    assert grounded([], "", ARTICLE) == []
