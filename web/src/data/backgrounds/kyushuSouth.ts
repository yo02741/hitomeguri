import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, ripples, SH, shape, sky, sun, tree } from './kit'

/**
 * 地區背景：大分、宮崎、鹿児島、沖縄。題材取自 data/spots 的景點，出處是那筆景點的 summary.source_url（沒有就 sources[0].url）。
 */

const n = (v: number) => +v.toFixed(1)
type Pt = [number, number]
/** 零件畫在原點（底部中央），用 translate＋scale 放到畫面上 */
const at = (x: number, y: number, s: number, art: string) => `<g transform="translate(${x} ${y}) scale(${s})">${art}</g>`
/** 一段往外鼓的圓弧（順時針），連起來就是雲、煙的扇貝形邊 */
const arc = (x0: number, y0: number, x1: number, y1: number, k = 0.56) => {
  const r = Math.round(Math.hypot(x1 - x0, y1 - y0) * k)
  return `A${r} ${r} 0 0 1 ${Math.round(x1)} ${Math.round(y1)}`
}
/** 湯けむり、火山的煙的輪廓：從 (x, y) 往上鼓起的一柱，h 高、w 最寬處、lean 往右飄多少、b 底部的寬度比例 */
function plume(x: number, y: number, h: number, w: number, lean = 0, b = 0.3): string {
  const L: Pt[] = []
  const R: Pt[] = []
  const m = 5
  for (let i = 0; i <= m; i++) {
    const t = i / m
    const cx = x + lean * t * t + Math.sin(t * 6 + x) * w * 0.08
    const hw = (w / 2) * (b + (1 - b) * Math.sqrt(t)) * (i % 2 ? 1.06 : 0.96)
    L.push([cx - hw, y - h * t])
    R.push([cx + hw, y - h * t * (1 - (i % 2) * 0.03)])
  }
  let d = `M${Math.round(L[0][0])} ${Math.round(L[0][1])}`
  for (let i = 1; i <= m; i++) d += arc(L[i - 1][0], L[i - 1][1], L[i][0], L[i][1], 0.85)
  const mx = L[m][0] * 0.42 + R[m][0] * 0.58
  const my = L[m][1] - w * 0.12
  d += arc(L[m][0], L[m][1], mx, my, 0.6) + arc(mx, my, R[m][0], R[m][1], 0.56)
  for (let i = m; i > 0; i--) d += arc(R[i][0], R[i][1], R[i - 1][0], R[i - 1][1], 0.85)
  return d + arc(R[0][0], R[0][1], L[0][0], L[0][1], 0.8) + 'Z'
}
/** 幾柱煙疊成一層（[x, y, h, w] 的清單） */
const steam = (list: number[][], lean = 20, op = 0.62, fill: string = C.white, b = 0.3) =>
  `<path d="${list.map(([x, y, h, w]) => plume(x, y, h, w, lean, b)).join('')}" fill="${fill}" opacity="${op}" ${E}/>`
/** 一串圓（遠處的樹冠、花叢） */
const crowns = (pts: number[][], fill: string, op = 1) =>
  `<g fill="${fill}" opacity="${op}" ${E}>${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
/** 霧、雲海、花田：上緣是一串大小不一的圓弧（x0..x1、上緣 y、厚 h；bump 是圓弧的寬度範圍） */
function fog(x0: number, x1: number, y: number, h: number, op = 0.6, seed = 1, fill: string = C.white, bump = 34): string {
  let d = `M${x0} ${y + h} L${x0} ${y}`
  let x = x0
  let py = y
  let k = seed
  while (x < x1) {
    k = (k * 9301 + 49297) % 233280
    const nx = Math.min(x1, x + bump + (k % Math.round(bump * 1.2)))
    const ny = y + ((k >> 5) % 5) - 2
    d += arc(x, py, nx, ny, 0.75)
    x = nx
    py = ny
  }
  return `<path d="${d} L${x1} ${y + h}Z" fill="${fill}" opacity="${op}" ${E}/>`
}
/** 一排街屋：牆＋寄棟的瓦屋頂（x0..x1，地面 y） */
function houses(x0: number, x1: number, y: number, wall: string, roof: string, op = 1, seed = 1): string {
  let walls = ''
  let tops = ''
  let x = x0
  let k = seed
  while (x < x1) {
    k = (k * 9301 + 49297) % 233280
    const w = 16 + (k % 14)
    const h = 7 + ((k >> 4) % 9)
    const r = 6 + ((k >> 2) % 5)
    walls += `M${x + 2} ${y} L${x + 2} ${y - h} L${x + w - 2} ${y - h} L${x + w - 2} ${y}Z`
    tops += `M${x - 1} ${y - h + 1} L${x + 5} ${y - h - r} L${x + w - 5} ${y - h - r} L${x + w + 1} ${y - h + 1}Z`
    x += w + ((k >> 5) % 4) * 2 - 2
  }
  return `<g opacity="${op}"><path d="${walls}" fill="${wall}"/><path d="${tops}" fill="${roof}" ${E}/></g>`
}
/** 一排小方塊（亮著燈的窗） */
const windows = (x0: number, y: number, count: number, gap: number, w: number, h: number, fill: string = C.yellow, op = 0.85) =>
  `<g fill="${fill}" opacity="${op}">${Array.from({ length: count }, (_, i) => `<rect x="${n(x0 + i * gap)}" y="${y}" width="${w}" height="${h}"/>`).join('')}</g>`
/** 石燈籠（原點在底部中央，高 44） */
const LANTERN =
  `<path d="M-7 0 L7 0 L5 -4 L-5 -4Z M-2.4 -4 L2.4 -4 L2.4 -22 L-2.4 -22Z M-7 -22 L7 -22 L6 -26 L-6 -26Z M-5 -26 L5 -26 L5 -34 L-5 -34Z M-10 -34 Q0 -44 10 -34Z M-2.2 -42 A2.2 2.2 0 1 0 2.2 -42 A2.2 2.2 0 1 0 -2.2 -42Z" fill="${C.grey}" ${E}/>` +
  `<rect x="-2.4" y="-32" width="4.8" height="4.5" fill="${C.ink}" opacity=".35"/><path d="M0.6 -4 L2.4 -4 L2.4 -22 L0.6 -22Z M2 -34 L10 -34 Q7 -38 2 -40Z" ${SH}/>`
/** 石鳥居（原點在兩柱中間的地面，高 62） */
const TORII_STONE =
  `<g fill="${C.grey}" ${E}><path d="M-30 -62 Q0 -58 30 -62 L28 -55 L-28 -55Z"/><path d="M-23 -44 L23 -44 L23 -40 L-23 -40Z"/>` +
  `<path d="M-18 -55 L-13 -55 L-12 0 L-19 0Z M13 -55 L18 -55 L19 0 L12 0Z"/></g><path d="M15 -55 L18 -55 L19 0 L15 0Z" ${SH}/>`
/** 落葉：紅、橙、黃的小點 */
const leaves = (pts: Pt[]) =>
  [C.red, C.orange, C.yellow].map((c, k) => `<g fill="${c}">${pts.filter((_, i) => i % 3 === k).map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.8"/>`).join('')}</g>`).join('')

// ---------- 大分 ----------
/** 宇佐鳥居：笠木兩端翹起、柱頂有黑色的台輪（原點在兩柱中間的地面，高 75） */
const USA_TORII =
  `<g fill="${C.red}" ${E}><path d="M-24 -56 L-19 -56 L-18 0 L-25 0Z M19 -56 L24 -56 L25 0 L18 0Z"/>` +
  `<path d="M-31 -46 L31 -46 L31 -41 L-31 -41Z M-2.5 -60 L2.5 -60 L2.5 -46 L-2.5 -46Z"/><path d="M-31 -60 L31 -60 L31 -65 L-31 -65Z"/></g>` +
  `<path d="M21.5 -56 L24 -56 L25 0 L21.5 0Z M-31 -43 L31 -43 L31 -41 L-31 -41Z" ${SH}/>` +
  `<g fill="${C.ink}" ${E}><path d="M-26 -56 L-17 -56 L-17 -60 L-26 -60Z M17 -56 L26 -56 L26 -60 L17 -60Z"/>` +
  `<path d="M-40 -76 Q-30 -68 -18 -69 L18 -69 Q30 -68 40 -76 L38 -69 Q30 -64 18 -64 L-18 -64 Q-30 -64 -38 -69Z"/></g>`
/** 宇佐神宮的門：朱柱、檜皮葺的屋頂與正面的唐破風，右邊接白壁的迴廊（原點在門的地面中央） */
function usaGate(): string {
  let out = shape('M-30 0 L30 0 L28 -6 L-28 -6Z', C.grey)
  out += shape('M26 -6 L84 -6 L84 -44 L26 -44Z', C.white)
  out += `<path d="M26 -6 L26 -44 M45 -6 L45 -44 M64 -6 L64 -44 M83 -6 L83 -44" ${line(3.4, C.red)}/><path d="M26 -12 L84 -12 M26 -38 L84 -38" ${line(2.6, C.red)}/>`
  out += shape('M20 -42 L90 -42 L90 -52 Q52 -50 24 -52Z', C.brown)
  out += `<g fill="${C.red}" ${E}><path d="M-24 -6 L-17 -6 L-17 -66 L-24 -66Z M17 -6 L24 -6 L24 -66 L17 -66Z"/><path d="M-28 -66 L28 -66 L28 -76 L-28 -76Z"/></g>`
  out += `<path d="M20.5 -6 L24 -6 L24 -66 L20.5 -66Z" ${SH}/><rect x="-17" y="-62" width="34" height="56" fill="${C.ink}" opacity=".16"/>`
  out += `<path d="M-26 -71 L26 -71" ${line(1.4, C.gold, 0.9)}/>` + [-22, -11, 0, 11, 22].map((x) => `<circle cx="${x}" cy="-71" r="1.6" fill="${C.gold}"/>`).join('')
  out += shape('M-52 -76 C-40 -80 -30 -96 -20 -104 L20 -104 C30 -96 40 -80 52 -76 L48 -70 Q0 -74 -48 -70Z', C.brown)
  out += `<path d="M20 -104 C30 -96 40 -80 52 -76 L48 -70 Q30 -72 18 -73Z" ${SH}/><path d="M-46 -73 Q0 -77 46 -73" ${line(1.2, C.white, 0.45)}/>`
  out += shape('M-22 -74 C-14 -74 -10 -90 0 -90 C10 -90 14 -74 22 -74Z', C.brown) + `<path d="M-22 -74 C-14 -74 -10 -90 0 -90 C10 -90 14 -74 22 -74" ${line(1.6, C.gold)}/>`
  return out + `<path d="M-21 -104 L21 -104" ${line(3, C.ink, 0.6)}/>`
}
/** 茅葺的小屋（金鱗湖畔的共同浴場「下ん湯」，原點在地面中央） */
const THATCH_HUT =
  shape('M-22 0 L22 0 L22 -18 L-22 -18Z', C.brown) +
  `<path d="M-14 -3 L-14 -15 M-6 -3 L-6 -15 M2 -3 L2 -15" ${line(1.2, C.ink, 0.3)}/>` +
  shape('M-32 -16 L-6 -44 L6 -44 L32 -16 L28 -12 L-28 -12Z', C.brown) +
  `<path d="M-32 -16 L-6 -44 L6 -44 L32 -16 L28 -12 L-28 -12Z" fill="${C.yellow}" opacity=".4"/>` +
  `<path d="M6 -44 L32 -16 L28 -12 L8 -12Z" ${SH}/><path d="M-22 -22 L22 -22 M-14 -32 L14 -32" ${line(1, C.ink, 0.2)}/>`
/** 鐵輪的溫泉旅館：兩層木造、瓦屋頂、亮著燈的格子窗（原點在左下角） */
const RYOKAN =
  `<g fill="${C.brown}" ${E}><path d="M0 0 L86 0 L86 -34 L0 -34Z"/><path d="M6 -40 L86 -40 L86 -70 L6 -70Z"/></g>` +
  `<rect x="72" y="-70" width="14" height="70" ${SH}/>` +
  windows(10, -28, 4, 15, 11, 16) +
  windows(16, -64, 4, 15, 10, 14) +
  `<path d="M6 -20 L70 -20 M12 -57 L72 -57 M15.5 -28 L15.5 -12 M30.5 -28 L30.5 -12 M45.5 -28 L45.5 -12 M60.5 -28 L60.5 -12" ${line(1, C.ink, 0.35)}/>` +
  `<g fill="${C.navy}" opacity=".8" ${E}><path d="M-10 -32 L96 -32 L90 -42 L-4 -42Z"/><path d="M-4 -68 Q44 -72 96 -68 L80 -86 L12 -86Z"/></g>` +
  `<path d="M58 -86 L58 -100" ${line(4, C.grey)}/>`

const OITA: Outfit[] = [
  // 宇佐神宮（data/spots/oita.json wd-Q715632，https://zh.wikipedia.org/wiki/%E5%AE%87%E4%BD%90%E7%A5%9E%E5%AE%AE）：朱色的宇佐鳥居（柱頂黑色台輪）、檜皮葺唐破風的門與白壁迴廊、參道的石燈籠，周圍是楠木林
  bg({
    id: 'bg-oita-usa-jingu',
    name: '宇佐神宮',
    pref: 'oita',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(158, 58, 1.2) +
      cloud(64, 30, 0.8, 0.8) +
      ridge([[-10, 262], [60, 232], [130, 214], [200, 222], [260, 206], [310, 226]], C.green, 0.28) +
      tree(108, 324, 2, C.green) +
      tree(196, 324, 2, C.green) +
      `<g opacity=".7">${tree(150, 324, 2.6, C.matcha)}</g>` +
      tree(10, 330, 4.2, C.green) +
      tree(294, 330, 4.4, C.green) +
      at(236, 326, 1.15, usaGate()) +
      at(62, 330, 1.3, USA_TORII) +
      ground(C.grey, 320, 0.3) +
      `<path d="M130 320 L98 400 M170 320 L202 400" ${line(1.4, C.white, 0.5)}/><path d="M0 352 L300 352 M0 380 L300 380" ${line(1.2, C.white, 0.35)}/>` +
      at(44, 378, 1.1, LANTERN) +
      at(258, 378, 1.1, LANTERN),
  }),
  // 由布院温泉（data/spots/oita.json wd-Q11264855，https://zh.wikipedia.org/wiki/%E7%94%B1%E5%B8%83%E9%99%A2%E6%BA%AB%E6%B3%89）：秋天早上的金鱗湖，湖面的晨霧、立在湖裡的石鳥居、湖畔茅葺的下ん湯與紅葉，後面是雙峰的由布岳
  bg({
    id: 'bg-oita-yufuin',
    name: '由布院溫泉',
    pref: 'oita',
    rarity: 2,
    art:
      sky(C.blue, 0.15) +
      sun(64, 70, 15, C.yellow, 0.4) +
      shape('M10 300 C70 270 140 210 178 150 L194 118 L206 130 L216 124 L230 114 L246 134 C268 172 294 214 330 246 L330 300Z', C.navy, 'opacity=".3"') +
      `<path d="M230 114 L246 134 C268 172 294 214 330 246 L330 300 L250 300 C252 240 244 170 230 114Z" ${SH}/>` +
      `<path d="M136 226 C170 214 200 220 232 212 C262 220 290 230 330 246 L330 300 L110 300Z" fill="${C.orange}" opacity=".22"/>` +
      ridge([[-10, 262], [40, 244], [90, 252], [140, 262]], C.navy, 0.16) +
      fog(-10, 310, 248, 16, 0.62, 30) +
      ridge([[-10, 282], [30, 268], [80, 274], [130, 266], [190, 272], [240, 264], [310, 274]], C.brown, 0.32) +
      ridge([[-10, 288], [50, 278], [120, 284], [180, 276], [250, 282], [310, 276]], C.orange, 0.34, 288) +
      crowns([[96, 282, 9], [114, 280, 11], [196, 280, 10], [214, 283, 8]], C.red, 0.8) +
      crowns([[132, 283, 9], [150, 280, 10], [178, 282, 9], [62, 283, 8]], C.orange, 0.8) +
      `<rect y="286" width="300" height="40" fill="${C.cream}"/><rect y="286" width="300" height="40" fill="${C.blue}" opacity=".3"/>` +
      `<path d="M-10 286 L310 286 L310 294 Q250 300 180 294 Q120 300 50 294 Q20 298 -10 294Z" fill="${C.orange}" opacity=".2"/>` +
      fog(-10, 310, 290, 6, 0.5, 9) +
      ripples([[130, 304], [214, 304], [174, 316]], 14, 0.55) +
      at(244, 322, 1.25, THATCH_HUT) +
      tree(292, 328, 1.6, C.orange) +
      ground(C.matcha, 324, 0.3) +
      `<path d="M0 325 L300 325" ${line(3, C.brown, 0.3)}/>` +
      `<path d="M-6 324 L150 324 C128 346 96 364 60 380 C36 390 14 398 -6 400Z" fill="${C.cream}"/>` +
      `<path d="M-6 324 L150 324 C128 346 96 364 60 380 C36 390 14 398 -6 400Z" fill="${C.blue}" opacity=".3"/>` +
      `<path d="M150 324 C128 346 96 364 60 380 C36 390 14 398 -6 400" ${line(3, C.brown, 0.3)}/>` +
      `<g opacity=".2" transform="translate(60 352) scale(.9 -.9)">${TORII_STONE}</g>` +
      at(60, 352, 0.9, TORII_STONE) +
      ripples([[42, 356], [78, 356], [60, 362], [112, 334], [20, 338], [34, 376]], 16, 0.6) +
      tree(8, 326, 1.4, C.red) +
      `<g opacity=".85">${leaves([[222, 352], [250, 380], [280, 344], [140, 392], [180, 366], [120, 370], [200, 388], [292, 368], [96, 392]])}</g>`,
  }),
  // 別府温泉（data/spots/oita.json wd-Q4890932，https://zh.wikipedia.org/wiki/%E5%88%AB%E5%BA%9C%E6%B8%A9%E6%B3%89）：黃昏，鐵輪一帶的街屋冒出一柱柱湯けむり，後面是鶴見岳；近景是海地獄的鈷藍色泉池與溫泉旅館
  bg({
    id: 'bg-oita-beppu-onsen',
    name: '別府溫泉',
    pref: 'oita',
    rarity: 3,
    art:
      sky(C.orange, 0.3, C.cream) +
      `<rect y="200" width="300" height="100" fill="${C.yellow}" opacity=".16"/>` +
      cloud(232, 64, 1.3, 0.6, C.pink) +
      shape('M-20 300 C20 260 50 200 92 160 C110 142 126 136 140 140 C160 146 180 176 210 210 C240 240 280 262 330 280 L330 300Z', C.purple, 'opacity=".28"') +
      ridge([[-10, 272], [60, 254], [130, 264], [200, 248], [260, 258], [310, 250]], C.navy, 0.18) +
      steam([[14, 282, 120, 26], [44, 282, 176, 32], [150, 280, 236, 34], [236, 282, 170, 32], [276, 282, 116, 26]], 26, 0.6) +
      houses(-6, 306, 284, C.white, C.navy, 0.4, 5) +
      steam([[84, 302, 136, 28], [198, 302, 150, 28]], 20, 0.64) +
      houses(-6, 306, 306, C.cream, C.navy, 0.6, 11) +
      at(208, 322, 1, RYOKAN) +
      steam([[266, 224, 90, 26]], 14, 0.72) +
      ground(C.brown, 320, 0.32) +
      shape('M-6 342 C20 330 76 328 114 338 C132 344 128 362 104 370 C64 382 16 378 -6 370Z', C.grey) +
      shape('M-6 346 C22 336 74 334 106 342 C120 348 116 360 98 366 C62 376 18 372 -6 366Z', C.blue) +
      `<path d="M-6 346 C22 336 74 334 106 342 C120 348 116 360 98 366 C62 376 18 372 -6 366Z" fill="${C.white}" opacity=".32"/>` +
      ripples([[30, 352], [74, 350], [52, 360]], 18, 0.6) +
      steam([[54, 352, 200, 62]], 24, 0.66, C.white, 0.55),
  }),
]

// ---------- 宮崎 ----------
/** 柱狀節理：在 x0..x1、y0..y1 畫直的柱縫與一明一暗的柱面 */
function columns(x0: number, x1: number, y0: number, y1: number, gap = 8, op = 0.16): string {
  let seams = ''
  let faces = ''
  for (let x = x0, i = 0; x < x1; x += gap, i++) {
    const top = y0 + ((i * 7) % 11)
    seams += `M${x} ${top} L${x + 1} ${y1}`
    if (i % 2) faces += `M${x} ${top} L${x + gap} ${top + 3} L${x + gap + 1} ${y1} L${x + 1} ${y1}Z`
  }
  return `<path d="${faces}" fill="${C.ink}" opacity=".06"/><path d="${seams}" ${line(1.2, C.ink, op)}/>`
}
/** 手划船：原點在船底中央 */
const BOAT =
  shape('M-18 -7 L18 -7 L14 0 L-14 0Z', C.white) + `<path d="M-17 -5 L17 -5" ${line(2, C.blue, 0.8)}/><path d="M6 -8 L18 4" ${line(1.6, C.brown)}/>`
/** ビロウ（蒲葵）：細的樹幹＋扇形的葉冠（x, y 樹根、h 高、r 葉冠半徑、lean 歪的方向） */
function palm(x: number, y: number, h: number, r: number, lean = 0, fill: string = C.green): string {
  const tx = x + lean
  const ty = y - h
  const R = Math.round
  let d = ''
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (1.05 + (i / 12) * 0.9)
    const rr = i % 2 ? r * 0.55 : r
    d += `${i ? 'L' : 'M'}${R(tx + Math.cos(a) * rr * 1.15)} ${R(ty + Math.sin(a) * rr * 0.8 + (i % 2 ? 0 : r * 0.12))}`
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + (i / 4) * 0.7)
    d += `L${R(tx + Math.cos(a) * r * (i % 2 ? 0.5 : 0.95) * 1.1)} ${R(ty + Math.sin(a) * r * (i % 2 ? 0.3 : 0.6))}`
  }
  return `<path d="M${x} ${y} Q${R(x + lean * 0.3)} ${R(y - h * 0.5)} ${tx} ${ty}" ${line(2.4, C.brown)}/><path d="${d}Z" fill="${fill}" ${E}/><path d="M${tx} ${ty} L${R(tx + r)} ${R(ty + r * 0.1)} L${R(tx + r * 0.6)} ${R(ty + r * 0.5)}Z" ${SH}/>`
}
/** 鵜戶神宮的本殿：朱色、深色的屋頂與金色的邊（原點在地面中央，寬 76） */
const UDO_HALL =
  shape('M-40 0 L40 0 L40 -6 L-40 -6Z', C.grey) +
  shape('M-32 -6 L32 -6 L32 -46 L-32 -46Z', C.red) +
  `<g fill="${C.white}" opacity=".75"><rect x="-26" y="-40" width="14" height="26"/><rect x="-7" y="-40" width="14" height="26"/><rect x="12" y="-40" width="14" height="26"/></g>` +
  `<path d="M-26 -27 L-12 -27 M-7 -27 L7 -27 M12 -27 L26 -27 M-19 -40 L-19 -14 M0 -40 L0 -14 M19 -40 L19 -14" ${line(1, C.red, 0.8)}/>` +
  `<path d="M22 -6 L32 -6 L32 -46 L22 -46Z" ${SH}/>` +
  shape('M-44 -44 L44 -44 L42 -50 L-42 -50Z', C.red) +
  shape('M-54 -48 C-36 -52 -26 -66 -14 -74 L14 -74 C26 -66 36 -52 54 -48 L50 -44 Q0 -48 -50 -44Z', C.ink, 'opacity=".85"') +
  shape('M-18 -50 C-10 -50 -8 -64 0 -64 C8 -64 10 -50 18 -50Z', C.ink, 'opacity=".85"') +
  `<path d="M-50 -46 Q0 -50 50 -46 M-18 -50 C-10 -50 -8 -64 0 -64 C8 -64 10 -50 18 -50" ${line(1.4, C.gold)}/>` +
  `<path d="M-14 -74 L14 -74" ${line(2.4, C.gold)}/>` +
  `<path d="M-40 -6 L40 -6 M-40 -16 L-32 -16 M32 -16 L40 -16" ${line(2, C.red)}/>`

const MIYAZAKI: Outfit[] = [
  // 青島（data/spots/miyazaki.json wd-Q4778779，https://zh.wikipedia.org/wiki/%E9%9D%92%E5%B3%B6_%28%E5%AE%AE%E5%B4%8E%E7%B8%A3%29）：日出，長滿ビロウ（蒲葵）的青島與青島神社的朱色鳥居，近景是「鬼の洗濯板」的波狀岩
  bg({
    id: 'bg-miyazaki-aoshima',
    name: '青島',
    pref: 'miyazaki',
    rarity: 1,
    art:
      sky(C.orange, 0.26, C.cream) +
      cloud(236, 96, 1.4, 0.55, C.pink) +
      cloud(150, 40, 1, 0.45, C.pink) +
      cloud(40, 170, 0.9, 0.5, C.pink) +
      sun(66, 258, 22, C.yellow, 0.9) +
      `<rect y="262" width="300" height="62" fill="${C.cream}"/><rect y="262" width="300" height="62" fill="${C.blue}" opacity=".3"/>` +
      `<path d="M50 268 L82 268 M44 278 L88 278 M54 288 L78 288 M40 298 L92 298 M52 308 L80 308" ${line(2, C.yellow, 0.8)}/>` +
      ripples([[150, 290], [130, 306], [20, 284], [110, 274]], 16, 0.5) +
      `<path d="M156 306 C164 280 190 262 226 256 C262 252 292 258 312 268 L312 306Z" fill="${C.green}" ${E}/>` +
      crowns([[176, 284, 14], [196, 272, 16], [222, 264, 16], [250, 262, 17], [278, 264, 16], [302, 270, 14]], C.matcha, 0.9) +
      palm(178, 284, 36, 13, -4, C.matcha) +
      palm(200, 276, 52, 15, 3) +
      palm(222, 270, 70, 16, -2, C.matcha) +
      palm(244, 268, 58, 15, 5) +
      palm(264, 268, 78, 17, -3) +
      palm(288, 270, 54, 15, 4, C.matcha) +
      `<path d="M156 306 C166 292 186 286 206 288 L312 292 L312 306Z" ${SH}/>` +
      at(214, 306, 0.44, `<g fill="${C.red}" ${E}><path d="M-22 -44 L22 -44 L22 -40 L-22 -40Z M-18 -55 L-13 -55 L-12 0 L-19 0Z M13 -55 L18 -55 L19 0 L12 0Z"/></g>${shape('M-30 -62 Q0 -58 30 -62 L28 -55 L-28 -55Z', C.ink)}`) +
      `<path d="M150 306 L312 306 L312 312 L146 312Z" fill="${C.grey}" ${E}/>` +
      ground(C.blue, 322, 0.3) +
      `<rect y="322" width="300" height="78" fill="${C.orange}" opacity=".14"/>` +
      [0, 1, 2, 3, 4].map((i) => {
        const y = 330 + i * 14 + i * i * 2
        const t = 5 + i * 2.2
        return `<path d="M-10 ${y} Q40 ${y - 5} 90 ${y - 5} Q150 ${y - 9} 210 ${y - 14} Q260 ${y - 16} 310 ${y - 22} L310 ${n(y - 22 + t)} Q150 ${n(y - 9 + t)} -10 ${n(y + t)}Z" fill="${C.grey}" ${E}/><path d="M-10 ${n(y + t)} Q150 ${n(y - 9 + t)} 310 ${n(y - 22 + t)} L310 ${n(y - 22 + t * 0.6)} Q150 ${n(y - 9 + t * 0.6)} -10 ${n(y + t * 0.6)}Z" ${SH}/>`
      }).join('') +
      `<path d="M0 322 L300 322" ${line(2, C.ink, 0.12)}/>`,
  }),
  // 鵜戸神宮（data/spots/miyazaki.json wd-Q704430，https://zh.wikipedia.org/wiki/%E9%B5%9C%E6%88%B6%E7%A5%9E%E5%AE%AE）：海邊斷崖的岩洞裡朱色的本殿，左邊是太平洋與綁著注連繩的龜石
  bg({
    id: 'bg-miyazaki-udo-jingu',
    name: '鵜戶神宮',
    pref: 'miyazaki',
    rarity: 2,
    art:
      sky(C.blue, 0.26) +
      cloud(70, 70, 1.3) +
      cloud(150, 30, 0.9, 0.8) +
      `<rect y="214" width="300" height="110" fill="${C.cream}"/><rect y="214" width="300" height="110" fill="${C.blue}" opacity=".42"/>` +
      ridge([[-10, 214], [10, 200], [40, 206], [70, 214]], C.green, 0.4, 216) +
      ripples([[40, 232], [110, 240], [150, 228], [80, 256], [130, 270], [30, 280], [160, 290]], 18, 0.55) +
      `<path d="M188 330 L190 240 C192 170 210 110 248 84 L320 70 L320 330Z" fill="${C.grey}" ${E}/>` +
      `<path d="M188 330 L190 240 C192 170 210 110 248 84 L320 70 L320 330Z" fill="${C.brown}" opacity=".26"/>` +
      `<path d="M206 140 Q260 124 310 130 M194 200 Q250 182 310 188 M226 104 Q270 92 310 96" ${line(1.4, C.ink, 0.14)}/>` +
      crowns([[250, 82, 12], [272, 74, 14], [296, 70, 14], [316, 72, 12]], C.green, 0.9) +
      `<path d="M196 326 C194 266 208 210 244 200 C278 194 300 220 306 250 L306 326Z" fill="${C.navy}" opacity=".42" ${E}/>` +
      `<path d="M196 326 C194 266 208 210 244 200 C228 214 216 250 216 326Z" fill="${C.cream}" opacity=".12"/>` +
      at(244, 320, 0.78, UDO_HALL) +
      `<g fill="${C.grey}" ${E}><path d="M-6 330 L-6 300 C10 292 30 296 40 306 L60 302 C70 296 90 300 96 314 L100 330Z"/><path d="M128 322 C134 312 150 310 160 318 L164 326 L126 326Z"/></g>` +
      `<path d="M40 300 C42 286 58 278 76 280 C90 282 100 290 98 302 L44 304Z" fill="${C.brown}" ${E}/><path d="M96 292 C102 288 110 290 110 296 C108 300 102 300 97 298Z" fill="${C.brown}" ${E}/>` +
      `<path d="M62 282 L78 282 L78 290 L62 290Z" fill="${C.ink}" opacity=".45"/><path d="M60 280 L80 280 L80 292 L60 292Z" ${line(1.6, C.white, 0.9)}/>` +
      `<path d="M76 304 C78 290 86 280 98 284 C90 290 86 298 84 304Z" ${SH}/>` +
      `<g fill="${C.white}" opacity=".8"><circle cx="30" cy="300" r="6"/><circle cx="20" cy="304" r="5"/><circle cx="104" cy="312" r="5"/><circle cx="114" cy="316" r="4"/></g>` +
      ground(C.grey, 326, 0.5) +
      `<path d="M0 346 L300 346 M0 372 L300 372 M60 326 L40 400 M240 326 L262 400" ${line(1.2, C.white, 0.4)}/>`,
  }),
  // 高千穂峡（data/spots/miyazaki.json wd-Q2027215，https://zh.wikipedia.org/wiki/%E9%AB%98%E5%8D%83%E7%A9%97%E5%B3%BD）：夏天，柱狀節理的峭壁夾著翠綠的五瀨川，左邊是從崖上落下的真名井瀑布，水上有手划船，遠處跨過峽谷的拱橋
  bg({
    id: 'bg-miyazaki-takachiho-kyo',
    name: '高千穗峽',
    pref: 'miyazaki',
    rarity: 3,
    art:
      sky(C.blue, 0.22) +
      `<path d="M60 96 Q150 40 240 96 L240 102 Q150 50 60 102Z" fill="${C.grey}" opacity=".5" ${E}/>` +
      `<path d="M96 96 L96 74 M120 82 L120 58 M150 76 L150 46 M180 82 L180 58 M204 96 L204 74" ${line(2, C.grey, 0.5)}/>` +
      crowns([[110, 140, 26], [150, 126, 30], [192, 138, 26]], C.green, 0.3) +
      `<path d="M96 300 L104 150 L196 150 L204 300Z" fill="${C.grey}" opacity=".3"/>` +
      `<path d="M112 300 L120 170 L180 170 L188 300Z" fill="${C.green}" opacity=".2"/>` +
      `<path d="M-10 300 L-10 98 L54 102 C76 106 88 116 92 132 L100 300Z" fill="${C.grey}" ${E}/>` +
      `<path d="M-10 300 L-10 98 L54 102 C76 106 88 116 92 132 L100 300Z" fill="${C.brown}" opacity=".32"/>` +
      columns(-6, 96, 104, 300, 10) +
      `<path d="M310 300 L310 80 L246 86 C222 92 210 104 206 122 L198 300Z" fill="${C.grey}" ${E}/>` +
      `<path d="M310 300 L310 80 L246 86 C222 92 210 104 206 122 L198 300Z" fill="${C.brown}" opacity=".32"/>` +
      columns(200, 306, 90, 300, 10) +
      `<path d="M310 300 L310 80 L246 86 C222 92 210 104 206 122 L198 300Z" ${SH}/>` +
      `<path d="M6 104 L6 150 M20 102 L20 128 M34 104 L34 172 M88 126 L88 160 M214 112 L214 170 M230 92 L230 130 M262 86 L262 150 M292 82 L292 118 M246 88 L246 112" ${line(3, C.green, 0.7)}/>` +
      crowns([[-4, 92, 20], [20, 86, 18], [44, 94, 16], [66, 100, 14], [306, 74, 20], [282, 76, 18], [258, 82, 16], [236, 92, 13]], C.green) +
      crowns([[8, 98, 12], [34, 100, 10], [294, 84, 12], [270, 88, 10]], C.matcha) +
      `<g fill="${C.green}" opacity=".85" ${E}><path d="M-10 170 C10 160 24 168 22 180 C10 186 -4 184 -10 182Z"/><path d="M310 160 C292 152 276 162 280 174 C292 180 304 178 310 176Z"/><path d="M310 230 C296 224 284 232 288 242 C298 246 306 244 310 242Z"/><path d="M-10 236 C6 230 18 238 14 248 C4 252 -6 250 -10 248Z"/></g>` +
      `<path d="M56 112 C64 112 70 116 72 124 L76 296 L56 296 C58 230 56 160 52 118Z" fill="${C.white}" opacity=".88" ${E}/>` +
      `<path d="M60 130 L62 290 M66 128 L69 292 M71 140 L73 290" ${line(1.2, C.blue, 0.3)}/>` +
      `<rect y="292" width="300" height="38" fill="${C.cream}"/><rect y="292" width="300" height="38" fill="${C.green}" opacity=".62"/><rect y="292" width="300" height="38" fill="${C.blue}" opacity=".15"/>` +
      `<path d="M-10 292 L310 292 L310 298 Q150 302 -10 298Z" fill="${C.ink}" opacity=".1"/>` +
      `<path d="M56 300 L76 300 L84 326 L48 326Z" fill="${C.white}" opacity=".25"/>` +
      `<g fill="${C.white}" opacity=".8"><circle cx="56" cy="296" r="9"/><circle cx="72" cy="294" r="10"/><circle cx="86" cy="298" r="7"/><circle cx="44" cy="300" r="6"/></g>` +
      ripples([[24, 312], [100, 314], [140, 304], [180, 318], [214, 304], [280, 322], [40, 324]], 14, 0.6) +
      at(268, 306, 0.95, BOAT) +
      at(234, 322, 1.4, BOAT) +
      ground(C.brown, 328, 0.42) +
      `<path d="M0 340 L300 340 M0 354 L300 354 M0 370 L300 370 M0 388 L300 388" ${line(1.4, C.ink, 0.16)}/>` +
      `<path d="M40 328 L40 340 M150 340 L150 354 M70 354 L70 370 M230 354 L230 370 M120 370 L120 388 M260 328 L260 340 M200 388 L200 400" ${line(1.2, C.ink, 0.14)}/>` +
      `<path d="M0 330 L300 330" ${line(2, C.white, 0.45)}/>`,
  }),
]

// ---------- 鹿児島 ----------
/** 黑松：彎的樹幹＋幾片平的葉叢（原點在樹根） */
function pine(flip = 1): string {
  const pads: number[][] = [[-14, -34, 30, 9], [14, -50, 34, 10], [-8, -66, 28, 9], [10, -80, 20, 7]]
  const d = pads.map(([x, y, w, h]) => `M${(x - w / 2) * flip} ${y} A${w / 2} ${h} 0 0 ${flip > 0 ? 1 : 0} ${(x + w / 2) * flip} ${y}Z`).join('')
  return (
    `<path d="M-3 0 Q${-8 * flip} -20 ${2 * flip} -40 Q${8 * flip} -58 ${2 * flip} -78 M${2 * flip} -40 L${-12 * flip} -34 M${5 * flip} -50 L${16 * flip} -50" ${line(4.5, C.brown)}/>` +
    `<path d="${d}" fill="${C.green}" ${E}/><path d="${pads.map(([x, y, w]) => `M${(x - w / 2) * flip} ${y} L${(x + w / 2) * flip} ${y} L${(x + w / 2 - 4) * flip} ${y - 3} L${(x - w / 2 + 4) * flip} ${y - 3}Z`).join('')}" ${SH}/>`
  )
}
/** 仙巖園的錫門：朱色的門、錫瓦的屋頂，兩邊接白牆（原點在地面中央） */
const SUZUMON =
  `<g fill="${C.white}" ${E}><path d="M-64 0 L-24 0 L-24 -30 L-64 -30Z M24 0 L64 0 L64 -30 L24 -30Z"/></g>` +
  `<g fill="${C.grey}" ${E}><path d="M-66 -29 L-24 -29 L-24 -37 L-62 -37Z M24 -29 L66 -29 L62 -37 L24 -37Z"/></g>` +
  `<path d="M-64 -8 L-24 -8 M24 -8 L64 -8" ${line(3, C.grey, 0.6)}/>` +
  `<g fill="${C.red}" ${E}><path d="M-24 0 L-17 0 L-17 -46 L-24 -46Z M17 0 L24 0 L24 -46 L17 -46Z"/><path d="M-17 0 L17 0 L17 -40 L-17 -40Z"/><path d="M-27 -44 L27 -44 L27 -50 L-27 -50Z"/></g>` +
  `<path d="M0 0 L0 -40" ${line(1.2, C.ink, 0.35)}/><path d="M17 0 L24 0 L24 -46 L17 -46Z" ${SH}/>` +
  [-11, -5, 5, 11].map((x) => `<circle cx="${x}" cy="-28" r="1.3" fill="${C.gold}"/><circle cx="${x}" cy="-14" r="1.3" fill="${C.gold}"/>`).join('') +
  shape('M-42 -48 Q-20 -51 0 -51 Q20 -51 42 -48 L44 -52 L32 -70 L-32 -70 L-44 -52Z', C.grey) +
  `<path d="M-42 -48 Q0 -52 42 -48 L44 -52 L32 -70 L-32 -70 L-44 -52Z" fill="${C.white}" opacity=".3"/>` +
  `<path d="M-30 -66 L-38 -52 M-16 -68 L-20 -51 M0 -69 L0 -51 M16 -68 L20 -51 M30 -66 L38 -52" ${line(1, C.ink, 0.2)}/>` +
  `<path d="M-33 -70 L33 -70" ${line(3, C.ink, 0.45)}/><path d="M10 -70 L32 -70 L44 -52 L42 -48 Q30 -50 20 -51Z" ${SH}/>`
/** 獅子乘大石燈籠：天然石疊成的大燈籠，笠上蹲著一隻獅子（原點在地面中央） */
const LION_LANTERN =
  `<g fill="${C.grey}" ${E}><path d="M-24 0 C-26 -10 -16 -17 0 -17 C16 -17 26 -10 24 0Z"/><path d="M-7 -16 L7 -16 L6 -44 L-6 -44Z"/>` +
  `<path d="M-15 -43 C-14 -48 14 -48 15 -43 L12 -50 L-12 -50Z"/><path d="M-10 -50 L10 -50 L10 -66 L-10 -66Z"/>` +
  `<path d="M-38 -65 C-22 -72 22 -72 38 -65 C30 -78 12 -84 0 -84 C-12 -84 -30 -78 -38 -65Z"/>` +
  `<path d="M-12 -83 C-14 -90 -6 -93 2 -92 C2 -100 10 -103 14 -97 C18 -94 17 -88 13 -86 L14 -82 Z"/></g>` +
  `<rect x="-5" y="-63" width="10" height="9" fill="${C.ink}" opacity=".35"/>` +
  `<path d="M0 -17 C16 -17 26 -10 24 0 L8 0Z M2 -16 L7 -16 L6 -44 L2 -44Z M8 -84 C20 -82 32 -76 38 -65 C28 -70 16 -71 4 -71Z" ${SH}/>` +
  `<path d="M-20 -6 C-12 -12 -4 -12 4 -10 M-30 -70 C-16 -76 0 -78 14 -76" ${line(1.4, C.matcha, 0.6)}/>`
/** 繩文杉：左邊放不下的巨大樹幹，右緣凹凸（樹瘤），往右上伸出粗枝；青苔長在樹瘤上 */
const JOMON_EDGE: Pt[] = [[112, 336], [90, 318], [96, 286], [80, 258], [88, 226], [72, 194], [78, 160], [64, 128], [70, 96], [58, 64], [62, 30], [52, -10]]
const JOMON_K = [0.58, 0.8, 0.64, 0.95, 0.6, 0.72]
const JOMON_D = `M-20 336 L${JOMON_EDGE[0].join(' ')}` + JOMON_EDGE.slice(1).map((p, i) => arc(JOMON_EDGE[i][0], JOMON_EDGE[i][1], p[0], p[1], JOMON_K[i % 6]) .replace('0 0 1', '0 0 0')).join('') + ' L-20 -10Z'
const JOMON =
  `<path d="M24 120 C60 80 100 50 150 26 C180 12 210 0 240 -12 L248 6 C214 16 184 30 156 48 C116 72 80 102 56 136Z M36 72 C50 42 62 18 72 -12 L90 -10 C80 22 68 48 56 84Z" fill="${C.brown}" ${E}/>` +
  `<path d="M24 120 C60 80 100 50 150 26 C180 12 210 0 240 -12 L248 6 C214 16 184 30 156 48 C116 72 80 102 56 136Z M36 72 C50 42 62 18 72 -12 L90 -10 C80 22 68 48 56 84Z" fill="${C.grey}" opacity=".3"/>` +
  `<path d="M60 128 C84 100 116 72 156 48 C184 30 214 16 248 6 L246 0 C210 12 180 26 150 42 C110 66 80 94 56 120Z" ${SH}/>` +
  `<path d="M100 336 C92 330 82 330 70 334 L-20 340 L-20 336Z" fill="${C.brown}" ${E}/>` +
  `<path d="${JOMON_D}" fill="${C.brown}" ${E}/><path d="${JOMON_D}" fill="${C.grey}" opacity=".3"/>` +
  `<path d="M50 336 C58 300 46 260 56 220 C62 180 50 140 56 100 C60 60 50 20 54 -10 L52 -10 L62 30 L58 64 L70 96 L64 128 L78 160 L72 194 L88 226 L80 258 L96 286 L90 318 L112 336Z" ${SH}/>` +
  `<path d="M8 336 C16 290 4 250 14 200 C22 160 10 120 18 70 C22 40 16 14 20 -10 M34 330 C40 290 30 250 38 210 M40 180 C34 150 44 110 36 60" ${line(1.8, C.ink, 0.2)}/>` +
  `<path d="M66 246 Q78 238 84 250 M54 148 Q66 140 72 152 M48 62 Q58 54 64 66 M78 300 Q92 292 98 304" ${line(1.6, C.ink, 0.22)}/>` +
  `<g fill="${C.matcha}" ${E}>${[[98, 320, 10, 5], [86, 224, 8, 4], [76, 160, 8, 4], [66, 98, 7, 3.5], [60, 32, 6, 3], [98, 288, 6, 3], [20, 332, 16, 6], [40, 250, 7, 3.5], [24, 140, 6, 3]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join('')}</g>` +
  `<path d="M98 300 Q106 290 112 282 M98 300 Q94 288 96 278 M84 210 Q92 202 98 196" ${line(2, C.green, 0.85)}/>`

const KAGOSHIMA: Outfit[] = [
  // 開聞岳（data/spots/kagoshima.json wd-Q713847，https://zh.wikipedia.org/wiki/%E9%96%8B%E8%81%9E%E5%B2%B3）：早春，池田湖畔的油菜花田，湖的對岸是圓錐形的「薩摩富士」開聞岳
  bg({
    id: 'bg-kagoshima-kaimondake',
    name: '開聞岳',
    pref: 'kagoshima',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(70, 80, 1.2) +
      cloud(200, 40, 0.9, 0.8) +
      ridge([[-10, 284], [30, 262], [80, 270], [130, 276]], C.navy, 0.18, 290) +
      `<path d="M100 292 C150 274 190 210 214 160 L220 150 L234 150 L240 160 C264 210 300 270 350 292Z" fill="${C.navy}" opacity=".36" ${E}/>` +
      `<path d="M227 150 L234 150 L240 160 C264 210 300 270 350 292 L262 292 C252 240 240 190 227 150Z" ${SH}/>` +
      `<path d="M120 288 C160 278 190 262 226 258 C262 260 300 276 340 290Z" fill="${C.green}" opacity=".35"/>` +
      `<rect y="288" width="300" height="26" fill="${C.cream}"/><rect y="288" width="300" height="26" fill="${C.blue}" opacity=".38"/>` +
      `<path d="M180 292 L272 292 L262 298 L190 298Z" fill="${C.navy}" opacity=".1"/>` +
      ripples([[40, 298], [96, 304], [150, 296], [210, 306], [262, 300]], 16, 0.55) +
      ground(C.matcha, 312, 0.45) +
      fog(-6, 306, 316, 8, 1, 3, C.yellow, 8) +
      fog(-6, 306, 330, 10, 1, 7, C.yellow, 11) +
      fog(-6, 306, 348, 12, 1, 9, C.yellow, 14) +
      fog(-6, 306, 370, 14, 1, 2, C.yellow, 18) +
      `<path d="M138 312 L162 312 L198 400 L102 400Z" fill="${C.cream}" ${E}/>` +
      `<path d="M8 352 L8 340 M30 352 L30 338 M56 354 L56 340 M244 352 L244 338 M270 354 L270 340 M292 352 L292 338 M20 386 L20 370 M64 388 L64 372 M236 388 L236 372 M282 386 L282 370" ${line(1.6, C.green, 0.7)}/>` +
      fog(-6, 96, 382, 18, 1, 5, C.yellow, 20) +
      fog(206, 306, 380, 20, 1, 8, C.yellow, 20) +
      `<g fill="${C.orange}" opacity=".4">${[[14, 382], [40, 386], [70, 384], [226, 382], [256, 384], [286, 380], [24, 366], [270, 364], [44, 346], [262, 346]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2"/>`).join('')}</g>`,
  }),
  // 縄文杉（data/spots/kagoshima.json wd-Q589967，https://zh.wikipedia.org/wiki/%E7%B9%A9%E6%96%87%E6%9D%89）：屋久島霧裡的森林，長滿青苔、樹瘤累累的繩文杉，前面是觀景的木棧台
  bg({
    id: 'bg-kagoshima-jomon-sugi',
    name: '繩文杉',
    pref: 'kagoshima',
    rarity: 2,
    art:
      sky(C.green, 0.16) +
      `<g fill="${C.brown}" opacity=".16"><rect x="128" y="0" width="14" height="330"/><rect x="176" y="0" width="18" height="330"/><rect x="214" y="0" width="12" height="330"/></g>` +
      fog(-10, 310, 210, 30, 0.42, 5) +
      `<g fill="${C.brown}" opacity=".4" ${E}><path d="M238 0 L262 0 L264 330 L234 330Z"/><path d="M282 0 L300 0 L302 330 L278 330Z"/></g>` +
      `<path d="M238 0 L262 0 L264 330 L252 330Z M290 0 L300 0 L302 330 L292 330Z" ${SH}/>` +
      `<path d="M240 40 L240 200 M250 120 L252 300 M286 60 L288 240" ${line(1.4, C.ink, 0.14)}/>` +
      JOMON +
      crowns([[250, -4, 26], [214, 4, 22], [176, 18, 20], [140, 30, 16], [286, 8, 24], [100, 40, 14], [-4, 6, 26], [30, -6, 22]], C.green, 0.9) +
      crowns([[232, 14, 12], [196, 22, 11], [160, 34, 10], [268, 22, 12]], C.matcha, 0.9) +
      `<path d="M300 40 L300 90 L210 330 L180 330Z M230 40 L246 40 L150 330 L134 330Z" fill="${C.white}" opacity=".12"/>` +
      fog(110, 310, 296, 20, 0.4, 11, C.white, 50) +
      `<g fill="${C.matcha}" ${E}><path d="M150 334 C150 318 176 312 192 320 C204 314 222 318 224 334Z"/><path d="M236 334 C238 320 262 314 276 322 C288 316 306 322 306 334Z"/></g>` +
      `<path d="M168 324 Q160 304 146 298 M168 324 Q172 302 186 294 M168 324 Q182 312 198 310 M258 324 Q250 304 236 300 M258 324 Q266 302 282 296 M258 324 Q244 314 228 312" ${line(2.4, C.green, 0.9)}/>` +
      ground(C.brown, 326, 0.42) +
      `<path d="M0 338 L300 338 M0 354 L300 354 M0 374 L300 374 M0 396 L300 396" ${line(1.4, C.ink, 0.16)}/>` +
      `<path d="M0 318 L300 318" ${line(3.4, C.brown)}/><path d="M14 316 L14 334 M84 316 L84 334 M154 316 L154 334 M224 316 L224 334 M294 316 L294 334" ${line(3.6, C.brown)}/>` +
      `<path d="M0 316.5 L300 316.5" ${line(1, C.white, 0.4)}/>`,
  }),
  // 仙巌園（data/spots/kagoshima.json wd-Q10884282，https://zh.wikipedia.org/wiki/%E4%BB%99%E5%B7%96%E5%9C%92）：島津家的庭園，朱色的錫門、獅子乘大石燈籠與黑松，借景錦江灣對岸冒著煙的櫻島
  bg({
    id: 'bg-kagoshima-senganen',
    name: '仙巖園',
    pref: 'kagoshima',
    rarity: 3,
    art:
      sky(C.blue, 0.24) +
      cloud(60, 60, 1.1) +
      `<g transform="translate(4 5)">${steam([[256, 140, 116, 50]], -52, 0.3, C.grey, 0.28)}</g>` +
      steam([[256, 140, 116, 50]], -52, 0.82, C.white, 0.28) +
      `<path d="M0 280 C60 260 120 224 166 186 C186 168 198 150 212 134 L222 140 L234 136 L246 148 L256 140 L266 152 C290 184 310 204 330 218 L330 280Z" fill="${C.navy}" opacity=".34" ${E}/>` +
      `<path d="M234 136 L246 148 L256 140 L266 152 C290 184 310 204 330 218 L330 280 L262 280 C262 236 252 190 234 136Z" ${SH}/>` +
      `<path d="M20 278 C70 266 120 250 170 240 C220 236 270 240 330 248 L330 282 L0 282Z" fill="${C.green}" opacity=".28"/>` +
      `<path d="M214 146 L222 164 M246 152 L240 184 M198 160 L192 186" ${line(1.4, C.white, 0.35)}/>` +
      `<rect y="278" width="300" height="30" fill="${C.cream}"/><rect y="278" width="300" height="30" fill="${C.blue}" opacity=".42"/>` +
      ripples([[30, 290], [90, 296], [150, 286], [200, 298], [270, 290]], 18, 0.55) +
      `<path d="M-6 312 C40 302 100 306 150 302 C200 298 260 304 306 300 L306 316 L-6 316Z" fill="${C.green}" ${E}/>` +
      fog(-6, 306, 306, 10, 1, 4, C.green, 14) +
      at(286, 324, 1.6, pine(-1)) +
      at(56, 326, 1.15, SUZUMON) +
      at(248, 328, 1.12, LION_LANTERN) +
      ground(C.matcha, 320, 0.35) +
      `<path d="M120 320 L180 320 L214 400 L86 400Z" fill="${C.cream}" opacity=".8" ${E}/>` +
      `<g fill="${C.green}" ${E}><ellipse cx="20" cy="352" rx="22" ry="10"/><ellipse cx="290" cy="356" rx="24" ry="11"/><ellipse cx="270" cy="384" rx="16" ry="7"/></g>` +
      `<path d="M0 340 L300 340" ${line(1, C.white, 0.3)}/>`,
  }),
]

// ---------- 沖縄 ----------
/** 赤瓦的屋頂：紅瓦疊一層橙，上面幾條白色的灰泥線（d 是屋頂的輪廓，rows 是灰泥線的 y） */
const redRoof = (d: string, rows: string) =>
  `<path d="${d}" fill="${C.red}" ${E}/><path d="${d}" fill="${C.orange}" opacity=".3"/><path d="${rows}" ${line(1.4, C.white, 0.85)}/>`
/** 守禮門：四根朱柱、三間，下層屋頂橫跨整座門，上層只蓋中間（以 x 150 為中心，地面 y 326） */
function shureimon(): string {
  let out = ''
  for (const x of [36, 84, 216, 264]) {
    out += shape(`M${x - 9} 326 L${x + 9} 326 L${x + 8} 314 L${x - 8} 314Z`, C.white)
    out += shape(`M${x - 4.5} 314 L${x + 4.5} 314 L${x + 4.5} 214 L${x - 4.5} 214Z`, C.red)
    out += `<path d="M${x + 1.5} 314 L${x + 4.5} 314 L${x + 4.5} 214 L${x + 1.5} 214Z" ${SH}/>`
  }
  out += `<g fill="${C.red}" ${E}><path d="M30 226 L90 226 L90 232 L30 232Z M210 226 L270 226 L270 232 L210 232Z M80 220 L220 220 L220 228 L80 228Z"/></g>`
  out += `<path d="M30 229 L90 229 M210 229 L270 229" ${line(1, C.gold, 0.8)}/>`
  // 下層屋頂
  out += shape('M10 210 Q30 214 40 216 L260 216 Q270 214 290 210 L282 206 L250 184 L50 184 L18 206Z', C.red)
  out += redRoof('M12 208 Q30 212 40 213 L260 213 Q270 212 288 208 L250 184 L50 184Z', 'M30 202 L270 202 M40 194 L260 194 M52 186 L248 186')
  out += `<path d="M150 184 L250 184 L288 208 Q270 212 260 213 L150 213Z" ${SH}/>`
  // 上層：朱色的框與屋頂
  out += shape('M84 186 L216 186 L216 162 L84 162Z', C.red) + `<path d="M84 174 L216 174" ${line(1.2, C.gold, 0.8)}/>`
  out += `<rect x="128" y="164" width="44" height="18" fill="${C.ink}" opacity=".7"/>`
  out += shape('M62 160 Q76 163 86 164 L214 164 Q224 163 238 160 L208 134 L92 134Z', C.red)
  out += redRoof('M62 160 Q76 163 86 164 L214 164 Q224 163 238 160 L208 134 L92 134Z', 'M76 154 L224 154 M86 146 L214 146 M94 138 L206 138')
  out += `<path d="M150 134 L208 134 L238 160 Q224 163 214 164 L150 164Z" ${SH}/>`
  return out + `<path d="M92 134 L208 134 M50 184 L250 184" ${line(2.6, C.white, 0.9)}/>`
}
/** 竹富島的民家：赤瓦寄棟、屋脊上的風獅爺、木造的牆（原點在左下角，寬 w） */
function takeHouse(w: number, flip = false): string {
  const roof = `M-8 -36 L${w + 8} -36 L${w - 14} -66 L14 -66Z`
  const sx = flip ? 30 : w - 30
  return (
    shape(`M0 0 L${w} 0 L${w} -36 L0 -36Z`, C.brown) +
    `<path d="M${w * 0.2} -4 L${w * 0.2} -30 L${w * 0.8} -30 L${w * 0.8} -4Z" fill="${C.ink}" opacity=".3"/>` +
    redRoof(roof, `M-2 -42 L${w + 2} -42 M4 -50 L${w - 4} -50 M10 -58 L${w - 10} -58`) +
    `<path d="M14 -66 L${w - 14} -66" ${line(2.6, C.white, 0.9)}/><path d="M${w / 2} -66 L${w + 8} -36 L${w / 2} -36Z" ${SH}/>` +
    `<path d="M${sx - 5} -66 L${sx - 5} -74 C${sx - 5} -80 ${sx + 5} -80 ${sx + 5} -74 L${sx + 7} -70 L${sx + 7} -66Z" fill="${C.orange}" ${E}/><circle cx="${sx + 1}" cy="-76" r="1.2" fill="${C.ink}"/>`
  )
}
/** 珊瑚石牆（グック）：不規則的石塊疊成（x0..x1，地面 y、高 h） */
function coralWall(x0: number, x1: number, y: number, h: number): string {
  let seams = ''
  for (let x = x0, i = 0; x < x1; x += 14, i++) seams += `M${x} ${y - h + 1 + (i % 2) * 2} L${x + 3} ${y - h / 2} L${x - 1} ${y} M${x + 3} ${y - h / 2} L${x + 11} ${y - h / 2 + (i % 3) - 1}`
  return shape(`M${x0} ${y} L${x0} ${y - h} Q${(x0 + x1) / 2} ${y - h - 3} ${x1} ${y - h} L${x1} ${y}Z`, C.white) + `<path d="M${x0} ${y} L${x0} ${y - h} Q${(x0 + x1) / 2} ${y - h - 3} ${x1} ${y - h} L${x1} ${y}Z" fill="${C.grey}" opacity=".35"/><path d="${seams}" ${line(1, C.ink, 0.22)}/>`
}
/** 水牛車：灰色的水牛拉著有頂棚的木車（原點在水牛前腳下，往右） */
const BUFFALO_CART =
  `<path d="M34 -4 L34 -40 M84 -4 L84 -40" ${line(2.4, C.brown)}/>` +
  shape('M26 -42 L92 -42 L88 -50 L30 -50Z', C.cream) +
  `<path d="M28 -46 L90 -46" ${line(1.2, C.red, 0.8)}/>` +
  shape('M28 -4 L90 -4 L90 -16 L28 -16Z', C.brown) +
  `<circle cx="44" cy="-4" r="9" fill="${C.brown}" ${E}/><circle cx="44" cy="-4" r="3" fill="${C.ink}" opacity=".4"/><circle cx="78" cy="-4" r="9" fill="${C.brown}" ${E}/><circle cx="78" cy="-4" r="3" fill="${C.ink}" opacity=".4"/>` +
  `<path d="M24 -14 L28 -12" ${line(2, C.brown)}/>` +
  shape('M2 0 L2 -12 C0 -22 4 -28 12 -28 L24 -28 C30 -28 32 -22 30 -14 L30 0 L26 0 L25 -10 L8 -10 L7 0Z', C.grey) +
  shape('M-8 -18 C-10 -26 -4 -32 4 -30 L8 -24 C6 -18 0 -14 -6 -14Z', C.grey) +
  `<path d="M-2 -30 C-8 -36 -14 -34 -16 -28 M4 -30 C8 -38 14 -36 16 -32" ${line(2, C.ink, 0.6)}/>` +
  `<path d="M12 -28 L24 -28 C30 -28 32 -22 30 -14 L30 0 L26 0 L25 -10 L16 -10Z" ${SH}/>`

const OKINAWA: Outfit[] = [
  // 竹富島（data/spots/okinawa.json wd-Q474560，https://zh.wikipedia.org/wiki/%E7%AB%B9%E5%AF%8C%E5%B3%B6）：白砂路兩旁是珊瑚石牆與赤瓦民家（屋脊上有風獅爺），九重葛垂在牆上，水牛車走在路上
  bg({
    id: 'bg-okinawa-taketomi',
    name: '竹富島',
    pref: 'okinawa',
    rarity: 1,
    art:
      sky(C.blue, 0.34) +
      cloud(150, 92, 2.2) +
      cloud(250, 34, 1, 0.85) +
      crowns([[-4, 236, 26], [30, 226, 28], [70, 238, 24], [234, 234, 24], [268, 224, 28], [304, 236, 26]], C.green) +
      crowns([[14, 220, 14], [262, 216, 14], [52, 230, 12]], C.matcha) +
      at(-8, 304, 1, takeHouse(98)) +
      at(214, 302, 1, takeHouse(96, true)) +
      coralWall(-6, 106, 324, 24) +
      coralWall(194, 306, 324, 24) +
      crowns([[6, 300, 7], [18, 296, 8], [32, 300, 6], [44, 298, 7], [14, 311, 6], [28, 314, 5], [56, 302, 6]], C.pink) +
      crowns([[10, 304, 4], [36, 304, 4], [20, 316, 3]], C.purple, 0.7) +
      crowns([[262, 298, 8], [276, 302, 7], [290, 298, 8], [270, 312, 5]], C.green) +
      crowns([[266, 296, 3], [284, 304, 3], [292, 296, 3]], C.red) +
      ground(C.cream, 324) +
      `<path d="M120 324 L180 324 L250 400 L50 400Z" fill="${C.white}" opacity=".8"/>` +
      `<path d="M-6 324 L106 324 L106 328 L-6 336Z M194 324 L306 324 L306 336 L194 328Z" ${SH}/>` +
      `<g transform="translate(252 384) scale(-1 1)">${BUFFALO_CART}</g>`,
  }),
  // 万座毛（data/spots/okinawa.json wd-Q11353838，https://zh.wikipedia.org/wiki/%E8%90%AC%E5%BA%A7%E6%AF%9B）：夕陽西沉的東海，海邊斷崖上像象鼻的岩石（中間穿了一個洞），崖頂是草地
  bg({
    id: 'bg-okinawa-manzamo',
    name: '萬座毛',
    pref: 'okinawa',
    rarity: 2,
    art:
      sky(C.orange, 0.36, C.cream) +
      cloud(60, 62, 1.5, 0.6, C.pink) +
      cloud(250, 120, 1.3, 0.55, C.pink) +
      cloud(200, 34, 1, 0.35, C.purple) +
      cloud(30, 196, 0.9, 0.5, C.pink) +
      sun(84, 238, 24, C.yellow, 0.95) +
      ridge([[-10, 246], [20, 236], [56, 244]], C.navy, 0.22, 248) +
      `<rect y="246" width="300" height="80" fill="${C.cream}"/><rect y="246" width="300" height="80" fill="${C.navy}" opacity=".3"/><rect y="246" width="300" height="80" fill="${C.pink}" opacity=".2"/>` +
      `<path d="M66 252 L102 252 M60 262 L108 262 M70 272 L98 272 M56 284 L112 284 M68 296 L100 296 M60 310 L108 310" ${line(2.2, C.yellow, 0.8)}/>` +
      ripples([[20, 270], [140, 262], [150, 290], [30, 300], [170, 312]], 16, 0.5) +
      `<path d="M204 304 C200 290 200 276 204 264 C208 252 206 242 204 234 C204 220 214 210 234 206 L312 202 L312 304 L268 304 C268 278 258 256 244 256 C230 256 224 278 224 304Z" fill="${C.grey}" ${E}/>` +
      `<path d="M204 304 C200 290 200 276 204 264 C208 252 206 242 204 234 C204 220 214 210 234 206 L312 202 L312 304 L268 304 C268 278 258 256 244 256 C230 256 224 278 224 304Z" fill="${C.orange}" opacity=".28"/>` +
      `<path d="M268 304 C268 278 258 256 244 256 C256 264 260 284 260 304Z M280 210 L312 206 L312 304 L290 304 C294 270 288 240 280 210Z M204 234 C204 220 214 210 234 206 C222 214 216 224 214 240 C212 250 214 258 212 266Z" ${SH}/>` +
      `<path d="M224 228 Q244 222 264 228 M272 248 Q292 242 312 246 M272 278 Q292 272 312 276 M208 270 Q214 268 218 272" ${line(1.2, C.ink, 0.16)}/>` +
      shape('M204 232 C206 218 216 210 234 206 L312 202 L312 211 L238 215 C224 218 214 224 208 238Z', C.matcha) +
      `<g fill="${C.white}" opacity=".75"><path d="M196 304 C204 298 214 300 218 304Z"/><path d="M226 304 C236 298 254 298 264 304Z"/><path d="M286 304 C296 298 306 298 312 304Z"/></g>` +
      ground(C.matcha, 322, 0.45) +
      `<rect y="322" width="300" height="78" fill="${C.orange}" opacity=".12"/>` +
      crowns([[-4, 328, 14], [20, 330, 12], [278, 326, 14], [302, 328, 12], [40, 334, 8], [258, 332, 8]], C.green) +
      `<g fill="${C.grey}" ${E}><path d="M60 360 C66 350 82 350 88 360Z"/><path d="M230 380 C236 372 250 372 254 380Z"/><path d="M150 392 C154 386 164 386 168 392Z"/></g>` +
      `<path d="M0 322 L300 322" ${line(2, C.white, 0.5)}/>`,
  }),
  // 首里城（data/spots/okinawa.json wd-Q907052，https://zh.wikipedia.org/wiki/%E9%A6%96%E9%87%8C%E5%9F%8E）：朱色的守禮門（三間、兩層的赤瓦屋頂），門後是琉球石灰岩的城牆與綾門大道的石板路
  bg({
    id: 'bg-okinawa-shurijo',
    name: '首里城',
    pref: 'okinawa',
    rarity: 3,
    art:
      sky(C.blue, 0.3) +
      cloud(60, 70, 1.6) +
      cloud(240, 50, 1.3, 0.9) +
      cloud(150, 24, 0.9, 0.8) +
      crowns([[110, 272, 22], [150, 262, 26], [190, 272, 22], [20, 270, 22], [280, 270, 22]], C.green, 0.5) +
      `<path d="M60 304 L60 284 C90 276 120 272 150 270 C180 272 210 276 240 284 L240 304Z" fill="${C.cream}" ${E}/>` +
      `<path d="M60 304 L60 284 C90 276 120 272 150 270 C180 272 210 276 240 284 L240 304Z" fill="${C.grey}" opacity=".3"/>` +
      `<path d="M134 304 L134 290 Q150 278 166 290 L166 304Z" fill="${C.ink}" opacity=".3"/>` +
      crowns([[-6, 292, 18], [24, 296, 16], [278, 294, 16], [306, 290, 18]], C.green) +
      ground(C.grey, 320, 0.32) +
      `<rect y="320" width="300" height="80" fill="${C.yellow}" opacity=".08"/>` +
      `<path d="M120 320 L96 400 M180 320 L204 400 M0 344 L300 344 M0 372 L300 372" ${line(1.2, C.white, 0.5)}/>` +
      shureimon(),
  }),
]

export const BG: Outfit[] = [...OITA, ...MIYAZAKI, ...KAGOSHIMA, ...OKINAWA]
