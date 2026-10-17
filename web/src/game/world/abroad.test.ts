import { describe, expect, it } from 'vitest'

import worldRaw from '../fixtures/_world.json'
import kyotoRaw from '../fixtures/kyoto.json'

import { tileDef } from '../engine/tiles'

import { abroadLink, boardOf, ids, parseAbroad, planTo, usageOf } from './abroad'
import { parseWorldIndex, prefData } from './data'
import type { AbroadIndex, PrefRaw } from './types'
import { createWorld } from './world'
import './kits'

// 從台灣出發（P4，規格 §13 第 4 點）：世界索引的 taiwan（国土交通省的直飛航線，fixture 是整份拷過來的）、
// 出發看板的列表、路線規劃、台灣 ↔ 日本的交通、機場的大廳。

const ab = parseAbroad((worldRaw as { taiwan?: unknown }).taiwan) as AbroadIndex
const index = parseWorldIndex(worldRaw)!
const entries = new Set(index.prefs.map((p) => p.towns[0]!.id))
const nameOf = (town: string) => index.prefs.flatMap((p) => p.towns).find((t) => t.id === town)?.name.ja

describe('台灣出發的航線（世界索引的 taiwan）', () => {
  it('fixture 有三個城市；台北 23、台中 3、高雄 8 個機場；出處是国土交通省的表', () => {
    expect(ab).toBeTruthy()
    expect(index.taiwan).toBeTruthy()
    expect(ab.cities).toEqual(['台北', '台中', '高雄'])
    const n = (c: string) => ab.routes.filter((r) => r.city === c).length
    expect([n('台北'), n('台中'), n('高雄')]).toEqual([23, 3, 8])
    expect(ab.source.url).toMatch(/^https:\/\/www\.mlit\.go\.jp\//)
    expect(ab.source.season).toMatch(/ダイヤ/)
    for (const r of ab.routes) {
      expect(r.airlines.length, r.airport).toBeGreaterThan(0)
      expect(r.weekly).toBeCloseTo(r.airlines.reduce((t, a) => t + a.weekly, 0), 5)
    }
  })

  it('壞掉的、沒有的：當作沒有航線資料', () => {
    expect(parseAbroad(null)).toBe(null)
    expect(parseAbroad({ airports: [], routes: [] })).toBe(null)
    // 不是台灣的城市、對不到機場的航線丟掉
    const x = parseAbroad({ airports: [{ id: 'a', iata: 'AAA', name: 'A空港', pref: 'osaka', hall: 'own', access: [] }], routes: [{ city: '香港', airport: 'a', weekly: 1, airlines: [] }, { city: '台北', airport: 'zzz', weekly: 1, airlines: [] }] })
    expect(x).toBe(null)
    const { taiwan: _t, ...noTw } = worldRaw as Record<string, unknown>
    expect(parseWorldIndex(noTw)?.taiwan).toBeUndefined()
  })
})

describe('出發看板', () => {
  it('台中：只有那覇、成田、中部；那覇降在那覇市的機場大廳，成田坐電車到東京，中部坐電車到京都', () => {
    const rows = boardOf(ab, '台中', entries)
    expect(rows.map((r) => r.airport.name)).toEqual(['那覇空港', '成田国際空港', '中部国際空港'])
    expect(rows.map((r) => r.route.weekly)).toEqual([16, 4, 3])
    const [naha, narita, chubu] = rows
    expect(naha!.link).toMatchObject({ id: 'tw:taichung>air:OKA', to: '472018', toStop: 'airport', mode: 'plane' })
    expect(naha!.link!.legs).toEqual([{ mode: 'plane', km: 0, kmKind: 'straight', to: '那覇空港' }])
    // 成田（千葉県，不在遊戲的縣裡）：飛到成田 → 坐電車到東京（縣的入口：東京駅）
    expect(narita!.airport.pref).toBe('chiba')
    expect(narita!.town).toBe('131016')
    expect(narita!.link!.legs.map((l) => [l.mode, l.to])).toEqual([
      ['plane', '成田国際空港'],
      ['rail', '東京'],
    ])
    expect(narita!.link!.legs[1]!.km).toBeGreaterThan(50)
    expect(narita!.link!.legs[1]!.km).toBeLessThan(80)
    // 中部（愛知県）：坐電車到京都（新幹線的那一段）
    expect(chubu!.town).toBe('261068')
    expect(chubu!.link!.legs[1]).toMatchObject({ mode: 'rail', kmKind: 'rail', to: '京都', shinkansen: true })
    expect(chubu!.link!.to).toBe('261068')
  })

  it('台北：遊戲的縣裡的機場（関西、羽田、函館）降在機場的大廳；接不到遊戲的鎮的（石垣、仙台、小松…）不列', () => {
    const rows = boardOf(ab, '台北', entries)
    // 国土交通省的表上台北直飛 23 個機場；看板只列遊戲裡去得了的 7 個（規格 §13 第 4 點）
    expect(ab.routes.filter((r) => r.city === '台北').length).toBe(23)
    expect(rows.map((r) => r.airport.iata).sort()).toEqual(['CTS', 'HKD', 'HND', 'KIX', 'NGO', 'NRT', 'OKA'])
    for (const iata of ['ISG', 'SDJ', 'KMQ']) expect(rows.some((r) => r.airport.iata === iata)).toBe(false)
    const kix = rows.find((r) => r.airport.iata === 'KIX')!
    expect(kix.link).toMatchObject({ to: 'air:KIX', toStop: 'hall' })
    expect(usageOf(kix.airport)).toBe('hall')
    expect(rows.find((r) => r.airport.iata === 'CTS')!.link).toMatchObject({ to: '012246', toStop: 'airport' })
    // 每週班次多的在前
    const w = rows.map((r) => r.route.weekly)
    expect(w).toEqual([...w].sort((a, b) => b - a))
  })

  it('高雄：福岡、熊本、仙台（接不到遊戲的鎮）不列', () => {
    const rows = boardOf(ab, '高雄', entries)
    expect(ab.routes.filter((r) => r.city === '高雄').length).toBe(8)
    expect(rows.length).toBe(5)
    for (const iata of ['FUK', 'KMJ', 'SDJ']) expect(rows.some((r) => r.airport.iata === iata)).toBe(false)
  })
})

describe('想去的地方（路線規劃）', () => {
  it('台中 → 京都（下京区）：中部＋電車', () => {
    const p = planTo(ab, '台中', '261068')
    expect(p.map((x) => x.airport.iata)).toEqual(['NGO'])
    expect(p[0]!.legs.map((l) => [l.mode, l.to])).toEqual([['rail', '京都']])
    expect(p[0]!.link.id).toBe(ids.route('台中', 'NGO', '261068'))
    expect(p[0]!.plan).toBe(false)
  })

  it('台中 → 東京（千代田区）：成田＋電車；台中 → 那覇市：直飛；台中 → 北海道：沒有', () => {
    expect(planTo(ab, '台中', '131016').map((x) => [x.airport.iata, x.legs.length])).toEqual([['NRT', 1]])
    const naha = planTo(ab, '台中', '472018')
    expect(naha.map((x) => [x.airport.iata, x.km, x.legs.length])).toEqual([['OKA', 0, 0]])
    expect(planTo(ab, '台中', '012246')).toEqual([])
    // 沖繩的別的鎮：那覇空港＋巴士（之後在那覇市的巴士站坐；要記下想去的地方）
    const nago = planTo(ab, '台中', '472093')
    expect(nago[0]!.legs.map((l) => l.mode)).toEqual(['bus'])
    expect(nago[0]!.plan).toBe(true)
    expect(nago[0]!.link.id).toBe('tw:taichung>air:OKA')
  })

  it('台北 → 大阪（北区）：関西（大廳＋電車）在前，中部在後；日本這一段近的在前', () => {
    const p = planTo(ab, '台北', '271276')
    expect(p[0]!.airport.iata).toBe('KIX')
    expect(p[0]!.plan).toBe(true)
    expect(p.map((x) => x.km)).toEqual([...p.map((x) => x.km)].sort((a, b) => a - b))
    expect(p.some((x) => x.airport.iata === 'NGO')).toBe(true)
  })
})

describe('台灣 ↔ 日本、機場的大廳 ↔ 鎮的交通', () => {
  it('回台灣：機場有直飛的城市才有；那覇空港是那覇市的機場大廳出發', () => {
    expect(abroadLink(ab, ids.home('KIX', '台北'))).toMatchObject({ from: 'air:KIX', fromStop: 'hall', to: 'tw:taipei', toStop: 'hall', mode: 'plane', name: '台北' })
    expect(abroadLink(ab, ids.home('KIX', '台中'))).toBe(null)
    expect(abroadLink(ab, ids.home('OKA', '台中'))).toMatchObject({ from: '472018', fromStop: 'airport', to: 'tw:taichung' })
    // 成田沒有大廳：回不了（從遊戲裡到不了成田）
    expect(abroadLink(ab, ids.home('NRT', '台中'))).toBe(null)
  })

  it('不認得的、資料沒有的：null', () => {
    expect(abroadLink(ab, 'tw:taichung>air:KIX')).toBe(null)
    expect(abroadLink(ab, 'tw:taipei>air:ISG')).toBe(null)
    expect(abroadLink(ab, 'tw:taipei>air:NRT')).toBe(null)
    expect(abroadLink(ab, 'tw:taipei>air:NRT>261068')).toBe(null)
    expect(abroadLink(ab, '261068.main>271276.main')).toBe(null)
    expect(abroadLink(ab, 'x>y>z>w')).toBe(null)
  })

  it('機場的大廳的剪票口 → 鎮、鎮的剪票口 → 機場的大廳：一樣的鐵路 km', () => {
    const go = abroadLink(ab, ids.gate('KIX', '271276'))!
    const back = abroadLink(ab, ids.toAirport('271276', 'KIX'))!
    expect(go).toMatchObject({ from: 'air:KIX', to: '271276', toStop: 'main', mode: 'rail', name: '大阪' })
    expect(back).toMatchObject({ from: '271276', fromStop: 'main', to: 'air:KIX', toStop: 'hall', name: '関西国際空港' })
    expect(back.legs[0]!.km).toBe(go.legs[0]!.km)
    // 函館空港：沒有車站，巴士到函館市
    expect(abroadLink(ab, ids.gate('HKD', '012025'))).toMatchObject({ mode: 'bus', name: nameOf('012025') })
  })
})

describe('機場的大廳（world 的地圖）', () => {
  const world = createWorld([prefData(kyotoRaw as unknown as PrefRaw)], { index })

  it('台灣的出發大廳：報到櫃台、出發看板、登機門（都打開出發看板）；沒有出口', () => {
    const m = world.mapSource('tw:taichung')!
    expect(m).toBeTruthy()
    expect(m.name.ja).toBe('台中')
    const travel = m.entities.filter((e) => e.kind === 'travel')
    expect(travel.map((e) => e.id.split(':').pop())).toEqual(['counter', 'counter2', 'board', 'board2', 'gate'])
    for (const e of travel) expect(e.data).toMatchObject({ abroad: { kind: 'board', place: 'tw:taichung' } })
    // 出發看板在裡面的牆上：看板下面那一格是空的地板（走得到）；登機門是一個人站的小櫃台，不是電車的售票機、剪票口
    const name = (layer: Uint16Array, x: number, y: number) => tileDef(layer[y * m.w + x] ?? 0)?.name ?? ''
    for (const e of travel.filter((x) => x.id.includes(':board'))) {
      expect(name(m.ground, e.x, e.y)).toBe('world/wall-board')
      expect(name(m.ground, e.x, e.y + 1)).toBe('world/tile')
      expect(name(m.lower, e.x, e.y + 1)).toBe('')
    }
    const gate = travel.find((e) => e.id.endsWith(':gate'))!
    expect(name(m.lower, gate.x, gate.y + 1)).toBe('world/counter-white')
    const lowers = new Set(Array.from(m.lower, (id) => tileDef(id)?.name ?? ''))
    expect(lowers.has('world/ticket')).toBe(false)
    expect(lowers.has('world/gate')).toBe(false)
    expect(m.warps).toEqual([])
    expect(world.abroadStart('台中')).toMatchObject({ map: 'tw:taichung', dir: 'up' })
    expect(world.abroadStart()).toMatchObject({ map: 'tw:taipei' })
    // 資料沒有的城市、機場：沒有大廳
    expect(world.mapSource('tw:tainan')).toBe(null)
  })

  it('日本的機場大廳：関西、羽田、函館才有（成田、中部、石垣沒有）；國際線櫃台、賣店（能刷卡）、剪票口', () => {
    for (const k of ['KIX', 'HND', 'HKD']) expect(world.mapSource(`air:${k}`), k).toBeTruthy()
    for (const k of ['NRT', 'NGO', 'ISG', 'OKA']) expect(world.mapSource(`air:${k}`), k).toBe(null)
    const m = world.mapSource('air:KIX')!
    expect(m.name.ja).toBe('関西国際空港')
    expect(m.entities.find((e) => e.kind === 'shop')?.data).toMatchObject({ shopKind: 'station', pref: 'osaka' })
    expect(m.entities.find((e) => e.id === 'air:KIX:intl')?.data).toMatchObject({ abroad: { kind: 'intl' } })
    expect(m.entities.find((e) => e.id === 'air:KIX:gate')?.data).toMatchObject({ mode: 'rail', abroad: { kind: 'gate' } })
    expect(world.mapSource('air:HKD')!.entities.find((e) => e.id === 'air:HKD:gate')?.data).toMatchObject({ mode: 'bus' })
    // 到了站的地方
    const l = world.linkById('tw:taipei>air:KIX')!
    expect(world.arrival(l)).toMatchObject({ map: 'air:KIX' })
  })

  it('鎮的生成不變：京都駅的剪票口還是原本的目的地（機場的大廳是打開面板時才加）', () => {
    const hall = world.generate('261068')!.interiors.get('int:261068:station:0')!
    const dests = (hall.entities.find((e) => e.kind === 'travel')!.data as { dests: { town: string }[] }).dests
    expect(dests.some((d) => d.town.startsWith('air:'))).toBe(false)
  })
})
