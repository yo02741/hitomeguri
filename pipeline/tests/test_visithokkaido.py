from pipeline.sources.visithokkaido import parse_latlng, parse_list

LIST = """
<dd><a href="https://www.visit-hokkaido.jp/spot/detail_10527.html" target="_self">more</a></dd>
<dd><a href="https://www.visit-hokkaido.jp/spot/detail_10527.html" alt="天に続く道" title="天に続く道">more</a></dd>
<dd><a href="detail_10511.html" alt="白金青い池" title="白金青い池">more</a></dd>
"""


def test_parse_list_skips_pickups_without_alt():
    assert parse_list(LIST) == [("10527", "天に続く道"), ("10511", "白金青い池")]


def test_parse_latlng():
    text = "var gConf  = {lat:43.0597729944444,lng:141.346596269444,zoom:14,count:10,id:10004};"
    assert parse_latlng(text) == (43.0597729944444, 141.346596269444)
    assert parse_latlng("") == (None, None)
