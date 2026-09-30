import { addDays } from './trip'

// 日期選擇器用的日期運算。日期一律是 YYYY-MM-DD 字串、月份是 YYYY-MM（當地日期，不含時區）。

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function isIsoDate(s: string | undefined | null): s is string {
  return Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s))
}

export function monthOf(d: string): string {
  return d.slice(0, 7)
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const t = y! * 12 + (m! - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export function weekday(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, day!)).getUTCDay()
}

/** 月曆的 6 週 × 7 天（從該月 1 日所在那一週的星期日開始） */
export function monthCells(ym: string): string[] {
  const first = `${ym}-01`
  const start = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** 2026/10/12（一） */
export function longDate(d: string): string {
  return `${d.replaceAll('-', '/')}（${WEEKDAYS[weekday(d)]}）`
}

/** 2026年10月12日 星期一（螢幕報讀用） */
export function spokenDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return `${y}年${m}月${day}日 星期${WEEKDAYS[weekday(d)]}`
}

export function clampDate(d: string, min?: string, max?: string): string {
  if (min && d < min) return min
  if (max && d > max) return max
  return d
}
