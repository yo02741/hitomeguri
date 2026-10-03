import { describe, expect, it } from 'vitest'

import { nearestHit } from './nearestHit'

// 圓形的目標：圓心 (cx, cy)、半徑 r
const disc = (name: string, cx: number, cy: number, r: number) => (x: number, y: number) => (Math.hypot(x - cx, y - cy) <= r ? name : null)
const any =
  (...fs: Array<(x: number, y: number) => string | null>) =>
  (x: number, y: number) =>
    fs.reduce<string | null>((hit, f) => hit ?? f(x, y), null)

describe('nearestHit', () => {
  it('finds a target within the radius', () => {
    expect(nearestHit(0, 0, disc('a', 15, 0, 3))).toBe('a')
  })
  it('returns null when nothing is within the radius', () => {
    expect(nearestHit(0, 0, disc('a', 30, 0, 3))).toBeNull()
    expect(nearestHit(0, 0, disc('a', 30, 0, 3), 30)).toBe('a')
  })
  it('prefers the nearer target', () => {
    expect(nearestHit(0, 0, any(disc('far', 0, -16, 2), disc('near', 9, 0, 2)))).toBe('near')
    expect(nearestHit(0, 0, any(disc('near', -6, 0, 1), disc('far', 0, 15, 4)))).toBe('near')
  })
})
