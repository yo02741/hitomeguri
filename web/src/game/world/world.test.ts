import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'

import kyotoRaw from '../fixtures/kyoto.json'
import okinawaRaw from '../fixtures/okinawa.json'
import { Gfx } from '../../services/pixelwalk/gfx'

import { cameraAxis, Game } from '../engine/game'
import { MapView } from '../engine/map'
import { TileCache, tileDef } from '../engine/tiles'
import { type GameMap, passable } from '../engine/types'

import { round1 } from '../../services/daytrip'

import { BUNDLES, type BundleApi, loadWorldData, municipalitiesOf, prefData } from './data'
import { compile, landmarkBlueprint } from './gen/blueprints'
import { classify } from './gen/classify'
import { flood, generateTown, stampStationOf, targetsOf } from './gen/town'
import { kmBetween } from './geo'
import { rideOverlay } from './ride'
import { kanaToRomaji, placeRomaji, stationRomaji } from './romaji'
import { bloomAt, climateOf, festivalsIn, seasonAt } from './season'
import { buildWorld, railKm, selectTowns } from './towns'
import type { FactRef, PrefData, PrefRaw, SignData, TravelData } from './types'
import { createWorld, GEN_VERSION } from './world'

// 世界生成（規格 §8、§11）：只讀 commit 進去的 fixture（CI 沒有 bundles）

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const kyoto = () => prefData(kyotoRaw as unknown as PrefRaw)
const okinawa = () => prefData(okinawaRaw as unknown as PrefRaw)
const both = () => [kyoto(), okinawa()]

/** 另外寫一份 Dijkstra（跟 daytrip.search 一樣的權重：新幹線 ×0.97），對照 km */
function dijkstraKm(p: PrefData, from: string, to: string): number | null {
  const nodes = p.railGraph.nodes
  const idx = new Map(nodes.map((n, i) => [n[0], i]))
  const adj: Array<Array<[number, number, number]>> = nodes.map(() => [])
  for (const [a, b, km, k] of p.railGraph.edges) {
    adj[a]!.push([b, km, k])
    adj[b]!.push([a, km, k])
  }
  const s = idx.get(from)
  const t = idx.get(to)
  if (s === undefined || t === undefined) return null
  const w = new Array<number>(nodes.length).fill(Infinity)
  const km = new Array<number>(nodes.length).fill(Infinity)
  const done = new Array<boolean>(nodes.length).fill(false)
  w[s] = 0
  km[s] = 0
  for (;;) {
    let u = -1
    for (let i = 0; i < nodes.length; i++) if (!done[i] && Number.isFinite(w[i]!) && (u < 0 || w[i]! < w[u]!)) u = i
    if (u < 0) break
    done[u] = true
    if (u === t) break
    for (const [v, d, k] of adj[u]!) {
      const nw = w[u]! + d * (k === 1 ? 0.97 : 1)
      if (nw < w[v]!) {
        w[v] = nw
        km[v] = km[u]! + d
      }
    }
  }
  return Number.isFinite(km[t]!) ? round1(km[t]!) : null
}

const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((v, i) => v === b[i])
const nodeByName = (p: PrefData, name: string) => p.railGraph.nodes.filter((n) => n[1] === name).map((n) => n[0])

describe('資料', () => {
  it('fixture → PrefData：查詢函式', () => {
    const k = kyoto()
    expect(k.spotById('wd-Q1013399')?.n).toBe('元離宮二条城')
    expect(k.castleById('castle-053')?.st).toEqual(['大休憩所'])
    expect(k.municipality('261068')?.n).toBe('下京区')
    expect(k.festivals.length).toBeGreaterThan(10)
    expect(k.kix?.n).toBe('関西国際空港')
  })

  it('區界的相鄰：共用 2 個以上的點', () => {
    const sq = (x: number, y: number) => [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]]
    const muns = municipalitiesOf({
      type: 'FeatureCollection',
      attribution: '',
      features: [
        { type: 'Feature', id: 1, properties: { m: '1', n: 'A' }, geometry: { type: 'MultiPolygon', coordinates: [sq(0, 0)] } },
        { type: 'Feature', id: 2, properties: { m: '2', n: 'B' }, geometry: { type: 'MultiPolygon', coordinates: [sq(1, 0)] } },
        { type: 'Feature', id: 3, properties: { m: '3', n: 'C' }, geometry: { type: 'MultiPolygon', coordinates: [sq(5, 5)] } },
      ],
    })
    expect(muns.map((m) => m.touches)).toEqual([['2'], ['1'], []])
    expect(muns[0]!.bbox).toEqual([0, 0, 1, 1])
  })

  it('讀不到（離線）不丟錯：每一縣一個 offline 的錯誤', async () => {
    const api: BundleApi = { ...BUNDLES, fetchIndex: () => Promise.reject(new TypeError('Failed to fetch')) }
    const r = await loadWorldData(['kyoto', 'okinawa'], api)
    expect(r.prefs).toEqual([])
    expect(r.errors.map((e) => [e.pref, e.kind])).toEqual([
      ['kyoto', 'offline'],
      ['okinawa', 'offline'],
    ])
  })

  it('從 bundles 轉成同一個形狀；擴充包只讀老舖與城（不讀寶可夢、角色商店）', async () => {
    const k = kyotoRaw as unknown as PrefRaw
    const packs: string[] = []
    const fail = () => Promise.reject(new Error('404'))
    const api: BundleApi = {
      ...BUNDLES,
      fetchIndex: () =>
        Promise.resolve({
          prefectures: { kyoto: { count: 1, featured: 0, version: 'v' }, nara: { count: 1, featured: 0, version: 'v' } },
          municipalities: { kyoto: { count: 1, version: 'v' } },
          packs: { shinise: { count: 1, version: 'v' }, castle: { count: 1, version: 'v' }, pokemon: { count: 1, version: 'v' }, chara: { count: 1, version: 'v' } },
          rail: { kyoto: { version: 'v' } },
        }),
      fetchMap: (pref) => (pref === 'kyoto' ? Promise.resolve(k.spots.slice(0, 5).map(({ name: _n, summary: _s, nearest: _ne, src: _src, ...s }) => s)) : fail()),
      fetchDetail: () => Promise.resolve([]),
      fetchMunicipalities: () => Promise.resolve({ type: 'FeatureCollection', attribution: '', features: [{ type: 'Feature', id: 1, properties: { m: '261068', n: '下京区' }, geometry: { type: 'MultiPolygon', coordinates: [[[[135.7, 34.9], [135.8, 34.9], [135.8, 35], [135.7, 34.9]]]] } }] }),
      fetchRail: () => Promise.resolve({ lines: [], stations: [] }),
      fetchFestivals: fail,
      fetchPrefSpecialties: fail,
      fetchSpecialties: () => Promise.resolve([]),
      fetchPack: (key) => {
        packs.push(key)
        return Promise.resolve([])
      },
      fetchSeasons: () => Promise.resolve(null),
      fetchRailGraph: fail,
    }
    const r = await loadWorldData(['kyoto', 'nara'], api)
    expect(r.prefs.map((p) => p.pref)).toEqual(['kyoto'])
    expect(r.prefs[0]!.spots.length).toBe(5)
    expect(r.prefs[0]!.municipalities[0]!.bbox).toEqual([135.7, 34.9, 135.8, 35])
    expect(r.errors.map((e) => [e.pref, e.kind])).toEqual([['nara', 'missing']])
    expect(packs.sort()).toEqual(['castle', 'shinise'])
  })

  it('索引有遊戲用的小 bundle（game/{縣}.json）：只讀它，不讀整份地圖、簡介、全國路網', async () => {
    const calls: string[] = []
    const no = (name: string) => () => {
      calls.push(name)
      return Promise.reject(new Error('不該讀'))
    }
    const api: BundleApi = {
      ...BUNDLES,
      fetchIndex: () =>
        Promise.resolve({
          prefectures: { kyoto: { count: 1, featured: 0, version: 'v' }, okinawa: { count: 1, featured: 0, version: 'v' } },
          municipalities: { kyoto: { count: 1, version: 'v' }, okinawa: { count: 1, version: 'v' } },
          rail_graph: { nodes: 1, edges: 1, version: 'v' },
          packs: { shinise: { count: 1, version: 'v' } },
          game: { kyoto: { version: 'g1' }, okinawa: { version: 'g2' } },
        }),
      fetchGame: (pref) => Promise.resolve(pref === 'kyoto' ? kyotoRaw : okinawaRaw),
      fetchMap: no('map'),
      fetchDetail: no('detail'),
      fetchMunicipalities: no('municipalities'),
      fetchRailGraph: no('rail-graph'),
      fetchPack: no('pack'),
      fetchSeasons: no('seasons'),
    }
    const r = await loadWorldData(['kyoto', 'okinawa'], api)
    expect(r.prefs.map((p) => p.pref)).toEqual(['kyoto', 'okinawa'])
    expect(r.errors).toEqual([])
    expect(calls).toEqual([])
    // 小 bundle 讀壞了：改讀完整的資料
    const broken = await loadWorldData(['kyoto'], { ...api, fetchGame: () => Promise.reject(new Error('500')) })
    expect(broken.warnings.some((w) => w.includes('game bundle'))).toBe(true)
    expect(calls).toContain('map')
  })

  it('假名 → 羅馬字（地名牌）', () => {
    expect(placeRomaji('下京区', 'しもぎょうく')).toBe('SHIMOGYO-KU')
    expect(placeRomaji('那覇市', 'なはし')).toBe('NAHA-SHI')
    expect(placeRomaji('恩納村', 'おんなそん')).toBe('ONNA-SON')
    expect(kanaToRomaji('きょうと')).toBe('kyoto')
    expect(kanaToRomaji('しんいち')).toBe("shin'ichi")
    expect(kanaToRomaji('はっとり')).toBe('hattori')
    // 車站：OSM 的英文名是羅馬字才用（去掉 Station）；Prefectural Office、Naha Airport 這種不寫（有同名景點就用它的）
    expect(stationRomaji('Torokko Arashiyama Station')).toBe('TOROKKO ARASHIYAMA')
    expect(stationRomaji('Nijōjō-mae')).toBe('NIJŌJŌ-MAE')
    expect(stationRomaji('Tambabashi')).toBe('TAMBABASHI')
    expect(stationRomaji('Prefectural Office')).toBe('')
    expect(stationRomaji('Naha Airport', 'Nahakuko')).toBe('NAHAKUKO')
  })
})

describe('選鎮與交通', () => {
  /** 這一區在資料裡有幾個景點（地標最多 12 個；資料少的區就是那幾個） */
  const inData = (p: PrefData, code: string) => p.spots.filter((s) => s.m === code).length

  it('京都：起點下京区（京都站）→ 有名城蓋章地點的區（中京区、福知山市）→ 照分數補到 9 個；每次一樣', () => {
    const k = kyoto()
    const a = selectTowns(k)
    const b = selectTowns(kyoto())
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id))
    expect(a.map((t) => t.name.ja)).toEqual(['下京区', '中京区', '福知山市', '東山区', '右京区', '左京区', '北区', '上京区', '西京区'])
    expect(a[0]!.station).toEqual({ id: 'node-267316272', name: '京都', kind: 'rail' })
    expect(a.every((t) => t.kit === 'kinki' && t.station.kind === 'rail')).toBe(true)
    expect(a.every((t) => t.spots.length >= Math.min(8, inData(k, t.id)) && t.spots.length <= 12)).toBe(true)
    // 有蓋章地點的名城一定在地標裡：二条城（中京区）、福知山城
    expect(a.find((t) => t.name.ja === '中京区')!.spots).toContain('wd-Q1013399')
    expect(a.find((t) => t.name.ja === '福知山市')!.spots).toContain('wd-Q2969288')
  })

  it('沖繩：那覇市（起點那覇空港）、名城的鎮 4 個、離島 1 個（飛機）、照分數補到 9 個（巴士）', () => {
    const o = okinawa()
    const t = selectTowns(o)
    expect(t.map((x) => x.name.ja)).toEqual(['那覇市', 'うるま市', '読谷村', '今帰仁村', '中城村', '宮古島市', '南城市', '名護市', '恩納村'])
    const naha = t[0]!
    expect(naha.station).toMatchObject({ name: '県庁前', kind: 'monorail' })
    expect(naha.stops.map((s) => s.id)).toEqual(expect.arrayContaining(['main', 'airport', 'bus']))
    expect(naha.stops.find((s) => s.id === 'airport')?.name).toBe('那覇空港')
    expect(t.filter((x) => x.island).map((x) => x.name.ja)).toEqual(['宮古島市'])
    expect(t[5]!.station).toMatchObject({ name: '下地島空港', kind: 'airport' })
    expect(t.filter((x) => !x.island && x !== naha).every((x) => x.station.kind === 'bus')).toBe(true)
    // 5 個名城（首里城、勝連城、座喜味城、今帰仁城、中城城）的景點都在地標裡
    const all = new Set(t.flatMap((x) => x.spots))
    for (const c of o.castles.filter((c) => c.st?.length)) expect(all.has(c.s!), c.n).toBe(true)
  })

  it('鐵路 km：rail-graph 子圖的最短路（同日帰り），京都站→稲荷、宇治也對', () => {
    const k = kyoto()
    const KYOTO = 'node-267316272'
    for (const name of ['稲荷', '宇治', '祇園四条', '嵐山']) for (const id of nodeByName(k, name)) expect(railKm(k, KYOTO, id), name).toBe(dijkstraKm(k, KYOTO, id))
    expect(railKm(k, KYOTO, nodeByName(k, '稲荷')[0]!)).toBe(2.4)
    const w = buildWorld(both())
    const rail = w.links.filter((l) => l.mode === 'rail' && l.legs.length === 1)
    expect(rail.length).toBe(9 * 8)
    for (const l of rail) {
      const from = w.towns.find((t) => t.id === l.from)!
      const to = w.towns.find((t) => t.id === l.to)!
      expect(l.legs[0]!.km, l.id).toBe(dijkstraKm(k, from.station.id, to.station.id))
      expect(l.legs[0]!.kmKind).toBe('rail')
    }
  })

  it('沖繩的交通：巴士直線 km、那覇的單軌、飛機；京都 ↔ 那覇空港經関西国際空港', () => {
    const w = buildWorld(both())
    const o = okinawa()
    const k = kyoto()
    const naha = w.towns.find((t) => t.id === '472018')!
    const nago = w.towns.find((t) => t.id === '472093')!
    const bus = w.links.find((l) => l.from === naha.id && l.to === nago.id)!
    expect(bus.mode).toBe('bus')
    expect(bus.legs[0]!.kmKind).toBe('straight')
    expect(bus.legs[0]!.km).toBeCloseTo(kmBetween(naha.stops.find((s) => s.id === 'bus')!, nago.stops[0]!), 1)
    const mono = w.links.filter((l) => l.mode === 'monorail')
    expect(mono.length).toBeGreaterThan(0)
    for (const l of mono) {
      const a = naha.stops.find((s) => s.id === l.fromStop)!
      const b = naha.stops.find((s) => s.id === l.toStop)!
      expect(l.legs[0]!.km).toBe(dijkstraKm(o, a.stationId!, b.stationId!))
    }
    const plane = w.links.find((l) => l.from === naha.id && l.to === '472140')!
    expect(plane.legs).toEqual([{ mode: 'plane', km: expect.any(Number), kmKind: 'straight', to: '下地島空港' }])
    const kix = w.links.find((l) => l.from === '261068' && l.to === naha.id)!
    expect(kix.toStop).toBe('airport')
    expect(kix.legs.map((x) => [x.mode, x.kmKind, x.to])).toEqual([
      ['rail', 'rail', '関西国際空港'],
      ['plane', 'straight', '那覇空港'],
    ])
    expect(kix.legs[0]!.km).toBe(dijkstraKm(k, 'node-267316272', k.kix!.st!))
    const ap = o.spots.find((s) => s.n === '那覇空港')!
    expect(kix.legs[1]!.km).toBeCloseTo(kmBetween(k.kix!, ap), 0)
    const back = w.links.find((l) => l.from === naha.id && l.to === '261068')!
    expect(back.legs.map((x) => x.mode)).toEqual(['plane', 'rail'])
    // 京都的其他鎮不直接到沖繩
    expect(w.links.filter((l) => l.from !== '261068' && w.towns.find((t) => t.id === l.from)!.pref === 'kyoto' && l.to === naha.id)).toEqual([])
  })
})

describe('鎮的生成', () => {
  const world = createWorld(both())

  it('每個鎮生成兩次一樣（種子＝市区町村碼＋生成器版本）', () => {
    const other = createWorld(both())
    for (const t of world.towns) {
      const a = world.generate(t.id)!.map
      const b = other.generate(t.id)!.map
      expect([a.w, a.h], t.id).toEqual([b.w, b.h])
      expect(same(a.ground, b.ground), t.id).toBe(true)
      expect(same(a.lower, b.lower), t.id).toBe(true)
      expect(same(a.over, b.over), t.id).toBe(true)
      expect(JSON.stringify(a.entities), t.id).toBe(JSON.stringify(b.entities))
      expect(JSON.stringify(a.warps), t.id).toBe(JSON.stringify(b.warps))
    }
    const c = createWorld(both(), { genVersion: GEN_VERSION + 1 }).generate('261068')!.map
    expect(same(c.lower, world.generate('261068')!.map.lower)).toBe(false)
  })

  it('大小 44–64 × 34–48；地標 8 個以上（資料少的區是全部）；生成沒有明顯變慢（中位數 < 120ms）', () => {
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      expect(g.map.w, t.id).toBeGreaterThanOrEqual(44)
      expect(g.map.w, t.id).toBeLessThanOrEqual(64)
      expect(g.map.h, t.id).toBeGreaterThanOrEqual(34)
      expect(g.map.h, t.id).toBeLessThanOrEqual(48)
      expect(g.landmarks.length, t.name.ja).toBeGreaterThanOrEqual(Math.min(8, t.spots.length))
    }
    // 生成的時間：規格 §9 的目標是一鎮 < 50ms，那是給實機看的目標，不是這裡的門檻。
    // vitest 是好幾個測試檔平行跑，機器忙的時候單一次會偶爾超過 50ms（QA 量過恩納村 52ms），所以這裡只擋明顯的退化：
    // 上面已經生成過一輪（熱身、JIT），同一鎮不經快取直接再生成 5 次，取中位數，門檻 120ms。
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
    for (const t of world.towns) {
      const input = { pref: world.prefOf(t.id)!, town: t, world: world.world, genVersion: GEN_VERSION }
      const ms = median(Array.from({ length: 5 }, () => generateTown(input).ms))
      expect(ms, t.name.ja).toBeLessThan(120)
    }
  })

  /** 一張地圖：從 start（或門墊）走得到所有的門、拍攝點、告示牌與 NPC 的旁邊 */
  const unreachable = (map: GameMap, from: { x: number; y: number }) => {
    const view = new MapView(map)
    const seen = flood(view, from)
    return targetsOf({ w: map.w, h: map.h, map }, view)
      .filter((t) => !t.cells.some((c) => seen[c.y * map.w + c.x]))
      .map((t) => t.what)
  }

  it('可達性：每個鎮、每個室內，門、拍攝點、NPC、告示牌、櫃台後面的人都走得到', () => {
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      expect(unreachable(g.map, g.map.start!), t.name.ja).toEqual([])
      for (const [id, m] of g.interiors) expect(unreachable(m, m.start!), id).toEqual([])
    }
    const room = world.mapSource('room')!
    expect(unreachable(room, room.start!)).toEqual([])
  })

  it('門進去的室內都在、出來回到門前；坐車到的地方都站得上去', () => {
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      for (const w of g.map.warps) {
        const int = world.mapSource(w.to)
        expect(int, w.to).toBeTruthy()
        expect(int!.warps.some((x) => x.to === t.mapId && x.tx === w.x && x.ty === w.y + 1), w.to).toBe(true)
      }
      for (const [id, a] of Object.entries(g.stops)) {
        const m = world.mapSource(a.map)!
        expect(new MapView(m).beh(a.x, a.y), `${t.name.ja} ${id}`).toBe(0)
      }
    }
  })

  it('實體的 data 照規格 §11：告示牌都有 source_url、拍攝點有範圍、事實 NPC 有出處', () => {
    const facts: FactRef[] = []
    let signs = 0
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      const maps = [g.map, ...g.interiors.values()]
      for (const m of maps)
        for (const e of m.entities) {
          const d = e.data as Record<string, unknown>
          if (e.kind === 'sign') {
            const s = d as unknown as SignData
            expect(s.source_url, e.id).toMatch(/^https:\/\//)
            expect(s.title.ja, e.id).toBeTruthy()
            if (s.summary) expect(s.summary.source_url).toMatch(/^https:\/\//)
            signs++
          }
          if (e.kind === 'photoSpot') {
            const tg = d.target as { x: number; y: number; w: number; h: number }
            expect(tg.w * tg.h, e.id).toBeGreaterThan(0)
            expect(tg.x >= 0 && tg.y >= 0 && tg.x + tg.w <= m.w && tg.y + tg.h <= m.h, e.id).toBe(true)
          }
          if (e.kind === 'npc') expect(['fact', 'passer', 'clerk', 'quest', 'festival', 'inn']).toContain(d.role)
          if (d.fact) facts.push(d.fact as FactRef)
          if (e.kind === 'travel') for (const dest of (d as unknown as TravelData).dests) expect(world.linkById(dest.link), dest.link).toBeTruthy()
        }
    }
    expect(signs).toBeGreaterThan(80)
    expect(facts.length).toBeGreaterThan(10)
    for (const f of facts) {
      expect(['festival.month', 'shinise.founded', 'castle.stamp', 'sakura.normal', 'rail.km', 'straight.km']).toContain(f.template)
      expect(f.source.url, f.template).toMatch(/^https:\/\//)
    }
  })

  it('不放寶可夢人孔蓋、角色商店的東西', () => {
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      for (const m of [g.map, ...g.interiors.values()]) expect(JSON.stringify(m.entities), t.id).not.toMatch(/pokemon|pokefuta|chara/i)
    }
  })

  it('城、グスク、御嶽只畫資料寫得出來的：石垣、城門、城跡的空地；蓋章的小屋只有蓋章地點在城裡的才有', () => {
    const allowed = /\/(ishigaki|castle-gate|castle-house|gusuku|gusuku-gate|house-door|pine|gajumaru|fukugi|tree|rock|bush|hibiscus|bougain|kanhi|sakura|grass|gravel|road|sando|sign|photo)/
    let castles = 0
    for (const t of world.towns) {
      const pref = world.prefOf(t.id)!
      const g = world.generate(t.id)!
      for (const lm of g.landmarks) {
        if (lm.kind !== 'castle' && lm.kind !== 'utaki') continue
        // 城看整個藍圖蓋到的範圍（石垣圍起來的整塊、城門、告示牌），藍圖的空白格（留給路、填空的）不算；御嶽看本體
        const bp = lm.kind === 'castle' ? compile(landmarkBlueprint('castle', 'M', t.kit, { stamp: true }), t.kit) : null
        const r = bp ? lm.area : lm.rect
        const names = new Set<string>()
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) {
            if (bp?.cells[(y - r.y) * bp.w + (x - r.x)]?.void) continue
            for (const layer of ['lower', 'over'] as const) {
              const n = tileDef(g.map[layer][y * g.map.w + x]!)?.name
              if (n) names.add(n)
            }
          }
        const c = pref.castles.find((c) => c.s === lm.spotId && c.st?.length)
        const hut = !!c && !stampStationOf(c, t)
        if (lm.kind === 'castle') {
          castles++
          expect(bp!.w, lm.spotId).toBe(lm.area.w)
          expect([...names].some((n) => /castle-gate|gusuku-gate/.test(n)), lm.spotId).toBe(true)
          expect([...names].some((n) => /castle-house|house-door/.test(n)), lm.spotId).toBe(hut)
        }
        for (const n of names) {
          if (lm.kind === 'castle') expect(n, `${lm.spotId} ${n}`).toMatch(allowed)
          if (lm.kind === 'castle') expect(n, `${lm.spotId} ${n}`).not.toMatch(/hall|haiden|hondo|tenshu|seiden|museum|machiya/)
          if (lm.kind === 'utaki') expect(n, `${lm.spotId} ${n}`).not.toMatch(/house|hall|station|museum|gate/)
        }
      }
    }
    expect(castles).toBeGreaterThanOrEqual(7)
    // 元離宮二条城（類型是城、名字有離宮）是城：石垣、城門、城跡的空地＋大休憩所的小屋，沒有御殿的大屋頂
    const nakagyo = world.generate('261041')!
    expect(nakagyo.landmarks.find((l) => l.spotId === 'wd-Q1013399')?.kind).toBe('castle')
    expect([...nakagyo.interiors.values()].some((m) => m.name.ja === '大休憩所')).toBe(true)
    // 首里城：只有石垣、石門與首里杜館（蓋章地點）
    const naha = world.generate('472018')!
    const shuri = naha.landmarks.find((l) => l.spotId === 'wd-Q907052')
    expect(shuri?.kind).toBe('castle')
    expect([...naha.interiors.values()].some((m) => m.name.ja === '首里杜館')).toBe(true)
  })

  it('類型：名字補判斷（伏見稲荷大社是神社、渡月橋是橋、斎場御嶽是御嶽、京都御所不是城）', () => {
    expect(classify({ n: '伏見稲荷大社', c: '展望' }, 'kinki')).toBe('shrine')
    expect(classify({ n: '渡月橋', c: '展望' }, 'kinki')).toBe('bridge')
    expect(classify({ n: '斎場御嶽', c: '史跡' }, 'okinawa')).toBe('utaki')
    expect(classify({ n: '京都御所', c: '城' }, 'kinki')).toBe('palace')
    expect(classify({ n: '桂離宮', c: '城' }, 'kinki')).toBe('palace')
    expect(classify({ n: '元離宮二条城', c: '城' }, 'kinki')).toBe('castle')
    expect(classify({ n: '元離宮二条城' }, 'kinki')).toBe('castle')
    expect(classify({ n: '世界遺産座喜味城跡ユンタンザミュージアム' }, 'okinawa')).toBe('museum')
    expect(classify({ n: '四条河原町' }, 'kinki')).toBe('generic')
    expect(classify({ n: '首里城', c: '城' }, 'okinawa')).toBe('castle')
  })

  it('蓋章：車站的站章、寺社的參拜印、名城的章（只有資料有 st 的城，放在那個地點名稱的室內）', () => {
    const stamps: Array<{ kind: string; name: string; map: string; face?: string }> = []
    for (const t of world.towns) for (const [, m] of world.generate(t.id)!.interiors) for (const e of m.entities) if (e.kind === 'stamp') stamps.push({ kind: e.data!.stampKind as string, name: e.data!.name as string, map: m.name.ja, face: e.data!.face as string | undefined })
    expect(stamps.filter((s) => s.kind === 'station').length).toBeGreaterThanOrEqual(6)
    expect(stamps.filter((s) => s.kind === 'sanpai').length).toBeGreaterThan(20)
    const castles = stamps.filter((s) => s.kind === 'castle')
    expect(castles.map((c) => [c.name, c.map, c.face])).toEqual(
      expect.arrayContaining([
        ['首里城', '首里杜館', '日本100名城 No.100'],
        ['勝連城', '勝連城跡休憩所', '続日本100名城 No.200'],
      ]),
    )
  })

  it('旅館（京都下京区）、民宿（那覇）進去是你的房間；房間 6×3 的架子、4 個相框、書桌，出口回到上次的旅館', () => {
    const kinn = world.generate('261068')!.inn!
    const ninn = world.generate('472018')!.inn!
    expect(kinn && ninn).toBeTruthy()
    for (const inn of [kinn, ninn]) {
      const m = world.mapSource(inn.map)!
      expect(m.entities.find((e) => e.kind === 'inn')?.data?.innKind).toBe(inn === kinn ? 'ryokan' : 'minshuku')
      expect(m.warps.some((w) => w.to === 'room')).toBe(true)
      const room = world.mapSource('room')!
      expect(room.entities.filter((e) => e.kind === 'shelfSlot').length).toBe(18)
      expect(room.entities.filter((e) => e.kind === 'frameSlot').length).toBe(4)
      expect(room.entities.filter((e) => e.kind === 'desk').length).toBe(1)
      expect(room.warps[0]!.to).toBe(inn.map)
    }
  })

  it('起點：京都駅的大廳；只有沖繩時是那覇空港的大廳', () => {
    expect(world.start.map).toMatch(/^int:261068:station:/)
    const hall = world.mapSource(world.start.map)!
    expect(hall.name.ja).toBe('京都駅')
    expect(hall.entities.map((e) => e.kind)).toEqual(expect.arrayContaining(['travel', 'stamp', 'shop']))
    const travel = hall.entities.find((e) => e.kind === 'travel')!.data as unknown as TravelData
    expect(travel.dests.map((d) => d.name)).toEqual(expect.arrayContaining(['祇園四条', '那覇空港']))
    const toNaha = travel.dests.find((d) => d.name === '那覇空港')!
    expect(toNaha).toMatchObject({ kmKind: 'straight', mode: 'plane', via: { name: '関西国際空港', kmKind: 'rail', mode: 'rail' } })
    const ow = createWorld([okinawa()])
    expect(ow.start.map).toMatch(/^int:472018:airport:/)
  })
})

describe('鎮的生成：站、拍攝點、NPC 的位置', () => {
  const world = createWorld(both())
  const k = kyoto()
  const o = okinawa()
  const prefOf = (pref: string) => (pref === 'kyoto' ? k : o)
  const npcsOf = (m: GameMap) => m.entities.filter((e) => e.kind === 'npc')

  it('有名城蓋章地點的城：每一個都有蓋章的室內（二条城的章在中京区的「大休憩所」）', () => {
    const rooms = new Map<string, string>()
    for (const t of world.towns) for (const [, m] of world.generate(t.id)!.interiors) for (const e of m.entities) if (e.kind === 'stamp' && e.data!.stampKind === 'castle') rooms.set(e.data!.name as string, `${t.name.ja}:${m.name.ja}`)
    expect(rooms.get('二条城')).toBe('中京区:大休憩所')
    for (const c of [...k.castles, ...o.castles].filter((c) => c.st?.length)) expect(rooms.get(c.n), c.n).toBeTruthy()
  })

  it('名城的章放在資料寫的地點：福知山城（st 的第一個是「福知山観光案内所（JR福知山駅構内）」）在福知山駅的大廳，不在城牆裡', () => {
    const fuku = world.townById('262013')!
    const g = world.generate('262013')!
    // 車站的大廳：站章台旁邊一張名城的印台＋立牌（名字照資料、出處是名城的清單）
    const hall = [...g.interiors.values()].find((m) => m.name.ja === '福知山駅')!
    expect(hall).toBeTruthy()
    const stamps = hall.entities.filter((e) => e.kind === 'stamp')
    expect(stamps.map((e) => e.data!.stampKind)).toEqual(['station', 'castle'])
    expect(stamps[1]!.data).toMatchObject({ stampId: 'castle:castle-158', name: '福知山城', castleId: 'castle-158', spotId: 'wd-Q2969288', face: '続日本100名城 No.158' })
    const board = hall.entities.find((e) => e.kind === 'sign')!.data as unknown as SignData
    expect(board.title).toEqual({ ja: '福知山観光案内所（JR福知山駅構内）' })
    expect(board.source_url).toBe('https://ja.wikipedia.org/wiki/続日本100名城')
    // 立牌、印台站得到旁邊（可達性的測試也會走一遍）
    const view = new MapView(hall)
    for (const e of [stamps[1]!, hall.entities.find((x) => x.kind === 'sign')!]) {
      expect(passable(view.beh(e.x, e.y)), e.id).toBe(false)
      expect(passable(view.beh(e.x, e.y + 1)), e.id).toBe(true)
    }
    // 城：沒有蓋章的室內，城牆裡也沒有小屋
    expect([...g.interiors.keys()].filter((id) => id.includes(':castle:'))).toEqual([])
    const lm = g.landmarks.find((l) => l.spotId === 'wd-Q2969288')!
    expect(lm.kind).toBe('castle')
    for (let y = lm.area.y; y < lm.area.y + lm.area.h; y++)
      for (let x = lm.area.x; x < lm.area.x + lm.area.w; x++) expect(tileDef(g.map.lower[y * g.map.w + x]!)?.name ?? '', `${x},${y}`).not.toMatch(/castle-house/)
    // 城門前的人說蓋章地點（附出處）
    const fact = g.map.entities.find((e) => e.kind === 'npc' && (e.data as { fact?: FactRef }).fact?.template === 'castle.stamp')
    expect((fact?.data as { fact: FactRef }).fact.params.stamp).toBe('福知山観光案内所（JR福知山駅構内）')
    // 判斷：寫在車站裡（駅構内、駅前）才放車站；道の駅、ロープウェイ的駅、城裡的地點照舊
    const stops = { stops: fuku.stops }
    expect(stampStationOf({ st: ['福知山観光案内所（JR福知山駅構内）'] }, stops)?.name).toBe('福知山')
    expect(stampStationOf({ st: ['若桜町観光案内所 (若桜鉄道若桜駅前)'] }, stops)?.id).toBe(fuku.stops[0]!.id)
    expect(stampStationOf({ st: ['大休憩所'] }, stops)).toBeNull()
    expect(stampStationOf({ st: ['道の駅熊野・板屋九郎兵衛の里'] }, stops)).toBeNull()
    expect(stampStationOf({ st: ['近江鉄道八幡山ロープウェイ山上駅'] }, stops)).toBeNull()
    expect(stampStationOf({ st: ['福知山観光案内所（JR福知山駅構内）'] }, { stops: [{ id: 'main', kind: 'bus', name: '福知山', lat: 0, lng: 0 }] })).toBeNull()
  })

  it('到站的地方：那一格、往前 3 格、左右沒有人（一下車不會跟人疊在一起、撞到人）', () => {
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      for (const [id, a] of Object.entries(g.stops)) {
        const m = world.mapSource(a.map)!
        const dy = a.dir === 'down' ? 1 : a.dir === 'up' ? -1 : 0
        const dx = a.dir === 'right' ? 1 : a.dir === 'left' ? -1 : 0
        const lane = new Set<string>()
        for (let n = 0; n <= 3; n++) for (const s of [-1, 0, 1]) lane.add(`${a.x + dx * n + dy * s},${a.y + dy * n + dx * s}`)
        const hit = npcsOf(m).filter((e) => lane.has(`${e.x},${e.y}`))
        expect(hit.map((e) => e.id), `${t.name.ja} ${id}`).toEqual([])
      }
    }
    // 新遊戲的起點（京都駅的大廳）：旁邊沒有人
    const hall = world.mapSource(world.start.map)!
    expect(npcsOf(hall).filter((e) => Math.abs(e.x - world.start.x) + Math.abs(e.y - world.start.y) <= 2)).toEqual([])
  })

  it('地圖邊一圈走不進去（樹排是實心的）', () => {
    for (const t of world.towns) {
      const m = world.generate(t.id)!.map
      const seen = flood(new MapView(m), m.start!)
      const edge: string[] = []
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) if (seen[y * m.w + x] && (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) && !m.warps.some((w) => w.x === x && w.y === y)) edge.push(`${x},${y}`)
      expect(edge, t.name.ja).toEqual([])
    }
  })

  it('海上的橋往開闊的海伸出去、一直接到地圖邊（不沿著岸邊、不在海中間斷掉）', () => {
    let n = 0
    for (const t of world.towns) {
      const m = world.generate(t.id)!.map
      const isBridge = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && /^okinawa\/bridge-[hv]$/.test(tileDef(m.ground[y * m.w + x]!)?.name ?? '')
      const cells: Array<[number, number]> = []
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (isBridge(x, y)) cells.push([x, y])
      if (!cells.length) continue
      n++
      // 每一座橋（連在一起的一串）都有一頭碰到地圖邊
      const seen = new Set<string>()
      for (const [x0, y0] of cells) {
        if (seen.has(`${x0},${y0}`)) continue
        const run: Array<[number, number]> = []
        const stack: Array<[number, number]> = [[x0, y0]]
        while (stack.length) {
          const [x, y] = stack.pop()!
          if (seen.has(`${x},${y}`) || !isBridge(x, y)) continue
          seen.add(`${x},${y}`)
          run.push([x, y])
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
        }
        expect(run.some(([x, y]) => x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1), `${t.name.ja} ${x0},${y0}`).toBe(true)
      }
    }
    expect(n).toBeGreaterThan(0)
  })

  it('拍攝點：地標的範圍放得進最窄的畫面（10×8 格以內），旁邊 2 格內沒有不會走開的人、也沒有人擋在地標上', () => {
    let spots = 0
    for (const t of world.towns) {
      const m = world.generate(t.id)!.map
      const still = npcsOf(m).filter((e) => e.data!.move !== 'wander')
      for (const e of m.entities.filter((x) => x.kind === 'photoSpot')) {
        spots++
        const tg = (e.data as unknown as { target: { x: number; y: number; w: number; h: number } }).target
        expect(tg.w, e.id).toBeLessThanOrEqual(10)
        expect(tg.h, e.id).toBeLessThanOrEqual(8)
        // 從拍攝點打開取景框：鏡頭挪到看得到整個地標（最窄的畫面 176×160、桌機 240×160）
        for (const W of [176, 240]) {
          const cx = cameraAxis(e.x * 16 + 8, m.w * 16, W, [tg.x * 16, tg.w * 16])
          const cy = cameraAxis(e.y * 16 + 8, m.h * 16, 160, [tg.y * 16, tg.h * 16])
          expect(tg.x * 16 >= cx && (tg.x + tg.w) * 16 <= cx + W && tg.y * 16 >= cy && (tg.y + tg.h) * 16 <= cy + 160, `${t.name.ja} ${e.id} W=${W}`).toBe(true)
        }
        const inT = (x: number, y: number) => x >= tg.x && x < tg.x + tg.w && y >= tg.y && y < tg.y + tg.h
        const bad = still.filter((n) => Math.max(Math.abs(n.x - e.x), Math.abs(n.y - e.y)) <= 2 || inT(n.x, n.y) || inT(n.x, n.y - 1))
        expect(bad.map((n) => n.id), `${t.name.ja} ${e.id}`).toEqual([])
      }
    }
    expect(spots).toBeGreaterThan(100)
  })

  it('車站、機場、授与所、店、旅館：櫃台後面走不進去（隔著櫃台說話）', () => {
    for (const t of world.towns)
      for (const [id, m] of world.generate(t.id)!.interiors) {
        const seen = flood(new MapView(m), m.start!)
        const staff = m.entities.filter((e) => ['travel', 'shop', 'inn', 'stamp'].includes(e.kind) && (e.data as { look?: string }).look)
        for (const e of staff) {
          const next = [[0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => seen[(e.y + dy!) * m.w + e.x + dx!])
          expect(next, `${id} ${e.id}`).toEqual([])
        }
      }
  })

  it('路人的外觀：4 格內不撞衫（12 種）', () => {
    for (const t of world.towns) {
      const n = npcsOf(world.generate(t.id)!.map)
      for (const a of n) for (const b of n) if (a !== b && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 4) expect(a.data!.look === b.data!.look, `${t.name.ja} ${a.id} ${b.id}`).toBe(false)
    }
  })

  it('老舖・茶屋：在這一鎮的區界裡的才放（一保堂、鳩居堂在中京区）', () => {
    for (const t of world.towns) {
      const p = prefOf(t.pref)
      for (const e of world.generate(t.id)!.map.entities) {
        const id = (e.data as { shiniseId?: string } | undefined)?.shiniseId
        if (!id) continue
        expect(p.shiniseById(id)!.m, `${t.name.ja} ${p.shiniseById(id)!.n}`).toBe(t.id)
      }
    }
    const names = (code: string) => world.generate(code)!.map.entities.map((e) => (e.data as { shiniseId?: string } | undefined)?.shiniseId).filter(Boolean)
    expect([...names('261033'), ...names('261050'), ...names('261084')].map((id) => k.shiniseById(id!)!.n)).not.toEqual(expect.arrayContaining(['一保堂']))
  })
})

describe('季節、花況、祭典', () => {
  const k = kyoto()
  const o = okinawa()
  const w = buildWorld([k, o])
  const town = (id: string) => w.towns.find((t) => t.id === id)!

  it('京都：平年值（京都）決定季節與花況', () => {
    const c = climateOf(k, town('261068'))!
    expect(c.station).toBe('京都')
    const d = (m: number, dd: number) => ({ y: 2026, m, d: dd })
    expect(seasonAt(d(1, 20), 'kinki', c)).toBe('winter')
    expect(seasonAt(d(2, 25), 'kinki', c)).toBe('spring')
    expect(seasonAt(d(7, 10), 'kinki', c)).toBe('summer')
    expect(seasonAt(d(11, 30), 'kinki', c)).toBe('autumn')
    expect(seasonAt(d(12, 25), 'kinki', c)).toBe('winter')
    expect([...bloomAt(d(4, 2), 'kinki', c)]).toEqual(['sakura'])
    expect([...bloomAt(d(3, 1), 'kinki', c)]).toEqual(['ume'])
    expect([...bloomAt(d(6, 20), 'kinki', c)]).toEqual(['ajisai'])
    expect([...bloomAt(d(11, 30), 'kinki', c)].sort()).toEqual(['ichou', 'kaede'])
    expect(bloomAt(d(8, 1), 'kinki', c).size).toBe(0)
  })

  it('沖繩：那覇、宮古島各用自己的平年值；寒緋櫻 1–2 月；沒有楓、銀杏、紫陽花', () => {
    expect(climateOf(o, town('472018'))!.station).toBe('那覇')
    expect(climateOf(o, town('472140'))!.station).toBe('宮古島')
    const c = climateOf(o, town('472018'))!
    expect([...bloomAt({ y: 2026, m: 1, d: 25 }, 'okinawa', c)].sort()).toEqual(['kanhi', 'ume'])
    expect([...bloomAt({ y: 2026, m: 2, d: 20 }, 'okinawa', c)]).toEqual([])
    expect(seasonAt({ y: 2026, m: 1, d: 25 }, 'okinawa', c)).toBe('spring')
    expect(seasonAt({ y: 2026, m: 8, d: 1 }, 'okinawa', c)).toBe('summer')
    expect(seasonAt({ y: 2026, m: 11, d: 10 }, 'okinawa', c)).toBe('autumn')
    for (let m = 1; m <= 12; m++) for (const f of bloomAt({ y: 2026, m, d: 15 }, 'okinawa', c)) expect(['kanhi', 'ume']).toContain(f)
  })

  it('開花的那天，鎮上的樹換成開花的；沒開就是一般的', () => {
    const world = createWorld([k, o])
    const gen = world.generate('261068')!
    const sakura = gen.bloom.filter((b) => b.flower === 'sakura')
    expect(sakura.length).toBeGreaterThan(0)
    world.seasonOf({ y: 2026, m: 4, d: 2 })
    const spring = world.mapSource('town:261068')!
    expect(sakura.every((b) => spring[b.layer][b.i] === b.bloom)).toBe(true)
    world.seasonOf({ y: 2026, m: 8, d: 2 })
    const summer = world.mapSource('town:261068')!
    expect(sakura.every((b) => summer[b.layer][b.i] === b.base)).toBe(true)
  })

  it('祭典：那個月、位置在這一鎮時才有攤子與祭典的人（事實台詞有出處）', () => {
    const world = createWorld([k, o])
    const t = world.towns.find((x) => festivalsIn(k, x).some((f) => f.months?.length) && world.generate(x.id)!.festival.tiles.length)
    expect(t, '有祭典的鎮').toBeTruthy()
    const f = festivalsIn(k, t!).find((x) => x.months?.length)!
    const gen = world.generate(t!.id)!
    const on = { y: 2026, m: f.months![0]!, d: 10 }
    expect(world.festivalsOf(on, t!.id).length).toBeGreaterThan(0)
    world.seasonOf(on)
    const map = world.mapSource(t!.mapId)!
    expect(gen.festival.tiles.every((x) => map[x.layer][x.i] === x.id)).toBe(true)
    const fest = map.entities.filter((e) => e.id.startsWith('festival:'))
    expect(fest.length).toBeGreaterThan(0)
    const npc = fest.find((e) => e.data!.role === 'festival')!
    expect((npc.data!.fact as FactRef).template).toBe('festival.month')
    const off = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !festivalsIn(k, t!, m).length)!
    world.seasonOf({ y: 2026, m: off, d: 10 })
    expect(world.mapSource(t!.mapId)!.entities.some((e) => e.id.startsWith('festival:'))).toBe(false)
  })

  it('祭典的位置在區界裡才算（不用外框、不用 3 km）：葵祭只在北区、時代祭只在中京区、沖縄サンバカーニバル不在うるま市', () => {
    const world = createWorld([k, o])
    const fests = (code: string, m: number) => world.festivalsOf({ y: 2026, m, d: 10 }, code).map((f) => f.name.ja)
    expect(fests('261084', 10)).toEqual([])
    expect(fests('261084', 5)).toEqual([])
    expect(fests('261017', 5)).toEqual(expect.arrayContaining(['葵祭']))
    expect(fests('261041', 10)).toEqual(expect.arrayContaining(['時代祭']))
    expect(fests('261033', 10)).toEqual(['鞍馬の火祭'])
    expect(fests('472131', 11)).toEqual([])
    // 一整年站著的事實 NPC 也不說別區的祭典
    const facts = world.generate('261084')!.map.entities.filter((e) => (e.data?.fact as FactRef | undefined)?.template === 'festival.month')
    expect(facts).toEqual([])
  })

  it('祭典的那個月：攤子不蓋到人、祭典的人站在走得到的格子、門與 NPC 都還走得到', () => {
    const world = createWorld([k, o])
    let checked = 0
    for (const t of world.towns)
      for (let m = 1; m <= 12; m++) {
        if (!world.festivalsOf({ y: 2026, m, d: 10 }, t.id).length) continue
        world.seasonOf({ y: 2026, m, d: 10 }, t.id)
        world.mapSource(t.mapId)
        world.seasonOf({ y: 2026, m, d: 10 })
        const map = world.mapSource(t.mapId)!
        const view = new MapView(map)
        for (const e of map.entities.filter((x) => x.kind === 'npc')) {
          expect(passable(view.beh(e.x, e.y)), `${t.name.ja} ${m} 月 ${e.id} (${e.x},${e.y})`).toBe(true)
          expect(map.over[e.y * map.w + e.x] && tileDef(map.over[e.y * map.w + e.x]!)?.name?.includes('stall'), `${t.name.ja} ${m} 月 ${e.id} 被攤子蓋住`).toBeFalsy()
        }
        const seen = flood(view, map.start!)
        const miss = targetsOf({ w: map.w, h: map.h, map }, view).filter((x) => !x.cells.some((c) => seen[c.y * map.w + c.x]))
        expect(miss.map((x) => x.what), `${t.name.ja} ${m} 月`).toEqual([])
        checked++
      }
    expect(checked).toBeGreaterThan(5)
  })

  it('有祭典的月份，每一鎮都有一個講祭典的人（攤子擺不下的鄉下鎮，例：福知山市，也站在提燈旁）', () => {
    const world = createWorld(both())
    let n = 0
    for (const t of world.towns)
      for (let m = 1; m <= 12; m++) {
        if (!world.festivalsOf({ y: 2026, m, d: 10 }, t.id).length) continue
        world.seasonOf({ y: 2026, m, d: 10 }, t.id)
        world.seasonOf({ y: 2026, m, d: 10 })
        const map = world.mapSource(t.mapId)!
        const who = map.entities.filter((e) => e.id.startsWith('festival:') && e.data!.role === 'festival')
        expect(who.length, `${t.name.ja} ${m} 月`).toBe(1)
        n++
      }
    expect(n).toBeGreaterThan(5)
  })
})

describe('坐車', () => {
  it('travel(game, link)：車窗畫面（可以按 A 跳過）→ 到那一鎮的車站門口，遊戲時間往前', () => {
    const world = createWorld(both())
    const game = new Game({ tokens, maps: world.mapSource, start: world.start, storage: null, seasonOf: world.seasonOf, genVersion: world.genVersion, now: new Date('2026-10-16T00:00:00Z') })
    const off = world.attach(game)
    game.newGame()
    expect(game.map!.id).toBe(world.start.map)
    const link = world.links.find((l) => l.from === '261068' && l.to === '261050')!
    const before = game.clock.minutes
    const arrived: string[] = []
    const r = world.travel(game, link.id, { onArrive: (t) => arrived.push(t.id) })!
    let frames = 0
    let overlaid = false
    while (!r.done && frames < 60 * 20) {
      game.update()
      if (frames === 60) overlaid = !!(game as unknown as { overlay: unknown }).overlay
      frames++
    }
    expect(r.done).toBe(true)
    expect(overlaid).toBe(true)
    expect(game.map!.id).toBe('town:261050')
    const a = world.arrival(link)
    expect([game.player.x, game.player.y]).toEqual([a.x, a.y])
    expect(game.clock.minutes - before).toBeGreaterThanOrEqual(link.minutes - 1)
    expect(arrived).toEqual(['261050'])
    // 跳過：按住 A 之後很快就到
    const back = world.links.find((l) => l.from === '261050' && l.to === '261068')!
    const r2 = world.travel(game, back)!
    let f2 = 0
    while (!r2.done && f2 < 60 * 20) {
      if (f2 === 40) game.input.press('A', 'test')
      if (f2 === 44) game.input.release('A', 'test')
      game.update()
      f2++
    }
    expect(game.map!.id).toBe('town:261068')
    expect(f2).toBeLessThan(frames)
    off()
  })

  it('車窗畫面在直拿的手機（邏輯高 256）：車廂在中間、下面是地板，飛機的窗在正中，渡輪的甲板一樣高', () => {
    const pal = new TileCache(tokens).palette('day')
    const at = (g: Gfx, x: number, y: number) => g.buf[y * g.w + x]
    const draw = (mode: 'rail' | 'bus' | 'plane' | 'ferry', w: number, h: number) => {
      const g = new Gfx(w, h, pal)
      rideOverlay({ mode, kit: 'okinawa', time: 'day', season: 'summer' })(g, 0)
      return g
    }
    for (const mode of ['rail', 'bus'] as const) {
      const gba = draw(mode, 240, 160)
      const tall = draw(mode, 195, 256)
      const seat = at(gba, 5, 150)
      // 座椅一樣高（48 + 106 起、54 格），再下面是地板
      expect(at(tall, 5, 48 + 150), mode).toBe(seat)
      expect(at(tall, 5, 250), mode).not.toBe(seat)
      // 窗在畫面中間附近（窗的上下緣對稱）
      expect(Math.abs(36 + 48 + 32 - 128), mode).toBeLessThanOrEqual(12)
    }
    // 飛機的牆是兩色抖色：上面是牆、正中是窗
    const gba = draw('plane', 240, 160)
    const wall = new Set([0, 1, 2, 3].flatMap((dx) => [0, 1, 2, 3].map((dy) => at(gba, 4 + dx, 4 + dy))))
    const plane = draw('plane', 195, 256)
    expect(wall.has(at(plane, 97, 128))).toBe(false)
    expect(wall.has(at(plane, 97, 20))).toBe(true)
    const deck = at(draw('ferry', 240, 160), 5, 150)
    expect(at(draw('ferry', 195, 256), 5, 250)).toBe(deck)
  })

  it('那覇空港 → 宮古島：飛機，到離島的機場大廳', () => {
    const world = createWorld(both())
    const link = world.links.find((l) => l.from === '472018' && l.to === '472140')!
    const a = world.arrival(link)
    expect(a.map).toMatch(/^int:472140:airport:/)
    expect(world.mapSource(a.map)!.name.ja).toBe('下地島空港')
  })
})
