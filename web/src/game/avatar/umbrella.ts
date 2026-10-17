import { IndexCanvas } from './canvas'
import { outline } from './pixelize'
import type { Raster } from './types'

/**
 * 頭頂的傘（規格 §7 的傘類手持物）：像 pixelwalk 的 UMBRELLA，上半個橢圓的傘面、一圈別的顏色、傘頂的尖、
 * 下面一小段傘柄接到頭頂（疊在旅人上面畫，所以傘柄只畫到頭頂為止，不會蓋到臉）。
 * 顏色是這把傘自己的（generate.ts 從傘的 SVG 用 k-means 取 3 色）：canopy 傘面、accent 一圈、shaft 傘柄與傘尖。
 */
export interface UmbrellaInk {
  canopy: number
  accent: number
  shaft: number
  ink: number
}

/** width：傘面的寬（含外框）。回傳描好外框的點陣與傘柄最下面一格的 y（貼到頭頂用） */
export function umbrellaSprite(width: number, c: UmbrellaInk, stub = 2): { raster: Raster; stubBottom: number } {
  const W = width % 2 ? width : width + 1
  const cx = (W - 1) / 2
  const rx = cx - 1
  const ry = Math.max(3, Math.round(rx * 0.55))
  const cy = 2 + ry
  const H = cy + stub + 2
  const g = new IndexCanvas(W, H)
  g.ellipse(cx, cy, rx, ry, c.canopy, true)
  g.ellipse(cx, cy, Math.round(rx * 0.62), Math.round(ry * 0.66), c.accent, true)
  g.ellipse(cx, cy, Math.round(rx * 0.42), Math.round(ry * 0.42), c.canopy, true)
  // 傘骨的尖：下緣每隔幾格往上缺一格，像撐開的傘
  const ribs = Math.max(3, Math.round(rx / 3))
  for (let i = 1; i < ribs; i++) {
    const x = Math.round(cx - rx + (2 * rx * i) / ribs)
    if (x >= cx) break
    // 左右對稱
    g.px(x, cy, -1)
    g.px(W - 1 - x, cy, -1)
  }
  g.px(cx, 1, c.shaft)
  for (let y = cy + 1; y <= cy + stub; y++) g.px(cx, y, c.shaft)
  const raw = outline(g, c.ink)
  // 傘柄下面那一格的外框拿掉：那裡是頭頂
  raw[(cy + stub + 1) * W + cx] = -1
  return { raster: { w: W, h: H, raw }, stubBottom: cy + stub }
}
