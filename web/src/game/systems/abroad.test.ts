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
import type { MapEntity } from '../engine/types'
import { memoryStore, saveKey, type SaveStorage } from '../engine/save'
import { loadPlayWorld, playMaps } from '../play/world'
import { registerDefaultLooks } from '../sprites'
import { notebookData } from '../ui/notebook'
import { BUNDLES, type BundleApi } from '../world'

import { installSystems } from './install'
import { systemsOf } from './state'
import { shop as shopTalk, travel as travelTalk } from './talk'
import type { TravelData, TravelDest, TravelLink } from './types'
import { NEW_GAME_YEN } from './wallet'

// 從台灣出發（P4，規格 §13 第 4 點）的整條流程：新遊戲選出發的城市 → 台灣的出發大廳的出發看板 → 飛到日本
// （台中 → 成田 → 電車到東京、那覇直達）→ 路線規劃記下想去的地方 → 回台灣 → 存檔來回；舊存檔不會被送回台灣。
// 資料都是 fixture（世界索引的 taiwan 是整份拷過來的）。

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
registerDefaultLooks()
const FIX: Record<string, unknown> = { _world: worldRaw, kyoto: kyotoRaw, okinawa: okinawaRaw, nara: naraRaw, osaka: osakaRaw, hyogo: hyogoRaw, tokyo: tokyoRaw, hokkaido: hokkaidoRaw }
const PREFS = ['kyoto', 'okinawa', 'nara', 'osaka', 'hyogo', 'tokyo', 'hokkaido']
const INDEX: BundleIndex = {
  prefectures: Object.fromEntries(PREFS.map((p) => [p, { count: 1, featured: 0, version: `${p}-v` }])),
  game: Object.fromEntries(Object.keys(FIX).map((p) => [p, { version: `${p}-g` }])),
}
const api: BundleApi = { ...BUNDLES, fetchIndex: async () => INDEX, fetchGame: async (pref) => structuredClone(FIX[pref]) }

async function boot(store: SaveStorage = memoryStore(), o: { api?: BundleApi; jingles?: string[] } = {}) {
  const r = await loadPlayWorld(async () => INDEX, { api: o.api ?? api })
  if (!r.ok) throw new Error('世界做不出來')
  const world = r.world
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
  const sys = installSystems(game, {
    prefs: world.prefs(),
    world: world.world,
    maps: playMaps(world),
    travel: (g, l) => void (l.link && world.travel(g, l.link)),
    jingle: (n) => o.jingles?.push(`${n}@${game.map?.id ?? ''}`),
  })
  world.onPrefs((ps) => sys.setData(ps, world.world))
  world.attach(game)
  const said: string[] = []
  game.on('say', (e) => {
    said.push(e.text)
    e.resolve()
  })
  game.on('ask', (e) => e.resolve(0))
  return { world, game, sys, said }
}

async function frames(g: Game, n: number) {
  for (let i = 0; i < n; i++) {
    g.update(1 / 60)
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 1))
  }
}
/** 等現在的腳本（坐車）跑完 */
async function settle(g: Game) {
  for (let i = 0; i < 200 && (g.busy || g.paused); i++) await frames(g, 30)
}

/** 打開這個 travel 實體的面板（腳本），回傳面板的資料 */
function open(sys: ReturnType<typeof installSystems>, e: MapEntity): TravelData {
  sys.game.run(travelTalk(sys, e)!)
  const p = sys.ui.panel
  expect(p?.kind).toBe('travel')
  return p?.kind === 'travel' ? p.data : (null as never)
}
const pick = (sys: ReturnType<typeof installSystems>, d: TravelData, x: TravelDest) => sys.closePanel({ ...x, mode: x.mode ?? d.mode, fromTown: d.fromTown } satisfies TravelLink)
const entity = (g: Game, id: string) => g.map!.entities.find((e) => e.id === id)!

/** 手帳的地圖頁上標「現在在這裡」的鎮 */
const hereTowns = (g: Game) => notebookData(g, null).map.towns.filter((t) => t.here).map((t) => t.id)

async function newGameIn(city: string, o: Parameters<typeof boot>[1] = {}) {
  const b = await boot(memoryStore(), o)
  b.game.newGame()
  expect(b.sys.startInTaiwan()).toBe(true)
  const p = b.sys.ui.panel
  expect(p?.kind === 'travel' && p.data.origin?.cities.map((c) => c.name)).toEqual(['台北', '台中', '高雄'])
  const i = p?.kind === 'travel' ? p.data.origin!.cities.findIndex((c) => c.name === city) : -1
  const c = p?.kind === 'travel' ? p.data.origin!.cities[i]! : null
  b.sys.closePanel({ town: `tw:${c!.id}`, name: c!.name, km: 0, kmKind: 'straight', mode: 'plane', fromTown: '' })
  await frames(b.game, 30)
  return b
}

describe('新遊戲：從台灣出發', () => {
  it('先選出發的城市（台北、台中、高雄）→ 那個城市的機場出發大廳；現金 50,000 円；沒有去過任何鎮', async () => {
    const { game, sys } = await newGameIn('台中')
    expect(game.map?.id).toBe('tw:taichung')
    expect(game.map?.name.ja).toBe('台中')
    expect(game.state.money).toBe(NEW_GAME_YEN)
    expect(systemsOf(game).trip).toEqual({ city: '台中' })
    expect(systemsOf(game).visited).toEqual([])
    expect(sys.ui.panel).toBe(null)
    expect(game.paused).toBe(false)
    // 機場的大廳不在任何鎮上（委託的東西不在這裡交）
    expect(sys.townHere()).toBeUndefined()
    // newGame() 先放在京都駅的大廳：從台灣出發的新遊戲不記那裡，手帳的地圖頁沒有「現在在這裡」的鎮
    expect(systemsOf(game).lastTown).toBeUndefined()
    expect(hereTowns(game)).toEqual([])
  })

  it('出發的城市：遊戲裡直飛得到的日本機場（表上的簡稱，看板的順序）；下面寫航線的出處', async () => {
    const { sys, game } = await boot()
    game.newGame()
    sys.startInTaiwan()
    const p = sys.ui.panel
    const o = p?.kind === 'travel' ? p.data : null
    expect(o?.origin?.cities.map((c) => `${c.name} ${c.to.join('、')}`)).toEqual(['台北 成田、関西、那覇、羽田、中部、新千歳、函館', '台中 那覇、成田、中部', '高雄 成田、関西、那覇、中部、新千歳'])
    expect(o?.source).toMatchObject({ label: '国土交通省', url: expect.stringContaining('mlit.go.jp') })
  })

  it('不選（B）：留在台北', async () => {
    const { game, sys } = await boot()
    game.newGame()
    sys.startInTaiwan()
    sys.closePanel()
    await frames(game, 10)
    expect(game.map?.id).toBe('tw:taipei')
    expect(systemsOf(game).trip?.city).toBe('台北')
  })

  it('選出發的城市時存了檔（切到背景、關掉分頁）：繼續時再選一次；選好之後的存檔不再問', async () => {
    const store = memoryStore()
    const a = await boot(store)
    a.game.newGame()
    a.sys.startInTaiwan()
    expect(systemsOf(a.game).trip).toEqual({ city: '台北', choosing: true })
    a.game.save()
    const b = await boot(store)
    expect(b.game.continueGame()).toBe(true)
    expect(b.game.map?.id).toBe('tw:taipei')
    expect(b.sys.resumeOrigin()).toBe(true)
    const p = b.sys.ui.panel
    expect(p?.kind === 'travel' && p.data.origin?.cities.map((c) => c.name)).toEqual(['台北', '台中', '高雄'])
    b.sys.closePanel({ town: 'tw:kaohsiung', name: '高雄', km: 0, kmKind: 'straight', mode: 'plane', fromTown: '' })
    await frames(b.game, 10)
    expect(b.game.map?.id).toBe('tw:kaohsiung')
    expect(systemsOf(b.game).trip).toEqual({ city: '高雄' })
    const c = await boot(store)
    expect(c.game.continueGame()).toBe(true)
    expect(c.sys.resumeOrigin()).toBe(false)
    expect(c.sys.ui.panel).toBeNull()
    expect(c.game.map?.id).toBe('tw:kaohsiung')
  })

  it('世界索引沒有航線資料：照舊從京都駅開始', async () => {
    const { game, sys, world } = await boot()
    const save = world.world.abroad
    world.world.abroad = undefined
    sys.setData(world.prefs(), world.world)
    game.newGame()
    expect(sys.startInTaiwan()).toBe(false)
    expect(game.map?.id).toBe('int:261068:station:0')
    world.world.abroad = save
  })
})

describe('出發看板與坐飛機', () => {
  it('台中的出發看板：那覇、成田、中部；選成田 → 飛機＋電車 → 東京駅（東京的資料坐車時才讀）', async () => {
    const { game, sys, world } = await newGameIn('台中')
    const d = open(sys, entity(game, 'tw:taichung:counter'))
    const b = d.board!
    expect(b.city).toBe('台中')
    expect(b.rows.map((r) => `${r.name} ${r.prefName}`)).toEqual(['那覇空港 沖縄県', '成田国際空港 千葉県', '中部国際空港 愛知県'])
    expect(b.rows.every((r) => r.dest)).toBe(true)
    expect(b.rows[1]!.then?.map((l) => [l.mode, l.to, l.area])).toEqual([['rail', '東京', '東京都']])
    expect(b.rows[0]!.dest!.flight?.weekly).toBe(16)
    expect(b.source).toMatchObject({ label: '国土交通省' })
    // 航空公司：那家公司繁體中文網站上的名字（data/flights/airline_names.json），表上的日文名留著
    expect(b.rows[0]!.airlines.map((a) => `${a.zh}／${a.name}`)).toEqual(['星宇航空／スターラックス航空', '台灣虎航／タイガーエア台湾'])
    // 想去的地方：7 縣的鎮；北海道的鎮從台中接不到
    expect(b.prefs.map((p) => p.pref)).toEqual(['hokkaido', 'tokyo', 'kyoto', 'osaka', 'hyogo', 'nara', 'okinawa'])
    expect(b.prefs[0]!.towns.every((t) => !t.routes.length)).toBe(true)
    const kyoto = b.prefs.find((p) => p.pref === 'kyoto')!.towns.find((t) => t.id === '261068')!
    expect(kyoto.routes.map((r) => r.name)).toEqual(['中部国際空港'])
    expect(world.hasPref('tokyo')).toBe(false)
    const t0 = game.clock.date.d * 1440 + game.clock.minutes
    pick(sys, d, b.rows[1]!.dest!)
    await settle(game)
    expect(world.hasPref('tokyo')).toBe(true)
    expect(game.map?.id).toBe('town:131016')
    expect(game.clock.date.d * 1440 + game.clock.minutes).toBeGreaterThan(t0 + 180)
  })

  it('那覇直達：降在那覇空港的抵達大廳（那覇市的機場）；櫃台多了回台灣（那覇有直飛的三個城市）→ 回台中的出發大廳', async () => {
    const { game, sys } = await newGameIn('台中')
    const d = open(sys, entity(game, 'tw:taichung:board'))
    pick(sys, d, d.board!.rows[0]!.dest!)
    await settle(game)
    expect(game.map?.id).toMatch(/^int:472018:airport:/)
    const counter = game.map!.entities.find((e) => e.kind === 'travel')!
    const c = open(sys, counter)
    const home = c.dests.filter((x) => x.flight)
    expect(home.map((x) => x.name)).toEqual(['台北', '台中', '高雄'])
    // 本來的國內線還在前面
    expect(c.dests.length).toBeGreaterThan(home.length)
    // 回台灣的列：航空公司、每週班次，面板寫航線的出處
    expect(home[0]!.flight?.airlines[0]?.zh).toBeTruthy()
    expect(c.source).toMatchObject({ label: '国土交通省' })
    pick(sys, c, home[1]!)
    await settle(game)
    expect(game.map?.id).toBe('tw:taichung')
    // 存檔、印帳、房間都留著；沖繩去過了
    expect(systemsOf(game).visited).toEqual([])
    expect(systemsOf(game).lastTown).toBe('472018')
    // 在台灣的大廳：手帳的地圖頁沒有「現在在這裡」的鎮（最後在的鎮照舊記著）
    expect(hereTowns(game)).toEqual([])
  })

  it('路線規劃：台北 → 名護市＝那覇空港＋巴士；先飛到那覇，那覇市的巴士站把名護市排最前面，到了就清掉', async () => {
    const { game, sys } = await newGameIn('台北')
    const d = open(sys, entity(game, 'tw:taipei:gate'))
    const nago = d.board!.prefs.find((p) => p.pref === 'okinawa')!.towns.find((t) => t.id === '472093')!
    expect(nago.routes[0]!.name).toBe('那覇空港')
    expect(nago.routes[0]!.legs.map((l) => l.mode)).toEqual(['bus'])
    pick(sys, d, nago.routes[0]!.dest)
    await settle(game)
    expect(systemsOf(game).trip?.plan).toBe('472093')
    // 走出機場到那覇市：巴士站的面板
    const town = game.map!.warps[0]!
    game.warpNow(town.to, town.tx, town.ty)
    const bus = game.map!.entities.find((e) => e.kind === 'travel' && (e.data as unknown as TravelData).mode === 'bus')!
    const bd = open(sys, bus)
    expect(bd.dests[0]).toMatchObject({ town: '472093', planned: true })
    pick(sys, bd, bd.dests[0]!)
    await settle(game)
    expect(game.map?.id).toBe('town:472093')
    expect(systemsOf(game).trip).toEqual({ city: '台北' })
  })

  it('関西国際空港的大廳：京都駅的剪票口多了関西国際空港；大廳的國際線櫃台回台北、高雄；剪票口到大阪、京都…', async () => {
    const { game, sys } = await newGameIn('高雄')
    // 高雄 → 関西：降在大廳
    const d = open(sys, entity(game, 'tw:kaohsiung:counter'))
    const kix = d.board!.rows.find((r) => r.name === '関西国際空港')!
    pick(sys, d, kix.dest!)
    await settle(game)
    expect(game.map?.id).toBe('air:KIX')
    expect(hereTowns(game)).toEqual([])
    const intl = open(sys, entity(game, 'air:KIX:intl'))
    expect(intl.dests.map((x) => x.name)).toEqual(['台北', '高雄'])
    sys.closePanel()
    await frames(game, 4)
    const gate = open(sys, entity(game, 'air:KIX:gate'))
    const towns = gate.dests.map((x) => x.town)
    expect(towns).toContain('271276')
    expect(towns).toContain('261068')
    expect(gate.dests.find((x) => x.town === '261068')).toMatchObject({ area: '京都府', mode: 'rail' })
    pick(sys, gate, gate.dests.find((x) => x.town === '261068')!)
    await settle(game)
    expect(game.map?.id).toBe('town:261068')
    // 京都駅の剪票口：関西国際空港（大阪府）
    game.warpNow('int:261068:station:0', 5, 5)
    const kgate = game.map!.entities.find((e) => e.kind === 'travel')!
    const kd = open(sys, kgate)
    const toKix = kd.dests.find((x) => x.town === 'air:KIX')!
    expect(toKix).toMatchObject({ name: '関西国際空港', area: '大阪府', mode: 'rail' })
    // 原本的目的地還在（12 個）
    expect(kd.dests.filter((x) => !x.town.startsWith('air:')).length).toBe(12)
    pick(sys, kd, toKix)
    await settle(game)
    expect(game.map?.id).toBe('air:KIX')
  })
})

describe('到了日本', () => {
  it('高雄 → 関西 → 電車到下京区：第一次到也有到站的曲子（新遊戲不是從京都駅開始的）', async () => {
    const jingles: string[] = []
    const { game, sys } = await newGameIn('高雄', { jingles })
    const d = open(sys, entity(game, 'tw:kaohsiung:counter'))
    pick(sys, d, d.board!.rows.find((r) => r.name === '関西国際空港')!.dest!)
    await settle(game)
    const gate = open(sys, entity(game, 'air:KIX:gate'))
    pick(sys, gate, gate.dests.find((x) => x.town === '261068')!)
    await settle(game)
    expect(game.map?.id).toBe('town:261068')
    expect(systemsOf(game).visited).toEqual(['261068'])
    expect(jingles).toContain('arrive@town:261068')
    expect(hereTowns(game)).toEqual(['261068'])
  })

  it('飛到関西国際空港：大阪的資料慢一點也等它（賣店有大阪的東西）', async () => {
    let release: (() => void) | null = null
    const slow: BundleApi = {
      ...api,
      fetchGame: async (pref) => {
        if (pref === 'osaka') await new Promise<void>((r) => (release = r))
        return structuredClone(FIX[pref])
      },
    }
    const { game, sys, world } = await newGameIn('高雄', { api: slow })
    const d = open(sys, entity(game, 'tw:kaohsiung:counter'))
    pick(sys, d, d.board!.rows.find((r) => r.name === '関西国際空港')!.dest!)
    // 車窗的時間（2.4 秒）過了還在等（大阪還沒讀到）
    await frames(game, 300)
    expect(game.map?.id).toBe('tw:kaohsiung')
    expect(world.hasPref('osaka')).toBe(false)
    ;(release as (() => void) | null)?.()
    await settle(game)
    expect(game.map?.id).toBe('air:KIX')
    expect(world.hasPref('osaka')).toBe(true)
    game.run(shopTalk(sys, entity(game, 'air:KIX:kiosk'))!)
    const p = sys.ui.panel
    const keys = p?.kind === 'shop' ? p.stock.entries.map((e) => e.key) : []
    expect(keys.some((k) => k.startsWith('specialty:'))).toBe(true)
  })

  it('大阪的資料一直讀不到：最多等幾秒，照樣降在関西国際空港的大廳', async () => {
    const never: BundleApi = { ...api, fetchGame: async (pref) => (pref === 'osaka' ? new Promise(() => undefined) : structuredClone(FIX[pref])) }
    const { game, sys, world } = await newGameIn('高雄', { api: never })
    const d = open(sys, entity(game, 'tw:kaohsiung:counter'))
    pick(sys, d, d.board!.rows.find((r) => r.name === '関西国際空港')!.dest!)
    await settle(game)
    expect(game.map?.id).toBe('air:KIX')
    expect(world.hasPref('osaka')).toBe(false)
  })
})

describe('存檔', () => {
  it('在台灣的出發大廳存檔、讀回來還在那裡（城市、想去的地方留著）', async () => {
    const store = memoryStore()
    const a = await boot(store)
    a.game.newGame()
    a.sys.startInTaiwan()
    a.sys.closePanel({ town: 'tw:kaohsiung', name: '高雄', km: 0, kmKind: 'straight', mode: 'plane', fromTown: '' })
    systemsOf(a.game).trip = { city: '高雄', plan: '271276' }
    a.game.save()
    const b = await boot(store)
    expect(b.game.continueGame()).toBe(true)
    expect(b.game.map?.id).toBe('tw:kaohsiung')
    expect(systemsOf(b.game).trip).toEqual({ city: '高雄', plan: '271276' })
    expect(b.game.state.money).toBe(NEW_GAME_YEN)
  })

  it('舊存檔（已經在日本）：繼續還在日本，不會被送回台灣', async () => {
    const store = memoryStore()
    const a = await boot(store)
    a.game.newGame()
    await frames(a.game, 4)
    a.game.save()
    const b = await boot(store)
    b.game.continueGame()
    expect(b.game.map?.id).toBe('int:261068:station:0')
  })
})

