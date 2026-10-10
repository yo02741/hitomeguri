import { describe, expect, it } from 'vitest'

import {
  allVariants,
  decodeVariant,
  drawnSeasons,
  drawSeason,
  drawSeasonsAcross,
  missingSeasonCount,
  missingSeasons,
  ownedVariants,
  taskVariants,
  type SpotRecord,
} from './cardVariants'

const keys = (r: SpotRecord) => ownedVariants(r).map((v) => v.key)
/** 每次回傳同一個數的亂數 */
const fixed = (x: number) => () => x

describe('樣式的種類', () => {
  it('每個景點 9 種，有夜景照片的 10 種；沒有銀箔、金箔', () => {
    expect(allVariants(false).map((v) => v.key)).toEqual(['base', 'season-spring', 'season-summer', 'season-autumn', 'season-winter', 'full', 'sumi', 'stamp', 'special'])
    expect(allVariants(true)).toHaveLength(10)
    expect(allVariants(true).map((v) => v.key)).toContain('night')
    expect(allVariants(true).some((v) => v.key === 'gold' || v.key === 'silver')).toBe(false)
  })

  it('稀有度：基本 0、季節 1、全景・夜景・墨繪・切手 2、特別全景 4', () => {
    const rank = Object.fromEntries(allVariants(true).map((v) => [v.key, v.rank]))
    expect(rank).toMatchObject({ base: 0, 'season-spring': 1, full: 2, night: 2, sumi: 2, stamp: 2, special: 4 })
  })
})

describe('以前的代號', () => {
  it('銀箔、金箔讀不到，存著的只認抽到的季節', () => {
    expect(decodeVariant('gold')).toBeUndefined()
    expect(decodeVariant('silver@autumn')).toBeUndefined()
    expect(drawnSeasons(['gold@spring', 'silver', 'full@winter', 'special', 'season-autumn', 'season-autumn', 'season-x'])).toEqual(['autumn'])
  })

  it('舊的金箔、抽到的全景、特別全景不算收集到', () => {
    expect(keys({ dates: ['2025-04-01'], night: false, drawn: ['gold@spring', 'silver', 'full@winter', 'special', 'season-winter'] })).toEqual(['season-spring', 'season-winter', 'base'])
  })
})

describe('任務與行程給的樣式', () => {
  it('切手、墨繪看勾選；夜景只有有夜景照片的才有', () => {
    expect(taskVariants({ tasks: ['stamp', 'ink', 'night'], night: false }).map((v) => v.key)).toEqual(['stamp', 'sumi'])
    expect(taskVariants({ tasks: ['night'], night: true }).map((v) => v.key)).toEqual(['night'])
    // 不認得的任務略過
    expect(taskVariants({ tasks: ['diary', 'x'], night: true })).toEqual([])
  })

  it('全景：這個景點在已結束的行程裡（自動），照片是那天的季節', () => {
    const [full] = taskVariants({ trip: { name: '京都三日', date: '2025-11-03' }, night: false })
    expect(full).toMatchObject({ key: 'full', photo: 'autumn' })
    expect(taskVariants({ trip: null, night: false })).toEqual([])
  })

  it('取消勾選，那一種就拿掉', () => {
    const r: SpotRecord = { dates: ['2025-04-01'], night: true, tasks: ['night', 'stamp'] }
    expect(keys(r)).toEqual(expect.arrayContaining(['night', 'stamp']))
    expect(keys({ ...r, tasks: ['stamp'] })).not.toContain('night')
  })
})

describe('特別全景（紀念卡）', () => {
  const all: SpotRecord = {
    dates: ['2025-11-03', '2024-04-05', null, '2025-11-03'],
    night: true,
    tasks: ['night', 'stamp', 'ink'],
    trip: { name: '京都三日', date: '2025-11-03' },
    drawn: ['season-summer', 'season-winter'],
  }

  it('其他樣式都有了才有，印上日期、行程、收齊的章', () => {
    const list = ownedVariants(all)
    expect(list).toHaveLength(10)
    expect(list[0]!.key).toBe('special')
    expect(list[0]!.record).toEqual({
      dates: ['2024-04-05', '2025-11-03'],
      trip: '京都三日',
      stamps: ['season-spring', 'season-summer', 'season-autumn', 'season-winter', 'night', 'sumi', 'stamp', 'full'],
    })
  })

  it('少了任何一種就沒有（取消勾選、行程沒了、缺一季）', () => {
    expect(keys({ ...all, tasks: ['night', 'stamp'] })).not.toContain('special')
    expect(keys({ ...all, trip: null })).not.toContain('special')
    expect(keys({ ...all, drawn: ['season-summer'] })).not.toContain('special')
  })

  it('沒有夜景照片的景點不需要夜景', () => {
    expect(keys({ ...all, night: false, tasks: ['stamp', 'ink'] })).toContain('special')
  })

  it('抽不到', () => {
    for (let i = 0; i < 20; i++) expect(drawSeason([], fixed(i / 20))?.kind).toBe('season')
  })
})

describe('抽獎券只抽還沒有的季節', () => {
  it('只從缺的季節裡抽，四季都有了不能抽', () => {
    const owned = ['base', 'season-spring', 'season-autumn', 'full', 'sumi']
    expect(missingSeasons(owned)).toEqual(['summer', 'winter'])
    expect(drawSeason(owned, fixed(0))?.key).toBe('season-summer')
    expect(drawSeason(owned, fixed(0.99))?.key).toBe('season-winter')
    expect(drawSeason(['season-spring', 'season-summer', 'season-autumn', 'season-winter'])).toBeNull()
  })

  it('十連抽：只抽季節，不重複，剩不到 10 張就抽剩下的', () => {
    const owned = new Map([
      ['a', ['base', 'season-spring']],
      ['b', ['base', 'season-spring', 'season-summer', 'season-autumn', 'season-winter', 'full']],
      ['c', ['base']],
    ])
    expect(missingSeasonCount(owned.values())).toBe(7)
    let seed = 0.37
    const rand = () => (seed = (seed * 9301 + 0.49297) % 1)
    const got = drawSeasonsAcross(owned, 10, rand)
    expect(got).toHaveLength(7)
    expect(got.every(([, v]) => v.kind === 'season')).toBe(true)
    expect(got.some(([id]) => id === 'b')).toBe(false)
    const pairs = got.map(([id, v]) => `${id}:${v.key}`)
    expect(new Set(pairs).size).toBe(pairs.length)
    expect(pairs).not.toContain('a:season-spring')
  })

  it('十連抽依每個景點缺幾季加權', () => {
    const owned = new Map([
      ['few', ['season-spring', 'season-summer', 'season-autumn']],
      ['many', []],
    ])
    // 缺 1 季與缺 4 季：第一張落在 [0, 1/5) 是 few，之後是 many
    expect(drawSeasonsAcross(owned, 1, fixed(0.1))[0]![0]).toBe('few')
    expect(drawSeasonsAcross(owned, 1, fixed(0.5))[0]![0]).toBe('many')
  })
})
