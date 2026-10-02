import { describe, expect, it } from 'vitest'

import { ACHIEVEMENTS, ACHV_RULES, type AchvDef } from '../data/achievements'
import { AREA_ZH, areaPrefs, regions } from '../data/regions'
import type { Mark } from '../stores/marks'
import {
  type AchvState,
  type Bound,
  derive,
  diffDays,
  diffKnown,
  evaluate,
  inTrip,
  kthDate,
  minBound,
  occasions,
  paidCount,
  prefStamps,
  recordedTrips,
  tiltOf,
} from './achievements'
import type { AchvData } from './bundles'
import { dayDate, type Stop, type Trip } from './trip'

// ---- 測試資料 ----

type Visit = [id: string, pref: string, date?: string | null]

function mk(visits: Visit[]): Record<string, Mark> {
  const out: Record<string, Mark> = {}
  for (const [id, pref, date] of visits) out[id] = { pref, name: id, visited: true, ...(date ? { visited_on: date } : {}) }
  return out
}

/** 和 composables/visited.ts 同樣的建法 */
function input(marks: Record<string, Mark>, doneTrips: Trip[] = [], data: AchvData | null = null) {
  const entries = new Map<string, Mark>()
  for (const t of doneTrips) {
    t.days.forEach((d, i) => {
      for (const s of d.stops) if (!entries.has(s.spot_id)) entries.set(s.spot_id, { pref: s.pref, name: s.name, visited: true, visited_on: dayDate(t, i) })
    })
  }
  for (const [id, m] of Object.entries(marks)) entries.set(id, { ...m, visited_on: m.visited_on ?? entries.get(id)?.visited_on })
  const datesById = new Map<string, Array<string | null>>()
  const add = (id: string, d: string | null) => {
    const list = datesById.get(id) ?? []
    if (!list.includes(d)) list.push(d)
    datesById.set(id, list)
  }
  for (const t of doneTrips) t.days.forEach((d, i) => d.stops.forEach((s) => add(s.spot_id, dayDate(t, i) ?? null)))
  for (const [id, m] of Object.entries(marks)) if (m.visited_on || !datesById.has(id)) add(id, m.visited_on ?? null)
  return { entries: [...entries.entries()], datesById, doneTrips, data }
}

const stop = (id: string, pref: string): Stop => ({ type: 'catalog', spot_id: id, pref, name: id })

function trip(id: string, start: string | undefined, end: string | undefined, days: Stop[][], extra: Partial<Trip> = {}): Trip {
  return {
    id,
    name: '',
    start_date: start,
    end_date: end,
    days: days.map((stops) => ({ stops })),
    unscheduled: [],
    owner: 'u',
    members: ['u'],
    member_info: {},
    created: 0,
    ...extra,
  }
}

function run(marks: Record<string, Mark>, doneTrips: Trip[] = [], data: AchvData | null = null) {
  const d = derive(input(marks, doneTrips, data))
  const states = evaluate(d)
  const by = new Map(states.map((s) => [s.def.id, s]))
  return { d, states, get: (id: string) => by.get(id)! }
}

const b = (lo: string | null, hi: string | null = lo): Bound => ({ lo, hi })

const DATA: AchvData = {
  tags: { 世界遺產: ['wd-A', 'wd-B'], 國寶: ['wd-A', 'wd-C'], 特別史跡: [], 特別名勝: [] },
  castle: {
    '100': Array.from({ length: 100 }, (_, i) => [`castle-${String(i + 1).padStart(3, '0')}`, `wd-castle${i + 1}`] as [string, string | null]),
    zoku: Array.from({ length: 97 }, (_, i) => [`castle-${101 + i}`, i === 22 ? null : `wd-zoku${i}`] as [string, string | null]),
  },
}

/** n 個景點，第 i 個在 2024-01-01 + i 天 */
function spots(n: number, pref = 'kyoto', prefix = 'wd-S'): Visit[] {
  return Array.from({ length: n }, (_, i) => [`${prefix}${i}`, pref, new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10)])
}

// ---- 上下界 ----

describe('kthDate', () => {
  it('都有日期：第 k 個', () => {
    expect(kthDate([b('2024-03-01'), b('2024-01-01'), b('2024-02-01')], 2)).toBe('2024-02-01')
    expect(kthDate([b('2024-03-01'), b('2024-01-01')], 3)).toBeNull()
  })
  it('1 個沒日期、影響不到第 k 個：照樣確定', () => {
    // 第 3 個單位有一次沒日期的造訪、另一次是 2023-12-01：不管哪天，它都在 2023-12-01 以前
    const units = [b('2024-01-01'), b('2024-02-01'), b(null, '2023-12-01')]
    expect(kthDate(units, 3)).toBe('2024-02-01')
    expect(kthDate(units, 2)).toBe('2024-01-01')
    expect(kthDate(units, 1)).toBeNull()
  })
  it('1 個沒日期、影響第 k 個：null', () => {
    const units = [b('2024-01-01'), b('2024-02-01'), b(null, null)]
    expect(kthDate(units, 3)).toBeNull()
    expect(kthDate(units, 1)).toBeNull()
  })
  it('沒日期但上界早於第 k 個：第 k 個不受影響', () => {
    const units = [b('2024-05-01'), b('2024-06-01'), b(null, '2024-01-01')]
    expect(kthDate(units, 2)).toBe('2024-05-01')
    expect(kthDate(units, 3)).toBe('2024-06-01')
    expect(kthDate(units, 1)).toBeNull()
  })
  it('縣有部分沒日期（prefFirst 的 lo=null）', () => {
    const { d } = run(mk([['a', 'kyoto', '2024-05-01'], ['b', 'kyoto', null], ['c', 'nara', '2024-04-01']]))
    expect(d.prefFirst.get('kyoto')).toEqual({ lo: null, hi: '2024-05-01' })
    // 兩縣都去過的那天：奈良 04-01、京都在 05-01 以前 → 最大的那個在 [04-01, 05-01] 之間，不確定
    expect(kthDate([d.prefFirst.get('kyoto')!, d.prefFirst.get('nara')!], 2)).toBeNull()
    // 京都的某個沒日期的造訪不影響「至少一縣」的上界，但下界不確定
    expect(kthDate([d.prefFirst.get('kyoto')!, d.prefFirst.get('nara')!], 1)).toBeNull()
  })
})

describe('minBound', () => {
  it('取最早；任一下界不知道就是不知道', () => {
    expect(minBound([b('2024-03-01'), b('2024-01-01')])).toEqual(b('2024-01-01'))
    expect(minBound([b('2024-03-01'), b(null, null)])).toEqual({ lo: null, hi: '2024-03-01' })
    expect(minBound([b(null, null)])).toEqual({ lo: null, hi: null })
  })
  it('名城：用名城 id 或景點 id 標，各只算一座，日期取較早的', () => {
    const { get } = run(mk([['castle-001', 'hokkaido', '2024-05-01'], ['wd-castle1', 'hokkaido', '2024-03-01'], ['wd-castle2', 'aomori', '2024-04-01']]), [], DATA)
    const s = get('castle100-10')
    expect(s.have).toBe(2)
    expect(s.items.map((c) => c.date)).toEqual(['2024-03-01', '2024-04-01'])
  })
})

// ---- 門檻 ----

describe('門檻', () => {
  it('足跡 9 和 10', () => {
    expect(run(mk(spots(9))).get('spots-10').status).toBe('locked')
    const ten = run(mk(spots(10))).get('spots-10')
    expect(ten.status).toBe('done')
    expect(ten.at).toBe('2024-01-10')
  })
  it('都道府縣 47 要全部', () => {
    const all = regions.map((r, i): Visit => [`wd-P${i}`, r.prefecture, '2024-01-01'])
    expect(run(mk(all.slice(0, 46))).get('prefs-47').status).toBe('locked')
    expect(run(mk(all)).get('prefs-47').status).toBe('done')
    expect(run(mk(all)).get('prefs-47').at).toBe('2024-01-01')
  })
  it('日本100名城 100 城不計続日本100名城', () => {
    const hundred = DATA.castle['100'].slice(0, 99).map((c): Visit => [c[0], 'tokyo', '2024-01-01'])
    const zoku = DATA.castle.zoku.slice(0, 10).map((c): Visit => [c[0], 'tokyo', '2024-01-01'])
    const r = run(mk([...hundred, ...zoku]), [], DATA)
    expect(r.get('castle100-100').status).toBe('locked')
    expect(r.get('castle100-100').have).toBe(99)
    expect(r.get('zoku-10').status).toBe('done')
  })
  it('沒有 achievements.json 時，data 的成就是 unknown', () => {
    const r = run(mk(spots(3)))
    expect(r.get('heritage-1').status).toBe('unknown')
    expect(r.get('castle100-10').status).toBe('unknown')
    expect(r.get('spots-10').status).toBe('locked')
  })
  it('文化指定：一個景點有幾種指定，每種都算', () => {
    const r = run(mk([['wd-A', 'nara', '2024-02-01']]), [], DATA)
    expect(r.get('heritage-1').status).toBe('done')
    expect(r.get('kokuho-1').status).toBe('done')
    expect(r.get('kokuho-1').at).toBe('2024-02-01')
  })
  it('擴充包：只看 id 前綴', () => {
    const r = run(mk([['pokecen-node-1', 'tokyo', '2024-01-01'], ['pokefuta-3', 'chiba', null]]))
    expect(r.get('pokecen').status).toBe('done')
    expect(r.get('pokefuta-1').status).toBe('done')
    expect(r.get('pokefuta-1').at).toBeNull()
    expect(r.get('pokefuta-1').undated).toBe(1)
  })
})

describe('地方', () => {
  it('關東少東京就不成立', () => {
    const kanto = areaPrefs('kanto').filter((p) => p !== 'tokyo').map((p, i): Visit => [`wd-K${i}`, p, `2024-01-0${i + 1}`])
    const s = run(mk(kanto)).get('area-kanto')
    expect(s.status).toBe('locked')
    expect(s.note).toBe('還沒去：東京')
    const done = run(mk([...kanto, ['wd-T', 'tokyo', '2024-02-01']])).get('area-kanto')
    expect(done.status).toBe('done')
    expect(done.at).toBe('2024-02-01')
  })
  it('名稱', () => {
    const name = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!.name
    expect(name('area-kanto')).toBe('關東 1 都 6 縣')
    expect(name('area-kinki')).toBe('近畿 2 府 5 縣')
    expect(name('area-chugoku')).toBe('中國地方 5 縣')
    expect(name('area-tohoku')).toBe('東北 6 縣')
    expect(ACHIEVEMENTS.some((a) => a.id === 'area-hokkaido')).toBe(false)
  })
  it('差 4 縣以上寫 x / n', () => {
    const s = run(mk([['wd-1', 'aomori', null]])).get('area-tohoku')
    expect(s.note).toBeUndefined()
    expect([s.have, s.need]).toEqual([1, 6])
  })
})

describe('時節', () => {
  it('12、1、2 月算冬', () => {
    const r = run(mk([['a', 'kyoto', '2023-12-05'], ['b', 'kyoto', '2024-01-05'], ['c', 'kyoto', '2024-02-05']]))
    expect(r.get('seasons-4').have).toBe(1)
  })
  it('四季的達成日是第 4 個季節第一次出現那天', () => {
    const r = run(mk([['a', 'kyoto', '2024-04-01'], ['b', 'kyoto', '2024-07-01'], ['c', 'kyoto', '2024-10-01'], ['d', 'kyoto', '2025-01-15'], ['e', 'kyoto', '2025-02-01']]))
    const s = r.get('seasons-4')
    expect(s.status).toBe('done')
    expect(s.at).toBe('2025-01-15')
  })
  it('年份', () => {
    const r = run(mk([['a', 'kyoto', '2020-04-01'], ['b', 'kyoto', '2022-07-01'], ['c', 'kyoto', '2022-01-01'], ['d', 'kyoto', '2024-10-01'], ['e', 'kyoto', null]]))
    expect(r.get('years-3').at).toBe('2024-10-01')
    expect(r.get('years-10').have).toBe(3)
  })
})

describe('再訪、同一縣 3 次', () => {
  it('occasions：29 天是同一次、30 天是另一次', () => {
    expect(occasions(['2024-01-01', '2024-01-30'])).toEqual(['2024-01-01'])
    expect(occasions(['2024-01-01', '2024-01-31'])).toEqual(['2024-01-01', '2024-01-31'])
    expect(diffDays('2024-01-01', '2024-01-31')).toBe(30)
  })
  it('同一趟連續兩天排了同一個點不算再訪', () => {
    const t = trip('t1', '2024-03-01', '2024-03-02', [[stop('hotel', 'kyoto')], [stop('hotel', 'kyoto')]])
    expect(run({}, [t]).get('revisit').status).toBe('locked')
  })
  it('相隔 30 天以上再去', () => {
    const t = trip('t1', '2024-03-01', '2024-03-01', [[stop('wd-X', 'kyoto')]])
    const s = run(mk([['wd-X', 'kyoto', '2024-05-01']]), [t]).get('revisit')
    expect(s.status).toBe('done')
    expect(s.at).toBe('2024-05-01')
  })
  it('同一縣 3 次', () => {
    const two = run(mk([['a', 'kyoto', '2024-01-01'], ['b', 'kyoto', '2024-03-01'], ['c', 'nara', '2024-06-01']])).get('pref-3times')
    expect(two.status).toBe('locked')
    expect(two.note).toBe('京都 2 / 3')
    const three = run(mk([['a', 'kyoto', '2024-01-01'], ['b', 'kyoto', '2024-03-01'], ['c', 'kyoto', '2024-03-20'], ['d', 'kyoto', '2024-06-01']])).get('pref-3times')
    expect(three.status).toBe('done')
    expect(three.at).toBe('2024-06-01')
  })
})

describe('旅行', () => {
  it('只有待排、沒有停留點的行程不算', () => {
    const empty = trip('t0', '2024-01-01', '2024-01-02', [[], []], { unscheduled: [stop('a', 'kyoto')] })
    const real = trip('t1', '2024-02-01', undefined, [[stop('b', 'nara')]])
    expect(recordedTrips([empty, real]).map((t) => t.id)).toEqual(['t1'])
    const s = run({}, [empty, real]).get('trips-1')
    expect(s.status).toBe('done')
    expect(s.at).toBe('2024-02-01')
  })
  it('一趟 5 縣不算待排', () => {
    const t = trip('t1', '2024-01-01', '2024-01-02', [[stop('a', 'kyoto'), stop('b', 'nara')], [stop('c', 'osaka'), stop('d', 'hyogo')]], {
      unscheduled: [stop('e', 'shiga')],
    })
    const s = run({}, [t]).get('trip-5prefs')
    expect(s.status).toBe('locked')
    expect(s.have).toBe(4)
  })
  it('只有開始日的行程是 1 天；7 天以上', () => {
    const one = trip('t1', '2024-01-01', undefined, [[stop('a', 'kyoto')]])
    expect(run({}, [one]).get('trip-7days').have).toBe(1)
    const week = trip('t2', '2024-03-01', '2024-03-07', [[stop('a', 'kyoto')], [], [], [], [], [], []])
    const s = run({}, [one, week]).get('trip-7days')
    expect(s.status).toBe('done')
    expect(s.at).toBe('2024-03-07')
  })
  it('共編', () => {
    const t = trip('t1', '2024-01-01', '2024-01-02', [[stop('a', 'kyoto')]], { members: ['u', 'v'] })
    expect(run({}, [t]).get('trip-shared').at).toBe('2024-01-02')
  })
})

describe('取消去過', () => {
  it('拿掉一筆 → 成就消失、給券的變少；加回來 → 完全一樣', () => {
    const tohoku = areaPrefs('tohoku').map((p, i): Visit => [`wd-T${i}`, p, `2024-0${i + 1}-01`])
    const full = run(mk(tohoku))
    expect(full.get('area-tohoku').status).toBe('done')
    const minus = run(mk(tohoku.slice(1)))
    expect(minus.get('area-tohoku').status).toBe('locked')
    expect(paidCount(minus.states)).toBe(paidCount(full.states) - 1)
    const back = run(mk(tohoku))
    expect(back.states).toEqual(full.states)
  })
  it('給券的只算 core', () => {
    const r = run(mk([['wd-A', 'nara', '2024-02-01']]), [], DATA)
    expect(r.get('heritage-1').status).toBe('done')
    expect(paidCount(r.states)).toBe(0)
  })
})

describe('diffKnown', () => {
  const empty = { v: 1 as const, deps: [], ids: [] }
  it('第一次 ready：靜靜建基準', () => {
    const r = diffKnown(empty, { core: ['area-tohoku', 'pref-aomori'], data: [] }, { core: true, data: false })
    expect(r.fresh).toEqual([])
    expect(r.known.deps).toEqual(['core'])
    expect(r.known.ids.sort()).toEqual(['area-tohoku', 'pref-aomori'])
  })
  it('還沒 ready：不動', () => {
    const r = diffKnown(empty, { core: ['a'], data: ['b'] }, { core: false, data: false })
    expect(r.known).toEqual(empty)
    expect(r.fresh).toEqual([])
  })
  it('data 另外建基準', () => {
    const k1 = diffKnown(empty, { core: ['a'], data: [] }, { core: true, data: false }).known
    const r = diffKnown(k1, { core: ['a'], data: ['heritage-1'] }, { core: true, data: true })
    expect(r.fresh).toEqual([])
    expect(r.known.deps).toEqual(['core', 'data'])
    const r2 = diffKnown(r.known, { core: ['a', 'b'], data: ['heritage-1', 'kokuho-1'] }, { core: true, data: true })
    expect(r2.fresh).toEqual(['b', 'kokuho-1'])
  })
  it('失去再得到不會再 fresh', () => {
    const k1 = diffKnown(empty, { core: [], data: [] }, { core: true, data: false }).known
    const k2 = diffKnown(k1, { core: ['trips-1'], data: [] }, { core: true, data: false })
    expect(k2.fresh).toEqual(['trips-1'])
    const lost = diffKnown(k2.known, { core: [], data: [] }, { core: true, data: false })
    expect(lost.fresh).toEqual([])
    const again = diffKnown(lost.known, { core: ['trips-1'], data: [] }, { core: true, data: false })
    expect(again.fresh).toEqual([])
  })
  it('擴充包隱藏時照樣比對（比對的是全部，不是畫面上的）', () => {
    const k1 = diffKnown(empty, { core: [], data: [] }, { core: true, data: false }).known
    const r = diffKnown(k1, { core: ['pokefuta-1'], data: [] }, { core: true, data: false })
    expect(r.fresh).toEqual(['pokefuta-1'])
  })
  it('opened 保留', () => {
    const r = diffKnown({ ...empty, opened: true }, { core: ['a'], data: [] }, { core: true, data: false })
    expect(r.known.opened).toBe(true)
  })
})

describe('inTrip', () => {
  it('開始日與結束日都算在內', () => {
    const t = trip('t1', '2024-03-01', '2024-03-03', [[stop('a', 'aomori')], [], [stop('c', 'iwate')]])
    const { d, states } = run(mk([['x', 'akita', '2024-02-28']]), [t])
    const stamps = prefStamps(d)
    const r = inTrip(states, stamps, t)
    expect(r.stamps.map((s) => s.pref).sort()).toEqual(['aomori', 'iwate'])
    expect(r.seals.map((s) => s.def.id)).toContain('trips-1')
    const at = (id: string): AchvState => states.find((s) => s.def.id === id)!
    expect(at('trips-1').at).toBe('2024-03-03')
  })
})

describe('初訪章', () => {
  it('47 格；沒日期的縣不寫日期', () => {
    const { d } = run(mk([['a', 'kyoto', null], ['b', 'nara', '2024-01-01']]))
    const stamps = prefStamps(d)
    expect(stamps).toHaveLength(47)
    expect(stamps.find((s) => s.pref === 'kyoto')).toMatchObject({ done: true, at: null, undated: 1 })
    expect(stamps.find((s) => s.pref === 'nara')).toMatchObject({ done: true, at: '2024-01-01', undated: 0 })
    expect(stamps.find((s) => s.pref === 'tokyo')?.done).toBe(false)
  })
})

describe('tiltOf', () => {
  it('−8..8，依 id 固定', () => {
    for (const a of ACHIEVEMENTS) {
      const t = tiltOf(a.id)
      expect(t).toBeGreaterThanOrEqual(-8)
      expect(t).toBeLessThanOrEqual(8)
      expect(tiltOf(a.id)).toBe(t)
    }
  })
})

// ---- 目錄 ----

describe('目錄', () => {
  it('40 個，id 唯一、kebab-case', () => {
    expect(ACHIEVEMENTS).toHaveLength(40)
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
  it('給券的一律是 core，總和 95', () => {
    const paid = ACHIEVEMENTS.filter((a) => a.tickets > 0)
    expect(paid.every((a) => a.dep === 'core')).toBe(true)
    expect(paid.every((a) => ['area', 'trip', 'time'].includes(a.group))).toBe(true)
    expect(paid.reduce((n, a) => n + a.tickets, 0)).toBe(95)
  })
  it('data 的只有 tag／castle 規則', () => {
    for (const a of ACHIEVEMENTS) expect(a.dep === 'data').toBe(a.rule.kind === 'tag' || a.rule.kind === 'castle')
  })
  it('文案：不稱讚、不加驚嘆號、不加 emoji', () => {
    const texts = [
      ...ACHIEVEMENTS.flatMap((a: AchvDef) => [a.name, a.hint, a.face.main, a.face.sub ?? '']),
      ...ACHV_RULES.flatMap((r) => [r.title, ...r.items]),
      ...Object.values(AREA_ZH),
    ]
    for (const t of texts) {
      expect(t).not.toMatch(/[!！?？]/)
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(t).not.toContain('您')
      expect(t).not.toContain('讓我們')
    }
  })
})
