from pipeline import config
from pipeline.sources.crossroadfukuoka import parse_detail, parse_list

LIST = """
<ul class="o-digest--tile__list">
  <li class="o-digest--tile__item">
    <a href="https://www.crossroadfukuoka.jp/spot/10256"
       class="o-digest--tile__anchor">
      <div class="o-digest--tile__image-box ">
      <h2 class="o-digest--tile__title">太宰府天満宮</h2>
  <li class="o-digest--tile__item">
    <a href="https://www.crossroadfukuoka.jp/spot/11833"
       class="o-digest--tile__anchor">
      <h2 class="o-digest--tile__title">櫛田神社</h2>
</ul>
"""

DETAIL = """
<h1 class="o-heading-low-type4">
    <span>立花いこいの森</span>
</h1>
<div embed-url="//www.google.com/maps/embed/v1/place?region=JP&amp;key=K&amp;language=ja&amp;q=33.170219,130.472456&amp;zoom=16"></div>
<a class="o-button o-button--category-tag" href="/spot?c=3">
    公園・庭園
</a>
"""


def test_parse_list_in_page_order():
    assert parse_list(LIST) == [("10256", "太宰府天満宮"), ("11833", "櫛田神社")]


def test_parse_detail():
    name, lat, lng, cats = parse_detail(DETAIL)
    assert (name, lat, lng) == ("立花いこいの森", 33.170219, 130.472456)
    assert cats == ["公園・庭園"]


def test_event_names_excluded():
    rx = config.OFFICIAL_EXCLUDE_NAME_RE
    for name in (
        "【宇美八幡宮】放生会",
        "山王寺　風鈴祭り",
        "矢部川沿いの彼岸花",
        "キリンコスモスフェスタ",
    ):
        assert rx.search(name), name
    for name in ("太宰府天満宮", "櫛田神社", "福岡城跡", "能古島", "八女中央大茶園"):
        assert not rx.search(name), name
