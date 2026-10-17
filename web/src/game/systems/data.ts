import { prefectureFullName, regionOf } from '../../data/regions'
import type { CalendarDate } from '../engine/clock'

import type {
  FestivalLike,
  Kit,
  MunicipalityLike,
  PackLike,
  PrefLike,
  SeasonStationLike,
  SpecialtyLike,
  SpotLike,
  StationLike,
  TownLike,
  WorldLike,
} from './types'

/**
 * 系統用的資料索引：兩縣（之後 47 縣）的 PrefData 依 id 查；鎮、地圖 id → 鎮；季節觀測站；這一鎮今天有沒有祭典。
 * 不改資料，只讀。地圖 id 照規格 §11：town:<碼>、int:<碼>:<種類>:<n>、room、ride:<mode>。
 */
export interface PlaceName {
  ja: string
  kana?: string
  romaji?: string
  zh?: string
}

/** 兩點的球面距離（km） */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r
  const dLng = (b.lng - a.lng) * r
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** 目的地的距離（規格 §8.2）：「鐵路約 n km」「直線約 n km」；10 km 以上取整數，不到 10 km 留一位 */
export function kmText(km: number, kind: 'rail' | 'straight'): string {
  const v = km >= 10 ? Math.round(km) : Math.max(0.1, Math.round(km * 10) / 10)
  return `${kind === 'rail' ? '鐵路' : '直線'}約 ${v} km`
}

/** 'town:261068'、'int:261068:shop:0' → '261068'；其他（room、ride）null */
export function townCodeOfMap(mapId: string | null | undefined): string | null {
  if (!mapId) return null
  const m = /^(?:town|int):([^:]+)/.exec(mapId)
  return m ? m[1]! : null
}

export const kitOfPref = (pref: string): Kit => (pref === 'okinawa' ? 'okinawa' : 'kinki')

/** 縣的名字：京都府、沖縄県（regions.json） */
export function prefName(pref: string): PlaceName {
  const r = regionOf(pref)
  if (!r) return { ja: pref }
  const suffix = pref === 'hokkaido' ? '' : pref === 'tokyo' ? '都' : pref === 'kyoto' || pref === 'osaka' ? '府' : '縣'
  const zh = r.name.zh_tw + suffix
  const ja = prefectureFullName(pref)
  return { ja, kana: r.name.kana, romaji: r.name.romaji, zh: zh !== ja ? zh : undefined }
}

/** 日期 'YYYY-MM-DD'（存檔、種子） */
export const dayKey = (d: CalendarDate) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`

export function parseDayKey(s: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

/** 'MM-DD'（氣象廳的平年值）＋年 → 一年的第幾天 */
function dayOfYear(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000)
}
const mmdd = (s: string | undefined): [number, number] | null => {
  const m = s ? /^(\d{2})-(\d{2})$/.exec(s) : null
  return m ? [Number(m[1]), Number(m[2])] : null
}

/**
 * 這一天是不是花季（遊戲的規則，照氣象廳的平年值）：
 * 櫻＝開花到滿開後一週（規格 §8.3）；楓＝紅葉日的前兩週到後十天；銀杏＝黃葉日的前兩週到後一週。
 */
export function bloomOf(date: CalendarDate, normals: Readonly<Record<string, string>> | null | undefined): 'sakura' | 'momiji' | null {
  if (!normals) return null
  const t = dayOfYear(date.y, date.m, date.d)
  const at = (k: string) => {
    const v = mmdd(normals[k])
    return v ? dayOfYear(date.y, v[0], v[1]) : null
  }
  const kaika = at('sakura_kaika')
  const mankai = at('sakura_mankai')
  if (kaika !== null && t >= kaika && t <= (mankai ?? kaika + 7) + 7) return 'sakura'
  const kaede = at('kaede')
  if (kaede !== null && t >= kaede - 14 && t <= kaede + 10) return 'momiji'
  const ichou = at('ichou')
  if (ichou !== null && t >= ichou - 14 && t <= ichou + 7) return 'momiji'
  return null
}

export class DataIndex {
  readonly prefs: readonly PrefLike[]
  readonly world: WorldLike | null
  private readonly spots = new Map<string, SpotLike>()
  private readonly festivals = new Map<string, FestivalLike>()
  private readonly specialties = new Map<string, SpecialtyLike>()
  private readonly shinise = new Map<string, PackLike>()
  private readonly castles = new Map<string, PackLike>()
  private readonly stations = new Map<string, StationLike>()
  private readonly munis = new Map<string, MunicipalityLike & { pref: string }>()
  private readonly towns = new Map<string, TownLike>()
  /** 每一筆資料是哪一縣的 */
  private readonly prefOfId = new Map<string, string>()

  constructor(prefs: readonly PrefLike[] = [], world: WorldLike | null = null) {
    this.prefs = prefs
    this.world = world
    for (const p of prefs) {
      const add = <T extends { id: string }>(m: Map<string, T>, list: readonly T[] | undefined) => {
        for (const x of list ?? []) {
          m.set(x.id, x)
          this.prefOfId.set(x.id, p.pref)
        }
      }
      add(this.spots, p.spots)
      add(this.festivals, p.festivals)
      add(this.specialties, p.specialties)
      add(this.shinise, p.shinise)
      add(this.castles, p.castles)
      add(this.stations, p.stations)
      for (const m of p.municipalities ?? []) this.munis.set(m.m, { ...m, pref: p.pref })
    }
    for (const t of world?.towns ?? []) this.towns.set(t.id, t)
  }

  spot = (id: string | undefined) => (id ? this.spots.get(id) : undefined)
  festival = (id: string | undefined) => (id ? this.festivals.get(id) : undefined)
  specialty = (id: string | undefined) => (id ? this.specialties.get(id) : undefined)
  shop = (id: string | undefined) => (id ? this.shinise.get(id) : undefined)
  castle = (id: string | undefined) => (id ? this.castles.get(id) : undefined)
  station = (id: string | undefined) => (id ? this.stations.get(id) : undefined)
  municipality = (code: string | undefined) => (code ? this.munis.get(code) : undefined)
  pref = (pref: string | undefined) => this.prefs.find((p) => p.pref === pref)
  /** 這一筆資料（景點、祭典、特色、老舖、城）是哪一縣的 */
  prefOf = (id: string) => this.prefOfId.get(id)

  /** 名城的章：100 名城或續 100 名城 */
  castleOfSpot(spotId: string): PackLike | undefined {
    for (const c of this.castles.values()) if (c.s === spotId) return c
    return undefined
  }

  allTowns(): TownLike[] {
    return [...this.towns.values()]
  }

  town(code: string | null | undefined): TownLike | undefined {
    if (!code) return undefined
    const t = this.towns.get(code)
    if (t) return t
    // 沒有 world（測試、world 還沒好）：用市区町村當鎮
    const m = this.munis.get(code)
    if (!m) return undefined
    return { id: m.m, pref: m.pref, name: { ja: m.n, kana: m.h }, center: m.l ? { lng: m.l[0]!, lat: m.l[1]! } : undefined, kit: kitOfPref(m.pref) }
  }

  townOfMap(mapId: string | null | undefined): TownLike | undefined {
    return this.town(townCodeOfMap(mapId))
  }

  kitOfTown(t: TownLike | undefined): Kit {
    return t?.kit ?? kitOfPref(t?.pref ?? '')
  }

  /** 鎮的中心：world 給的，沒有就用市区町村名的位置 */
  centerOf(t: TownLike): { lat: number; lng: number } | null {
    if (t.center) return t.center
    const m = this.munis.get(t.id)
    return m?.l ? { lng: m.l[0]!, lat: m.l[1]! } : null
  }

  /** 這一鎮的季節用哪一個觀測站：離島用那個島的，其他用縣裡第一個（京都、那覇） */
  seasonStation(t: TownLike | undefined): SeasonStationLike | null {
    const p = this.pref(t?.pref)
    const list = p?.seasons?.stations ?? []
    if (!list.length) return null
    const name = t ? (this.munis.get(t.id)?.n ?? t.name.ja) : ''
    const island = [
      ['宮古', '宮古島'],
      ['石垣', '石垣島'],
      ['竹富', '石垣島'],
      ['与那国', '石垣島'],
      ['大東', '南大東島'],
    ] as const
    for (const [k, st] of island) if (name.includes(k)) return list.find((s) => s.name === st) ?? list[0]!
    return list[0]!
  }

  /** 季節資料的出處（氣象廳） */
  seasonSource(t: TownLike | undefined): string | null {
    return this.pref(t?.pref)?.seasons?.source.url ?? null
  }

  /**
   * 今天在這一鎮的祭典（規格 §8.3）：月份在祭典的 months 裡、有位置、點在區界內
   * （world 算好的 m；舊資料沒有 m 時用外框）。沒有月份、沒有位置的不算。world 的 festivalsIn 同一條規則。
   */
  festivalsAt(t: TownLike | undefined, date: CalendarDate): FestivalLike[] {
    if (!t) return []
    const p = this.pref(t.pref)
    const muni = this.munis.get(t.id)
    const out: FestivalLike[] = []
    for (const f of p?.festivals ?? []) {
      if (!f.location || !f.months?.includes(date.m)) continue
      if (f.m !== undefined) {
        if (f.m === t.id) out.push(f)
        continue
      }
      const { lat, lng } = f.location
      const b = muni?.bbox
      if (!!b && b.length === 4 && lng >= b[0]! && lng <= b[2]! && lat >= b[1]! && lat <= b[3]!) out.push(f)
    }
    return out
  }

  /** 一鎮的景點（分數高的在前） */
  spotsOfTown(code: string): SpotLike[] {
    const t = this.town(code)
    const p = this.pref(t?.pref)
    return (p?.spots ?? []).filter((s) => s.m === code).sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1))
  }
}

/** 景點的名字（日文、假名、羅馬字、中文） */
export function spotName(s: SpotLike): PlaceName {
  const zh = s.z ?? s.name?.zh_tw
  return { ja: s.name?.ja ?? s.n, kana: s.h ?? s.name?.kana, romaji: s.r ?? s.name?.romaji, zh: zh && zh !== (s.name?.ja ?? s.n) ? zh : undefined }
}

/** 資料的名字（祭典、特色）→ PlaceName（中文跟日文一樣時不寫） */
export function nameOf(n: { ja: string; kana?: string; romaji?: string; zh_tw?: string }): PlaceName {
  return { ja: n.ja, kana: n.kana, romaji: n.romaji, zh: n.zh_tw && n.zh_tw !== n.ja ? n.zh_tw : undefined }
}
