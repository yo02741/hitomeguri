import { dotOn, type Gfx } from '../../services/pixelwalk/gfx'
import { packRgb, type Season, type TimeOfDay, tintRgb, type Tokens } from '../../services/pixelwalk/palette'
import { rng, type Rng } from '../../services/pixelwalk/rng'
import type { Sprite } from '../../services/pixelwalk/sprite'

import type { Actor } from './actor'
import { cellHash, type MapView } from './map'
import { TileCache, type TileImage, tileDef } from './tiles'
import { type AnySprite, isRgbSprite, type RgbSprite, TILE, type TileLayer } from './types'

/**
 * 畫一格畫面：只畫看得到的 tile（地面整列複製、上兩層跳過透明）、角色依腳底 y 排序、
 * over 層（屋頂、樹冠、草尖）畫在角色前面，最後是天氣。淡出淡入（Bayer 抖色）與時段的交替由 Game 疊上去。
 */
export interface Scene {
  view: MapView
  camX: number
  camY: number
  season: Season
  time: TimeOfDay
  /** 動畫的秒數 */
  t: number
  actors: Actor[]
}

/** 貼一格快取好的 tile（dx, dy 是畫面座標） */
export function blitTile(g: Gfx, img: TileImage, dx: number, dy: number) {
  const W = g.w
  const x0 = Math.max(0, -dx)
  const x1 = Math.min(TILE, W - dx)
  const y0 = Math.max(0, -dy)
  const y1 = Math.min(TILE, g.h - dy)
  if (x0 >= x1 || y0 >= y1) return
  const src = img.buf
  const buf = g.buf
  for (let j = y0; j < y1; j++) {
    const so = j * TILE
    const to = (dy + j) * W + dx
    if (img.opaque) buf.set(src.subarray(so + x0, so + x1), to + x0)
    else
      for (let i = x0; i < x1; i++) {
        const v = src[so + i]!
        if (v) buf[to + i] = v
      }
  }
}

/** RGB 調色盤的 sprite（P1 的旅人）：依時段換色後的查表 */
export function drawRgb(g: Gfx, s: RgbSprite, x: number, y: number, lut: Uint32Array, flip = false) {
  const X = Math.round(x + g.ox)
  const Y = Math.round(y + g.oy)
  for (let j = 0; j < s.h; j++) {
    const yy = Y + j
    if (yy < 0 || yy >= g.h) continue
    for (let i = 0; i < s.w; i++) {
      const v = s.idx[j * s.w + (flip ? s.w - 1 - i : i)]!
      if (!v) continue
      const xx = X + i
      if (xx < 0 || xx >= g.w) continue
      g.buf[yy * g.w + xx] = lut[v]!
    }
  }
}

/** 抖色的橢圓（影子） */
function shadow(g: Gfx, cx: number, cy: number, rx: number, ry: number, level: number) {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))
    const dx = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, t)))
    for (let x = cx - dx; x <= cx + dx; x++) if (dotOn(x, cy + dy, level)) g.px(x, cy + dy, 'ink-2')
  }
}

export class Renderer {
  readonly cache: TileCache
  private readonly tokens: Tokens
  private readonly luts = new WeakMap<RgbSprite, Partial<Record<TimeOfDay, Uint32Array>>>()

  constructor(tokens: Tokens, cache: TileCache) {
    this.tokens = tokens
    this.cache = cache
  }

  /** RGB sprite 依時段換色（跟 makePalette 同一套混法），每個 sprite 每個時段算一次 */
  lut(s: RgbSprite, time: TimeOfDay): Uint32Array {
    let m = this.luts.get(s)
    if (!m) {
      m = {}
      this.luts.set(s, m)
    }
    let lut = m[time]
    if (!lut) {
      lut = new Uint32Array(s.rgb.length + 1)
      s.rgb.forEach((c, i) => (lut![i + 1] = packRgb(tintRgb(c, this.tokens, time))))
      m[time] = lut
    }
    return lut
  }

  /** 一個 sprite（px token 的或 RGB 調色盤的） */
  sprite(g: Gfx, s: AnySprite, x: number, y: number, time: TimeOfDay, flip = false) {
    if (isRgbSprite(s)) drawRgb(g, s, x, y, this.lut(s, time), flip)
    else g.sprite(s as Sprite, x, y, { flip })
  }

  draw(g: Gfx, sc: Scene) {
    g.pal = this.cache.palette(sc.time)
    g.ox = 0
    g.oy = 0
    this.layer(g, sc, 'ground')
    this.layer(g, sc, 'lower')
    this.actors(g, sc)
    this.layer(g, sc, 'over')
  }

  private layer(g: Gfx, sc: Scene, layer: TileLayer) {
    const { view, camX, camY } = sc
    const map = view.map
    const ids = map[layer]
    const info = view.info[layer]
    const border = map.border[layer] ?? 0
    const tx0 = Math.floor(camX / TILE)
    const ty0 = Math.floor(camY / TILE)
    const tx1 = Math.floor((camX + g.w - 1) / TILE)
    const ty1 = Math.floor((camY + g.h - 1) / TILE)
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const inside = tx >= 0 && ty >= 0 && tx < map.w && ty < map.h
        const i = ty * map.w + tx
        const id = inside ? ids[i]! : border
        if (!id) continue
        const def = tileDef(id)
        if (!def) continue
        let variant: number
        let mask: number
        if (inside) {
          const v = info[i]!
          variant = v >> 4
          mask = v & 15
        } else {
          // 地圖外：花樣照格子挑，接邊當作四周都一樣
          variant = def.variants && def.variants > 1 ? cellHash(tx, ty) % def.variants : 0
          mask = def.connect ? 15 : 0
        }
        const img = this.cache.get(id, sc.season, sc.time, TileCache.frameOf(def, sc.t), variant, mask)
        if (img) blitTile(g, img, tx * TILE - camX, ty * TILE - camY)
      }
  }

  private actors(g: Gfx, sc: Scene) {
    // 腳底 y 由上往下；同一列玩家畫在最前面
    const list = sc.actors.filter((a) => !a.hidden)
    list.sort((a, b) => a.py - b.py || order(a) - order(b))
    // 夥伴在旅人正後方（上面一格）時，比旅人頭頂高的那幾列不畫：柴犬的耳朵不會從頭頂冒出來（像戴了貓耳）
    const player = list.find((a) => a.kind === 'player')
    let headY: number | null = null
    if (player) {
      try {
        const pf = player.look.frame(player.dir, player.pose())
        headY = player.py + TILE - sc.camY - pf.ay - player.z + topRow(pf.sprite)
      } catch {
        headY = null
      }
    }
    for (const a of list) {
      const z = a.z
      const footX = a.px + 8 - sc.camX
      const footY = a.py + TILE - sc.camY
      if (z > 1) shadow(g, footX, footY - 2, Math.round((a.look.shadow ?? 12) / 2), 2, 8)
      let f
      try {
        f = a.look.frame(a.dir, a.pose())
      } catch {
        continue
      }
      const x = footX - f.ax
      const y = footY - f.ay - z
      const behind = a.kind === 'follower' && player && headY !== null && Math.abs(a.px - player.px) < 6 && a.py < player.py && player.py - a.py <= TILE + 2
      const keep = behind ? saveRows(g, Math.round(x), Math.round(y), f.sprite.w, Math.round(headY! + 1) - Math.round(y)) : null
      // 站在高架的橋面下（上層是 overhead 的 tile）：比那一格上緣高的部分不畫，下面的部分橋面會蓋住
      const deck = overheadTop(sc, a)
      const clip = deck !== null ? saveRows(g, Math.round(x) - 8, Math.round(y) - 8, f.sprite.w + 16, deck - (Math.round(y) - 8)) : null
      this.sprite(g, f.sprite, x, y, sc.time, f.flip)
      if (f.extra) for (const e of f.extra) this.sprite(g, e.sprite, x + e.x, y + e.y, sc.time, e.flip)
      if (keep) restoreRows(g, keep)
      if (clip) restoreRows(g, clip)
    }
  }
}

/** 角色腳下那一格的上層是 overhead 的 tile（高架的橋面）：回那一格上緣在畫面上的 y；不是回 null */
function overheadTop(sc: Scene, a: Actor): number | null {
  const map = sc.view.map
  const tx = Math.floor((a.px + TILE / 2) / TILE)
  const ty = Math.floor((a.py + TILE / 2) / TILE)
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return null
  const id = map.over[ty * map.w + tx]
  return id && tileDef(id)?.overhead ? ty * TILE - sc.camY : null
}

/** sprite 最上面有顏色的那一列（快取） */
const tops = new WeakMap<object, number>()
function topRow(s: { w: number; h: number; idx: Uint8Array }): number {
  let t = tops.get(s)
  if (t !== undefined) return t
  t = 0
  outer: for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if (s.idx[j * s.w + i]) {
    t = j
    break outer
  }
  tops.set(s, t)
  return t
}

/** 先存一塊畫面（之後放回去：夥伴超出旅人頭頂的部分不畫） */
function saveRows(g: Gfx, x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number; px: Uint32Array } | null {
  const x0 = Math.max(0, x + g.ox)
  const y0 = Math.max(0, y + g.oy)
  const x1 = Math.min(g.w, x + g.ox + w)
  const y1 = Math.min(g.h, y + g.oy + h)
  if (x1 <= x0 || y1 <= y0) return null
  const px = new Uint32Array((x1 - x0) * (y1 - y0))
  for (let yy = y0; yy < y1; yy++) px.set(g.buf.subarray(yy * g.w + x0, yy * g.w + x1), (yy - y0) * (x1 - x0))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, px }
}
function restoreRows(g: Gfx, r: { x: number; y: number; w: number; h: number; px: Uint32Array }) {
  for (let yy = 0; yy < r.h; yy++) g.buf.set(r.px.subarray(yy * r.w, (yy + 1) * r.w), (r.y + yy) * g.w + r.x)
}

const order = (a: Actor) => (a.kind === 'player' ? 2 : a.kind === 'follower' ? 0 : 1)

// ---------- 天氣 ----------
export type Weather = 'clear' | 'rain' | 'snow'

interface Drop {
  x: number
  y: number
  v: number
  l: number
  p: number
}

/** 雨、雪（畫面座標，跟著鏡頭稍微移動）：沿用像素散步的畫法 */
export class WeatherFx {
  kind: Weather = 'clear'
  private drops: Drop[] = []
  private t = 0
  private readonly r: Rng = rng(7)
  private builtFor = 0

  set(kind: Weather, W: number, H = 160) {
    if (kind === this.kind && this.builtFor === W * 1000 + H) return
    this.kind = kind
    this.builtFor = W * 1000 + H
    // 高的畫面（手機直拿）照面積多下一點
    const k = H / 160
    const n = Math.round((kind === 'rain' ? W / 2.6 : kind === 'snow' ? W / 4 : 0) * k)
    this.drops = Array.from({ length: n }, () => ({
      x: this.r.range(0, W + 40),
      y: this.r.range(0, H),
      v: kind === 'rain' ? this.r.range(170, 230) : this.r.range(12, 28),
      l: this.r.int(3, 5),
      p: this.r.range(0, 7),
    }))
  }

  update(dt: number) {
    this.t += dt
  }

  draw(g: Gfx, camX: number, camY: number, time: TimeOfDay) {
    if (this.kind === 'clear') return
    const W = g.w
    const H = g.h
    const t = this.t
    if (this.kind === 'rain') {
      const k = time === 'night' ? 'sky-night-3' : 'snow-2'
      this.drops.forEach((d, i) => {
        const y = ((((d.y + t * d.v - camY * 0.3) % (H + 12)) + H + 12) % (H + 12)) - 12
        const x = ((((d.x - y * 0.3 - camX * 0.3) % (W + 40)) + W + 40) % (W + 40)) - 20
        g.line(x, y, x + 1, y - d.l, i % 4 ? k : 'white')
      })
    } else {
      const k = time === 'night' ? 'sky-day-3' : 'snow-1'
      this.drops.forEach((d, i) => {
        const y = ((((d.y + t * d.v - camY * 0.5) % (H + 8)) + H + 8) % (H + 8)) - 4
        const x = ((((d.x + Math.sin(t * 1.3 + d.p) * 4 - camX * 0.5) % W) + W) % W)
        g.px(x, y, k)
        if (i % 3 === 0) {
          g.px(x - 1, y, k)
          g.px(x, y - 1, k)
        }
      })
    }
  }
}
