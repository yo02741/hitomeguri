import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'

import kyotoRaw from '../fixtures/kyoto.json'
import okinawaRaw from '../fixtures/okinawa.json'
import { addDays } from '../engine/clock'
import { Game } from '../engine/game'
import { memoryStore, saveKey } from '../engine/save'
import type { MapEntity } from '../engine/types'
import { installSystems } from '../systems'
import { dayKey } from '../systems/data'
import { memoryPhotos, type PhotoStore } from '../systems/photoStore'
import { accept, pruneQuests, questFor } from '../systems/quests'
import { systemsOf } from '../systems/state'
import { createWorld, prefData, type PrefRaw } from '../world'
import { registerDefaultLooks } from '../sprites'

import { playMaps } from './world'

// 審查修掉的問題（/play 的接法，只讀 fixture）：委託指得到的景點、做不完的委託、取景框與對話、委託的照片、
// 沒有 IndexedDB 時的縮圖、抵達的短曲、授与所的人、祭典照。

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const prefs = () => [prefData(kyotoRaw as unknown as PrefRaw), prefData(okinawaRaw as unknown as PrefRaw)]
registerDefaultLooks()
const run = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) g.update(1 / 60)
}

function setup(o: { photos?: PhotoStore; now?: string; holdSay?: boolean } = {}) {
  const ps = prefs()
  const world = createWorld(ps)
  const game = new Game({
    tokens,
    maps: playMaps(world),
    start: world.start,
    genVersion: world.genVersion,
    seasonOf: (d) => world.seasonOf(d),
    storage: memoryStore(),
    saveKey: saveKey(null),
    now: new Date(o.now ?? '2026-10-17T00:00:00Z'),
  })
  const sounds: string[] = []
  const sys = installSystems(game, {
    prefs: ps,
    world: world.world,
    maps: playMaps(world),
    townSpots: (t) => world.questSpotsOf(t),
    festival: (g) => world.festivalNow(g),
    jingle: (n) => sounds.push(n),
    travel: (g, l) => void (l.link && world.travel(g, l.link)),
    photos: o.photos ?? memoryPhotos(),
  })
  const off = world.attach(game)
  const pending: Array<() => void> = []
  game.on('say', (e) => (o.holdSay ? pending.push(e.resolve) : e.resolve()))
  let answer = 0
  game.on('ask', (e) => e.resolve(answer))
  game.newGame()
  run(game, 20)
  return { world, game, sys, off, sounds, pending, answer: (i: number) => (answer = i) }
}

const stepOn = (g: Game, e: MapEntity) => {
  g.player.place(e.x, e.y, 'up')
  g.follower?.reset(e.x, e.y + 1, 'up')
  g.emit('step', { map: g.map!.id, x: e.x, y: e.y })
}

describe('委託', () => {
  it('委託指的景點都在地圖上：找東西的有告示牌，拍照的有拍攝點（9 個鎮、一個月）', () => {
    const { world, sys } = setup()
    const env = { data: sys.data, townSpots: (t: string) => world.questSpotsOf(t) }
    const bad: string[] = []
    let n = 0
    for (const t of world.towns) {
      const gen = world.generate(t.id)!
      for (const giver of gen.map.entities.filter((e) => e.id.endsWith(':quest')))
        for (let d = 0; d < 30; d++) {
          const q = questFor(giver.id, t.id, addDays({ y: 2026, m: 10, d: 1 }, d), env)
          if (!q?.spot) continue
          n++
          const towns = q.type === 'lost' ? [t] : world.towns.filter((x) => x.pref === t.pref)
          const kind = q.type === 'lost' ? 'sign' : 'photo'
          if (!towns.some((x) => world.generate(x.id)!.map.entities.some((e) => e.id === `${kind}:${q.spot}`))) bad.push(`${q.type} ${t.name.ja} ${q.spot}`)
        }
    }
    expect(n).toBeGreaterThan(100)
    expect(bad).toEqual([])
  })

  it('做不完也不會卡住：過了期限自己取消；跟委託的人說「不做了」名額就空出來', () => {
    const { world, game, sys, answer } = setup()
    const env = { data: sys.data, townSpots: (t: string) => world.questSpotsOf(t) }
    const t = world.towns[0]!
    const giver = world.generate(t.id)!.map.entities.find((e) => e.id.endsWith(':quest'))!
    const q = questFor(giver.id, t.id, game.clock.date, env)!
    expect(accept(game, q)).toBe(true)
    expect(pruneQuests(game, env)).toEqual([])
    expect(pruneQuests(game, env, addDays(game.clock.date, 4)).map((x) => x.id)).toEqual([q.id])
    expect(systemsOf(game).quests.active).toEqual([])
    // 手帳寫期限
    accept(game, q)
    // 地點不在地圖上的（舊存檔）也取消
    systemsOf(game).quests.active.push({ ...q, id: 'old', spot: 'wd-Q0', type: 'photo' })
    expect(pruneQuests(game, env).map((x) => x.id)).toEqual(['old'])
    // 回去找委託的人：不做了（「繼續」那一項照委託的種類說：找東西、拍照、送東西）
    const asked: string[][] = []
    game.on('ask', (e) => asked.push(e.options))
    game.warpNow(t.mapId, giver.x, giver.y + 1, 'up')
    run(game, 30)
    answer(1)
    game.input.tap('A', 'test')
    run(game, 10)
    expect(systemsOf(game).quests.active).toEqual([])
    expect(asked[0]).toEqual([{ lost: '再找找看', photo: '再去拍', deliver: '這就送去' }[q.type], '不做了'])
    void sys
  })
})

describe('拍照', () => {
  it('對話中不開取景框，「拍照」鈕也不出來（按一次 A 不會同時拍照又翻頁）', () => {
    const { world, game, sys } = setup({ holdSay: true })
    const t = world.towns.find((x) => x.id === '261068')!
    game.warpNow(t.mapId, 2, 2, 'down')
    run(game, 30)
    const spot = game.map!.entities.find((e) => e.kind === 'photoSpot')!
    stepOn(game, spot)
    expect(sys.ui.hint?.spot).toBe(spot)
    expect(sys.canShoot()).toBe(true)
    game.run(function* (api) {
      yield* api.say('告示牌的第一句。')
    })
    run(game, 2)
    expect(game.busy).toBe(true)
    expect(sys.canShoot()).toBe(false)
    sys.openCamera(spot)
    expect(sys.ui.panel).toBe(null)
  })

  it('委託的照片：相簿那一格留著原本的也算拍到（不用換掉原本的照片）', async () => {
    const { world, game, sys } = setup()
    const t = world.towns.find((x) => x.id === '261068')!
    game.warpNow(t.mapId, 2, 2, 'down')
    run(game, 30)
    const spot = game.map!.entities.find((e) => e.kind === 'photoSpot')!
    const spotId = (spot.data as { spotId: string }).spotId
    stepOn(game, spot)
    // 先拍一張放進相簿
    sys.openCamera(spot)
    await sys.camera.shoot()
    await new Promise((r) => setTimeout(r, 0))
    const first = game.state.album[0]!
    sys.closePanel()
    // 接下拍這個景點的委託，再拍一張、留著原本的
    systemsOf(game).quests.active.push({ id: 'q1', type: 'photo', from: t.id, giver: 'npc:x', spot: spotId, reward: 600, d: dayKey(game.clock.date) })
    sys.openCamera(spot)
    await sys.camera.shoot()
    const p = sys.ui.panel
    expect(p?.kind === 'photo' && p.result.quest && !!p.result.replace).toBe(true)
    sys.discardPhoto()
    sys.closePanel()
    const q = systemsOf(game).quests.active.find((x) => x.id === 'q1')!
    expect(typeof q.ready).toBe('string')
    expect(game.state.album).toEqual([first])
  })

  it('沒有 IndexedDB（存不進去，只在記憶體）：拍好的照片面板照樣有縮圖', async () => {
    const mem = memoryPhotos()
    const noIdb: PhotoStore = { ...mem, put: async (r) => (await mem.put(r), false) }
    const { world, game, sys } = setup({ photos: noIdb })
    const t = world.towns.find((x) => x.id === '261068')!
    game.warpNow(t.mapId, 2, 2, 'down')
    run(game, 30)
    const spot = game.map!.entities.find((e) => e.kind === 'photoSpot')!
    stepOn(game, spot)
    // node 沒有 canvas：toPng 做不出 PNG，這裡直接放一張進記憶體，看面板有沒有去讀
    sys.openCamera(spot)
    const shot = sys.camera.shoot()
    await shot
    const p = sys.ui.panel
    expect(p?.kind).toBe('photo')
    if (p?.kind !== 'photo') return
    await noIdb.put({ id: p.result.id, w: 1, h: 1, png: new Blob([new Uint8Array([1])]) })
    let url: string | null = null
    for (let i = 0; i < 20 && !url; i++) {
      await new Promise((r) => setTimeout(r, 0))
      const q = sys.ui.panel
      url = q?.kind === 'photo' ? q.result.url : null
    }
    // URL.createObjectURL 在 node 有就給 blob:，沒有也不會是因為 put 回 false 才空著
    expect(typeof URL.createObjectURL === 'function' ? !!url : true).toBe(true)
  })

  it('祭典的那個月：框裡沒有攤子、提燈、祭典的人，就不是祭典照', () => {
    const { world, game, sys } = setup()
    // 左京区：10 月有鞍馬の火祭
    const t = world.towns.find((x) => x.id === '261033')!
    game.warpNow(t.mapId, 2, 2, 'down')
    run(game, 30)
    expect(sys.festivalNow()).toBe(true)
    const frame = { x: 0, y: 0, w: game.W, h: game.H }
    const spots = game.map!.entities.filter((e) => e.kind === 'photoSpot')
    const results = spots.map((e) => {
      game.player.place(e.x, e.y, 'up')
      return sys.festivalInFrame(frame)
    })
    expect(results.some((x) => x)).toBe(true)
    expect(results.some((x) => !x)).toBe(true)
  })
})

describe('抵達、店員', () => {
  it('新遊戲從京都駅的大廳直接坐車：第一個新的鎮響短曲，之後回起點的鎮不響', () => {
    const { world, game, sounds } = setup()
    const link = world.links.find((l) => l.from === '261068' && l.to === '261050')!
    world.travel(game, link)
    run(game, 60 * 12)
    expect(game.map?.id).toBe('town:261050')
    expect(sounds).toEqual(['arrive'])
    game.warpNow('town:261068', world.generate('261068')!.stops.main!.x, world.generate('261068')!.stops.main!.y, 'down')
    run(game, 30)
    expect(sounds).toEqual(['arrive'])
  })

  it('授与所的櫃台後面有人', () => {
    const { world, game } = setup()
    const gen = world.generate('261050')!
    const id = [...gen.interiors.keys()].find((k) => k.includes(':juyosho:'))!
    const m = gen.interiors.get(id)!
    game.warpNow(id, m.start!.x, m.start!.y, 'up')
    run(game, 30)
    expect(game.npcs.some((a) => a.entity?.kind === 'stamp')).toBe(true)
  })
})
