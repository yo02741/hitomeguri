import { Gfx } from '../../services/pixelwalk/gfx'
import type { Tokens } from '../../services/pixelwalk/palette'

import { Actor } from '../engine/actor'
import { lookOf } from '../engine/looks'
import { MapView } from '../engine/map'
import { Renderer } from '../engine/render'
import { allTiles, TileCache } from '../engine/tiles'
import { TILE, type GameMap, type Season, type TimeOfDay } from '../engine/types'

import { objectInfo, objectNames } from './kits/objects'

/**
 * 開發用的預覽（不在正式頁面用）：把一張地圖整張畫出來（含 NPC、店員）、把一套 kit 的 tile 排成一張表，
 * 再編成 PNG（CompressionStream，瀏覽器與 node 都有）。world/preview.test.ts 在設了 GAME_PREVIEW 時寫成檔案。
 */
export function renderMap(map: GameMap, tokens: Tokens, season: Season, time: TimeOfDay, o: { actors?: boolean; t?: number } = {}): Gfx {
  const cache = new TileCache(tokens)
  const r = new Renderer(tokens, cache)
  const view = new MapView(map)
  const actors: Actor[] = []
  if (o.actors ?? true)
    for (const e of map.entities) {
      const look = typeof e.data?.look === 'string' ? e.data.look : null
      if (!look) continue
      actors.push(new Actor(e.id, 'npc', lookOf(look), e.x, e.y, e.facing ?? 'down'))
    }
  const t = map.outdoor ? time : 'day'
  const g = new Gfx(map.w * TILE, map.h * TILE, cache.palette(t))
  r.draw(g, { view, camX: 0, camY: 0, season, time: t, t: o.t ?? 0, actors })
  return g
}

/** 一套 kit 的 tile 排成表：每格中間留 2px，透明的地方鋪 paper */
export function tileSheet(tokens: Tokens, prefix: string, season: Season, time: TimeOfDay, cols = 24): Gfx {
  const tiles = allTiles().filter((t) => t.name.startsWith(prefix))
  const cache = new TileCache(tokens)
  const rows = Math.ceil(tiles.length / cols)
  const g = new Gfx(cols * 18, rows * 18, cache.palette(time))
  g.clear('paper-2')
  tiles.forEach((def, i) => {
    const img = cache.draw(def, { season, time, frame: 0, variant: 0, mask: def.connect ? 15 : 0, x: 0, y: 0 })
    const ox = (i % cols) * 18 + 1
    const oy = Math.floor(i / cols) * 18 + 1
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const v = img.buf[y * TILE + x]!
        if (v) g.buf[(oy + y) * g.w + ox + x] = v
      }
  })
  return g
}

/** 一套 kit 的東西整個畫出來（好幾格的照原樣拼回去；一格的排在後面），寬 width px 換行 */
export function objectSheet(tokens: Tokens, prefix: string, season: Season, time: TimeOfDay, width = 640, bloom = false): Gfx {
  const cache = new TileCache(tokens)
  const items: Array<{ w: number; h: number; cells: Array<{ cx: number; cy: number; id: number }> }> = []
  const inObject = new Set<number>()
  for (const name of objectNames()) {
    if (!name.startsWith(prefix)) continue
    if (name.endsWith('@bloom') !== bloom && objectInfo(name.replace('@bloom', ''))?.bloom) continue
    const info = objectInfo(name)!
    const cells: Array<{ cx: number; cy: number; id: number }> = []
    for (let cy = 0; cy < info.h; cy++)
      for (let cx = 0; cx < info.w; cx++) {
        const t = allTiles().find((d) => d.name === `${name}/${cx},${cy}`)
        if (t) {
          cells.push({ cx, cy, id: t.id })
          inObject.add(t.id)
        }
      }
    items.push({ w: info.w, h: info.h, cells })
  }
  for (const t of allTiles()) if (t.name.startsWith(prefix) && !t.name.includes('/', prefix.length) && !inObject.has(t.id)) items.push({ w: 1, h: 1, cells: [{ cx: 0, cy: 0, id: t.id }] })
  // 排版：一列放不下就換行
  let x = 2
  let y = 2
  let rowH = 0
  const pos: Array<[number, number]> = []
  for (const it of items) {
    const w = it.w * TILE
    if (x + w > width - 2) {
      x = 2
      y += rowH + 4
      rowH = 0
    }
    pos.push([x, y])
    x += w + 4
    rowH = Math.max(rowH, it.h * TILE)
  }
  const g = new Gfx(width, y + rowH + 2, cache.palette(time))
  g.clear('paper-2')
  items.forEach((it, i) => {
    const [ox, oy] = pos[i]!
    for (const c of it.cells) {
      const def = allTiles().find((d) => d.id === c.id)!
      const img = cache.draw(def, { season, time, frame: 0, variant: 0, mask: def.connect ? 10 : 0, x: 0, y: 0 })
      for (let yy = 0; yy < TILE; yy++)
        for (let xx = 0; xx < TILE; xx++) {
          const v = img.buf[yy * TILE + xx]!
          if (v) g.buf[(oy + c.cy * TILE + yy) * g.w + ox + c.cx * TILE + xx] = v
        }
    }
  })
  return g
}

/** 把幾張圖橫著或直著拼起來（中間 gap px，空的地方鋪 ink） */
export function stitch(list: Gfx[], dir: 'h' | 'v', gap = 4): Gfx {
  const w = dir === 'h' ? list.reduce((s, g) => s + g.w, 0) + gap * (list.length - 1) : Math.max(...list.map((g) => g.w))
  const h = dir === 'v' ? list.reduce((s, g) => s + g.h, 0) + gap * (list.length - 1) : Math.max(...list.map((g) => g.h))
  const out = new Gfx(w, h, list[0]!.pal)
  out.clear('ink')
  let at = 0
  for (const g of list) {
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const v = g.buf[y * g.w + x]!
      if (!v) continue
      const X = dir === 'h' ? at + x : x
      const Y = dir === 'v' ? at + y : y
      out.buf[Y * w + X] = v
    }
    at += (dir === 'h' ? g.w : g.h) + gap
  }
  return out
}

// ---------- PNG ----------
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const be32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const td = concat([new TextEncoder().encode(type), data])
  return concat([be32(data.length), td, be32(crc32(td))])
}
async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate')
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Gfx → PNG（scale 倍、最近鄰）；透明的像素照樣透明 */
export async function encodePng(g: Gfx, scale = 1): Promise<Uint8Array> {
  const W = g.w * scale
  const H = g.h * scale
  const raw = new Uint8Array((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1)
    for (let x = 0; x < W; x++) {
      const v = g.buf[Math.floor(y / scale) * g.w + Math.floor(x / scale)]!
      const o = row + 1 + x * 4
      raw[o] = v & 255
      raw[o + 1] = (v >>> 8) & 255
      raw[o + 2] = (v >>> 16) & 255
      raw[o + 3] = v ? 255 : 0
    }
  }
  const ihdr = concat([be32(W), be32(H), new Uint8Array([8, 6, 0, 0, 0])])
  return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0))])
}
