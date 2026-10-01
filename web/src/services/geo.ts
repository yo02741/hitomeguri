// 縣界（web/public/geo/prefectures.json）：判斷地圖中心落在哪個縣（UX-FLOW.md §1.3），並在地區頁畫出縣界。

import type * as GeoJSON from 'geojson'

type Ring = [number, number][]
interface Feature {
  properties: { pref: string }
  geometry: { coordinates: Ring[][] }
}

let features: Feature[] | null = null
let loading: Promise<Feature[]> | null = null

export function loadPrefectureShapes(): Promise<Feature[]> {
  if (features) return Promise.resolve(features)
  loading ??= fetch(`${import.meta.env.BASE_URL}geo/prefectures.json`)
    .then((r) => r.json())
    .then((fc: { features: Feature[] }) => (features = fc.features))
  return loading
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function prefectureAt(lng: number, lat: number): string | null {
  for (const f of features ?? []) {
    for (const poly of f.geometry.coordinates) {
      const [outer, ...holes] = poly
      if (outer && inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) {
        return f.properties.pref
      }
    }
  }
  return null
}

/** 縣界的 GeoJSON（地圖上畫縣界用）；縣界尚未載入時為 null */
export function prefectureShape(pref: string): GeoJSON.Feature<GeoJSON.MultiPolygon> | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  return { type: 'Feature', properties: { pref }, geometry: { type: 'MultiPolygon', coordinates: f.geometry.coordinates } }
}

/** 縣界的外框 [west, south, east, north]；縣界尚未載入時為 null。 */
export function prefectureBounds(pref: string): [number, number, number, number] | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  let w = 180, s = 90, e = -180, n = -90
  for (const poly of f.geometry.coordinates) {
    for (const [x, y] of poly[0] ?? []) {
      w = Math.min(w, x); e = Math.max(e, x)
      s = Math.min(s, y); n = Math.max(n, y)
    }
  }
  return [w, s, e, n]
}

/**
 * 縣的主要陸地（範圍最大的一塊）的外框：進入地區時看得到整個縣的形狀，
 * 又不會因為離島（沖繩的八重山、東京的伊豆諸島）拉得太遠。縣界尚未載入時為 null。
 */
export function prefectureMainBounds(pref: string): [number, number, number, number] | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  let best: [number, number, number, number] | null = null
  let bestArea = -1
  for (const poly of f.geometry.coordinates) {
    let w = 180, s = 90, e = -180, n = -90
    for (const [x, y] of poly[0] ?? []) {
      w = Math.min(w, x); e = Math.max(e, x)
      s = Math.min(s, y); n = Math.max(n, y)
    }
    const area = (e - w) * (n - s)
    if (area > bestArea) {
      bestArea = area
      best = [w, s, e, n]
    }
  }
  return best
}

/** 兩點距離（公尺） */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

/** 收集冊的日本地圖（DESIGN.md §7.19）：一縣一條 SVG path */
export interface PrefPath {
  pref: string
  d: string
}
export interface JapanOutline {
  viewBox: string
  paths: PrefPath[]
  /** 沖繩移到左上的框（x, y, w, h） */
  inset: [number, number, number, number]
}

// 等距圓柱投影，經度依北緯 36.5 度縮放；沖繩依日本地圖的慣例移到左上角的框裡。
const LNG0 = 128.3
const LAT0 = 45.7
const KX = Math.cos((36.5 * Math.PI) / 180) * 10
const OKINAWA_SHIFT: [number, number] = [5.67, 18.3]
// 離島：外框小於這個（度）的島不畫；東京的小笠原（北緯 32 度以南）不畫
const MIN_ISLAND = 0.06
const TOLERANCE = 0.45

let outline: JapanOutline | null = null

const px = (x: number) => (x - LNG0) * KX
const py = (y: number) => (LAT0 - y) * 10

/** 沖繩一帶（照日本地圖的慣例畫在左上框裡的範圍） */
export function inOkinawaInset(lng: number, lat: number): boolean {
  return lat < 27.05 && lng < 131.5
}

/** 經緯度 → 日本地圖 SVG 座標；沖繩一帶移到左上的框 */
export function japanProject(lng: number, lat: number, inset = inOkinawaInset(lng, lat)): [number, number] {
  return inset ? [px(lng + OKINAWA_SHIFT[0]), py(lat + OKINAWA_SHIFT[1])] : [px(lng), py(lat)]
}

/** 日本地圖 SVG 座標 → 經緯度（點在沖繩框裡時換回原本的位置） */
export function japanUnproject(x: number, y: number): [number, number] {
  const lng = x / KX + LNG0
  const lat = LAT0 - y / 10
  const [ix, iy, iw, ih] = outline?.inset ?? [0, 0, 0, 0]
  if (x >= ix && x <= ix + iw && y >= iy && y <= iy + ih) return [lng - OKINAWA_SHIFT[0], lat - OKINAWA_SHIFT[1]]
  return [lng, lat]
}

export async function japanOutline(): Promise<JapanOutline> {
  if (outline) return outline
  const fs = await loadPrefectureShapes()
  const paths = fs.map((f) => {
    const pref = f.properties.pref
    const [sx, sy] = pref === 'okinawa' ? OKINAWA_SHIFT : [0, 0]
    const polys = f.geometry.coordinates.filter((poly) => {
      const ring = poly[0] ?? []
      const xs = ring.map((p) => p[0])
      const ys = ring.map((p) => p[1])
      if (pref === 'tokyo' && Math.max(...ys) < 32) return false
      return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= MIN_ISLAND || f.geometry.coordinates.length === 1
    })
    let d = ''
    for (const poly of polys) {
      for (const ring of poly) {
        const pts: [number, number][] = []
        for (const [x, y] of ring) {
          const p: [number, number] = [px(x + sx), py(y + sy)]
          const l = pts[pts.length - 1]
          if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) >= TOLERANCE) pts.push(p)
        }
        if (pts.length < 3) continue
        d += 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z'
      }
    }
    return { pref, d }
  })
  const w = px(148.95)
  const h = py(26.95)
  outline = { viewBox: `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`, paths, inset: [px(128.4), py(45.62), px(137.4) - px(128.4), py(41.95) - py(45.62)] }
  return outline
}
