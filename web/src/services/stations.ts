// 車站卡片（TODO.md「縣內規劃」3）：縣的鐵路 bundle 裡的一個車站、停靠的路線、附近的景點。
// 車站 id 是路網節點（rail-graph.json）：縣界附近、同名相鄰的幾個車站點合併成一個，景點的 st 也是它。

import type { MapSpot, RailBundle } from './bundles'
import { distanceM } from './geo'

export interface StationLine {
  name: string
  /** 官方路線色（OSM 的 colour；沒有就沒有） */
  color?: string
  shinkansen: boolean
  /** 營運者（「・」分隔） */
  operator?: string
}

export interface StationInfo {
  id: string
  name: string
  en?: string
  lat: number
  lng: number
  shinkansen: boolean
  lines: StationLine[]
}

/** 一個車站：同一個 id 的車站點（合併過的）停靠的路線合在一起；新幹線排前面，其餘依名稱 */
export function stationInfo(rail: RailBundle | null | undefined, id: string | null | undefined): StationInfo | null {
  if (!rail || !id) return null
  const points = rail.stations.filter((s) => s.id === id)
  const first = points[0]
  if (!first) return null
  const byName = new Map<string, StationLine>()
  for (const st of points) {
    for (const i of st.l ?? []) {
      const l = rail.lines[i]
      if (!l || byName.has(l.n)) continue
      byName.set(l.n, {
        name: l.n,
        color: l.c,
        shinkansen: l.s === 1,
        operator: l.o ? l.o.split(';').map((o) => o.trim()).filter(Boolean).join('・') : undefined,
      })
    }
  }
  const lines = [...byName.values()].sort((a, b) => Number(b.shinkansen) - Number(a.shinkansen) || a.name.localeCompare(b.name, 'ja'))
  return {
    id,
    name: first.n,
    en: first.e,
    lat: first.lat,
    lng: first.lng,
    shinkansen: points.some((s) => s.s === 1) || lines.some((l) => l.shinkansen),
    lines,
  }
}

/** 最近車站是這一站的景點（依分數）；沒有時改列這個距離內最近的幾個 */
export const NEAR_M = 1500
export const NEAR_MAX = 5

export interface NearbySpots {
  /** nearest：最近車站是這一站的景點；near：NEAR_M 內最近的幾個 */
  mode: 'nearest' | 'near'
  rows: { spot: MapSpot; d: number }[]
}

export function nearbySpots(spots: readonly MapSpot[], st: { id: string; lat: number; lng: number }): NearbySpots {
  const dist = (s: MapSpot) => Math.round(distanceM(st.lat, st.lng, s.lat, s.lng) / 10) * 10
  const own = spots.filter((s) => s.st === st.id)
  if (own.length) {
    return { mode: 'nearest', rows: own.map((spot) => ({ spot, d: dist(spot) })).sort((a, b) => b.spot.s - a.spot.s || a.d - b.d) }
  }
  const near = spots
    .map((spot) => ({ spot, d: dist(spot) }))
    .filter((x) => x.d <= NEAR_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, NEAR_MAX)
  return { mode: 'near', rows: near }
}

/** 車站名稱比對用：去掉「駅」與空白（景點詳細資料的最近車站名稱和鐵路 bundle 的寫法不一定一樣） */
export function sameStation(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/駅$/, '')
  return norm(a) === norm(b)
}

/** OSM 的出處：車站 id 是 node-123 時連到那個點 */
export function osmUrl(id: string): string | null {
  const m = /^(node|way|relation)-(\d+)$/.exec(id)
  return m ? `https://www.openstreetmap.org/${m[1]}/${m[2]}` : null
}
