import type { Festival } from './bundles'

/** 深度探索「祭典」的一組：舉行的月份（跨月的放在第一個月），沒有月份的是 none「月份未載」 */
export interface FestivalGroup {
  key: string
  label: string
  items: Festival[]
}

export const FESTIVAL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
/** 每月先顯示幾項，其餘用「全部 N 項」展開 */
export const FESTIVAL_FIRST = 6

/** 祭典所在的組（月份或 none） */
export function festivalGroupKey(f: Festival): string {
  const m = f.months?.[0]
  return m ? String(m) : 'none'
}

/** 1 到 12 月依序、最後「月份未載」；組內依日文維基瀏覽量。沒有祭典的組不列 */
export function festivalGroups(festivals: readonly Festival[]): FestivalGroup[] {
  const sorted = [...festivals].sort((a, b) => b.views - a.views)
  const out: FestivalGroup[] = FESTIVAL_MONTHS.map((m) => ({
    key: String(m),
    label: `${m}月`,
    items: sorted.filter((f) => f.months?.[0] === m),
  }))
  out.push({ key: 'none', label: '月份未載', items: sorted.filter((f) => !f.months?.length) })
  return out.filter((g) => g.items.length)
}

/** 祭典卡的錨點 id（從地圖返回時捲回這張卡） */
export const festivalAnchor = (id: string) => `fest-${id}`

/**
 * 要讓這個祭典的卡出現在畫面上，月份篩選與展開的組要怎麼改：
 * 篩選的是別的月份就取消篩選；沒篩選、卡片排在收起的部分就展開那一組。不用改時回傳 null。
 */
export function revealFestival(
  groups: readonly FestivalGroup[],
  id: string,
  state: { month: string | null; expanded: ReadonlySet<string> },
): { month: string | null; expanded: Set<string> } | null {
  const g = groups.find((x) => x.items.some((f) => f.id === id))
  if (!g) return null
  if (state.month === g.key) return null
  const index = g.items.findIndex((f) => f.id === id)
  const needExpand = index >= FESTIVAL_FIRST && !state.expanded.has(g.key)
  if (state.month === null && !needExpand) return null
  const expanded = new Set(state.expanded)
  if (needExpand) expanded.add(g.key)
  return { month: null, expanded }
}
