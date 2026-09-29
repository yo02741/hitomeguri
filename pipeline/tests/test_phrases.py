"""旅前準備會話（data/phrases）：格式、id 不重複、假名與羅馬拼音的字元。"""

import re

from pipeline.build_bundles import load_phrases

KANA = re.compile(r"^[\u3040-\u30ffー・、。？／ 　]+$")


def test_phrases_valid_and_unique() -> None:
    phrases = load_phrases()
    assert len(phrases) >= 100
    assert len({p["id"] for p in phrases}) == len(phrases)


def test_kana_and_romaji() -> None:
    for p in load_phrases():
        assert KANA.match(p["kana"]), p["id"]
        assert p["romaji"].isascii() or all(c.isascii() or c in "āīūēōĀĪŪĒŌ" for c in p["romaji"]), p["id"]
        if "answer_hint" in p:
            assert KANA.match(p["answer_hint"]["kana"]), p["id"]


def test_theme_or_common() -> None:
    for p in load_phrases():
        ctx = p["context"]
        prefix = p["id"].split("-")[0]
        assert prefix == "common" or ctx.get("theme") == prefix or ctx.get("spot_kind") == prefix, p["id"]
