import { makePalette, type Palette, readTokens } from '../../../services/pixelwalk/palette'
import type { Sprite } from '../../../services/pixelwalk/sprite'

/**
 * DOM 裡畫像素圖（品項的小圖、印的圖案）：sprite 用白天的調色盤（--color-px-* token）畫進 canvas，
 * canvas 的大小就是 sprite 的點數，CSS 用 image-rendering: pixelated 放大。
 */
let pal: Palette | null = null
function palette(): Palette | null {
  if (pal) return pal
  try {
    pal = makePalette(readTokens(), 'day')
  } catch {
    pal = null
  }
  return pal
}

export function paintSprite(c: HTMLCanvasElement | null, s: Sprite) {
  const p = palette()
  if (!c || !p) return
  c.width = s.w
  c.height = s.h
  const ctx = c.getContext('2d')
  if (!ctx) return
  const buf = new Uint32Array(s.w * s.h)
  const lut = s.keys.map((k) => p.u32[k])
  for (let i = 0; i < buf.length; i++) {
    const v = s.idx[i]!
    if (v) buf[i] = lut[v - 1]!
  }
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.buffer), s.w, s.h), 0, 0)
}
