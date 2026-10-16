import { Gfx } from './gfx'
import { PX, type Palette, type Px } from './palette'
import type { Sprite } from './sprite'

/**
 * 用畫的做 sprite：fn 在一塊 w×h 的 Gfx 上用調色盤的名字畫（rect、ellipse、poly…），
 * 畫完自動描外框（outline，GBA 的黑邊；不要就給 null）。適合圓的、對稱的、會動的東西（頭、車、動物）。
 */
const KEY_PAL: Palette = { key: 'keys', u32: Object.fromEntries(PX.map((k, i) => [k, i + 1])) as Record<Px, number> }

export function drawSprite(w: number, h: number, fn: (g: Gfx) => void, outline: Px | null = 'ink'): Sprite {
  // 外框要一格的空間：畫在內縮 1 的位置
  const g = new Gfx(w, h, KEY_PAL)
  fn(g)
  const src = g.buf
  const out = new Uint32Array(src)
  if (outline) {
    const v = PX.indexOf(outline) + 1
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (src[y * w + x]) continue
        const n = (dx: number, dy: number) => {
          const xx = x + dx
          const yy = y + dy
          return xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] !== 0
        }
        if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) out[y * w + x] = v
      }
  }
  const used = [...new Set(out)].filter((v) => v !== 0)
  const keys = used.map((v) => PX[v - 1]!)
  const remap = new Map(used.map((v, i) => [v, i + 1]))
  const idx = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) if (out[i]) idx[i] = remap.get(out[i]!)!
  return { w, h, keys, idx }
}

/** 左右翻過來的 sprite（需要固定朝左的東西） */
export function mirrored(s: Sprite): Sprite {
  const idx = new Uint8Array(s.idx.length)
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) idx[y * s.w + x] = s.idx[y * s.w + (s.w - 1 - x)]!
  return { ...s, idx }
}
