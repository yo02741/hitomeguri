import {
  abroadLink,
  ABROAD_SOURCE_LABEL,
  airportById,
  airportOfMap,
  airportsFromTown,
  boardOf,
  cityOfMap,
  CITY_ID,
  gateAccess,
  homeLinks,
  ids,
  inTownAirport,
  isAirMap,
  isTwMap,
  planTo,
  routesFrom,
  usageOf,
} from '../world/abroad'
import type { AbroadAirport, AbroadIndex, AbroadRoute, Leg, Link } from '../world/types'

import { prefName } from './data'
import type { GameSystems } from './install'
import type { AirlineView, BoardRowView, BoardView, FlightSource, OriginView, PlanRouteView, PlanTownView, TravelData, TravelDest } from './types'

/**
 * 從台灣出發（P4）的面板資料：台灣的出發大廳的出發看板與「想去的地方」、日本的機場大廳的國際線櫃台（回台灣）與剪票口、
 * 鎮的剪票口多出來的「機場的大廳」、那覇空港與新千歳空港的櫃台多出來的「回台灣」。都在打開面板時從世界索引的 taiwan 算
 * （world/abroad.ts），鎮的生成不變。
 * 航空公司與每週班次照国土交通省的表；台灣那一邊沒有座標（台北也不分桃園、松山），飛機那一段不寫 km。
 */
export const abroadOf = (sys: GameSystems): AbroadIndex | null => sys.data.world?.abroad ?? null

/** 每縣的入口：世界索引每縣第一個鎮（京都駅、東京駅、那覇空港…） */
function entries(sys: GameSystems): Set<string> {
  const out = new Set<string>()
  for (const p of sys.data.world?.atlas ?? []) if (p.towns[0]) out.add(p.towns[0].id)
  return out
}
const prefOfTown = (sys: GameSystems) => (town: string) => sys.data.town(town)?.pref ?? null
const airlinesOf = (r: AbroadRoute): AirlineView[] => r.airlines.map((a) => ({ name: a.name, ...(a.zh ? { zh: a.zh } : {}), weekly: a.weekly }))
const flightOf = (r: AbroadRoute): NonNullable<TravelDest['flight']> => ({ airlines: airlinesOf(r), weekly: r.weekly })

/** 航線的出處：国土交通省的表（畫面上的「出處」） */
export function flightSource(ab: AbroadIndex): FlightSource {
  return { url: ab.source.url, label: ABROAD_SOURCE_LABEL, ...(ab.source.season ? { season: ab.source.season } : {}) }
}

/**
 * 每週班次：表上有半班的（ピーチ 成田 16.5：隔週一班）。整數照寫，有小數的四捨五入寫「約」（表上的數字照舊留在資料裡）
 */
export function weeklyText(n: number): string {
  return Number.isInteger(n) ? `每週 ${n} 班` : `每週約 ${Math.round(n)} 班`
}
const areaOf = (sys: GameSystems, town: string, than?: string) => {
  const pref = sys.data.town(town)?.pref
  return pref && pref !== than ? prefName(pref).ja : undefined
}
const legView = (l: Leg) => ({ mode: l.mode, km: l.km, kmKind: l.kmKind, to: l.to })

/** 一段（鐵路或巴士）的交通 → 目的地的一列 */
function legDest(link: Link, extra: Partial<TravelDest> = {}): TravelDest {
  const leg = link.legs[link.legs.length - 1]!
  const km = Math.round(link.legs.reduce((t, l) => t + l.km, 0) * 10) / 10
  return { town: link.to, name: link.name, km, kmKind: leg.kmKind, mode: link.mode, link: link.id, ...extra }
}

/** 台灣 ↔ 日本的飛機 → 目的地的一列（不寫 km：航空公司與每週班次） */
function flightDest(link: Link, route: AbroadRoute, extra: Partial<TravelDest> = {}): TravelDest {
  return { town: link.to, name: link.name, km: 0, kmKind: 'straight', mode: 'plane', link: link.id, flight: flightOf(route), ...extra }
}

/** 出發看板（台灣的出發大廳） */
export function boardView(sys: GameSystems, place: string): BoardView | null {
  const ab = abroadOf(sys)
  const city = cityOfMap(place)
  if (!ab || !city) return null
  const ent = entries(sys)
  const rows: BoardRowView[] = boardOf(ab, city, ent).map((r) => {
    const base = { airport: r.airport.id, name: r.airport.name, prefName: prefName(r.airport.pref).ja, airlines: airlinesOf(r.route), weekly: r.route.weekly }
    if (!r.town) return { ...base, dest: flightDest(r.link, r.route) }
    const acc = r.airport.access.find((x) => x.town === r.town)!
    const then = acc.legs.map((l, i) => ({ ...legView(l), ...(i === acc.legs.length - 1 ? { area: areaOf(sys, r.town!) } : {}) }))
    return { ...base, dest: flightDest(r.link, r.route, { name: r.link.name, area: areaOf(sys, r.town) }), then }
  })
  const plan = sys.save.trip?.plan
  const prefs = sys.data.gamePrefs().map((pref) => ({
    pref,
    name: prefName(pref).ja,
    towns: sys.data.townsOf(pref).map((t): PlanTownView => ({ id: t.id, name: { ja: t.name.ja, kana: t.name.kana, zh: t.name.zh }, routes: planView(ab, city, t.id) })),
  }))
  return {
    city,
    rows,
    prefs,
    ...(plan ? { plan } : {}),
    source: flightSource(ab),
  }
}

/** 想去的地方：從這個城市到這一鎮的路線（近的在前） */
export function planView(ab: AbroadIndex, city: string, town: string): PlanRouteView[] {
  return planTo(ab, city, town).map((p) => ({
    airport: p.airport.id,
    name: p.airport.name,
    prefName: prefName(p.airport.pref).ja,
    weekly: p.route.weekly,
    airlines: airlinesOf(p.route),
    legs: p.legs.map(legView),
    km: p.km,
    dest: flightDest(p.link, p.route, p.plan ? { plan: town } : {}),
  }))
}

/** 新遊戲：選出發的城市（遊戲裡從這個城市直飛得到的日本機場；出發看板的順序：每週班次多的先） */
export function originView(ab: AbroadIndex): OriginView {
  const to = (c: string) =>
    routesFrom(ab, c)
      .map((r) => ({ r, a: airportById(ab, r.airport) }))
      .filter((x) => x.a && usageOf(x.a))
      .sort((x, y) => y.r.weekly - x.r.weekly || (x.a!.id < y.a!.id ? -1 : 1))
      .map((x) => x.a!.short)
  return { cities: ab.cities.map((c) => ({ id: CITY_ID[c] ?? c, name: c, to: to(c) })) }
}

/** 回台灣：這個機場有直飛的城市 */
function homeDests(ab: AbroadIndex, a: AbroadAirport): TravelDest[] {
  return homeLinks(ab, a).map(({ route, link }) => flightDest(link, route))
}

/**
 * 這個櫃台、剪票口多出來的目的地（打開面板時算）：
 * - 日本的機場大廳的國際線櫃台：回台灣（這個機場有直飛的城市）
 * - 日本的機場大廳的剪票口：同一縣的鎮、別的縣的入口、想去的地方
 * - 那覇空港、新千歳空港的櫃台（那一鎮的機場）：多了回台灣
 * - 鎮的剪票口：附近的機場大廳（関西国際空港、東京国際空港、函館空港）
 */
export function extraDests(sys: GameSystems, d: TravelData): TravelDest[] {
  const ab = abroadOf(sys)
  if (!ab) return []
  const x = d.abroad
  if (x && isAirMap(x.place)) {
    const a = airportOfMap(ab, x.place)
    if (!a) return []
    if (x.kind === 'intl') return homeDests(ab, a)
    if (x.kind === 'gate') {
      const plan = sys.save.trip?.plan ?? null
      return gateAccess(ab, a.iata, prefOfTown(sys), entries(sys), plan).flatMap((acc) => {
        const link = abroadLink(ab, ids.gate(a.iata, acc.town))
        return link ? [legDest(link, { area: areaOf(sys, acc.town, a.pref) })] : []
      })
    }
    return []
  }
  if (x) return []
  if (d.mode === 'plane') {
    const a = inTownAirport(ab, d.fromTown)
    return a ? homeDests(ab, a) : []
  }
  const here = sys.data.town(d.fromTown)?.pref
  // 鐵路的剪票口列全部（坐巴士的機場也列：函館駅 → 函館空港）；巴士站只列坐巴士的
  const rail = d.mode === 'rail' || d.mode === 'monorail'
  return airportsFromTown(ab, d.fromTown, prefOfTown(sys), entries(sys))
    .filter((l) => rail || l.mode === d.mode)
    .map((l) => {
      const a = airportOfMap(ab, l.to)
      const area = a && a.pref !== here ? prefName(a.pref).ja : undefined
      return legDest(l, area ? { area } : {})
    })
}

/** 「想去的地方」排在最前面（標 planned） */
export function withPlan(dests: readonly TravelDest[], plan: string | null | undefined): TravelDest[] {
  if (!plan) return [...dests]
  const hit = dests.filter((x) => x.town === plan)
  if (!hit.length) return [...dests]
  return [...hit.map((x) => ({ ...x, planned: true })), ...dests.filter((x) => x.town !== plan)]
}

/** 這個面板是台灣的出發大廳（出發看板） */
export const isBoard = (d: TravelData) => d.abroad?.kind === 'board' && isTwMap(d.abroad.place)

/** 機場所在的縣（日本的機場大廳：賣店、地方的 kit） */
export function hallPref(sys: GameSystems, mapId: string | null | undefined): string | null {
  const ab = abroadOf(sys)
  if (!ab || !mapId || !isAirMap(mapId)) return null
  return airportOfMap(ab, mapId)?.pref ?? null
}

export { airportById }
