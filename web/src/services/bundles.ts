// 前端 bundle（pipeline/build_bundles.py 產生，部署在站台的 bundles/ 底下）。

export interface MapSpot {
  id: string
  n: string // 日文名
  z?: string // 繁中名（featured.json 省略）
  lat: number
  lng: number
  k: 'major' | 'theme'
  f: 0 | 1 // 精選
  s: number // 分數
  h?: string // 假名
  r?: string // 羅馬拼音
  t?: string[] // 主題
  c?: string // 分類
  i?: string // 地圖用小圖：Commons 縮圖路徑（省略前綴）或完整網址
}

const COMMONS_THUMB_PREFIX = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'

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
  kind: 'major' | 'theme'
  themes: string[]
  tags: string[]
  featured: boolean
  score: number
  /** 維基百科開頭段落（中文優先，沒有則日文）；顯示時標示出處與授權 */
  summary?: { text: string; lang: 'zh' | 'ja'; source_url: string; license: string; fetched_at: string }
  best_months?: number[]
  stay_minutes?: number
  nearest_stations?: { name: StationName; distance_m: number }[]
  images: SpotImage[]
  external_ids: { wikidata?: string; osm?: string; google_place_id?: string }
  sources: { url: string; fetched_at: string }[]
  status: 'published' | 'closed'
  updated_at: string
}

export interface BundleIndex {
  prefectures: Record<string, { count: number; featured: number; version: string }>
}

const base = `${import.meta.env.BASE_URL}bundles/`

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base + path)
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return (await res.json()) as T
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
  summary_zh: string
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

export async function fetchSpecialties(): Promise<Specialty[]> {
  try {
    return await getJson<Specialty[]>('specialties.json')
  } catch {
    return []
  }
}

export async function fetchFlights(): Promise<FlightRoute[]> {
  try {
    return await getJson<FlightRoute[]>('flights.json')
  } catch {
    return []
  }
}
