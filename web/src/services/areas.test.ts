import { describe, expect, it } from 'vitest'

import { areaAt, areaGroups, areaList, isUnassigned, paddedBox, parseArea, prefCode } from './areas'
import type { MapSpot, MunicipalityBundle } from './bundles'

const square = (x: number, y: number, s = 1): number[][][][] => [
  [
    [
      [x, y],
      [x + s, y],
      [x + s, y + s],
      [x, y + s],
      [x, y],
    ],
  ],
]

function feature(m: string, n: string, coords: number[][][][], extra: { c?: string; h?: string } = {}) {
  return { type: 'Feature' as const, id: Number(m), properties: { m, n, ...extra }, geometry: { type: 'MultiPolygon' as const, coordinates: coords } }
}

// 神奈川のつもり：横浜市の区（政令指定都市）、川崎市の区、一般の市、所属未定地
const bundle: MunicipalityBundle = {
  type: 'FeatureCollection',
  attribution: 'N03',
  features: [
    feature('142018', '横須賀市', square(3, 0)),
    feature('141020', '神奈川区', square(1, 0), { c: '横浜市' }),
    feature('141011', '鶴見区', square(0, 0), { c: '横浜市', h: 'つるみく' }),
    feature('141313', '川崎区', square(2, 0), { c: '川崎市' }),
    feature('140007', '所属未定地', square(9, 9)),
  ],
}

const spot = (id: string, m?: string): MapSpot => ({ id, n: id, lat: 0, lng: 0, k: 'major', f: 0, s: 1, m })

describe('areaList', () => {
  it('依代碼排列、所属未定地不算', () => {
    const list = areaList(bundle)
    expect(list.map((a) => a.code)).toEqual(['141011', '141020', '141313', '142018'])
    expect(list[0]).toMatchObject({ name: '鶴見区', kana: 'つるみく', city: '横浜市', bbox: [0, 0, 1, 1] })
    // 沒有名稱的位置時用外框中心
    expect(list[0]!.label).toEqual([0.5, 0.5])
  })

  it('所属未定地：名稱或代碼第 3–5 碼 000', () => {
    expect(isUnassigned('130001', '所属未定地')).toBe(true)
    expect(isUnassigned('470007')).toBe(true)
    expect(isUnassigned('131067', '台東区')).toBe(false)
  })
})

describe('areaGroups（地區選單）', () => {
  const areas = areaList(bundle)
  const spots = [spot('a', '141011'), spot('b', '141011'), spot('c', '141313'), spot('d', '142018'), spot('e')]

  it('只列有景點的區、附件數；政令指定都市的區排在市名底下', () => {
    expect(areaGroups(areas, spots)).toEqual([
      { city: '横浜市', areas: [{ code: '141011', name: '鶴見区', kana: 'つるみく', count: 2 }] },
      { city: '川崎市', areas: [{ code: '141313', name: '川崎区', kana: undefined, count: 1 }] },
      { city: undefined, areas: [{ code: '142018', name: '横須賀市', kana: undefined, count: 1 }] },
    ])
  })

  it('目前選的區沒有景點也列出來', () => {
    const g = areaGroups(areas, spots, '141020')
    expect(g[0]).toEqual({
      city: '横浜市',
      areas: [
        { code: '141011', name: '鶴見区', kana: 'つるみく', count: 2 },
        { code: '141020', name: '神奈川区', kana: undefined, count: 0 },
      ],
    })
  })
})

describe('areaAt', () => {
  const areas = areaList(bundle)
  it('點在哪一區；區外、所属未定地為 null', () => {
    expect(areaAt(areas, 0.5, 0.5)?.name).toBe('鶴見区')
    expect(areaAt(areas, 2.5, 0.5)?.name).toBe('川崎区')
    expect(areaAt(areas, 9.5, 9.5)).toBeNull()
    expect(areaAt(areas, -1, 0.5)).toBeNull()
  })

  it('洞（飛地的外面那一區）裡的點不算', () => {
    const ring = (x: number, y: number, s: number) => [
      [x, y],
      [x + s, y],
      [x + s, y + s],
      [x, y + s],
      [x, y],
    ]
    const holed = areaList({
      type: 'FeatureCollection',
      attribution: '',
      features: [feature('131016', '外', [[ring(0, 0, 4), ring(1, 1, 1)]]), feature('131024', '飛地', [[ring(1, 1, 1)]])],
    })
    expect(areaAt(holed, 1.5, 1.5)?.name).toBe('飛地')
    expect(areaAt(holed, 3, 3)?.name).toBe('外')
  })
})

describe('parseArea（網址的 ?area=）', () => {
  it('6 碼、屬於這個縣才算', () => {
    expect(prefCode('tokyo')).toBe('13')
    expect(prefCode('hokkaido')).toBe('01')
    expect(parseArea('131067', 'tokyo')).toBe('131067')
    expect(parseArea('141011', 'tokyo')).toBeNull()
    expect(parseArea('130001', 'tokyo')).toBeNull()
    expect(parseArea('13106', 'tokyo')).toBeNull()
    expect(parseArea(['131067'], 'tokyo')).toBeNull()
    expect(parseArea('131067', null)).toBeNull()
  })
})

describe('paddedBox', () => {
  it('四周留白，小的區至少留 0.004 度', () => {
    const [w, s, e, n] = paddedBox([139.77, 35.66, 139.79, 35.68])
    expect(w).toBeLessThan(139.77)
    expect(e).toBeGreaterThan(139.79)
    expect(35.66 - s).toBeCloseTo(0.004, 5)
    expect(n - 35.68).toBeCloseTo(0.004, 5)
  })
})
