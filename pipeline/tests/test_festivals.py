from pipeline.festivals import is_festival, months_from_labels, months_from_text


def test_is_festival_by_p31_and_name():
    assert is_festival("祇園祭", ["祭礼"])
    assert is_festival("神戸ルミナリエ", ["光の祭り"])
    assert is_festival("さっぽろ雪まつり", ["winter festival"])
    assert not is_festival("長刀鉾", ["山鉾"])
    assert not is_festival("八坂神社", ["神社"])
    assert not is_festival("日本の祭り一覧", ["一覧記事"])
    assert not is_festival("京都三大祭り", ["祭り"])
    assert not is_festival("福岡五大祭", [])
    assert is_festival("大祭", [])
    # P31 沒有時看名稱
    assert is_festival("唐津くんち", [])
    assert not is_festival("某保存会", [])


def test_months_from_wikidata_labels():
    assert months_from_labels(["8月3日", "8月6日"]) == [8]
    assert months_from_labels(["7月", "１０月"]) == [7, 10]
    assert months_from_labels(["夏"]) == []


def test_months_from_text():
    assert months_from_text("青森ねぶた祭は、毎年8月2日から7日に行われる夏祭り。") == [8]
    assert months_from_text("例年7月下旬に開催される。") == [7]
    assert months_from_text("毎年5月15日に行われる。1884年に始まった。") == [5]
    assert months_from_text("10月9日から11日にかけて行われる秋祭り。") == [10]
    assert months_from_text("弘前公園で4月下旬から5月上旬まで開かれる桜の祭り。") == [4]
    # 舊曆與創始年份不算
    assert months_from_text("毎年旧暦7月15日に行われる。") == []
    assert months_from_text("毎年旧暦12月に行われる。") == []
    assert months_from_text("1603年に始まった祭り。") == []


def test_location_falls_back_to_place():
    from pipeline.festivals import location_of
    from pipeline.sources.wikidata import Entity

    fest = Entity(qid="Q1", location_items=["Q2"])
    shrine = Entity(qid="Q2", lat=35.0, lng=135.7)
    loc = location_of(fest, {"Q2": shrine})
    assert loc is not None and (loc.lat, loc.lng) == (35.0, 135.7)
    assert location_of(Entity(qid="Q3"), {}) is None


def test_is_defunct():
    from pipeline.festivals import is_defunct

    assert is_defunct(
        "南部道楽フェスティバルは、毎年9月最終週の土曜日と日曜日に行われていた祭である。"
    )
    assert not is_defunct(
        "青森ねぶた祭は、毎年8月2日から7日に行われる夏祭り。\n2020年は中止された。"
    )
