import json

from pipeline import packs
from pipeline.sources import pokefuta

DETAIL = """<div class="detail-manhole">
    <div class="heading">
        <h1>沖縄県/那覇市</h1>
    </div>
    <div class="inner">
        <div class="zukan">
            <ul>
                <li><a href="https://zukan.pokemon.co.jp/detail/058" target="_blank" rel="noopener noreferrer"><span>ガーディ</span><span>ポケモンずかんへ</span></a></li>
            </ul>
        </div>
        <div class="block map">
            <h2>マンホール場所</h2>
            <p>沖縄県那覇市首里池端町18</p>
            <div class="googlemap-link"><a href="https://maps.google.com/maps?q=26.22005,127.71657" target="_blank">Google マップへ</a></div>
        </div>
    </div>
</div>"""

PREF = """<li class="manhole-item"><a href="/manhole/desc/446/?is_modal=1" class="manhole-detail">那覇市</a></li>
<li class="manhole-item"><a href="/manhole/desc/425/?is_modal=1" class="manhole-detail">久米島町</a></li>
<li class="manhole-item"><a href="/manhole/desc/446/?is_modal=1" class="manhole-detail">那覇市</a></li>"""


def test_parse_detail():
    title, lat, lng, address, mons = pokefuta.parse_detail(DETAIL)
    assert title == "沖縄県/那覇市"
    assert pokefuta.municipality_of(title) == "那覇市"
    assert (lat, lng) == (26.22005, 127.71657)
    assert address == "沖縄県那覇市首里池端町18"
    assert mons == [("058", "ガーディ")]


def test_seed_pokefuta(tmp_path, monkeypatch):
    pages = {
        pokefuta.PREF_URL.format(slug="okinawa"): PREF,
        pokefuta.DETAIL_URL.format(id="446"): DETAIL,
        pokefuta.DETAIL_URL.format(id="425"): DETAIL.replace(
            "maps.google.com/maps?q=26.22005,127.71657", ""
        ),
    }
    monkeypatch.setattr(pokefuta, "get_text", lambda url: pages.get(url))
    monkeypatch.setattr(packs, "PACKS_DIR", tmp_path)
    (tmp_path / "pokefuta.json").write_text(
        json.dumps([{"id": "pokefuta-1", "prefecture": "kagawa"}]), encoding="utf-8"
    )
    report = packs.seed_pokefuta(["okinawa"])
    out = json.loads((tmp_path / "pokefuta.json").read_text(encoding="utf-8"))
    # 其他縣的既有資料保留；沒有座標的略過並列在報告裡
    assert [r["id"] for r in out] == ["pokefuta-1", "pokefuta-446"]
    rec = out[1]
    assert rec["municipality"] == "那覇市"
    assert rec["pokemon"] == [{"dex": "058", "ja": "ガーディ"}]
    assert rec["sources"][0]["url"].endswith("/manhole/desc/446/?is_modal=1")
    assert "沒有座標" in report


def test_shop_record_and_bundle(tmp_path, monkeypatch):
    from pipeline import build_bundles
    from pipeline.sources.osm import OsmElement

    monkeypatch.setattr(packs, "_pref_of", lambda lat, lng: "aichi")
    center = packs.shop_record(
        OsmElement("node/1", 35.16, 136.9, {"name": "ポケモンセンターナゴヤ", "shop": "toys"}), "d"
    )
    store = packs.shop_record(OsmElement("node/2", 35.1, 136.8, {"name": "ポケモンストア"}), "d")
    assert center["kind"] == "center" and store["kind"] == "store"
    assert center["id"] == "osm-node-1"

    (tmp_path / "pokecen.json").write_text(json.dumps([center]), encoding="utf-8")
    lid = packs.lid_record(
        pokefuta.Lid("446", "okinawa", "那覇市", "https://x", 26.22005, 127.71657, "", [("058", "ガーディ")]),
        "d",
    )
    (tmp_path / "pokefuta.json").write_text(json.dumps([lid]), encoding="utf-8")
    items = {it["id"]: it for it in build_bundles.pack_items_pokemon(tmp_path)}
    assert items["pokefuta-446"] == {
        "id": "pokefuta-446", "g": "lid", "p": "okinawa", "n": "那覇市",
        "lat": 26.22005, "lng": 127.71657, "pk": [["058", "ガーディ"]], "u": "https://x",
    }  # fmt: skip
    assert items["osm-node-1"]["g"] == "center"
