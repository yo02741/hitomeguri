import type { Dir, MapEntity } from '../engine/types'

/**
 * 系統（拍照、買東西、印、房間、委託、台詞）讀的資料與實體的形狀（規格 §11）。
 * 世界生成（game/world）把 bundles 轉成 PrefData 交進來；這裡只寫系統真的會讀的欄位（都是唯讀），
 * world 的 PrefData 多出來的欄位、查詢函式不影響。測試直接用 fixtures/kyoto.json、okinawa.json。
 */

/** 日文名、假名、羅馬字、中文（有才寫） */
export interface NameLike {
  ja: string
  kana?: string
  romaji?: string
  zh_tw?: string
  en?: string
}

/** 維基百科、農林水產省…的簡介（第一段） */
export interface SummaryLike {
  text: string
  lang: string
  source_url: string
  license?: string
  /** 英文、日文簡介的中文翻譯（translate-summaries） */
  text_zh?: string
}

export interface SourceLike {
  url: string
  fetched_at?: string
}

/** 景點（map bundle 的 MapSpot＋detail 的名稱、簡介） */
export interface SpotLike {
  id: string
  /** 日文名 */
  n: string
  /** 中文名 */
  z?: string
  h?: string
  r?: string
  /** 類型（神社、寺院、城…） */
  c?: string
  /** 文化指定 */
  d?: string
  s: number
  m?: string
  st?: string
  lat: number
  lng: number
  name?: NameLike
  summary?: SummaryLike
}

export interface FestivalLike {
  id: string
  name: NameLike
  months?: readonly number[]
  months_source?: string
  location?: { lat: number; lng: number }
  /** 位置落在哪一個市区町村（world/data.ts 的 point-in-polygon；null＝不在縣裡的區界；沒有＝舊資料） */
  m?: string | null
  summary?: SummaryLike
  sources?: readonly SourceLike[]
}

export interface SpecialtyLike {
  id: string
  name: NameLike
  category: string
  summary?: SummaryLike
  source_type?: string
  sources?: readonly SourceLike[]
}

/** 擴充包的一個點（老舖・茶屋、名城）：services/bundles.ts 的 PackItem */
export interface PackLike {
  id: string
  g: string
  p: string
  n: string
  lat: number
  lng: number
  u: string
  h?: string
  z?: string
  no?: number
  st?: readonly string[]
  s?: string
  f?: string
  w?: string
  /** 位置落在哪一個市区町村（老舖；world/data.ts 算） */
  m?: string | null
}

export interface MunicipalityLike {
  m: string
  n: string
  h?: string
  c?: string
  l?: readonly number[]
  /** [西, 南, 東, 北]（經緯度） */
  bbox?: readonly number[]
}

export interface StationLike {
  id: string
  n: string
  e?: string
  lat: number
  lng: number
}

export interface SeasonStationLike {
  name: string
  normals: Readonly<Record<string, string>>
}

export interface PrefLike {
  pref: string
  spots: readonly SpotLike[]
  municipalities?: readonly MunicipalityLike[]
  stations?: readonly StationLike[]
  festivals?: readonly FestivalLike[]
  specialties?: readonly SpecialtyLike[]
  shinise?: readonly PackLike[]
  castles?: readonly PackLike[]
  seasons?: { source: { url: string }; stations: readonly SeasonStationLike[] }
  railGraph?: { attribution?: string }
}

export type Kit = 'kinki' | 'okinawa'

/** world 的鎮（規格 §11） */
export interface TownLike {
  /** 市区町村碼 */
  id: string
  pref: string
  name: { ja: string; kana?: string; romaji?: string; zh?: string }
  station?: { id: string; name: string }
  center?: { lat: number; lng: number }
  mapId?: string
  kit?: Kit
  /** 放進地圖的地標（景點 id）：委託、印帳用 */
  spots?: readonly string[]
}

export interface WorldLike {
  towns: readonly TownLike[]
  startTown?: string
}

// ---------- 實體的 data（world 產生，systems 處理） ----------
export interface SignData {
  spotId?: string
  festivalId?: string
  /** 老舖・茶屋的店面牌子 */
  shiniseId?: string
  title?: { ja: string; zh?: string; kana?: string; romaji?: string }
  summary?: SummaryLike
  source_url?: string
  /** 老舖的創業年（資料有才有） */
  founded?: string
}

export interface PhotoSpotData {
  spotId?: string
  name?: string | { ja: string; zh?: string }
  /** 地標佔的格子範圍（評分用） */
  target?: { x: number; y: number; w: number; h: number }
}

export type NpcRole = 'fact' | 'passer' | 'clerk' | 'quest' | 'festival' | 'inn'

export interface FactRef {
  kind: string
  id: string
}

export interface NpcData {
  role?: NpcRole
  /** 外觀：registerLook 的 id（folk-a…d、clerk），或種子（數字） */
  look?: number | string
  /** 旅人產生器的種子（generatedNpcs 時用） */
  lookSeed?: number
  /** 事實：樣板、資料參照、參數；source 是 world 算出來的出處（rail.km、straight.km 這種資料推出來的數字用） */
  fact?: { template: string; ref: FactRef; params?: Record<string, string | number>; source?: { label: string; url: string } }
  tags?: { region?: string; kit?: Kit; town?: string; season?: string; time?: string }
  /** 祭典 NPC 指的祭典（沒有 fact 時用） */
  festivalId?: string
  /** 店員：顧的那一家店（店的實體 id；不寫就找這張地圖的第一家） */
  shop?: string
}

export type ShopKind = 'station' | 'shinise' | 'shokudo' | 'teahouse'

/** 行李裡的東西指到哪一筆資料：地區特色、老舖・茶屋、遊戲自己的東西 */
export interface ItemRef {
  kind: 'specialty' | 'shinise' | 'game'
  id: string
}

/** 站在櫃台後面的人（店、剪票口、旅館；有寫 look 或 lookSeed 就生一個） */
export interface StaffData {
  look?: string
  lookSeed?: number
}

export interface ShopData extends StaffData {
  shopKind: ShopKind
  name?: string
  shiniseId?: string
  /** world 給的品項：車站賣店、食堂當作今天輪換的池子，老舖照給的賣 */
  items?: readonly ItemRef[]
}

export type StampKind = 'station' | 'sanpai' | 'castle'

export interface StampData {
  stampId: string
  stampKind: StampKind
  pref: string
  name: string
  spotId?: string
  castleId?: string
  stationId?: string
  /** 印面上的字（world 給的：只寫資料裡有的） */
  face?: string
}

export type TravelMode = 'rail' | 'monorail' | 'bus' | 'plane' | 'ferry'

export interface TravelDest {
  town: string
  name: string
  km: number
  kmKind: 'rail' | 'straight'
  /** 轉乘的地方（例：関西国際空港） */
  via?: string | { name: string; km: number; kmKind: 'rail' | 'straight'; mode: TravelMode }
  /** 坐什麼（跟出發的地方不一樣時才寫） */
  mode?: TravelMode
  /** world 的 Link.id */
  link?: string
}

export interface TravelData extends StaffData {
  mode: TravelMode
  fromTown: string
  dests: readonly TravelDest[]
}

/** 選好的目的地（交給 world 的 travel） */
export interface TravelLink extends TravelDest {
  mode: TravelMode
  fromTown: string
}

export interface InnData extends StaffData {
  innKind: 'ryokan' | 'minshuku'
  name: string
}

/** 房間的架子、相框（world 在 'room' 地圖放）：index（或 slot）是第幾格（架子 0–17、相框 0–3）；也可以寫 col、row */
export interface SlotData {
  index?: number
  slot?: number
  col?: number
  row?: number
}

/** 實體的 data 照種類讀（型別不對的欄位當作沒有） */
export const dataOf = <T>(e: MapEntity): Partial<T> => (e.data ?? {}) as Partial<T>

export interface Place {
  map: string
  x: number
  y: number
  dir: Dir
}
