import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, ripples, roofs, SH, shape, sky, sun, torii } from './kit'

/**
 * 地區背景：秋田、山形、福島。題材取自 data/spots 的景點，出處是那筆景點的 summary.source_url。
 */

const f = (v: number) => +v.toFixed(1)

// ---------- 秋田 ----------
/** 竿燈：x 親竹、y 最下面一根橫竹、s 大小、bend 頂端往旁邊彎多少；燈籠吊在每根橫竹下面（一個燈籠 = 一段圓頭的粗線） */
function kanto(x: number, y: number, s = 1, op = 1, bend = 0, rows = 9, cols = 5, detail = true): string {
  const lw = f(9 * s)
  const lh = 12 * s
  const gap = 2.4 * s
  const rowH = 16 * s
  const wid = cols * lw + (cols - 1) * gap
  let bars = ''
  let rim = ''
  let pole = `M${f(x)} ${f(y + 46 * s)}`
  const cxs: number[] = []
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1)
    const cx = x + bend * t * t
    const by = y - i * rowH
    cxs.push(cx)
    if (bend) pole += `L${f(cx)} ${f(by)}`
    bars += `M${f(cx - wid / 2 - 2.5 * s)} ${f(by)}h${f(wid + 5 * s)}`
    if (detail) rim += `M${f(cx - wid / 2 + lw * 0.2)} ${f(by + 2 * s)}h${f(wid)}m${f(-wid)} ${f(lh - 1 * s)}h${f(wid)}`
  }
  // 燈籠：一直排一條折線，虛線的每一段（圓頭）就是一個燈籠
  const col = (dx: number) => {
    let d = ''
    for (let j = 0; j < cols; j++) {
      const ox = -wid / 2 + lw / 2 + j * (lw + gap) + dx
      d += `M${f(cxs[rows - 1] + ox)} ${f(y - (rows - 1) * rowH + 1.5 * s + lw / 2)}`
      if (bend) for (let i = rows - 2; i >= 0; i--) d += `l${f(cxs[i] - cxs[i + 1])} ${f(rowH)}`
      d += `v${f(lh - lw + (bend ? 0 : (rows - 1) * rowH))}`
    }
    return d
  }
  const dash = `stroke-dasharray="${f(lh - lw)} ${f(rowH - lh + lw)}"`
  const lan = `<path d="${col(0)}" ${line(lw, C.yellow)} ${dash}/>`
  const sh = detail ? `<path d="${col(lw * 0.28)}" ${line(f(lw * 0.36), C.ink, 0.14)} ${dash}/>` : ''
  const tx = f(x + bend * 1.08)
  const ty = f(y - (rows - 1) * rowH - 14 * s)
  pole += `L${tx} ${ty}`
  const cy = f(y - ((rows - 2) * rowH) / 2)
  return (
    `<g opacity="${op}">` +
    (detail
      ? `<ellipse cx="${f(x + bend / 2)}" cy="${cy}" rx="${f(wid * 0.95)}" ry="${f(rows * rowH * 0.66)}" fill="${C.orange}" opacity=".1"/>` +
        `<ellipse cx="${f(x + bend / 2)}" cy="${cy}" rx="${f(wid * 0.78)}" ry="${f(rows * rowH * 0.58)}" fill="${C.yellow}" opacity=".1"/>`
      : '') +
    `<path d="${pole}" ${line(2.2 * s, C.brown)}/>` +
    `<path d="${bars}" ${line(1.5 * s, C.brown)}/>` +
    lan +
    (detail
      ? sh +
        `<path d="${rim}" fill="none" stroke="${C.ink}" stroke-opacity=".55" stroke-width="${f(1.3 * s)}" stroke-dasharray="${f(lw * 0.6)} ${f(lw * 0.4 + gap)}"/>`
      : '') +
    // 頂端的御幣
    shape(`M${tx} ${ty}l${f(5 * s)} ${f(3 * s)}l${f(-4 * s)} ${f(2.5 * s)}l${f(5 * s)} ${f(3 * s)}l${f(-6 * s)} ${f(1.5 * s)}z`, C.white) +
    `</g>`
  )
}
/** 竿燈的表演者（差し手）：穿法被，把竿舉在頭上 */
const sashite = (x: number, y: number) =>
  shape(`M${x - 6} ${y} L${x - 5} ${y - 14} L${x - 7} ${y - 26} L${x - 3} ${y - 31} L${x + 3} ${y - 31} L${x + 7} ${y - 26} L${x + 5} ${y - 14} L${x + 6} ${y}Z`, C.white) +
  `<path d="M${x - 1} ${y - 14} L${x - 1} ${y} M${x - 7} ${y - 26} L${x - 2} ${y - 44} M${x + 7} ${y - 26} L${x + 2} ${y - 44}" ${line(2.4, C.ink, 0.8)}/>` +
  `<circle cx="${x}" cy="${y - 35}" r="4.2" fill="${C.ink}" opacity=".85"/>` +
  `<path d="M${x - 7} ${y - 18} L${x + 7} ${y - 18}" ${line(2, C.navy)}/>`

/** 把一組圖形放到 (x, y)、放大 s 倍（裡面用以原點為準的整數座標，字串比較短） */
const at = (x: number, y: number, s: number, body: string, extra = '') => `<g transform="translate(${x} ${y}) scale(${s})" ${extra}>${body}</g>`
/** 枝垂櫻（原點是樹根）：幾片鐘形的花幕疊在一起，下緣是垂下來的枝梢 */
function shidare(): string {
  const bell = (cx: number, w: number, top: number, bot: number, n: number) => {
    const X = (v: number) => Math.round(cx + v * w)
    let d = `M${cx} ${-top}C${X(0.6)} ${-top} ${X(0.8)} ${-top + 30} ${X(0.86)} ${-top + 70}S${X(1)} ${-bot - 30} ${X(1)} ${-bot}`
    for (let k = 1; k <= n; k++) {
      const t = 1 - (2 * k) / n
      d += `L${X(t + 1 / n)} ${-bot - 22 - (k % 3) * 6}L${X(t)} ${-bot + ((k * 5) % 4) * 5}`
    }
    return `${d}S${X(-0.86)} ${-top + 70} ${X(-0.86)} ${-top + 70}C${X(-0.8)} ${-top + 30} ${X(-0.6)} ${-top} ${cx} ${-top}Z`
  }
  let fall = ''
  for (const k of [-3, -2, -1, 1, 2, 3]) fall += `M${k * 5} -160C${k * 12} -150 ${k * 14} -110 ${k * 15} ${-34 - (k & 1) * 14}`
  const back = bell(-4, 62, 182, 44, 12)
  return (
    shape('M-5 0C-4 -40 -12 -70 -24 -96L-18 -98C-6 -78 0 -70 4 -100L9 -98C6 -60 5 -30 6 0Z', C.brown) +
    `<path d="${back}" fill="${C.white}"/><path d="${back}" fill="${C.pink}" opacity=".6" ${E}/>` +
    `<path d="${bell(-30, 32, 148, 26, 7)}${bell(30, 30, 140, 30, 7)}${bell(0, 40, 172, 50, 9)}" fill="${C.pink}" ${E}/>` +
    `<path d="M14 -168C34 -160 40 -120 40 -70L40 -50L30 -54C32 -90 30 -130 14 -168Z" ${SH}/>` +
    `<path d="${fall}" ${line(1.3, C.white, 0.6)}/>`
  )
}
/** 黑板塀（透視，道路兩側）：每一側 [近端 x, 遠端 x, 近端上緣, 近端下緣, 門的位置（0–1，沒有門是 -1）]，消失點 vp */
function kurobei(vp: [number, number], sides: Array<[number, number, number, number, number]>): string {
  const p = { base: '', panel: '', boards: '', cap: '', hi: '', door: '', post: '', roof: '', ridge: '' }
  for (const [near, far, top0, bot0, gateAt] of sides) {
    const T = (x: number) => f(top0 + ((vp[1] - top0) * (x - near)) / (vp[0] - near))
    const B = (x: number) => f(bot0 + ((vp[1] - bot0) * (x - near)) / (vp[0] - near))
    for (let k = 1; k < 12; k++) {
      const x = f(near + ((far - near) * (1 - Math.pow(0.84, k))) / (1 - Math.pow(0.84, 12)))
      p.boards += `M${x} ${T(x)}V${B(x)}`
    }
    p.base += `M${near} ${bot0}L${far} ${B(far)}v2L${near} ${bot0 + 8}Z`
    p.panel += `M${near} ${top0}L${far} ${T(far)}V${B(far)}L${near} ${bot0}Z`
    p.cap += `M${near} ${top0 - 6}L${far} ${f(+T(far) - 2)}v2L${near} ${top0 + 2}Z`
    p.hi += `M${near} ${top0 - 6}L${far} ${f(+T(far) - 2)}`
    if (gateAt >= 0) {
      const g0 = f(near + (far - near) * gateAt)
      const g1 = f(g0 + (far - near) * 0.2)
      const d = g1 - g0
      p.door += `M${g0} ${T(g0)}L${g1} ${T(g1)}V${B(g1)}L${g0} ${B(g0)}Z`
      p.post += `M${g0} ${f(+T(g0) - 4)}V${B(g0)}M${g1} ${f(+T(g1) - 4)}V${B(g1)}M${f(g0 + d / 2)} ${T(g0 + d / 2)}V${B(g0 + d / 2)}`
      p.roof += `M${f(g0 - d * 0.3)} ${f(+T(g0) - 2)}L${f(g0 + d * 0.2)} ${f(+T(g0) - 18)}L${f(g1 - d * 0.05)} ${f(+T(g1) - 14)}L${f(g1 + d * 0.25)} ${f(+T(g1) - 1)}Z`
      p.ridge += `M${f(g0 + d * 0.2)} ${f(+T(g0) - 18)}L${f(g1 - d * 0.05)} ${f(+T(g1) - 14)}`
    }
  }
  return (
    shape(p.base, C.grey) +
    shape(p.panel, C.ink, 'opacity=".86"') +
    `<path d="${p.boards}" ${line(1, C.white, 0.14)}/>` +
    shape(p.cap, C.ink) +
    `<path d="${p.hi}" ${line(1, C.white, 0.3)}/>` +
    shape(p.door, C.brown) +
    `<path d="${p.post}" ${line(2.6, C.brown)}/><path d="${p.post}" ${line(1, C.ink, 0.3)}/>` +
    shape(p.roof, C.ink) +
    `<path d="${p.ridge}" ${line(1.4, C.grey)}/>`
  )
}
/** 幾棵針葉樹（杉、樅）合成一個 path：[x, 樹根的 y, 高度] */
function firs(list: Array<[number, number, number]>, fill: string = C.green, op = 1): string {
  let d = ''
  let sh = ''
  for (const [x, y, h] of list) {
    const w = h * 0.2
    let r = ''
    let l = ''
    for (let k = 1; k <= 5; k++) {
      const yy = Math.round(y - h + (h * 0.9 * k) / 5)
      const ww = (w * k) / 5 + w * 0.3
      r += `L${Math.round(x + ww)} ${yy}` + (k < 5 ? `L${Math.round(x + ww * 0.55)} ${yy}` : '')
      l = (k < 5 ? `L${Math.round(x - ww * 0.55)} ${yy}` : '') + `L${Math.round(x - ww)} ${yy}` + l
    }
    d += `M${x} ${y - h}${r}L${x + 2} ${y}L${x - 2} ${y}${l}Z`
    sh += `M${x} ${y - h}L${Math.round(x + w * 1.3)} ${Math.round(y - h * 0.1)}H${x}Z`
  }
  return `<g opacity="${op}"><path d="${d}" fill="${fill}" ${E}/><path d="${sh}" ${SH}/></g>`
}
/** 辰子像：金色的像（長髮、長衣，雙手在胸前合起），x 中心、y 腳下 */
const tatsuko = (x: number, y: number) =>
  at(
    x,
    y,
    1,
    shape('M-26 26C-24 10 -12 3 0 4C12 2 22 10 26 26Z', C.grey) +
      '<path d="M3 4C14 3 22 10 26 26L9 26Z" ' + SH + '/>' +
      shape('M-7 0H8V5H-7Z', C.grey) +
      shape('M-3 -76C-9 -74 -10 -64 -9 -54L-8 -40L-2 -44Z', C.gold) +
      shape('M-2 -64L2 -64L3 -60L7 -58C9 -50 8 -44 7 -38C8 -26 9 -12 9 0H-8C-8 -12 -7 -26 -6 -38C-7 -44 -8 -50 -6 -58L-3 -60Z', C.gold) +
      '<path d="M3 -60L7 -58C9 -50 8 -44 7 -38C8 -26 9 -12 9 0H5C6 -14 5 -28 5 -38C6 -46 6 -54 3 -60Z" ' + SH + '/>' +
      `<path d="M-6 -56L-5 -46L0 -44M7 -56L6 -46L1 -44" ${line(2.4, C.gold)}/>` +
      `<path d="M-6 -56L-5 -46L0 -44M7 -56L6 -46L1 -44" ${line(1, C.ink, 0.2)}/>` +
      `<circle cx="0" cy="-70" r="5.4" fill="${C.gold}" ${E}/>` +
      `<path d="M-2 -38L-2 -4" ${line(1, C.white, 0.5)}/>`,
  )

const AKITA: Outfit[] = [
  // 竿燈（data/spots/akita.json wd-Q4701224，https://zh.wikipedia.org/wiki/%E7%AB%BF%E7%87%88）：夏夜的竿燈大通，左右兩支大若竿燈與舉竿的表演者，後面滿街的竿燈
  bg({
    id: 'bg-akita-kanto',
    name: '秋田竿燈祭',
    pref: 'akita',
    rarity: 3,
    art:
      sky(C.navy, 0.74, C.cream) +
      `<ellipse cx="150" cy="330" rx="230" ry="150" fill="${C.orange}" opacity=".1"/><ellipse cx="150" cy="330" rx="170" ry="96" fill="${C.orange}" opacity=".1"/>` +
      sun(232, 48, 13, C.cream, 0.9) +
      `<g fill="${C.navy}" opacity=".5"><rect x="-4" y="196" width="46" height="130"/><rect x="40" y="226" width="38" height="100"/><rect x="226" y="208" width="40" height="118"/><rect x="262" y="180" width="44" height="146"/></g>` +
      `<path d="M8 210h8M24 210h8M8 230h8M24 230h8M246 226h8M276 196h8M276 216h8M292 216h8M246 246h8" ${line(4, C.yellow, 0.35)}/>` +
      kanto(150, 196, 0.8, 0.42, 0, 9, 5, false) +
      kanto(108, 250, 0.6, 0.5, 0, 9, 5, false) +
      kanto(194, 246, 0.6, 0.5, 0, 9, 5, false) +
      `<path d="M0 324 ${Array.from({ length: 30 }, (_, i) => `q5 ${-18 + (i % 3) * 2} 10 0`).join('')}V324Z" fill="${C.ink}" opacity=".4"/>` +
      ground(C.navy, 320, 0.52) +
      `<ellipse cx="60" cy="336" rx="44" ry="6" fill="${C.yellow}" opacity=".2"/><ellipse cx="240" cy="334" rx="44" ry="6" fill="${C.yellow}" opacity=".2"/>` +
      `<path d="M0 352 L300 352 M0 378 L300 378" ${line(1.2, C.white, 0.18)}/>` +
      kanto(58, 252, 1, 1, 14) +
      kanto(242, 248, 1, 1, -14) +
      sashite(58, 336) +
      sashite(242, 332),
  }),
  // 角館（data/spots/akita.json wd-Q11630890，https://zh.wikipedia.org/wiki/%E8%A7%92%E9%A4%A8）：武家屋敷通的黑板塀與門，牆後垂下來的枝垂櫻
  bg({
    id: 'bg-akita-kakunodate',
    name: '角館',
    pref: 'akita',
    rarity: 2,
    art:
      sky() +
      cloud(70, 60, 1.1) +
      cloud(236, 92, 0.8, 0.8) +
      ridge([[-10, 268], [40, 252], [96, 262], [150, 250], [206, 258], [262, 246], [310, 262]], C.green, 0.25, 318) +
      firs([[118, 314, 34], [184, 314, 40]], C.green, 0.6) +
      `<path d="M112 312 q8 -18 18 -4 q10 -14 20 0 q10 -14 20 0 q10 -16 18 4Z" fill="${C.pink}" opacity=".7" ${E}/>` +
      firs([[12, 300, 176], [290, 300, 166], [100, 302, 120], [202, 304, 112]]) +
      ground(C.cream, 316) +
      `<path d="M150 314 L76 400 L224 400Z" fill="${C.grey}" opacity=".3"/>` +
      `<path d="M150 314 L-60 400 L76 400Z M150 314 L224 400 L360 400Z" fill="${C.brown}" opacity=".14"/>` +
      at(54, 300, 0.94, shidare()) +
      at(248, 302, 0.9, shidare()) +
      kurobei([150, 314], [
        [-4, 112, 262, 350, 0.32],
        [304, 188, 264, 350, 0.5],
      ]) +
      `<path d="${[[30, 360], [64, 372], [96, 352], [118, 388], [180, 366], [206, 384], [238, 356], [262, 374], [44, 392], [150, 344], [272, 396]].map(([x, y]) => `M${x} ${y}h3`).join('')}" ${line(2.6, C.pink, 0.9)}/>` +
      `<path d="M112 150l3 1M84 112l3 -1M196 128l3 1M224 170l3 -1M130 236l3 1M176 214l3 1M60 160l3 1M250 116l3 -1" ${line(2.4, C.pink, 0.9)}/>`,
  }),
  // 田沢湖（data/spots/akita.json wd-Q174309，https://zh.wikipedia.org/wiki/%E7%94%B0%E6%BE%A4%E6%B9%96）：黃昏的湖面、站在湖中的金色辰子像、岸邊的朱色鳥居，遠方的秋田駒ヶ岳
  bg({
    id: 'bg-akita-tazawako',
    name: '田澤湖',
    pref: 'akita',
    rarity: 1,
    art:
      sky(C.orange, 0.26, C.cream) +
      `<ellipse cx="150" cy="30" rx="260" ry="150" fill="${C.purple}" opacity=".08"/><ellipse cx="150" cy="-10" rx="220" ry="90" fill="${C.purple}" opacity=".08"/><ellipse cx="150" cy="276" rx="200" ry="70" fill="${C.yellow}" opacity=".16"/>` +
      cloud(70, 78, 1.3, 0.75, C.pink) +
      cloud(232, 44, 1, 0.7, C.pink) +
      cloud(258, 156, 0.7, 0.6, C.white) +
      shape('M90 284C136 264 168 240 194 226C204 220 210 213 218 214C226 215 230 221 236 218C244 212 252 213 258 219C272 232 290 240 310 246V284Z', C.purple, 'opacity=".42"') +
      `<path d="M236 218C244 212 252 213 258 219C272 232 290 240 310 246V284H250C256 260 250 234 236 218Z" ${SH}/>` +
      ridge([[-10, 262], [30, 250], [80, 258], [120, 252], [160, 262], [210, 256], [260, 264], [310, 256]], C.navy, 0.28, 284) +
      `<path d="M-4 272 ${Array.from({ length: 26 }, (_, i) => `q6 ${-9 - ((i * 7) % 4) * 3} 12 0`).join('')}V272Z" fill="${C.orange}" opacity=".45" ${E}/>` +
      `<rect y="270" width="300" height="60" fill="${C.blue}" opacity=".85" ${E}/>` +
      `<path d="M0 270h300v6c-30 3 -60 -2 -90 1s-60 -3 -90 0 -80 -2 -120 -1Z" fill="${C.purple}" opacity=".3"/>` +
      `<path d="M0 314c40 -4 70 3 110 -1s80 4 120 -2 50 2 70 1V330H0Z" fill="${C.green}" opacity=".35"/>` +
      ripples([[36, 288], [118, 292], [190, 284], [266, 296], [100, 306], [222, 308], [150, 300]], 16, 0.4) +
      `<path d="M50 302h20M46 310h28M52 318h18" ${line(1.6, C.gold, 0.7)}/>` +
      tatsuko(60, 292) +
      shape('M204 327 C208 316 222 311 236 313 C250 311 264 317 268 327Z', C.grey) +
      `<path d="M236 313 C250 311 264 317 268 327H244Z" ${SH}/>` +
      torii(236, 319, 0.7) +
      ground(C.cream, 324) +
      `<rect y="324" width="300" height="76" fill="${C.brown}" opacity=".16"/>` +
      `<path d="M0 325 Q75 319 150 325 T300 325" ${line(2.2, C.white, 0.7)}/>` +
      `<path d="M14 330l-3 -9M17 330l1 -10M20 330l4 -8M280 332l-3 -9M283 332l1 -11M286 332l4 -8" ${line(1.6, C.green, 0.8)}/>` +
      `<g fill="${C.grey}" opacity=".55" ${E}><ellipse cx="30" cy="352" rx="9" ry="4"/><ellipse cx="96" cy="370" rx="6" ry="3"/><ellipse cx="228" cy="358" rx="10" ry="4"/><ellipse cx="270" cy="386" rx="7" ry="3"/><ellipse cx="160" cy="392" rx="5" ry="2.4"/></g>`,
  }),
]

// ---------- 山形 ----------
/**
 * 銀山溫泉的木造旅館（正面）：同樣高度的幾棟 xs = [[x0, x1], …]、base 地面、floors 層數、fh 一層的高度。
 * 一樓是格子，樓上是亮著的障子與木欄杆，各層的庇上積雪，屋頂是白壁的山牆。full = false 是遠景的簡略版；tower：第幾棟的屋頂上有望樓
 */
function ryokans(xs: Array<[number, number]>, base: number, floors: number, fh: number, full = true, tower = -1): string {
  const [t0, t1] = xs[tower] ?? [0, 0]
  const tm = (t0 + t1) / 2
  const top = base - floors * fh
  const p = { body: '', sh: '', win: '', lat: '', rail: '', railTop: '', eave: '', snow: '', wall: '', beam: '', board: '', cap: '' }
  const gable = (gx0: number, gx1: number, gy: number, gh: number) => {
    const m = f((gx0 + gx1) / 2)
    p.wall += `M${gx0} ${gy}L${m} ${f(gy - gh)}L${gx1} ${gy}Z`
    p.beam += `M${f(m - (gx1 - gx0) * 0.18)} ${f(gy - gh * 0.62)}H${f(m + (gx1 - gx0) * 0.18)}M${m} ${f(gy - gh)}V${gy}`
    p.board += `M${f(gx0 - 6)} ${f(gy + 4)}L${m} ${f(gy - gh)}L${f(gx1 + 6)} ${f(gy + 4)}`
    p.cap += `M${f(gx0 - 8)} ${f(gy + 2)}L${m} ${f(gy - gh - 4)}L${f(gx1 + 8)} ${f(gy + 2)}L${f(gx1 + 4)} ${f(gy - 1)}L${m} ${f(gy - gh + 1)}L${f(gx0 - 4)} ${f(gy - 1)}Z`
  }
  for (const [x0, x1] of xs) {
    const w = x1 - x0
    p.body += `M${x0} ${base}V${top}H${x1}V${base}Z`
    p.sh += `M${f(x1 - w * 0.2)} ${base}V${top}H${x1}V${base}Z`
    p.lat += `M${x0 + 3} ${f(base - fh * 0.42)}H${x1 - 3}`
    for (let i = 1; i < floors; i++) {
      const yb = base - i * fh
      p.win += `M${x0 + 3} ${f(yb - fh * 0.5)}H${x1 - 3}`
      p.rail += `M${x0 + 1} ${f(yb - fh * 0.27)}H${x1 - 1}`
      p.railTop += `M${x0} ${f(yb - fh * 0.36)}H${x1}`
      p.eave += `M${x0 - 5} ${yb}h${w + 10}l-3 ${f(fh * 0.14)}H${x0 - 2}Z`
      p.snow += `M${x0 - 6} ${yb}q${f(w / 2 + 6)} ${f(-fh * 0.18)} ${w + 12} 0Z`
    }
    gable(x0 + 2, x1 - 2, top, f(Math.min(fh * 0.95, w * 0.34)))
  }
  const dash = (w: number, d: string) => `fill="none" stroke-width="${f(fh * w)}" stroke-dasharray="${d}"`
  return (
    shape(p.body, C.brown) +
    (full ? `<path d="${p.sh}" ${SH}/>` : '') +
    `<path d="${p.win}${p.lat}" stroke="${C.yellow}" ${dash(0.4, `${f(fh * 0.2)} 1.2`)}/>` +
    (full
      ? `<path d="${p.lat}" stroke="${C.brown}" ${dash(0.4, '1.2 1.8')}/>` +
        `<path d="${p.rail}" stroke="${C.brown}" ${dash(0.18, '1.4 2.6')}/>` +
        `<path d="${p.railTop}" ${line(1.8, C.brown)}/>`
      : '') +
    shape(p.eave, C.ink) +
    shape(p.snow, C.white) +
    shape(p.wall, C.white) +
    (full ? `<path d="${p.beam}" ${line(1.2, C.brown, 0.7)}/>` : '') +
    `<path d="${p.board}" ${line(f(fh * 0.1 + 1), C.ink)}/>` +
    shape(p.cap, C.white) +
    // 望樓：屋頂上再一層小樓
    (tower >= 0 ? ryokans([[f(tm - (t1 - t0) * 0.16), f(tm + (t1 - t0) * 0.16)]], f(top - (t1 - t0) * 0.12), 1, 15, false) : '')
  )
}
/** 瓦斯燈（幾盞同樣高度 h）：xs、y 腳下 */
function gaslamps(xs: number[], y: number, h: number): string {
  let glow = ''
  let post = ''
  let lamp = ''
  let hat = ''
  for (const x of xs) {
    glow += `<circle cx="${x}" cy="${y - h}" r="${f(h * 0.3)}"/>`
    post += `M${x} ${y}V${y - h + 4}`
    lamp += `M${f(x - h * 0.09)} ${f(y - h + 5)}h${f(h * 0.18)}l${f(h * 0.03)} ${f(-h * 0.18)}h${f(-h * 0.24)}Z`
    hat += `M${f(x - h * 0.15)} ${f(y - h - 1.4)}h${f(h * 0.3)}l${f(-h * 0.15)} ${f(-h * 0.08)}Z`
  }
  return `<g fill="${C.yellow}" opacity=".25">${glow}</g><path d="${post}" ${line(f(h * 0.06 + 0.6), C.ink, 0.85)}/>` + shape(lamp, C.yellow) + shape(hat, C.ink)
}
/** 雪：小白點 */
const snowfall = (pts: Array<[number, number]>, r = 2.4) => `<path d="${pts.map(([x, y]) => `M${x} ${y}h0`).join('')}" ${line(r, C.white, 0.9)}/>`

/** 佛堂（正面）：x 中心、y 地板、w 寬、h 牆高、wall 牆的顏色；兩端翹起的屋頂 */
function hall(x: number, y: number, w: number, h: number, wall: string, roof: string = C.ink): string {
  const r = w * 0.78
  const t = y - h
  return (
    shape(`M${f(x - w / 2)} ${y}V${t}H${f(x + w / 2)}V${y}Z`, wall) +
    `<path d="M${f(x + w * 0.22)} ${y}V${t}H${f(x + w / 2)}V${y}Z" ${SH}/>` +
    `<path d="M${f(x - w / 6)} ${y}V${t}M${f(x + w / 6)} ${y}V${t}" ${line(1, C.ink, 0.35)}/>` +
    shape(`M${f(x - r)} ${f(t + 2)}Q${f(x - r * 0.5)} ${f(t - 1)} ${f(x - r * 0.42)} ${f(t - h * 0.7)}H${f(x + r * 0.42)}Q${f(x + r * 0.5)} ${f(t - 1)} ${f(x + r)} ${f(t + 2)}L${f(x + r - 3)} ${f(t + 4)}H${f(x - r + 3)}Z`, roof)
  )
}
/** 一團團的樹（紅葉、櫻）：每個 [x, y, r] 疊三個圓，同色的合成一個 path */
function clumps(list: Array<[number, number, number]>, fill: string, op = 1): string {
  const c = (x: number, y: number, r: number) => {
    const R = Math.round(r)
    return `M${Math.round(x - R)} ${Math.round(y)}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`
  }
  const d = list.map(([x, y, r]) => c(x - r * 0.45, y, r * 0.66) + c(x + r * 0.5, y + r * 0.08, r * 0.6) + c(x, y - r * 0.42, r * 0.7)).join('')
  // paint-order：先畫邊再塗色，重疊的圓裡面的邊被蓋掉，只留外面一圈
  return `<path d="${d}" fill="${fill}" opacity="${op}" ${E} paint-order="stroke"/>`
}

/** 羽黒山五重塔：素木（不上漆）的五重塔、杮葺的屋頂；x 中心、y 台基、s 大小 */
function haguroPagoda(x: number, y: number, s = 1): string {
  let body = ''
  let sh = ''
  let roof = ''
  let brk = ''
  let bottom = y
  for (let i = 0; i < 5; i++) {
    const bw = (26 - i * 2.2) * s
    const rw = (64 - i * 4.6) * s
    const top = bottom - (i === 0 ? 20 : 13) * s
    body += `M${f(x - bw / 2)} ${f(bottom)}V${f(top)}H${f(x + bw / 2)}V${f(bottom)}Z`
    sh += `M${f(x + bw / 2 - 5 * s)} ${f(bottom)}V${f(top)}H${f(x + bw / 2)}V${f(bottom)}Z`
    brk += `M${f(x - bw / 2 - 3 * s)} ${f(top + 1.6 * s)}H${f(x + bw / 2 + 3 * s)}`
    roof += `M${f(x - rw / 2)} ${f(top - 3 * s)}Q${f(x - rw * 0.36)} ${f(top - 1 * s)} ${f(x - rw * 0.22)} ${f(top - 6 * s)}L${f(x)} ${f(top - 9 * s)}L${f(x + rw * 0.22)} ${f(top - 6 * s)}Q${f(x + rw * 0.36)} ${f(top - 1 * s)} ${f(x + rw / 2)} ${f(top - 3 * s)}L${f(x + rw / 2 - 2 * s)} ${f(top + 1 * s)}Q${f(x + rw * 0.3)} ${f(top + 2 * s)} ${f(x)} ${f(top + 1.4 * s)}Q${f(x - rw * 0.3)} ${f(top + 2 * s)} ${f(x - rw / 2 + 2 * s)} ${f(top + 1 * s)}Z`
    bottom = top - 8 * s
  }
  let rings = ''
  for (let i = 0; i < 9; i++) rings += `M${f(x - 3.6 * s)} ${f(bottom - (4 + i * 3) * s)}h${f(7.2 * s)}`
  return (
    shape(`M${f(x - 26 * s)} ${f(y + 4 * s)}H${f(x + 26 * s)}L${f(x + 23 * s)} ${f(y - 1 * s)}H${f(x - 23 * s)}Z`, C.grey) +
    shape(body, C.brown) +
    `<path d="${sh}" ${SH}/>` +
    `<path d="${brk}" ${line(f(1.6 * s), C.cream, 0.5)}/>` +
    `<path d="M${f(x - 20 * s)} ${f(y - 8 * s)}H${f(x + 20 * s)}M${f(x - 20 * s)} ${f(y - 1 * s)}V${f(y - 8 * s)}M${f(x + 20 * s)} ${f(y - 1 * s)}V${f(y - 8 * s)}" ${line(f(1.4 * s), C.brown)}/>` +
    shape(roof, C.brown) +
    `<path d="${roof}" fill="${C.ink}" opacity=".42"/>` +
    `<path d="M${x} ${f(bottom + 2 * s)}V${f(bottom - 34 * s)}" ${line(f(2.2 * s), C.ink, 0.7)}/>` +
    `<path d="${rings}" ${line(f(1.3 * s), C.ink, 0.7)}/>`
  )
}
/** 杉木大樹的樹幹：[x 中心, 粗細, 上端 y（可以在畫面外）, 樹根 y] */
const trunks = (list: Array<[number, number, number, number]>, op = 1) =>
  `<g opacity="${op}"><path d="${list.map(([x, w, y0, y1]) => `M${f(x - w / 2)} ${y0}H${f(x + w / 2)}L${f(x + w / 2 + w * 0.12)} ${y1}H${f(x - w / 2 - w * 0.12)}Z`).join('')}" fill="${C.brown}" ${E}/>` +
  `<path d="${list.map(([x, w, y0, y1]) => `M${f(x + w * 0.18)} ${y0}H${f(x + w / 2)}L${f(x + w / 2 + w * 0.12)} ${y1}H${f(x + w * 0.2)}Z`).join('')}" ${SH}/>` +
  `<path d="${list.filter(([, w]) => w > 14).map(([x, w, y0, y1]) => `M${f(x - w * 0.22)} ${y0}V${y1}M${f(x + w * 0.05)} ${y0 + 20}V${y1 - 10}M${f(x - w * 0.36)} ${y0 + 60}V${y1 - 30}`).join('')}" ${line(1, C.ink, 0.22)}/></g>`

const YAMAGATA: Outfit[] = [
  // 銀山温泉（data/spots/yamagata.json wd-Q5563313，https://zh.wikipedia.org/wiki/%E9%8A%80%E5%B1%B1%E6%BA%AB%E6%B3%89）：雪的傍晚，銀山川兩岸的木造多層旅館、亮起來的窗與瓦斯燈
  bg({
    id: 'bg-yamagata-ginzan',
    name: '銀山溫泉',
    pref: 'yamagata',
    rarity: 3,
    art:
      sky(C.navy, 0.6, C.cream) +
      `<rect width="300" height="400" fill="${C.blue}" opacity=".18"/>` +
      // 兩側陡峭的山與積雪的杉林
      shape('M-10 96 C40 120 100 210 150 268 L150 330 L-10 330Z M310 86 C260 112 200 210 150 268 L150 330 L310 330Z', C.navy, 'opacity=".42"') +
      shape('M-10 150 C30 170 80 220 120 262 L120 330 L-10 330Z M310 140 C270 162 220 220 180 262 L180 330 L310 330Z', C.white, 'opacity=".14"') +
      firs([[14, 132, 26], [44, 150, 24], [76, 176, 22], [104, 210, 18], [288, 124, 26], [256, 146, 24], [226, 174, 22], [198, 208, 18]], C.navy, 0.5) +
      ryokans([[112, 136], [164, 188]], 288, 3, 14, false) +
      ryokans([[76, 112], [188, 224]], 302, 3, 22, false) +
      shape('M-6 323 L136 289 L146 270 L154 270 L164 289 L306 323Z', C.white) +
      `<path d="M146 270 L154 270 L196 322 L104 322Z" fill="${C.navy}" opacity=".62"/>` +
      `<path d="M140 284v8M160 286v10M124 300v14M178 298v16M150 300v18" ${line(2.4, C.yellow, 0.5)}/>` +
      gaslamps([120, 180], 296, 22) +
      ryokans([[22, 84], [216, 278]], 324, 4, 32, true, 0) +
      gaslamps([96, 204], 320, 32) +
      ground(C.white, 322) +
      `<rect y="322" width="300" height="78" fill="${C.blue}" opacity=".16"/>` +
      `<path d="M0 326 H300" ${line(4, C.brown, 0.55)}/>` +
      `<path d="M0 326 H300" ${line(1.4, C.white)}/>` +
      `<path d="M-10 400 Q40 352 110 372 Q150 382 190 372 Q260 352 310 400Z" fill="${C.white}" opacity=".7"/>` +
      `<path d="M30 384 Q70 370 110 378 M190 378 Q230 370 270 384" ${line(1.6, C.blue, 0.25)}/>` +
      snowfall([[20, 30], [70, 60], [120, 24], [180, 50], [240, 20], [280, 70], [40, 120], [100, 140], [160, 110], [214, 130], [266, 104], [24, 200], [138, 214], [286, 220], [88, 250], [210, 246], [60, 360], [240, 372], [150, 388], [12, 288], [292, 300]]),
  }),
  // 立石寺（data/spots/yamagata.json wd-Q1760419，https://zh.wikipedia.org/wiki/%E7%AB%8B%E7%9F%B3%E5%AF%BA）：紅葉的山寺，岩峰上的朱色納經堂與開山堂、左邊懸崖上的五大堂
  bg({
    id: 'bg-yamagata-yamadera',
    name: '山寺立石寺',
    pref: 'yamagata',
    rarity: 2,
    art:
      sky(C.blue, 0.26) +
      cloud(60, 60, 1.1) +
      cloud(220, 84, 0.8, 0.8) +
      ridge([[-10, 236], [50, 214], [110, 232], [160, 220], [220, 236], [310, 220]], C.purple, 0.22, 320) +
      ridge([[-10, 262], [40, 248], [100, 262], [150, 252], [200, 264], [260, 250], [310, 262]], C.orange, 0.32, 320) +
      roofs(96, 204, 312, C.brown, 0.3, 5) +
      // 右：岩峰（凝灰岩，有修行的洞穴）
      shape('M192 330 L198 262 C200 236 204 214 208 196 L210 150 C210 140 214 134 218 134 C222 134 224 140 224 150 L226 170 C230 158 234 148 240 146 L266 146 C276 148 282 156 288 166 L306 176 V330Z', C.grey) +
      `<path d="M192 330 L198 262 C200 236 204 214 208 196 L210 150 C210 140 214 134 218 134 C222 134 224 140 224 150 L226 170 C230 158 234 148 240 146 L266 146 C276 148 282 156 288 166 L306 176 V330Z" fill="${C.brown}" opacity=".18"/>` +
      `<path d="M266 146 C276 148 282 156 288 166 L306 176 V330 H268 C276 280 272 200 266 146Z" ${SH}/>` +
      `<g fill="${C.ink}" opacity=".34"><ellipse cx="244" cy="196" rx="6" ry="8"/><ellipse cx="262" cy="230" rx="5" ry="6"/><ellipse cx="226" cy="246" rx="4" ry="6"/><ellipse cx="284" cy="206" rx="4" ry="5"/><ellipse cx="248" cy="276" rx="5" ry="6"/></g>` +
      `<path d="M214 170 L212 230 M236 168 C232 200 236 240 232 290 M276 180 L280 260" ${line(1.2, C.ink, 0.18)}/>` +
      `<path d="M204 268 h14 M240 212 h16 M222 290 h12 M262 254 h14 M6 250 h18 M40 280 h14" ${line(2.4, C.ink, 0.14)}/>` +
      clumps([[214, 266, 6], [252, 210, 6], [270, 252, 6], [16, 248, 6], [60, 236, 5]], C.matcha) +
      hall(217, 135, 15, 12, C.red) +
      hall(254, 147, 32, 17, C.brown) +
      // 左：五大堂（懸崖上的木造舞台）
      shape('M-6 330 V206 C20 200 50 198 80 204 L86 214 C82 250 88 290 96 330Z', C.grey) +
      `<path d="M-6 330 V206 C20 200 50 198 80 204 L86 214 C82 250 88 290 96 330Z" fill="${C.brown}" opacity=".18"/>` +
      `<path d="M70 204 L80 204 L86 214 C82 250 88 290 96 330 H74 C70 280 74 240 70 204Z" ${SH}/>` +
      '<g transform="translate(6 0)">' +
      `<path d="M58 202 L58 230 M72 202 L76 232 M86 196 L90 236 M58 222 L90 214" ${line(2.4, C.brown)}/>` +
      shape('M26 196 H96 V202 H26Z', C.brown) +
      `<path d="M28 182 H94 M30 182 V196 M48 182 V196 M66 182 V196 M84 182 V196 M94 182 V196" ${line(1.8, C.brown)}/>` +
      shape('M30 182 V160 H92 V182Z', C.brown, 'opacity=".8"') +
      `<path d="M30 160 H92 V170 H30Z" ${SH}/>` +
      `<path d="M38 160 V196 M54 160 V196 M70 160 V196 M86 160 V196" ${line(2.4, C.brown)}/>` +
      shape('M20 162 Q40 160 46 146 H80 Q86 160 102 162 L98 166 H24Z', C.ink) +
      '</g>' +
      // 紅葉與杉
      firs([[104, 318, 70], [190, 320, 64], [292, 186, 40]], C.green, 0.9) +
      clumps([[96, 306, 20], [204, 296, 16], [12, 212, 18], [238, 308, 18], [208, 214, 10], [92, 252, 12], [30, 318, 16]], C.red) +
      clumps([[72, 314, 18], [222, 318, 16], [46, 206, 12], [282, 166, 14], [124, 318, 12]], C.orange) +
      clumps([[190, 318, 14], [96, 226, 12], [234, 152, 10], [280, 308, 18], [54, 300, 12]], C.yellow) +
      ground(C.grey, 320, 0.5) +
      `<path d="M0 340 H300 M0 362 H300 M0 386 H300" ${line(2, C.ink, 0.12)}/>` +
      `<path d="M0 341.5 H300 M0 363.5 H300 M0 387.5 H300" ${line(1.2, C.white, 0.4)}/>` +
      `<path d="M20 352h3M58 372h3M96 348h3M238 352h3M270 374h3M206 394h3M120 396h3M40 392h3M262 330h3M34 330h3" ${line(3, C.red, 0.8)}/>` +
      `<path d="M74 356h3M226 370h3M150 346h3M286 392h3" ${line(3, C.orange, 0.9)}/>`,
  }),
  // 羽黒山五重塔（data/spots/yamagata.json wd-Q11610424，https://ja.wikipedia.org/wiki/%E7%BE%BD%E9%BB%92%E5%B1%B1%E4%BA%94%E9%87%8D%E5%A1%94）：夏天的杉林裡，不上漆的素木五重塔，周圍的杉木大樹與石板參道
  bg({
    id: 'bg-yamagata-haguro',
    name: '羽黑山五重塔',
    pref: 'yamagata',
    rarity: 1,
    art:
      sky(C.matcha, 0.22) +
      `<rect width="300" height="400" fill="${C.green}" opacity=".12"/>` +
      trunks([[66, 8, -10, 300], [120, 7, -10, 296], [150, 6, -10, 294], [180, 7, -10, 296], [210, 6, -10, 298], [272, 9, -10, 302]], 0.35) +
      `<path d="M-10 186 C40 176 80 196 150 182 C210 170 250 192 310 180 V320 H-10Z" fill="${C.white}" opacity=".32"/>` +
      // 杉的樹梢：從上面垂下來的鋸齒狀針葉
      `<path d="M-10 -10 H310 V60 ${Array.from({ length: 16 }, (_, i) => `L${f(300 - i * 20)} ${60 + ((i * 7) % 3) * 8}L${f(290 - i * 20)} ${36 + ((i * 5) % 2) * 6}`).join('')}Z" fill="${C.green}" opacity=".75" ${E}/>` +
      `<path d="M-10 -10 H310 V22 ${Array.from({ length: 12 }, (_, i) => `L${f(297 - i * 26.6)} ${40 + ((i * 5) % 3) * 9}L${f(284 - i * 26.6)} ${16}`).join('')}Z" fill="${C.green}" ${E}/>` +
      trunks([[100, 13, 30, 312], [198, 12, 40, 312]], 0.85) +
      ridge([[-10, 316], [40, 306], [96, 312], [150, 308], [210, 312], [260, 304], [310, 312]], C.matcha, 0.8, 324) +
      haguroPagoda(234, 318, 1.38) +
      `<path d="M-30 -10 L60 -10 L170 330 L120 330Z M200 -10 L250 -10 L300 330 L270 330Z" fill="${C.white}" opacity=".12"/>` +
      trunks([[34, 34, -10, 336], [298, 26, -10, 334]]) +
      ground(C.green, 320, 0.55) +
      `<path d="M128 320 L172 320 L214 400 L86 400Z" fill="${C.grey}" opacity=".7" ${E}/>` +
      `<path d="M124 334 H176 M118 350 H182 M110 368 H190 M100 388 H200" ${line(1.4, C.ink, 0.18)}/>` +
      clumps([[16, 330, 12], [70, 326, 10], [236, 330, 12], [286, 340, 10]], C.matcha),
  }),
]

// ---------- 福島 ----------
/** 鶴之城的天守：白壁、赤瓦（紅褐色的瓦）的五層天守，下面是石垣；x 中心、y 石垣的下緣、s 大小 */
function tsurugajo(x: number, y: number, s = 1): string {
  const X = (v: number) => f(x + v * s)
  const Y = (v: number) => f(y - v * s)
  const ws = [74, 64, 54, 44, 34]
  const hs = [24, 20, 19, 17, 18]
  let wall = ''
  let sh = ''
  let win = ''
  let roof = ''
  let gab = ''
  let gabEdge = ''
  let base = 58
  for (let i = 0; i < 5; i++) {
    const w = ws[i]
    const top = base + hs[i]
    wall += `M${X(-w / 2)} ${Y(base)}V${Y(top)}H${X(w / 2)}V${Y(base)}Z`
    sh += `M${X(w * 0.3)} ${Y(base)}V${Y(top)}H${X(w / 2)}V${Y(base)}Z`
    win += `M${X(-w / 2 + 6)} ${Y(base + hs[i] * 0.48)}H${X(w / 2 - 6)}`
    const nw = i < 4 ? ws[i + 1] : 14
    const rise = i < 4 ? 6 : 13
    roof += `M${X(-w / 2 - 9)} ${Y(top - 2)}Q${X(-w / 2 - 3)} ${Y(top)} ${X(-nw / 2)} ${Y(top + rise)}H${X(nw / 2)}Q${X(w / 2 + 3)} ${Y(top)} ${X(w / 2 + 9)} ${Y(top - 2)}L${X(w / 2 + 7)} ${Y(top - 5)}H${X(-w / 2 - 7)}Z`
    // 千鳥破風（屋頂上的三角形山牆）
    const g = (cx: number, gw: number, gh: number) => {
      gab += `M${X(cx - gw)} ${Y(top + 1)}L${X(cx)} ${Y(top + gh)}L${X(cx + gw)} ${Y(top + 1)}Z`
      gabEdge += `M${X(cx - gw - 3)} ${Y(top - 1)}L${X(cx)} ${Y(top + gh + 1.5)}L${X(cx + gw + 3)} ${Y(top - 1)}`
    }
    if (i === 0) [-20, 20].forEach((c) => g(c, 10, 12))
    if (i === 1 || i === 4) g(0, i === 4 ? 9 : 11, i === 4 ? 19 : 12)
    if (i === 2) [-14, 14].forEach((c) => g(c, 8, 10))
    base = top + 5
  }
  const tile = `fill="${C.brown}" opacity=".42"`
  return (
    // 石垣：往上收的扇形坡，石的接縫用虛線
    shape(`M${X(-54)} ${Y(0)}Q${X(-45)} ${Y(28)} ${X(-42)} ${Y(58)}H${X(42)}Q${X(45)} ${Y(28)} ${X(54)} ${Y(0)}Z`, C.grey) +
    `<path d="M${X(22)} ${Y(58)}H${X(42)}Q${X(45)} ${Y(28)} ${X(54)} ${Y(0)}H${X(28)}Z" ${SH}/>` +
    `<path d="${[10, 20, 30, 40, 50].map((h) => `M${X(-53 + h * 0.2)} ${Y(h)}H${X(53 - h * 0.2)}`).join('')}" ${line(1, C.ink, 0.16)}/>` +
    `<path d="${[5, 15, 25, 35, 45, 54].map((h, k) => `M${X(-52 + h * 0.2 + (k % 2) * 4)} ${Y(h)}H${X(52 - h * 0.2)}`).join('')}" fill="none" stroke="${C.ink}" stroke-opacity=".14" stroke-width="${f(9 * s)}" stroke-dasharray="${f(1 * s)} ${f(8 * s)}"/>` +
    shape(wall, C.white) +
    `<path d="${sh}" ${SH}/>` +
    `<path d="${win}" fill="none" stroke="${C.ink}" stroke-opacity=".7" stroke-width="${f(5 * s)}" stroke-dasharray="${f(3.4 * s)} ${f(4.6 * s)}"/>` +
    shape(roof, C.red) +
    `<path d="${roof}" ${tile}/>` +
    shape(gab, C.white) +
    `<path d="${gabEdge}" ${line(f(3 * s), C.red)}/><path d="${gabEdge}" fill="none" stroke="${C.brown}" stroke-opacity=".42" stroke-width="${f(3 * s)}" stroke-linejoin="round"/>` +
    `<path d="M${X(-8)} ${Y(base + 8)}q${f(-3 * s)} ${f(-1 * s)} ${f(-3 * s)} ${f(-6 * s)}M${X(8)} ${Y(base + 8)}q${f(3 * s)} ${f(-1 * s)} ${f(3 * s)} ${f(-6 * s)}" ${line(f(2.6 * s), C.gold)}/>`
  )
}
/** 大內宿的茅草屋頂民家（面向街道的長邊）：同樣大小的幾棟 xs = [[x0, x1], …]、base 地面、rh 屋頂高度；厚厚的寄棟茅草屋頂、白牆與障子 */
function kayabuki(xs: Array<[number, number]>, base: number, rh: number): string {
  const wallH = f(rh * 0.6)
  const ey = f(base - wallH)
  const ry = f(ey - rh)
  const p = { wall: '', beam: '', shoji: '', door: '', post: '', eaveSh: '', roof: '', straw: '', roofSh: '', cut: '', ridge: '', gushi: '' }
  const w0 = xs[0][1] - xs[0][0]
  for (const [x0, x1] of xs) {
    const w = x1 - x0
    const rx0 = f(x0 + w * 0.26)
    const rx1 = f(x1 - w * 0.26)
    p.wall += `M${x0} ${base}V${ey}H${x1}V${base}Z`
    p.beam += `M${x0} ${f(base - wallH * 0.55)}H${x1}`
    p.shoji += `M${f(x0 + 4)} ${f(base - wallH * 0.26)}H${f(x1 - 4)}`
    p.door += `M${f(x0 + w * 0.42)} ${base}V${f(base - wallH * 0.5)}H${f(x0 + w * 0.58)}V${base}Z`
    p.post += `M${x0 + 1} ${base}V${ey}M${x1 - 1} ${base}V${ey}M${f(x0 + w * 0.42)} ${base}V${ey}M${f(x0 + w * 0.58)} ${base}V${ey}`
    p.eaveSh += `M${x0} ${f(ey + 6)}H${x1}V${ey}H${x0}Z`
    p.roof += `M${x0 - 10} ${f(ey + 4)}L${rx0} ${ry}H${rx1}L${x1 + 10} ${f(ey + 4)}Z`
    for (let k = 1; k < 10; k++) p.straw += `M${f(x0 - 10 + ((w + 20) * k) / 10)} ${f(ey + 1)}L${f(rx0 + ((rx1 - rx0) * k) / 10)} ${f(ry + 4)}`
    p.roofSh += `M${f(x1 - w * 0.12)} ${f(ey + 4)}L${rx1} ${ry}L${x1 + 10} ${f(ey + 4)}Z`
    p.cut += `M${x0 - 10} ${f(ey + 4)}H${x1 + 10}`
    p.ridge += `M${f(rx0 - 3)} ${f(ry + 2)}H${f(rx1 + 3)}V${f(ry - 5)}H${f(rx0 - 3)}Z`
    p.gushi += `M${rx0} ${f(ry - 2)}H${rx1}`
  }
  const sw = f(wallH * 0.44)
  return (
    // 壁：上半部白壁、柱、下半部障子與入口
    shape(p.wall, C.cream) +
    `<path d="${p.beam}" ${line(3, C.brown)}/>` +
    `<path d="${p.shoji}" fill="none" stroke="${C.white}" stroke-width="${sw}" stroke-dasharray="${f(w0 / 8 - 2)} 2"/>` +
    `<path d="${p.shoji}" fill="none" stroke="${C.ink}" stroke-opacity=".12" stroke-width="${sw}" stroke-dasharray="0.8 4"/>` +
    shape(p.door, C.brown) +
    `<path d="${p.post}" ${line(2.4, C.brown)}/>` +
    `<path d="${p.eaveSh}" ${SH}/>` +
    // 茅草屋頂：稻草的顏色、切口的亮帶、屋脊
    shape(p.roof, C.brown) +
    `<path d="${p.roof}" fill="${C.yellow}" opacity=".38"/>` +
    `<path d="${p.straw}" ${line(1, C.brown, 0.35)}/>` +
    `<path d="${p.roofSh}" ${SH}/>` +
    `<path d="${p.cut}" ${line(5, C.yellow, 0.55)}/>` +
    shape(p.ridge, C.ink, 'opacity=".75"') +
    `<path d="${p.gushi}" fill="none" stroke="${C.brown}" stroke-width="7" stroke-dasharray="2 7"/>`
  )
}

const FUKUSHIMA: Outfit[] = [
  // 若松城（data/spots/fukushima.json wd-Q1365061，https://zh.wikipedia.org/wiki/%E4%BC%9A%E6%B4%A5%E8%8B%A5%E6%9D%BE%E5%9F%8E）：櫻花季的鶴之城，白壁赤瓦的五層天守與石垣
  bg({
    id: 'bg-fukushima-tsurugajo',
    name: '會津若松城',
    pref: 'fukushima',
    rarity: 3,
    art:
      sky(C.blue, 0.24) +
      cloud(70, 70, 1.2) +
      cloud(170, 44, 0.8, 0.8) +
      ridge([[-10, 290], [60, 276], [130, 286], [200, 272], [310, 284]], C.green, 0.3, 322) +
      tsurugajo(236, 322, 0.98) +
      // 櫻
      `<path d="M58 322 C58 300 54 280 44 262 M58 300 C64 286 74 274 86 266 M52 284 C42 278 32 276 20 276" ${line(5, C.brown)}/>` +
      clumps([[38, 250, 30], [86, 246, 24], [62, 214, 30], [20, 216, 20], [104, 274, 16], [150, 302, 14], [184, 308, 18], [262, 310, 20], [292, 298, 16]], C.pink) +
      clumps([[48, 238, 14], [78, 206, 12], [96, 252, 10], [270, 302, 9], [184, 302, 8]], C.white, 0.75) +
      ground(C.cream, 320) +
      `<rect y="320" width="300" height="80" fill="${C.grey}" opacity=".22"/>` +
      `<path d="M0 334 H300" ${line(1.4, C.white, 0.6)}/>` +
      `<path d="M30 352h3M70 372h3M108 346h3M232 356h3M262 378h3M200 392h3M140 390h3M44 388h3M282 344h3M176 362h3" ${line(2.6, C.pink)}/>` +
      `<path d="M120 170l3 1M150 212l3 -1M110 120l3 1M168 150l3 1M60 140l3 -1M196 246l3 1" ${line(2.4, C.pink, 0.9)}/>`,

  }),
  // 大内宿（data/spots/fukushima.json wd-Q3594058，https://zh.wikipedia.org/wiki/%E5%A4%A7%E5%85%A7%E5%AE%BF）：夏天的會津西街道宿場，沿街的茅葺屋頂民家與門前的水路
  bg({
    id: 'bg-fukushima-ouchijuku',
    name: '大內宿',
    pref: 'fukushima',
    rarity: 2,
    art:
      sky(C.blue, 0.28) +
      cloud(64, 66, 1.2) +
      cloud(236, 40, 1, 0.85) +
      cloud(250, 124, 0.7, 0.7) +
      ridge([[-10, 168], [40, 138], [100, 158], [160, 130], [220, 150], [270, 126], [310, 144]], C.green, 0.32, 320) +
      ridge([[-10, 222], [50, 200], [120, 214], [180, 194], [240, 210], [310, 196]], C.green, 0.5, 320) +
      kayabuki([[104, 196]], 306, 60) +
      kayabuki([[-14, 100], [200, 314]], 318, 82) +
      ground(C.cream, 318) +
      `<rect y="318" width="300" height="82" fill="${C.brown}" opacity=".18"/>` +
      `<path d="M-4 328 H304" ${line(5, C.blue, 0.55)}/>` +
      `<path d="M-4 324 H304 M-4 332 H304" ${line(1.4, C.grey)}/>` +
      `<path d="M20 328h8M120 328h6M236 328h8" ${line(1.4, C.white, 0.7)}/>` +
      clumps([[12, 316, 9], [104, 314, 8], [196, 314, 8], [290, 316, 9]], C.green) +
      `<path d="M40 356h4M220 368h4M96 382h4M260 390h4M150 350h4" ${line(2.4, C.brown, 0.3)}/>`,
  }),
  // 五色沼（data/spots/fukushima.json wd-Q3214907，https://en.wikipedia.org/wiki/Goshiki-numa）：秋天的毘沙門沼，鈷藍色的湖水、岸邊的紅葉，後面是山頂崩落成火口壁的磐梯山
  bg({
    id: 'bg-fukushima-goshikinuma',
    name: '五色沼',
    pref: 'fukushima',
    rarity: 1,
    art:
      sky(C.blue, 0.24) +
      cloud(56, 54, 1.1) +
      cloud(262, 76, 0.8, 0.8) +
      // 磐梯山：右邊是山頂，左邊是櫛ヶ峰，中間是崩落後留下的火口壁
      shape('M-10 272 C20 240 40 180 62 160 L76 150 L92 168 C110 186 130 200 150 196 C170 192 188 160 204 140 L222 124 L236 120 L248 132 C266 158 288 190 310 214 V272Z', C.purple, 'opacity=".34"') +
      `<path d="M92 168 C110 186 130 200 150 196 C170 192 188 160 204 140 L212 150 C198 176 192 214 184 244 L172 236 L160 250 L146 238 L132 252 L118 240 L104 248 C102 220 100 190 92 168Z" fill="${C.brown}" opacity=".3"/>` +
      `<path d="M120 200 L116 236 M140 204 L138 240 M162 198 L160 238 M186 180 L180 226 M104 186 L106 222" ${line(1.4, C.ink, 0.15)}/>` +
      `<path d="M236 120 L248 132 C266 158 288 190 310 214 V272 H262 C272 220 256 160 236 120Z" ${SH}/>` +
      ridge([[-10, 252], [40, 236], [90, 250], [150, 246], [210, 252], [260, 234], [310, 242]], C.orange, 0.28, 272) +
      `<path d="M-10 272 ${Array.from({ length: 27 }, (_, i) => `q6 ${-10 - ((i * 7) % 4) * 3} 12 0`).join('')}V272Z" fill="${C.orange}" opacity=".5" ${E}/>` +
      `<path d="M-10 274 ${Array.from({ length: 23 }, (_, i) => `q7 ${-8 - ((i * 5) % 3) * 4} 14 0`).join('')}V274Z" fill="${C.red}" opacity=".35"/>` +
      // 湖面：鈷藍
      `<rect y="270" width="300" height="56" fill="${C.blue}" opacity=".9" ${E}/>` +
      `<rect y="270" width="300" height="56" fill="${C.green}" opacity=".3"/>` +
      `<path d="M0 304 C60 300 100 308 150 304 S250 300 300 306 V326 H0Z" fill="${C.green}" opacity=".25"/>` +
      ripples([[30, 284], [96, 292], [200, 286], [262, 296], [130, 312], [234, 314], [60, 316]], 16, 0.45) +
      // 岸邊的紅葉與針葉樹
      firs([[16, 296, 66], [246, 300, 56], [290, 296, 72]], C.green, 0.95) +
      `<path d="M58 326 C58 300 52 286 42 272 M58 300 C64 290 74 282 84 278" ${line(4, C.brown)}/>` +
      clumps([[40, 262, 24], [76, 270, 20], [100, 312, 14], [228, 312, 16], [270, 300, 18]], C.red) +
      clumps([[58, 238, 22], [10, 300, 18], [204, 316, 12], [276, 270, 14]], C.orange) +
      clumps([[90, 248, 14], [30, 314, 12], [250, 314, 14], [298, 318, 12]], C.yellow) +
      ground(C.brown, 324, 0.3) +
      `<path d="M0 326 Q150 320 300 326" ${line(2, C.white, 0.5)}/>` +
      `<path d="M30 350h3M74 370h3M118 344h3M210 360h3M250 380h3M180 392h3M136 386h3M48 390h3M276 346h3" ${line(3, C.red, 0.85)}/>` +
      `<path d="M92 360h3M232 348h3M160 372h3M20 372h3M286 372h3" ${line(3, C.yellow)}/>`,
  }),
]

export const BG: Outfit[] = [...AKITA, ...YAMAGATA, ...FUKUSHIMA]
