import { minutesOf } from './towns'
import type { AbroadAccess, AbroadAirline, AbroadAirport, AbroadHall, AbroadIndex, AbroadRoute, Leg, Link, TravelMode } from './types'

/**
 * 從台灣出發（規格 §13 第 4 點，P4）：台灣的機場出發大廳、日本的機場大廳、台灣 ↔ 日本的交通、出發看板與路線規劃。
 * 資料是世界索引的 taiwan（pipeline/game_taiwan.py；国土交通省的直飛航線表：航空公司、每週班次）。
 *
 * 地圖 id：
 *   tw:<城市>   台灣的機場出發大廳（taipei、taichung、kaohsiung；遊戲裡寫「台北」不寫機場名）
 *   air:<IATA>  日本的機場大廳（只有不是哪一鎮的機場的：関西国際空港 air:KIX、東京国際空港 air:HND、函館空港 air:HKD）
 *   那覇空港、新千歳空港是那覇市、千歳市本來就有的機場大廳（不另外做）。
 * 交通的 id（world.travel 認得；跟鎮之間的 Link 一樣跑車窗、到站）：
 *   tw:<城市>>air:<IATA>         飛到那個機場的大廳（hall 是 own 或那一鎮的機場）
 *   tw:<城市>>air:<IATA>><鎮>    飛到沒有大廳的機場（成田、中部），坐電車到那一鎮（一段路線）
 *   air:<IATA>>tw:<城市>         回台灣（日本的機場大廳的國際線櫃台）
 *   air:<IATA>><鎮>              日本的機場大廳的剪票口、巴士站 → 鎮
 *   <鎮>>air:<IATA>              鎮的剪票口 → 日本的機場大廳
 * 台灣那一邊沒有座標資料（台北也不分桃園、松山）：飛機那一段 km 寫 0、畫面上不寫 km，只寫航空公司與每週班次；
 * 遊戲時間往前 ABROAD_FLIGHT_MINUTES（遊戲規則）。不寫時刻、票價。
 */

/** 台灣的城市（資料的寫法）→ 地圖 id 的後半 */
export const CITY_ID: Readonly<Record<string, string>> = { 台北: 'taipei', 台中: 'taichung', 高雄: 'kaohsiung' }
const CITY_OF_ID = new Map(Object.entries(CITY_ID).map(([k, v]) => [v, k]))
/** 國際線一段的遊戲時間（分；遊戲規則） */
export const ABROAD_FLIGHT_MINUTES = 180
/** 資料的出處（畫面上的小牌子） */
export const ABROAD_SOURCE_LABEL = '国土交通省'

export const twMap = (city: string) => `tw:${CITY_ID[city] ?? city}`
export const airMap = (iata: string) => `air:${iata}`
export const isTwMap = (id: string | null | undefined) => !!id && id.startsWith('tw:')
export const isAirMap = (id: string | null | undefined) => !!id && id.startsWith('air:')
/** 台灣、日本的機場大廳（不在任何鎮上） */
export const isAbroadMap = (id: string | null | undefined) => isTwMap(id) || isAirMap(id)
/** tw:taipei → 台北 */
export const cityOfMap = (id: string) => (isTwMap(id) ? (CITY_OF_ID.get(id.slice(3)) ?? null) : null)

// ---------- 形狀檢查（世界索引的 taiwan） ----------
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const MODES = new Set<string>(['rail', 'monorail', 'bus', 'plane', 'ferry'])

function legOf(v: unknown): Leg | null {
  if (!isObj(v) || !MODES.has(v.mode as string) || !isNum(v.km) || (v.kmKind !== 'rail' && v.kmKind !== 'straight') || typeof v.to !== 'string') return null
  return { mode: v.mode as TravelMode, km: v.km, kmKind: v.kmKind, to: v.to, ...(v.shinkansen === true ? { shinkansen: true } : {}) }
}
function airlineOf(v: unknown): AbroadAirline | null {
  if (!isObj(v) || !isStr(v.name) || !isNum(v.weekly)) return null
  return { name: v.name, weekly: v.weekly, ...(isStr(v.code) ? { code: v.code } : {}), ...(isStr(v.zh) ? { zh: v.zh } : {}) }
}
function hallOf(v: unknown): AbroadHall {
  if (v === 'own') return 'own'
  if (isObj(v) && isStr(v.town) && isStr(v.stop)) return { town: v.town, stop: v.stop }
  return null
}

/** 世界索引的 taiwan → AbroadIndex（壞掉的機場、航線丟掉；沒有航線回 null） */
export function parseAbroad(raw: unknown): AbroadIndex | null {
  if (!isObj(raw) || !Array.isArray(raw.airports) || !Array.isArray(raw.routes)) return null
  const airports: AbroadAirport[] = []
  for (const a of raw.airports) {
    if (!isObj(a) || !isStr(a.id) || !isStr(a.iata) || !isStr(a.name) || !isStr(a.pref)) continue
    const access: AbroadAccess[] = []
    for (const x of Array.isArray(a.access) ? a.access : []) {
      if (!isObj(x) || !isStr(x.town) || !Array.isArray(x.legs)) continue
      const legs = x.legs.map(legOf)
      if (legs.some((l) => !l)) continue
      access.push({ town: x.town, legs: legs as Leg[], km: isNum(x.km) ? x.km : (legs as Leg[]).reduce((t, l) => t + l.km, 0) })
    }
    airports.push({ id: a.id, iata: a.iata, name: a.name, short: isStr(a.short) ? a.short : a.name, pref: a.pref, hall: hallOf(a.hall), access })
  }
  const known = new Set(airports.map((a) => a.id))
  const routes: AbroadRoute[] = []
  for (const r of raw.routes) {
    if (!isObj(r) || !isStr(r.city) || !CITY_ID[r.city] || !isStr(r.airport) || !known.has(r.airport) || !isNum(r.weekly)) continue
    const airlines = (Array.isArray(r.airlines) ? r.airlines : []).map(airlineOf).filter((x): x is AbroadAirline => !!x)
    routes.push({ city: r.city, airport: r.airport, weekly: r.weekly, airlines })
  }
  if (!routes.length) return null
  const src = isObj(raw.source) ? raw.source : {}
  const cities = (Array.isArray(raw.cities) ? raw.cities : []).filter((c): c is string => isStr(c) && !!CITY_ID[c] && routes.some((r) => r.city === c))
  return {
    source: { url: isStr(src.url) ? src.url : '', ...(isStr(src.fetched_at) ? { fetched_at: src.fetched_at } : {}), ...(isStr(src.season) ? { season: src.season } : {}) },
    cities: cities.length ? cities : Object.keys(CITY_ID).filter((c) => routes.some((r) => r.city === c)),
    airports,
    routes,
  }
}

// ---------- 查詢 ----------
export const airportById = (ab: AbroadIndex, id: string) => ab.airports.find((a) => a.id === id) ?? null
export const airportByIata = (ab: AbroadIndex, iata: string) => ab.airports.find((a) => a.iata === iata) ?? null
/** air:KIX → 関西国際空港（the own hall），或那一鎮的機場（那覇空港：air:OKA 也認得） */
export const airportOfMap = (ab: AbroadIndex, id: string) => (isAirMap(id) ? airportByIata(ab, id.slice(4)) : null)
export const routesFrom = (ab: AbroadIndex, city: string) => ab.routes.filter((r) => r.city === city)
export const routesTo = (ab: AbroadIndex, airport: string) => ab.routes.filter((r) => r.airport === airport)

/**
 * 這個機場在遊戲裡怎麼用：hall＝降在機場大廳（那一鎮的、或遊戲另外做的）；route＝沒有大廳，飛到之後直接坐電車到鎮上；
 * null＝接不到遊戲的鎮（出發看板上不列：石垣空港、仙台空港…）
 */
export function usageOf(a: AbroadAirport): 'hall' | 'route' | null {
  if (a.hall && typeof a.hall === 'object') return 'hall'
  if (a.hall === 'own') return a.access.length ? 'hall' : null
  return a.access.length ? 'route' : null
}

/** 遊戲另外做大廳的機場（own、接得到鎮的） */
export const ownHalls = (ab: AbroadIndex) => ab.airports.filter((a) => a.hall === 'own' && a.access.length > 0)

/** 降落的地方：Link 的 to、toStop */
function landingOf(a: AbroadAirport): { to: string; toStop: string } | null {
  if (a.hall && typeof a.hall === 'object') return { to: a.hall.town, toStop: a.hall.stop }
  if (a.hall === 'own' && a.access.length) return { to: airMap(a.iata), toStop: 'hall' }
  return null
}
/** 出發的地方（回台灣）：Link 的 from、fromStop */
function departOf(a: AbroadAirport): { from: string; fromStop: string } | null {
  const l = landingOf(a)
  return l ? { from: l.to, fromStop: l.toStop } : null
}

const flightLeg = (to: string): Leg => ({ mode: 'plane', km: 0, kmKind: 'straight', to })

/** 交通的 id（看 abroad.ts 開頭的說明） */
export const ids = {
  toHall: (city: string, iata: string) => `${twMap(city)}>${airMap(iata)}`,
  route: (city: string, iata: string, town: string) => `${twMap(city)}>${airMap(iata)}>${town}`,
  home: (iata: string, city: string) => `${airMap(iata)}>${twMap(city)}`,
  gate: (iata: string, town: string) => `${airMap(iata)}>${town}`,
  toAirport: (town: string, iata: string) => `${town}>${airMap(iata)}`,
}

/** 交通的 id → Link（資料裡沒有這一條、id 不認得：null） */
export function abroadLink(ab: AbroadIndex, id: string): Link | null {
  const seg = id.split('>')
  if (seg.length < 2 || seg.length > 3) return null
  const [a, b, c] = seg as [string, string, string | undefined]
  // 台灣 → 日本
  if (isTwMap(a) && isAirMap(b)) {
    const city = cityOfMap(a)
    const ap = airportOfMap(ab, b)
    if (!city || !ap || !routesFrom(ab, city).some((r) => r.airport === ap.id)) return null
    if (c === undefined) {
      const land = landingOf(ap)
      if (!land) return null
      return { id, from: a, fromStop: 'hall', ...land, mode: 'plane', legs: [flightLeg(ap.name)], name: ap.name, minutes: ABROAD_FLIGHT_MINUTES }
    }
    // 沒有大廳的機場：飛機＋電車（一段路線）
    if (usageOf(ap) !== 'route') return null
    const acc = ap.access.find((x) => x.town === c)
    if (!acc?.legs.length) return null
    const legs = [flightLeg(ap.name), ...acc.legs.map((l) => ({ ...l }))]
    return { id, from: a, fromStop: 'hall', to: c, toStop: 'main', mode: 'plane', legs, name: legs[legs.length - 1]!.to, minutes: ABROAD_FLIGHT_MINUTES + minutesOf(acc.legs) }
  }
  if (c !== undefined) return null
  // 日本 → 台灣
  if (isAirMap(a) && isTwMap(b)) {
    const ap = airportOfMap(ab, a)
    const city = cityOfMap(b)
    const dep = ap ? departOf(ap) : null
    if (!ap || !city || !dep || !routesTo(ab, ap.id).some((r) => r.city === city)) return null
    return { id, ...dep, to: b, toStop: 'hall', mode: 'plane', legs: [flightLeg(city)], name: city, minutes: ABROAD_FLIGHT_MINUTES }
  }
  // 日本的機場大廳 → 鎮
  if (isAirMap(a)) {
    const ap = airportOfMap(ab, a)
    if (!ap || ap.hall !== 'own') return null
    const acc = ap.access.find((x) => x.town === b)
    if (!acc?.legs.length) return null
    const legs = acc.legs.map((l) => ({ ...l }))
    return { id, from: a, fromStop: 'hall', to: b, toStop: 'main', mode: legs[0]!.mode, legs, name: legs[legs.length - 1]!.to, minutes: minutesOf(legs) }
  }
  // 鎮 → 日本的機場大廳（只有一段的：鐵路或巴士）
  if (isAirMap(b)) {
    const ap = airportOfMap(ab, b)
    if (!ap || ap.hall !== 'own') return null
    const acc = ap.access.find((x) => x.town === a)
    if (acc?.legs.length !== 1) return null
    const leg: Leg = { ...acc.legs[0]!, to: ap.name }
    return { id, from: a, fromStop: 'main', to: b, toStop: 'hall', mode: leg.mode, legs: [leg], name: ap.name, minutes: minutesOf([leg]) }
  }
  return null
}

// ---------- 出發看板、路線規劃 ----------
export interface BoardRow {
  route: AbroadRoute
  airport: AbroadAirport
  /** 選了之後的交通 */
  link: Link
  /** 沒有大廳的機場：飛到之後坐電車去的那一鎮 */
  town?: string
}

/**
 * 出發看板（這個城市有直飛、遊戲裡去得了的日本機場；規格 §13 第 4 點「只列遊戲裡有的縣的機場」）：每週班次多的先。
 * 遊戲的縣裡的機場（那覇、新千歳、関西、羽田、函館）降在大廳；不在遊戲的縣裡、但坐電車接得到遊戲的鎮的（成田、中部）
 * 也列（例外：台中只有直飛那覇、成田、中部），飛到之後坐電車到最近的「縣的入口」（entries：每縣的起點的鎮，例：東京駅、
 * 京都駅），沒有的話到最近的鎮。接不到遊戲的鎮的（石垣、仙台、福岡…）不列。
 */
export function boardOf(ab: AbroadIndex, city: string, entries: ReadonlySet<string>): BoardRow[] {
  const out: BoardRow[] = []
  for (const r of routesFrom(ab, city)) {
    const a = airportById(ab, r.airport)
    if (!a) continue
    const use = usageOf(a)
    let link: Link | null = null
    let town: string | undefined
    if (use === 'hall') link = abroadLink(ab, ids.toHall(city, a.iata))
    else if (use === 'route') {
      const acc = a.access.find((x) => entries.has(x.town)) ?? a.access[0]!
      link = abroadLink(ab, ids.route(city, a.iata, acc.town))
      town = acc.town
    }
    if (link) out.push({ route: r, airport: a, link, ...(town ? { town } : {}) })
  }
  return out.sort((x, y) => y.route.weekly - x.route.weekly || (x.airport.id < y.airport.id ? -1 : 1))
}

export interface PlanRoute {
  route: AbroadRoute
  airport: AbroadAirport
  /** 飛到之後的那幾段（空的＝就降在那一鎮的機場） */
  legs: Leg[]
  /** 日本這一邊的距離（飛機那一段沒有 km） */
  km: number
  /** 選了之後坐的交通：有大廳的機場是「飛到大廳」（之後從大廳的剪票口、或那一鎮的車站自己坐）；沒有大廳的是一段路線 */
  link: Link
  /** 有大廳的機場：要記下「想去的地方」 */
  plan: boolean
}

/**
 * 目的地優先（使用者的例子：台中想去金澤 → 台中只有直飛那覇、成田、中部，建議中部＋電車）：
 * 從這個城市直飛、而且飛到之後坐電車或巴士接得到這一鎮的機場，日本這一邊的距離短的在前（一樣的話每週班次多的先）。
 * 台灣那一邊沒有座標（台北也不分桃園、松山），所以飛機那一段不算進距離。
 */
export function planTo(ab: AbroadIndex, city: string, town: string): PlanRoute[] {
  const out: PlanRoute[] = []
  for (const r of routesFrom(ab, city)) {
    const a = airportById(ab, r.airport)
    const acc = a?.access.find((x) => x.town === town)
    if (!a || !acc) continue
    const use = usageOf(a)
    const link = use === 'hall' ? abroadLink(ab, ids.toHall(city, a.iata)) : use === 'route' ? abroadLink(ab, ids.route(city, a.iata, town)) : null
    if (!link) continue
    out.push({ route: r, airport: a, legs: acc.legs.map((l) => ({ ...l })), km: acc.km, link, plan: use === 'hall' && acc.legs.length > 0 })
  }
  return out.sort((x, y) => x.km - y.km || y.route.weekly - x.route.weekly || (x.airport.id < y.airport.id ? -1 : 1))
}

/**
 * 日本的機場大廳的剪票口、巴士站（own 的機場）：同一縣的鎮＋別的縣的入口（entries）＋想去的地方（plan）。近的在前。
 */
export function gateAccess(ab: AbroadIndex, iata: string, prefOf: (town: string) => string | null, entries: ReadonlySet<string>, plan?: string | null): AbroadAccess[] {
  const a = airportByIata(ab, iata)
  if (!a || a.hall !== 'own') return []
  return a.access.filter((x) => x.legs.length > 0 && (x.town === plan || entries.has(x.town) || prefOf(x.town) === a.pref))
}

/** 鎮的剪票口 → 日本的機場大廳（gateAccess 的反方向：同一縣的鎮與別的縣的入口；一段的才有） */
export function airportsFromTown(ab: AbroadIndex, town: string, prefOf: (town: string) => string | null, entries: ReadonlySet<string>): Link[] {
  const out: Link[] = []
  for (const a of ownHalls(ab)) {
    const acc = a.access.find((x) => x.town === town)
    if (!acc || acc.legs.length !== 1 || (!entries.has(town) && prefOf(town) !== a.pref)) continue
    const l = abroadLink(ab, ids.toAirport(town, a.iata))
    if (l) out.push(l)
  }
  return out
}

/** 回台灣：這個機場有直飛的城市（城市的順序） */
export function homeLinks(ab: AbroadIndex, airport: AbroadAirport): { route: AbroadRoute; link: Link }[] {
  const out: { route: AbroadRoute; link: Link }[] = []
  for (const city of ab.cities) {
    const r = routesTo(ab, airport.id).find((x) => x.city === city)
    const l = r ? abroadLink(ab, ids.home(airport.iata, city)) : null
    if (r && l) out.push({ route: r, link: l })
  }
  return out
}

/** 那一鎮的機場（那覇空港、新千歳空港）：鎮的碼 → 機場 */
export const inTownAirport = (ab: AbroadIndex, town: string) => ab.airports.find((a) => !!a.hall && typeof a.hall === 'object' && a.hall.town === town) ?? null
