import { describe, expect, it } from 'vitest'

import {
  addStopTo,
  dayIndexOn,
  dayRouteUrls,
  edgeTarget,
  findStop,
  fromHereUrl,
  insertStop,
  MAPS_URL_MAX,
  moveStop,
  parseStay,
  placesOf,
  removeStop,
  resizeDays,
  setStay,
  spotCount,
  type Stop,
} from './trip'

const s = (id: string): Stop => ({ type: 'catalog', spot_id: id, pref: 'kyoto', name: id })

describe('insertStop（移除的復原）', () => {
  const t = { days: [{ stops: [s('a'), s('b'), s('c')] }, { stops: [s('d')] }], unscheduled: [s('e')] }

  it('放回原本的位置', () => {
    const removed = removeStop(t, { day: 0, idx: 1 })
    const back = insertStop(removed, { day: 0, idx: 1 }, s('b'))
    expect(back?.days[0]!.stops.map((x) => x.spot_id)).toEqual(['a', 'b', 'c'])
  })

  it('待排也放得回去', () => {
    const removed = removeStop(t, { day: -1, idx: 0 })
    expect(insertStop(removed, { day: -1, idx: 0 }, s('e'))?.unscheduled.map((x) => x.spot_id)).toEqual(['e'])
  })

  it('那一天已經不在就放回待排，位置超過就放最後', () => {
    const back = insertStop({ days: [{ stops: [] }], unscheduled: [s('e')] }, { day: 1, idx: 5 }, s('d'))
    expect(back?.unscheduled.map((x) => x.spot_id)).toEqual(['e', 'd'])
  })

  it('那一天已經有就不動（共編的人又加回來了）', () => {
    expect(insertStop(t, { day: 0, idx: 0 }, s('a'))).toBeNull()
  })

  it('別天有同一個景點照樣放回去（機場：來跟回）', () => {
    expect(insertStop(t, { day: 1, idx: 1 }, s('a'))?.days[1]!.stops.map((x) => x.spot_id)).toEqual(['d', 'a'])
  })
})

describe('同一個景點排進不同天', () => {
  const t = { days: [{ stops: [s('air'), s('b')] }, { stops: [s('c')] }, { stops: [] }], unscheduled: [s('d')] }

  it('加到別天可以，同一天不重複', () => {
    const next = addStopTo(t, s('air'), 2)
    expect(next && placesOf(next, 'air')).toEqual([0, 2])
    expect(addStopTo(t, s('air'), 0)).toBeNull()
  })

  it('排進某一天時，待排裡的同一個拿掉；已經排了的不再放進待排', () => {
    const next = addStopTo(t, s('d'), 1)
    expect(next?.days[1]!.stops.map((x) => x.spot_id)).toEqual(['c', 'd'])
    expect(next?.unscheduled).toEqual([])
    expect(addStopTo(t, s('air'), null)).toBeNull()
    expect(addStopTo(t, s('e'), null)?.unscheduled.map((x) => x.spot_id)).toEqual(['d', 'e'])
  })

  it('移到已經有同一個景點的那天不動', () => {
    const two = addStopTo(t, s('air'), 2)!
    expect(moveStop(two, { day: 2, idx: 0 }, { day: 0, idx: 0 })).toBe(two)
    expect(moveStop(two, { day: 2, idx: 0 }, { day: 1, idx: 1 }).days[1]!.stops.map((x) => x.spot_id)).toEqual(['c', 'air'])
  })

  it('findStop 先找畫面上那一天的', () => {
    const two = addStopTo(t, s('air'), 2)!
    expect(findStop(two, 'air', 2)).toEqual({ day: 2, idx: 0 })
    expect(findStop(two, 'air')).toEqual({ day: 0, idx: 0 })
    // 那天已經沒有（共編的人移走了）就找第一個
    expect(findStop(two, 'air', 1)).toEqual({ day: 0, idx: 0 })
  })

  it('天數改少時待排不重複；計數算一個', () => {
    const two = addStopTo(t, s('air'), 2)!
    expect(resizeDays(two, 1).unscheduled.map((x) => x.spot_id)).toEqual(['d', 'c', 'air'])
    expect(spotCount(two)).toBe(4)
  })
})

describe('edgeTarget（移到最前、最後）', () => {
  const t = { days: [{ stops: [s('a'), s('b'), s('c')] }], unscheduled: [s('d'), s('e')] }
  const ids = (x: { days: { stops: Stop[] }[] }) => x.days[0]!.stops.map((y) => y.spot_id)

  it('移到最前', () => {
    expect(ids(moveStop(t, { day: 0, idx: 2 }, edgeTarget(t, { day: 0, idx: 2 }, 'first')!))).toEqual(['c', 'a', 'b'])
  })

  it('移到最後', () => {
    expect(ids(moveStop(t, { day: 0, idx: 0 }, edgeTarget(t, { day: 0, idx: 0 }, 'last')!))).toEqual(['b', 'c', 'a'])
  })

  it('已經在最前、最後就不動', () => {
    expect(edgeTarget(t, { day: 0, idx: 0 }, 'first')).toBeNull()
    expect(edgeTarget(t, { day: 0, idx: 2 }, 'last')).toBeNull()
  })

  it('待排也可以', () => {
    const moved = moveStop(t, { day: -1, idx: 0 }, edgeTarget(t, { day: -1, idx: 0 }, 'last')!)
    expect(moved.unscheduled.map((y) => y.spot_id)).toEqual(['e', 'd'])
  })
})

describe('dayIndexOn（旅途中的今天）', () => {
  const t = { start_date: '2026-10-02', days: [{ stops: [] }, { stops: [] }, { stops: [] }] }

  it('出發日是 DAY 1', () => {
    expect(dayIndexOn(t, '2026-10-02')).toBe(0)
    expect(dayIndexOn(t, '2026-10-03')).toBe(1)
  })

  it('期間外或沒有出發日是 null', () => {
    expect(dayIndexOn(t, '2026-10-01')).toBeNull()
    expect(dayIndexOn(t, '2026-10-05')).toBeNull()
    expect(dayIndexOn({ days: t.days }, '2026-10-02')).toBeNull()
  })
})

describe('dayRouteUrls（一天的 Google Maps 路線）', () => {
  const stops = (n: number) => Array.from({ length: n }, (_, i) => s(`s${i}`))
  const params = (url: string) => new URL(url).searchParams

  it('一個點沒有路線', () => {
    expect(dayRouteUrls(stops(1), 3)).toEqual([])
  })

  it('兩個點沒有 waypoints', () => {
    const [leg] = dayRouteUrls(stops(2), 3)
    expect(params(leg!.url).get('origin')).toBe('s0 京都府')
    expect(params(leg!.url).get('destination')).toBe('s1 京都府')
    expect(params(leg!.url).has('waypoints')).toBe(false)
  })

  it('上限內是一段，waypoints 用 | 分隔', () => {
    const legs = dayRouteUrls(stops(5), 3)
    expect(legs.map((l) => [l.from, l.to])).toEqual([[0, 4]])
    expect(params(legs[0]!.url).get('waypoints')).toBe('s1 京都府|s2 京都府|s3 京都府')
    expect(legs[0]!.url).toContain('%7C')
  })

  it('超過上限拆段，下一段從上一段的終點出發', () => {
    expect(dayRouteUrls(stops(8), 3).map((l) => [l.from, l.to])).toEqual([[0, 4], [4, 7]])
    expect(dayRouteUrls(stops(12), 9).map((l) => [l.from, l.to])).toEqual([[0, 10], [10, 11]])
  })

  it('網址太長時再拆短', () => {
    const long = Array.from({ length: 11 }, (_, i) => ({ ...s(`l${i}`), name: `${'長'.repeat(40)}${i}` }))
    const legs = dayRouteUrls(long, 9)
    expect(legs.length).toBeGreaterThan(1)
    for (const l of legs) expect(l.url.length).toBeLessThanOrEqual(MAPS_URL_MAX)
    expect(legs.at(-1)!.to).toBe(10)
  })
})

describe('fromHereUrl（從目前位置）', () => {
  it('不給 origin，用大眾運輸', () => {
    const q = new URL(fromHereUrl(s('a'))).searchParams
    expect(q.has('origin')).toBe(false)
    expect(q.get('destination')).toBe('a 京都府')
    expect(q.get('travelmode')).toBe('transit')
  })
})

describe('住的車站（日帰り）', () => {
  const tokyo = { st: 'node-1', n: '東京' }
  const t = { days: [{ stops: [s('a'), s('b')], stay: tokyo }, { stops: [s('c')] }], unscheduled: [s('d')] }

  it('移動、移除、復原、調整天數都不會弄丟住的地方', () => {
    expect(moveStop(t, { day: 0, idx: 0 }, { day: 1, idx: 1 }).days[0]!.stay).toEqual(tokyo)
    expect(removeStop(t, { day: 0, idx: 1 }).days[0]!.stay).toEqual(tokyo)
    expect(insertStop(t, { day: 0, idx: 0 }, s('e'))!.days[0]!.stay).toEqual(tokyo)
    const more = resizeDays(t, 3)
    expect(more.days[0]!.stay).toEqual(tokyo)
    expect('stay' in more.days[2]!).toBe(false)
  })

  it('設定、換站、清除；一樣的站不用改', () => {
    const kyoto = { st: 'node-2', n: '京都' }
    expect(setStay(t, 1, kyoto)!.days[1]!.stay).toEqual(kyoto)
    expect(setStay(t, 0, { st: 'node-1', n: '東京' })).toBeNull()
    const cleared = setStay(t, 0, null)!
    expect('stay' in cleared.days[0]!).toBe(false)
    expect(cleared.days[0]!.stops.map((x) => x.spot_id)).toEqual(['a', 'b'])
    expect(setStay(t, 5, kyoto)).toBeNull()
    // 原本的不動
    expect(t.days[0]!.stay).toEqual(tokyo)
  })

  it('讀回來的值要檢查', () => {
    expect(parseStay({ st: 'node-1', n: '東京' })).toEqual(tokyo)
    expect(parseStay({ st: '', n: 'x' })).toBeUndefined()
    expect(parseStay({ st: 3, n: 'x' })).toBeUndefined()
    expect(parseStay(null)).toBeUndefined()
  })
})
