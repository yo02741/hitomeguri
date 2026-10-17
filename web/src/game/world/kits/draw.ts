import { dotOn, type Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import type { Season } from '../../engine/types'
import type { Kit } from '../types'

/**
 * 地方 kit 共用的畫法（GBA 的 tileset 風格）：光從左上來，亮面、中間色、暗面三階＋一圈深色的邊；
 * 漸層與陰影用 Bayer 抖色，不用透明度。顏色只用 px token。
 * 這裡的函式都畫在 g 的座標上（g.at 平移過的也可以）。
 */

/** 格子座標的雜湊（決定小花樣：同一格每次一樣） */
export function hash2(x: number, y: number, s = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/** 有外框的矩形 */
export function box(g: Gfx, x: number, y: number, w: number, h: number, fill: Px, line?: Px) {
  if (line) {
    g.rect(x, y, w, h, line)
    g.rect(x + 1, y + 1, w - 2, h - 2, fill)
  } else g.rect(x, y, w, h, fill)
}

/** 立體的方塊：上緣亮、下緣與右緣暗 */
export function bevel(g: Gfx, x: number, y: number, w: number, h: number, fill: Px, light: Px, dark: Px) {
  g.rect(x, y, w, h, fill)
  g.hline(x, x + w - 1, y, light)
  g.vline(x, y, y + h - 1, light)
  g.hline(x, x + w - 1, y + h - 1, dark)
  g.vline(x + w - 1, y, y + h - 1, dark)
}

/** 稀疏的小點（草、碎石、沙的紋理）：密度 0–1，seed 換花樣 */
export function speckle(g: Gfx, x: number, y: number, w: number, h: number, k: Px, density: number, seed: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (hash2(x + i, y + j, seed) % 1000 < density * 1000) g.px(x + i, y + j, k)
}

/** 一小撮草（ʌʌ） */
export function tuft(g: Gfx, x: number, y: number, k: Px, light?: Px) {
  g.px(x, y + 1, k)
  g.px(x + 1, y, k)
  g.px(x + 2, y + 1, k)
  if (light) g.px(x + 1, y - 1, light)
}

export interface Tones {
  line: Px
  dark: Px
  mid: Px
  light: Px
}

/**
 * 樹冠、灌木：一圈邊、中間色、右下暗面（抖色過去）、左上亮的幾撮葉子。
 * 不是正圓：幾個小圓疊起來，邊緣有凹凸（GBA 的樹）。
 */
export function foliage(g: Gfx, cx: number, cy: number, rx: number, ry: number, t: Tones, seed = 0) {
  const lobes = lobesOf(cx, cy, rx, ry, seed)
  for (const [x, y, r] of lobes) g.ellipse(x, y, r + 1, r + 1, t.line)
  for (const [x, y, r] of lobes) g.ellipse(x, y, r, r, t.mid)
  // 暗面：右下
  for (const [x, y, r] of lobes) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const side = dx * 0.6 + dy
        if (side > r * 0.35) g.px(x + dx, y + dy, t.dark)
        else if (side > r * 0.05 && dotOn(x + dx, y + dy, 8)) g.px(x + dx, y + dy, t.dark)
      }
  }
  // 亮面：左上的小葉叢
  for (const [x, y, r] of lobes) {
    if (r < 3) continue
    const lx = x - Math.round(r * 0.4)
    const ly = y - Math.round(r * 0.45)
    g.px(lx, ly, t.light)
    g.px(lx + 1, ly, t.light)
    g.px(lx - 1, ly + 1, t.light)
    g.px(lx + 2, ly + 1, t.light)
    if (r >= 5) {
      g.px(lx + 3, ly - 1, t.light)
      g.px(lx, ly + 2, t.light)
    }
  }
}

/** 樹冠的幾個小圓：中間一個大的，周圍幾個小的（決定外形） */
function lobesOf(cx: number, cy: number, rx: number, ry: number, seed: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [[cx, cy, Math.min(rx, ry)]]
  const n = 6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (seed % 7) * 0.3
    const r = Math.max(2, Math.round(Math.min(rx, ry) * (0.5 + ((hash2(i, seed) % 100) / 100) * 0.2)))
    out.push([Math.round(cx + Math.cos(a) * (rx - r)), Math.round(cy + Math.sin(a) * (ry - r)), r])
  }
  return out
}

/** 抖色的影子（地上的橢圓） */
export function shadow(g: Gfx, cx: number, cy: number, rx: number, ry: number, k: Px = 'ink-2', level = 6) {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))
    const dx = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, t)))
    for (let x = cx - dx; x <= cx + dx; x++) if (dotOn(x, cy + dy, level)) g.px(x, cy + dy, k)
  }
}

/** 樹幹：左亮右暗 */
export function trunk(g: Gfx, x: number, y0: number, y1: number, w: number, base: Px = 'wood-2', dark: Px = 'wood-3', light: Px = 'wood-1') {
  g.rect(x, y0, w, y1 - y0 + 1, base)
  g.vline(x + w - 1, y0, y1, dark)
  if (w > 2) g.vline(x, y0, y1, light)
  g.hline(x - 1, x + w, y1, dark)
}

/**
 * 日式的瓦屋頂（正面看下來）：一排一排的瓦（每排上亮下暗、瓦筒的縱線），屋脊在上、屋簷在下。
 * tone 給三個顏色＋邊；slope 是兩側往外斜的程度（入母屋、寄棟的屋頂兩邊斜一點）。
 */
export interface RoofTone {
  light: Px
  mid: Px
  dark: Px
  line: Px
}
export const GRAY_ROOF: RoofTone = { light: 'roof-1', mid: 'roof-2', dark: 'roof-3', line: 'ink' }
export const RED_ROOF: RoofTone = { light: 'kawara-1', mid: 'kawara-2', dark: 'kawara-3', line: 'ink-2' }
export const BARK_ROOF: RoofTone = { light: 'wood-1', mid: 'wood-2', dark: 'wood-3', line: 'ink-2' }

export function tileRoof(g: Gfx, x: number, y: number, w: number, h: number, t: RoofTone, o: { slope?: number; ridge?: boolean; rows?: number; mortar?: Px } = {}) {
  const slope = o.slope ?? 0
  // 外形：上窄下寬的梯形
  const top = y
  const bot = y + h - 1
  const inset = (yy: number) => Math.round(slope * (1 - (yy - top) / Math.max(1, h - 1)))
  for (let yy = top; yy <= bot; yy++) {
    const a = x + inset(yy)
    const b = x + w - 1 - inset(yy)
    g.hline(a, b, yy, t.mid)
    g.px(a, yy, t.line)
    g.px(b, yy, t.line)
  }
  // 一排一排的瓦：每排上緣亮、下緣暗；縱向的瓦筒每 4px 一條
  const step = o.rows ?? 4
  for (let yy = top + 2; yy < bot - 1; yy += step) {
    const a = x + inset(yy) + 1
    const b = x + w - 2 - inset(yy)
    g.hline(a, b, yy, t.light)
    g.hline(a, b, yy + step - 1, t.dark)
    for (let xx = a + ((yy / step) % 2 ? 1 : 3); xx <= b; xx += 4) {
      g.vline(xx, yy + 1, yy + step - 2, t.dark)
      if (o.mortar) g.px(xx - 1, yy + 1, o.mortar)
    }
  }
  if (o.ridge ?? true) {
    // 屋脊
    g.rect(x + inset(top) + 1, top, w - 2 - inset(top) * 2, 2, t.dark)
    g.hline(x + inset(top) + 1, x + w - 2 - inset(top), top, t.line)
  }
  // 屋簷：一條深色的影子
  g.hline(x, x + w - 1, bot, t.line)
  g.hline(x + 1, x + w - 2, bot - 1, t.dark)
}

/** 縱向的格子（町家的千本格子、障子）：bar 每 step px 一條 */
export function lattice(g: Gfx, x: number, y: number, w: number, h: number, bg: Px, bar: Px, step = 2) {
  g.rect(x, y, w, h, bg)
  for (let xx = x; xx < x + w; xx += step) g.vline(xx, y, y + h - 1, bar)
}

/** 障子（白紙＋木框的方格） */
export function shoji(g: Gfx, x: number, y: number, w: number, h: number, frame: Px = 'wood-2', paper: Px = 'white') {
  g.rect(x, y, w, h, paper)
  g.frame(x, y, w, h, frame)
  for (let xx = x + 3; xx < x + w - 1; xx += 3) g.vline(xx, y, y + h - 1, frame)
  for (let yy = y + 4; yy < y + h - 1; yy += 4) g.hline(x, x + w - 1, yy, frame)
}

/** 暖簾：分成幾片的布，下緣有一點點縫 */
export function noren(g: Gfx, x: number, y: number, w: number, h: number, cloth: Px, dark: Px, mark: Px = 'white') {
  g.rect(x, y, w, h, cloth)
  g.hline(x, x + w - 1, y, dark)
  const parts = w >= 12 ? 3 : 2
  for (let i = 1; i < parts; i++) g.vline(x + Math.round((w * i) / parts), y + 2, y + h - 1, dark)
  // 中間的白色記號（不寫字）
  g.rect(x + Math.floor(w / 2) - 1, y + 2, 3, 3, mark)
}

/** 燈籠（提灯）：夜裡亮（lamp 不跟著時段變暗） */
export function lantern(g: Gfx, x: number, y: number, night: boolean, body: Px = 'shu-1') {
  g.px(x + 1, y, 'ink')
  g.rect(x, y + 1, 3, 4, night ? 'lamp-1' : body)
  g.hline(x, x + 2, y + 1, 'ink-2')
  g.hline(x, x + 2, y + 5, 'ink-2')
  if (!night) g.px(x, y + 2, 'white')
}

/** 季節的草色 */
export function grassTones(season: Season, kit: Kit): { base: Px; dark: Px; light: Px; deep: Px } {
  if (kit === 'hokkaido') {
    // 北海道：冬天整片厚雪（草地就是雪原）；春天嫩綠、夏天濃綠、秋天草轉黃
    if (season === 'winter') return { base: 'snow-1', dark: 'snow-2', light: 'white', deep: 'snow-3' }
    if (season === 'autumn') return { base: 'leaf-2', dark: 'leaf-3', light: 'gold-1', deep: 'leaf-4' }
    if (season === 'summer') return { base: 'leaf-2', dark: 'leaf-3', light: 'leaf-1', deep: 'leaf-4' }
    return { base: 'leaf-1', dark: 'leaf-2', light: 'white', deep: 'leaf-3' }
  }
  if (kit === 'kanto') {
    // 關東：冬天不積雪，草皮枯成淺褐（冬枯れ）；其他跟近畿一樣
    if (season === 'winter') return { base: 'sand-2', dark: 'dirt-2', light: 'sand-1', deep: 'wood-3' }
    if (season === 'autumn') return { base: 'leaf-2', dark: 'leaf-3', light: 'gold-1', deep: 'dirt-2' }
    if (season === 'summer') return { base: 'leaf-2', dark: 'leaf-3', light: 'leaf-1', deep: 'leaf-4' }
    return { base: 'leaf-1', dark: 'leaf-2', light: 'white', deep: 'leaf-3' }
  }
  if (kit === 'okinawa') {
    if (season === 'winter') return { base: 'leaf-3', dark: 'leaf-4', light: 'leaf-2', deep: 'leaf-4' }
    if (season === 'autumn') return { base: 'leaf-2', dark: 'leaf-3', light: 'sand-2', deep: 'leaf-4' }
    return { base: 'leaf-2', dark: 'leaf-3', light: 'leaf-1', deep: 'leaf-4' }
  }
  // 近畿：春是嫩綠、夏是濃綠、秋草轉黃、冬是枯草色（偶爾殘雪）
  if (season === 'autumn') return { base: 'leaf-2', dark: 'leaf-3', light: 'gold-1', deep: 'dirt-2' }
  if (season === 'winter') return { base: 'leaf-3', dark: 'dirt-2', light: 'stone-1', deep: 'wood-3' }
  if (season === 'summer') return { base: 'leaf-2', dark: 'leaf-3', light: 'leaf-1', deep: 'leaf-4' }
  return { base: 'leaf-1', dark: 'leaf-2', light: 'white', deep: 'leaf-3' }
}

/** 季節在草地上多疊的一層抖色（秋：黃、冬：土色） */
export function grassTint(season: Season, kit: Kit): { k: Px; level: number } | null {
  if (kit === 'okinawa') return season === 'autumn' ? { k: 'sand-2', level: 2 } : null
  if (kit === 'hokkaido') return season === 'autumn' ? { k: 'gold-2', level: 4 } : season === 'winter' ? { k: 'snow-2', level: 3 } : null
  if (kit === 'kanto') return season === 'autumn' ? { k: 'gold-2', level: 4 } : season === 'winter' ? { k: 'dirt-1', level: 6 } : null
  if (season === 'autumn') return { k: 'gold-2', level: 5 }
  if (season === 'winter') return { k: 'dirt-1', level: 8 }
  return null
}

/** 樹的四季顏色（一般的闊葉樹） */
export function leafTones(season: Season, kit: Kit): Tones {
  if (kit === 'hokkaido' && season === 'autumn') return { line: 'leaf-4', dark: 'momiji-2', mid: 'gold-2', light: 'gold-1' }
  if (kit === 'okinawa') {
    if (season === 'winter') return { line: 'leaf-4', dark: 'leaf-4', mid: 'leaf-3', light: 'leaf-2' }
    return { line: 'leaf-4', dark: 'leaf-3', mid: 'leaf-2', light: 'leaf-1' }
  }
  if (season === 'summer') return { line: 'leaf-4', dark: 'leaf-4', mid: 'leaf-3', light: 'leaf-2' }
  if (season === 'autumn') return { line: 'leaf-4', dark: 'leaf-3', mid: 'leaf-2', light: 'sand-2' }
  if (season === 'winter') return { line: 'ink-2', dark: 'leaf-4', mid: 'leaf-3', light: 'stone-2' }
  return { line: 'leaf-4', dark: 'leaf-3', mid: 'leaf-2', light: 'leaf-1' }
}

/** 光禿的枝（冬天的落葉樹） */
export function bareBranches(g: Gfx, cx: number, cy: number, rx: number, ry: number, k: Px = 'wood-3', seed = 0) {
  g.vline(cx, cy - ry + 2, cy + ry, k)
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55 + ((hash2(i, seed) % 10) - 5) * 0.03
    const len = Math.round(Math.min(rx, ry) * (0.7 + (hash2(seed, i) % 30) / 100))
    const y0 = cy + Math.round(ry * 0.4) - i
    g.line(cx, y0, cx + Math.round(Math.cos(a) * len), y0 + Math.round(Math.sin(a) * len), k)
  }
}

/** 散落的花點（櫻、梅、寒緋櫻）：在樹冠範圍內 */
export function blossoms(g: Gfx, cx: number, cy: number, rx: number, ry: number, a: Px, b: Px, density: number, seed: number) {
  for (let dy = -ry; dy <= ry; dy++)
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx + 0.1) + (dy * dy) / (ry * ry + 0.1) > 1) continue
      const h = hash2(cx + dx, cy + dy, seed) % 1000
      if (h < density * 700) g.px(cx + dx, cy + dy, a)
      else if (h < density * 1000) g.px(cx + dx, cy + dy, b)
    }
}

/** 一塊有亮邊與暗邊的石頭（石垣、庭石） */
export function stone(g: Gfx, x: number, y: number, w: number, h: number, fill: Px, light: Px, dark: Px, line: Px) {
  g.rect(x + 1, y, w - 2, h, line)
  g.rect(x, y + 1, w, h - 2, line)
  g.rect(x + 1, y + 1, w - 2, h - 2, fill)
  g.hline(x + 1, x + w - 3, y + 1, light)
  g.px(x + 1, y + 2, light)
  g.hline(x + 2, x + w - 2, y + h - 2, dark)
  g.vline(x + w - 2, y + 2, y + h - 2, dark)
}

/** 窗戶：白天反光、夜裡亮燈 */
export function windowPane(g: Gfx, x: number, y: number, w: number, h: number, night: boolean, frame: Px = 'wood-3') {
  g.rect(x, y, w, h, frame)
  g.rect(x + 1, y + 1, w - 2, h - 2, night ? 'lamp-1' : 'sky-day-2')
  if (!night) {
    g.px(x + 1, y + 1, 'white')
    g.px(x + 2, y + 1, 'white')
    g.dither(x + 1, y + h - 3, w - 2, 2, 'sky-day-1', 8)
  } else g.dither(x + 1, y + h - 3, w - 2, 2, 'lamp-2', 6)
}

/** 雪（屋頂上、樹冠上的一層） */
export function snowCap(g: Gfx, x: number, y: number, w: number, seed = 0) {
  g.hline(x, x + w - 1, y, 'snow-1')
  for (let i = 0; i < w; i++) if (hash2(x + i, y, seed) % 3) g.px(x + i, y + 1, 'snow-2')
}

/**
 * 厚雪（北海道的冬天）：屋頂、牆頭、樹上的一大塊雪。上緣亮、兩端圓、下緣一圈淡藍的陰影，
 * 偶爾鼓起一點（不是一條直線）。depth 是雪的厚度（px）。
 */
export function thickSnow(g: Gfx, x: number, y: number, w: number, depth = 4, seed = 0) {
  if (w < 3) return
  for (let i = 0; i < w; i++) {
    const end = i === 0 || i === w - 1 ? 1 : 0
    const bump = hash2(x + i, y, seed) % 5 === 0 ? 1 : 0
    const top = y + end
    const bot = y + depth - 1 + bump - end
    g.vline(x + i, top, bot, 'snow-1')
    g.px(x + i, bot, 'snow-2')
    g.px(x + i, bot + 1, 'snow-3')
  }
  g.hline(x + 1, x + w - 2, y, 'white')
  // 雪面上一點點起伏的影子
  for (let i = 2; i < w - 2; i += 5) if (hash2(x + i, y, seed + 1) % 2) g.px(x + i, y + 1 + (depth > 3 ? 1 : 0), 'snow-2')
}

/** 屋簷垂下的冰柱（北海道的冬天）：x0–x1 之間零星幾根 */
export function icicles(g: Gfx, x0: number, x1: number, y: number, seed = 0) {
  for (let x = x0; x <= x1; x++) {
    const h = hash2(x, y, seed) % 7
    if (h > 1) continue
    g.vline(x, y, y + 1 + h, 'snow-2')
    g.px(x, y, 'white')
  }
}
