import datetime as dt

from pipeline.flight_schedules import (
    Coverage,
    Flight,
    RmqTable,
    Schedule,
    dated_update,
    parse_rmq,
)

MONDAY = dt.date(2026, 11, 23)
TUESDAY = MONDAY + dt.timedelta(days=1)
WEDNESDAY = TUESDAY + dt.timedelta(days=1)


def test_refresh_replaces_only_dates_that_the_airport_returned():
    existing = Flight(
        destination="UKB",
        number="JX306",
        airline="星宇航空",
        departure="09:00",
        dates=[MONDAY, TUESDAY],
    )
    old = Schedule(
        origin="RMQ",
        updated_at=MONDAY,
        coverage=[Coverage(start=MONDAY, end=TUESDAY)],
        flights=[existing],
    )
    revised = Flight(
        destination="UKB", number="JX306", airline="星宇航空", departure="08:45"
    )
    coverage, flights = dated_update(old, TUESDAY, [(revised, TUESDAY)], {TUESDAY, WEDNESDAY})
    assert coverage == [Coverage(start=MONDAY, end=WEDNESDAY)]
    assert {(f.departure, tuple(f.dates)) for f in flights} == {
        ("09:00", (MONDAY,)),
        ("08:45", (TUESDAY,)),
    }


def test_taichung_weekly_table_preserves_local_time_and_codeshare():
    days = "".join(
        f'<td class="datelineplane" data-th="11/{23 + index}">'
        f'{"<img>" if index == 1 else ""}</td>'
        for index in range(7)
    )
    html = f"""
    <input name="searchDate" value="2026-11-23">
    <select id="airPortCode"><option value="UKB">神戶機場</option></select>
    <table><tbody id="dataView"><tr>
      <td class="itema text-nowrap"><div>星宇航空</div><div>共掛航空</div></td>
      <td class="itemb"><div><div>JX 306</div><div>JL 9900</div></div></td>
      <td class="itemc">神戶機場</td><td class="iteme">09:00</td>{days}
    </tr></tbody></table>
    """
    [(flight, day)] = parse_rmq(RmqTable(html), MONDAY, {"UKB"})
    assert day == TUESDAY
    assert flight.number == "JX306"
    assert flight.codeshares == ["JL9900"]
    assert flight.airline == "星宇航空"
    assert flight.departure == "09:00"
    assert flight.arrival is None
