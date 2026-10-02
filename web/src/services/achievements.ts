import {
  ACHIEVEMENTS,
  type AchvDef,
  type AchvDep,
  type AchvRule,
  type Designation,
  ruleNeed,
} from '../data/achievements'
import { packOfId } from '../data/packs'
import { areaPrefs, regionOf, regions } from '../data/regions'
import type { Mark } from '../stores/marks'
import type { AchvData } from './bundles'
import { seasonOfMonth } from './cardVariants'
import { dayCount, type Trip } from './trip'

// 成就的判斷與達成日（DESIGN.md §7.25）。純函式：不用 Vue、Pinia，stores/achievements.ts 包成 computed。
// 成就是「現在的紀錄」的函數：取消去過就拿掉，標回去就回來。
// 達成日是旅行時的日期（去過的日期、行程結束日），不是 app 發現的那天；沒有日期的造訪用上下界推算，
// 推不出確定的那天就不寫。

/** 達成日的上下界：lo=null 可能更早（−∞），hi=null 不知道（+∞） */
export interface Bound {
  lo: string | null
  hi: string | null
}

const UNKNOWN: Bound = { lo: null, hi: null }

/** 一組單位裡最早那個的上下界 */
export function minBound(bs: Bound[]): Bound {
  if (!bs.length) return UNKNOWN
  let lo: string | null = bs[0]!.lo
  let hi: string | null = null
  for (const b of bs) {
    if (lo !== null) lo = b.lo === null ? null : b.lo < lo ? b.lo : lo
    if (b.hi !== null && (hi === null || b.hi < hi)) hi = b.hi
  }
  return { lo, hi }
}

/** 第 k 個單位達成的那天：上下界都一樣才確定，否則 null */
export function kthDate(units: Bound[], k: number): string | null {
  if (k < 1 || units.length < k) return null
  const los = units.map((u) => u.lo).sort((a, b) => (a === null ? -1 : b === null ? 1 : a.localeCompare(b)))
  const his = units.map((u) => u.hi).sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
  const lo = los[k - 1]
  const hi = his[k - 1]
  return lo && hi && lo === hi ? lo : null
}

function utc(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y!, m! - 1, day!)
}

/** b − a 幾天 */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86400000)
}

/** 依日期分成幾次：相鄰日期相差 ≥ gap 天就是另一次；回傳每次的第一天 */
export function occasions(sortedDates: string[], gap = 30): string[] {
  const out: string[] = []
  let prev: string | null = null
  for (const d of sortedDates) {
    if (prev === null || diffDays(prev, d) >= gap) out.push(d)
    prev = d
  }
  return out
}

/** 行程的結束日：沒有 end_date 的是當天來回（done 的行程一定有 start_date） */
export function tripEnd(t: Pick<Trip, 'start_date' | 'end_date'>): string {
  return t.end_date ?? t.start_date ?? ''
}

/** 有紀錄的旅行：已結束、至少一天排了停留點（不看待排，和 composables/visited.ts 一致）。依結束日遞增 */
export function recordedTrips(doneTrips: Trip[]): Trip[] {
  return doneTrips
    .filter((t) => t.days.some((d) => d.stops.length > 0))
    .sort((a, b) => tripEnd(a).localeCompare(tripEnd(b)) || (a.start_date ?? '').localeCompare(b.start_date ?? '') || a.id.localeCompare(b.id))
}

/** 章的傾斜角度（−8°..8°），依 id 固定 */
export function tiltOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  return (((h % 17) + 17) % 17) - 8
}

/** 2025-04-03 → 2025.04.03 */
export function dotDate(d: string): string {
  return d.replaceAll('-', '.')
}

export interface AchvInput {
  entries: Array<[string, Mark]>
  datesById: Map<string, Array<string | null>>
  doneTrips: Trip[]
  data: AchvData | null
}

/** 詳細對話框裡「有關的」景點、旅行或縣 */
export interface Contrib {
  key: string
  kind: 'spot' | 'trip' | 'pref'
  label: string
  lang?: 'ja'
  date: string | null
  to: string
}

export type AchvStatus = 'unknown' | 'locked' | 'done'

export interface AchvState {
  def: AchvDef
  status: AchvStatus
  have: number
  need: number
  /** 達成日（確定時） */
  at: string | null
  /** 未達成時代替 x / n 的進度（「還沒去：秋田、山形」） */
  note?: string
  items: Contrib[]
  /** 讓達成日算不出來的、沒有日期的地方數 */
  undated: number
}

export interface PrefStampState {
  pref: string
  done: boolean
  at: string | null
  items: Contrib[]
  undated: number
}

type Castles = AchvData['castle']

export interface Derived {
  /** V：去過的 id（含擴充包的點） */
  ids: Set<string>
  /** P：去過的縣 */
  prefs: Set<string>
  byPref: Map<string, string[]>
  /** 每個 id 第一次去過的上下界 */
  first: Map<string, Bound>
  prefFirst: Map<string, Bound>
  /** DATES：所有去過的日期，去重後遞增 */
  dates: string[]
  prefDates: Map<string, string[]>
  /** 每個 id 有日期的那幾次，遞增 */
  datesOf: Map<string, string[]>
  /** T：有紀錄的旅行，依結束日遞增 */
  trips: Trip[]
  markOf: Map<string, Mark>
  tagSets: Record<Designation, Set<string>> | null
  castles: Castles | null
}

const tagCache = new WeakMap<AchvData, Record<Designation, Set<string>>>()
function tagSetsOf(data: AchvData): Record<Designation, Set<string>> {
  let out = tagCache.get(data)
  if (!out) {
    const set = (k: Designation) => new Set(data.tags[k] ?? [])
    out = { 世界遺產: set('世界遺產'), 國寶: set('國寶'), 特別史跡: set('特別史跡'), 特別名勝: set('特別名勝') }
    tagCache.set(data, out)
  }
  return out
}

const sortedUnique = (list: string[]) => [...new Set(list)].sort()

/** 一次掃過去過的紀錄與旅行 */
export function derive(i: AchvInput): Derived {
  const ids = new Set<string>()
  const prefs = new Set<string>()
  const byPref = new Map<string, string[]>()
  const first = new Map<string, Bound>()
  const datesOf = new Map<string, string[]>()
  const markOf = new Map<string, Mark>()
  const all: string[] = []
  for (const [id, m] of i.entries) {
    ids.add(id)
    prefs.add(m.pref)
    markOf.set(id, m)
    const list = byPref.get(m.pref) ?? []
    list.push(id)
    byPref.set(m.pref, list)
    const raw = i.datesById.get(id) ?? [m.visited_on ?? null]
    first.set(id, minBound(raw.map((d) => (d ? { lo: d, hi: d } : UNKNOWN))))
    const dated = sortedUnique(raw.filter((d): d is string => Boolean(d)))
    datesOf.set(id, dated)
    all.push(...dated)
  }
  const prefFirst = new Map<string, Bound>()
  const prefDates = new Map<string, string[]>()
  for (const [p, list] of byPref) {
    prefFirst.set(p, minBound(list.map((id) => first.get(id)!)))
    prefDates.set(p, sortedUnique(list.flatMap((id) => datesOf.get(id) ?? [])))
  }
  return {
    ids,
    prefs,
    byPref,
    first,
    prefFirst,
    dates: sortedUnique(all),
    prefDates,
    datesOf,
    trips: recordedTrips(i.doneTrips),
    markOf,
    tagSets: i.data ? tagSetsOf(i.data) : null,
    castles: i.data?.castle ?? null,
  }
}

const exact = (b: Bound | undefined): string | null => (b && b.lo !== null && b.lo === b.hi ? b.lo : null)
const byDate = (a: Contrib, b: Contrib) =>
  a.date === b.date ? 0 : a.date === null ? 1 : b.date === null ? -1 : a.date.localeCompare(b.date)

/** 景點或擴充包的點在地圖上的位置（擴充包的點一併打開那個擴充包） */
function spotTo(id: string, pref: string): string {
  const pack = packOfId(id)
  return `/map/${pref}?spot=${encodeURIComponent(id)}${pack ? `&pack=${pack}` : ''}`
}

function spotItems(d: Derived, ids: Iterable<string>): Contrib[] {
  const out: Contrib[] = []
  for (const id of ids) {
    const m = d.markOf.get(id)
    if (!m) continue
    out.push({ key: id, kind: 'spot', label: m.name, lang: 'ja', date: exact(d.first.get(id)), to: spotTo(id, m.pref) })
  }
  return out.sort(byDate)
}

function prefItems(d: Derived, prefs: Iterable<string>): Contrib[] {
  const out: Contrib[] = []
  for (const p of prefs) {
    if (!d.prefs.has(p)) continue
    out.push({ key: p, kind: 'pref', label: regionOf(p)?.name.zh_tw ?? p, date: exact(d.prefFirst.get(p)), to: `/map/${p}` })
  }
  return out.sort(byDate)
}

function tripItems(trips: Trip[]): Contrib[] {
  return trips.map((t) => ({ key: t.id, kind: 'trip' as const, label: t.name || '未命名行程', date: tripEnd(t), to: `/trips/${t.id}` }))
}

const undatedIn = (d: Derived, ids: Iterable<string>) => {
  let n = 0
  for (const id of ids) if (d.first.get(id)?.lo === null) n += 1
  return n
}

/** 走一遍 DATES：key 的種類第一次達到 need 的那天 */
function walkDates(dates: string[], keyOf: (d: string) => string, need: number): { have: number; at: string | null } {
  const seen = new Set<string>()
  let at: string | null = null
  for (const d of dates) {
    seen.add(keyOf(d))
    if (at === null && seen.size >= need) at = d
  }
  return { have: seen.size, at }
}

function tripDays(t: Trip): number {
  return dayCount(t.start_date, tripEnd(t)) ?? 0
}
function tripPrefCount(t: Trip): number {
  return new Set(t.days.flatMap((day) => day.stops.map((s) => s.pref))).size
}

interface Judged {
  have: number
  need: number
  at: string | null
  note?: string
  items: Contrib[]
  /** 和日期有關的 id（算 undated 用） */
  related?: Iterable<string>
}

function judge(d: Derived, rule: AchvRule): Judged | null {
  const need = ruleNeed(rule)
  switch (rule.kind) {
    case 'area': {
      const ps = areaPrefs(rule.area)
      const have = ps.filter((p) => d.prefs.has(p))
      const missing = ps.filter((p) => !d.prefs.has(p))
      const note =
        missing.length > 0 && missing.length <= 3
          ? `還沒去：${missing.map((p) => regionOf(p)?.name.zh_tw ?? p).join('、')}`
          : undefined
      return {
        have: have.length,
        need,
        at: missing.length ? null : kthDate(ps.map((p) => d.prefFirst.get(p)!), ps.length),
        note,
        items: prefItems(d, ps),
        related: ps.flatMap((p) => d.byPref.get(p) ?? []),
      }
    }
    case 'prefs': {
      const ps = [...d.prefs]
      return {
        have: ps.length,
        need,
        at: kthDate(ps.map((p) => d.prefFirst.get(p)!), need),
        items: prefItems(d, regions.map((r) => r.prefecture)),
        related: d.ids,
      }
    }
    case 'spots':
      return {
        have: d.ids.size,
        need,
        at: kthDate([...d.ids].map((id) => d.first.get(id)!), need),
        items: spotItems(d, d.ids),
        related: d.ids,
      }
    case 'trips': {
      const ends = d.trips.map(tripEnd)
      return { have: ends.length, need, at: ends[need - 1] ?? null, items: tripItems(d.trips) }
    }
    case 'tripDays': {
      const hit = d.trips.filter((t) => tripDays(t) >= need)
      return {
        have: Math.max(0, ...d.trips.map(tripDays)),
        need,
        at: hit.map(tripEnd).sort()[0] ?? null,
        items: tripItems(hit),
      }
    }
    case 'tripPrefs': {
      const hit = d.trips.filter((t) => tripPrefCount(t) >= need)
      return {
        have: Math.max(0, ...d.trips.map(tripPrefCount)),
        need,
        at: hit.map(tripEnd).sort()[0] ?? null,
        items: tripItems(hit),
      }
    }
    case 'tripShared': {
      const hit = d.trips.filter((t) => t.members.length >= 2)
      return { have: hit.length ? 1 : 0, need, at: hit.map(tripEnd).sort()[0] ?? null, items: tripItems(hit) }
    }
    case 'revisit': {
      const when = new Map<string, string>()
      for (const [id, ds] of d.datesOf) {
        const again = ds.find((x) => diffDays(ds[0]!, x) >= rule.gap)
        if (again) when.set(id, again)
      }
      const at = [...when.values()].sort()[0] ?? null
      const items = spotItems(d, when.keys()).map((c) => ({ ...c, date: when.get(c.key) ?? null })).sort(byDate)
      return { have: when.size ? 1 : 0, need, at, items }
    }
    case 'prefOccasions': {
      let best: { pref: string; n: number } | null = null
      const when = new Map<string, string>()
      for (const r of regions) {
        const occ = occasions(d.prefDates.get(r.prefecture) ?? [], rule.gap)
        if (occ.length && (!best || occ.length > best.n)) best = { pref: r.prefecture, n: occ.length }
        if (occ.length >= rule.need) when.set(r.prefecture, occ[rule.need - 1]!)
      }
      const at = [...when.values()].sort()[0] ?? null
      const items = (when.size ? [...when.keys()] : best ? [best.pref] : []).map((p) => ({
        key: p,
        kind: 'pref' as const,
        label: regionOf(p)?.name.zh_tw ?? p,
        date: when.get(p) ?? null,
        to: `/map/${p}`,
      }))
      return {
        have: best?.n ?? 0,
        need,
        at,
        note: best ? `${regionOf(best.pref)?.name.zh_tw ?? best.pref} ${Math.min(best.n, need)} / ${need}` : undefined,
        items: items.sort(byDate),
      }
    }
    case 'seasons':
      return { ...walkDates(d.dates, (x) => seasonOfMonth(Number(x.slice(5, 7))), need), need, items: [] }
    case 'months':
      return { ...walkDates(d.dates, (x) => x.slice(5, 7), need), need, items: [] }
    case 'years':
      return { ...walkDates(d.dates, (x) => x.slice(0, 4), need), need, items: [] }
    case 'tag': {
      if (!d.tagSets) return null
      const set = d.tagSets[rule.tag]
      const hit = [...d.ids].filter((id) => set.has(id))
      return {
        have: hit.length,
        need,
        at: kthDate(hit.map((id) => d.first.get(id)!), need),
        items: spotItems(d, hit),
        related: hit,
      }
    }
    case 'castle': {
      if (!d.castles) return null
      const hit = d.castles[rule.group].filter((c) => d.ids.has(c[0]) || (c[1] !== null && d.ids.has(c[1])))
      const visitedOf = (c: [string, string | null]) => [c[0], c[1]].filter((x): x is string => x !== null && d.ids.has(x))
      const bounds = hit.map((c) => minBound(visitedOf(c).map((id) => d.first.get(id)!)))
      const items = hit.map((c, n) => {
        const id = visitedOf(c)[0]!
        const m = d.markOf.get(id)!
        return { key: c[0], kind: 'spot' as const, label: m.name, lang: 'ja' as const, date: exact(bounds[n]), to: spotTo(id, m.pref) }
      })
      return {
        have: hit.length,
        need,
        at: kthDate(bounds, need),
        items: items.sort(byDate),
        related: hit.flatMap(visitedOf),
      }
    }
    case 'prefix': {
      const hit = [...d.ids].filter((id) => id.startsWith(rule.prefix))
      return {
        have: hit.length,
        need,
        at: kthDate(hit.map((id) => d.first.get(id)!), need),
        items: spotItems(d, hit),
        related: hit,
      }
    }
  }
}

/** 每個成就現在的狀態 */
export function evaluate(d: Derived, defs: AchvDef[] = ACHIEVEMENTS): AchvState[] {
  return defs.map((def) => {
    const r = judge(d, def.rule)
    if (!r) return { def, status: 'unknown', have: 0, need: ruleNeed(def.rule), at: null, items: [], undated: 0 }
    const done = r.have >= r.need
    const at = done ? r.at : null
    const state: AchvState = {
      def,
      status: done ? 'done' : 'locked',
      have: r.have,
      need: r.need,
      at,
      items: r.items,
      undated: done && at === null && r.related ? undatedIn(d, r.related) : 0,
    }
    if (!done && r.note) state.note = r.note
    return state
  })
}

/**
 * 給券的成就數（stores/wallet.ts）：只算 core 的，和錢包現有的來源一樣只依賴 marks、trips，
 * achievements.json 晚到或資料更新都不會讓張數跳動
 */
export function paidCount(states: AchvState[]): number {
  return states.filter((s) => s.def.tickets > 0 && s.def.dep === 'core' && s.status === 'done').length
}

/** 47 格初訪章（regions.json 的順序） */
export function prefStamps(d: Derived): PrefStampState[] {
  return regions.map((r) => {
    const p = r.prefecture
    const ids = d.byPref.get(p) ?? []
    const at = exact(d.prefFirst.get(p))
    return {
      pref: p,
      done: d.prefs.has(p),
      at,
      items: spotItems(d, ids),
      undated: d.prefs.has(p) && at === null ? undatedIn(d, ids) : 0,
    }
  })
}

/** 這趟旅行期間（開始日到結束日，含首尾）達成的初訪章與成就 */
export function inTrip(states: AchvState[], stamps: PrefStampState[], t: Pick<Trip, 'start_date' | 'end_date'>): { stamps: PrefStampState[]; seals: AchvState[] } {
  const start = t.start_date
  const end = tripEnd(t)
  if (!start || !end) return { stamps: [], seals: [] }
  const within = (at: string | null) => at !== null && at >= start && at <= end
  return {
    stamps: stamps.filter((s) => s.done && within(s.at)),
    seals: states.filter((s) => s.status === 'done' && within(s.at)),
  }
}

/** 這台裝置看過的成就（localStorage）：比對出新達成的 */
export interface Known {
  v: 1
  deps: AchvDep[]
  ids: string[]
  opened?: true
}

/**
 * 和上次看過的比：某個 dep 第一次 ready 時，把目前達成的靜靜記成基準（不標 NEW）；
 * 之後才出現的就是新的。known 只會增加，取消再勾回來不會再 NEW。
 */
export function diffKnown(
  known: Known,
  doneByDep: Record<AchvDep, string[]>,
  ready: Record<AchvDep, boolean>,
): { known: Known; fresh: string[] } {
  const deps = [...known.deps]
  const ids = new Set(known.ids)
  const fresh: string[] = []
  for (const dep of ['core', 'data'] as const) {
    if (!ready[dep]) continue
    if (!deps.includes(dep)) {
      deps.push(dep)
      for (const id of doneByDep[dep]) ids.add(id)
      continue
    }
    for (const id of doneByDep[dep]) {
      if (ids.has(id)) continue
      ids.add(id)
      fresh.push(id)
    }
  }
  const next: Known = { v: 1, deps, ids: [...ids] }
  if (known.opened) next.opened = true
  return { known: next, fresh }
}
