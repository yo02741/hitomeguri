"""期間限定：氣象廳本季觀測頁的解析與顯示期間（網頁片段取自實際頁面的格式）。"""

from pipeline import timed
from pipeline.build_bundles import build_timed
from pipeline.sources import jma

SAKURA_KAIKA = """<html><head><title>気象庁 | 2026年のさくらの開花 </title></head><body>
<tr class='mtx'><th colspan='7' align='left' scope='col'>【近畿地方】
</th></tr>
<tr class='mtx'>
<th scope='row'>京都     </th>
<td align='right'> 3月25日</td>
<td align='right'>-1</td>
<td align='right'> 3月26日</td>
<td align='right'>+2</td>
<td align='right'> 3月23日</td>
<td></td>
</tr>
<tr class='mtx'>
<th scope='row'>南大東島 </th>
<td align='right'></td>
<td align='right'></td>
<td align='right'> 2月 5日</td>
<td align='right'></td>
<td align='right'>欠測</td>
<td>ひかんざくら</td>
</tr>
<tr class='mtx'>
<th scope='row'>奈良     </th>
<td align='right'> 3月28日</td>
<td align='right'>0</td>
<td align='right'> 3月28日</td>
<td align='right'>0</td>
<td align='right'> 3月28日</td>
<td></td>
</tr>
</body></html>"""

SAKURA_MANKAI = """<html><head><title>気象庁 | 2026年のさくらの満開 </title></head><body>
<tr class='mtx'>
<th scope='row'>京都     </th>
<td align='right'> 4月 2日</td>
<td align='right'>+1</td>
<td align='right'> 4月 1日</td>
<td align='right'>0</td>
<td align='right'> 4月 2日</td>
<td></td>
</tr>
</body></html>"""

KAEDE = """<h1>かえでの紅葉日  (2025年-2026年)</h1>
<TABLE class=data><TBODY>
<TR class=mtx><th rowspan=2 scope="col">地点名</th><th colspan=3 scope="col">2025年</th>
<th colspan=3 scope="col">2026年</th><th rowspan=2 scope="col">代替種目による観測</th></tr>
<TR class=mtx><th scope="col">観測日</th><th scope="col">平年差</th><th scope="col">昨年差</th>
<th scope="col">観測日</th><th scope="col">平年差</th><th scope="col">昨年差</th></tr>
<TR class=mtx>
<td>
    札幌
</td>
<td align="center" valign="middle">
 11月 6日
</td>
<td align="center" valign="middle">
   +9
</td>
<td align="center" valign="middle">
   -5
</td>
<td align="center" valign="middle">
 10月30日
</td>
<td align="center" valign="middle">
   +2
</td>
<td align="center" valign="middle">
   -7
</td>
<td>やまもみじ</td>
</tr>
<TR class=mtx>
<td>
    京都
</td>
<td align="center" valign="middle">
 12月 1日
</td>
<td align="center" valign="middle">
   +3
</td>
<td align="center" valign="middle">
   -2
</td>
<td align="center" valign="middle">
   -
</td>
<td align="center" valign="middle">
  ///
</td>
<td align="center" valign="middle">
  ///
</td>
<td>　</td>
</tr>
</TBODY></TABLE>"""

NOW = "2026-10-31T00:00:00+00:00"


def test_parse_sakura() -> None:
    year, obs = jma.parse_sakura(SAKURA_KAIKA)
    assert year == 2026
    assert [(o.station, o.date, o.diff_normal) for o in obs] == [
        ("京都", "2026-03-25", -1),
        ("奈良", "2026-03-28", 0),
    ]


def test_parse_autumn_takes_latest_year() -> None:
    year, obs = jma.parse_autumn(KAEDE)
    assert year == 2026
    # 京都今年還沒觀測（「-」），只有札幌
    assert [(o.station, o.date, o.diff_normal) for o in obs] == [("札幌", "2026-10-30", 2)]


def test_sakura_items_window() -> None:
    items = {i.id: i for i in timed.sakura_items(SAKURA_KAIKA, SAKURA_MANKAI, NOW)}
    kyoto = items["jma-sakura-2026-京都"]
    assert kyoto.prefectures == ["kyoto"]
    # 滿開 4/2 + 7 天
    assert (kyoto.valid_from, kyoto.valid_to) == ("2026-03-25", "2026-04-09")
    assert kyoto.title.ja == "京都　さくら満開"
    assert "比平年早 1 天" in (kyoto.summary_zh or "")
    # 還沒滿開：開花 + 7 + 7
    nara = items["jma-sakura-2026-奈良"]
    assert nara.valid_to == "2026-04-11"
    assert "與平年同日" in (nara.summary_zh or "")


def test_autumn_items() -> None:
    items = timed.autumn_items(timed.AUTUMN[1], KAEDE, NOW)
    assert len(items) == 1
    it = items[0]
    assert it.id == "jma-kaede-2026-札幌"
    assert it.prefectures == ["hokkaido"]
    assert (it.valid_from, it.valid_to) == ("2026-10-30", "2026-11-13")
    assert it.source_label and "気象庁" in it.source_label


def test_build_timed_drops_expired(tmp_path) -> None:  # type: ignore[no-untyped-def]
    items = timed.autumn_items(timed.AUTUMN[1], KAEDE, NOW)
    (tmp_path / "2026-10.json").write_text(
        "[" + ",".join(i.model_dump_json(exclude_none=True) for i in items) + "]", encoding="utf-8"
    )
    assert len(build_timed(tmp_path, today="2026-11-13")) == 1
    assert build_timed(tmp_path, today="2026-11-14") == []
