import type { SpriteSize } from './types'

/**
 * 紙娃娃（240×320 的畫布，腳底 y 280）→ 像素畫布的對應，與 chibi 變形（規格 §7）：
 * 頭以脖子為中心放大 kh 倍、身體寬 ×kbx、高 ×kb（腳底不動）。手上的東西跟著手、縮放取身體兩個比例的平均。
 */
export interface Chibi {
  kh: number
  kb: number
  kbx: number
}
export const CHIBI: Chibi = { kh: 1.2, kb: 0.72, kbx: 0.92 }

/** 遊戲裡的旅人：本體 20×28（含外框），每格畫布 32×40 */
export const GAME_SIZE: SpriteSize = { w: 20, h: 28, cw: 32, ch: 40 }
/** /about 像素散步：本體 16×24（跟 pixelwalk/hero.ts 一樣大），畫布 24×34（帽子可以超出） */
export const ABOUT_SIZE: SpriteSize = { w: 16, h: 24, cw: 24, ch: 34 }

/** 紙娃娃的固定座標：脖子（頭的旋轉中心）、頭頂（標準髮型的最高點）、腳底、右手 */
export const DOLL = { cx: 120, feet: 280, neck: 156, hairTop: 38, hand: [156, 222] as const, neckLen: 124, handDrop: 58, handX: 36 }

export interface Geom {
  c: Chibi
  /** 變形後脖子的 y */
  neckY: number
  /** 變形後頭頂的 y */
  top: number
  /** SVG 的 transform：身體、頭、手上的東西 */
  body: string
  head: string
  hand: string
  /** 紙娃娃座標 → 變形後 */
  mapHead(x: number, y: number): [number, number]
  mapBody(x: number, y: number): [number, number]
}

export function geom(c: Chibi): Geom {
  const neckY = DOLL.feet - DOLL.neckLen * c.kb
  const hx = DOLL.cx + DOLL.handX * c.kbx
  const hy = DOLL.feet - DOLL.handDrop * c.kb
  const hk = (c.kb + c.kbx) / 2
  return {
    c,
    neckY,
    top: neckY - (DOLL.neck - DOLL.hairTop) * c.kh,
    body: `translate(${DOLL.cx} ${DOLL.feet}) scale(${c.kbx} ${c.kb}) translate(${-DOLL.cx} ${-DOLL.feet})`,
    head: `translate(${DOLL.cx} ${neckY}) scale(${c.kh}) translate(${-DOLL.cx} ${-DOLL.neck})`,
    hand: `translate(${hx} ${hy}) scale(${hk}) translate(${-DOLL.hand[0]} ${-DOLL.hand[1]})`,
    mapHead: (x, y) => [DOLL.cx + (x - DOLL.cx) * c.kh, neckY + (y - DOLL.neck) * c.kh],
    mapBody: (x, y) => [DOLL.cx + (x - DOLL.cx) * c.kbx, DOLL.feet - (DOLL.feet - y) * c.kb],
  }
}

/**
 * 一格畫布對應到紙娃娃的哪一塊：本體高 h（含外框）= 頭頂到腳底再加上下各 1px 的外框，
 * 腳底對齊倒數第 2 列（最下面一列是外框），左右置中。
 */
export interface Frame {
  size: SpriteSize
  g: Geom
  /** 每個紙娃娃 px 是幾個像素 */
  s: number
  /** 畫布左上角在紙娃娃座標的哪裡、畫布涵蓋多大（紙娃娃 px） */
  x0: number
  y0: number
  vw: number
  vh: number
  /** 本體在畫布裡的位置（含外框）：x, y, w, h */
  box: [number, number, number, number]
}

export function frame(size: SpriteSize, c: Chibi = CHIBI): Frame {
  const g = geom(c)
  const s = (size.h - 2) / (DOLL.feet - g.top)
  const x0 = DOLL.cx - size.cw / 2 / s
  const y0 = DOLL.feet - (size.ch - 1) / s
  return { size, g, s, x0, y0, vw: size.cw / s, vh: size.ch / s, box: [Math.round((size.cw - size.w) / 2), size.ch - size.h, size.w, size.h] }
}

/** 紙娃娃座標（已變形）→ 畫布的像素 */
export const toPx = (fr: Frame, x: number, y: number): [number, number] => [(x - fr.x0) * fr.s, (y - fr.y0) * fr.s]

/** 腿從哪一列開始（身體的 dollY 處，預設下襬 250；側面用 252） */
export function legTop(fr: Frame, dollY = 250): number {
  return Math.round(toPx(fr, 0, fr.g.mapBody(0, dollY)[1])[1])
}

/** 夥伴的畫布：圖示範圍（outfit.icon 的 x y w h）縮成旅人比例的 mult 倍，最大 maxPx（含外框）；不做 chibi 變形 */
export interface BuddyFrame {
  w: number
  h: number
  s: number
  x0: number
  y0: number
  vw: number
  vh: number
}
export function buddyFrame(icon: string, travellerScale: number, mult = 1.5, maxPx = 16): BuddyFrame {
  const [bx = 0, by = 0, bw = 80, bh = 80] = icon.split(/\s+/).map(Number)
  const s = Math.min(travellerScale * mult, (maxPx - 2) / Math.max(bw, bh))
  // 浮點的誤差（14.0000001）不要多算一格
  const w = Math.ceil(bw * s - 1e-6) + 2
  const h = Math.ceil(bh * s - 1e-6) + 2
  return { w, h, s, x0: bx - 1 / s, y0: by - 1 / s, vw: w / s, vh: h / s }
}
