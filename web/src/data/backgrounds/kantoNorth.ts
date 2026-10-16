import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, SH, shape, sky, sun, torii, tree } from './kit'

/**
 * 地區背景：茨城、栃木、群馬。題材取自 data/spots 的景點，出處是那筆景點的 summary.source_url。
 */

type Pt = [number, number]
const r1 = (v: number) => Math.round(v * 10) / 10
/** 固定 seed 的亂數（每次畫出來一樣） */
function rand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
/** 上緣是 f(x) 的一塊地（丘、花田）：從 x0 到 x1 每 step 取一點，底封到 base */
function hillD(f: (x: number) => number, x0: number, x1: number, base: number, step = 6): string {
  let d = `M${x0} ${base}`
  for (let x = x0; x < x1; x += step) d += `L${x} ${Math.round(f(x))}`
  return d + `L${x1} ${Math.round(f(x1))}L${x1} ${base}Z`
}
/** 一群小點（花、雪、浪花）：用圓頭的零長度線段畫（相對座標），比 <circle> 省字 */
function dotp(pts: Pt[], w: number, color: string, op = 1): string {
  if (!pts.length) return ''
  let d = ''
  let px = 0
  let py = 0
  for (const [fx, fy] of pts) {
    const x = Math.round(fx)
    const y = Math.round(fy)
    d += d ? `m${x - px} ${y - py}h0` : `M${x} ${y}h0`
    px = x
    py = y
  }
  return `<path d="${d.replace(/ -/g, '-')}" ${line(w, color, op)}/>`
}
/** 在 f(x) 以下的範圍撒 n 個點 */
function scatter(n: number, seed: number, x0: number, x1: number, f: (x: number) => number, yMax: number, pad = 3): Pt[] {
  const r = rand(seed)
  const out: Pt[] = []
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const x = x0 + r() * (x1 - x0)
    const y = f(x) + pad + r() * (yMax - f(x) - pad)
    if (y < yMax) out.push([x, y])
  }
  return out
}

// ---------- 茨城 ----------
const bell = (cx: number, top: number, w: number, base = 322) => (x: number) => base - (base - top) * Math.exp(-(((x - cx) / w) ** 2))
/** 天空的一層紙：上緣是起伏的波，往下鋪到地平線 */
function band(y: number, amp: number, fill: string, op: number, k = 0): string {
  let d = `M-4 330L-4 ${y}`
  for (let x = -4, i = k; x < 304; x += 40, i++) d += `Q${x + 20} ${y + (i % 2 ? amp : -amp)} ${x + 40} ${y}`
  return `<path d="${d}L304 330Z" fill="${fill}" opacity="${op}"/>`
}
/** 摩天輪：c 中心、r 半徑，車廂幾個顏色輪流 */
function ferris(cx: number, cy: number, r: number): string {
  const cols = [C.red, C.yellow, C.blue, C.green]
  const cars = cols.map(() => '')
  let spokes = ''
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const x = r1(cx + Math.cos(a) * r)
    const y = r1(cy + Math.sin(a) * r)
    spokes += `M${cx} ${cy}L${x} ${y}`
    cars[i % 4] += `M${r1(x - 2.6)} ${r1(y + 0.6)}h5.2v4.6h-5.2Z`
  }
  return (
    `<path d="M${cx} ${cy}L${cx - 24} ${cy + 100}M${cx} ${cy}L${cx + 24} ${cy + 100}" ${line(2.6, C.grey)}/>` +
    `<path d="${spokes}" ${line(0.8, C.grey, 0.8)}/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" ${line(2.2, C.grey)}/><circle cx="${cx}" cy="${cy}" r="${r - 5}" ${line(1, C.grey, 0.7)}/>` +
    `<circle cx="${cx}" cy="${cy}" r="3.4" fill="${C.grey}"/>` +
    cars.map((d, i) => `<path d="${d}" fill="${cols[i]}" ${E}/>`).join('')
  )
}

/** 沿著丘的等高線排成一列的點（花田的一行行花） */
function rows(f: (x: number) => number, off: number, w: number, gap: number, color: string, op: number): string {
  let d = ''
  for (let x = -4; x <= 304; x += 18) {
    const y = f(x) + off
    if (y < 322) d += `${d ? 'L' : 'M'}${x} ${Math.round(y)}`
  }
  return `<path d="${d}" ${line(w, color, op)} stroke-dasharray="0 ${gap}"/>`
}
/** 粉蝶花：五片藍色花瓣、白色花心，k 大小 */
function nemophila(pts: Pt[], k: number): string {
  const petals: Pt[] = []
  for (const [x, y] of pts) for (let i = 0; i < 5; i++) petals.push([x + Math.cos(i * 1.257 + x) * 3.4 * k, y + Math.sin(i * 1.257 + x) * 3.4 * k])
  return dotp(petals, 4.6 * k, C.blue, 0.95) + dotp(pts, 3 * k, C.white) + dotp(pts, 1 * k, C.navy, 0.45)
}

function hitachiSeaside(): string {
  const big = bell(76, 200, 118)
  const small = bell(270, 262, 62, 324)
  const hd = hillD(big, -4, 304, 324, 14)
  const sd = hillD(small, 150, 304, 324, 14)
  const field = scatter(38, 5, 0, 300, () => 324, 362, 0).filter(([x, y]) => Math.abs(x - 150) > 18 + (y - 320) * 0.7)
  return (
    sky(C.blue, 0.16) +
    cloud(70, 64, 1.15, 0.95) +
    cloud(228, 36, 0.8, 0.8) +
    ridge([[120, 288], [150, 278], [178, 284], [206, 274], [236, 280], [266, 272], [304, 280]], C.green, 0.3) +
    ferris(228, 196, 38) +
    // 見晴之丘：粉藍色的粉蝶花鋪滿整座丘，丘頂幾棵樹，一條小路爬上去
    `<path d="${hd}" fill="${C.white}"/><path d="${hd}" fill="${C.blue}" opacity=".52" ${E}/>` +

    tree(50, 205, 0.52, C.green) +
    tree(70, 201, 0.64, C.matcha) +
    `<path d="M126 322 C100 304 128 284 104 262 C88 248 80 228 74 204" ${line(3.4, C.cream)}/>` +
    [10, 24, 42, 64, 90].map((o, i) => rows(big, o, 1.6 + i * 0.3, 6 + i, C.blue, 0.75)).join('') +
    rows(big, 33, 1.4, 9, C.white, 0.8) +
    rows(big, 77, 1.8, 11, C.white, 0.8) +
    `<path d="${sd}" fill="${C.white}"/><path d="${sd}" fill="${C.blue}" opacity=".6" ${E}/>` +
    rows(small, 8, 2, 7, C.blue, 0.8) +
    rows(small, 22, 2.4, 8, C.blue, 0.8) +
    rows(small, 15, 1.4, 9, C.white, 0.8) +
    // 前景的花田與中間的步道，兩邊近處是大朵的粉蝶花
    ground(C.blue, 320, 0.55, C.white) +
    shape('M138 320 L162 320 L204 400 L96 400Z', C.cream) +
    `<path d="M138 320 L96 400 M162 320 L204 400" ${line(1.2, C.brown, 0.18)}/>` +
    dotp(field, 3.4, C.blue, 0.95) +
    dotp(field, 1.2, C.white, 0.95) +
    nemophila([[30, 352], [74, 360], [228, 358], [270, 350], [212, 384]], 0.9) +
    nemophila([[12, 384], [52, 392], [92, 382], [250, 390], [288, 378]], 1.3)
  )
}

/** 黑松：x,y 樹根、s 大小、dir 往哪邊斜（1 右、-1 左）；彎的樹幹、幾叢平的松葉 */
function pine(x: number, y: number, s: number, dir: number, fill: string = C.green): string {
  const tx = x + dir * 46 * s
  const ty = y - 140 * s
  const P = (dx: number, dy: number) => `${r1(tx + dir * dx * s)} ${r1(ty + dy * s)}`
  let out = shape(
    `M${r1(x - 7 * s)} ${y} C${r1(x - 4 * s)} ${r1(y - 70 * s)} ${P(-30, 40)} ${P(-3, 0)} L${P(3, 0)} C${P(-24, 46)} ${r1(x + 6 * s)} ${r1(y - 70 * s)} ${r1(x + 7 * s)} ${y}Z`,
    C.brown,
  )
  const pads: Array<[number, number, number]> = [
    [2, 0, 30],
    [-36, 24, 26],
    [30, 38, 22],
    [-12, 52, 20],
    [-30, 80, 18],
  ]
  let br = ''
  for (const [dx, dy] of pads) br += `M${P(-dx * 0.2 - 14 * (dy / 74), dy + 8)}L${P(dx * 0.6, dy + 2)}`
  out += `<path d="${br}" ${line(3 * s, C.brown)}/>`
  let pd = ''
  let sd = ''
  for (const [dx, dy, w0] of pads) {
    const w = w0 * s
    const h = w * 0.5
    const cx = tx + dir * dx * s
    const cy = ty + dy * s
    const X = (k: number) => r1(cx + w * k)
    const Y = (k: number) => r1(cy - h * k)
    pd += `M${X(-1)} ${Y(0)}Q${X(-1.05)} ${Y(0.8)} ${X(-0.6)} ${Y(0.9)}Q${X(-0.4)} ${Y(1.5)} ${X(0.05)} ${Y(1.2)}Q${X(0.5)} ${Y(1.6)} ${X(0.75)} ${Y(0.8)}Q${X(1.1)} ${Y(0.6)} ${X(1)} ${Y(0)}Q${X(0)} ${Y(-0.3)} ${X(-1)} ${Y(0)}Z`
    sd += `M${X(-1)} ${Y(0)}Q${X(0)} ${Y(-0.3)} ${X(1)} ${Y(0)}Q${X(0)} ${Y(0.4)} ${X(-1)} ${Y(0)}Z`
  }
  return out + shape(pd, fill) + `<path d="${sd}" ${SH}/>`
}
/** 礁石：鋸齒狀的上緣 */
const rock = (pts: Pt[], base: number, fill: string, op = 1) =>
  `<path d="M${pts[0][0]} ${base}${pts.map(([x, y]) => `L${x} ${y}`).join('')}L${pts[pts.length - 1][0]} ${base}Z" fill="${fill}" opacity="${op}" ${E}/>`

function oaraiIsosaki(): string {
  const wave = (y: number, x0: number, x1: number, op: number) => {
    let d = `M${x0} ${y}`
    for (let x = x0; x < x1; x += 16) d += 'q4 -3 8 0t8 0'
    return `<path d="${d}" ${line(1.4, C.white, op)}/>`
  }
  return (
    sky(C.pink, 0.14, C.cream) +
    `<path d="M-4 -4 L304 -4 L304 96 Q260 112 216 100 Q170 88 128 104 Q84 120 40 104 Q16 96 -4 104Z" fill="${C.purple}" opacity=".13"/>` +
    band(150, 6, C.orange, 0.13) +
    band(226, 5, C.yellow, 0.2, 1) +
    // 橫向的朝霞雲
    `<path d="M-4 164 C40 156 90 162 130 156 C112 168 60 172 -4 172Z M176 130 C218 124 262 128 304 122 L304 132 C262 138 218 138 176 130Z M190 202 C226 196 264 200 304 194 L304 202 C268 208 228 208 190 202Z" fill="${C.pink}" opacity=".6" ${E}/>` +
    `<path d="M14 212 C54 206 96 210 136 204 C116 214 66 220 14 212Z" fill="${C.white}" opacity=".55"/>` +
    sun(232, 256, 36, C.yellow, 0.2) +
    sun(232, 256, 22, C.yellow, 0.95) +
    // 海：水平線 y 262，朝陽照在海面的光
    `<rect y="262" width="300" height="62" fill="${C.cream}"/><rect y="262" width="300" height="62" fill="${C.blue}" opacity=".5" ${E}/>` +
    `<path d="M0 262 L300 262" ${line(1.2, C.white, 0.6)}/>` +
    [267, 273, 280, 288, 297].map((y, i) => `<path d="M${226 - i * 5} ${y} L${238 + i * 5} ${y}" ${line(2.2, C.yellow, 0.85 - i * 0.1)}/>`).join('') +
    wave(278, -4, 170, 0.4) +
    wave(292, -8, 200, 0.5) +
    wave(306, 90, 200, 0.55) +
    // 神磯：立在海中岩石上的鳥居，浪打在岩上
    rock([[194, 322], [202, 306], [212, 301], [222, 297], [234, 299], [246, 296], [258, 301], [268, 305], [278, 322]], 324, C.navy, 0.82) +
    `<path d="M212 301 L222 297 L234 299 L230 306 L214 306Z" fill="${C.white}" opacity=".14"/>` +
    `<g opacity=".94">${torii(236, 299, 0.84, C.navy)}</g>` +
    cloud(204, 314, 0.48, 0.95) +
    cloud(280, 316, 0.4, 0.9) +
    dotp([[194, 297], [188, 302], [199, 292], [284, 304], [289, 298], [281, 296]], 2.2, C.white, 0.9) +
    // 左邊的岩岸與黑松
    rock([[-4, 296], [12, 288], [28, 282], [46, 286], [62, 294], [78, 302], [92, 322]], 324, C.navy, 0.66) +
    cloud(92, 318, 0.44, 0.92) +
    pine(32, 290, 0.84, 1, C.green) +
    // 腳下的岩礁：朝陽照亮的岩面、潮池
    ground(C.brown, 320, 0.3) +
    wave(323, -4, 300, 0.7) +
    `<path d="M-4 400 L-4 346 Q10 332 34 336 Q60 334 76 350 Q96 366 92 400Z M206 400 Q214 362 236 354 Q256 340 284 342 Q300 340 304 344 L304 400Z" fill="${C.navy}" opacity=".42" ${E}/>` +
    `<path d="M-4 352 Q12 338 34 341 Q58 340 72 352 Q50 346 30 348 Q10 348 -4 358Z M220 362 Q240 348 266 346 Q290 344 304 350 L304 356 Q284 350 262 352 Q240 354 220 362Z" fill="${C.orange}" opacity=".4"/>` +
    `<path d="M104 368 C130 358 172 358 198 368 C176 380 128 380 104 368Z" fill="${C.blue}" opacity=".36" ${E}/>` +
    `<path d="M128 366 L150 366 M160 371 L178 371 M20 360 L40 362 M250 358 L272 356" ${line(1.4, C.yellow, 0.8)}/>` +
    dotp([[100, 340], [196, 344], [120, 392], [180, 388], [24, 366], [276, 368]], 3, C.navy, 0.25)
  )
}

/** 牛久大佛：x 中心、y 台座底。阿彌陀如來立像：右手舉在胸前、左手垂下，衣服蓋住兩肩、袖子垂到膝 */
function daibutsu(x: number, y: number): string {
  const b = C.grey
  const P = (dx: number, dy: number) => `${r1(x + dx)} ${r1(y - dy)}`
  // 台座與蓮花座
  let out = shape(`M${P(-32, 0)}L${P(32, 0)}L${P(30, 14)}L${P(-30, 14)}Z M${P(-22, 14)}L${P(22, 14)}L${P(27, 28)}L${P(-27, 28)}Z`, b)
  out += `<path d="M${P(10, 0)}L${P(32, 0)}L${P(30, 14)}L${P(10, 14)}Z" ${SH}/>`
  let petals = ''
  for (let i = -3; i <= 3; i++) petals += `M${P(i * 7.4 - 3.7, 28)} Q${P(i * 7.4, 13)} ${P(i * 7.4 + 3.7, 28)}`
  out += `<path d="${petals}" ${line(1, C.white, 0.4)}/>`
  // 衣：肩、兩邊垂下的袖子、裙襬
  const robe = `M${P(-5, 168)} C${P(-14, 168)} ${P(-21, 164)} ${P(-23, 156)} L${P(-25, 82)} C${P(-25, 78)} ${P(-21, 76)} ${P(-17, 78)} L${P(-17, 28)} L${P(17, 28)} L${P(17, 78)} C${P(21, 76)} ${P(25, 78)} ${P(25, 82)} L${P(23, 156)} C${P(21, 164)} ${P(14, 168)} ${P(5, 168)}Z`
  out += shape(robe, b) + `<path d="${robe}" fill="${C.green}" opacity=".12"/>`
  out += `<path d="M${P(9, 167)} C${P(15, 166)} ${P(21, 164)} ${P(23, 156)} L${P(25, 82)} C${P(25, 78)} ${P(21, 76)} ${P(17, 78)} L${P(17, 28)} L${P(9, 28)}Z" ${SH}/>`
  // 衣褶：胸前的 U 字、袖子與裙襬的直線
  let f = ''
  for (let i = 0; i < 5; i++) f += `M${P(-14 + i, 156 - i * 13)} Q${P(0, 140 - i * 15)} ${P(14 - i, 156 - i * 13)}`
  f += `M${P(-21, 150)} L${P(-22, 86)} M${P(21, 150)} L${P(22, 86)} M${P(-9, 76)} L${P(-10, 30)} M${P(-2, 80)} L${P(-2, 30)} M${P(5, 80)} L${P(5, 30)} M${P(12, 76)} L${P(12, 30)}`
  out += `<path d="${f}" ${line(1, C.white, 0.32)}/>`
  // 手：右手（看過去在左）掌心朝前舉在胸前，左手（看過去在右）垂下
  out += shape(`M${P(-15, 112)}L${P(-9, 114)}L${P(-8, 128)}L${P(-14, 126)}Z M${P(-14, 126)}L${P(-7, 127)}L${P(-7, 138)}C${P(-7, 142)} ${P(-14, 142)} ${P(-14, 138)}Z M${P(9, 92)}L${P(15, 92)}L${P(15, 80)}C${P(15, 76)} ${P(9, 76)} ${P(9, 80)}Z`, b)
  out += `<path d="M${P(-12, 140)} L${P(-12, 133)} M${P(-9.5, 140)} L${P(-9.5, 133)} M${P(11, 79)} L${P(11, 85)} M${P(13.5, 79)} L${P(13.5, 85)}" ${line(0.6, C.ink, 0.3)}/>`
  // 頭：脖子、肉髻、螺髮、長耳
  out += shape(
    `M${P(-4, 166)}L${P(4, 166)}L${P(4, 174)}L${P(-4, 174)}Z M${P(-9, 184)}C${P(-10, 174)} ${P(-5, 171)} ${P(0, 171)}C${P(5, 171)} ${P(10, 174)} ${P(9, 184)}L${P(10, 190)}C${P(10, 199)} ${P(-10, 199)} ${P(-10, 190)}Z M${P(-5.5, 196)}C${P(-5.5, 204)} ${P(5.5, 204)} ${P(5.5, 196)}Z M${P(-10.5, 189)}L${P(-12.5, 188)}L${P(-12, 176)}L${P(-10, 177)}Z M${P(10.5, 189)}L${P(12.5, 188)}L${P(12, 176)}L${P(10, 177)}Z`,
    b,
  )
  out += `<path d="M${P(3, 171)} C${P(7, 171)} ${P(10, 174)} ${P(9, 184)} L${P(10, 190)} C${P(10, 196)} ${P(6, 198)} ${P(3, 198)}Z" ${SH}/>`
  const curls: Pt[] = []
  for (let i = 0; i < 7; i++) curls.push([x - 8 + i * 2.7, y - 192], [x - 6.5 + i * 2.2, y - 196.5])
  curls.push([x - 2.5, y - 200.5], [x, y - 201.5], [x + 2.5, y - 200.5])
  out += dotp(curls, 1.2, C.ink, 0.25)
  out += `<path d="M${P(-23, 152)} L${P(-25, 84)}" ${line(1, C.white, 0.45)}/>`
  return out
}

function ushikuDaibutsu(): string {
  const flowers = (x0: number, x1: number, y0: number, y1: number, seed: number, col: string) => dotp(scatter(24, seed, x0, x1, () => y0, y1, 0), 3.4, col, 0.92)
  return (
    sky(C.purple, 0.15, C.cream) +
    band(196, 7, C.orange, 0.14) +
    band(250, 6, C.pink, 0.2, 1) +
    sun(52, 276, 22, C.yellow, 0.75) +
    `<path d="M214 42 A14 14 0 1 0 232 60 A11 11 0 1 1 214 42Z" fill="${C.white}" opacity=".9" ${E}/>` +
    `<path d="M-4 150 C40 144 80 148 118 142 C100 152 50 156 -4 154Z M8 222 C46 216 90 220 126 214 C108 224 56 228 8 222Z" fill="${C.pink}" opacity=".5"/>` +
    cloud(270, 118, 0.62, 0.5, C.pink) +
    // 遠方的關東平原樹林
    ridge([[-4, 300], [24, 292], [52, 298], [86, 290], [120, 296], [154, 290], [190, 296], [224, 290], [262, 296], [304, 290]], C.green, 0.3) +
    daibutsu(234, 308) +
    ridge([[150, 316], [176, 308], [200, 312], [272, 312], [304, 308]], C.green, 0.5, 324) +
    tree(42, 324, 1.7, C.green) +
    tree(88, 324, 1.2, C.matcha) +
    tree(284, 324, 1.1, C.green) +
    ground(C.matcha, 320, 0.5) +
    // 參道與花圃
    shape('M110 400 L190 400 L242 320 L226 320Z', C.cream) +
    `<path d="M110 400 L226 320 M190 400 L242 320" ${line(1.2, C.brown, 0.16)}/>` +
    shape('M-4 344 Q40 334 96 342 L62 400 L-4 400Z', C.green, 'opacity=".55"') +
    shape('M304 334 Q252 334 212 346 L170 400 L304 400Z', C.green, 'opacity=".55"') +
    flowers(4, 84, 344, 398, 3, C.pink) +
    flowers(4, 84, 344, 398, 13, C.yellow) +
    flowers(206, 298, 344, 398, 23, C.pink) +
    flowers(206, 298, 344, 398, 31, C.white)
  )
}

const IBARAKI: Outfit[] = [
  // 国営ひたち海浜公園（data/spots/ibaraki.json wd-Q10855585，https://zh.wikipedia.org/wiki/%E5%9C%8B%E7%87%9F%E5%B8%B8%E9%99%B8%E6%B5%B7%E6%BF%B1%E5%85%AC%E5%9C%92）：春天開滿粉蝶花、整片變藍的見晴之丘，丘頂的樹與小路，丘後的大摩天輪
  bg({ id: 'bg-ibaraki-hitachi-seaside', name: '常陸海濱公園', pref: 'ibaraki', rarity: 3, art: hitachiSeaside() }),
  // 大洗磯前神社（data/spots/ibaraki.json wd-Q11437230，https://zh.wikipedia.org/wiki/%E5%A4%A7%E6%B4%97%E7%9F%B6%E5%89%8D%E7%A5%9E%E7%A4%BE）：日出時立在海中岩石上的神磯鳥居、打上岩石的浪、岸邊的黑松與岩礁
  bg({ id: 'bg-ibaraki-oarai-isosaki', name: '大洗磯前神社', pref: 'ibaraki', rarity: 2, art: oaraiIsosaki() }),
  // 牛久大仏（data/spots/ibaraki.json wd-Q542324，https://zh.wikipedia.org/wiki/%E7%89%9B%E4%B9%85%E5%A4%A7%E4%BD%9B）：黃昏的天空下青銅的阿彌陀如來立像與蓮花座，參道、花圃與樹
  bg({ id: 'bg-ibaraki-ushiku-daibutsu', name: '牛久大佛', pref: 'ibaraki', rarity: 1, art: ushikuDaibutsu() }),
]

// ---------- 栃木 ----------
/** 杉林的剪影：一排尖的樹梢（一條 path） */
function spikes(x0: number, x1: number, y: number, h: number, w: number, seed: number): Pt[] {
  const r = rand(seed)
  const pts: Pt[] = [[x0, y]]
  for (let x = x0; x < x1; x += w) pts.push([x + w / 2, Math.round(y - h * (0.6 + r() * 0.4))], [x + w, y])
  return pts
}
/** 石燈籠：x 中心、y 底、s 大小，笠上積雪 */
function lantern(x: number, y: number, s: number, snow = true): string {
  const P = (dx: number, dy: number) => `${r1(x + dx * s)} ${r1(y - dy * s)}`
  return (
    shape(`M${P(-10, 0)}L${P(10, 0)}L${P(8, 6)}L${P(-8, 6)}Z M${P(-3, 6)}L${P(3, 6)}L${P(3, 26)}L${P(-3, 26)}Z M${P(-8, 26)}L${P(8, 26)}L${P(6, 30)}L${P(-6, 30)}Z M${P(-6, 30)}L${P(6, 30)}L${P(6, 42)}L${P(-6, 42)}Z M${P(-14, 42)}Q${P(0, 46)} ${P(14, 42)}L${P(13, 46)}L${P(0, 53)}L${P(-13, 46)}Z M${P(-2.5, 53)}C${P(-3, 58)} ${P(3, 58)} ${P(2.5, 53)}Z`, C.grey) +
    `<path d="M${P(-3, 33)}L${P(3, 33)}L${P(3, 39)}L${P(-3, 39)}Z" fill="${C.ink}" opacity=".45"/>` +
    `<path d="M${P(2, 6)}L${P(3, 6)}L${P(3, 26)}L${P(2, 26)}Z M${P(3, 30)}L${P(6, 30)}L${P(6, 42)}L${P(3, 42)}Z" ${SH}/>` +
    (snow ? shape(`M${P(-14, 43)}Q${P(-6, 52)} ${P(0, 54)}Q${P(6, 52)} ${P(14, 43)}Q${P(0, 47)} ${P(-14, 43)}Z`, C.white) : '')
  )
}
/** 陽明門：x 中心、y 基壇底、s 大小。白柱、金色與彩色的斗栱、白色欄杆、黑色銅瓦屋頂（正面的唐破風），屋頂積雪 */
function yomeimon(x: number, y: number, s: number): string {
  const P = (dx: number, dy: number) => `${r1(x + dx * s)} ${r1(y - dy * s)}`
  const R = (x0: number, y0: number, x1: number, y1: number) => `M${P(x0, y0)}L${P(x1, y0)}L${P(x1, y1)}L${P(x0, y1)}Z`
  const band = (x0: number, x1: number, dy: number, col: string, w: number, dash: string, op = 1) =>
    `<path d="M${P(x0, dy)}L${P(x1, dy)}" fill="none" stroke="${col}" stroke-width="${r1(w * s)}" stroke-dasharray="${dash}" stroke-opacity="${op}"/>`
  const eave = `M${P(-52, 120)}Q${P(-40, 125)} ${P(-24, 125)}L${P(-12, 125)}C${P(-7, 125)} ${P(-6, 134)} ${P(0, 134)}C${P(6, 134)} ${P(7, 125)} ${P(12, 125)}L${P(24, 125)}Q${P(40, 125)} ${P(52, 120)}`
  return (
    // 基壇
    shape(R(-46, 0, 46, 14), C.grey) +
    `<path d="M${P(-46, 7)}L${P(46, 7)}" ${line(1, C.ink, 0.15)}/>` +
    shape(R(-47, 13, 47, 16), C.white) +
    // 下層：裡面暗、兩側的隨身像、四根白柱
    `<path d="${R(-33, 16, 33, 62)}" fill="${C.navy}" opacity=".55"/>` +
    shape(`M${P(-26, 16)}L${P(-18, 16)}L${P(-19, 36)}L${P(-20, 42)}C${P(-20, 46)} ${P(-24, 46)} ${P(-24, 42)}L${P(-25, 36)}Z M${P(18, 16)}L${P(26, 16)}L${P(25, 36)}L${P(24, 42)}C${P(24, 46)} ${P(20, 46)} ${P(20, 42)}L${P(19, 36)}Z`, C.red) +
    shape(`${R(-36, 16, -31, 62)} ${R(-13, 16, -8, 62)} ${R(8, 16, 13, 62)} ${R(31, 16, 36, 62)}`, C.white) +
    `<path d="${R(-33.5, 16, -31, 62)} ${R(-10.5, 16, -8, 62)} ${R(10.5, 16, 13, 62)} ${R(33.5, 16, 36, 62)}" ${SH}/>` +
    // 下層的斗栱（金色底，藍、綠、朱的雕刻）
    shape(R(-40, 62, 40, 76), C.gold) +
    band(-39, 39, 65, C.blue, 3, '3 2') +
    band(-39, 39, 69, C.green, 3, '2 3') +
    band(-38, 38, 73, C.red, 2, '2 2') +
    // 白色欄杆
    shape(R(-45, 76, 45, 86), C.white) +
    band(-44, 44, 81, C.ink, 9, '1.2 6', 0.3) +
    `<path d="M${P(-45, 86)}L${P(45, 86)}" ${line(1.6, C.gold)}/>` +
    // 上層
    shape(R(-30, 86, 30, 110), C.white) +
    `<path d="${R(-25, 90, -14, 106)} ${R(-6, 90, 6, 106)} ${R(14, 90, 25, 106)}" fill="${C.gold}" opacity=".85"/>` +
    dotp([[-20, 98], [0, 98], [20, 98], [-17, 94], [3, 102], [17, 102]].map(([a, b]) => [x + a * s, y - b * s] as Pt), 3, C.green, 0.9) +
    dotp([[-22, 102], [-3, 94], [22, 94]].map(([a, b]) => [x + a * s, y - b * s] as Pt), 3, C.blue, 0.9) +
    `<path d="${R(18, 86, 30, 110)}" ${SH}/>` +
    // 上層的斗栱
    shape(R(-40, 110, 40, 122), C.gold) +
    band(-39, 39, 113, C.green, 3, '3 2') +
    band(-39, 39, 117.5, C.blue, 3, '2 3') +
    // 屋頂：翹起的屋簷、正面的唐破風、往上收的屋面；積雪
    shape(`${eave}Q${P(34, 128)} ${P(28, 154)}L${P(-28, 154)}Q${P(-34, 128)} ${P(-52, 120)}Z`, C.ink) +
    `<path d="${eave}" ${line(1.4, C.gold)}/>` +
    shape(`M${P(-47, 127)}Q${P(-38, 130)} ${P(-24, 130)}L${P(-12, 130)}C${P(-6, 131)} ${P(-5, 139)} ${P(0, 139)}C${P(5, 139)} ${P(6, 131)} ${P(12, 130)}L${P(24, 130)}Q${P(38, 130)} ${P(47, 127)}Q${P(32, 131)} ${P(27, 155)}L${P(-27, 155)}Q${P(-32, 131)} ${P(-47, 127)}Z`, C.white) +
    `<path d="M${P(5, 139)}C${P(5, 139)} ${P(6, 131)} ${P(12, 130)}L${P(24, 130)}Q${P(38, 130)} ${P(47, 127)}Q${P(32, 131)} ${P(27, 155)}L${P(5, 155)}Z" fill="${C.blue}" opacity=".1"/>` +
    shape(R(-30, 155, 30, 160), C.ink) +
    shape(`M${P(-33, 154)}L${P(-28, 154)}L${P(-28, 166)}L${P(-32, 165)}Z M${P(28, 154)}L${P(33, 154)}L${P(32, 165)}L${P(28, 166)}Z`, C.gold) +
    shape(R(-28, 160, 28, 162.5), C.white)
  )
}
/** 五重塔（東照宮）：x 中心、y 台基上緣、s 大小；朱塗的塔身、每層的斗栱、黑色屋頂上積雪 */
function pagodaSnow(x: number, y: number, s: number): string {
  const n = (v: number) => r1(v)
  let body = ''
  let sh = ''
  let roof = ''
  let snow = ''
  let brk = ''
  let bottom = y
  for (let i = 0; i < 5; i++) {
    const bw = (24 - i * 2.2) * s
    const rw = (54 - i * 4.6) * s
    const top = bottom - (i === 0 ? 18 : 13) * s
    body += `M${n(x - bw / 2)} ${n(bottom)}H${n(x + bw / 2)}V${n(top)}H${n(x - bw / 2)}Z`
    sh += `M${n(x + bw / 2 - 4 * s)} ${n(bottom)}H${n(x + bw / 2)}V${n(top)}H${n(x + bw / 2 - 4 * s)}Z`
    brk += `M${n(x - bw / 2)} ${n(top + 2 * s)}H${n(x + bw / 2)}`
    roof += `M${n(x - rw / 2)} ${n(top + 1 * s)}C${n(x - rw / 4)} ${n(top - 2 * s)} ${n(x - rw / 6)} ${n(top - 7 * s)} ${n(x)} ${n(top - 7 * s)}C${n(x + rw / 6)} ${n(top - 7 * s)} ${n(x + rw / 4)} ${n(top - 2 * s)} ${n(x + rw / 2)} ${n(top + 1 * s)}L${n(x + rw / 2 - 3 * s)} ${n(top + 4 * s)}L${n(x - rw / 2 + 3 * s)} ${n(top + 4 * s)}Z`
    snow += `M${n(x - rw / 2 + 2 * s)} ${n(top - 0.4 * s)}C${n(x - rw / 4)} ${n(top - 3.4 * s)} ${n(x - rw / 6)} ${n(top - 8.5 * s)} ${n(x)} ${n(top - 8.5 * s)}C${n(x + rw / 6)} ${n(top - 8.5 * s)} ${n(x + rw / 4)} ${n(top - 3.4 * s)} ${n(x + rw / 2 - 2 * s)} ${n(top - 0.4 * s)}Q${n(x)} ${n(top - 4.5 * s)} ${n(x - rw / 2 + 2 * s)} ${n(top - 0.4 * s)}Z`
    bottom = top - 7 * s
  }
  let rings = `M${n(x)} ${n(bottom + 2 * s)}V${n(bottom - 34 * s)}`
  for (let i = 0; i < 9; i++) rings += `M${n(x - 4 * s)} ${n(bottom - (4 + i * 3) * s)}H${n(x + 4 * s)}`
  return (
    shape(`M${n(x - 22 * s)} ${n(y + 4 * s)}H${n(x + 22 * s)}L${n(x + 20 * s)} ${n(y)}H${n(x - 20 * s)}Z`, C.grey) +
    shape(body, C.red) +
    `<path d="${sh}" ${SH}/>` +
    `<path d="${brk}" fill="none" stroke="${C.green}" stroke-width="${n(3 * s)}" stroke-dasharray="2 2"/>` +
    shape(roof, C.ink) +
    shape(snow, C.white) +
    `<path d="${rings}" ${line(1.6 * s, C.gold)}/>`
  )
}
function nikkoToshogu(): string {
  const r = rand(17)
  const flakes: Pt[] = []
  for (let i = 0; i < 30; i++) flakes.push([r() * 300, r() * 390])
  const near = spikes(-12, 306, 290, 120, 30, 5)
  return (
    sky(C.grey, 0.22) +
    // 杉林：遠的淡、近的深，樹梢積雪
    ridge(spikes(-6, 306, 250, 90, 22, 3), C.green, 0.28, 324, false) +
    ridge(near, C.green, 0.48, 324, false) +
    `<path d="${near.slice(1).filter((_, i) => i % 2 === 0).map(([a, b]) => `M${a - 4} ${b + 12}L${a} ${b + 6}L${a + 4} ${b + 12}`).join('')}" ${line(2, C.white, 0.7)}/>` +
    pagodaSnow(56, 318, 1) +
    yomeimon(220, 318, 1) +
    ground(C.white, 320, 0.9, C.grey) +
    shape('M196 320 L248 320 L304 400 L146 400Z', C.grey, 'opacity=".35"') +
    `<path d="M192 336 L258 336 M184 354 L270 354 M172 376 L288 376" ${line(1.2, C.white, 0.6)}/>` +
    lantern(98, 334, 1) +
    lantern(44, 360, 1) +
    `<path d="M0 334 Q40 330 80 336 M40 372 Q70 368 100 374" ${line(1.4, C.blue, 0.12)}/>` +
    dotp(flakes, 2.6, C.white, 0.95)
  )
}

function ashikagaFlowerPark(): string {
  const r = rand(29)
  const stars: Pt[] = []
  for (let i = 0; i < 18; i++) stars.push([10 + r() * 280, 6 + r() * 90])
  // 花穗：一朵朵小花排成一串，上大下小、微微左右錯開；紫的與粉紫的兩組
  const W = [6.4, 5.2, 4, 2.8]
  const fl: Pt[][][] = [W.map(() => []), W.map(() => [])]
  const hi: Pt[] = []
  for (let i = 0; i < 42; i++) {
    const x = -2 + i * 7.4 + r() * 3
    const top = 150 + Math.abs(x - 150) * 0.08 + r() * 8
    const L = 30 + r() * 40 + (Math.abs(x - 150) > 70 ? 24 : 0)
    const n = Math.round(L / 4.8)
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1)
      fl[i % 2][t < 0.3 ? 0 : t < 0.6 ? 1 : t < 0.85 ? 2 : 3].push([x + (r() - 0.5) * 3.4 * (1 - t * 0.5), top + t * L])
    }
    if (i % 3 === 0) hi.push([x - 1.5, top + L * 0.15])
  }
  // 花棚本身：一整片密密的花
  const mass: Pt[] = []
  for (let i = 0; i < 38; i++) {
    const x = i * 8 + r() * 4
    const top = 108 + r() * 14
    for (let k = 0; k < 5; k++) mass.push([x + (r() - 0.5) * 3, top + k * 5.2])
  }
  const flowers = (g: Pt[][], col: string, op: number) => g.map((p, k) => dotp(p, W[k], col, op)).join('')
  return (
    sky(C.navy, 0.74, C.cream) +
    dotp(stars, 1.6, C.white, 0.8) +
    sun(240, 52, 13, C.cream, 0.9) +
    // 遠處也打著燈的花棚
    ridge([[-4, 300], [30, 286], [70, 294], [110, 284], [150, 292], [190, 282], [230, 292], [270, 284], [304, 292]], C.purple, 0.35) +
    // 撐棚的柱子、扭曲的老樹幹與往兩邊伸的枝
    `<path d="M24 160 L24 322 M96 166 L96 322 M204 166 L204 322 M276 160 L276 322" ${line(3, C.brown, 0.7)}/>` +
    shape('M50 324 C46 290 62 270 52 240 C44 214 58 190 46 156 L58 154 C70 186 60 212 68 236 C76 262 64 292 72 324Z', C.brown) +
    `<path d="M60 236 C64 262 62 292 72 324 L64 324 C58 292 62 262 58 236Z" ${SH}/>` +
    `<path d="M50 160 C30 154 10 150 -4 150 M56 158 C80 146 110 142 140 142 M52 196 C40 190 26 184 16 174" ${line(5, C.brown)}/>` +
    // 花棚：上面是葉，下緣一圈圈的花
    `<path d="M-4 108 Q14 96 36 104 Q58 92 80 102 Q104 90 126 100 Q150 88 172 100 Q196 90 218 102 Q242 92 264 102 Q284 94 304 102 L304 156 Q290 166 274 158 Q258 168 240 158 Q222 168 204 158 Q186 168 168 158 Q150 168 132 158 Q114 168 96 158 Q78 168 60 158 Q42 168 24 158 Q10 166 -4 156Z" fill="${C.purple}" opacity=".55" ${E}/>` +
    `<path d="M-4 108 Q14 96 36 104 Q58 92 80 102 Q104 90 126 100 Q150 88 172 100 Q196 90 218 102 Q242 92 264 102 Q284 94 304 102 L304 118 Q260 112 220 120 Q180 112 140 120 Q100 112 60 120 Q30 114 -4 120Z" fill="${C.green}" opacity=".35"/>` +
    dotp(mass, 5.6, C.purple, 0.8) +
    dotp(mass.filter((_, i) => i % 5 === 2), 5, C.pink, 0.8) +
    flowers(fl[0], C.purple, 0.95) +
    flowers(fl[1], C.pink, 0.92) +
    dotp(hi, 2, C.white, 0.6) +
    // 地面：花棚下被照亮的地、落下的花
    ground(C.navy, 320, 0.55, C.cream) +
    `<path d="M-4 324 Q150 312 304 324 L304 352 Q150 340 -4 352Z" fill="${C.purple}" opacity=".3"/>` +
    `<path d="M120 400 L136 322 L164 322 L180 400Z" fill="${C.cream}" opacity=".3"/>` +
    dotp(scatter(30, 37, 0, 300, () => 326, 398, 0), 2.4, C.pink, 0.7)
  )
}

function kegonFalls(): string {
  const autumn = [C.orange, C.red, C.yellow]
  const trees = (pts: Array<[number, number, number]>) => pts.map(([x, y, s], i) => tree(x, y, s, autumn[i % 3])).join('')
  /** 紅葉林的上緣：一排小圓頂 */
  const canopy = (x0: number, x1: number, y: number, k: number, seed: number) => {
    const r = rand(seed)
    const pts: Pt[] = []
    for (let x = x0; x <= x1; x += k) pts.push([x, Math.round(y + (r() - 0.5) * k * 0.7)])
    return pts
  }
  return (
    sky(C.blue, 0.26) +
    cloud(72, 52, 1, 0.9) +
    cloud(250, 84, 0.7, 0.8) +
    // 左邊：遠山、一層層紅葉的山坡
    ridge([[-4, 214], [40, 184], [90, 198], [130, 176], [180, 196]], C.blue, 0.22) +
    ridge(canopy(-4, 170, 228, 18, 3), C.orange, 0.42) +
    ridge(canopy(-4, 170, 258, 16, 5), C.red, 0.5) +
    ridge(canopy(-4, 170, 288, 14, 7), C.yellow, 0.7) +
    // 右邊的岩壁，瀑布從上緣的缺口落下
    shape('M146 324 L152 228 L164 172 L186 136 L210 114 L224 118 L240 118 L252 108 L276 116 L304 104 L304 324Z', C.grey) +
    `<path d="M146 324 L152 228 L164 172 L186 136 L210 114 L224 118 L240 118 L252 108 L276 116 L304 104 L304 324Z" fill="${C.brown}" opacity=".24"/>` +
    `<path d="M160 230 C170 214 184 216 192 200 L196 240 C182 236 172 246 160 250Z M254 150 C264 140 280 146 292 134 L296 180 C282 176 268 184 256 190Z" fill="${C.ink}" opacity=".08"/>` +
    `<path d="M172 300 L174 180 M188 300 L190 150 M204 300 L205 128 M258 300 L258 128 M272 300 L273 122 M288 300 L290 112" ${line(1.2, C.ink, 0.14)}/>` +
    `<path d="M252 108 L276 116 L304 104 L304 324 L268 324 Q258 220 252 108Z" ${SH}/>` +
    dotp([[168, 196], [176, 190], [190, 220], [262, 176], [280, 206], [292, 160], [184, 262]], 6, C.orange, 0.85) +
    dotp([[172, 188], [258, 172], [286, 212], [196, 258]], 5, C.red, 0.8) +
    trees([[172, 162, 0.7], [194, 134, 0.8], [264, 114, 0.7], [288, 108, 0.75]]) +
    // 華嚴瀑布：細長直落的一道，兩邊的細瀑，下面的水花
    shape('M224 118 L240 118 L246 300 L218 300Z', C.white) +
    `<path d="M229 126 L227 296 M236 126 L238 296" ${line(1.2, C.blue, 0.3)}/>` +
    `<path d="M196 236 L195 292 M206 250 L205 292 M262 230 L264 292 M274 244 L275 292" ${line(2, C.white, 0.85)}/>` +
    cloud(232, 306, 1.1, 0.95) +
    cloud(206, 312, 0.6, 0.85) +
    cloud(262, 312, 0.7, 0.85) +
    // 瀑潭與岸邊
    `<path d="M146 312 Q230 304 304 312 L304 324 L146 324Z" fill="${C.green}" opacity=".5" ${E}/>` +
    trees([[34, 326, 1.3], [80, 326, 1]]) +
    ground(C.grey, 320, 0.45) +
    `<path d="M-4 400 L-4 344 Q40 334 70 348 Q90 360 96 400Z M210 400 Q220 352 260 344 Q290 340 304 346 L304 400Z" fill="${C.brown}" opacity=".3" ${E}/>` +
    dotp(scatter(26, 47, 0, 300, () => 324, 398, 0), 3, C.orange, 0.8) +
    dotp(scatter(16, 53, 0, 300, () => 324, 398, 0), 3, C.red, 0.7)
  )
}

const TOCHIGI: Outfit[] = [
  // 日光東照宮（data/spots/tochigi.json wd-Q696641，https://zh.wikipedia.org/wiki/%E6%97%A5%E5%85%89%E6%9D%B1%E7%85%A7%E5%AE%AE）：雪中的陽明門（白柱、金與彩色的斗栱、白色欄杆、唐破風屋頂）與朱色的五重塔，杉林、石燈籠
  bg({ id: 'bg-tochigi-nikko-toshogu', name: '日光東照宮', pref: 'tochigi', rarity: 3, art: nikkoToshogu() }),
  // あしかがフラワーパーク（data/spots/tochigi.json wd-Q11257294，https://zh.wikipedia.org/wiki/%E8%B6%B3%E5%88%A9%E8%8A%B1%E5%8D%89%E5%85%AC%E5%9C%92）：夜間點燈的大藤，整片花棚垂下的紫藤花穗、老樹幹與撐棚的柱子
  bg({ id: 'bg-tochigi-ashikaga-flower-park', name: '足利花卉公園', pref: 'tochigi', rarity: 2, art: ashikagaFlowerPark() }),
  // 華厳滝（data/spots/tochigi.json wd-Q37580，https://zh.wikipedia.org/wiki/%E8%8F%AF%E5%9A%B4%E7%80%91%E5%B8%83）：秋天，從岩壁缺口直落的瀑布、兩旁的細瀑（十二瀧）、紅葉的山坡
  bg({ id: 'bg-tochigi-kegon-falls', name: '華嚴瀑布', pref: 'tochigi', rarity: 1, art: kegonFalls() }),
]

// ---------- 群馬 ----------
/** 一排木造的旅館：bs 是 [x, 寬, 高]，底在 y；一樓、二樓的紙窗透出燈光，中間的屋簷與屋頂積雪 */
function ryokanRow(bs: Array<[number, number, number]>, y: number): string {
  let body = ''
  let roof = ''
  let snow = ''
  let shoji = ''
  let lattice = ''
  for (const [x, w, h] of bs) {
    const t = y - h
    const m = y - Math.round(h * 0.48)
    body += `M${x} ${y}V${t}H${x + w}V${y}Z`
    roof += `M${x - 4} ${t + 1}L${x + 4} ${t - 9}H${x + w - 4}L${x + w + 4} ${t + 1}Z M${x - 3} ${m}L${x + w + 3} ${m}L${x + w + 1} ${m - 5}H${x - 1}Z`
    snow += `M${x - 2} ${t - 1}L${x + 4} ${t - 9}H${x + w - 4}L${x + w + 2} ${t - 1}Q${x + w / 2} ${t - 4} ${x - 2} ${t - 1}Z M${x - 1} ${m - 5}H${x + w + 1}L${x + w} ${m - 7}H${x}Z`
    shoji += `M${x + 4} ${t + 6}H${x + w - 4}V${m - 8}H${x + 4}Z M${x + 4} ${m + 4}H${x + w - 4}V${y - 3}H${x + 4}Z`
    for (let k = x + 9; k < x + w - 5; k += 6) lattice += `M${k} ${t + 6}V${m - 8}M${k} ${m + 4}V${y - 3}`
  }
  return (
    shape(body, C.brown) +
    `<path d="${body}" fill="${C.ink}" opacity=".25"/>` +
    `<path d="${shoji}" fill="${C.yellow}" opacity=".7"/>` +
    `<path d="${lattice}" ${line(0.8, C.brown, 0.6)}/>` +
    shape(roof, C.ink) +
    shape(snow, C.white)
  )
}
function kusatsuYubatake(): string {
  // 湯樋：七條木槽從左後方斜斜流向右前方，越近越寬
  const far: Pt[] = [[22, 238], [64, 230]]
  const near: Pt[] = [[196, 298], [254, 274]]
  const at = (e: Pt[], t: number): Pt => [r1(e[0][0] + (e[1][0] - e[0][0]) * t), r1(e[0][1] + (e[1][1] - e[0][1]) * t)]
  let wood = ''
  let water = ''
  for (let k = 0; k <= 7; k++) {
    const a = at(far, k / 7)
    const b = at(near, k / 7)
    wood += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`
    if (k < 7) {
      const c = at(far, (k + 0.5) / 7)
      const d = at(near, (k + 0.5) / 7)
      water += `M${c[0]} ${c[1]}L${d[0]} ${d[1]}`
    }
  }
  // 湯滝：一道道白色的水，從木槽的盡頭落下
  let falls = ''
  for (let k = 0; k < 7; k++) {
    const [x, y] = at(near, (k + 0.5) / 7)
    falls += `M${x} ${y}C${r1(x + 2)} ${r1(y + 8)} ${r1(x + 3)} ${r1(y + 20)} ${r1(x + 4)} ${r1(334 - k * 3)}`
  }
  const steam = (x: number, y: number, k: number, op: number) => cloud(x, y, k, op, C.white)
  return (
    sky(C.navy, 0.4) +
    `<rect width="300" height="400" fill="${C.blue}" opacity=".18"/>` +
    band(150, 8, C.purple, 0.1) +
    dotp([[40, 30], [96, 60], [170, 22], [230, 70], [262, 30], [20, 84]], 1.6, C.white, 0.8) +
    ridge([[-4, 206], [50, 176], [110, 192], [170, 166], [230, 186], [304, 170]], C.navy, 0.28, 262) +
    // 湯畑周圍的木造旅館
    ryokanRow([[-6, 46, 62], [42, 40, 54], [150, 44, 58], [196, 40, 66], [238, 34, 52], [274, 34, 60]], 262) +
    ground(C.white, 262, 0.75, C.grey) +
    // 湯樋：木槽、槽裡淡綠的湯、冒起的湯煙
    `<path d="M22 238 L64 230 L254 274 L254 281 L196 305 L196 298Z" fill="${C.brown}" ${E}/>` +
    `<path d="M196 298 L254 274 L254 281 L196 305Z" fill="${C.ink}" opacity=".3"/>` +
    `<path d="${water}" ${line(3, C.green, 0.75)}/>` +
    `<path d="${water}" ${line(1.2, C.white, 0.85)}/>` +
    `<path d="${wood}" ${line(1.4, C.ink, 0.3)}/>` +
    steam(54, 230, 1.1, 0.55) +
    steam(112, 248, 1.4, 0.5) +
    steam(176, 262, 1.2, 0.5) +
    cloud(176, 262, 1.2, 0.18, C.yellow) +
    steam(232, 262, 0.9, 0.55) +
    `<path d="M50 214 C40 198 60 188 50 172 M128 222 C118 204 140 194 128 174 M206 236 C196 218 218 208 208 190" ${line(5, C.white, 0.3)}/>` +
    // 翡翠色的湯池與湯滝
    `<path d="M178 312 Q240 300 304 306 L304 342 Q240 350 178 340Z" fill="${C.green}" opacity=".9" ${E}/>` +
    `<path d="M178 312 Q240 300 304 306 L304 342 Q240 350 178 340Z" fill="${C.blue}" opacity=".3"/>` +
    `<path d="M196 305 L254 281 L262 312 Q232 326 200 334Z" fill="${C.green}" opacity=".5"/>` +
    `<path d="${falls}" ${line(4.4, C.white, 0.92)}/>` +
    steam(234, 336, 0.9, 0.9) +
    ripplesAt([[284, 318], [190, 336], [288, 334]]) +
    // 石柵與路燈
    shape('M-4 316 L170 300 L176 312 L-4 330Z', C.grey) +
    `<path d="M-4 322 L172 306" fill="none" stroke="${C.ink}" stroke-width="12" stroke-dasharray="2 10" stroke-opacity=".18"/>` +
    `<path d="M-4 316 L170 300" ${line(2.4, C.white, 0.9)}/>` +
    shape('M176 344 L304 342 L304 358 L172 358Z', C.grey) +
    `<path d="M176 344 L304 342" ${line(2.4, C.white, 0.9)}/>` +
    lamps([[30, 296], [96, 290], [158, 284], [286, 324]]) +
    `<path d="M-4 338 L174 316 L172 358 L304 358 L304 400 L-4 400Z" fill="${C.grey}" opacity=".35"/>` +
    `<path d="M106 400 L140 330 L176 326 L190 400Z" fill="${C.grey}" opacity=".3"/>` +
    `<path d="M200 318 Q240 310 290 318 M210 330 Q240 324 276 330" ${line(1.6, C.yellow, 0.45)}/>` +
    `<path d="M20 362 L60 362 M200 376 L250 376 M100 388 L140 388" ${line(1.4, C.yellow, 0.35)}/>`
  )
}
const ripplesAt = (pts: Pt[]) => `<path d="${pts.map(([x, y]) => `M${x - 7} ${y}H${x + 7}`).join('')}" ${line(1.4, C.white, 0.6)}/>`
/** 路燈：細柱、暖黃的燈與光暈 */
const lamps = (pts: Pt[]) =>
  `<path d="${pts.map(([x, y]) => `M${x} ${y + 2}V${y + 14}`).join('')}" ${line(1.6, C.ink, 0.7)}/>` +
  dotp(pts, 14, C.yellow, 0.3) +
  dotp(pts, 6, C.yellow, 0.95)

function tomiokaSilkMill(): string {
  // 東置繭所：二層的木骨磚造，正面中央的拱門（這裡從偏左的位置看）
  const y = 318
  let posts = ''
  for (let x = 8; x <= 264; x += 24) posts += `M${x} ${y}V214`
  let win = ''
  let arch = ''
  for (let x = 8; x < 260; x += 24) {
    win += `M${x + 6} 222h12v20h-12Z`
    if (x < 40 || x > 80) win += `M${x + 6} 274h12v22h-12Z`
  }
  arch = 'M44 318 L44 282 A18 18 0 0 1 80 282 L80 318Z'
  let brick = ''
  for (let yy = 218; yy < 316; yy += 5) brick += `M-4 ${yy}H264`
  return (
    sky(C.blue, 0.24) +
    cloud(70, 70, 1.2, 0.95) +
    cloud(226, 40, 0.9, 0.85) +
    cloud(250, 140, 0.6, 0.7) +
    ridge([[-4, 214], [60, 196], [130, 206], [200, 190], [304, 204]], C.blue, 0.18, 230) +
    // 屋頂（桟瓦）
    shape('M-8 216 L-4 188 L268 188 L276 216Z', C.grey) +
    `<path d="M-4 188 L268 188 L276 216 L-8 216Z" fill="${C.ink}" opacity=".25"/>` +
    `<path d="M0 194 H270 M-2 200 H272 M-4 206 H274 M-6 212 H275" ${line(1, C.white, 0.25)}/>` +
    shape('M-6 186 L270 186 L270 190 L-6 190Z', C.ink) +
    // 磚牆與白色木骨
    shape(`M-4 ${y} L-4 214 L268 214 L268 ${y}Z`, C.red) +
    `<path d="M-4 ${y} L-4 214 L268 214 L268 ${y}Z" fill="${C.brown}" opacity=".3"/>` +
    `<path d="${brick}" ${line(0.8, C.ink, 0.1)}/>` +
    `<path d="${posts}M-4 214H268M-4 262H268M-4 248H268M-4 300H268" ${line(3, C.cream, 0.95)}/>` +
    `<path d="${win}" fill="${C.white}" ${E}/>` +
    `<path d="${win}" fill="${C.blue}" opacity=".3"/>` +
    `<path d="${win.replace(/h12v(\d+)h-12Z/g, (_, h) => `m6 0v${h}`)}" ${line(1.2, C.white)}/>` +
    `<path d="M248 214 L268 214 L268 ${y} L248 ${y}Z" ${SH}/>` +
    // 拱門與拱心石
    shape(arch, C.cream) +
    `<path d="${arch}" fill="${C.navy}" opacity=".55"/>` +
    `<path d="M54 318 L54 300 L70 300 L70 318Z" fill="${C.cream}" opacity=".7"/>` +
    `<path d="M40 318 L40 282 A22 22 0 0 1 84 282 L84 318" ${line(4, C.white, 0.9)}/>` +
    shape('M58 258 L66 258 L64 266 L60 266Z', C.cream) +
    shape(`M-4 ${y - 4} L268 ${y - 4} L268 ${y + 2} L-4 ${y + 2}Z`, C.grey) +
    // 中庭
    ground(C.grey, 320, 0.32) +
    `<path d="M44 320 L80 320 L150 400 L-4 400 L-4 384Z" fill="${C.cream}" opacity=".7"/>` +
    ridge([[90, 322], [104, 314], [118, 320], [132, 313], [146, 320], [160, 314], [176, 320], [190, 314], [206, 320], [222, 313], [238, 320], [252, 315], [268, 322]], C.green, 0.75, 322) +
    tree(286, 324, 1.2, C.green)
  )
}

function harunaLake(): string {
  const cone = bell(222, 150, 60, 272)
  /** 山坡上一叢叢的紅葉：兩個小圓頂、平底 */
  const leaf = (n: number, seed: number, fill: string, op: number) => {
    const d = scatter(n, seed, 124, 304, (x) => cone(x) + 7, 270, 0)
      .map(([x, y]) => {
        const w = Math.round(4 + (y - 150) / 34)
        return `M${Math.round(x - w)} ${Math.round(y)}a${w / 2} ${w / 2} 0 0 1 ${w} 0a${w / 2} ${w / 2} 0 0 1 ${w} 0Z`
      })
      .join('')
    return `<path d="${d}" fill="${fill}" opacity="${op}"/>`
  }
  let refl = 'M120 272'
  for (let x = 120; x <= 304; x += 8) refl += `L${x} ${Math.round(272 + (272 - cone(x)) * 0.42)}`
  return (
    sky(C.orange, 0.22, C.cream) +
    band(200, 6, C.pink, 0.16) +
    `<path d="M-4 120 C40 112 90 118 130 110 C110 122 60 126 -4 126Z M150 70 C190 64 240 68 280 62 C262 74 200 78 150 70Z" fill="${C.pink}" opacity=".5"/>` +
    sun(56, 188, 16, C.yellow, 0.85) +
    // 外輪山與榛名富士（滿山紅葉，右半邊在陰影裡）
    ridge([[-4, 236], [30, 214], [70, 226], [110, 208], [150, 234]], C.purple, 0.25, 272) +
    `<path d="${hillD(cone, 120, 304, 272, 6)}" fill="${C.orange}" opacity=".85" ${E}/>` +
    `<path d="${hillD(cone, 120, 304, 272, 6)}" fill="${C.brown}" opacity=".25"/>` +
    leaf(38, 71, C.red, 0.85) +
    leaf(34, 73, C.yellow, 0.85) +
    leaf(22, 79, C.green, 0.7) +
    `<path d="M222 150 C236 150 250 176 262 210 C276 246 290 262 304 266 L304 272 L262 272 Q246 210 222 150Z" ${SH}/>` +
    ridge([[-4, 262], [30, 250], [70, 258], [110, 254], [150, 266]], C.red, 0.5, 274) +
    // 湖面：倒影、夕陽的光、小船
    `<rect y="270" width="300" height="54" fill="${C.cream}"/><rect y="270" width="300" height="54" fill="${C.blue}" opacity=".42" ${E}/>` +
    `<path d="${refl}L304 272Z" fill="${C.orange}" opacity=".25"/>` +
    `<path d="M50 280 L90 280 M56 288 L84 288 M62 296 L78 296" ${line(2, C.yellow, 0.75)}/>` +
    ripplesAt([[160, 300], [250, 306], [20, 310], [120, 314], [280, 290]]) +
    shape('M38 304 L74 304 L68 311 L44 311Z', C.brown) +
    `<path d="M46 304 L66 298" ${line(1.4, C.brown)}/>` +
    // 湖岸與紅葉
    ground(C.brown, 320, 0.3) +
    `<path d="M-4 322 Q150 314 304 322" ${line(2, C.white, 0.5)}/>` +
    tree(28, 330, 1.7, C.red) +
    tree(272, 330, 1.5, C.orange) +
    dotp(scatter(30, 83, 0, 300, () => 328, 398, 0), 3.4, C.orange, 0.8) +
    dotp(scatter(18, 89, 0, 300, () => 328, 398, 0), 3.4, C.red, 0.75) +
    dotp(scatter(12, 97, 0, 300, () => 328, 398, 0), 3.4, C.yellow, 0.8)
  )
}

const GUNMA: Outfit[] = [
  // 草津温泉（data/spots/gunma.json wd-Q3137477，https://zh.wikipedia.org/wiki/%E8%8D%89%E6%B4%A5%E6%B8%A9%E6%B3%89）：冬天傍晚的湯畑，七條並排的木製湯樋、冒起的湯煙、落進翡翠色湯池的湯滝，周圍積雪的旅館與路燈
  bg({ id: 'bg-gunma-kusatsu-onsen', name: '草津溫泉', pref: 'gunma', rarity: 3, art: kusatsuYubatake() }),
  // 富岡製糸場（data/spots/gunma.json wd-Q7818931，https://zh.wikipedia.org/wiki/%E5%AF%8C%E5%86%88%E5%88%B6%E4%B8%9D%E5%8E%82）：晴天的東置繭所，木骨磚造的二層長屋、白色木骨與窗、拱心石的拱門、瓦屋頂
  bg({ id: 'bg-gunma-tomioka-silk-mill', name: '富岡製絲廠', pref: 'gunma', rarity: 2, art: tomiokaSilkMill() }),
  // 榛名湖（data/spots/gunma.json wd-Q3214922，https://en.wikipedia.org/wiki/Lake_Haruna）：秋天黃昏，湖畔的圓錐形榛名富士與倒影、外輪山、湖上的小船、紅葉
  bg({ id: 'bg-gunma-haruna-lake', name: '榛名湖', pref: 'gunma', rarity: 1, art: harunaLake() }),
]

export const BG: Outfit[] = [...IBARAKI, ...TOCHIGI, ...GUNMA]
