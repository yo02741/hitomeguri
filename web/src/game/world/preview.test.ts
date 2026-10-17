import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'

import kyoto from '../fixtures/kyoto.json'
import okinawa from '../fixtures/okinawa.json'
import { registerDefaultLooks } from '../sprites'

import { Gfx } from '../../services/pixelwalk/gfx'
import { TileCache } from '../engine/tiles'

import { prefData } from './data'
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

describe.skipIf(!OUT)('預覽', () => {
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
