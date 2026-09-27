// 前端 bundle（pipeline/build_bundles.py 產生，部署在站台的 bundles/ 底下）。

export interface MapSpot {
  id: string
  n: string // 日文名
  z: string // 繁中名
  lat: number
  lng: number
  k: 'major' | 'theme'
  f: 0 | 1 // 精選
  s: number // 分數
  h?: string // 假名
  r?: string // 羅馬拼音
  t?: string[] // 主題
  c?: string // 分類
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
  kana_source?: 'wikidata' | 'osm' | 'llm'
  location: { lat: number; lng: number }
  prefecture: string
  city?: string
  kind: 'major' | 'theme'
  themes: string[]
  tags: string[]
  featured: boolean
  score: number
  summary_zh: string
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

export function fetchDetail(pref: string, version: string): Promise<Spot[]> {
  return getJson<Spot[]>(`detail/${pref}.json?v=${version}`)
}
