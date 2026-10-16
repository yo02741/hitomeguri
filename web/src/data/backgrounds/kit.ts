import { C, E, line, SH, shape } from '../dollArt'
import type { Outfit } from '../outfits'

/**
 * 地區背景（DESIGN.md §7.24b）：旅人頁展示窗後面的風景，每個縣 3 張，去過那個縣之後加進扭蛋。
 * 畫布 300×400（BG_W × BG_H），展示窗用 preserveAspectRatio="xMidYMax slice" 鋪滿、貼齊下緣：
 * 桌機（直長）左右各裁掉約 27，手機（正方形）上面裁掉 100。要緊的東西放在 x 30–270、y 100–400。
 * 地平線（地面的上緣）在 y 320 上下（HORIZON），旅人的腳踩在地平線下面一點。旅人擋住中間 x 90–210、y 95–350，
 * 地標放兩側或遠景（從旅人身後露出來）。畫法同服裝：剪紙、平塗、不描黑邊、不用漸層；顏色只用 dollArt 的 C token，
 * 淡的顏色用 opacity 疊（天空 = 米色底＋一層淡藍）。不用 <defs>、id、<text>、<image>（一頁裡會同時出現很多張）。
 */
export const BG_W = 300
export const BG_H = 400
/** 地平線：地面的上緣（旅人的腳在 y≈330–350） */
export const HORIZON = 320

export { C, E, line, SH, shape }

type Def = Omit<Outfit, 'slot' | 'icon' | 'svg'> & { art: string }
/** 一張背景：畫好的內容包在自己的 300×400 svg 裡（不會超出去，衣櫃小圖、扭蛋、十連抽都直接用） */
export const bg = ({ art, ...o }: Def): Outfit => ({
  ...o,
  slot: 'bg',
  icon: `0 0 ${BG_W} ${BG_H}`,
  svg: `<svg x="0" y="0" width="${BG_W}" height="${BG_H}" viewBox="0 0 ${BG_W} ${BG_H}" overflow="hidden">${art}</svg>`,
})

type Pt = [number, number]
const n = (v: number) => +v.toFixed(1)

// ---------- 共用的零件（各區的檔案可以再寫自己的） ----------
/** 天空：整張先鋪底色，再疊一層淡色（tint 的 opacity 越低越淡；黃昏可以用 base = C.cream、tint = C.orange） */
export const sky = (tint: string = C.blue, op = 0.22, base: string = C.white) =>
  `<rect width="${BG_W}" height="${BG_H}" fill="${base}"/><rect width="${BG_W}" height="${BG_H}" fill="${tint}" opacity="${op}"/>`
/** 地面：從 y 鋪到底；op < 1 時先鋪一層米色（不會透出後面的天空） */
export const ground = (fill: string, y = HORIZON, op = 1, base: string = C.cream) =>
  (op < 1 ? `<rect y="${y}" width="${BG_W}" height="${BG_H - y}" fill="${base}"/>` : '') + `<rect y="${y}" width="${BG_W}" height="${BG_H - y}" fill="${fill}" opacity="${op}" ${E}/>`
/** 連綿的山、丘、樹林的輪廓：給一串點，底部封到 base；smooth 用圓弧連，否則是尖的稜線 */
export function ridge(pts: Pt[], fill: string, op = 1, base = HORIZON + 4, smooth = true): string {
  if (pts.length < 2) return ''
  let d = `M${n(pts[0][0])} ${base} L${n(pts[0][0])} ${n(pts[0][1])}`
  if (smooth) {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      d += ` Q${n(x0 + (x1 - x0) / 2)} ${n(Math.min(y0, y1) - Math.abs(x1 - x0) * 0.12)} ${n(x1)} ${n(y1)}`
    }
  } else for (const [x, y] of pts.slice(1)) d += ` L${n(x)} ${n(y)}`
  d += ` L${n(pts[pts.length - 1][0])} ${base}Z`
  return `<path d="${d}" fill="${fill}" opacity="${op}" ${E}/>`
}
/** 紙雲：幾個圓疊成一朵，下緣切平 */
export const cloud = (x: number, y: number, s = 1, op = 0.9, fill: string = C.white) =>
  `<path d="M${n(x - 22 * s)} ${n(y)} C${n(x - 26 * s)} ${n(y - 10 * s)} ${n(x - 14 * s)} ${n(y - 16 * s)} ${n(x - 7 * s)} ${n(y - 11 * s)} C${n(x - 4 * s)} ${n(y - 22 * s)} ${n(x + 12 * s)} ${n(y - 22 * s)} ${n(x + 14 * s)} ${n(y - 10 * s)} C${n(x + 22 * s)} ${n(y - 14 * s)} ${n(x + 28 * s)} ${n(y - 4 * s)} ${n(x + 24 * s)} ${n(y)}Z" fill="${fill}" opacity="${op}" ${E}/>`
/** 太陽、月亮：一個圓 */
export const sun = (x: number, y: number, r: number, fill: string = C.yellow, op = 0.85) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${op}" ${E}/>`
/** 圓頭的樹（闊葉樹、櫻、楓）：樹幹＋一團樹冠＋右下一層陰影 */
export const tree = (x: number, y: number, s = 1, fill: string = C.green, trunk: string = C.brown) =>
  `<path d="M${n(x - 2.4 * s)} ${n(y)} L${n(x - 1.6 * s)} ${n(y - 16 * s)} L${n(x + 1.6 * s)} ${n(y - 16 * s)} L${n(x + 2.4 * s)} ${n(y)}Z" fill="${trunk}"/>` +
  `<path d="M${n(x)} ${n(y - 40 * s)} C${n(x + 12 * s)} ${n(y - 40 * s)} ${n(x + 17 * s)} ${n(y - 30 * s)} ${n(x + 15 * s)} ${n(y - 22 * s)} C${n(x + 14 * s)} ${n(y - 14 * s)} ${n(x + 6 * s)} ${n(y - 12 * s)} ${n(x)} ${n(y - 13 * s)} C${n(x - 6 * s)} ${n(y - 12 * s)} ${n(x - 14 * s)} ${n(y - 14 * s)} ${n(x - 15 * s)} ${n(y - 22 * s)} C${n(x - 17 * s)} ${n(y - 30 * s)} ${n(x - 12 * s)} ${n(y - 40 * s)} ${n(x)} ${n(y - 40 * s)}Z" fill="${fill}" ${E}/>` +
  `<path d="M${n(x + 15 * s)} ${n(y - 22 * s)} C${n(x + 14 * s)} ${n(y - 14 * s)} ${n(x + 6 * s)} ${n(y - 12 * s)} ${n(x)} ${n(y - 13 * s)} C${n(x + 7 * s)} ${n(y - 17 * s)} ${n(x + 12 * s)} ${n(y - 22 * s)} ${n(x + 15 * s)} ${n(y - 22 * s)}Z" ${SH}/>`
/** 杉、松這類尖的樹：三層三角 */
export const cedar = (x: number, y: number, s = 1, fill: string = C.green, op = 1) =>
  `<g opacity="${op}"><path d="M${n(x - 1.6 * s)} ${n(y)} L${n(x - 1.6 * s)} ${n(y - 8 * s)} L${n(x + 1.6 * s)} ${n(y - 8 * s)} L${n(x + 1.6 * s)} ${n(y)}Z" fill="${C.brown}"/>` +
  `<path d="M${n(x)} ${n(y - 46 * s)} L${n(x + 8 * s)} ${n(y - 30 * s)} L${n(x + 5 * s)} ${n(y - 30 * s)} L${n(x + 12 * s)} ${n(y - 18 * s)} L${n(x + 8 * s)} ${n(y - 18 * s)} L${n(x + 15 * s)} ${n(y - 7 * s)} L${n(x - 15 * s)} ${n(y - 7 * s)} L${n(x - 8 * s)} ${n(y - 18 * s)} L${n(x - 12 * s)} ${n(y - 18 * s)} L${n(x - 5 * s)} ${n(y - 30 * s)} L${n(x - 8 * s)} ${n(y - 30 * s)}Z" fill="${fill}" ${E}/>` +
  `<path d="M${n(x)} ${n(y - 46 * s)} L${n(x + 8 * s)} ${n(y - 30 * s)} L${n(x + 5 * s)} ${n(y - 30 * s)} L${n(x + 12 * s)} ${n(y - 18 * s)} L${n(x + 8 * s)} ${n(y - 18 * s)} L${n(x + 15 * s)} ${n(y - 7 * s)} L${n(x)} ${n(y - 7 * s)}Z" ${SH}/></g>`
/** 水面的橫紋（波光）：幾條短白線 */
export const ripples = (pts: Pt[], w = 14, op = 0.55) => pts.map(([x, y]) => `<path d="M${n(x - w / 2)} ${n(y)} L${n(x + w / 2)} ${n(y)}" ${line(1.6, C.white, op)}/>`).join('')
/** 一排房子的剪影（屋頂高低不同）：從 x0 到 x1，地面在 y */
export function roofs(x0: number, x1: number, y: number, fill: string, op = 1, seed = 1): string {
  let d = `M${x0} ${y}`
  let x = x0
  let k = seed
  while (x < x1) {
    k = (k * 9301 + 49297) % 233280
    const w = 14 + (k % 12)
    const h = 12 + ((k >> 3) % 14)
    const nx = Math.min(x1, x + w)
    d += ` L${n(x)} ${n(y - h)} L${n((x + nx) / 2)} ${n(y - h - 7)} L${n(nx)} ${n(y - h)}`
    x = nx
  }
  return `<path d="${d} L${x1} ${y}Z" fill="${fill}" opacity="${op}" ${E}/>`
}
/** 鳥居（正面）：x 中心、y 柱腳、s 大小 */
export const torii = (x: number, y: number, s = 1, fill: string = C.red) =>
  shape(`M${n(x - 30 * s)} ${n(y - 62 * s)} Q${n(x)} ${n(y - 58 * s)} ${n(x + 30 * s)} ${n(y - 62 * s)} L${n(x + 28 * s)} ${n(y - 56 * s)} L${n(x - 28 * s)} ${n(y - 56 * s)}Z`, C.ink) +
  shape(`M${n(x - 26 * s)} ${n(y - 56 * s)} L${n(x + 26 * s)} ${n(y - 56 * s)} L${n(x + 25 * s)} ${n(y - 51 * s)} L${n(x - 25 * s)} ${n(y - 51 * s)}Z`, fill) +
  shape(`M${n(x - 22 * s)} ${n(y - 44 * s)} L${n(x + 22 * s)} ${n(y - 44 * s)} L${n(x + 22 * s)} ${n(y - 40 * s)} L${n(x - 22 * s)} ${n(y - 40 * s)}Z`, fill) +
  shape(`M${n(x - 18 * s)} ${n(y - 51 * s)} L${n(x - 14 * s)} ${n(y - 51 * s)} L${n(x - 13 * s)} ${n(y)} L${n(x - 19 * s)} ${n(y)}Z`, fill) +
  shape(`M${n(x + 14 * s)} ${n(y - 51 * s)} L${n(x + 18 * s)} ${n(y - 51 * s)} L${n(x + 19 * s)} ${n(y)} L${n(x + 13 * s)} ${n(y)}Z`, fill)
