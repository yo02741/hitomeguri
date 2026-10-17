import type { Festival } from '../../services/bundles'
import { seedOf } from '../../services/pixelwalk/rng'

import type { CalendarDate } from '../engine/clock'
import type { Weather } from '../engine/render'
import type { Season } from '../engine/types'

import { inBbox, kmBetween, type LatLng } from './geo'
import type { Kit, PrefData, PrefFestival, Town } from './types'

/**
 * 季節、花況、祭典、天氣（規格 §8.3、§8.8）。
 * 依最近的氣象台平年值（seasons.json：京都、那覇、宮古島、石垣島…，氣象庁）：
 *   近畿：春＝梅開花（沒有梅就櫻開花前三週）起、夏 6/1、秋 9/23、冬＝紅葉日＋14 天（最早 12/1）；
 *   沖繩：春＝梅或寒緋櫻開花起、夏 5/1、秋 11/1（短）、冬 12/1（不下雪）。
 *   花況（畫面上的「開花」）：梅＝開花日起 30 天、櫻（沖繩是寒緋櫻）＝開花日到滿開後 7 天、
 *   紫陽花＝開花日起 30 天、楓（紅葉）＝紅葉日前 10 天到冬、銀杏（黃葉）＝黃葉日前 10 天到冬。
 *   平年值裡沒有的現象不畫（沖繩沒有楓、銀杏、紫陽花的資料）。季節的分界是遊戲規則，花況照資料。
 * 祭典：遊戲日期的月份在 months 裡、location 落在這一鎮的區界裡（point-in-polygon 算好的 m；舊資料沒有 m 時用外框）。
 *   不用「離鎮中心幾 km」：京都市內的區很近，會把別區的祭典算進來。沒有位置的不放。
 * 畫面不宣稱實況（只是平年值）。
 */
export type Flower = 'ume' | 'sakura' | 'ajisai' | 'kaede' | 'ichou' | 'kanhi'

export interface Climate {
  /** 氣象台的名字（京都、那覇…） */
  station: string
  normals: Record<string, string>
  source: { label: string; url: string }
}

/** 'MM-DD' → 一年的第幾天（平年，1/1 = 0） */
const DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
export const doyOf = (m: number, d: number) => DAYS[m - 1]! + d - 1
const doyStr = (s: string | undefined): number | null => {
  const m = s && /^(\d\d)-(\d\d)$/.exec(s)
  return m ? doyOf(Number(m[1]), Number(m[2])) : null
}
/** 一年的第幾天 → 'M 月 D 日'（事實台詞用） */
export function dateLabel(s: string): string {
  const m = /^(\d\d)-(\d\d)$/.exec(s)
  return m ? `${Number(m[1])} 月 ${Number(m[2])} 日` : s
}

/** 氣象台在哪：名字對到市区町村（那覇 → 那覇市、宮古島 → 宮古島市、石垣島 → 石垣市、京都 → 京都市的區） */
function stationPlace(pref: PrefData, name: string): LatLng | null {
  const stem = name.replace(/島$/, '')
  const hits = pref.municipalities.filter((m) => m.n.startsWith(stem) || m.c?.startsWith(name) || (stem.length >= 2 && m.n.startsWith(stem)))
  const pts = hits.filter((m) => m.l).map((m) => ({ lng: m.l![0], lat: m.l![1] }))
  if (!pts.length) return null
  return { lat: pts.reduce((t, p) => t + p.lat, 0) / pts.length, lng: pts.reduce((t, p) => t + p.lng, 0) / pts.length }
}

/** 這一鎮最近的氣象台（只有一個就是那一個；位置對不到的放最後） */
export function climateOf(pref: PrefData, town: Pick<Town, 'center'>): Climate | null {
  const list = pref.seasons.stations
  if (!list.length) return null
  let best = list[0]!
  let bd = Infinity
  for (const st of list) {
    const p = stationPlace(pref, st.name)
    const d = p ? kmBetween(p, town.center) : Infinity
    if (d < bd) {
      bd = d
      best = st
    }
  }
  return { station: best.name, normals: best.normals, source: { label: '気象庁（生物季節観測の平年値）', url: pref.seasons.source.url } }
}

interface Calendar {
  spring: number
  summer: number
  autumn: number
  winter: number
}

function calendarOf(kit: Kit, c: Climate | null): Calendar {
  const n = c?.normals ?? {}
  const ume = doyStr(n.ume)
  const kaika = doyStr(n.sakura_kaika)
  if (kit === 'okinawa') {
    const first = [ume, kaika].filter((x): x is number => x !== null)
    return { spring: first.length ? Math.min(...first) : doyOf(1, 15), summer: doyOf(5, 1), autumn: doyOf(11, 1), winter: doyOf(12, 1) }
  }
  const kaede = doyStr(n.kaede)
  return {
    spring: ume ?? (kaika !== null ? kaika - 21 : doyOf(3, 1)),
    summer: doyOf(6, 1),
    autumn: doyOf(9, 23),
    winter: Math.max(doyOf(12, 1), kaede !== null ? kaede + 14 : 0),
  }
}

export function seasonAt(date: CalendarDate, kit: Kit, climate: Climate | null): Season {
  const cal = calendarOf(kit, climate)
  const d = doyOf(date.m, Math.min(date.d, date.m === 2 ? 28 : 31))
  if (d >= cal.winter || d < cal.spring) return 'winter'
  if (d < cal.summer) return 'spring'
  if (d < cal.autumn) return 'summer'
  return 'autumn'
}

/** 這一天開著（紅著、黃著）的花 */
export function bloomAt(date: CalendarDate, kit: Kit, climate: Climate | null): Set<Flower> {
  const out = new Set<Flower>()
  if (!climate) return out
  const n = climate.normals
  const d = doyOf(date.m, Math.min(date.d, date.m === 2 ? 28 : 31))
  const cal = calendarOf(kit, climate)
  const within = (a: number | null, b: number | null) => a !== null && b !== null && d >= a && d <= b
  const ume = doyStr(n.ume)
  const kaika = doyStr(n.sakura_kaika)
  const mankai = doyStr(n.sakura_mankai)
  if (within(ume, ume !== null ? ume + 30 : null)) out.add('ume')
  if (within(kaika, mankai !== null ? mankai + 7 : null)) out.add(kit === 'okinawa' ? 'kanhi' : 'sakura')
  if (kit === 'okinawa') return out
  const ajisai = doyStr(n.ajisai)
  if (within(ajisai, ajisai !== null ? ajisai + 30 : null)) out.add('ajisai')
  const kaede = doyStr(n.kaede)
  if (within(kaede !== null ? kaede - 10 : null, cal.winter - 1)) out.add('kaede')
  const ichou = doyStr(n.ichou)
  if (within(ichou !== null ? ichou - 10 : null, cal.winter - 1)) out.add('ichou')
  return out
}

/** 祭典的位置在這一鎮的區界裡嗎（m 有算就照 m；沒有就用外框） */
export function festivalInTown(f: Pick<PrefFestival, 'location' | 'm'>, town: Pick<Town, 'id' | 'bbox'>): boolean {
  if (!f.location) return false
  if (f.m !== undefined) return f.m === town.id
  return inBbox(town.bbox, f.location)
}

/** 落在這一鎮的祭典（有位置的才算）；給 month 就只要那個月的 */
export function festivalsIn(pref: PrefData, town: Pick<Town, 'id' | 'bbox'>, month?: number): Festival[] {
  return pref.festivals
    .filter((f) => festivalInTown(f, town))
    .filter((f) => month === undefined || (f.months ?? []).includes(month))
    .sort((a, b) => b.views - a.views || (a.id < b.id ? -1 : 1))
}

/**
 * 天氣（遊戲規則，不宣稱實況）：日期＋鎮決定，同一天每次一樣。
 * 近畿：冬天偶爾下雪、梅雨（6 月）常下雨；沖繩：冬天偶爾下雨（天空灰一點），不下雪。
 */
export function weatherAt(date: CalendarDate, town: string, kit: Kit, season: Season): Weather {
  const h = seedOf('weather', town, date.y, date.m, date.d) % 100
  if (kit === 'okinawa') return season === 'winter' && h < 25 ? 'rain' : date.m === 5 && h < 20 ? 'rain' : 'clear'
  if (season === 'winter') return h < 15 ? 'snow' : 'clear'
  if (date.m === 6) return h < 30 ? 'rain' : 'clear'
  return h < 8 ? 'rain' : 'clear'
}
