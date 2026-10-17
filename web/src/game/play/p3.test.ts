import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'
import type { BundleIndex } from '../../services/bundles'

import worldRaw from '../fixtures/_world.json'
import hokkaidoRaw from '../fixtures/hokkaido.json'
import hyogoRaw from '../fixtures/hyogo.json'
import kyotoRaw from '../fixtures/kyoto.json'
import naraRaw from '../fixtures/nara.json'
import okinawaRaw from '../fixtures/okinawa.json'
import osakaRaw from '../fixtures/osaka.json'
import tokyoRaw from '../fixtures/tokyo.json'
import { Game } from '../engine/game'
import { memoryStore, saveKey, type SaveStorage } from '../engine/save'
import { registerDefaultLooks } from '../sprites'
import { installSystems } from '../systems'
import { pressStamp, stampBook, stampView } from '../systems/stamps'
import { systemsOf } from '../systems/state'
import type { StampData } from '../systems/types'
import { travel as travelTalk } from '../systems/talk'
import { notebookData } from '../ui/notebook'
import { BUNDLES, type BundleApi, CANNOT_GO, type GameWorld, type TravelData } from '../world'

import { loadPlayWorld, playMaps, savePrefs } from './world'

// P3 的延遲載入（規格 §12）：一開始只抓世界索引＋京都；坐車到別的縣才抓那一縣（車窗裡等；讀不到回出發的站）；
// 存檔在別的縣時先讀那一縣再繼續。用假的 BundleApi（回 fixture、記下抓了什麼）。

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
registerDefaultLooks()
const FIX: Record<string, unknown> = { _world: worldRaw, kyoto: kyotoRaw, okinawa: okinawaRaw, nara: naraRaw, osaka: osakaRaw, hyogo: hyogoRaw, tokyo: tokyoRaw, hokkaido: hokkaidoRaw }
const PREFS = ['kyoto', 'okinawa', 'nara', 'osaka', 'hyogo', 'tokyo', 'hokkaido']
const INDEX: BundleIndex = {
  prefectures: Object.fromEntries(PREFS.map((p) => [p, { count: 1, featured: 0, version: `${p}-v` }])),
  game: Object.fromEntries(Object.keys(FIX).map((p) => [p, { version: `${p}-g` }])),
}

/** 假的 bundles：game bundle 回 fixture；fail 的縣讀不到（完整資料那條路也讀不到）；其他的檔一律不該抓 */
function fakeApi(o: { fail?: ReadonlySet<string>; offline?: ReadonlySet<string> } = {}) {
  const calls: string[] = []
  const nope = (what: string) => () => {
    calls.push(what)
    return Promise.reject(new Error(`${what} 不該抓`))
  }
  const api: BundleApi = {
    ...BUNDLES,
    fetchIndex: async () => INDEX,
    fetchMap: nope('map'),
    fetchDetail: nope('detail'),
    fetchRail: nope('rail'),
    fetchMunicipalities: nope('municipalities'),
    fetchFestivals: nope('festivals'),
    fetchPrefSpecialties: nope('specialties'),
    fetchSpecialties: nope('specialties'),
    fetchPack: nope('pack'),
    fetchSeasons: nope('seasons'),
    fetchRailGraph: nope('rail-graph'),
    fetchGame: async (pref, version) => {
      calls.push(pref)
      expect(version).toBe(`${pref}-g`)
      if (o.offline?.has(pref)) throw new TypeError('Failed to fetch')
      if (o.fail?.has(pref)) throw new Error('500')
      // 讀到一半（別的 promise 先跑）
      await new Promise((r) => setTimeout(r, 5))
      return structuredClone(FIX[pref])
    },
  }
  return { api, calls }
}

async function boot(api: BundleApi, store: SaveStorage = memoryStore()) {
  const r = await loadPlayWorld(async () => INDEX, { api })
  if (!r.ok) throw new Error('世界做不出來')
  const world = r.world
  const said: string[] = []
  const game = new Game({
    tokens,
    maps: playMaps(world),
    start: world.start,
    genVersion: world.genVersion,
    seasonOf: (d) => world.seasonOf(d),
    storage: store,
    saveKey: saveKey(null),
    now: new Date('2026-10-17T00:00:00Z'),
  })
  const sys = installSystems(game, { prefs: world.prefs(), world: world.world, maps: playMaps(world), travel: (g, l) => void (l.link && world.travel(g, l.link)) })
  world.onPrefs((ps) => sys.setData(ps, world.world))
  const off = world.attach(game)
  game.on('say', (e) => {
    said.push(e.text)
    e.resolve()
  })
  game.on('ask', (e) => e.resolve(0))
  return { world, game, sys, off, said, r }
}

/** 跑 n 格（每幾格讓 promise 跑一下：讀資料的 setTimeout） */
async function frames(g: Game, n: number) {
  for (let i = 0; i < n; i++) {
    g.update(1 / 60)
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 1))
  }
}
async function ride(w: GameWorld, g: Game, id: string) {
  const runner = w.travel(g, id)
  expect(runner, id).toBeTruthy()
  for (let i = 0; i < 200 && !runner!.done; i++) await frames(g, 30)
  expect(runner!.done, `${id} 坐完了`).toBe(true)
}

describe('延遲載入', () => {
  it('一開始只抓世界索引與京都；剪票口列得出別的縣（沒讀也列）', async () => {
    const { api, calls } = fakeApi()
    const { world, game, sys } = await boot(api)
    expect(calls).toEqual(['_world', 'kyoto'])
    expect(world.prefs().map((p) => p.pref)).toEqual(['kyoto'])
    expect(world.atlas.map((p) => p.pref)).toEqual(PREFS)
    game.newGame()
    expect(game.map?.id).toBe('int:261068:station:0')
    const gate = game.map!.entities.find((e) => e.kind === 'travel')!.data as unknown as TravelData
    expect(gate.dests.map((d) => d.name).slice(-4)).toEqual(['那覇空港', '近鉄奈良', '大阪', '東京'])
    // 還沒讀的縣的鎮：systems 也認得名字（手帳、目的地的縣名）
    expect(sys.data.town('292010')?.name.ja).toBe('奈良市')
    expect(sys.data.gamePrefs()).toEqual(['hokkaido', 'tokyo', 'kyoto', 'osaka', 'hyogo', 'nara', 'okinawa'])
  })

  it('坐車到大阪才抓大阪；到了大阪駅前，已經生成的京都不重做', async () => {
    const { api, calls } = fakeApi()
    const { world, game, said } = await boot(api)
    game.newGame()
    await frames(game, 30)
    const kyoto = world.generate('261068')
    const t0 = game.clock.date.d * 1440 + game.clock.minutes
    await ride(world, game, '261068.main>271276.main')
    expect(calls).toEqual(['_world', 'kyoto', 'osaka'])
    expect(world.hasPref('osaka')).toBe(true)
    expect(game.map?.id).toBe('town:271276')
    expect(said).not.toContain(CANNOT_GO)
    expect(game.clock.date.d * 1440 + game.clock.minutes).toBeGreaterThan(t0)
    expect(world.generate('261068')).toBe(kyoto)
    // 大阪的剪票口：兵庫、奈良、京都、関西国際空港經由的沖繩、北海道
    const hall = world.generate('271276')!.interiors.get('int:271276:station:0')!
    const dests = (hall.entities.find((e) => e.kind === 'travel')!.data as unknown as TravelData).dests
    expect(dests.filter((d) => !d.town.startsWith('27')).map((d) => d.town)).toEqual(['261068', '281107', '292010', '472018', '012246'])
  })

  it('讀不到（伺服器錯、連不上）：回到出發的站說「現在去不了。」，時間不走，之後連上可以再去', async () => {
    const fail = new Set(['tokyo'])
    const { api, calls } = fakeApi({ fail, offline: new Set(['hokkaido']) })
    const { world, game, said } = await boot(api)
    game.newGame()
    await frames(game, 30)
    const at = { map: game.map?.id, x: game.player.x, y: game.player.y }
    const t0 = game.clock.minutes
    await ride(world, game, '261068.main>131016.main')
    expect(said).toEqual([CANNOT_GO])
    expect({ map: game.map?.id, x: game.player.x, y: game.player.y }).toEqual(at)
    expect(game.clock.minutes).toBe(t0)
    expect(world.hasPref('tokyo')).toBe(false)
    expect(calls).toContain('tokyo')
    // 連不上（offline）也是讀不到
    expect(await world.ensurePref('hokkaido')).toBe(false)
    // 這一次讀得到
    fail.delete('tokyo')
    await ride(world, game, '261068.main>131016.main')
    expect(game.map?.id).toBe('town:131016')
    expect(said).toEqual([CANNOT_GO])
  })

  it('存檔在別的縣：重新整理後只抓索引＋京都，繼續之前讀那一縣，接著玩', async () => {
    const store = memoryStore()
    {
      const { api } = fakeApi()
      const { world, game } = await boot(api, store)
      game.newGame()
      await frames(game, 30)
      await ride(world, game, '261068.main>271276.main')
      await ride(world, game, '271276.main>281107.main')
      expect(game.map?.id).toBe('town:281107')
      systemsOf(game).visited.push('271276', '281107')
      expect(game.save().ok).toBe(true)
    }
    const { api, calls } = fakeApi()
    const { world, game } = await boot(api, store)
    expect(calls).toEqual(['_world', 'kyoto'])
    const plan = savePrefs(game.savedData(), (c) => world.prefOfTown(c))
    expect(plan.need).toEqual(['hyogo'])
    expect(plan.also).toContain('osaka')
    for (const p of plan.need) expect(await world.ensurePref(p)).toBe(true)
    expect(game.continueGame()).toBe(true)
    expect(game.map?.id).toBe('town:281107')
    expect(calls).toEqual(['_world', 'kyoto', 'hyogo'])
  })

  it('重新整理後去過的縣還沒讀進來：印帳照蓋章時記下的畫（No.、出處、羅馬字），聽來的寫「讀取中」，讀好了換上', async () => {
    const store = memoryStore()
    const book = (game: Game, sys: ReturnType<typeof installSystems>) =>
      stampBook(game, sys.data, ['hokkaido'])
        .find((b) => b.pref === 'hokkaido')!
        .stamps.map((s) => ({ id: s.id, face: s.face, where: s.where, source: s.source?.url, romaji: s.art.romaji, no: s.art.no, sil: s.art.silhouette }))
    let full: ReturnType<typeof book>
    {
      const { api } = fakeApi()
      const { world, game, sys } = await boot(api, store)
      game.newGame()
      expect(await world.ensurePref('hokkaido')).toBe(true)
      expect(game.warpNow('town:012025', 10, 10)).toBe(true)
      const castle: StampData = { stampId: 'castle:castle-002', stampKind: 'castle', pref: 'hokkaido', name: '五稜郭', castleId: 'castle-002', spotId: 'wd-Q1196357' }
      const station: StampData = { stampId: 'station:node-8082693151', stampKind: 'station', pref: 'hokkaido', name: '小樽', stationId: 'node-8082693151' }
      for (const d of [castle, station]) pressStamp(game, d, '012025', stampView(d, sys.data))
      sys.hear({ k: 'fact', id: 'castle.stamp', ref: { kind: 'castle', id: 'castle-002' } })
      full = book(game, sys)
      expect(full[0]!.face).toBe('日本100名城 No.2')
      expect(full[0]!.source).toMatch(/wikipedia/)
      expect(full[1]!.romaji).toBe('OTARU')
      expect(notebookData(game, null).heard.facts.length).toBe(1)
      expect(game.save().ok).toBe(true)
    }
    const { api } = fakeApi()
    const { world, game, sys } = await boot(api, store)
    // 存檔所在的鎮還沒讀（PlayView 會先讀）：這裡只要存檔的 state（印帳、聽來的），放回起點也沒關係
    game.continueGame()
    expect(world.hasPref('hokkaido')).toBe(false)
    // 北海道還沒讀：印帳一樣（名字之外的字、出處、剪影是蓋章時記下的）；聽來的那一句先不列，寫讀取中
    expect(book(game, sys)).toEqual(full)
    const before = notebookData(game, null).heard
    expect(before.facts.length).toBe(0)
    expect(before.pending).toBe(true)
    expect(await world.ensurePref('hokkaido')).toBe(true)
    const after = notebookData(game, null).heard
    expect(after.facts.length).toBe(1)
    expect(after.pending).toBeUndefined()
    expect(book(game, sys)).toEqual(full)
  })

  it('存檔在你的房間：要的是最後住的那一間旅館的縣', () => {
    const save = { map: 'room', ext: { world: { lastInn: 'int:012246:inn:0' }, systems: { visited: ['261068', '271276'], stamps: { a: { p: 'tokyo' } } } } }
    const prefOf = (c: string) => ({ '012246': 'hokkaido', '261068': 'kyoto', '271276': 'osaka' })[c] ?? null
    expect(savePrefs(save as never, prefOf)).toEqual({ need: ['hokkaido'], also: ['kyoto', 'osaka', 'tokyo'] })
    expect(savePrefs(null, prefOf)).toEqual({ need: [], also: [] })
  })

  it('存檔在機場的大廳（P4）：日本的大廳要機場所在的縣（賣店）；台灣的大廳不要哪一縣', () => {
    const prefOf = (c: string) => ({ '261068': 'kyoto' })[c] ?? null
    const hall = (m: string) => ({ 'air:KIX': 'osaka', 'air:HKD': 'hokkaido' })[m] ?? null
    const kix = { map: 'air:KIX', ext: { systems: { visited: ['261068'] } } }
    expect(savePrefs(kix as never, prefOf, hall)).toEqual({ need: ['osaka'], also: ['kyoto'] })
    expect(savePrefs({ map: 'tw:taipei', ext: {} } as never, prefOf, hall)).toEqual({ need: [], also: [] })
    // 沒給 hallPref（P3 的呼叫）：跟以前一樣
    expect(savePrefs(kix as never, prefOf)).toEqual({ need: [], also: ['kyoto'] })
  })

  it('手帳：地圖頁列 7 縣（北到南、還沒去的縣也列鎮）、印帳 7 頁；剪票口的別縣目的地寫縣名', async () => {
    const { api } = fakeApi()
    const { world, game, sys } = await boot(api)
    game.newGame()
    await frames(game, 10)
    const nb = notebookData(game, null)
    const prefs = nb.map.prefs ?? []
    expect(prefs.map((p) => p.pref)).toEqual(['hokkaido', 'tokyo', 'kyoto', 'osaka', 'hyogo', 'nara', 'okinawa'])
    expect(prefs.map((p) => p.title.ja)).toEqual(['北海道', '東京都', '京都府', '大阪府', '兵庫県', '奈良県', '沖縄県'])
    for (const p of prefs) expect(p.towns.length, p.pref).toBe(world.atlas.find((a) => a.pref === p.pref)!.towns.length)
    expect(prefs.find((p) => p.pref === 'kyoto')!.towns.find((t) => t.here)?.id).toBe('261068')
    expect(nb.stamps.books.map((b) => b.pref)).toEqual(prefs.map((p) => p.pref))
    // 剪票口
    const gate = game.map!.entities.find((e) => e.kind === 'travel')!
    game.run(travelTalk(sys, gate)!)
    const panel = sys.ui.panel
    expect(panel?.kind).toBe('travel')
    const dests = panel?.kind === 'travel' ? panel.data.dests : []
    // P4：最後多了関西国際空港的大廳（打開面板時加的，鎮的生成不變）
    expect(dests.filter((d) => d.area).map((d) => `${d.name} ${d.area}`)).toEqual(['那覇空港 沖縄県', '近鉄奈良 奈良県', '大阪 大阪府', '東京 東京都', '関西国際空港 大阪府'])
    expect(dests.filter((d) => !d.area).every((d) => d.town.startsWith('26'))).toBe(true)
    sys.closePanel()
  })

  it('同一縣同時只讀一次', async () => {
    const { api, calls } = fakeApi()
    const { world } = await boot(api)
    const [a, b] = await Promise.all([world.ensurePref('nara'), world.ensurePref('nara')])
    expect([a, b]).toEqual([true, true])
    expect(calls.filter((c) => c === 'nara').length).toBe(1)
  })

  it('沒有世界索引（舊的 bundles）：跟 P2 一樣讀京都、沖繩', async () => {
    const { api, calls } = fakeApi()
    const old: BundleIndex = { ...INDEX, game: { kyoto: { version: 'kyoto-g' }, okinawa: { version: 'okinawa-g' } } }
    const r = await loadPlayWorld(async () => old, { api: { ...api, fetchIndex: async () => old } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.index).toBeNull()
    expect(calls.sort()).toEqual(['kyoto', 'okinawa'])
    expect(r.world.prefs().map((p) => p.pref)).toEqual(['kyoto', 'okinawa'])
  })
})
