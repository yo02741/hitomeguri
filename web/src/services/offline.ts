import { MAP_STYLE_URL } from '../map/style'
import type { useCatalogStore } from '../stores/catalog'
import { mapThumbUrl } from './bundles'
import { commonsThumb, commonsWidthFor } from './commons'
import { allStops, type Trip } from './trip'

/**
 * 行程的離線準備（DESIGN.md §7.20）：把行程用得到的東西先抓一遍，讓 service worker 存起來。
 * - 停留點所在各縣的地圖、景點詳細、鐵路、祭典、地區特色資料，會話與期間限定
 * - 停留點的照片
 * - 停留點附近的地圖圖磚（縮放 10–15，半徑約 1.5 km）＋各縣全圖（縮放 6–9）
 * 收藏、去過、行程本身由 Firestore 的本機快取處理（services/firebase.ts）。
 */

type Catalog = ReturnType<typeof useCatalogStore>

const STORE_KEY = 'hm-offline-trips'
const TILE_LIMIT = 1800
const CONCURRENCY = 6

export interface OfflineProgress {
  done: number
  total: number
}

/** 這台裝置上哪些行程準備過離線（行程 id → 日期）；只是本機的提示 */
export function offlineReadyAt(tripId: string): string | null {
  try {
    const m = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, string>
    return m[tripId] ?? null
  } catch {
    return null
  }
}

function markReady(tripId: string, date: string) {
  try {
    const m = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, string>
    m[tripId] = date
    localStorage.setItem(STORE_KEY, JSON.stringify(m))
  } catch {
    // 無痕模式等存不了：只是少了「已可離線」的提示
  }
}

// 經緯度 → 圖磚座標（Web Mercator）
function tileXY(lng: number, lat: number, z: number): [number, number] {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))]
}

function tilesInBox(w: number, s: number, e: number, n: number, z: number): string[] {
  const [x1, y1] = tileXY(w, n, z)
  const [x2, y2] = tileXY(e, s, z)
  const out: string[] = []
  for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) out.push(`${z}/${x}/${y}`)
  return out
}

/** 底圖向量圖磚的網址樣板（從樣式的 TileJSON 讀，例 https://tiles.openfreemap.org/planet/…/{z}/{x}/{y}.pbf） */
async function tileTemplate(): Promise<{ url: string; maxzoom: number } | null> {
  try {
    const style = (await (await fetch(MAP_STYLE_URL)).json()) as { sources: Record<string, { type: string; url?: string }> }
    const src = Object.values(style.sources).find((s) => s.type === 'vector' && s.url)
    if (!src?.url) return null
    const tj = (await (await fetch(src.url)).json()) as { tiles?: string[]; maxzoom?: number }
    return tj.tiles?.[0] ? { url: tj.tiles[0], maxzoom: tj.maxzoom ?? 14 } : null
  } catch {
    return null
  }
}

async function runAll(urls: string[], onDone: () => void) {
  let i = 0
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++]!
      try {
        // 照片走 no-cors（和 <img> 一樣），其他照一般請求
        await fetch(url, url.includes('wikimedia.org') ? { mode: 'no-cors' } : undefined)
      } catch {
        // 抓不到的跳過（離線時這一張就沒有）
      }
      onDone()
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
}

export async function prepareOffline(trip: Trip, catalog: Catalog, onProgress: (p: OfflineProgress) => void): Promise<void> {
  const stops = allStops(trip)
  const prefs = [...new Set(stops.map((s) => s.pref))]
  const steps = prefs.length * 4 + 3
  let done = 0
  const tick = (total: number) => onProgress({ done: ++done, total })

  // 資料：經由 catalog 載入，網址和平常一樣（service worker 存的就是這些）
  const index = await catalog.loadIndex()
  await Promise.all(
    prefs.flatMap((p) => [
      catalog.loadMap(p).finally(() => tick(steps)),
      catalog.loadDetail(p).finally(() => tick(steps)),
      catalog.loadRail(p).finally(() => tick(steps)),
      catalog.loadFestivals(p).finally(() => tick(steps)),
    ]),
  )
  await Promise.all([
    catalog.loadPhrases().finally(() => tick(steps)),
    catalog.loadTimed().finally(() => tick(steps)),
    // 旅前準備的地區特色詞（一縣一檔）
    catalog.loadSpecialties(prefs).finally(() => tick(steps)),
  ])

  // 照片：停留點的地圖小圖與卡片用的縮圖
  const photos = new Set<string>()
  const points: [number, number][] = []
  for (const s of stops) {
    const m = catalog.mapSpots[s.pref]?.find((x) => x.id === s.spot_id)
    if (m) {
      points.push([m.lng, m.lat])
      if (m.i) photos.add(mapThumbUrl(m.i))
    }
    const d = catalog.details[s.pref]?.[s.spot_id]
    const img = d?.images[0]?.url
    if (img) {
      // 收集卡（500、960）與景點面板（這台裝置的面板寬 × devicePixelRatio，SpotPanel 用同一個規則；桌機的面板 400 寬）
      photos.add(commonsThumb(img, 500))
      photos.add(commonsThumb(img, 960))
      photos.add(commonsThumb(img, commonsWidthFor(window.innerWidth < 1024 ? window.innerWidth : 400, window.devicePixelRatio)))
    }
  }

  // 地圖圖磚：停留點附近（縮放 10–15）＋各縣全圖（縮放 6–9）
  const tpl = await tileTemplate()
  const tiles = new Set<string>()
  if (tpl) {
    for (const p of prefs) {
      const b = index.prefectures[p] ? catalog.mapSpots[p] : undefined
      if (!b?.length) continue
      const lngs = b.map((x) => x.lng)
      const lats = b.map((x) => x.lat)
      for (let z = 6; z <= 9; z++) tilesInBox(Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats), z).forEach((t) => tiles.add(t))
    }
    const d = 0.015
    for (const [lng, lat] of points) {
      for (let z = 10; z <= Math.min(15, tpl.maxzoom); z++) tilesInBox(lng - d, lat - d, lng + d, lat + d, z).forEach((t) => tiles.add(t))
    }
  }
  const tileUrls = [...tiles].slice(0, TILE_LIMIT).map((t) => {
    const [z, x, y] = t.split('/')
    return tpl!.url.replace('{z}', z!).replace('{x}', x!).replace('{y}', y!)
  })

  const urls = [...photos, ...tileUrls]
  const total = steps + urls.length
  done = steps
  onProgress({ done, total })
  await runAll(urls, () => onProgress({ done: ++done, total }))
  markReady(trip.id, new Date().toISOString().slice(0, 10))
}
