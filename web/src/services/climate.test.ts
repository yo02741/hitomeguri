import { describe, expect, it } from 'vitest'

import { rainShare } from './climate'

describe('rainShare', () => {
  it('下雨天數 ÷ 當月天數', () => {
    expect(rainShare(6, 12)).toBeCloseTo(0.4)
    expect(rainShare(2, 28.25)).toBe(1)
    expect(rainShare(1, 40)).toBe(1)
  })
})
