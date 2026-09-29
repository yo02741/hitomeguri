import type { TimedItem } from './bundles'

// 期間限定的篩選與顯示（UX-FLOW.md A6）。

/** 今天看得到的：已開始、還沒結束，另加 7 天內開始的；依結束日排序 */
export function currentTimed(items: TimedItem[], today: string, pref?: string | null): TimedItem[] {
  const soon = new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10)
  return items
    .filter((t) => t.valid_to >= today && t.valid_from <= soon)
    .filter((t) => !pref || t.scope === 'national' || t.prefectures?.includes(pref))
    .sort((a, b) => a.valid_to.localeCompare(b.valid_to) || a.id.localeCompare(b.id))
}

/** 和一段日期重疊的（旅前準備：行程期間內） */
export function overlapping(items: TimedItem[], start: string, end: string, prefs: string[]): TimedItem[] {
  return items
    .filter((t) => t.valid_from <= end && t.valid_to >= start)
    .filter((t) => t.scope === 'national' || t.prefectures?.some((p) => prefs.includes(p)))
    .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
}

/** 10.30 – 11.13（DESIGN.md §7.8） */
export function dateRange(t: TimedItem): string {
  const f = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`
  return t.valid_from === t.valid_to ? f(t.valid_from) : `${f(t.valid_from)} – ${f(t.valid_to)}`
}
