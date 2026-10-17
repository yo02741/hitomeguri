import { describe, expect, it, vi } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'

import worldRaw from '../fixtures/_world.json'
import hokkaidoRaw from '../fixtures/hokkaido.json'
import kyotoRaw from '../fixtures/kyoto.json'
import tokyoRaw from '../fixtures/tokyo.json'
import { Game } from '../engine/game'

import { parseWorldIndex, prefData } from './data'
import type { RideScene } from './ride'
import type { PrefRaw } from './types'
import { createWorld } from './world'
import './kits'

/** 車窗畫面每一段的樣子（rideOverlay 收到的 scene） */
const scenes: RideScene[] = []
vi.mock('./ride', async (orig) => {
  const m = (await orig()) as typeof import('./ride')
  return { ...m, rideOverlay: (s: RideScene) => (scenes.push({ ...s }), m.rideOverlay(s)) }
})

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const raw = (x: unknown) => prefData(x as PrefRaw)
const index = parseWorldIndex(worldRaw)!

function ride(prefs: unknown[], at: string, linkId: string, now: string, loadPref?: (p: string) => Promise<ReturnType<typeof raw> | null>) {
  const world = createWorld(prefs.map(raw), { index, ...(loadPref ? { loadPref } : {}) })
  const game = new Game({ tokens, maps: world.mapSource, start: world.start, storage: null, seasonOf: (d) => world.seasonOf(d), genVersion: world.genVersion, now: new Date(now) })
  const off = world.attach(game)
  game.newGame()
  expect(game.warpNow(`town:${at}`, 10, 10)).toBe(true)
  for (let i = 0; i < 40; i++) game.update()
  scenes.length = 0
  const r = world.travel(game, linkId)!
  return { world, game, r, off }
}

describe('車窗的季節（最後一段是目的地的）', () => {
  it('東京 → 新千歳（4/10）：電車那一段是東京的春，飛機那一段畫北海道、季節是北海道的冬', async () => {
    const { world, game, r, off } = ride([kyotoRaw, tokyoRaw, hokkaidoRaw], '131016', '131016.main>012246.airport', '2026-04-10T01:00:00Z')
    const d = { ...game.clock.date }
    expect(world.seasonOf(d, '131016')).toBe('spring')
    expect(world.seasonOf(d, '012246')).toBe('winter')
    for (let f = 0; !r.done && f < 60 * 30; f++) game.update()
    expect(r.done).toBe(true)
    expect(scenes.map((s) => [s.mode, s.kit, s.season])).toEqual([
      ['rail', 'kanto', 'spring'],
      ['plane', 'hokkaido', 'winter'],
    ])
    off()
  })

  it('目的地的縣還在讀：先照世界索引的 kit 算，讀好了算出來不一樣就換窗外', async () => {
    let resolve!: (p: ReturnType<typeof raw> | null) => void
    const { game, r, off } = ride([kyotoRaw, tokyoRaw], '131016', '131016.main>012246.airport', '2026-04-10T01:00:00Z', () => new Promise((ok) => (resolve = ok)))
    for (let f = 0; !r.done && f < 60 * 6; f++) game.update()
    resolve(raw(hokkaidoRaw))
    await Promise.resolve()
    await Promise.resolve()
    for (let f = 0; !r.done && f < 60 * 30; f++) game.update()
    expect(r.done).toBe(true)
    const last = scenes[scenes.length - 1]!
    expect([last.mode, last.kit, last.season]).toEqual(['plane', 'hokkaido', 'winter'])
    off()
  })
})
