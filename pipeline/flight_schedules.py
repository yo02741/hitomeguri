"""台灣機場公開的日本直飛班表，供網站查詢。"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import time
from collections import defaultdict
from collections.abc import Iterator
from html.parser import HTMLParser
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

import httpx
from pydantic import Field, model_validator

from pipeline.models import StrictModel
from pipeline.paths import AIRPORTS_JSON, DATA, REGIONS_JSON

Origin = Literal["TPE", "TSA", "RMQ", "KHH"]
SCHEDULES = DATA / "flights" / "schedules"
SOURCES = {
    "TPE": "https://www.taoyuan-airport.com/flight_timetable",
    "TSA": "https://www.tsa.gov.tw/flights/international/regular",
    "RMQ": "https://www.tca.gov.tw/?act=fids&code=regular_flight",
    "KHH": "https://www.kia.gov.tw/FLIPLAN.html",
}
ORIGINS = {"TPE": "桃園", "TSA": "台北松山", "RMQ": "台中", "KHH": "高雄"}
# 機場底冊是依國交省的定期班資料建立；補上台灣機場班表另列的航點。
EXTRA_PREFS = {
    "AKJ": "hokkaido",
    "AXT": "akita",
    "FKS": "fukushima",
    "KCZ": "kochi",
    "UKB": "hyogo",
}
DEST_NAMES = {
    "AKJ": "旭川",
    "AOJ": "青森",
    "AXT": "秋田",
    "CTS": "札幌新千歲",
    "FKS": "福島",
    "FUK": "福岡",
    "HIJ": "廣島",
    "HKD": "函館",
    "HNA": "花卷",
    "HND": "東京羽田",
    "HSG": "佐賀",
    "ISG": "石垣",
    "KCZ": "高知",
    "KIJ": "新潟",
    "KIX": "大阪關西",
    "KKJ": "北九州",
    "KMI": "宮崎",
    "KMJ": "熊本",
    "KMQ": "小松",
    "KOJ": "鹿兒島",
    "MYJ": "松山",
    "NGO": "名古屋中部",
    "NRT": "東京成田",
    "OIT": "大分",
    "OKA": "沖繩那霸",
    "OKJ": "岡山",
    "SDJ": "仙台",
    "SHI": "宮古下地島",
    "TAK": "高松",
    "TOY": "富山",
    "UKB": "神戶",
    "YGJ": "米子",
}
RMQ_NAMES = {
    "下地島": "SHI",
    "名古屋": "NGO",
    "成田": "NRT",
    "新千歲": "CTS",
    "沖繩": "OKA",
    "熊本": "KMJ",
    "神戶": "UKB",
    "高松": "TAK",
}
DAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


class Coverage(StrictModel):
    start: dt.date
    end: dt.date

    @model_validator(mode="after")
    def validate_interval(self):
        if self.start > self.end:
            raise ValueError("班表起日必須早於或等於末日")
        return self


class Flight(StrictModel):
    destination: str = Field(pattern=r"^[A-Z]{3}$")
    number: str = Field(pattern=r"^[A-Z0-9]{2}[0-9][A-Z0-9]*$")
    airline: str = Field(min_length=1)
    departure: str = Field(pattern=r"^\d{2}:\d{2}$")
    arrival: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}([+-][1-9])?$")
    codeshares: list[str] = Field(default_factory=list)
    dates: list[dt.date] = Field(default_factory=list)
    weekdays: list[int] = Field(default_factory=list)


class Schedule(StrictModel):
    origin: Origin
    updated_at: dt.date
    coverage: list[Coverage] = Field(default_factory=list)
    flights: list[Flight] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_flights(self):
        seen = set()
        for flight in self.flights:
            if self.origin == "TSA":
                if flight.dates or not flight.weekdays or set(flight.weekdays) - set(range(1, 8)):
                    raise ValueError("松山班表需要星期")
                days = flight.weekdays
            else:
                if (
                    flight.weekdays
                    or not flight.dates
                    or any(
                        not any(span.start <= day <= span.end for span in self.coverage)
                        for day in flight.dates
                    )
                ):
                    raise ValueError("飛航日期必須在班表範圍內")
                days = flight.dates
            keys = {(flight.destination, flight.number, flight.departure, day) for day in days}
            if keys & seen or len(keys) != len(days):
                raise ValueError("重複班次")
            seen.update(keys)
        return self


def japan_airports() -> dict[str, dict[str, str]]:
    names = {
        airport["iata"]: (airport["prefecture"], airport["name_ja"])
        for airport in json.loads(AIRPORTS_JSON.read_text(encoding="utf-8"))["airports"]
    }
    names.update({code: (pref, DEST_NAMES[code]) for code, pref in EXTRA_PREFS.items()})
    regions = {
        region["prefecture"]: region["area"]
        for region in json.loads(REGIONS_JSON.read_text(encoding="utf-8"))["regions"]
    }
    return {
        code: {"name": DEST_NAMES.get(code, name), "area": regions[pref]}
        for code, (pref, name) in names.items()
    }


def days_between(start: dt.date, end: dt.date) -> Iterator[dt.date]:
    for offset in range((end - start).days + 1):
        yield start + dt.timedelta(days=offset)


def coverage_of(days: set[dt.date]) -> list[Coverage]:
    spans: list[Coverage] = []
    for day in sorted(days):
        if spans and day == spans[-1].end + dt.timedelta(days=1):
            spans[-1].end = day
        else:
            spans.append(Coverage(start=day, end=day))
    return spans


def local_time(value: str) -> str:
    return re.sub(r"^(\d{2})(\d{2})", r"\1:\2", value.strip())


def as_date(value: str) -> dt.date:
    return dt.date.fromisoformat(value.replace("/", "-"))


def dated_flights(rows: list[tuple[Flight, dt.date]]) -> list[Flight]:
    # 以同日同航班去重。若來源重複列出班號，合併共掛資料。
    occurrences: dict[tuple[str, str, str, dt.date], Flight] = {}
    for flight, day in rows:
        key = flight.destination, flight.number, flight.departure, day
        existing = occurrences.get(key)
        if existing is None:
            occurrences[key] = flight.model_copy()
        elif (flight.departure, flight.arrival) == (existing.departure, existing.arrival):
            existing.codeshares = sorted(set(existing.codeshares) | set(flight.codeshares))
        else:
            raise ValueError(f"同一班號時刻不一致：{key}")
    grouped: dict[str, Flight] = {}
    for (_, _, _, day), flight in sorted(occurrences.items()):
        key = flight.model_dump_json()
        grouped.setdefault(key, flight.model_copy(update={"dates": []})).dates.append(day)
    return sorted(grouped.values(), key=lambda f: (f.destination, f.departure, f.number, f.dates))


def parse_tpe(rows, start, end, japan):
    for row in rows:
        dest = row["CityCode"]
        if dest not in japan or row["PlaneType"] != "PD":
            continue
        bits = row["WeekDay"]
        if len(bits) != 7 or any(bit not in ("0", str(i)) for i, bit in enumerate(bits, 1)):
            raise ValueError("桃園飛航日格式變更")
        flight = Flight(
            destination=dest,
            number=row["ACode"] + row["FlightNo"],
            airline=row["AName"],
            departure=local_time(row["OTime"]),
            arrival=local_time(row["RTime"]),
            codeshares=sorted({s["ACode"] + s["FlightNo"] for s in row.get("isSharing", [])}),
        )
        active_start, active_end = as_date(row["StartDate"]), as_date(row["EndDate"])
        for day in days_between(max(start, active_start), min(end, active_end)):
            if bits[day.weekday()] != "0":
                yield flight, day


def parse_tsa(rows, japan):
    by_time = defaultdict(list)
    for row in rows:
        dest = row["GoalAirportName"][-3:]
        if dest in japan:
            days = tuple(i for i, day in enumerate(DAYS, 1) if row[day] == "Y")
            by_time[dest, row["ExpectDepartureTime"], row["ExpectArrivalTime"], days].append(row)
    for (dest, departure, arrival, days), group in sorted(by_time.items()):
        operating = [row for row in group if row["AirPlaneType"]]
        if len(operating) != 1:
            raise ValueError(f"松山班表無法辨認執飛班號：{dest} {departure}")
        row = operating[0]
        yield Flight(
            destination=dest,
            number=row["FlightNumber"],
            airline=row["AirLineName"].strip(),
            departure=local_time(departure),
            arrival=local_time(arrival),
            weekdays=list(days),
            codeshares=sorted({r["FlightNumber"] for r in group if r is not row}),
        )


def parse_khh(rows, names, japan):
    for row in rows:
        code = row["airLineCode"]
        dest = row["goalAirportCode"]
        if (
            row["upAirportCode"] != "KHH"
            or dest not in japan
            or not re.fullmatch(r"[A-Z0-9]{2}", code)
        ):
            continue
        start, end = as_date(row["weekstart"]), as_date(row["weekend"])
        flight = Flight(
            destination=dest,
            number=row["airLineNum"],
            airline=names[code],
            departure=local_time(row["expectDepartureTime"]),
            arrival=local_time(row["expectArrivalTime"]),
            codeshares=sorted(set(re.findall(r"[A-Z0-9]{2}\d+[A-Z]?", row["CodeShareInfo"] or ""))),
        )
        active_start, active_end = (
            as_date(row["ScheduleStartDate"]),
            as_date(row["ScheduleEndDate"]),
        )
        for day in days_between(max(start, active_start), min(end, active_end)):
            if row[DAYS[day.weekday()]] == "Y":
                yield flight, day


class RmqTable(HTMLParser):
    """讀公開班表的目的地選單、出發週表及共掛班號。"""

    def __init__(self, document: str):
        super().__init__()
        self.destinations = dict(RMQ_NAMES)
        self.rows = []
        self.in_select = False
        self.in_table = False
        self.option: str | None = None
        self.cell: dict | None = None
        self.row: list[dict] | None = None
        self.input_date = None
        self.feed(document)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "input" and attrs.get("name") == "searchDate":
            self.input_date = attrs.get("value")
        elif tag == "select":
            self.in_select = attrs.get("id") == "airPortCode"
        elif tag == "option" and self.in_select:
            self.option = attrs.get("value")
        elif tag == "tbody":
            self.in_table = attrs.get("id") == "dataView"
        elif self.in_table and tag == "tr":
            self.row = []
        elif self.row is not None and tag == "td":
            self.cell = {
                "class": attrs.get("class", "").split(),
                "day": attrs.get("data-th"),
                "text": "",
                "flies": False,
            }
        elif self.cell is not None and tag == "img":
            self.cell["flies"] = True

    def handle_data(self, data):
        if self.option and data.strip():
            self.destinations[data.strip()] = self.option
        if self.cell is not None:
            self.cell["text"] += data

    def handle_endtag(self, tag):
        if tag == "option":
            self.option = None
        elif tag == "select":
            self.in_select = False
        elif tag == "div" and self.cell is not None:
            self.cell["text"] += "\n"
        elif tag == "td" and self.cell is not None and self.row is not None:
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        elif tag == "tbody":
            self.in_table = False


def parse_rmq(table, start, japan):
    if table.input_date != start.isoformat():
        raise ValueError("台中班表未回傳要求的日期")
    for row in table.rows:
        columns = {c["class"][0]: c["text"].strip() for c in row if c["class"]}
        dest = table.destinations.get(columns.get("itemc", ""))
        if dest not in japan:
            continue
        numbers = re.findall(r"([A-Z0-9]{2})\s+(\d+[A-Z]?)", columns["itemb"])
        flight = Flight(
            destination=dest,
            number="".join(numbers[0]),
            airline=columns["itema"].splitlines()[0],
            departure=local_time(columns["iteme"]),
            codeshares=["".join(n) for n in numbers[1:]],
        )
        calendar = [c for c in row if "datelineplane" in c["class"]]
        if len(calendar) != 7:
            raise ValueError("台中班表缺少飛航日")
        for i, cell in enumerate(calendar):
            day = start + dt.timedelta(days=i)
            if tuple(map(int, cell["day"].split("/"))) != (day.month, day.day):
                raise ValueError("台中班表飛航日與查詢區間不符")
            if cell["flies"]:
                yield flight, day


def dated_update(old, updated_at, rows, complete_days):
    # 保留未被新班表覆蓋的資料；只在來源成功回傳該週時以該週替換。
    first = updated_at - dt.timedelta(days=365)
    kept = (
        [
            (f.model_copy(update={"dates": []}), day)
            for f in old.flights
            for day in f.dates
            if first <= day and day not in complete_days
        ]
        if old
        else []
    )
    published = {
        day
        for span in (old.coverage if old else [])
        for day in days_between(max(first, span.start), span.end)
    } | complete_days
    return coverage_of(published), dated_flights(kept + rows)


def refresh(client: httpx.Client, origin: Origin, today: dt.date, old: Schedule | None) -> Schedule:
    japan = japan_airports()
    if origin == "TSA":
        response = (
            client.post(
                "https://www.tsa.gov.tw/api/airWeekMonth/Paging",
                data={
                    "Status": "departures",
                    "Category": 0,
                    "AirFlyLine": 1,
                    "AirFlyIO": 1,
                    "Limit": 999,
                    "Culture": 1,
                    "Sort": "ExpectDepartureTime",
                    "Order": "asc",
                },
            )
            .raise_for_status()
            .json()
        )
        if response["total"] != len(response["rows"]):
            raise ValueError("松山班表未完整回傳")
        return Schedule(
            origin=origin, updated_at=today, flights=list(parse_tsa(response["rows"], japan))
        )

    rows, covered = [], set()
    if origin == "KHH":
        base = "https://www.kia.gov.tw/data/"
        raw = client.get(base + "flightplan.json").raise_for_status().json()
        airlines = client.get(base + "airline2.json").raise_for_status().json()
        names = {
            a["AirlineIATA"]: a["AirlineChineseAlias"]
            for entry in airlines
            if entry.get("name") == "airline"
            for a in entry["data"]
        }
        rows = list(parse_khh(raw, names, japan))
        weeks = {
            (as_date(r["weekstart"]), as_date(r["weekend"]))
            for r in raw
            if r["upAirportCode"] == origin
        }
        for start, end in weeks:
            if any(start <= day <= end for _, day in rows):
                covered.update(days_between(start, end))
    else:
        monday = today - dt.timedelta(days=today.weekday())
        # 桃園公開較長的期間，台中的班表逐週公布。
        for offset in range(20 if origin == "TPE" else 8):
            if offset:
                time.sleep(1)
            start = monday + dt.timedelta(weeks=offset)
            end = start + dt.timedelta(days=6)
            try:
                if origin == "TPE":
                    url = "https://www.taoyuan-airport.com/api/api/flight/fids"
                    raw = (
                        client.post(
                            url,
                            json={
                                "StartDate": str(start),
                                "EndDate": str(end),
                                "language": "ch",
                                "PlaneType": "PD",
                            },
                        )
                        .raise_for_status()
                        .json()
                    )
                    week = list(parse_tpe(raw, start, end, japan))
                else:
                    page = (
                        client.get(
                            "https://www.tca.gov.tw/",
                            params={
                                "act": "fids",
                                "code": "regular_flight",
                                "searchDate": str(start),
                            },
                        )
                        .raise_for_status()
                        .text
                    )
                    week = list(parse_rmq(RmqTable(page), start, japan))
            except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as exc:
                print(f"{origin} {start}：{exc}，保留該週已有的班表。")
                continue
            if week:
                covered.update(days_between(start, end))
                rows.extend(week)
    if not covered:
        raise ValueError("未取得任何一週的日本直飛班表")
    coverage, flights = dated_update(old, today, rows, covered)
    return Schedule(origin=origin, updated_at=today, coverage=coverage, flights=flights)


def save_schedule(schedule: Schedule, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(
        schedule.model_dump_json(indent=2, exclude_defaults=True) + "\n", encoding="utf-8"
    )
    tmp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", choices=ORIGINS, action="append")
    args = parser.parse_args()
    origins = args.origin or ORIGINS
    today = dt.datetime.now(ZoneInfo("Asia/Taipei")).date()
    success = 0
    with httpx.Client(
        timeout=10, follow_redirects=True, headers={"User-Agent": "Hitomeguri/1.0"}
    ) as client:
        for origin in origins:
            path = SCHEDULES / f"{origin}.json"
            old = Schedule.model_validate_json(path.read_bytes()) if path.exists() else None
            try:
                schedule = refresh(client, origin, today, old)
            except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError) as exc:
                print(f"{origin}：{exc}，保留現有班表。")
                continue
            success += 1
            if old and schedule.coverage == old.coverage and schedule.flights == old.flights:
                print(f"{origin}：班表無變更。")
                continue
            save_schedule(schedule, path)
            print(f"{origin}：更新 {len(schedule.flights)} 組班號／時刻。")
    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
