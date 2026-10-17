import { buildGraph, type Graph, type Reach, round1, search } from '../../services/daytrip'

import { bboxAreaKm2, kmBetween, type LatLng } from './geo'
import { placeRomaji } from './romaji'
import type { Kit, Leg, Link, PrefData, PrefSpot, Town, TownStop, TravelMode, World } from './types'

/**
 * 選鎮與鎮之間的交通（規格 §8.2、§8.8）。
 * 選鎮：一縣最多 count 個（9），順序是
 *   1. 起點的鎮（京都＝下京区、沖繩＝那覇市）
 *   2. 有名城蓋章地點的市区町村（castle pack 的 st 有值、城的景點在這一縣：二条城→中京区、勝連城→うるま市…）
 *   3. 離島（沖繩：有機場、區界跟起點不相連，坐飛機）
 *   4. 其餘照市区町村的景點分數總和補滿。
 * 鐵路的縣要有連得到起點的車站（連不到的跳過，名城的鎮也一樣）。
 * 代表車站＝那一區景點最常見的最近車站 st（一樣多時看分數總和，再看 id）；起點可以指定（京都＝「京都」站）。
 * 交通：同縣的鐵路鎮兩兩用 rail-graph 的鐵路 km；沒有鐵路的鎮之間坐巴士（直線 km）；同一鎮的單軌站之間坐單軌；
 * 起點的機場與離島的機場之間坐飛機（直線 km）；京都 ↔ 那覇空港經関西国際空港（鐵路 km＋直線 km）。
 * 畫面只寫「鐵路約 n km」「直線約 n km」，不寫時刻、班次、路線名。
 */
export interface TownRule {
  count: number
  /** 起點的市区町村碼 */
  start: string
  /** 起點的車站（路網節點）；沒寫就照規則選 */
  startStation?: string
  /** 新遊戲（或從外縣來）進這一縣的地方：main＝車站門口、airport＝機場的抵達大廳 */
  startStop: 'main' | 'airport'
  /** 離島幾個（坐飛機到；要有機場的景點、區界跟起點不相連） */
  islands?: number
  /** 同一個政令指定都市最多幾區（不寫＝不限；P3 想讓鎮分散一點時用） */
  maxPerCity?: number
  /** 鎮之間坐什麼 */
  transit: 'rail' | 'bus'
}

export const TOWN_RULES: Record<string, TownRule> = {
  kyoto: { count: 9, start: '261068', startStation: 'node-267316272', startStop: 'main', transit: 'rail' },
  okinawa: { count: 9, start: '472018', startStop: 'airport', islands: 1, transit: 'bus' },
}

/** 縣 → 地方 kit（P3 擴到 47 縣時在這裡加；沒寫的用近畿） */
export const KIT_OF: Record<string, Kit> = { okinawa: 'okinawa' }
export const kitOf = (pref: string): Kit => KIT_OF[pref] ?? 'kinki'

/** 一鎮最多放幾個地標（規格：前 8–12 個） */
export const MAX_LANDMARKS = 12

// ---------- 鐵路 km ----------
/**
 * 先只搜到 NEAR_CAP km（Dijkstra 的權重上限：上限內的站，最短距離跟不設限一樣）；
 * 目的地不在裡面才搜整張路網（全國 9000 多個點，一次十幾毫秒，手機上更久）。
 */
const NEAR_CAP = 200
const reaches = new WeakMap<Graph, Map<string, Reach>>()
function reachFrom(g: Graph, src: number, cap?: number): Reach {
  let m = reaches.get(g)
  if (!m) reaches.set(g, (m = new Map()))
  const k = `${src}:${cap ?? ''}`
  let r = m.get(k)
  if (!r) m.set(k, (r = search(g, src, cap)))
  return r
}

/** 兩站之間的鐵路 km（daytrip 的 search，同日帰り；小數 1 位）；連不到回 null */
export function railKm(pref: Pick<PrefData, 'railGraph'>, a: string, b: string): number | null {
  if (!pref.railGraph.nodes.length) return null
  const g = buildGraph(pref.railGraph)
  const ia = g.index.get(a)
  const ib = g.index.get(b)
  if (ia === undefined || ib === undefined) return null
  if (ia === ib) return 0
  const km = reachFrom(g, ia, NEAR_CAP).km.get(ib) ?? reachFrom(g, ia).km.get(ib)
  return km === undefined ? null : round1(km)
}

function nodeOf(pref: PrefData, id: string): { id: string; name: string; lat: number; lng: number } | null {
  const st = pref.station(id)
  if (st) return { id, name: st.n, lat: st.lat, lng: st.lng }
  if (!pref.railGraph.nodes.length) return null
  const g = buildGraph(pref.railGraph)
  const i = g.index.get(id)
  if (i === undefined) return null
  const n = g.nodes[i]!
  return { id, name: n[1], lat: n[2], lng: n[3] }
}

/** 車站是單軌的嗎（rail bundle 的路線種類） */
function stationKind(pref: PrefData, id: string): 'rail' | 'monorail' {
  const st = pref.station(id)
  const kinds = (st?.l ?? []).map((i) => pref.lines[i]?.k)
  return kinds.length && kinds.every((k) => k === 'monorail') ? 'monorail' : 'rail'
}

// ---------- 選鎮 ----------
interface Candidate {
  code: string
  score: number
  spots: PrefSpot[]
}

function candidates(pref: PrefData): Candidate[] {
  const by = new Map<string, PrefSpot[]>()
  for (const s of pref.spots) {
    if (!s.m) continue
    const list = by.get(s.m)
    if (list) list.push(s)
    else by.set(s.m, [s])
  }
  const out: Candidate[] = []
  for (const [code, spots] of by) {
    if (!pref.municipality(code)) continue
    out.push({ code, score: spots.reduce((t, s) => t + s.s, 0), spots: spots.sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1)) })
  }
  return out.sort((a, b) => b.score - a.score || (a.code < b.code ? -1 : 1))
}

/** 這一區景點最常見的最近車站（要連得到 from；一樣多時看分數總和，再看 id） */
function commonStation(pref: PrefData, spots: PrefSpot[], from: string | null): string | null {
  const count = new Map<string, { n: number; s: number }>()
  for (const s of spots) {
    if (!s.st) continue
    if (from && railKm(pref, from, s.st) === null) continue
    if (!from && !nodeOf(pref, s.st)) continue
    const c = count.get(s.st) ?? { n: 0, s: 0 }
    c.n++
    c.s += s.s
    count.set(s.st, c)
  }
  let best: string | null = null
  let bc = { n: 0, s: 0 }
  for (const [id, c] of count)
    if (!best || c.n > bc.n || (c.n === bc.n && (c.s > bc.s || (c.s === bc.s && id < best)))) {
      best = id
      bc = c
    }
  return best
}

/** 跟 start 的區界相連的市区町村（本島）；沒有相鄰資料時當作全部相連 */
function landOf(pref: PrefData, start: string): Set<string> | null {
  if (!pref.municipalities.some((m) => m.touches?.length)) return null
  const seen = new Set([start])
  const todo = [start]
  while (todo.length) {
    const m = pref.municipality(todo.pop()!)
    for (const n of m?.touches ?? []) if (!seen.has(n)) seen.add(n), todo.push(n)
  }
  return seen
}

const airportOf = (spots: PrefSpot[]) => spots.find((s) => s.c === '機場')

function labelPoint(pref: PrefData, code: string, spots: PrefSpot[]): LatLng {
  const m = pref.municipality(code)
  if (m?.l) return { lat: m.l[1], lng: m.l[0] }
  // 區名的位置沒有：分數加權的景點重心
  const top = spots.slice(0, 8)
  const w = top.reduce((t, s) => t + s.s, 0) || 1
  return { lat: top.reduce((t, s) => t + s.lat * s.s, 0) / w, lng: top.reduce((t, s) => t + s.lng * s.s, 0) / w }
}

/**
 * 官方觀光網站的商品頁（行程、租借）或名字後面接宣傳標語的（「…　気軽に楽しめる…!」）：不當地標。
 * pipeline（sources/okinawastory.py 的 clean_name）已經整理過；這裡是舊資料的保險。有類型、Wikidata 的景點不看。
 */
export function listingLike(s: Pick<PrefSpot, 'id' | 'n' | 'c'>): boolean {
  if (s.c || /^wd-/.test(s.id)) return false
  return /ツアー|レンタル|^【/.test(s.n) || /\u3000[^\u3000]*[!！]$/.test(s.n)
}

/** 名城的景點（castle pack 的 st 有值：有蓋章地點的） */
export function stampCastleSpots(pref: PrefData): Set<string> {
  return new Set(pref.castles.filter((c) => c.s && (c.st?.length ?? 0) > 0).map((c) => c.s!))
}

/**
 * 放進地圖的地標：分數高的前 MAX_LANDMARKS 個（機場只有在這一鎮進出機場時放；跟鎮同名的島不放）。
 * 有蓋章地點的名城一定放（排在機場後面，最先擺）。
 */
function landmarksOf(name: string, spots: PrefSpot[], airport: PrefSpot | undefined, castles: ReadonlySet<string>): string[] {
  const out: PrefSpot[] = []
  const names = new Set<string>()
  if (airport) {
    out.push(airport)
    names.add(airport.n)
  }
  for (const s of spots)
    if (castles.has(s.id) && !names.has(s.n)) {
      out.push(s)
      names.add(s.n)
    }
  for (const s of spots) {
    if (out.length >= MAX_LANDMARKS) break
    if (s.c === '機場' || names.has(s.n) || listingLike(s)) continue
    if (s.c === '島' && name.startsWith(s.n.replace(/島$/, ''))) continue
    out.push(s)
    names.add(s.n)
  }
  return out.map((s) => s.id)
}

function townOf(pref: PrefData, c: Candidate, kit: Kit, main: TownStop, island: boolean, extra: TownStop[]): Town {
  const m = pref.municipality(c.code)!
  const area = bboxAreaKm2(m.bbox)
  const rail = main.kind === 'rail' || main.kind === 'monorail'
  const airport = main.kind === 'airport' ? pref.spotById(main.spotId!) : extra.find((s) => s.kind === 'airport') ? airportOf(c.spots) : undefined
  return {
    id: c.code,
    pref: pref.pref,
    name: { ja: m.n, kana: m.h, romaji: placeRomaji(m.n, m.h) || undefined, zh: m.n },
    station: { id: main.stationId ?? main.spotId ?? `bus:${c.code}`, name: main.name, kind: main.kind },
    center: { lat: main.lat, lng: main.lng },
    mapId: `town:${c.code}`,
    kit,
    score: Math.round(c.score * 10) / 10,
    island,
    // 政令指定都市的區、或有鐵路且不大的市：街上（直角街道、町家成排）
    urban: rail && (m.c ? area < 60 : area < 100),
    bbox: m.bbox,
    stops: [main, ...extra],
    spots: landmarksOf(m.n, c.spots, airport, stampCastleSpots(pref)),
  }
}

/** 一縣的鎮（照分數；起點在第一個） */
export function selectTowns(pref: PrefData, rule: TownRule = TOWN_RULES[pref.pref] ?? defaultRule(pref)): Town[] {
  const kit = kitOf(pref.pref)
  const all = candidates(pref)
  const start = all.find((c) => c.code === rule.start)
  if (!start) return []
  const land = landOf(pref, rule.start)
  const out: Town[] = []

  // 起點
  let startStation = rule.startStation && nodeOf(pref, rule.startStation) ? rule.startStation : commonStation(pref, start.spots, null)
  if (rule.transit === 'rail' && !startStation) return []
  const startMain = startStation ? stopOfStation(pref, startStation, 'main') : busStop(pref, start)
  const extra: TownStop[] = []
  if (rule.startStop === 'airport') {
    const ap = airportOf(start.spots)
    if (ap) {
      extra.push({ id: 'airport', kind: 'airport', name: ap.n, lat: ap.lat, lng: ap.lng, spotId: ap.id })
      // 機場旁邊的單軌站（1.5 km 內）
      const near = startStation ? nearestStation(pref, ap, 1.5, startStation) : null
      if (near && near !== startStation) extra.push(stopOfStation(pref, near, `st:${near}`))
    }
  }
  if (startMain.kind === 'monorail' && startStation) {
    // 分數最高的地標附近另一個單軌站（離主站 1.5 km 以上時）：例 首里城
    const far = start.spots.find((s) => s.st && s.st !== startStation && railKm(pref, startStation!, s.st) !== null && kmBetween(s, startMain) > 1.5)
    if (far?.st && !extra.some((e) => e.stationId === far.st)) extra.push(stopOfStation(pref, far.st, `st:${far.st}`))
  }
  if (rule.transit === 'bus' && startMain.kind !== 'bus') {
    // 巴士站在車站前
    extra.push({ id: 'bus', kind: 'bus', name: pref.municipality(start.code)!.n, lat: startMain.lat, lng: startMain.lng })
  }
  out.push(townOf(pref, start, kit, startMain, false, extra))

  const perCity = new Map<string, number>()
  const cityOf = (code: string) => pref.municipality(code)?.c
  const bump = (code: string) => {
    const city = cityOf(code)
    if (city) perCity.set(city, (perCity.get(city) ?? 0) + 1)
  }
  bump(start.code)
  /** 本島（跟起點相連）的鎮：鐵路的縣要有連得到起點的車站 */
  const addLand = (c: Candidate, capCity: boolean): boolean => {
    if (out.length >= rule.count || out.some((t) => t.id === c.code)) return false
    if (land && !land.has(c.code)) return false
    const city = cityOf(c.code)
    if (capCity && rule.maxPerCity && city && (perCity.get(city) ?? 0) >= rule.maxPerCity) return false
    if (rule.transit === 'rail') {
      const st = commonStation(pref, c.spots, startStation)
      if (!st) return false
      out.push(townOf(pref, c, kit, stopOfStation(pref, st, 'main'), false, []))
    } else out.push(townOf(pref, c, kit, busStop(pref, c), false, []))
    bump(c.code)
    return true
  }

  // 有名城蓋章地點的市区町村（分數高的先）
  const castleTowns = new Set([...stampCastleSpots(pref)].map((id) => pref.spotById(id)?.m).filter((m): m is string => !!m))
  for (const c of all) if (castleTowns.has(c.code)) addLand(c, false)

  // 離島
  const islands = rule.islands ?? 0
  if (islands > 0 && land) {
    for (const c of all) {
      if (out.length >= rule.count || out.filter((t) => t.island).length >= islands) break
      if (land.has(c.code)) continue
      const ap = airportOf(c.spots)
      if (!ap) continue
      out.push(townOf(pref, c, kit, { id: 'main', kind: 'airport', name: ap.n, lat: ap.lat, lng: ap.lng, spotId: ap.id }, true, []))
    }
  }

  // 其他（本島、照分數）
  for (const c of all) {
    if (out.length >= rule.count) break
    addLand(c, true)
  }
  return out
}

function defaultRule(pref: PrefData): TownRule {
  const top = candidates(pref)[0]
  return { count: 9, start: top?.code ?? '', startStop: 'main', transit: 'rail' }
}

function stopOfStation(pref: PrefData, id: string, stopId: string): TownStop {
  const n = nodeOf(pref, id)!
  return { id: stopId, kind: stationKind(pref, id), name: n.name, lat: n.lat, lng: n.lng, stationId: id }
}

function busStop(pref: PrefData, c: Candidate): TownStop {
  const p = labelPoint(pref, c.code, c.spots)
  return { id: 'main', kind: 'bus', name: pref.municipality(c.code)!.n, lat: p.lat, lng: p.lng }
}

/** p 附近 maxKm 內、連得到 from 的最近車站 */
function nearestStation(pref: PrefData, p: LatLng, maxKm: number, from: string): string | null {
  let best: string | null = null
  let bd = maxKm
  for (const st of pref.stations) {
    const d = kmBetween(p, st)
    if (d <= bd && railKm(pref, from, st.id) !== null) {
      best = st.id
      bd = d
    }
  }
  return best
}

// ---------- 交通 ----------
/** 遊戲時間往前走幾分鐘（遊戲規則：依距離；取 5 分鐘的倍數） */
export function minutesOf(legs: Leg[]): number {
  let m = 0
  for (const l of legs) {
    if (l.mode === 'rail') m += 10 + l.km * 1.2
    else if (l.mode === 'monorail') m += 5 + l.km * 2
    else if (l.mode === 'bus') m += 10 + l.km * 2
    else if (l.mode === 'plane') m += 90 + l.km / 8
    else m += 15 + l.km * 3
  }
  return Math.max(5, Math.round(m / 5) * 5)
}

function link(from: Town, fromStop: string, to: Town, toStop: string, mode: TravelMode, legs: Leg[]): Link {
  return { id: `${from.id}.${fromStop}>${to.id}.${toStop}`, from: from.id, fromStop, to: to.id, toStop, mode, legs, name: legs[legs.length - 1]!.to, minutes: minutesOf(legs) }
}

const stopOf = (t: Town, id: string) => t.stops.find((s) => s.id === id)
const busStopOf = (t: Town) => t.stops.find((s) => s.kind === 'bus')

/** 一縣之內的交通 */
function prefLinks(pref: PrefData, towns: Town[]): Link[] {
  const out: Link[] = []
  const rail = towns.filter((t) => t.station.kind === 'rail' || t.station.kind === 'monorail')
  const rule = TOWN_RULES[pref.pref]
  // 鐵路：鐵路鎮兩兩（縣的規則是巴士時，鐵路只有那覇的單軌，不跨鎮）
  if (rule?.transit !== 'bus')
    for (const a of rail)
      for (const b of rail) {
        if (a === b) continue
        const km = railKm(pref, a.station.id, b.station.id)
        if (km === null) continue
        out.push(link(a, 'main', b, 'main', 'rail', [{ mode: 'rail', km, kmKind: 'rail', to: b.station.name }]))
      }
  // 巴士：本島的鎮兩兩（直線 km）
  const bus = towns.filter((t) => !t.island && busStopOf(t))
  for (const a of bus)
    for (const b of bus) {
      if (a === b) continue
      const sa = busStopOf(a)!
      const sb = busStopOf(b)!
      out.push(link(a, sa.id, b, sb.id, 'bus', [{ mode: 'bus', km: Math.round(kmBetween(sa, sb) * 10) / 10, kmKind: 'straight', to: b.name.ja }]))
    }
  // 單軌：同一鎮的單軌站之間
  for (const t of towns) {
    const mono = t.stops.filter((s) => s.kind === 'monorail' && s.stationId)
    for (const a of mono)
      for (const b of mono) {
        if (a === b) continue
        const km = railKm(pref, a.stationId!, b.stationId!)
        if (km === null) continue
        out.push(link(t, a.id, t, b.id, 'monorail', [{ mode: 'monorail', km, kmKind: 'rail', to: b.name }]))
      }
  }
  // 飛機：起點的機場 ↔ 離島的機場
  const home = towns.find((t) => stopOf(t, 'airport'))
  if (home) {
    const ha = stopOf(home, 'airport')!
    for (const t of towns.filter((x) => x.island)) {
      const ta = stopOf(t, 'main')!
      const km = Math.round(kmBetween(ha, ta) * 10) / 10
      out.push(link(home, 'airport', t, 'main', 'plane', [{ mode: 'plane', km, kmKind: 'straight', to: ta.name }]))
      out.push(link(t, 'main', home, 'airport', 'plane', [{ mode: 'plane', km, kmKind: 'straight', to: ha.name }]))
    }
  }
  return out
}

/** 縣與縣之間（京都駅 ↔ 那覇空港，經関西国際空港） */
function crossLinks(prefs: PrefData[], towns: Map<string, Town[]>): Link[] {
  const out: Link[] = []
  for (const a of prefs) {
    const ta = towns.get(a.pref)?.[0]
    if (!ta || ta.station.kind !== 'rail') continue
    for (const b of prefs) {
      if (a === b) continue
      const tb = towns.get(b.pref)?.[0]
      const ap = tb && stopOf(tb, 'airport')
      if (!tb || !ap) continue
      const sa = stopOf(ta, 'main')!
      const kix = a.kix
      const viaKm = kix?.st ? railKm(a, ta.station.id, kix.st) : null
      if (kix && viaKm !== null) {
        const fly = Math.round(kmBetween(kix, ap) * 10) / 10
        out.push(link(ta, 'main', tb, 'airport', 'rail', [{ mode: 'rail', km: viaKm, kmKind: 'rail', to: kix.n }, { mode: 'plane', km: fly, kmKind: 'straight', to: ap.name }]))
        out.push(link(tb, 'airport', ta, 'main', 'plane', [{ mode: 'plane', km: fly, kmKind: 'straight', to: kix.n }, { mode: 'rail', km: viaKm, kmKind: 'rail', to: sa.name }]))
      } else {
        // 関西国際空港的資料沒有：直接飛（直線 km 從車站算），不寫轉乘的機場名
        const fly = Math.round(kmBetween(sa, ap) * 10) / 10
        out.push(link(ta, 'main', tb, 'airport', 'plane', [{ mode: 'plane', km: fly, kmKind: 'straight', to: ap.name }]))
        out.push(link(tb, 'airport', ta, 'main', 'plane', [{ mode: 'plane', km: fly, kmKind: 'straight', to: sa.name }]))
      }
    }
  }
  return out
}

/** 世界：每一縣的鎮、全部的交通、起點的鎮（第一縣的起點） */
export function buildWorld(prefs: PrefData[], rules: Record<string, TownRule> = TOWN_RULES): World {
  const towns = new Map<string, Town[]>()
  for (const p of prefs) {
    const list = selectTowns(p, rules[p.pref] ?? defaultRule(p))
    if (list.length) towns.set(p.pref, list)
  }
  const links: Link[] = []
  for (const p of prefs) if (towns.has(p.pref)) links.push(...prefLinks(p, towns.get(p.pref)!))
  links.push(...crossLinks(prefs.filter((p) => towns.has(p.pref)), towns))
  const all = [...towns.values()].flat()
  return { towns: all, links, startTown: all[0]?.id ?? '' }
}

/** 從這一鎮的這個地方出發的交通 */
export const linksFrom = (w: World, town: string, stop: string) => w.links.filter((l) => l.from === town && l.fromStop === stop)
