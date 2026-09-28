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
