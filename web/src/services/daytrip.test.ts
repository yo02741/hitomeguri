import { describe, expect, it } from 'vitest'

import {
  bandOf,
  buildGraph,
  cityKey,
  type DaytripArea,
  destinations,
  foldName,
  kmLabel,
  nearestStation,
  round1,
  type RailGraphBundle,
  search,
  searchStations,
  TOKYO_23,
  within,
} from './daytrip'
import expected from './fixtures/rail-graph-small.expected.json'
import small from './fixtures/rail-graph-small.json'

const fixture = small as unknown as RailGraphBundle

describe('鐵路距離（pipeline/rail_graph.py 的移植）', () => {
  // 對照資料由 pipeline/tests/test_daytrip.py 用 rail_graph.within 產生（同一份 fixture）
  for (const c of expected.cases) {
    it(`${c.base} ${c.max_km} km 內和 pipeline 相同`, () => {
      const got = within(buildGraph(fixture), c.base, c.max_km)
      const want = c.reach as Record<string, [number, number]>
      expect([...got.keys()].sort()).toEqual(Object.keys(want).sort())
      for (const [id, [km, skm]] of Object.entries(want)) expect([id, got.get(id)!.km, got.get(id)!.shinkansenKm]).toEqual([id, km, skm])
    })
  }

  it('新幹線的權重 0.97：距離差不多時走新幹線，回報實際的 km', () => {
    const g = buildGraph(fixture)
    const r = search(g, g.index.get('n-a')!)
    const i = g.index.get('n-b')!
    // 在來線 6.7 km、新幹線 6.8 km（×0.97 = 6.596）：走新幹線
    expect(r.km.get(i)).toBeCloseTo(6.8, 9)
    expect(r.skm.get(i)).toBeCloseTo(6.8, 9)
  })

  it('小數 1 位和 Python 的 round 相同', () => {
    expect(round1(1.65)).toBe(1.6)
    expect(round1(0.25)).toBe(0.2)
    expect(round1(0.75)).toBe(0.8)
    expect(round1(43.85)).toBe(43.9)
    expect(round1(48.8)).toBe(48.8)
  })

  it('連不到的站沒有距離', () => {
    const g = buildGraph(fixture)
    expect(search(g, g.index.get('n-a')!).km.has(g.index.get('n-k')!)).toBe(false)
  })
})

describe('分段', () => {
  it('60、150 km；150 km 以上要能搭新幹線、到 450 km 為止', () => {
    expect(bandOf(60, false)).toBe(0)
    expect(bandOf(60.1, false)).toBe(1)
    expect(bandOf(150, false)).toBe(1)
    expect(bandOf(151, false)).toBeNull()
    expect(bandOf(151, true)).toBe(2)
    expect(bandOf(450, true)).toBe(2)
    expect(bandOf(451, true)).toBeNull()
  })

  it('城市：政令指定都市的區、東京 23 區合起來', () => {
    expect(cityKey('231061', '名古屋市')).toBe('23:名古屋市')
    expect(cityKey('131067')).toBe('13:23')
    expect(cityKey('132012')).toBe('132012')
    expect(cityKey('112011')).toBe('112011')
  })

  it('km 的寫法', () => {
    expect(kmLabel(36.7)).toBe('37')
    expect(kmLabel(3.2)).toBe('3')
    expect(kmLabel(3.3)).toBe('3.5')
    expect(kmLabel(0.1)).toBe('0.5')
  })
})

const area = (m: string, n: string, p: string, s: DaytripArea['s'], extra: Partial<DaytripArea> = {}): DaytripArea => ({
  m,
  n,
  p,
  lat: 35,
  lng: 139,
  s,
  ...extra,
})

describe('單日來回的目的地', () => {
  const g = buildGraph(fixture)
  const reach = search(g, g.index.get('n-a')!, 450)
  const areas: DaytripArea[] = [
    area('131016', '千代田区', 'tokyo', [['wd-1', '皇居', 'n-a', 90]]),
    area('131067', '台東区', 'tokyo', [['wd-2', '浅草寺', 'n-j', 95]]),
    area('112011', '川越市', 'saitama', [['wd-3', '喜多院', null, 70], ['wd-4', '時の鐘', 'n-g', 60]]),
    area('111031', '大宮区', 'saitama', [['wd-5', '大宮公園', 'n-f', 50]], { c: 'さいたま市' }),
    area('111074', '浦和区', 'saitama', [['wd-6', '調神社', 'n-x', 55]], { c: 'さいたま市', x: ['n-f'] }),
    area('102024', '高崎市', 'gunma', [['wd-7', '高崎白衣大観音', 'n-h', 70]]),
    area('142069', '小田原市', 'kanagawa', [['wd-8', '小田原城', 'n-d', 80]]),
    area('472018', '那覇市', 'okinawa', [['wd-9', '首里城', 'n-k', 90]]),
  ]

  it('依距離排序；連不到的不列；住的城市（東京 23 區）不列', () => {
    const out = destinations(g, reach, areas, cityKey('131016'))
    expect(out.map((d) => d.name)).toEqual(['さいたま市', '川越市', '小田原市', '高崎市'])
    const kawagoe = out[1]!
    expect(kawagoe.km).toBeCloseTo(45.5, 6)
    expect(kawagoe.band).toBe(0)
    expect(kawagoe.spots.map((s) => s.name)).toEqual(['喜多院', '時の鐘'])
  })

  it('政令指定都市的區合成一個，景點依分數合起來，距離取最近的區', () => {
    const saitama = destinations(g, reach, areas, null).find((d) => d.key === '11:さいたま市')!
    expect(saitama.codes).toEqual(['111031', '111074'])
    expect(saitama.spots.map((s) => [s.name, s.area])).toEqual([
      ['調神社', '浦和区'],
      ['大宮公園', '大宮区'],
    ])
    expect(saitama.km).toBeCloseTo(30.3, 6)
  })

  it('東京 23 區從外面看是一個地方', () => {
    const from = search(g, g.index.get('n-g')!, 450)
    const tokyo = destinations(g, from, areas, null).find((d) => d.key === '13:23')!
    expect(tokyo.name).toBe(TOKYO_23)
    expect(tokyo.spots[0]!.name).toBe('浅草寺')
  })

  it('新幹線：路上新幹線 ≥ 20 km 才算', () => {
    const out = destinations(g, reach, areas, null)
    expect(out.find((d) => d.name === '高崎市')!.shinkansen).toBe(true)
    expect(out.find((d) => d.name === '小田原市')!.shinkansen).toBe(false)
  })

  it('150 km 以上：沒有新幹線的不列，有的取能搭新幹線的那一站', () => {
    const far: RailGraphBundle = {
      nodes: [
        ['a', '起點', 35, 139, 'tokyo', 1],
        ['b', '在來線の町', 36, 139, 'gunma', 0],
        ['c', '新幹線の町', 36, 140, 'miyagi', 1],
        ['d', '新幹線の町東', 36, 140.01, 'miyagi', 0],
      ],
      edges: [
        [0, 1, 200, 0],
        [0, 2, 300, 1],
        [0, 3, 290, 0],
        [2, 3, 20, 0],
      ],
    }
    const fg = buildGraph(far)
    const out = destinations(fg, search(fg, 0, 450), [
      area('100001', '在來線の町', 'gunma', [['s1', 'x', 'b', 50]]),
      area('040001', '新幹線の町', 'miyagi', [['s2', 'y', 'd', 50]], { x: ['c'] }),
    ])
    expect(out.map((d) => [d.name, d.station, d.band, d.shinkansen])).toEqual([['新幹線の町', 'c', 2, true]])
  })
})

describe('住的車站', () => {
  const g = buildGraph(fixture)

  it('繁體字、全形、「駅」「站」都找得到', () => {
    expect(foldName('金澤駅')).toBe('金沢')
    expect(foldName('鹿兒島站')).toBe('鹿児島')
    expect(searchStations(g, '東京駅')[0]!.id).toBe('n-a')
    expect(searchStations(g, '上野').map((s) => s.name)).toEqual(['上野', '京成上野'])
  })

  it('沒有車站點的停靠點、沒有連到路網的不列', () => {
    expect(searchStations(g, '成田空港')).toEqual([])
    expect(searchStations(g, '那覇空港')).toEqual([])
  })

  it('最近的車站', () => {
    expect(nearestStation(g, 35.91, 139.48)!.name).toBe('川越')
    expect(nearestStation(g, 40, 120)).toBeNull()
  })
})
