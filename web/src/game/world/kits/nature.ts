import type { Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import type { TileCtx } from '../../engine/types'

import { foliage, hash2, leafTones, shadow, stone, thickSnow } from './draw'
import type { Kit } from '../types'

/**
 * 自然的地標（資料的名字寫著山、岳、滝、温泉、灯台才用）：山（岩稜、山腰的林、登山道）、瀑布（崖、往下流的水、
 * 潭）、露天的溫泉（石頭圍的湯、熱氣）、燈塔。北海道（snow）冬天積厚雪、瀑布結冰；關東的山冬天只是枯色。
 */
export interface NatureOpts {
  kit: Kit
  snow: boolean
}

/** 山（6×4）：三角的山體、岩稜、山腰的樹、之字形的登山道；北海道秋天山頂初雪、冬天整座白 */
export function peak(g: Gfx, c: TileCtx, o: NatureOpts) {
  const W = 96
  const H = 64
  const winter = o.snow && c.season === 'winter'
  const capped = winter || (o.snow && c.season === 'autumn')
  // 山的外形：主峰＋右邊的肩
  const ridge = (x: number) => {
    const a = Math.max(0, 1 - Math.abs(x - 44) / 44)
    const b = Math.max(0, 1 - Math.abs(x - 74) / 24) * 0.55
    const n = ((hash2(x >> 2, 7) % 5) - 2) * 0.4
    return Math.round(H - 6 - Math.max(a, b) * (H - 10) + n)
  }
  for (let x = 1; x < W - 1; x++) {
    const top = ridge(x)
    g.vline(x, top, H - 4, 'ink-2')
    g.vline(x, top + 1, H - 4, x < 44 ? 'stone-2' : 'stone-3')
  }
  // 山腰的林（下半部）
  const forest = leafTones(c.season === 'winter' ? 'summer' : c.season, o.kit)
  for (let x = 2; x < W - 2; x++) {
    const top = ridge(x)
    const treeLine = Math.max(top + 2, Math.round(H - 6 - (H - 10) * 0.45))
    for (let y = treeLine; y < H - 4; y++) {
      const k: Px = (x + y * 3) % 7 === 0 ? forest.light : (x + y) % 3 === 0 ? forest.dark : forest.mid
      g.px(x, y, winter ? ((x + y) % 4 === 0 ? 'leaf-4' : (x * 3 + y) % 5 === 0 ? 'snow-3' : 'snow-1') : k)
    }
  }
  // 岩稜的亮面與裂縫
  for (let x = 4; x < W - 4; x += 3) {
    const top = ridge(x)
    if (x < 44) g.line(x, top + 2, x + 3, top + 7, 'stone-1')
    else g.line(x, top + 2, x - 2, top + 6, 'stone-4')
  }
  // 岩的小點（只在山的裡面）
  for (let x = 2; x < W - 2; x++) for (let y = ridge(x) + 3; y < H - 30; y++) if (hash2(x, y, 5) % 40 === 0) g.px(x, y, 'stone-4')
  // 雪（山頂一帶）
  if (capped) {
    const line = winter ? H - 12 : 22
    for (let x = 2; x < W - 2; x++) {
      const top = ridge(x)
      const bottom = Math.min(H - 5, line + ((hash2(x, 3) % 4) - 1))
      if (top + 1 > bottom) continue
      g.vline(x, top + 1, bottom, x < 44 ? 'snow-1' : 'snow-2')
      g.px(x, top + 1, 'white')
    }
  }
  // 登山道：之字形
  const trail: Px = winter ? 'snow-3' : 'dirt-1'
  g.line(48, H - 5, 38, H - 14, trail)
  g.line(38, H - 14, 52, H - 22, trail)
  g.line(52, H - 22, 44, H - 30, trail)
  // 山腳
  g.hline(1, W - 2, H - 4, 'ink-2')
  g.rect(1, H - 3, W - 2, 3, winter ? 'snow-2' : forest.dark)
}

/** 瀑布（3×4）：兩側的岩壁、中間往下流的水（動畫）、下面的潭與水花；北海道的冬天結冰（不動） */
export function waterfall(g: Gfx, c: TileCtx, o: NatureOpts) {
  const frozen = o.snow && c.season === 'winter'
  const t = leafTones(c.season === 'winter' ? 'summer' : c.season, o.kit)
  // 崖頂的林
  foliage(g, 10, 7, 10, 6, t, 3)
  foliage(g, 38, 7, 10, 6, t, 4)
  if (frozen) {
    thickSnow(g, 1, 2, 18, 3, 1)
    thickSnow(g, 29, 2, 18, 3, 2)
  }
  // 岩壁
  for (const [x, w] of [[0, 18], [30, 18]] as const)
    for (let y = 12; y < 54; y += 7)
      for (let xx = x + ((y / 7) % 2) * 3; xx < x + w; xx += 9) stone(g, xx, y, Math.min(9, x + w - xx), 7, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
  // 水：一條一條往下的白線
  g.rect(17, 8, 14, 46, frozen ? 'snow-2' : 'sea-2')
  for (let x = 18; x < 30; x++) {
    const ph = (hash2(x, 1) % 8) + (frozen ? 0 : c.frame * 4)
    for (let y = 8 + (ph % 8); y < 54; y += 8) g.vline(x, y, y + 3, frozen ? 'white' : x % 3 ? 'foam' : 'sea-1')
  }
  g.vline(17, 8, 53, 'ink-2')
  g.vline(30, 8, 53, 'ink-2')
  // 潭與水花
  g.rect(4, 52, 40, 11, frozen ? 'snow-2' : 'sea-2')
  g.rect(3, 54, 42, 7, frozen ? 'snow-1' : 'sea-3')
  for (let x = 8; x < 40; x += 4) g.hline(x, x + 2, 55 + ((x + c.frame) % 3) * 2, frozen ? 'white' : 'sea-1')
  for (let x = 15; x < 33; x += 2) g.px(x, 52 + ((x + c.frame) % 2), frozen ? 'white' : 'foam')
  g.hline(2, 45, 62, 'stone-3')
  g.hline(2, 45, 63, 'stone-4')
}

/** 露天的溫泉（4×3）：石頭圍起來的湯、竹的出水口、後面的竹籬、往上飄的熱氣（動畫） */
export function onsen(g: Gfx, c: TileCtx, o: NatureOpts) {
  const snow = o.snow && c.season === 'winter'
  // 後面的竹籬
  g.rect(0, 2, 64, 14, 'wood-2')
  for (let x = 1; x < 64; x += 3) g.vline(x, 2, 15, 'wood-1')
  g.hline(0, 63, 6, 'wood-3')
  g.hline(0, 63, 12, 'wood-3')
  if (snow) thickSnow(g, 0, 0, 64, 3, 4)
  // 湯：石頭圍成的橢圓
  g.ellipse(32, 31, 29, 13, 'stone-4')
  g.ellipse(32, 31, 27, 11, 'stone-3')
  g.ellipse(32, 32, 23, 8, 'lagoon-2')
  g.ellipse(32, 33, 20, 6, 'lagoon-1')
  g.dither(10, 26, 44, 4, 'sea-1', 4)
  for (let a = 0; a < 18; a++) {
    const th = (a / 18) * Math.PI * 2
    const x = Math.round(32 + Math.cos(th) * 25)
    const y = Math.round(31 + Math.sin(th) * 10)
    stone(g, x - 3, y - 2, 6, 5, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
    if (snow && Math.sin(th) < 0.3) g.hline(x - 2, x + 1, y - 2, 'snow-1')
  }
  // 出水口（竹）
  g.rect(50, 16, 2, 10, 'leaf-3')
  g.hline(44, 51, 16, 'leaf-2')
  g.vline(44, 17, 21, 'sea-1')
  // 熱氣（冬天比較濃）
  const lvl = snow ? 8 : c.season === 'summer' ? 3 : 5
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 9
    const y = 22 - ((c.frame * 3 + i * 5) % 14)
    g.dither(x - 3, y, 7, 5, 'white', lvl)
    g.dither(x - 2, y - 3, 5, 3, 'white', Math.max(2, lvl - 3))
  }
  g.rect(0, 45, 64, 3, 'stone-2')
  g.hline(0, 63, 47, 'stone-4')
  shadow(g, 32, 44, 26, 1)
}

/** 燈塔（2×4）：白的塔身、上面的燈室（夜裡亮、光往兩邊）、底下的小屋 */
export function lighthouse(g: Gfx, c: TileCtx, o: NatureOpts) {
  const late = c.time !== 'day'
  const snow = o.snow && c.season === 'winter'
  if (late) {
    g.dither(0, 6, 9, 4, 'lamp-1', 4)
    g.dither(23, 6, 9, 4, 'lamp-1', 4)
  }
  g.poly([10, 6, 16, 0, 22, 6], 'ink-2')
  g.poly([11, 5, 16, 1, 21, 5], 'shu-2')
  g.rect(11, 6, 10, 7, 'ink-2')
  g.rect(12, 7, 8, 5, late ? 'lamp-1' : 'sky-day-2')
  g.vline(16, 7, 11, 'ink-2')
  g.rect(9, 13, 14, 2, 'ink-2')
  for (let y = 15; y < 52; y++) {
    const h = Math.round(5 + (y - 15) * 0.07)
    g.hline(16 - h, 15 + h, y, 'white')
    g.px(16 - h, y, 'stone-2')
    g.px(15 + h, y, 'stone-3')
    g.px(14 + h, y, 'paper-2')
  }
  for (const y of [22, 34]) {
    g.rect(14, y, 4, 5, 'ink-2')
    g.rect(15, y + 1, 2, 3, late ? 'lamp-2' : 'stone-3')
  }
  // 小屋
  g.rect(1, 46, 30, 15, 'ink-2')
  g.rect(2, 47, 28, 13, 'white')
  g.rect(2, 44, 28, 3, 'shu-2')
  g.rect(20, 50, 6, 10, 'wood-3')
  if (snow) {
    thickSnow(g, 1, 42, 30, 3, 6)
    thickSnow(g, 10, 4, 12, 2, 7)
  }
  g.rect(0, 60, 32, 4, 'stone-2')
  g.hline(0, 31, 63, 'stone-4')
}
