import type { Outfit } from '../outfits'
import { bg, C, cedar, cloud, E, ground, line, ridge, roofs, SH, sky, tree } from './kit'

/**
 * 地區背景：四國（徳島、香川、愛媛、高知）。題材取自 data/spots 的景點與 data/festivals 的祭典，
 * 出處是那筆資料的 summary.source_url（沒有就 sources[0].url），寫在每張上面一行的註解。
 */

type Pt = [number, number]
type Pt3 = [number, number, number]
const r1 = (v: number) => +v.toFixed(1)
const P = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')
/** 同一色的幾塊紙：共用填色與淡邊（字數少） */
const G = (fill: string, ds: string[], op = 1) => `<g fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''} ${E}>${ds.map((d) => `<path d="${d}"/>`).join('')}</g>`
/** 陰影：幾塊併成一條 path */
const shade = (ds: string[]) => `<path d="${ds.join('')}" ${SH}/>`
/** 一團圓：樹冠、紅葉、花、石頭（每個點 [x, y, r]） */
const blobs = (pts: Pt3[], fill: string, op = 1) =>
  `<g fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''} ${E}>${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`
/** 水面的波光、地面的紋：短的橫線併成一條 path */
const rip = (pts: Pt[], w = 14, op = 0.55, c: string = C.white, sw = 1.6) => `<path d="${pts.map(([x, y]) => `M${r1(x - w / 2)} ${y}h${w}`).join('')}" ${line(sw, c, op)}/>`
/** 地面上緣的一條淡影（同 kanto 的範例） */
const EDGE = `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".08" ${E}/>`
/** 一層樹林的邊緣：沿著一串點用圓弧連（往外鼓），底部封到 base；用來疊山坡上的紅葉、樹林 */
function canopy(pts: Pt[], fill: string, op = 1, base = 324, k = 0.62): string {
  let d = `M${r1(pts[0][0])} ${base}L${r1(pts[0][0])} ${r1(pts[0][1])}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x, y] = pts[i]
    const rr = r1(Math.hypot(x - x0, y - y0) * k)
    d += `A${rr} ${rr} 0 0 1 ${r1(x)} ${r1(y)}`
  }
  return `<path d="${d}L${r1(pts[pts.length - 1][0])} ${base}Z" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''} ${E}/>`
}
/** 從 a 到 b 均分 n 段的點（中間的點上下錯開 j，讓樹林的邊有高有低） */
const slope = (a: Pt, b: Pt, nSeg: number, j = 5): Pt[] =>
  Array.from({ length: nSeg + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / nSeg, a[1] + ((b[1] - a[1]) * i) / nSeg + (i % 2 && i < nSeg ? -j : 0)] as Pt)
/** 一片平的松葉（下緣平、上緣起伏） */
const pinePad = (cx: number, cy: number, w: number) => {
  const h = w * 0.44
  return `M${r1(cx - w)} ${r1(cy)}Q${r1(cx - w * 0.9)} ${r1(cy - h)} ${r1(cx - w * 0.4)} ${r1(cy - h * 1.1)}Q${r1(cx)} ${r1(cy - h * 1.7)} ${r1(cx + w * 0.4)} ${r1(cy - h * 1.1)}Q${r1(cx + w)} ${r1(cy - h)} ${r1(cx + w)} ${r1(cy)}Z`
}
/** 黑松：彎的樹幹（根 x,y → 梢 top）＋幾片平的松葉（[dx, dy, 半寬]，相對樹根） */
function pine(x: number, y: number, top: Pt, pads: Pt3[], s = 1): string {
  const [tx, ty] = [x + top[0], y + top[1]]
  const mx = r1((x + tx) / 2 + 12 * s)
  const my = r1((y + ty) / 2)
  const br = pads.map(([dx, dy]) => `M${r1(x + dx)} ${r1(y + dy)}L${r1(x + (dx + top[0]) * 0.5)} ${r1(y + dy * 0.85)}`).join('')
  return (
    `<path d="${br}" ${line(2.6 * s, C.brown)}/>` +
    G(C.brown, [`M${x - 5 * s} ${y}Q${mx - 4 * s} ${my} ${tx - 1.5 * s} ${ty}L${tx + 1.5 * s} ${ty}Q${mx + 4 * s} ${my} ${x + 5 * s} ${y}Z`]) +
    G(C.green, pads.map(([dx, dy, w]) => pinePad(x + dx, y + dy, w))) +
    shade(pads.map(([dx, dy, w]) => `M${r1(x + dx - w)} ${r1(y + dy)}h${r1(2 * w)}l${r1(-w * 0.2)} ${r1(-w * 0.18)}h${r1(-1.6 * w)}Z`))
  )
}
/** 岩石：一塊多邊形＋第 2–4 點那一側的暗面 */
const rocks = (list: Pt[][], fill: string = C.grey) => G(fill, list.map((p) => `${P(p)}Z`)) + shade(list.map((p) => `${P([p[1], p[2], p[3]])}Z`))

// ---------- 徳島 ----------
/** 渦：外圈白浪、中間凹下去的深色、螺旋的白線（k 是壓扁的高度比） */
function swirl(cx: number, cy: number, r: number, turns = 2.4): string {
  const k = 0.3
  let d = ''
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    const a = t * turns * Math.PI * 2
    const rr = r * (1 - t * 0.88)
    d += `${i ? 'L' : 'M'}${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * k * Math.sin(a))}`
  }
  return (
    `<ellipse cx="${cx}" cy="${cy}" rx="${r1(r * 1.12)}" ry="${r1(r * k * 1.15)}" fill="${C.white}" opacity=".45"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r1(r * k)}" fill="${C.navy}" opacity=".22"/>` +
    `<ellipse cx="${cx}" cy="${r1(cy + 0.6)}" rx="${r1(r * 0.42)}" ry="${r1(r * k * 0.42)}" fill="${C.navy}" opacity=".3"/>` +
    `<path d="${d}" ${line(1.5, C.white, 0.85)}/>`
  )
}
/** 吊橋的塔：兩根柱子＋三道橫梁＋海裡的橋墩 */
function bridgeTower(x: number, top: number, base: number): string {
  const legs = [x - 5, x + 5].map((a) => `M${a - 3} ${base}L${a - 2} ${top}h4.4L${a + 3.4} ${base}Z`).join('')
  const beams = [top + 2, top + 40, top + 82].map((y) => `M${x - 8} ${y}h16v5h-16Z`).join('')
  return G(C.grey, [legs + beams, `M${x - 13} ${base}h26v14h-26Z`]) + shade([`M${x + 6} ${base}L${x + 6.6} ${top}h.8L${x + 8.4} ${base}Z`, `M${x + 5} ${base}h8v14h-8Z`])
}
/** 大鳴門橋：兩座塔、主纜、吊索、加勁桁（桁裡是三角形的格子） */
function onaruto(xa: number, xb: number, top: number, deck: number): string {
  const cy = 2 * (deck - 6) - top
  const cable = (x: number) => {
    const t = (x - xa) / (xb - xa)
    return (1 - t) * (1 - t) * top + 2 * (1 - t) * t * cy + t * t * top
  }
  let hang = ''
  for (let x = xa + 10; x < xb - 4; x += 10) hang += `M${x} ${r1(cable(x))}V${deck}`
  let truss = `M-6 ${deck + 1}`
  for (let x = -6; x < 306; x += 12) truss += `L${x + 6} ${deck + 11}L${x + 12} ${deck + 1}`
  return (
    bridgeTower(xa, top, 282) +
    bridgeTower(xb, top, 282) +
    `<path d="${hang}" ${line(0.8, C.navy, 0.35)}/>` +
    `<path d="M${xa} ${top + 2}Q${(xa + xb) / 2} ${cy} ${xb} ${top + 2}M${xa} ${top + 2}Q${xa - 40} ${top + 50} -6 ${deck - 4}M${xb} ${top + 2}Q${xb + 40} ${top + 50} 306 ${deck - 4}" ${line(2.2, C.navy, 0.55)}/>` +
    G(C.grey, [`M-6 ${deck}H306v12H-6Z`]) +
    `<path d="${truss}" ${line(1, C.white, 0.6)}/>` +
    `<rect x="-6" y="${deck + 9}" width="312" height="3" ${SH}/>`
  )
}
/** 觀潮船：白色船身、藍色的線、船艙、船尾的白浪 */
const boat = (x: number, y: number) =>
  G(C.white, [`M${x - 22} ${y - 6}h46l-6 9h-36Z`, `M${x - 10} ${y - 6}l2 -8h18l2 8Z`]) +
  `<path d="M${x - 21} ${y - 2}h42" ${line(1.6, C.blue)}/><path d="M${x - 6} ${y - 11}h14" ${line(2, C.navy, 0.5)}/>` +
  `<path d="M${x + 20} ${y + 1}Q${x + 30} ${y + 2} ${x + 40} ${y}M${x - 20} ${y + 1}Q${x - 30} ${y + 3} ${x - 38} ${y + 1}" ${line(1.4, C.white, 0.8)}/>`

/** 蔓橋：扶手的藤、橋面的木板（側面看是一排短木頭）、扶手和橋面之間的網；扶手和橋面都是拋物線 */
function kazurabashi(xa: number, ya: number, xb: number, yb: number, sag: number): string {
  const mx = (xa + xb) / 2
  const rail = (x: number, dy = 0, sg = sag) => {
    const t = (x - xa) / (xb - xa)
    return ya + (yb - ya) * t + 4 * sg * t * (1 - t) + dy
  }
  const curve = (dy: number, sg: number) => `M${xa} ${ya + dy}Q${mx} ${r1((ya + yb) / 2 + dy + 2 * sg)} ${xb} ${yb + dy}`
  const deckD = curve(30, sag + 6)
  let net = ''
  for (let x = xa; x < xb - 6; x += 14) net += `M${x} ${r1(rail(x))}L${x + 14} ${r1(rail(x + 14, 30, sag + 6))}M${x + 14} ${r1(rail(x + 14))}L${x} ${r1(rail(x, 30, sag + 6))}`
  return (
    `<path d="${net}" ${line(1, C.brown, 0.75)}/>` +
    `<path d="${curve(0, sag)}" ${line(3, C.brown)}/>` +
    `<path d="${deckD}" ${line(6, C.brown)}/>` +
    `<path d="${deckD}" fill="none" stroke="${C.cream}" stroke-width="5" stroke-dasharray="1.2 3.4" stroke-opacity=".55"/>` +
    `<path d="${curve(33, sag + 6)}" ${line(1.4, C.ink, 0.2)}/>`
  )
}
/** 阿波舞的女踊り：編笠、浴衣、高舉的雙手。畫在原點（腳底），用 transform 放到 x,y、縮放 s、f = -1 左右翻；c 浴衣、obi 腰帶 */
const odoriko = (x: number, y: number, s: number, c: string, obi: string, f = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s * f} ${s})">` +
  `<path d="M-7 -60L-16 -84L-12 -96M7 -60L15 -86L20 -96" ${line(3, C.cream)}/>` +
  `<path d="M-3 -14L-4 -2M4 -14L6 -3" ${line(2.6, C.white)}/><path d="M-6 -1h5M4 -2h5" ${line(2.2, C.ink, 0.8)}/>` +
  G(c, ['M-8 -62L-17 -84L-24 -66L-16 -56ZM8 -62L16 -86L24 -70L16 -56ZM-9 -64H9L12 -14H-11Z']) +
  shade(['M2 -64H9L12 -14H4Z']) +
  `<path d="M-2 -64L3 -46M-6 -30H8M-6 -22H9" ${line(1, C.white, 0.6)}/>` +
  G(obi, ['M-10 -48H10V-40H-10Z']) +
  `<circle cy="-70" r="5" fill="${C.cream}"/>` +
  G(C.gold, ['M-15 -70C-14 -84 -6 -91 1 -91C8 -91 15 -84 16 -70Q1 -76 -15 -70Z']) +
  `<path d="M-10 -78Q1 -83 11 -78" ${line(0.9, C.brown, 0.55)}/></g>`
/** 男踊り：法被、頭上的手拭、蹲低、一手舉高一手拿團扇（畫法同 odoriko） */
const otokoOdori = (x: number, y: number, s: number, c: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M-6 -30L-14 -14L-12 -1M6 -30L14 -14L13 -1" ${line(5, C.white)}/><path d="M-15 -1h6M10 -1h6" ${line(2.4, C.ink, 0.8)}/>` +
  `<path d="M-7 -56L-18 -70L-14 -82M7 -56L18 -46L24 -52" ${line(3, C.cream)}/>` +
  G(c, ['M-10 -60H10L12 -30H-12Z']) +
  `<path d="M0 -60V-30" ${line(1.6, C.white, 0.7)}/>` +
  G(C.navy, ['M-12 -36H12V-32H-12Z']) +
  `<circle cy="-67" r="6" fill="${C.cream}"/><path d="M-6.5 -70Q0 -76 6.5 -70" ${line(2.6, C.white)}/>` +
  `<circle cx="27" cy="-56" r="6" fill="${C.white}" ${E}/></g>`
/** 一串提燈：電線垂下來，燈籠紅白交錯 */
function lanternRow(y0: number, sag: number, step: number, s = 1): string {
  const lan: [string, string] = ['', '']
  let caps = ''
  const w = r1(12 * s)
  const h = r1(13 * s)
  const c = r1(8 * s)
  for (let x = -4, i = 0; x < 306; x += step, i++) {
    const t = (x + 4) / 310
    const y = y0 + 4 * sag * t * (1 - t)
    lan[i % 2] += `<rect x="${r1(x - 6 * s)}" y="${r1(y + 2.5 * s)}" width="${w}" height="${h}" rx="${r1(5 * s)}"/>`
    caps += `M${r1(x - 4 * s)} ${r1(y + 2.5 * s)}h${c}M${r1(x - 4 * s)} ${r1(y + 15.5 * s)}h${c}`
  }
  const wire = `M-6 ${y0}Q150 ${y0 + 2 * sag} 306 ${y0}`
  return (
    `<path d="${wire}" ${line(0.8, C.ink, 0.6)}/>` +
    `<g fill="${C.red}" ${E}>${lan[0]}</g><g fill="${C.white}" ${E}>${lan[1]}</g>` +
    `<path d="${caps}" ${line(2 * s, C.ink, 0.8)}/>`
  )
}
/** 飄落的紅葉：小的菱形 */
const leaves = (pts: Pt[], fill: string) => `<path d="${pts.map(([x, y]) => `M${x} ${y}l4 -3 3 4 -4 3Z`).join('')}" fill="${fill}" opacity=".85"/>`

const TOKUSHIMA: Outfit[] = [
  // 鳴門の渦潮（data/spots/tokushima.json wd-Q1350120，https://zh.wikipedia.org/wiki/%E9%B3%B4%E9%96%80%E6%BC%A9%E6%B8%A6）：鳴門海峽的漩渦、上面的大鳴門橋、觀潮船，對岸的淡路島，岸邊的岩石
  bg({
    id: 'bg-tokushima-naruto',
    name: '鳴門漩渦',
    pref: 'tokushima',
    rarity: 2,
    art:
      sky() +
      cloud(150, 50, 1.1) +
      cloud(254, 30, 0.8, 0.8) +
      cloud(40, 150, 0.6, 0.7) +
      ridge([[140, 238], [190, 220], [236, 212], [280, 220], [306, 228]], C.green, 0.32, 240) +
      ridge([[-6, 232], [24, 222], [60, 230], [84, 238]], C.green, 0.28, 240) +
      `<rect y="236" width="300" height="86" fill="${C.blue}" opacity=".52"/>` +
      `<rect y="236" width="300" height="9" fill="${C.white}" opacity=".25"/>` +
      rip([[30, 252], [118, 248], [262, 250], [196, 258], [86, 268], [150, 282], [20, 290]], 16, 0.5) +
      onaruto(70, 236, 104, 200) +
      `<path d="M48 286Q70 280 92 286M214 286Q236 280 258 286M8 300Q24 296 38 300M102 296Q118 292 134 296M262 312Q280 308 298 312M178 290Q194 286 208 290" ${line(1.6, C.white, 0.7)}/>` +
      boat(270, 266) +
      swirl(226, 304, 38) +
      swirl(72, 306, 26, 2.1) +
      rocks([[[-6, 322], [-6, 296], [12, 290], [26, 304], [36, 322]]], C.brown) +
      rocks([[[262, 322], [274, 304], [290, 298], [306, 302], [306, 322]]], C.brown) +
      `<path d="M30 320Q60 314 92 320M210 320Q236 314 262 320" ${line(2, C.white, 0.75)}/>` +
      ground(C.grey, 320, 0.48) +
      rocks([
        [[-6, 400], [-6, 344], [22, 336], [52, 352], [64, 400]],
        [[236, 400], [252, 356], [282, 346], [306, 352], [306, 400]],
      ]) +
      rip([[100, 340], [204, 336], [120, 370], [192, 388]], 40, 0.45, C.white, 1.3) +
      EDGE,
  }),
  // かずら橋（data/spots/tokushima.json wd-Q11263836，https://zh.wikipedia.org/wiki/%E8%94%93%E6%A9%8B）：秋天的祖谷溪，藤蔓編的吊橋掛在兩岸的紅葉與杉林之間，下面是碧綠的祖谷川
  bg({
    id: 'bg-tokushima-kazurabashi',
    name: '祖谷蔓橋',
    pref: 'tokushima',
    rarity: 1,
    art:
      sky(C.blue, 0.18) +
      cloud(222, 58, 1, 0.85) +
      cloud(70, 92, 0.7, 0.7) +
      ridge([[-6, 150], [50, 116], [118, 142], [180, 104], [246, 132], [306, 112]], C.navy, 0.14, 330) +
      ridge([[-6, 186], [60, 160], [130, 184], [196, 150], [262, 176], [306, 160]], C.green, 0.3, 330) +
      canopy(slope([84, 252], [220, 250], 8, 6), C.orange, 0.35) +
      canopy(slope([-6, 128], [128, 322], 9, 4), C.matcha) +
      canopy(slope([306, 118], [172, 322], 9, 4).reverse(), C.green) +
      cedar(20, 172, 0.8, C.green) +
      cedar(40, 186, 0.6, C.green) +
      cedar(276, 162, 0.8, C.matcha) +
      cedar(256, 180, 0.6, C.matcha) +
      canopy(slope([-6, 166], [104, 322], 8, 5), C.orange) +
      canopy(slope([306, 160], [198, 322], 8, 5).reverse(), C.yellow) +
      canopy(slope([-6, 236], [74, 322], 6, 4), C.red) +
      canopy(slope([306, 222], [226, 322], 6, 4).reverse(), C.orange) +
      `<path d="M92 300C120 306 180 306 208 300L216 322H84Z" fill="${C.green}" opacity=".6"/>` +
      `<path d="M92 300C120 306 180 306 208 300L216 322H84Z" fill="${C.blue}" opacity=".3"/>` +
      kazurabashi(26, 204, 274, 198, 22) +
      `<path d="M16 207L32 202M268 200L284 196" ${line(7, C.brown)}/>` +
      ground(C.grey, 320, 0.42) +
      `<path d="M168 320H306V380Q250 356 214 340Q190 330 168 320Z" fill="${C.green}" opacity=".55" ${E}/>` +
      `<path d="M168 320H306V380Q250 356 214 340Q190 330 168 320Z" fill="${C.blue}" opacity=".3"/>` +
      rip([[230, 330], [262, 342], [286, 356], [204, 324]], 14, 0.6) +
      rocks([
        [[-6, 338], [-4, 324], [12, 318], [30, 324], [34, 338]],
        [[38, 340], [42, 332], [52, 330], [58, 340]],
        [[100, 388], [104, 380], [116, 378], [122, 388]],
      ]) +
      rip([[28, 350], [110, 374], [50, 391]], 56, 0.45, C.white, 1.3) +
      EDGE +
      leaves([[70, 120], [236, 98], [40, 364], [140, 392]], C.red) +
      leaves([[252, 132], [250, 372], [96, 80]], C.orange),
  }),
  // 阿波踊り（data/festivals/tokushima.json tokushima-Q1185363，https://zh.wikipedia.org/wiki/%E9%98%BF%E6%B3%A2%E8%88%9E）：夏夜的街上掛滿提燈，戴編笠的女踊り與拿團扇的男踊り，後面是眉山的稜線
  bg({
    id: 'bg-tokushima-awaodori',
    name: '阿波舞',
    pref: 'tokushima',
    rarity: 3,
    art:
      sky(C.navy, 0.72, C.cream) +
      `<g fill="${C.white}" opacity=".55"><circle cx="40" cy="30" r="1.2"/><circle cx="96" cy="58" r="1"/><circle cx="168" cy="22" r="1.3"/><circle cx="236" cy="70" r="1"/><circle cx="276" cy="34" r="1.2"/><circle cx="20" cy="96" r="1"/></g>` +
      ridge([[-6, 238], [40, 220], [110, 206], [180, 208], [240, 220], [306, 236]], C.navy, 0.5, 330) +
      roofs(-4, 304, 300, C.navy, 0.5, 7) +
      `<path d="M8 286h6v5h-6ZM40 282h6v5h-6ZM72 288h5v5h-5ZM226 284h6v5h-6ZM258 288h5v5h-5ZM286 282h6v5h-6Z" fill="${C.yellow}" opacity=".65"/>` +
      `<rect y="294" width="300" height="28" fill="${C.brown}" opacity=".24"/>` +
      lanternRow(156, 16, 22, 0.8) +
      lanternRow(108, 22, 27) +
      odoriko(38, 320, 0.9, C.blue, C.yellow) +
      odoriko(78, 322, 0.96, C.pink, C.red, -1) +
      odoriko(224, 322, 0.96, C.purple, C.yellow) +
      otokoOdori(264, 320, 1, C.blue) +
      ground(C.grey, 320, 0.55) +
      `<rect y="320" width="300" height="80" fill="${C.navy}" opacity=".22"/>` +
      `<ellipse cx="150" cy="338" rx="150" ry="16" fill="${C.cream}" opacity=".18"/>` +
      `<path d="M0 346H300M0 372H300" ${line(1.2, C.white, 0.22)}/>` +
      EDGE,
  }),
]

// ---------- 香川 ----------
/** 石燈籠：台座、竿、火袋（中間一格暗的窗）、笠、寶珠。畫在原點（腳底），transform 放到 x,y、縮放 s */
const ishidoro = (x: number, y: number, s: number, fill: string = C.grey) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  G(fill, ['M-10 0H10V-5H-10Z', 'M-3.5 -5H3.5V-30H-3.5Z', 'M-9 -30H9V-35H-9Z', 'M-7 -35H7V-48H-7Z', 'M-14 -48Q-8 -50 -6 -56H6Q8 -50 14 -48Z', 'M-2.5 -56A3 3 0 1 1 2.5 -56Z']) +
  `<path d="M-3 -37h6v-9h-6Z" fill="${C.ink}" opacity=".45"/>` +
  shade(['M2 -5H10V0H2Z', 'M1 -5H3.5V-30H1Z', 'M3 -35H7V-48H3Z']) +
  `</g>`
/** 偃月橋：平緩的木造拱橋（橋身、扶手、欄杆柱），水裡的倒影合起來像半個月亮 */
function engetsukyo(x0: number, x1: number, y: number, rise: number): string {
  const m = (x0 + x1) / 2
  const q = y - rise * 2
  let posts = ''
  for (let x = x0 + 8; x < x1 - 4; x += 8) {
    const t = (x - x0) / (x1 - x0)
    const d = y - 4 * rise * t * (1 - t)
    posts += `M${x} ${r1(d)}V${r1(d - 9)}`
  }
  return (
    `<path d="M${x0 + 4} ${y + 4}Q${m} ${y + 4 + rise * 2} ${x1 - 4} ${y + 4}Z" fill="${C.brown}" opacity=".28"/>` +
    G(C.brown, [`M${x0} ${y}Q${m} ${q} ${x1} ${y}L${x1 - 4} ${y + 4}Q${m} ${q + 10} ${x0 + 4} ${y + 4}Z`]) +
    `<path d="M${x0 + 4} ${y + 4}Q${m} ${q + 10} ${x1 - 4} ${y + 4}" ${line(1.4, C.ink, 0.25)}/>` +
    `<path d="${posts}" ${line(1.4, C.brown)}/>` +
    `<path d="M${x0 + 2} ${y - 9}Q${m} ${q - 9} ${x1 - 2} ${y - 9}" ${line(2.4, C.brown)}/>` +
    `<path d="M${x0 + 2} ${y - 1}Q${m} ${q - 1} ${x1 - 2} ${y - 1}" ${line(1, C.cream, 0.6)}/>`
  )
}
/** 掬月亭：水邊的數寄屋，白色障子、深色的格子，兩層屋頂，下面是立在池裡的柱子 */
function kikugetsutei(x0: number, x1: number, y: number): string {
  const w = x1 - x0
  let frames = ''
  for (let x = x0 + 10; x < x1 - 4; x += 10) frames += `M${x} ${y - 22}V${y}`
  let stilts = ''
  for (let x = x0 + 6; x < x1; x += 14) stilts += `M${x} ${y + 3}V${y + 12}`
  const u0 = x0 + w * 0.22
  const u1 = x1 - w * 0.24
  return (
    `<rect x="${x0}" y="${y + 12}" width="${w}" height="12" fill="${C.ink}" opacity=".1"/>` +
    `<path d="${stilts}" ${line(2.4, C.brown)}/>` +
    G(C.brown, [`M${x0 - 4} ${y}H${x1 + 4}v4H${x0 - 4}Z`]) +
    G(C.white, [`M${x0} ${y}V${y - 24}H${x1}V${y}Z`, `M${u0 + 4} ${y - 40}V${y - 52}H${u1 - 4}V${y - 40}Z`]) +
    `<path d="${frames}M${x0} ${y - 17}H${x1}" ${line(1.1, C.brown, 0.7)}/>` +
    `<path d="M${u0 + 12} ${y - 52}V${y - 40}M${u0 + 24} ${y - 52}V${y - 40}M${u1 - 16} ${y - 52}V${y - 40}" ${line(1.1, C.brown, 0.7)}/>` +
    G(C.ink, [
      `M${x0 - 12} ${y - 22}Q${x0 - 4} ${y - 25} ${x0 + 4} ${y - 34}L${x0 + 14} ${y - 40}H${x1 - 14}L${x1 - 4} ${y - 34}Q${x1 + 4} ${y - 25} ${x1 + 12} ${y - 22}Z`,
      `M${u0 - 6} ${y - 50}Q${u0} ${y - 52} ${u0 + 4} ${y - 58}L${u0 + 10} ${y - 64}H${u1 - 10}L${u1 - 4} ${y - 58}Q${u1} ${y - 52} ${u1 + 6} ${y - 50}Z`,
    ]) +
    `<path d="M${x0 - 10} ${y - 23}Q${x0 - 3} ${y - 26} ${x0 + 5} ${y - 34}M${u0 - 4} ${y - 51}Q${u0 + 1} ${y - 53} ${u0 + 5} ${y - 58}" ${line(1, C.white, 0.35)}/>`
  )
}
/** 金刀比羅宮的大門：二層的入母屋造，下層中間是門洞，前面是往上收窄的石階，兩旁石燈籠 */
function daimon(x: number, y: number): string {
  let steps = ''
  for (let i = 1; i <= 12; i++) {
    const t = (i / 12) ** 1.35
    const yy = r1(y + (322 - y) * t)
    const half = r1(18 + 44 * t)
    steps += `M${r1(x - half)} ${yy}H${r1(x + half)}`
  }
  return (
    G(C.grey, [`M${x - 18} ${y}H${x + 18}L${x + 62} 322H${x - 62}Z`]) +
    `<path d="M${x - 18} ${y}H${x + 18}L${x + 62} 322H${x - 62}Z" fill="${C.white}" opacity=".35"/>` +
    `<path d="${steps}" ${line(1.4, C.white, 0.7)}/>` +
    `<path d="${steps}" transform="translate(0 2)" ${line(1, C.ink, 0.15)}/>` +
    G(C.white, [`M${x - 26} ${y}V${y - 34}H${x + 26}V${y}Z`, `M${x - 17} ${y - 46}V${y - 62}H${x + 17}V${y - 46}Z`]) +
    `<path d="M${x - 8} ${y}V${y - 24}H${x + 8}V${y}Z" fill="${C.ink}" opacity=".6"/>` +
    `<path d="M${x - 26} ${y - 34}H${x + 26}M${x - 17} ${y - 34}V${y}M${x + 17} ${y - 34}V${y}M${x - 17} ${y - 62}H${x + 17}M${x - 6} ${y - 62}V${y - 46}M${x + 6} ${y - 62}V${y - 46}" ${line(2.4, C.brown)}/>` +
    G(C.ink, [
      `M${x - 40} ${y - 32}Q${x - 32} ${y - 35} ${x - 26} ${y - 42}L${x - 20} ${y - 46}H${x + 20}L${x + 26} ${y - 42}Q${x + 32} ${y - 35} ${x + 40} ${y - 32}Z`,
      `M${x - 34} ${y - 60}Q${x - 26} ${y - 63} ${x - 20} ${y - 72}L${x - 12} ${y - 80}H${x + 12}L${x + 20} ${y - 72}Q${x + 26} ${y - 63} ${x + 34} ${y - 60}Z`,
    ]) +
    `<path d="M${x - 12} ${y - 80}H${x + 12}M${x - 38} ${y - 33}Q${x - 31} ${y - 36} ${x - 25} ${y - 43}M${x - 32} ${y - 61}Q${x - 25} ${y - 64} ${x - 19} ${y - 73}" ${line(1, C.white, 0.35)}/>`
  )
}

const KAGAWA: Outfit[] = [
  // 栗林公園（data/spots/kagawa.json wd-Q1071520，https://zh.wikipedia.org/wiki/%E6%A0%97%E6%9E%97%E5%85%AC%E5%9C%92）：初夏的南湖，左邊是偃月橋、右邊是水邊的掬月亭，後面是紫雲山，岸上的黑松與修剪成圓形的杜鵑
  bg({
    id: 'bg-kagawa-ritsurin',
    name: '栗林公園',
    pref: 'kagawa',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(56, 74, 1.1) +
      cloud(238, 46, 0.9, 0.85) +
      canopy(slope([-6, 186], [306, 176], 16, 8).map(([x, y]) => [x, y - 56 * Math.sin((Math.PI * (x + 6)) / 312)] as Pt), C.green, 0.5, 330) +
      canopy(slope([-6, 226], [306, 222], 16, 6), C.matcha, 0.7, 330) +
      canopy(slope([-6, 244], [306, 240], 18, 6), C.green, 0.9, 330) +
      pine(70, 264, [-26, -46], [[-30, -48, 22], [-6, -32, 17], [-50, -30, 14], [-20, -68, 14]], 1.5) +
      pine(234, 264, [24, -46], [[30, -48, 22], [8, -32, 17], [50, -30, 14], [20, -68, 14]], 1.5) +
      `<rect y="258" width="300" height="64" fill="${C.blue}" opacity=".42"/>` +
      `<rect y="258" width="300" height="12" fill="${C.green}" opacity=".18"/>` +
      rip([[140, 280], [36, 312], [172, 300], [124, 316], [286, 306]], 16, 0.55) +
      kikugetsutei(196, 268, 290) +
      engetsukyo(12, 108, 292, 16) +
      ground(C.cream, 320) +
      `<rect y="320" width="300" height="80" fill="${C.grey}" opacity=".22"/>` +
      `<path d="M0 320Q150 314 300 320" ${line(2, C.white, 0.8)}/>` +
      canopy([[-14, 344], [36, 344]], C.green, 1, 344, 0.56) +
      canopy([[20, 344], [56, 344]], C.matcha, 1, 344, 0.56) +
      canopy([[244, 344], [280, 344]], C.matcha, 1, 344, 0.56) +
      canopy([[264, 344], [314, 344]], C.green, 1, 344, 0.56) +
      blobs([[2, 326, 3], [14, 324, 2.6], [22, 332, 2.4], [-2, 334, 2.6], [10, 336, 2.4], [280, 326, 2.6], [292, 324, 3], [286, 334, 2.4], [300, 332, 2.4]], C.pink) +
      ishidoro(62, 334, 0.55) +
      rip([[96, 346], [210, 344], [70, 368], [236, 372], [150, 392]], 44, 0.5, C.white, 1.2) +
      EDGE,
  }),
  // 金刀比羅宮（data/spots/kagawa.json wd-Q94760，https://zh.wikipedia.org/wiki/%E9%87%91%E5%88%80%E6%AF%94%E7%BE%85%E5%AE%AE）：秋天的象頭山，參道的石階往上通到大門，兩旁一排石燈籠
  bg({
    id: 'bg-kagawa-kotohiragu',
    name: '金刀比羅宮',
    pref: 'kagawa',
    rarity: 3,
    art:
      sky(C.blue, 0.18) +
      cloud(232, 62, 1, 0.85) +
      ridge([[-6, 210], [40, 150], [110, 112], [180, 106], [236, 128], [306, 170]], C.green, 0.4, 330) +
      canopy(slope([-6, 200], [306, 214], 12, 8), C.matcha, 0.8, 330) +
      cedar(176, 214, 1, C.green) +
      cedar(196, 204, 1.2, C.green) +
      cedar(286, 206, 1, C.green) +
      canopy(slope([140, 262], [306, 236], 8, 9), C.orange) +
      canopy(slope([-6, 252], [130, 270], 7, 8), C.orange) +
      tree(244, 318, 2.1, C.red) +
      tree(290, 314, 1.5, C.orange) +
      tree(206, 318, 1.3, C.yellow) +
      daimon(56, 214) +
      ishidoro(30, 236, 0.32) +
      ishidoro(82, 236, 0.32) +
      ishidoro(20, 262, 0.45) +
      ishidoro(92, 262, 0.45) +
      ishidoro(214, 330, 0.8) +
      ishidoro(262, 330, 0.8) +
      ground(C.grey, 320, 0.42) +
      `<path d="M0 340H300M0 364H300M0 390H300" ${line(1.4, C.white, 0.45)}/>` +
      `<path d="M150 320L120 400M150 320L180 400" ${line(1.2, C.white, 0.35)}/>` +
      EDGE +
      leaves([[120, 96], [36, 150], [262, 160], [64, 360], [230, 380]], C.red) +
      leaves([[178, 130], [110, 386], [280, 352]], C.orange),
  }),
  // 父母ヶ浜（data/spots/kagawa.json wd-Q60997790，https://en.wikipedia.org/wiki/Chichibugahama_Beach）：退潮後的沙灘留下一片片潮池，像鏡子一樣映著夕陽與晚霞，海上是燧灘的小島
  bg({
    id: 'bg-kagawa-chichibugahama',
    name: '父母濱',
    pref: 'kagawa',
    rarity: 1,
    art:
      sky(C.purple, 0.16, C.cream) +
      `<path d="M0 104Q80 98 150 106T300 102V240H0Z" fill="${C.pink}" opacity=".3"/>` +
      `<path d="M0 168Q70 162 150 170T300 166V240H0Z" fill="${C.orange}" opacity=".26"/>` +
      `<path d="M0 206Q80 202 150 208T300 204V240H0Z" fill="${C.yellow}" opacity=".3"/>` +
      cloud(64, 96, 1.4, 0.55, C.pink) +
      cloud(236, 70, 1, 0.5, C.white) +
      cloud(260, 168, 0.8, 0.45, C.pink) +
      `<circle cx="222" cy="232" r="17" fill="${C.yellow}" opacity=".9"/>` +
      ridge([[16, 238], [34, 228], [58, 232], [80, 238]], C.navy, 0.3, 239) +
      ridge([[124, 238], [140, 232], [156, 238]], C.navy, 0.25, 239) +
      `<rect y="236" width="300" height="34" fill="${C.blue}" opacity=".26"/><rect y="236" width="300" height="34" fill="${C.purple}" opacity=".1"/>` +
      `<path d="M206 242h32M210 250h24M214 258h16M218 265h8" ${line(2, C.yellow, 0.8)}/>` +
      `<path d="M-6 270H306V322H-6Z" fill="${C.yellow}" opacity=".2"/><path d="M-6 270H306V322H-6Z" fill="${C.brown}" opacity=".12"/>` +
      `<path d="M-6 276Q60 272 120 278T306 276V290Q240 294 160 290T-6 292Z" fill="${C.orange}" opacity=".35"/>` +
      `<path d="M30 298Q90 294 140 300T300 300V312Q220 316 150 312T30 310Z" fill="${C.pink}" opacity=".35"/>` +
      `<path d="M212 278h20M214 284h16M208 302h28M212 308h20" ${line(2, C.yellow, 0.7)}/>` +
      ground(C.yellow, 320, 0.22) +
      `<rect y="320" width="300" height="80" fill="${C.brown}" opacity=".14"/>` +
      `<path d="M-6 330Q40 324 96 332Q120 336 112 352Q100 370 40 368Q-6 366 -6 350Z" fill="${C.orange}" opacity=".38"/>` +
      `<path d="M196 330Q250 322 306 328V376Q260 384 222 372Q186 360 196 330Z" fill="${C.orange}" opacity=".38"/>` +
      `<path d="M200 334Q240 328 290 334V346Q250 350 206 344Z" fill="${C.purple}" opacity=".18"/>` +
      `<g transform="translate(0 700) scale(1 -1)">${cloud(54, 350, 1, 0.45, C.pink)}</g>` +
      `<path d="M212 338h22M206 348h34M214 358h18M220 366h8" ${line(2.2, C.yellow, 0.75)}/>` +
      `<path d="M20 344h30M60 356h24" ${line(1.6, C.white, 0.5)}/>` +
      `<path d="M0 386Q30 382 60 386T120 386M150 394Q190 390 230 394T300 392M120 356Q140 352 160 356" ${line(1.2, C.brown, 0.3)}/>` +
      `<path d="M96 150l6 4 6 -4M116 136l5 3 5 -3" ${line(1.4, C.ink, 0.5)}/>` +
      EDGE,
  }),
]

// ---------- 愛媛 ----------
/** 入母屋的屋頂（正面）：屋簷兩端微微翹起；x0–x1 是屋簷的寬、y 屋簷、h 屋頂高、k 兩端收進來的量 */
const roofD = (x0: number, x1: number, y: number, h: number, k = 12) =>
  `M${r1(x0)} ${r1(y)}Q${r1(x0 + k * 0.6)} ${r1(y - 2)} ${r1(x0 + k)} ${r1(y - h * 0.4)}L${r1(x0 + k * 1.7)} ${r1(y - h)}H${r1(x1 - k * 1.7)}L${r1(x1 - k)} ${r1(y - h * 0.4)}Q${r1(x1 - k * 0.6)} ${r1(y - 2)} ${r1(x1)} ${r1(y)}Z`
/** 唐破風：中間鼓起、兩端往下彎的弓形屋頂 */
const karahafuD = (cx: number, y: number, w: number, h: number) =>
  `M${r1(cx - w)} ${r1(y)}Q${r1(cx - w * 0.62)} ${r1(y - h * 0.1)} ${r1(cx - w * 0.5)} ${r1(y - h * 0.55)}Q${r1(cx)} ${r1(y - h * 1.5)} ${r1(cx + w * 0.5)} ${r1(y - h * 0.55)}Q${r1(cx + w * 0.62)} ${r1(y - h * 0.1)} ${r1(cx + w)} ${r1(y)}Z`
/** 千鳥破風：三角形的山牆（白色的牆面＋深色的屋頂邊） */
const chidori = (cx: number, y: number, w: number, h: number) =>
  G(C.ink, [`M${cx - w} ${y}L${cx} ${y - h}L${cx + w} ${y}Z`]) + G(C.white, [`M${cx - w + 5} ${y}L${cx} ${y - h + 5}L${cx + w - 5} ${y}Z`])
/** 一排亮著的障子：x0–x1、y0–y1，每 d 一格 */
function shoji(x0: number, x1: number, y0: number, y1: number, d = 8, glow: string = C.yellow): string {
  let bars = ''
  for (let x = x0 + d; x < x1 - 1; x += d) bars += `M${x} ${y0}V${y1}`
  return `<path d="M${x0} ${y0}H${x1}V${y1}H${x0}Z" fill="${glow}" opacity=".85"/><path d="${bars}M${x0} ${r1((y0 + y1) / 2)}H${x1}" ${line(1, C.brown, 0.7)}/>`
}
/** 道後溫泉本館：木造三層的神之湯本館，屋頂上是振鷺閣（紅色玻璃的小樓，頂上一隻白鷺），左邊是較低的兩層側棟；夜裡障子都亮著 */
function dogo(): string {
  const wood = (ds: string[]) => G(C.brown, ds)
  return (
    // 左邊的側棟
    wood(['M-6 318V282H104V318Z', 'M6 276V252H92V276Z']) +
    shoji(2, 98, 290, 308, 8) +
    shoji(12, 86, 256, 272, 7) +
    G(C.ink, [roofD(-16, 114, 284, 10, 10), roofD(-4, 102, 254, 20, 12)]) +
    chidori(48, 240, 18, 14) +
    // 中間的連接處（大多被旅人擋住）
    wood(['M100 318V286H190V318Z']) +
    shoji(104, 186, 292, 310, 8) +
    G(C.ink, [roofD(94, 196, 288, 9, 8)]) +
    // 神之湯本館：三層
    wood(['M176 318V280H306V318Z', 'M186 272V244H294V272Z', 'M202 236V212H272V236Z']) +
    shoji(180, 306, 286, 308, 9) +
    shoji(190, 290, 248, 266, 8) +
    shoji(206, 268, 216, 232, 7) +
    `<path d="M186 268H294M202 232H272" ${line(1.6, C.red, 0.9)}/>` +
    G(C.ink, [roofD(166, 312, 282, 10, 10), roofD(178, 302, 246, 10, 10), roofD(190, 284, 214, 16, 12)]) +
    G(C.ink, [karahafuD(212, 284, 22, 18)]) +
    `<path d="M196 284V318H228V284" fill="${C.yellow}" opacity=".5"/>` +
    // 振鷺閣：紅玻璃的方形小樓、寶形造的小屋頂、白鷺
    wood(['M226 200V182H248V200Z']) +
    `<path d="M228 184h18v14h-18Z" fill="${C.red}" opacity=".9"/><path d="M233 184v14M237 184v14M241 184v14M228 191h18" ${line(1, C.yellow, 0.9)}/>` +
    G(C.ink, [`M220 184L237 168L254 184Z`, roofD(220, 254, 202, 4, 4)]) +
    G(C.white, ['M234 168Q236 160 240 158L244 156L241 160Q240 166 238 168Z', 'M236 162Q230 160 228 163L235 165Z'])
  )
}
/** 天守：從下往上一層層（每層 [寬, 牆高, 破風：0 無、1 千鳥、2 唐]），每層上面一圈屋簷；dark 是牆下半的黑色下見板 */
function tenshu(x: number, y: number, tiers: Pt3[], dark = false): string {
  let out = ''
  let base = y
  tiers.forEach(([w, h, hafu], i) => {
    const top = base - h
    const last = i === tiers.length - 1
    let win = ''
    for (let wx = x - w / 2 + 6; wx < x + w / 2 - 6; wx += 9) win += `M${r1(wx)} ${r1(top + h * 0.3)}h4v${r1(h * 0.24)}h-4Z`
    out += G(C.white, [`M${r1(x - w / 2)} ${base}V${top}H${r1(x + w / 2)}V${base}Z`])
    if (dark) out += `<path d="M${r1(x - w / 2)} ${base}V${r1(base - h * 0.42)}H${r1(x + w / 2)}V${base}Z" fill="${C.ink}" opacity=".85"/>`
    out += `<path d="${win}" fill="${C.ink}" opacity=".7"/>`
    out += shade([`M${r1(x + w / 2 - 6)} ${base}V${top}H${r1(x + w / 2)}V${base}Z`])
    const ov = 6 + w * 0.12
    out += G(C.ink, [roofD(x - w / 2 - ov, x + w / 2 + ov, top + 1, last ? 18 : 8, last ? 10 : ov * 0.9)])
    if (hafu === 1) out += chidori(x, top - 3, 12, 11)
    if (hafu === 2) out += G(C.ink, [karahafuD(x, top + 1, 12, 9)])
    if (last) out += `<g fill="${C.gold}"><circle cx="${r1(x - w / 2 + 4)}" cy="${top - 18}" r="1.8"/><circle cx="${r1(x + w / 2 - 4)}" cy="${top - 18}" r="1.8"/></g>`
    base = top - 6
  })
  return out
}
/** 石垣：下寬上窄、兩側往內彎（扇の勾配），一排排的石縫 */
function ishigaki(x0: number, x1: number, top: number, base: number, curve = 14): string {
  let rows = ''
  for (let yy = top + 9; yy < base; yy += 9) rows += `M${r1(x0 - curve * ((yy - top) / (base - top)) ** 2)} ${yy}H${r1(x1 + curve * ((yy - top) / (base - top)) ** 2)}`
  return (
    G(C.grey, [`M${x0} ${top}H${x1}Q${x1 + curve * 0.2} ${r1((top + base) / 2)} ${x1 + curve} ${base}H${x0 - curve}Q${x0 - curve * 0.2} ${r1((top + base) / 2)} ${x0} ${top}Z`]) +
    `<path d="${rows}" ${line(1, C.white, 0.5)}/>` +
    shade([`M${x1 - 10} ${top}H${x1}Q${x1 + curve * 0.2} ${r1((top + base) / 2)} ${x1 + curve} ${base}H${x1 - 10}Z`])
  )
}
/** 吊橋（遠景的剪影）：兩座塔之間一條主纜，塔高 h */
function farBridge(xa: number, xb: number, deck: (x: number) => number, ha: number, hb: number, hangStep = 0, c: string = C.navy, op = 0.7): string {
  const ya = deck(xa) - ha
  const yb = deck(xb) - hb
  const mid = (xa + xb) / 2
  const cy = 2 * (deck(mid) - 2) - (ya + yb) / 2
  const cab = (x: number) => {
    const t = (x - xa) / (xb - xa)
    return (1 - t) * (1 - t) * ya + 2 * (1 - t) * t * cy + t * t * yb
  }
  let hang = ''
  if (hangStep) for (let x = xa + hangStep; x < xb - 2; x += hangStep) hang += `M${x} ${r1(cab(x))}V${r1(deck(x))}`
  const tw = r1(1.6 + hb * 0.04)
  return (
    `<g opacity="${op}"><path d="M${xa} ${r1(deck(xa) + 2)}V${r1(ya)}M${xb} ${r1(deck(xb) + 2)}V${r1(yb)}" ${line(tw * 1.6, c)}/>` +
    `<path d="M${xa} ${r1(ya)}Q${mid} ${r1(cy)} ${xb} ${r1(yb)}M${xa} ${r1(ya)}L${r1(xa - (xb - xa) * 0.3)} ${r1(deck(xa - (xb - xa) * 0.3))}M${xb} ${r1(yb)}L${r1(xb + (xb - xa) * 0.3)} ${r1(deck(xb + (xb - xa) * 0.3))}" ${line(tw * 0.6, c)}/>` +
    (hang ? `<path d="${hang}" ${line(0.6, c, 0.7)}/>` : '') +
    `</g>`
  )
}
/** 來島海峽大橋的橋面：從左邊遠處斜斜地往右下靠近 */
const deckK = (x: number) => 235 + (x + 6) * 0.142

const EHIME: Outfit[] = [
  // 道後温泉本館（data/spots/ehime.json wd-Q11641713，https://zh.wikipedia.org/wiki/%E9%81%93%E5%BE%8C%E6%BA%AB%E6%B3%89%E6%9C%AC%E9%A4%A8）：夜裡亮著燈的木造三層浴場，屋頂上紅玻璃的振鷺閣與白鷺，正面的唐破風玄關
  bg({
    id: 'bg-ehime-dogo-onsen',
    name: '道後溫泉本館',
    pref: 'ehime',
    rarity: 3,
    art:
      sky(C.navy, 0.72, C.cream) +
      `<path d="M58 54A16 16 0 1 0 74 74A13 13 0 1 1 58 54Z" fill="${C.yellow}" opacity=".85"/>` +
      `<g fill="${C.white}" opacity=".55"><circle cx="128" cy="34" r="1.2"/><circle cx="196" cy="62" r="1"/><circle cx="262" cy="28" r="1.3"/><circle cx="24" cy="120" r="1"/><circle cx="282" cy="112" r="1"/><circle cx="160" cy="90" r="1"/></g>` +
      ridge([[-6, 226], [60, 204], [130, 214], [200, 196], [260, 210], [306, 204]], C.navy, 0.4, 330) +
      dogo() +
      `<path d="M-6 312H306V320H-6Z" fill="${C.grey}" opacity=".9" ${E}/>` +
      ground(C.grey, 320, 0.5) +
      `<rect y="320" width="300" height="80" fill="${C.navy}" opacity=".28"/>` +
      `<path d="M-6 323H110L96 332H-6ZM170 323H306V334H186Z" fill="${C.yellow}" opacity=".32"/>` +
      `<path d="M0 346H300M0 370H300M0 394H300" ${line(1.2, C.white, 0.22)}/>` +
      EDGE,
  }),
  // 松山城（data/spots/ehime.json wd-Q981357，https://zh.wikipedia.org/wiki/%E6%9D%BE%E5%B1%B1%E5%9F%8E_%28%E4%BC%8A%E4%BA%88%E5%9B%BD%29）：春天勝山山頂的本丸，高高的石垣上是三層的大天守與小天守、渡櫓，前面盛開的櫻花
  bg({
    id: 'bg-ehime-matsuyama-castle',
    name: '松山城',
    pref: 'ehime',
    rarity: 2,
    art:
      sky(C.blue, 0.22) +
      cloud(70, 70, 1.1) +
      cloud(170, 36, 0.8, 0.8) +
      ridge([[-6, 262], [50, 248], [110, 256], [170, 244], [230, 252], [306, 246]], C.blue, 0.22, 330) +
      roofs(-4, 160, 300, C.grey, 0.3, 5) +
      ishigaki(196, 306, 238, 322, 14) +
      G(C.white, ['M270 238V228H290V238Z']) +
      G(C.ink, [roofD(266, 294, 230, 6, 6)]) +
      tenshu(296, 238, [[30, 16, 0], [22, 12, 0]], true) +
      tenshu(238, 238, [[52, 22, 1], [42, 18, 2], [32, 16, 0]], true) +
      tree(50, 322, 2.5, C.pink) +
      tree(14, 300, 1.4, C.pink) +
      tree(118, 316, 1.6, C.pink) +
      tree(290, 334, 1.3, C.pink) +
      blobs([[34, 240, 2.4], [58, 230, 2], [70, 252, 2.2], [42, 262, 2], [22, 250, 1.8], [62, 270, 2], [8, 272, 1.6], [290, 300, 2], [282, 312, 1.8]], C.white, 0.75) +
      ground(C.cream, 320) +
      `<rect y="320" width="300" height="80" fill="${C.brown}" opacity=".16"/>` +
      `<ellipse cx="52" cy="326" rx="44" ry="5" fill="${C.ink}" opacity=".08"/>` +
      rip([[100, 344], [214, 340], [64, 370], [236, 374], [150, 392]], 44, 0.5, C.white, 1.2) +
      EDGE +
      `<g fill="${C.pink}" opacity=".9"><ellipse cx="120" cy="120" rx="2.4" ry="1.5"/><ellipse cx="210" cy="96" rx="2.4" ry="1.5"/><ellipse cx="86" cy="190" rx="2.4" ry="1.5"/><ellipse cx="160" cy="360" rx="2.4" ry="1.5"/><ellipse cx="60" cy="382" rx="2.4" ry="1.5"/><ellipse cx="262" cy="356" rx="2.4" ry="1.5"/></g>`,
  }),
  // 来島海峡大橋（data/spots/ehime.json wd-Q2740666，https://zh.wikipedia.org/wiki/%E4%BE%86%E5%B3%B6%E6%B5%B7%E5%B3%BD%E5%A4%A7%E6%A9%8B）：從大島的龜老山往下看，三座吊橋接連跨過來島海峽與島嶼，傍晚的天空與海
  bg({
    id: 'bg-ehime-kurushima',
    name: '來島海峽大橋',
    pref: 'ehime',
    rarity: 1,
    art:
      sky(C.blue, 0.3) +
      `<path d="M0 104Q80 96 150 104T300 100V240H0Z" fill="${C.purple}" opacity=".16"/>` +
      `<path d="M0 156Q70 150 150 158T300 154V240H0Z" fill="${C.pink}" opacity=".24"/>` +
      `<path d="M0 190Q80 186 150 192T300 188V240H0Z" fill="${C.orange}" opacity=".26"/>` +
      `<path d="M0 208Q80 205 150 210T300 206V240H0Z" fill="${C.yellow}" opacity=".3"/>` +
      cloud(226, 78, 1.3, 0.6, C.pink) +
      cloud(58, 128, 0.9, 0.5, C.white) +
      `<circle cx="62" cy="210" r="13" fill="${C.yellow}" opacity=".9"/>` +
      ridge([[-6, 216], [40, 206], [100, 214], [170, 200], [240, 210], [306, 204]], C.purple, 0.32, 224) +
      `<rect y="220" width="300" height="102" fill="${C.blue}" opacity=".24"/><rect y="220" width="300" height="102" fill="${C.orange}" opacity=".12"/>` +
      `<path d="M50 226h24M54 233h16M58 240h8" ${line(2, C.yellow, 0.85)}/>` +
      ridge([[170, 226], [220, 214], [268, 218], [306, 224]], C.navy, 0.3, 230) +
      ridge([[106, 256], [134, 242], [172, 242], [200, 256]], C.navy, 0.4, 262) +
      ridge([[-6, 252], [12, 244], [34, 250]], C.navy, 0.4, 256) +
      ridge([[200, 294], [226, 278], [258, 280], [282, 296]], C.navy, 0.42, 300) +
      `<path d="M200 296Q240 290 282 296" ${line(1.6, C.white, 0.6)}/>` +
      G(C.navy, ['M-6 234L306 278V284L-6 237Z'], 0.62) +
      farBridge(10, 54, deckK, 16, 20, 0) +
      farBridge(92, 200, deckK, 28, 42, 0) +
      farBridge(226, 290, deckK, 54, 68, 6) +
      rip([[120, 276], [40, 284], [176, 300], [80, 306]], 18, 0.45, C.yellow) +
      canopy(slope([-6, 284], [84, 324], 5, 5), C.green) +
      canopy(slope([306, 290], [250, 324], 4, 5).reverse(), C.green) +
      ground(C.matcha, 320, 0.6) +
      `<rect y="320" width="300" height="80" fill="${C.navy}" opacity=".14"/>` +
      `<path d="M-6 306H306M-6 316H306" ${line(2.2, C.brown)}/>` +
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${i * 24 - 2} 302V322`).join('')}" ${line(3, C.brown)}/>` +
      `<path d="M10 344l4 -6M40 358l3 -6M250 350l4 -6M280 368l3 -6M120 384l3 -6M200 392l4 -6" ${line(1.4, C.green, 0.8)}/>` +
      EDGE,
  }),
]

// ---------- 高知 ----------
/** 追手門：兩側的石垣中間是厚重的木門，上面橫跨一座白牆的櫓（入母屋的屋頂） */
function otemon(x: number, y: number): string {
  let studs = ''
  for (let i = 0; i < 4; i++) studs += `M${x - 13} ${y - 36 + i * 9}h0M${x - 5} ${y - 36 + i * 9}h0M${x + 5} ${y - 36 + i * 9}h0M${x + 13} ${y - 36 + i * 9}h0`
  let win = ''
  for (const wx of [x - 38, x - 20, x + 12, x + 30]) win += `M${wx} ${y - 76}h8v10h-8Z`
  return (
    ishigaki(x - 46, x - 20, y - 52, y, 6) +
    ishigaki(x + 20, x + 46, y - 52, y, 6) +
    G(C.brown, [`M${x - 20} ${y}V${y - 46}H${x + 20}V${y}Z`]) +
    `<path d="M${x} ${y}V${y - 46}M${x - 20} ${y - 46}H${x + 20}" ${line(1.6, C.ink, 0.5)}/><path d="${studs}" ${line(2.4, C.ink, 0.55)}/>` +
    G(C.white, [`M${x - 50} ${y - 52}V${y - 84}H${x + 50}V${y - 52}Z`]) +
    `<path d="M${x - 50} ${y - 52}V${y - 60}H${x + 50}V${y - 52}Z" fill="${C.ink}" opacity=".8"/>` +
    `<path d="${win}" fill="${C.ink}" opacity=".7"/>` +
    shade([`M${x + 42} ${y - 52}V${y - 84}H${x + 50}V${y - 52}Z`]) +
    G(C.ink, [roofD(x - 62, x + 62, y - 82, 20, 14)]) +
    `<path d="M${x - 40} ${y - 102}H${x + 40}" ${line(1, C.white, 0.35)}/>`
  )
}
/** 燈塔：白色細長的塔身、上面一圈走廊、燈室與圓頂 */
const lighthouse = (x: number, y: number, h: number) =>
  G(C.white, [`M${x - 8} ${y}L${x - 5} ${y - h}H${x + 5}L${x + 8} ${y}Z`, `M${x - 9} ${y - h}h18v-4h-18Z`]) +
  shade([`M${x + 3} ${y}L${x + 2} ${y - h}H${x + 5}L${x + 8} ${y}Z`]) +
  `<path d="M${x - 5} ${y - h - 4}h10v-11h-10Z" fill="${C.yellow}" opacity=".8" ${E}/>` +
  `<path d="M${x - 2} ${y - h - 4}v-11M${x + 2} ${y - h - 4}v-11" ${line(0.8, C.ink, 0.5)}/>` +
  G(C.grey, [`M${x - 7} ${y - h - 15}Q${x} ${y - h - 26} ${x + 7} ${y - h - 15}Z`]) +
  `<path d="M${x} ${y - h - 21}v-5" ${line(1.4, C.ink, 0.7)}/>`
/** 小小的神社（龍王岬上的海津見神社）：朱色的社殿＋深色屋頂 */
const hokora = (x: number, y: number) =>
  G(C.red, [`M${x - 7} ${y}V${y - 9}H${x + 7}V${y}Z`]) + G(C.ink, [`M${x - 11} ${y - 8}Q${x - 6} ${y - 10} ${x - 4} ${y - 15}H${x + 4}Q${x + 6} ${y - 10} ${x + 11} ${y - 8}Z`])
/** 椿：深綠的樹叢上開著紅花（花是小圓，中間一點黃） */
function tsubaki(masses: Pt[][], flowers: Pt[]): string {
  return (
    masses.map((m) => canopy(m, C.green)).join('') +
    `<g fill="${C.red}">${flowers.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g>` +
    `<g fill="${C.yellow}">${flowers.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9"/>`).join('')}</g>`
  )
}

const KOCHI: Outfit[] = [
  // 高知城（data/spots/kochi.json wd-Q1012815，https://zh.wikipedia.org/wiki/%E9%AB%98%E7%9F%A5%E5%9F%8E）：夏天，前面是追手門的櫓門與石垣，後面大高坂山上是四重的天守，最上層一圈廻緣高欄
  bg({
    id: 'bg-kochi-kochi-castle',
    name: '高知城',
    pref: 'kochi',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(58, 168, 1.5) +
      cloud(92, 150, 1, 0.95) +
      cloud(244, 52, 0.9, 0.85) +
      canopy(slope([140, 300], [306, 236], 8, 8), C.green, 0.75) +
      ishigaki(212, 264, 240, 262, 8) +
      tenshu(238, 240, [[56, 22, 2], [46, 18, 1], [38, 16, 1], [28, 16, 0]]) +
      `<path d="M220 160H256M220 155H256M222 160V155M228 160V155M234 160V155M240 160V155M246 160V155M252 160V155" ${line(1.2, C.ink, 0.85)}/>` +
      canopy(slope([150, 316], [306, 262], 9, 7), C.green) +
      canopy(slope([-6, 280], [130, 296], 6, 6), C.matcha) +
      tree(286, 322, 1.7, C.green) +
      tree(200, 322, 1.4, C.matcha) +
      otemon(54, 322) +
      ground(C.grey, 320, 0.42) +
      `<path d="M0 340H300M0 364H300M0 390H300" ${line(1.4, C.white, 0.45)}/>` +
      `<path d="M54 322L20 400M54 322L96 400" ${line(1.2, C.white, 0.35)}/>` +
      EDGE,
  }),
  // 桂浜（data/spots/kochi.json wd-Q11536831，https://zh.wikipedia.org/wiki/%E6%A1%82%E6%BF%B1）：天剛暗的海邊，滿月從太平洋上升起，右邊是龍王岬的岩石、松樹與小神社，弧形的沙灘與浪
  bg({
    id: 'bg-kochi-katsurahama',
    name: '桂濱',
    pref: 'kochi',
    rarity: 2,
    art:
      sky(C.blue, 0.42) +
      `<path d="M0 170Q80 164 150 172T300 168V240H0Z" fill="${C.purple}" opacity=".2"/>` +
      `<path d="M0 210Q80 206 150 212T300 208V240H0Z" fill="${C.pink}" opacity=".24"/>` +
      `<g fill="${C.white}" opacity=".6"><circle cx="150" cy="40" r="1.2"/><circle cx="220" cy="70" r="1"/><circle cx="270" cy="30" r="1.3"/><circle cx="24" cy="60" r="1"/><circle cx="180" cy="120" r="1"/></g>` +
      `<circle cx="66" cy="150" r="27" fill="${C.white}" opacity=".22"/>` +
      `<circle cx="66" cy="150" r="17" fill="${C.cream}" ${E}/>` +
      `<path d="M58 146a3 3 0 1 0 1 0ZM70 156a2 2 0 1 0 1 0Z" fill="${C.yellow}" opacity=".4"/>` +
      `<rect y="232" width="300" height="90" fill="${C.navy}" opacity=".38"/><rect y="232" width="300" height="90" fill="${C.blue}" opacity=".18"/>` +
      `<path d="M52 238h28M56 246h20M50 256h32M58 266h16M54 278h24" ${line(2, C.cream, 0.75)}/>` +
      ridge([[-6, 240], [20, 234], [52, 242]], C.navy, 0.45, 244) +
      rocks([
        [[186, 310], [196, 262], [214, 246], [236, 240], [266, 240], [290, 236], [306, 246], [306, 310]],
      ], C.brown) +
      `<path d="M196 262L214 268L236 262L250 272L270 264L290 270L306 266" ${line(1.2, C.ink, 0.2)}/>` +
      pine(232, 242, [-6, -38], [[-12, -40, 15], [6, -30, 12], [-22, -26, 10]], 1.1) +
      pine(292, 238, [-8, -44], [[-14, -46, 14], [2, -34, 11]], 1.1) +
      hokora(262, 240) +
      `<path d="M140 302Q160 296 186 300M186 310Q240 304 306 312" ${line(2.2, C.white, 0.8)}/>` +
      `<path d="M-6 300Q80 286 170 306L172 322H-6Z" fill="${C.grey}" opacity=".5"/>` +
      `<path d="M-6 298Q80 284 168 304M-6 290Q60 280 120 290" ${line(2, C.white, 0.75)}/>` +
      ground(C.brown, 320, 0.3) +
      `<rect y="306" width="300" height="94" fill="${C.navy}" opacity=".14"/>` +
      `<g opacity=".8">${[[20, 340, C.red], [40, 352, C.yellow], [64, 336, C.white], [92, 380, C.grey], [210, 346, C.white], [236, 360, C.red], [262, 338, C.yellow], [280, 372, C.grey], [120, 392, C.white], [184, 384, C.navy], [16, 376, C.navy], [250, 392, C.white]].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2" fill="${c}"/>`).join('')}</g>` +
      `<path d="M0 360Q40 356 80 360M200 370Q240 366 290 370" ${line(1.2, C.white, 0.35)}/>` +
      EDGE,
  }),
  // 足摺岬（data/spots/kochi.json wd-Q11636890，https://zh.wikipedia.org/wiki/%E8%B6%B3%E6%91%BA%E5%B2%AC）：冬天，太平洋上的斷崖，常綠樹林裡白色的足摺岬燈塔，步道兩旁開著紅色的椿花
  bg({
    id: 'bg-kochi-ashizuri',
    name: '足摺岬',
    pref: 'kochi',
    rarity: 1,
    art:
      sky(C.blue, 0.24) +
      cloud(64, 70, 1.1) +
      cloud(200, 40, 0.8, 0.85) +
      `<rect y="204" width="300" height="118" fill="${C.blue}" opacity=".62"/><rect y="204" width="300" height="10" fill="${C.white}" opacity=".3"/>` +
      `<rect y="250" width="300" height="72" fill="${C.navy}" opacity=".12"/>` +
      ridge([[-6, 212], [24, 204], [56, 210], [80, 222], [96, 236]], C.navy, 0.3, 240) +
      `<path d="M-6 240Q50 234 100 240" ${line(1.6, C.white, 0.7)}/>` +
      rip([[120, 222], [160, 234], [100, 250], [44, 262], [140, 270], [80, 286], [30, 300]], 16, 0.5) +
      rocks([[[176, 322], [184, 290], [200, 270], [214, 262], [306, 256], [306, 322]]], C.brown) +
      `<path d="M168 318Q180 306 190 300M184 296Q196 286 206 282" ${line(2, C.white, 0.75)}/>` +
      canopy(slope([206, 264], [306, 246], 6, 6), C.green) +
      lighthouse(240, 256, 92) +
      canopy(slope([196, 296], [306, 270], 6, 6), C.green) +
      tsubaki(
        [slope([-6, 274], [84, 324], 5, 6), slope([306, 282], [244, 324], 4, 6).reverse()],
        [[2, 284], [16, 290], [10, 302], [30, 300], [24, 312], [44, 308], [56, 316], [40, 318], [70, 318], [296, 292], [282, 300], [272, 306], [292, 310], [262, 314], [280, 318]],
      ) +
      ground(C.brown, 320, 0.28) +
      `<rect y="320" width="300" height="80" fill="${C.green}" opacity=".12"/>` +
      `<path d="M150 320L110 400M150 320L190 400" ${line(1.4, C.white, 0.4)}/>` +
      `<g fill="${C.red}" opacity=".9"><circle cx="40" cy="352" r="2.4"/><circle cx="72" cy="380" r="2.4"/><circle cx="238" cy="362" r="2.4"/><circle cx="262" cy="388" r="2.4"/></g>` +
      `<path d="M120 150l6 4 6 -4M140 164l5 3 5 -3" ${line(1.4, C.ink, 0.5)}/>` +
      EDGE,
  }),
]

export const BG: Outfit[] = [...TOKUSHIMA, ...KAGAWA, ...EHIME, ...KOCHI]
