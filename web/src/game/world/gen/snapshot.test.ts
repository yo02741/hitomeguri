import { describe, expect, it } from 'vitest'

import css from '../../../styles/theme.css?raw'
import { PX, type Tokens } from '../../../services/pixelwalk/palette'

import worldRaw from '../../fixtures/_world.json'
import hokkaidoRaw from '../../fixtures/hokkaido.json'
import hyogoRaw from '../../fixtures/hyogo.json'
import kyotoRaw from '../../fixtures/kyoto.json'
import naraRaw from '../../fixtures/nara.json'
import okinawaRaw from '../../fixtures/okinawa.json'
import osakaRaw from '../../fixtures/osaka.json'
import tokyoRaw from '../../fixtures/tokyo.json'

import { allTiles, SEASONS, TileCache, tileDef, TIMES } from '../../engine/tiles'
import type { GameMap } from '../../engine/types'

import { parseWorldIndex, prefData } from '../data'
import type { PrefRaw } from '../types'
import { createWorld, type GameWorld } from '../world'
import '../kits'

/**
 * 已經上線的京都、沖繩不能因為 P3 改變（GEN_VERSION 不改）：
 *  1. 每一鎮的生成結果（三層 tile 的名字、行為覆寫、實體、warp、室內、到站的地方、地標、開花、祭典的格子）的雜湊；
 *  2. 近畿、沖繩、室內 kit 每個 tile（四季 × 三時段）畫出來的像素的雜湊（改到共用的畫法時也不能變）。
 * tile 用名字算（id 的分配順序變了不算改變）。要故意改京都、沖繩時才更新這份快照（vitest -u），並在報告裡寫為什麼。
 */
const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens

/** FNV-1a（32 位元），字串一個字一個字算 */
function fnv(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
const hex = (n: number) => n.toString(16).padStart(8, '0')

const nameOf = (id: number) => (id ? (tileDef(id)?.name ?? `?${id}`) : '')
function mapText(m: GameMap): string {
  const layer = (a: Uint16Array) => Array.from(a, nameOf).join('|')
  const border = [m.border.ground, m.border.lower ?? 0, m.border.over ?? 0].map(nameOf).join('|')
  return [m.id, m.w, m.h, m.outdoor, m.bgm ?? '', border, layer(m.ground), layer(m.lower), layer(m.over), Array.from(m.beh).join(','), JSON.stringify(m.warps), JSON.stringify(m.entities), JSON.stringify(m.start ?? null)].join('\n')
}

/** 每一鎮的生成結果的雜湊：地圖、室內、其他（到站的地方、地標、委託的地點、旅館、開花、祭典） */
function townHashes(world: GameWorld): Record<string, string> {
  const out: Record<string, string> = {}
  for (const t of world.towns) {
    const g = world.generate(t.id)!
    const interiors = [...g.interiors.entries()].map(([id, m]) => `${id}\n${mapText(m)}`).join('\n#\n')
    const extra = JSON.stringify({
      stops: g.stops,
      landmarks: g.landmarks,
      questSpots: g.questSpots,
      inn: g.inn ?? null,
      bloom: g.bloom.map((b) => [b.layer, b.i, nameOf(b.base), nameOf(b.bloom), b.flower]),
      festival: { tiles: g.festival.tiles.map((x) => [x.layer, x.i, nameOf(x.id)]), npcs: g.festival.festivalNpcs },
    })
    out[`${t.pref}/${t.id} ${t.name.ja}`] = [hex(fnv(mapText(g.map))), hex(fnv(interiors)), hex(fnv(extra))].join(' ')
  }
  return out
}

describe('京都、沖繩的鎮生成結果不變（P3 的快照）', () => {
  it('18 鎮：tile、實體、warp、室內、到站的地方、地標、開花、祭典', () => {
    const out = townHashes(createWorld([prefData(kyotoRaw as unknown as PrefRaw), prefData(okinawaRaw as unknown as PrefRaw)]))
    expect(Object.keys(out).length).toBe(18)
    expect(out).toMatchSnapshot()
  })

  /**
   * 上線的樣子（P4 起）：7 縣 63 鎮都照世界索引做（縣與縣之間的交通、剪票口的目的地也在實體裡）。
   * 這份快照是用 P3（commit 66a5ca5）的程式做的（git archive 出來跑 vitest -u）：P4 加的台灣航線（索引的 taiwan）、
   * 機場的大廳都不能改到任何一鎮。
   */
  it('7 縣 63 鎮（世界索引，含台灣的航線）：跟 P3 上線時一樣', () => {
    const prefs = [kyotoRaw, okinawaRaw, naraRaw, osakaRaw, hyogoRaw, tokyoRaw, hokkaidoRaw].map((r) => prefData(r as unknown as PrefRaw))
    const out = townHashes(createWorld(prefs, { index: parseWorldIndex(worldRaw)! }))
    expect(Object.keys(out).length).toBe(63)
    expect(out).toMatchSnapshot()
  })

  it('近畿、沖繩、室內 kit 的每個 tile（四季 × 三時段）像素不變', () => {
    const cache = new TileCache(tokens)
    const out: Record<string, string> = {}
    for (const prefix of ['kinki/', 'okinawa/', 'world/']) {
      const tiles = allTiles()
        .filter((t) => t.name.startsWith(prefix))
        .sort((a, b) => (a.name < b.name ? -1 : 1))
      let h = 0x811c9dc5
      for (const t of tiles)
        for (const season of SEASONS)
          for (const time of TIMES)
            for (const mask of t.connect ? [0, 5, 10, 15] : [0]) {
              const img = cache.draw(t, { season, time, frame: 0, variant: 0, mask, x: 0, y: 0 })
              h = fnv(`${t.name}:${season}:${time}:${mask}:${Array.from(img.buf).join(',')}`, h)
            }
      out[`${prefix} ${tiles.length}`] = hex(h)
    }
    expect(out).toMatchSnapshot()
  })
})
