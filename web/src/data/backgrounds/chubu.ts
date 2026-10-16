import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, ripples, roofs, SH, shape, sky, sun } from './kit'

/**
 * 地區背景：新潟、富山、石川、福井。題材取自 data/spots 的景點與 data/festivals 的祭典，出處是那筆資料的 summary.source_url。
 */

const f = (v: number) => +v.toFixed(1)
type P = [number, number]
/** 折線封口的 path d */
const poly = (p: P[]) => 'M' + p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z'
/** 一組圓：[x, y, r]（不描邊，光點、花瓣、雪） */
const dots = (list: number[][], fill: string, op = 1) =>
  `<g fill="${fill}" opacity="${op}">` + list.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`).join('') + '</g>'
/** 一團圓鼓鼓的形狀（樹冠、櫻花、雲海）的 d：橢圓周上 k 個點，用外凸的圓弧連起來 */
function blobD(cx: number, cy: number, rx: number, ry: number, k = 8, seed = 0): string {
  let d = ''
  const ch = (Math.PI * (rx + ry)) / k
  for (let i = 0; i <= k; i++) {
    const t = (i / k) * Math.PI * 2 + seed
    const x = Math.round(cx + Math.cos(t) * rx)
    const y = Math.round(cy + Math.sin(t) * ry)
    d += i ? `A${Math.round(ch * (0.6 + 0.1 * ((i * 7 + Math.round(seed * 10)) % 3)) + 0.5)} ${Math.round(ch * 0.62 + 0.5)} 0 0 1 ${x} ${y}` : `M${x} ${y}`
  }
  return d + 'Z'
}
/** 同一個顏色的幾團 blob 合成一個 path：[cx, cy, rx, ry, k?, seed?] */
const blobs = (fill: string, op: number, list: number[][]) =>
  `<path d="${list.map(([cx, cy, rx, ry, k = 8, sd = 0]) => blobD(cx, cy, rx, ry, k, sd)).join('')}" fill="${fill}" opacity="${op}" ${E}/>`
/** 夜：整張疊一層深藍 */
const night = (op = 0.72) => sky(C.navy, op, C.cream)

// ---------- 新潟 ----------
/** 花火：x, y 中心、r 半徑、c1 光線、c2 光點、k 條。光線是一圈粗的虛線（每一小段就是一條放射的光），光點是圓頭的零長虛線 */
function hanabi(x: number, y: number, r: number, c1: string, c2: string, k = 28): string {
  const ring = (rr: number, w: number, c: string, dash: number, n: number, op = 1) =>
    `<circle cx="${x}" cy="${y}" r="${f(rr)}" fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-dasharray="${dash} ${f((2 * Math.PI * rr) / n - dash)}" stroke-opacity="${op}"${dash ? '' : ' stroke-linecap="round"'}/>`
  return (
    `<circle cx="${x}" cy="${y}" r="${f(r * 1.1)}" fill="${c1}" opacity=".07"/>` +
    ring(r * 0.6, r * 0.56, c1, 1, k, 0.75) +
    (r > 25 ? ring(r * 0.3, r * 0.22, c2, 0.8, k / 2, 0.55) + ring(r * 0.64, r / 24, C.white, 0, k / 2, 0.8) : '') +
    ring(r, r / 15, c2, 0, k)
  )
}
/** 長岡のフェニックス：河川敷から横に長く並んで開く扇形の花火（高低交互） */
function phoenix(y: number): string {
  const arcs = (R: number, odd: number) => {
    let d = ''
    for (let i = odd; i < 10; i += 2) {
      const x = 4 + i * 32
      const p = (t: number) => `${f(x + Math.cos(Math.PI * t) * R)} ${f(y + Math.sin(Math.PI * t) * R)}`
      d += `M${p(1.12)}A${R} ${R} 0 0 1 ${p(1.88)}`
    }
    return d
  }
  const fan = (R: number, odd: number) =>
    `<path d="${arcs(R / 2 + 1.5, odd)}" fill="none" stroke="${C.yellow}" stroke-width="${R - 3}" stroke-dasharray="1 ${f(R / 6)}" stroke-opacity=".8"/>` +
    `<path d="${arcs(R + 2, odd)}" ${line(2.4, C.white)} stroke-dasharray="0 ${f(((R + 2) / (R / 2 + 1.5)) * (1 + R / 6))}"/>`
  return `<rect y="${y - 36}" width="300" height="38" fill="${C.yellow}" opacity=".12"/>` + fan(40, 0) + fan(30, 1)
}
/** 長生橋：曲弦トラスが続く鉄橋（夜の剪影） */
function choseiBashi(y: number): string {
  let d = ''
  for (let x = -20; x < 300; x += 54) {
    d += `M${x} ${y}Q${x + 27} ${y - 24} ${x + 54} ${y}`
    for (let j = 1; j < 4; j++) {
      const vx = x + j * 13.5
      const top = y - 12 * (1 - Math.pow((vx - x - 27) / 27, 2))
      d += `M${f(vx)} ${y}V${f(top)}L${f(vx + 13.5)} ${y}`
    }
  }
  return (
    `<path d="${d}" ${line(1.6, C.ink, 0.8)}/>` +
    `<rect y="${y}" width="300" height="4" fill="${C.ink}" opacity=".85"/>` +
    `<path d="${Array.from({ length: 7 }, (_, i) => `M${-20 + i * 54} ${y + 3}v9`).join('')}" ${line(4, C.ink, 0.7)}/>` +
    `<path d="M8 ${y - 1.5}H300" ${line(1.6, C.yellow, 0.9)} stroke-dasharray="0 26"/>`
  )
}
/** 倒映在水面上的光：[x, y, 寬] 的短橫線 */
const glints = (pts: number[][], c: string, op = 0.6, w = 1.6) => `<path d="${pts.map(([x, y, l]) => `M${f(x - l / 2)} ${f(y)}h${f(l)}`).join('')}" ${line(w, c, op)}/>`
/** 折線在 x 的 y（線性內插） */
function edgeY(pts: P[], x: number): number {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    if ((x - x0) * (x - x1) <= 0 && x0 !== x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return pts[pts.length - 1][1]
}
/** 柱狀節理：從稜線往下的直線，中間斷開一段 */
function joints(top: P[], x0: number, x1: number, bottom: number, step = 7): string {
  let d = ''
  for (let x = x0; x <= x1; x += step) {
    const y = Math.round(edgeY(top, x) + 4)
    const b = y + 18 + ((x * 7) % 34)
    if (b + 6 < bottom) d += `M${x} ${y}V${b}M${x} ${b + 6}V${bottom}`
  }
  return d
}

// 清津峡トンネル終点のパノラマステーション：洞口外是 V 字的峽谷（上半是紅葉的林、下半是柱狀節理的岩壁、谷底是河）
const KL: P[] = [[34, 238], [62, 228], [88, 222], [112, 210], [124, 250], [136, 290], [142, 322]]
const KR: P[] = [[266, 232], [238, 224], [212, 218], [190, 206], [178, 250], [166, 290], [160, 322]]
/** 洞口外的峽谷下半（只畫在 y ≤ 322，上下翻過來就是水面的倒影） */
function kiyotsuLow(): string {
  return (
    shape(poly([[100, 322], [100, 214], [150, 206], [204, 214], [204, 322]]), C.grey, 'opacity=".55"') +
    shape(poly([...KL, [34, 322]]), C.grey, 'opacity=".95"') +
    shape(poly([...KR, [266, 322]]), C.grey, 'opacity=".95"') +
    `<path d="${poly([[88, 222], [112, 210], [124, 250], [118, 296], [104, 250]])}${poly([[212, 218], [190, 206], [178, 250], [184, 294], [196, 250]])}" fill="${C.white}" opacity=".25"/>` +
    `<path d="${poly([[34, 280], [134, 284], [142, 322], [34, 322]])}${poly([[266, 276], [168, 282], [160, 322], [266, 322]])}" ${SH}/>` +
    `<path d="${joints(KL, 42, 134, 322, 12)}${joints(KR, 168, 258, 322, 12)}${joints([[100, 214], [204, 214]], 106, 198, 322, 12)}" ${line(1.3, C.ink, 0.16)}/>` +
    shape(poly([[132, 298], [170, 298], [176, 322], [126, 322]]), C.green, 'opacity=".85"') +
    `<path d="M136 304h10M150 310h14M138 316h8" ${line(1.4, C.white, 0.7)}/>`
  )
}
function kiyotsu(): string {
  const low = kiyotsuLow()
  const hole = 'M34 405V200A116 116 0 0 1 266 200V405Z'
  return (
    `<rect width="300" height="320" fill="${C.white}"/><rect width="300" height="320" fill="${C.blue}" opacity=".26"/>` +
    cloud(118, 122, 0.8, 0.85) +
    ridge([[96, 214], [124, 170], [150, 160], [180, 168], [206, 212]], C.blue, 0.22, 216) +
    ridge([[96, 216], [120, 194], [150, 186], [182, 192], [206, 216]], C.matcha, 0.6, 218) +
    low +
    // 兩側的紅葉林（V 字的上半）
    shape(poly([[34, 96], [60, 110], [86, 146], [104, 184], [114, 212], [88, 224], [62, 230], [34, 240]]), C.orange, 'opacity=".9"') +
    shape(poly([[266, 90], [238, 104], [214, 140], [196, 180], [188, 208], [212, 220], [238, 226], [266, 234]]), C.orange, 'opacity=".9"') +
    blobs(C.red, 0.9, [[46, 100, 16, 11, 7, 0.3], [94, 172, 12, 9, 6, 1], [60, 160, 14, 10, 6, 2], [250, 98, 18, 11, 7, 0.6], [206, 168, 12, 9, 6, 1.6], [236, 176, 13, 9, 6, 0.1]]) +
    blobs(C.yellow, 0.92, [[72, 126, 14, 10, 6, 1.2], [44, 140, 12, 9, 6, 2.4], [108, 202, 10, 7, 6, 0.4], [226, 124, 14, 10, 6, 2], [256, 150, 12, 9, 6, 0.9], [196, 198, 10, 7, 6, 1.3], [80, 194, 11, 7, 6, 2.8]]) +
    blobs(C.matcha, 0.85, [[84, 150, 9, 7, 6, 0.7], [40, 186, 10, 7, 6, 1.9], [214, 146, 9, 7, 6, 2.2], [258, 190, 10, 7, 6, 0.5]]) +
    `<path d="M34 238L62 228L88 222L112 210M266 232L238 224L212 218L190 206" ${line(4, C.ink, 0.12)}/>` +
    `<g transform="matrix(1 0 0 -1 0 640)">${low}</g>` +
    `<rect x="34" y="320" width="232" height="80" fill="${C.blue}" opacity=".2"/>` +
    glints([[60, 330, 34], [150, 336, 60], [238, 330, 30], [90, 352, 50], [210, 360, 64], [60, 382, 40], [170, 390, 80]], C.white, 0.45, 1.3) +
    // 隧道：外面一圈暗的牆（先鋪米色、不透出後面）、洞口被外光照亮的內壁、隧道的接縫、地面與牆的交線
    `<path d="M-5 -5H305V405H-5Z ${hole}" fill="${C.cream}" fill-rule="evenodd"/>` +
    `<path d="M-5 -5H305V405H-5Z ${hole}" fill="${C.ink}" opacity=".5" fill-rule="evenodd" ${E}/>` +
    `<path d="M16 405V200A134 134 0 0 1 284 200V405 ${hole}" fill="${C.grey}" opacity=".5" fill-rule="evenodd"/>` +
    `<path d="M-14 400V200A164 164 0 0 1 314 200V400 M34 320L-6 380M266 320L306 380" ${line(1.4, C.white, 0.14)}/>` +
    `<path d="M34 320h232" ${line(1.6, C.white, 0.6)}/>`
  )
}

/** 高田城の三重櫓：x 中心、y 土塁の上、s 大小（白壁、黒い瓦、最上段は入母屋） */
function yagura(x: number, y: number, s = 1): string {
  let out = ''
  let b = y
  const tiers = [
    [58, 25],
    [45, 19],
    [33, 17],
  ]
  tiers.forEach(([w, h], i) => {
    const hw = (w * s) / 2
    const top = b - h * s
    out += shape(poly([[x - hw, b], [x - hw, top], [x + hw, top], [x + hw, b]]), C.white)
    out += `<path d="${poly([[x + hw - 7 * s, b], [x + hw - 7 * s, top], [x + hw, top], [x + hw, b]])}" ${SH}/>`
    let win = ''
    for (let j = 0; j < 3 - (i === 2 ? 1 : 0); j++) {
      const wx = i === 2 ? x - 9 * s + j * 12 * s : x - 18 * s + j * 14 * s - (i ? -2 * s : 0)
      win += `M${f(wx)} ${f(top + h * s * 0.38)}h${f(6 * s)}v${f(5 * s)}h${f(-6 * s)}Z`
    }
    out += `<path d="${win}" fill="${C.ink}" opacity=".7"/>`
    const rw = hw + 9 * s
    const lift = i === 2 ? 11 : 6
    out += shape(
      `M${f(x - rw)} ${f(top + 1 * s)} Q${f(x - hw)} ${f(top - 1 * s)} ${f(x - hw + 3 * s)} ${f(top - lift * s)} L${f(x + hw - 3 * s)} ${f(top - lift * s)} Q${f(x + hw)} ${f(top - 1 * s)} ${f(x + rw)} ${f(top + 1 * s)} L${f(x + rw - 3 * s)} ${f(top + 4 * s)} L${f(x - rw + 3 * s)} ${f(top + 4 * s)}Z`,
      C.ink,
      'opacity=".82"',
    )
    if (i === 2) {
      // 入母屋の破風と鯱
      out += shape(poly([[x - 8 * s, top - lift * s + 0.5], [x, top - (lift + 9) * s], [x + 8 * s, top - lift * s + 0.5]]), C.white)
      out += `<path d="M${f(x - 10 * s)} ${f(top - lift * s)}L${f(x)} ${f(top - (lift + 10) * s)}L${f(x + 10 * s)} ${f(top - lift * s)}" ${line(2 * s, C.ink, 0.8)}/>`
      out += `<path d="M${f(x - 3 * s)} ${f(top - (lift + 10) * s)}c-2 -1 -2 -4 0 -5 M${f(x + 3 * s)} ${f(top - (lift + 10) * s)}c2 -1 2 -4 0 -5" ${line(1.8 * s, C.gold)}/>`
    }
    b = top - (i === 2 ? lift : lift - 1) * s
  })
  return out
}
/** 一列吊在繩子上的ぼんぼり（白い紙、上下が赤） */
function bonboriLine(x0: number, x1: number, y: number, sag: number, gap = 14): string {
  let l = ''
  let red = ''
  for (let x = x0 + gap / 2; x < x1; x += gap) {
    const t = (x - x0) / (x1 - x0)
    const yy = Math.round(y + 4 * sag * t * (1 - t))
    l += `M${Math.round(x - 3)} ${yy + 2}h5v6h-5Z`
    red += `M${Math.round(x - 3)} ${yy + 2}h5M${Math.round(x - 3)} ${yy + 8}h5`
  }
  return `<path d="M${x0} ${y}Q${(x0 + x1) / 2} ${y + 2 * sag} ${x1} ${y}" ${line(0.8, C.ink, 0.4)}/><path d="${l}" fill="${C.white}" ${E}/><path d="${red}" ${line(1.4, C.red, 0.9)}/>`
}


const NIIGATA: Outfit[] = [
  // 長岡まつり（data/festivals/niigata.json niigata-Q11651982，https://zh.wikipedia.org/wiki/%E9%95%B7%E5%B2%A1%E7%A5%AD）：信濃川の夜空に開く大輪の花火、河川敷から横に長く開くフェニックス、長生橋の鉄橋
  bg({
    id: 'bg-niigata-nagaoka-hanabi',
    name: '長岡花火大會',
    pref: 'niigata',
    rarity: 3,
    art:
      night(0.74) +
      dots([[40, 30, 0.9], [120, 18, 0.8], [270, 40, 0.9], [160, 56, 0.7], [20, 96, 0.7], [290, 110, 0.8]], C.white, 0.7) +
      cloud(232, 200, 1.1, 0.08) +
      cloud(66, 214, 0.9, 0.07) +
      hanabi(214, 126, 60, C.yellow, C.gold, 30) +
      hanabi(214, 126, 30, C.pink, C.white, 16) +
      hanabi(70, 166, 42, C.pink, C.white, 24) +
      hanabi(262, 234, 22, C.orange, C.yellow, 16) +
      hanabi(46, 66, 22, C.blue, C.white, 16) +
      hanabi(132, 40, 16, C.red, C.yellow, 14) +
      ridge([[0, 274], [60, 262], [130, 268], [200, 256], [300, 266]], C.ink, 0.22, 298) +
      roofs(-4, 304, 298, C.ink, 0.35, 5) +
      `<rect y="296" width="300" height="30" fill="${C.navy}" opacity=".5"/>` +
      choseiBashi(284) +
      phoenix(298) +
      glints([[30, 304, 10], [92, 306, 12], [160, 304, 10], [222, 307, 12], [280, 304, 8], [60, 314, 14], [130, 316, 10], [196, 314, 14], [252, 318, 10], [212, 322, 8]], C.yellow, 0.55) +
      glints([[78, 310, 8], [238, 312, 8], [150, 320, 10]], C.pink, 0.55) +
      ground(C.green, 326) +
      `<rect y="326" width="300" height="74" fill="${C.navy}" opacity=".55"/>` +
      `<rect y="326" width="300" height="7" fill="${C.grey}" opacity=".35"/>` +
      `<path d="M0 326h300" ${line(1.4, C.yellow, 0.3)}/><path d="M20 352l3 -5M60 372l3 -5M250 356l3 -5M280 384l3 -5M120 392l3 -5M200 380l3 -5" ${line(1.2, C.matcha, 0.5)}/>`,
  }),
  // 清津峡（data/spots/niigata.json wd-Q11561258，https://en.wikipedia.org/wiki/Kiyotsu_Gorge）：清津峡渓谷トンネル終点の洞口、柱状節理の岩壁と紅葉、床の水鏡に映る峡谷
  bg({
    id: 'bg-niigata-kiyotsukyo',
    name: '清津峽',
    pref: 'niigata',
    rarity: 2,
    art: kiyotsu(),
  }),
  // 高田城（data/spots/niigata.json wd-Q10856387，https://zh.wikipedia.org/wiki/%E9%AB%98%E7%94%B0%E5%9F%8E）：土塁の上の三重櫓、外堀の桜とぼんぼり、遠くの妙高山
  bg({
    id: 'bg-niigata-takadajo',
    name: '高田城',
    pref: 'niigata',
    rarity: 1,
    art:
      sky(C.blue, 0.22) +
      cloud(70, 70, 1.1) +
      cloud(250, 104, 0.8, 0.8) +
      ridge([[-10, 268], [40, 236], [86, 196], [104, 192], [150, 230], [230, 262], [310, 270]], C.blue, 0.24, 300, false) +
      `<path d="M74 210L86 196L104 192L118 204L110 210L100 204L92 212Z" fill="${C.white}" opacity=".85"/>` +
      `<path d="M150 298 Q172 270 196 268 L292 268 Q300 270 304 276 L304 300Z" fill="${C.matcha}" ${E}/>` +
      `<path d="M150 298 Q172 270 196 268 L226 268 Q202 276 194 300Z" ${SH}/>` +
      yagura(236, 268, 1.12) +
      blobs(C.pink, 1, [[20, 276, 26, 16, 8, 0.4], [62, 270, 24, 18, 8, 1.2], [104, 278, 22, 14, 8, 2], [146, 284, 18, 11, 7, 0.7], [180, 280, 14, 9, 7, 1.6], [290, 272, 16, 10, 7, 0.9]]) +
      `<path d="M10 290h22M54 290h20M98 292h16" ${line(2, C.brown, 0.6)}/>` +
      bonboriLine(0, 196, 284, 6) +
      `<rect y="298" width="300" height="24" fill="${C.blue}" opacity=".38" ${E}/>` +
      `<path d="M210 300h52v8h-52Z" fill="${C.white}" opacity=".35"/><path d="M0 300h196v4h-196Z" fill="${C.pink}" opacity=".35"/>` +
      ripples([[40, 312], [120, 308], [200, 314], [264, 310]]) +
      // 手前の大きな桜の枝（左上から）
      `<path d="M-6 150 Q30 160 64 184 M20 158 Q40 140 74 132 M40 170 Q70 168 96 190" ${line(4, C.brown)}/>` +
      blobs(C.pink, 1, [[70, 130, 28, 18, 9, 0.2], [14, 140, 26, 22, 9, 1.4], [96, 186, 22, 14, 8, 0.9], [54, 182, 20, 14, 8, 2.5]]) +
      `<path d="M74 140c8 6 20 6 26 -2 M20 158c8 4 16 2 22 -4 M96 196c6 2 14 0 18 -6" ${line(5, C.red, 0.12)}/>` +
      dots([[60, 124, 1.6], [84, 132, 1.4], [10, 132, 1.6], [30, 146, 1.4], [92, 182, 1.4], [46, 176, 1.4]], C.white, 0.8) +
      ground(C.matcha, 322, 0.4) +
      `<path d="M150 322 L110 400 M150 322 L190 400" ${line(1.2, C.white, 0.4)}/>` +
      dots([[30, 340, 1.6], [70, 362, 1.4], [240, 348, 1.6], [270, 380, 1.4], [120, 390, 1.4], [210, 372, 1.6]], C.pink, 0.9),
  }),
]

// ---------- 富山 ----------
/** 小的三角形樹（山坡上的針葉林）：[x, y 根元, 高] */
const pines = (list: number[][], fill: string, op = 1) =>
  `<path d="${list.map(([x, y, h]) => `M${f(x - h * 0.36)} ${y}L${x} ${y - h}L${f(x + h * 0.36)} ${y}Z`).join('')}" fill="${fill}" opacity="${op}"/>`
/** 線性內插 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** 黒部ダム：下流の谷から見上げたアーチダム、観光放水と虹、後ろの北アルプス */
function kurobe(): string {
  const face = 'M22 132Q150 166 278 140L188 306L116 306Z'
  let jl = ''
  for (let i = 1; i < 8; i++) {
    const t = i / 8
    jl += `M${f(lerp(22, 116, t))} ${f(lerp(132, 306, t))}Q150 ${f(lerp(166, 308, t))} ${f(lerp(278, 188, t))} ${f(lerp(140, 306, t))}`
  }
  for (let i = 1; i < 8; i++) jl += `M${f(lerp(22, 278, i / 8))} ${f(146 + 10 * Math.sin((Math.PI * i) / 8))}L${f(lerp(116, 188, i / 8))} 306`
  const bow = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const
  return (
    sky(C.blue, 0.26) +
    cloud(64, 40, 0.9) +
    cloud(244, 26, 0.7, 0.8) +
    ridge([[0, 120], [26, 78], [50, 92], [82, 56], [112, 86], [140, 66], [172, 90], [206, 50], [234, 76], [262, 60], [300, 92]], C.blue, 0.3, 170, false) +
    `<path d="M72 68L82 56L92 66L86 72Z M196 62L206 50L216 62L208 68Z M132 74L140 66L148 74Z M254 68L262 60L270 70Z" fill="${C.white}" opacity=".9"/>` +
    ridge([[0, 136], [40, 108], [90, 124], [150, 104], [210, 120], [260, 100], [300, 114]], C.green, 0.4, 170) +
    shape(face, C.white) +
    `<path d="${face}" fill="${C.grey}" opacity=".28"/>` +
    `<path d="M172 160Q230 156 278 140L188 306L158 306Q176 230 172 160Z" ${SH}/>` +
    `<path d="${jl}" ${line(1, C.ink, 0.13)}/>` +
    `<path d="M22 132Q150 166 278 140" ${line(5, C.grey)}/><path d="M22 127Q150 161 278 135" ${line(1.2, C.ink, 0.45)}/>` +
    shape(poly([[-5, 110], [22, 128], [50, 176], [76, 226], [100, 274], [116, 322], [-5, 322]]), C.green) +
    shape(poly([[305, 118], [278, 136], [250, 182], [226, 230], [204, 276], [190, 322], [305, 322]]), C.green) +
    blobs(C.matcha, 0.7, [[18, 180, 14, 11, 7], [50, 250, 16, 11, 7, 1], [286, 200, 14, 11, 7, 2], [254, 262, 14, 9, 7, 0.5], [12, 290, 14, 9, 6]]) +
    pines([[6, 112, 12], [16, 122, 10], [30, 140, 12], [42, 160, 10], [56, 184, 12], [68, 208, 10], [294, 120, 12], [282, 134, 10], [270, 152, 12], [258, 172, 10], [244, 196, 12], [234, 218, 10]], C.green, 1) +
    `<path d="M-5 300L100 274L116 322L-5 322Z M305 300L204 276L190 322L305 322Z" ${SH}/>` +
    shape(poly([[114, 306], [190, 306], [192, 322], [112, 322]]), C.green, 'opacity=".75"') +
    // 観光放水：ダムの壁の中ほどから右下へ吹き出す白い水と水しぶき、虹
    `<path d="M196 214h9v5h-9Z" fill="${C.ink}" opacity=".45"/>` +
    shape('M200 214Q246 200 262 248L282 322L214 322Q212 262 200 222Z', C.white, 'opacity=".45"') +
    `<path d="${[0, 1, 2, 3, 4].map((i) => `M200 ${216 + i}Q${238 - i * 6} ${208 + i * 4} ${252 - i * 6} ${250 + i * 2}T${274 - i * 12} 322`).join('')}" ${line(2.6, C.white, 0.9)}/>` +
    dots([[262, 236, 1.6], [270, 252, 1.4], [252, 226, 1.2], [276, 270, 1.6], [214, 204, 1.2], [230, 202, 1.4]], C.white, 0.9) +
    blobs(C.white, 0.75, [[236, 274, 22, 16, 7, 0.3], [272, 270, 18, 14, 7, 1.1]]) +
    blobs(C.white, 0.85, [[200, 314, 26, 10, 7], [244, 304, 36, 16, 8, 1], [286, 310, 22, 12, 7, 2], [160, 318, 18, 7, 6, 0.4]]) +
    bow.map((c, i) => `<path d="M${f(236 - (60 - i * 2.6) * 0.94)} ${f(334 - (60 - i * 2.6) * 0.34)}A${f(60 - i * 2.6)} ${f(60 - i * 2.6)} 0 0 1 ${f(236 + (60 - i * 2.6) * 0.5)} ${f(334 - (60 - i * 2.6) * 0.87)}" ${line(2.6, C[c], 0.42)}/>`).join('') +
    ground(C.grey, 322, 0.45) +
    `<path d="M0 306H300M0 312H300" ${line(1.4, C.ink, 0.4)}/><path d="M6 314H300" fill="none" stroke="${C.ink}" stroke-width="16" stroke-dasharray="1.8 22.2" stroke-opacity=".4"/>` +
    `<path d="M0 340H300M0 366H300M0 394H300" ${line(1.2, C.white, 0.4)}/>`
  )
}

/** 雪の大谷：室堂へ向かう道の両側にそびえる雪の壁（遠近法で奥へ消える）と、奥の立山 */
function snowWall(nx: number, fx: number, nTop: number, fTop: number, nFoot: number, fFoot: number, shade: number): string {
  let top = ''
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    top += `${i ? 'L' : 'M'}${f(lerp(nx, fx, t))} ${f(lerp(nTop, fTop, t) + (i % 2 ? 6 * (1 - t) : 0))}`
  }
  let st = ''
  ;[0.08, 0.18, 0.3, 0.43, 0.56, 0.7, 0.84].forEach((h) => (st += `M${nx} ${f(lerp(nFoot, nTop, h))}L${fx} ${f(lerp(fFoot, fTop, h))}`))
  const sc = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 0.5) / 9
    const x = lerp(nx, fx, t)
    return `M${f(x)} ${f(lerp(nFoot, fFoot, t))}L${f(x + (i % 2 ? 2 : -2))} ${f(lerp(nTop, fTop, t) + 8)}`
  }).join('')
  return (
    `<path d="${top}L${fx} ${fFoot}L${nx} ${nFoot}Z" fill="${C.white}" ${E}/>` +
    `<path d="${top}L${fx} ${fFoot}L${nx} ${nFoot}Z" fill="${C.blue}" opacity="${shade}"/>` +
    `<path d="${st}" ${line(1.6, C.brown, 0.16)}/><path d="${sc}" ${line(1.2, C.blue, 0.06)}/>` +
    `<path d="${top}" ${line(7, C.blue, 0.12)} transform="translate(0 5)"/><path d="${top}" ${line(2.4, C.white)}/>`
  )
}
function yukiNoOtani(): string {
  return (
    sky(C.blue, 0.36) +
    cloud(250, 40, 0.8, 0.85) +
    ridge([[0, 168], [40, 148], [70, 126], [96, 116], [120, 124], [140, 102], [160, 108], [178, 98], [204, 116], [236, 110], [262, 130], [300, 150]], C.white, 1, 316, false) +
    `<path d="M0 168L40 148L70 126L96 116L120 124L140 102L160 108L178 98L204 116L236 110L262 130L300 150V316H0Z" fill="${C.blue}" opacity=".1"/>` +
    `<path d="M96 116L104 150L88 190L120 124Z M178 98L186 136L172 176L204 116Z M140 102L146 130L160 108Z M236 110L244 146L230 190L262 130Z M40 148L52 176L70 126Z" fill="${C.blue}" opacity=".2"/>` +
    `<path d="M100 132l-4 10l2 8M182 116l-3 12l2 10M240 128l-4 12l1 9M146 120l-3 8M64 140l-3 9M210 124l-2 8M272 140l-3 8" ${line(1.6, C.grey, 0.5)}/>` +
    ground(C.grey, 312, 0.6) +
    `<path d="M150 400V384M150 372V362M150 352V346M150 338V334M150 328V325" ${line(2.4, C.white, 0.8)}/>` +
    `<path d="M-10 368L146 314M310 368L154 314" ${line(2, C.white, 0.7)}/>` +
    snowWall(-10, 146, -60, 290, 360, 314, 0.06) +
    snowWall(310, 154, -30, 292, 360, 314, 0.2) +
    `<path d="M0 400L-10 360L146 314L150 322Z" fill="${C.white}" opacity=".5"/>`
  )
}

/** 格子：橫的一條粗虛線，每一小段就是一根直的木條（x0–x1、y0–y1 的範圍） */
const lattice = (x0: number, x1: number, y0: number, y1: number, c: string, op = 1, bar = 1.4, gap = 2.2) =>
  `<path d="M${f(x0)} ${f((y0 + y1) / 2)}H${f(x1)}" fill="none" stroke="${c}" stroke-width="${f(y1 - y0)}" stroke-dasharray="${bar} ${gap}" stroke-opacity="${op}"/>`
/** 八尾の町家：x 左端、y 道、w 幅。昼の色で描いて、あとで夜の藍をかぶせる */
function machiya(x: number, y: number, w: number): string {
  const r1 = y - 54
  const r2 = r1 - 44
  return (
    shape(poly([[x, y], [x, r2], [x + w, r2], [x + w, y]]), C.brown) +
    `<path d="M${x + w - 6} ${y}V${r2}h6V${y}Z" ${SH}/>` +
    shape(`M${x - 5} ${r1 + 3}L${x + w + 5} ${r1 + 3}L${x + w} ${r1 - 7}L${x} ${r1 - 7}Z`, C.ink, 'opacity=".7"') +
    shape(`M${x - 7} ${r2 + 2}L${x + w + 7} ${r2 + 2}L${x + w - 3} ${r2 - 13}L${x + 3} ${r2 - 13}Z`, C.ink, 'opacity=".78"')
  )
}
/** 町家の明かり（夜の藍の上に描く）：一階の格子戸、二階の障子 */
function machiyaLight(x: number, y: number, w: number, k: number): string {
  const r1 = y - 54
  const r2 = r1 - 44
  return (
    `<path d="M${x + 6} ${r1 + 9}H${x + w - 8}V${y - 3}H${x + 6}Z M${x + 14} ${r2 + 10}H${x + w - 16}V${r1 - 13}H${x + 14}Z" fill="${C.yellow}" opacity="${k % 2 ? 0.62 : 0.5}"/>` +
    lattice(x + 6, x + w - 8, r1 + 9, y - 3, C.brown, 0.95) +
    (k % 2 ? `<path d="M${x + 14} ${(r2 + r1) / 2 - 1.5}H${x + w - 16}M${x + w / 2 - 1} ${r2 + 10}V${r1 - 13}" ${line(1.4, C.brown, 0.8)}/>` : lattice(x + 14, x + w - 16, r2 + 10, r1 - 13, C.brown, 0.9, 1.4, 3)) +
    `<path d="M${x + w * 0.62} ${r1 + 9}V${y - 3}" ${line(2, C.brown, 0.9)}/>`
  )
}
/** おわらのぼんぼり：細い柱の上の白い紙の灯り（[x, 地面の y] を一度に） */
const bonboris = (list: number[][]) =>
  dots(list.map(([x, y]) => [x, y - 44, 16]), C.yellow, 0.16) +
  `<path d="${list.map(([x, y]) => `M${f(x)} ${f(y)}V${f(y - 34)}`).join('')}" ${line(2.2, C.brown)}/>` +
  `<path d="${list.map(([x, y]) => `M${f(x - 6)} ${f(y - 34)}h12l1.5 -12c0 -4 -3 -6 -7.5 -6s-7.5 2 -7.5 6Z`).join('')}" fill="${C.cream}" ${E}/>` +
  `<path d="${list.map(([x, y]) => `M${f(x - 7)} ${f(y - 41)}h14`).join('')}" ${line(1.2, C.red, 0.7)}/>`
/** おわら踊りの踊り手：深くかぶった編笠、浴衣、片手を上げた形 */
function odoriko(x: number, y: number, s: number, robe: string, flip = 1): string {
  const X = (v: number) => f(x + v * s * flip)
  const Y = (v: number) => f(y - v * s)
  return (
    shape(`M${X(-6)} ${Y(0)}L${X(-8)} ${Y(30)}L${X(-6)} ${Y(42)}L${X(6)} ${Y(42)}L${X(8)} ${Y(30)}L${X(7)} ${Y(0)}Z`, robe) +
    shape(`M${X(5)} ${Y(40)}L${X(18)} ${Y(50)}L${X(22)} ${Y(46)}L${X(16)} ${Y(36)}L${X(7)} ${Y(32)}Z`, robe) +
    shape(`M${X(-6)} ${Y(38)}L${X(-14)} ${Y(30)}L${X(-12)} ${Y(24)}L${X(-6)} ${Y(30)}Z`, robe) +
    `<path d="M${X(-7.5)} ${Y(27)}H${X(7.6)}" ${line(f(4 * s), C.ink, 0.85)}/>` +
    shape(`M${X(-11)} ${Y(44)}C${X(-10)} ${Y(55)} ${X(10)} ${Y(55)} ${X(11)} ${Y(44)}C${X(4)} ${Y(41)} ${X(-4)} ${Y(41)} ${X(-11)} ${Y(44)}Z`, C.gold)
  )
}
function owara(): string {
  const H: number[][] = [
    [-16, 316, 94],
    [78, 308, 94],
    [172, 300, 94],
    [266, 292, 94],
  ]
  return (
    `<rect width="300" height="400" fill="${C.cream}"/>` +
    ridge([[0, 168], [70, 148], [150, 162], [230, 140], [300, 156]], C.green, 0.5, 240) +
    H.map(([x, y, w]) => machiya(x, y, w)).join('') +
    shape('M-5 318L310 290V405H-5Z', C.grey, 'opacity=".55"') +
    `<path d="M0 340L300 318M0 364L300 346M0 390L300 376M40 314L30 400M110 308L104 400M180 302L176 400M250 296L248 400" ${line(1.2, C.white, 0.35)}/>` +
    `<rect width="300" height="400" fill="${C.navy}" opacity=".68"/>` +
    sun(244, 50, 13, C.cream, 0.9) +
    dots([[40, 40, 1], [120, 70, 1], [190, 26, 1], [280, 96, 1]], C.white, 0.7) +
    H.map(([x, y, w], i) => machiyaLight(x, y, w, i)).join('') +
    `<path d="M0 344L300 318" ${line(22, C.yellow, 0.08)}/>` +
    bonboris([10, 66, 124, 180, 236, 292].map((x) => [x, 322 - (x / 300) * 28])) +
    odoriko(208, 311, 1.2, C.pink) +
    odoriko(254, 306, 1.2, C.pink)
  )
}

const TOYAMA: Outfit[] = [
  // 黒部ダム（data/spots/toyama.json wd-Q1208749，https://zh.wikipedia.org/wiki/%E9%BB%91%E9%83%A8%E6%B0%B4%E5%A3%A9）：下流の展望台から見たアーチダム、観光放水の水しぶきと虹、後ろの北アルプス
  bg({
    id: 'bg-toyama-kurobe-dam',
    name: '黑部水壩',
    pref: 'toyama',
    rarity: 3,
    art: kurobe(),
  }),
  // 室堂（data/spots/toyama.json wd-Q11452989，https://en.wikipedia.org/wiki/Murod%C5%8D）：雪の大谷、道の両側の雪の壁（積もった層の筋）と奥の立山
  bg({
    id: 'bg-toyama-yuki-no-otani',
    name: '雪之大谷',
    pref: 'toyama',
    rarity: 2,
    art: yukiNoOtani(),
  }),
  // おわら風の盆（data/festivals/toyama.json toyama-Q2071242，https://en.wikipedia.org/wiki/Kaze_no_bon）：八尾の坂の町、格子の町家とぼんぼり、編笠の踊り手
  bg({
    id: 'bg-toyama-owara',
    name: '八尾風之盆',
    pref: 'toyama',
    rarity: 1,
    art: owara(),
  }),
]

// ---------- 石川 ----------
/** 徽軫灯籠：x 中心、y 中台の下、s 大小。笠と中台に雪、長い脚は池の中、短い脚は雪をかぶった石の上 */
function kotoji(x: number, y: number, s = 1): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    shape('M14 40C20 30 40 28 52 40Z', C.grey) +
    `<path d="M16 35C24 28 40 27 50 37C40 33 26 33 16 35Z" fill="${C.white}"/>` +
    shape('M-20 0C-24 20 -30 44 -36 62L-29 62C-24 44 -16 20 -12 0Z', C.grey) +
    shape('M12 0C16 12 22 24 26 33L32 32C28 22 22 10 20 0Z', C.grey) +
    `<path d="M-16 0C-20 20 -26 44 -32 62L-29 62C-24 44 -16 20 -12 0Z" ${SH}/>` +
    shape('M-26 0L26 0L22 -7L-22 -7Z', C.grey) +
    shape('M-11 -7V-27H11V-7Z', C.grey) +
    `<path d="M-5 -22h10v10h-10Z" fill="${C.ink}" opacity=".45"/><path d="M5 -7V-27h6V-7Z" ${SH}/>` +
    shape('M-34 -27C-20 -33 -10 -40 0 -41C10 -40 20 -33 34 -27L30 -23L-30 -23Z', C.grey) +
    shape('M-33 -28C-24 -40 -12 -50 0 -50C12 -50 24 -40 33 -28C20 -33 -20 -33 -33 -28Z', C.white) +
    shape('M-27 -6C-16 -13 16 -13 27 -6C12 -8 -12 -8 -27 -6Z', C.white) +
    '</g>'
  )
}
/** 唐崎松と雪吊り：x 芯柱、y 根元。柱のてっぺんから枝先へ放射状に張った縄、雪をのせた枝の段 */
function yukitsuri(x: number, y: number): string {
  const top = 118
  const ends: P[] = [[176, 254], [186, 236], [198, 222], [212, 212], [228, 206], [246, 204], [264, 206], [280, 212], [294, 222], [304, 236], [190, 274], [300, 262]]
  const pads = [
    [214, 256, 40, 9],
    [276, 250, 34, 9],
    [228, 228, 30, 8],
    [270, 222, 28, 8],
    [250, 206, 24, 7],
    [196, 238, 18, 6],
  ]
  return (
    `<path d="M${x + 6} ${y}C${x + 4} ${y - 30} ${x - 10} ${y - 44} ${x - 30} ${y - 50}M${x} ${y - 30}C${x + 20} ${y - 40} ${x + 30} ${y - 50} ${x + 34} ${y - 56}M${x - 4} ${y - 60}C${x - 10} ${y - 70} ${x - 18} ${y - 74} ${x - 24} ${y - 76}" ${line(7, C.brown)}/>` +
    `<path d="M${x + 6} ${y}C${x + 4} ${y - 30} ${x - 4} ${y - 60} ${x} ${y - 100}" ${line(10, C.brown)}/>` +
    blobs(C.green, 1, pads.map(([cx, cy, rx, ry], i) => [cx, cy, rx, ry, 7, i])) +
    `<path d="${pads.map(([cx, cy, rx, ry]) => `M${cx - rx} ${cy - 2}C${cx - rx * 0.6} ${cy - ry - 6} ${cx + rx * 0.6} ${cy - ry - 6} ${cx + rx} ${cy - 2}C${cx + rx * 0.5} ${cy - ry + 2} ${cx - rx * 0.5} ${cy - ry + 2} ${cx - rx} ${cy - 2}Z`).join('')}" fill="${C.white}" ${E}/>` +
    `<path d="M${x} ${y}V${top}" ${line(3, C.brown)}/>` +
    `<path d="${ends.map(([ex, ey]) => `M${x} ${top + 4}L${ex} ${ey}`).join('')}" ${line(1, C.gold, 0.9)}/>` +
    shape(`M${x - 4} ${top + 6}L${x} ${top - 10}L${x + 4} ${top + 6}Z`, C.gold)
  )
}
function kenrokuen(): string {
  const flakes: number[][] = []
  for (let i = 0; i < 12; i++) flakes.push([(i * 83) % 300, (i * 137) % 330 + 6, 1 + (i % 3) * 0.5])
  return (
    sky(C.navy, 0.16) +
    blobs(C.white, 1, [[20, 266, 30, 22, 7], [76, 258, 32, 26, 8, 1], [140, 262, 30, 22, 7, 2], [206, 256, 34, 26, 8, 0.5], [270, 262, 32, 22, 7, 1.5]]) +
    blobs(C.green, 0.4, [[30, 280, 24, 10, 6], [96, 278, 26, 10, 6, 1], [160, 280, 24, 10, 6, 2], [230, 278, 28, 10, 6, 0.4], [286, 282, 20, 9, 6, 1.2]]) +
    `<path d="M50 252l-4 30M110 240l3 40M180 246l-3 34M250 240l2 40" ${line(2, C.brown, 0.35)}/>` +
    `<rect y="284" width="300" height="38" fill="${C.blue}" opacity=".3" ${E}/>` +
    `<rect y="284" width="300" height="5" fill="${C.white}" opacity=".7"/>` +
    ripples([[130, 300], [190, 296], [160, 312], [240, 306]], 16, 0.6) +
    yukitsuri(246, 300) +
    `<path d="M196 300C220 290 270 290 304 296V322H196Z" fill="${C.white}" ${E}/>` +
    kotoji(68, 256, 1.3) +
    `<path d="M22 324h22M48 330h12" ${line(1.4, C.white, 0.7)}/>` +
    // 手前の雪をかぶった枝（左上から）と虹橋
    `<path d="M-6 132C24 138 50 150 72 170M18 142C30 128 44 120 60 118M40 156C56 152 72 156 86 166" ${line(3.4, C.brown, 0.85)}/>` +
    `<path d="M-6 128C24 134 50 146 72 166M18 138C30 124 44 116 60 114M40 152C56 148 72 152 86 162" ${line(2.2, C.white)}/>` +
    shape('M-5 322C30 312 80 312 118 322L118 330C80 320 30 320 -5 330Z', C.grey) +
    shape('M-5 320C30 309 80 309 118 320L118 323C80 314 30 314 -5 323Z', C.white) +
    ground(C.white, 330) +
    `<path d="M0 352C60 344 120 350 160 346M150 372C200 366 250 372 300 366M10 392C80 384 140 392 200 388" ${line(6, C.blue, 0.1)}/>` +
    dots(flakes, C.white, 0.9)
  )
}

/** 東茶屋街：一点透視の通り。奥行き d（1 = 手前）の点 = 消失点へ 1/d 縮める */
const VP: P = [150, 290]
const pp = (x: number, y: number, d: number): string => `${f(VP[0] + (x - VP[0]) / d)} ${f(VP[1] + (y - VP[1]) / d)}`
/** 片側の町並み：nx 手前の壁の x、sx 通りへ出る向き（左 +1、右 -1）、shade 影 */
function chayaSide(nx: number, sx: number, shade: boolean): string {
  const D = 7
  const q = (a: number, b: number, y0: number, y1: number, x0 = nx, x1 = nx) => `M${pp(x0, y0, a)}L${pp(x1, y1, a)}L${pp(x1, y1, b)}L${pp(x0, y0, b)}Z`
  const wall = `M${pp(nx, 400, 1)}L${pp(nx, 40, 1)}L${pp(nx, 40, D)}L${pp(nx, 400, D)}Z`
  let bars1 = ''
  let bars2 = ''
  for (let d = 1.03; d < 3.6; d += 0.055) bars1 += `M${pp(nx, 398, d)}L${pp(nx, 252, d)}`
  for (let d = 1.05; d < 3.6; d += 0.09) bars2 += `M${pp(nx, 208, d)}L${pp(nx, 112, d)}`
  const posts = [1.4, 2.1, 3, 4.2, 5.6].map((d) => `M${pp(nx, 400, d)}L${pp(nx, 70, d)}`).join('')
  const e1 = nx + sx * 16
  const e2 = nx + sx * 34
  return (
    shape(wall, C.brown) +
    `<path d="${wall}" fill="${C.red}" opacity=".2"/>` +
    `<path d="${q(1, D, 252, 398)}${q(1, D, 112, 208)}" fill="${C.ink}" opacity=".35"/>` +
    `<path d="${bars1}" ${line(1.5, C.red, 0.5)}/><path d="${bars2}" ${line(1.5, C.red, 0.45)}/>` +
    `<path d="${q(1, D, 70, 112)}" fill="${C.cream}" opacity=".8"/>` +
    `<path d="${posts}" ${line(3, C.brown)}/>` +
    `<path d="${q(1, D, 236, 246, nx, e1)}${q(1, D, 46, 66, nx, e2)}" fill="${C.brown}"/>` +
    `<path d="${q(1, D, 238, 252, e1, e1)}${q(1, D, 50, 76, e2, e2)}" fill="${C.ink}" opacity=".78" ${E}/>` +
    `<path d="${q(1.5, 1.85, 252, 300)}" fill="${C.navy}" opacity=".85"/>` +
    (shade ? `<path d="${wall}${q(1, D, 46, 76, nx, e2)}" ${SH}/>` : '')
  )
}
function higashiChaya(): string {
  let stones = ''
  for (const d of [1.08, 1.25, 1.48, 1.8, 2.25, 2.9, 3.9]) stones += `M${pp(-10, 400, d)}L${pp(310, 400, d)}`
  for (const x of [40, 100, 150, 200, 260]) stones += `M${pp(x, 400, 1)}L${pp(x, 400, 7)}`
  return (
    sky(C.blue, 0.24) +
    cloud(150, 70, 1.1) +
    cloud(60, 120, 0.7, 0.8) +
    ridge([[80, 236], [120, 214], [160, 210], [200, 222], [230, 240]], C.green, 0.65, 292) +
    ground(C.grey, 286, 0.5) +
    `<path d="${stones}" ${line(1.2, C.white, 0.45)}/>` +
    chayaSide(-10, 1, false) +
    chayaSide(310, -1, true)
  )
}

/** 白米千枚田：海へ下る斜面に重なる小さな田（水を張った田に夕日が映る）。畦の曲線 i の y（0 = 海岸、下ほど手前で太く曲がる） */
const TY = [240, 247, 255, 265, 277, 291, 308, 328, 352, 380, 412]
const ty = (i: number, x: number) => TY[i] - (12 + i * 7) * ((x - 150) / 150) ** 2
const tcurve = (i: number, rev = false) => {
  const xs = [-10, 30, 70, 110, 150, 190, 230, 270, 310]
  return (rev ? xs.reverse() : xs).map((x, j) => `${j || rev ? 'L' : 'M'}${x} ${f(ty(i, x))}`).join('')
}
function senmaida(): string {
  const fill = [C.yellow, C.orange, C.yellow, C.orange, C.matcha, C.yellow, C.orange, C.matcha, C.yellow, C.orange]
  let cuts = ''
  for (let i = 0; i < 10; i++) for (let x = 10 + (i % 2) * 12; x < 300; x += 22 + i * 7) cuts += `M${x} ${f(ty(i, x))}L${f(x + (x - 150) * 0.04 * (i + 1))} ${f(ty(i + 1, x + (x - 150) * 0.04 * (i + 1)))}`
  return (
    sky(C.orange, 0.3, C.cream) +
    cloud(70, 96, 1.1, 0.5, C.pink) +
    cloud(200, 140, 0.8, 0.45, C.pink) +
    sun(236, 200, 44, C.yellow, 0.18) +
    sun(236, 200, 16, C.yellow, 0.95) +
    `<path d="M-5 212C24 204 56 206 84 216H-5Z M230 216C252 210 276 208 305 210V216Z" fill="${C.navy}" opacity=".35"/>` +
    `<rect y="216" width="300" height="32" fill="${C.navy}" opacity=".3"/>` +
    glints([[236, 220, 34], [236, 226, 26], [236, 232, 30], [236, 238, 18], [80, 228, 18], [140, 236, 14]], C.yellow, 0.75, 2) +
    // 田：畦と畦のあいだを交互の色で（水面に映る夕焼け、苗の緑）
    `<path d="${tcurve(0)}L310 400L-10 400Z" fill="${C.cream}"/>` +
    Array.from({ length: 10 }, (_, i) => `<path d="${tcurve(i)}${i < 9 ? tcurve(i + 1, true) : 'L310 400L-10 400'}Z" fill="${fill[i]}" opacity="${fill[i] === C.matcha ? 0.5 : 0.36}"/>`).join('') +
    `<path d="${cuts}" ${line(2, C.green, 0.75)}/>` +
    `<path d="${[0, 1, 2, 3, 4].map((i) => tcurve(i)).join('')}" ${line(2.2, C.green, 0.9)}/><path d="${[5, 6, 8, 9].map((i) => tcurve(i)).join('')}" ${line(4.4, C.green, 0.9)}/>` +
    `<path d="${tcurve(0)}" ${line(2, C.white, 0.7)} transform="translate(0 -3)"/>` +
    `<path d="${tcurve(7)}" ${line(10, C.matcha)}/><path d="${tcurve(7)}" ${line(2, C.brown, 0.3)} transform="translate(0 4)"/>` +
    ridge([[-10, 188], [14, 192], [34, 206], [46, 222]], C.green, 0.95, 236) +
    ridge([[256, 222], [270, 204], [290, 192], [310, 190]], C.green, 0.95, 236)
  )
}

const ISHIKAWA: Outfit[] = [
  // 兼六園（data/spots/ishikawa.json wd-Q998239，https://zh.wikipedia.org/wiki/%E5%85%BC%E5%85%AD%E5%9C%92）：冬の霞ヶ池、二本脚の徽軫灯籠と虹橋、雪吊りの唐崎松
  bg({
    id: 'bg-ishikawa-kenrokuen',
    name: '兼六園',
    pref: 'ishikawa',
    rarity: 3,
    art: kenrokuen(),
  }),
  // 東山ひがし（data/spots/ishikawa.json wd-Q5897562，https://zh.wikipedia.org/wiki/%E6%9D%B1%E5%B1%B1%E6%9D%B1）：ひがし茶屋街の通り、両側に続く紅殻格子（木虫籠）の二階建ての茶屋、石畳
  bg({
    id: 'bg-ishikawa-higashi-chaya',
    name: '東茶屋街',
    pref: 'ishikawa',
    rarity: 2,
    art: higashiChaya(),
  }),
  // 白米千枚田（data/spots/ishikawa.json wd-Q11580283，https://zh.wikipedia.org/wiki/%E7%99%BD%E7%B1%B3%E5%8D%83%E6%9E%9A%E7%94%B0）：日本海へ下る斜面の棚田、水を張った田に映る夕日
  bg({
    id: 'bg-ishikawa-shiroyone-senmaida',
    name: '白米千枚田',
    pref: 'ishikawa',
    rarity: 1,
    art: senmaida(),
  }),
]

// ---------- 福井 ----------
/** 東尋坊の断崖：海へ下りる柱状節理の岩。pts は稜線（端から海側へ）。夕日を背にした暗い面、上の縁と海側の縁に夕日の光、柱の縦の筋と横の割れ目 */
function cliff(pts: P[], bottom = 330, op = 1): string {
  const out = pts.map(([x, y]) => `${x} ${y}`).join('L')
  const mass = `M${pts[0][0]} ${bottom}L${out}L${pts[pts.length - 1][0]} ${bottom}Z`
  let rim = ''
  let side = ''
  let cols = ''
  let cut = ''
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    if (Math.abs(y1 - y0) < Math.abs(x1 - x0)) {
      rim += `M${x0} ${y0 + 1}L${x1} ${y1 + 1}`
      const lo = Math.min(x0, x1)
      for (let x = lo + 5; x < Math.max(x0, x1) - 2; x += 8) {
        const yt = y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) + 3
        cols += `M${f(x)} ${f(yt)}V${bottom}`
        cut += `M${f(x - 4)} ${f(yt + 20 + ((x * 7) % 26))}h8`
      }
    } else side += `M${x0 + (x1 > x0 ? 1 : -1)} ${y0}L${x1 + (x1 > x0 ? 1 : -1)} ${y1}`
  }
  return (
    `<g opacity="${op}"><path d="${mass}" fill="${C.brown}" ${E}/><path d="${mass}" fill="${C.ink}" opacity=".3"/>` +
    `<path d="${cols}" ${line(1.4, C.ink, 0.22)}/><path d="${cut}" ${line(1, C.ink, 0.22)}/>` +
    `<path d="${rim}" ${line(3, C.orange, 0.8)}/><path d="${side}" ${line(2, C.orange, 0.55)}/></g>`
  )
}
/** 柱の頭が並んだ岩の床（六角形の割れ目、奥ほど細かい） */
function hexFloor(): string {
  const rows = [324, 336, 352, 372, 400, 432]
  let d = ''
  for (let r = 0; r + 1 < rows.length; r++) {
    const y0 = rows[r]
    const y1 = rows[r + 1]
    const w = 20 + r * 12
    const a = (y1 - y0) * 0.22
    const off = r % 2 ? w / 2 : 0
    const R = Math.round
    let z = ''
    for (let x = -w + off; x < 310; x += w) {
      z += `${z ? 'L' : 'M'}${R(x)} ${R(y0 + a)}L${R(x + w / 2)} ${R(y0 - a)}`
      d += `M${R(x + w)} ${R(y0 + a)}V${R(y1 - a)}`
    }
    d += z
  }
  return `<path d="${d}" ${line(1.5, C.ink, 0.2)}/>`
}
function tojinbo(): string {
  return (
    sky(C.orange, 0.36, C.cream) +
    cloud(90, 120, 1.2, 0.4, C.pink) +
    cloud(250, 150, 0.9, 0.35, C.pink) +
    sun(234, 212, 46, C.yellow, 0.2) +
    sun(234, 212, 17, C.yellow, 0.95) +
    `<rect y="238" width="300" height="90" fill="${C.cream}"/><rect y="238" width="300" height="90" fill="${C.blue}" opacity=".5"/><rect y="238" width="300" height="90" fill="${C.navy}" opacity=".15"/>` +
    `<path d="M126 238C132 230 146 228 158 232C164 234 168 236 170 238Z" fill="${C.navy}" opacity=".45"/>` +
    `<path d="M214 238H254L262 328H206Z" fill="${C.orange}" opacity=".22"/>` +
    glints([[234, 242, 40], [234, 248, 30], [234, 255, 36], [234, 263, 22], [234, 274, 28], [234, 288, 16], [150, 252, 16], [176, 270, 12], [120, 262, 10]], C.yellow, 0.8, 2) +
    cliff([[150, 300], [166, 296], [172, 282], [186, 280], [190, 270], [206, 268], [210, 274], [230, 272]], 330, 0.55) +
    cliff([[-6, 176], [10, 172], [18, 176], [30, 174], [34, 188], [52, 186], [56, 198], [62, 200], [66, 216], [80, 214], [84, 228], [90, 230], [94, 248], [104, 246], [106, 264], [112, 266], [116, 286], [124, 290], [126, 310], [134, 314]]) +
    cliff([[306, 216], [296, 214], [290, 222], [276, 220], [272, 236], [262, 238], [258, 252], [246, 250], [242, 266], [236, 268], [232, 284], [222, 286], [218, 300], [204, 304], [200, 316], [192, 318]]) +
    blobs(C.white, 0.88, [[132, 322, 16, 6, 7], [192, 320, 16, 6, 7, 1], [110, 326, 14, 5, 6, 2], [170, 304, 12, 5, 6, 0.5]]) +
    `<path d="M140 304h14M150 312h12" ${line(1.6, C.white, 0.7)}/>` +
    ground(C.brown, 322, 0.55) +
    `<rect y="322" width="300" height="78" fill="${C.orange}" opacity=".14"/>` +
    hexFloor() +
    `<path d="M0 323H300" ${line(2, C.orange, 0.5)}/>`
  )
}

/** 永平寺の山門：二重の楼門、入母屋の大屋根（x 中心、y 基壇の上） */
function sanmon(x: number, y: number): string {
  return (
    `<g transform="translate(${x} ${y})">` +
    shape('M-56 0H56V10H-56Z', C.grey) +
    shape('M-46 0V-50H46V0Z', C.brown) +
    `<path d="M-46 0V-50H46V0Z" fill="${C.ink}" opacity=".5"/>` +
    lattice(-40, 40, -40, -8, C.brown, 0.8, 1.2, 3) +
    `<path d="M-42 0V-50M-14 0V-50M14 0V-50M42 0V-50" ${line(6, C.brown)}/>` +
    shape('M-60 -48L60 -48L52 -58L-52 -58Z', C.ink, 'opacity=".75"') +
    shape('M-40 -58V-88H40V-58Z', C.brown) +
    `<path d="M-30 -66v-14h10v14Z M20 -66v-14h10v14Z" fill="${C.ink}" opacity=".45"/>` +
    `<path d="M-48 -60H48" ${line(3, C.red, 0.6)}/><path d="M-48 -64H48" fill="none" stroke="${C.red}" stroke-width="6" stroke-dasharray="1.4 5" stroke-opacity=".5"/>` +
    shape('M-74 -84C-50 -88 -40 -100 -30 -116L30 -116C40 -100 50 -88 74 -84L66 -80L-66 -80Z', C.ink, 'opacity=".8"') +
    shape('M-14 -116L0 -132L14 -116Z', C.brown) +
    `<path d="M-16 -116L0 -134L16 -116M-34 -116H34" ${line(2.4, C.ink, 0.8)}/>` +
    '</g>'
  )
}
/** 杉の大木：根元の広がった太い幹（[x, 太さ]）、樹皮の縦の筋、右側の影 */
const sugi = (list: number[][], op = 1) =>
  `<path d="${list.map(([x, w]) => `M${f(x - w * 0.9)} 326C${f(x - w * 0.55)} 316 ${f(x - w / 2)} 300 ${f(x - w / 2)} 280L${f(x - w * 0.4)} -10H${f(x + w * 0.4)}L${f(x + w / 2)} 280C${f(x + w / 2)} 300 ${f(x + w * 0.55)} 316 ${f(x + w * 0.9)} 326Z`).join('')}" fill="${C.brown}" opacity="${op}" ${E}/>` +
  `<path d="${list.map(([x, w]) => `M${f(x + w * 0.1)} 300L${f(x + w * 0.1)} -10H${f(x + w * 0.4)}L${f(x + w / 2)} 280C${f(x + w / 2)} 300 ${f(x + w * 0.55)} 316 ${f(x + w * 0.9)} 326H${f(x + w * 0.2)}Z`).join('')}" ${SH}/>` +
  `<path d="${list.map(([x, w]) => `M${f(x - w * 0.25)} 296V20M${f(x - w * 0.05)} 250V-10M${f(x + w * 0.22)} 310V60`).join('')}" ${line(1.2, C.ink, 0.18)}/>`
function eiheiji(): string {
  return (
    sky(C.blue, 0.16) +
    pines([[110, 290, 70], [150, 286, 90], [190, 292, 74], [230, 288, 84], [270, 294, 66], [60, 292, 60]], C.green, 0.25) +
    pines([[90, 300, 56], [170, 304, 60], [210, 300, 70], [250, 306, 52]], C.green, 0.4) +
    sugi([[150, 16], [182, 12], [118, 12]], 0.45) +
    // 右：山の斜面を上がっていく回廊（階段の屋根と柱）
    shape('M188 300L310 214V226L192 308Z', C.ink, 'opacity=".72"') +
    shape('M192 308L310 226V268L196 330Z', C.cream) +
    `<path d="${[0, 1, 2, 3, 4, 5].map((i) => `M${200 + i * 20} ${f(304 - i * 14)}V${f(326 - i * 13)}`).join('')}" ${line(3, C.brown)}/>` +
    `<path d="M196 330L310 268" ${line(3, C.brown)}/><path d="M194 318L310 248" ${line(1.4, C.brown, 0.6)}/>` +
    `<g transform="translate(76 304) scale(1.12) translate(-76 -304)">${sanmon(76, 304)}</g>` +
    sugi([[0, 30], [222, 24], [276, 34]]) +
    blobs(C.green, 1, [[10, 10, 56, 40, 9], [100, -10, 60, 34, 9, 1], [200, -6, 60, 38, 9, 2], [290, 16, 50, 44, 9, 0.5]]) +
    blobs(C.matcha, 0.55, [[40, 34, 26, 12, 7], [250, 46, 30, 12, 7, 1], [150, 18, 24, 10, 7, 2]]) +
    ground(C.matcha, 322, 0.6) +
    shape('M128 400L144 322H158L174 400Z', C.grey, 'opacity=".55"') +
    `<path d="M140 340H162M136 360H166M132 382H170" ${line(1.2, C.white, 0.5)}/>` +
    dots([[30, 336, 3], [60, 350, 2.4], [96, 372, 3], [210, 344, 2.6], [240, 366, 3], [280, 350, 2.4], [262, 390, 3], [40, 390, 2.6]], C.green, 0.5)
  )
}

/** 越前大野城：亀山の上の天守（大天守と小天守、最上階に廻縁）。x 大天守の中心、y 石垣の下 */
function onojo(x: number, y: number): string {
  return (
    `<g transform="translate(${x} ${y})">` +
    shape('M-30 0L-26 -14H22L26 0Z', C.grey) +
    `<path d="M-24 -9H20M-26 -4H24" ${line(1, C.ink, 0.25)}/>` +
    shape('M-28 -14V-26H-10V-14Z', C.white) +
    shape('M-32 -25L-6 -25L-9 -31L-29 -31Z', C.ink, 'opacity=".8"') +
    shape('M-12 -14V-32H18V-14Z', C.white) +
    shape('M-16 -31L22 -31L18 -38L-12 -38Z', C.ink, 'opacity=".8"') +
    shape('M-8 -37V-48H14V-37Z', C.white) +
    shape('M-12 -47L18 -47L14 -53L-8 -53Z', C.ink, 'opacity=".8"') +
    shape('M-4 -52V-60H10V-52Z', C.white) +
    `<path d="M-7 -53H13" ${line(1.4, C.ink, 0.7)}/>` +
    shape('M-8 -59L14 -59L9 -67L-3 -67Z', C.ink, 'opacity=".85"') +
    `<path d="M-3 -67c-1 -2 0 -4 2 -4M9 -67c1 -2 0 -4 -2 -4" ${line(1.4, C.gold)}/>` +
    `<path d="M-8 -24h4v4h-4ZM4 -24h4v4h-4ZM-24 -22h4v3h-4ZM0 -44h4v3h-4Z" fill="${C.ink}" opacity=".55"/>` +
    `<path d="M14 -14V-32h4V-14Z" ${SH}/>` +
    '</g>'
  )
}
function onoUnkai(): string {
  return (
    sky(C.blue, 0.2) +
    sun(206, 104, 40, C.yellow, 0.2) +
    sun(206, 104, 12, C.yellow, 0.8) +
    ridge([[-10, 214], [40, 196], [100, 206], [160, 190], [210, 194], [240, 166], [262, 134], [282, 164], [300, 184], [310, 190]], C.blue, 0.32, 260, false) +
    ridge([[-10, 236], [30, 222], [80, 230], [130, 216], [170, 228], [220, 214], [310, 226]], C.blue, 0.22, 270) +
    blobs(C.green, 0.85, [[230, 240, 50, 18, 9], [70, 250, 20, 8, 7, 1]]) +
    blobs(C.orange, 0.85, [[194, 238, 13, 8, 6], [262, 236, 15, 9, 6, 1]]) +
    blobs(C.red, 0.8, [[208, 246, 11, 6, 6, 2], [274, 246, 11, 6, 6]]) +
    `<g transform="translate(228 232) scale(1.25) translate(-228 -232)">${onojo(228, 232)}</g>` +
    blobs(C.white, 1, [[20, 262, 40, 14, 8], [96, 258, 44, 16, 8, 1], [170, 262, 44, 14, 8, 2], [246, 262, 50, 16, 8, 0.6], [300, 258, 30, 14, 7]]) +
    `<rect y="262" width="300" height="60" fill="${C.white}"/>` +
    blobs(C.white, 1, [[40, 290, 50, 14, 8, 1], [150, 286, 50, 14, 8], [260, 292, 50, 14, 8, 2]]) +
    `<path d="M0 274C50 270 100 276 150 272S250 276 300 272M0 300C60 296 120 302 180 298S260 302 300 298" ${line(3, C.blue, 0.12)}/>` +
    // 手前：戌山の展望地と紅葉の枝
    shape('M-5 312Q60 316 150 326T305 310V405H-5Z', C.matcha) +
    shape('M-5 326Q80 330 150 336T305 324V405H-5Z', C.brown, 'opacity=".35"') +
    `<path d="M-5 326Q80 330 150 336T305 324V405H-5Z" fill="${C.orange}" opacity=".12"/>` +
    `<path d="M20 316l2 -6M28 317l-1 -7M84 320l2 -6M200 324l2 -6M208 324l-1 -7M262 318l2 -6M270 317l-1 -6" ${line(1.4, C.green, 0.8)}/>` +
    `<path d="M-6 112C20 120 40 136 54 160M14 120C22 106 34 98 50 96M30 132C44 130 60 132 74 140" ${line(4, C.brown)}/>` +
    blobs(C.red, 0.95, [[46, 92, 20, 12, 8], [8, 112, 18, 14, 8, 1], [56, 158, 16, 11, 7, 2]]) +
    blobs(C.orange, 0.95, [[26, 140, 16, 11, 7, 0.4], [76, 136, 14, 9, 7, 1.3], [-2, 150, 12, 10, 6]]) +
    blobs(C.yellow, 0.9, [[64, 116, 10, 7, 6, 0.8]]) +
    dots([[30, 344, 2.4], [70, 360, 2], [110, 378, 2.4], [240, 362, 2.4], [272, 384, 2], [180, 392, 2.4]], C.red, 0.7) +
    dots([[94, 350, 2.4], [220, 342, 2.4], [256, 356, 2], [40, 386, 2]], C.orange, 0.8)
  )
}

const FUKUI: Outfit[] = [
  // 東尋坊（data/spots/fukui.json wd-Q648937，https://zh.wikipedia.org/wiki/%E6%9D%B1%E5%B0%8B%E5%9D%8A）：日本海に沈む夕日、柱状節理の断崖、波しぶき、沖の雄島
  bg({
    id: 'bg-fukui-tojinbo',
    name: '東尋坊',
    pref: 'fukui',
    rarity: 3,
    art: tojinbo(),
  }),
  // 永平寺（data/spots/fukui.json wd-Q1303633，https://zh.wikipedia.org/wiki/%E6%B0%B8%E5%B9%B3%E5%AF%BA）：杉の大木に囲まれた山門、斜面を上がる回廊、苔むした参道
  bg({
    id: 'bg-fukui-eiheiji',
    name: '永平寺',
    pref: 'fukui',
    rarity: 2,
    art: eiheiji(),
  }),
  // 大野城（data/spots/fukui.json wd-Q1072530，https://zh.wikipedia.org/wiki/%E5%A4%A7%E9%87%8E%E5%9F%8E_%28%E8%B6%8A%E5%89%8D%E5%9C%8B%29）：秋の朝、雲海に浮かぶ亀山の天守、奥の荒島岳、手前の紅葉
  bg({
    id: 'bg-fukui-onojo',
    name: '越前大野城',
    pref: 'fukui',
    rarity: 1,
    art: onoUnkai(),
  }),
]


export const BG: Outfit[] = [...NIIGATA, ...TOYAMA, ...ISHIKAWA, ...FUKUI]
