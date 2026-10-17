import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'

import worldRaw from '../fixtures/_world.json'
import hokkaido from '../fixtures/hokkaido.json'
import hyogo from '../fixtures/hyogo.json'
import kyoto from '../fixtures/kyoto.json'
import nara from '../fixtures/nara.json'
import okinawa from '../fixtures/okinawa.json'
import osaka from '../fixtures/osaka.json'
import tokyo from '../fixtures/tokyo.json'
import { registerDefaultLooks } from '../sprites'

import { Gfx } from '../../services/pixelwalk/gfx'
import { TileCache } from '../engine/tiles'

import { parseWorldIndex, prefData } from './data'
import { rideOverlay } from './ride'
import { encodePng, objectSheet, renderMap, stitch, tileSheet } from './preview'
import type { PrefRaw } from './types'
import { createWorld } from './world'
import './kits'

/**
 * 開發用：GAME_PREVIEW=<資料夾> npx vitest run src/game/world/preview.test.ts
 * 把 kit 的 tile 表、每個鎮的全圖、季節與時段寫成 PNG（沒設 GAME_PREVIEW 時什麼都不做，CI 上會跳過）。
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const OUT = env.GAME_PREVIEW
const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens

async function save(name: string, bytes: Uint8Array) {
  const fs = (await import(/* @vite-ignore */ String('node:fs'))) as { writeFileSync(p: string, d: Uint8Array): void; mkdirSync(p: string, o: { recursive: boolean }): void }
  fs.mkdirSync(OUT!, { recursive: true })
  fs.writeFileSync(`${OUT}/${name}.png`, bytes)
}

/** P3 的預覽（關東、北海道的 kit）：GAME_PREVIEW_P3=kit｜town｜ride（逗號分開，沒寫就全部）；設了就不跑 P2 的 */
const P3 = env.GAME_PREVIEW_P3
const p3 = (part: string) => P3 !== undefined && (P3 === '' || P3 === '1' || P3.split(',').includes(part))

describe.skipIf(!OUT || P3 !== undefined)('預覽', () => {
  it('每個鎮的全圖（白天）、一鎮四季', async () => {
    registerDefaultLooks()
    const w = createWorld([prefData(kyoto as unknown as PrefRaw), prefData(okinawa as unknown as PrefRaw)])
    const only = env.GAME_PREVIEW_TOWN
    for (const t of w.towns) {
      if (only && !only.split(',').includes(t.id)) continue
      const gen = w.generate(t.id)!
      console.log(t.id, t.name.ja, `${gen.map.w}x${gen.map.h}`, `${gen.ms.toFixed(1)}ms`, 'landmarks', gen.landmarks.length, '/', t.spots.length, 'interiors', gen.interiors.size)
      const map = w.mapSource(t.mapId)!
      await save(`p2-world-${t.pref}-${t.id}-day`, await encodePng(renderMap(map, tokens, 'summer', 'day'), 2))
    }
    if (!only) {
      for (const id of ['261068', '472018']) {
        const t = w.townById(id)!
        // 四季：近畿（櫻、夏、紅葉、冬）；沖繩（寒緋櫻、夏、秋、冬）
        const dates =
          t.kit === 'kinki'
            ? [
                { y: 2026, m: 4, d: 2 },
                { y: 2026, m: 7, d: 10 },
                { y: 2026, m: 11, d: 30 },
                { y: 2027, m: 1, d: 20 },
              ]
            : [
                { y: 2027, m: 2, d: 1 },
                { y: 2026, m: 7, d: 10 },
                { y: 2026, m: 11, d: 15 },
                { y: 2026, m: 12, d: 20 },
              ]
        const list = []
        for (const d of dates) {
          w.seasonOf(d)
          const map = w.mapSource(t.mapId)!
          list.push(renderMap(map, tokens, w.seasonOf(d, id), 'day'))
        }
        await save(`p2-world-${t.pref}-${id}-seasons`, await encodePng(stitch(list, 'h', 8), 1))
        const times = (['day', 'dusk', 'night'] as const).map((time) => renderMap(w.mapSource(t.mapId)!, tokens, 'summer', time))
        await save(`p2-world-${t.pref}-${id}-times`, await encodePng(stitch(times, 'h', 8), 1))
      }
      // 車窗：電車、單軌、巴士、飛機、渡輪（白天、黃昏、夜晚）
      const rides = []
      for (const [mode, kit] of [['rail', 'kinki'], ['monorail', 'okinawa'], ['bus', 'okinawa'], ['plane', 'okinawa'], ['ferry', 'okinawa']] as const)
        for (const time of ['day', 'dusk', 'night'] as const) {
          const g = new Gfx(240, 160, new TileCache(tokens).palette(time))
          const draw = rideOverlay({ mode, kit, time, season: 'summer' })
          draw(g, 0)
          draw(g, 1.3)
          rides.push(g)
        }
      const rrows = []
      for (let i = 0; i < rides.length; i += 3) rrows.push(stitch(rides.slice(i, i + 3), 'h', 4))
      await save('p2-world-rides', await encodePng(stitch(rrows, 'v', 4), 2))
      // 室內
      const ints = []
      for (const t of w.towns.slice(0, 1).concat(w.towns.filter((x) => x.id === '472018'))) for (const [, m] of w.generate(t.id)!.interiors) ints.push(renderMap(m, tokens, 'summer', 'day'))
      ints.push(renderMap(w.mapSource('room')!, tokens, 'summer', 'day'))
      const rows = []
      for (let i = 0; i < ints.length; i += 5) rows.push(stitch(ints.slice(i, i + 5), 'h', 8))
      await save('p2-world-interiors', await encodePng(stitch(rows, 'v', 8), 2))
    }
    expect(true).toBe(true)
  })

  it('kit 的 tile 表', async () => {
    if (env.GAME_PREVIEW_TOWN) return
    for (const prefix of ['kinki/', 'okinawa/', 'world/']) {
      const rows = (['spring', 'summer', 'autumn', 'winter'] as const).map((s) => tileSheet(tokens, prefix, s, 'day'))
      rows.push(tileSheet(tokens, prefix, 'summer', 'night'))
      await save(`p2-world-tiles-${prefix.slice(0, -1)}`, await encodePng(stitch(rows, 'v', 6), 3))
    }
    for (const prefix of ['kinki/', 'okinawa/', 'world/']) {
      const list = (['spring', 'summer', 'autumn', 'winter'] as const).map((s) => objectSheet(tokens, prefix, s, 'day'))
      list.push(objectSheet(tokens, prefix, 'summer', 'night'), objectSheet(tokens, prefix, 'spring', 'day', 640, true))
      for (const [i, g] of list.entries()) await save(`p2-world-objects-${prefix.slice(0, -1)}-${['spring', 'summer', 'autumn', 'winter', 'night', 'bloom'][i]}`, await encodePng(g, 2))
    }
    expect(true).toBe(true)
  })
})

describe.skipIf(!OUT || P3 === undefined)('預覽（P3：關東、北海道）', () => {
  it('kit 的 tile 表、物件表（四季、夜裡、開花）', async () => {
    if (!p3('kit')) return
    for (const prefix of ['kanto/', 'hokkaido/']) {
      const name = prefix.slice(0, -1)
      const rows = (['spring', 'summer', 'autumn', 'winter'] as const).map((s) => tileSheet(tokens, prefix, s, 'day'))
      rows.push(tileSheet(tokens, prefix, 'summer', 'dusk'), tileSheet(tokens, prefix, 'winter', 'night'))
      await save(`p3-kit-tiles-${name}`, await encodePng(stitch(rows, 'v', 6), 3))
      const list = (['spring', 'summer', 'autumn', 'winter'] as const).map((s) => objectSheet(tokens, prefix, s, 'day', 800))
      list.push(objectSheet(tokens, prefix, 'summer', 'night', 800), objectSheet(tokens, prefix, 'spring', 'day', 800, true))
      for (const [i, g] of list.entries()) await save(`p3-kit-objects-${name}-${['spring', 'summer', 'autumn', 'winter', 'night', 'bloom'][i]}`, await encodePng(g, 2))
    }
    expect(true).toBe(true)
  }, 120_000)

  it('車窗：關東、北海道的電車、巴士、飛機，新幹線（三個時段）；北海道的冬天', async () => {
    if (!p3('ride')) return
    const shot = (scene: Parameters<typeof rideOverlay>[0], h = 160) => {
      const g = new Gfx(240, h, new TileCache(tokens).palette(scene.time))
      const draw = rideOverlay(scene)
      draw(g, 0)
      draw(g, 1.3)
      return g
    }
    const rows = []
    const cases: Array<[string, Omit<Parameters<typeof rideOverlay>[0], 'time'>]> = [
      ['kanto-rail', { mode: 'rail', kit: 'kanto', season: 'summer' }],
      ['kanto-shinkansen', { mode: 'rail', kit: 'kanto', season: 'spring', shinkansen: true }],
      ['kanto-bus', { mode: 'bus', kit: 'kanto', season: 'autumn' }],
      ['kanto-plane', { mode: 'plane', kit: 'kanto', season: 'summer' }],
      ['hokkaido-rail', { mode: 'rail', kit: 'hokkaido', season: 'summer' }],
      ['hokkaido-rail-winter', { mode: 'rail', kit: 'hokkaido', season: 'winter' }],
      ['hokkaido-bus', { mode: 'bus', kit: 'hokkaido', season: 'autumn' }],
      ['hokkaido-plane', { mode: 'plane', kit: 'hokkaido', season: 'winter' }],
      ['kinki-shinkansen', { mode: 'rail', kit: 'kinki', season: 'autumn', shinkansen: true }],
    ]
    for (const [, scene] of cases) rows.push(stitch((['day', 'dusk', 'night'] as const).map((time) => shot({ ...scene, time })), 'h', 4))
    await save('p3-kit-rides', await encodePng(stitch(rows, 'v', 4), 2))
    // 直拿的手機（邏輯高 256）
    await save('p3-kit-rides-tall', await encodePng(stitch([shot({ mode: 'rail', kit: 'kanto', season: 'summer', time: 'day', shinkansen: true }, 256), shot({ mode: 'rail', kit: 'hokkaido', season: 'winter', time: 'dusk' }, 256)], 'h', 4), 2))
    expect(true).toBe(true)
  })

  it('東京、北海道每個鎮的全圖；一鎮四季、三時段', async () => {
    if (!p3('town')) return
    registerDefaultLooks()
    // GAME_PREVIEW_BUNDLES=<web/public/bundles/game>：用本機 build-bundles 的真資料（fixture 是子集）；GAME_PREVIEW_PREFS：要畫哪幾縣
    const dir = env.GAME_PREVIEW_BUNDLES
    const fixtures = { kyoto, okinawa, nara, osaka, hyogo, tokyo, hokkaido } as Record<string, unknown>
    const read = async (name: string): Promise<unknown> => {
      if (!dir) return name === '_world' ? worldRaw : fixtures[name]
      const fs = (await import(/* @vite-ignore */ String('node:fs'))) as { readFileSync(p: string, e: string): string }
      return JSON.parse(fs.readFileSync(`${dir}/${name}.json`, 'utf8'))
    }
    const all = []
    for (const name of Object.keys(fixtures)) all.push(prefData((await read(name)) as PrefRaw))
    const w = createWorld(all, { index: parseWorldIndex(await read('_world')) })
    const only = env.GAME_PREVIEW_TOWN
    const prefs = (env.GAME_PREVIEW_PREFS ?? 'tokyo,hokkaido').split(',')
    const tag = env.GAME_PREVIEW_TAG ?? 'p3-kit'
    for (const t of w.towns) {
      if (!prefs.includes(t.pref)) continue
      if (only && !only.split(',').includes(t.id)) continue
      const gen = w.generate(t.id)!
      console.log(t.id, t.name.ja, t.kit, t.urban ? 'urban' : 'rural', `${gen.map.w}x${gen.map.h}`, `${gen.ms.toFixed(1)}ms`, gen.landmarks.map((l) => `${w.prefOf(t.id)?.spotById(l.spotId)?.n}:${l.kind}`).join(' '))
      await save(`${tag}-town-${t.pref}-${t.id}-day`, await encodePng(renderMap(w.mapSource(t.mapId)!, tokens, 'summer', 'day'), 2))
    }
    if (only) return
    const seasons: Array<[string, Array<{ y: number; m: number; d: number }>]> = [
      [env.GAME_PREVIEW_TOKYO ?? '131016', [{ y: 2026, m: 3, d: 30 }, { y: 2026, m: 7, d: 10 }, { y: 2026, m: 11, d: 25 }, { y: 2027, m: 1, d: 20 }]],
      [env.GAME_PREVIEW_HOKKAIDO ?? '011011', [{ y: 2026, m: 5, d: 3 }, { y: 2026, m: 7, d: 20 }, { y: 2026, m: 10, d: 20 }, { y: 2027, m: 1, d: 20 }]],
    ]
    for (const [id, dates] of seasons) {
      const t = w.townById(id)
      if (!t) continue
      const list = []
      for (const d of dates) {
        w.seasonOf(d)
        list.push(renderMap(w.mapSource(t.mapId)!, tokens, w.seasonOf(d, id), 'day'))
      }
      await save(`${tag}-seasons-${t.pref}-${id}`, await encodePng(stitch(list, 'h', 8), 1))
      const times = (['day', 'dusk', 'night'] as const).map((time) => renderMap(w.mapSource(t.mapId)!, tokens, 'summer', time))
      await save(`${tag}-times-${t.pref}-${id}`, await encodePng(stitch(times, 'h', 8), 1))
    }
    expect(true).toBe(true)
  }, 300_000)
})
