import { dots } from '../dollArt'
import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, SH, shape, sky, sun, tree } from './kit'

/**
 * 地區背景：三重、滋賀、京都、大阪。題材取自 data/spots 的景點，出處是那筆資料的 summary.source_url。
 */

type Pt = [number, number]
const r = (v: number) => Math.round(v * 10) / 10
/** 折線封起來的形狀（座標取 1 位小數） */
const poly = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L') + 'Z'
const box = (x: number, y: number, w: number, h: number) => `M${r(x)} ${r(y)} h${r(w)} v${r(h)} h${r(-w)}Z`
/** 疊一層半透明的顏色（不帶紙邊） */
const tint = (d: string, fill: string, op: number) => `<path d="${d}" fill="${fill}" opacity="${op}"/>`
/** 白木（檜）：米色上疊一層淡褐 */
const wood = (d: string) => shape(d, C.cream) + tint(d, C.brown, 0.3)
/** 很多小圓點（一個 path：每點一筆零長度的圓頭線） */
const specks = (pts: Pt[], color: string, w: number, op = 1) => `<path d="${pts.map(([x, y]) => `M${x} ${y}h0`).join('')}" ${line(w, color, op)}/>`
/** 水面的橫紋（一個 path） */
const rip = (pts: Pt[], w = 14, op = 0.55, color: string = C.white) => `<path d="${pts.map(([x, y]) => `M${r(x - w / 2)} ${y}h${w}`).join('')}" ${line(1.6, color, op)}/>`
/** 固定種子的亂數撒點（雪、砂利） */
function scatter(k: number, x0: number, y0: number, x1: number, y1: number, seed: number): Pt[] {
  const out: Pt[] = []
  let s = seed
  for (let i = 0; i < k; i++) {
    s = (s * 9301 + 49297) % 233280
    const a = s / 233280
    s = (s * 9301 + 49297) % 233280
    out.push([r(x0 + a * (x1 - x0)), r(y0 + (s / 233280) * (y1 - y0))])
  }
  return out
}

/** 一排杉林（一個 path）：x0 到 x1 每 step 一棵，底在 base，高約 h */
function cedarRow(x0: number, x1: number, step: number, base: number, h: number, fill: string, op: number, seed = 1): string {
  let d = ''
  let k = seed
  for (let x = x0; x <= x1; x += step) {
    k = (k * 9301 + 49297) % 233280
    const t = h * (0.78 + (k % 44) / 100)
    const w = step * 0.8
    const f = (dx: number, dy: number) => `${Math.round(x + dx * w)} ${Math.round(base - dy * t)}`
    d += `M${f(-1, 0)} L${f(-0.62, 0.38)} L${f(-0.8, 0.38)} L${f(-0.42, 0.7)} L${f(-0.56, 0.7)} L${f(0, 1)} L${f(0.56, 0.7)} L${f(0.42, 0.7)} L${f(0.8, 0.38)} L${f(0.62, 0.38)} L${f(1, 0)}Z`
  }
  return `<path d="${d}" fill="${fill}" opacity="${op}" ${E}/>`
}

/** 遠方的杉林：鋸齒狀的林梢（一個 path） */
function zigzag(x0: number, x1: number, step: number, base: number, h: number, fill: string, op: number, seed = 1): string {
  let d = `M${x0} ${base}`
  let k = seed
  for (let x = x0; x <= x1; x += step) {
    k = (k * 9301 + 49297) % 233280
    d += ` L${x} ${Math.round(base - h * 0.45)} L${Math.round(x + step / 2)} ${Math.round(base - h * (0.8 + (k % 40) / 100))}`
  }
  return `<path d="${d} L${x1} ${base}Z" fill="${fill}" opacity="${op}" ${E}/>`
}

// ---------- 三重 ----------
/** 宇治橋的大鳥居（神明鳥居、白木）：x0、x1 兩根柱子的中心，top 笠木上緣，y 柱腳 */
function shinmei(x0: number, x1: number, top: number, y: number): string {
  const pil = (x: number) => poly([[x - 7, top + 13], [x + 7, top + 13], [x + 7.8, y], [x - 7.8, y]])
  const shade = (x: number) => poly([[x + 2.5, top + 13], [x + 7, top + 13], [x + 7.8, y], [x + 2.8, y]])
  const ny = top + 36
  return (
    wood(pil(x0)) +
    wood(pil(x1)) +
    `<path d="${shade(x0)}${shade(x1)}" ${SH}/>` +
    wood(poly([[x0 - 14, ny], [x1 + 14, ny], [x1 + 14, ny + 10], [x0 - 14, ny + 10]])) +
    `<path d="M${x0 - 14} ${ny + 8} L${x1 + 14} ${ny + 8}" ${line(2, C.ink, 0.1)}/>` +
    `<path d="${box(x0 - 9, ny + 10, 4, 6)}${box(x1 + 5, ny + 10, 4, 6)}" fill="${C.brown}" opacity=".5"/>` +
    wood(poly([[x0 - 22, top], [x1 + 22, top], [x1 + 18, top + 14], [x0 - 18, top + 14]])) +
    `<path d="M${x0 - 20} ${top + 2.5} L${x1 + 20} ${top + 2.5}" ${line(1.6, C.white, 0.6)}/>` +
    `<path d="M${x0 - 18} ${top + 12} L${x1 + 18} ${top + 12}" ${line(2, C.ink, 0.1)}/>`
  )
}
/** 宇治橋：往前延伸的木橋，兩側高欄的擬寶珠一根根變小（消失點 vx, vy） */
function ujibashi(vx: number, vy: number): string {
  const near = 322
  const half = 88
  const crest = 0.16
  const at = (s: number, side: number): Pt => [vx + side * half * s, vy + (near - vy) * s]
  const deck = poly([at(1, -1), at(1, 1), at(crest, 1), at(crest, -1)])
  let seams = ''
  for (let k = 1; k < 12; k++) {
    const s = 1 / (1 + 0.42 * k)
    if (s < crest) break
    const [xa, ya] = at(s, -1)
    seams += `M${r(xa)} ${r(ya)} L${r(at(s, 1)[0])} ${r(ya)}`
  }
  let rails = ''
  let posts = ''
  let caps = ''
  for (const side of [-1, 1]) {
    // 高欄：上下兩根橫木
    const [x0, y0] = at(1, side)
    const [x1, y1] = at(crest, side)
    for (const [hh, t] of [[14, 4], [30, 5]]) rails += poly([[x0, y0 - hh], [x1, y1 - hh * crest], [x1, y1 - (hh - t) * crest], [x0, y0 - hh + t]])
    for (let k = 0; k < 8; k++) {
      const s = 1 / (1 + 0.45 * k)
      if (s < crest) break
      const [x, y] = at(s, side)
      const w = 3.4 * s
      posts += poly([[x - w, y], [x - w, y - 34 * s], [x + w, y - 34 * s], [x + w, y]])
      // 擬寶珠（青銅）：洋蔥形的頭
      const q = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
      caps += `M${q(-5, -34)} Q${q(-5, -41)} ${q(0, -45)} Q${q(5, -41)} ${q(5, -34)}Z`
    }
  }
  return (
    `<g ${E}><path d="${deck}" fill="${C.cream}"/><path d="${rails}${posts}" fill="${C.cream}"/></g>` +
    tint(deck, C.brown, 0.42) +
    tint(rails + posts, C.brown, 0.36) +
    `<path d="${seams}" ${line(1, C.ink, 0.14)}/>` +
    shape(caps, C.gold)
  )
}

/** 夫婦岩：岩、上面的灌木 */
const ROCK_M = 'M20 316 C18 290 24 262 28 240 C32 214 44 190 62 182 C78 176 94 182 102 198 C110 214 108 236 112 258 C116 282 120 300 118 316Z'
const ROCK_F = 'M192 316 C190 302 196 288 206 280 C216 272 234 270 244 278 C254 286 256 302 256 316Z'
/** 注連縄：兩塊岩之間垂下的五條繩子 */
function shimenawa(): string {
  let out = ''
  for (let i = 0; i < 5; i++) {
    const d = `M106 ${208 + i * 4} Q150 ${262 + i * 4} 200 ${284 + i * 3}`
    out += `<path d="${d}" ${line(3.6, C.brown, 0.45)}/><path d="${d}" ${line(2.2, C.yellow, 0.9)}/>`
  }
  // 繩子繞在岩上的一圈
  const wrap = 'M32 220 Q70 232 108 206 M194 290 Q224 298 250 286'
  out += `<path d="${wrap}" ${line(4.4, C.brown, 0.45)}/><path d="${wrap}" ${line(2.8, C.yellow, 0.9)}/>`
  return out
}
/** 二見興玉神社的石蛙：x 中心、y 底、s 大小 */
function kaeru(x: number, y: number, s: number): string {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  return (
    shape(`M${p(-16, 0)} C${p(-18, -10)} ${p(-12, -20)} ${p(0, -21)} C${p(12, -20)} ${p(18, -10)} ${p(16, 0)}Z`, C.grey) +
    tint(`M${p(-16, 0)} C${p(-18, -10)} ${p(-12, -20)} ${p(0, -21)} C${p(12, -20)} ${p(18, -10)} ${p(16, 0)}Z`, C.green, 0.22) +
    shape(`M${p(-9, -16)} C${p(-10, -26)} ${p(-2, -27)} ${p(-2, -19)}Z M${p(9, -16)} C${p(10, -26)} ${p(2, -27)} ${p(2, -19)}Z`, C.grey) +
    dots(C.ink, r(1.4 * s), [[r(x - 6 * s), r(y - 21 * s)], [r(x + 6 * s), r(y - 21 * s)]], 'opacity=".6"') +
    `<path d="M${p(-6, -12)} Q${p(0, -9)} ${p(6, -12)}" ${line(1, C.ink, 0.35)}/>` +
    `<path d="M${p(-12, 0)} L${p(-8, -6)} L${p(-4, 0)} M${p(4, 0)} L${p(8, -6)} L${p(12, 0)}" ${line(1, C.ink, 0.25)}/>` +
    `<path d="M${p(16, 0)} C${p(18, -10)} ${p(12, -20)} ${p(0, -21)} C${p(8, -16)} ${p(11, -8)} ${p(8, 0)}Z" ${SH}/>`
  )
}

/** おかげ横丁の町家（切妻・妻入り）：x 中心、w 寬、apex 屋脊的高度、y 地面、lit 窗裡的燈 */
function machiya(x: number, w: number, apex: number, y: number, lit: number): string {
  const h = w / 2
  const eave = apex + h * 0.62
  const pent = eave + 44
  const L = x - h
  const R = x + h
  const wall = poly([[L + 4, y], [L + 4, eave], [x, apex + 6], [R - 4, eave], [R - 4, y]])
  // 牆：木板，直的板縫
  let seams = ''
  for (let i = 1; i < 8; i++) seams += `M${r(L + 4 + ((w - 8) * i) / 8)} ${r(Math.max(eave, apex + 6 + Math.abs(L + 4 + ((w - 8) * i) / 8 - x) * 1.24))} L${r(L + 4 + ((w - 8) * i) / 8)} ${pent}`
  let out = shape(wall, C.brown) + tint(wall, C.ink, 0.12) + `<path d="${seams}" ${line(1, C.ink, 0.18)}/>`
  // 格子窗：裡面點著燈
  let lit0 = ''
  let bars = ''
  let frames = ''
  for (const [x0, y0, ww, hh] of [
    [x - h * 0.42, eave + 10, h * 0.84, 22],
    [L + 9, pent + 14, h - 25, y - pent - 30],
    [x + 16, pent + 14, h - 25, y - pent - 30],
  ]) {
    lit0 += box(x0, y0, ww, hh)
    frames += box(x0, y0, ww, hh)
    for (let xx = x0 + 3.5; xx < x0 + ww - 1; xx += 3.5) bars += `M${r(xx)} ${r(y0)} L${r(xx)} ${r(y0 + hh)}`
  }
  out += `<path d="${lit0}" fill="${C.yellow}" opacity="${lit}"/><path d="${bars}" ${line(1.3, C.brown)}/><path d="${frames}" ${line(2, C.brown)}/>`
  out += `<path d="${box(L + 9, y - 14, h - 25, 12)}${box(x + 16, y - 14, h - 25, 12)}" fill="${C.ink}" opacity=".25"/>`
  // 入口：暖簾（三片）與裡面的燈
  out += `<path d="${box(x - 13, pent + 10, 26, y - pent - 10)}" fill="${C.yellow}" opacity="${lit * 0.7}"/>`
  out += `<g ${E}>${[0, 1, 2].map((i) => `<path d="${box(x - 13 + i * 8.8, pent + 10, 8.2, 24)}" fill="${C.navy}"/>`).join('')}</g>`
  // 庇（下屋）與屋頂
  out += shape(poly([[L - 6, pent + 10], [L, pent], [R, pent], [R + 6, pent + 10]]), C.ink)
  out += shape(poly([[L - 8, eave + 4], [x, apex - 6], [R + 8, eave + 4], [R + 2, eave + 9], [x, apex + 4], [L - 2, eave + 9]]), C.ink)
  out += `<path d="M${L - 6} ${eave + 3} L${x} ${apex - 5} L${R + 6} ${eave + 3} M${L - 4} ${pent + 9} L${R + 4} ${pent + 9}" ${line(1.2, C.white, 0.22)}/>`
  // 懸魚
  out += shape(`M${x - 4} ${apex + 4} L${x + 4} ${apex + 4} L${x + 3} ${apex + 14} L${x} ${apex + 17} L${x - 3} ${apex + 14}Z`, C.cream, 'opacity=".8"')
  return out
}
/** 提燈：x、y 上緣、s 大小 */
function chochin(x: number, y: number, s: number, fill: string = C.red): string {
  return (
    `<circle cx="${x}" cy="${r(y + 9 * s)}" r="${r(14 * s)}" fill="${C.yellow}" opacity=".22"/>` +
    shape(`M${r(x - 6 * s)} ${r(y + 2 * s)} C${r(x - 9 * s)} ${r(y + 7 * s)} ${r(x - 9 * s)} ${r(y + 12 * s)} ${r(x - 6 * s)} ${r(y + 17 * s)} L${r(x + 6 * s)} ${r(y + 17 * s)} C${r(x + 9 * s)} ${r(y + 12 * s)} ${r(x + 9 * s)} ${r(y + 7 * s)} ${r(x + 6 * s)} ${r(y + 2 * s)}Z`, fill) +
    `<path d="${box(x - 5 * s, y, 10 * s, 2.4 * s)}${box(x - 5 * s, y + 16.6 * s, 10 * s, 2.4 * s)}" fill="${C.ink}"/>` +
    `<path d="M${r(x - 8.4 * s)} ${r(y + 9.5 * s)} L${r(x + 8.4 * s)} ${r(y + 9.5 * s)}" ${line(0.8, C.ink, 0.3)}/>`
  )
}

const MIE: Outfit[] = [
  // 伊勢神宮（data/spots/mie.json wd-Q687168，https://zh.wikipedia.org/wiki/%E4%BC%8A%E5%8A%BF%E7%A5%9E%E5%AE%AB）：清晨的宇治橋，白木的大鳥居、擬寶珠的高欄，後面是神路山的杉林與晨霧
  bg({
    id: 'bg-mie-ise-jingu',
    name: '伊勢神宮',
    pref: 'mie',
    rarity: 3,
    art:
      sky(C.blue, 0.16) +
      cloud(232, 60, 1.1, 0.85) +
      cloud(64, 84, 0.8, 0.7) +
      ridge([[-4, 196], [44, 176], [100, 168], [150, 184], [208, 164], [262, 176], [304, 190]], C.green, 0.28, 300) +
      ridge([[-4, 226], [50, 204], [112, 214], [170, 198], [232, 208], [304, 200]], C.green, 0.48, 300) +
      `<rect y="226" width="300" height="18" fill="${C.white}" opacity=".5"/>` +
      zigzag(-6, 306, 13, 290, 80, C.green, 0.5, 3) +
      `<rect y="250" width="300" height="12" fill="${C.white}" opacity=".35"/>` +
      cedarRow(2, 306, 14, 292, 52, C.green, 0.9, 5) +
      `<rect y="272" width="300" height="14" fill="${C.white}" opacity=".4"/>` +
      `<path d="M10 120 L46 120 L150 300 L104 300Z M60 120 L76 120 L196 300 L170 300Z" fill="${C.white}" opacity=".16"/>` +
      `<rect y="284" width="300" height="40" fill="${C.blue}" opacity=".3"/>` +
      rip([[20, 296], [36, 308], [264, 298], [282, 310], [12, 316], [288, 318]], 12, 0.6) +
      wood(box(133, 230, 2.4, 33) + box(164.6, 230, 2.4, 33) + box(130, 235, 40, 2) + 'M128 228 H172 L171 231 H129Z') +
      ujibashi(150, 250.6) +
      ground(C.grey, 320, 0.32) +
      specks(scatter(30, 0, 330, 300, 398, 7), C.white, 2.6, 0.7) +
      specks(scatter(26, 0, 330, 300, 398, 11), C.grey, 2.4, 0.6) +
      `<ellipse cx="51" cy="326" rx="16" ry="3" fill="${C.ink}" opacity=".12"/><ellipse cx="249" cy="326" rx="16" ry="3" fill="${C.ink}" opacity=".12"/>` +
      shinmei(51, 249, 108, 326) +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".06" ${E}/>`,
  }),
  // 夫婦岩（data/spots/mie.json wd-Q333875，https://zh.wikipedia.org/wiki/%E5%A4%AB%E5%A9%A6%E5%B2%A9）：二見浦的日出，男岩上的小鳥居、連著兩塊岩的大注連繩、岸邊的石蛙
  bg({
    id: 'bg-mie-meotoiwa',
    name: '夫婦岩',
    pref: 'mie',
    rarity: 2,
    art:
      sky(C.orange, 0.24, C.cream) +
      `<rect width="300" height="110" fill="${C.blue}" opacity=".1"/>` +
      `<circle cx="236" cy="168" r="34" fill="${C.yellow}" opacity=".25"/>` +
      sun(236, 168, 20, C.yellow, 0.95) +
      cloud(70, 96, 1.2, 0.55, C.cream) +
      cloud(200, 60, 0.9, 0.5, C.cream) +
      `<path d="M-4 238 L40 233 L90 236 L140 232 L200 235 L304 233 L304 240 L-4 240Z" fill="${C.navy}" opacity=".16"/>` +
      `<rect y="238" width="300" height="86" fill="${C.blue}" opacity=".5"/>` +
      `<path d="M226 248 L246 248 M222 260 L250 260 M228 272 L244 272 M220 286 L252 286 M230 300 L242 300" ${line(2.4, C.yellow, 0.8)}/>` +
      rip([[40, 252], [120, 258], [170, 270], [70, 280], [150, 296], [270, 262], [16, 300]], 14, 0.5) +
      shape(ROCK_M, C.grey) +
      tint(ROCK_M, C.brown, 0.42) +
      `<path d="M102 198 C110 214 108 236 112 258 C116 282 120 300 118 316 L90 316 C96 280 94 236 102 198Z" ${SH}/>` +
      `<path d="M38 236 C42 216 50 198 62 190 M30 280 C30 268 32 258 34 250" ${line(1.4, C.white, 0.35)}/>` +
      `<path d="M52 226 L48 256 L52 280 M76 206 L80 236 L76 262 M96 246 L100 280" ${line(1.2, C.ink, 0.18)}/>` +
      tree(50, 190, 0.4, C.green) +
      tree(66, 186, 0.32, C.matcha) +
      // 男岩上的小鳥居
      `<g ${E}><path d="${box(76, 168, 2.4, 16)}${box(87, 168, 2.4, 16)}" fill="${C.white}"/><path d="${box(72, 165, 21, 3.4)}${box(74, 171, 17, 2)}" fill="${C.white}"/></g>` +
      shape(ROCK_F, C.grey) +
      tint(ROCK_F, C.brown, 0.42) +
      `<path d="M242 276 C252 284 254 300 254 314 L236 314 C240 300 240 286 242 276Z" ${SH}/>` +
      shimenawa() +
      `<path d="M12 315 Q28 306 44 312 Q60 306 76 312 Q96 306 124 315 M186 315 Q200 308 214 313 Q232 307 262 315" ${line(2.4, C.white, 0.85)}/>` +
      ground(C.grey, 320, 0.45) +
      `<path d="M0 320 L300 320" ${line(3, C.white, 0.6)}/>` +
      `<path d="M0 340 L300 340 M0 362 L300 362 M0 388 L300 388 M60 320 L56 340 M140 320 L138 340 M220 320 L222 340 M30 340 L24 362 M110 340 L106 362 M190 340 L192 362 M270 340 L276 362" ${line(1.2, C.white, 0.45)}/>` +
      kaeru(250, 372, 1.3) +
      kaeru(46, 380, 0.95),
  }),
  // おかげ横丁（data/spots/mie.json wd-Q11261371，https://ja.wikipedia.org/wiki/%E3%81%8A%E3%81%8B%E3%81%92%E6%A8%AA%E4%B8%81）：入夜的內宮門前町，切妻・妻入的町家亮起燈、簷下的提燈與暖簾
  bg({
    id: 'bg-mie-okage-yokocho',
    name: '託福橫丁',
    pref: 'mie',
    rarity: 1,
    art:
      sky(C.navy, 0.62, C.cream) +
      `<rect y="190" width="300" height="80" fill="${C.orange}" opacity=".18"/>` +
      sun(70, 64, 11, C.cream, 0.9) +
      specks([[30, 30], [120, 22], [180, 48], [250, 26], [276, 90], [212, 112], [16, 120], [148, 80]], C.white, 2.2, 0.75) +
      ridge([[-4, 236], [60, 222], [130, 230], [200, 216], [304, 228]], C.navy, 0.4, 300) +
      shape(poly([[108, 322], [108, 238], [150, 208], [192, 238], [192, 322]]), C.brown) +
      tint(poly([[108, 322], [108, 238], [150, 208], [192, 238], [192, 322]]), C.navy, 0.3) +
      `<path d="${box(118, 270, 64, 40)}${box(132, 242, 36, 16)}" fill="${C.yellow}" opacity=".4"/>` +
      shape(poly([[100, 244], [150, 200], [200, 244], [194, 248], [150, 210], [106, 248]]) + box(102, 260, 96, 7), C.ink) +
      machiya(54, 92, 156, 322, 0.62) +
      machiya(246, 96, 160, 322, 0.62) +
      chochin(18, 254, 1) +
      chochin(94, 256, 1) +
      chochin(206, 260, 1) +
      chochin(284, 258, 1) +
      ground(C.grey, 320, 0.6) +
      `<rect y="320" width="300" height="80" fill="${C.navy}" opacity=".3"/>` +
      `<path d="M14 322 L98 322 L112 352 L0 352Z M198 322 L292 322 L300 352 L184 352Z" fill="${C.yellow}" opacity=".16"/>` +
      `<path d="M0 340 L300 340 M0 364 L300 364 M0 390 L300 390 M40 340 L36 364 M120 340 L118 364 M200 340 L202 364 M270 340 L274 364" ${line(1.2, C.white, 0.2)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".14" ${E}/>`,
  }),
]

// ---------- 滋賀 ----------
/** 花頭窓（上緣像鐘的窗）：一串窗的 path，x 中心、y 下緣、w 寬、h 高 */
const katomado = (xs: number[], y: number, w: number, h: number) =>
  xs.map((x) => `M${r(x - w / 2)} ${y} V${r(y - h * 0.62)} C${r(x - w / 2)} ${r(y - h * 0.86)} ${r(x - w * 0.2)} ${r(y - h * 0.88)} ${x} ${y - h} C${r(x + w * 0.2)} ${r(y - h * 0.88)} ${r(x + w / 2)} ${r(y - h * 0.86)} ${r(x + w / 2)} ${r(y - h * 0.62)} V${y}Z`).join('')
/** 彥根城天守：三層，千鳥破風、唐破風、花頭窓、最上層的高欄。cx 中心、by 天守台的上緣 */
function hikone(cx: number, by: number): string {
  const P = (pts: Pt[]) => poly(pts.map(([x, y]) => [cx + x, by + y] as Pt))
  const X = (xs: number[]) => xs.map((x) => cx + x)
  // 石垣：微微內收的梯形，上面幾道石縫
  let out = shape(P([[-46, 18], [46, 18], [40, 0], [-40, 0]]), C.grey) + tint(P([[-46, 18], [46, 18], [40, 0], [-40, 0]]), C.cream, 0.3)
  out += `<path d="M${cx - 43} ${by + 9} H${cx + 43} M${cx - 20} ${by} V${by + 9} M${cx + 12} ${by + 9} V${by + 18} M${cx + 26} ${by} V${by + 9} M${cx - 30} ${by + 9} V${by + 18}" ${line(1, C.ink, 0.2)}/>`
  // 牆（白漆喰）
  const walls = P([[-34, 0], [34, 0], [34, -30], [-34, -30]]) + P([[-27, -38], [27, -38], [27, -64], [-27, -64]]) + P([[-20, -72], [20, -72], [20, -96], [-20, -96]])
  out += shape(walls, C.white)
  out += `<path d="${P([[24, 0], [34, 0], [34, -30], [24, -30]])}${P([[19, -38], [27, -38], [27, -64], [19, -64]])}${P([[13, -72], [20, -72], [20, -96], [13, -96]])}" ${SH}/>`
  // 窗：一層的格子窗、二三層的花頭窓
  out += `<path d="${[-24, -8, 8, 24].map((x) => box(cx + x - 4, by - 22, 8, 10)).join('')}${katomado(X([-14, 0, 14]), by - 44, 8, 14)}${katomado(X([-9, 9]), by - 78, 7, 13)}" fill="${C.ink}" opacity=".78"/>`
  // 屋頂（深灰的瓦）：一層、二層、最上層
  const roofs = P([[-44, -28], [44, -28], [36, -40], [-36, -40]]) + P([[-37, -62], [37, -62], [30, -73], [-30, -73]]) + P([[-31, -94], [31, -94], [17, -112], [-17, -112]])
  out += shape(roofs, C.ink) + tint(roofs, C.blue, 0.14)
  // 最上層的高欄（廻縁）
  out += `<path d="M${cx - 25} ${by - 78} H${cx + 25}" ${line(2, C.ink)}/><path d="${[-22, -16, -10, 10, 16, 22].map((x) => `M${cx + x} ${by - 78} V${by - 73}`).join('')}" ${line(1, C.ink, 0.8)}/>`
  // 千鳥破風（一層）、唐破風（二層）、入母屋破風（最上層）：深色的屋頂邊＋白色的妻面
  const gables = P([[-31, -34], [-19, -50], [-7, -34]]) + P([[7, -34], [19, -50], [31, -34]]) + `M${cx - 15} ${by - 66} C${cx - 8} ${by - 66} ${cx - 6} ${by - 82} ${cx} ${by - 82} C${cx + 6} ${by - 82} ${cx + 8} ${by - 66} ${cx + 15} ${by - 66}Z` + P([[-13, -100], [0, -118], [13, -100]])
  out += shape(gables, C.ink) + tint(gables, C.blue, 0.14)
  out += `<path d="${P([[-26, -36], [-19, -45], [-12, -36]])}${P([[12, -36], [19, -45], [26, -36]])}M${cx - 10} ${by - 67} C${cx - 5} ${by - 67} ${cx - 4} ${by - 78} ${cx} ${by - 78} C${cx + 4} ${by - 78} ${cx + 5} ${by - 67} ${cx + 10} ${by - 67}Z${P([[-9, -101], [0, -113], [9, -101]])}" fill="${C.white}"/>`
  // 金色的飾金具、懸魚與鯱
  out += `<path d="M${cx - 31} ${by - 34} L${cx - 19} ${by - 50} L${cx - 7} ${by - 34} M${cx + 7} ${by - 34} L${cx + 19} ${by - 50} L${cx + 31} ${by - 34} M${cx - 13} ${by - 100} L${cx} ${by - 118} L${cx + 13} ${by - 100}" ${line(1.2, C.gold)}/>`
  out += dots(C.gold, 1.8, [[cx - 19, by - 46], [cx + 19, by - 46], [cx, by - 79], [cx, by - 114]])
  out += shape(`M${cx - 12} ${by - 112} Q${cx - 19} ${by - 113} ${cx - 16} ${by - 120} Q${cx - 14} ${by - 116} ${cx - 10} ${by - 112}Z M${cx + 12} ${by - 112} Q${cx + 19} ${by - 113} ${cx + 16} ${by - 120} Q${cx + 14} ${by - 116} ${cx + 10} ${by - 112}Z`, C.gold)
  // 屋簷的亮邊
  out += `<path d="M${cx - 43} ${by - 28.5} H${cx + 43} M${cx - 36} ${by - 62.5} H${cx + 36} M${cx - 30} ${by - 94.5} H${cx + 30}" ${line(1.2, C.white, 0.35)}/>`
  return out
}
/** 櫻花樹：樹冠上再撒幾點淡色的花 */
const sakura = (x: number, y: number, s: number, seed: number) =>
  tree(x, y, s, C.pink) + specks(scatter(10, x - 13 * s, y - 36 * s, x + 13 * s, y - 18 * s, seed), C.white, 2.2 * s, 0.6)

/** 一團團的樹冠（遠一點的櫻、松、楓）：[x, y, 半徑] */
const puffs = (pts: Array<[number, number, number]>, fill: string, op = 1) =>
  `<g fill="${fill}" ${E}${op < 1 ? ` opacity="${op}"` : ''}>${pts.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`).join('')}</g>`
/** 從畫面左上角伸進來的櫻花枝 */
function sakuraBranch(): string {
  const br = 'M-4 96 C30 102 56 112 84 134 M30 103 C40 118 46 130 48 146 M60 116 C70 112 80 112 92 116'
  const blossoms: Pt[] = [[8, 92], [22, 104], [38, 98], [52, 112], [70, 122], [86, 132], [96, 118], [44, 128], [48, 146], [34, 116], [80, 112], [64, 136]]
  return (
    `<path d="${br}" ${line(3.4, C.brown)}/>` +
    `<g ${E}>${blossoms.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${7 + (i % 3) * 2}" fill="${C.pink}"/>`).join('')}</g>` +
    specks(blossoms.map(([x, y]) => [x - 2, y - 2] as Pt), C.white, 2.4, 0.7)
  )
}
/** 白鬚神社的湖中大鳥居（明神鳥居、朱色）：x 中心、top 笠木上緣、y 柱腳、w 柱距 */
function lakeTorii(x: number, top: number, y: number, w: number): string {
  const a = x - w / 2
  const b = x + w / 2
  const kas = `M${a - 22} ${top - 3} Q${x} ${top + 4} ${b + 22} ${top - 3} L${b + 18} ${top + 8} L${a - 18} ${top + 8}Z`
  return (
    shape(`${box(a - 4, top + 14, 8, y - top - 14)}${box(b - 4, top + 14, 8, y - top - 14)}`, C.red) +
    `<path d="${box(a + 1, top + 14, 3, y - top - 14)}${box(b + 1, top + 14, 3, y - top - 14)}" ${SH}/>` +
    shape(`${box(a - 14, top + 30, w + 28, 7)}${box(x - 4, top + 14, 8, 16)}`, C.red) +
    shape(box(a - 17, top + 8, w + 34, 7), C.red) +
    shape(kas, C.ink) +
    shape(`${box(a - 7, y - 6, 14, 6)}${box(b - 7, y - 6, 14, 6)}`, C.grey)
  )
}
/** 石燈籠：x 中心、y 底、s 大小 */
const toro = (x: number, y: number, s: number) => {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  return (
    shape(
      `M${p(-9, 0)} L${p(9, 0)} L${p(7, -5)} L${p(-7, -5)}Z M${p(-3, -5)} L${p(3, -5)} L${p(3, -22)} L${p(-3, -22)}Z M${p(-8, -22)} L${p(8, -22)} L${p(7, -26)} L${p(-7, -26)}Z M${p(-6, -26)} L${p(6, -26)} L${p(6, -36)} L${p(-6, -36)}Z M${p(-12, -36)} Q${p(0, -44)} ${p(12, -36)} L${p(10, -40)} Q${p(0, -48)} ${p(-10, -40)}Z M${p(-2, -46)} L${p(2, -46)} L${p(1, -50)} L${p(-1, -50)}Z`,
      C.grey,
    ) + `<path d="M${p(-3, -28)} L${p(3, -28)} L${p(3, -34)} L${p(-3, -34)}Z" fill="${C.yellow}" opacity=".7"/>`
  )
}

/** 八幡堀的土藏：x0 左緣、w 寬、y 牆腳、h 牆高；gable 妻面朝外 */
function dozo(x0: number, w: number, y: number, h: number, gable: boolean): string {
  const top = y - h
  const roof = gable
    ? poly([[x0 - 5, top + 2], [x0 + w / 2, top - w * 0.42], [x0 + w + 5, top + 2], [x0 + w + 5, top + 7], [x0 + w / 2, top - w * 0.42 + 6], [x0 - 5, top + 7]])
    : poly([[x0 - 6, top + 4], [x0 + 4, top - 14], [x0 + w - 4, top - 14], [x0 + w + 6, top + 4]])
  const snow = gable
    ? `M${r(x0 - 5)} ${top + 2} L${r(x0 + w / 2)} ${r(top - w * 0.42)} L${r(x0 + w + 5)} ${top + 2} L${r(x0 + w / 2)} ${r(top - w * 0.42 + 3)}Z`
    : `M${x0 - 2} ${top - 4} L${x0 + 4} ${top - 14} H${x0 + w - 4} L${x0 + w + 2} ${top - 4} Q${x0 + w / 2} ${top - 8} ${x0 - 2} ${top - 4}Z`
  const wall = gable ? poly([[x0, y], [x0, top + 4], [x0 + w / 2, top - w * 0.42 + 6], [x0 + w, top + 4], [x0 + w, y]]) : box(x0, top + 2, w, h - 2)
  return (
    shape(wall, C.white) +
    shape(box(x0, y - h * 0.42, w, h * 0.42), C.ink) +
    `<path d="${Array.from({ length: Math.floor(w / 6) }, (_, i) => `M${x0 + 3 + i * 6} ${r(y - h * 0.42)} V${y}`).join('')}" ${line(0.8, C.white, 0.18)}/>` +
    (gable ? shape(box(x0 + w / 2 - 5, top + 8, 10, 10), C.ink) : shape(box(x0 + w * 0.3, top + 8, 9, 9) + box(x0 + w * 0.62, top + 8, 9, 9), C.ink)) +
    shape(roof, C.ink) +
    `<path d="${snow}" fill="${C.white}"/>`
  )
}
/** 柳：樹幹＋從樹冠垂下的細枝（冬天沒有葉子） */
function willow(x: number, y: number, h: number): string {
  let br = ''
  for (let i = 0; i < 11; i++) {
    const dx = -30 + i * 6
    const sy = y - h + Math.abs(dx) * 0.5
    br += `M${r(x + dx * 0.3)} ${r(y - h + 10)} Q${r(x + dx * 0.9)} ${r(sy - 8)} ${r(x + dx * 1.1)} ${r(sy + 6)} T${r(x + dx * 1.15 + (i % 2) * 2)} ${r(y - h * 0.38 + (i % 3) * 9)}`
  }
  return (
    shape(`M${x - 4} ${y} C${x - 3} ${y - h * 0.4} ${x - 8} ${y - h * 0.7} ${x - 3} ${y - h + 8} L${x + 3} ${y - h + 8} C${x} ${y - h * 0.7} ${x + 3} ${y - h * 0.4} ${x + 5} ${y}Z`, C.brown) +
    `<path d="M${x - 3} ${y - h + 10} L${x - 14} ${y - h} M${x + 2} ${y - h + 12} L${x + 12} ${y - h + 2}" ${line(2.4, C.brown)}/>` +
    `<path d="${br}" ${line(1.2, C.brown, 0.7)}/>` +
    `<path d="M${x - 16} ${y - h + 1} L${x - 12} ${y - h - 1} M${x + 10} ${y - h + 2} L${x + 14} ${y - h}" ${line(2.4, C.white)}/>`
  )
}

const SHIGA: Outfit[] = [
  // 彦根城（data/spots/shiga.json wd-Q1012374，https://zh.wikipedia.org/wiki/%E5%BD%A5%E6%A0%B9%E5%9F%8E）：春天的國寶天守，三層的千鳥破風、唐破風與花頭窓，山下與中堀邊的櫻花
  bg({
    id: 'bg-shiga-hikone-castle',
    name: '彥根城',
    pref: 'shiga',
    rarity: 3,
    art:
      sky(C.blue, 0.22) +
      cloud(150, 50, 1.2) +
      cloud(254, 30, 0.8, 0.8) +
      ridge([[-4, 270], [60, 252], [130, 262], [200, 248], [304, 258]], C.blue, 0.18, 300) +
      ridge([[150, 300], [180, 270], [214, 252], [262, 248], [304, 256]], C.green, 0.85, 300) +
      puffs([[190, 262, 8], [282, 254, 9], [296, 266, 8]], C.green, 0.9) +
      hikone(236, 230) +
      puffs([[178, 280, 8], [204, 268, 8], [228, 274, 9], [262, 266, 8], [292, 272, 9]], C.green) +
      cloud(188, 288, 0.9, 1, C.pink) +
      cloud(232, 290, 1, 1, C.pink) +
      cloud(276, 286, 0.95, 1, C.pink) +
      cloud(212, 270, 0.6, 1, C.pink) +
      cloud(256, 266, 0.6, 1, C.pink) +
      cloud(294, 262, 0.55, 1, C.pink) +
      specks([[180, 280], [222, 280], [262, 276], [292, 280], [240, 284], [206, 264], [252, 260]], C.white, 2.6, 0.7) +
      shape('M-4 286 L304 286 L304 298 L-4 298Z', C.grey) +
      `<path d="M-4 292 H304 M20 286 V292 M60 292 V298 M100 286 V292 M140 292 V298 M180 286 V292 M220 292 V298 M260 286 V292" ${line(1, C.ink, 0.18)}/>` +
      `<rect y="298" width="300" height="26" fill="${C.blue}" opacity=".34"/>` +
      rip([[30, 306], [90, 314], [210, 306], [266, 316], [150, 310]], 16, 0.55) +
      specks([[40, 304], [64, 312], [120, 308], [180, 314], [236, 302], [280, 310]], C.pink, 2.6, 0.9) +
      sakura(44, 322, 2.3, 13) +
      sakura(90, 320, 1.5, 15) +
      ground(C.cream, 320, 1) +
      `<rect y="320" width="300" height="80" fill="${C.matcha}" opacity=".18"/>` +
      `<path d="M0 340 L300 340" ${line(1.4, C.white, 0.5)}/>` +
      specks(scatter(26, 0, 326, 300, 398, 17), C.pink, 2.8, 0.75) +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".08" ${E}/>` +
      sakuraBranch(),
  }),
  // 白鬚神社（data/spots/shiga.json wd-Q705303，https://zh.wikipedia.org/wiki/%E7%99%BD%E9%AC%9A%E7%A5%9E%E7%A4%BE）：琵琶湖上的朱色大鳥居與倒影，對岸升起的太陽、岸邊的石燈籠
  bg({
    id: 'bg-shiga-shirahige',
    name: '白鬚神社',
    pref: 'shiga',
    rarity: 2,
    art:
      sky(C.purple, 0.16, C.cream) +
      `<rect y="150" width="300" height="90" fill="${C.pink}" opacity=".28"/>` +
      `<rect y="200" width="300" height="40" fill="${C.orange}" opacity=".14"/>` +
      cloud(60, 110, 1.1, 0.5, C.white) +
      cloud(230, 64, 1.3, 0.45, C.white) +
      `<circle cx="64" cy="232" r="26" fill="${C.yellow}" opacity=".25"/>` +
      sun(64, 232, 15, C.yellow, 0.9) +
      `<path d="M28 176 l5 -3 l5 3 M42 168 l4 -2.4 l4 2.4 M50 182 l4 -2.4 l4 2.4" ${line(1.2, C.ink, 0.45)}/>` +
      ridge([[-4, 238], [40, 232], [100, 236], [150, 230], [190, 234], [250, 228], [304, 234]], C.purple, 0.32, 240) +
      `<rect y="238" width="300" height="86" fill="${C.blue}" opacity=".3"/>` +
      `<rect y="238" width="300" height="86" fill="${C.purple}" opacity=".08"/>` +
      `<path d="M50 246 H78 M54 256 H74 M46 268 H82 M56 282 H72 M50 298 H78" ${line(2.4, C.yellow, 0.75)}/>` +
      rip([[130, 250], [170, 262], [110, 276], [200, 290], [150, 304], [20, 290], [270, 300]], 16, 0.5) +
      `<g transform="matrix(1 0 0 -1 0 604)" opacity=".28">${lakeTorii(230, 152, 302, 44)}</g>` +
      lakeTorii(230, 152, 302, 44) +
      `<path d="M200 302 Q212 298 224 302 M236 302 Q248 298 260 302" ${line(1.6, C.white, 0.75)}/>` +
      ground(C.grey, 320, 0.42) +
      `<path d="M-4 322 Q20 314 46 320 Q60 312 84 322 Z M226 324 Q250 314 276 320 Q292 316 304 322 Z" fill="${C.grey}" ${E}/>` +
      specks(scatter(30, 0, 332, 300, 398, 21), C.white, 3, 0.55) +
      specks(scatter(22, 0, 332, 300, 398, 23), C.grey, 3.4, 0.6) +
      toro(48, 350, 1.3),
  }),
  // 近江八幡（data/spots/shiga.json wd-Q11638463，https://ja.wikipedia.org/wiki/%E8%BF%91%E6%B1%9F%E5%85%AB%E5%B9%A1%E5%B8%82%E5%85%AB%E5%B9%A1%E4%BC%9D%E7%B5%B1%E7%9A%84%E5%BB%BA%E9%80%A0%E7%89%A9%E7%BE%A4%E4%BF%9D%E5%AD%98%E5%9C%B0%E5%8C%BA）：雪中的八幡堀，石垣上的白牆土藏、靠岸的小船、冬天的柳
  bg({
    id: 'bg-shiga-omihachiman',
    name: '近江八幡',
    pref: 'shiga',
    rarity: 1,
    art:
      sky(C.blue, 0.14) +
      `<rect width="300" height="400" fill="${C.grey}" opacity=".12"/>` +
      ridge([[-4, 236], [40, 214], [96, 200], [150, 210], [210, 224], [304, 232]], C.grey, 0.4, 280) +
      specks(scatter(18, 20, 206, 180, 226, 31), C.white, 3, 0.8) +
      dozo(-6, 50, 270, 46, true) +
      dozo(52, 78, 270, 40, false) +
      dozo(134, 46, 270, 50, true) +
      dozo(186, 64, 270, 42, false) +
      dozo(254, 50, 270, 48, true) +
      shape('M-4 268 L304 268 L304 294 L-4 294Z', C.grey) +
      `<path d="M-4 276 H304 M-4 285 H304 M14 268 V276 M44 276 V285 M74 268 V276 M104 285 V294 M134 268 V276 M164 276 V285 M194 268 V276 M224 285 V294 M254 268 V276 M284 276 V285" ${line(1, C.ink, 0.2)}/>` +
      `<path d="M-4 268 H304" ${line(2.4, C.white, 0.9)}/>` +
      `<rect y="294" width="300" height="30" fill="${C.blue}" opacity=".3"/>` +
      rip([[30, 302], [96, 310], [160, 304], [230, 312], [274, 304]], 18, 0.5) +
      shape('M204 306 L276 306 L270 316 L212 316Z', C.brown) +
      shape('M220 306 L222 294 Q240 286 258 294 L260 306Z', C.yellow, 'opacity=".9"') +
      `<path d="M222 294 Q240 286 258 294 L256 290 Q240 283 224 290Z" fill="${C.white}"/>` +
      `<path d="M270 306 L286 276" ${line(1.4, C.brown)}/>` +
      ground(C.white, 320, 1) +
      `<rect y="320" width="300" height="80" fill="${C.blue}" opacity=".08"/>` +
      shape('M-4 320 L304 320 L304 328 L-4 328Z', C.grey) +
      `<path d="M-4 320 H304" ${line(2.6, C.white)}/>` +
      willow(54, 322, 150) +
      specks(scatter(46, 0, 0, 300, 400, 37), C.white, 3, 0.9) +
      `<path d="M0 352 Q80 346 160 352 T300 350 M0 378 Q90 372 180 378 T300 376" ${line(1.4, C.blue, 0.12)}/>`,
  }),
]

// ---------- 京都 ----------
/** 松：彎的樹幹＋幾層平平的樹冠，snow 時上面積雪。x 根部、y 地面、s 大小 */
function pine(x: number, y: number, s: number, snow: boolean): string {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const pads: Array<[number, number, number, number]> = [[-9, -20, 13, 5], [9, -28, 12, 5], [-3, -38, 10, 4.5]]
  const pad = ([dx, dy, w, h]: [number, number, number, number]) => `M${p(dx - w, dy)} Q${p(dx, dy - h * 2.2)} ${p(dx + w, dy)}Z`
  const cap = ([dx, dy, w, h]: [number, number, number, number]) => `M${p(dx - w * 0.85, dy - h * 0.55)} Q${p(dx, dy - h * 2.4)} ${p(dx + w * 0.85, dy - h * 0.55)} Q${p(dx, dy - h * 1.2)} ${p(dx - w * 0.85, dy - h * 0.55)}Z`
  return (
    shape(`M${p(-2, 0)} C${p(-4, -10)} ${p(5, -18)} ${p(-1, -36)} L${p(2, -36)} C${p(8, -18)} ${p(0, -10)} ${p(3, 0)}Z`, C.brown) +
    `<path d="M${p(0, -16)} L${p(-8, -20)} M${p(2, -24)} L${p(9, -28)}" ${line(1.6 * s, C.brown)}/>` +
    shape(pads.map(pad).join(''), C.green) +
    tint(pads.map(pad).join(''), C.ink, 0.28) +
    (snow ? `<path d="${pads.map(cap).join('')}" fill="${C.white}"/>` : '')
  )
}
/** 金閣（舍利殿）：一層白木與白牆、二三層貼金、寶形造的屋頂與鳳凰，屋頂積雪。cx 中心、by 池邊 */
function kinkaku(cx: number, by: number): string {
  const B = (x: number, y: number, w: number, h: number) => box(cx + x, by + y, w, h)
  const roof = (y: number, wb: number, wt: number, h: number) => poly([[cx - wb, by + y], [cx + wb, by + y], [cx + wt, by + y - h], [cx - wt, by + y - h]])
  const snow = (y: number, wb: number, wt: number, h: number) => `M${cx - wb + 1} ${by + y - 2} L${cx - wt} ${by + y - h - 1} H${cx + wt} L${cx + wb - 1} ${by + y - 2} Q${cx} ${by + y - h * 0.4} ${cx - wb + 1} ${by + y - 2}Z`
  const roofs = roof(-25, 38, 29, 8) + roof(-54, 37, 27, 9) + B(-40, -15, 12, 3)
  let out =
    // 一層（法水院）與西側伸出水面的漱清
    shape(B(-28, -26, 56, 24) + B(-38, -12, 10, 10), C.cream) +
    `<path d="${[-28, -20, -12, -4, 4, 12, 20, 28].map((x) => `M${cx + x} ${by - 26} V${by - 2}`).join('')}M${cx - 38} ${by - 12} V${by - 2}" ${line(1.8, C.brown, 0.8)}/>` +
    shape(B(-31, -4, 62, 4), C.brown) +
    // 二層（潮音洞）、三層（究竟頂）：金色
    shape(B(-27, -54, 54, 22) + B(-15, -81, 30, 20), C.gold) +
    `<path d="${B(14, -54, 13, 22)}${B(7, -81, 8, 20)}" ${SH}/>` +
    `<path d="${[-18, -9, 0, 9, 18].map((x) => `M${cx + x} ${by - 52} V${by - 38}`).join('')}" ${line(1, C.brown, 0.3)}/>` +
    `<path d="${katomado([cx - 7, cx + 7], by - 63, 6, 12)}" fill="${C.brown}" opacity=".45"/>` +
    // 高欄
    `<path d="M${cx - 29} ${by - 36} H${cx + 29} M${cx - 17} ${by - 64} H${cx + 17}" ${line(1.6, C.brown, 0.75)}/>` +
    // 屋頂（檜皮葺）與積雪
    shape(roofs, C.brown) +
    tint(roofs, C.ink, 0.45) +
    shape(`M${cx - 27} ${by - 80} Q${cx - 12} ${by - 85} ${cx - 3} ${by - 104} L${cx + 3} ${by - 104} Q${cx + 12} ${by - 85} ${cx + 27} ${by - 80} L${cx + 25} ${by - 77} L${cx - 25} ${by - 77}Z`, C.brown) +
    tint(`M${cx - 27} ${by - 80} L${cx + 27} ${by - 80} L${cx + 25} ${by - 77} L${cx - 25} ${by - 77}Z`, C.ink, 0.45) +
    `<path d="${snow(-25, 38, 29, 8)}${snow(-54, 37, 27, 9)}M${cx - 25} ${by - 82} Q${cx - 12} ${by - 87} ${cx - 3} ${by - 104} L${cx + 3} ${by - 104} Q${cx + 12} ${by - 87} ${cx + 25} ${by - 82} Q${cx} ${by - 86} ${cx - 25} ${by - 82}Z M${cx - 41} ${by - 15} L${cx - 28} ${by - 15} L${cx - 29} ${by - 13}Z" fill="${C.white}"/>` +
    // 鳳凰
    `<path d="M${cx} ${by - 104} V${by - 109}" ${line(1.4, C.gold)}/>` +
    shape(`M${cx - 7} ${by - 112} Q${cx - 4} ${by - 115} ${cx - 2} ${by - 112} L${cx + 1} ${by - 121} Q${cx + 4} ${by - 114} ${cx + 5} ${by - 112} L${cx + 9} ${by - 118} Q${cx + 8} ${by - 110} ${cx + 3} ${by - 108} L${cx - 4} ${by - 108}Z`, C.gold)
  return out
}

/** 金閣的倒影：只留牆與屋頂的大塊顏色 */
const kinkakuGhost = (cx: number, by: number) =>
  `<path d="${box(cx - 28, by - 26, 56, 26)}" fill="${C.cream}"/><path d="${box(cx - 27, by - 54, 54, 22)}${box(cx - 15, by - 81, 30, 20)}" fill="${C.gold}"/>` +
  `<path d="${poly([[cx - 38, by - 25], [cx + 38, by - 25], [cx + 29, by - 33], [cx - 29, by - 33]])}${poly([[cx - 37, by - 54], [cx + 37, by - 54], [cx + 27, by - 63], [cx - 27, by - 63]])}${poly([[cx - 27, by - 80], [cx + 27, by - 80], [cx, by - 104]])}" fill="${C.brown}"/>`

/** 千本鳥居：一座座朱色的稻荷鳥居往深處排（消失點 vx, vy），柱腳塗黑 */
function senbon(vx: number, vy: number): string {
  let out = ''
  for (let k = 17; k >= 0; k--) {
    const s = 1 / (1 + 0.14 * k)
    const X = (dx: number) => Math.round(vx + dx * s)
    const Y = (dy: number) => Math.round(vy + dy * s)
    const red = `M${X(-111)} ${Y(-116)}H${X(-89)}V${Y(80)}H${X(-111)}Z M${X(89)} ${Y(-116)}H${X(111)}V${Y(80)}H${X(89)}Z M${X(-118)} ${Y(-96)}H${X(118)}V${Y(-88)}H${X(-118)}Z M${X(-124)} ${Y(-128)}H${X(124)}V${Y(-118)}H${X(-124)}Z`
    const ink = `M${X(-111)} ${Y(80)}H${X(-89)}V${Y(106)}H${X(-111)}Z M${X(89)} ${Y(80)}H${X(111)}V${Y(106)}H${X(89)}Z M${X(-113)} ${Y(-120)}H${X(-87)}V${Y(-114)}H${X(-113)}Z M${X(87)} ${Y(-120)}H${X(113)}V${Y(-114)}H${X(87)}Z M${X(-134)} ${Y(-144)}Q${vx} ${Y(-134)} ${X(134)} ${Y(-144)}L${X(130)} ${Y(-128)}H${X(-130)}Z`
    const sh = `M${X(-96)} ${Y(-116)}H${X(-89)}V${Y(80)}H${X(-96)}Z M${X(89)} ${Y(-116)}H${X(96)}V${Y(80)}H${X(89)}Z`
    out += `<g ${E}><path d="${red}" fill="${C.red}"/><path d="${ink}" fill="${C.ink}"/></g><path d="${sh}" ${SH}/>`
  }
  return out
}

/** 嵐山的紅葉：山坡上一團團的紅、橙、黃，中間露出松的綠 */
const MOMIJI: Array<[number, number, number, number]> = [
  [22, 200, 0.8, 0], [56, 178, 0.9, 1], [92, 160, 0.8, 2], [128, 152, 1, 0], [168, 164, 0.8, 1], [206, 156, 0.9, 0], [242, 172, 0.8, 2], [276, 190, 0.8, 1],
  [36, 228, 1, 2], [80, 212, 1.1, 0], [122, 196, 0.9, 1], [164, 204, 1, 2], [210, 196, 1.1, 1], [256, 214, 1, 0], [292, 224, 0.8, 2],
  [14, 252, 0.9, 1], [60, 248, 1, 0], [108, 240, 1, 2], [156, 246, 0.9, 0], [200, 236, 1, 2], [246, 246, 1, 1], [290, 252, 0.8, 0],
]
const autumnSlope = () => MOMIJI.map(([x, y, sc, c]) => cloud(x, y, sc, 0.78, [C.red, C.orange, C.yellow][c])).join('')
const ARASHI: Pt[] = [[-4, 210], [30, 170], [80, 136], [130, 128], [170, 142], [220, 134], [262, 160], [304, 196]]
/** 渡月橋：長長的低橋，木欄杆、一排排的橋腳 */
function togetsukyo(y: number): string {
  let legs = ''
  for (let x = 4; x < 300; x += 24) legs += `M${x - 4} ${y + 6} V${y + 30} M${x} ${y + 6} V${y + 31} M${x + 4} ${y + 6} V${y + 30}`
  let posts = ''
  for (let x = 0; x <= 300; x += 10) posts += `M${x} ${Math.round(y - 9 + Math.abs(x - 150) * 0.02)} V${Math.round(y - 1 + Math.abs(x - 150) * 0.02)}`
  return (
    `<path d="${legs}" ${line(2.2, C.brown, 0.85)}/>` +
    shape(`M-4 ${y + 3} Q150 ${y - 3} 304 ${y + 3} L304 ${y + 8} Q150 ${y + 2} -4 ${y + 8}Z`, C.brown) +
    `<path d="${posts}" ${line(1.6, C.brown)}/>` +
    `<path d="M-4 ${y - 6} Q150 ${y - 12} 304 ${y - 6}" ${line(2, C.brown)}/>` +
    `<path d="M-4 ${y + 4} Q150 ${y - 2} 304 ${y + 4}" ${line(1, C.white, 0.35)}/>`
  )
}

const KYOTO: Outfit[] = [
  // 鹿苑寺（data/spots/kyoto.json wd-Q270983，https://en.wikipedia.org/wiki/Kinkaku-ji）：雪中的金閣，鏡湖池上的倒影、池中島上積雪的松
  bg({
    id: 'bg-kyoto-kinkakuji',
    name: '金閣寺',
    pref: 'kyoto',
    rarity: 3,
    art:
      sky(C.blue, 0.16) +
      `<rect width="300" height="400" fill="${C.grey}" opacity=".14"/>` +
      ridge([[-4, 210], [50, 176], [120, 164], [190, 172], [250, 160], [304, 178]], C.green, 0.36, 280) +
      specks(scatter(26, 0, 178, 300, 230, 41), C.white, 4, 0.85) +
      ridge([[-4, 250], [40, 230], [100, 236], [160, 226], [230, 234], [304, 226]], C.green, 0.62, 280) +
      specks(scatter(22, 0, 234, 300, 254, 43), C.white, 4, 0.9) +
      `<rect y="262" width="300" height="62" fill="${C.blue}" opacity=".3"/>` +
      `<g transform="matrix(1.15 0 0 -1.15 -34.2 563.3)" opacity=".3">${kinkakuGhost(228, 262)}</g>` +
      rip([[40, 272], [90, 286], [150, 276], [214, 294], [262, 284], [120, 306], [30, 300], [244, 308]], 18, 0.55) +
      `<path d="M-4 262 H304" ${line(2, C.white, 0.7)}/>` +
      pine(270, 262, 0.8, true) +
      `<g transform="matrix(1.15 0 0 1.15 -34.2 -39.3)">${kinkaku(228, 262)}</g>` +
      shape('M10 292 Q40 278 76 284 Q100 282 112 292Z', C.grey) +
      `<path d="M14 290 Q42 280 74 286 Q98 284 108 290 Q60 286 14 290Z" fill="${C.white}"/>` +
      pine(46, 288, 1.1, true) +
      pine(84, 290, 0.8, true) +
      ground(C.white, 320, 1) +
      `<rect y="320" width="300" height="80" fill="${C.blue}" opacity=".08"/>` +
      `<path d="M0 320 H300" ${line(2, C.blue, 0.2)}/>` +
      `<path d="M0 350 Q80 344 160 350 T300 348 M0 378 Q90 372 180 378 T300 376" ${line(1.4, C.blue, 0.12)}/>` +
      shape('M-4 400 L-4 360 Q10 342 30 348 Q46 336 62 350 Q74 352 78 400Z M232 400 Q236 362 256 360 Q270 346 288 356 Q300 354 304 362 L304 400Z', C.green) +
      tint('M-4 400 L-4 360 Q10 342 30 348 Q46 336 62 350 Q74 352 78 400Z M232 400 Q236 362 256 360 Q270 346 288 356 Q300 354 304 362 L304 400Z', C.ink, 0.25) +
      `<path d="M-4 362 Q10 344 30 350 Q46 338 62 352 Q50 348 30 356 Q12 352 -4 366Z M234 366 Q240 360 256 362 Q270 348 288 358 Q300 356 304 364 Q290 362 272 360 Q258 368 234 366Z" fill="${C.white}"/>` +
      specks(scatter(50, 0, 0, 300, 400, 47), C.white, 3, 0.9),
  }),
  // 伏見稲荷大社（data/spots/kyoto.json wd-Q714828，https://zh.wikipedia.org/wiki/%E4%BC%8F%E8%A6%8B%E7%A8%BB%E8%8D%B7%E5%A4%A7%E7%A4%BE）：千本鳥居，朱色的鳥居一座接一座排成隧道，柱腳塗黑，樹林間的陽光
  bg({
    id: 'bg-kyoto-fushimi-inari',
    name: '伏見稻荷大社',
    pref: 'kyoto',
    rarity: 2,
    art:
      sky(C.yellow, 0.14) +
      `<rect width="300" height="400" fill="${C.green}" opacity=".5"/>` +
      `<path d="M-4 -4 H304 V70 Q292 88 276 76 Q262 96 244 80 Q226 92 210 74 Q194 90 176 72 Q158 86 140 70 Q122 88 104 74 Q88 92 70 78 Q52 94 36 78 Q18 90 -4 74Z" fill="${C.green}" opacity=".85" ${E}/>` +
      `<path d="M-4 120 Q14 130 10 160 Q20 200 8 240 Q16 280 -4 300Z M304 110 Q286 130 292 170 Q282 210 294 250 Q286 280 304 300Z" fill="${C.green}" opacity=".7"/>` +
      specks([[30, 30], [96, 20], [168, 40], [236, 26], [280, 50], [62, 56], [204, 54]], C.yellow, 7, 0.45) +
      shape(poly([[-4, 400], [304, 400], [174, 260], [126, 260]]), C.cream) +
      tint(poly([[-4, 400], [304, 400], [174, 260], [126, 260]]), C.brown, 0.2) +
      `<rect x="120" y="150" width="60" height="110" fill="${C.cream}"/>` +
      senbon(150, 230) +
      `<g fill="${C.yellow}" opacity=".3"><ellipse cx="62" cy="366" rx="14" ry="4"/><ellipse cx="236" cy="378" rx="18" ry="5"/><ellipse cx="128" cy="392" rx="16" ry="4"/><ellipse cx="190" cy="352" rx="10" ry="3"/></g>` +
      `<path d="M0 360 L300 360 M0 386 L300 386" ${line(1.2, C.white, 0.3)}/>`,
  }),
  // 渡月橋（data/spots/kyoto.json wd-Q11561923，https://zh.wikipedia.org/wiki/%E6%B8%A1%E6%9C%88%E6%A9%8B）：秋天的嵐山，滿山紅葉、跨過桂川的長橋、河岸的楓樹
  bg({
    id: 'bg-kyoto-togetsukyo',
    name: '渡月橋',
    pref: 'kyoto',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(60, 60, 1.1) +
      cloud(236, 84, 0.9, 0.8) +
      ridge(ARASHI, C.green, 0.7, 290) +
      autumnSlope() +
      specks([[44, 196], [150, 180], [232, 196], [100, 226], [190, 222], [272, 238], [30, 242]], C.green, 9, 0.55) +
      `<rect y="244" width="300" height="20" fill="${C.white}" opacity=".35"/>` +
      `<rect y="266" width="300" height="58" fill="${C.blue}" opacity=".38"/>` +
      togetsukyo(262) +
      rip([[30, 300], [80, 310], [140, 298], [200, 312], [262, 302], [110, 316]], 18, 0.55) +
      shape('M212 304 L268 304 L262 312 L218 312Z', C.brown) +
      `<path d="M232 304 L246 290" ${line(1.4, C.brown)}/>` +
      ground(C.grey, 320, 0.4) +
      specks(scatter(20, 0, 330, 300, 398, 51), C.grey, 5, 0.5) +
      tree(36, 330, 2.2, C.red) +
      tree(274, 334, 1.8, C.orange) +
      specks(scatter(18, 0, 326, 300, 398, 53), C.red, 3, 0.7),
  }),
]

// ---------- 大阪 ----------
/** 大阪城天守：五層白牆、銅綠的屋頂、金色的破風飾與鯱、最上層黑牆上的金虎。cx 中心、by 天守台上緣 */
function osakajo(cx: number, by: number): string {
  // 每一層：[牆寬的一半, 牆高, 屋簷寬的一半]
  const tiers: Array<[number, number, number]> = [[32, 22, 40], [28, 18, 35], [24, 16, 30], [20, 14, 26], [16, 15, 22]]
  let walls = ''
  let shade = ''
  let roofs = ''
  let gold = ''
  let y = by
  const tops: number[] = []
  tiers.forEach(([w, h, e], i) => {
    walls += box(cx - w, y - h, w * 2, h + 1)
    shade += box(cx + w - 6, y - h, 6, h + 1)
    const ry = y - h
    // 最上層是入母屋（高一點、上緣窄）
    roofs += i < 4 ? poly([[cx - e, ry + 2], [cx + e, ry + 2], [cx + e - 8, ry - 6], [cx - e + 8, ry - 6]]) : poly([[cx - e, ry + 2], [cx + e, ry + 2], [cx + 11, ry - 11], [cx - 11, ry - 11]])
    gold += `M${cx - e} ${ry + 2} H${cx + e}`
    tops.push(ry - 6)
    y = ry - 6
  })
  // 破風：二層的大千鳥破風、三層的唐破風、四層的一對千鳥破風
  const [t1, t2, t3] = tops
  const gab = poly([[cx - 16, t1 + 4], [cx, t1 - 12], [cx + 16, t1 + 4]]) + `M${cx - 12} ${t2 + 4} C${cx - 6} ${t2 + 4} ${cx - 5} ${t2 - 8} ${cx} ${t2 - 8} C${cx + 5} ${t2 - 8} ${cx + 6} ${t2 + 4} ${cx + 12} ${t2 + 4}Z` + poly([[cx - 22, t3 + 4], [cx - 13, t3 - 7], [cx - 4, t3 + 4]]) + poly([[cx + 4, t3 + 4], [cx + 13, t3 - 7], [cx + 22, t3 + 4]])
  const gabFace = poly([[cx - 11, t1 + 3], [cx, t1 - 8], [cx + 11, t1 + 3]]) + poly([[cx - 18, t3 + 3], [cx - 13, t3 - 3], [cx - 8, t3 + 3]]) + poly([[cx + 8, t3 + 3], [cx + 13, t3 - 3], [cx + 18, t3 + 3]])
  gold += `M${cx - 16} ${t1 + 4} L${cx} ${t1 - 12} L${cx + 16} ${t1 + 4} M${cx - 22} ${t3 + 4} L${cx - 13} ${t3 - 7} L${cx - 4} ${t3 + 4} M${cx + 4} ${t3 + 4} L${cx + 13} ${t3 - 7} L${cx + 22} ${t3 + 4}`
  const top = y - 5
  // 最上層：黑牆（金色的虎與鶴）、入母屋屋頂、鯱
  const t5 = tops[3]
  let out =
    shape(walls, C.white) +
    `<path d="${box(cx - 16, t5 - 15, 32, 15)}" fill="${C.ink}" opacity=".82"/>` +
    `<path d="${shade}" ${SH}/>` +
    // 窗
    `<path d="${[-22, -11, 0, 11, 22].map((x) => box(cx + x - 3, by - 15, 6, 7)).join('')}${[-17, -6, 6, 17].map((x) => box(cx + x - 2.5, tops[0] - 12, 5, 6)).join('')}${[-14, -5, 5, 14].map((x) => box(cx + x - 2, tops[1] - 11, 4, 6)).join('')}${[-10, 0, 10].map((x) => box(cx + x - 2, tops[2] - 10, 4, 5)).join('')}" fill="${C.ink}" opacity=".7"/>` +
    shape(roofs + gab, C.green) +
    tint(roofs + gab, C.white, 0.22) +
    `<path d="${gabFace}M${cx - 8} ${t2 + 3} C${cx - 4} ${t2 + 3} ${cx - 3} ${t2 - 4} ${cx} ${t2 - 4} C${cx + 3} ${t2 - 4} ${cx + 4} ${t2 + 3} ${cx + 8} ${t2 + 3}Z" fill="${C.white}"/>` +
    `<path d="${gold}" ${line(1.4, C.gold)}/>` +
    dots(C.gold, 1.6, [[cx - 9, t5 - 8], [cx + 9, t5 - 8], [cx, t1 - 3], [cx, t2 - 3], [cx - 13, t3 - 1], [cx + 13, t3 - 1]]) +
    `<path d="M${cx - 13} ${t5 - 11} l4 -2 l4 2 M${cx + 5} ${t5 - 11} l4 -2 l4 2" ${line(1.2, C.gold)}/>` +
    `<path d="M${cx - 20} ${t5 - 1} H${cx + 20}" ${line(1.6, C.ink)}/>` +
    shape(`M${cx - 11} ${top - 1} Q${cx - 16} ${top - 2} ${cx - 14} ${top - 8} Q${cx - 12} ${top - 4} ${cx - 8} ${top - 1}Z M${cx + 11} ${top - 1} Q${cx + 16} ${top - 2} ${cx + 14} ${top - 8} Q${cx + 12} ${top - 4} ${cx + 8} ${top - 1}Z`, C.gold)
  // 天守台的石垣
  out += shape(`M${cx - 36} ${by} H${cx + 36} Q${cx + 40} ${by + 14} ${cx + 50} ${by + 26} H${cx - 50} Q${cx - 40} ${by + 14} ${cx - 36} ${by}Z`, C.grey) + tint(`M${cx - 36} ${by} H${cx + 36} Q${cx + 40} ${by + 14} ${cx + 50} ${by + 26} H${cx - 50} Q${cx - 40} ${by + 14} ${cx - 36} ${by}Z`, C.cream, 0.3)
  out += `<path d="M${cx - 38} ${by + 8} H${cx + 38} M${cx - 43} ${by + 17} H${cx + 43} M${cx - 20} ${by} V${by + 8} M${cx + 8} ${by + 8} V${by + 17} M${cx + 26} ${by} V${by + 8} M${cx - 8} ${by + 17} V${by + 26}" ${line(1, C.ink, 0.2)}/>`
  return out
}
/** 梅樹：彎曲的深色枝幹，枝上一點點的梅花。x 根部、y 地面、s 大小、flower 花色 */
function ume(x: number, y: number, s: number, flower: string, seed: number): string {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const br = `M${p(0, 0)} C${p(-3, -14)} ${p(6, -22)} ${p(2, -34)} M${p(2, -30)} C${p(-10, -36)} ${p(-18, -38)} ${p(-28, -50)} M${p(3, -32)} C${p(12, -40)} ${p(20, -40)} ${p(30, -52)} M${p(-14, -40)} C${p(-14, -50)} ${p(-8, -56)} ${p(-6, -64)} M${p(16, -42)} C${p(14, -52)} ${p(18, -58)} ${p(16, -66)} M${p(2, -34)} C${p(4, -46)} ${p(0, -54)} ${p(4, -70)}`
  const fl = scatter(28, x - 32 * s, y - 70 * s, x + 32 * s, y - 32 * s, seed)
  return `<path d="${br}" ${line(3.4 * s, C.brown)}/>` + specks(fl, flower, 5.2 * s, 0.92) + specks(fl.slice(0, 10), C.white, 2 * s, 0.8)
}

/** 通天閣：四腳跨在路上、往上收的鐵塔、展望台、頂上的光球（夜裡點燈）。cx 中心、y 地面 */
function tsutenkaku(cx: number, y: number): string {
  const legs = `M${cx - 30} ${y} L${cx - 26} ${y - 44} H${cx + 26} L${cx + 30} ${y}H${cx + 18} Q${cx} ${y - 36} ${cx - 18} ${y}Z`
  const shaft = poly([[cx - 26, y - 44], [cx + 26, y - 44], [cx + 14, y - 160], [cx - 14, y - 160]])
  let lattice = ''
  for (let i = 0; i < 5; i++) {
    const y0 = y - 44 - i * 23.2
    const w0 = 26 - i * 2.4
    const w1 = w0 - 2.4
    lattice += `M${r(cx - w0)} ${r(y0)} L${r(cx + w1)} ${r(y0 - 23.2)} M${r(cx + w0)} ${r(y0)} L${r(cx - w1)} ${r(y0 - 23.2)} M${r(cx - w1)} ${r(y0 - 23.2)} H${r(cx + w1)}`
  }
  return (
    shape(legs + shaft + box(cx - 20, y - 184, 40, 24) + box(cx - 12, y - 198, 24, 14), C.cream) +
    `<path d="${poly([[cx + 14, y - 44], [cx + 26, y - 44], [cx + 14, y - 160], [cx + 8, y - 160]])}" ${SH}/>` +
    `<path d="${lattice}" ${line(1.4, C.ink, 0.28)}/>` +
    // 塔身兩側的燈條
    `<path d="M${cx - 24} ${y - 52} L${cx - 14} ${y - 154} M${cx + 24} ${y - 52} L${cx + 14} ${y - 154}" ${line(2, C.yellow, 0.75)}/>` +
    `<path d="${box(cx - 18, y - 178, 36, 10)}${box(cx - 10, y - 194, 20, 5)}" fill="${C.yellow}" opacity=".85"/>` +
    `<path d="${box(cx - 22, y - 186, 44, 3)}${box(cx - 22, y - 163, 44, 3)}${box(cx - 14, y - 200, 28, 3)}" fill="${C.grey}"/>` +
    `<path d="M${cx} ${y - 200} V${y - 210}" ${line(2, C.grey)}/>` +
    `<circle cx="${cx}" cy="${y - 216}" r="12" fill="${C.white}" opacity=".3"/>` +
    sun(cx, y - 216, 6.5, C.white, 0.95)
  )
}
/** 新世界的街屋：亮著燈的窗、屋簷下的大提燈 */
function shinsekai(x0: number, w: number, top: number, y: number, seed: number): string {
  let win = ''
  let k = seed
  for (let yy = top + 10; yy < y - 40; yy += 20)
    for (let xx = x0 + 6; xx < x0 + w - 12; xx += 15) {
      k = (k * 9301 + 49297) % 233280
      if (k % 4) win += box(xx, yy, 9, 11)
    }
  return (
    shape(box(x0, top, w, y - top), C.navy) +
    tint(box(x0, top, w, y - top), C.cream, 0.18) +
    `<path d="${win}" fill="${C.yellow}" opacity=".7"/>` +
    shape(box(x0 - 3, y - 38, w + 6, 5), C.red) +
    `<path d="${box(x0 + 4, y - 30, w - 8, 28)}" fill="${C.yellow}" opacity=".45"/>`
  )
}

/** 太陽之塔的左半邊輪廓（從左下的塔腳往上到頂）：每段 [控制點 1, 控制點 2, 終點]，右半邊左右翻過來 */
const TAIYO_START: Pt = [-46, 0]
const TAIYO: Array<[Pt, Pt, Pt]> = [
  [[-38, -50], [-24, -96], [-21, -118]],
  [[-32, -124], [-46, -136], [-54, -150]],
  [[-58, -158], [-60, -166], [-56, -170]],
  [[-50, -170], [-46, -160], [-40, -156]],
  [[-32, -150], [-24, -146], [-17, -146]],
  [[-15, -156], [-14, -164], [-12, -170]],
]
/** 太陽之塔：白色的塔身與往上張開的雙臂、頂上的黃金之臉、胸前的太陽之臉與兩側的閃電紋。cx 中心、y 地面 */
function taiyoNoTo(cx: number, y: number): string {
  const p = (dx: number, dy: number) => `${r(cx + dx)} ${r(y + dy)}`
  const ends = [TAIYO_START, ...TAIYO.map((seg) => seg[2])]
  let body = `M${p(...TAIYO_START)}`
  for (const [a, b, c] of TAIYO) body += ` C${p(...a)} ${p(...b)} ${p(...c)}`
  body += ` L${p(12, -170)}`
  for (let i = TAIYO.length - 1; i >= 0; i--) {
    const [a, b] = TAIYO[i]
    body += ` C${p(-b[0], b[1])} ${p(-a[0], a[1])} ${p(-ends[i][0], ends[i][1])}`
  }
  // 黃金之臉：金色的圓盤，邊上一圈短短的尖角
  let rays = ''
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    rays += `M${r(cx + Math.cos(a - 0.17) * 15)} ${r(y - 184 + Math.sin(a - 0.17) * 15)} L${r(cx + Math.cos(a) * 20)} ${r(y - 184 + Math.sin(a) * 20)} L${r(cx + Math.cos(a + 0.17) * 15)} ${r(y - 184 + Math.sin(a + 0.17) * 15)}Z`
  }
  return (
    `<g transform="matrix(.88 0 0 .88 ${r(cx * 0.12)} ${r(y * 0.12)})">` +
    shape(body + 'Z', C.white) +
    `<path d="M${p(21, -118)} C${p(24, -96)} ${p(38, -50)} ${p(46, 0)} L${p(30, 0)} C${p(24, -50)} ${p(16, -96)} ${p(14, -118)}Z" ${SH}/>` +
    `<path d="M${p(-54, -150)} C${p(-46, -136)} ${p(-32, -124)} ${p(-21, -118)} M${p(54, -150)} C${p(46, -136)} ${p(32, -124)} ${p(21, -118)}" ${line(1.4, C.grey, 0.5)}/>` +
    // 胸前的太陽之臉、兩側的閃電
    `<path d="M${p(-16, -92)} L${p(-24, -104)} L${p(-27, -96)} L${p(-36, -114)} L${p(-40, -106)} L${p(-50, -128)} M${p(16, -92)} L${p(24, -104)} L${p(27, -96)} L${p(36, -114)} L${p(40, -106)} L${p(50, -128)}" ${line(3, C.red, 0.9)}/>` +
    `<circle cx="${cx}" cy="${y - 80}" r="17" fill="${C.grey}" ${E}/>` +
    `<path d="M${p(-9, -84)} h6 M${p(3, -84)} h6 M${p(-6, -72)} Q${p(0, -75)} ${p(6, -72)}" ${line(1.8, C.ink, 0.4)}/>` +
    shape(rays, C.gold) +
    `<circle cx="${cx}" cy="${y - 184}" r="16" fill="${C.gold}" ${E}/>` +
    `<path d="M${p(-10, -187)} h7 M${p(3, -187)} h7 M${p(-4, -177)} h8" ${line(2, C.ink, 0.6)}/>` +
    `<path d="M${p(-8, -195)} Q${p(0, -199)} ${p(8, -195)}" ${line(1.2, C.white, 0.6)}/>` +
    `</g>`
  )
}

const OSAKA: Outfit[] = [
  // 大坂城（data/spots/osaka.json wd-Q321242，https://zh.wikipedia.org/wiki/%E5%A4%A7%E9%98%AA%E5%9F%8E）：梅林花開時的天守閣，白牆、銅綠屋頂與金色的鯱、高高的石垣
  bg({
    id: 'bg-osaka-osakajo',
    name: '大阪城',
    pref: 'osaka',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(64, 64, 1.3) +
      cloud(150, 30, 0.9, 0.8) +
      cloud(50, 150, 0.8, 0.7) +
      ridge([[-4, 290], [60, 276], [140, 284], [210, 272], [304, 280]], C.green, 0.4, 300) +
      `<g transform="matrix(1.1 0 0 1.1 -22.8 -25.2)">${osakajo(228, 252)}</g>` +
      puffs([[170, 290, 12], [194, 286, 12], [270, 284, 13], [296, 290, 12], [222, 292, 12], [246, 290, 12]], C.green, 0.85) +
      ume(250, 326, 1.15, C.pink, 61) +
      ume(196, 326, 0.9, C.white, 63) +
      ground(C.matcha, 320, 0.3) +
      `<path d="M0 340 Q150 334 300 340" ${line(1.4, C.white, 0.5)}/>` +
      ume(52, 330, 1.5, C.pink, 65) +
      ume(118, 326, 0.9, C.red, 67) +
      specks(scatter(18, 0, 330, 300, 398, 69), C.pink, 3, 0.7),
  }),
  // 通天閣（data/spots/osaka.json wd-Q1148463，https://zh.wikipedia.org/wiki/%E9%80%9A%E5%A4%A9%E9%96%A3）：夜裡的新世界，點燈的通天閣、頂上的光球，街上一串串的提燈
  bg({
    id: 'bg-osaka-tsutenkaku',
    name: '通天閣',
    pref: 'osaka',
    rarity: 2,
    art:
      sky(C.navy, 0.72, C.cream) +
      `<rect y="230" width="300" height="90" fill="${C.purple}" opacity=".18"/>` +
      specks([[30, 40], [96, 22], [150, 60], [186, 30], [30, 150], [120, 110], [280, 40], [290, 150]], C.white, 2.2, 0.7) +
      `<path d="M-4 322 V250 H40 V230 H74 V260 H120 V240 H150 V262 H200 V246 H230 V322Z" fill="${C.navy}" opacity=".5" ${E}/>` +
      tsutenkaku(240, 322) +
      shinsekai(-6, 54, 196, 322, 3) +
      shinsekai(50, 50, 220, 322, 5) +
      `<path d="M-4 214 Q50 236 100 220 Q150 240 214 230" ${line(1, C.ink, 0.6)}/>` +
      `<g ${E}>${([[12, 221], [34, 226], [56, 227], [78, 224], [116, 225], [138, 229], [160, 230], [184, 230], [204, 229]] as Pt[]).map(([x, yy], i) => `<ellipse cx="${x}" cy="${yy + 5}" rx="4" ry="5" fill="${i % 2 ? C.red : C.yellow}"/>`).join('')}</g>` +
      chochin(30, 276, 1.3) +
      chochin(76, 286, 1.1) +
      ground(C.navy, 320, 0.55) +
      `<path d="M226 322 L254 322 L262 400 L218 400Z" fill="${C.yellow}" opacity=".12"/>` +
      `<path d="M0 346 L300 346 M0 374 L300 374" ${line(1.2, C.white, 0.14)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".14" ${E}/>`,
  }),
  // 太陽の塔（data/spots/osaka.json wd-Q3275446，https://zh.wikipedia.org/wiki/%E5%A4%AA%E9%99%BD%E4%B9%8B%E5%A1%94）：夏天的萬博紀念公園，張開雙臂的太陽之塔、頂上的黃金之臉、胸前的太陽之臉
  bg({
    id: 'bg-osaka-taiyo-no-to',
    name: '太陽之塔',
    pref: 'osaka',
    rarity: 1,
    art:
      sky(C.blue, 0.34) +
      cloud(220, 120, 2, 0.95) +
      cloud(260, 70, 1.2, 0.9) +
      cloud(150, 40, 0.9, 0.8) +
      ridge([[-4, 300], [50, 284], [120, 290], [190, 278], [260, 286], [304, 280]], C.green, 0.5, 300) +
      puffs([[150, 300, 14], [176, 294, 15], [206, 300, 14], [236, 292, 16], [266, 298, 14], [294, 292, 15]], C.green) +
      taiyoNoTo(76, 324) +
      ground(C.matcha, 320, 0.45) +
      `<path d="M0 334 Q150 328 300 334 M0 360 Q150 354 300 360" ${line(1.4, C.white, 0.35)}/>` +
      tree(250, 332, 1.5, C.green) +
      tree(284, 330, 1.1, C.matcha),
  }),
]

export const BG: Outfit[] = [...MIE, ...SHIGA, ...KYOTO, ...OSAKA]
