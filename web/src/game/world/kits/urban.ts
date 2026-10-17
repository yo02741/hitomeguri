import type { Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import type { TileCtx } from '../../engine/types'

import { GRAY_ROOF, hash2, icicles, noren, shadow, thickSnow, tileRoof, windowPane } from './draw'

/**
 * 都市的建築（關東 kit 畫，北海道 kit 的札幌也用）：辦公大樓、住商混合、公寓、便利商店、車站、高樓、教堂、塔、會館。
 * 招牌只畫色塊、不寫字；店面不畫真的品牌。夜裡一部分的窗亮燈（哪幾格亮依位置的雜湊，每次一樣）。
 * snow：北海道的冬天，平屋頂與招牌上積厚雪、屋簷有冰柱（關東冬天不積雪，偶爾下雪是天氣畫的）。
 */
export interface UrbanOpts {
  snow: boolean
}

const isNight = (c: TileCtx) => c.time === 'night'
const isLate = (c: TileCtx) => c.time !== 'day'

/** 夜裡（黃昏少一點）這一格窗戶亮不亮 */
export function litAt(c: TileCtx, x: number, y: number, seed: number): boolean {
  if (c.time === 'day') return false
  const h = hash2(x, y, seed) % 100
  return c.time === 'night' ? h < 62 : h < 30
}

/** 玻璃（白天反光、夜裡亮燈或暗） */
export function glass(g: Gfx, x: number, y: number, w: number, h: number, c: TileCtx, seed: number, tint: Px = 'sky-day-2') {
  if (c.time === 'day') {
    g.rect(x, y, w, h, tint)
    g.dither(x, y + Math.floor(h / 2), w, h - Math.floor(h / 2), 'sky-day-1', 6)
    g.px(x, y, 'white')
    if (w > 3) g.px(x + 1, y, 'white')
    return
  }
  g.rect(x, y, w, h, litAt(c, x, y, seed) ? 'lamp-1' : 'roof-3')
  if (litAt(c, x, y, seed)) g.dither(x, y + h - 2, w, 2, 'lamp-2', 6)
}

/**
 * 平屋頂（從上面看下去的樓頂）：女兒牆、水泥板、空調室外機或樓梯間；北海道的冬天整片是雪。
 * 回傳樓頂的下緣（牆面從那裡開始）。
 */
export function flatRoof(g: Gfx, x: number, y: number, w: number, h: number, c: TileCtx, o: UrbanOpts, seed: number, extras = true): number {
  const snow = o.snow && c.season === 'winter'
  g.rect(x, y, w, h, 'ink-2')
  g.rect(x + 1, y + 1, w - 2, h - 2, snow ? 'snow-1' : 'stone-1')
  if (!snow) {
    // 女兒牆（上緣亮、內側一條影子）＋樓頂板的接縫
    g.hline(x + 1, x + w - 2, y + 1, 'white')
    g.hline(x + 2, x + w - 3, y + 2, 'stone-2')
    g.vline(x + 2, y + 2, y + h - 3, 'stone-2')
    for (let xx = x + 16; xx < x + w - 2; xx += 16) g.vline(xx, y + 3, y + h - 3, 'paper-2')
    g.hline(x + 3, x + w - 3, y + h - 3, 'paper-2')
  } else {
    g.hline(x + 1, x + w - 2, y + 1, 'white')
    g.dither(x + 1, y + h - 4, w - 2, 2, 'snow-2', 6)
  }
  if (extras) {
    // 樓梯間（小的方塊、門）＋空調室外機（橫的格柵）
    const sx = x + 4 + (seed % 3) * 3
    g.rect(sx, y + 2, 12, h - 5, 'ink-2')
    g.rect(sx + 1, y + 3, 10, h - 7, 'paper-2')
    g.hline(sx + 1, sx + 10, y + 3, 'paper')
    g.rect(sx + 7, y + h - 8, 3, 4, 'stone-3')
    if (snow) thickSnow(g, sx, y + 1, 12, 3, seed)
    const ax = x + w - 18 - (seed % 2) * 6
    g.rect(ax, y + h - 8, 12, 5, 'ink-2')
    g.rect(ax + 1, y + h - 7, 10, 3, 'stone-1')
    for (let i = ax + 2; i < ax + 11; i += 2) g.vline(i, y + h - 7, y + h - 5, 'stone-3')
    if (snow) thickSnow(g, ax, y + h - 9, 12, 2, seed + 3)
  }
  // 樓頂的邊（牆面的上緣）：一條深色的影子
  g.hline(x, x + w - 1, y + h - 1, 'ink')
  return y + h
}

/** 牆面的兩側與底（地基）：側邊深一點、底下一條石的地基 */
function sides(g: Gfx, x: number, y0: number, y1: number, w: number, base: Px = 'stone-2') {
  g.vline(x, y0, y1, 'ink-2')
  g.vline(x + w - 1, y0, y1, 'ink-2')
  g.vline(x + w - 2, y0, y1 - 3, 'stone-3')
  g.rect(x, y1 - 2, w, 3, base)
  g.hline(x, x + w - 1, y1 - 2, 'stone-1')
  g.hline(x, x + w - 1, y1, 'stone-4')
}

/** 縱的招牌（只有色塊，不寫字） */
export function signStack(g: Gfx, x: number, y: number, h: number, c: TileCtx, seed: number) {
  const night = isLate(c)
  const colors: Px[] = night ? ['neon-1', 'lamp-1', 'neon-2', 'lamp-2'] : ['shu-1', 'gold-1', 'cloth-1', 'white']
  g.rect(x, y, 6, h, 'ink-2')
  let yy = y + 1
  let i = seed % colors.length
  while (yy < y + h - 1) {
    const hh = Math.min(4 + (hash2(seed, yy) % 3), y + h - 1 - yy)
    g.rect(x + 1, yy, 4, hh - 1, colors[i % colors.length]!)
    yy += hh
    i++
  }
}

/** 店面的遮陽篷（條紋） */
export function awning(g: Gfx, x: number, y: number, w: number, a: Px, b: Px, edge: Px) {
  for (let i = 0; i < w; i += 4) g.rect(x + i, y, Math.min(4, w - i), 5, (i / 4) % 2 ? b : a)
  g.hline(x, x + w - 1, y, edge)
  for (let i = 0; i < w; i += 4) g.px(x + i + 1, y + 5, (i / 4) % 2 ? b : a)
  g.hline(x, x + w - 1, y + 6, 'ink-2')
}

/** 店的玻璃門面：架子上的東西是一點一點的色塊；夜裡整面亮 */
export function shopGlass(g: Gfx, x: number, y: number, w: number, h: number, c: TileCtx, seed: number) {
  const late = isLate(c)
  g.rect(x, y, w, h, 'stone-3')
  g.rect(x + 1, y + 1, w - 2, h - 2, late ? 'lamp-1' : 'sky-day-2')
  if (!late) g.dither(x + 1, y + 1, w - 2, h - 2, 'paper', 4)
  const goods: Px[] = ['shu-1', 'gold-1', 'leaf-2', 'cloth-1', 'sakura-2', 'white']
  for (let yy = y + 3; yy < y + h - 2; yy += 4) {
    g.hline(x + 1, x + w - 2, yy + 2, late ? 'lamp-2' : 'stone-2')
    for (let xx = x + 2; xx < x + w - 2; xx += 2) if (hash2(xx, yy, seed) % 3) g.px(xx, yy + 1, goods[hash2(xx, yy, seed + 1) % goods.length]!)
  }
  for (let xx = x + 8; xx < x + w - 1; xx += 8) g.vline(xx, y + 1, y + h - 2, 'stone-3')
}

// ---------- 大樓 ----------
/** 辦公大樓（玻璃帷幕）：樓頂、四層的帶狀玻璃、一樓的大廳 */
export function officeGlass(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const W = 64
  const top = flatRoof(g, 0, 2, W, 13, c, o, seed)
  g.rect(1, top, W - 2, 61 - top, 'stone-2')
  for (let f = 0; f < 3; f++) {
    const y = top + 1 + f * 11
    g.hline(1, W - 2, y - 1, 'stone-1')
    for (let x = 3; x < W - 4; x += 8) glass(g, x, y, 7, 8, c, seed + f * 13, f % 2 ? 'sky-day-2' : 'sky-day-3')
    g.hline(1, W - 2, y + 9, 'stone-3')
  }
  // 一樓：大廳的玻璃門、雨庇
  const ly = top + 34
  g.rect(1, ly, W - 2, 61 - ly, 'stone-1')
  g.rect(20, ly - 1, 24, 2, 'ink-2')
  g.rect(22, ly + 1, 20, 61 - ly - 1, 'stone-3')
  g.rect(23, ly + 2, 18, 61 - ly - 2, isLate(c) ? 'lamp-1' : 'sky-day-2')
  g.vline(32, ly + 2, 60, 'stone-3')
  for (const x of [5, 47]) glass(g, x, ly + 2, 12, 61 - ly - 4, { ...c, time: c.time === 'night' ? 'night' : c.time }, seed + 99)
  sides(g, 0, top, 63, W)
  if (o.snow && c.season === 'winter') icicles(g, 2, W - 3, top, seed)
}

/** 辦公大樓（磁磚外牆、方窗）：樓頂的廣告看板（色塊）、一樓的店 */
export function officeTile(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const W = 64
  const snow = o.snow && c.season === 'winter'
  const top = flatRoof(g, 0, 4, W, 11, c, o, seed, false)
  // 樓頂的看板：鐵架＋色塊
  g.rect(8, 0, 30, 10, 'ink-2')
  g.rect(9, 1, 28, 7, isLate(c) ? 'neon-2' : 'cloth-1')
  g.rect(12, 3, 10, 3, isLate(c) ? 'lamp-1' : 'white')
  g.rect(25, 3, 8, 3, isLate(c) ? 'neon-1' : 'gold-1')
  for (const x of [11, 34]) g.vline(x, 10, 13, 'ink-2')
  if (snow) thickSnow(g, 8, 0, 30, 2, seed)
  g.rect(1, top, W - 2, 61 - top, 'sand-1')
  g.dither(1, top, W - 2, 61 - top, 'sand-2', 4)
  for (let f = 0; f < 3; f++)
    for (let k = 0; k < 4; k++) {
      const x = 4 + k * 15
      const y = top + 3 + f * 10
      g.rect(x - 1, y - 1, 11, 8, 'stone-3')
      glass(g, x, y, 9, 6, c, seed + f * 7 + k)
      g.hline(x - 1, x + 9, y + 7, 'paper')
    }
  // 一樓：遮陽篷、店的玻璃
  const ly = top + 33
  awning(g, 2, ly, W - 4, 'shu-1', 'white', 'shu-2')
  shopGlass(g, 3, ly + 7, 40, 61 - ly - 8, c, seed)
  g.rect(46, ly + 7, 14, 61 - ly - 7, 'stone-3')
  g.rect(47, ly + 8, 12, 61 - ly - 8, isLate(c) ? 'lamp-2' : 'ink-2')
  signStack(g, 56, top + 2, 26, c, seed)
  sides(g, 0, top, 63, W)
}

/** 住商混合：一樓的店（遮陽篷）、上面三層的陽台（欄杆、晾的衣服）、側邊的縱招牌 */
export function mixedUse(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number, wall: Px = 'paper') {
  const W = 64
  const top = flatRoof(g, 0, 2, W, 12, c, o, seed)
  g.rect(1, top, W - 2, 61 - top, wall)
  g.dither(1, top, W - 2, 3, 'paper-2', 8)
  for (let f = 0; f < 3; f++) {
    const y = top + 2 + f * 11
    for (const x of [4, 32]) {
      // 落地窗、陽台的欄杆
      glass(g, x + 2, y, 22, 7, c, seed + f * 5 + x)
      g.vline(x + 13, y, y + 6, 'stone-3')
      g.rect(x, y + 6, 26, 4, 'stone-1')
      g.hline(x, x + 25, y + 6, 'white')
      for (let xx = x + 2; xx < x + 25; xx += 3) g.vline(xx, y + 7, y + 9, 'stone-2')
      g.hline(x, x + 25, y + 10, 'stone-3')
      // 晾的衣服（顏色是遊戲自己的）
      if (hash2(x, y, seed) % 3 === 0 && c.time === 'day') for (const [dx, k] of [[4, 'cloth-1'], [7, 'white'], [10, 'sakura-2']] as const) g.rect(x + dx, y + 2, 2, 4, k)
    }
  }
  const ly = top + 35
  awning(g, 2, ly, 40, seed % 2 ? 'leaf-2' : 'cloth-1', 'white', 'ink-2')
  shopGlass(g, 3, ly + 7, 38, 61 - ly - 8, c, seed)
  g.rect(44, ly, 16, 61 - ly, 'stone-3')
  g.rect(46, ly + 3, 12, 61 - ly - 3, isLate(c) ? 'lamp-2' : 'ink-2')
  g.vline(52, ly + 3, 60, 'stone-3')
  signStack(g, 57, top + 3, 30, c, seed + 1)
  sides(g, 0, top, 63, W)
  if (o.snow && c.season === 'winter') icicles(g, 2, W - 3, top, seed)
}

/** 公寓（マンション）：白牆、一排一排的陽台與門、樓頂的水塔 */
export function apartment(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const W = 64
  const top = flatRoof(g, 0, 2, W, 12, c, o, seed)
  g.rect(1, top, W - 2, 61 - top, 'paper')
  g.dither(1, top, W - 2, 61 - top, 'white', 4)
  for (let f = 0; f < 4; f++) {
    const y = top + 1 + f * 11
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 20
      glass(g, x + 2, y, 14, 7, c, seed + f * 3 + k)
      g.rect(x, y + 6, 18, 4, 'stone-1')
      g.hline(x, x + 17, y + 6, 'white')
      g.hline(x, x + 17, y + 9, 'stone-3')
      // 冷氣的室外機（小白方塊）
      g.rect(x + 13, y + 7, 4, 2, 'white')
      g.px(x + 14, y + 8, 'stone-3')
    }
    g.hline(1, W - 2, y + 10, 'paper-2')
  }
  // 入口
  g.rect(26, 53, 12, 8, 'stone-3')
  g.rect(27, 54, 10, 7, isLate(c) ? 'lamp-1' : 'sky-day-2')
  sides(g, 0, top, 63, W)
  if (o.snow && c.season === 'winter') icicles(g, 2, W - 3, top, seed)
}

/** 便利商店（4×3）：平屋頂、色帶（不是哪一家的配色）、整面玻璃、夜裡很亮 */
export function konbini(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const W = 64
  const top = flatRoof(g, 0, 2, W, 10, c, o, seed, false)
  // 招牌：白的帶、中間一塊色塊（不畫哪一家的配色與標誌）
  g.rect(1, top, W - 2, 8, isLate(c) ? 'lamp-1' : 'white')
  g.hline(1, W - 2, top, 'stone-2')
  g.rect(24, top + 2, 16, 4, 'cloth-1')
  g.hline(24, 39, top + 2, 'sky-day-1')
  g.hline(1, W - 2, top + 7, 'stone-3')
  shopGlass(g, 2, top + 9, 26, 46 - top - 9, c, seed)
  shopGlass(g, 36, top + 9, 26, 46 - top - 9, c, seed + 1)
  // 自動門
  g.rect(28, top + 9, 8, 46 - top - 9, 'stone-3')
  g.rect(29, top + 10, 6, 46 - top - 10, isLate(c) ? 'lamp-1' : 'sky-day-1')
  g.vline(32, top + 10, 45, 'stone-2')
  sides(g, 0, top, 47, W)
  if (o.snow && c.season === 'winter') thickSnow(g, 2, top - 1, W - 4, 2, seed)
}

/** 會館、劇場、美術館這類的大型現代建築（6×4）：混凝土、縱的鰭板、中間的玻璃大廳、雨庇 */
export function hall(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const W = 96
  const top = flatRoof(g, 0, 2, W, 12, c, o, seed, false)
  g.rect(1, top, W - 2, 60 - top, 'stone-1')
  for (let x = 4; x < W - 4; x += 6) {
    g.rect(x, top + 2, 3, 30, 'paper')
    g.vline(x + 2, top + 2, top + 31, 'stone-2')
  }
  g.rect(28, top + 6, 40, 40, 'stone-3')
  glass(g, 29, top + 7, 38, 39, c, seed)
  for (let x = 37; x < 67; x += 9) g.vline(x, top + 7, top + 45, 'stone-3')
  g.hline(29, 66, top + 20, 'stone-3')
  g.rect(22, top + 32, 52, 3, 'ink-2')
  g.hline(22, 73, top + 32, 'stone-2')
  for (let i = 0; i < 3; i++) g.rect(30 - i * 2, 58 + i * 2 - 4, 36 + i * 4, 2, i % 2 ? 'stone-2' : 'stone-1')
  sides(g, 0, top, 63, W)
  if (o.snow && c.season === 'winter') icicles(g, 2, W - 3, top, seed)
}

/** 高樓（4×6）：頂上的天線與停機坪的框、整面玻璃、中段退縮、一樓大廳 */
export function highrise(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const snow = o.snow && c.season === 'winter'
  // 頂：退縮的頂層
  g.vline(31, 0, 6, 'stone-3')
  g.px(31, 0, isLate(c) ? 'lamp-3' : 'shu-1')
  flatRoof(g, 12, 5, 40, 9, c, o, seed, false)
  g.rect(12, 14, 40, 20, 'stone-3')
  for (let x = 14; x < 50; x += 6) glass(g, x, 15, 5, 18, c, seed + x, 'sky-day-3')
  g.vline(12, 14, 33, 'ink-2')
  g.vline(51, 14, 33, 'ink-2')
  // 中段以下：寬的主體
  flatRoof(g, 2, 32, 60, 5, c, o, seed + 1, false)
  g.rect(3, 37, 58, 50, 'stone-2')
  for (let f = 0; f < 5; f++)
    for (let x = 5; x < 59; x += 6) {
      const y = 38 + f * 9
      glass(g, x, y, 5, 7, c, seed + f * 31 + x, f % 2 ? 'sky-day-2' : 'sky-day-3')
    }
  for (let f = 0; f < 5; f++) g.hline(3, 60, 45 + f * 9, 'stone-1')
  // 一樓
  g.rect(3, 84, 58, 9, 'stone-1')
  g.rect(22, 85, 20, 8, 'stone-3')
  g.rect(23, 86, 18, 7, isLate(c) ? 'lamp-1' : 'sky-day-2')
  g.vline(32, 86, 92, 'stone-3')
  g.vline(2, 32, 95, 'ink-2')
  g.vline(61, 32, 95, 'ink-2')
  g.vline(60, 37, 92, 'stone-3')
  g.rect(2, 93, 60, 3, 'stone-2')
  g.hline(2, 61, 95, 'stone-4')
  if (snow) icicles(g, 4, 59, 37, seed)
}

/** 大螢幕的大樓（十字路口）：深色的外牆、大螢幕（白天是亮的色塊、夜裡是霓虹的顏色）、小的廣告板 */
export function screenBuilding(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const W = 64
  const top = flatRoof(g, 0, 2, W, 10, c, o, seed)
  g.rect(1, top, W - 2, 61 - top, 'roof-3')
  g.dither(1, top, W - 2, 61 - top, 'roof-2', 4)
  const late = isLate(c)
  // 大螢幕
  g.rect(6, top + 3, 44, 24, 'ink')
  g.rect(7, top + 4, 42, 22, late ? 'cloth-2' : 'sky-day-1')
  const blocks: Px[] = late ? ['neon-1', 'neon-2', 'lamp-1', 'lamp-2'] : ['cloth-1', 'gold-1', 'white', 'shu-1']
  for (let i = 0; i < 6; i++) {
    const bx = 9 + (hash2(i, seed) % 28)
    const by = top + 6 + (hash2(seed, i) % 14)
    g.rect(bx, by, 6 + (i % 3) * 2, 3 + (i % 2) * 2, blocks[i % blocks.length]!)
  }
  g.hline(7, 48, top + 4, late ? 'neon-2' : 'white')
  signStack(g, 53, top + 2, 28, c, seed)
  // 一樓的店面
  shopGlass(g, 3, top + 32, 46, 61 - top - 33, c, seed)
  sides(g, 0, top, 63, W)
}

/** 商店街、市場的店面（2×2）：條紋遮陽篷、玻璃、台子上的東西 */
export function shopFront(g: Gfx, c: TileCtx, seed: number) {
  const late = isLate(c)
  g.rect(0, 2, 32, 4, 'ink-2')
  g.rect(1, 3, 30, 2, late ? 'neon-2' : 'paper')
  g.rect(4, 3, 10, 2, late ? 'lamp-1' : (['shu-1', 'cloth-1', 'leaf-2'] as const)[seed % 3]!)
  awning(g, 0, 6, 32, (['cloth-1', 'shu-1', 'leaf-2'] as const)[seed % 3]!, 'white', 'ink-2')
  shopGlass(g, 1, 13, 30, 15, c, seed)
  g.rect(0, 28, 32, 3, 'stone-2')
  g.hline(0, 31, 30, 'stone-4')
}

// ---------- 住宅 ----------
/** 二層的獨棟（灰瓦的寄棟屋頂、雨淋板的牆、兩層的窗、玄關） */
export function tiledHouse(g: Gfx, c: TileCtx, seed: number) {
  const night = isNight(c)
  tileRoof(g, 0, 4, 64, 26, GRAY_ROOF, { slope: 7 })
  g.rect(3, 30, 58, 31, 'paper')
  for (let y = 32; y < 60; y += 3) g.hline(3, 60, y, 'paper-2')
  g.vline(3, 30, 60, 'stone-3')
  g.vline(60, 30, 60, 'stone-3')
  g.hline(3, 60, 44, 'stone-2')
  windowPane(g, 8, 33, 14, 9, night, 'stone-3')
  windowPane(g, 42, 33, 14, 9, night, 'stone-3')
  windowPane(g, 8, 47, 16, 10, night, 'stone-3')
  // 玄關：門、小雨庇
  g.rect(37, 45, 14, 2, 'roof-2')
  g.rect(39, 47, 10, 14, 'wood-3')
  g.rect(40, 48, 8, 13, night ? 'lamp-2' : 'wood-2')
  g.px(46, 54, 'gold-1')
  g.rect(0, 61, 64, 3, 'stone-2')
  g.hline(0, 63, 63, 'stone-4')
  if (seed % 2) {
    // 門前的盆栽
    g.rect(28, 56, 4, 5, 'wood-2')
    g.rect(27, 52, 6, 4, 'leaf-3')
    g.px(28, 52, 'leaf-2')
  }
}

/** 平屋頂的獨棟（白的箱形、陽台、大窗、捲門的車庫） */
export function boxHouse(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const night = isNight(c)
  const top = flatRoof(g, 2, 8, 60, 10, c, o, seed, false)
  g.rect(3, top, 58, 61 - top, 'white')
  g.dither(3, top, 58, 61 - top, 'paper', 4)
  g.vline(3, top, 60, 'stone-3')
  g.vline(60, top, 60, 'stone-3')
  // 二樓：陽台
  glass(g, 8, top + 2, 22, 9, c, seed)
  g.rect(6, top + 9, 26, 3, 'stone-3')
  g.hline(6, 31, top + 9, 'stone-1')
  windowPane(g, 40, top + 2, 14, 9, night, 'stone-3')
  // 一樓：車庫的捲門、門
  g.rect(6, top + 20, 24, 61 - top - 20, 'stone-2')
  for (let y = top + 22; y < 60; y += 2) g.hline(6, 29, y, 'stone-3')
  g.rect(40, top + 18, 12, 61 - top - 18, 'wood-3')
  g.rect(41, top + 19, 10, 61 - top - 19, night ? 'lamp-2' : 'wood-2')
  g.rect(0, 61, 64, 3, 'stone-2')
  g.hline(0, 63, 63, 'stone-4')
  if (o.snow && c.season === 'winter') icicles(g, 4, 59, top, seed)
}

/** 平房（3×3）：灰瓦或平屋頂的小房子 */
export function smallHouse(g: Gfx, c: TileCtx, o: UrbanOpts, flat: boolean, seed: number) {
  const night = isNight(c)
  let top: number
  if (flat) top = flatRoof(g, 1, 4, 46, 10, c, o, seed, false)
  else {
    tileRoof(g, 0, 2, 48, 18, GRAY_ROOF, { slope: 4 })
    if (o.snow && c.season === 'winter') thickSnow(g, 5, 3, 38, 4, seed)
    top = 20
  }
  g.rect(2, top, 44, 45 - top, flat ? 'paper' : 'sand-1')
  for (let y = top + 2; y < 44; y += 3) g.hline(2, 45, y, flat ? 'paper-2' : 'sand-2')
  g.vline(2, top, 44, 'stone-3')
  g.vline(45, top, 44, 'stone-3')
  windowPane(g, 6, top + 4, 14, 9, night, 'stone-3')
  g.rect(28, top + 3, 12, 45 - top - 3, 'wood-3')
  g.rect(29, top + 4, 10, 45 - top - 4, night ? 'lamp-2' : 'wood-2')
  g.px(37, top + 12, 'gold-1')
  g.rect(0, 45, 48, 3, 'stone-2')
  g.hline(0, 47, 47, 'stone-4')
}

// ---------- 車站、店 ----------
/** 高架的車站（8×4）：月台的長屋頂、高架的橋樑、玻璃的站房、站名牌（不寫字）、玻璃門 */
export function elevatedStation(g: Gfx, c: TileCtx, o: UrbanOpts) {
  const late = isLate(c)
  const snow = o.snow && c.season === 'winter'
  // 月台的屋頂（長、平緩）
  g.rect(2, 2, 124, 9, 'ink-2')
  g.rect(3, 3, 122, 6, snow ? 'snow-1' : 'roof-1')
  if (!snow) for (let x = 6; x < 124; x += 6) g.vline(x, 3, 8, 'roof-2')
  g.hline(3, 124, 3, snow ? 'white' : 'stone-1')
  // 月台與高架（混凝土的大樑、欄杆）
  g.rect(0, 11, 128, 3, 'stone-1')
  g.rect(0, 14, 128, 8, 'stone-2')
  g.hline(0, 127, 14, 'stone-1')
  g.hline(0, 127, 21, 'stone-3')
  for (let x = 4; x < 128; x += 8) g.vline(x, 11, 13, 'stone-3')
  // 站房
  g.rect(2, 22, 124, 39, 'paper')
  g.dither(2, 22, 124, 3, 'paper-2', 8)
  for (const x of [6, 26, 90, 110]) {
    g.rect(x - 1, 27, 14, 26, 'stone-3')
    glass(g, x, 28, 12, 24, c, x)
  }
  // 站名牌（色帶、細線代表字）
  g.rect(40, 24, 48, 9, 'cloth-2')
  g.frame(40, 24, 48, 9, 'ink-2')
  for (let x = 44; x < 84; x += 6) g.hline(x, x + 3, 28, 'white')
  if (late) g.dither(41, 25, 46, 7, 'lamp-1', 2)
  // 玻璃門
  g.rect(46, 38, 36, 23, 'stone-3')
  g.rect(48, 40, 32, 21, late ? 'lamp-1' : 'sky-day-2')
  g.vline(63, 40, 60, 'stone-3')
  g.vline(64, 40, 60, 'stone-3')
  if (!late) g.dither(48, 52, 32, 8, 'sky-day-1', 8)
  g.rect(40, 35, 48, 3, 'ink-2')
  for (const x of [2, 38, 89, 125]) g.rect(x, 22, 2, 39, 'stone-3')
  g.rect(0, 61, 128, 3, 'stone-2')
  g.hline(0, 127, 63, 'stone-4')
  if (snow) icicles(g, 2, 125, 11, 5)
}

/** 定食屋（5×4）：二樓的窗、瓦的小屋簷、招牌（色塊）、白暖簾、食物樣品的櫥窗 */
export function eatery(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const late = isLate(c)
  const top = flatRoof(g, 0, 4, 80, 10, c, o, seed, false)
  g.rect(1, top, 78, 47 - top, 'sand-1')
  g.dither(1, top, 78, 47 - top, 'sand-2', 4)
  windowPane(g, 8, top + 3, 18, 9, isNight(c), 'stone-3')
  windowPane(g, 54, top + 3, 18, 9, isNight(c), 'stone-3')
  // 招牌（色塊）
  g.rect(28, top + 2, 24, 11, 'ink-2')
  g.rect(29, top + 3, 22, 9, 'paper')
  for (let x = 32; x < 48; x += 5) g.rect(x, top + 5, 3, 5, 'ink-2')
  tileRoof(g, 0, 31, 80, 9, GRAY_ROOF, { ridge: false, rows: 3 })
  if (o.snow && c.season === 'winter') thickSnow(g, 2, 30, 76, 3, seed)
  g.rect(1, 40, 78, 21, 'wood-2')
  for (let x = 3; x < 78; x += 4) g.vline(x, 40, 60, 'wood-3')
  // 櫥窗：食物樣品（一盤一盤的色塊）
  g.rect(5, 44, 22, 14, 'stone-3')
  g.rect(6, 45, 20, 12, late ? 'lamp-1' : 'paper')
  for (const [x, y, k] of [[8, 47, 'gold-1'], [14, 47, 'shu-1'], [20, 47, 'leaf-2'], [8, 52, 'momiji-1'], [14, 52, 'white'], [20, 52, 'sand-2']] as const) {
    g.rect(x, y + 2, 5, 1, 'white')
    g.rect(x + 1, y, 3, 2, k)
  }
  g.rect(30, 41, 20, 20, 'wood-3')
  g.rect(31, 42, 18, 19, late ? 'lamp-1' : 'ink-2')
  noren(g, 29, 41, 22, 10, 'white', 'stone-2', 'cloth-2')
  windowPane(g, 54, 44, 20, 12, isNight(c), 'wood-3')
  g.rect(0, 61, 80, 3, 'stone-2')
  g.hline(0, 79, 63, 'stone-4')
}

/** 旅館（6×4，都市的）：三層、灰瓦、白牆與木格子的帶、深藍暖簾、門前的燈 */
export function cityInn(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const late = isLate(c)
  const night = isNight(c)
  tileRoof(g, 0, 0, 96, 14, GRAY_ROOF, { slope: 4 })
  if (o.snow && c.season === 'winter') thickSnow(g, 5, 1, 86, 4, seed)
  g.rect(2, 14, 92, 47, 'paper')
  for (let f = 0; f < 2; f++) {
    const y = 16 + f * 12
    g.rect(2, y + 9, 92, 2, 'wood-3')
    for (let x = 6; x < 90; x += 14) {
      g.rect(x, y, 10, 8, 'wood-3')
      g.rect(x + 1, y + 1, 8, 6, night || litAt(c, x, y, seed) ? 'lamp-1' : 'white')
      for (let xx = x + 3; xx < x + 9; xx += 3) g.vline(xx, y + 1, y + 6, 'wood-2')
    }
  }
  tileRoof(g, 0, 39, 96, 6, GRAY_ROOF, { ridge: false, rows: 3 })
  g.rect(2, 45, 92, 16, 'wood-2')
  for (let x = 4; x < 92; x += 3) g.vline(x, 45, 60, 'wood-3')
  g.rect(36, 44, 24, 17, 'wood-3')
  g.rect(37, 45, 22, 16, late ? 'lamp-1' : 'ink-2')
  noren(g, 35, 44, 26, 9, 'cloth-2', 'roof-3')
  for (const x of [29, 64]) {
    g.rect(x, 47, 3, 6, late ? 'lamp-1' : 'white')
    g.hline(x, x + 2, 46, 'ink-2')
    g.hline(x, x + 2, 53, 'ink-2')
  }
  g.rect(0, 61, 96, 3, 'stone-2')
  g.hline(0, 95, 63, 'stone-4')
}

/** 看板建築的老舖（5×4）：平的正面、上緣的線腳、銅板的綠（礁湖色）、看板（色塊）、暖簾 */
export function kanbanShop(g: Gfx, c: TileCtx, o: UrbanOpts, seed: number) {
  const late = isLate(c)
  g.rect(2, 2, 76, 4, 'ink-2')
  g.rect(3, 3, 74, 2, 'stone-1')
  if (o.snow && c.season === 'winter') thickSnow(g, 2, 0, 76, 3, seed)
  g.rect(2, 6, 76, 38, 'lagoon-2')
  g.dither(2, 6, 76, 38, 'leaf-3', 3)
  // 銅板的接縫（菱形的格子）
  for (let y = 8; y < 42; y += 6) for (let x = 4 + ((y / 6) % 2) * 3; x < 76; x += 6) g.px(x, y, 'lagoon-1')
  g.hline(2, 77, 6, 'lagoon-1')
  // 看板
  g.rect(16, 10, 48, 12, 'ink-2')
  g.rect(17, 11, 46, 10, 'wood-1')
  for (let x = 22; x < 58; x += 9) g.rect(x, 13, 6, 6, 'ink-2')
  windowPane(g, 8, 26, 16, 12, isNight(c), 'stone-3')
  windowPane(g, 56, 26, 16, 12, isNight(c), 'stone-3')
  g.rect(28, 26, 24, 12, 'lagoon-1')
  g.frame(28, 26, 24, 12, 'leaf-3')
  // 一樓：店面
  g.rect(2, 44, 76, 3, 'ink-2')
  g.rect(2, 47, 76, 14, 'wood-3')
  shopGlass(g, 4, 48, 22, 13, c, seed)
  shopGlass(g, 54, 48, 22, 13, c, seed + 1)
  g.rect(30, 47, 20, 14, late ? 'lamp-1' : 'ink-2')
  noren(g, 28, 46, 24, 9, 'roof-3', 'ink', 'paper')
  g.vline(2, 2, 61, 'ink-2')
  g.vline(77, 2, 61, 'ink-2')
  g.rect(0, 61, 80, 3, 'stone-2')
  g.hline(0, 79, 63, 'stone-4')
}

// ---------- 地標 ----------
/** 教堂（4×5）：前面的尖塔（十字）、陡的石板屋頂、白牆、圓窗、拱形的窗與門 */
export function church(g: Gfx, c: TileCtx, o: UrbanOpts) {
  const late = isLate(c)
  const snow = o.snow && c.season === 'winter'
  // 後面的本體：陡的屋頂
  g.poly([2, 46, 14, 22, 50, 22, 62, 46], 'ink-2')
  g.poly([4, 45, 15, 24, 49, 24, 60, 45], 'roof-2')
  for (let y = 27; y < 45; y += 4) g.hline(6 + Math.round((45 - y) * 0.45), 58 - Math.round((45 - y) * 0.45), y, 'roof-1')
  if (snow) {
    g.poly([6, 44, 16, 25, 48, 25, 58, 44], 'snow-1')
    g.hline(16, 47, 25, 'white')
    for (let y = 30; y < 44; y += 5) g.hline(10 + Math.round((44 - y) * 0.4), 54 - Math.round((44 - y) * 0.4), y, 'snow-2')
  }
  g.rect(4, 46, 56, 31, 'white')
  g.dither(4, 46, 56, 3, 'paper', 8)
  g.vline(4, 46, 76, 'stone-3')
  g.vline(59, 46, 76, 'stone-3')
  for (const x of [8, 46]) {
    // 拱形的窗
    g.rect(x, 54, 8, 14, 'stone-3')
    g.rect(x + 1, 55, 6, 13, late ? 'lamp-1' : 'cloth-1')
    g.px(x, 54, 'white')
    g.px(x + 7, 54, 'white')
    g.vline(x + 3, 56, 67, late ? 'lamp-2' : 'sky-day-2')
  }
  // 前面的塔：尖頂、十字、圓窗、拱門
  g.rect(31, 0, 2, 7, 'gold-2')
  g.rect(29, 2, 6, 2, 'gold-2')
  g.px(31, 0, 'gold-1')
  g.poly([22, 22, 32, 6, 42, 22], 'ink-2')
  g.poly([24, 21, 32, 8, 40, 21], 'roof-2')
  g.line(32, 8, 25, 21, 'roof-1')
  if (snow) {
    g.poly([26, 20, 32, 11, 36, 20], 'snow-1')
    g.px(32, 11, 'white')
  }
  g.rect(22, 22, 20, 55, 'white')
  g.vline(22, 22, 76, 'stone-3')
  g.vline(41, 22, 76, 'stone-3')
  g.vline(40, 23, 76, 'paper-2')
  g.ring(32, 36, 5, 'stone-3')
  g.circle(32, 36, 4, late ? 'lamp-1' : 'cloth-1')
  g.px(32, 36, late ? 'lamp-2' : 'gold-1')
  g.rect(27, 50, 10, 4, 'stone-3')
  g.rect(26, 54, 12, 23, 'wood-3')
  g.rect(27, 55, 10, 22, late ? 'lamp-2' : 'wood-2')
  g.vline(32, 55, 76, 'wood-3')
  g.hline(27, 36, 52, 'stone-2')
  g.rect(0, 77, 64, 3, 'stone-2')
  g.hline(0, 63, 79, 'stone-4')
}

/** 鐵塔（3×7）：紅白相間的格子塔、上下兩層展望台、天線（夜裡航空燈亮）、腳下的大樓 */
export function latticeTower(g: Gfx, c: TileCtx, o: UrbanOpts) {
  const late = isLate(c)
  const snow = o.snow && c.season === 'winter'
  const band = (y: number): Px => (Math.floor(y / 8) % 2 ? 'white' : 'shu-1')
  // 天線
  for (let y = 1; y < 20; y++) g.hline(23, 24, y, band(y))
  g.px(23, 0, late ? 'lamp-3' : 'shu-2')
  g.px(24, 0, late ? 'lamp-3' : 'shu-2')
  // 塔身（從上到下變寬）：外框、內部的斜撐
  const half = (y: number) => (y < 34 ? 2 + (y - 20) * 0.12 : y < 58 ? 4 + (y - 42) * 0.12 : y < 70 ? 7 : 7 + (y - 70) * 0.62)
  for (let y = 20; y < 100; y++) {
    if ((y >= 34 && y < 42) || (y >= 58 && y < 70)) continue
    const h = Math.round(half(y))
    const l = 24 - h
    const r = 23 + h
    g.hline(l, l + 1, y, band(y))
    g.hline(r - 1, r, y, band(y))
    if (y >= 70) {
      // 腳：中間是拱（下半部空的）
      const inner = Math.max(0, Math.round((y - 76) * 0.45))
      if (inner > 0 && r - l > inner * 2 + 6) {
        g.hline(l + 2, 24 - inner - 1, y, (y + l) % 4 ? null : 'shu-2')
        g.hline(23 + inner + 1, r - 2, y, (y + r) % 4 ? null : 'shu-2')
      } else g.hline(l + 2, r - 2, y, (y % 4) < 2 ? 'shu-2' : null)
    } else {
      // 斜撐（交叉的線）
      for (let x = l + 2; x <= r - 2; x++) if ((x + y) % 6 === 0 || (x - y + 600) % 6 === 0) g.px(x, y, Math.floor(y / 8) % 2 ? 'stone-1' : 'shu-2')
    }
  }
  // 上面的展望台
  g.rect(17, 34, 14, 8, 'ink-2')
  g.rect(18, 35, 12, 6, 'white')
  g.rect(18, 37, 12, 2, late ? 'lamp-1' : 'sky-day-2')
  if (snow) thickSnow(g, 17, 33, 14, 2, 1)
  // 大展望台（兩層）
  g.rect(12, 58, 24, 12, 'ink-2')
  g.rect(13, 59, 22, 10, 'white')
  g.rect(13, 60, 22, 3, late ? 'lamp-1' : 'sky-day-2')
  g.rect(13, 65, 22, 3, late ? 'lamp-1' : 'sky-day-2')
  for (let x = 16; x < 34; x += 4) {
    g.vline(x, 60, 62, 'stone-2')
    g.vline(x, 65, 67, 'stone-2')
  }
  if (snow) thickSnow(g, 12, 57, 24, 2, 2)
  if (late) {
    g.px(17, 58, 'lamp-3')
    g.px(30, 58, 'lamp-3')
  }
  // 腳下的大樓
  g.rect(3, 96, 42, 13, 'ink-2')
  g.rect(4, 97, 40, 11, 'paper')
  for (let x = 6; x < 42; x += 5) glass(g, x, 99, 3, 4, c, x + 7)
  g.rect(19, 103, 10, 5, late ? 'lamp-1' : 'stone-3')
  g.rect(2, 108, 44, 4, 'stone-2')
  g.hline(2, 45, 111, 'stone-4')
}

/** 細長的塔（3×7）：白的塔身、兩個展望台（玻璃的環）、天線、腳下的大樓 */
export function slenderTower(g: Gfx, c: TileCtx, o: UrbanOpts) {
  const late = isLate(c)
  const snow = o.snow && c.season === 'winter'
  g.vline(23, 0, 22, 'stone-2')
  g.vline(24, 0, 22, 'stone-3')
  g.px(23, 0, late ? 'lamp-3' : 'shu-1')
  for (let y = 22; y < 100; y++) {
    const h = Math.round(2 + (y - 22) * 0.06 + (y > 84 ? (y - 84) * 0.35 : 0))
    g.hline(24 - h, 23 + h, y, 'stone-1')
    g.px(24 - h, y, 'white')
    g.px(23 + h, y, 'stone-3')
    if (h > 3) g.px(22 + h, y, 'stone-2')
  }
  // 上面的展望台
  g.rect(18, 26, 12, 7, 'ink-2')
  g.rect(19, 27, 10, 5, late ? 'lamp-1' : 'sky-day-3')
  g.hline(19, 28, 27, 'white')
  // 大展望台
  g.rect(13, 58, 22, 12, 'ink-2')
  g.rect(14, 59, 20, 10, 'stone-1')
  g.rect(14, 61, 20, 6, late ? 'lamp-1' : 'sky-day-2')
  for (let x = 17; x < 33; x += 4) g.vline(x, 61, 66, 'stone-2')
  if (snow) {
    thickSnow(g, 18, 25, 12, 2, 3)
    thickSnow(g, 13, 57, 22, 2, 4)
  }
  if (late) for (const y of [40, 80]) g.px(23, y, 'lamp-3')
  g.rect(3, 96, 42, 13, 'ink-2')
  g.rect(4, 97, 40, 11, 'paper')
  for (let x = 6; x < 42; x += 5) glass(g, x, 99, 3, 4, c, x + 3)
  g.rect(19, 103, 10, 5, late ? 'lamp-1' : 'stone-3')
  g.rect(2, 108, 44, 4, 'stone-2')
  g.hline(2, 45, 111, 'stone-4')
}

/** 電線桿（1×2）：混凝土的桿子、橫擔與礙子、變壓器 */
export function utilityPole(g: Gfx, c: TileCtx, o: UrbanOpts) {
  shadow(g, 8, 30, 4, 1)
  g.rect(7, 3, 3, 28, 'stone-2')
  g.vline(7, 3, 30, 'stone-1')
  g.vline(9, 3, 30, 'stone-3')
  g.rect(2, 6, 13, 2, 'stone-3')
  for (const x of [3, 8, 13]) g.px(x, 5, 'white')
  g.rect(10, 10, 4, 6, 'stone-2')
  g.vline(13, 10, 15, 'stone-3')
  g.hline(10, 13, 10, 'stone-1')
  // 電線往兩邊（短短一段垂下）
  g.line(0, 9, 3, 6, 'ink-2')
  g.line(13, 6, 15, 9, 'ink-2')
  if (o.snow && c.season === 'winter') {
    g.hline(2, 14, 5, 'snow-1')
    g.hline(10, 13, 9, 'snow-1')
  }
}

/** 紅綠燈（1×2）：桿子＋橫的燈箱（綠、黃、紅，亮的是綠）；北海道是直的燈箱（雪不積在上面） */
export function trafficSignal(g: Gfx, c: TileCtx, vertical: boolean) {
  const late = isLate(c)
  shadow(g, 8, 30, 3, 1)
  g.rect(7, 6, 2, 25, 'stone-3')
  g.vline(7, 6, 30, 'stone-2')
  if (vertical) {
    g.rect(9, 1, 6, 16, 'ink-2')
    g.rect(10, 2, 4, 14, 'roof-3')
    for (const [y, on] of [[3, false], [8, false], [13, true]] as const) {
      g.rect(10, y, 4, 3, on ? (late ? 'neon-2' : 'leaf-1') : 'stone-4')
      if (on && !late) g.px(10, y, 'white')
    }
    g.hline(8, 9, 8, 'stone-3')
    if (c.season === 'winter') g.hline(9, 14, 0, 'snow-1')
  } else {
    g.rect(1, 2, 14, 7, 'ink-2')
    g.rect(2, 3, 12, 5, 'roof-3')
    for (const [x, on] of [[3, true], [7, false], [11, false]] as const) {
      g.rect(x, 4, 3, 3, on ? (late ? 'neon-2' : 'leaf-1') : 'stone-4')
      if (on && !late) g.px(x, 4, 'white')
    }
    g.hline(1, 14, 1, 'ink-2')
  }
  // 行人用的小燈箱
  g.rect(3, 13, 4, 6, 'ink-2')
  g.rect(4, 14, 2, 2, late ? 'neon-2' : 'leaf-2')
  g.rect(4, 16, 2, 2, 'stone-4')
}

/** 自動販賣機（1×1）：機身、陳列窗（一排一排的罐子色塊）、取物口；夜裡陳列窗亮 */
export function vending(g: Gfx, c: TileCtx, body: Px, shade: Px) {
  const late = isLate(c)
  shadow(g, 8, 15, 7, 1)
  g.rect(2, 0, 12, 16, 'ink-2')
  g.rect(3, 1, 10, 14, body)
  g.vline(12, 1, 14, shade)
  g.rect(4, 2, 8, 7, late ? 'lamp-1' : 'paper')
  const cans: Px[] = ['shu-1', 'cloth-1', 'gold-1', 'leaf-2', 'momiji-1', 'white']
  for (let i = 0; i < 4; i++) {
    g.rect(4 + i * 2, 3, 1, 2, cans[i]!)
    g.rect(4 + i * 2, 6, 1, 2, cans[(i + 2) % cans.length]!)
  }
  g.rect(4, 10, 4, 1, 'stone-3')
  g.px(10, 10, 'gold-2')
  g.rect(4, 12, 8, 2, 'ink-2')
}

/** 郵筒（1×1）：紅的方形郵筒 */
export function postbox(g: Gfx) {
  shadow(g, 8, 15, 5, 1)
  g.rect(4, 2, 8, 12, 'ink-2')
  g.rect(5, 3, 6, 10, 'shu-1')
  g.vline(10, 3, 12, 'shu-2')
  g.hline(5, 10, 3, 'momiji-1')
  g.rect(6, 5, 4, 1, 'ink-2')
  g.rect(6, 8, 4, 2, 'white')
  g.rect(7, 14, 2, 2, 'stone-3')
}

/** 停著的腳踏車（1×1，兩台） */
export function bicycles(g: Gfx) {
  shadow(g, 8, 14, 7, 1)
  for (const [x, y, k] of [[1, 6, 'shu-1'], [5, 9, 'cloth-1']] as const) {
    g.ring(x + 2, y + 4, 2, 'ink-2')
    g.ring(x + 8, y + 4, 2, 'ink-2')
    g.line(x + 2, y + 4, x + 5, y + 1, k)
    g.line(x + 5, y + 1, x + 8, y + 4, k)
    g.line(x + 5, y + 1, x + 4, y + 4, k)
    g.hline(x + 4, x + 6, y, 'ink-2')
    g.px(x + 8, y, 'stone-3')
  }
}

/** 路燈（1×2）：彎的桿子、燈罩；黃昏、夜裡亮（地上一圈光） */
export function streetLamp(g: Gfx, c: TileCtx, gas: boolean) {
  const late = isLate(c)
  shadow(g, 8, 30, 3, 1)
  if (late) g.dither(3, 26, 10, 5, 'lamp-2', 3)
  if (gas) {
    // 煤氣燈的樣子（運河邊、紅磚倉庫）：黑的鐵柱、四角的燈箱
    g.rect(7, 10, 2, 21, 'ink-2')
    g.rect(6, 26, 4, 5, 'ink-2')
    g.rect(5, 2, 6, 8, 'ink-2')
    g.rect(6, 3, 4, 6, late ? 'lamp-1' : 'paper')
    g.poly([4, 3, 8, 0, 12, 3], 'ink-2')
    if (c.season === 'winter') g.hline(5, 11, 1, 'snow-1')
    return
  }
  g.rect(7, 4, 2, 27, 'stone-3')
  g.vline(7, 4, 30, 'stone-2')
  g.hline(8, 12, 3, 'stone-3')
  g.rect(10, 4, 4, 2, 'stone-4')
  g.rect(10, 6, 4, 1, late ? 'lamp-1' : 'stone-1')
}
