"""資料模型（pydantic），對應 PLAN.md §4。

data/ 內的 JSON 讀寫一律經過這裡驗證；欄位名稱與 PLAN.md 完全一致。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Prefecture = str  # slug，例 "kyoto"
Theme = Literal["tea", "sake", "beer", "incense", "onsen", "ramen", "pokemon", "goshuin"]
Airport = Literal["TPE", "TSA", "RMQ", "KHH", "TNN"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LocalizedName(StrictModel):
    ja: str
    kana: str | None = None
    romaji: str | None = None
    zh_tw: str
    en: str | None = None


class Location(StrictModel):
    lat: float
    lng: float


class Source(StrictModel):
    url: str
    fetched_at: str


class Image(StrictModel):
    url: str
    author: str
    license: str
    source_url: str


class StationName(StrictModel):
    ja: str
    kana: str | None = None
    romaji: str | None = None
    en: str | None = None


class NearestStation(StrictModel):
    name: StationName
    distance_m: int


class ExternalIds(StrictModel):
    wikidata: str | None = None
    osm: str | None = None
    google_place_id: str | None = None


class Goshuin(StrictModel):
    available: bool
    limited: str | None = None
    note_zh: str | None = None


class Omamori(StrictModel):
    note_zh: str


class Verification(StrictModel):
    checked_at: str
    result: str
    notes: str | None = None


class Spot(StrictModel):
    """景點（data/spots/{prefecture}.json 陣列元素）。"""

    id: str
    name: LocalizedName
    # 假名的來源；"llm" 表示由 LLM 補、尚未人工確認（PLAN.md §11：reviewed: false）。
    kana_source: Literal["wikidata", "osm", "llm"] | None = None
    location: Location
    prefecture: Prefecture
    city: str | None = None
    kind: Literal["major", "theme"]
    themes: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    featured: bool = False
    score: float = 0
    summary_zh: str = ""  # 由 enrich 補；空字串表示尚未補全
    best_months: list[int] | None = None
    stay_minutes: int | None = None
    nearest_stations: list[NearestStation] | None = None
    images: list[Image] = Field(default_factory=list)
    external_ids: ExternalIds = Field(default_factory=ExternalIds)
    sources: list[Source] = Field(default_factory=list)
    goshuin: Goshuin | None = None
    omamori: list[Omamori] | None = None
    status: Literal["published", "closed"] = "published"
    verification: Verification | None = None
    updated_at: str


class Specialty(StrictModel):
    """地區特色（data/specialties/{prefecture}.json）。"""

    id: str
    name: LocalizedName
    prefecture: Prefecture
    area: str | None = None
    category: str
    season_months: list[int] | None = None
    summary_zh: str
    source_type: Literal["gi", "regional_trademark", "kyodo_ryori", "llm_research"]
    sources: list[Source] = Field(default_factory=list)
    related_spot_ids: list[str] | None = None
    updated_at: str


class TimedTitle(StrictModel):
    ja: str
    zh_tw: str


class TimedImage(StrictModel):
    url: str
    source_url: str


class TimedItem(StrictModel):
    """期間限定（data/timed/{yyyy-mm}.json）。"""

    id: str
    kind: Literal["product", "event", "seasonal"]
    category: str
    brand: str | None = None
    title: TimedTitle
    summary_zh: str
    scope: Literal["national", "regional", "spot"]
    prefectures: list[Prefecture] | None = None
    location: Location | None = None
    spot_id: str | None = None
    valid_from: str
    valid_to: str
    relevance: float = 0
    image: TimedImage | None = None
    source_url: str
    updated_at: str


class PhraseContext(StrictModel):
    theme: str | None = None
    spot_kind: str | None = None
    specialty_id: str | None = None
    situation: str


class AnswerHint(StrictModel):
    ja: str
    kana: str
    zh_tw: str


class Phrase(StrictModel):
    """旅前準備詞彙（data/phrases/...）。"""

    id: str
    context: PhraseContext
    direction: Literal["hear", "say", "read"]
    ja: str
    kana: str
    romaji: str
    zh_tw: str
    answer_hint: AnswerHint | None = None
    note_zh: str | None = None
    priority: Literal[1, 2, 3]
    reviewed: bool = False


class Airline(StrictModel):
    name_zh: str
    iata: str | None = None


class FlightRoute(StrictModel):
    """台灣直飛航線（data/flights/taiwan_direct.json）。"""

    origin: Airport
    dest: str
    airlines: list[Airline] = Field(default_factory=list)
    frequency_note_zh: str | None = None
    season: str | None = None
    verified: bool = False
    checked_at: str
    sources: list[Source] = Field(default_factory=list)


class RegionColor(StrictModel):
    source: str
    base: str
    on_base: str
    accent: str
    tint: str
    strong: str
    paper: str
    surface: str
    map: str
    header: str
    placeholder: str
    line_soft: str
    line: str
    ink: str
    ink_2: str
    sub: str


class RegionName(StrictModel):
    ja: str
    kana: str
    romaji: str
    zh_tw: str


class Region(StrictModel):
    prefecture: Prefecture
    name: RegionName
    area: str
    area_name: str
    motif_zh: str
    color: RegionColor


class NationalRegion(StrictModel):
    name: RegionName
    motif_zh: str
    color: RegionColor


class Regions(StrictModel):
    """data/regions.json 整檔。"""

    readme: str = Field(alias="_readme")
    national: NationalRegion
    regions: list[Region]
