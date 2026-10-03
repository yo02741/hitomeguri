import { describe, expect, it } from 'vitest'

import { dayIndexOn, edgeTarget, insertStop, moveStop, removeStop, type Stop } from './trip'

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
