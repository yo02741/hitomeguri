import { describe, expect, it } from 'vitest'

import { snapAfterDrag, snapHeights, stepSnap } from './sheetSnap'

const h = { peek: 120, half: 460, full: 670 }

describe('snapHeights', () => {
  it('半開 55vh，不超過海報條以下的地圖區減 40', () => {
    expect(snapHeights(670, 56, 118, 844)).toEqual({ peek: 118, half: 464, full: 670 })
    // 手機打橫：地圖區只有兩百多 px
    expect(snapHeights(274, 56, 118, 390)).toEqual({ peek: 118, half: 178, full: 274 })
  })
  it('名稱帶還沒量到時收合用 120，且不高過半開', () => {
    expect(snapHeights(670, 0, 0, 844).peek).toBe(120)
    expect(snapHeights(200, 56, 150, 390).peek).toBe(104)
  })
})

describe('snapAfterDrag', () => {
  it('慢慢放開：吸到最近的一段', () => {
    expect(snapAfterDrag(h, 140, 0)).toBe('peek')
    expect(snapAfterDrag(h, 300, 0.1)).toBe('half')
    expect(snapAfterDrag(h, 600, -0.1)).toBe('full')
  })
  it('比收合低很多才關閉', () => {
    expect(snapAfterDrag(h, 90, 0)).toBe('peek')
    expect(snapAfterDrag(h, 60, 0)).toBeNull()
  })
  it('甩的時候往甩的方向換一段', () => {
    expect(snapAfterDrag(h, 470, 0.8)).toBe('full')
    expect(snapAfterDrag(h, 200, 0.8)).toBe('half')
    expect(snapAfterDrag(h, 450, -0.8)).toBe('peek')
    expect(snapAfterDrag(h, 650, -0.8)).toBe('half')
    // 從收合往下甩：關閉
    expect(snapAfterDrag(h, 115, -0.8)).toBeNull()
    expect(snapAfterDrag(h, 670, 0.9)).toBe('full')
  })
})

describe('stepSnap', () => {
  it('上下一段，到頭就停', () => {
    expect(stepSnap('peek', 1)).toBe('half')
    expect(stepSnap('full', 1)).toBe('full')
    expect(stepSnap('half', -1)).toBe('peek')
    expect(stepSnap('peek', -1)).toBe('peek')
  })
  it('點把手依序輪替', () => {
    expect(stepSnap('peek', 0)).toBe('half')
    expect(stepSnap('half', 0)).toBe('full')
    expect(stepSnap('full', 0)).toBe('peek')
  })
})
