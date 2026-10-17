import { distanceM } from '../../services/geo'

/**
 * 經緯度的小工具：球面距離（km）、區界外框、以鎮中心為原點的平面（km，北朝上）。
 */
export interface LatLng {
  lat: number
  lng: number
}

export const kmBetween = (a: LatLng, b: LatLng) => distanceM(a.lat, a.lng, b.lat, b.lng) / 1000

/** 以 o 為原點：東 +x、南 +y（畫面的方向），單位 km */
export function offsetKm(o: LatLng, p: LatLng): { x: number; y: number } {
  const kx = 111.32 * Math.cos((o.lat * Math.PI) / 180)
  return { x: (p.lng - o.lng) * kx, y: (o.lat - p.lat) * 110.57 }
}

export function inBbox(b: [number, number, number, number], p: LatLng): boolean {
  return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3]
}

/** 外框的面積（km²，粗估：判斷街上或郊外） */
export function bboxAreaKm2(b: [number, number, number, number]): number {
  const mid = (b[1] + b[3]) / 2
  return (b[2] - b[0]) * 111.32 * Math.cos((mid * Math.PI) / 180) * (b[3] - b[1]) * 110.57
}

/** 小數 1 位（顯示的 km） */
export const km1 = (km: number) => Math.round(km * 10) / 10

/** 點在不在多邊形裡（even-odd，外環與洞一起算；座標 [經度, 緯度]） */
function inRings(rings: readonly (readonly (readonly number[])[])[], x: number, y: number): boolean {
  let inside = false
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i]![0]!
      const yi = ring[i]![1]!
      const xj = ring[j]![0]!
      const yj = ring[j]![1]!
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  return inside
}

/** 區界（MultiPolygon）裡有這個點嗎 */
export function inMultiPolygon(coords: readonly (readonly (readonly (readonly number[])[])[])[], p: LatLng): boolean {
  for (const poly of coords) if (inRings(poly, p.lng, p.lat)) return true
  return false
}

/**
 * 這個點在哪一個市区町村（N03 的區界，point-in-polygon；外框先篩）。都不在回 null。
 * 祭典、老舖用這個決定「在哪一鎮」（規格 §8.3：點在區界內）。
 */
export function municipalityAt(
  features: ReadonlyArray<{ properties: { m: string }; geometry: { coordinates: readonly (readonly (readonly (readonly number[])[])[])[] } }>,
  boxes: ReadonlyMap<string, readonly [number, number, number, number]>,
  p: LatLng,
): string | null {
  for (const f of features) {
    const b = boxes.get(f.properties.m)
    if (b && !inBbox(b as [number, number, number, number], p)) continue
    if (inMultiPolygon(f.geometry.coordinates, p)) return f.properties.m
  }
  return null
}
