/** 可重現的亂數（mulberry32）：同一個種子畫出同一條街 */
export interface Rng {
  /** [0, 1) */
  next(): number
  /** [a, b] 的整數 */
  int(a: number, b: number): number
  /** [a, b) 的小數 */
  range(a: number, b: number): number
  chance(p: number): boolean
  pick<T>(list: readonly T[]): T
  /** 依權重挑一個 */
  weighted<T>(list: readonly T[], weight: (x: T) => number): T
}

export function rng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const r: Rng = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    range: (lo, hi) => lo + next() * (hi - lo),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)]!,
    weighted: (list, weight) => {
      const total = list.reduce((s, x) => s + Math.max(0, weight(x)), 0)
      let u = next() * total
      for (const x of list) {
        u -= Math.max(0, weight(x))
        if (u < 0) return x
      }
      return list[list.length - 1]!
    },
  }
  return r
}

/** 字串＋數字 → 種子 */
export function seedOf(...parts: Array<string | number>): number {
  let h = 2166136261
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
