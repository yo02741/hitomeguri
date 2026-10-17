import { describe, expect, it } from 'vitest'

import { buildGraph, round1, search } from '../../services/daytrip'

import worldRaw from '../fixtures/_world.json'
import hokkaidoRaw from '../fixtures/hokkaido.json'
import hyogoRaw from '../fixtures/hyogo.json'
import kyotoRaw from '../fixtures/kyoto.json'
import naraRaw from '../fixtures/nara.json'
import okinawaRaw from '../fixtures/okinawa.json'
import osakaRaw from '../fixtures/osaka.json'
import tokyoRaw from '../fixtures/tokyo.json'
import type { GameMap } from '../engine/types'
import { tileDef } from '../engine/tiles'

import { parseWorldIndex, prefData } from './data'
import { kmBetween } from './geo'
import { bloomAt, climateOf, seasonAt, weatherAt } from './season'
import { buildWorld, KIT_OF, kitOf, selectTowns, TOWN_RULES } from './towns'
import type { PrefData, PrefRaw, Town, TravelData } from './types'
import { createWorld } from './world'
import './kits'

/**
 * P3（規格 §12）：世界索引（pipeline/game_world.py 選的鎮與縣之間的交通）、五縣的鎮、延遲加縣、季節。
 * 只讀 fixture（CI 沒有 bundles）；本機有 web/public/bundles 時另外拿整份資料對 pipeline 的選鎮與 km。
 */
const raw = (x: unknown) => prefData(x as PrefRaw)
const index = parseWorldIndex(worldRaw)!
const FIX: Record<string, unknown> = { kyoto: kyotoRaw, okinawa: okinawaRaw, nara: naraRaw, osaka: osakaRaw, hyogo: hyogoRaw, tokyo: tokyoRaw, hokkaido: hokkaidoRaw }
const P3 = ['nara', 'osaka', 'hyogo', 'tokyo', 'hokkaido'] as const
const all = () => Object.keys(FIX).map((p) => raw(FIX[p]))
const pinnedOf = (pref: string) => index.prefs.find((p) => p.pref === pref)!.towns
const brief = (t: Town) => ({ id: t.id, station: t.station, stops: t.stops.map((s) => s.id), island: t.island })

const nameOf = (id: number) => (id ? (tileDef(id)?.name ?? `?${id}`) : '')
/** 鎮的地圖（三層 tile、行為、warp、實體）；travel 的實體另外比 */
function mapText(m: GameMap, skipTravel: boolean): string {
  const layer = (a: Uint16Array) => Array.from(a, nameOf).join('|')
  const ents = m.entities.filter((e) => !(skipTravel && e.kind === 'travel'))
  return [m.id, m.w, m.h, layer(m.ground), layer(m.lower), layer(m.over), Array.from(m.beh).join(','), JSON.stringify(m.warps), JSON.stringify(ents)].join('\n')
}

describe('世界索引', () => {
  it('7 縣、起點京都、每縣最多 9 鎮、kit 照 KIT_OF', () => {
    expect(index.v).toBe(1)
    expect(index.start).toBe('kyoto')
    expect(index.prefs.map((p) => p.pref)).toEqual(['kyoto', 'okinawa', 'nara', 'osaka', 'hyogo', 'tokyo', 'hokkaido'])
    for (const p of index.prefs) {
      expect(p.towns.length, p.pref).toBeLessThanOrEqual(9)
      expect(p.towns.length, p.pref).toBeGreaterThanOrEqual(6)
      expect(p.kit, p.pref).toBe(kitOf(p.pref))
    }
    expect(KIT_OF).toMatchObject({ okinawa: 'okinawa', tokyo: 'kanto', hokkaido: 'hokkaido' })
    expect(['nara', 'osaka', 'hyogo'].map(kitOf)).toEqual(['kinki', 'kinki', 'kinki'])
  })

  it('起點（規格 §12）：奈良市（近鉄奈良）、大阪北区（大阪）、神戸中央区（三ノ宮）、千代田区（東京）、千歳市（新千歳空港）＋札幌', () => {
    const first = (pref: string) => pinnedOf(pref)[0]!
    expect([first('nara').name.ja, first('nara').station.name]).toEqual(['奈良市', '近鉄奈良'])
    expect([first('osaka').name.ja, first('osaka').station.name]).toEqual(['北区', '大阪'])
    expect([first('hyogo').name.ja, first('hyogo').station.name]).toEqual(['中央区', '三ノ宮'])
    expect([first('tokyo').name.ja, first('tokyo').station.name]).toEqual(['千代田区', '東京'])
    const hk = pinnedOf('hokkaido')
    expect(hk[0]!.name.ja).toBe('千歳市')
    expect(hk[0]!.stops.find((s) => s.id === 'airport')?.name).toBe('新千歳空港')
    expect(hk[1]).toMatchObject({ id: '011011', city: '札幌市' })
    for (const p of P3) expect(TOWN_RULES[p]?.start, p).toBe(first(p).id)
  })

  it('京都、沖繩：pipeline 選的鎮＝這裡照規則選的（同一份 fixture，pinned 跟不 pinned 一樣）', () => {
    for (const pref of ['kyoto', 'okinawa']) {
      const p = raw(FIX[pref])
      const mine = selectTowns(p)
      expect(mine.map((t) => [t.id, t.station.id, t.station.kind]), pref).toEqual(pinnedOf(pref).map((t) => [t.id, t.station.id, t.station.kind]))
      expect(mine.map((t) => t.stops.map((s) => s.id)), pref).toEqual(pinnedOf(pref).map((t) => t.stops.map((s) => s.id)))
      // pinned 建出來的鎮跟自己選的一模一樣（地標、街上或郊外、外框）
      expect(selectTowns(p, TOWN_RULES[pref], pinnedOf(pref))).toEqual(mine)
    }
  })

  it('名城的鎮最多 4 個（兵庫有 8 座名城）；北海道只放 1 個', () => {
    const castleTowns = (pref: string) => {
      const p = raw(FIX[pref])
      const spots = new Set(p.castles.filter((c) => c.s && c.st?.length).map((c) => c.s!))
      const codes = new Set(p.spots.filter((s) => spots.has(s.id)).map((s) => s.m))
      return pinnedOf(pref).filter((t) => codes.has(t.id)).length
    }
    for (const pref of P3) expect(castleTowns(pref), pref).toBeLessThanOrEqual(TOWN_RULES[pref]!.maxCastles!)
    expect(castleTowns('hyogo')).toBe(4)
    expect(castleTowns('hokkaido')).toBe(1)
    // 奈良的 3 座名城都放：高取城在山上（景點 1.5 km 內沒有車站），代表站是高取町 2 km 內的市尾（castleStationKm）
    expect(castleTowns('nara')).toBe(3)
    const takatori = pinnedOf('nara').find((t) => t.id === '294012')
    expect(takatori?.station.name).toBe('市尾')
    expect(TOWN_RULES.kyoto!.castleStationKm).toBeUndefined()
  })

  it('P3 的縣的資料：別的縣的料理（冷やしラーメン）、泡麵不當地區特色；是餐廳的茶屋不放；出處不是評論網站', () => {
    const hk = raw(FIX.hokkaido)
    expect(hk.specialties.map((s) => s.id)).not.toContain('hokkaido-Q11395303')
    expect(hk.specialties.some((s) => /インスタント|袋麺/.test(s.summary?.text ?? ''))).toBe(false)
    for (const pref of P3) {
      const p = raw(FIX[pref])
      for (const x of p.shinise) {
        if (x.g === 'teahouse') expect(x.n, pref).not.toMatch(/どんぶり|丼|うなぎ|鰻|海鮮|料理|なか卯/)
        expect(x.u ?? '', `${pref} ${x.n}`).not.toMatch(/tabelog\.com/)
      }
    }
  })

  it('北海道的鎮分散：起點與札幌之外，兩鎮至少隔 30 km、半徑 120 km 內最多 3 鎮、札幌一區', () => {
    const towns = pinnedOf('hokkaido')
    expect(towns.filter((t) => t.city === '札幌市').length).toBe(1)
    for (const a of towns.slice(2)) {
      for (const b of towns) if (a !== b) expect(kmBetween(a.center, b.center), `${a.name.ja}–${b.name.ja}`).toBeGreaterThanOrEqual(30)
      expect(towns.filter((b) => kmBetween(a.center, b.center) <= 120).length, a.name.ja).toBeLessThanOrEqual(3)
    }
    // 札幌一帶（中央区 80 km 內）不超過 3 鎮
    const sapporo = towns[1]!.center
    expect(towns.filter((t) => kmBetween(t.center, sapporo) <= 80).length).toBeLessThanOrEqual(3)
  })

  it('代表站不重複', () => {
    for (const p of index.prefs) {
      const ids = p.towns.filter((t) => t.station.kind === 'rail' || t.station.kind === 'monorail').map((t) => t.station.id)
      expect(new Set(ids).size, p.pref).toBe(ids.length)
    }
  })
})

describe('縣與縣之間的交通（只寫 km）', () => {
  const links = new Map(index.links.map((l) => [l.id, l]))
  const get = (id: string) => {
    const l = links.get(id)
    expect(l, id).toBeTruthy()
    return l!
  }
  it('京都駅：奈良、大阪、東京（新幹線）、那覇空港（經関西国際空港）；兩個方向的 km 一樣', () => {
    const from = index.links.filter((l) => l.from === '261068' && l.fromStop === 'main')
    expect(from.map((l) => l.toPref)).toEqual(['okinawa', 'nara', 'osaka', 'tokyo'])
    expect(get('261068.main>131016.main').legs).toEqual([{ mode: 'rail', km: 472.7, kmKind: 'rail', to: '東京', shinkansen: true }])
    expect(get('261068.main>292010.main').legs[0]).toMatchObject({ mode: 'rail', kmKind: 'rail', to: '近鉄奈良' })
    expect(get('261068.main>271276.main').legs[0]!.shinkansen).toBeUndefined()
    for (const l of index.links) {
      const back = index.links.find((x) => x.from === l.to && x.to === l.from && x.fromStop === l.toStop)!
      expect(back, l.id).toBeTruthy()
      expect(back.legs.map((x) => x.km).reverse(), l.id).toEqual(l.legs.map((x) => x.km))
      for (const x of l.legs) expect(x.km, l.id).toBeGreaterThan(0)
      // 新幹線只有京都 ↔ 東京
      expect(l.legs.some((x) => x.shinkansen), l.id).toBe(l.id.includes('131016.main') && l.id.includes('261068.main'))
    }
  })
  it('大阪：兵庫、奈良、関西国際空港（沖繩、北海道）；東京：羽田（東京国際空港：北海道、沖繩）', () => {
    const to = (from: string) => index.links.filter((l) => l.from === from && l.fromStop === 'main').map((l) => `${l.toPref}:${l.legs.map((x) => x.to).join('>')}`)
    expect(to('271276')).toEqual(['kyoto:京都', 'hyogo:三ノ宮', 'nara:近鉄奈良', 'okinawa:関西国際空港>那覇空港', 'hokkaido:関西国際空港>新千歳空港'])
    expect(to('131016')).toEqual(['kyoto:京都', 'hokkaido:東京国際空港>新千歳空港', 'okinawa:東京国際空港>那覇空港'])
    // 新千歳空港の到着：千歳市の airport
    expect(get('131016.main>012246.airport').legs.map((x) => x.mode)).toEqual(['rail', 'plane'])
    expect(get('012246.airport>131016.main').mode).toBe('plane')
  })
  it('京都 ↔ 那覇空港：P2 的 crossLinks 算的跟索引一樣（id、km、名字）', () => {
    const w = buildWorld([raw(kyotoRaw), raw(okinawaRaw)])
    for (const id of ['261068.main>472018.airport', '472018.airport>261068.main']) {
      const mine = w.links.find((l) => l.id === id)!
      const { fromPref: _f, toPref: _t, ...rest } = get(id)
      expect({ ...rest, legs: rest.legs.map(({ shinkansen: _s, ...x }) => x) }).toEqual({ id: mine.id, from: mine.from, fromStop: mine.fromStop, to: mine.to, toStop: mine.toStop, mode: mine.mode, legs: mine.legs, name: mine.name })
    }
  })
  it('坐車的遊戲時間：新幹線（京都 ↔ 東京）約 2 小時 20 分，比電車＋飛機（京都 ↔ 那覇、東京 ↔ 新千歳）快', () => {
    const w = createWorld([raw(kyotoRaw)], { index })
    const m = (id: string) => w.linkById(id)!.minutes
    expect(m('261068.main>131016.main')).toBe(140)
    expect(m('131016.main>261068.main')).toBe(140)
    expect(m('261068.main>131016.main')).toBeLessThan(m('261068.main>472018.airport'))
    expect(m('261068.main>131016.main')).toBeLessThan(m('131016.main>012246.airport'))
    // 一般的電車（沒有新幹線的段）照舊：京都 ↔ 大阪
    const osaka = w.linkById('261068.main>271276.main')!
    expect(osaka.minutes).toBe(Math.max(5, Math.round((10 + osaka.legs[0]!.km * 1.2) / 5) * 5))
  })
  it('飛機是兩個機場景點的直線 km（小數一位）', () => {
    const l = get('131016.main>012246.airport')
    const hk = raw(hokkaidoRaw)
    const cts = hk.spots.find((s) => s.n === '新千歳空港')!
    // 東京国際空港的景點不在 fixture（東京的 fixture 只放選到的鎮）：從 km 反推不了，只檢查新千歳那一端在資料裡
    expect(cts.c).toBe('機場')
    expect(l.legs[1]!.km).toBeGreaterThan(700)
    expect(l.legs[1]!.km).toBeLessThan(900)
  })
})

describe('五縣的鎮（fixture）', () => {
  it('照索引建鎮，每一鎮生成得出來；縣與縣之間的交通的兩端都有那個站', () => {
    const world = createWorld(all(), { index })
    expect(world.prefs().map((p) => p.pref)).toEqual(index.prefs.map((p) => p.pref))
    for (const pref of P3) {
      const towns = world.towns.filter((t) => t.pref === pref)
      expect(towns.map((t) => t.id), pref).toEqual(pinnedOf(pref).map((t) => t.id))
      for (const t of towns) {
        const gen = world.generate(t.id)!
        expect(gen.map.w, t.name.ja).toBeGreaterThan(0)
        expect(t.kit, t.name.ja).toBe(kitOf(pref))
      }
    }
    for (const l of index.links) {
      expect(world.generate(l.from)?.stops[l.fromStop], `${l.id} 出發`).toBeTruthy()
      expect(world.generate(l.to)?.stops[l.toStop], `${l.id} 到`).toBeTruthy()
    }
  })

  it('北海道：有鐵路的鎮坐電車、沒有的坐巴士（接到最近的鐵路鎮）', () => {
    const world = createWorld([raw(kyotoRaw), raw(hokkaidoRaw)], { index })
    const hk = world.towns.filter((t) => t.pref === 'hokkaido')
    const bus = hk.filter((t) => t.station.kind === 'bus')
    expect(bus.map((t) => t.name.ja).sort()).toEqual(['斜里町', '美瑛町'].sort())
    for (const t of bus) {
      const out = world.links.filter((l) => l.from === t.id)
      expect(out.length, t.name.ja).toBe(1)
      expect(out[0]!.mode).toBe('bus')
      expect(out[0]!.legs[0]!.kmKind).toBe('straight')
      const hub = world.townById(out[0]!.to)!
      expect(hub.station.kind).toBe('rail')
      expect(hub.stops.some((s) => s.kind === 'bus'), hub.name.ja).toBe(true)
      expect(world.links.some((l) => l.from === hub.id && l.to === t.id && l.mode === 'bus')).toBe(true)
    }
    // 鐵路的鎮兩兩：鐵路 km
    const rail = hk.filter((t) => t.station.kind === 'rail')
    expect(rail.length).toBe(7)
    expect(world.links.filter((l) => l.mode === 'rail' && rail.some((t) => t.id === l.from) && rail.some((t) => t.id === l.to)).length).toBe(7 * 6)
    // 縣內的路網少了沒有縣的停靠點時會繞一大圈（札幌 → 小樽經長万部約 340 km）：pipeline 把選好的鎮之間的路徑放進來
    const km = (a: string, b: string) => world.links.find((l) => l.from === a && l.to === b && l.mode === 'rail')!.legs[0]!.km
    expect(km('011011', '012033')).toBeLessThan(45)
    expect(km('012246', '012033')).toBeLessThan(90)
    // 新千歳空港：抵達大廳的櫃台是東京、大阪
    const gen = world.generate('012246')!
    const hall = [...gen.interiors.values()].find((m) => m.id.includes(':airport:'))!
    const counter = hall.entities.find((e) => e.kind === 'travel')!.data as unknown as TravelData
    expect(counter.dests.map((d) => d.town)).toEqual(['271276', '131016'])
  })
})

describe('延遲加縣', () => {
  it('京都＋沖繩的鎮：只有 P2 的兩縣（沒有索引）與七縣（索引）生成的 tile、實體一樣，剪票口的目的地只多不少', () => {
    const p2 = createWorld([raw(kyotoRaw), raw(okinawaRaw)])
    const p3 = createWorld([raw(kyotoRaw)], { index })
    p3.addPref(raw(okinawaRaw))
    for (const t of p2.towns) {
      const a = p2.generate(t.id)!
      const b = p3.generate(t.id)!
      expect(mapText(b.map, true), t.name.ja).toBe(mapText(a.map, true))
      expect([...b.interiors.keys()], t.name.ja).toEqual([...a.interiors.keys()])
      for (const [id, m] of a.interiors) expect(mapText(b.interiors.get(id)!, true), id).toBe(mapText(m, true))
      expect(b.stops).toEqual(a.stops)
      // 交通的實體：P2 的目的地照原來的順序在前面
      const travels = (g: typeof a) => [g.map, ...g.interiors.values()].flatMap((m) => m.entities.filter((e) => e.kind === 'travel'))
      const ta = travels(a)
      const tb = travels(b)
      expect(tb.map((e) => e.id)).toEqual(ta.map((e) => e.id))
      ta.forEach((e, i) => {
        const da = (e.data as unknown as TravelData).dests
        const db = (tb[i]!.data as unknown as TravelData).dests
        expect(db.slice(0, da.length), e.id).toEqual(da)
      })
    }
    const station = p3.generate('261068')!.interiors.get('int:261068:station:0')!
    const dests = (station.entities.find((e) => e.kind === 'travel')!.data as unknown as TravelData).dests
    expect(dests.slice(-4).map((d) => d.name)).toEqual(['那覇空港', '近鉄奈良', '大阪', '東京'])
  })

  it('之後再加的縣不重做已經生成的鎮；鎮與交通的順序跟一起讀的一樣（讀的先後不影響）', () => {
    const lazy = createWorld([raw(kyotoRaw)], { index })
    const kyoto = lazy.generate('261068')!
    const before = lazy.links.filter((l) => l.from === '261068').map((l) => l.id)
    const seen: string[][] = []
    lazy.onPrefs((ps) => seen.push(ps.map((p) => p.pref)))
    // 先北海道、再大阪（跟索引的順序反過來）
    for (const p of ['hokkaido', 'osaka']) lazy.addPref(raw(FIX[p]))
    expect(seen).toEqual([
      ['kyoto', 'hokkaido'],
      ['kyoto', 'osaka', 'hokkaido'],
    ])
    expect(lazy.generate('261068')).toBe(kyoto)
    expect(lazy.links.filter((l) => l.from === '261068').map((l) => l.id)).toEqual(before)
    const eager = createWorld([raw(kyotoRaw), raw(osakaRaw), raw(hokkaidoRaw)], { index })
    expect(lazy.towns.map((t) => t.id)).toEqual(eager.towns.map((t) => t.id))
    expect(lazy.links.map((l) => l.id)).toEqual(eager.links.map((l) => l.id))
    // 已經有的縣再加一次：什麼都不做
    expect(lazy.addPref(raw(osakaRaw)).length).toBe(9)
    expect(seen.length).toBe(2)
    // 還沒讀的縣的鎮：知道是哪一縣（世界索引）
    expect(lazy.prefOfTown('131016')).toBe('tokyo')
    expect(lazy.hasPref('tokyo')).toBe(false)
    expect(lazy.townById('131016')).toBeUndefined()
  })
})

describe('ensurePref', () => {
  it('讀一縣：loadPref＋那一縣的 kit（loadKit）；kit 讀不到就是讀不到', async () => {
    const kits: string[] = []
    const w = createWorld([raw(kyotoRaw)], {
      index,
      loadPref: async (p) => raw(FIX[p]),
      loadKit: async (k) => {
        kits.push(k)
        if (k === 'hokkaido') throw new Error('chunk')
      },
    })
    expect(await w.ensurePref('tokyo')).toBe(true)
    expect(await w.ensurePref('nara')).toBe(true)
    expect(await w.ensurePref('hokkaido')).toBe(false)
    // 奈良（近畿 kit 的 P3 的縣）：山、教堂、高樓用關東的零件，那一檔也一起讀
    expect(kits).toEqual(['kanto', 'kinki', 'kanto', 'hokkaido'])
    expect(w.prefs().map((p) => p.pref)).toEqual(['kyoto', 'nara', 'tokyo'])
    // 讀過的不再讀
    expect(await w.ensurePref('tokyo')).toBe(true)
    expect(kits.length).toBe(4)
    // 沒有 loadPref：讀不到
    expect(await createWorld([raw(kyotoRaw)], { index }).ensurePref('nara')).toBe(false)
  })

  it('一直不回：loadWaitSeconds 秒後當作讀不到；晚到的資料照樣加進來', async () => {
    let arrive: (d: PrefData) => void = () => {}
    let calls = 0
    const w = createWorld([raw(kyotoRaw)], {
      index,
      loadWaitSeconds: 0.05,
      loadPref: (p) => {
        calls++
        return calls === 1 ? new Promise<PrefData>((r) => (arrive = r)) : Promise.resolve(raw(FIX[p]))
      },
    })
    const seen: string[][] = []
    w.onPrefs((list) => seen.push(list.map((p) => p.pref)))
    expect(await w.ensurePref('nara')).toBe(false)
    expect(w.hasPref('nara')).toBe(false)
    // 晚到：加進來（onPrefs 通知），之後就是讀好了
    arrive(raw(naraRaw))
    await new Promise((r) => setTimeout(r, 0))
    expect(w.hasPref('nara')).toBe(true)
    expect(seen.at(-1)).toContain('nara')
    expect(await w.ensurePref('nara')).toBe(true)
    expect(calls).toBe(1)
  })
})

describe('季節（各縣的氣象台）', () => {
  const ps = all()
  const town = (pref: string, id: string) => createWorld([ps.find((p) => p.pref === pref)!], { index }).townById(id)!
  const climate = (p: PrefData, t: Town) => climateOf(p, t)
  it('各縣用自己的站；北海道的鎮用最近的', () => {
    const name = (pref: string) => {
      const p = ps.find((x) => x.pref === pref)!
      return climate(p, town(pref, pinnedOf(pref)[0]!.id))?.station
    }
    expect(['nara', 'osaka', 'hyogo', 'tokyo'].map(name)).toEqual(['奈良', '大阪', '神戸', '東京'])
    const hk = ps.find((x) => x.pref === 'hokkaido')!
    const w = createWorld([hk], { index })
    const st = (code: string) => climate(hk, w.townById(code)!)?.station
    expect([st('011011'), st('012025'), st('012068'), st('012041'), st('012114')]).toEqual(['札幌', '函館', '釧路', '旭川', '網走'])
  })
  it('北海道：11–4 月是冬（積雪）、櫻在 5 月；東京：1 月還不是春', () => {
    const hk = ps.find((x) => x.pref === 'hokkaido')!
    const sapporo = climate(hk, createWorld([hk], { index }).townById('011011')!)
    const d = (m: number, dd: number) => ({ y: 2026, m, d: dd })
    expect([d(11, 5), d(1, 10), d(4, 20)].map((x) => seasonAt(x, 'hokkaido', sapporo))).toEqual(['winter', 'winter', 'winter'])
    expect([d(5, 5), d(7, 1), d(10, 1)].map((x) => seasonAt(x, 'hokkaido', sapporo))).toEqual(['spring', 'summer', 'autumn'])
    expect(bloomAt(d(5, 5), 'hokkaido', sapporo).has('sakura')).toBe(true)
    expect(bloomAt(d(4, 5), 'hokkaido', sapporo).has('sakura')).toBe(false)
    // 沒有梅平年值的站（旭川、網走…）：櫻開花前 2 天才是春，不會比札幌早（4/25 札幌、旭川都還是冬）
    const hw = createWorld([hk], { index })
    const firstSpring = (code: string) => {
      const c = climate(hk, hw.townById(code)!)
      for (let k = 60; k < 200; k++) {
        const dt = new Date(Date.UTC(2026, 0, 1 + k))
        if (seasonAt({ y: 2026, m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }, 'hokkaido', c) === 'spring') return k
      }
      return -1
    }
    expect(firstSpring('012041')).toBeGreaterThanOrEqual(firstSpring('011011'))
    expect(seasonAt(d(4, 25), 'hokkaido', climate(hk, hw.townById('012041')!))).toBe('winter')
    expect(seasonAt(d(4, 25), 'hokkaido', sapporo)).toBe('winter')
    const tk = ps.find((x) => x.pref === 'tokyo')!
    const tokyo = climate(tk, town('tokyo', '131016'))
    expect(seasonAt(d(1, 25), 'kanto', tokyo)).toBe('winter')
    expect(seasonAt(d(3, 10), 'kanto', tokyo)).toBe('spring')
    // 京都（近鉄）照舊：梅開花就是春
    const ky = ps.find((x) => x.pref === 'kyoto')!
    const kc = climate(ky, createWorld([ky]).townById('261068')!)
    expect(seasonAt(d(2, 23), 'kinki', kc)).toBe('spring')
  })
  it('天氣：北海道的冬天常下雪、東京很少', () => {
    const days = Array.from({ length: 60 }, (_, i) => ({ y: 2027, m: 1 + Math.floor(i / 31), d: (i % 31) + 1 }))
    const snow = (kit: 'hokkaido' | 'kanto' | 'kinki') => days.filter((d) => weatherAt(d, '011011', kit, 'winter') === 'snow').length
    expect(snow('hokkaido')).toBeGreaterThan(snow('kinki'))
    expect(snow('kanto')).toBeLessThan(snow('kinki'))
  })
})

// ---------- 本機有 bundles 時：pipeline 選的鎮＝這裡照規則選的（整份資料），縣與縣之間的鐵路 km＝rail-graph ----------
// web/public/bundles 是 gitignore（CI 沒有）：glob 不到檔就跳過
const files = import.meta.glob(['../../../public/bundles/game/*.json', '../../../public/bundles/rail-graph.json'], { import: 'default' }) as Record<string, () => Promise<unknown>>
const read = (name: string) => files[`../../../public/bundles/${name}`]!()
const local = !!files['../../../public/bundles/game/_world.json']
describe.skipIf(!local)('本機的 bundles（CI 沒有，跳過）', () => {
  it('七縣：照規則選的鎮跟 pipeline 一樣（代表站、站）', async () => {
    const w = parseWorldIndex(await read('game/_world.json'))!
    for (const p of w.prefs) {
      const data = prefData((await read(`game/${p.pref}.json`)) as PrefRaw)
      expect(selectTowns(data).map(brief), p.pref).toEqual(selectTowns(data, TOWN_RULES[p.pref], p.towns).map(brief))
      expect(selectTowns(data).map((t) => t.id), p.pref).toEqual(p.towns.map((t) => t.id))
    }
  })
  it('鐵路的 km：全國路網的 search（同日帰り）', async () => {
    const w = parseWorldIndex(await read('game/_world.json'))!
    const g = buildGraph((await read('rail-graph.json')) as Parameters<typeof buildGraph>[0])
    const town = (id: string) => w.prefs.flatMap((p) => p.towns).find((t) => t.id === id)!
    let n = 0
    for (const l of w.links)
      if (l.legs.length === 1 && l.legs[0]!.mode === 'rail') {
        const a = g.index.get(town(l.from).station.id)!
        const b = g.index.get(town(l.to).station.id)!
        expect(round1(search(g, a).km.get(b)!), l.id).toBe(l.legs[0]!.km)
        n++
      }
    expect(n).toBe(10)
  })
  it('縣內的鐵路 km（前端用那一縣的路網算）＝全國路網的 search', async () => {
    const w = parseWorldIndex(await read('game/_world.json'))!
    const g = buildGraph((await read('rail-graph.json')) as Parameters<typeof buildGraph>[0])
    const datas = []
    for (const p of w.prefs) datas.push(prefData((await read(`game/${p.pref}.json`)) as PrefRaw))
    const world = createWorld(datas, { index: w })
    let n = 0
    const reach = new Map<string, ReturnType<typeof search>>()
    const from = (id: string) => reach.get(id) ?? reach.set(id, search(g, g.index.get(id)!)).get(id)!
    for (const l of world.links) {
      const a = world.townById(l.from)
      const b = world.townById(l.to)
      if (!a || !b || a.pref !== b.pref || l.legs.length !== 1 || l.legs[0]!.mode !== 'rail') continue
      const full = from(a.station.id).km.get(g.index.get(b.station.id)!)!
      expect(Math.abs(l.legs[0]!.km - full), `${l.id} ${l.legs[0]!.km} / ${round1(full)}`).toBeLessThanOrEqual(Math.max(1, full * 0.05))
      n++
    }
    expect(n).toBeGreaterThan(200)
  }, 120_000)
})
