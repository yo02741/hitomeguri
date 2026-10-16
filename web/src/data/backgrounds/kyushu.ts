import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, ripples, shape, sky, sun, tree } from './kit'

/**
 * 地區背景：福岡、佐賀、長崎、熊本。題材取自 data/spots 的景點（祭典取自 data/festivals），
 * 出處是那筆資料的 summary.source_url（每張上面一行註解）。
 */

// ---------- 共用的小零件（只在這個檔案用） ----------
type Pt = [number, number]
const f = (v: number) => +v.toFixed(1)
/** 矩形的路徑 */
const box = (x: number, y: number, w: number, h: number) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`
/** 不帶紙邊的平塗（小東西、光、陰影） */
const flat = (d: string, fill: string, op = 1) => `<path d="${d}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`
/** 帶紙邊的矩形 */
const rect = (x: number, y: number, w: number, h: number, fill: string, op = 1) => shape(box(x, y, w, h), fill, op < 1 ? `opacity="${op}"` : '')
/** 同一種筆觸的線（多段併成一條 path） */
const lines = (d: string, w: number, color: string, op = 1) => `<path d="${d}" ${line(w, color, op)}/>`
/** 一粒粒的小圓點（花、燈、星）：零長度的線加圓頭 */
const pips = (pts: Pt[], fill: string, size: number, op = 1) => lines(pts.map(([x, y]) => `M${f(x)} ${f(y)}h0`).join(''), size, fill, op)
/** 偽亂數（同一個 seed 每次畫出來都一樣） */
function rng(seed: number): () => number {
  let k = seed
  return () => (k = (k * 9301 + 49297) % 233280) / 233280
}
/** 夜空：米色底疊一層藏青 */
const night = (op = 0.72) => sky(C.navy, op, C.cream)
/** 和式屋頂：上緣是屋脊（寬 rw），兩側內凹、簷角翹起（寬 ew）；op < 1 時半透明（例：黑瓦疊在淡色上變深灰） */
function roof(x: number, ry: number, ey: number, rw: number, ew: number, fill: string, th = 4, op = 1): string {
  const h = ey - ry
  const d = (ew - rw) / 2
  const R = x + rw / 2
  const ER = x + ew / 2
  const right = `C${f(R + d * 0.2)} ${f(ry + h * 0.75)} ${f(ER - d * 0.35)} ${f(ey)} ${f(ER)} ${f(ey - 3)} L${f(ER - 3)} ${f(ey + th)}`
  const all = `M${f(x - rw / 2)} ${f(ry)} L${f(R)} ${f(ry)} ${right} L${f(x - ew / 2 + 3)} ${f(ey + th)} L${f(x - ew / 2)} ${f(ey - 3)} C${f(x - ew / 2 + d * 0.35)} ${f(ey)} ${f(x - rw / 2 - d * 0.2)} ${f(ry + h * 0.75)} ${f(x - rw / 2)} ${f(ry)}Z`
  return shape(all, fill, op < 1 ? `opacity="${op}"` : '') + flat(`M${f(x)} ${f(ry)} L${f(R)} ${f(ry)} ${right} L${f(x)} ${f(ey + th)}Z`, C.ink, 0.14)
}
/** 二次曲線上的點 */
const qpt = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number): Pt => [
  (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
  (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1,
]

// ---------- 福岡 ----------
/** 梅樹：折來折去的枝＋一粒粒的花（x 樹根、y 地面、s 大小） */
function plum(x: number, y: number, s: number, colors: string[], seed: number): string {
  const P = (dx: number, dy: number): Pt => [x + dx * s, y + dy * s]
  const br: Pt[][] = [
    [[0, -46], [14, -66], [30, -74], [44, -94], [52, -100]],
    [[0, -46], [-6, -74], [4, -98], [-2, -122]],
    [[14, -66], [22, -92], [34, -112]],
    [[30, -74], [36, -102]],
    [[4, -98], [16, -124]],
    [[-2, -28], [-18, -42], [-26, -62], [-22, -80]],
    [[-18, -42], [-34, -50]],
  ]
  const path = (b: Pt[]) => `M${b.map(([dx, dy]) => P(dx, dy).map(f).join(' ')).join(' L')}`
  let out = shape(`M${f(x - 5 * s)} ${y} L${f(x - 3 * s)} ${f(y - 22 * s)} L${f(x - 6 * s)} ${f(y - 40 * s)} L${f(x - 1 * s)} ${f(y - 50 * s)} L${f(x + 3 * s)} ${f(y - 30 * s)} L${f(x + 5 * s)} ${y}Z`, C.brown)
  out += lines(br.slice(0, 2).map(path).join(''), 3 * s, C.brown) + lines(br.slice(2).map(path).join(''), 1.8 * s, C.brown)
  const r = rng(seed)
  const pts: Pt[][] = colors.map(() => [])
  for (const b of br)
    for (let i = 1; i < b.length; i++)
      for (let k = 0; k < 4; k++) {
        const t = r()
        const [px, py] = P(b[i - 1][0] + (b[i][0] - b[i - 1][0]) * t, b[i - 1][1] + (b[i][1] - b[i - 1][1]) * t)
        pts[Math.floor(r() * colors.length)].push([px + (r() - 0.5) * 9 * s, py + (r() - 0.5) * 8 * s])
      }
  return out + colors.map((c, i) => pips(pts[i], c, 5 * s)).join('')
}
/** 太鼓橋：朱色的拱橋（x0–x1 橋腳、y 橋腳的地面、top 橋面最高處） */
function taikobashi(x0: number, x1: number, y: number, top: number): string {
  const mx = (x0 + x1) / 2
  const cy = 2 * top - y
  const cy2 = 2 * (top + 6) - y
  const rail = 2 * (top - 12) - (y - 11)
  let legs = ''
  let legSh = ''
  for (const t of [0.28, 0.42, 0.58, 0.72]) {
    const [px, py] = qpt(x0 + 6, y, mx, cy2, x1 - 6, y, t)
    legs += box(px - 1.6, py, 3.2, y + 2 - py)
    legSh += box(px, py, 1.6, y + 2 - py)
  }
  let posts = ''
  for (let i = 0; i <= 10; i++) {
    const [ax, ay] = qpt(x0 + 2, y, mx, cy, x1 - 2, y, i / 10)
    const [bx, by] = qpt(x0 + 2, y - 11, mx, rail, x1 - 2, y - 11, i / 10)
    posts += `M${f(ax)} ${f(ay)} L${f(bx)} ${f(by)}`
  }
  return (
    shape(legs, C.red) +
    flat(legSh, C.ink, 0.16) +
    shape(`M${x0} ${y} Q${mx} ${cy} ${x1} ${y} L${x1 - 7} ${y} Q${mx} ${cy2} ${x0 + 7} ${y}Z`, C.red) +
    lines(`M${x0 + 7} ${y} Q${mx} ${cy2} ${x1 - 7} ${y}`, 1.6, C.ink, 0.25) +
    lines(posts, 1.8, C.red) +
    lines(`M${x0 + 2} ${y - 11} Q${mx} ${rail} ${x1 - 2} ${y - 11}`, 2.6, C.red) +
    lines(`M${x0 + 2} ${y - 6} Q${mx} ${2 * (top - 7) - (y - 6)} ${x1 - 2} ${y - 6}`, 1.2, C.red) +
    pips([[x0 + 2, y - 13], [x1 - 2, y - 13]], C.gold, 5)
  )
}
/** 太宰府天滿宮的樓門：兩層、檜皮葺的屋頂，下層的屋頂正中央是唐破風 */
function romon(X: number, b: number): string {
  const P4 = [X - 33, X - 14, X + 9, X + 28]
  const U4 = [X - 24, X - 9, X + 5, X + 20]
  const row = (x0: number, n: number, y: number, w = 3.6, h = 6) => Array.from({ length: n }, (_, i) => box(x0 + i * 8, y, w, h)).join('')
  const kara = `M${X - 16} ${b - 70}C${X - 9} ${b - 70} ${X - 9} ${b - 86} ${X} ${b - 86}C${X + 9} ${b - 86} ${X + 9} ${b - 70} ${X + 16} ${b - 70}`
  return (
    rect(X - 40, b - 6, 80, 8, C.grey) +
    // 兩層的牆：左右兩間是暗的，下層正中間是通道
    flat(box(X - 28, b - 50, 16, 44) + box(X + 12, b - 50, 16, 44) + box(X - 22, b - 106, 44, 20), C.ink, 0.3) +
    flat(box(X - 12, b - 50, 24, 44), C.cream, 0.45) +
    // 斗栱的白色小壁、朱色的柱子與高欄
    shape(box(X - 37, b - 64, 74, 6) + box(X - 27, b - 114, 54, 6), C.white) +
    shape(P4.map((px) => box(px, b - 52, 5, 46)).join('') + box(X - 37, b - 58, 74, 6) + U4.map((px) => box(px, b - 108, 4, 22)).join('') + box(X - 30, b - 88, 60, 3) + box(X - 30, b - 82, 60, 3), C.red) +
    flat(row(X - 35, 9, b - 64) + row(X - 25, 7, b - 114) + row(X - 28, 8, b - 88, 1.6), C.red) +
    flat(P4.map((px) => box(px + 3, b - 52, 2, 46)).join(''), C.ink, 0.16) +
    roof(X, b - 80, b - 66, 54, 94, C.brown, 4) +
    roof(X, b - 136, b - 116, 38, 84, C.brown, 5) +
    lines(`M${X - 19} ${b - 136}H${X + 19}`, 3, C.ink, 0.45) +
    pips([[X - 20, b - 137], [X + 20, b - 137]], C.gold, 4.4) +
    // 唐破風，金色的邊
    shape(kara + 'Z', C.brown) +
    lines(kara, 1.4, C.gold) +
    pips([[X - 31, b - 61], [X - 12, b - 61], [X + 12, b - 61], [X + 31, b - 61]], C.gold, 2.6)
  )
}

/** 中洲的屋台：攤車、條紋的屋頂、暖簾、紅燈籠、裡面的燈光（x 左緣、b 地面、w 寬） */
function yatai(x: number, b: number, w: number, top: string): string {
  const cx = x + w / 2
  const nw = (w - 6) / 5
  const L = [x + 2, x + w - 2]
  const st = [0, 1, 2].map((i) => x + 10 + i * ((w - 32) / 2))
  return (
    `<ellipse cx="${f(cx)}" cy="${b}" rx="${f(w * 0.75)}" ry="9" fill="${C.yellow}" opacity=".22"/>` +
    // 裡面的燈光、湯鍋、蒸氣
    flat(box(x + 4, b - 74, w - 8, 36), C.yellow, 0.85) +
    shape(`M${f(cx + 4)} ${b - 52}h22v12h-22Z`, C.grey) +
    lines(`M${f(cx + 10)} ${b - 54}c-4 -6 4 -9 0 -15M${f(cx + 19)} ${b - 54}c-4 -6 4 -9 0 -15`, 1.4, C.white, 0.8) +
    // 柱子、屋頂（條紋布）、暖簾（沒有字）
    shape(box(x + 2, b - 86, 3, 50) + box(x + w - 5, b - 86, 3, 50), C.brown) +
    shape(`M${x - 6} ${b - 80}L${x + 4} ${b - 96}H${x + w - 4}L${x + w + 6} ${b - 80}Z`, top) +
    flat(Array.from({ length: Math.floor(w / 14) }, (_, i) => `M${f(x + 6 + i * 14)} ${b - 96}h6l-2 16h-7Z`).join('') + box(x - 6, b - 82, w + 12, 3), C.white, 0.5) +
    shape(Array.from({ length: 5 }, (_, i) => box(x + 3.6 + i * nw, b - 80, nw - 1.2, 15 + (i % 2) * 2)).join(''), C.cream) +
    // 攤車：吧台、木板、輪子、小椅子
    rect(x, b - 40, w, 5, C.cream) +
    rect(x + 2, b - 35, w - 4, 26, C.brown) +
    flat(box(x + w - 14, b - 35, 12, 26) + box(x + 2, b - 27, w - 4, 1) + box(x + 2, b - 19, w - 4, 1), C.ink, 0.18) +
    pips([[x + 12, b - 5], [x + w - 12, b - 5]], C.ink, 11, 0.85) +
    shape(st.map((sx) => box(sx, b - 16, 12, 4)).join(''), C.red) +
    lines(st.map((sx) => `M${f(sx + 2)} ${b - 12}l-1 12m9 -12l1 12`).join(''), 1.4, C.ink, 0.7) +
    // 紅燈籠（兩端）
    pips(L.map((lx) => [lx, b - 67]), C.yellow, 26, 0.22) +
    lines(L.map((lx) => `M${lx} ${b - 80}v3`).join(''), 1.2, C.ink) +
    shape(L.map((lx) => `M${lx - 6} ${b - 76}C${lx - 9} ${b - 70} ${lx - 9} ${b - 64} ${lx - 6} ${b - 58}H${lx + 6}C${lx + 9} ${b - 64} ${lx + 9} ${b - 70} ${lx + 6} ${b - 76}Z`).join(''), C.red) +
    flat(L.map((lx) => box(lx - 6, b - 78, 12, 3) + box(lx - 6, b - 59, 12, 3)).join(''), C.ink, 0.85)
  )
}
/** 河對岸的大樓：亮著的窗是一排排的虛線 */
function city(list: [number, number, number][], base: number, op: number, seed: number): string {
  const r = rng(seed)
  let body = ''
  let a = ''
  let c = ''
  let d = ''
  for (const [x, w, h] of list) {
    body += box(x, base - h, w, h)
    for (let xx = x + 4.5; xx < x + w - 3; xx += 6) {
      const v = r()
      const seg = `M${f(xx)} ${base - h + 6}V${base - 4}`
      if (v < 0.5) a += seg
      else if (v < 0.78) c += seg
      else if (v < 0.86) d += seg
    }
  }
  return (
    flat(body, C.navy, op) +
    `<path d="${a}" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-dasharray="3 4" opacity=".75"/>` +
    `<path d="${c}" fill="none" stroke="${C.cream}" stroke-width="3" stroke-dasharray="3 4 3 11" opacity=".55"/>` +
    `<path d="${d}" fill="none" stroke="${C.pink}" stroke-width="3" stroke-dasharray="3 4" opacity=".8"/>`
  )
}

/** 白色的鳥居（二見浦）：整座都是白的 */
function whiteTorii(x: number, y: number, s: number): string {
  const P = (dx: number, dy: number) => `${f(x + dx * s)} ${f(y + dy * s)}`
  return (
    shape(
      `M${P(-15, -52)} L${P(-11, -52)} L${P(-10, 0)} L${P(-16, 0)}Z M${P(11, -52)} L${P(15, -52)} L${P(16, 0)} L${P(10, 0)}Z M${P(-22, -44)} L${P(22, -44)} L${P(22, -40)} L${P(-22, -40)}Z M${P(-24, -56)} L${P(24, -56)} L${P(23, -51)} L${P(-23, -51)}Z M${P(-2, -56)} L${P(2, -56)} L${P(2, -44)} L${P(-2, -44)}Z`,
      C.white,
    ) +
    shape(`M${P(-30, -63)} Q${P(0, -58)} ${P(30, -63)} L${P(28, -57)} L${P(-28, -57)}Z`, C.white) +
    flat(`M${P(13, -52)} L${P(15, -52)} L${P(16, 0)} L${P(13, 0)}Z M${P(-28, -57)} L${P(28, -57)} L${P(27, -55.6)} L${P(-27, -55.6)}Z`, C.ink, 0.12)
  )
}

const FUKUOKA: Outfit[] = [
  // 太宰府天満宮（data/spots/fukuoka.json wd-Q710786，https://zh.wikipedia.org/wiki/%E5%A4%AA%E5%AE%B0%E5%BA%9C%E5%A4%A9%E6%BB%BF%E5%AE%AE）：心字池上的朱色太鼓橋、梅花、兩層的樓門與後面的大樟樹，遠方的寶滿山
  bg({
    id: 'bg-fukuoka-dazaifu',
    name: '太宰府天滿宮',
    pref: 'fukuoka',
    rarity: 3,
    art:
      sky(C.blue, 0.2) +
      cloud(70, 66, 1.1) +
      cloud(236, 92, 0.8, 0.8) +
      ridge([[-10, 252], [50, 230], [110, 214], [160, 204], [214, 224], [262, 238], [310, 248]], C.blue, 0.22) +
      ridge([[-6, 286], [26, 266], [62, 274], [100, 258], [140, 266], [176, 254], [214, 268], [252, 260], [306, 274]], C.green, 0.5) +
      tree(282, 324, 2.5, C.green) +
      tree(186, 322, 1.9, C.matcha) +
      romon(228, 322) +
      ground(C.grey, 320, 0.28) +
      flat('M218 322 L238 322 L284 400 L188 400Z', C.white, 0.4) +
      lines('M214 336 H246 M208 354 H258 M200 376 H274', 1, C.grey, 0.5) +
      `<ellipse cx="66" cy="338" rx="86" ry="15" fill="${C.blue}" opacity=".4" ${E}/>` +
      lines('M24 340h12M72 346h12M98 334h12M44 332h12', 1.6, C.white, 0.6) +
      plum(44, 326, 1.15, [C.pink, C.white], 3) +
      taikobashi(12, 122, 336, 296),
  }),
  // 中洲（data/spots/fukuoka.json wd-Q6960335，https://zh.wikipedia.org/wiki/%E4%B8%AD%E6%B4%B2_%28%E7%A6%8F%E5%B2%A1%E5%B8%82%29）：那珂川邊的屋台（紅燈籠、暖簾、湯鍋的蒸氣），河對岸中洲的大樓燈火倒映在河面
  bg({
    id: 'bg-fukuoka-nakasu',
    name: '中洲屋台',
    pref: 'fukuoka',
    rarity: 2,
    art:
      night(0.68) +
      sun(62, 60, 11, C.cream, 0.95) +
      pips([[120, 40], [176, 24], [214, 58], [260, 30], [32, 104], [150, 70]], C.white, 2.2, 0.8) +
      city([[106, 30, 66], [134, 34, 54], [166, 30, 72]], 286, 0.55, 2) +
      city([[-4, 28, 120], [22, 30, 158], [50, 26, 104], [74, 32, 134], [194, 30, 126], [222, 26, 168], [246, 32, 110], [276, 28, 142]], 286, 0.75, 5) +
      flat(box(0, 286, 300, 34), C.navy, 0.6) +
      `<path d="M14 290V316M34 292V318M58 290V314M84 292V316M206 290V318M232 292V314M256 290V316M282 292V318" fill="none" stroke="${C.yellow}" stroke-width="2.4" stroke-dasharray="2 3" opacity=".4"/>` +
      lines('M39 300h14M113 306h14M163 296h14M237 304h14M143 312h14', 1.6, C.white, 0.3) +
      ground(C.navy, 320, 0.5) +
      flat(box(0, 318, 300, 4), C.grey, 0.6) +
      lines('M0 350 H300 M0 378 H300 M150 320 L130 400 M150 320 L170 400', 1, C.white, 0.14) +
      yatai(30, 342, 82, C.red) +
      yatai(194, 334, 76, C.blue),
  }),
  // 二見ヶ浦（data/spots/fukuoka.json wd-Q21654514，https://en.wikipedia.org/wiki/Futamigaura%2C_Fukuoka）：夕陽落在海中的夫婦岩之間、兩塊岩石之間的大注連繩，岸邊淺水裡的白色鳥居
  bg({
    id: 'bg-fukuoka-futamigaura',
    name: '糸島二見浦',
    pref: 'fukuoka',
    rarity: 1,
    art:
      sky(C.orange, 0.28, C.cream) +
      flat('M0 0H300V116Q270 128 236 118Q196 108 160 120Q118 132 80 118Q40 106 0 120Z', C.pink, 0.24) +
      flat('M0 262V208Q40 196 90 204Q150 214 200 200Q250 190 300 202V262Z', C.yellow, 0.24) +
      `<g fill="${C.white}" opacity=".55">${[[40, 70, 70], [190, 104, 90], [96, 160, 60], [214, 40, 50], [20, 226, 40]].map(([x, y, w]) => `<path d="M${x} ${y}h${w}a4 4 0 0 1 0 8h-${w}a4 4 0 0 1 0-8Z"/>`).join('')}</g>` +
      sun(234, 254, 18, C.yellow, 0.95) +
      flat(box(0, 262, 300, 60), C.blue, 0.42) +
      flat(box(0, 262, 300, 60), C.purple, 0.06) +
      lines('M219 268h30M222 278h24M216 290h36M224 302h20M220 312h28', 2, C.yellow, 0.7) +
      ripples([[40, 276], [120, 284], [80, 300], [160, 296], [30, 310], [130, 312]], 14, 0.45) +
      // 夫婦岩：左邊高的男岩、右邊的女岩，大注連繩繞過兩塊岩石的上端
      shape('M188 306L192 290L190 272L194 254L193 240L198 228L206 219L214 216L222 220L227 230L226 246L230 260L229 278L233 294L236 306Z M238 306L241 290L239 274L243 258L247 246L255 240L263 242L268 252L267 268L271 286L274 306Z', C.brown) +
      flat('M214 216L222 220L227 230L226 246L230 260L229 278L233 294L236 306L218 306L222 280L219 250L221 230Z M255 240L263 242L268 252L267 268L271 286L274 306L262 306L264 280L261 256Z', C.ink, 0.28) +
      flat('M198 228L206 219L210 222L202 236L200 262L196 290L192 290L190 272L194 254L193 240Z M247 246L255 240L257 244L249 256L246 288L241 290L239 274L243 258Z', C.white, 0.14) +
      lines('M194 254L212 258M193 270L210 268M192 290L214 286M243 258L258 262M241 290L262 286M242 274L256 272', 1.2, C.ink, 0.22) +
      shape('M194 232Q210 239 227 232L227 239Q210 246 194 239Z M242 250Q255 256 268 250L268 256Q255 262 242 256Z', C.cream) +
      lines('M226 236Q236 254 244 253', 4.6, C.cream) +
      lines('M199 234l2 5M205 236l2 5M211 237l2 5M217 236l2 5M248 252l2 5M254 254l2 5M260 253l2 5M229 242l3 -2M233 247l3 -2M238 250l3 -2', 1, C.ink, 0.22) +
      lines('M231 246v8M235 250v9M239 252v9M207 241v7M214 241v6M252 258v6M259 258v7', 1.6, C.cream) +
      lines('M182 306Q192 301 202 306Q214 301 228 306Q236 302 244 306Q254 301 264 306Q272 302 280 306', 1.8, C.white, 0.85) +
      whiteTorii(66, 318, 1.15) +
      lines('M44 320 H88', 1.6, C.white, 0.6) +
      ground(C.yellow, 322, 0.32) +
      flat(box(0, 322, 300, 10), C.brown, 0.12) +
      lines('M-4 323 Q24 318 52 323 Q80 318 108 323 Q136 318 164 323 Q192 318 220 323 Q248 318 276 323 Q290 320 304 323', 2, C.white, 0.85) +
      lines('M30 356 Q36 352 42 356 M210 370 Q216 366 222 370 M250 348 Q255 345 260 348', 1.2, C.brown, 0.35),
  }),
]

// ---------- 佐賀 ----------
/** 熱氣球的氣囊（半徑 10 的單位形狀）：k 是左右的寬度，一瓣瓣的顏色往上下收攏 */
const envelope = (k: number) => {
  const P = (dx: number, dy: number) => `${f(dx * 10 * k)} ${f(dy * 10)}`
  return `M${P(-0.2, 1.28)}C${P(-0.55, 0.95)} ${P(-1, 0.5)} ${P(-1, 0)}C${P(-1, -0.56)} ${P(-0.56, -1)} ${P(0, -1)}C${P(0.56, -1)} ${P(1, -0.56)} ${P(1, 0)}C${P(1, 0.5)} ${P(0.55, 0.95)} ${P(0.2, 1.28)}Z`
}
const ENV = [envelope(1), envelope(0.6), envelope(0.22)]
/** 熱氣球：上圓下窄的氣囊、吊繩、吊籃（x 中心、cy 氣囊中心、r 半徑）；整顆用 transform 縮放，紙邊不跟著變粗 */
function balloon(x: number, cy: number, r: number, c1: string, c2: string, full = true): string {
  const ns = 'vector-effect="non-scaling-stroke"'
  return (
    `<g transform="translate(${x} ${cy}) scale(${f(r / 10)})">` +
    shape(ENV[0], c1, ns) +
    flat(ENV[1], c2) +
    (full
      ? flat(ENV[2], c1) +
        flat('M0 -10C5.6 -10 10 -5.6 10 0C10 5 5.5 9.5 2 12.8H1.2C3.3 9.5 6 5 6 0C6 -5.6 3.4 -10 0 -10Z', C.ink, 0.12) +
        lines('M-7.2 -5Q-6 -8.4 -3 -9.2', 0.6, C.white, 0.6) +
        lines('M-2 13L-1.2 16.2M2 13L1.2 16.2', 0.35, C.ink, 0.6) +
        shape('M-1.4 16h2.8v2h-2.8Z', C.brown, ns)
      : flat('M-1.6 12.8h3.2l-.6 3.4h-2Z', C.brown)) +
    '</g>'
  )
}
/** 小鳥居（一排往山上的千本鳥居用）：朱色的柱子與島木、黑色的笠木 */
const miniTorii = (x: number, y: number, s: number) =>
  shape(`M${f(x - 9 * s)} ${f(y)}V${f(y - 26 * s)}h${f(2.6 * s)}V${f(y)}Z M${f(x + 6.4 * s)} ${f(y)}V${f(y - 26 * s)}h${f(2.6 * s)}V${f(y)}Z M${f(x - 12 * s)} ${f(y - 22 * s)}h${f(24 * s)}v${f(2.4 * s)}h${f(-24 * s)}Z M${f(x - 13 * s)} ${f(y - 28 * s)}h${f(26 * s)}v${f(3 * s)}h${f(-26 * s)}Z`, C.red) +
  flat(`M${f(x - 15 * s)} ${f(y - 31 * s)}Q${f(x)} ${f(y - 28 * s)} ${f(x + 15 * s)} ${f(y - 31 * s)}L${f(x + 14 * s)} ${f(y - 28 * s)}H${f(x - 14 * s)}Z`, C.ink)
/** 祐德稻荷的本殿：立在山崖上的懸造，朱色的柱子一格格撐起舞台（x 中心、y 舞台面） */
function kakezukuri(x: number, y: number): string {
  let posts = ''
  for (let px = x - 42; px <= x + 42; px += 14) posts += box(px - 2, y + 4, 4, 322 - y - 4)
  let beams = ''
  for (let by = y + 26; by < 318; by += 26) beams += box(x - 46, by, 92, 3)
  return (
    flat(`M${x - 50} 322L${x - 40} ${y + 10}H${x + 50}V322Z`, C.grey, 0.5) +
    lines(`M${x - 44} ${y + 40}L${x + 44} ${y + 80}M${x - 30} ${y + 100}L${x + 46} ${y + 60}`, 1.4, C.grey, 0.7) +
    shape(posts + beams, C.red) +
    flat(posts.replace(/M([\d.]+)/g, (_, v) => `M${f(+v + 2.4)}`).replace(/h4/g, 'h1.6'), C.ink, 0.18) +
    rect(x - 50, y, 100, 5, C.red) +
    lines(`M${x - 48} ${y - 8}H${x + 48}`, 2, C.red) +
    lines(Array.from({ length: 9 }, (_, i) => `M${x - 48 + i * 12} ${y - 8}V${y}`).join(''), 1.4, C.red) +
    // 本殿：朱色的牆、金色的飾片、黑色的屋頂
    rect(x - 36, y - 40, 72, 40, C.red) +
    flat(box(x - 28, y - 30, 14, 24) + box(x - 7, y - 30, 14, 24) + box(x + 14, y - 30, 14, 24), C.ink, 0.22) +
    lines([-24, -20, -16, -3, 1, 5, 18, 22, 26].map((d) => `M${x + d} ${y - 30}v24`).join('') + `M${x - 28} ${y - 18}h56`, 0.8, C.gold, 0.8) +
    flat(box(x + 18, y - 40, 18, 40), C.ink, 0.12) +
    rect(x - 38, y - 46, 76, 6, C.white) +
    roof(x, y - 74, y - 48, 34, 98, C.ink, 5) +
    shape(`M${x - 14} ${y - 50}C${x - 8} ${y - 50} ${x - 8} ${y - 64} ${x} ${y - 64}C${x + 8} ${y - 64} ${x + 8} ${y - 50} ${x + 14} ${y - 50}Z`, C.ink) +
    lines(`M${x - 14} ${y - 50}C${x - 8} ${y - 50} ${x - 8} ${y - 64} ${x} ${y - 64}C${x + 8} ${y - 64} ${x + 8} ${y - 50} ${x + 14} ${y - 50}`, 1.4, C.gold) +
    pips([[x - 17, y - 75], [x + 17, y - 75], [x - 36, y - 43], [x + 36, y - 43], [x, y - 43]], C.gold, 3.4)
  )
}
/** 石燈籠：台座、竿、中台、火袋、笠、寶珠（x 中心、y 地面、s 大小） */
const toro = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  shape('M-9 0L-7 -5H7L9 0Z M-3 -5V-24H3V-5Z M-8 -24H8V-28H-8Z M-6 -28H6V-38H-6Z M-12 -38L0 -46L12 -38V-35H-12Z M-2.4 -46a2.4 2.4 0 1 1 4.8 0Z', C.grey, 'vector-effect="non-scaling-stroke"') +
  flat('M-3 -36H3V-30H-3Z', C.ink, 0.4) +
  flat('M2 -38H12V-35H2Z M1 -24H3V-5H1Z M3 -28H6V-38H3Z', C.ink, 0.15) +
  '</g>'
/** 吉野里的物見櫓：四根腳、斜撐、圍起來的瞭望台、茅草屋頂（x 中心、y 地面、h 高） */
function yagura(x: number, y: number, h: number, s: number): string {
  const top = y - h
  const w = 24 * s
  return (
    lines(`M${f(x - w)} ${y}L${f(x - w * 0.7)} ${f(top + 10 * s)}M${f(x + w)} ${y}L${f(x + w * 0.7)} ${f(top + 10 * s)}M${f(x - w * 0.3)} ${y}L${f(x - w * 0.25)} ${f(top + 10 * s)}M${f(x + w * 0.3)} ${y}L${f(x + w * 0.25)} ${f(top + 10 * s)}`, 4 * s, C.brown) +
    lines(`M${f(x - w * 0.95)} ${f(y - 4)}L${f(x + w * 0.8)} ${f(top + h * 0.45)}M${f(x + w * 0.95)} ${f(y - 4)}L${f(x - w * 0.8)} ${f(top + h * 0.45)}M${f(x - w * 0.82)} ${f(top + h * 0.45)}L${f(x + w * 0.72)} ${f(top + 12 * s)}M${f(x + w * 0.82)} ${f(top + h * 0.45)}L${f(x - w * 0.72)} ${f(top + 12 * s)}`, 1.6 * s, C.brown, 0.8) +
    lines(`M${f(x - w * 0.86)} ${f(top + h * 0.45)}H${f(x + w * 0.86)}`, 2.4 * s, C.brown) +
    // 瞭望台：木板圍起來
    shape(box(x - w * 0.86, top - 2 * s, w * 1.72, 14 * s), C.brown) +
    lines(Array.from({ length: 6 }, (_, i) => `M${f(x - w * 0.86 + (i + 1) * w * 0.246)} ${f(top - 2 * s)}v${f(14 * s)}`).join(''), 1, C.ink, 0.3) +
    flat(box(x + w * 0.3, top - 2 * s, w * 0.56, 14 * s), C.ink, 0.16) +
    // 茅草屋頂
    shape(`M${f(x - w * 1.1)} ${f(top - 2 * s)}L${f(x - w * 0.34)} ${f(top - 30 * s)}H${f(x + w * 0.34)}L${f(x + w * 1.1)} ${f(top - 2 * s)}Z`, C.yellow) +
    flat(`M${f(x)} ${f(top - 30 * s)}H${f(x + w * 0.34)}L${f(x + w * 1.1)} ${f(top - 2 * s)}H${f(x)}Z`, C.brown, 0.3) +
    lines(`M${f(x - w * 0.8)} ${f(top - 12 * s)}H${f(x + w * 0.8)}M${f(x - w * 0.56)} ${f(top - 21 * s)}H${f(x + w * 0.56)}`, 1, C.brown, 0.45) +
    lines(`M${f(x - w * 0.5)} ${f(top - 34 * s)}L${f(x - w * 0.3)} ${f(top - 28 * s)}M${f(x + w * 0.5)} ${f(top - 34 * s)}L${f(x + w * 0.3)} ${f(top - 28 * s)}M${f(x - w * 0.34)} ${f(top - 30 * s)}H${f(x + w * 0.34)}`, 2 * s, C.brown)
  )
}
/** 高床倉庫：短柱（有擋老鼠的圓板）、木牆、陡的茅草屋頂 */
function kura(x: number, y: number, s: number): string {
  const w = 30 * s
  const fl = y - 22 * s
  return (
    shape([-0.8, -0.27, 0.27, 0.8].map((k) => box(x + k * w - 2 * s, fl, 4 * s, y - fl)).join(''), C.brown) +
    shape([-0.8, -0.27, 0.27, 0.8].map((k) => box(x + k * w - 6 * s, fl + 6 * s, 12 * s, 3 * s)).join(''), C.brown) +
    flat(box(x - w, fl + 6 * s, w * 2, 3 * s), C.ink, 0.15) +
    rect(x - w * 0.95, fl - 4 * s, w * 1.9, 4 * s, C.brown) +
    rect(x - w * 0.82, fl - 26 * s, w * 1.64, 22 * s, C.brown) +
    lines(Array.from({ length: 4 }, (_, i) => `M${f(x - w * 0.82)} ${f(fl - 22 * s + i * 5 * s)}h${f(w * 1.64)}`).join(''), 1, C.ink, 0.25) +
    flat(box(x + w * 0.3, fl - 26 * s, w * 0.52, 22 * s), C.ink, 0.15) +
    shape(`M${f(x - w * 1.2)} ${f(fl - 22 * s)}L${f(x - w * 0.5)} ${f(fl - 62 * s)}H${f(x + w * 0.5)}L${f(x + w * 1.2)} ${f(fl - 22 * s)}Z`, C.yellow) +
    flat(`M${f(x)} ${f(fl - 62 * s)}H${f(x + w * 0.5)}L${f(x + w * 1.2)} ${f(fl - 22 * s)}H${f(x)}Z`, C.brown, 0.3) +
    lines(`M${f(x - w * 0.95)} ${f(fl - 36 * s)}H${f(x + w * 0.95)}M${f(x - w * 0.72)} ${f(fl - 50 * s)}H${f(x + w * 0.72)}`, 1, C.brown, 0.45) +
    lines(`M${f(x - w * 0.62)} ${f(fl - 68 * s)}L${f(x - w * 0.45)} ${f(fl - 60 * s)}M${f(x + w * 0.62)} ${f(fl - 68 * s)}L${f(x + w * 0.45)} ${f(fl - 60 * s)}M${f(x - w * 0.5)} ${f(fl - 62 * s)}H${f(x + w * 0.5)}`, 2.2 * s, C.brown)
  )
}
/** 竪穴住居：從地面蓋起來的圓錐形茅草屋頂 */
const pithouse = (x: number, y: number, s: number) =>
  shape(`M${f(x - 30 * s)} ${y}Q${f(x - 20 * s)} ${f(y - 22 * s)} ${f(x - 4 * s)} ${f(y - 36 * s)}H${f(x + 4 * s)}Q${f(x + 20 * s)} ${f(y - 22 * s)} ${f(x + 30 * s)} ${y}Z`, C.yellow) +
  flat(`M${f(x)} ${f(y - 36 * s)}H${f(x + 4 * s)}Q${f(x + 20 * s)} ${f(y - 22 * s)} ${f(x + 30 * s)} ${y}H${f(x)}Z`, C.brown, 0.3) +
  flat(`M${f(x - 7 * s)} ${y}V${f(y - 12 * s)}H${f(x + 7 * s)}V${y}Z`, C.ink, 0.45) +
  lines(`M${f(x - 22 * s)} ${f(y - 12 * s)}Q${f(x)} ${f(y - 16 * s)} ${f(x + 22 * s)} ${f(y - 12 * s)}M${f(x - 13 * s)} ${f(y - 26 * s)}Q${f(x)} ${f(y - 29 * s)} ${f(x + 13 * s)} ${f(y - 26 * s)}`, 1, C.brown, 0.45) +
  lines(`M${f(x - 7 * s)} ${f(y - 40 * s)}L${f(x - 3 * s)} ${f(y - 35 * s)}M${f(x + 7 * s)} ${f(y - 40 * s)}L${f(x + 3 * s)} ${f(y - 35 * s)}`, 1.8 * s, C.brown)
/** 木柵：一排尖頭的木樁 */
function palisade(x0: number, x1: number, y: number, h: number, fill: string, op = 1): string {
  let d = `M${x0} ${y}`
  for (let x = x0; x < x1; x += 6) d += `V${f(y - h - ((x / 6) % 2) * 3)}l3 -4l3 4`
  return flat(d + `V${y}Z`, fill, op)
}

const SAGA: Outfit[] = [
  // 佐賀インターナショナルバルーンフェスタ（data/spots/saga.json wd-Q7398902，https://en.wikipedia.org/wiki/Saga_International_Balloon_Fiesta）：十一月早上嘉瀬川河岸，一起升空的熱氣球，遠方的山
  bg({
    id: 'bg-saga-balloon-fiesta',
    name: '佐賀國際氣球節',
    pref: 'saga',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      flat('M0 250Q80 240 150 246Q220 252 300 242V330H0Z', C.cream, 0.5) +
      ridge([[-10, 296], [40, 276], [96, 284], [150, 270], [206, 280], [258, 268], [310, 282]], C.blue, 0.24) +
      ridge([[-6, 310], [40, 300], [90, 306], [140, 298], [190, 304], [240, 296], [306, 304]], C.green, 0.4) +
      flat(box(0, 308, 300, 9), C.blue, 0.35) +
      lines('M20 312h16M90 314h12M160 311h18M226 313h14', 1.4, C.white, 0.6) +
      balloon(150, 50, 10, C.orange, C.white, false) +
      balloon(250, 46, 12, C.green, C.yellow, false) +
      balloon(122, 128, 8, C.pink, C.white, false) +
      balloon(260, 132, 8, C.red, C.white, false) +
      balloon(214, 102, 18, C.purple, C.pink) +
      balloon(62, 162, 32, C.red, C.yellow) +
      balloon(238, 200, 28, C.blue, C.white) +
      balloon(60, 272, 18, C.green, C.white) +
      balloon(250, 280, 15, C.yellow, C.orange) +
      ground(C.matcha, 320, 0.42) +
      flat('M0 320H300V326H0Z', C.green, 0.25) +
      lines('M0 344H300M0 372H300', 1.2, C.yellow, 0.5),
  }),
  // 祐徳稲荷神社（data/spots/saga.json wd-Q251682，https://zh.wikipedia.org/wiki/%E7%A5%90%E5%BE%B7%E7%A8%BB%E8%8D%B7%E7%A5%9E%E7%A4%BE）：春天，立在山崖上的朱色懸造本殿、往奧之院一路排上山的鳥居、山上與參道旁的櫻花、石燈籠
  bg({
    id: 'bg-saga-yutoku-inari',
    name: '祐德稻荷神社',
    pref: 'saga',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(60, 52, 1) +
      cloud(232, 86, 0.8, 0.8) +
      ridge([[-10, 214], [50, 184], [120, 170], [190, 150], [250, 142], [310, 156]], C.green, 0.3) +
      ridge([[-10, 246], [40, 222], [100, 212], [160, 200], [220, 186], [270, 178], [310, 188]], C.green, 0.55) +
      tree(24, 262, 1.1, C.pink) +
      tree(118, 240, 1, C.pink) +
      [[40, 322, 1.1], [52, 296, 1], [62, 272, 0.9], [70, 250, 0.8], [76, 230, 0.7], [80, 212, 0.6]].map(([x, y, s]) => miniTorii(x, y, s)).reverse().join('') +
      kakezukuri(224, 220) +
      ground(C.grey, 320, 0.3) +
      flat('M0 320H300V325H0Z', C.ink, 0.06) +
      tree(30, 334, 1.4, C.pink) +
      toro(86, 336, 1) +
      toro(254, 340, 1.1) +
      lines('M0 352H300M0 380H300', 1.2, C.white, 0.4),
  }),
  // 吉野ヶ里遺跡（data/spots/saga.json wd-Q1049645，https://zh.wikipedia.org/wiki/%E5%90%89%E9%87%8E%E9%87%8C%E9%81%BA%E8%B7%A1）：黃昏，彌生時代聚落復原的物見櫓、高床倉庫、竪穴住居與環濠內側的木柵
  bg({
    id: 'bg-saga-yoshinogari',
    name: '吉野里遺跡',
    pref: 'saga',
    rarity: 1,
    art:
      sky(C.orange, 0.26, C.cream) +
      flat('M0 0H300V150Q240 160 170 148Q100 136 0 152Z', C.purple, 0.12) +
      flat('M0 300V230Q60 222 130 228Q210 236 300 224V300Z', C.yellow, 0.3) +
      sun(232, 202, 16, C.yellow, 0.9) +
      `<g fill="${C.white}" opacity=".5">${[[30, 100, 60], [200, 70, 70], [130, 184, 50]].map(([x, y, w]) => `<path d="M${x} ${y}h${w}a4 4 0 0 1 0 8h-${w}a4 4 0 0 1 0-8Z"/>`).join('')}</g>` +
      ridge([[-10, 280], [60, 262], [130, 272], [200, 258], [260, 266], [310, 260]], C.purple, 0.22) +
      ridge([[-6, 304], [50, 296], [110, 300], [170, 292], [230, 298], [306, 292]], C.green, 0.35) +
      palisade(0, 300, 314, 16, C.brown, 0.55) +
      yagura(262, 314, 98, 0.6) +
      kura(234, 322, 0.9) +
      yagura(58, 322, 150, 1) +
      pithouse(102, 326, 0.8) +
      ground(C.matcha, 320, 0.38) +
      flat('M0 320H300V328H0Z', C.brown, 0.15) +
      lines('M20 346q8-4 16 0M240 360q8-4 16 0M110 384q8-4 16 0', 1.2, C.green, 0.6),
  }),
]

// ---------- 長崎 ----------
/** 大浦天主堂：白牆的哥德式教堂，正面的八角尖塔與兩側的小尖塔，下面是石階與石垣（x 正面中心、y 台地） */
function oura(x: number, y: number): string {
  const lancet = (cx: number, top: number, w: number, h: number) => `M${f(cx - w / 2)} ${f(top + h)}V${f(top + w * 0.6)}Q${f(cx - w / 2)} ${f(top)} ${f(cx)} ${f(top - w * 0.3)}Q${f(cx + w / 2)} ${f(top)} ${f(cx + w / 2)} ${f(top + w * 0.6)}V${f(top + h)}Z`
  return (
    // 石垣與正面的石階
    shape(`M${x - 48} 322L${x - 46} ${y}H${x + 48}L${x + 50} 322Z`, C.grey) +
    lines(`M${x - 46} ${y + 10}H${x - 18}M${x + 18} ${y + 10}H${x + 48}M${x - 47} ${y + 22}H${x - 22}M${x + 22} ${y + 22}H${x + 49}M${x - 36} ${y}v10M${x + 34} ${y + 10}v12M${x - 30} ${y + 22}v12M${x + 40} ${y}v10`, 1, C.ink, 0.2) +
    shape(`M${x - 16} ${y}H${x + 16}L${x + 24} 322H${x - 24}Z`, C.cream) +
    lines(Array.from({ length: 8 }, (_, i) => `M${f(x - 16 - i)} ${y + 4 + i * 4}H${f(x + 16 + i)}`).join(''), 1.2, C.grey, 0.7) +
    // 本堂：灰藍的屋頂、白牆、尖拱窗
    shape(`M${x - 38} ${y - 52}L${x - 30} ${y - 72}H${x + 30}L${x + 38} ${y - 52}Z`, C.navy, 'opacity=".75"') +
    rect(x - 36, y - 52, 72, 52, C.white) +
    flat(box(x + 18, y - 52, 18, 52), C.ink, 0.08) +
    flat(lancet(x - 28, y - 42, 7, 22) + lancet(x + 28, y - 42, 7, 22), C.blue, 0.7) +
    // 正面的塔：門、彩色玻璃、八角尖塔、十字架
    rect(x - 14, y - 86, 28, 86, C.white) +
    flat(box(x + 6, y - 86, 8, 86), C.ink, 0.08) +
    shape(lancet(x, y - 28, 14, 28), C.brown) +
    lines(`M${x} ${y - 30}V${y}`, 1, C.ink, 0.35) +
    flat(lancet(x, y - 66, 10, 26), C.blue, 0.8) +
    flat(box(x - 5, y - 54, 10, 3) + box(x - 1, y - 68, 2, 26), C.yellow, 0.9) +
    pips([[x, y - 74]], C.red, 4) +
    lines(`M${x - 14} ${y - 86}H${x + 14}M${x - 14} ${y - 36}H${x + 14}`, 1.6, C.grey, 0.6) +
    rect(x - 10, y - 98, 20, 12, C.white) +
    flat(lancet(x - 4, y - 96, 3, 8) + lancet(x + 4, y - 96, 3, 8), C.ink, 0.5) +
    shape(`M${x - 11} ${y - 98}L${x} ${y - 160}L${x + 11} ${y - 98}Z`, C.navy, 'opacity=".8"') +
    flat(`M${x} ${y - 160}L${x + 11} ${y - 98}H${x + 4}Z`, C.ink, 0.2) +
    lines(`M${x} ${y - 160}V${y - 176}M${x - 5} ${y - 170}H${x + 5}`, 2, C.ink) +
    // 正面兩側的小尖塔
    shape(`M${x - 40} ${y - 50}V${y - 64}L${x - 36} ${y - 80}L${x - 32} ${y - 64}V${y - 50}Z M${x + 32} ${y - 50}V${y - 64}L${x + 36} ${y - 80}L${x + 40} ${y - 64}V${y - 50}Z`, C.white) +
    flat(`M${x - 36} ${y - 80}L${x - 40} ${y - 64}H${x - 32}Z M${x + 36} ${y - 80}L${x + 32} ${y - 64}H${x + 40}Z`, C.navy, 0.7)
  )
}
/** 端島（軍艦島）：高高的海堤圍起來的島，擠滿方方的舊公寓，中間的岩山上有燈塔（從遊船上看） */
function gunkanjima(): string {
  const blocks: [number, number, number][] = [[158, 18, 30], [174, 22, 46], [194, 18, 62], [212, 18, 44], [230, 20, 36], [250, 14, 48], [264, 18, 76], [280, 24, 58]]
  let body = ''
  let win = ''
  for (const [x, w, h] of blocks) {
    body += box(x, 284 - h, w, h)
    for (let yy = 284 - h + 5; yy < 280; yy += 5) win += `M${x + 2} ${yy}H${x + w - 2}`
  }
  return (
    // 中間的岩山與燈塔
    shape('M204 284L212 236Q222 214 236 206Q248 200 256 210Q266 222 270 284Z', C.matcha) +
    flat('M236 206Q248 200 256 210Q266 222 270 284H246Q250 240 236 206Z', C.ink, 0.14) +
    flat('M218 230l8-6l4 8l-6 4Z M244 222l6-2l2 8l-6 1Z', C.brown, 0.35) +
    rect(214, 226, 14, 12, C.grey) +
    rect(240, 186, 5, 20, C.white) +
    flat(box(239, 183, 7, 4), C.ink, 0.6) +
    shape(body, C.grey) +
    flat(body, C.brown, 0.12) +
    `<path d="${win}" fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-dasharray="2.4 2" opacity=".42"/>` +
    flat('M194 222h18v3h-18Z M174 238h22v3h-22Z M264 208h18v3h-18Z', C.ink, 0.25) +
    flat(box(166, 262, 5, 22) + box(220, 240, 4, 44) + box(272, 216, 5, 68) + box(186, 250, 3, 34), C.brown, 0.3) +
    flat(box(190, 238, 4, 46) + box(256, 236, 8, 48) + box(296, 236, 8, 48), C.ink, 0.12) +
    // 海堤：左邊尖尖的船頭
    shape('M140 300L158 280H304V308H150Z', C.grey) +
    flat('M150 308L156 300H304V308Z', C.ink, 0.22) +
    flat(box(176, 282, 5, 18) + box(232, 282, 6, 16) + box(280, 282, 4, 20), C.brown, 0.2) +
    lines('M158 280H304', 1.4, C.white, 0.6)
  )
}
/** 長崎燈會的黃色燈籠：沿著一條垂下來的繩子掛一排（x0 y0 → x1 y1，cy 控制點） */
function lanternString(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number): string {
  let body = ''
  let caps = ''
  let tas = ''
  const glow: Pt[] = []
  for (let i = 1; i < n; i++) {
    const [lx, ly] = qpt(x0, y0, cx, cy, x1, y1, i / n)
    const y = ly + 9
    body += `M${f(lx - 5.5)} ${f(y)}a5.5 6.5 0 1 0 11 0a5.5 6.5 0 1 0 -11 0Z`
    caps += box(lx - 3, y - 8, 6, 2.4) + box(lx - 3, y + 5.6, 6, 2.4)
    tas += `M${f(lx)} ${f(ly)}v2.6M${f(lx)} ${f(y + 8)}v5`
    glow.push([lx, y])
  }
  return (
    lines(`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, 0.8, C.ink, 0.6) +
    pips(glow, C.yellow, 18, 0.14) +
    lines(tas, 1.2, C.red) +
    shape(body, C.yellow) +
    flat(caps, C.red) +
    lines(glow.map(([x, y]) => `M${f(x - 5)} ${f(y)}h10`).join(''), 0.7, C.orange, 0.7)
  )
}
/** 眼鏡橋：兩個石拱，倒影接起來像一副眼鏡（水面 y、兩個拱心 a b、半徑 r） */
function meganebashi(y: number, a: number, b: number, r: number): string {
  const L = a - r - 8
  const R = b + r + 8
  const top = y - r - 10
  const arch = (sweep: number, bottom: number) => `M${L} ${y}V${bottom}H${R}V${y}H${b + r}A${r} ${r} 0 0 ${sweep} ${b - r} ${y}H${a + r}A${r} ${r} 0 0 ${sweep} ${a - r} ${y}Z`
  let joints = ''
  for (const c of [a, b])
    for (let k = 0; k <= 6; k++) {
      const t = Math.PI * (k / 6)
      joints += `M${f(c - r * Math.cos(t))} ${f(y - r * Math.sin(t))}L${f(c - (r + 6) * Math.cos(t))} ${f(y - (r + 6) * Math.sin(t))}`
    }
  return (
    flat(arch(1, y + r + 10), C.cream, 0.3) +
    shape(arch(0, top), C.grey) +
    flat(arch(0, top), C.cream, 0.25) +
    flat(arch(0, top), C.yellow, 0.12) +
    lines(joints + `M${L} ${top + 5}H${R}`, 1, C.ink, 0.3) +
    shape(box(L - 2, top - 5, R - L + 4, 5), C.grey)
  )
}

const NAGASAKI: Outfit[] = [
  // 長崎ランタンフェスティバル（data/festivals/nagasaki.json nagasaki-Q11652390，https://zh.wikipedia.org/wiki/%E9%95%B7%E5%B4%8E%E7%87%88%E6%9C%83）＋眼鏡橋（data/spots/nagasaki.json wd-Q74710，https://zh.wikipedia.org/wiki/%E7%9C%BC%E9%8F%A1%E6%A9%8B_%28%E9%95%B7%E5%B4%8E%E5%B8%82%29）：燈會的夜裡，中島川上掛滿黃色燈籠，石造雙拱的眼鏡橋和倒影連成一副眼鏡，後面山坡上的燈火
  bg({
    id: 'bg-nagasaki-meganebashi',
    name: '眼鏡橋',
    pref: 'nagasaki',
    rarity: 3,
    art:
      night(0.7) +
      sun(244, 52, 10, C.cream, 0.95) +
      ridge([[-10, 230], [40, 200], [100, 214], [160, 196], [220, 208], [270, 190], [310, 204]], C.navy, 0.45) +
      pips([[20, 226], [44, 214], [66, 222], [30, 244], [84, 232], [118, 222], [180, 214], [214, 220], [236, 210], [262, 202], [284, 214], [250, 230], [56, 240], [276, 236]], C.yellow, 2.4, 0.8) +
      flat('M0 300V262H22V252H48V266H70V256H92V270H112V300Z M180 300V264H204V254H228V268H250V258H276V266H300V300Z', C.navy, 0.75) +
      `<path d="M8 270V296M30 262V296M58 272V296M80 266V296M100 276V296M216 258V266M290 274V296" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-dasharray="3 5" opacity=".7"/>` +
      flat(box(0, 296, 300, 26), C.navy, 0.55) +
      `<path d="M20 300V318M50 302V318M82 300V316M120 304V318M160 300V318" fill="none" stroke="${C.yellow}" stroke-width="2.4" stroke-dasharray="2 3" opacity=".45"/>` +
      meganebashi(296, 212, 253, 19) +
      lanternString(-10, 100, 150, 160, 310, 96, 12) +
      lanternString(-10, 168, 150, 222, 310, 160, 12) +
      lanternString(-10, 214, 70, 262, 160, 226, 6) +
      ground(C.navy, 320, 0.5) +
      flat(box(0, 318, 300, 5), C.grey, 0.55) +
      lines('M0 346H300M0 374H300M40 323V346M100 323V346M200 323V346M260 323V346M70 346V374M150 346V374M230 346V374', 1, C.white, 0.14),
  }),
  // 大浦天主堂（data/spots/nagasaki.json wd-Q430626，https://zh.wikipedia.org/wiki/%E5%A4%A7%E6%B5%A6%E5%A4%A9%E4%B8%BB%E5%A0%82）：春天，石階上白牆的哥德式教堂與八角尖塔，港的對岸是稻佐山與造船廠的大吊車
  bg({
    id: 'bg-nagasaki-oura',
    name: '大浦天主堂',
    pref: 'nagasaki',
    rarity: 2,
    art:
      sky(C.blue, 0.22) +
      cloud(66, 70, 1.1) +
      cloud(150, 40, 0.7, 0.7) +
      ridge([[-10, 252], [30, 212], [74, 196], [118, 214], [160, 240], [210, 262]], C.blue, 0.26) +
      lines('M70 196V174M80 200V182', 1.4, C.navy, 0.35) +
      flat(box(0, 262, 300, 40), C.blue, 0.22) +
      lines('M30 258V232M18 234H60M30 240L44 234', 2, C.navy, 0.3) +
      lines('M20 274h14M70 282h14M120 272h14M50 294h14', 1.4, C.white, 0.6) +
      tree(116, 300, 1.2, C.pink) +
      ridge([[-6, 312], [30, 300], [80, 306], [130, 298], [170, 304]], C.green, 0.4) +
      oura(236, 286) +
      tree(44, 326, 1.9, C.pink) +
      tree(290, 326, 1.4, C.pink) +
      ground(C.grey, 320, 0.3) +
      lines('M0 344H300M0 370H300M60 320L40 400M120 344L110 400', 1, C.white, 0.45),
  }),
  // 端島（data/spots/nagasaki.json wd-Q285468，https://zh.wikipedia.org/wiki/%E7%AB%AF%E5%B3%B6）：夏天，從遊船的甲板看海上的軍艦島：海堤、擠在一起的公寓、岩山上的燈塔
  bg({
    id: 'bg-nagasaki-gunkanjima',
    name: '軍艦島',
    pref: 'nagasaki',
    rarity: 1,
    art:
      sky(C.blue, 0.3) +
      cloud(60, 120, 1.8) +
      cloud(96, 100, 1.2, 0.95) +
      cloud(250, 60, 1, 0.8) +
      lines('M210 120q4-4 8 0q4-4 8 0M240 150q3-3 6 0q3-3 6 0M60 190q3-3 6 0q3-3 6 0', 1.4, C.ink, 0.5) +
      flat(box(0, 256, 300, 66), C.blue, 0.5) +
      ridge([[10, 262], [40, 250], [80, 262]], C.green, 0.35, 262) +
      gunkanjima() +
      lines('M140 308Q156 303 176 309Q200 303 230 309Q260 303 300 308', 1.6, C.white, 0.8) +
      lines('M30 274h16M90 282h16M40 296h16M110 300h14M190 314h16M250 316h16', 1.4, C.white, 0.6) +
      // 遊船的甲板與欄杆、救生圈
      ground(C.white, 320, 0.6) +
      flat(box(0, 320, 300, 4), C.ink, 0.1) +
      lines('M0 300H300M0 310H300', 2.4, C.white) +
      lines('M10 300V320M60 300V320M110 300V320M160 300V320M210 300V320M260 300V320', 2, C.white) +
      lines('M0 302H300', 1, C.ink, 0.12) +
      `<circle cx="56" cy="310" r="11" fill="none" stroke="${C.orange}" stroke-width="6"/>` +
      lines('M47 304l3 3M62 316l3 3M45 316l3 -3M65 304l-3 3', 6.2, C.white) +
      lines('M0 348H300M0 376H300', 1, C.grey, 0.4),
  }),
]

// ---------- 熊本 ----------
/** 熊本城：武者返し石垣（往下越來越張開的弧）上的大天守與後面的小天守；牆是黑的、瓦是深灰、屋脊與簷下是白的 */
function kumamotoCastle(X: number): string {
  // 各層的牆：[中心, 上緣, 寬, 高, 窗數]
  const fl: [number, number, number, number, number][] = [[286, 232, 40, 30, 3], [286, 204, 28, 16, 2], [X, 238, 66, 24, 5], [X, 212, 48, 14, 4], [X, 184, 34, 16, 3]]
  // 各層的屋頂：[中心, 屋脊, 簷, 屋脊寬, 簷寬]
  const rf: [number, number, number, number, number][] = [[286, 220, 232, 30, 54], [286, 190, 204, 18, 40], [X, 226, 240, 54, 96], [X, 200, 214, 40, 76], [X, 166, 186, 22, 60]]
  const ishi = 'M176 322Q198 316 199 262H304V322Z'
  let joints = ''
  for (let y = 270; y < 322; y += 8) joints += `M${f(199 - ((y - 262) / 60) ** 2.4 * 20)} ${y}H304`
  const gable = (x: number, base: number, w: number, h: number) => `M${x - w / 2} ${base}L${x} ${base - h}L${x + w / 2} ${base}`
  const gables = gable(X - 18, 232, 22, 10) + gable(X + 18, 232, 22, 10) + gable(X, 208, 26, 12)
  return (
    shape(fl.map(([x, t, w, h]) => box(x - w / 2, t, w, h)).join(''), C.ink) +
    flat(fl.map(([x, t, w]) => box(x - w / 2, t, w, 3)).join(''), C.white, 0.85) +
    flat(fl.map(([x, t, w, h, n]) => Array.from({ length: n }, (_, i) => box(x - w / 2 + ((i + 0.5) * w) / n - 3, t + h * 0.42, 6, 4)).join('')).join(''), C.grey, 0.75) +
    // 石垣
    shape(ishi, C.grey) +
    flat(ishi, C.cream, 0.25) +
    lines(joints + 'M220 262V270M250 270V278M232 286V294M270 278V286M214 302V310M262 294V302M240 310V318', 1, C.ink, 0.2) +
    lines('M176 322Q198 316 199 262', 2, C.white, 0.7) +
    // 屋頂、千鳥破風、最上層的迴廊、鯱
    rf.map(([x, ry, ey, rw, ew]) => roof(x, ry, ey, rw, ew, C.ink, 4, 0.72)).join('') +
    flat(gables.replace(/M([\d.]+ [\d.]+)L([\d.]+ [\d.]+)L([\d.]+ [\d.]+)/g, 'M$1L$2L$3Z'), C.ink) +
    lines(gables + rf.map(([x, ry, , rw]) => `M${x - rw / 2} ${ry}H${x + rw / 2}`).join(''), 1.4, C.white, 0.7) +
    lines(`M${X - 20} 196H${X + 20}`, 2, C.ink) +
    lines(Array.from({ length: 9 }, (_, i) => `M${X - 20 + i * 5} 192v4`).join(''), 1, C.ink) +
    shape(`M${X - 12} 166c-2 -1 -3 -4 -1 -6c1 1 2 3 2 6Z M${X + 12} 166c2 -1 3 -4 1 -6c-1 1 -2 3 -2 6Z`, C.gold)
  )
}
/** 城的土塀與石垣（左邊）：石垣、黑板白壁的牆、瓦頂 */
const castleWall = (x0: number, x1: number, y: number) =>
  shape(`M${x0} 322V${y + 12}H${x1}Q${x1 + 4} ${y + 30} ${x1 + 14} 322Z`, C.grey) +
  flat(`M${x0} 322V${y + 12}H${x1}Q${x1 + 4} ${y + 30} ${x1 + 14} 322Z`, C.cream, 0.25) +
  lines(`M${x0} ${y + 20}H${x1 + 1}M${x0} ${y + 28}H${x1 + 3}M${x0} ${y + 36}H${x1 + 6}`, 1, C.ink, 0.2) +
  rect(x0, y - 8, x1 - x0, 20, C.white) +
  flat(box(x0, y + 2, x1 - x0, 10), C.ink, 0.85) +
  shape(`M${x0} ${y - 8}H${x1 + 4}L${x1} ${y - 13}H${x0}Z`, C.navy)

/** 通潤橋：沒有欄杆的石造拱橋，正中間往外放水（x 橋中心、y 河面、r 拱的半徑、half 半個橋長） */
function tsujunkyo(x: number, y: number, r: number, half: number): string {
  const top = y - r - 36
  const L = x - half
  const R = x + half
  const body = `M${L} ${y + 6}V${top}H${R}V${y + 6}H${x + r}V${y - 4}A${r} ${r} 0 0 0 ${x - r} ${y - 4}V${y + 6}Z`
  let joints = ''
  for (let k = 0; k <= 10; k++) {
    const t = Math.PI * (k / 10)
    joints += `M${f(x - r * Math.cos(t))} ${f(y - 4 - r * Math.sin(t))}L${f(x - (r + 9) * Math.cos(t))} ${f(y - 4 - (r + 9) * Math.sin(t))}`
  }
  for (let yy = top + 9; yy < y; yy += 8) {
    const w = yy > y - 4 - r ? Math.sqrt(Math.max(0, (r + 9) ** 2 - (y - 4 - yy) ** 2)) : 0
    joints += w ? `M${L} ${yy}H${f(x - w)}M${f(x + w)} ${yy}H${R}` : `M${L} ${yy}H${R}`
  }
  const jet = `M${x - 4} ${top + 12}C${x - 26} ${top + 8} ${x - 46} ${top + 30} ${x - 52} ${y + 2}`
  return (
    shape(body, C.grey) +
    flat(body, C.cream, 0.32) +
    // 兩端往下張開的石垣（鞘石垣）
    flat(`M${L} ${y + 6}V${y - 30}L${x - r - 14} ${y - 4}V${y + 6}Z M${R} ${y + 6}V${y - 30}L${x + r + 14} ${y - 4}V${y + 6}Z`, C.ink, 0.1) +
    lines(joints, 1, C.ink, 0.17) +
    rect(L - 2, top - 3, R - L + 4, 4, C.grey) +
    flat(box(x - 3, top + 9, 6, 5), C.ink, 0.5) +
    // 放水：從橋的正中間噴出來，畫一道弧落到河裡，下面是水花
    lines(jet, 11, C.blue, 0.22) +
    lines(jet, 7, C.white, 0.95) +
    lines(`M${x - 6} ${top + 16}C${x - 24} ${top + 16} ${x - 38} ${top + 36} ${x - 42} ${y}M${x - 8} ${top + 10}C${x - 30} ${top + 4} ${x - 52} ${top + 26} ${x - 60} ${y - 2}`, 1.6, C.white, 0.8) +
    lines(`M${x - 14} ${top + 14}C${x - 28} ${top + 16} ${x - 40} ${top + 30} ${x - 46} ${y - 10}`, 1.2, C.blue, 0.4) +
    pips([[x - 52, y], [x - 42, y + 4], [x - 62, y + 4], [x - 34, y + 6], [x - 56, y + 8]], C.white, 14, 0.75) +
    pips([[x - 48, y - 8], [x - 60, y - 6], [x - 38, y - 4]], C.white, 8, 0.6)
  )
}
/** 棚田：一層層彎曲的田（黃金色的稻與收割過的田交錯） */
function tanada(x0: number, y0: number, n: number): string {
  let gold = ''
  let cut = ''
  let edge = ''
  for (let i = 0; i < n; i++) {
    const y = y0 + i * 14
    const x = x0 - i * 8
    const d = `M${x} ${y + 12}Q${x + 30} ${y - 2} ${f(x + 60 + i * 6)} ${y}T310 ${y - 4}V${y + 10}Q${f(x + 70 + i * 6)} ${y + 14} ${x} ${y + 12}Z`
    if (i % 3 === 1) cut += d
    else gold += d
    edge += `M${x} ${y + 12}Q${x + 30} ${y - 2} ${f(x + 60 + i * 6)} ${y}T310 ${y - 4}`
  }
  return flat(gold, C.yellow, 0.75) + flat(cut, C.orange, 0.4) + lines(edge, 1.6, C.green, 0.6)
}
/** 馬（側面）：x 腳底中心、y 地面、s 大小，s 為負時朝左；graze 是低頭吃草 */
const horse = (x: number, y: number, s: number, fill: string = C.brown, graze = false) =>
  `<g transform="translate(${x} ${y}) scale(${s} ${Math.abs(s)})">` +
  flat(
    graze
      ? 'M-12 -14C-13 -19 -9 -21 -4 -21H5C9 -21 12 -16 15 -10L18 -4C19 -2 17 -1 15 -2L12 -7C10 -10 9 -12 7 -12C3 -11 -8 -11 -12 -14Z'
      : 'M-12 -14C-13 -19 -9 -21 -4 -21H5C8 -22 11 -26 13 -29C15 -31 17 -30 18 -28L22 -22C23 -20 21 -19 19 -20L16 -21C14 -19 12 -15 10 -13C8 -12 -8 -11 -12 -14Z',
    fill,
  ) +
  lines('M-9 -14L-10 0M-5 -13V0M5 -13L6 0M8 -14L9 0M-12 -17Q-16 -14 -15 -6', 2.2, fill) +
  lines(graze ? 'M5 -21Q10 -20 13 -14' : 'M12 -28Q8 -25 6 -21', 2, C.ink, 0.35) +
  '</g>'

/** 火山的白煙：從火口往上冒、越來越寬、往右飄（一串重疊的圓，右下錯開一層淡灰當陰影） */
function plume(x: number, y: number): string {
  const r = rng(11)
  const pts: [number, number, number][] = []
  for (let i = 0; i < 16; i++) {
    const t = i / 15
    pts.push([x + 6 * t + 140 * t * t + (r() - 0.5) * 8 * t, y - 156 * t + 34 * t * t + (r() - 0.5) * 8 * t, 5 + 16 * t + r() * 5 * t])
  }
  const d = pts.map(([px, py, pr]) => `M${f(px - pr)} ${f(py)}a${f(pr)} ${f(pr)} 0 1 0 ${f(2 * pr)} 0a${f(pr)} ${f(pr)} 0 1 0 ${f(-2 * pr)} 0Z`).join('')
  return `<path d="${d}" fill="${C.grey}" opacity=".35" transform="translate(3 4)"/>` + flat(d, C.white, 0.95)
}

const KUMAMOTO: Outfit[] = [
  // 熊本城（data/spots/kumamoto.json wd-Q613355，https://zh.wikipedia.org/wiki/%E7%86%8A%E6%9C%AC%E5%9F%8E）：春天的櫻花，武者返し石垣上的黑色大天守與小天守，左邊是城的土塀
  bg({
    id: 'bg-kumamoto-castle',
    name: '熊本城',
    pref: 'kumamoto',
    rarity: 3,
    art:
      sky(C.blue, 0.22) +
      cloud(64, 64, 1.2) +
      cloud(150, 34, 0.7, 0.7) +
      ridge([[-10, 262], [40, 238], [90, 228], [140, 244], [200, 262], [260, 256], [310, 266]], C.blue, 0.22) +
      ridge([[-6, 300], [40, 286], [100, 292], [160, 284], [220, 294]], C.green, 0.4) +
      kumamotoCastle(228) +
      castleWall(-4, 74, 286) +
      tree(36, 330, 2.1, C.pink) +
      tree(102, 326, 1.4, C.pink) +
      tree(294, 330, 1.5, C.pink) +
      ground(C.matcha, 320, 0.32) +
      pips([[70, 200], [150, 250], [210, 300], [40, 360], [120, 380], [260, 350], [90, 340], [190, 372], [230, 330]], C.pink, 3.4) +
      lines('M0 350H300M0 380H300', 1, C.green, 0.3),
  }),
  // 通潤橋（data/spots/kumamoto.json wd-Q3077059，https://zh.wikipedia.org/wiki/%E9%80%9A%E6%B6%A6%E6%A1%A5）：秋天，沒有欄杆的石造拱橋從正中間放水，山谷裡的紅葉，右邊山坡上的梯田
  bg({
    id: 'bg-kumamoto-tsujunkyo',
    name: '通潤橋',
    pref: 'kumamoto',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      flat('M0 300V200Q80 190 150 198Q230 206 300 194V300Z', C.orange, 0.12) +
      cloud(232, 70, 1) +
      ridge([[-10, 214], [50, 190], [110, 200], [170, 182], [240, 196], [310, 186]], C.blue, 0.24) +
      ridge([[-10, 252], [40, 236], [100, 244], [150, 232], [210, 226], [260, 214], [310, 220]], C.orange, 0.4) +
      tanada(190, 232, 6) +
      tree(176, 270, 1.4, C.red) +
      tree(150, 262, 1.2, C.orange) +
      tree(118, 246, 1.1, C.yellow) +
      ridge([[-6, 312], [30, 300], [80, 306], [140, 298], [190, 304], [240, 300], [306, 308]], C.green, 0.4) +
      tsujunkyo(78, 304, 32, 100) +
      flat(box(0, 308, 300, 14), C.blue, 0.4) +
      lines('M120 314h14M170 312h14M230 316h14', 1.4, C.white, 0.6) +
      tree(266, 326, 1.6, C.orange) +
      tree(290, 330, 1.3, C.red) +
      ground(C.matcha, 320, 0.35) +
      pips([[30, 340], [80, 360], [150, 380], [220, 350], [250, 376], [120, 344], [200, 390]], C.orange, 4, 0.8) +
      pips([[56, 372], [180, 336], [240, 392], [100, 390]], C.red, 4, 0.8),
  }),
  // 草千里ヶ浜（data/spots/kumamoto.json wd-Q31454860，https://ja.wikipedia.org/wiki/%E8%8D%89%E5%8D%83%E9%87%8C%E3%83%B6%E6%B5%9C）：夏天，阿蘇的大草原與水池、吃草的馬，左邊冒著白煙的中岳，右邊的烏帽子岳
  bg({
    id: 'bg-kumamoto-kusasenri',
    name: '草千里濱',
    pref: 'kumamoto',
    rarity: 1,
    art:
      sky(C.blue, 0.28) +
      cloud(250, 120, 1.1, 0.9) +
      ridge([[-10, 250], [20, 216], [58, 204], [100, 214], [140, 248], [180, 272]], C.grey, 0.55) +
      ridge([[-10, 250], [20, 216], [58, 204], [100, 214], [140, 248], [180, 272]], C.brown, 0.2) +
      plume(58, 210) +
      ridge([[130, 290], [180, 236], [226, 206], [248, 200], [276, 214], [310, 236]], C.green, 0.6) +
      lines('M210 232L196 268M238 214L232 262M262 216L270 258', 1.4, C.green, 0.6) +
      ridge([[-6, 300], [60, 288], [150, 292], [240, 284], [306, 292]], C.matcha, 0.5) +
      `<ellipse cx="236" cy="300" rx="42" ry="7" fill="${C.blue}" opacity=".5" ${E}/>` +
      `<ellipse cx="50" cy="306" rx="22" ry="4" fill="${C.blue}" opacity=".45" ${E}/>` +
      lines('M220 300h14M246 302h12M44 306h10', 1.4, C.white, 0.7) +
      horse(80, 300, 0.6, C.brown, true) +
      horse(256, 312, -0.7, C.ink, true) +
      ground(C.green, 320, 0.42) +
      horse(50, 346, 1.15) +
      lines('M20 360l3-6l3 6M120 380l3-6l3 6M200 352l3-6l3 6M250 386l3-6l3 6M90 336l3-5l3 5M276 340l3-5l3 5', 1.2, C.green, 0.8),
  }),
]

export const BG: Outfit[] = [...FUKUOKA, ...SAGA, ...NAGASAKI, ...KUMAMOTO]
