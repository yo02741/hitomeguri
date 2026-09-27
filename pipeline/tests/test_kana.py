from pipeline.kana import is_kana, normalize_kana, romaji_with_spacing, to_romaji


def test_to_romaji_basic():
    assert to_romaji("きょうと") == "kyoto"
    assert to_romaji("おおさか") == "osaka"
    assert to_romaji("なごやじょう") == "nagoyajo"
    assert to_romaji("いっぽどう") == "ippodo"
    assert to_romaji("しんおおさか") == "shin'osaka"


def test_katakana_and_spacing():
    assert normalize_kana("フシミ イナリ タイシャ") == "ふしみいなりたいしゃ"
    assert is_kana("フシミ・イナリ")
    assert not is_kana("伏見稲荷")
    assert (
        romaji_with_spacing("ふしみいなりたいしゃ", "Fushimi Inari-taisha")
        == "Fushimi Inari Taisha"
    )
    assert romaji_with_spacing("きよみずでら", "Kiyomizu-dera") == "Kiyomizu Dera"
    assert romaji_with_spacing("きんかくじ", "Rokuon-ji") == "Kinkakuji"
