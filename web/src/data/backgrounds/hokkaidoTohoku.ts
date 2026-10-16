import type { Outfit } from '../outfits'
import { bg, C, cedar, cloud, E, ground, line, ridge, roofs, SH, shape, sky, sun, tree } from './kit'

/**
 * 地區背景：北海道、青森、岩手、宮城。題材取自 data/spots（與 data/festivals）的景點，出處是那筆資料的 summary.source_url。
 */

// ---------- 共用的小工具 ----------
type Pt = [number, number]
type Pt3 = [number, number, number]
const r = (v: number) => Math.round(v * 10) / 10
const poly = (p: Pt[]) => `M${p.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L')}Z`
const box = (x: number, y: number, w: number, h: number) => `M${r(x)} ${r(y)} h${r(w)} v${r(h)} h${r(-w)}Z`
/** 帶紙邊的形狀（op < 1 時半透明） */
const P = (d: string, fill: string, op = 1) => shape(d, fill, op < 1 ? `opacity="${op}"` : '')
/** 不帶邊的平塗（遠景、倒影、光暈） */
const F = (d: string, fill: string, op = 1) => `<path d="${d}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`
const S = (d: string) => `<path d="${d}" ${SH}/>`
const L = (d: string, w: number, c: string, op = 1) => `<path d="${d}" ${line(w, c, op)}/>`
const dot = (x: number, y: number, rr: number, fill: string, op = 1) => `<circle cx="${r(x)}" cy="${r(y)}" r="${rr}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`
/** 帶紙邊的群組：裡面的 path 只寫 fill（Q），邊由群組給 */
const G = (s: string) => `<g ${E}>${s}</g>`
const Q = (d: string, fill: string) => `<path d="${d}" fill="${fill}"/>`
const INK = (d: string, w: number) => L(d, w, C.ink, 0.85)
const eyes = (pts: Pt[], rr: number) =>
  `<g fill="${C.yellow}" ${E}>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`).join('')}</g><g fill="${C.ink}">${pts.map(([x, y]) => `<circle cx="${x + (x % 2 ? 0 : 1)}" cy="${y}" r="${r(rr * 0.45)}"/>`).join('')}</g>`

/** 雪：一串小白點 */
const flakes = (pts: Pt[], rr = 1.6, op = 0.85) => `<g fill="${C.white}" opacity="${op}">${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`).join('')}</g>`

// ---------- 北海道 ----------
/** 札幌市時計台：正面的山牆（紅星）、上面的鐘樓，左邊往後的側面；雪蓋在紅屋頂上 */
function tokeidai(x: number, g: number): string {
  const w = 38
  const ew = g - 70
  const ap = g - 102
  // 側面（往左後方）
  let o = P(poly([[x - w, g], [x - w, ew], [x - w - 74, ew + 6], [x - w - 74, g]]), C.white)
  o += S(poly([[x - w, g], [x - w, ew], [x - w - 74, ew + 6], [x - w - 74, g]]))
  o += P(poly([[x - w - 4, ew + 2], [x - 2, ap - 6], [x - w - 72, ap + 2], [x - w - 80, ew + 9]]), C.white)
  o += F(poly([[x - w - 4, ew + 2], [x - w - 80, ew + 9], [x - w - 79, ew + 4], [x - w - 6, ew - 3]]), C.red)
  o += F(poly([[x - w - 6, ew - 3], [x - w - 79, ew + 4], [x - w - 74, ap + 8], [x - 8, ap + 4]]), C.blue, 0.1)
  // 鐘樓
  o += P(box(x - 16, ap - 40, 32, 50), C.white) + S(box(x + 8, ap - 40, 8, 50))
  o += `<circle cx="${x}" cy="${ap - 20}" r="11" fill="${C.white}" ${E}/>` + L(`M${x} ${ap - 20} L${x} ${ap - 28} M${x} ${ap - 20} L${x + 6} ${ap - 17}`, 1.6, C.ink)
  o += L(`M${x} ${ap - 20} m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0`, 1.4, C.ink, 0.5)
  o += P(box(x - 18, ap - 45, 36, 6), C.white)
  o += P(box(x - 12, ap - 66, 24, 21), C.white) + F(`M${x - 8} ${ap - 47} v-11 a3 3 0 0 1 6 0 v11Z M${x + 2} ${ap - 47} v-11 a3 3 0 0 1 6 0 v11Z`, C.navy, 0.5)
  o += P(box(x - 15, ap - 70, 30, 5), C.white)
  o += P(`M${x - 17} ${ap - 68} C${x - 8} ${ap - 74} ${x - 3} ${ap - 84} ${x} ${ap - 96} C${x + 3} ${ap - 84} ${x + 8} ${ap - 74} ${x + 17} ${ap - 68}Z`, C.red)
  o += F(`M${x - 13} ${ap - 71} C${x - 6} ${ap - 76} ${x - 2} ${ap - 84} ${x} ${ap - 93} C${x + 1} ${ap - 84} ${x + 4} ${ap - 76} ${x + 9} ${ap - 72}Z`, C.white, 0.9)
  o += L(`M${x} ${ap - 96} L${x} ${ap - 112}`, 1.4, C.ink, 0.8) + dot(x, ap - 103, 2, C.ink, 0.8)
  // 正面
  const front = poly([[x - w, g], [x - w, ew], [x, ap], [x + w, ew], [x + w, g]])
  o += P(front, C.white)
  let clap = ''
  for (let y = ew + 6; y < g - 2; y += 6) clap += `M${x - w} ${y} L${x + w} ${y} `
  o += L(clap, 0.8, C.ink, 0.1)
  // 屋簷：紅色的邊，上面積雪
  o += P(poly([[x - w - 7, ew + 3], [x, ap - 9], [x + w + 7, ew + 3], [x + w + 7, ew + 9], [x, ap - 2], [x - w - 7, ew + 9]]), C.red)
  o += P(poly([[x - w - 8, ew + 1], [x, ap - 13], [x + w + 8, ew + 1], [x + w + 6, ew + 4], [x, ap - 8], [x - w - 6, ew + 4]]), C.white)
  // 開拓使的紅星
  const st: Pt[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? 2.6 : 6.4
    st.push([x + rr * Math.cos(a), ap + 20 + rr * Math.sin(a)])
  }
  o += F(poly(st), C.red)
  // 窗：二樓三扇、一樓兩扇、中間的門廊與陽台
  let win = ''
  for (const dx of [-26, -5, 16]) win += box(x + dx, ew + 10, 10, 18) + ' '
  for (const dx of [-30, 20]) win += box(x + dx, ew + 42, 10, 19) + ' '
  for (const sx of [x - w - 64, x - w - 44, x - w - 24]) win += box(sx, ew + 14, 9, 16) + ' ' + box(sx, ew + 42, 9, 17) + ' '
  o += F(win, C.navy, 0.55)
  o += P(box(x - 14, ew + 34, 28, 6), C.white) + P(box(x - 12, ew + 40, 24, 30), C.white) + F(box(x - 6, ew + 46, 12, 24), C.navy, 0.45)
  o += L(`M${x - 14} ${ew + 34} L${x - 14} ${ew + 28} L${x + 14} ${ew + 28} L${x + 14} ${ew + 34} M${x - 8} ${ew + 28} L${x - 8} ${ew + 34} M${x - 2} ${ew + 28} L${x - 2} ${ew + 34} M${x + 4} ${ew + 28} L${x + 4} ${ew + 34} M${x + 10} ${ew + 28} L${x + 10} ${ew + 34}`, 1, C.ink, 0.45)
  return o
}
/** 積雪的針葉樹：杉的三層上各蓋一片雪 */
function snowFir(x: number, y: number, s: number): string {
  const sn = poly([[x, y - 46 * s], [x + 6 * s, y - 34 * s], [x + 2 * s, y - 32 * s], [x - 3 * s, y - 34 * s], [x - 6 * s, y - 33 * s]]) +
    poly([[x - 9 * s, y - 24 * s], [x - 2 * s, y - 28 * s], [x + 6 * s, y - 25 * s], [x + 10 * s, y - 21 * s], [x + 3 * s, y - 23 * s], [x - 4 * s, y - 21 * s]]) +
    poly([[x - 13 * s, y - 11 * s], [x - 4 * s, y - 15 * s], [x + 8 * s, y - 13 * s], [x + 14 * s, y - 9 * s], [x + 4 * s, y - 11 * s], [x - 6 * s, y - 9 * s]])
  return cedar(x, y, s, C.green) + F(sn, C.white, 0.95)
}

/** 一排防風林（細長的落葉松、白楊）：一條 path */
const firRow = (xs: number[], y: number, h: number, fill: string, op = 1) =>
  F(xs.map((x) => `M${x} ${y - h} C${x + 4} ${y - h * 0.6} ${x + 5} ${y - 4} ${x + 3} ${y} L${x - 3} ${y} C${x - 5} ${y - 4} ${x - 4} ${y - h * 0.6} ${x} ${y - h}Z`).join(' '), fill, op)
/** ファーム富田：斜坡上一條條平行的花帶。上緣是 (x0,a0)–(x1,a1) 的弧（(cx,cy) 控制點），每條帶在兩端的寬 [ha, hb] */
function bands(x0: number, a0: number, x1: number, a1: number, cx: number, cy: number, list: Array<[string, number, number]>): string {
  let o = ''
  let oa = 0
  let ob = 0
  for (const [fill, ha, hb] of list) {
    o += F(`M${x0} ${r(a0 + oa)} Q${cx} ${r(cy + (oa + ob) / 2)} ${x1} ${r(a1 + ob)} L${x1} ${r(a1 + ob + hb)} Q${cx} ${r(cy + (oa + ob + ha + hb) / 2)} ${x0} ${r(a0 + oa + ha)}Z`, fill)
    oa += ha
    ob += hb
  }
  return o
}

/** 小樽運河的煤氣燈（一排一起畫）：黑鐵柱、四角的燈箱、暖色的光暈。[x, 地面 y, 大小] */
function gasLamps(list: Pt3[]): string {
  let halo = ''
  let iron = ''
  let glass = ''
  let frame = ''
  for (const [x, g, s] of list) {
    const t = g - 150 * s
    halo += `<circle cx="${r(x)}" cy="${r(t + 14 * s)}" r="${r(15 * s)}"/>`
    iron += box(x - 1.5 * s, t + 22 * s, 3 * s, 128 * s) + box(x - 4 * s, g - 10 * s, 8 * s, 10 * s) + poly([[x - 8 * s, t + 6 * s], [x, t - 2 * s], [x + 8 * s, t + 6 * s]]) + box(x - 0.7 * s, t - 7 * s, 1.4 * s, 6 * s) + box(x - 5 * s, t + 21 * s, 10 * s, 2.4 * s)
    glass += poly([[x - 6 * s, t + 6 * s], [x + 6 * s, t + 6 * s], [x + 4.5 * s, t + 22 * s], [x - 4.5 * s, t + 22 * s]])
    frame += `M${r(x - 6 * s)} ${r(t + 6 * s)} L${r(x - 4.5 * s)} ${r(t + 22 * s)} M${r(x + 6 * s)} ${r(t + 6 * s)} L${r(x + 4.5 * s)} ${r(t + 22 * s)} M${r(x)} ${r(t + 6 * s)} L${r(x)} ${r(t + 22 * s)}`
  }
  return `<g fill="${C.yellow}" opacity=".24">${halo}</g>` + F(glass, C.yellow) + L(frame, 1.1, C.ink, 0.7) + F(iron, C.ink, 0.85)
}
/** 運河右岸的石造倉庫：沿著往消失點收的透視線排，窗有燈 */
function warehouses(): string {
  const vx = 166
  const vy = 300
  const at = (x: number, y300: number) => vy + ((y300 - vy) * (x - vx)) / (300 - vx)
  // [近端 x, 遠端 x, 牆頂在 x=300 的高度, 屋脊高]
  const W: Array<[number, number, number, number]> = [
    [300, 246, 186, 160],
    [242, 212, 200, 178],
    [209, 190, 192, 166],
    [188, 177, 204, 184],
    [176, 170, 196, 176],
  ]
  let walls = ''
  let roofs = ''
  let gables = ''
  let lit = ''
  let dark = ''
  let refl = ''
  for (const [xa, xb, wt, rt] of W) {
    const wb = 334
    walls += poly([[xa, at(xa, wt)], [xb, at(xb, wt)], [xb, at(xb, wb)], [xa, at(xa, wb)]]) + ' '
    refl += poly([[xa, at(xa, wb)], [xb, at(xb, wb)], [xb, at(xb, wb) + (at(xb, wb) - at(xb, wt)) * 0.55], [xa, at(xa, wb) + (at(xa, wb) - at(xa, wt)) * 0.55]]) + ' '
    // 屋頂斜面：牆頂到屋脊
    roofs += poly([[xa + 3, at(xa, wt) + 2], [xa - 4, at(xa, rt)], [xb - 2, at(xb, rt)], [xb + 1, at(xb, wt)]]) + ' '
    // 近端的山牆三角
    gables += poly([[xa, at(xa, wt)], [xa - 4, at(xa, rt)], [xa + 4, at(xa, wt) - 2]]) + ' '
    // 窗：兩排
    const n = Math.max(1, Math.round((xa - xb) / 13))
    for (let i = 0; i < n; i++) {
      const cx = xa - ((i + 0.5) * (xa - xb)) / n
      const h = at(cx, wb) - at(cx, wt)
      const ww = Math.max(1.6, ((xa - xb) / n) * 0.3)
      const y1 = at(cx, wt) + h * 0.22
      const y2 = at(cx, wt) + h * 0.58
      const d = box(cx - ww / 2, y1, ww, h * 0.16) + ' ' + box(cx - ww / 2, y2, ww, h * 0.18) + ' '
      if ((i + xa) % 3 === 0) dark += d
      else lit += d
    }
  }
  return (
    F(refl, C.navy, 0.3) +
    P(walls, C.grey) + F(walls, C.brown, 0.18) +
    S(walls) +
    P(roofs, C.ink, 0.78) +
    P(gables, C.grey) +
    F(lit, C.yellow, 0.9) +
    F(dark, C.ink, 0.45) +
    F(poly([[300, 334], [166, 300], [166, 302], [300, 340]]), C.ink, 0.3)
  )
}

const HOKKAIDO: Outfit[] = [
  // 札幌市時計台（data/spots/hokkaido.json wd-Q1140619，https://zh.wikipedia.org/wiki/%E6%9C%AD%E5%B9%8C%E5%B8%82%E9%90%98%E6%A8%93）：雪天的白色木造時計台（紅屋頂、山牆的紅星、鐘樓），後面的大樓、左邊積雪的樹
  bg({
    id: 'bg-hokkaido-tokeidai',
    name: '札幌時計台',
    pref: 'hokkaido',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(70, 70, 1.1) +
      cloud(232, 40, 0.8, 0.8) +
      F(box(18, 150, 40, 175) + box(62, 190, 34, 135) + box(118, 128, 46, 197) + box(170, 168, 40, 157) + box(250, 120, 60, 205), C.grey, 0.3) +
      L(`M24 168 h28 M24 186 h28 M24 204 h28 M24 222 h28 M24 240 h28 M24 258 h28 M256 140 h48 M256 160 h48 M256 180 h48 M256 200 h48`, 2, C.white, 0.5) +
      snowFir(50, 326, 2.1) +
      snowFir(104, 324, 1.4) +
      tokeidai(232, 324) +
      ground(C.white, 320) +
      F(`M0 328 C40 318 70 322 96 330 L96 336 L0 336Z M200 334 C230 326 270 326 300 332 L300 340 L200 340Z`, C.blue, 0.12) +
      L(`M0 352 C60 346 110 348 150 352 C200 356 250 354 300 348`, 1.4, C.blue, 0.25) +
      flakes([[40, 120], [86, 160], [140, 110], [200, 96], [256, 104], [30, 210], [112, 240], [176, 140], [270, 250], [60, 280], [214, 280], [150, 60], [100, 40], [240, 70]]),
  }),
  // ファーム富田（data/spots/hokkaido.json wd-Q10954584，https://zh.wikipedia.org/wiki/%E5%AF%8C%E7%94%B0%E8%BE%B2%E5%A0%B4）：夏天的薰衣草畦與彩色花帶的斜坡，遠方殘雪的十勝岳連峰
  bg({
    id: 'bg-hokkaido-farm-tomita',
    name: '富田農場',
    pref: 'hokkaido',
    rarity: 2,
    art:
      sky(C.blue, 0.26) +
      cloud(58, 90, 1.2) +
      cloud(236, 60, 1) +
      cloud(160, 30, 0.7, 0.7) +
      ridge([[-10, 236], [24, 214], [56, 200], [86, 210], [118, 184], [150, 196], [186, 178], [214, 194], [246, 186], [276, 204], [310, 218]], C.blue, 0.4, 300, false) +
      F(`M56 200 L64 206 L60 207 L52 205Z M118 184 L127 192 L121 193 L113 189Z M186 178 L196 187 L190 188 L181 184Z M246 186 L254 193 L248 194 L241 190Z`, C.white, 0.85) +
      ridge([[-10, 262], [40, 248], [100, 256], [160, 246], [220, 254], [310, 244]], C.matcha, 0.55, 300) +
      F(`M0 266 L40 252 L96 260 L96 300 L0 300Z M200 256 L260 248 L300 252 L300 300 L200 300Z`, C.yellow, 0.35) +
      firRow([14, 24, 34, 44, 54, 64, 74, 206, 216, 226, 236, 246, 256, 266], 264, 26, C.green, 0.8) +
      ridge([[-10, 276], [60, 268], [150, 274], [240, 266], [310, 272]], C.green, 0.6, 330) +
      // 左：彩りの畑（紫、白、粉、紅、橘、黃一條條排在坡上）
      F(`M-4 250 Q74 270 154 316 L154 330 L-4 330Z`, C.matcha) +
      bands(-4, 250, 154, 316, 74, 270, ([[C.purple, 9, 3], [C.white, 7, 2.6], [C.red, 7, 2.6], [C.purple, 8, 3], [C.pink, 8, 2.6], [C.orange, 7, 2.6], [C.white, 7, 2.4], [C.yellow, 7, 2.4], [C.purple, 22, 8]] as Array<[string, number, number]>).flatMap((b, i) => (i ? [[C.matcha, 1.4, 0.6], b] : [b]) as Array<[string, number, number]>)) +
      // 右：薰衣草畦
      F(`M304 248 Q240 256 160 314 L160 330 L304 330Z`, C.matcha) +
      bands(160, 314, 304, 248, 240, 256, [[C.purple, 2, 5], [C.matcha, 1.5, 3], [C.purple, 2, 6], [C.matcha, 1.5, 3], [C.purple, 2, 7], [C.matcha, 1.5, 4], [C.purple, 2, 8], [C.matcha, 1.5, 4], [C.purple, 2, 9], [C.matcha, 1.5, 4], [C.purple, 10, 30]]) +
      ground(C.matcha, 318) +
      F([-60, -10, 40, 260, 310, 360].map((x) => poly([[150 + (x - 150) * 0.1 - 3, 318], [150 + (x - 150) * 0.1 + 3, 318], [x + 22, 400], [x - 22, 400]])).join(' '), C.purple, 0.9) +
      F(poly([[146, 318], [154, 318], [184, 400], [116, 400]]), C.cream, 0.8),
  }),
  // 小樽運河（data/spots/hokkaido.json wd-Q10959355，https://zh.wikipedia.org/wiki/%E5%B0%8F%E6%A8%BD%E9%81%8B%E6%B2%B3）：黃昏的運河，右岸沿河的石造倉庫（亮著窗），左岸步道上一列煤氣燈，運河上的遊覽船與水面的倒影
  bg({
    id: 'bg-hokkaido-otaru',
    name: '小樽運河',
    pref: 'hokkaido',
    rarity: 3,
    art:
      sky(C.blue, 0.55) +
      F(`M0 0 H300 V118 C250 110 210 126 150 118 C90 110 50 126 0 116Z`, C.navy, 0.16) +
      F(`M0 214 C60 206 110 220 160 210 C210 202 260 216 300 208 V310 H0Z`, C.pink, 0.3) +
      F(`M0 252 C50 246 100 256 150 248 C200 242 250 254 300 246 V310 H0Z`, C.orange, 0.32) +
      sun(236, 62, 9, C.cream, 0.95) +
      `<g fill="${C.white}">${[[60, 40], [110, 82], [176, 28], [282, 104], [34, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')}</g>` +
      ridge([[-10, 274], [40, 256], [90, 266], [140, 252], [190, 266]], C.navy, 0.22, 304) +
      roofs(-4, 168, 304, C.navy, 0.34, 5) +
      F(box(18, 290, 4, 5) + box(40, 292, 4, 5) + box(70, 288, 4, 5) + box(100, 294, 3, 4) + box(130, 297, 3, 3), C.yellow, 0.85) +
      // 運河的水面
      F(poly([[166, 300], [300, 334], [300, 400], [206, 400]]), C.cream) +
      F(poly([[166, 300], [300, 334], [300, 400], [206, 400]]), C.blue, 0.55) +
      F(poly([[166, 300], [300, 334], [300, 400], [206, 400]]), C.navy, 0.18) +
      warehouses() +
      L(`M262 352 v10 M262 368 v6 M284 358 v12 M284 376 v5 M232 340 v8 M232 352 v5 M214 326 v6 M200 316 v4 M246 346 v7 M222 334 v5`, 2.4, C.yellow, 0.7) +
      L(`M196 330 h20 M224 352 h34 M240 380 h44 M206 360 h16 M186 316 h12`, 1.4, C.white, 0.35) +
      // 運河的遊覽船：白色的頂棚、船頭的燈
      G(Q(`M204 368 L268 368 L262 378 L210 378Z`, C.navy) + Q(`M212 352 L262 352 L264 356 L210 356Z`, C.white)) +
      L(`M214 356 V368 M238 356 V368 M260 356 V368`, 1.4, C.ink, 0.6) +
      `<g fill="${C.cream}"><circle cx="222" cy="364" r="3"/><circle cx="230" cy="364" r="3"/><circle cx="248" cy="364" r="3"/></g>` +
      dot(206, 364, 2.4, C.yellow) + dot(206, 364, 6, C.yellow, 0.3) +
      L(`M200 382 h16 M252 382 h20`, 1.4, C.white, 0.5) +
      // 左岸的石板步道
      F(poly([[0, 306], [166, 300], [206, 400], [0, 400]]), C.cream) +
      F(poly([[0, 306], [166, 300], [206, 400], [0, 400]]), C.grey, 0.5) +
      L(`M0 318 L169 307 M0 334 L174 318 M0 356 L182 340 M0 384 L193 370 M60 304 L20 400 M120 302 L110 400`, 1.2, C.white, 0.35) +
      F(poly([[166, 300], [206, 400], [196, 400], [163, 300]]), C.grey) + L(`M166 300 L206 400`, 1.2, C.ink, 0.3) +
      gasLamps([[157, 303, 0.22], [146, 306, 0.3], [131, 310, 0.42], [110, 318, 0.6], [46, 352, 1.25]]),
  }),
]

// ---------- 青森 ----------
/** 弘前城天守：石垣上三層的白牆天守，銅瓦屋頂、正面的切妻破風。x 中心、y 石垣上緣 */
function hirosakiCastle(x: number, y: number): string {
  let o = P(`M${x - 44} ${y + 52} C${x - 40} ${y + 30} ${x - 36} ${y + 12} ${x - 34} ${y} L${x + 34} ${y} C${x + 36} ${y + 12} ${x + 40} ${y + 30} ${x + 44} ${y + 52}Z`, C.grey)
  o += L(`M${x - 36} ${y + 12} L${x + 36} ${y + 12} M${x - 38} ${y + 24} L${x + 38} ${y + 24} M${x - 41} ${y + 37} L${x + 41} ${y + 37} M${x - 14} ${y} L${x - 16} ${y + 12} M${x + 10} ${y + 12} L${x + 11} ${y + 24} M${x - 20} ${y + 24} L${x - 22} ${y + 37} M${x + 24} ${y + 37} L${x + 26} ${y + 52}`, 1, C.ink, 0.2)
  o += S(`M${x + 20} ${y} L${x + 34} ${y} C${x + 36} ${y + 12} ${x + 40} ${y + 30} ${x + 44} ${y + 52} L${x + 26} ${y + 52}Z`)
  let walls = ''
  let roof = ''
  let gab = ''
  let win = ''
  let b = y
  for (const [w, h, g] of [[54, 26, 1], [42, 21, 1], [32, 18, 0]]) {
    const t = b - h
    walls += box(x - w / 2, t, w, h)
    for (let i = 0; i < 3; i++) win += box(x - w / 2 + 6 + (i * (w - 18)) / 2, t + h * 0.38, 6, h * 0.34)
    roof += `M${x - w / 2 - 9} ${t + 3} Q${x - w / 2 - 3} ${t - 1} ${x - w / 2 + 2} ${t - 7} L${x + w / 2 - 2} ${t - 7} Q${x + w / 2 + 3} ${t - 1} ${x + w / 2 + 9} ${t + 3}Z`
    if (g) gab += poly([[x - 11, t - 1], [x, t - 15], [x + 11, t - 1]])
    b = t - 7
  }
  // 最上層的入母屋屋頂與鯱
  roof += `M${x - 26} ${b + 2} Q${x - 18} ${b - 2} ${x - 12} ${b - 16} L${x + 12} ${b - 16} Q${x + 18} ${b - 2} ${x + 26} ${b + 2}Z`
  gab += poly([[x - 9, b - 6], [x, b - 18], [x + 9, b - 6]])
  o += P(walls, C.white) + F(win, C.ink, 0.55) + P(roof, C.navy, 0.85) + P(gab, C.white)
  o += L(`M${x - 11} ${y - 27} L${x} ${y - 41} L${x + 11} ${y - 27}`, 1.4, C.navy, 0.8)
  o += F(`M${x - 12} ${b - 16} c-3 -3 -2 -7 1 -8 l1 6Z M${x + 12} ${b - 16} c3 -3 2 -7 -1 -8 l-1 6Z`, C.ink, 0.8)
  o += S(box(x + 10, y - 26, 17, 26)) + S(box(x + 8, y - 54, 13, 21))
  return o
}
/** 朱色的木橋（下乘橋）：微微拱起的橋面、欄杆、擬寶珠 */
function redBridge(x0: number, x1: number, y: number): string {
  const m = (x0 + x1) / 2
  let posts = ''
  for (let x = x0 + 6; x < x1; x += 16) posts += box(x - 1.5, y - 15 + Math.abs(x - m) * 0.05, 3, 13)
  let piers = ''
  for (let x = x0 + 20; x < x1 - 10; x += 34) piers += box(x - 2, y + 4, 4, 16)
  return (
    F(piers, C.brown, 0.8) +
    P(`M${x0} ${y + 6} Q${m} ${y - 8} ${x1} ${y + 6} L${x1} ${y} Q${m} ${y - 14} ${x0} ${y}Z`, C.red) +
    F(posts, C.red) +
    P(`M${x0} ${y - 12} Q${m} ${y - 26} ${x1} ${y - 12} L${x1} ${y - 9} Q${m} ${y - 23} ${x0} ${y - 9}Z`, C.red) +
    L(`M${x0} ${y - 5} Q${m} ${y - 19} ${x1} ${y - 5}`, 1.4, C.red) +
    `<g fill="${C.ink}" opacity=".8">${[x0 + 2, x0 + 54, x1 - 54, x1 - 2].map((x) => `<circle cx="${r(x)}" cy="${r(y - 14 - (14 * (1 - ((x - m) / (x1 - x0) * 2) ** 2)) / 2 + 1)}" r="2.6"/>`).join('')}</g>` +
    S(`M${x0} ${y + 6} Q${m} ${y - 8} ${x1} ${y + 6} L${x1} ${y + 3} Q${m} ${y - 11} ${x0} ${y + 3}Z`)
  )
}
/** 一團花、一團樹冠：幾個圓疊在一起，只留外圍一圈紙邊（先畫帶邊的、再蓋一層不帶邊的） */
function bloom(pts: Pt3[], fill: string, op = 1): string {
  const c = pts.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`).join('')
  return `<g opacity="${op}"><g fill="${fill}" ${E}>${c}</g><g fill="${fill}">${c}</g></g>`
}

/** 奥入瀬：長滿青苔的石頭（灰石頭，上半蓋著青苔） */
const mossRocks = (pts: Pt3[]) =>
  P(pts.map(([x, y, w]) => `M${r(x - w)} ${y} C${r(x - w)} ${r(y - w * 0.7)} ${r(x - w * 0.3)} ${r(y - w * 0.9)} ${x} ${r(y - w * 0.9)} C${r(x + w * 0.5)} ${r(y - w * 0.9)} ${r(x + w)} ${r(y - w * 0.6)} ${r(x + w)} ${y}Z`).join(' '), C.grey) +
  F(pts.map(([x, y, w]) => `M${r(x - w * 0.96)} ${r(y - w * 0.3)} C${r(x - w * 0.9)} ${r(y - w * 0.75)} ${r(x - w * 0.3)} ${r(y - w * 0.92)} ${x} ${r(y - w * 0.92)} C${r(x + w * 0.5)} ${r(y - w * 0.92)} ${r(x + w)} ${r(y - w * 0.62)} ${r(x + w * 0.98)} ${r(y - w * 0.3)} C${r(x + w * 0.5)} ${r(y - w * 0.4)} ${r(x)} ${r(y - w * 0.2)} ${r(x - w * 0.96)} ${r(y - w * 0.3)}Z`).join(' '), C.green) +
  F(pts.map(([x, y, w]) => `M${r(x + w * 0.2)} ${y} C${r(x + w * 0.6)} ${r(y - w * 0.3)} ${r(x + w * 0.7)} ${r(y - w * 0.6)} ${r(x + w * 0.5)} ${r(y - w * 0.8)} C${r(x + w)} ${r(y - w * 0.6)} ${r(x + w)} ${r(y - w * 0.3)} ${r(x + w)} ${y}Z`).join(' '), C.ink, 0.14) +
  L(pts.map(([x, y, w]) => `M${r(x - w * 0.55)} ${r(y - w * 0.55)} Q${r(x - w * 0.2)} ${r(y - w * 0.92)} ${r(x + w * 0.25)} ${r(y - w * 0.82)}`).join(' '), 1.4, C.matcha, 0.9)

/** 青森ねぶた：武者（白臉、紅隈取、金盔與鍬形、舉起的刀），cx, cy 是臉的中心 */
function warrior(cx: number, cy: number): string {
  return (
    G(
      Q(`M${cx - 20} ${cy + 30} C${cx - 34} ${cy + 20} ${cx - 40} ${cy} ${cx - 36} ${cy - 22} L${cx - 22} ${cy - 20} C${cx - 24} ${cy - 4} ${cx - 16} ${cy + 10} ${cx - 6} ${cy + 22}Z`, C.blue) +
        Q(`M${cx - 30} ${cy - 78} L${cx - 26} ${cy - 76} L${cx - 26} ${cy - 30} L${cx - 30} ${cy - 30}Z`, C.white) +
        Q(box(cx - 36, cy - 34, 16, 4), C.gold) +
        Q(`M${cx - 38} ${cy - 22} C${cx - 40} ${cy - 30} ${cx - 34} ${cy - 34} ${cx - 28} ${cy - 33} C${cx - 20} ${cy - 32} ${cx - 18} ${cy - 24} ${cx - 22} ${cy - 18}Z`, C.cream) +
        Q(`M${cx - 6} ${cy - 30} C${cx - 14} ${cy - 40} ${cx - 20} ${cy - 50} ${cx - 18} ${cy - 66} C${cx - 12} ${cy - 54} ${cx - 6} ${cy - 44} ${cx + 1} ${cy - 34}Z M${cx + 6} ${cy - 30} C${cx + 14} ${cy - 40} ${cx + 20} ${cy - 50} ${cx + 18} ${cy - 66} C${cx + 12} ${cy - 54} ${cx + 6} ${cy - 44} ${cx - 1} ${cy - 34}Z`, C.gold) +
        Q(`M${cx - 34} ${cy - 10} L${cx - 26} ${cy - 22} L${cx - 22} ${cy + 4}Z M${cx + 34} ${cy - 10} L${cx + 26} ${cy - 22} L${cx + 22} ${cy + 4}Z`, C.green) +
        Q(`M${cx - 24} ${cy - 18} C${cx - 26} ${cy + 6} ${cx - 16} ${cy + 28} ${cx} ${cy + 30} C${cx + 16} ${cy + 28} ${cx + 26} ${cy + 6} ${cx + 24} ${cy - 18}Z`, C.white) +
        Q(`M${cx - 28} ${cy - 14} C${cx - 28} ${cy - 40} ${cx + 28} ${cy - 40} ${cx + 28} ${cy - 14} C${cx + 14} ${cy - 20} ${cx - 14} ${cy - 20} ${cx - 28} ${cy - 14}Z`, C.gold) +
        Q(`M${cx - 10} ${cy + 15} Q${cx} ${cy + 25} ${cx + 10} ${cy + 15} Q${cx} ${cy + 18} ${cx - 10} ${cy + 15}Z`, C.red),
    ) +
    // 紅隈取
    L(`M${cx - 4} ${cy - 10} C${cx - 10} ${cy - 18} ${cx - 18} ${cy - 16} ${cx - 23} ${cy - 8} M${cx + 4} ${cy - 10} C${cx + 10} ${cy - 18} ${cx + 18} ${cy - 16} ${cx + 23} ${cy - 8} M${cx - 20} ${cy + 4} C${cx - 18} ${cy + 12} ${cx - 12} ${cy + 18} ${cx - 8} ${cy + 18} M${cx + 20} ${cy + 4} C${cx + 18} ${cy + 12} ${cx + 12} ${cy + 18} ${cx + 8} ${cy + 18}`, 3, C.red, 0.9) +
    INK(`M${cx - 33} ${cy + 8} q8 -2 12 6 M${cx - 36} ${cy - 8} q8 -2 12 6 M${cx - 28} ${cy - 14} C${cx - 14} ${cy - 20} ${cx + 14} ${cy - 20} ${cx + 28} ${cy - 14} M${cx} ${cy - 34} L${cx} ${cy - 19} M${cx - 3} ${cy + 7} Q${cx} ${cy + 10} ${cx + 3} ${cy + 7} M${cx - 10} ${cy + 15} Q${cx} ${cy + 25} ${cx + 10} ${cy + 15} Q${cx} ${cy + 18} ${cx - 10} ${cy + 15}`, 1.5) +
    INK(`M${cx - 20} ${cy - 9} Q${cx - 12} ${cy - 15} ${cx - 4} ${cy - 7} M${cx + 20} ${cy - 9} Q${cx + 12} ${cy - 15} ${cx + 4} ${cy - 7}`, 3) +
    eyes([[cx - 11, cy - 2], [cx + 11, cy - 2]], 4.4)
  )
}
/** 青森ねぶた：鬼（紅臉、角、獠牙、亂髮、舉起的爪），cx, cy 是臉的中心 */
function oni(cx: number, cy: number): string {
  let hair = ''
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.95 + i * 0.137)
    const pt = (k: number, d: number) => `${r(cx + Math.cos(a + k) * d)} ${r(cy - 6 + Math.sin(a + k) * d * 0.95)}`
    hair += `M${pt(-0.2, 24)} Q${pt(-0.05, 40)} ${pt(0, 46)} Q${pt(0.15, 34)} ${pt(0.3, 24)}Z`
  }
  return (
    G(
      Q(hair, C.navy) +
        Q(`M${cx + 18} ${cy + 30} C${cx + 34} ${cy + 18} ${cx + 38} ${cy} ${cx + 34} ${cy - 22} L${cx + 22} ${cy - 20} C${cx + 24} ${cy - 2} ${cx + 16} ${cy + 12} ${cx + 4} ${cy + 22}Z`, C.green) +
        Q(`M${cx + 20} ${cy - 20} C${cx + 18} ${cy - 30} ${cx + 22} ${cy - 40} ${cx + 30} ${cy - 40} C${cx + 38} ${cy - 40} ${cx + 40} ${cy - 30} ${cx + 36} ${cy - 20}Z`, C.red) +
        Q(`M${cx - 14} ${cy - 22} C${cx - 18} ${cy - 34} ${cx - 22} ${cy - 42} ${cx - 30} ${cy - 50} C${cx - 18} ${cy - 46} ${cx - 10} ${cy - 38} ${cx - 6} ${cy - 26}Z M${cx + 6} ${cy - 26} C${cx + 8} ${cy - 38} ${cx + 12} ${cy - 46} ${cx + 22} ${cy - 54} C${cx + 18} ${cy - 42} ${cx + 16} ${cy - 32} ${cx + 14} ${cy - 22}Z`, C.cream) +
        Q(`M${cx - 24} ${cy - 16} C${cx - 28} ${cy + 8} ${cx - 18} ${cy + 30} ${cx} ${cy + 32} C${cx + 18} ${cy + 30} ${cx + 28} ${cy + 8} ${cx + 24} ${cy - 16} C${cx + 14} ${cy - 28} ${cx - 14} ${cy - 28} ${cx - 24} ${cy - 16}Z`, C.red) +
        Q(`M${cx - 13} ${cy + 15} Q${cx} ${cy + 30} ${cx + 13} ${cy + 15} Q${cx} ${cy + 19} ${cx - 13} ${cy + 15}Z`, C.ink) +
        Q(`M${cx - 10} ${cy + 16} l3 7 l2 -6Z M${cx + 10} ${cy + 16} l-3 7 l-2 -6Z M${cx - 4} ${cy + 18} l2 -6 l2 6Z M${cx + 4} ${cy + 18} l-2 -6 l-2 6Z`, C.white),
    ) +
    S(`M${cx + 10} ${cy - 24} C${cx + 20} ${cy - 20} ${cx + 28} ${cy + 8} ${cx} ${cy + 32} C${cx + 18} ${cy + 30} ${cx + 28} ${cy + 8} ${cx + 24} ${cy - 16}Z`) +
    INK(`M${cx + 34} ${cy + 6} q-8 -2 -12 6 M${cx + 36} ${cy - 10} q-8 -2 -12 6 M${cx + 22} ${cy - 37} l-3 -9 M${cx + 28} ${cy - 40} l0 -10 M${cx + 34} ${cy - 39} l3 -9`, 1.7) +
    INK(`M${cx - 20} ${cy - 10} L${cx - 4} ${cy - 5} M${cx + 20} ${cy - 10} L${cx + 4} ${cy - 5} M${cx - 6} ${cy - 18} q6 4 12 0`, 3) +
    eyes([[cx - 11, cy + 1], [cx + 11, cy + 1]], 5)
  )
}
/** ねぶた的身體與雲（黑線勾邊的彩色和紙）：左是武者的鎧甲與紅袖，中間的雲，右是鬼的衣服與虎皮 */
function nebutaBody(): string {
  return (
    G(
      Q(`M10 300 C6 268 14 240 36 222 C52 212 74 210 92 220 C104 210 120 214 128 226 L128 300Z`, C.green) +
        Q(`M30 228 C44 216 64 214 80 220 L76 246 C62 240 46 242 34 250Z`, C.gold) +
        Q(`M36 300 C30 280 40 258 62 256 C84 254 100 270 104 300Z`, C.red) +
        Q(`M118 300 C112 266 122 236 150 232 C178 236 188 266 182 300Z`, C.purple) +
        `<g fill="${C.white}">${[[134, 252, 9], [162, 246, 11], [150, 276, 10], [126, 284, 7], [176, 280, 8]].map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`).join('')}</g>` +
        Q(`M172 300 C170 270 178 236 204 222 C220 214 244 214 260 222 C280 232 292 262 290 300Z`, C.blue) +
        Q(`M206 300 L214 262 L264 262 L272 300Z`, C.yellow),
    ) +
    INK(
      `M20 266 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 M18 282 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 M84 250 q10 -8 20 0 q10 8 20 0 M36 236 q20 -8 42 -4 ` +
        `M50 300 C48 284 56 272 68 272 C78 272 84 280 82 288 C80 294 72 294 70 288 ` +
        `M134 252 m-4 0 a4 4 0 1 1 4 4 M162 246 m-5 0 a5 5 0 1 1 5 5 M150 276 m-4 0 a4 4 0 1 1 4 4 ` +
        `M190 248 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10 ` +
        `M220 266 l4 12 M232 266 l2 16 M246 266 l-1 18 M258 266 l-3 14 M222 300 l3 -12 M240 300 l0 -10 M256 300 l-2 -12`,
      1.6,
    )
  )
}
/** 跳人（ハネト）：白浴衣、花笠、舉起一隻手跳。[x, 腳 y, 大小, 朝向] */
function haneto(list: Array<[number, number, number, number]>): string {
  let robe = ''
  let skin = ''
  let sash = ''
  let hat = ''
  let flw = ['', '', '']
  let arms = ''
  let legs = ''
  for (const [x, y, s, f] of list) {
    const X = (dx: number) => r(x + dx * s * f)
    const Y = (dy: number) => r(y + dy * s)
    robe += `M${X(-6)} ${Y(-31)} L${X(6)} ${Y(-31)} L${X(9)} ${Y(-9)} L${X(-9)} ${Y(-9)}Z`
    sash += box(Math.min(+X(-7), +X(7)), +Y(-24), 14 * s, 4 * s)
    skin += `<circle cx="${x}" cy="${Y(-35)}" r="${r(4 * s)}"/>`
    hat += `M${X(-11)} ${Y(-38)} C${X(-10)} ${Y(-50)} ${X(10)} ${Y(-50)} ${X(11)} ${Y(-38)}Z`
    ;[[-6, -42], [0, -46], [6, -42], [0, -40]].forEach(([dx, dy], i) => (flw[i % 3] += `<circle cx="${X(dx)}" cy="${Y(dy)}" r="${r(2.4 * s)}"/>`))
    arms += `M${X(-5)} ${Y(-29)} L${X(-11)} ${Y(-40)} L${X(-9)} ${Y(-48)} M${X(5)} ${Y(-29)} L${X(13)} ${Y(-24)} L${X(15)} ${Y(-30)}`
    legs += `M${X(-4)} ${Y(-10)} L${X(-6)} ${Y(0)} M${X(4)} ${Y(-10)} L${X(9)} ${Y(-3)}`
  }
  return (
    L(legs, 2.4, C.cream) + L(arms, 3.4, C.white) +
    G(Q(robe, C.white) + Q(sash, C.pink) + `<g fill="${C.cream}">${skin}</g>` + Q(hat, C.white)) +
    `<g fill="${C.red}">${flw[0]}</g><g fill="${C.yellow}">${flw[1]}</g><g fill="${C.pink}">${flw[2]}</g>`
  )
}

const AOMORI: Outfit[] = [
  // 奥入瀬渓流（data/spots/aomori.json wd-Q10942580，https://zh.wikipedia.org/wiki/%E5%A5%A7%E5%85%A5%E7%80%A8%E6%BA%AA%E6%B5%81）：紅葉的溪谷，長滿青苔的石頭間的急流，右邊岩壁落下的細長瀑布，步道上的落葉
  bg({
    id: 'bg-aomori-oirase',
    name: '奧入瀨溪流',
    pref: 'aomori',
    rarity: 1,
    art:
      sky(C.yellow, 0.2) +
      ridge([[-10, 150], [30, 120], [70, 134], [110, 112], [150, 128], [190, 108], [230, 126], [270, 110], [310, 130]], C.yellow, 0.4, 300) +
      ridge([[-10, 196], [40, 170], [90, 186], [140, 166], [190, 182], [240, 164], [310, 180]], C.orange, 0.32, 300) +
      L(`M24 300 L26 150 M58 300 L57 170 M120 300 L121 160 M150 300 L149 150 M176 300 L178 166 M196 300 L195 140`, 3, C.brown, 0.28) +
      bloom([[10, 10, 30], [58, -2, 30], [106, 8, 24], [152, -4, 26], [198, 6, 26], [246, -2, 30], [30, 44, 18], [128, 32, 14], [222, 36, 14]], C.orange, 0.9) +
      bloom([[292, 14, 32], [270, 50, 16], [300, 70, 14]], C.red) +
      // 右：岩壁與瀑布
      P(`M200 300 C206 250 214 180 226 130 C236 104 262 92 304 90 L304 300Z`, C.brown, 0.5) +
      F(`M214 240 C220 222 234 214 246 222 C238 232 226 238 214 240Z M262 170 C272 158 290 156 304 160 L304 176 C290 172 276 174 262 170Z M226 150 C232 140 244 136 252 140 C244 148 234 150 226 150Z M270 250 C280 238 296 238 304 242 L304 258 C292 254 280 254 270 250Z`, C.green, 0.6) +
      P(`M243 104 C246 100 252 100 254 104 L254 296 L240 296Z`, C.white, 0.94) +
      L(`M246 120 L245 290 M250 140 L250 286`, 1.2, C.blue, 0.3) +
      bloom([[262, 214, 16], [286, 226, 16], [276, 196, 13], [214, 196, 13], [230, 210, 10]], C.red, 0.95) +
      // 左：山毛櫸
      P(`M30 322 L34 170 L44 170 L48 322Z M86 318 L89 200 L96 200 L99 318Z`, C.grey) +
      bloom([[70, 112, 16], [8, 134, 16], [104, 160, 14], [0, 186, 14], [118, 214, 10]], C.orange) +
      bloom([[38, 140, 30], [12, 170, 24], [66, 168, 26], [40, 190, 20], [92, 184, 22], [112, 204, 16], [60, 118, 20], [20, 126, 18], [94, 152, 16]], C.yellow) +
      // 溪流：從後面流到右下
      F(`M146 294 C170 284 204 286 226 292 C254 298 282 300 304 300 L304 400 L224 400 C214 360 190 322 146 302Z`, C.blue, 0.55) +
      L(`M168 292 q10 -3 20 0 M204 296 q10 -4 20 0 M246 304 q12 -4 24 0 M196 316 q10 -4 20 0 M228 330 q14 -5 28 0 M268 322 q12 -4 24 0 M212 360 q10 -4 20 0 M266 360 q14 -5 28 0 M226 392 q12 -4 24 0`, 2, C.white, 0.85) +
      F(`M236 300 C238 294 254 294 258 300Z M206 340 C214 332 230 334 236 342Z M254 352 C264 344 282 346 288 354Z M216 378 C228 372 246 374 252 382Z`, C.white, 0.75) +
      mossRocks([[178, 304, 10], [222, 346, 16], [270, 358, 20], [236, 398, 22], [292, 390, 14], [262, 314, 12]]) +
      // 步道、青苔的岸、落葉
      F(`M0 318 C50 312 110 312 146 302 C190 322 214 360 224 400 L0 400Z`, C.cream) +
      F(`M0 318 C50 312 110 312 146 302 C190 322 214 360 224 400 L0 400Z`, C.brown, 0.3) +
      P(`M0 318 C50 312 110 312 146 302 C190 322 214 360 224 400 L212 400 C202 362 180 330 144 312 C110 322 50 322 0 326Z`, C.green, 0.75) +
      `<g fill="${C.red}">${[[30, 350], [82, 372], [140, 390], [196, 380], [250, 330], [60, 392], [280, 340], [110, 346]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2"/>`).join('')}</g>` +
      `<g fill="${C.yellow}">${[[52, 340], [112, 362], [168, 382], [20, 380], [124, 336], [240, 372], [196, 304]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="2"/>`).join('')}</g>`,
  }),
  // 弘前城（data/spots/aomori.json wd-Q328582，https://zh.wikipedia.org/wiki/%E5%BC%98%E5%89%8D%E5%9F%8E）：櫻花季，石垣上三層的天守、護城河上朱色的下乘橋與花筏，遠方殘雪的岩木山
  bg({
    id: 'bg-aomori-hirosaki-castle',
    name: '弘前城',
    pref: 'aomori',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(180, 60, 1) +
      cloud(260, 112, 0.7, 0.8) +
      ridge([[-10, 300], [18, 262], [44, 214], [58, 190], [66, 196], [74, 182], [82, 194], [90, 188], [110, 216], [150, 256], [200, 282], [250, 296], [310, 302]], C.blue, 0.36, 304, false) +
      F(`M44 214 L58 190 L66 196 L74 182 L82 194 L90 188 L104 208 L94 204 L86 210 L78 202 L68 210 L60 204 L50 214Z`, C.white, 0.9) +
      ridge([[-10, 290], [30, 276], [70, 284], [120, 272], [170, 282], [220, 270], [270, 280], [310, 274]], C.pink, 0.55, 304) +
      hirosakiCastle(232, 248) +
      bloom([[176, 286, 14], [196, 280, 12], [276, 282, 14], [292, 292, 12]], C.pink, 0.9) +
      // 護城河與花筏
      F(box(0, 296, 300, 26), C.blue, 0.45) +
      F(`M0 316 C40 312 80 318 120 314 C170 310 220 318 300 312 L300 322 L0 322Z M160 300 C190 298 230 302 270 299 L270 303 C230 306 190 303 160 304Z`, C.pink, 0.7) +
      L(`M20 304 h18 M70 308 h24 M216 306 h20`, 1.4, C.white, 0.5) +
      redBridge(104, 296, 292) +
      // 左的櫻樹、上面垂下的枝
      tree(46, 324, 2.3, C.pink) +
      tree(104, 324, 1.5, C.pink) +
      L(`M-4 110 C30 116 56 128 86 152 M40 122 C46 134 50 144 50 156`, 3, C.brown, 0.85) +
      bloom([[0, 112, 14], [18, 120, 14], [36, 128, 14], [54, 136, 13], [70, 146, 12], [86, 156, 10], [44, 150, 11], [22, 104, 10], [8, 132, 10]], C.pink) +
      `<g fill="${C.white}" opacity=".8">${[[6, 106], [20, 124], [34, 116], [48, 132], [62, 142], [78, 152], [40, 146], [14, 134], [58, 128], [28, 98]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5"/>`).join('')}</g>` +
      ground(C.matcha, 322, 0.55) +
      F(`M130 322 L170 322 L196 400 L104 400Z`, C.cream, 0.7) +
      `<g fill="${C.pink}">${[[120, 120], [200, 140], [230, 108], [150, 200], [86, 240], [260, 210], [30, 250], [190, 250], [60, 360], [240, 370], [20, 340], [276, 344]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.6"/>`).join('')}</g>`,
  }),
  // 青森ねぶた（data/spots/aomori.json wd-Q862407，https://zh.wikipedia.org/wiki/%E9%9D%92%E6%A3%AE%E7%9D%A1%E9%AD%94%E7%A5%AD）：夏夜的大型睡魔燈籠：左邊舉刀的武者、右邊的鬼，中間的雲，裡面點著燈
  bg({
    id: 'bg-aomori-nebuta',
    name: '青森睡魔祭',
    pref: 'aomori',
    rarity: 3,
    art:
      sky(C.navy, 0.74, C.cream) +
      `<g fill="${C.white}">${[[40, 40], [96, 70], [170, 34], [240, 60], [280, 24], [20, 100], [270, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')}</g>` +
      nebutaBody() +
      warrior(68, 182) +
      oni(234, 190) +
      // 底座：黑台、紅幕、白線
      P(box(4, 298, 292, 18), C.ink, 0.8) +
      F(box(4, 302, 292, 8), C.red, 0.9) +
      L(`M4 306 H296`, 1, C.white, 0.5) +
      ground(C.navy, 316, 0.58) +
      `<ellipse cx="150" cy="326" rx="150" ry="8" fill="${C.yellow}" opacity=".14"/>` +
      haneto([[44, 352, 1.1, 1], [78, 346, 1, -1], [224, 346, 1, 1], [258, 352, 1.1, -1]]),
  }),
]

// ---------- 岩手 ----------
/** 中尊寺金色堂（覆堂裡的玻璃櫃中）：寶形造的金屋頂與寶珠、四根金柱、兩側的格子門 */
function konjikido(): string {
  // 屋頂的瓦：直的一條條，上端沿著隅棟
  const hip: Pt[] = [[10, 196], [50, 188], [82, 174], [110, 148], [130, 122], [146, 96]]
  const hipY = (x: number) => {
    const d = Math.abs(x - 150)
    const X = 150 - d
    for (let i = 1; i < hip.length; i++) if (X <= hip[i][0]) return hip[i - 1][1] + ((hip[i][1] - hip[i - 1][1]) * (X - hip[i - 1][0])) / (hip[i][0] - hip[i - 1][0])
    return 96
  }
  let tiles = ''
  for (let x = 22; x < 280; x += 9) if (Math.abs(x - 150) > 3) tiles += `M${x} ${r(hipY(x) + 3)} L${x} 195 `
  let lattice = ''
  for (const [x0, x1] of [[46, 106], [194, 254]]) {
    for (let x = x0 + 10; x < x1; x += 10) lattice += `M${x} 230 L${x} 296 `
    for (let y = 240; y < 296; y += 10) lattice += `M${x0} ${y} L${x1} ${y} `
  }
  return (
    G(
      // 寶珠
      Q(`M144 92 L156 92 L154 86 L146 86Z M150 64 C156 70 158 76 156 82 C154 86 146 86 144 82 C142 76 144 70 150 64Z`, C.gold) +
        // 屋頂
        Q(`M10 196 Q82 178 120 134 Q140 108 146 94 L154 94 Q160 108 180 134 Q218 178 290 196 L286 206 L14 206Z`, C.gold) +
        Q(box(24, 206, 252, 8), C.gold) +
        // 柱、長押、格子門、中間
        Q(box(46, 220, 208, 80), C.gold) +
        Q(box(34, 214, 12, 88) + box(104, 214, 12, 88) + box(184, 214, 12, 88) + box(254, 214, 12, 88), C.gold) +
        Q(box(30, 214, 240, 8) + box(30, 260, 240, 5), C.gold) +
        Q(box(18, 300, 264, 8), C.gold) +
        Q(box(24, 308, 252, 12), C.brown),
    ) +
    F(box(116, 222, 68, 78), C.brown, 0.35) +
    L(tiles, 1.2, C.ink, 0.16) +
    L(lattice, 1, C.ink, 0.22) +
    L(`M10 196 Q82 178 120 134 Q140 108 146 94 M290 196 Q218 178 180 134 Q160 108 154 94`, 1.4, C.white, 0.6) +
    L(`M40 216 L40 298 M110 216 L110 298 M190 216 L190 298 M260 216 L260 298 M24 210 L276 210`, 1.2, C.white, 0.45) +
    S(`M150 94 L154 94 Q160 108 180 134 Q218 178 290 196 L286 206 L150 206Z`) +
    S(box(254, 214, 12, 88) + box(184, 214, 12, 88)) +
    L(`M30 210 h240`, 3, C.ink, 0.12) + L(Array.from({ length: 22 }, (_, i) => `M${33 + i * 11} 207 v5`).join(' '), 3, C.ink, 0.2) +
    `<g fill="${C.white}" opacity=".8">${[[60, 250], [90, 250], [60, 280], [90, 280], [210, 250], [240, 250], [210, 280], [240, 280], [70, 217], [150, 217], [230, 217]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')}</g>`
  )
}
/** 浄土ヶ浜：白色流紋岩的尖石，頂上長著松 */
function jodoRocks(list: Array<[number, number, number, number]>): string {
  // [x 中心, 底 y, 寬, 高]
  let rock = ''
  let shade = ''
  let crack = ''
  for (const [x, y, w, h] of list) {
    rock += `M${x - w / 2} ${y} L${r(x - w * 0.42)} ${r(y - h * 0.55)} L${r(x - w * 0.22)} ${r(y - h * 0.8)} L${r(x - w * 0.08)} ${y - h} L${r(x + w * 0.12)} ${r(y - h * 0.86)} L${r(x + w * 0.3)} ${r(y - h * 0.7)} L${r(x + w * 0.44)} ${r(y - h * 0.4)} L${x + w / 2} ${y}Z`
    shade += `M${r(x + w * 0.05)} ${y} L${r(x + w * 0.02)} ${r(y - h * 0.6)} L${r(x + w * 0.12)} ${r(y - h * 0.86)} L${r(x + w * 0.3)} ${r(y - h * 0.7)} L${r(x + w * 0.44)} ${r(y - h * 0.4)} L${x + w / 2} ${y}Z`
    crack += `M${r(x - w * 0.22)} ${r(y - h * 0.7)} L${r(x - w * 0.18)} ${r(y - h * 0.3)} M${r(x - w * 0.34)} ${r(y - h * 0.4)} L${r(x - w * 0.3)} ${r(y - h * 0.1)}`
  }
  return P(rock, C.white) + F(rock, C.grey, 0.18) + S(shade) + L(crack, 1, C.ink, 0.18)
}
/** 松：彎的樹幹＋幾層扁平的樹冠。[x, 根 y, 大小, 往哪邊彎] */
function pines(list: Array<[number, number, number, number]>): string {
  let trunk = ''
  let leaf = ''
  for (const [x, y, s, f] of list) {
    const X = (dx: number) => r(x + dx * s * f)
    const Y = (dy: number) => r(y + dy * s)
    trunk += `M${X(-1.5)} ${y} C${X(-1)} ${Y(-8)} ${X(4)} ${Y(-14)} ${X(6)} ${Y(-22)} L${X(8.5)} ${Y(-21)} C${X(7)} ${Y(-12)} ${X(2)} ${Y(-6)} ${X(1.5)} ${y}Z`
    for (const [cx, cy, w] of [[6, -24, 11], [-2, -16, 8], [12, -15, 7]]) leaf += `M${X(cx - w)} ${Y(cy + 2)} C${X(cx - w)} ${Y(cy - 4)} ${X(cx - w * 0.3)} ${Y(cy - 6)} ${X(cx)} ${Y(cy - 6)} C${X(cx + w * 0.4)} ${Y(cy - 6)} ${X(cx + w)} ${Y(cy - 3)} ${X(cx + w)} ${Y(cy + 2)}Z`
  }
  return F(trunk, C.brown) + P(leaf, C.green) + F(leaf, C.ink, 0.12)
}
/** 海鷗：一個 V 字的白鳥 */
const gulls = (pts: Pt3[]) =>
  P(pts.map(([x, y, s]) => `M${r(x - 9 * s)} ${r(y - 2 * s)} Q${r(x - 4 * s)} ${r(y - 6 * s)} ${x} ${y} Q${r(x + 4 * s)} ${r(y - 6 * s)} ${r(x + 9 * s)} ${r(y - 2 * s)} Q${r(x + 4 * s)} ${r(y - 3 * s)} ${x} ${r(y + 2 * s)} Q${r(x - 4 * s)} ${r(y - 3 * s)} ${r(x - 9 * s)} ${r(y - 2 * s)}Z`).join(''), C.white) +
  F(pts.map(([x, y, s]) => `M${r(x - 9 * s)} ${r(y - 2 * s)} Q${r(x - 7 * s)} ${r(y - 4 * s)} ${r(x - 5 * s)} ${r(y - 4.4 * s)} L${r(x - 6 * s)} ${r(y - 2.6 * s)}Z M${r(x + 9 * s)} ${r(y - 2 * s)} Q${r(x + 7 * s)} ${r(y - 4 * s)} ${r(x + 5 * s)} ${r(y - 4.4 * s)} L${r(x + 6 * s)} ${r(y - 2.6 * s)}Z`).join(''), C.ink, 0.6)
/** 猊鼻渓：兩岸的石灰岩絕壁（直的岩紋、掛著紅葉） */
function cliff(d: string, seams: string): string {
  return P(d, C.grey) + F(d, C.brown, 0.18) + L(seams, 1.4, C.ink, 0.16)
}
/** 猊鼻渓的舟下り：平底舟、站在船尾撐篙的船夫（斗笠）、坐著的客人。x, y 是船底中心 */
function gorgeBoat(x: number, y: number, s: number): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    L(`M36 -34 L54 14`, 2, C.brown) +
    G(
      Q(`M-46 -6 L46 -6 L40 2 L-36 2Z`, C.brown) +
        Q(`M26 -6 L26 -26 L34 -26 L34 -6Z`, C.navy) +
        Q(`M21 -26 L30 -34 L39 -26Z`, C.yellow) +
        Q(`M-32 -6 C-32 -12 -24 -12 -24 -6Z M-16 -6 C-16 -12 -8 -12 -8 -6Z M0 -6 C0 -12 8 -12 8 -6Z`, C.red) +
        `<g fill="${C.cream}"><circle cx="-28" cy="-15" r="3.4"/><circle cx="-12" cy="-15" r="3.4"/><circle cx="4" cy="-15" r="3.4"/></g>`,
    ) +
    L(`M28 -20 L38 -28`, 2.2, C.navy) +
    F(`M-46 2 L40 2 L40 6 L-40 6Z`, C.ink, 0.15) +
    L(`M-52 8 h20 M44 8 h16`, 1.2, C.white, 0.6) +
    `</g>`
  )
}
/** 一叢叢的紅葉、黃葉：圓鼓鼓的一團，同色的畫在同一條 path。[x, y, 大小] */
function clumps(list: Pt3[], fill: string, op = 1): string {
  const d = list
    .map(([x, y, z]) => {
      const p = (dx: number, dy: number) => `${Math.round(x + dx * z)} ${Math.round(y + dy * z)}`
      return `M${p(-1, 0.4)} C${p(-1.3, -0.1)} ${p(-0.8, -0.8)} ${p(-0.2, -0.6)} C${p(0, -1.1)} ${p(0.8, -1)} ${p(0.7, -0.4)} C${p(1.2, -0.3)} ${p(1.2, 0.5)} ${p(0.5, 0.5)} C${p(0.2, 0.8)} ${p(-0.6, 0.8)} ${p(-1, 0.4)}Z`
    })
    .join(' ')
  return P(d, fill, op)
}

const IWATE: Outfit[] = [
  // 猊鼻渓（data/spots/iwate.json wd-Q3100169，https://zh.wikipedia.org/wiki/%E7%8C%8A%E9%BC%BB%E6%BA%AA）：紅葉季的溪谷，兩岸筆直的石灰岩絕壁，河上船夫撐篙的平底舟
  bg({
    id: 'bg-iwate-geibikei',
    name: '猊鼻溪',
    pref: 'iwate',
    rarity: 1,
    art:
      sky(C.orange, 0.12, C.cream) +
      cloud(150, 50, 0.9, 0.85) +
      F(`M96 300 L104 150 L124 120 L140 300Z M160 300 L174 130 L192 110 L206 300Z`, C.grey, 0.4) +
      clumps([[114, 160, 12], [184, 150, 12]], C.orange, 0.45) +
      cliff(`M-4 340 L-4 20 L40 30 L64 70 L76 140 L92 200 L100 260 L110 340Z`, `M20 40 L26 300 M44 50 L50 300 M66 100 L74 300 M86 190 L92 300`) +
      cliff(`M304 340 L304 10 L262 26 L236 70 L222 140 L210 210 L200 270 L192 340Z`, `M280 30 L276 300 M254 50 L250 300 M234 110 L230 300 M216 200 L212 300`) +
      S(`M262 26 L236 70 L222 140 L210 210 L200 270 L192 340 L214 340 L222 270 L232 210 L244 140 L256 76Z`) +
      // 紅葉集中在崖頂、岩棚
      clumps([[36, 116, 12], [88, 210, 13], [228, 128, 12], [208, 222, 11]], C.yellow) +
      clumps([[40, 34, 16], [52, 104, 16], [50, 206, 12], [286, 30, 18], [266, 124, 13], [222, 206, 14]], C.orange) +
      clumps([[14, 42, 18], [70, 120, 13], [70, 196, 15], [262, 38, 14], [244, 112, 16], [242, 214, 14]], C.red) +
      pines([[30, 34, 1, 1], [268, 30, 0.9, -1]]) +
      // 河面
      F(`M88 296 L212 296 L256 342 L44 342Z`, C.green, 0.45) +
      F(`M88 296 L212 296 L256 342 L44 342Z`, C.blue, 0.25) +
      L(`M110 302 h20 M160 306 h26 M84 318 h30 M150 322 h40 M196 312 h18 M70 334 h26 M200 336 h30`, 1.4, C.white, 0.6) +
      clumps([[20, 310, 18], [60, 318, 14], [290, 306, 18]], C.orange) +
      clumps([[44, 304, 15], [262, 312, 15], [86, 326, 10]], C.red) +
      gorgeBoat(222, 330, 1.25) +
      // 岸邊的石頭
      F(`M0 340 C60 334 100 342 150 342 C200 342 240 334 300 340 L300 400 L0 400Z`, C.cream) +
      F(`M0 340 C60 334 100 342 150 342 C200 342 240 334 300 340 L300 400 L0 400Z`, C.grey, 0.45) +
      L(`M15 356 h10 M55 376 h10 M95 352 h10 M205 358 h10 M245 382 h10 M275 352 h10 M35 394 h10 M175 390 h10 M125 372 h10`, 4, C.white, 0.6) +
      `<g fill="${C.red}">${[[34, 366], [86, 386], [226, 370], [268, 394], [150, 356]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.8"/>`).join('')}</g>`,
  }),
  // 浄土ヶ浜（data/spots/iwate.json wd-Q11271084，https://zh.wikipedia.org/wiki/%E6%B7%A8%E5%9C%9F%E6%BF%B1）：夏天，翡翠色的海灣裡立著白色的尖石、石頂長著松，白色的礫石海灘，海鷗
  bg({
    id: 'bg-iwate-jodogahama',
    name: '淨土濱',
    pref: 'iwate',
    rarity: 2,
    art:
      sky(C.blue, 0.3) +
      cloud(60, 70, 1.2) +
      cloud(240, 110, 1) +
      gulls([[100, 118, 1.5], [200, 96, 1.2], [236, 146, 1.6], [56, 156, 1.2]]) +
      ridge([[150, 270], [200, 254], [250, 248], [310, 256]], C.green, 0.45, 280) +
      F(box(0, 270, 300, 60), C.blue, 0.55) +
      F(box(0, 292, 300, 38), C.green, 0.3) +
      L(`M20 280 h30 M120 286 h40 M220 278 h30 M60 300 h26 M180 304 h34 M90 316 h30 M240 318 h28`, 1.4, C.white, 0.6) +
      jodoRocks([[56, 304, 70, 150], [104, 300, 40, 84], [236, 306, 64, 140], [192, 302, 36, 70], [276, 300, 34, 96], [10, 300, 30, 80]]) +
      pines([[48, 160, 1.4, 1], [70, 176, 1, -1], [102, 222, 0.9, 1], [226, 172, 1.3, -1], [250, 186, 1, 1], [276, 210, 0.9, -1], [190, 236, 0.8, 1]]) +
      F(`M0 306 L300 306 L300 312 L0 312Z`, C.white, 0.5) +
      ground(C.white, 324) +
      F(`M0 324 C60 318 120 322 160 326 C210 330 260 324 300 320 L300 334 L0 334Z`, C.green, 0.25) +
      `<g fill="${C.grey}" opacity=".35">${[[20, 350, 6], [52, 366, 4], [90, 352, 5], [210, 356, 5], [248, 372, 6], [282, 352, 4], [36, 390, 5], [150, 392, 4], [230, 394, 5], [120, 372, 3], [180, 368, 3]].map(([x, y, rr]) => `<ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rr * 0.55}"/>`).join('')}</g>`,
  }),
  // 中尊寺金色堂（data/spots/iwate.json wd-Q11363889，https://zh.wikipedia.org/wiki/%E4%B8%AD%E5%B0%8A%E5%AF%BA%E9%87%91%E8%89%B2%E5%A0%82）：覆堂裡、玻璃櫃中的金色堂：寶形造的金屋頂與寶珠、金柱與格子門
  bg({
    id: 'bg-iwate-konjikido',
    name: '中尊寺金色堂',
    pref: 'iwate',
    rarity: 3,
    art:
      sky(C.brown, 0.4, C.cream) +
      F(box(0, 0, 300, 56), C.ink, 0.12) +
      L(`M0 56 H300 M60 0 V56 M150 0 V56 M240 0 V56 M0 28 H300`, 2, C.brown, 0.4) +
      L(`M20 70 V320 M280 70 V320`, 6, C.brown, 0.25) +
      F(`M110 56 L190 56 L290 320 L10 320Z`, C.cream, 0.12) +
      konjikido() +
      ground(C.brown, 320, 0.5) +
      F(`M18 320 L282 320 L270 344 L30 344Z`, C.gold, 0.25) +
      // 玻璃櫃的框與反光
      L(`M8 60 L8 320 M292 60 L292 320 M8 60 L292 60`, 2.4, C.ink, 0.3) +
      F(`M20 70 L44 70 L20 110Z M250 230 L280 190 L280 214 L262 238Z`, C.white, 0.22),
  }),
]

// ---------- 宮城 ----------
/** 伊達政宗騎馬像：石台座上的銅像（朝右的馬、舉起的前腳、頭盔上細長的三日月前立）。x 台座中心、y 台座上緣、s 大小 */
function masamune(x: number, y: number, s: number): string {
  const horse =
    `M26 -34 L26 -44 C28 -50 31 -55 34 -58 L40 -58 L50 -55 C53 -56 54 -59 52 -61 L46 -68 L39 -74 L37 -80 L34 -74 C30 -70 26 -64 22 -58 C20 -52 17 -49 14 -48 C4 -46 -12 -46 -22 -46 C-27 -45 -29 -40 -28 -34 L-27 -26 C-20 -22 14 -22 20 -24 C24 -26 26 -30 26 -34Z ` +
    `M-28 -42 C-36 -38 -36 -22 -32 -10 L-29 -11 C-31 -22 -30 -32 -26 -38Z ` +
    `M10 -46 C12 -56 10 -66 4 -70 L-4 -70 C-8 -64 -8 -54 -6 -46Z M4 -46 L8 -34 L4 -32 L-2 -44Z ` +
    `M16 -86 Q2 -78 -16 -91 Q1 -82 16 -86Z`
  return (
    // 台座
    G(Q(box(x - 34 * s, y + 66 * s, 68 * s, 10 * s), C.grey) + Q(box(x - 28 * s, y + 4 * s, 56 * s, 62 * s), C.grey) + Q(box(x - 32 * s, y - 2, 64 * s, 8 * s), C.grey)) +
    S(box(x + 14 * s, y + 4 * s, 14 * s, 62 * s)) +
    L(`M${r(x - 28 * s)} ${r(y + 24 * s)} H${r(x + 28 * s)} M${r(x - 28 * s)} ${r(y + 46 * s)} H${r(x + 28 * s)}`, 1, C.ink, 0.15) +
    // 銅像
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    L(`M20 -26 L28 -14 L24 -6 M14 -24 L16 0 M-18 -26 L-20 -12 L-18 0 M-24 -28 L-28 -12 L-26 0`, 5, C.ink, 0.8) +
    F(horse, C.ink, 0.8) +
    `<circle cx="0" cy="-75" r="5.6" fill="${C.ink}" opacity=".8"/>` +
    L(`M6 -62 L18 -56 L30 -60`, 2.6, C.ink, 0.8) +
    L(`M30 -50 C24 -54 18 -50 12 -47 M-2 -66 C-4 -58 -4 -52 -2 -46`, 1.2, C.green, 0.6) +
    `</g>`
  )
}
/** 仙台七夕的吹き流し：竹竿、上面的くす玉、垂下來的彩色紙帶。x、球心 y、球半徑 rr、紙帶到 y1 */
function fukinagashi(list: Array<[number, number, number, number]>): string {
  const cols = [C.pink, C.yellow, C.blue, C.green, C.red, C.purple, C.orange, C.white]
  const strips: string[] = cols.map(() => '')
  let balls = ''
  let dotsW = ''
  let poles = ''
  let bands = ''
  list.forEach(([x, y, rr, y1], j) => {
    poles += `M${x} 58 L${x} ${y - rr}`
    balls += `<circle cx="${x}" cy="${y}" r="${rr}"/>`
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + j
      dotsW += `<circle cx="${r(x + Math.cos(a) * rr * 0.6)}" cy="${r(y + Math.sin(a) * rr * 0.6)}" r="${r(rr * 0.13)}"/>`
    }
    const n = Math.max(5, Math.round(rr * 0.5))
    const w = (rr * 2.1) / n
    for (let i = 0; i < n; i++) {
      const xa = x - rr * 1.05 + i * w
      const sway = ((i % 3) - 1) * rr * 0.12
      const top = y + Math.sqrt(Math.max(0, rr * rr - (xa + w / 2 - x) ** 2)) * 0.8
      strips[(i + j * 3) % cols.length] += `M${r(xa)} ${r(top)} L${r(xa + w)} ${r(top)} Q${r(xa + w + sway)} ${r((top + y1) / 2)} ${r(xa + w + sway * 0.6 + (xa - x) * 0.08)} ${y1 - (i % 2) * rr * 0.4} L${r(xa + sway * 0.6 + (xa - x) * 0.08)} ${y1 - (i % 2) * rr * 0.4} Q${r(xa + sway)} ${r((top + y1) / 2)} ${r(xa)} ${r(top)}Z `
    }
    bands += `M${r(x - rr * 1.05)} ${r(y + rr * 1.5)} L${r(x + rr * 1.05)} ${r(y + rr * 1.5)} M${r(x - rr * 1.08)} ${r(y + rr * 2.6)} L${r(x + rr * 1.08)} ${r(y + rr * 2.6)}`
  })
  return (
    L(poles, 1.4, C.green, 0.7) +
    G(strips.map((d, i) => (d ? Q(d, cols[i]) : '')).join('')) +
    L(bands, 1.6, C.white, 0.7) +
    `<g fill="${C.pink}" ${E}>${balls}</g><g fill="${C.white}" opacity=".85">${dotsW}</g>`
  )
}
/** 松島的五大堂：小島岩上寶形造的佛堂、緣側的欄杆、寶珠。x 中心、y 地板 */
function godaido(x: number, y: number): string {
  return (
    G(
      Q(`M${x - 34} ${y - 30} Q${x - 14} ${y - 38} ${x - 4} ${y - 58} L${x + 4} ${y - 58} Q${x + 14} ${y - 38} ${x + 34} ${y - 30} L${x + 32} ${y - 26} L${x - 32} ${y - 26}Z`, C.ink) +
        Q(box(x - 20, y - 26, 40, 26), C.brown) +
        Q(box(x - 28, y, 56, 4), C.brown) +
        Q(`M${x - 3} ${y - 58} L${x + 3} ${y - 58} L${x + 2} ${y - 62} C${x + 4} ${y - 66} ${x + 2} ${y - 70} ${x} ${y - 72} C${x - 2} ${y - 70} ${x - 4} ${y - 66} ${x - 2} ${y - 62}Z`, C.gold),
    ) +
    F(box(x - 8, y - 22, 16, 22), C.ink, 0.45) +
    L(`M${x - 28} ${y - 6} H${x + 28} M${x - 26} ${y - 6} V${y} M${x - 14} ${y - 6} V${y} M${x + 14} ${y - 6} V${y} M${x + 26} ${y - 6} V${y} M${x - 20} ${y + 4} V${y + 16} M${x + 20} ${y + 4} V${y + 16}`, 1.4, C.ink, 0.6) +
    L(`M${x - 18} ${y - 25} H${x + 18}`, 2, C.gold, 0.7)
  )
}

/** 松島灣裡的小島：白灰色的岩壁、頂上一團團的松。[x, 水面 y, 寬, 高] */
function isles(list: Array<[number, number, number, number]>, op: number): string {
  const rock = list.map(([x, y, w, h]) => `M${x - w / 2} ${y} C${x - w / 2} ${r(y - h * 0.6)} ${r(x - w * 0.42)} ${y - h} ${r(x - w * 0.15)} ${y - h} L${r(x + w * 0.2)} ${y - h} C${r(x + w * 0.45)} ${y - h} ${x + w / 2} ${r(y - h * 0.5)} ${x + w / 2} ${y}Z`).join(' ')
  const tops: Pt3[] = list.flatMap(([x, y, w, h]): Pt3[] => [[r(x - w * 0.22), y - h, r(w * 0.2)], [r(x + w * 0.12), r(y - h - w * 0.05), r(w * 0.24)]])
  return `<g opacity="${op}">` + P(rock, C.grey) + F(rock, C.orange, 0.15) + clumps(tops, C.green) + F(list.map(([x, y, w]) => box(x - w / 2, y - 2, w, 2)).join(' '), C.ink, 0.2) + `</g>`
}

const MIYAGI: Outfit[] = [
  // 仙台城（data/spots/miyagi.json wd-Q598621，https://zh.wikipedia.org/wiki/%E4%BB%99%E5%8F%B0%E5%9F%8E）：本丸跡的伊達政宗騎馬像（三日月前立的頭盔），秋天的銀杏與楓，下面的仙台市街
  bg({
    id: 'bg-miyagi-sendai-castle',
    name: '仙台城跡',
    pref: 'miyagi',
    rarity: 1,
    art:
      sky(C.blue, 0.26) +
      cloud(70, 64, 1.1) +
      cloud(220, 40, 0.8, 0.8) +
      cloud(150, 150, 0.7, 0.7) +
      ridge([[-10, 238], [60, 232], [140, 236], [220, 230], [310, 234]], C.blue, 0.3, 300) +
      F(box(-4, 236, 308, 4), C.blue, 0.35) +
      F(box(4, 252, 14, 50) + box(22, 262, 12, 40) + box(40, 246, 16, 56) + box(60, 268, 12, 34) + box(96, 256, 14, 46) + box(118, 244, 16, 58) + box(150, 262, 14, 40) + box(172, 250, 18, 52) + box(196, 266, 12, 36) + box(214, 254, 16, 48) + box(244, 262, 14, 40) + box(266, 248, 18, 54) + box(288, 266, 14, 36), C.grey, 0.6) +
      L(`M8 262 v30 M44 256 v36 M122 254 v40 M176 260 v36 M218 264 v30 M270 258 v36`, 1.4, C.white, 0.5) +
      F(`M0 286 L300 286 L300 304 L0 304Z`, C.green, 0.4) +
      tree(40, 314, 2.2, C.yellow) +
      tree(96, 316, 1.5, C.red) +
      tree(286, 312, 1.4, C.orange) +
      P(`M0 304 L300 304 L300 318 L0 318Z`, C.grey) +
      L(`M20 304 V318 M60 304 V318 M100 304 V318 M140 304 V318 M180 304 V318 M220 304 V318 M260 304 V318`, 1, C.ink, 0.18) +
      masamune(218, 234, 1) +
      ground(C.cream, 318) +
      F(box(0, 318, 300, 82), C.grey, 0.3) +
      `<g fill="${C.yellow}">${[[30, 350], [70, 370], [120, 390], [210, 380], [250, 356], [280, 386], [150, 344]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="2"/>`).join('')}</g>`,
  }),
  // 仙台七夕（data/festivals/miyagi.json miyagi-Q9385159，https://zh.wikipedia.org/wiki/%E4%BB%99%E5%8F%B0%E4%B8%83%E5%A4%95%E7%A5%AD）：拱廊商店街裡一排排的吹流（竹竿、くす玉、垂下的彩色紙帶）
  bg({
    id: 'bg-miyagi-tanabata',
    name: '仙台七夕',
    pref: 'miyagi',
    rarity: 2,
    art:
      sky(C.yellow, 0.12, C.cream) +
      F(`M0 0 H300 V70 Q150 40 0 70Z`, C.white, 0.7) +
      L(`M0 70 Q150 40 300 70 M0 30 Q150 4 300 30 M40 0 L60 66 M150 0 V46 M260 0 L240 66`, 3, C.grey, 0.6) +
      // 兩側的店面
      P(`M-4 330 L-4 120 L116 250 L116 310Z`, C.cream) +
      P(`M304 330 L304 120 L184 250 L184 310Z`, C.cream) +
      F(`M-4 160 L116 264 L116 274 L-4 186Z M304 160 L184 264 L184 274 L304 186Z`, C.red, 0.55) +
      F(`M10 230 L40 250 L40 320 L10 322Z M60 262 L84 276 L84 316 L60 318Z M290 230 L260 250 L260 320 L290 322Z M240 262 L216 276 L216 316 L240 318Z`, C.navy, 0.3) +
      F(`M14 200 L36 216 L36 236 L14 222Z M286 200 L264 216 L264 236 L286 222Z`, C.yellow, 0.55) +
      fukinagashi([[128, 184, 9, 252], [172, 184, 9, 252], [96, 160, 14, 266], [204, 160, 14, 266], [52, 128, 22, 298], [248, 128, 22, 298]]) +
      ground(C.cream, 318) +
      F(box(0, 318, 300, 82), C.grey, 0.35) +
      L(`M150 318 L60 400 M150 318 L240 400 M150 318 L0 380 M150 318 L300 380 M0 340 H300 M0 366 H300`, 1.2, C.white, 0.5),
  }),
  // 松島（data/spots/miyagi.json wd-Q1144855，https://zh.wikipedia.org/wiki/%E6%9D%BE%E5%B3%B6）：夕陽下的松島灣：左邊小島上的五大堂與すかし橋，灣裡長著松的島，右邊遠處朱色的福浦橋
  bg({
    id: 'bg-miyagi-matsushima',
    name: '松島',
    pref: 'miyagi',
    rarity: 3,
    art:
      sky(C.blue, 0.2) +
      F(`M0 120 C60 112 110 126 160 118 C220 110 260 124 300 116 V260 H0Z`, C.pink, 0.22) +
      F(`M0 190 C50 184 100 196 150 188 C210 180 250 194 300 186 V260 H0Z`, C.orange, 0.32) +
      F(`M0 230 C60 226 120 234 170 228 C220 224 260 232 300 228 V260 H0Z`, C.yellow, 0.3) +
      cloud(64, 100, 1.2, 0.75) +
      sun(238, 214, 16, C.yellow, 0.95) +
      // 海
      F(box(0, 252, 300, 86), C.blue, 0.5) +
      F(box(0, 252, 300, 86), C.purple, 0.1) +
      L(`M222 262 h32 M226 272 h24 M218 284 h40 M228 298 h20 M220 312 h36 M230 326 h16 M60 300 h30 M120 320 h26`, 2, C.yellow, 0.75) +
      // 遠近的島：岩壁、頂上的松
      F(`M96 254 C100 246 112 246 116 254Z M176 254 C180 244 194 244 198 254Z M20 254 C24 248 34 248 38 254Z`, C.navy, 0.3) +
      isles([[128, 266, 30, 18], [176, 262, 24, 14], [206, 270, 26, 16], [272, 262, 22, 12], [252, 268, 16, 10]], 0.75) +
      // 福浦橋
      F(box(176, 276, 128, 3), C.red) +
      L(`M176 272 H304 ` + Array.from({ length: 13 }, (_, i) => `M${180 + i * 10} 279 V288`).join(' '), 1.4, C.red, 0.95) +
      isles([[290, 292, 44, 30], [236, 312, 40, 28]], 1) +
      // 五大堂的小島
      P(`M18 336 C14 310 24 288 44 280 L96 278 C112 284 120 306 118 336Z`, C.grey) +
      F(`M18 336 C14 310 24 288 44 280 L96 278 C112 284 120 306 118 336Z`, C.orange, 0.15) +
      S(`M80 278 L96 278 C112 284 120 306 118 336 L96 336 C100 310 94 290 80 278Z`) +
      pines([[30, 288, 1.3, 1], [106, 286, 1.2, -1]]) +
      godaido(66, 276) +
      // 透かし橋
      F(`M-4 314 L22 306 L22 310 L-4 318Z`, C.brown) +
      L(`M2 316 V326 M14 312 V322 M-4 306 L22 298`, 1.6, C.brown, 0.9) +
      L(`M130 330 h30 M180 334 h40 M250 330 h30`, 1.4, C.white, 0.5) +
      ground(C.brown, 336, 0.25) +
      L(`M20 362 h14 M70 384 h10 M214 366 h14 M256 390 h12 M140 394 h8`, 2.4, C.grey, 0.5),
  }),
]

export const BG: Outfit[] = [...HOKKAIDO, ...AOMORI, ...IWATE, ...MIYAGI]
