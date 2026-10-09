import { describe, expect, it } from 'vitest'

import { ACHIEVEMENTS, achvById } from '../data/achievements'
import { ACHV_RULES } from '../data/achvRules'
import { ACHV_OUTFIT } from '../data/outfitRewards'
import { achvOutfitOf, DEFAULT_EQUIPPED, giftOf, OUTFITS, outfitById } from '../data/outfits'
import { ACHV_OUTFITS } from '../data/outfitsAchv'
import { regions } from '../data/regions'
import type { Mark } from '../stores/marks'
import { type AchvStatus, derive, evaluate } from './achievements'
import { derivedOwned, gachaPool, wornOf } from './outfitOwn'

const ALL_PREFS = new Set(regions.map((r) => r.prefecture))
const status = (m: Record<string, AchvStatus>) => (id: string) => m[id]

/** 每縣一個去過的景點（可以少幾縣） */
function visits(skip: string[] = []) {
  const entries: Array<[string, Mark]> = regions
    .filter((r) => !skip.includes(r.prefecture))
    .map((r) => [`s-${r.prefecture}`, { pref: r.prefecture, name: r.prefecture, visited: true, visited_on: '2025-04-01' }])
  return derive({ entries, datesById: new Map(), doneTrips: [], data: null })
}

describe('成就服裝的目錄', () => {
  it('5–8 件，一個成就一件，成就都存在', () => {
    expect(ACHV_OUTFITS.length).toBeGreaterThanOrEqual(5)
    expect(ACHV_OUTFITS.length).toBeLessThanOrEqual(8)
    const achvs = ACHV_OUTFITS.map((o) => o.achv!)
    expect(new Set(achvs).size).toBe(achvs.length)
    for (const a of achvs) expect(achvById.has(a), a).toBe(true)
    for (const o of ACHV_OUTFITS) {
      expect(o.pref).toBeUndefined()
      expect(o.gift).toBeUndefined()
      expect(achvOutfitOf(o.achv!)?.id).toBe(o.id)
      expect(ACHV_OUTFIT[o.achv!]).toEqual({ id: o.id, name: o.name })
    }
  })

  it('服裝 id 不重複、都在 OUTFITS 裡', () => {
    expect(new Set(OUTFITS.map((o) => o.id)).size).toBe(OUTFITS.length)
    for (const o of ACHV_OUTFITS) expect(outfitById.get(o.id)).toBe(o)
  })

  it('顏色只用 token（不寫死色碼）', () => {
    for (const o of ACHV_OUTFITS) {
      expect(o.svg, o.id).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?!-)/)
      expect(o.svg, o.id).not.toMatch(/rgb|hsl/)
    }
  })

  it('成就的規則列出每個送服裝的成就', () => {
    const text = ACHV_RULES.find((r) => r.title === '服裝')!.items.join('')
    for (const o of ACHV_OUTFITS) expect(text, o.achv).toContain(achvById.get(o.achv!)!.name)
  })
})

describe('拿到與拿掉', () => {
  it('達成才有；locked、unknown 都沒有', () => {
    const ids = derivedOwned(ACHV_OUTFITS, { visitedPrefs: new Set(), achv: status({ 'prefs-47': 'done', 'castle100-50': 'locked' }) })
    expect(ids).toEqual(['achv-kappa'])
  })

  it('不進扭蛋（去過全部的縣也一樣）', () => {
    const pool = gachaPool(OUTFITS, ALL_PREFS)
    expect(pool.some((o) => o.achv)).toBe(false)
    expect(pool.some((o) => o.gift)).toBe(false)
    expect(pool.length).toBe(OUTFITS.length - ACHV_OUTFITS.length - 47)
  })

  it('47 縣都去過就有道中合羽；取消一縣就拿掉，標回去就回來', () => {
    const own = (skip: string[]) => {
      const d = visits(skip)
      const states = new Map(evaluate(d, ACHIEVEMENTS.filter((a) => a.dep === 'core')).map((s) => [s.def.id, s.status]))
      return derivedOwned(OUTFITS, { visitedPrefs: d.prefs, achv: (id) => states.get(id) })
    }
    const all = own([])
    expect(all).toContain('achv-kappa')
    expect(all).toContain(giftOf('okinawa')!.id)
    const less = own(['okinawa'])
    expect(less).not.toContain('achv-kappa')
    expect(less).not.toContain(giftOf('okinawa')!.id)
    expect(own([])).toEqual(all)
  })
})

describe('穿在身上的', () => {
  const equipped = { body: 'achv-kappa', head: 'achv-jingasa', hand: 'camera', buddy: 'achv-kaeru' }
  it('紀錄還沒對過時照畫', () => {
    expect(wornOf(equipped, outfitById, { visitedPrefs: new Set(), achv: () => undefined, ready: false, fallback: DEFAULT_EQUIPPED })).toEqual(equipped)
  })
  it('拿掉的不畫；衣服換回預設；unknown（achievements.json 還沒到）照畫', () => {
    const worn = wornOf(equipped, outfitById, {
      visitedPrefs: new Set(),
      achv: status({ 'prefs-47': 'locked', 'trips-10': 'locked' }),
      ready: true,
      fallback: DEFAULT_EQUIPPED,
    })
    expect(worn).toEqual({ body: 'tee', head: 'achv-jingasa', hand: 'camera' })
  })
  it('代表單品：那個縣沒去過就不畫', () => {
    const gift = giftOf('kyoto')!
    const e = { [gift.slot]: gift.id }
    expect(wornOf(e, outfitById, { visitedPrefs: new Set(), achv: () => undefined, ready: true, fallback: {} })).toEqual({})
    expect(wornOf(e, outfitById, { visitedPrefs: new Set(['kyoto']), achv: () => undefined, ready: true, fallback: {} })).toEqual(e)
  })
})
