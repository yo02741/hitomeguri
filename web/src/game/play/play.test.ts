import { describe, expect, it, vi } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'
import type { BundleIndex } from '../../services/bundles'

import kyotoRaw from '../fixtures/kyoto.json'
import okinawaRaw from '../fixtures/okinawa.json'
import { Game } from '../engine/game'
import { memoryStore, saveKey, type SaveStorage } from '../engine/save'
import { installSystems } from '../systems'
import { BUNDLES, type BundleApi, createWorld, prefData, type PrefRaw } from '../world'

import { p0Maps } from './devMaps'
import { arrivalJingle, indexVia, loadPlayWorld, playMaps } from './world'

// /play 的接法（規格 §5、§8）：起點、舊存檔搬家、DEV 的測試小鎮、資料讀不到、抵達的短曲。只讀 fixture。

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const prefs = () => [prefData(kyotoRaw as unknown as PrefRaw), prefData(okinawaRaw as unknown as PrefRaw)]

function setup(store: SaveStorage, dev = false) {
  const world = createWorld(prefs())
  const game = new Game({
    tokens,
    maps: playMaps(world, dev ? p0Maps : null),
    start: world.start,
    genVersion: world.genVersion,
    seasonOf: (d) => world.seasonOf(d),
    storage: store,
    saveKey: saveKey(null),
    now: new Date('2026-10-16T00:00:00Z'),
  })
  const sys = installSystems(game, { prefs: prefs(), world: world.world, maps: playMaps(world) })
  const off = world.attach(game)
  return { world, game, sys, off }
}

/** P0 的存檔：測試小鎮的格子，旗標、旅費、行李 */
const P0_SAVE = {
  v: 1,
  gen: 0,
  map: 'town',
  x: 14,
  y: 20,
  dir: 'up',
  flags: { 'town.met': true },
  money: 2400,
  items: { 'game:tenugui': 1 },
  stamps: [],
  room: {},
  calendar: { y: 2026, m: 5, d: 3, min: 600 },
  settings: { alwaysRun: true, textSpeed: 'fast', timeRate: 1 },
  seen: ['sign:1'],
  album: [],
  ext: {},
  savedAt: 1,
}

describe('/play 的世界', () => {
  it('新遊戲從京都駅的大廳開始（剪票口前、面向上）', () => {
    const { game, world } = setup(memoryStore())
    game.newGame()
    expect(world.start.map).toBe('int:261068:station:0')
    expect(game.map?.id).toBe(world.start.map)
    expect([game.player.x, game.player.y, game.player.dir]).toEqual([world.start.x, world.start.y, 'up'])
    expect(game.map?.bgm).toBe('interior')
    // 剪票口（travel）在這張地圖上
    expect(game.map?.entities.some((e) => e.kind === 'travel')).toBe(true)
  })

  it('舊的 P0 存檔（測試小鎮）：放到京都駅的大廳，旗標、旅費、行李、設定留著', () => {
    const store = memoryStore()
    store.set(saveKey(null), JSON.stringify(P0_SAVE))
    const { game, world } = setup(store)
    expect(game.hasSave()).toBe(true)
    expect(game.continueGame()).toBe(true)
    expect(game.map?.id).toBe(world.start.map)
    expect([game.player.x, game.player.y]).toEqual([world.start.x, world.start.y])
    expect(game.state.money).toBe(2400)
    expect(game.state.items['game:tenugui']).toBe(1)
    expect(game.state.flags['town.met']).toBe(true)
    expect(game.settings.alwaysRun).toBe(true)
    expect(game.clock.date).toEqual({ y: 2026, m: 5, d: 3 })
    // DEV 有測試小鎮也一樣（p0: 前綴，舊存檔的 'town' 找不到）
    const s2 = setup(store, true)
    s2.game.continueGame()
    expect(s2.game.map?.id).toBe(world.start.map)
  })

  it('同一版的存檔接著玩；生成器版本變了放回那張地圖的入口', () => {
    const store = memoryStore()
    const a = setup(store)
    a.game.newGame()
    const town = a.world.towns.find((t) => t.id === '261068')!
    const st = a.world.generate(town.id)!.stops.main!
    a.game.warpNow(st.map, st.x, st.y, st.dir)
    expect(a.game.save().ok).toBe(true)
    const b = setup(store)
    b.game.continueGame()
    expect([b.game.map?.id, b.game.player.x, b.game.player.y]).toEqual([st.map, st.x, st.y])
    // 版本變了：同一張地圖的 start
    const raw = JSON.parse(store.get(saveKey(null))!)
    store.set(saveKey(null), JSON.stringify({ ...raw, gen: raw.gen + 1 }))
    const c = setup(store)
    c.game.continueGame()
    const m = c.game.map!
    expect(m.id).toBe(st.map)
    expect([c.game.player.x, c.game.player.y]).toEqual([m.start!.x, m.start!.y])
  })

  it('存檔在你的房間裡：讀回來時出口還是最後住的旅館（沖繩的民宿）', () => {
    const store = memoryStore()
    const a = setup(store)
    a.game.newGame()
    const naha = a.world.generate('472018')!
    expect(naha.inn).toBeTruthy()
    // 進民宿，再進房間
    a.game.warpNow(naha.inn!.map, naha.inn!.stairs.x, naha.inn!.stairs.y + 1, 'up')
    expect((a.game.state.ext.world as { lastInn?: string }).lastInn).toBe(naha.inn!.map)
    a.game.warpNow('room', 5, 8, 'up')
    a.game.save()
    // 重新整理：新的世界、新的 Game
    const b = setup(store)
    b.game.continueGame()
    expect(b.game.map?.id).toBe('room')
    const exits = b.game.map!.warps.map((w) => w.to)
    expect(exits.length).toBeGreaterThan(0)
    expect(new Set(exits)).toEqual(new Set([naha.inn!.map]))
  })

  it('DEV 的測試小鎮在 p0: 底下，門也接到 p0:', () => {
    const town = p0Maps('p0:town')!
    expect(town.id).toBe('p0:town')
    expect(town.warps.every((w) => w.to.startsWith('p0:'))).toBe(true)
    expect(p0Maps('town')).toBeNull()
    expect(p0Maps('p0:nope')).toBeNull()
    const { game } = setup(memoryStore(), true)
    game.newGame()
    expect(game.warpNow('p0:town', 14, 20, 'up')).toBe(true)
    expect(game.map?.id).toBe('p0:town')
    // 正式版沒有
    const prod = setup(memoryStore())
    prod.game.newGame()
    expect(prod.game.warpNow('p0:town', 14, 20, 'up')).toBe(false)
  })

  it('鎮曲：京都的鎮 kyoto、沖繩的鎮 okinawa、室內 interior', () => {
    const { world } = setup(memoryStore())
    for (const t of world.towns) {
      const m = world.mapSource(t.mapId)!
      expect(m.bgm, t.name.ja).toBe(t.kit === 'okinawa' ? 'okinawa' : 'kyoto')
      for (const id of world.generate(t.id)!.interiors.keys()) expect(world.mapSource(id)!.bgm, id).toBe('interior')
    }
    expect(world.mapSource('room')!.bgm).toBe('interior')
  })
})

describe('資料讀不到', () => {
  const fail = (e: unknown): BundleApi => ({
    ...BUNDLES,
    fetchIndex: () => Promise.reject(e),
  })
  it('catalog 給空的索引時自己再抓；連不上是 offline，不丟錯', async () => {
    const empty = async (): Promise<BundleIndex> => ({ prefectures: {} })
    const r = await loadPlayWorld(empty, { api: fail(new TypeError('Failed to fetch')) })
    expect(r.ok).toBe(false)
    expect(r.errors.map((e) => [e.pref, e.kind])).toEqual([
      ['kyoto', 'offline'],
      ['okinawa', 'offline'],
    ])
  })
  it('catalog 的索引有東西就用它（不重抓）', async () => {
    const idx: BundleIndex = { prefectures: { kyoto: { count: 1, featured: 0, version: 'v1' } } }
    const fetchIndex = vi.fn(() => Promise.reject(new Error('不該呼叫')))
    const api = indexVia(async () => idx, { ...BUNDLES, fetchIndex })
    await expect(api.fetchIndex()).resolves.toBe(idx)
    expect(fetchIndex).not.toHaveBeenCalled()
  })
})

describe('抵達的短曲', () => {
  it('坐車時等到站之後才放；走路進鎮（傳送）馬上放；蓋章、買東西不等', () => {
    const played: string[] = []
    const timers: Array<() => void> = []
    const a = arrivalJingle(
      (n) => played.push(n),
      900,
      (fn) => timers.push(fn),
    )
    a.jingle('arrive')
    expect(played).toEqual(['arrive'])
    a.ride()
    a.jingle('arrive')
    a.jingle('stamp')
    expect(played).toEqual(['arrive', 'stamp'])
    a.arrived()
    expect(played).toEqual(['arrive', 'stamp'])
    timers.splice(0).forEach((f) => f())
    expect(played).toEqual(['arrive', 'stamp', 'arrive'])
    // 到了但不是第一次（沒有排）：不放
    a.ride()
    a.arrived()
    expect(timers.length).toBe(0)
  })
})
