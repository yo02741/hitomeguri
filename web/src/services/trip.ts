import { prefectureFullName } from '../data/regions'

// 行程（UX-FLOW.md §3 Trip）的純函式：日期與狀態、天數調整、移動停留點、轉乘連結。

/** 行程的一個停留點。另存縣與日文名：列表只需載入相關縣的 bundle，景點從目錄移除時仍認得出來。 */
export interface Stop {
  type: 'catalog'
  spot_id: string
  pref: string
  name: string
}

export interface TripDay {
  stops: Stop[]
}

export type TripStatus = 'planning' | 'ongoing' | 'done'

export interface Trip {
  id: string
  name: string
  start_date?: string
  end_date?: string
  days: TripDay[]
  /** 想去但還沒排進某天 */
  unscheduled: Stop[]
  created: number
}

/** 停留點位置：day 為 -1 表示「待排」 */
export interface StopPos {
  day: number
  idx: number
}

// firestore.rules 的上限
export const MAX_DAYS = 60
export const TRIP_NAME_MAX = 80

const DAY_MS = 86400000

function parse(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y!, m! - 1, day!)
}

export function addDays(d: string, n: number): string {
  return new Date(parse(d) + n * DAY_MS).toISOString().slice(0, 10)
}

/** 起訖日期涵蓋幾天（含首尾）；日期不完整或顛倒時為 null */
export function dayCount(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const n = Math.round((parse(end) - parse(start)) / DAY_MS) + 1
  return n >= 1 ? Math.min(n, MAX_DAYS) : null
}

/** 依日期推算狀態：出發前規劃中、期間內進行中、結束後就是旅行紀錄。沒有日期的算規劃中。 */
export function tripStatus(t: Pick<Trip, 'start_date' | 'end_date'>, today: string): TripStatus {
  const start = t.start_date
  const end = t.end_date ?? t.start_date
  if (!start || !end) return 'planning'
  if (today < start) return 'planning'
  if (today > end) return 'done'
  return 'ongoing'
}

export function dayDate(t: Pick<Trip, 'start_date'>, i: number): string | undefined {
  return t.start_date ? addDays(t.start_date, i) : undefined
}

/** 調整天數：減少時，被拿掉的那幾天的停留點移到「待排」 */
export function resizeDays(t: Pick<Trip, 'days' | 'unscheduled'>, n: number): Pick<Trip, 'days' | 'unscheduled'> {
  const count = Math.max(1, Math.min(n, MAX_DAYS))
  const days = t.days.slice(0, count).map((d) => ({ stops: [...d.stops] }))
  while (days.length < count) days.push({ stops: [] })
  const dropped = t.days.slice(count).flatMap((d) => d.stops)
  return { days, unscheduled: [...t.unscheduled, ...dropped] }
}

function listAt(t: Pick<Trip, 'days' | 'unscheduled'>, day: number): Stop[] | undefined {
  return day === -1 ? t.unscheduled : t.days[day]?.stops
}

/** 移動一個停留點（同一天換順序、換到別天、移入或移出待排）；to.idx 是移除前的插入位置 */
export function moveStop(
  t: Pick<Trip, 'days' | 'unscheduled'>,
  from: StopPos,
  to: StopPos,
): Pick<Trip, 'days' | 'unscheduled'> {
  const next = { days: t.days.map((d) => ({ stops: [...d.stops] })), unscheduled: [...t.unscheduled] }
  const src = listAt(next, from.day)
  const dst = listAt(next, to.day)
  if (!src || !dst || from.idx < 0 || from.idx >= src.length) return t
  const [stop] = src.splice(from.idx, 1)
  let idx = Math.max(0, Math.min(to.idx, dst.length + (src === dst ? 1 : 0)))
  if (src === dst && to.idx > from.idx) idx -= 1
  dst.splice(Math.min(idx, dst.length), 0, stop!)
  return next
}

export function removeStop(t: Pick<Trip, 'days' | 'unscheduled'>, at: StopPos): Pick<Trip, 'days' | 'unscheduled'> {
  const next = { days: t.days.map((d) => ({ stops: [...d.stops] })), unscheduled: [...t.unscheduled] }
  listAt(next, at.day)?.splice(at.idx, 1)
  return next
}

export function allStops(t: Pick<Trip, 'days' | 'unscheduled'>): Stop[] {
  return [...t.days.flatMap((d) => d.stops), ...t.unscheduled]
}

export function hasSpot(t: Pick<Trip, 'days' | 'unscheduled'>, spotId: string): boolean {
  return allStops(t).some((s) => s.spot_id === spotId)
}

/** 這一天主要在哪個縣（停留點最多的縣，同數取先出現的）：DAY 標記與標頭用它的縣色 */
export function dayPref(day: TripDay): string | undefined {
  const counts = new Map<string, number>()
  for (const s of day.stops) counts.set(s.pref, (counts.get(s.pref) ?? 0) + 1)
  let best: string | undefined
  for (const [p, n] of counts) if (!best || n > counts.get(best)!) best = p
  return best
}

/** 整趟的縣（依第一次出現的順序）：封面色帶 */
export function tripPrefs(t: Pick<Trip, 'days' | 'unscheduled'>): string[] {
  return [...new Set(allStops(t).map((s) => s.pref))]
}

function place(s: Stop): string {
  return `${s.name} ${prefectureFullName(s.pref)}`
}

/**
 * 相鄰兩個停留點之間的 Google Maps 大眾運輸路線（Maps URLs）。
 * 大眾運輸不支援 waypoints，所以一天的路線拆成一段一段（PLAN.md §8）。
 */
export function transitUrl(a: Stop, b: Stop): string {
  const q = new URLSearchParams({ api: '1', origin: place(a), destination: place(b), travelmode: 'transit' })
  return `https://www.google.com/maps/dir/?${q}`
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

/** 10/12（六） */
export function shortDate(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${m}/${day}（${WEEKDAY[new Date(parse(d)).getUTCDay()]}）`
}
