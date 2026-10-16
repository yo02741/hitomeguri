import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, ripples, SH, shape, sky, sun, tree } from './kit'

/**
 * 地區背景：山梨、長野、岐阜、静岡、愛知。題材取自 data/spots 的景點（高山祭取自 data/festivals），
 * 出處是那筆資料的 summary.source_url。富士山在山梨從北邊（新倉山淺間公園）看、在静岡從南邊（三保松原）看。
 */

type Pt = [number, number]
const r = (v: number) => +v.toFixed(1)
/** 0–1 的固定亂數（同一個 seed 每次一樣） */
const rnd = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}
/** 散落的小點（雪、星）：n 個、seed、範圍 w×h，兩種大小各一個 path */
const specks = (n: number, seed: number, w: number, h: number, size: number, fill: string, op = 1) =>
  [0, 1]
    .map((k) => `<path d="${Array.from({ length: n / 2 }, (_, i) => `M${Math.round(rnd(seed + i * 2 + k) * w)} ${Math.round(rnd(seed + 99 + i * 2 + k) * h)}h0.1`).join('')}" ${line(size * (k ? 1.6 : 1), fill, op)}/>`)
    .join('')
/** 淡一點的陰影（SH 是 .16） */
const sh = (op: number) => `fill="${C.ink}" opacity="${op}"`
const P = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)} ${Math.round(y)}`).join('') + 'Z'
/** 凹凸的一團（樹冠、櫻花、紅葉、灌木）的 path：沿著橢圓一圈 k 個小圓弧 */
function blobD(cx: number, cy: number, rx: number, ry: number, k: number, seed = 1): string {
  const pts: Pt[] = []
  for (let i = 0; i < k; i++) {
    const a = Math.PI + (i / k) * Math.PI * 2
    const j = 0.9 + 0.16 * rnd(seed + i)
    pts.push([Math.round(cx + Math.cos(a) * rx * j), Math.round(cy + Math.sin(a) * ry * j)])
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < k; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % k]
    const rr = Math.round(Math.hypot(x1 - x0, y1 - y0) * 0.6)
    d += `A${rr} ${rr} 0 0 1 ${x1} ${y1}`
  }
  return d + 'Z'
}
const blob = (cx: number, cy: number, rx: number, ry: number, k: number, fill: string, op = 1, seed = 1, edge = true) =>
  `<path d="${blobD(cx, cy, rx, ry, k, seed)}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}${edge ? ' ' + E : ''}/>`
/** 同色的幾團合成一個 path：[cx, cy, rx, ry, k, seed] */
const blobs = (list: number[][], fill: string, op = 1) =>
  `<path d="${list.map(([cx, cy, rx, ry, k, seed]) => blobD(cx, cy, rx, ry, k, seed)).join('')}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''} ${E}/>`
/** 花木（櫻、紅葉）：[x, y 樹根, s 大小, seed]，樹幹、樹冠、右下的陰影、左上的亮面各合成一個 path */
function blooms(list: number[][], fill: string, hi: string = C.white): string {
  let trunk = ''
  let crown = ''
  let shade = ''
  let light = ''
  for (const [x, y, s, seed] of list) {
    trunk += P([[x - 2.5 * s, y], [x - 1.4 * s, y - 18 * s], [x + 1.4 * s, y - 18 * s], [x + 2.5 * s, y]])
    crown += blobD(x, y - 28 * s, 19 * s, 14 * s, 9, seed)
    shade += blobD(x + 7 * s, y - 22 * s, 10 * s, 6 * s, 6, seed + 3)
    light += blobD(x - 5 * s, y - 34 * s, 9 * s, 5 * s, 6, seed + 9)
  }
  return shape(trunk, C.brown) + shape(crown, fill) + `<path d="${shade}" ${sh(0.1)}/><path d="${light}" fill="${hi}" opacity=".35"/>`
}

/** 二次曲線上的點 */
const q = (a: Pt, b: Pt, c: Pt, t: number): Pt => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]
/** 富士山：山頂平平的一段（cx 為中心、寬 tw），兩側內凹的山腳到 base（寬 bw）；snow 是雪線的 y */
function fuji(cx: number, top: number, tw: number, bw: number, base: number, snow: number, fill: string, op: number): string {
  const h = base - top
  const lS: Pt = [cx - tw / 2, top]
  const rS: Pt = [cx + tw / 2, top]
  const lB: Pt = [cx - bw / 2, base]
  const rB: Pt = [cx + bw / 2, base]
  const lC: Pt = [lS[0] - (lS[0] - lB[0]) * 0.16, top + h * 0.6]
  const rC: Pt = [rS[0] + (rB[0] - rS[0]) * 0.16, top + h * 0.6]
  // 山頂的小凹凸（火口緣）
  const crest = `L${r(lS[0] + tw * 0.25)} ${r(top - 1.5)} L${r(cx)} ${r(top + 1)} L${r(rS[0] - tw * 0.22)} ${r(top - 2)}`
  const body = `M${r(lB[0])} ${base} Q${r(lC[0])} ${r(lC[1])} ${r(lS[0])} ${top} ${crest} L${r(rS[0])} ${top} Q${r(rC[0])} ${r(rC[1])} ${r(rB[0])} ${base}Z`
  // 雪：左右兩條稜線上找到雪線的 t，下緣是長短不一的雪溝
  const tAt = (B: Pt, Cc: Pt, S: Pt) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2
      if (q(B, Cc, S, m)[1] > snow) lo = m
      else hi = m
    }
    return lo
  }
  const tl = tAt(lB, lC, lS)
  const tr = tAt(rB, rC, rS)
  const left: Pt[] = []
  for (let i = 0; i <= 6; i++) left.push(q(lB, lC, lS, tl + ((1 - tl) * i) / 6))
  const right: Pt[] = []
  for (let i = 6; i >= 0; i--) right.push(q(rB, rC, rS, tr + ((1 - tr) * i) / 6))
  const a = left[0]
  const b = right[right.length - 1]
  // 雪溝：細長的白線往下伸，長短不一
  const teeth: Pt[] = []
  const m = 9
  for (let i = 1; i <= m; i++) {
    const xc = b[0] + ((a[0] - b[0]) * i) / (m + 1) + (rnd(i + cx) - 0.5) * 6
    const w = Math.min(3.5 + rnd(i * 7 + cx) * 4, ((b[0] - a[0]) / (m + 1)) * 0.45)
    const dep = 6 + rnd(i * 13 + cx) * (i % 3 ? 16 : 30)
    teeth.push([xc + w, snow - 3 + rnd(i * 5) * 5], [xc + 1, snow + dep], [xc - 1.5, snow + dep - 3], [xc - w, snow - 2 + rnd(i * 3) * 5])
  }
  const cap = P([...left, ...right, ...teeth])
  return (
    `<path d="${body}" fill="${fill}" opacity="${op}" ${E}/>` +
    `<path d="${cap}" fill="${C.white}" ${E}/>` +
    // 右半邊的陰影（光從左上來）
    `<path d="M${r(cx + tw / 2)} ${top} Q${r(rC[0])} ${r(rC[1])} ${r(rB[0])} ${base} L${r(cx + bw * 0.12)} ${base} Q${r(cx + tw * 0.2)} ${r(top + h * 0.5)} ${r(cx + tw * 0.1)} ${top + 1}Z" ${sh(0.07)}/>`
  )
}

// ---------- 山梨 ----------
/** 忠靈塔（新倉山淺間公園的五重塔）：x 中心、y 台基、s 大小 */
function chureito(x: number, y: number, s = 1): string {
  let body = ''
  let shade = ''
  let roof = ''
  let rafter = ''
  let bottom = y - 6 * s
  for (let i = 0; i < 5; i++) {
    const bw = (22 - i * 2) * s
    const rw = (50 - i * 4.5) * s
    const top = bottom - (i === 0 ? 18 : 12) * s
    body += P([[x - bw / 2, bottom], [x - bw / 2, top], [x + bw / 2, top], [x + bw / 2, bottom]])
    shade += P([[x + bw / 2 - 4.5 * s, bottom], [x + bw / 2 - 4.5 * s, top], [x + bw / 2, top], [x + bw / 2, bottom]])
    // 屋簷：兩端微微翹起，下緣一條朱色的椽
    roof += `M${r(x - rw / 2)} ${r(top - 1 * s)} C${r(x - rw / 4)} ${r(top - 2 * s)} ${r(x - rw / 6)} ${r(top - 7 * s)} ${r(x)} ${r(top - 7 * s)} C${r(x + rw / 6)} ${r(top - 7 * s)} ${r(x + rw / 4)} ${r(top - 2 * s)} ${r(x + rw / 2)} ${r(top - 1 * s)} L${r(x + rw / 2 - 3 * s)} ${r(top + 3 * s)} L${r(x - rw / 2 + 3 * s)} ${r(top + 3 * s)}Z`
    rafter += `M${r(x - rw / 2 + 4 * s)} ${r(top + 3.4 * s)} L${r(x + rw / 2 - 4 * s)} ${r(top + 3.4 * s)}`
    bottom = top - 7 * s
  }
  let rings = `M${x} ${r(bottom + 2 * s)} L${x} ${r(bottom - 30 * s)}`
  for (let i = 0; i < 8; i++) rings += `M${r(x - 3.5 * s)} ${r(bottom - (4 + i * 3) * s)} L${r(x + 3.5 * s)} ${r(bottom - (4 + i * 3) * s)}`
  return (
    shape(P([[x - 22 * s, y], [x + 22 * s, y], [x + 20 * s, y - 6 * s], [x - 20 * s, y - 6 * s]]), C.grey) +
    shape(body, C.red) +
    `<path d="${shade}" ${SH}/>` +
    shape(roof, C.ink) +
    `<path d="${rafter}" ${line(1.2 * s, C.red, 0.9)}/>` +
    `<path d="${rings}" ${line(1.4 * s, C.gold)}/>`
  )
}
/** 昇仙峽的覺圓峰：圓頭的花崗岩峰，一塊塊疊起來的節理、直的裂紋 */
function kakuenpo(): string {
  const d = 'M6 304 C10 260 12 220 20 196 C16 176 26 160 34 152 C34 140 44 130 58 130 C70 128 82 134 88 146 C98 152 102 168 100 184 C108 204 110 250 120 304Z'
  return (
    `<path d="${d}" fill="${C.grey}" opacity=".6" ${E}/><path d="${d}" fill="${C.white}" opacity=".3"/>` +
    // 右側的陰面
    `<path d="M76 132 C84 136 88 142 88 146 C98 152 102 168 100 184 C108 204 110 250 120 304 L84 304 C90 260 86 210 90 186 C92 168 84 148 76 132Z" ${SH}/>` +
    // 橫的節理與直的裂紋
    `<path d="M36 156 C52 150 74 152 90 150 M22 198 C44 190 76 192 100 186 M14 248 C40 240 80 244 106 238 M50 134 C46 150 48 170 44 196 M70 136 C72 160 66 176 68 198 M34 204 C30 226 32 240 30 252 M60 196 C62 214 58 230 60 244 M84 194 C86 214 84 228 88 240 M44 252 C42 270 44 286 40 302 M78 248 C80 266 76 286 80 302" ${line(1.3, C.ink, 0.2)}/>`
  )
}
/** 小松：彎的樹幹＋幾層平平的葉團（岩頂、海岸） */
function pine(x: number, y: number, s = 1, lean = 0): string {
  const tx = x + lean * s
  let pad = ''
  let sh = ''
  for (const [px, py, w] of [[tx, y - 36 * s, 13], [tx - 12 * s, y - 26 * s, 10], [tx + 11 * s, y - 22 * s, 10]] as const) {
    pad += `M${r(px - w * s)} ${r(py + 3 * s)} C${r(px - w * 0.8 * s)} ${r(py - 5 * s)} ${r(px + w * 0.7 * s)} ${r(py - 6 * s)} ${r(px + w * s)} ${r(py + 3 * s)}Z`
    sh += `M${r(px)} ${r(py + 3 * s)} L${r(px + w * s)} ${r(py + 3 * s)} C${r(px + w * 0.8 * s)} ${r(py - 1 * s)} ${r(px + w * 0.4 * s)} ${r(py - 2 * s)} ${r(px)} ${r(py + 3 * s)}Z`
  }
  return (
    `<path d="M${x} ${y} C${r(x + lean * 0.2 * s)} ${r(y - 14 * s)} ${r(tx - 4 * s)} ${r(y - 22 * s)} ${r(tx)} ${r(y - 34 * s)} M${r(tx - 1 * s)} ${r(y - 24 * s)} L${r(tx - 11 * s)} ${r(y - 24 * s)} M${r(tx)} ${r(y - 20 * s)} L${r(tx + 10 * s)} ${r(y - 20 * s)}" ${line(2.6 * s, C.brown)}/>` +
    shape(pad, C.green) +
    `<path d="${sh}" ${SH}/>`
  )
}
/** 猿橋的刎木：岩壁伸出四層木樑（越上面伸得越長），樑頭各有小屋頂；x0 岩壁、dir 往橋的方向、y 橋面 */
function hanegi(x0: number, y: number, dir: 1 | -1): string {
  let beam = ''
  let shd = ''
  let roof = ''
  for (let i = 0; i < 4; i++) {
    const yy = y + 14 + i * 10
    const x1 = x0 + dir * (50 - i * 11)
    const w0 = x0 - dir * 6
    beam += P([[w0, yy + 10], [x1, yy + 1], [x1, yy - 3], [w0, yy + 5]])
    shd += P([[w0, yy + 10], [x1, yy + 1], [x1, yy - 0.5], [w0, yy + 8]])
    // 樑上蓋的板屋頂：順著樑，前端多伸出一點、往下折
    roof += P([[w0, yy + 3], [x1 + dir * 3, yy - 5], [x1 + dir * 4, yy - 1], [x1 + dir * 1, yy - 2.5], [w0, yy + 6]])
  }
  return shape(beam, C.brown) + `<path d="${shd}" ${SH}/>` + shape(roof, C.ink)
}

const YAMANASHI: Outfit[] = [
  // 新倉山浅間公園（data/spots/yamanashi.json wd-Q21652375，https://zh.wikipedia.org/wiki/%E6%96%B0%E5%80%89%E5%B1%B1%E6%B7%BA%E9%96%93%E5%85%AC%E5%9C%92）：山腰的五重塔（忠靈塔）、滿山的櫻花，右後方的富士山與山腳的富士吉田街區
  bg({
    id: 'bg-yamanashi-arakurayama',
    name: '新倉山淺間公園',
    pref: 'yamanashi',
    rarity: 3,
    art:
      sky(C.blue, 0.24) +
      cloud(70, 70, 1.1) +
      cloud(150, 30, 0.7, 0.7) +
      fuji(232, 122, 32, 370, 300, 184, C.blue, 0.6) +
      ridge([[-10, 292], [40, 280], [90, 288], [150, 282], [210, 290], [260, 284], [310, 292]], C.green, 0.35, 322) +
      // 山腳的街區：淡淡一排屋頂
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${i * 22 - 4} 300 L${i * 22 + 1} ${292 - (i % 3) * 3} L${i * 22 + 13} ${292 - (i % 3) * 3} L${i * 22 + 18} 300Z`).join('')}" fill="${C.grey}" opacity=".45"/>` +
      // 新倉山的山坡：塔立在山腰
      ridge([[-10, 236], [30, 246], [80, 268], [130, 290], [170, 304]], C.green, 0.5, 322) +
      blobs([[24, 250, 34, 20, 9, 3], [116, 292, 30, 14, 8, 5]], C.pink, 0.85) +
      chureito(62, 302, 1.12) +
      // 塔前、右邊的櫻
      blooms([[20, 332, 1.5, 11], [100, 332, 1.25, 21], [236, 332, 1.7, 31], [284, 326, 1.3, 41]], C.pink) +
      // 右上角垂下來的櫻枝
      `<path d="M300 20 C270 30 250 46 228 52 M262 38 C256 54 252 66 244 74" ${line(3, C.brown)}/>` +
      blobs([[232, 56, 16, 9, 7, 51], [250, 74, 12, 8, 6, 61], [276, 32, 18, 10, 7, 71]], C.pink) +
      ground(C.matcha, 320, 0.32) +
      `<path d="M0 320 L300 320" ${line(3, C.brown, 0.18)}/>` +
      // 落在地上的花瓣
      `<path d="${Array.from({ length: 16 }, (_, i) => `M${r(10 + rnd(i + 80) * 280)} ${r(334 + rnd(i + 90) * 60)}h4`).join('')}" ${line(2.4, C.pink)}/>`,
  }),
  // 昇仙峡（data/spots/yamanashi.json wd-Q9336171，https://zh.wikipedia.org/wiki/%E6%98%87%E4%BB%99%E5%B3%BD）：左邊圓頭的花崗岩峰（覺圓峰）、右邊的岩壁，滿谷紅葉與荒川的溪流、河床的圓石
  bg({
    id: 'bg-yamanashi-shosenkyo',
    name: '昇仙峽',
    pref: 'yamanashi',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(150, 70, 1.1) +
      cloud(256, 40, 0.7, 0.8) +
      ridge([[-10, 236], [60, 210], [150, 196], [230, 206], [310, 220]], C.navy, 0.14, 300) +
      ridge([[40, 262], [120, 236], [190, 244], [260, 230]], C.green, 0.25, 300) +
      kakuenpo() +
      pine(50, 136, 0.62, 3) +
      pine(74, 134, 0.5, -4) +
      // 右邊的岩壁
      `<path d="M304 140 C290 140 278 156 270 176 C262 196 258 214 248 236 C238 258 232 280 226 304 L304 304Z" fill="${C.grey}" opacity=".55" ${E}/>` +
      `<path d="M304 170 C292 186 284 214 278 244 L272 304 L304 304Z" ${SH}/>` +
      `<path d="M282 160 C276 190 272 210 262 236 M296 196 C290 220 286 250 284 280" ${line(1.3, C.ink, 0.2)}/>` +
      pine(288, 148, 0.55, -3) +
      // 紅葉：岩腳到溪邊、岩上
      blobs([[272, 206, 20, 15, 8, 6], [18, 278, 26, 26, 9, 12], [26, 200, 10, 6, 6, 2]], C.orange) +
      blobs([[250, 260, 30, 24, 9, 8], [116, 294, 26, 14, 8, 14], [102, 240, 9, 6, 6, 3]], C.red) +
      blobs([[290, 280, 24, 22, 8, 10], [176, 296, 34, 12, 8, 16]], C.yellow, 0.85) +
      blooms([[42, 318, 1.25, 18]], C.red, C.yellow) +
      blooms([[260, 320, 1.4, 20]], C.orange, C.yellow) +
      // 荒川：岩間的溪流
      `<rect y="300" width="300" height="22" fill="${C.blue}" opacity=".42"/>` +
      ripples([[60, 306], [130, 312], [196, 306], [240, 314], [100, 318]], 16, 0.7) +
      ground(C.grey, 320, 0.36) +
      // 河床的圓石：灰的一塊，上面一道亮面
      shape([[30, 346, 26, 14], [262, 352, 30, 15], [96, 388, 18, 9], [218, 386, 22, 10]].map(([x, y, w, h]) => `M${x - w} ${y} C${x - w} ${y - h} ${x + w * 0.6} ${y - h * 1.1} ${x + w} ${y}Z`).join(''), C.grey, 'opacity=".75"') +
      `<path d="M8 340 Q18 334 30 334 M238 345 Q248 339 262 339 M82 384 Q90 381 98 381 M200 381 Q210 377 218 377" ${line(2, C.white, 0.6)}/>` +
      `<path d="${Array.from({ length: 10 }, (_, i) => `M${r(14 + rnd(i + 3) * 272)} ${r(356 + rnd(i + 7) * 40)}h3`).join('')}" ${line(3, C.red)}/>`,
  }),
  // 猿橋（data/spots/yamanashi.json wd-Q4329112，https://en.wikipedia.org/wiki/Saruhashi_Bridge）：桂川峽谷兩邊的岩壁，一層層伸出的刎木與上面的小屋頂撐起木橋，夏天的綠
  bg({
    id: 'bg-yamanashi-saruhashi',
    name: '猿橋',
    pref: 'yamanashi',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(150, 52, 1.1) +
      ridge([[-10, 150], [70, 128], [150, 140], [230, 124], [310, 146]], C.green, 0.3, 300) +
      // 峽谷裡面：往深處收窄的岩壁與樹
      `<path d="M30 140 C70 170 90 220 110 300 L30 300Z M270 140 C230 170 210 220 190 300 L270 300Z" fill="${C.grey}" opacity=".35"/>` +
      `<path d="${blobD(96, 214, 22, 30, 8, 2)}${blobD(206, 222, 22, 32, 8, 4)}" fill="${C.green}" opacity=".5"/>` +
      // 谷底的水面
      `<rect y="288" width="300" height="34" fill="${C.green}" opacity=".3"/><rect y="288" width="300" height="34" fill="${C.blue}" opacity=".2"/>` +
      ripples([[120, 298], [176, 306], [146, 314]], 18, 0.5) +
      // 左右的岩壁
      shape('M-4 128 L48 128 C54 160 44 196 54 236 C60 266 48 296 56 322 L-4 322Z M304 128 L252 128 C246 160 256 196 246 236 C240 266 252 296 244 322 L304 322Z', C.grey) +
      `<path d="M30 128 L48 128 C54 160 44 196 54 236 C60 266 48 296 56 322 L36 322 C30 290 40 256 34 220 C28 186 36 156 30 128Z M252 128 L268 128 C264 166 274 200 266 240 C260 270 270 300 264 322 L244 322 C252 296 240 266 246 236 C256 196 246 160 252 128Z" ${SH}/>` +
      `<path d="M16 170 L32 176 M22 230 L40 226 M14 276 L30 282 M38 150 C34 180 42 200 38 214 M272 180 L288 174 M268 240 L286 246 M274 290 L290 284 M262 150 C266 176 258 196 262 212" ${line(1.4, C.ink, 0.2)}/>` +
      blobs([[28, 210, 12, 8, 6, 6], [274, 262, 12, 8, 6, 8], [48, 112, 22, 16, 8, 5], [252, 110, 24, 16, 8, 7]], C.matcha) +
      blobs([[12, 116, 30, 22, 8, 3], [290, 116, 30, 22, 8, 9], [34, 318, 36, 22, 9, 13], [268, 318, 36, 22, 9, 15]], C.green) +
      // 橋：刎木＋橋面＋欄干
      hanegi(48, 124, 1) +
      hanegi(252, 124, -1) +
      shape('M38 120 Q150 112 262 120 L262 127 Q150 119 38 127Z', C.brown) +
      `<path d="M40 120 Q150 112 260 120" ${line(1.2, C.white, 0.5)}/>` +
      `<path d="M42 108 Q150 100 258 108${Array.from({ length: 16 }, (_, i) => { const x = 46 + i * 13.9; const y = 108 - Math.sin(((x - 42) / 216) * Math.PI) * 8; return ` M${r(x)} ${r(y)} L${r(x)} ${r(y + 11)}` }).join('')}" ${line(1.8, C.brown)}/>` +
      ground(C.matcha, 320, 0.36) +
      `<path d="M0 320 L300 320" ${line(3, C.green, 0.3)}/>` +
      `<path d="M30 352 L60 352 M220 372 L256 372 M110 390 L140 390" ${line(1.4, C.white, 0.5)}/>`,
  }),
]

// ---------- 長野 ----------
/** 雪山的稜線（尖的），每個山頭一塊雪；f 是雪往下蓋到兩邊稜線的比例 */
function alps(pts: Pt[], fill: string, op: number, base = 300, f = 0.38): string {
  let snow = ''
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    if (y >= pts[i - 1][1] || y >= pts[i + 1][1]) continue
    const a: Pt = [x + (pts[i - 1][0] - x) * f, y + (pts[i - 1][1] - y) * f]
    const b: Pt = [x + (pts[i + 1][0] - x) * f, y + (pts[i + 1][1] - y) * f]
    const lo = Math.max(a[1], b[1])
    snow += P([[x, y], b, [(x + b[0]) / 2 + 2, lo - 3], [x + 1, lo + 5], [(x + a[0]) / 2 - 1, lo - 4], a])
  }
  return ridge(pts, fill, op, base, false) + `<path d="${snow}" fill="${C.white}"/>`
}
/** 雪中的杉林：[x, y, s]，三層三角合成一個 path，頂上與下層積著雪 */
function firs(list: number[][], fill: string = C.green, op = 0.8): string {
  let tree = ''
  let snow = ''
  for (const [x, y, s] of list) {
    tree += P([[x, y - 46 * s], [x + 8 * s, y - 30 * s], [x + 5 * s, y - 30 * s], [x + 12 * s, y - 18 * s], [x + 8 * s, y - 18 * s], [x + 15 * s, y - 6 * s], [x - 15 * s, y - 6 * s], [x - 8 * s, y - 18 * s], [x - 12 * s, y - 18 * s], [x - 5 * s, y - 30 * s], [x - 8 * s, y - 30 * s]])
    snow += P([[x, y - 46 * s], [x + 5 * s, y - 36 * s], [x, y - 38 * s], [x - 5 * s, y - 36 * s]]) + P([[x - 8 * s, y - 22 * s], [x + 5 * s, y - 23 * s], [x + 11 * s, y - 15 * s], [x - 12 * s, y - 15 * s]])
  }
  return `<path d="${tree}" fill="${fill}" opacity="${op}" ${E}/><path d="${snow}" fill="${C.white}"/>`
}
/** 冒上來的熱氣：彎彎的一條紙，帶淡邊 */
const steam = (x: number, y: number, h: number, w = 7) =>
  `<path d="M${r(x - w / 2)} ${y} C${r(x - w * 2)} ${r(y - h * 0.3)} ${r(x + w * 1.6)} ${r(y - h * 0.55)} ${r(x - w * 0.4)} ${y - h} C${r(x + w * 2.4)} ${r(y - h * 0.55)} ${r(x - w * 0.6)} ${r(y - h * 0.3)} ${r(x + w / 2)} ${y}Z" fill="${C.white}" opacity=".75" ${E}/>`
/** 天守的一層一層：x 中心、y 最下層的底、ws 各層牆寬、hs 各層高；黑的下見板、上緣白漆喰、灰瓦屋簷，最上面是入母屋＋鯱 */
function tenshu(x: number, y: number, ws: number[], hs: number[], wall: string, band: string, roofFill: string, gables: number[] = []): string {
  let body = ''
  let white = ''
  let roof = ''
  let gab = ''
  let gabFace = ''
  let shd = ''
  let b = y
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i]
    const t = b - hs[i]
    const last = i === ws.length - 1
    body += P([[x - w / 2, b], [x - w / 2, t], [x + w / 2, t], [x + w / 2, b]])
    white += P([[x - w / 2, t + hs[i] * 0.34], [x - w / 2, t], [x + w / 2, t], [x + w / 2, t + hs[i] * 0.34]])
    shd += P([[x + w / 2 - w * 0.18, b], [x + w / 2 - w * 0.18, t], [x + w / 2, t], [x + w / 2, b]])
    const ew = w + Math.max(5, w * 0.2)
    const nw = last ? w * 0.3 : ws[i + 1] + 2
    const rt = last ? t - w * 0.38 : t - Math.max(2.5, w * 0.09)
    roof += P([[x - ew / 2 - 2, t + 0.5], [x - nw / 2, rt], [x + nw / 2, rt], [x + ew / 2 + 2, t + 0.5], [x + ew / 2 - 2, t + 4], [x - ew / 2 + 2, t + 4]])
    if (gables.includes(i)) {
      const gw = Math.min(w * 0.42, 18)
      gab += P([[x - gw - 3, t + 1], [x, t - gw * 0.8 - 2], [x + gw + 3, t + 1], [x + gw, t + 2], [x, t - gw * 0.8 + 2], [x - gw, t + 2]])
      gabFace += P([[x - gw + 1, t + 1.5], [x, t - gw * 0.8 + 3], [x + gw - 1, t + 1.5]])
    }
    if (last) gab += `M${r(x - nw / 2)} ${r(rt)} l${r(-w * 0.1)} ${r(-w * 0.16)} l${r(w * 0.12)} ${r(w * 0.03)} l${r(w * 0.06)} ${r(w * 0.13)}Z M${r(x + nw / 2)} ${r(rt)} l${r(w * 0.1)} ${r(-w * 0.16)} l${r(-w * 0.12)} ${r(w * 0.03)} l${r(-w * 0.06)} ${r(w * 0.13)}Z`
    b = rt
  }
  return `<g ${E}><path d="${body}" fill="${wall}"/><path d="${white}" fill="${band}"/></g><path d="${shd}" ${SH}/><g ${E}><path d="${roof}" fill="${roofFill}"/>${gabFace ? `<path d="${gabFace}" fill="${band}"/>` : ''}<path d="${gab}" fill="${roofFill}"/></g>`
}
/** 石垣：下寬上窄、兩邊微彎，上面幾條石縫 */
const ishigaki = (x0: number, x1: number, top: number, bot: number) => {
  const a = Math.round(top + (bot - top) * 0.36)
  const b = Math.round(top + (bot - top) * 0.7)
  return (
    shape(`M${x0 - 6} ${bot} C${x0 - 2} ${bot - 12} ${x0 + 2} ${top + 8} ${x0 + 4} ${top} L${x1 - 4} ${top} C${x1 - 2} ${top + 8} ${x1 + 2} ${bot - 12} ${x1 + 6} ${bot}Z`, C.grey) +
    `<path d="M${x0} ${a}H${x1}M${x0 - 3} ${b}H${x1 + 3}${Array.from({ length: Math.floor((x1 - x0) / 14) }, (_, i) => `M${x0 + 7 + i * 14} ${top}V${a}M${x0 + i * 14} ${a}V${b}`).join('')}" ${line(1, C.ink, 0.18)}/>`
  )
}
/** 日本獼猴：x 中心、y 腳下（泡湯的是水面）、s 大小；頭上積一點雪 */
function monkey(x: number, y: number, s: number, bath = false): string {
  const k = (v: number) => r(v * s)
  const hy = y - (bath ? 14 : 34) * s
  const fur = bath
    ? `M${r(x - 15 * s)} ${y} C${r(x - 15 * s)} ${r(y - 10 * s)} ${r(x - 8 * s)} ${r(y - 12 * s)} ${x} ${r(y - 12 * s)} C${r(x + 8 * s)} ${r(y - 12 * s)} ${r(x + 15 * s)} ${r(y - 10 * s)} ${r(x + 15 * s)} ${y}Z`
    : `M${r(x - 14 * s)} ${y} C${r(x - 17 * s)} ${r(y - 18 * s)} ${r(x - 11 * s)} ${r(y - 28 * s)} ${x} ${r(y - 28 * s)} C${r(x + 11 * s)} ${r(y - 28 * s)} ${r(x + 17 * s)} ${r(y - 18 * s)} ${r(x + 14 * s)} ${y}Z`
  const head = `M${r(x - 11 * s)} ${r(hy)} a${k(11)} ${k(11.5)} 0 1 1 ${k(22)} 0 a${k(11)} ${k(10.5)} 0 1 1 ${k(-22)} 0Z`
  return (
    `<g opacity=".7">${shape(fur + head, C.brown)}</g>` +
    (bath ? '' : `<path d="M${r(x - 8 * s)} ${r(y - 8 * s)} Q${x} ${r(y - 3 * s)} ${r(x + 8 * s)} ${r(y - 8 * s)}" ${line(2.4 * s, C.ink, 0.15)}/>`) +
    shape(`M${x} ${r(hy - 6 * s)} C${r(x + 5 * s)} ${r(hy - 8 * s)} ${r(x + 7.5 * s)} ${r(hy - 3 * s)} ${r(x + 6.5 * s)} ${r(hy + 2 * s)} C${r(x + 6 * s)} ${r(hy + 6.5 * s)} ${r(x + 3 * s)} ${r(hy + 8 * s)} ${x} ${r(hy + 8 * s)} C${r(x - 3 * s)} ${r(hy + 8 * s)} ${r(x - 6 * s)} ${r(hy + 6.5 * s)} ${r(x - 6.5 * s)} ${r(hy + 2 * s)} C${r(x - 7.5 * s)} ${r(hy - 3 * s)} ${r(x - 5 * s)} ${r(hy - 8 * s)} ${x} ${r(hy - 6 * s)}Z`, C.pink) +
    `<path d="M${r(x - 5.5 * s)} ${r(hy - 1 * s)} Q${x} ${r(hy - 5 * s)} ${r(x + 5.5 * s)} ${r(hy - 1 * s)} L${r(x + 5 * s)} ${r(hy + 4 * s)} Q${x} ${r(hy + 7 * s)} ${r(x - 5 * s)} ${r(hy + 4 * s)}Z" fill="${C.red}" opacity=".45"/>` +
    `<path d="M${r(x - 2.6 * s)} ${r(hy + 0.5 * s)} h0.1 M${r(x + 2.6 * s)} ${r(hy + 0.5 * s)} h0.1" ${line(1.8 * s, C.ink)}/>` +
    `<path d="M${r(x - 8 * s)} ${r(hy - 8 * s)} Q${x} ${r(hy - 15 * s)} ${r(x + 8 * s)} ${r(hy - 8 * s)} Q${x} ${r(hy - 10 * s)} ${r(x - 8 * s)} ${r(hy - 8 * s)}Z" fill="${C.white}"/>`
  )
}
/** 妻籠宿的一排町家（透視）：side -1 左、1 右；往消失點 (150, 286) 收，近的一端在畫面外 */
function machiyaRow(side: -1 | 1): string {
  const V: Pt = [150, 286]
  const x0 = side < 0 ? -12 : 312
  const at = (y: number, t: number, dx = 0): Pt => [Math.round(x0 - side * dx * (1 - t) + (V[0] - x0) * t), Math.round(y + (V[1] - y) * t)]
  // 房子的分界：同樣深度的房子越遠越窄
  const T = [0, 1, 2, 3, 4, 5].map((d) => 1 - 1.5 / (1.5 + d))
  const band = (y0: number, y1: number, t0: number, t1: number, d0 = 0, d1 = 0) => P([at(y0, t0, d0), at(y0, t1, d0), at(y1, t1, d1), at(y1, t0, d1)])
  const seg = (a: Pt, b: Pt) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`
  let wall1 = ''
  let wall2 = ''
  let dark = ''
  let hisashi = ''
  let eave = ''
  let lattice = ''
  let lat2 = ''
  let posts = ''
  let noren = ''
  let lamp = ''
  for (let i = 0; i < T.length - 1; i++) {
    const [t0, t1] = [T[i], T[i + 1]]
    const up = (i % 2) * 6
    wall1 += band(338, 264, t0, t1)
    wall2 += band(250, 198 - up, t0, t1, 6, 6)
    // 二樓的雨戶（顏色深一點）與出格子
    if ((i + (side < 0 ? 0 : 1)) % 2) dark += band(244, 206 - up, t0 + (t1 - t0) * 0.1, t1 - (t1 - t0) * 0.1, 6, 6)
    hisashi += band(264, 254, t0, t1, 14, 6)
    eave += band(198 - up, 182 - up, t0, t1, 28, 8)
    posts += seg(at(338, t0), at(264, t0))
    for (let j = 1; j < 7; j++) {
      const t = t0 + ((t1 - t0) * j) / 7
      lattice += seg(at(326, t), at(270, t))
      if (j % 2) lat2 += seg(at(244, t, 6), at(206 - up, t, 6))
    }
    // 暖簾、掛在庇下的燈籠（點著）
    if (i < 3 && (i + (side < 0 ? 1 : 0)) % 2) noren += band(264, 290, t0 + (t1 - t0) * 0.2, t1 - (t1 - t0) * 0.25)
    if (i < 4) {
      const [lx, ly] = at(272, t0 + (t1 - t0) * 0.5, 10)
      const sz = r(1 - T[i] * 0.85)
      lamp += `M${lx} ${ly - 8 * sz}v${3 * sz}` + `<ellipse cx="${lx}" cy="${r(ly + 2 * sz)}" rx="${r(5 * sz)}" ry="${r(7 * sz)}"/>`
    }
  }
  const lampLine = lamp.replace(/<ellipse[^>]*>/g, '')
  const lampBody = lamp.match(/<ellipse[^>]*>/g)?.join('') ?? ''
  return (
    shape(wall1, C.brown) +
    `<path d="${lattice}" ${line(1.1, C.ink, 0.35)}/><path d="${posts}" ${line(2.4, C.ink, 0.45)}/>` +
    shape(wall2, C.brown) +
    `<path d="${dark}" ${sh(0.22)}/><path d="${lat2}" ${line(1.1, C.ink, 0.35)}/>` +
    shape(noren, C.navy) +
    shape(hisashi, C.ink, 'opacity=".8"') +
    shape(eave, C.ink, 'opacity=".85"') +
    `<path d="${lampLine}" ${line(1, C.ink, 0.6)}/><g fill="${C.yellow}" ${E}>${lampBody}</g>`
  )
}

const NAGANO: Outfit[] = [
  // 松本城（data/spots/nagano.json wd-Q739612，https://zh.wikipedia.org/wiki/%E6%9D%BE%E6%9C%AC%E5%9F%8E）：黑色的五重天守、左邊的乾小天守與渡櫓、右邊朱色欄杆的月見櫓，石垣與內堀、朱色的埋橋，後面的北阿爾卑斯雪山
  bg({
    id: 'bg-nagano-matsumoto-jo',
    name: '松本城',
    pref: 'nagano',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(64, 64, 1.1) +
      cloud(250, 40, 0.8, 0.85) +
      alps([[-10, 250], [20, 214], [48, 232], [80, 186], [112, 222], [150, 200], [186, 230], [214, 196], [250, 224], [282, 204], [310, 236]], C.blue, 0.4, 304) +
      ridge([[-10, 284], [60, 270], [140, 280], [220, 266], [310, 280]], C.green, 0.35, 304) +
      // 乾小天守、渡櫓
      ishigaki(140, 198, 264, 304) +
      tenshu(158, 264, [32, 27, 22], [20, 15, 15], C.ink, C.white, C.grey) +
      tenshu(186, 264, [22, 20], [16, 14], C.ink, C.white, C.grey) +
      // 月見櫓：朱色的回緣
      ishigaki(256, 312, 278, 304) +
      tenshu(270, 278, [28, 22], [18, 16], C.ink, C.white, C.grey) +
      shape('M282 278 L282 256 L312 256 L312 278Z', C.white) +
      `<path d="M282 266 L312 266 M284 266 L284 278 M291 266 L291 278 M298 266 L298 278 M305 266 L305 278" ${line(2, C.red)}/>` +
      shape('M276 257 L290 242 L312 242 L312 257Z', C.grey) +
      // 大天守
      ishigaki(192, 258, 272, 304) +
      tenshu(226, 272, [62, 54, 46, 38, 32], [30, 22, 20, 18, 22], C.ink, C.white, C.grey, [1, 3]) +
      // 內堀與倒影
      `<rect y="302" width="300" height="20" fill="${C.blue}" opacity=".5"/>` +
      `<path d="M196 304 L256 304 L246 322 L206 322Z M146 304 L196 304 L190 318 L152 318Z" fill="${C.ink}" opacity=".14"/>` +
      ripples([[40, 310], [130, 316], [220, 312], [270, 318]], 16, 0.6) +
      // 埋橋：朱色的拱橋
      shape('M18 306 Q62 282 106 306 L106 310 Q62 288 18 310Z', C.red) +
      `<path d="M22 296 Q62 274 102 296 M28 302 L28 294 M44 296 L44 285 M62 293 L62 282 M80 296 L80 285 M96 302 L96 294" ${line(2, C.red)}/>` +
      pine(40, 300, 0.9, 4) +
      ground(C.matcha, 322, 0.34) +
      `<path d="M0 322 L300 322" ${line(3, C.ink, 0.12)}/>` +
      `<path d="M20 350 L70 350 M226 366 L280 366 M100 388 L150 388" ${line(1.4, C.white, 0.5)}/>`,
  }),
  // 地獄谷野猿公苑（data/spots/nagano.json wd-Q5302436，https://zh.wikipedia.org/wiki/%E5%9C%B0%E7%8B%B1%E8%B0%B7%E9%87%8E%E7%8C%BF%E5%85%AC%E8%8B%91）：雪的山谷與杉林、冒著熱氣的岩邊露天溫泉，泡湯與坐在岩上的日本獼猴
  bg({
    id: 'bg-nagano-jigokudani',
    name: '地獄谷野猿公苑',
    pref: 'nagano',
    rarity: 2,
    art:
      sky(C.grey, 0.22) +
      alps([[-10, 200], [40, 150], [90, 176], [150, 140], [210, 172], [262, 146], [310, 180]], C.grey, 0.35, 300, 0.6) +
      // 雪的山谷：兩邊的坡
      `<path d="M-10 110 C40 140 90 214 140 304 L-10 304Z M310 130 C260 164 210 226 166 304 L310 304Z" fill="${C.white}" ${E}/>` +
      `<path d="M310 130 C260 164 210 226 166 304 L214 304 C240 250 272 200 310 172Z" ${sh(0.06)}/>` +
      firs([[8, 168, 0.6], [34, 186, 0.7], [62, 214, 0.6], [16, 222, 0.8], [44, 252, 0.9], [-2, 270, 0.9], [72, 284, 0.8]]) +
      firs([[284, 186, 0.6], [258, 206, 0.7], [296, 230, 0.8], [232, 238, 0.6], [268, 256, 0.9], [300, 282, 0.9], [240, 290, 0.8]]) +
      // 谷底的雪
      ridge([[-10, 304], [80, 296], [150, 302], [220, 294], [310, 304]], C.white, 1, 324) +
      ground(C.white, 324) +
      `<rect y="324" width="300" height="76" fill="${C.blue}" opacity=".07"/>` +
      // 溫泉：岩圍起來的池子＋熱氣（整組往右挪一點，桌機左邊會裁掉）
      '<g transform="translate(10 0)">' +
      blobs([[6, 324, 22, 12, 7, 2], [52, 320, 26, 10, 7, 4], [104, 326, 20, 11, 7, 6]], C.grey) +
      `<path d="M-20 318 Q2 306 26 316 M28 314 Q52 304 78 314 M86 320 Q104 312 122 320" ${line(5, C.white)}/>` +
      `<path d="M-20 334 C14 326 96 326 122 338 C128 352 104 370 56 372 C10 372 -20 362 -20 334Z" fill="${C.blue}" opacity=".45" ${E}/>` +
      monkey(30, 346, 1.4, true) +
      monkey(76, 350, 1.15, true) +
      `<path d="M-20 346 C30 352 90 352 124 346 C122 360 100 371 56 372 C10 372 -20 362 -20 346Z" fill="${C.blue}" opacity=".35"/>` +
      ripples([[30, 350], [78, 354], [52, 364]], 24, 0.75) +
      steam(20, 330, 70) +
      steam(64, 326, 90, 8) +
      steam(106, 332, 60, 6) +
      blobs([[118, 372, 16, 9, 6, 6], [20, 380, 20, 8, 6, 8]], C.grey) +
      `<path d="M104 366 Q118 359 132 366 M2 376 Q20 370 38 376" ${line(4, C.white)}/>` +
      '</g>' +
      // 右邊岩上坐著的猴子
      blob(252, 334, 32, 15, 7, C.grey, 1, 12) +
      `<path d="M222 328 Q252 315 282 328" ${line(5, C.white)}/>` +
      monkey(252, 326, 1.3) +
      specks(22, 200, 300, 300, 3, C.white),
  }),
  // 妻籠宿（data/spots/nagano.json wd-Q1079904，https://zh.wikipedia.org/wiki/%E5%A6%BB%E7%B1%A0%E5%AE%BF）：中山道的宿場，兩排木造的出格子町家、深的屋簷，黃昏點起的燈籠，後面木曾谷的山
  bg({
    id: 'bg-nagano-tsumago',
    name: '妻籠宿',
    pref: 'nagano',
    rarity: 1,
    art:
      sky(C.orange, 0.26, C.cream) +
      sun(244, 142, 16, C.yellow, 0.7) +
      cloud(70, 60, 1, 0.7) +
      cloud(200, 86, 0.8, 0.6) +
      ridge([[-10, 200], [60, 160], [130, 196], [200, 170], [310, 206]], C.navy, 0.2, 300) +
      // 木曾谷兩邊陡的山
      `<path d="M-10 112 C30 120 80 170 140 300 L-10 300Z M310 150 C270 156 220 190 160 300 L310 300Z" fill="${C.green}" opacity=".4" ${E}/>` +
      `<path d="M-10 150 C20 156 60 190 110 300 L-10 300Z" fill="${C.navy}" opacity=".15"/>` +
      // 路面：從消失點往前展開
      `<path d="M150 284 L-12 340 V400 H312 V340Z" fill="${C.cream}"/><path d="M150 284 L-12 340 V400 H312 V340Z" fill="${C.brown}" opacity=".2"/>` +
      ridge([[40, 260], [110, 228], [180, 236], [250, 222]], C.green, 0.3, 300) +
      machiyaRow(-1) +
      machiyaRow(1) +
      // 路面：往遠處收的兩道
      `<path d="M150 286 L96 400 M150 286 L204 400" ${line(1.4, C.white, 0.35)}/>` +
      `<path d="M10 344 L40 344 M250 360 L286 360 M70 384 L100 384" ${line(1.4, C.white, 0.4)}/>`,
  }),
]

// ---------- 岐阜 ----------
/** 合掌造：[x 正面（山牆）中心、y 地面、s 大小、f 屋頂側面往右後（1）或左後（-1）]；同一層的幾棟合成一個 path */
function gassho(list: number[][]): string {
  const L = { side: '', sideSnow: '', wall: '', win: '', edge: '', face: '', snow: '', mark: '' }
  for (const [x, y, s, f] of list) {
    const p = (pts: Pt[]) => P(pts.map(([dx, dy]) => [x + f * dx * s, y + dy * s] as Pt))
    // 屋頂的側面（往後延伸）：茅草＋雪
    L.side += p([[0, -76], [44, -82], [80, -22], [36, -14]])
    L.sideSnow += p([[-1, -77], [44, -84], [76, -30], [32, -21]])
    // 一樓的牆、紙窗
    L.wall += p([[-24, 0], [-24, -16], [24, -16], [24, 0]])
    L.win += p([[-18, -3], [-18, -11], [-4, -11], [-4, -3]]) + p([[6, -3], [6, -11], [18, -11], [18, -3]])
    // 山牆：外圈的茅草邊、裡面的木板與三層紙窗
    L.edge += p([[0, -78], [37, -13], [-37, -13]])
    L.face += p([[0, -66], [27, -17], [-27, -17]])
    for (const [dx, dy, w] of [[-18, -24, 36], [-12, -38, 24], [-6, -51, 12]]) L.win += p([[dx, dy], [dx, dy - 6], [dx + w, dy - 6], [dx + w, dy]])
    L.mark += `M${x} ${r(y - 66 * s)}V${r(y - 17 * s)}`
    // 山牆兩邊茅草上的雪
    L.snow += p([[0, -80], [39, -14], [33, -14], [0, -70], [-33, -14], [-39, -14]])
  }
  return (
    shape(L.side, C.brown, 'opacity=".75"') +
    shape(L.sideSnow, C.white) +
    shape(L.wall, C.brown) +
    shape(L.edge, C.brown, 'opacity=".85"') +
    shape(L.face, C.brown) +
    `<path d="${L.face}" ${sh(0.2)}/><path d="${L.win}" fill="${C.cream}"/><path d="${L.mark}" ${line(1, C.ink, 0.25)}/>` +
    shape(L.snow, C.white)
  )
}
/** 高山祭的屋台：[x 中心、y 地面、s 大小]。車輪、黑漆的下段與金具、紅的水引幕、雕刻的中段、四根柱子的上段與屋根 */
function yatai(list: number[][]): string {
  const L = { ink: '', gold: '', dot: '', goldFill: '', spoke: '', red: '', redLine: '', brown: '', purple: '', tassel: '', carve: '' }
  for (const [x, y, s] of list) {
    const k = (v: number) => r(v * s)
    const box = (x0: number, y0: number, x1: number, y1: number) => P([[x + x0 * s, y + y0 * s], [x + x1 * s, y + y0 * s], [x + x1 * s, y + y1 * s], [x + x0 * s, y + y1 * s]])
    const wheel = (cx: number) => `M${x + k(cx - 10)} ${y - k(10)}a${k(10)} ${k(10)} 0 1 0 ${k(20)} 0a${k(10)} ${k(10)} 0 1 0 ${k(-20)} 0Z`
    // 下段、車輪、欄干、屋根（黑漆）
    L.ink += box(-26, -14, 26, -50) + wheel(-17) + wheel(17) + box(-30, -84, 30, -88)
    L.ink += `M${x - k(36)} ${y - k(122)}C${x - k(26)} ${y - k(124)} ${x - k(14)} ${y - k(146)} ${x} ${y - k(146)}C${x + k(14)} ${y - k(146)} ${x + k(26)} ${y - k(124)} ${x + k(36)} ${y - k(122)}L${x + k(32)} ${y - k(127)}C${x + k(18)} ${y - k(132)} ${x + k(10)} ${y - k(140)} ${x} ${y - k(140)}C${x - k(10)} ${y - k(140)} ${x - k(18)} ${y - k(132)} ${x - k(32)} ${y - k(127)}Z`
    L.gold += `M${x - k(26)} ${y - k(46)}H${x + k(26)}M${x - k(26)} ${y - k(18)}H${x + k(26)}M${x - k(14)} ${y - k(20)}V${y - k(44)}M${x + k(14)} ${y - k(20)}V${y - k(44)}M${x - k(30)} ${y - k(88)}H${x + k(30)}`
    L.gold += `M${x - k(34)} ${y - k(123)}C${x - k(24)} ${y - k(125)} ${x - k(13)} ${y - k(145)} ${x} ${y - k(145)}C${x + k(13)} ${y - k(145)} ${x + k(24)} ${y - k(125)} ${x + k(34)} ${y - k(123)}`
    for (let i = 0; i < 6; i++) L.dot += `M${x + k(-20 + i * 8)} ${y - k(57)}h0.1`
    L.dot += `M${x - k(17)} ${y - k(10)}h0.1M${x + k(17)} ${y - k(10)}h0.1`
    L.spoke += `M${x - k(25)} ${y - k(10)}h${k(16)}M${x - k(17)} ${y - k(18)}v${k(16)}M${x + k(9)} ${y - k(10)}h${k(16)}M${x + k(17)} ${y - k(18)}v${k(16)}`
    // 水引幕（下緣一串弧）
    L.red += `M${x - k(28)} ${y - k(50)}H${x + k(28)}V${y - k(62)}${Array.from({ length: 7 }, (_, i) => `Q${x + k(24 - i * 8)} ${y - k(56)} ${x + k(20 - i * 8)} ${y - k(62)}`).join('')}Z`
    // 中段：雕刻（金）
    L.brown += box(-24, -62, 24, -84)
    for (const dx of [-21, -7, 7]) {
      L.goldFill += box(dx, -65, dx + 12, -81)
      L.carve += `M${x + k(dx + 3)} ${y - k(73)}q${k(3)} ${k(-5)} ${k(6)} 0q${k(-3)} ${k(5)} ${k(-6)} 0`
    }
    L.goldFill += P([[x, y - 146 * s], [x - 4 * s, y - 152 * s], [x, y - 162 * s], [x + 4 * s, y - 152 * s]])
    // 上段：柱子、紫的幕、垂下來的房
    L.redLine += `M${x - k(20)} ${y - k(88)}V${y - k(124)}M${x + k(20)} ${y - k(88)}V${y - k(124)}M${x} ${y - k(88)}V${y - k(124)}`
    L.purple += `M${x - k(24)} ${y - k(124)}H${x + k(24)}V${y - k(114)}Q${x + k(12)} ${y - k(108)} ${x} ${y - k(114)}Q${x - k(12)} ${y - k(108)} ${x - k(24)} ${y - k(114)}Z`
    L.tassel += `M${x - k(24)} ${y - k(114)}v${k(14)}M${x + k(24)} ${y - k(114)}v${k(14)}M${x} ${y - k(114)}v${k(10)}`
  }
  return (
    `<path d="${L.redLine}" ${line(3, C.red)}/>` +
    shape(L.purple, C.purple) +
    `<path d="${L.tassel}" ${line(2.6, C.orange)}/>` +
    shape(L.brown, C.brown) +
    `<path d="${L.goldFill}" fill="${C.gold}"/><path d="${L.carve}" ${line(1.3, C.brown, 0.6)}/>` +
    shape(L.ink, C.ink) +
    shape(L.red, C.red) +
    `<path d="${L.spoke}" ${line(1.5, C.brown)}/><path d="${L.gold}" ${line(1.8, C.gold)}/><path d="${L.dot}" ${line(5, C.gold)}/>`
  )
}
/** 鵜舟的篝火：火焰、鐵籠、一圈光 */
const kagaribi = (x: number, y: number, s = 1) =>
  `<circle cx="${x}" cy="${r(y - 8 * s)}" r="${r(30 * s)}" fill="${C.yellow}" opacity=".18"/>` +
  shape(`M${r(x - 9 * s)} ${y} C${r(x - 14 * s)} ${r(y - 10 * s)} ${r(x - 8 * s)} ${r(y - 16 * s)} ${r(x - 6 * s)} ${r(y - 26 * s)} C${r(x - 2 * s)} ${r(y - 18 * s)} ${r(x)} ${r(y - 20 * s)} ${r(x + 1 * s)} ${r(y - 32 * s)} C${r(x + 5 * s)} ${r(y - 20 * s)} ${r(x + 8 * s)} ${r(y - 18 * s)} ${r(x + 9 * s)} ${r(y - 24 * s)} C${r(x + 13 * s)} ${r(y - 14 * s)} ${r(x + 12 * s)} ${r(y - 6 * s)} ${r(x + 9 * s)} ${y}Z`, C.orange) +
  `<path d="M${r(x - 5 * s)} ${y} C${r(x - 7 * s)} ${r(y - 8 * s)} ${r(x - 2 * s)} ${r(y - 12 * s)} ${r(x)} ${r(y - 18 * s)} C${r(x + 3 * s)} ${r(y - 12 * s)} ${r(x + 7 * s)} ${r(y - 8 * s)} ${r(x + 5 * s)} ${y}Z" fill="${C.yellow}"/>` +
  shape(P([[x - 9 * s, y - 2 * s], [x + 9 * s, y - 2 * s], [x + 6 * s, y + 6 * s], [x - 6 * s, y + 6 * s]]), C.ink) +
  `<g fill="${C.yellow}">${[[-14, -30], [10, -38], [-4, -44], [16, -24]].map(([dx, dy]) => `<circle cx="${r(x + dx * s)}" cy="${r(y + dy * s)}" r="${r(1.3 * s)}"/>`).join('')}</g>`
/** 鵜舟：細長的木船（船頭朝 dir）、船頭伸出去的篝火、站著的鵜匠 */
function ubune(x0: number, x1: number, y: number, dir: 1 | -1, s = 1): string {
  const bow = dir > 0 ? x1 : x0
  const stern = dir > 0 ? x0 : x1
  const fx = bow + dir * 6 * s
  const mx = bow - dir * 16 * s
  return (
    shape(`M${stern} ${r(y - 8 * s)} L${r(bow - dir * 6 * s)} ${r(y - 8 * s)} Q${r(bow + dir * 4 * s)} ${r(y - 10 * s)} ${bow} ${r(y - 14 * s)} L${r(bow - dir * 10 * s)} ${y} L${r(stern + dir * 6 * s)} ${y}Z`, C.brown) +
    `<path d="M${stern} ${r(y - 8 * s)} L${r(bow - dir * 6 * s)} ${r(y - 8 * s)}" ${line(1.4 * s, C.white, 0.35)}/>` +
    `<path d="M${r(bow - dir * 4 * s)} ${r(y - 10 * s)} L${r(fx)} ${r(y - 36 * s)}" ${line(1.8 * s, C.ink)}/>` +
    kagaribi(r(fx), r(y - 36 * s), s) +
    // 鵜匠：頭巾、黑衣、腰蓑
    shape(`M${r(mx - 4 * s)} ${r(y - 9 * s)} L${r(mx - 3 * s)} ${r(y - 30 * s)} Q${mx} ${r(y - 33 * s)} ${r(mx + 3 * s)} ${r(y - 30 * s)} L${r(mx + 4 * s)} ${r(y - 9 * s)}Z`, C.navy) +
    shape(P([[mx - 6 * s, y - 9 * s], [mx - 4 * s, y - 20 * s], [mx + 4 * s, y - 20 * s], [mx + 6 * s, y - 9 * s]]), C.yellow, 'opacity=".8"') +
    `<circle cx="${mx}" cy="${r(y - 35 * s)}" r="${r(3.6 * s)}" fill="${C.navy}" ${E}/>` +
    `<path d="M${r(mx + dir * 3 * s)} ${r(y - 26 * s)} L${r(mx + dir * 12 * s)} ${r(y - 18 * s)}" ${line(1.8 * s, C.navy)}/>`
  )
}
/** 鵜：浮在水面的黑鳥（長脖子），用細繩拉著 */
const cormorants = (list: number[][]) =>
  `<path d="${list.map(([x, y, d]) => `M${x - 9 * d} ${y}C${x - 6 * d} ${y - 6} ${x + 2 * d} ${y - 6} ${x + 4 * d} ${y - 4}C${x + 5 * d} ${y - 9} ${x + 5 * d} ${y - 13} ${x + 8 * d} ${y - 13}L${x + 12 * d} ${y - 11}L${x + 8 * d} ${y - 10}C${x + 7 * d} ${y - 7} ${x + 8 * d} ${y - 3} ${x + 7 * d} ${y}Z`).join('')}" fill="${C.ink}" ${E}/>`

const GIFU: Outfit[] = [
  // 白川郷（data/spots/gifu.json wd-Q1002193，https://zh.wikipedia.org/wiki/%E7%99%BD%E5%B7%9D%E9%84%89）：雪中荻町的合掌造，陡的茅草屋頂積著厚雪、山牆的紙窗，後面的杉林與雪山
  bg({
    id: 'bg-gifu-shirakawago',
    name: '白川鄉',
    pref: 'gifu',
    rarity: 3,
    art:
      sky(C.blue, 0.16) +
      cloud(60, 64, 1.2, 0.8) +
      cloud(240, 40, 0.9, 0.7) +
      alps([[-10, 214], [50, 170], [110, 196], [170, 160], [230, 190], [280, 166], [310, 180]], C.navy, 0.22, 300, 0.55) +
      // 兩邊陡的山：雪裡的杉林
      `<path d="M-10 112 C30 118 70 190 110 268 L-10 268Z M310 100 C266 114 226 190 190 268 L310 268Z" fill="${C.white}" ${E}/>` +
      `<path d="M310 100 C266 114 226 190 190 268 L232 268 C252 210 278 150 310 132Z" ${sh(0.05)}/>` +
      firs([[6, 138, 0.5], [30, 150, 0.55], [52, 172, 0.5], [14, 186, 0.6], [74, 204, 0.55], [40, 212, 0.6], [292, 128, 0.5], [266, 146, 0.55], [244, 172, 0.5], [282, 180, 0.6], [222, 204, 0.55], [258, 210, 0.6]], C.green, 0.7) +
      ridge([[-10, 270], [60, 240], [140, 256], [220, 236], [310, 254]], C.green, 0.4, 300) +
      firs([[16, 262, 0.7], [44, 252, 0.8], [76, 258, 0.6], [112, 262, 0.7], [190, 254, 0.7], [226, 246, 0.8], [262, 252, 0.7], [292, 258, 0.6]], C.green, 0.9) +
      // 遠處的合掌造
      gassho([[108, 300, 0.42, 1], [176, 298, 0.36, -1], [150, 304, 0.5, 1]]) +
      gassho([[64, 322, 0.95, 1], [234, 324, 1.02, -1]]) +
      ground(C.white, 320) +
      `<rect y="320" width="300" height="80" fill="${C.blue}" opacity=".08"/>` +
      `<path d="M0 334 Q80 328 150 336 T300 332 M0 362 Q90 356 160 366 T300 360" ${line(2, C.blue, 0.18)}/>` +
      specks(18, 500, 300, 310, 3, C.white),
  }),
  // 高山祭（data/festivals/gifu.json gifu-Q7677467，https://zh.wikipedia.org/wiki/%E9%AB%98%E5%B1%B1%E7%A5%AD）：春天的山王祭，兩座華麗的屋台（金的雕刻、紅的水引幕、紫的幕），宮川上朱色的中橋、岸邊的櫻與古い町並
  bg({
    id: 'bg-gifu-takayama-matsuri',
    name: '高山祭',
    pref: 'gifu',
    rarity: 2,
    art:
      sky(C.blue, 0.22) +
      cloud(70, 56, 1.1) +
      cloud(230, 84, 0.8, 0.8) +
      alps([[-10, 236], [60, 200], [120, 222], [180, 196], [240, 220], [310, 204]], C.blue, 0.3, 300, 0.4) +
      // 對岸的町家
      `<path d="${Array.from({ length: 9 }, (_, i) => { const x = i * 36 - 8; const h = 30 + (i % 3) * 5; return P([[x, 284], [x, 284 - h], [x - 4, 284 - h], [x + 18, 284 - h - 10], [x + 40, 284 - h], [x + 36, 284 - h], [x + 36, 284]]) }).join('')}" fill="${C.brown}" opacity=".55" ${E}/>` +
      `<path d="${Array.from({ length: 9 }, (_, i) => `M${i * 36 - 4} ${270 - (i % 3) * 5} h28`).join(' ')}" ${line(1.6, C.ink, 0.3)}/>` +
      blooms([[24, 290, 1.1, 3], [98, 292, 0.9, 5], [204, 292, 0.9, 7], [276, 290, 1.1, 9]], C.pink) +
      // 宮川與中橋
      `<rect y="292" width="300" height="30" fill="${C.blue}" opacity=".4"/>` +
      ripples([[40, 304], [120, 312], [200, 306], [260, 314]], 16, 0.6) +
      shape('M10 300 Q150 270 290 300 L290 306 Q150 277 10 306Z', C.red) +
      `<path d="M14 290 Q150 262 286 290${Array.from({ length: 11 }, (_, i) => { const x = 24 + i * 25.2; const y = 290 - Math.sin(((x - 14) / 272) * Math.PI) * 14.6; return ` M${r(x)} ${r(y)} V${r(y + 10)}` }).join('')}" ${line(2, C.red)}/>` +
      ground(C.grey, 320, 0.3) +
      `<path d="M0 320 L300 320" ${line(3, C.ink, 0.12)}/>` +
      yatai([[68, 344, 1.12], [234, 342, 1.08]]) +
      `<path d="M20 370 L60 370 M230 384 L270 384 M120 392 L160 392" ${line(1.4, C.white, 0.5)}/>`,
  }),
  // 長良川（data/spots/gifu.json wd-Q1194094，https://zh.wikipedia.org/wiki/%E9%95%B7%E8%89%AF%E5%B7%9D）：夏夜的鵜飼，鵜舟船頭的篝火、鵜匠與鵜，後面金華山頂點燈的岐阜城（wd-Q1367052，https://zh.wikipedia.org/wiki/%E5%B2%90%E9%98%9C%E5%9F%8E）
  bg({
    id: 'bg-gifu-nagaragawa',
    name: '長良川',
    pref: 'gifu',
    rarity: 1,
    art:
      sky(C.navy, 0.72, C.cream) +
      sun(52, 122, 10, C.cream, 0.9) +
      specks(14, 700, 300, 200, 1.8, C.white, 0.8) +
      ridge([[-10, 270], [50, 246], [120, 262], [170, 250], [240, 262]], C.navy, 0.5, 300) +
      // 金華山與山頂的岐阜城
      ridge([[130, 300], [180, 236], [222, 172], [244, 162], [270, 182], [310, 226]], C.green, 0.4, 300) +
      `<circle cx="242" cy="150" r="24" fill="${C.yellow}" opacity=".16"/>` +
      shape('M228 170 L256 170 L254 163 L230 163Z', C.grey) +
      tenshu(242, 163, [22, 17, 12], [10, 8, 9], C.white, C.white, C.grey) +
      // 對岸的燈
      `<path d="${Array.from({ length: 16 }, (_, i) => `M${Math.round(6 + i * 19 + rnd(i) * 6)} ${Math.round(290 + rnd(i + 40) * 6)}h0.1`).join('')}" ${line(2.4, C.yellow, 0.7)}/>` +
      // 河面
      `<rect y="294" width="300" height="30" fill="${C.blue}" opacity=".35"/>` +
      `<path d="M88 302h16M91 308h10M93 314h6M200 298h14M202 303h10M204 308h6" ${line(2.4, C.orange, 0.65)}/>` +
      ripples([[40, 314], [150, 304], [180, 318], [270, 310]], 18, 0.35) +
      ubune(212, 304, 302, -1, 0.8) +
      ubune(-14, 86, 314, 1, 1.05) +
      cormorants([[100, 318, 1], [116, 312, 1], [62, 322, 1], [198, 310, -1], [184, 306, -1]]) +
      ground(C.grey, 324, 0.7) +
      `<rect y="324" width="300" height="76" fill="${C.navy}" opacity=".3"/>` +
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${Math.round(rnd(i + 900) * 290)} ${Math.round(334 + rnd(i + 950) * 60)}h6`).join('')}" ${line(3, C.white, 0.25)}/>`,
  }),
]

// ---------- 静岡 ----------
/** 黑松：x 樹根、y 地面、s 大小、f 1 往左斜 -1 往右斜。彎的樹幹、橫伸的枝，一層層平平的葉團 */
function kuromatsu(x: number, y: number, s: number, f: 1 | -1 = 1): string {
  const X = (dx: number) => r(x - f * dx * s)
  const Y = (dy: number) => r(y - dy * s)
  const pads: number[][] = [[40, 150, 30, 14], [66, 98, 24, 11], [-6, 132, 24, 12], [-34, 70, 20, 10], [18, 118, 16, 8]]
  let leaf = ''
  let light = ''
  let shd = ''
  pads.forEach(([cx, cy, w, h], i) => {
    const px = +X(cx)
    const py = +Y(cy + h * 0.45)
    leaf += blobD(px, py, w * s, h * 0.46 * s, 9, i * 7 + x)
    light += blobD(px - f * w * 0.15 * s, py - h * 0.25 * s, w * 0.6 * s, h * 0.28 * s, 6, i * 5 + x)
    shd += `M${r(px - w * s)} ${r(py + h * 0.1 * s)}Q${px} ${r(py + h * 0.75 * s)} ${r(px + w * s)} ${r(py + h * 0.1 * s)}Z`
  })
  return (
    shape(`M${X(10)} ${y}C${X(4)} ${Y(30)} ${X(14)} ${Y(56)} ${X(22)} ${Y(84)}C${X(30)} ${Y(110)} ${X(26)} ${Y(128)} ${X(42)} ${Y(148)}L${X(35)} ${Y(153)}C${X(18)} ${Y(134)} ${X(20)} ${Y(112)} ${X(12)} ${Y(88)}C${X(4)} ${Y(62)} ${X(-10)} ${Y(30)} ${X(-10)} ${y}Z`, C.brown) +
    `<path d="M${X(10)} ${y}C${X(4)} ${Y(30)} ${X(14)} ${Y(56)} ${X(22)} ${Y(84)}C${X(30)} ${Y(110)} ${X(26)} ${Y(128)} ${X(42)} ${Y(148)}L${X(38)} ${Y(150)}C${X(22)} ${Y(126)} ${X(26)} ${Y(108)} ${X(16)} ${Y(84)}C${X(8)} ${Y(56)} ${X(-2)} ${Y(30)} ${X(2)} ${y}Z" ${sh(0.22)}/>` +
    `<path d="M${X(-3)} ${Y(50)} ${X(-34)} ${Y(70)}M${X(14)} ${Y(86)}Q${X(40)} ${Y(92)} ${X(64)} ${Y(98)}M${X(24)} ${Y(116)}Q${X(8)} ${Y(126)} ${X(-6)} ${Y(132)}" ${line(4.4 * s, C.brown)}/>` +
    shape(leaf, C.green) +
    `<path d="${light}" fill="${C.matcha}" opacity=".7"/><path d="${shd}" ${SH}/>`
  )
}
/** 反射爐的一座（雙爐）：下面的爐體與焚口、兩根磚造煙囪、外面的鋼骨補強框；x 左緣、y 地面、w 寬、h 煙囪頂 */
function hanshaRo(x: number, y: number, w: number, top: number): string {
  const bodyTop = y - (y - top) * 0.3
  const cw = w * 0.34
  const c1 = x + w * 0.08
  const c2 = x + w * 0.58
  const chim = (cx: number) => P([[cx, bodyTop], [cx + 1.5, top], [cx + cw - 1.5, top], [cx + cw, bodyTop]])
  let truss = ''
  for (const cx of [c1, c2]) {
    const a = cx - 2
    const b = cx + cw + 2
    truss += `M${r(a)} ${r(bodyTop)}L${r(a + 1)} ${r(top + 8)}M${r(b)} ${r(bodyTop)}L${r(b - 1)} ${r(top + 8)}`
    const n = 6
    for (let i = 0; i < n; i++) {
      const y0 = bodyTop - ((bodyTop - top - 8) * i) / n
      const y1 = bodyTop - ((bodyTop - top - 8) * (i + 1)) / n
      truss += `M${r(a)} ${r(y0)}L${r(b)} ${r(y1)}M${r(b)} ${r(y0)}L${r(a)} ${r(y1)}M${r(a)} ${r(y1)}H${r(b)}`
    }
  }
  const brick = Array.from({ length: 14 }, (_, i) => `M${r(c1)} ${r(top + 10 + i * 9)}h${r(cw)}M${r(c2)} ${r(top + 14 + i * 9)}h${r(cw)}`).join('')
  return (
    shape(chim(c1) + chim(c2) + P([[x, y], [x, bodyTop], [x + w, bodyTop], [x + w, y]]), C.grey) +
    `<path d="${chim(c1)}${chim(c2)}${P([[x, y], [x, bodyTop], [x + w, bodyTop], [x + w, y]])}" fill="${C.white}" opacity=".45"/>` +
    `<path d="${P([[c1 + cw * 0.62, bodyTop], [c1 + cw * 0.66, top], [c1 + cw - 1.5, top], [c1 + cw, bodyTop]])}${P([[c2 + cw * 0.62, bodyTop], [c2 + cw * 0.66, top], [c2 + cw - 1.5, top], [c2 + cw, bodyTop]])}${P([[x + w * 0.8, y], [x + w * 0.8, bodyTop], [x + w, bodyTop], [x + w, y]])}" ${sh(0.12)}/>` +
    `<path d="${brick}" ${line(0.8, C.brown, 0.25)}/>` +
    // 焚口：拱形的口
    `<path d="${[0.2, 0.7].map((f) => `M${r(x + w * f - 6)} ${y}V${r(y - 10)}A6 6 0 0 1 ${r(x + w * f + 6)} ${r(y - 10)}V${y}Z`).join('')}" fill="${C.ink}" opacity=".7"/>` +
    `<path d="${truss}" ${line(1.2, C.ink, 0.8)}/>`
  )
}
/** 一排茶樹：上緣圓圓的一條長畦，y 底、h 高 */
const chaRow = (y: number, h: number, fill: string, seed: number) => {
  let d = `M-10 ${y}`
  let x = -10
  let i = 0
  while (x < 310) {
    const w = 16 + rnd(seed + i++) * 10
    d += `Q${r(x + w / 2)} ${r(y - h * 1.5)} ${r(x + w)} ${y - h * 0.4}`
    x += w
  }
  return `<path d="${d}L310 ${y}Z" fill="${fill}" ${E}/><path d="M-10 ${y - h * 0.3}H310" ${line(1.2, C.white, 0.35)}/>`
}

const SHIZUOKA: Outfit[] = [
  // 三保の松原（data/spots/shizuoka.json wd-Q869275，https://zh.wikipedia.org/wiki/%E4%B8%89%E4%BF%9D%E4%B9%8B%E6%9D%BE%E5%8E%9F）：白沙灘與彎的黑松，駿河灣對面左邊的富士山，遠處一路沿岸的松林
  bg({
    id: 'bg-shizuoka-miho',
    name: '三保松原',
    pref: 'shizuoka',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(206, 66, 1.1) +
      cloud(280, 120, 0.7, 0.8) +
      fuji(70, 124, 30, 440, 300, 172, C.blue, 0.58) +
      ridge([[170, 262], [230, 252], [310, 256]], C.navy, 0.2, 266) +
      // 駿河灣
      `<rect y="262" width="300" height="50" fill="${C.blue}" opacity=".5"/>` +
      ripples([[40, 272], [110, 280], [170, 270], [240, 284], [80, 294], [200, 298], [270, 272]], 18, 0.6) +
      // 沿岸遠去的松林
      `<path d="${[[-6, 296, 16, 9, 6, 1], [22, 292, 16, 8, 6, 2], [48, 290, 14, 7, 6, 3], [72, 290, 12, 6, 6, 4], [92, 291, 10, 5, 6, 5]].map(([a, b, c, d, e, f]) => blobD(a, b, c, d, e, f)).join('')}" fill="${C.green}" opacity=".8" ${E}/>` +
      `<path d="M-10 300 Q50 292 110 296" ${line(4, C.yellow, 0.5)}/>` +
      ground(C.yellow, 312, 0.22) +
      // 打上來的浪
      `<path d="M-10 313 Q20 306 50 312 T110 311 T170 313 T230 310 T310 312" ${line(3, C.white, 0.9)}/>` +
      `<path d="M30 326 Q60 322 90 326 M190 330 Q220 326 250 330" ${line(1.4, C.white, 0.6)}/>` +
      kuromatsu(262, 338, 1.25) +
      kuromatsu(22, 336, 0.7, -1) +
      `<path d="M12 360 L40 360 M110 384 L150 384 M230 372 L262 372" ${line(1.4, C.brown, 0.2)}/>`,
  }),
  // 白糸の滝（data/spots/shizuoka.json wd-Q38411，https://zh.wikipedia.org/wiki/%E7%99%BD%E7%B5%B2%E7%80%91%E5%B8%83_%28%E9%9D%9C%E5%B2%A1%E7%B8%A3%29）：寬寬的弧形岩壁，從岩壁中段的地層湧出、像白線垂下的無數細瀑，右邊從崖頂落下的主瀑，夏天的綠
  bg({
    id: 'bg-shizuoka-shiraito',
    name: '白絲瀑布',
    pref: 'shizuoka',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(150, 54, 1.1) +
      // 崖上的林
      blobs([[-4, 150, 34, 24, 8, 1], [56, 146, 32, 22, 8, 2], [118, 142, 34, 22, 8, 3], [182, 142, 34, 22, 8, 4], [246, 146, 32, 22, 8, 5], [304, 150, 34, 24, 8, 6]], C.green) +
      blobs([[26, 160, 24, 14, 7, 7], [150, 156, 30, 14, 7, 8], [278, 160, 24, 14, 7, 9]], C.matcha) +
      // 弧形的岩壁：上面一層深色的熔岩、下面長著苔
      shape('M-10 166 Q150 150 310 166 L310 292 L-10 292Z', C.grey) +
      `<path d="M-10 166 Q150 150 310 166 L310 196 Q150 182 -10 196Z" ${sh(0.2)}/>` +
      `<path d="M-10 214 Q150 202 310 214 L310 292 L-10 292Z" fill="${C.green}" opacity=".3"/>` +
      blobs([[20, 236, 14, 8, 6, 10], [92, 252, 12, 7, 6, 11], [210, 246, 14, 8, 6, 12], [282, 230, 12, 7, 6, 13], [150, 230, 10, 6, 6, 14]], C.matcha) +
      // 白線一樣的細瀑：從岩壁中段湧出
      `<path d="${Array.from({ length: 34 }, (_, i) => { const x = 4 + i * 8.6 + rnd(i) * 4; const y0 = 194 - Math.sin(((x + 10) / 320) * Math.PI) * 8 + rnd(i + 50) * 10; return `M${r(x)} ${r(y0)}Q${r(x + 1.5)} ${r((y0 + 292) / 2)} ${r(x)} 292` }).join('')}" ${line(1.6, C.white, 0.9)}/>` +
      // 主瀑
      shape('M228 160 L250 160 Q252 220 256 292 L222 292 Q226 220 228 160Z', C.white, 'opacity=".9"') +
      `<path d="M234 172 L232 288 M243 172 L246 288" ${line(1.2, C.blue, 0.3)}/>` +
      // 瀑壺與水霧
      `<rect y="290" width="300" height="32" fill="${C.blue}" opacity=".35"/><rect y="290" width="300" height="32" fill="${C.green}" opacity=".15"/>` +
      `<path d="${[[20, 292, 20, 7, 7, 20], [80, 294, 22, 6, 7, 21], [150, 292, 24, 7, 7, 22], [214, 294, 26, 8, 7, 23], [272, 292, 22, 7, 7, 24]].map(([a, b, c, d, e, f]) => blobD(a, b, c, d, e, f)).join('')}" fill="${C.white}" opacity=".7"/>` +
      ripples([[50, 306], [120, 312], [190, 304], [250, 314]], 18, 0.7) +
      ground(C.grey, 322, 0.32) +
      `<path d="M0 322 L300 322" ${line(3, C.green, 0.3)}/>` +
      tree(18, 340, 1.5, C.green) +
      tree(282, 344, 1.6, C.matcha) +
      shape([[64, 346, 22, 12], [232, 358, 26, 13], [130, 392, 16, 7]].map(([x, y, w, h]) => `M${x - w} ${y}C${x - w} ${y - h} ${x + w * 0.6} ${y - h * 1.1} ${x + w} ${y}Z`).join(''), C.grey, 'opacity=".8"') +
      `<path d="M46 340 Q56 335 66 335 M210 352 Q222 346 234 346" ${line(2, C.white, 0.6)}/>`,
  }),
  // 韮山反射炉（data/spots/shizuoka.json wd-Q20042067，https://zh.wikipedia.org/wiki/%E9%9F%AE%E5%B1%B1%E5%8F%8D%E5%B0%84%E7%88%90）：兩座雙爐的磚造煙囪與外面的鋼骨補強框、爐體的焚口，前面一畦畦的茶園，黃昏
  bg({
    id: 'bg-shizuoka-nirayama',
    name: '韮山反射爐',
    pref: 'shizuoka',
    rarity: 1,
    art:
      sky(C.orange, 0.3, C.cream) +
      sun(58, 206, 18, C.yellow, 0.75) +
      cloud(90, 70, 1.2, 0.6) +
      cloud(230, 46, 0.9, 0.55) +
      ridge([[-10, 250], [50, 232], [120, 246], [190, 226], [260, 240], [310, 232]], C.navy, 0.2, 300) +
      ridge([[-10, 284], [70, 268], [150, 280], [230, 264], [310, 276]], C.green, 0.35, 300) +
      blobs([[176, 290, 24, 18, 8, 3], [290, 288, 26, 20, 8, 4]], C.green) +
      hanshaRo(146, 304, 56, 138) +
      hanshaRo(198, 314, 68, 118) +
      ground(C.brown, 314, 0.22) +
      chaRow(326, 10, C.green, 1) +
      chaRow(346, 14, C.matcha, 2) +
      chaRow(372, 18, C.green, 3) +
      chaRow(404, 24, C.matcha, 4),
  }),
]

// ---------- 愛知 ----------
/** 名古屋城的天守：白漆喰的牆、一排排的窗、綠的銅瓦屋頂，最上面一對金鯱；x 中心、y 最下層的底 */
function nagoyaTenshu(x: number, y: number, ws: number[], hs: number[], gables: number[]): string {
  let win = ''
  let b = y
  let top = y
  let tw = 0
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i]
    const t = b - hs[i]
    const last = i === ws.length - 1
    // 一排窗：用虛線畫（窗寬 w/n*0.4、間隔 w/n*0.6）
    const n = Math.max(2, Math.round(w / 9))
    const u = w / n
    win += `<path d="M${r(x - w / 2 + u * 0.3)} ${r(t + hs[i] * 0.46)}h${r(w - u * 0.3)}" fill="none" stroke="${C.ink}" stroke-opacity=".55" stroke-width="${r(hs[i] * 0.32)}" stroke-dasharray="${r(u * 0.4)} ${r(u * 0.6)}"/>`
    const rt = last ? t - w * 0.38 : t - Math.max(2.5, w * 0.09)
    if (last) {
      top = rt
      tw = w * 0.15
    }
    b = rt
  }
  // 金鯱：尾巴翹起來的魚
  const shachi = (sx: number, d: number) =>
    `M${r(sx)} ${r(top + 1)}C${r(sx - d * 1)} ${r(top - 4)} ${r(sx - d * 1)} ${r(top - 9)} ${r(sx + d * 2)} ${r(top - 13)}C${r(sx + d * 1)} ${r(top - 9)} ${r(sx + d * 3)} ${r(top - 6)} ${r(sx + d * 5)} ${r(top - 9)}L${r(sx + d * 4)} ${r(top - 3)}C${r(sx + d * 3)} ${r(top - 1)} ${r(sx + d * 2)} ${r(top + 1)} ${r(sx)} ${r(top + 1)}Z`
  return (
    tenshu(x, y, ws, hs, C.white, C.white, C.green, gables) +
    win +
    shape(shachi(x - tw, -1) + shachi(x + tw, 1), C.gold)
  )
}
/** 隅櫓：石垣上兩層的小櫓 */
const sumiyagura = (x: number, y: number) => ishigaki(x - 34, x + 34, y, 322) + tenshu(x, y, [52, 38], [22, 18], C.white, C.white, C.grey, [0])
/** 名古屋電視塔：四隻腳的鋼骨塔、展望台、天線，夜裡點著燈；x 中心 */
function tvTower(x: number): string {
  const leg = (s: 1 | -1) => `M${x + s * 34} 318 C${x + s * 22} 260 ${x + s * 12} 200 ${x + s * 9} 166 L${x + s * 6} 166 C${x + s * 8} 200 ${x + s * 14} 262 ${x + s * 22} 318Z`
  let brace = ''
  const lv = [318, 286, 256, 230, 206, 184, 166]
  const half = (y: number) => 9 + (25 * (y - 166)) / 152 + ((y - 166) * (318 - y)) / 2600
  for (let i = 0; i < lv.length - 1; i++) {
    const [y0, y1] = [lv[i], lv[i + 1]]
    brace += `M${r(x - half(y0))} ${y0}L${r(x + half(y1))} ${y1}M${r(x + half(y0))} ${y0}L${r(x - half(y1))} ${y1}M${r(x - half(y1))} ${y1}H${r(x + half(y1))}`
  }
  for (let y = 112; y < 146; y += 8) brace += `M${x - 5} ${y + 8}L${x + 5} ${y}M${x + 5} ${y + 8}L${x - 5} ${y}`
  return (
    shape(leg(1) + leg(-1) + P([[x - 6, 148], [x - 4, 108], [x + 4, 108], [x + 6, 148]]), C.grey) +
    `<path d="${brace}" ${line(1.1, C.yellow, 0.75)}/>` +
    // 展望台
    shape(P([[x - 13, 166], [x - 13, 148], [x + 13, 148], [x + 13, 166]]), C.grey) +
    `<path d="M${x - 11} 154H${x + 11}M${x - 11} 160H${x + 11}" ${line(2.4, C.yellow, 0.9)}/>` +
    `<path d="M${x} 108V58M${x - 3} 92H${x + 3}M${x - 2} 78H${x + 2}" ${line(2, C.grey)}/>` +
    `<circle cx="${x}" cy="58" r="2" fill="${C.red}"/>`
  )
}

const AICHI: Outfit[] = [
  // 名古屋城（data/spots/aichi.json wd-Q648629，https://zh.wikipedia.org/wiki/%E5%90%8D%E5%8F%A4%E5%B1%8B%E5%9F%8E）：石垣上的五重大天守（白牆、綠銅瓦、千鳥破風、屋頂一對金鯱）與小天守，右邊的隅櫓，春天的櫻
  bg({
    id: 'bg-aichi-nagoya-jo',
    name: '名古屋城',
    pref: 'aichi',
    rarity: 3,
    art:
      sky(C.blue, 0.26) +
      cloud(220, 70, 1.2) +
      cloud(140, 34, 0.7, 0.8) +
      ridge([[-10, 290], [80, 280], [160, 288], [240, 278], [310, 286]], C.green, 0.3, 304) +
      // 小天守
      ishigaki(104, 160, 270, 322) +
      nagoyaTenshu(132, 270, [44, 36], [22, 18], [0]) +
      // 大天守
      ishigaki(22, 122, 254, 322) +
      nagoyaTenshu(72, 254, [74, 66, 56, 46, 36], [26, 20, 18, 16, 19], [0, 2, 3]) +
      sumiyagura(244, 270) +
      blooms([[30, 334, 1.3, 3], [100, 336, 1.1, 5], [206, 334, 1.2, 7], [276, 330, 1.4, 9]], C.pink) +
      ground(C.matcha, 322, 0.3) +
      `<path d="M0 322 L300 322" ${line(3, C.ink, 0.12)}/>` +
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${Math.round(10 + rnd(i + 120) * 280)} ${Math.round(340 + rnd(i + 130) * 54)}h4`).join('')}" ${line(2.4, C.pink)}/>`,
  }),
  // 香嵐渓（data/spots/aichi.json wd-Q11667254，https://en.wikipedia.org/wiki/K%C5%8Drankei）：滿山的紅葉、巴川上朱色的待月橋，水面映著紅葉
  bg({
    id: 'bg-aichi-korankei',
    name: '香嵐溪',
    pref: 'aichi',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(150, 40, 1) +
      // 飯盛山：整片的紅葉
      ridge([[-10, 210], [60, 150], [150, 136], [230, 156], [310, 200]], C.orange, 0.4, 300) +
      `<path d="${Array.from({ length: 16 }, (_, i) => { const x = 10 + (i % 8) * 40 + (i > 7 ? 20 : 0); const y = (i > 7 ? 222 : 184) - Math.sin(((x + 10) / 320) * Math.PI) * 34 + rnd(i + 60) * 8; return blobD(x, y, 16, 11, 6, i + 40) }).join('')}" fill="${C.red}" opacity=".3"/>` +
      `<path d="${Array.from({ length: 6 }, (_, i) => blobD(30 + i * 48, 238 - Math.sin(((i * 48 + 40) / 320) * Math.PI) * 30, 13, 9, 6, i + 70)).join('')}" fill="${C.yellow}" opacity=".4"/>` +
      blobs([[10, 260, 34, 26, 9, 1], [76, 250, 30, 22, 9, 2], [226, 248, 30, 22, 9, 3], [292, 258, 34, 26, 9, 4]], C.red) +
      blobs([[44, 274, 28, 18, 8, 5], [140, 262, 40, 20, 9, 6], [262, 274, 28, 18, 8, 7]], C.orange) +
      blobs([[110, 280, 24, 12, 8, 8], [190, 278, 26, 13, 8, 9]], C.yellow, 0.9) +
      // 巴川
      `<rect y="286" width="300" height="36" fill="${C.blue}" opacity=".4"/>` +
      `<path d="M30 296h22M240 300h24M70 306h14M210 310h18" ${line(3, C.red, 0.35)}/>` +
      ripples([[60, 300], [130, 312], [180, 298], [250, 316]], 16, 0.6) +
      // 待月橋：朱色的木拱橋
      shape('M-10 278 Q150 238 310 278 L310 285 Q150 246 -10 285Z', C.red) +
      `<path d="M-10 266 Q150 226 310 266${Array.from({ length: 13 }, (_, i) => { const x = 2 + i * 24.6; const y = 278 - Math.sin(((x + 10) / 320) * Math.PI) * 30; return ` M${r(x)} ${r(y - 12)} V${r(y)}` }).join('')}" ${line(2.2, C.red)}/>` +
      `<path d="M-6 284 L-6 322 M40 270 L40 322 M260 270 L260 322 M306 284 L306 322" ${line(3, C.red, 0.85)}/>` +
      ground(C.grey, 322, 0.32) +
      `<path d="M0 322 L300 322" ${line(3, C.brown, 0.2)}/>` +
      // 兩邊的楓樹：樹幹與垂到上面的樹冠
      shape('M14 334 C18 280 10 220 22 160 L30 160 C24 220 30 280 28 334Z M290 334 C284 280 292 220 280 156 L272 156 C278 220 274 280 276 334Z', C.brown) +
      `<path d="M24 210 Q44 196 62 196 M20 180 Q8 166 -6 162 M278 204 Q258 190 240 190 M282 176 Q294 162 310 158" ${line(4, C.brown)}/>` +
      blobs([[16, 138, 40, 30, 10, 20], [62, 186, 26, 16, 8, 21], [286, 134, 40, 30, 10, 22], [236, 182, 26, 16, 8, 23]], C.red) +
      blobs([[36, 116, 22, 14, 8, 24], [-6, 168, 18, 12, 7, 25], [268, 112, 22, 14, 8, 26], [306, 166, 18, 12, 7, 27]], C.orange) +
      `<path d="${blobD(4, 128, 16, 9, 7, 28)}${blobD(296, 124, 16, 9, 7, 29)}" fill="${C.yellow}" opacity=".6"/>` +
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${Math.round(10 + rnd(i + 140) * 280)} ${Math.round(336 + rnd(i + 150) * 58)}h3`).join('')}" ${line(3.4, C.red)}/>` +
      `<path d="${Array.from({ length: 8 }, (_, i) => `M${Math.round(10 + rnd(i + 160) * 280)} ${Math.round(336 + rnd(i + 170) * 58)}h3`).join('')}" ${line(3.4, C.yellow)}/>`,
  }),
  // 名古屋テレビ塔（data/spots/aichi.json wd-Q283373，https://zh.wikipedia.org/wiki/%E5%90%8D%E5%8F%A4%E5%B1%8B%E9%9B%BB%E8%A6%96%E5%A1%94）：久屋大通公園夜裡點燈的鋼骨電視塔，左邊旁邊的綠洲 21 浮在半空的橢圓玻璃屋頂（オアシス21，wd-Q5359224，https://en.wikipedia.org/wiki/Oasis_21），後面的大樓與公園的樹
  bg({
    id: 'bg-aichi-tv-tower',
    name: '名古屋電視塔',
    pref: 'aichi',
    rarity: 1,
    art:
      sky(C.navy, 0.7, C.cream) +
      specks(12, 400, 300, 160, 1.8, C.white, 0.7) +
      // 後面的大樓與窗燈
      `<path d="M-10 318V230H24V200H50V244H80V214H108V250H150V222H178V190H206V236H236V206H262V240H310V318Z" fill="${C.navy}" opacity=".55" ${E}/>` +
      `<path d="${Array.from({ length: 30 }, (_, i) => { const x = Math.round(2 + rnd(i + 420) * 296); const y = Math.round(236 + rnd(i + 430) * 70); return `M${x} ${y}h3` }).join('')}" ${line(2, C.yellow, 0.6)}/>` +
      tvTower(238) +
      // 綠洲 21：柱子上浮著的橢圓玻璃屋頂，上面一層水
      `<path d="M14 318V236M44 318V240M74 318V240M104 318V238" ${line(2.4, C.grey, 0.8)}/>` +
      `<path d="${[[-4, 312, 20, 12], [40, 314, 18, 10], [82, 312, 20, 12], [124, 316, 16, 8], [180, 316, 16, 8], [290, 312, 20, 12]].map(([x, y, a, b], i) => blobD(x, y, a, b, 8, i + 90)).join('')}" fill="${C.green}" opacity=".5" ${E}/>` +
      shape('M-40 232 C-10 220 110 220 140 232 C110 244 -10 244 -40 232Z', C.blue, 'opacity=".8"') +
      `<path d="M-30 230 C0 224 100 224 130 230 C100 236 0 236 -30 230Z" fill="${C.white}" opacity=".35"/>` +
      `<path d="M-36 231 C-6 222 106 222 136 231" ${line(2, C.white, 0.85)}/>` +
      `<path d="M-30 236 C0 242 100 242 130 236" ${line(1.4, C.yellow, 0.7)}/>` +
      ground(C.grey, 318, 0.6) +
      `<rect y="318" width="300" height="82" fill="${C.navy}" opacity=".25"/>` +
      `<path d="M0 340 L300 340 M0 366 L300 366" ${line(1.4, C.white, 0.25)}/>` +
      `<path d="M24 318 l0 -26 M276 318 l0 -26" ${line(1.6, C.grey)}/><circle cx="24" cy="290" r="4" fill="${C.yellow}" ${E}/><circle cx="276" cy="290" r="4" fill="${C.yellow}" ${E}/>`,
  }),
]

export const BG: Outfit[] = [...YAMANASHI, ...NAGANO, ...GIFU, ...SHIZUOKA, ...AICHI]
