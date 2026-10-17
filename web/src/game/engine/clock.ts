import type { Season, TimeOfDay } from './types'

/**
 * 遊戲時鐘：日曆從今天（日本時間）開始，一天 1440 分鐘。時段：白天 6:00–16:59、黃昏 17:00–18:59、夜晚 19:00–5:59。
 * 在戶外走的時候時間往前（預設現實 1 秒＝遊戲 1 分鐘，Game 的 settings.timeRate 可以調）。
 * 季節預設照月份（3–5 春、6–8 夏、9–11 秋、12–2 冬）；P2 換成氣象台的平年值（GameOptions.seasonOf）。
 */
export interface CalendarDate {
  y: number
  m: number
  d: number
}

export const DAY_MIN = 1440
/** 新遊戲從早上 9 點開始 */
export const START_MIN = 9 * 60

export function todayJst(now: Date = new Date()): CalendarDate {
  const t = new Date(now.getTime() + 9 * 3600 * 1000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

export function periodOf(min: number): TimeOfDay {
  const h = Math.floor((((min % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60)
  if (h >= 6 && h < 17) return 'day'
  if (h >= 17 && h < 19) return 'dusk'
  return 'night'
}

export function monthSeason(d: CalendarDate): Season {
  if (d.m >= 3 && d.m <= 5) return 'spring'
  if (d.m >= 6 && d.m <= 8) return 'summer'
  if (d.m >= 9 && d.m <= 11) return 'autumn'
  return 'winter'
}

/** 日期加幾天（用 UTC 算，不受時區影響） */
export function addDays(d: CalendarDate, n: number): CalendarDate {
  const t = new Date(Date.UTC(d.y, d.m - 1, d.d + n))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

export const sameDate = (a: CalendarDate, b: CalendarDate) => a.y === b.y && a.m === b.m && a.d === b.d

export class GameClock {
  date: CalendarDate
  /** 這一天的第幾分鐘（可以有小數） */
  minutes: number
  seasonOf: (d: CalendarDate) => Season

  constructor(now: Date = new Date(), seasonOf: (d: CalendarDate) => Season = monthSeason) {
    this.date = todayJst(now)
    this.minutes = START_MIN
    this.seasonOf = seasonOf
  }

  get time(): TimeOfDay {
    return periodOf(this.minutes)
  }
  get season(): Season {
    return this.seasonOf(this.date)
  }
  /** 'HH:MM' */
  get hhmm(): string {
    const m = Math.floor(this.minutes)
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }

  /** 往前走幾分鐘（跨過午夜就換到隔天） */
  advance(min: number) {
    if (!(min > 0)) return
    let m = this.minutes + min
    let days = 0
    while (m >= DAY_MIN) {
      m -= DAY_MIN
      days++
    }
    this.minutes = m
    if (days) this.date = addDays(this.date, days)
  }

  setDate(y: number, m: number, d: number) {
    const t = new Date(Date.UTC(y, m - 1, d))
    if (Number.isNaN(t.getTime())) return
    this.date = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
  }

  setTime(h: number, m = 0) {
    const v = Math.round(h * 60 + m)
    this.minutes = ((v % DAY_MIN) + DAY_MIN) % DAY_MIN
  }

  /** 睡一晚：隔天早上（過了午夜、還沒到早上才睡的，就是今天早上，不跳過一天） */
  nextMorning(h = 7) {
    if (this.minutes >= h * 60) this.date = addDays(this.date, 1)
    this.setTime(h)
  }

  toJSON() {
    return { y: this.date.y, m: this.date.m, d: this.date.d, min: Math.floor(this.minutes) }
  }

  load(c: { y: number; m: number; d: number; min: number }) {
    this.setDate(c.y, c.m, c.d)
    this.minutes = Math.max(0, Math.min(DAY_MIN - 1, c.min))
  }
}
