import { buildGraph, type Graph, type Reach, round1, search } from '../../services/daytrip'

import { bboxAreaKm2, kmBetween, type LatLng } from './geo'
import { placeRomaji } from './romaji'
import type { AtlasPref, Kit, Leg, Link, PrefData, PrefSpot, Town, TownStop, TravelMode, World, WorldIndex, WorldIndexLink, WorldIndexTown } from './types'

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
 *
 * P3（規格 §12）：奈良、大阪、兵庫、東京、北海道。名城的鎮最多 4 個（maxCastles；北海道 1 個）；代表站跟已經選到的鎮
 * 一樣的不選；北海道從新千歳空港（千歳市）進來、一定有札幌（include）、鎮要分散（minKm、cluster：資料沒有振興局，
 * 用距離）、有連得到起點的車站就坐電車、沒有就坐巴士（transit 'mixed'；巴士接到最近的鐵路鎮）。
 * 選鎮在 pipeline（pipeline/game_world.py，同一個算法的移植）先做好放進世界索引；有世界索引時照它建鎮（pinned），
 * 沒有（測試、舊的 bundles）照這裡的規則選。縣與縣之間的交通也在世界索引裡（indexLinks）。
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
  /** 鎮之間坐什麼（mixed：有連得到起點的車站坐電車，沒有坐巴士） */
  transit: 'rail' | 'bus' | 'mixed'
  /** 有名城蓋章地點的鎮最多幾個（不寫＝不限） */
  maxCastles?: number
  /** 起點之後一定放的鎮 */
  include?: string[]
  /** 鎮與鎮（代表點）至少隔幾 km（起點與 include 不算） */
  minKm?: number
  /** [半徑 km, 最多幾鎮]：新的鎮的半徑內（含自己）最多幾鎮（起點與 include 不算） */
  cluster?: [number, number]
  /**
   * 名城的鎮：景點都沒有最近車站（1.5 km 內）時，市区町村代表點這麼多 km 內、連得到起點的車站當代表站
   * （高取城在山上，最近的車站 3.7 km）。京都、沖繩不設（已經上線的鎮不變）
   */
  castleStationKm?: number
}

/** pipeline/game_world.py 的 RULES（兩邊要一樣） */
export const TOWN_RULES: Record<string, TownRule> = {
  kyoto: { count: 9, start: '261068', startStation: 'node-267316272', startStop: 'main', transit: 'rail' },
  okinawa: { count: 9, start: '472018', startStop: 'airport', islands: 1, transit: 'bus' },
  // 奈良市（近鉄奈良）
  nara: { count: 9, start: '292010', startStation: 'node-4452353501', startStop: 'main', transit: 'rail', maxCastles: 4, castleStationKm: 2 },
  // 大阪市北区（大阪駅）
  osaka: { count: 9, start: '271276', startStation: 'node-346685291', startStop: 'main', transit: 'rail', maxCastles: 4, castleStationKm: 2 },
  // 神戸市中央区（JR 三ノ宮）
  hyogo: { count: 9, start: '281107', startStation: 'node-3999683422', startStop: 'main', transit: 'rail', maxCastles: 4, castleStationKm: 2 },
  // 千代田区（東京駅）
  tokyo: { count: 9, start: '131016', startStation: 'node-11329319854', startStop: 'main', transit: 'rail', maxCastles: 4, castleStationKm: 2 },
  // 千歳市（新千歳空港）＋札幌市中央区；隔 30 km 以上、半徑 120 km 內最多 3 鎮、札幌一區、名城一鎮
  hokkaido: { count: 9, start: '012246', startStop: 'airport', transit: 'mixed', include: ['011011'], minKm: 30, cluster: [120, 3], maxPerCity: 1, maxCastles: 1 },
}

/** 縣 → 地方 kit（沒寫的用近畿：奈良、大阪、兵庫跟京都同一套） */
export const KIT_OF: Record<string, Kit> = { okinawa: 'okinawa', tokyo: 'kanto', hokkaido: 'hokkaido' }
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
    // 政令指定都市的區、或有鐵路且不大的市：街上（直角街道、町家成排）。
    // P3：町、村不算街上（明日香村）；區的上限 60 → 100 km²（神戸市中央区、東灘区的外框含人工島）。京都、沖繩的鎮都不受影響（快照測試鎖住）
    urban: rail && !/[町村]$/.test(m.n) && area < 100,
    bbox: m.bbox,
    stops: [main, ...extra],
    spots: landmarksOf(m.n, c.spots, airport, stampCastleSpots(pref)),
  }
}

/** 一縣的鎮（照分數；起點在第一個）。pinned：世界索引選好的鎮（照它的順序與代表站建鎮，不再選） */
export function selectTowns(pref: PrefData, rule: TownRule = TOWN_RULES[pref.pref] ?? defaultRule(pref), pinned?: readonly WorldIndexTown[] | null): Town[] {
  const kit = kitOf(pref.pref)
  const all = candidates(pref)
  const startCode = pinned?.length ? pinned[0]!.id : rule.start
  const start = all.find((c) => c.code === startCode)
  if (!start) return []
  const land = landOf(pref, startCode)
  const out: Town[] = []

  // 起點
  let startStation: string | null
  if (pinned?.length) {
    const st = pinned[0]!.station
    startStation = (st.kind === 'rail' || st.kind === 'monorail') && nodeOf(pref, st.id) ? st.id : null
  } else startStation = rule.startStation && nodeOf(pref, rule.startStation) ? rule.startStation : commonStation(pref, start.spots, null)
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

  if (pinned?.length) {
    for (const p of pinned.slice(1)) {
      const c = all.find((x) => x.code === p.id)
      if (!c || out.some((t) => t.id === c.code)) continue
      const st = p.station
      if (p.island) {
        const ap = c.spots.find((s) => s.id === st.id) ?? airportOf(c.spots)
        if (ap) out.push(townOf(pref, c, kit, { id: 'main', kind: 'airport', name: ap.n, lat: ap.lat, lng: ap.lng, spotId: ap.id }, true, []))
      } else if ((st.kind === 'rail' || st.kind === 'monorail') && nodeOf(pref, st.id)) out.push(townOf(pref, c, kit, stopOfStation(pref, st.id, 'main'), false, []))
      else if (st.kind === 'bus') out.push(townOf(pref, c, kit, busStop(pref, c), false, []))
    }
    if (rule.transit === 'mixed') hubStops(pref, out)
    return out
  }

  const perCity = new Map<string, number>()
  const cityOf = (code: string) => pref.municipality(code)?.c
  const bump = (code: string) => {
    const city = cityOf(code)
    if (city) perCity.set(city, (perCity.get(city) ?? 0) + 1)
  }
  bump(start.code)
  /** 分散的時候不算的鎮（起點、include） */
  const fixed = new Set([rule.start, ...(rule.include ?? [])])
  const farEnough = (main: TownStop) => {
    if (!rule.minKm && !rule.cluster) return true
    const d = out.map((t) => kmBetween(main, t.stops[0]!))
    if (rule.minKm && d.some((x) => x < rule.minKm!)) return false
    if (rule.cluster && d.filter((x) => x <= rule.cluster![0]).length + 1 > rule.cluster[1]) return false
    return true
  }
  /** 本島（跟起點相連）的鎮：鐵路的縣要有連得到起點的車站 */
  const addLand = (c: Candidate, capCity: boolean, castle = false): boolean => {
    if (out.length >= rule.count || out.some((t) => t.id === c.code)) return false
    if (land && !land.has(c.code)) return false
    const city = cityOf(c.code)
    if (capCity && rule.maxPerCity && city && (perCity.get(city) ?? 0) >= rule.maxPerCity) return false
    let main: TownStop
    if (rule.transit === 'rail' || rule.transit === 'mixed') {
      let st = commonStation(pref, c.spots, startStation)
      if (!st && castle && rule.castleStationKm && startStation) st = nearestStation(pref, labelPoint(pref, c.code, c.spots), rule.castleStationKm, startStation)
      if (st) main = stopOfStation(pref, st, 'main')
      else if (rule.transit === 'mixed') main = busStop(pref, c)
      else return false
    } else main = busStop(pref, c)
    // 代表站跟已經選到的鎮一樣的不選（大阪的天王寺区、阿倍野区）
    if (main.stationId && out.some((t) => t.stops[0]!.stationId === main.stationId)) return false
    if (!fixed.has(c.code) && !farEnough(main)) return false
    out.push(townOf(pref, c, kit, main, false, []))
    bump(c.code)
    return true
  }

  // 起點之後一定放的鎮
  for (const code of rule.include ?? []) {
    const c = all.find((x) => x.code === code)
    if (c) addLand(c, false)
  }

  // 有名城蓋章地點的市区町村（分數高的先；最多 maxCastles 個）
  const castleTowns = new Set([...stampCastleSpots(pref)].map((id) => pref.spotById(id)?.m).filter((m): m is string => !!m))
  let castles = 0
  for (const c of all) {
    if (!castleTowns.has(c.code)) continue
    if (rule.maxCastles !== undefined && castles >= rule.maxCastles) break
    if (addLand(c, false, true)) castles++
  }

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
  if (rule.transit === 'mixed') hubStops(pref, out)
  return out
}

/** 巴士的鎮接到哪一個鐵路的鎮（最近的；transit 'mixed'） */
function hubOf(towns: readonly Town[], t: Town): Town | null {
  let best: Town | null = null
  let bd = Infinity
  for (const x of towns) {
    if (x === t || x.station.kind === 'bus' || x.station.kind === 'airport') continue
    const d = kmBetween(t.stops[0]!, x.stops[0]!)
    if (d < bd || (d === bd && best && x.id < best.id)) {
      best = x
      bd = d
    }
  }
  return best
}

/** mixed：巴士的鎮接到的鐵路鎮，車站前加一個巴士站 */
function hubStops(pref: PrefData, towns: Town[]) {
  for (const t of towns) {
    if (t.station.kind !== 'bus') continue
    const hub = hubOf(towns, t)
    if (!hub || hub.stops.some((s) => s.kind === 'bus')) continue
    const main = hub.stops[0]!
    hub.stops.push({ id: 'bus', kind: 'bus', name: pref.municipality(hub.id)?.n ?? hub.name.ja, lat: main.lat, lng: main.lng })
  }
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
/**
 * 遊戲時間往前走幾分鐘（遊戲規則：依距離；取 5 分鐘的倍數）。
 * 一般的電車約時速 50 km；新幹線的那一段（leg.shinkansen：京都 ↔ 東京）快得多（473 km 約 2 小時 20 分）。
 */
export function minutesOf(legs: Leg[]): number {
  let m = 0
  for (const l of legs) {
    if (l.mode === 'rail') m += l.shinkansen ? 10 + l.km * 0.28 : 10 + l.km * 1.2
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
  // 巴士：本島的鎮兩兩（直線 km）；mixed（北海道）只有巴士的鎮 ↔ 接到的鐵路鎮
  const bus = towns.filter((t) => !t.island && busStopOf(t))
  const busLink = (a: Town, b: Town) => {
    const sa = busStopOf(a)!
    const sb = busStopOf(b)!
    out.push(link(a, sa.id, b, sb.id, 'bus', [{ mode: 'bus', km: Math.round(kmBetween(sa, sb) * 10) / 10, kmKind: 'straight', to: b.name.ja }]))
  }
  if (rule?.transit === 'mixed') {
    for (const t of bus) {
      if (t.station.kind !== 'bus') continue
      const hub = hubOf(towns, t)
      if (!hub || !busStopOf(hub)) continue
      busLink(t, hub)
      busLink(hub, t)
    }
  } else
    for (const a of bus)
      for (const b of bus) {
        if (a === b) continue
        busLink(a, b)
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

/** 沒有世界索引時的縣與縣之間（京都 ↔ 那覇空港）：讀進來的縣的鎮（每縣第一個是起點） */
export function crossLinksOf(prefs: PrefData[], towns: readonly Town[]): Link[] {
  const by = new Map<string, Town[]>()
  for (const t of towns) by.set(t.pref, [...(by.get(t.pref) ?? []), t])
  return crossLinks(prefs.filter((p) => by.has(p.pref)), by)
}

/** 一縣的鎮與縣內的交通（世界索引有這一縣時照它建鎮） */
export function prefWorld(p: PrefData, rules: Record<string, TownRule> = TOWN_RULES, index?: WorldIndex | null): { towns: Town[]; links: Link[] } {
  const pinned = index?.prefs.find((x) => x.pref === p.pref)?.towns
  const towns = selectTowns(p, rules[p.pref] ?? defaultRule(p), pinned)
  return { towns, links: towns.length ? prefLinks(p, towns) : [] }
}

/** 世界索引的縣與縣之間的交通 → Link（遊戲時間照 legs 算） */
export function indexLinks(index: WorldIndex): Link[] {
  return index.links.map((l: WorldIndexLink) => {
    const { fromPref: _f, toPref: _t, ...rest } = l
    return { ...rest, legs: l.legs.map((x) => ({ ...x })), minutes: minutesOf(l.legs) }
  })
}

/** 世界索引的鎮 → 手帳、委託用的名字（還沒讀的縣也有） */
export function atlasOf(index: WorldIndex): AtlasPref[] {
  return index.prefs.map((p) => ({
    pref: p.pref,
    kit: p.kit,
    towns: p.towns.map((t) => ({
      id: t.id,
      pref: p.pref,
      name: { ja: t.name.ja, kana: t.name.kana, romaji: placeRomaji(t.name.ja, t.name.kana) || undefined, zh: t.name.ja },
      station: { id: t.station.id, name: t.station.name },
      center: { ...t.center },
      kit: p.kit,
    })),
  }))
}

/**
 * 世界：每一縣的鎮、全部的交通、起點的鎮（第一縣的起點）。
 * index（世界索引）有給時：鎮照索引建、縣與縣之間的交通用索引的（還沒讀的縣也在：剪票口一開始就列得出來），
 * links 的順序是「每一縣的縣內交通（索引的縣順序）＋縣與縣之間（索引的順序）」，之後再讀進來的縣插在它的位置
 * （world.ts 的 addPref），一鎮的目的地順序不會因為讀的先後不同而變。沒給時跟 P2 一樣（京都 ↔ 沖繩用 crossLinks）。
 */
export function buildWorld(prefs: PrefData[], rules: Record<string, TownRule> = TOWN_RULES, index?: WorldIndex | null): World {
  const towns = new Map<string, Town[]>()
  const intra = new Map<string, Link[]>()
  for (const p of prefs) {
    const w = prefWorld(p, rules, index)
    if (!w.towns.length) continue
    towns.set(p.pref, w.towns)
    intra.set(p.pref, w.links)
  }
  if (index) {
    const order = orderOf(index, [...towns.keys()])
    const all = order.flatMap((p) => towns.get(p) ?? [])
    const links = [...order.flatMap((p) => intra.get(p) ?? []), ...indexLinks(index)]
    const startTown = index.prefs.find((p) => p.pref === index.start)?.towns[0]?.id ?? all[0]?.id ?? ''
    return { towns: all, links, startTown, atlas: atlasOf(index) }
  }
  const links: Link[] = []
  for (const p of prefs) if (towns.has(p.pref)) links.push(...intra.get(p.pref)!)
  links.push(...crossLinks(prefs.filter((p) => towns.has(p.pref)), towns))
  const all = [...towns.values()].flat()
  return { towns: all, links, startTown: all[0]?.id ?? '' }
}

/** 縣的順序：世界索引的順序，索引沒有的縣接在後面 */
export function orderOf(index: WorldIndex | null | undefined, prefs: readonly string[]): string[] {
  const known = (index?.prefs ?? []).map((p) => p.pref)
  return [...known.filter((p) => prefs.includes(p)), ...prefs.filter((p) => !known.includes(p))]
}

/** 從這一鎮的這個地方出發的交通 */
export const linksFrom = (w: World, town: string, stop: string) => w.links.filter((l) => l.from === town && l.fromStop === stop)
