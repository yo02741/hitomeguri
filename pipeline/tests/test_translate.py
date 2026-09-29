import json
from types import SimpleNamespace

from pipeline import build_bundles, translate


def test_with_translation_only_for_english():
    en = {"summary": {"text": "Zunda mochi is eaten at New Year.", "lang": "en"}}
    ja = {"summary": {"text": "ずんだ餅は正月に食べる。", "lang": "ja"}}
    zh = {translate.key_of(en["summary"]["text"]): "ずんだ餅在正月食用。"}
    assert build_bundles.with_translation(en, zh)["summary"]["text_zh"] == "ずんだ餅在正月食用。"
    assert "text_zh" not in build_bundles.with_translation(ja, zh)["summary"]
    other = {"summary": {"text": "Something else.", "lang": "en"}}
    assert "text_zh" not in build_bundles.with_translation(other, zh)["summary"]


class FakeClient:
    def __init__(self, reply):
        self.reply = reply
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kw):
        payload = json.loads(kw["messages"][0]["content"])
        assert kw["output_config"]["format"]["type"] == "json_schema"
        text = json.dumps({"translations": [{"id": p["id"], "zh": self.reply} for p in payload]})
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text=text)],
            usage=SimpleNamespace(input_tokens=10, output_tokens=5),
        )


def test_translate_batch_keeps_only_requested_ids():
    batch = [("k1", {"en": "A.", "name_ja": "甲"}), ("k2", {"en": "B.", "name_ja": "乙"})]
    got, usage = translate._translate_batch(FakeClient("譯文"), batch)
    assert got == {"k1": "譯文", "k2": "譯文"} and usage.output_tokens == 5


def test_banned_phrases():
    assert translate.BANNED.search("這裡宛如仙境")
    assert translate.BANNED.search("好吃！")
    assert not translate.BANNED.search("在正月食用。")
