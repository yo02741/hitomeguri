import { describe, expect, it } from 'vitest'

import { insertStop, removeStop, type Stop } from './trip'

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
