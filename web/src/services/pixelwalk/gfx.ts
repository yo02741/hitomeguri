import type { Ink, Palette, Px } from './palette'
import type { Sprite } from './sprite'

/**
 * 軟體點陣畫布：一個 Uint32Array 的像素緩衝（0 是透明），所有圖形都畫在整數像素上、不反鋸齒。
 * 背景的長條、天空、每一格畫面都是 Gfx；最後整格 putImageData 到 canvas，CSS 用 pixelated 放大。
 * 座標可以先平移（ox、oy：畫長條、腳本用世界座標畫的時候）；超出畫布的部分自動裁掉。
 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
/** 抖色的格子：level 0–16，越大越滿 */
export const dotOn = (x: number, y: number, level: number) => BAYER[((y & 3) << 2) | (x & 3)]! < level

export class Gfx {
  readonly w: number
  readonly h: number
  readonly buf: Uint32Array
  pal: Palette
  ox = 0
  oy = 0

  constructor(w: number, h: number, pal: Palette, buf?: Uint32Array) {
    this.w = Math.max(1, Math.round(w))
    this.h = Math.max(1, Math.round(h))
    this.buf = buf ?? new Uint32Array(this.w * this.h)
    this.pal = pal
  }

  /** 平移一段時間：g.at(-cam, 0, () => …) */
  at(ox: number, oy: number, fn: () => void) {
    const [a, b] = [this.ox, this.oy]
    this.ox += ox
    this.oy += oy
    try {
      fn()
    } finally {
      this.ox = a
      this.oy = b
    }
  }

  private c(k: Ink): number {
    return k === null ? 0 : this.pal.u32[k]
  }

  clear(k: Ink = null) {
    this.buf.fill(this.c(k))
  }

  px(x: number, y: number, k: Ink) {
    x = Math.round(x + this.ox)
    y = Math.round(y + this.oy)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || k === null) return
    this.buf[y * this.w + x] = this.pal.u32[k]
  }

  /** 填一段：畫布座標、已平移 */
  private span(x0: number, x1: number, y: number, v: number) {
    if (y < 0 || y >= this.h) return
    const a = Math.max(0, x0)
    const b = Math.min(this.w - 1, x1)
    if (a > b) return
    this.buf.fill(v, y * this.w + a, y * this.w + b + 1)
  }

  hline(x0: number, x1: number, y: number, k: Ink) {
    if (k === null) return
    const [a, b] = x0 <= x1 ? [x0, x1] : [x1, x0]
    this.span(Math.round(a + this.ox), Math.round(b + this.ox), Math.round(y + this.oy), this.c(k))
  }

  vline(x: number, y0: number, y1: number, k: Ink) {
    if (k === null) return
    const [a, b] = y0 <= y1 ? [y0, y1] : [y1, y0]
    for (let y = Math.round(a); y <= Math.round(b); y++) this.px(x, y, k)
  }

  rect(x: number, y: number, w: number, h: number, k: Ink) {
    if (k === null || w <= 0 || h <= 0) return
    const v = this.c(k)
    const x0 = Math.round(x + this.ox)
    const y0 = Math.round(y + this.oy)
    const x1 = x0 + Math.round(w) - 1
    for (let yy = y0; yy < y0 + Math.round(h); yy++) this.span(x0, x1, yy, v)
  }

  /** 挖掉（變透明）：窗洞、半圓 */
  cut(x: number, y: number, w: number, h: number) {
    if (w <= 0 || h <= 0) return
    const x0 = Math.round(x + this.ox)
    const y0 = Math.round(y + this.oy)
    for (let yy = y0; yy < y0 + Math.round(h); yy++) this.span(x0, x0 + Math.round(w) - 1, yy, 0)
  }

  /** 外框（1px） */
  frame(x: number, y: number, w: number, h: number, k: Ink) {
    this.hline(x, x + w - 1, y, k)
    this.hline(x, x + w - 1, y + h - 1, k)
    this.vline(x, y, y + h - 1, k)
    this.vline(x + w - 1, y, y + h - 1, k)
  }

  /** Bresenham 直線 */
  line(x0: number, y0: number, x1: number, y1: number, k: Ink) {
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.px(x0, y0, k)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }

  /** 實心圓（像素畫的圓：半徑加半格） */
  circle(cx: number, cy: number, r: number, k: Ink) {
    this.ellipse(cx, cy, r, r, k)
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, k: Ink) {
    if (k === null) return
    const v = this.c(k)
    const X = Math.round(cx + this.ox)
    const Y = Math.round(cy + this.oy)
    const RY = Math.round(ry)
    for (let dy = -RY; dy <= RY; dy++) {
      const t = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))
      const dx = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, t)))
      this.span(X - dx, X + dx, Y + dy, v)
    }
  }

  /** 空心圓 */
  ring(cx: number, cy: number, r: number, k: Ink) {
    let x = Math.round(r)
    let y = 0
    let err = 1 - x
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]] as const) this.px(cx + a, cy + b, k)
      y++
      if (err < 0) err += 2 * y + 1
      else {
        x--
        err += 2 * (y - x) + 1
      }
    }
  }

  /** 多邊形（掃描線、奇偶規則）：pts = [x0, y0, x1, y1, …] */
  poly(pts: number[], k: Ink) {
    if (k === null || pts.length < 6) return
    const v = this.c(k)
    const n = pts.length / 2
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < n; i++) {
      minY = Math.min(minY, pts[i * 2 + 1]!)
      maxY = Math.max(maxY, pts[i * 2 + 1]!)
    }
    const xs: number[] = []
    for (let y = Math.ceil(minY - 0.5); y <= Math.floor(maxY - 0.5); y++) {
      const sy = y + 0.5
      xs.length = 0
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2]!
        const ay = pts[i * 2 + 1]!
        const bx = pts[((i + 1) % n) * 2]!
        const by = pts[((i + 1) % n) * 2 + 1]!
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.ceil(xs[i]! - 0.5)
        const x1 = Math.floor(xs[i + 1]! - 0.5)
        this.span(Math.round(x0 + this.ox), Math.round(x1 + this.ox), Math.round(y + this.oy), v)
      }
    }
  }

  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, k: Ink) {
    this.poly([x0, y0, x1, y1, x2, y2], k)
  }

  /** 抖色：在 Bayer 4×4 的格子上點 level/16 的點（GBA 的漸層、半透明、陰影都用這個） */
  dither(x: number, y: number, w: number, h: number, k: Ink, level: number) {
    if (k === null || level <= 0) return
    if (level >= 16) return this.rect(x, y, w, h, k)
    const v = this.c(k)
    const x0 = Math.max(0, Math.round(x + this.ox))
    const y0 = Math.max(0, Math.round(y + this.oy))
    const x1 = Math.min(this.w, Math.round(x + this.ox) + Math.round(w))
    const y1 = Math.min(this.h, Math.round(y + this.oy) + Math.round(h))
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (dotOn(xx, yy, level)) this.buf[yy * this.w + xx] = v
  }

  /** 由上往下的色帶：colors 依序排，相鄰兩色的交界抖色過去（天空、海、夕陽） */
  bands(y: number, h: number, colors: Px[], x = 0, w = this.w) {
    if (!colors.length) return
    if (colors.length === 1) return this.rect(x, y, w, h, colors[0]!)
    const seg = h / colors.length
    for (let i = 0; i < colors.length; i++) {
      const top = Math.round(y + i * seg)
      const bot = Math.round(y + (i + 1) * seg)
      this.rect(x, top, w, bot - top, colors[i]!)
      // 往下一色抖過去：最後 5 列
      if (i + 1 < colors.length) {
        const n = Math.min(5, bot - top)
        for (let j = 0; j < n; j++) this.dither(x, bot - n + j, w, 1, colors[i + 1]!, Math.round(((j + 1) / (n + 1)) * 16))
      }
    }
  }

  /** 貼 sprite：flip 左右翻；ink 給剪影一個顏色（遠景、影子） */
  sprite(s: Sprite, x: number, y: number, opts: { flip?: boolean; ink?: Px; level?: number } = {}) {
    const lut = new Uint32Array(s.keys.length + 1)
    s.keys.forEach((k, i) => (lut[i + 1] = this.pal.u32[opts.ink ?? k]))
    const X = Math.round(x + this.ox)
    const Y = Math.round(y + this.oy)
    const level = opts.level ?? 16
    for (let j = 0; j < s.h; j++) {
      const yy = Y + j
      if (yy < 0 || yy >= this.h) continue
      for (let i = 0; i < s.w; i++) {
        const v = s.idx[j * s.w + (opts.flip ? s.w - 1 - i : i)]!
        if (!v) continue
        const xx = X + i
        if (xx < 0 || xx >= this.w || (level < 16 && !dotOn(xx, yy, level))) continue
        this.buf[yy * this.w + xx] = lut[v]!
      }
    }
  }

  /**
   * 貼 RGB 調色盤的 sprite（你的旅人，traveller.ts）：idx 1 起算、0 透明，lut 是這個時段換好色的像素值。
   * flip、level 同 sprite()
   */
  lut(s: { w: number; h: number; idx: Uint8Array }, lut: Uint32Array, x: number, y: number, opts: { flip?: boolean; level?: number } = {}) {
    const X = Math.round(x + this.ox)
    const Y = Math.round(y + this.oy)
    const level = opts.level ?? 16
    for (let j = 0; j < s.h; j++) {
      const yy = Y + j
      if (yy < 0 || yy >= this.h) continue
      for (let i = 0; i < s.w; i++) {
        const v = s.idx[j * s.w + (opts.flip ? s.w - 1 - i : i)]!
        if (!v) continue
        const xx = X + i
        if (xx < 0 || xx >= this.w || (level < 16 && !dotOn(xx, yy, level))) continue
        this.buf[yy * this.w + xx] = lut[v]!
      }
    }
  }

  /** 把另一塊 Gfx（長條、天空）貼上來：從 src 的 (sx, sy) 取 w×h，貼到 (dx, dy)；透明的不貼 */
  blit(src: Gfx, sx: number, sy: number, w: number, h: number, dx: number, dy: number, opaque = false) {
    sx = Math.round(sx)
    sy = Math.round(sy)
    dx = Math.round(dx + this.ox)
    dy = Math.round(dy + this.oy)
    for (let j = 0; j < h; j++) {
      const ty = dy + j
      const fy = sy + j
      if (ty < 0 || ty >= this.h || fy < 0 || fy >= src.h) continue
      let x0 = 0
      let x1 = w
      if (dx + x0 < 0) x0 = -dx
      if (sx + x0 < 0) x0 = Math.max(x0, -sx)
      if (dx + x1 > this.w) x1 = this.w - dx
      if (sx + x1 > src.w) x1 = Math.min(x1, src.w - sx)
      if (x0 >= x1) continue
      const so = fy * src.w + sx
      const to = ty * this.w + dx
      if (opaque) this.buf.set(src.buf.subarray(so + x0, so + x1), to + x0)
      else
        for (let i = x0; i < x1; i++) {
          const v = src.buf[so + i]!
          if (v) this.buf[to + i] = v
        }
    }
  }

  /** 整個畫面蓋一層抖色（轉場：level 0 到 16 由透明到全蓋） */
  cover(k: Px, level: number) {
    this.at(-this.ox, -this.oy, () => this.dither(0, 0, this.w, this.h, k, level))
  }

  /** 3×5 的小字（英數與幾個符號，招牌、站名用）：回傳寬度 */
  text(s: string, x: number, y: number, k: Ink): number {
    let cx = x
    for (const ch of s.toUpperCase()) {
      const g = FONT[ch]
      if (g === undefined) {
        cx += 4
        continue
      }
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if ((g >> ((4 - j) * 3 + (2 - i))) & 1) this.px(cx + i, y + j, k)
      cx += 4
    }
    return cx - x - 1
  }
}

// 3×5 字型：每字 15 位元，由上而下、由左而右
const F = (rows: string) => parseInt(rows.replace(/[^#.]/g, '').replace(/#/g, '1').replace(/\./g, '0'), 2)
const FONT: Record<string, number> = {
  A: F('.#. #.# ### #.# #.#'), B: F('##. #.# ##. #.# ##.'), C: F('.## #.. #.. #.. .##'), D: F('##. #.# #.# #.# ##.'),
  E: F('### #.. ##. #.. ###'), F: F('### #.. ##. #.. #..'), G: F('.## #.. #.# #.# .##'), H: F('#.# #.# ### #.# #.#'),
  I: F('### .#. .#. .#. ###'), J: F('..# ..# ..# #.# .#.'), K: F('#.# #.# ##. #.# #.#'), L: F('#.. #.. #.. #.. ###'),
  M: F('#.# ### ### #.# #.#'), N: F('##. #.# #.# #.# #.#'), O: F('.#. #.# #.# #.# .#.'), P: F('##. #.# ##. #.. #..'),
  Q: F('.#. #.# #.# ### .##'), R: F('##. #.# ##. #.# #.#'), S: F('.## #.. .#. ..# ##.'), T: F('### .#. .#. .#. .#.'),
  U: F('#.# #.# #.# #.# ###'), V: F('#.# #.# #.# #.# .#.'), W: F('#.# #.# ### ### #.#'), X: F('#.# #.# .#. #.# #.#'),
  Y: F('#.# #.# .#. .#. .#.'), Z: F('### ..# .#. #.. ###'),
  '0': F('### #.# #.# #.# ###'), '1': F('.#. ##. .#. .#. ###'), '2': F('##. ..# .#. #.. ###'), '3': F('##. ..# .#. ..# ##.'),
  '4': F('#.# #.# ### ..# ..#'), '5': F('### #.. ##. ..# ##.'), '6': F('.## #.. ### #.# ###'), '7': F('### ..# .#. .#. .#.'),
  '8': F('### #.# ### #.# ###'), '9': F('### #.# ### ..# ##.'),
  '-': F('... ... ### ... ...'), '.': F('... ... ... ... .#.'), '!': F('.#. .#. .#. ... .#.'), '?': F('##. ..# .#. ... .#.'),
  '/': F('..# ..# .#. #.. #..'), ':': F('... .#. ... .#. ...'), '+': F('... .#. ### .#. ...'), "'": F('.#. .#. ... ... ...'),
  // 乘號（變焦的「×1.5」：比字母 X 小一號，不會看成 X 鍵）
  '×': F('... #.# .#. #.# ...'),
  ' ': 0,
}
