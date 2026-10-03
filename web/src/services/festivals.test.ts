import { describe, expect, it } from 'vitest'

import type { Festival } from './bundles'
import { FESTIVAL_FIRST, festivalGroupKey, festivalGroups, revealFestival } from './festivals'

const fest = (id: string, months: number[] | undefined, views: number) => ({ id, months, views }) as unknown as Festival

// 8 月 8 個（瀏覽量 80…10）、7 月 1 個、沒有月份 1 個
const list = [
  ...Array.from({ length: 8 }, (_, i) => fest(`a${i}`, [8], 80 - i * 10)),
  fest('b', [7, 8], 5),
  fest('c', undefined, 1),
]

describe('festivalGroups', () => {
  it('依月份排、最後是月份未載，組內依瀏覽量', () => {
    const g = festivalGroups(list)
    expect(g.map((x) => x.key)).toEqual(['7', '8', 'none'])
    expect(g[1]!.items.map((f) => f.id)).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'])
    expect(festivalGroupKey(list[8]!)).toBe('7')
    expect(festivalGroupKey(list[9]!)).toBe('none')
  })
})

describe('revealFestival', () => {
  const groups = festivalGroups(list)
  const none = new Set<string>()
  it('卡片已經看得到時不改', () => {
    expect(revealFestival(groups, 'a0', { month: null, expanded: none })).toBeNull()
    expect(revealFestival(groups, 'a7', { month: '8', expanded: none })).toBeNull()
    expect(revealFestival(groups, 'a7', { month: null, expanded: new Set(['8']) })).toBeNull()
  })
  it('排在收起的部分：展開那一組', () => {
    expect(FESTIVAL_FIRST).toBe(6)
    const r = revealFestival(groups, 'a6', { month: null, expanded: none })
    expect(r).toEqual({ month: null, expanded: new Set(['8']) })
  })
  it('篩選的是別的月份：取消篩選，必要時展開', () => {
    expect(revealFestival(groups, 'b', { month: '8', expanded: none })).toEqual({ month: null, expanded: new Set() })
    expect(revealFestival(groups, 'a7', { month: '7', expanded: new Set(['none']) })).toEqual({
      month: null,
      expanded: new Set(['none', '8']),
    })
  })
  it('找不到的 id 不改', () => {
    expect(revealFestival(groups, 'zzz', { month: '8', expanded: none })).toBeNull()
  })
})
