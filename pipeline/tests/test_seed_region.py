"""用假資料跑完整的 seed-region 流程（不連網）。"""

import json

import pytest

from pipeline import build_bundles, major, wiki
from pipeline.sources.commons import ImageInfo
from pipeline.sources.osm import OsmElement
from pipeline.sources.wikidata import Entity


def _ent(qid, ja, lat, lng, **kw):
    e = Entity(qid=qid, labels={"ja": ja, **kw.pop("labels", {})}, lat=lat, lng=lng)
    for k, v in kw.items():
        setattr(e, k, v)
    return e


ENTS = {
    "Q1": _ent(
        "Q1", "伏見稲荷大社", 34.9671, 135.7727,
        labels={"zh-tw": "伏見稻荷大社", "en": "Fushimi Inari-taisha"},
        kana_all=["-いなりの", "ふしみいなりたいしゃ"], image="Fushimi.jpg", heritage=["QH1"],
        located_in=["QFUSHIMI"],
        sitelinks={
            "jawiki": "伏見稲荷大社", "zhwiki": "伏見稻荷大社", "enwiki": "Fushimi Inari-taisha",
        },
    ),
    "Q2": _ent(
        "Q2", "伏見稲荷大社本殿", 34.9672, 135.7728, heritage=["QH2"],
        sitelinks={"jawiki": "a", "enwiki": "b", "zhwiki": "c"},
    ),
    "Q3": _ent(
        "Q3", "清水寺", 34.9949, 135.7850, labels={"zh": "清水寺", "en": "Kiyomizu-dera"},
        kana_all=["キヨミズデラ"], heritage=["QH1"], sitelinks={"jawiki": "清水寺"},
    ),
    "Q9": _ent("Q9", "大阪城", 34.6873, 135.5262, sitelinks={"jawiki": "大阪城"}),  # 縣外
    "Q5": _ent(
        "Q5", "鹿苑寺", 35.0394, 135.7292, labels={"zh-tw": "金閣寺 (京都)"},
        sitelinks={"jawiki": "鹿苑寺"},
    ),
    # 縣本身：依 P31 排除
    "Q7": _ent(
        "Q7", "京都府", 35.0211, 135.7556, instance_of=["QP"], sitelinks={"jawiki": "京都府"}
    ),
    # 座標落在滋賀，但行政區鏈屬於京都 → 應收錄（犬山城那類縣界誤判）
    "Q8": _ent(
        "Q8", "境界寺", 35.1286, 136.0979, located_in=["QKY"], sitelinks={"jawiki": "境界寺"}
    ),
    # 車站：依 P31 排除
    "Q10": _ent(
        "Q10", "嵯峨嵐山駅", 35.0183, 135.6810, instance_of=["QSTA"], sitelinks={"jawiki": "x"}
    ),
}  # fmt: skip


@pytest.fixture
def fake_sources(monkeypatch, tmp_path):
    osm_els = [
        OsmElement("way/10", 34.9670, 135.7726, {"name": "伏見稲荷大社", "wikidata": "Q1",
                   "amenity": "place_of_worship", "religion": "shinto"}),
        OsmElement("node/11", 35.0036, 135.7780, {"name": "八坂の塔", "tourism": "attraction",
                   "name:ja-Hira": "やさかのとう", "name:en": "Yasaka Pagoda"}),
        OsmElement("node/12", 34.99495, 135.78505, {"name": "清水寺", "tourism": "attraction"}),
        # 寺內博物館也掛了伏見稲荷大社的 wikidata：不能影響主體的分類與假名
        OsmElement("node/14", 34.9675, 135.7730, {"name": "稲荷大社宝物館", "wikidata": "Q1",
                   "tourism": "museum", "name:ja-Hira": "ほうもつかん"}),
    ]  # fmt: skip
    stations = [
        OsmElement("node/20", 34.9677, 135.7704, {"name": "稲荷", "name:ja-Hira": "いなり",
                   "name:en": "Inari"}),
        OsmElement("node/21", 34.9660, 135.7720, {"name": "稲荷", "name:en": "Inari"}),
        OsmElement("node/22", 35.0000, 135.7700, {"name": "清水五条"}),
    ]  # fmt: skip
    monkeypatch.setattr(major.osm, "attractions", lambda iso: osm_els)
    monkeypatch.setattr(major.osm, "stations", lambda bbox: stations)
    monkeypatch.setattr(
        major.wikidata, "heritage_items_in_box", lambda *a: ["Q2", "Q3", "Q9", "Q7", "Q8", "Q10"]
    )
    monkeypatch.setattr(
        major.wikidata, "entities", lambda qids: {q: ENTS[q] for q in qids if q in ENTS}
    )
    monkeypatch.setattr(
        major.wikidata,
        "labels_ja",
        lambda qids: {
            "QH1": "世界遺産", "QH2": "重要文化財", "QP": "日本の都道府県", "QSTA": "鉄道駅",
        },
    )  # fmt: skip
    monkeypatch.setattr(
        major.wikidata, "search", lambda name, **kw: ["Q5"] if "鹿苑寺" in name else []
    )
    monkeypatch.setattr(major.wikidata, "prefecture_items", lambda: {"QKY": "JP-26"})
    monkeypatch.setattr(
        major.wikidata, "parents", lambda qids: {q: ["QKY"] for q in qids if q == "QFUSHIMI"}
    )
    monkeypatch.setattr(major.geo, "contains_fine", major.geo.contains)
    monkeypatch.setattr(
        major.pageviews, "yearly_views", lambda site, title: 100000 if "伏見" in title else 1000
    )
    monkeypatch.setattr(
        major.commons,
        "image_info",
        lambda files: {
            "Fushimi.jpg": ImageInfo(
                "https://u/thumb.jpg", "Someone", "CC BY-SA 4.0", "https://commons/File:Fushimi.jpg"
            )
        },
    )
    monkeypatch.setattr(
        major,
        "load_seeds",
        lambda pref: [
            {"name_ja": "伏見稲荷大社", "guide_tier": "S", "themes": ["goshuin"], "kind": "major"},
            {"name_ja": "鹿苑寺（金閣寺）", "guide_tier": "S", "themes": [], "kind": "major"},
            {"name_ja": "存在しない寺", "guide_tier": "A", "themes": [], "kind": "major"},
        ],
    )
    monkeypatch.setattr(
        wiki.wikipedia,
        "intro_extracts",
        lambda site, titles: {
            "zhwiki": {"伏見稻荷大社": "伏見稻荷大社是位於京都市伏見區的神社。\n第二段。"},
            "jawiki": {"鹿苑寺": "鹿苑寺（ろくおんじ）は、京都市北区にある臨済宗の寺院。"},
        }.get(site, {}),
    )
    # 維基「京都府の観光地」：Q5（鹿苑寺）列在上面
    monkeypatch.setattr(major, "tourism_qids", lambda pref: {"Q5"})
    monkeypatch.setattr(major, "extra_category_qids", lambda pref: set())
    monkeypatch.setattr(major, "SPOTS_DIR", tmp_path / "spots")
    return tmp_path


def test_seed_region_end_to_end(fake_sources):
    report = major.seed_region("kyoto")
    spots = json.loads((fake_sources / "spots" / "kyoto.json").read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in spots}

    # 縣外的大阪城、縣本身、車站被排除；本殿併入主體；清水寺 OSM 與 Wikidata 合併；
    # 座標在縣界外但行政區屬於京都的境界寺收錄；只有 OSM、沒有 Wikidata 的八坂の塔排除
    assert set(by_id) == {"wd-Q1", "wd-Q3", "wd-Q5", "wd-Q8"}

    fushimi = by_id["wd-Q1"]
    assert fushimi["featured"] is True
    assert fushimi["name"] == {
        "ja": "伏見稲荷大社",
        "kana": "ふしみいなりたいしゃ",
        "romaji": "Fushimi Inari Taisha",
        "zh_tw": "伏見稻荷大社",
        "en": "Fushimi Inari-taisha",
    }
    assert fushimi["kana_source"] == "wikidata"
    assert fushimi["tags"][:2] == ["神社", "世界遺產"]
    assert "guide-S" in fushimi["tags"]
    assert fushimi["themes"] == ["goshuin"]
    assert fushimi["images"][0]["author"] == "Someone"
    stations = fushimi["nearest_stations"]
    assert stations[0]["name"]["ja"] == "稲荷"
    assert stations[0]["name"]["kana"] == "いなり"

    kiyomizu = by_id["wd-Q3"]
    assert kiyomizu["name"]["kana"] == "きよみずでら"
    assert kiyomizu["external_ids"]["osm"] == "node/12"

    # 種子補查：鹿苑寺（金閣寺）用 Wikidata 搜尋補進來，S 級一律精選；消歧義括號去掉
    assert by_id["wd-Q5"]["featured"] is True
    assert by_id["wd-Q5"]["name"]["zh_tw"] == "金閣寺"

    assert "存在しない寺" in report
    assert [s["id"] for s in spots] == sorted(s["id"] for s in spots)


def test_rerun_preserves_enriched_fields(fake_sources):
    major.seed_region("kyoto")
    path = fake_sources / "spots" / "kyoto.json"
    spots = json.loads(path.read_text(encoding="utf-8"))
    for s in spots:
        if s.get("summary"):
            s["summary"]["fetched_at"] = "2000-01-01"
        s["updated_at"] = "2000-01-01"
    path.write_text(json.dumps(spots, ensure_ascii=False), encoding="utf-8")
    major.seed_region("kyoto")
    again = json.loads(path.read_text(encoding="utf-8"))
    # 簡介內容沒變：取得時間與 updated_at 都保留
    assert all(s["summary"]["fetched_at"] == "2000-01-01" for s in again if s.get("summary"))
    assert all(s["updated_at"] == "2000-01-01" for s in again)


def test_featured_category_cap():
    drafts = [
        major.Draft(
            key=f"k{i}", lat=0, lng=0, osm_els=[OsmElement("node/1", 0, 0, {"name": f"{i}号古墳"})]
        )
        for i in range(5)
    ]
    assert len(major.pick_featured(drafts)) == 2


def test_build_bundles(fake_sources):
    major.seed_region("kyoto")
    out = fake_sources / "bundles"
    build_bundles.build(fake_sources / "spots", out)
    index = json.loads((out / "_index.json").read_text(encoding="utf-8"))
    assert index["prefectures"]["kyoto"]["count"] == 4
    entries = json.loads((out / "map" / "kyoto.json").read_text(encoding="utf-8"))
    fushimi = next(e for e in entries if e["id"] == "wd-Q1")
    assert fushimi["f"] == 1 and fushimi["h"] == "ふしみいなりたいしゃ" and fushimi["c"] == "神社"


def test_prune_and_refill_featured(tmp_path, monkeypatch):
    from pipeline import curate

    spots = [
        {"id": "wd-Q1", "kind": "major", "name": {"ja": "甲寺"}, "tags": ["寺院"], "featured": True,
         "score": 90, "status": "published", "external_ids": {"wikidata": "Q1"}},
        {"id": "wd-Q2", "kind": "major", "name": {"ja": "某古墳 (某市)"}, "tags": [], "featured": True,
         "score": 80, "status": "published", "external_ids": {"wikidata": "Q2"}},
        {"id": "osm-node-3", "kind": "major", "name": {"ja": "パチンコ"}, "tags": [], "featured": False,
         "score": 0, "status": "published", "external_ids": {}},
        {"id": "wd-Q4", "kind": "major", "name": {"ja": "機関車"}, "tags": [], "featured": False,
         "score": 70, "status": "published", "external_ids": {"wikidata": "Q4"}},
        {"id": "wd-Q5", "kind": "major", "name": {"ja": "乙神社"}, "tags": ["神社"], "featured": False,
         "score": 60, "status": "published", "external_ids": {"wikidata": "Q5"}},
    ]  # fmt: skip
    kept = [s for s in spots if not curate.is_excluded(s, {"wd-Q9"})]
    assert [s["id"] for s in kept] == ["wd-Q1", "wd-Q4", "wd-Q5"]
    added = curate.refill_featured(kept)
    # 類型不明的「機関車」不遞補，改補有類型的乙神社
    assert added == ["乙神社"]


def test_category_for_shopping_and_coast():
    def cat(name, **tags):
        el = OsmElement("node/1", 0, 0, {"name": name, **tags})
        return major.category(major.Draft(key="k", lat=0, lng=0, osm_els=[el]))

    assert cat("国際通り") == "街區"
    assert cat("港川外人住宅") == "街區"
    assert cat("泊いゆまち") == "市場"
    assert cat("イーアス沖縄豊崎") == "購物"
    assert cat("瀬長島") == "島"
    assert cat("古宇利大橋") == "橋"
    assert cat("知念岬") == "岬"
    assert cat("どこか", natural="beach") == "海灘"


def test_merge_official(monkeypatch):
    from pipeline.sources.okinawastory import OfficialSpot

    monkeypatch.setattr(major.geo, "contains_fine", lambda pref, lat, lng: True)
    existing = major.Draft(
        key="Q10", lat=26.2147, lng=127.6861,
        osm_els=[OsmElement("way/1", 26.2147, 127.6861, {"name": "国際通り"})],
    )  # fmt: skip
    drafts = {"Q10": existing}
    items = [
        OfficialSpot("okinawastory", "1", "国際通り", "https://x/1", 1, 26.2150, 127.6870, []),
        OfficialSpot(
            "okinawastory", "2", "泊いゆまち", "https://x/2", 2, 26.2270, 127.6780, ["市場"]
        ),
        OfficialSpot("okinawastory", "3", "某ホテル", "https://x/3", 3, 26.2, 127.6, ["宿泊施設"]),
    ]
    monkeypatch.setattr(major, "OFFICIAL_SOURCES", {"okinawa": lambda n: items})
    major.merge_official("okinawa", drafts)
    assert existing.official and existing.official.rank == 1
    assert set(drafts) == {"Q10", "okinawastory-2"}
    new = drafts["okinawastory-2"]
    assert major.spot_id(new) == "okinawastory-2" and major.category(new) == "市場"


def test_parse_okinawastory():
    from pipeline.sources import okinawastory

    detail = (
        '<h1 class="os-c-title-cmn-main">知念岬公園</h1>'
        '<iframe src="https://www.google.com/maps/embed/v1/place?q=26.16673088,127.8297348&zoom=16">'
        '<a class="p-detail-tag__link" href="/spot/list?category=20">海岸・岬・湾</a>'
    )
    assert okinawastory.parse_detail(detail) == (
        "知念岬公園",
        26.16673088,
        127.8297348,
        ["海岸・岬・湾"],
    )
    listing = '<a class="os-c-list-cmn__title-link" href="/spot/1321">古宇利大橋</a>'
    assert okinawastory._ITEM.findall(listing) == [("1321", "古宇利大橋")]
