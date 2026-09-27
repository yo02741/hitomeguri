// 縣界（web/public/geo/prefectures.json）：判斷地圖中心落在哪個縣（UX-FLOW.md §1.3）。

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
