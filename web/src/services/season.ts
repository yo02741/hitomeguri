import type { TimedItem } from './bundles'

/**
 * 海報區飄落的季節（DESIGN.md §9）。
 * 先看氣象廳本季觀測（期間限定裡這個縣正在開花、轉紅、轉黃的），沒有時依月份。
 */
export type Season = 'sakura' | 'momiji' | 'ichou' | 'snow' | 'hotaru' | 'hanabi'
export const SEASONS: Season[] = ['sakura', 'momiji', 'ichou', 'snow', 'hotaru', 'hanabi']

function byObservation(items: TimedItem[], pref: string, today: string): Season | null {
  for (const t of items) {
    if (t.kind !== 'seasonal' || t.valid_from > today || t.valid_to < today) continue
    if (!t.prefectures?.includes(pref)) continue
    if (t.category === 'sakura') return 'sakura'
    if (t.category === 'autumn_leaves') return t.id.includes('-ichou-') ? 'ichou' : 'momiji'
  }
  return null
}

function byMonth(pref: string | null, month: number): Season | null {
  // 8 月：煙火大會的季節
  if (month === 8) return 'hanabi'
  if (pref === 'okinawa') return month <= 2 ? 'sakura' : null
  if (pref === 'hokkaido') {
    if (month === 4 || month === 5) return 'sakura'
    if (month === 7) return 'hotaru'
    if (month === 9 || month === 10) return 'momiji'
    return month >= 11 || month <= 3 ? 'snow' : null
  }
  if (month === 3 || month === 4) return 'sakura'
  if (month === 6 || month === 7) return 'hotaru'
  if (month === 10 || month === 11) return 'momiji'
  if (month === 12 || month <= 2) return 'snow'
  return null
}

export function seasonFor(pref: string | null, today: string, timed: TimedItem[] | null): Season | null {
  const seen = pref && timed ? byObservation(timed, pref, today) : null
  return seen ?? byMonth(pref, Number(today.slice(5, 7)))
}
