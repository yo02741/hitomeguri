from pipeline import climate


def _page(rows: list[list[str]]) -> str:
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table id='tablefix1' class='data2_s'><tr><th>月</th></tr>{body}</table>"


def test_parse_value_quality_marks():
    assert climate.parse_value("12.3") == 12.3
    assert climate.parse_value("5.5 )") == 5.5  # 準正常值
    assert climate.parse_value("31*") == 31.0
    assert climate.parse_value("0 ]") is None  # 資料不足值
    assert climate.parse_value("×") is None
    assert climate.parse_value("///") is None
    assert climate.parse_value("--") is None
    assert climate.parse_value("") is None


def test_station_months_averages_valid_years():
    # p1：月, 気圧2, 降水合計, 最大3, 気温日平均, 日最高, 日最低
    def p1(temp: str) -> str:
        return _page(
            [[str(m), "1012", "1019", "100", "1", "1", "1", temp, "20", "10"] for m in range(1, 13)]
        )

    # a1：月 … 最後 8 欄是降水階級日數，≧1.0mm 是倒數第 6 欄
    def a1(days: str) -> str:
        return _page([[str(m), "1012", "1019", "1008", "24", "100", "11", "21", "14", "x", "4", "21",
                       "1", "31", "17", "12", days, "5", "2", "0", "0", "0"] for m in range(1, 13)])  # fmt: skip

    years = list(range(2016, 2026))
    pages: dict[str, str] = {}
    for i, y in enumerate(years):
        # 一年資料不足（"]"）：不算進平均
        temp = "10.0 ]" if y == 2016 else str(10 + i)
        pages[climate.MONTHLY_URL.format(prec=51, block="47636", year=y, view="p1")] = p1(temp)
        pages[climate.MONTHLY_URL.format(prec=51, block="47636", year=y, view="a1")] = a1("8")
    months, urls = climate.station_months(51, "47636", years, fetch=pages.get)
    assert len(months) == 12 and len(urls) == 20
    jan = months[0]
    assert jan.temp == round(sum(10 + i for i in range(1, 10)) / 9, 1)
    assert jan.high == 20.0 and jan.low == 10.0 and jan.precip == 100.0 and jan.rain_days == 8.0
    assert jan.years == 9


def test_too_few_years_left_empty():
    years = list(range(2016, 2026))
    months, _ = climate.station_months(51, "47636", years, fetch=lambda url: None)
    assert months[0].temp is None and months[0].years == 0


def test_every_prefecture_has_a_station():
    from pipeline import geo

    assert sorted(climate.STATIONS) == sorted(geo.pref_slugs())
