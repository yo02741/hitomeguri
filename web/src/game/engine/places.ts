import type { GameMap, MapName } from './types'

/**
 * 地圖上「有名字的地方」（P4 的地名與小地圖）：只從地圖本身的資料讀，不另外編名字。
 *  - 告示牌（sign）的 data.title：地標（data.spotId）、老舖・茶屋的店面（shiniseId）、車站（id 是 sign:station:…）。
 *    地標的範圍＝同一個 spotId 的拍攝點的 target（地標的本體）；沒有就是告示牌那一格。
 *  - 門 → 室內：室內地圖的名字（茶屋、食堂、旅館、機場…）。車站、授与所、城的蓋章處是地標或車站的一部分，不另外算；
 *    名字跟告示牌一樣的（老舖的店面）也不重複。
 * 純函式：PlayView 在進一張地圖時算一次（室內的名字由 nameOf 給，通常是 world 的 mapSource）。
 */
export interface PlaceName {
  ja: string
  zh?: string
  kana?: string
  romaji?: string
}

export type PlaceKind = 'landmark' | 'station' | 'shop' | 'door'

export interface Place {
  /** 告示牌的實體 id，或 door:<室內地圖 id> */
  id: string
  kind: PlaceKind
  name: PlaceName
  /** 地標的本體（格子座標）；告示牌、門是 1×1 */
  rect: { x: number; y: number; w: number; h: number }
  /** 小地圖上的記號（本體的中心） */
  at: { x: number; y: number }
  /** 告示牌、門那一格（走到旁邊也算到了） */
  near: { x: number; y: number }
}

/** 門的室內種類（int:<鎮>:<種類>:<n>）：這幾種是地標、車站的一部分，地名不另外浮出 */
const PART_OF_LANDMARK = new Set(['station', 'juyosho', 'castle'])

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

function nameOf(v: unknown): PlaceName | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const ja = str(o.ja)
  if (!ja) return null
  const n: PlaceName = { ja }
  const zh = str(o.zh)
  const kana = str(o.kana)
  const romaji = str(o.romaji)
  if (zh) n.zh = zh
  if (kana) n.kana = kana
  if (romaji) n.romaji = romaji
  return n
}

/** 室內地圖 id 的種類（int:261068:teahouse:0 → teahouse） */
export function interiorKind(mapId: string): string | null {
  const m = /^int:[^:]+:([^:]+):/.exec(mapId)
  return m ? m[1]! : null
}

export function placesOf(map: GameMap, interiorName?: (mapId: string) => MapName | null | undefined): Place[] {
  const out: Place[] = []
  const targets = new Map<string, { x: number; y: number; w: number; h: number }>()
  for (const e of map.entities) {
    if (e.kind !== 'photoSpot') continue
    const d = (e.data ?? {}) as Record<string, unknown>
    const id = str(d.spotId)
    const t = d.target as { x?: unknown; y?: unknown; w?: unknown; h?: unknown } | undefined
    if (id && t && [t.x, t.y, t.w, t.h].every((n) => typeof n === 'number' && Number.isFinite(n))) targets.set(id, t as { x: number; y: number; w: number; h: number })
  }
  const names = new Set<string>()
  for (const e of map.entities) {
    if (e.kind !== 'sign') continue
    const d = (e.data ?? {}) as Record<string, unknown>
    const name = nameOf(d.title)
    if (!name) continue
    const spot = str(d.spotId)
    const kind: PlaceKind = e.id.startsWith('sign:station:') ? 'station' : str(d.shiniseId) ? 'shop' : spot ? 'landmark' : 'shop'
    const t = spot ? targets.get(spot) : undefined
    const rect = t ? { ...t } : { x: e.x, y: e.y, w: 1, h: 1 }
    out.push({ id: e.id, kind, name, rect, at: { x: rect.x + Math.floor(rect.w / 2), y: rect.y + Math.floor(rect.h / 2) }, near: { x: e.x, y: e.y } })
    names.add(name.ja)
  }
  if (interiorName) {
    const seen = new Set<string>()
    for (const w of map.warps) {
      const kind = interiorKind(w.to)
      if (!kind || PART_OF_LANDMARK.has(kind) || seen.has(w.to)) continue
      seen.add(w.to)
      let n: MapName | null | undefined = null
      try {
        n = interiorName(w.to)
      } catch {
        n = null
      }
      const name = nameOf(n)
      if (!name || names.has(name.ja)) continue
      if (name.zh === name.ja) delete name.zh
      const r = { x: w.x, y: w.y, w: 1, h: 1 }
      out.push({ id: `door:${w.to}`, kind: 'door', name, rect: r, at: { x: w.x, y: w.y }, near: { x: w.x, y: w.y } })
    }
  }
  return out
}

/** 格子到一塊範圍的距離（Chebyshev：斜角也算一格） */
export function rectDistance(r: { x: number; y: number; w: number; h: number }, x: number, y: number): number {
  const dx = x < r.x ? r.x - x : x >= r.x + r.w ? x - (r.x + r.w - 1) : 0
  const dy = y < r.y ? r.y - y : y >= r.y + r.h ? y - (r.y + r.h - 1) : 0
  return Math.max(dx, dy)
}

/** 離這個地方多遠（本體、告示牌或門，取近的那個） */
export function placeDistance(p: Place, x: number, y: number): number {
  return Math.min(rectDistance(p.rect, x, y), Math.max(Math.abs(p.near.x - x), Math.abs(p.near.y - y)))
}

/** 附近幾格內最近的地方（一樣近時，範圍小的優先：站在大寺裡的老舖前面，是那家老舖）；沒有 null */
export function nearestPlace(places: readonly Place[], x: number, y: number, reach = 2): Place | null {
  let best: Place | null = null
  let bestD = Infinity
  let bestA = Infinity
  for (const p of places) {
    const d = placeDistance(p, x, y)
    if (d > reach) continue
    const a = p.rect.w * p.rect.h
    if (d < bestD || (d === bestD && a < bestA)) {
      best = p
      bestD = d
      bestA = a
    }
  }
  return best
}

/** 地名的小字：中文（跟日文不一樣時），沒有就念法（假名），再沒有就羅馬字 */
export function placeSub(n: PlaceName): string | null {
  if (n.zh && n.zh !== n.ja) return n.zh
  if (n.kana && n.kana !== n.ja) return n.kana
  if (n.romaji && n.romaji !== n.ja) return n.romaji
  return null
}
