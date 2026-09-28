from pipeline import specialties
from pipeline.sources import maff

AREA = """<a href="../menu/kishimen_aichi.html">
<img class="resp_img" src="../../img/aichi_3_1.jpg" alt="きしめん">
<p class="tit">きしめん</p>
<p class="txt">厚さ1mm...</p></a>
<a href="../menu/aburagezushi_aichi.html">
<img class="resp_img" src="../../img/aichi_16_1.jpg" alt="あぶらげずし">
<p class="tit">あぶらげずし/いなりずし</p></a>
<a href="../menu/kishimen_aichi.html"><p class="tit">きしめん</p></a>"""


def test_parse_area():
    dishes = maff.parse_area(AREA, "aichi")
    assert [d.name for d in dishes] == ["きしめん", "あぶらげずし"]
    assert dishes[1].aliases == ["いなりずし"]
    assert dishes[0].url.endswith("/search_menu/menu/kishimen_aichi.html")


def test_category_for():
    assert specialties.category_for("徳島ラーメン", [], "food") == "ramen"
    assert specialties.category_for("鬼まんじゅう", [], "kyodo") == "sweets"
    assert specialties.category_for("宇治茶", ["緑茶"], "food") == "tea"
    assert specialties.category_for("泡盛", ["蒸留酒"], "food") == "sake"
    assert specialties.category_for("味噌煮込みうどん", ["郷土料理"], "kyodo") == "kyodo"


def test_pref_from_text():
    assert specialties.pref_from_text("家系ラーメンは、神奈川県横浜市発祥の…") == "kanagawa"
    assert specialties.pref_from_text("札幌ラーメンは、北海道札幌市の…") == "hokkaido"
    assert specialties.pref_from_text("日本のラーメン") is None


def test_merge_drafts_by_name_and_alias():
    dish = maff.Dish("aburagezushi_aichi", "aichi", "あぶらげずし", ["いなりずし"], "u")
    a = specialties.Draft("aichi", "あぶらげずし", "kyodo", maff=dish, aliases=["いなりずし"])
    b = specialties.Draft("aichi", "いなりずし", "food", qid="Q1", source="wikipedia")
    c = specialties.Draft("gifu", "いなりずし", "food", qid="Q1", source="wikipedia")
    out = specialties.merge_drafts([a, b, c])
    assert len(out) == 2
    assert out[0].maff is dish and out[0].qid == "Q1" and out[0].name == "あぶらげずし"
