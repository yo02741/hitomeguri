import json

from pipeline import diff_report, validate


def _write(path, data, indent=2):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=indent) + "\n", encoding="utf-8")


def test_validate_flags_format_order_and_sources(tmp_path):
    ok = {"id": "castle-001", "prefecture": "hokkaido", "location": {"lat": 43.3, "lng": 145.6},
          "sources": [{"url": "https://ja.wikipedia.org/wiki/x", "fetched_at": "2026-09-30"}]}  # fmt: skip
    bad = {
        "id": "castle-000",
        "prefecture": "atlantis",
        "location": {"lat": 0, "lng": 0},
        "sources": [],
    }
    _write(tmp_path / "packs" / "castles.json", [ok, bad])
    _write(tmp_path / "packs" / "loose.json", [ok], indent=1)
    res = validate.validate(tmp_path, bundles=False)
    text = "\n".join(res.errors)
    assert "沒有依 id 排序" in text
    assert "縣 'atlantis' 不存在" in text and "座標不在日本" in text and "缺來源" in text
    assert "loose.json：格式不是 indent=2" in text
    assert not res.ok and "沒有通過" in validate.report(res)


def test_validate_uses_models(tmp_path):
    _write(tmp_path / "spots" / "kyoto.json", [{"id": "wd-Q1", "name": {"ja": "x"}}])
    res = validate.validate(tmp_path, bundles=False)
    assert any("spots/kyoto.json #0" in e for e in res.errors)


def test_validate_rejects_old_theme_spots():
    """舊的主題小店（kind: theme）已刪除，再出現就擋下來。"""
    from pipeline.models import Spot

    base = {"id": "osm-node-1", "name": {"ja": "x", "zh_tw": "x"}, "location": {"lat": 35.0, "lng": 135.7},
            "prefecture": "kyoto", "updated_at": "2026-10-09"}  # fmt: skip
    Spot.model_validate(base | {"kind": "major"})
    try:
        Spot.model_validate(base | {"kind": "theme"})
    except ValueError as e:
        assert "kind" in str(e)
    else:
        raise AssertionError("kind: theme 應該不合 schema")


def test_compare_counts_and_fields():
    old = [
        {"id": "a", "name": {"ja": "甲", "kana": "こう"}, "updated_at": "1"},
        {"id": "b", "name": {"ja": "乙"}, "summary": {"text": "舊", "fetched_at": "1"}},
        {"id": "c", "name": {"ja": "丙"}},
    ]
    new = [
        {"id": "a", "name": {"ja": "甲", "kana": "かぶと"}, "updated_at": "2"},
        {"id": "b", "name": {"ja": "乙"}, "summary": {"text": "舊", "fetched_at": "2"}},
        {"id": "d", "name": {"ja": "丁"}},
    ]
    c = diff_report.compare(old, new)
    assert [r["id"] for r in c["added"]] == ["d"] and [r["id"] for r in c["removed"]] == ["c"]
    # 只有取得時間、更新時間變了不算修改
    assert c["changed"] == ["a"]
    assert c["fields"]["念法"] == ["甲：こう → かぶと"]
