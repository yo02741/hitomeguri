from pipeline.seasons import build_stations
from pipeline.sources.jma import Normal, parse_mmdd, parse_normals

# 氣象廳累年値 CSV 的格式（節錄；各年欄位縮短）
SAMPLE = """4,さくらの開花,,,,,,,,,,,,
番号,地点名,2024,rm,2025,rm,平年値,rm,最早値,rm,最早年,最晩値,rm,最晩年
401,稚内　　,507,7,0,0,513,6,429,6,2002,526,6,2013
412,札幌　　,418,8,423,8,501,8,415,8,2023,514,8,1980
413,岩見沢　,0,0,0,0,0,0,422,6,2002,517,6,1984
991,那覇　　,118,8,120,8,116,8,103,8,2001,203,8,2003
"""


def test_parse_mmdd():
    assert parse_mmdd("521") == (5, 21)
    assert parse_mmdd("1225") == (12, 25)
    assert parse_mmdd("0") is None
    assert parse_mmdd("") is None


def test_parse_normals_reads_normal_column_and_skips_missing():
    rows = parse_normals(SAMPLE)
    assert [(n.station, n.month, n.day) for n in rows] == [
        ("稚内", 5, 13),
        ("札幌", 5, 1),
        ("那覇", 1, 16),
    ]


def test_build_stations_groups_by_station_in_prefecture_order():
    stations, unknown = build_stations({
        "sakura_kaika": [Normal("札幌", 5, 1), Normal("那覇", 1, 16), Normal("どこか", 4, 1)],
        "kaede": [Normal("札幌", 11, 6), Normal("稚内", 10, 30)],
    })  # fmt: skip
    assert [(s.name, s.prefecture) for s in stations] == [
        ("札幌", "hokkaido"),
        ("稚内", "hokkaido"),
        ("那覇", "okinawa"),
    ]
    assert stations[0].normals == {"kaede": "11-06", "sakura_kaika": "05-01"}
    assert unknown == {"どこか"}
