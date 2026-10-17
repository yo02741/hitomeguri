import type { Festival, MapSpot, MunicipalityProps, PackItem, RailStation, SeasonData, Specialty, Spot } from '../../services/bundles'
import type { RailGraphBundle } from '../../services/daytrip'

/**
 * 世界生成（規格 §8、§11）的資料介面：PrefData（一縣的資料，world 定義、systems 只讀）、鎮、鎮之間的交通、
 * 地圖上實體的 data（world 產生、systems 處理互動）。
 */

// ---------- 一縣的資料 ----------
/** 景點：地圖 bundle 的 MapSpot＋detail 的名字、簡介（前 160 字）、最近的車站、出處 */
export interface PrefSpot extends MapSpot {
  name?: Spot['name']
  summary?: Spot['summary']
  nearest?: NonNullable<Spot['nearest_stations']>
  /** 資料的出處（detail 的 sources 第一筆）：簡介沒有時告示牌用這個 */
  src?: string
}

export interface PrefMunicipality extends MunicipalityProps {
  /** [西, 南, 東, 北]（經緯度） */
  bbox: [number, number, number, number]
  /** 相鄰的市区町村（區界有共用的點）：判斷「本島」與離島 */
  touches?: string[]
}

export type PrefLine = { n: string; e?: string; k: string; o?: string; s?: 1 }

/**
 * 祭典、老舖：m＝位置落在哪一個市区町村（區界的 point-in-polygon，data.ts 與 build-fixtures.mjs 算）。
 * null＝不在這一縣的任何區界裡；沒有這個欄位（舊的資料）時用外框判斷。
 */
export type PrefFestival = Festival & { m?: string | null }
export type PrefShop = PackItem & { m?: string | null }

export interface PrefRaw {
  pref: string
  spots: PrefSpot[]
  municipalities: PrefMunicipality[]
  lines: PrefLine[]
  stations: RailStation[]
  festivals: PrefFestival[]
  specialties: Specialty[]
  shinise: PrefShop[]
  castles: PackItem[]
  seasons: SeasonData
  railGraph: RailGraphBundle & { attribution?: string }
  /** 京都才有：関西国際空港（大阪的景點，鐵路與飛機的轉乘） */
  kix?: MapSpot
}

/** PrefRaw＋查詢 */
export interface PrefData extends PrefRaw {
  spotById(id: string): PrefSpot | undefined
  specialtyById(id: string): Specialty | undefined
  shiniseById(id: string): PrefShop | undefined
  castleById(id: string): PackItem | undefined
  festivalById(id: string): PrefFestival | undefined
  municipality(code: string): PrefMunicipality | undefined
  station(id: string): RailStation | undefined
}

// ---------- 鎮與交通 ----------
export type Kit = 'kinki' | 'okinawa' | 'kanto' | 'hokkaido'
export type TravelMode = 'rail' | 'monorail' | 'bus' | 'plane' | 'ferry'
export type KmKind = 'rail' | 'straight'

export interface PlaceName {
  ja: string
  kana?: string
  romaji?: string
  zh?: string
}

/** 進出一鎮的地方：車站、單軌的站、巴士站、機場、碼頭 */
export interface TownStop {
  /** 'main'、'airport'、'bus'、或 'st:<車站節點 id>' */
  id: string
  kind: 'rail' | 'monorail' | 'bus' | 'airport' | 'pier'
  name: string
  lat: number
  lng: number
  /** 路網節點（鐵路、單軌） */
  stationId?: string
  /** 景點 id（機場） */
  spotId?: string
}

export interface Town {
  /** 市区町村碼 */
  id: string
  pref: string
  name: PlaceName
  /** 代表的車站（沒有鐵路的鎮是巴士站或機場） */
  station: { id: string; name: string; kind: TownStop['kind'] }
  center: { lat: number; lng: number }
  mapId: string
  kit: Kit
  /** 景點分數的總和（選鎮用） */
  score: number
  /** 離島（坐飛機到） */
  island: boolean
  /** 街上（2 格寬的直角街道）或郊外（彎路） */
  urban: boolean
  bbox: [number, number, number, number]
  stops: TownStop[]
  /** 放進地圖的地標（景點 id，分數高的在前） */
  spots: string[]
}

/** 一段：坐什麼、多遠（鐵路的 km 或直線 km） */
export interface Leg {
  mode: TravelMode
  km: number
  kmKind: KmKind
  /** 這一段的終點的名字（站名、機場名） */
  to: string
  /** 鐵路這一段有搭新幹線（rail-graph 的路徑上新幹線 ≥ 20 km）：車窗畫新幹線 */
  shinkansen?: boolean
}

/**
 * 兩個地方之間的交通（單向）。from/to 是鎮 id，fromStop/toStop 是那一鎮的 TownStop.id。
 * 京都駅 → 那覇空港：兩段（鐵路到関西国際空港、飛機到那覇空港）。
 */
export interface Link {
  id: string
  from: string
  fromStop: string
  to: string
  toStop: string
  /** 出發的地方用什麼（剪票口是 rail、巴士站是 bus、機場櫃台是 plane） */
  mode: TravelMode
  legs: Leg[]
  /** 目的地的名字（最後一段的終點） */
  name: string
  /** 遊戲時間往前走幾分鐘（遊戲規則：依距離） */
  minutes: number
}

export interface World {
  towns: Town[]
  links: Link[]
  startTown: string
  /** 世界索引的 7 縣的鎮（還沒讀的縣也在：手帳的地圖、委託、聽來的用名字）；沒有世界索引時沒有 */
  atlas?: AtlasPref[]
  /** 台灣出發的直飛航線（P4，世界索引的 taiwan）；沒有就是還沒有航線資料（新遊戲照舊從京都駅開始） */
  abroad?: AbroadIndex
}

// ---------- 台灣出發（P4，世界索引的 taiwan：pipeline/game_taiwan.py） ----------
/** 一家航空公司這條航線的每週班次（国土交通省的表） */
export interface AbroadAirline {
  code?: string
  /** 国土交通省的表上的名字（日文：チャイナ エアライン） */
  name: string
  /** 那家公司繁體中文網站上的名字（中華航空；data/flights/airline_names.json）；沒有就照表的名字 */
  zh?: string
  weekly: number
}

/** 台灣的一個城市（台北、台中、高雄；台北不分桃園、松山）→ 日本的一個機場 */
export interface AbroadRoute {
  city: string
  /** 機場景點的 id */
  airport: string
  weekly: number
  airlines: AbroadAirline[]
}

/** 機場到遊戲的一鎮：坐什麼、多遠（legs 空的＝就是那一鎮的機場） */
export interface AbroadAccess {
  town: string
  legs: Leg[]
  km: number
}

/**
 * 降落的地方：那一鎮的機場大廳（{town, stop}：那覇空港、新千歳空港）、遊戲另外做的這個機場的大廳（own：関西国際空港、
 * 東京国際空港、函館空港）、沒有大廳（null：成田国際空港、中部国際空港…，飛到之後直接坐電車）。
 */
export type AbroadHall = 'own' | { town: string; stop: string } | null

export interface AbroadAirport {
  id: string
  iata: string
  /** 景點的名字（関西国際空港） */
  name: string
  /** 表上的名字（関西） */
  short: string
  /** 所在的縣（slug） */
  pref: string
  hall: AbroadHall
  /** 接得到的鎮（近的在前；接不到任何鎮的機場在看板上是灰的） */
  access: AbroadAccess[]
}

export interface AbroadIndex {
  /** 国土交通省的表（網址、取得日、表的標題） */
  source: { url: string; fetched_at?: string; season?: string }
  /** 台灣的城市（北到南） */
  cities: string[]
  airports: AbroadAirport[]
  /** 城市的順序、每週班次多的在前 */
  routes: AbroadRoute[]
}

// ---------- 世界索引（game/_world.json，pipeline/game_world.py） ----------
/**
 * 遊戲一開始只抓這一份（gzip 約 4 KB）＋起點的縣（京都）；別的縣坐車到那裡時才抓（world.ts 的 ensurePref）。
 * 鎮是 pipeline 照 TOWN_RULES 選好的（同一份 game bundle、同一個規則：towns.ts 的 selectTowns 有 pinned 時照這份建鎮）；
 * links 只有縣與縣之間的（縣內的交通讀到那一縣時才算：prefLinks）。km 是 pipeline 算的（鐵路＝rail-graph、飛機＝直線）。
 */
export const WORLD_INDEX_VERSION = 1

export interface WorldIndexStop {
  id: string
  kind: TownStop['kind']
  name: string
  stationId?: string
  spotId?: string
}

export interface WorldIndexTown {
  /** 市区町村碼 */
  id: string
  name: { ja: string; kana?: string }
  /** 代表的車站（鐵路、單軌：路網節點 id；巴士：bus:<碼>；離島的機場：景點 id） */
  station: { id: string; name: string; kind: TownStop['kind'] }
  center: { lat: number; lng: number }
  stops: WorldIndexStop[]
  /** 政令指定都市名 */
  city?: string
  island?: boolean
}

export interface WorldIndexPref {
  pref: string
  kit: Kit
  /** 從別的縣來的時候進這一縣的地方：main＝起點的鎮的車站、airport＝起點的鎮的機場 */
  startStop: 'main' | 'airport'
  /** 起點在第一個 */
  towns: WorldIndexTown[]
}

/** 縣與縣之間的一條（單向）：Link 少了 minutes（遊戲規則，前端照 legs 算），多了兩端的縣 */
export interface WorldIndexLink extends Omit<Link, 'minutes'> {
  fromPref: string
  toPref: string
}

export interface WorldIndex {
  v: number
  /** 新遊戲的縣 */
  start: string
  attribution?: { rail?: string; straight?: string }
  prefs: WorldIndexPref[]
  links: WorldIndexLink[]
  /** 台灣出發的直飛航線（P4；舊的索引沒有） */
  taiwan?: AbroadIndex
}

/** 手帳、委託用的鎮（systems 的 TownLike）：還沒讀的縣也有名字、代表站、中心 */
export interface AtlasTown {
  id: string
  pref: string
  name: PlaceName
  station: { id: string; name: string }
  center: { lat: number; lng: number }
  kit: Kit
}

export interface AtlasPref {
  pref: string
  kit: Kit
  towns: AtlasTown[]
}

// ---------- 地圖上的實體（規格 §11） ----------
export interface SignData {
  spotId?: string
  festivalId?: string
  shiniseId?: string
  title: PlaceName
  summary?: { text: string; lang: string; source_url: string; license: string; text_zh?: string }
  source_url: string
  /** 老舖的創業年（資料有才有） */
  founded?: string
}

export interface PhotoSpotData {
  spotId: string
  name: PlaceName
  /** 地標佔的格子（評分用） */
  target: { x: number; y: number; w: number; h: number }
}

export type NpcRole = 'fact' | 'passer' | 'clerk' | 'quest' | 'festival' | 'inn'

export interface FactRef {
  /** content/facts.ts 的樣板 key：festival.month、shinise.founded、castle.stamp、sakura.normal、rail.km、straight.km */
  template: string
  ref: { kind: 'festival' | 'shinise' | 'castle' | 'season' | 'town' | 'spot'; id: string }
  params: Record<string, string | number>
  source: { label: string; url: string }
}

export interface NpcData {
  role: NpcRole
  /** 手畫的路人 id（folk-a…d、clerk）：引擎現在就畫得出來 */
  look: string
  /** 旅人生成器的種子（npcLook(seed)，P1） */
  lookSeed: number
  fact?: FactRef
  tags?: { region: string; kit: Kit; town: string; season?: string; time?: string }
  /** 引擎的 NPC 移動（stand、look、wander） */
  move?: 'stand' | 'look' | 'wander'
  range?: number
  /** 閒聊用哪一種台詞（P4 的機場大廳：airport）；不寫是路人 */
  chat?: 'airport'
}

export type ItemRef = { kind: 'specialty' | 'shinise' | 'game'; id: string }

export interface ShopData {
  shopKind: 'station' | 'shinise' | 'shokudo' | 'teahouse'
  name: string
  shiniseId?: string
  items: ItemRef[]
  /** 賣哪一縣的東西（不寫就是這一鎮的縣；P4 的機場大廳不在鎮上，寫機場所在的縣） */
  pref?: string
  /** 站在櫃台後面的人（有就 spawn 一個店員） */
  look?: string
  lookSeed?: number
}

export interface StampData {
  stampId: string
  stampKind: 'station' | 'sanpai' | 'castle'
  pref: string
  name: string
  spotId?: string
  castleId?: string
  stationId?: string
  /** 印面上可以寫的字（只寫資料裡有的：站名羅馬字、日本100名城 No.53） */
  face?: string
}

export interface TravelDest {
  town: string
  name: string
  km: number
  kmKind: KmKind
  via?: { name: string; km: number; kmKind: KmKind; mode: TravelMode }
  /** 坐什麼（跟出發的地方不一樣時才寫，例：京都駅的剪票口到那覇空港是 plane） */
  mode?: TravelMode
  /** Link.id：systems 呼叫 world.travel(game, link) */
  link: string
}

export interface TravelData {
  mode: TravelMode
  fromTown: string
  dests: TravelDest[]
  look?: string
  lookSeed?: number
  /**
   * 機場的大廳（P4）：目的地照航線資料，打開時才算（systems 的 abroad.ts）。
   * board＝台灣的出發大廳（報到櫃台、出發看板、登機門）；intl＝日本的機場的國際線櫃台（回台灣）；gate＝日本的機場的剪票口、巴士站
   */
  abroad?: { kind: 'board' | 'intl' | 'gate'; place: string }
}

export interface InnData {
  innKind: 'ryokan' | 'minshuku'
  name: string
  look?: string
  lookSeed?: number
}

/** 你的房間的格位（擺設由 systems 處理） */
export interface SlotData {
  index: number
  col?: number
  row?: number
}
