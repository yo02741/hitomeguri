import { describe, expect, it } from 'vitest'

import { dayIndexOn, dayRouteUrls, edgeTarget, fromHereUrl, insertStop, MAPS_URL_MAX, moveStop, removeStop, type Stop } from './trip'

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

  it('已經在這趟裡就不動', () => {
    expect(insertStop(t, { day: 1, idx: 0 }, s('a'))).toBeNull()
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
