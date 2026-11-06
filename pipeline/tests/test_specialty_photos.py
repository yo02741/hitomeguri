import json
from types import SimpleNamespace

from pipeline import specialty_photos as sp


def _file(title, lic="CC BY-SA 4.0", mime="image/jpeg", width=1200):
    return {
        "title": title,
        "url": f"https://upload.wikimedia.org/x/{title}",
        "thumburl": f"https://upload.wikimedia.org/thumb/{title}",
        "descriptionurl": f"https://commons.wikimedia.org/wiki/File:{title}",
        "mime": mime,
        "width": width,
        "height": 800,
        "extmetadata": {"Artist": {"value": "Someone"}, "LicenseShortName": {"value": lic}},
    }


def test_queries_strip_parenthesis():
    item = {"name": {"ja": "イカスミ汁", "en": "Ikasumi-Jiru(Squid ink soup)"}}
    assert sp.queries(item) == ["イカスミ汁", "Ikasumi-Jiru"]
    assert sp.queries({"name": {"ja": "ずんだ餅"}}) == ["ずんだ餅"]


def test_candidates_keep_free_large_images(monkeypatch):
    files = [
        _file("a.jpg"),
        _file("nc.jpg", lic="CC BY-NC 2.0"),
        _file("small.jpg", width=300),
        _file("map.svg", mime="image/svg+xml"),
        _file("b.jpg", lic="CC0"),
    ]
    monkeypatch.setattr(sp, "search", lambda q, limit=8: files)
    got = [f["title"] for f in sp.candidates({"name": {"ja": "x", "en": "y"}})]
    assert got == ["a.jpg", "b.jpg"]


class FakeClient:
    def __init__(self, choice):
        self.choice = choice
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))
        self.images = 0

    def create(self, **kw):
        self.images = sum(1 for c in kw["messages"][0]["content"] if c["type"] == "image")
        text = json.dumps({"choice": self.choice, "reason": "盛好的料理"})
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text=text)],
            usage=SimpleNamespace(input_tokens=100, output_tokens=10),
        )


def test_judge_sends_images_and_bounds_choice(monkeypatch):
    monkeypatch.setattr(sp, "get_bytes", lambda url, min_interval=0.5: b"\xff\xd8jpeg")
    item = {"name": {"ja": "イカスミ汁", "kana": "いかすみじる"}, "category": "kyodo"}
    cands = [_file("a.jpg"), _file("b.jpg")]
    client = FakeClient(1)
    choice, reason, usage = sp.judge(client, item, "沖縄県", cands)
    assert (choice, client.images, usage.input_tokens) == (1, 2, 100)
    assert sp.judge(FakeClient(5), item, "沖縄県", cands)[0] == -1
    assert sp.judge(FakeClient(-1), item, "沖縄県", cands)[0] == -1
