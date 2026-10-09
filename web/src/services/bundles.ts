// 前端 bundle（pipeline/build_bundles.py 產生，部署在站台的 bundles/ 底下）。

export interface MapSpot {
  id: string
  n: string // 日文名
  z?: string // 繁中名（featured.json 省略）
  lat: number
  lng: number
  k: 'major'
  f: 0 | 1 // 精選
  s: number // 分數
  h?: string // 假名
  r?: string // 羅馬拼音
  c?: string // 分類
  i?: string // 地圖用小圖：Commons 縮圖路徑（省略前綴）或完整網址
  d?: string // 最高的文化指定（世界遺產、國寶、特別史跡、特別名勝）：收集卡的稀有度
  si?: Partial<Record<'spring' | 'summer' | 'autumn' | 'winter' | 'night' | 'panorama', [path: string, author: string, license: string]>> // 收集卡的季節、夜景照片
}

export const COMMONS_THUMB_PREFIX = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'

export function mapThumbUrl(i: string): string {
  return i.startsWith('https://') ? i : COMMONS_THUMB_PREFIX + i
}

export interface SpotImage {
  url: string
  author: string
  license: string
  source_url: string
}

export interface StationName {
  ja: string
  kana?: string
  romaji?: string
  en?: string
}

export interface Spot {
  id: string
  name: { ja: string; kana?: string; romaji?: string; zh_tw: string; en?: string }
  kana_source?: 'wikidata' | 'osm' | 'wikipedia'
  location: { lat: number; lng: number }
  prefecture: string
  city?: string
  kind: 'major'
  themes: string[]
  tags: string[]
  featured: boolean
  score: number
  /** 維基百科開頭段落（中文優先，沒有則日文）；顯示時標示出處與授權 */
  summary?: { text: string; lang: 'zh' | 'en' | 'ja'; source_url: string; license: string; fetched_at: string; text_zh?: string }
  best_months?: number[]
  stay_minutes?: number
  nearest_stations?: { name: StationName; distance_m: number }[]
  images: SpotImage[]
  /** 收集卡的季節照片（Commons） */
  season_images?: Partial<Record<'spring' | 'summer' | 'autumn' | 'winter' | 'night' | 'panorama', SpotImage>>
  external_ids: { wikidata?: string; osm?: string; google_place_id?: string }
  sources: { url: string; fetched_at: string }[]
  status: 'published' | 'closed'
  updated_at: string
}

export interface BundleIndex {
  prefectures: Record<string, { count: number; featured: number; version: string }>
  packs?: Record<string, { count: number; version: string }>
  /** search.json 的版本 */
  search?: string
  /** 鐵路路線圖層：縣 → 版本 */
  rail?: Record<string, { version: string }>
  /** 深度探索「祭典」：縣 → 版本 */
  festivals?: Record<string, { count: number; version: string }>
  /** 深度探索、旅前準備的「地區特色」：縣 → 版本（一縣一檔；沒有這欄的舊索引讀全國一個檔） */
  specialties?: Record<string, { count: number; version: string }>
  /** 期間限定（全國一個檔） */
  timed?: { count: number; version: string }
  /** 地區特色、會話、季節、航線、浮世繪裡的景點：檔名 → 版本 */
  extras?: Partial<Record<'specialties' | 'flights' | 'phrases' | 'seasons' | 'ukiyoe', string>>
  /** 成就用的小索引（achievements.json） */
  achievements?: { version: string }
}

/**
 * 成就用的小索引（pipeline/build_bundles.py build_achievements）：
 * tags 文化指定 → 帶這個指定的大點 id（一個景點有幾種指定就列在幾種底下）；
 * castle 名城組別 → [名城 id, 對應景點 id 或 null]。
 */
export interface AchvData {
  tags: Record<string, string[]>
  castle: Record<'100' | 'zoku', Array<[string, string | null]>>
}

export function fetchAchievements(v: string): Promise<AchvData> {
  return getJson<AchvData>(`achievements.json?v=${v}`)
}

/** 有版本就加 ?v=（舊的 _index.json 沒有版本時照舊抓） */
const withV = (path: string, v?: string) => (v ? `${path}?v=${v}` : path)

/** 搜尋索引一筆：[id, 縣, 日文名, 假名, 繁中名（同日文時空字串）, 羅馬拼音, 分數] */
export type SearchRow = [string, string, string, string, string, string, number]

export function fetchSearch(version: string): Promise<SearchRow[]> {
  return getJson<SearchRow[]>(`search.json?v=${version}`)
}

/** 擴充包的一個點（pipeline/build_bundles.py 的 pack_items_*） */
export interface PackItem {
  id: string
  g: string // 組別（data/packs.ts 的 groups）
  p: string // 縣
  n: string // 名稱（人孔蓋為所在市町村）
  lat: number
  lng: number
  a?: string // 地址
  pk?: [string, string][] // 人孔蓋上的寶可夢（圖鑑編號、日文名）
  u: string // 官方頁面或來源
  h?: string // 假名
  z?: string // 繁中名（與日文相同時省略）
  no?: number // 名城番號
  st?: string[] // スタンプ設置場所
  s?: string // 對應的景點 id（城）
  f?: string // 創業（「1705年」「16世紀」）
  w?: string // 維基百科條目
}

const base = `${import.meta.env.BASE_URL}bundles/`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path)
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return (await res.json()) as T
}

/**
 * 浮世繪裡的景點（pipeline/build_bundles.py build_ukiyoe）：s 景點 id、p 縣、n 日文名、z 繁中名（同日文時省略）、
 * sc 分數、w 作品（i 作品 QID、t 題名、se 系列、y 年份、c 作者、f 圖：Commons 縮圖路徑或完整網址、a 圖的作者、l 授權、u Commons 檔案頁）。
 */
export interface UkiyoeWork {
  i: string
  t: string
  se?: string
  y?: number
  c: string
  f: string
  a: string
  l: string
  u: string
}
export interface UkiyoeSpot {
  s: string
  p: string
  n: string
  z?: string
  sc: number
  w: UkiyoeWork[]
}

export async function fetchUkiyoe(v?: string): Promise<UkiyoeSpot[]> {
  return getJson<UkiyoeSpot[]>(withV('ukiyoe.json', v))
}

export function fetchIndex(): Promise<BundleIndex> {
  return getJson<BundleIndex>('_index.json')
}

export function fetchMap(pref: string, version: string): Promise<MapSpot[]> {
  return getJson<MapSpot[]>(`map/${pref}.json?v=${version}`)
}

/** 各縣精選（首頁用）；v 為各縣版本組成，資料更新時換網址避開快取 */
export function fetchFeatured(v: string): Promise<Record<string, MapSpot[]>> {
  return getJson<Record<string, MapSpot[]>>(`featured.json?v=${v}`)
}
export function fetchPack(key: string, version: string): Promise<PackItem[]> {
  return getJson<PackItem[]>(`packs/${key}.json?v=${version}`)
}
export function fetchDetail(pref: string, version: string): Promise<Spot[]> {
  return getJson<Spot[]>(`detail/${pref}.json?v=${version}`)
}

export interface Specialty {
  id: string
  name: { ja: string; kana?: string; romaji?: string; zh_tw: string; en?: string }
  prefecture: string
  area?: string
  category: string
  season_months?: number[]
  /** 維基百科開頭段落（中文優先，沒有則日文）；舊資料為 summary_zh */
  summary?: { text: string; lang: 'zh' | 'en' | 'ja'; source_url: string; license: string; fetched_at: string; text_zh?: string }
  summary_zh?: string
  images?: SpotImage[]
  sources: { url: string; fetched_at: string }[]
}

export interface FlightRoute {
  origin: string
  dest: string
  airlines: { name_zh: string; iata?: string }[]
  frequency_note_zh?: string
  season?: string
  verified: boolean
  checked_at: string
  sources?: { url: string; fetched_at: string }[]
}

export function fetchPrefSpecialties(pref: string, version: string): Promise<Specialty[]> {
  return getJson<Specialty[]>(`specialties/${pref}.json?v=${version}`)
}

/** 全國一個檔（約 1.8 MB）：只在索引沒有分縣版本時用 */
export async function fetchSpecialties(v?: string): Promise<Specialty[]> {
  try {
    return await getJson<Specialty[]>(withV('specialties.json', v))
  } catch {
    return []
  }
}

/** 鐵路路線圖層（pipeline/build_bundles.py build_rail）：n 名稱、e 英文、c 路線色、k 種類、o 營運者、g 線段 */
export interface RailBundle {
  lines: Array<{ n: string; e?: string; c?: string; k: string; o?: string; g: number[][][] }>
  stations: Array<{ n: string; e?: string; lat: number; lng: number }>
}

export function fetchRail(pref: string, version: string): Promise<RailBundle> {
  return getJson<RailBundle>(`rail/${pref}.json?v=${version}`)
}

/** 深度探索「祭典」（pipeline/models.py Festival） */
export interface Festival {
  id: string
  name: { ja: string; kana?: string; romaji?: string; zh_tw: string; en?: string }
  prefecture: string
  months?: number[]
  months_source?: 'wikidata' | 'wikipedia'
  location?: { lat: number; lng: number }
  summary?: { text: string; lang: 'zh' | 'en' | 'ja'; source_url: string; license: string; text_zh?: string }
  images?: Array<{ url: string; author: string; license: string; source_url: string }>
  sources: Array<{ url: string; fetched_at: string }>
  views: number
}

export function fetchFestivals(pref: string, version: string): Promise<Festival[]> {
  return getJson<Festival[]>(`festivals/${pref}.json?v=${version}`)
}

/** 深度探索「季節」：氣象廳生物季節観測平年值（normals: 現象 key → "MM-DD"） */
export interface SeasonStation {
  name: string
  prefecture: string
  normals: Record<string, string>
}
export interface SeasonData {
  source: { url: string; fetched_at: string }
  stations: SeasonStation[]
}

export async function fetchSeasons(v?: string): Promise<SeasonData | null> {
  try {
    return await getJson<SeasonData>(withV('seasons.json', v))
  } catch {
    return null
  }
}

/** 期間限定（pipeline/models.py TimedItem；build-bundles 只輸出沒過期的） */
export interface TimedItem {
  id: string
  kind: 'product' | 'event' | 'seasonal'
  category: string
  brand?: string
  title: { ja: string; zh_tw: string }
  summary_zh?: string
  scope: 'national' | 'regional' | 'spot'
  prefectures?: string[]
  location?: { lat: number; lng: number }
  spot_id?: string
  valid_from: string
  valid_to: string
  source_url: string
  source_label?: string
}

export async function fetchTimed(version: string): Promise<TimedItem[]> {
  try {
    return await getJson<TimedItem[]>(`timed.json?v=${version}`)
  } catch {
    return []
  }
}

/** 旅前準備的會話（data/phrases） */
export async function fetchPhrases(v?: string): Promise<import('./prep').Phrase[]> {
  try {
    return await getJson<import('./prep').Phrase[]>(withV('phrases.json', v))
  } catch {
    return []
  }
}

export async function fetchFlights(v?: string): Promise<FlightRoute[]> {
  try {
    return await getJson<FlightRoute[]>(withV('flights.json', v))
  } catch {
    return []
  }
}
