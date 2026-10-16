import type { Outfit } from '../outfits'
import { bg, C, cedar, cloud, E, ground, line, ridge, ripples, SH, shape, sky, sun, tree } from './kit'

/**
 * 地區背景：鳥取、島根、岡山、広島、山口。題材取自 data/spots 的景點，出處是那筆景點的 summary.source_url。
 */

type Pt = [number, number]
const r1 = (v: number) => Math.round(v * 10) / 10
/** 平塗的一片紙（op < 1 時會透出後面） */
const pth = (d: string, fill: string, op = 1) => `<path d="${d}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''} ${E}/>`
/** 不透明的淡色：先鋪米色再疊一層顏色 */
const paper = (d: string, fill: string, op: number, base: string = C.cream) => `<path d="${d}" fill="${base}"/>` + pth(d, fill, op)
/** 一張紙放到 x、y，放大 s 倍；紙的淡邊加在整組上（裡面的 pf、pp 不用再各自帶） */
const at = (x: number, y: number, s: number, body: string) => `<g transform="translate(${r1(x)} ${r1(y)}) scale(${s})" ${E}>${body}</g>`
/** at() 裡面用的平塗紙片（淡邊由外面那組給） */
const pf = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`
/** at() 裡面用的不透明淡色 */
const pp = (d: string, fill: string, op: number) => `<path d="${d}" fill="${C.cream}"/><path d="${d}" fill="${fill}" opacity="${op}"/>`
/** 固定的亂數（同一個 seed 每次都一樣） */
function rnd(seed: number) {
  let k = seed
  return () => (k = (k * 9301 + 49297) % 233280) / 233280
}
/** 一條波浪線（風紋、水紋）：x0 到 x1，每段寬 w、起伏 a */
function wavy(x0: number, x1: number, y: number, w: number, a: number): string {
  let d = `M${x0} ${y}`
  for (let x = x0, i = 0; x < x1; x += w, i++) d += ` q${w / 2} ${i % 2 ? a : -a} ${w} 0`
  return d
}
/** 散落的點（雪、落葉、花瓣）：在 x0–x1、y0–y1 的範圍裡撒 count 個 */
function scatter(count: number, x0: number, x1: number, y0: number, y1: number, rr: number, fill: string, op: number, seed: number): string {
  const rn = rnd(seed)
  let s = ''
  for (let i = 0; i < count; i++) s += `<circle cx="${Math.round(x0 + rn() * (x1 - x0))}" cy="${Math.round(y0 + rn() * (y1 - y0))}" r="${r1(rr * (0.6 + rn() * 0.6))}"/>`
  return `<g fill="${fill}" opacity="${op}">${s}</g>`
}

// ---------- 鳥取 ----------
/** 鳥取砂丘的駱駝（雙峰，朝左）：x、y 腳下，s 大小 */
const camel = (x: number, y: number, s: number) =>
  at(
    x,
    y,
    s,
    `<path d="M-12 -22 L-12.5 0 M-8 -22 L-8.5 0 M10 -22 L10.5 0 M14 -22 L14.5 0" ${line(2.6, C.brown)}/>` +
      pf('M-16 -21 C-19 -28 -17 -33 -12 -34 C-10 -44 -3 -44 -1 -35 C1 -44 9 -44 11 -34 C16 -33 19 -28 18 -21 C10 -18 -8 -18 -16 -21Z', C.brown) +
      `<path d="M1 -36 C4 -42 9 -41 11 -34 C16 -33 19 -28 18 -21 C14 -20 9 -19 5 -19Z" ${SH}/>` +
      pf('M-14 -30 C-21 -32 -24 -38 -25 -45 C-26 -49 -29 -51 -33 -50 L-36 -47.5 C-36.5 -46 -35 -45 -33.5 -45.4 L-30.5 -45.6 C-29.5 -38 -26 -28 -16 -22Z', C.brown) +
      pf('M-4 -37 L3 -37 L5 -24 L-6 -24Z', C.red) +
      `<path d="M18 -27 Q21 -24 20 -18" ${line(1.4, C.brown)}/>`,
  )
/** 遠處的人：小小的剪影 */
const walkers = (pts: Pt[], s = 1) =>
  `<g fill="${C.ink}" opacity=".45">${pts.map(([x, y]) => `<rect x="${r1(x - 0.8 * s)}" y="${r1(y - 5 * s)}" width="${r1(1.6 * s)}" height="${r1(4 * s)}" rx="${r1(0.8 * s)}"/><circle cx="${x}" cy="${r1(y - 5.8 * s)}" r="${r1(1 * s)}"/>`).join('')}</g>`
/** 投入堂：嵌在岩壁凹處的懸造佛堂（左邊連著小的愛染堂），薄的檜皮葺屋頂，下面是長短不一的細柱 */
function nageiredo(): string {
  let d = ''
  for (const [x, y] of [[214, 232], [221, 236], [229, 238], [237, 240], [245, 242], [253, 244], [261, 246], [268, 247]]) d += `M${x} 201 L${x} ${y} `
  return (
    `<path d="${d}" ${line(1.8, C.white, 0.9)}/>` +
    `<path d="M212 214 L270 214 M212 226 L270 226" ${line(1.2, C.white, 0.75)}/>` +
    pf('M209 197 L272 197 L272 202 L209 202Z', C.brown) +
    pf('M220 180 L266 180 L266 197 L220 197Z', C.white) +
    pf('M206 187 L220 187 L220 197 L206 197Z', C.white) +
    `<path d="M226 182 L226 197 M236 182 L236 197 M250 182 L250 197 M260 182 L260 197" ${line(1.1, C.brown, 0.7)}/>` +
    `<path d="M238 186 L248 186 L248 197 L238 197Z M209 190 L216 190 L216 197 L209 197Z" fill="${C.ink}" opacity=".55"/>` +
    // 屋頂：主堂一面、愛染堂一面，都是薄的
    pf('M212 181 Q220 176 226 168 L258 168 Q264 176 274 180 L272 183 Q243 179.5 214 184Z', C.brown) +
    `<path d="M244 168 L258 168 Q264 176 274 180 L272 183 Q258 181 246 180.6Z" ${SH}/>` +
    pf('M202 189 Q206 185 210 182 L220 181 L221 186 Q212 186 203 191Z', C.brown)
  )
}
/** 落葉：小小的三角紙片（四種顏色各一條 path） */
function leaves(count: number, x0: number, x1: number, y0: number, y1: number, seed: number): string {
  const rn = rnd(seed)
  const ds = ['', '', '', '']
  for (let i = 0; i < count; i++) ds[i % 4] += `M${r1(x0 + rn() * (x1 - x0))} ${r1(y0 + rn() * (y1 - y0))} l${r1(2 + rn() * 2)} ${r1(-1 - rn() * 2)} l${r1(0.5 + rn())} ${r1(2.5 + rn())}z`
  return [C.red, C.orange, C.yellow, C.red].map((c, i) => `<path d="${ds[i]}" fill="${c}"/>`).join('')
}
/** 積雪的杉：杉的每一層上緣蓋一片雪 */
const snowCedar = (x: number, y: number, s: number) =>
  cedar(x, y, s, C.green) +
  `<path d="M${x} ${r1(y - 46 * s)} L${r1(x + 5 * s)} ${r1(y - 36 * s)} L${r1(x - 5 * s)} ${r1(y - 36 * s)}Z M${r1(x - 8 * s)} ${r1(y - 28 * s)} L${r1(x + 8 * s)} ${r1(y - 28 * s)} L${r1(x + 10 * s)} ${r1(y - 25 * s)} L${r1(x - 10 * s)} ${r1(y - 25 * s)}Z M${r1(x - 11 * s)} ${r1(y - 16 * s)} L${r1(x + 11 * s)} ${r1(y - 16 * s)} L${r1(x + 13.5 * s)} ${r1(y - 12.5 * s)} L${r1(x - 13.5 * s)} ${r1(y - 12.5 * s)}Z" fill="${C.white}"/>`

/** 冬天落了葉的山毛櫸：細的樹幹與幾根分枝 */
const bare = (pts: Pt[]) =>
  `<path d="${pts.map(([x, y]) => `M${x} ${y} L${x} ${y - 22} M${x} ${y - 10} L${x - 5} ${y - 17} M${x} ${y - 14} L${x + 5} ${y - 21} M${x} ${y - 18} L${x - 3} ${y - 24}`).join(' ')}" ${line(1.2, C.brown, 0.55)}/>`

const TOTTORI: Outfit[] = [
  // 鳥取砂丘（data/spots/tottori.json wd-Q780905，https://zh.wikipedia.org/wiki/%E9%B3%A5%E5%8F%96%E6%B2%99%E4%B8%98）：夏天的「馬の背」大沙丘與後面的日本海、稜線上的小小人影、駱駝、腳下的風紋
  bg({
    id: 'bg-tottori-sakyu',
    name: '鳥取砂丘',
    pref: 'tottori',
    rarity: 3,
    art:
      sky(C.blue, 0.32) +
      sun(254, 60, 13, C.yellow, 0.8) +
      cloud(62, 86, 1.5) +
      cloud(102, 78, 1.05) +
      cloud(216, 38, 0.8, 0.8) +
      cloud(262, 128, 0.6, 0.75) +
      // 日本海
      `<rect y="204" width="300" height="70" fill="${C.cream}"/><rect y="204" width="300" height="70" fill="${C.blue}" opacity=".72"/>` +
      `<rect y="204" width="300" height="4" fill="${C.navy}" opacity=".22"/>` +
      ripples([[30, 216], [76, 226], [18, 234], [118, 220], [160, 212], [60, 214]], 16, 0.5) +
      `<path d="M-4 247 Q40 240 84 244 T170 236" ${line(2.2, C.white, 0.85)}/>` +
      // 馬の背：迎光的一面亮、左邊的背光面淡橘
      paper('M-4 330 L-4 256 C40 252 90 246 130 230 C165 216 200 194 236 189 C262 186 286 190 304 196 L304 330Z', C.yellow, 0.46) +
      `<path d="M236 189 C214 200 190 232 172 262 C160 284 150 306 140 330 L-4 330 L-4 256 C40 252 90 246 130 230 C165 216 200 194 236 189Z" fill="${C.orange}" opacity=".16"/>` +
      `<path d="M236 189 C262 186 286 190 304 196" ${line(1.4, C.white, 0.8)}/>` +
      `<path d="${wavy(180, 300, 238, 20, 2)} ${wavy(168, 300, 260, 22, 2.4)} ${wavy(158, 300, 284, 24, 2.6)}" ${line(1.1, C.brown, 0.18)}/>` +
      walkers([[222, 191], [231, 190], [246, 188.6], [254, 188.6], [267, 189.6], [214, 205], [262, 216]], 1.3) +
      `<path d="M-4 300 C60 292 140 296 200 304 C240 308 280 304 304 300 L304 324 L-4 324Z" fill="${C.orange}" opacity=".14"/>` +
      camel(50, 306, 0.95) +
      camel(86, 301, 0.78) +
      // 腳下的沙丘與風紋
      paper('M-4 400 L-4 318 C60 308 120 312 160 318 C210 325 260 318 304 312 L304 400Z', C.yellow, 0.5) +
      `<path d="M-4 318 C60 308 120 312 160 318 C210 325 260 318 304 312" ${line(1.4, C.white, 0.7)}/>` +
      `<path d="${wavy(-6, 306, 334, 30, 2.4)} ${wavy(-20, 306, 348, 34, 3)} ${wavy(-6, 306, 364, 38, 3.6)} ${wavy(-24, 306, 382, 42, 4.2)}" ${line(1.3, C.brown, 0.24)}/>` +
      `<path d="${wavy(-6, 306, 332.2, 30, 2.4)} ${wavy(-20, 306, 345.8, 34, 3)} ${wavy(-6, 306, 361.4, 38, 3.6)} ${wavy(-24, 306, 379, 42, 4.2)}" ${line(1, C.white, 0.6)}/>` +
      `<path d="M18 352 L22 340 M22 352 L23 337 M26 352 L28 341 M276 360 L279 347 M280 360 L282 345 M284 360 L288 349" ${line(1.6, C.matcha)}/>`,
  }),
  // 投入堂（data/spots/tottori.json wd-Q19826408，https://zh.wikipedia.org/wiki/%E6%8A%95%E5%85%A5%E5%A0%82）：三德山北側的斷崖，岩壁凹處嵌著懸空的佛堂與細柱，秋天的紅葉
  bg({
    id: 'bg-tottori-nageiredo',
    name: '投入堂',
    pref: 'tottori',
    rarity: 2,
    art:
      sky(C.blue, 0.16) +
      cloud(58, 62, 1, 0.85) +
      cloud(150, 30, 0.7, 0.7) +
      ridge([[-10, 176], [36, 150], [84, 166], [130, 140], [176, 160]], C.navy, 0.13) +
      ridge([[-10, 214], [46, 192], [104, 206], [160, 186]], C.green, 0.32) +
      ridge([[-10, 246], [40, 232], [100, 240], [160, 226]], C.orange, 0.3) +
      // 斷崖：凹處上面的岩石像屋簷一樣往外突
      paper('M150 324 L160 290 C166 266 178 248 192 240 L200 238 C204 226 202 208 198 194 C194 182 188 170 180 160 C186 152 192 144 194 132 C198 100 210 50 220 -4 L304 -4 L304 324Z', C.grey, 0.82) +
      `<path d="M220 -4 C210 50 198 100 194 132 C192 144 186 152 180 160 C200 156 222 150 236 140 C232 96 240 40 252 -4Z" fill="${C.white}" opacity=".2"/>` +
      `<path d="M242 -4 C234 40 230 80 222 112 M270 -4 C262 50 260 96 254 128 M292 24 C288 64 286 100 284 134 M180 300 C186 280 192 266 202 256 M286 262 C282 280 280 300 282 320" ${line(1.4, C.ink, 0.16)}/>` +
      // 凹處（陰影）
      `<path d="M200 238 C204 226 202 208 198 194 C194 182 188 170 182 162 C206 158 246 154 286 158 L304 160 L304 254 C280 250 236 244 200 238Z" fill="${C.ink}" opacity=".3"/>` +
      `<path d="M182 162 C206 158 246 154 286 158 L304 160" ${line(1.6, C.white, 0.35)}/>` +
      at(24, 18, 0.9, nageiredo()) +
      // 岩壁下的紅葉
      tree(178, 320, 1.5, C.orange) +
      tree(214, 316, 1.6, C.red) +
      cedar(244, 314, 1.6, C.green) +
      tree(276, 320, 2, C.yellow) +
      // 左邊的楓與杉
      cedar(20, 322, 2.6, C.green) +
      tree(52, 324, 2.5, C.red) +
      tree(92, 320, 1.4, C.orange) +
      ground(C.brown, 320, 0.3) +
      `<path d="M0 334 L300 334" ${line(1.2, C.white, 0.35)}/>` +
      shape('M22 352 C24 342 40 340 46 348 C50 354 44 358 36 358 L24 358Z', C.grey) +
      shape('M256 344 C258 336 272 334 278 342 C282 348 276 352 268 352 L258 352Z', C.grey) +
      `<path d="M36 342 C40 342 44 345 46 348 L44 350Z M268 336 C272 336 276 339 278 342 L276 344Z" ${SH}/>` +
      leaves(22, 0, 300, 326, 396, 7) +
      leaves(6, 20, 180, 120, 300, 3),
  }),
  // 大山（data/spots/tottori.json wd-Q715498，https://zh.wikipedia.org/wiki/%E5%A4%A7%E5%B1%B1_%28%E9%B3%A5%E5%8F%96%E7%B8%A3%29）：冬天從西邊看的「伯耆富士」，積雪的山頂、山腳的林與覆雪的杉、飄雪
  bg({
    id: 'bg-tottori-daisen',
    name: '大山',
    pref: 'tottori',
    rarity: 1,
    art:
      sky(C.blue, 0.3) +
      cloud(64, 56, 1.1, 0.85) +
      cloud(150, 28, 0.8, 0.7) +
      cloud(40, 150, 0.6, 0.7) +
      paper('M-10 324 L-10 262 C60 240 140 190 196 132 C206 122 212 118 220 117 L234 118 C244 122 252 130 262 140 C276 154 292 166 310 172 L310 324Z', C.navy, 0.3) +
      // 山頂的雪：下緣是一道道雪溝
      `<path d="M150 174 C170 156 186 142 196 132 C206 122 212 118 220 117 L234 118 C244 122 252 130 262 140 C272 150 282 158 292 164 L284 170 L276 180 L268 176 L260 196 L252 182 L244 212 L236 188 L228 222 L220 194 L210 214 L202 190 L192 204 L182 184 L172 192 L162 180Z" fill="${C.white}" ${E}/>` +
      `<path d="M226 118 L244 212 M224 118 L228 222 M220 118 L210 214 M216 120 L192 204 M234 120 L260 196 M244 124 L276 180" ${line(1.2, C.navy, 0.16)}/>` +
      `<path d="M234 118 C244 122 252 130 262 140 C272 150 282 158 292 164 L284 170 L276 180 L268 176 L260 196 L252 182 L244 212 L236 188 L228 222 L228 118Z" fill="${C.navy}" opacity=".07"/>` +
      // 山腳的林
      ridge([[-10, 274], [30, 262], [80, 270], [130, 254], [180, 262], [230, 248], [270, 256], [310, 246]], C.navy, 0.22) +
      ridge([[-10, 292], [50, 280], [110, 288], [170, 276], [230, 286], [310, 274]], C.green, 0.34) +
      scatter(22, 0, 300, 256, 294, 1.4, C.white, 0.7, 11) +
      bare([[70, 296], [84, 292], [112, 294], [196, 290], [214, 294], [232, 292]]) +
      snowCedar(18, 324, 2.2) +
      snowCedar(48, 318, 1.6) +
      snowCedar(252, 318, 1.5) +
      snowCedar(282, 326, 2.4) +
      ground(C.white, 318) +
      `<path d="M-4 400 L-4 352 C40 344 90 346 130 356 C160 364 200 360 240 350 C270 344 290 346 304 350 L304 400Z" fill="${C.blue}" opacity=".08"/>` +
      `<path d="M0 334 Q80 326 150 334 T300 330 M0 352 C40 344 90 346 130 356 C160 364 200 360 240 350 C270 344 290 346 300 350 M0 380 Q80 372 150 380 T300 376" ${line(1.4, C.blue, 0.22)}/>` +
      `<path d="M30 340 L32 330 M36 340 L35 328 M268 346 L270 334 M274 346 L273 332" ${line(1.3, C.brown, 0.6)}/>` +
      scatter(34, 0, 300, 0, 320, 1.8, C.white, 0.9, 5),
  }),
]

// ---------- 島根 ----------
/** 松：彎的樹幹與分枝，四團上緣起伏、下緣平的松葉 */
const pine = (x: number, y: number, s: number, fill: string = C.green, trunk: string = C.brown) => {
  const q = Math.round
  const clump = (cx: number, cy: number, w: number, h: number) =>
    `M${cx - w} ${cy}C${cx - w} ${q(cy - h * 0.8)} ${q(cx - w * 0.6)} ${q(cy - h)} ${q(cx - w * 0.3)} ${q(cy - h * 0.8)}C${q(cx - w * 0.1)} ${q(cy - h * 1.2)} ${q(cx + w * 0.3)} ${q(cy - h * 1.2)} ${q(cx + w * 0.4)} ${q(cy - h * 0.8)}C${q(cx + w * 0.7)} ${q(cy - h)} ${cx + w} ${q(cy - h * 0.6)} ${cx + w} ${cy}Z`
  return at(
    x,
    y,
    s,
    pf('M-2 0 C-3 -10 4 -18 0 -30 L3 -31 C7 -18 1 -10 2 0Z', trunk) +
      `<path d="M1 -20 L-10 -22 M2 -15 L10 -17 M1 -27 L-4 -32" ${line(1.6, trunk)}/>` +
      pf(`${clump(1, -32, 13, 7)} ${clump(-11, -22, 9, 6)} ${clump(11, -17, 9, 5.5)} ${clump(-2, -42, 7, 4.5)}`, fill) +
      `<path d="M-12 -32 L14 -32 M-20 -22 L-2 -22 M2 -17 L20 -17" ${line(1, C.ink, 0.15)}/>`,
  )
}
/** 紙垂：白色的折紙 */
const shide = (x: number, y: number, s: number) => at(x, y, s, pf('M0 0 L5 0 L5 6 L8 6 L8 13 L5 13 L5 20 L8 20 L8 27 L3 27 L3 20 L0 20 L0 13 L3 13 L3 6 L0 6Z', C.white))
/** 神楽殿的大注連縄：中間粗、兩端細，下面垂著三束〆の子 */
function shimenawa(): string {
  const c = (x: number) => 128 + 10 * (1 - ((x - 150) / 116) ** 2)
  const h = (x: number) => 6 + 18 * (1 - ((x - 150) / 116) ** 2)
  let top = ''
  let bot = ''
  for (let x = 36; x <= 264; x += 19) {
    top += `${top ? ' L' : 'M'}${x} ${r1(c(x) - h(x))}`
    bot = ` L${x} ${r1(c(x) + h(x))}` + bot
  }
  let tw = ''
  for (let x = 42; x < 260; x += 10) {
    const k = h(x) * 0.55
    tw += `M${r1(x - k)} ${r1(c(x - k) - h(x - k) + 1)} Q${r1(x + k * 0.6)} ${r1(c(x) - h(x) * 0.5)} ${r1(x + k)} ${r1(c(x + k) + h(x + k) - 1)} `
  }
  const tuft = (x: number, y: number, s: number) =>
    at(x, y, s, pp('M-9 0 L9 0 C8 14 5 30 4 42 L-4 42 C-5 30 -8 14 -9 0Z', C.yellow, 0.55) + `<path d="M-9 4 L9 4" ${line(2.4, C.brown, 0.6)}/><path d="M-3 36 L-3 42 M0 34 L0 42 M3 36 L3 42 M-5 12 C-3 22 -2 30 -2 36 M4 12 C3 22 2 30 2 36" ${line(1, C.brown, 0.35)}/>`)
  return (
    tuft(150, c(150) + h(150) - 4, 1.25) +
    tuft(76, c(76) + h(76) - 4, 1) +
    tuft(224, c(224) + h(224) - 4, 1) +
    shide(108, c(108) + h(108) - 2, 0.9) +
    shide(184, c(184) + h(184) - 2, 0.9) +
    shide(48, c(48) + h(48) - 2, 0.75) +
    shide(246, c(246) + h(246) - 2, 0.75) +
    paper(`${top}${bot}Z`, C.yellow, 0.55) +
    `<path d="${tw}" ${line(1.3, C.brown, 0.38)}/>` +
    `<path d="M50 ${r1(c(50) - h(50) + 3)} Q150 ${r1(c(150) - h(150) - 2)} 250 ${r1(c(250) - h(250) + 3)}" ${line(1.6, C.white, 0.55)}/>`
  )
}
/** 一排直條紋（格子、垂木頭）：用虛線畫，x0–x1、y0–y1，每 gap 一條，條寬 w */
const stripes = (x0: number, x1: number, y0: number, y1: number, gap: number, w: number, color: string, op: number) =>
  `<path d="M${x0} ${r1((y0 + y1) / 2)} L${x1} ${r1((y0 + y1) / 2)}" fill="none" stroke="${color}" stroke-width="${r1(y1 - y0)}" stroke-dasharray="${w} ${r1(gap - w)}" stroke-opacity="${op}"/>`
type House = [x: number, w: number, h: number, plaster: boolean]
/** 大森的町家（正面）一整排：紅褐色的石州瓦、二樓白牆或木板與蟲籠窗、一樓的格子；地面 g */
function street(hs: House[], g: number): string {
  let tile = ''
  let ridge = ''
  let tl = ''
  let plaster = ''
  let wood = ''
  let win = ''
  let low = ''
  let bars = ''
  let sh = ''
  for (const [x, w, h, p] of hs) {
    const t = g - h
    const m = t + 16 + Math.round(h * 0.28)
    tile += `M${x - 5} ${t + 16} L${x + 4} ${t} L${x + w - 4} ${t} L${x + w + 5} ${t + 16}Z M${x - 6} ${m + 10} L${x} ${m} L${x + w} ${m} L${x + w + 6} ${m + 10}Z `
    ridge += `M${x + 2} ${t} L${x + w - 2} ${t} `
    tl += `M${x - 1} ${t + 6} L${x + w + 1} ${t + 6} M${x - 3} ${t + 11} L${x + w + 3} ${t + 11} M${x - 3} ${m + 5} L${x + w + 3} ${m + 5} `
    if (p) plaster += `M${x} ${t + 16}H${x + w}V${m}H${x}Z `
    else wood += `M${x} ${t + 16}H${x + w}V${m}H${x}Z `
    win += `M${x + w / 2 - 9} ${t + 21}h18V${m - 4}h-18Z `
    low += `M${x} ${m + 10}H${x + w}V${g}H${x}Z `
    bars += `M${x + w / 2 - 5} ${t + 21}V${m - 4} M${x + w / 2} ${t + 21}V${m - 4} M${x + w / 2 + 5} ${t + 21}V${m - 4} `
    sh += `M${x + w - 6} ${m + 10}H${x + w}V${g}H${x + w - 6}Z `
  }
  return (
    `<path d="${wood}" fill="${C.brown}" opacity=".6" ${E}/>` +
    `<path d="${plaster}" fill="${C.cream}" ${E}/>` +
    `<path d="${win}" fill="${C.ink}" opacity=".32"/>` +
    `<path d="${bars}" ${line(1.6, C.cream, 0.8)}/>` +
    paper(low, C.brown, 0.5) +
    hs.map(([x, w, h]) => stripes(x + 4, x + w - 4, g - h + 26 + Math.round(h * 0.28), g - 2, 4, 1.2, C.cream, 0.55)).join('') +
    `<path d="${sh}" ${SH}/>` +
    paper(tile, C.red, 0.55, C.brown) +
    `<path d="${tl}" ${line(1, C.ink, 0.18)}/>` +
    `<path d="${ridge}" ${line(3.4, C.brown)}/>`
  )
}
/** 蜆漁的小船：船身、船上的人與長竿 */
const shijimiBoat = (x: number, y: number, s: number, fill: string) =>
  at(x, y, s, `<g fill="${fill}"><path d="M-22 -6 L24 -6 L18 0 L-18 0Z"/><path d="M4 -6 L4 -13 L14 -13 L14 -6Z"/><path d="M-8 -6 L-8 -16 L-4 -16 L-4 -6Z"/><circle cx="-6" cy="-18.5" r="2.6"/></g><path d="M-6 -14 L-26 6" ${line(1.4, fill)}/>`)

const SHIMANE: Outfit[] = [
  // 出雲大社（data/spots/shimane.json wd-Q696362，https://zh.wikipedia.org/wiki/%E5%87%BA%E9%9B%B2%E5%A4%A7%E7%A4%BE）：神楽殿正面垂掛的大注連縄、〆の子與紙垂，屋頂後面的松林
  bg({
    id: 'bg-shimane-izumotaisha',
    name: '出雲大社',
    pref: 'shimane',
    rarity: 3,
    art:
      sky(C.blue, 0.24) +
      cloud(150, 22, 0.8, 0.7) +
      ridge([[-10, 74], [60, 44], [140, 56], [220, 36], [310, 62]], C.green, 0.4, 110) +
      pine(44, 92, 1.7) +
      pine(258, 88, 1.8) +
      // 屋頂
      shape('M-6 106 C40 100 70 74 84 50 L216 50 C230 74 260 100 306 106 L306 112 L-6 112Z', C.brown) +
      `<path d="M150 50 L216 50 C230 74 260 100 306 106 L306 112 L150 112Z" ${SH}/>` +
      `<path d="M84 50 L216 50" ${line(4, C.ink, 0.7)}/>` +
      `<path d="M-6 106 C40 100 70 74 84 50 M216 50 C230 74 260 100 306 106" ${line(1.4, C.white, 0.4)}/>` +
      // 正面：梁、柱、格子門
      paper('M14 112 L286 112 L286 300 L14 300Z', C.brown, 0.18) +
      stripes(44, 258, 178, 290, 10, 1, C.brown, 0.3) +
      shape('M14 168 L286 168 L286 176 L14 176Z', C.brown, 'opacity=".7"') +
      shape('M-6 112 L306 112 L306 122 L-6 122Z', C.brown) +
      stripes(2, 300, 112, 116, 10, 3, C.cream, 0.7) +
      shape('M30 122 L42 122 L42 300 L30 300Z M258 122 L270 122 L270 300 L258 300Z', C.brown) +
      `<path d="M38 122 L42 122 L42 300 L38 300Z M266 122 L270 122 L270 300 L266 300Z" ${SH}/>` +
      shimenawa() +
      // 縁與石階
      shape('M0 290 L300 290 L300 300 L0 300Z', C.brown) +
      shape('M-4 300 L304 300 L304 322 L-4 322Z', C.grey, 'opacity=".75"') +
      `<path d="M0 311 L300 311" ${line(1.2, C.white, 0.4)}/>` +
      ground(C.grey, 320, 0.3) +
      `<path d="M110 322 L80 400 M190 322 L220 400 M98 352 L202 352 M88 380 L212 380" ${line(1.3, C.white, 0.55)}/>`,
  }),
  // 宍道湖（data/spots/shimane.json wd-Q1151248，https://zh.wikipedia.org/wiki/%E5%AE%8D%E9%81%93%E6%B9%96）：湖上的夕陽與金色的倒影、松樹與小鳥居的嫁ヶ島剪影、捕蜆的小船
  bg({
    id: 'bg-shimane-shinjiko',
    name: '宍道湖',
    pref: 'shimane',
    rarity: 2,
    art:
      sky(C.orange, 0.42, C.cream) +
      `<rect width="300" height="150" fill="${C.pink}" opacity=".22"/><rect width="300" height="80" fill="${C.purple}" opacity=".16"/>` +
      `<path d="M150 166 C170 160 230 158 270 164 C250 170 190 172 150 166Z M30 138 C60 132 110 132 140 138 C110 144 60 144 30 138Z M196 118 C220 114 262 114 290 120 C262 124 220 124 196 118Z" fill="${C.yellow}" opacity=".55"/>` +
      `<path d="M210 52 C240 46 280 48 300 54 C280 60 236 60 210 52Z M20 70 C46 64 90 66 108 72 C84 78 44 76 20 70Z" fill="${C.pink}" opacity=".5"/>` +
      sun(230, 212, 19, C.yellow, 0.95) +
      `<path d="M60 96 l5 3 l5 -3 M76 88 l4 2.5 l4 -2.5 M242 92 l4 2.5 l4 -2.5" ${line(1.3, C.ink, 0.45)}/>` +
      // 對岸的山
      ridge([[-10, 230], [40, 222], [100, 228], [160, 218], [220, 226], [260, 222], [310, 228]], C.purple, 0.4, 238) +
      // 湖面
      paper('M-4 236 L304 236 L304 330 L-4 330Z', C.orange, 0.34) +
      `<path d="M-4 236 L304 236" ${line(1.4, C.white, 0.5)}/>` +
      `<path d="M206 242 L254 242 M212 250 L248 250 M200 260 L262 260 M216 270 L244 270 M196 282 L266 282 M210 296 L250 296 M190 312 L270 312" ${line(3, C.yellow, 0.85)}/>` +
      `<path d="M14 250 L60 250 M120 246 L170 246 M30 292 L90 292 M110 304 L160 304 M20 318 L80 318" ${line(1.6, C.purple, 0.25)}/>` +
      ripples([[230, 246], [226, 266], [234, 288], [228, 306]], 10, 0.7) +
      // 嫁ヶ島
      `<g opacity=".78">` +
      `<path d="M30 266 Q34 258 52 257 L100 257 Q112 258 116 266Z" fill="${C.navy}"/>` +
      `<path d="M58 258 C57 248 60 240 58 232 M70 258 C71 246 67 236 69 224 M84 258 C83 248 87 240 85 230 M98 258 C99 250 96 244 98 238" ${line(1.8, C.navy)}/>` +
      `<path d="M48 240 C46 232 54 228 58 230 C58 222 66 216 70 220 C72 212 80 212 82 218 C88 216 94 222 92 228 C100 228 106 236 102 242 C96 246 90 240 86 244 C80 240 74 236 70 238 C64 236 60 244 54 244Z" fill="${C.navy}"/>` +
      `<path d="M37 249 L49 249 M38 252 L48 252 M40 249 L40 262 M46 249 L46 262" ${line(1.4, C.navy)}/></g>` +
      `<path d="M32 270 L114 270 M44 276 L100 276" ${line(1.4, C.navy, 0.2)}/>` +
      shijimiBoat(262, 294, 0.9, C.navy) +
      shijimiBoat(56, 300, 0.6, C.navy) +
      // 湖岸
      shape('M-4 324 L304 324 L304 334 L-4 334Z', C.grey, 'opacity=".8"') +
      ground(C.brown, 334, 0.32) +
      `<path d="M0 329 L300 329" ${line(1, C.white, 0.4)}/>` +
      `<path d="M14 334 L10 306 M20 334 L22 300 M26 334 L30 310 M276 334 L272 304 M282 334 L284 298 M288 334 L292 308" ${line(1.6, C.brown, 0.7)}/>` +
      `<path d="M0 360 L300 360 M0 386 L300 386" ${line(1.2, C.white, 0.35)}/>`,
  }),
  // 石見銀山（data/spots/shimane.json wd-Q174139，https://zh.wikipedia.org/wiki/%E7%9F%B3%E8%A6%8B%E9%8A%80%E5%B1%B1%E9%81%BA%E8%B7%A1%E5%8F%8A%E5%85%B6%E6%96%87%E5%8C%96%E6%99%AF%E8%A7%80）：大森町的町家，紅褐色的石州瓦、格子與蟲籠窗，後面是綠色的銀山山林
  bg({
    id: 'bg-shimane-iwamiginzan',
    name: '石見銀山',
    pref: 'shimane',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(70, 60, 1.1, 0.85) +
      cloud(232, 36, 0.8, 0.8) +
      ridge([[-10, 150], [40, 126], [100, 140], [160, 112], [230, 132], [310, 118]], C.green, 0.3, 300) +
      ridge([[-10, 200], [30, 178], [80, 188], [130, 170], [190, 186], [250, 166], [310, 180]], C.green, 0.55, 300) +
      cedar(30, 196, 1.1, C.green, 0.7) +
      cedar(262, 184, 1.2, C.green, 0.7) +
      tree(220, 208, 1.1, C.matcha) +
      tree(72, 214, 1.2, C.matcha) +
      // 後一排的屋頂
      `<path d="M-4 236 L10 226 L44 226 L56 236Z M120 232 L132 222 L170 222 L182 232Z M236 234 L248 224 L290 224 L304 234Z" fill="${C.red}" opacity=".45" ${E}/>` +
      street([[-12, 60, 104, true], [50, 54, 94, false], [106, 46, 98, true], [154, 48, 90, false], [204, 50, 100, true], [256, 58, 110, false]], 322) +
      // 町家前的水路與路
      shape('M-4 322 L304 322 L304 330 L-4 330Z', C.grey, 'opacity=".8"') +
      `<path d="M-4 326 L304 326" ${line(2.2, C.blue, 0.45)}/>` +
      ground(C.brown, 330, 0.26) +
      `<path d="M0 352 L300 352" ${line(1.2, C.white, 0.4)}/>` +
      shape('M30 332 C30 326 42 324 44 330 C46 336 40 340 34 338Z', C.grey) +
      tree(284, 334, 0.7, C.matcha),
  }),
]

// ---------- 岡山 ----------
/** 天守：x 中心、y 石垣下緣、s 大小；wall 牆、trim 屋簷的鑲邊（岡山城是金色） */
function tenshu(x: number, y: number, s: number, wall: string, trim: string): string {
  const roof = (w: number, w2: number, yy: number, h: number) => `M${-w} ${yy - 2} Q0 ${yy + 2} ${w} ${yy - 2} L${w2} ${yy - h} L${-w2} ${yy - h}Z `
  const body = (w: number, y0: number, y1: number) => `M${-w} ${y0}H${w}V${y1}H${-w}Z `
  const bodies = body(28, -22, -46) + body(21, -52, -72) + body(15, -78, -94) + body(11, -100, -114)
  const roofs = roof(38, 30, -44, 8) + roof(29, 22, -70, 8) + roof(23, 16, -92, 8) + roof(19, 12, -112, 10) + 'M-14 -50 L0 -64 L14 -50Z M-6 -122 L0 -128 L6 -122Z'
  return at(
    x,
    y,
    s,
    pf('M-34 0 L34 0 L28 -22 L-28 -22Z', C.grey) +
      `<path d="M-32 -7 L32 -7 M-30 -14 L30 -14" ${line(1, C.white, 0.4)}/>` +
      pf(bodies, wall) +
      `<path d="M18 -22H28V-46H18Z M14 -52H21V-72H14Z M10 -78H15V-94H10Z M7 -100H11V-114H7Z" ${SH}/>` +
      `<path d="M-20 -32h6v6h-6Z M-4 -32h6v6h-6Z M12 -32h6v6h-6Z M-12 -62h5v5h-5Z M4 -62h5v5h-5Z M-6 -86h4v4h-4Z M2 -86h4v4h-4Z" fill="${C.white}" opacity=".55"/>` +
      pf(roofs, C.ink) +
      `<path d="M-38 -46 Q0 -42 38 -46 M-29 -72 Q0 -68 29 -72 M-23 -94 Q0 -90 23 -94 M-19 -114 Q0 -110 19 -114 M-14 -50 L0 -64 L14 -50" ${line(1.4, trim, 0.9)}/>` +
      `<path d="M-13 -122 C-15 -126 -12 -129 -10 -127 M13 -122 C15 -126 12 -129 10 -127" ${line(2.2, C.gold)}/>`,
  )
}
/** 丹頂鶴（朝左）：x、y 腳下 */
const crane = (x: number, y: number, s: number) =>
  at(
    x,
    y,
    s,
    `<path d="M-2 0 L-1 -16 M3 0 L2 -16" ${line(1.2, C.ink)}/>` +
      pf('M-10 -18 C-10 -26 4 -28 12 -22 C14 -20 12 -16 6 -15 C0 -14 -8 -14 -10 -18Z', C.white) +
      pf('M6 -22 C12 -24 16 -20 16 -14 C12 -16 8 -16 4 -16Z', C.ink) +
      pf('M-8 -22 C-12 -30 -12 -38 -9 -44 L-6 -44 C-8 -38 -8 -30 -4 -24Z', C.ink) +
      `<circle cx="-8" cy="-46" r="2.6" fill="${C.white}"/><circle cx="-7.6" cy="-47.6" r="1.3" fill="${C.red}"/><path d="M-10 -46.6 L-16 -45 L-10 -45Z" fill="${C.brown}"/>`,
  )
/** 柳：微彎的樹幹，樹冠下緣一縷縷垂下來，枝條長短不一 */
function willow(x: number, y: number, s: number, lean = 1): string {
  const rn = rnd(Math.round(x * 7 + y))
  const o = lean * 4
  let d = ''
  for (let i = -5; i <= 5; i++) {
    const x0 = i * 6 + o
    d += `M${x0} -50 Q${x0 + 3 * lean} -36 ${x0 + lean} ${Math.round(-38 + rn() * 26 - Math.abs(i))} `
  }
  return at(
    x,
    y,
    s,
    pf(`M-3 0 C-2 -20 ${-3 + lean * 2} -40 ${lean * 5} -58 L${lean * 5 + 4} -58 C${1 + lean * 2} -40 3 -20 4 0Z`, C.brown) +
      pf(`M${o - 32} -46 C${o - 30} -64 ${o - 10} -74 ${o + 4} -72 C${o + 22} -70 ${o + 34} -62 ${o + 34} -48 L${o + 30} -40 L${o + 26} -48 L${o + 20} -36 L${o + 14} -48 L${o + 8} -38 L${o + 2} -48 L${o - 4} -36 L${o - 10} -48 L${o - 16} -40 L${o - 22} -48 L${o - 27} -38Z`, C.green) +
      `<path d="M${o - 20} -62 C${o - 8} -68 ${o + 10} -68 ${o + 22} -62" ${line(1.2, C.matcha, 0.8)}/>` +
      `<path d="${d}" ${line(2.6, C.green)}/>`,
  )
}
/** 倉敷川的川舟：木船、戴斗笠撐篙的船夫、坐著的客人 */
const kawabune = (x: number, y: number, s: number) =>
  at(
    x,
    y,
    s,
    pf('M-30 -8 L32 -8 L26 0 L-26 0Z', C.brown) +
      `<path d="M-30 -8 L32 -8" ${line(1.4, C.cream, 0.7)}/>` +
      `<path d="M-14 -8 L-14 -14 M-4 -8 L-4 -14" ${line(5, C.navy, 0.8)}/><circle cx="-14" cy="-17" r="3" fill="${C.ink}" opacity=".8"/><circle cx="-4" cy="-17" r="3" fill="${C.ink}" opacity=".8"/>` +
      pf('M19 -8 L19 -24 L25 -24 L25 -8Z', C.navy) +
      `<path d="M15 -27 L22 -32 L29 -27Z" fill="${C.yellow}" ${E}/>` +
      `<path d="M24 -22 L10 8" ${line(1.4, C.brown)}/>`,
  )
/** 海鼠壁：黑底、斜格子的白線（線剪在 x0–x1、y0–y1 裡面） */
function namako(x0: number, y0: number, x1: number, y1: number, g = 13): string {
  const hgt = y1 - y0
  let d = ''
  for (let k = x0 - hgt; k < x1; k += g) {
    // 往右上
    let ax = k
    let ay = y1
    let bx = k + hgt
    let by = y0
    if (ax < x0) [ax, ay] = [x0, y1 - (x0 - ax)]
    if (bx > x1) [bx, by] = [x1, y0 + (bx - x1)]
    if (ax < bx) d += `M${Math.round(ax)} ${Math.round(ay)}L${Math.round(bx)} ${Math.round(by)}`
    // 往左上
    let cx = k + hgt
    let cy = y1
    let ex = k
    let ey = y0
    if (cx > x1) [cx, cy] = [x1, y1 - (cx - x1)]
    if (ex < x0) [ex, ey] = [x0, y0 + (x0 - ex)]
    if (ex < cx) d += `M${Math.round(cx)} ${Math.round(cy)}L${Math.round(ex)} ${Math.round(ey)}`
  }
  return `<path d="M${x0} ${y0}H${x1}V${y1}H${x0}Z" fill="${C.ink}" opacity=".72"/><path d="${d}" ${line(1.3, C.white, 0.85)}/>`
}
/** 倉敷的土藏：x 左緣、w 寬、wallTop 白牆上緣、g 地面；gable 是山牆朝外（妻入） */
function kura(x: number, w: number, top: number, g: number, gable: boolean): string {
  const mid = Math.round(g - (g - top) * 0.32)
  const roof = gable
    ? shape(`M${x - 5} ${top + 2} L${x + w / 2} ${top - w * 0.42} L${x + w + 5} ${top + 2} L${x + w + 1} ${top + 4} L${x + w / 2} ${top - w * 0.42 + 5} L${x - 1} ${top + 4}Z`, C.ink)
    : shape(`M${x - 6} ${top + 2} L${x + 4} ${top - 14} L${x + w - 4} ${top - 14} L${x + w + 6} ${top + 2}Z`, C.ink)
  const wall = gable ? `M${x} ${top + 3} L${x + w / 2} ${top - w * 0.42 + 6} L${x + w} ${top + 3} L${x + w} ${g} L${x} ${g}Z` : `M${x} ${top + 2}H${x + w}V${g}H${x}Z`
  return (
    shape(wall, C.cream) +
    namako(x, mid, x + w, g) +
    roof +
    `<path d="M${x + w / 2 - 6} ${top + 10}h12v12h-12Z" fill="${C.ink}" opacity=".7"/><path d="M${x + w / 2 - 8} ${top + 8}h4v16h-4Z M${x + w / 2 + 4} ${top + 8}h4v16h-4Z" fill="${C.cream}" ${E}/>` +
    `<path d="M${x + w - 5} ${top + 3}H${x + w}V${g}H${x + w - 5}Z" ${SH}/>`
  )
}
/** 遠處的島：一塊平頂的剪影 */
const isle = (x: number, y: number, w: number, h: number, fill: string, op: number) => `<path d="M${x - w} ${y} C${x - w * 0.6} ${y - h} ${x + w * 0.4} ${y - h * 1.1} ${x + w} ${y}Z" fill="${fill}" opacity="${op}"/>`
/** 瀨戶大橋（下津井瀨戶大橋）：吊橋的主塔與主纜，從右前方往左後方延伸；towers 是 [x, 塔頂 y, 橋面 y, 塔寬] */
function setoBridge(towers: Array<[number, number, number, number]>, fill: string): string {
  let out = ''
  let cable = ''
  let hang = ''
  for (let i = 0; i < towers.length; i++) {
    const [x, top, deck, w] = towers[i]
    out += `<path d="M${x - w} ${deck + w * 3} L${x - w} ${top} L${x - w * 0.4} ${top} L${x - w * 0.4} ${deck + w * 3}Z M${x + w * 0.4} ${deck + w * 3} L${x + w * 0.4} ${top} L${x + w} ${top} L${x + w} ${deck + w * 3}Z M${x - w} ${top + w} H${x + w} V${top + w * 1.8} H${x - w}Z M${x - w} ${r1((top + deck) / 2)} H${x + w} V${r1((top + deck) / 2 + w * 0.8)} H${x - w}Z" fill="${fill}"/>`
    if (i > 0) {
      const [px, ptop, pdeck] = towers[i - 1]
      const mx = (x + px) / 2
      const my = Math.max(deck, pdeck) - 4
      cable += `M${px} ${ptop + 1} Q${mx} ${r1(my + (my - Math.min(top, ptop)) * 0.6)} ${x} ${top + 1} `
      for (let t = 0.1; t < 0.95; t += 0.1) {
        const hx = px + (x - px) * t
        const cy = (1 - t) ** 2 * (ptop + 1) + 2 * (1 - t) * t * (my + (my - Math.min(top, ptop)) * 0.6) + t * t * (top + 1)
        const dy = pdeck + (deck - pdeck) * t
        if (cy < dy - 2) hang += `M${r1(hx)} ${r1(cy)} L${r1(hx)} ${r1(dy)} `
      }
    }
  }
  const [fx, , fdeck, fw] = towers[0]
  const [lx, , ldeck, lw] = towers[towers.length - 1]
  const deck = `M${fx + 70} ${fdeck + 7} L${lx - 40} ${ldeck - 2} L${lx - 40} ${ldeck + lw * 1.2} L${fx + 70} ${fdeck + 7 + fw * 2.4}Z`
  return `<path d="${hang}" ${line(0.8, fill, 0.6)}/><path d="${cable}" ${line(1.6, fill)}/>` + out + `<path d="${deck}" fill="${fill}" opacity=".85"/><path d="M${fx + 70} ${fdeck + 7.6} L${lx - 40} ${ldeck - 1.4}" ${line(0.8, C.yellow, 0.7)}/>`
}

const OKAYAMA: Outfit[] = [
  // 後楽園（data/spots/okayama.json wd-Q1377689，https://zh.wikipedia.org/wiki/%E5%BE%8C%E6%A8%82%E5%9C%92）：秋天的草坪、沢の池、唯心山與松，借景的黑色岡山城（金色的鯱與屋簷），草坪上的丹頂鶴
  bg({
    id: 'bg-okayama-korakuen',
    name: '後樂園',
    pref: 'okayama',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(66, 70, 1.3) +
      cloud(272, 116, 0.6, 0.8) +
      tenshu(234, 266, 1.02, C.ink, C.gold) +
      // 園外的林
      ridge([[-10, 262], [30, 250], [70, 258], [120, 244], [170, 256], [200, 252], [240, 262], [280, 250], [310, 258]], C.green, 0.85, 300) +
      tree(194, 276, 1.6, C.orange) +
      tree(284, 280, 1.7, C.red) +
      // 唯心山
      paper('M-10 300 C10 286 30 250 60 244 C86 240 110 268 130 300Z', C.matcha, 0.8) +
      `<path d="M10 290 C40 284 70 276 96 270 M30 270 C50 262 70 256 84 252" ${line(1.4, C.white, 0.45)}/>` +
      tree(40, 290, 1.1, C.red) +
      tree(84, 288, 0.8, C.orange) +
      pine(118, 302, 1.6) +
      // 沢の池
      paper('M-4 296 C60 290 240 290 304 296 L304 318 L-4 318Z', C.blue, 0.42) +
      ripples([[40, 304], [90, 310], [150, 302], [220, 308], [270, 302]], 18, 0.6) +
      ground(C.matcha, 316, 0.75) +
      `<path d="M0 316 C80 312 220 312 300 316" ${line(1.4, C.white, 0.5)}/>` +
      `<path d="M160 400 C170 370 196 344 240 330 L262 330 C222 346 196 372 190 400Z" fill="${C.cream}" opacity=".7" ${E}/>` +
      pine(26, 346, 2.4) +
      crane(248, 330, 1) +
      crane(276, 336, 0.9) +
      `<path d="M0 352 C60 346 110 348 150 354 M0 380 C50 374 100 376 140 382" ${line(1.2, C.green, 0.3)}/>`,
  }),
  // 倉敷美観地区（data/spots/okayama.json wd-Q11386772，https://zh.wikipedia.org/wiki/%E5%80%89%E6%95%B7%E7%BE%8E%E8%A7%80%E5%9C%B0%E5%8D%80）：倉敷川兩岸的柳，白牆與海鼠壁的土藏，石砌的河岸與載客的川舟
  bg({
    id: 'bg-okayama-kurashiki',
    name: '倉敷美觀地區',
    pref: 'okayama',
    rarity: 2,
    art:
      sky(C.blue, 0.22) +
      cloud(64, 64, 1.2) +
      cloud(226, 40, 0.9, 0.8) +
      cloud(252, 130, 0.55, 0.75) +
      kura(-4, 72, 200, 284, false) +
      kura(68, 62, 212, 284, true) +
      kura(130, 76, 202, 284, false) +
      kura(206, 60, 210, 284, true) +
      kura(266, 40, 198, 284, false) +
      willow(30, 286, 1.7, 1) +
      willow(272, 288, 1.6, -1) +
      // 石垣與川
      shape('M-4 282 L304 282 L304 292 L-4 292Z', C.grey) +
      `<path d="M-4 287 L304 287" ${line(1, C.white, 0.4)}/>` +
      paper('M-4 292 L304 292 L304 322 L-4 322Z', C.blue, 0.5) +
      ripples([[30, 300], [100, 306], [160, 298], [214, 314], [70, 316]], 16, 0.6) +
      `<path d="M14 296 L40 296 M262 296 L290 296" ${line(3, C.green, 0.35)}/>` +
      kawabune(240, 312, 0.95) +
      shape('M-4 320 L304 320 L304 328 L-4 328Z', C.grey) +
      ground(C.grey, 328, 0.38) +
      `<path d="M0 352 L300 352 M0 380 L300 380 M60 328 L50 400 M150 328 L150 400 M240 328 L250 400" ${line(1.2, C.white, 0.45)}/>`,
  }),
  // 瀬戸大橋（data/spots/okayama.json wd-Q976648，https://zh.wikipedia.org/wiki/%E7%80%A8%E6%88%B6%E5%A4%A7%E6%A9%8B）：從鷲羽山看夕陽下的瀨戶內海，吊橋的主塔與主纜一路往四國延伸，海上的小島
  bg({
    id: 'bg-okayama-setoohashi',
    name: '瀨戶大橋',
    pref: 'okayama',
    rarity: 1,
    art:
      sky(C.orange, 0.44, C.cream) +
      `<rect width="300" height="140" fill="${C.pink}" opacity=".24"/><rect width="300" height="70" fill="${C.purple}" opacity=".16"/>` +
      `<path d="M14 168 C40 162 90 162 120 168 C90 174 40 174 14 168Z M200 132 C226 126 270 128 296 134 C270 140 226 138 200 132Z" fill="${C.yellow}" opacity=".5"/>` +
      sun(72, 222, 16, C.yellow, 0.95) +
      paper('M-4 228 L304 228 L304 324 L-4 324Z', C.orange, 0.3) +
      `<path d="M50 236 L94 236 M56 246 L88 246 M44 258 L100 258 M60 270 L84 270 M40 284 L104 284" ${line(3, C.yellow, 0.8)}/>` +
      isle(150, 230, 40, 10, C.purple, 0.4) +
      isle(260, 230, 50, 12, C.purple, 0.4) +
      isle(10, 232, 30, 8, C.purple, 0.45) +
      isle(200, 252, 34, 16, C.navy, 0.45) +
      isle(118, 258, 26, 12, C.navy, 0.45) +
      setoBridge([[236, 140, 262, 4.5], [124, 196, 247, 2.6], [56, 216, 238, 1.6], [20, 224, 234, 1.1]], C.navy) +
      ripples([[150, 290], [200, 300], [250, 286], [30, 300], [120, 310]], 16, 0.4) +
      // 鷲羽山的岩與松
      paper('M-4 400 L-4 312 C20 300 50 304 70 314 C100 322 200 322 230 312 C252 304 282 300 304 308 L304 400Z', C.brown, 0.42) +
      `<path d="M-4 312 C20 300 50 304 70 314 M230 312 C252 304 282 300 304 308" ${line(1.4, C.white, 0.35)}/>` +
      shape('M6 330 C10 314 34 310 44 322 C50 330 44 338 30 338 L8 338Z', C.grey, 'opacity=".8"') +
      shape('M250 326 C254 310 280 306 292 318 C298 326 290 334 276 334 L252 334Z', C.grey, 'opacity=".8"') +
      `<path d="M60 340 L90 352 L84 376 M200 346 L232 338 L250 360 M120 370 L160 384 L170 400 M20 372 L40 392" ${line(1.4, C.ink, 0.16)}/>` +
      `<path d="M60 342 L88 353 M200 348 L231 340" ${line(1.2, C.white, 0.35)}/>` +
      `<path d="M100 336 L102 326 M104 336 L106 324 M108 336 L108 328 M180 360 L182 350 M184 360 L187 348 M240 384 L242 374 M244 384 L247 372" ${line(1.4, C.green, 0.6)}/>` +
      pine(26, 312, 2, C.navy, C.navy) +
      pine(276, 308, 2.3, C.navy, C.navy) +
      `<rect y="300" width="300" height="100" fill="${C.purple}" opacity=".12"/>`,
  }),
]

// ---------- 広島 ----------
/** 嚴島神社的大鳥居（兩部鳥居）：兩根主柱，前後各有一根稚兒柱，黑色的笠木 */
function otorii(): string {
  const chigo = [56, 102, 198, 244]
  let red = 'M71 300 L73 134 L85 134 L87 300Z M213 300 L215 134 L227 134 L229 300Z M46 168 L254 168 L254 177 L46 177Z M141 133 L159 133 L159 168 L141 168Z M44 124 C80 130 220 130 256 124 L254 134 C220 139 80 139 46 134Z '
  let caps = ''
  for (const x of chigo) {
    red += `M${x - 4} 300 L${x - 3} 226 L${x + 3} 226 L${x + 4} 300Z `
    caps += `M${x - 6} 221 L${x + 6} 221 L${x + 5} 227 L${x - 5} 227Z `
  }
  red += 'M56 240 L102 240 L102 245 L56 245Z M56 268 L102 268 L102 273 L56 273Z M198 240 L244 240 L244 245 L198 245Z M198 268 L244 268 L244 273 L198 273Z'
  return (
    `<path d="M71 300 L69 330 M87 300 L89 330 M213 300 L211 330 M229 300 L231 330" ${line(10, C.red, 0.18)}/>` +
    shape(red, C.red) +
    `<path d="M80 136 L85 136 L87 300 L81 300Z M222 136 L227 136 L229 300 L223 300Z M46 174 L254 174 L254 177 L46 177Z" ${SH}/>` +
    shape(caps + 'M30 102 C70 116 230 116 270 102 L267 113 C226 126 74 126 33 113Z', C.ink) +
    `<path d="M144 140 L156 140 L156 162 L144 162Z" fill="${C.ink}"/><path d="M144 140 L156 140 L156 162 L144 162Z" ${line(1.2, C.gold)}/>` +
    `<path d="M34 106 C74 118 226 118 266 106" ${line(1.2, C.white, 0.35)}/>` +
    `<path d="M40 300 Q60 296 80 300 T120 300 M182 300 Q202 296 222 300 T262 300" ${line(1.6, C.white, 0.8)}/>`
  )
}
/** 鹿（朝左）：x、y 腳下 */
const deer = (x: number, y: number, s: number) =>
  at(
    x,
    y,
    s,
    `<path d="M-8 0 L-8.5 -13 M-4 0 L-4.5 -13 M7 0 L7.5 -13 M11 0 L11 -13" ${line(2, C.brown)}/>` +
      pf('M-12 -13 C-14 -20 -8 -24 0 -24 C8 -24 14 -22 15 -16 C15 -12 12 -11 8 -11 L-8 -11 C-11 -11 -12 -12 -12 -13Z M-9 -20 C-13 -24 -14 -27 -14 -30 L-20 -31 C-22 -32 -21 -34 -19 -35 L-12 -36 C-9 -34 -7 -29 -4 -23Z M-13 -34 L-10 -40 L-8 -35Z', C.brown) +
      pf('M14 -21 C17 -21 17 -16 15 -15Z', C.white) +
      `<path d="M2 -24 C8 -24 14 -22 15 -16 C15 -12 12 -11 8 -11 L4 -11Z" ${SH}/><circle cx="-16.5" cy="-33.5" r=".8" fill="${C.ink}"/>` +
      `<g fill="${C.white}" opacity=".7"><circle cx="-3" cy="-20" r="1"/><circle cx="2" cy="-21" r="1"/><circle cx="7" cy="-20" r="1"/><circle cx="0" cy="-17" r="1"/><circle cx="5" cy="-16.5" r="1"/></g>`,
  )
/** 石燈籠：x、y 腳下 */
const lantern = (x: number, y: number, s: number) =>
  at(
    x,
    y,
    s,
    pf('M-8 0 L8 0 L6 -4 L-6 -4Z M-2.5 -4 L2.5 -4 L2.5 -22 L-2.5 -22Z M-7 -22 L7 -22 L7 -26 L-7 -26Z M-5 -26 L5 -26 L5 -36 L-5 -36Z M-11 -36 L11 -36 L4 -43 L-4 -43Z M-1.5 -43 L1.5 -43 L1.5 -47 L-1.5 -47Z', C.grey) +
      `<path d="M-2.5 -33 L2.5 -33 L2.5 -28 L-2.5 -28Z" fill="${C.ink}" opacity=".6"/><path d="M3 -36 L11 -36 L4 -43 L1 -43Z M1 -22 L2.5 -22 L2.5 -4 L1 -4Z" ${SH}/>`,
  )
/** 一片片的樹冠（紅葉、櫻花）：同一個顏色的圓疊成一組 */
const blobs = (fill: string, pts: Array<[number, number, number]>, op = 1) =>
  `<g fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''} ${E}>${pts.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}"/>`).join('')}</g>`
/** 一團起伏的樹冠（櫻花、紅葉）：五個圓疊成一團，給 blobs 用 */
const crown = (x: number, y: number, r: number): Array<[number, number, number]> => [
  [x, y, r],
  [Math.round(x - r * 0.75), Math.round(y + r * 0.3), r1(r * 0.7)],
  [Math.round(x + r * 0.75), Math.round(y + r * 0.25), r1(r * 0.72)],
  [Math.round(x - r * 0.35), Math.round(y - r * 0.55), r1(r * 0.62)],
  [Math.round(x + r * 0.4), Math.round(y - r * 0.5), r1(r * 0.6)],
]
/** 坡上的町家：一排排白牆小屋與瓦頂；rows 是 [y, 屋高, seed] */
function slopeTown(rows: Array<[number, number, number]>): string {
  const q = Math.round
  let walls = ''
  let tops = ''
  for (const [y, h, seed] of rows) {
    const rn = rnd(seed)
    let x = q(-6 - rn() * 10)
    while (x < 306) {
      const w = q(h * (1.6 + rn() * 1.1))
      const yy = y + q((rn() - 0.5) * h * 0.6)
      const k = q(h * 0.5)
      walls += `M${x} ${yy}h${w}v${h}h${-w}Z`
      tops += `M${x - 2} ${yy + 1}l${k} ${-k}h${w - 2 * k + 4}l${k} ${k}Z`
      x += w + q(rn() * h * 0.5)
    }
  }
  return `<path d="${walls}" fill="${C.cream}" ${E}/><path d="${tops}" fill="${C.grey}" ${E}/>`
}
/** 千光寺本堂（赤堂）：大岩上的懸造朱色佛堂，旁邊是頂著玉の岩的岩柱 */
const senkoji = () =>
  shape('M18 300 C14 270 20 250 30 244 L28 206 C26 198 30 194 36 196 C44 196 48 200 46 210 L46 240 C60 236 70 248 84 246 C100 244 112 256 114 300Z', C.grey) +
  `<path d="M46 210 L46 240 C60 236 70 248 84 246 C100 244 112 256 114 300 L80 300 C84 280 70 262 50 256Z" ${SH}/>` +
  `<circle cx="37" cy="186" r="13" fill="${C.grey}" ${E}/><path d="M44 178 C50 184 50 192 44 198" ${line(1.4, C.white, 0.45)}/>` +
  `<path d="M54 234 L54 258 M64 234 L64 254 M74 234 L74 250 M84 234 L84 248 M94 234 L94 250 M52 244 L98 244" ${line(2, C.brown)}/>` +
  shape('M52 214 L96 214 L96 234 L52 234Z', C.red) +
  `<path d="M60 218 L60 232 M68 218 L68 232 M80 218 L80 232 M88 218 L88 232" ${line(1, C.cream, 0.7)}/>` +
  shape('M48 232 L100 232 L100 236 L48 236Z', C.red) +
  shape('M42 216 C50 212 56 206 60 198 L88 198 C92 206 98 212 106 216 C88 214 60 214 42 216Z M68 198 L74 190 L80 198Z', C.ink) +
  `<path d="M90 214 L96 214 L96 234 L90 234Z" ${SH}/>`
/** 黑淵的渡船：小木船與撐篙的船夫 */
const ferry = (x: number, y: number, s: number) =>
  at(x, y, s, pf('M-22 -6 L22 -6 L17 0 L-17 0Z', C.brown) + pf('M8 -6 L8 -20 L13 -20 L13 -6Z', C.navy) + pf('M5 -22 L10.5 -27 L16 -22Z', C.yellow) + `<path d="M12 -18 L24 6" ${line(1.3, C.brown)}/>`)

const HIROSHIMA: Outfit[] = [
  // 厳島神社（data/spots/hiroshima.json wd-Q191763，https://zh.wikipedia.org/wiki/%E4%B8%A5%E5%B2%9B%E7%A5%9E%E7%A4%BE）：滿潮時立在海中的朱色大鳥居（兩部鳥居、黑色笠木），對岸的山，御笠濱的石燈籠與鹿
  bg({
    id: 'bg-hiroshima-itsukushima',
    name: '嚴島神社',
    pref: 'hiroshima',
    rarity: 3,
    art:
      sky(C.blue, 0.28) +
      cloud(150, 50, 1.4) +
      cloud(60, 84, 0.8, 0.8) +
      cloud(250, 76, 0.9, 0.85) +
      ridge([[-10, 252], [40, 236], [90, 244], [150, 230], [210, 240], [260, 228], [310, 240]], C.blue, 0.3, 262) +
      paper('M-4 256 L304 256 L304 326 L-4 326Z', C.blue, 0.48) +
      `<path d="M-4 256 L304 256" ${line(1.4, C.white, 0.6)}/>` +
      ripples([[20, 270], [130, 266], [170, 276], [290, 270], [30, 312], [150, 318], [270, 314], [120, 296], [180, 292]], 16, 0.55) +
      otorii() +
      // 御笠濱
      paper('M-4 400 L-4 322 C60 318 240 318 304 322 L304 400Z', C.yellow, 0.26) +
      `<path d="M-4 322 C60 318 240 318 304 322" ${line(1.6, C.white, 0.8)}/>` +
      `<path d="M0 346 C60 342 110 344 150 348 M150 372 C200 368 250 368 300 372" ${line(1.2, C.brown, 0.18)}/>` +
      cloud(272, 120, 0.5, 0.8) +
      `<path d="M266 268 L286 268 L282 272 L270 272Z M272 268 L272 262 L280 262 L280 268Z" fill="${C.white}" ${E}/>` +
      `<path d="M60 150 l4 2.5 l4 -2.5 M74 142 l3.5 2 l3.5 -2" ${line(1.2, C.ink, 0.45)}/>` +
      lantern(46, 352, 1.5) +
      deer(244, 352, 1.5),
  }),
  // 千光寺（data/spots/hiroshima.json wd-Q3478566，https://zh.wikipedia.org/wiki/%E5%8D%83%E5%85%89%E5%AF%BA_%28%E5%B0%BE%E9%81%93%E5%B8%82%29）：春天從千光寺公園往下看，大岩上的朱色本堂與玉の岩，坡上的屋頂、尾道水道與對岸向島的造船廠吊臂，櫻花
  bg({
    id: 'bg-hiroshima-senkoji',
    name: '千光寺',
    pref: 'hiroshima',
    rarity: 2,
    art:
      sky(C.blue, 0.24) +
      cloud(220, 56, 1.1) +
      cloud(80, 34, 0.8, 0.8) +
      ridge([[-10, 214], [50, 196], [110, 206], [170, 190], [240, 202], [310, 192]], C.green, 0.36, 232) +
      `<path d="M226 216 L226 186 L262 186 M226 190 L254 190 M258 186 L258 206 M268 216 L268 192 L292 192 L292 204" ${line(1.6, C.red, 0.55)}/>` +
      paper('M-4 222 L304 222 L304 250 L-4 250Z', C.blue, 0.45) +
      ripples([[60, 230], [140, 234], [230, 230], [280, 238]], 16, 0.6) +
      `<path d="M176 232 L198 232 L194 236 L180 236Z" fill="${C.white}" ${E}/>` +
      slopeTown([[240, 7, 3], [254, 8, 8], [270, 10, 5], [288, 12, 2]]) +
      blobs(C.green, [...crown(126, 254, 7), ...crown(176, 268, 8), ...crown(236, 258, 7), ...crown(282, 284, 8), ...crown(150, 290, 8)], 0.85) +
      senkoji() +
      // 櫻
      `<path d="M14 330 C16 300 12 270 22 240 M22 268 L4 250 M24 290 L44 268 M282 330 C280 300 286 272 278 244 M280 270 L298 254 M280 292 L262 272" ${line(5, C.brown)}/>` +
      blobs(C.pink, [...crown(20, 236, 18), ...crown(2, 260, 14), ...crown(46, 266, 13), ...crown(278, 236, 18), ...crown(298, 258, 14), ...crown(256, 270, 12)], 0.95) +
      blobs(C.white, [[12, 226, 5], [30, 222, 4], [270, 226, 5], [288, 222, 4], [40, 258, 4], [262, 262, 4]], 0.5) +
      shape('M-4 320 L304 320 L304 328 L-4 328Z', C.grey) +
      ground(C.grey, 328, 0.3) +
      `<path d="M0 350 L300 350 M0 376 L300 376" ${line(1.2, C.white, 0.45)}/>` +
      scatter(16, 0, 300, 120, 396, 1.6, C.pink, 0.9, 13),
  }),
  // 三段峡（data/spots/hiroshima.json wd-Q3137717，https://zh.wikipedia.org/wiki/%E4%B8%89%E6%AE%B5%E5%B3%BD）：秋天的黑淵，兩側陡峭的岩壁與紅葉，碧綠的深潭與渡船
  bg({
    id: 'bg-hiroshima-sandankyo',
    name: '三段峽',
    pref: 'hiroshima',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(150, 40, 1, 0.85) +
      ridge([[60, 140], [110, 120], [150, 150], [190, 118], [240, 140]], C.green, 0.3, 300) +
      paper('M100 300 L112 200 C126 180 140 176 150 186 C160 176 176 180 188 200 L200 300Z', C.grey, 0.45) +
      `<path d="M146 236 L146 296 M152 240 L152 296" ${line(3, C.white, 0.85)}/>` +
      // 左右的岩壁
      paper('M-4 330 L-4 -4 L44 -4 C52 40 66 70 72 100 C82 140 84 170 92 210 C98 250 104 280 108 330Z', C.grey, 0.8) +
      paper('M304 330 L304 -4 L256 -4 C248 40 236 76 230 104 C222 140 218 176 210 214 C206 250 198 280 194 330Z', C.grey, 0.8) +
      `<path d="M20 -4 C28 60 40 120 50 180 C56 220 64 270 70 330 M56 60 C64 110 70 160 80 220 M280 -4 C272 60 262 120 254 180 C250 220 242 270 236 330 M246 60 C240 110 232 160 224 220" ${line(1.4, C.ink, 0.16)}/>` +
      `<path d="M44 -4 C52 40 66 70 72 100 C82 140 84 170 92 210 C98 250 104 280 108 330 L84 330 C82 270 72 210 62 150 C54 100 44 50 30 -4Z" fill="${C.white}" opacity=".18"/>` +
      `<path d="M256 -4 C248 40 236 76 230 104 C222 140 218 176 210 214 C206 250 198 280 194 330 L220 330 C226 270 236 210 244 150 C250 100 262 50 276 -4Z" ${SH}/>` +
      `<path d="M40 30 L52 22 M58 84 L68 76 M72 140 L80 132 M84 194 L90 186 M244 30 L250 22 M240 88 L236 80 M228 144 L224 136 M216 198 L214 190 M10 70 L4 62 M12 210 L8 202 M290 80 L296 72 M288 230 L292 222" ${line(2.4, C.brown)}/>` +
      blobs(C.red, [...crown(52, 18, 16), ...crown(88, 184, 12), ...crown(236, 78, 13), ...crown(204, 244, 11), ...crown(8, 200, 18), ...crown(296, 70, 18)]) +
      blobs(C.orange, [...crown(68, 76, 13), ...crown(98, 240, 11), ...crown(250, 20, 16), ...crown(224, 134, 14)]) +
      blobs(C.yellow, [...crown(80, 132, 14), ...crown(214, 188, 12), ...crown(6, 60, 18), ...crown(292, 220, 18)]) +
      blobs(C.white, [[46, 8, 4], [230, 70, 3], [244, 10, 4], [74, 122, 3], [290, 60, 4], [2, 50, 4]], 0.3) +
      // 深潭
      paper('M-4 290 L304 290 L304 330 L-4 330Z', C.green, 0.5) +
      `<rect y="290" width="300" height="40" fill="${C.blue}" opacity=".22"/>` +
      ripples([[40, 300], [110, 306], [190, 302], [250, 312], [70, 320], [220, 322]], 16, 0.6) +
      ferry(240, 312, 1.1) +
      // 岸邊的石頭
      paper('M-4 400 L-4 328 C40 322 80 330 120 326 C170 322 220 330 260 324 C280 322 296 324 304 326 L304 400Z', C.grey, 0.4) +
      shape('M10 346 C14 334 36 332 42 342 C46 350 38 354 26 354 L12 354Z M250 352 C254 340 280 338 288 348 C292 356 282 360 268 360 L252 360Z', C.grey) +
      `<path d="M30 336 C36 336 40 339 42 342 L40 345Z M272 342 C280 342 286 345 288 348 L286 351Z" ${SH}/>` +
      leaves(16, 0, 300, 334, 396, 17),
  }),
]

// ---------- 山口 ----------
/** 二次貝茲曲線上的一點 */
const qpt = (a: Pt, c: Pt, b: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]
/** 錦帶橋：石砌的橋墩上架木造的拱（一層層的桁、包鐵的箍），拱上的欄杆；piers 是橋墩中心的 x */
function kintaikyo(piers: number[]): string {
  let body = ''
  let layers = ''
  let bands = ''
  let posts = ''
  let rail = ''
  let stone = ''
  let lines = ''
  let sh = ''
  for (const pc of piers) {
    stone += `M${pc - 11} 256 L${pc + 11} 256 L${pc + 15} 304 L${pc - 15} 304Z `
    lines += `M${pc - 12} 268 L${pc + 12} 268 M${pc - 13} 280 L${pc + 13} 280 M${pc - 14} 292 L${pc + 14} 292 `
    sh += `M${pc + 4} 256 L${pc + 11} 256 L${pc + 15} 304 L${pc + 6} 304Z `
  }
  for (let i = 0; i < piers.length - 1; i++) {
    const l = piers[i] + 8
    const r = piers[i + 1] - 8
    const cx = (l + r) / 2
    body += `M${l - 4} 256 Q${cx} 144 ${r + 4} 256 L${r} 276 Q${cx} 156 ${l} 276Z `
    rail += `M${l - 4} 248 Q${cx} 136 ${r + 4} 248 `
    for (const f of [0.3, 0.55, 0.8]) layers += `M${r1(l - 4 + 4 * f)} ${256 + 20 * f} Q${cx} ${r1(144 + 12 * f)} ${r1(r + 4 - 4 * f)} ${256 + 20 * f} `
    for (let t = 0.05; t < 1; t += 0.075) {
      const [x0, y0] = qpt([l - 4, 256], [cx, 144], [r + 4, 256], t)
      const [, y1] = qpt([l - 4, 248], [cx, 136], [r + 4, 248], t)
      posts += `M${r1(x0)} ${r1(y0)}V${r1(y1)}`
    }
    for (const t of [0.12, 0.3, 0.7, 0.88]) {
      const [x0, y0] = qpt([l - 4, 256], [cx, 144], [r + 4, 256], t)
      const [x1, y1] = qpt([l, 276], [cx, 156], [r, 276], t)
      bands += `M${r1(x0)} ${r1(y0 + 1)}L${r1(x1)} ${r1(y1 - 1)}`
    }
  }
  return (
    `<path d="${posts}" ${line(1, C.brown, 0.8)}/><path d="${rail}" ${line(1.8, C.brown)}/>` +
    paper(body, C.brown, 0.5) +
    `<path d="${layers}" ${line(1, C.brown, 0.55)}/><path d="${bands}" ${line(2.2, C.ink, 0.45)}/>` +
    shape(stone, C.grey) +
    `<path d="${lines}" ${line(1, C.white, 0.5)}/><path d="${sh}" ${SH}/>`
  )
}
/** 元乃隅神社的一排紅鳥居：pts 是 [x, 柱腳 y, 大小, 正面的程度 0–1]（沿著坡走的方向橫過來時只看到側面，窄） */
function toriiRow(pts: Array<[number, number, number, number]>): string {
  const q = r1
  let red = ''
  let black = ''
  for (const [x, y, sc, f] of pts) {
    const w = 11 * sc * (0.3 + 0.7 * f)
    const h = 44 * sc
    const p = 2.6 * sc
    red += `M${q(x - w)} ${q(y)}h${q(p)}V${q(y - h)}h${q(-p)}Z M${q(x + w - p)} ${q(y)}h${q(p)}V${q(y - h)}h${q(-p)}Z M${q(x - w - 2 * sc)} ${q(y - h * 0.78)}h${q(2 * w + 4 * sc)}v${q(2.4 * sc)}h${q(-2 * w - 4 * sc)}Z M${q(x - w - 3 * sc)} ${q(y - h)}h${q(2 * w + 6 * sc)}v${q(3 * sc)}h${q(-2 * w - 6 * sc)}Z `
    black += `M${q(x - w - 5 * sc)} ${q(y - h)}L${q(x - w - 4 * sc)} ${q(y - h - 3.4 * sc)}H${q(x + w + 4 * sc)}L${q(x + w + 5 * sc)} ${q(y - h)}Z `
  }
  return `<path d="${black}" fill="${C.ink}"/><path d="${red}" fill="${C.red}" ${E}/>`
}
/** 沿著折線（由近到遠）每隔一段放一個鳥居：越遠越小、越密；回傳由遠到近的順序 */
function along(path: Pt[], gap: number, yNear: number, yFar: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = []
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1]
    const [x1, y1] = path[i]
    const len = Math.hypot(x1 - x0, y1 - y0)
    const f = Math.abs(y1 - y0) / len
    for (let d = 0; d < len; ) {
      const x = x0 + ((x1 - x0) * d) / len
      const y = y0 + ((y1 - y0) * d) / len
      const sc = 0.28 + (0.77 * (y - yFar)) / (yNear - yFar)
      out.push([r1(x), r1(y), r1(sc), r1(f)])
      d += gap * (0.25 + sc)
    }
  }
  return out.sort((a, b) => a[1] - b[1])
}
/** 瑠璃光寺五重塔：素木的塔身、厚的檜皮葺屋頂（上面積雪），x 中心、y 台基 */
function rurikoji(x: number, y: number): string {
  let bodies = ''
  let roofs = ''
  let snow = ''
  let sh = ''
  let bottom = y - 4
  for (let i = 0; i < 5; i++) {
    const bw = 26 - i * 1.5
    const rw = 38 - i * 2.2
    const top = bottom - (i === 0 ? 28 : 18)
    bodies += `M${r1(x - bw / 2)} ${bottom}V${top}H${r1(x + bw / 2)}V${bottom}Z `
    sh += `M${r1(x + bw / 2 - 5)} ${bottom}V${top}H${r1(x + bw / 2)}V${bottom}Z `
    roofs += `M${r1(x - rw)} ${top + 2} Q${x} ${top - 3} ${r1(x + rw)} ${top + 2} L${r1(x + rw - 4)} ${top + 8} Q${x} ${top + 4} ${r1(x - rw + 4)} ${top + 8}Z `
    snow += `M${r1(x - rw + 2)} ${top + 1} Q${x} ${top - 13} ${r1(x + rw - 2)} ${top + 1} Q${x} ${top - 4} ${r1(x - rw + 2)} ${top + 1}Z `
    bottom = top - 4
  }
  return (
    shape(`M${x - 24} ${y + 2} L${x + 24} ${y + 2} L${x + 22} ${y - 4} L${x - 22} ${y - 4}Z`, C.grey) +
    shape(bodies, C.brown, 'opacity=".8"') +
    `<path d="${bodies}" fill="none" stroke="${C.cream}" stroke-width="7" stroke-dasharray="1 5" stroke-opacity=".35"/>` +
    `<path d="${sh}" ${SH}/>` +
    shape(roofs, C.brown) +
    `<path d="${roofs}" fill="${C.ink}" opacity=".25"/>` +
    shape(snow, C.white) +
    `<path d="M${x} ${bottom + 3} L${x} ${bottom - 36}" ${line(2.2, C.ink, 0.7)}/>` +
    `<path d="${Array.from({ length: 9 }, (_, i) => `M${x - 3.5} ${bottom - 5 - i * 3}h7`).join('')}" ${line(1.3, C.ink, 0.7)}/>`
  )
}

const YAMAGUCHI: Outfit[] = [
  // 錦帯橋（data/spots/yamaguchi.json wd-Q1196460，https://zh.wikipedia.org/wiki/%E9%8C%A6%E5%B8%B6%E6%A9%8B）：春天的錦川，石砌橋墩上的木造拱橋，城山山頂的岩國城，河岸的櫻
  bg({
    id: 'bg-yamaguchi-kintaikyo',
    name: '錦帶橋',
    pref: 'yamaguchi',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(60, 64, 1.2) +
      cloud(178, 36, 0.8, 0.8) +
      ridge([[-10, 230], [40, 206], [100, 222], [150, 210]], C.green, 0.3, 290) +
      paper('M110 300 C140 250 180 190 222 162 C240 150 258 148 272 156 C288 166 298 176 310 186 L310 300Z', C.green, 0.6) +
      blobs(C.green, [...crown(204, 200, 11), ...crown(274, 184, 10), ...crown(170, 238, 10)], 0.6) +
      tenshu(254, 158, 0.42, C.white, C.ink) +
      blobs(C.pink, [...crown(20, 262, 14), ...crown(58, 272, 11), ...crown(140, 270, 12), ...crown(236, 266, 13), ...crown(286, 268, 14)], 0.9) +
      paper('M-4 284 L304 284 L304 330 L-4 330Z', C.blue, 0.45) +
      `<rect y="284" width="300" height="46" fill="${C.green}" opacity=".12"/>` +
      kintaikyo([-15, 95, 205, 315]) +
      ripples([[40, 312], [150, 310], [260, 312], [20, 322], [96, 318], [206, 318], [280, 324]], 18, 0.6) +
      // 河原
      paper('M-4 400 L-4 328 C80 324 220 324 304 328 L304 400Z', C.grey, 0.28) +
      `<path d="M-4 328 C80 324 220 324 304 328" ${line(1.4, C.white, 0.6)}/>` +
      scatter(18, 0, 300, 336, 398, 2.4, C.grey, 0.6, 23) +
      scatter(10, 0, 300, 336, 398, 1.6, C.white, 0.7, 29) +
      tree(18, 360, 2.6, C.pink) +
      tree(288, 356, 2.3, C.pink) +
      blobs(C.white, [[12, 278, 4], [26, 272, 3], [284, 284, 4], [296, 278, 3]], 0.5) +
      scatter(12, 0, 300, 140, 380, 1.6, C.pink, 0.9, 31),
  }),
  // 元乃隅神社（data/spots/yamaguchi.json wd-Q22120637，https://zh.wikipedia.org/wiki/%E5%85%83%E4%B9%83%E9%9A%85%E7%A5%9E%E7%A4%BE）：夏天面向日本海的斷崖上，一排紅鳥居沿著綠坡一路延伸到海邊，岩岸的「龍宮の潮吹」
  bg({
    id: 'bg-yamaguchi-motonosumi',
    name: '元乃隅神社',
    pref: 'yamaguchi',
    rarity: 2,
    art:
      sky(C.blue, 0.3) +
      cloud(70, 70, 1.3) +
      cloud(228, 46, 1, 0.85) +
      cloud(262, 126, 0.55, 0.8) +
      // 日本海
      paper('M-4 156 L304 156 L304 300 L-4 300Z', C.blue, 0.74) +
      `<rect y="156" width="300" height="4" fill="${C.navy}" opacity=".25"/>` +
      ripples([[40, 172], [110, 184], [200, 170], [260, 190], [70, 206], [170, 214], [240, 226]], 18, 0.5) +
      // 岸邊的岩、浪與「龍宮の潮吹」
      shape('M140 258 C160 246 190 242 210 248 C232 238 260 236 282 242 C292 240 300 240 304 242 L304 290 L140 290Z', C.grey) +
      `<path d="M210 248 C232 238 260 236 282 242 C292 240 300 240 304 242 L304 252 C280 250 240 252 210 256Z" ${SH}/>` +
      `<path d="M140 258 C160 246 190 242 210 248 C232 238 260 236 282 242" ${line(3, C.white, 0.85)}/>` +
      `<path d="M268 246 C266 232 262 220 256 210 M271 246 C271 228 271 214 273 200 M274 246 C278 232 284 222 290 214" ${line(5, C.white, 0.9)}/>` +
      `<g fill="${C.white}" opacity=".9"><circle cx="254" cy="204" r="2.4"/><circle cx="273" cy="194" r="2.2"/><circle cx="292" cy="208" r="2.2"/><circle cx="262" cy="196" r="1.6"/><circle cx="284" cy="200" r="1.6"/><circle cx="248" cy="214" r="1.4"/></g>` +
      // 綠坡
      paper('M-4 400 L-4 218 C40 222 90 236 140 252 C190 266 240 270 304 268 L304 400Z', C.matcha, 0.8) +
      `<path d="M-4 218 C40 222 90 236 140 252 C190 266 240 270 304 268" ${line(1.6, C.white, 0.6)}/>` +
      `<path d="M0 340 C40 336 70 340 100 346 M200 360 C240 354 270 356 300 360 M220 300 C250 296 270 298 296 302" ${line(1.2, C.green, 0.35)}/>` +
      toriiRow(along([[34, 394], [96, 334], [46, 304], [116, 286], [200, 278], [246, 270]], 9.5, 394, 270)),
  }),
  // 瑠璃光寺（data/spots/yamaguchi.json wd-Q11573988，https://zh.wikipedia.org/wiki/%E7%91%A0%E7%92%83%E5%85%89%E5%AF%BA）：冬天的五重塔，素木塔身與檜皮葺的屋頂積著雪，塔前的池、雪松與石燈籠
  bg({
    id: 'bg-yamaguchi-rurikoji',
    name: '瑠璃光寺五重塔',
    pref: 'yamaguchi',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      `<rect width="300" height="400" fill="${C.grey}" opacity=".12"/>` +
      cloud(70, 60, 1.1, 0.8) +
      ridge([[-10, 236], [40, 214], [100, 226], [160, 206], [220, 222], [310, 204]], C.green, 0.3, 300) +
      scatter(26, 0, 300, 206, 290, 2, C.white, 0.75, 41) +
      rurikoji(234, 298) +
      snowCedar(178, 300, 1.4) +
      snowCedar(290, 304, 1.6) +
      pine(52, 304, 2.2) +
      `<path d="M30 266 l16 -4 M50 278 l18 -3 M18 280 l12 -2" ${line(3, C.white)}/>` +
      // 池
      paper('M-4 302 L304 302 L304 326 L-4 326Z', C.blue, 0.32) +
      `<path d="M206 306 h56 M212 312 h44 M220 318 h28 M230 323 h8" ${line(3, C.brown, 0.28)}/>` +
      ripples([[60, 312], [140, 316], [236, 314], [280, 310]], 18, 0.7) +
      ground(C.white, 324) +
      `<path d="M0 340 Q80 334 150 340 T300 338 M0 368 Q100 360 180 368 T300 366" ${line(1.4, C.blue, 0.2)}/>` +
      lantern(108, 340, 1.4) +
      `<path d="M92.6 290.2 L123.4 290.2 L113.6 280.4 L102.4 280.4Z" fill="${C.white}"/>` +
      scatter(40, 0, 300, 0, 320, 1.8, C.white, 0.9, 43),
  }),
]

export const BG: Outfit[] = [...TOTTORI, ...SHIMANE, ...OKAYAMA, ...HIROSHIMA, ...YAMAGUCHI]
