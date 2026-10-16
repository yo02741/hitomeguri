import type { Outfit } from '../outfits'
import { bg, C, cloud, E, ground, line, ridge, ripples, SH, shape, sky } from './kit'

/**
 * 地區背景：兵庫、奈良、和歌山。題材取自 data/spots 的景點，出處是那筆資料的 summary.source_url。
 */

type Pt = [number, number]
const r = (v: number) => Math.round(v * 10) / 10
/** 折線封起來的形狀（座標取 1 位小數） */
const poly = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L') + 'Z'
const rect = (x: number, y: number, w: number, h: number) => `M${r(x)} ${r(y)} h${r(w)} v${r(h)} h${r(-w)}Z`
/** 一組共用紙邊的形狀：[d, fill] 排在同一個 <g> 裡 */
const paper = (parts: Array<[string, string]>, op = 1) =>
  `<g ${E}${op < 1 ? ` opacity="${op}"` : ''}>${parts.map(([d, f]) => `<path d="${d}" fill="${f}"/>`).join('')}</g>`
/** 一排直條（窗、格子、欄杆）：不圓頭的虛線，條寬 bw、間隔 gap、高 h（y 是中線） */
const bars = (x0: number, x1: number, y: number, h: number, bw: number, gap: number, color: string, op = 1) =>
  `<path d="M${r(x0)} ${r(y)} L${r(x1)} ${r(y)}" fill="none" stroke="${color}" stroke-width="${r(h)}" stroke-dasharray="${r(bw)} ${r(gap)}" stroke-opacity="${op}"/>`
/** 散落的小點（花瓣、星、燈火）：圓頭的零長線段 */
const specks = (pts: Pt[], w: number, color: string, op = 1) => `<path d="${pts.map(([x, y]) => `M${r(x)} ${r(y)}h0`).join('')}" ${line(w, color, op)}/>`
/** 固定的亂數：同一個 seed 每次畫出來都一樣 */
function rng(seed: number) {
  let k = seed
  return () => {
    k = (k * 9301 + 49297) % 233280
    return k / 233280
  }
}
/** 在範圍裡撒 n 個點 */
function scatter(n: number, x0: number, x1: number, y0: number, y1: number, seed: number): Pt[] {
  const rand = rng(seed)
  return Array.from({ length: n }, () => [Math.round(x0 + rand() * (x1 - x0)), Math.round(y0 + rand() * (y1 - y0))] as Pt)
}
/** 樹林的樹冠：一連串圓弧的輪廓，底部封到 base */
function canopy(x0: number, x1: number, y: number, base: number, fill: string, op = 1, seed = 1, size = 12): string {
  let d = `M${x0} ${base} L${x0} ${y}`
  let x = x0
  const rand = rng(seed)
  while (x < x1) {
    const w = size + rand() * size * 0.9
    const yy = y + rand() * 8 - 4
    const nx = Math.min(x1, x + w)
    d += ` Q${Math.round((x + nx) / 2)} ${Math.round(yy - w * 0.75)} ${Math.round(nx)} ${Math.round(yy)}`
    x = nx
  }
  return `<path d="${d} L${x1} ${base}Z" fill="${fill}" opacity="${op}" ${E}/>`
}
/** 斜的花帶（山坡上連成一片的櫻）：上緣是一串圓弧，沿著 (x0,y0)–(x1,y1) 的斜線，底部封到 base */
function band(x0: number, y0: number, x1: number, y1: number, fill: string, op: number, seed: number, size = 11, base = 324): string {
  const rand = rng(seed)
  const at = (x: number) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  let d = `M${x0} ${base} L${x0} ${Math.round(y0)}`
  let x = x0
  while (x < x1) {
    const w = size + rand() * size * 0.9
    const nx = Math.min(x1, x + w)
    const yy = at(nx) + rand() * 6 - 3
    d += ` Q${Math.round((x + nx) / 2)} ${Math.round((at(x) + yy) / 2 - w * 0.7)} ${Math.round(nx)} ${Math.round(yy)}`
    x = nx
  }
  return `<path d="${d} L${x1} ${base}Z" fill="${fill}" opacity="${op}" ${E}/>`
}
/** 幾個圓疊成一團（樹冠、花團）：[cx, cy, 半徑] */
const blob = (cs: Array<[number, number, number]>) =>
  cs
    .map(([cx, cy, q]) => [Math.round(cx), Math.round(cy), Math.round(q)])
    .map(([cx, cy, q]) => `M${cx - q} ${cy}a${q} ${q} 0 1 0 ${2 * q} 0a${q} ${q} 0 1 0 ${-2 * q} 0`)
    .join('')
/** 一片圓團的樹（櫻、楓、闊葉樹）：[x 樹根, y 地面, s 大小]。樹幹、樹冠（幾個圓疊成）、右下的陰影、花的白點各畫成一條 path */
function grove(ts: Array<[number, number, number]>, fill: string, dots = '', seed = 1): string {
  let trunk = ''
  let crown = ''
  let shade = ''
  let pts: Pt[] = []
  for (const [x, y, s] of ts) {
    const q = (v: number) => r(v * s)
    trunk += `M${r(x - 2.2 * s)} ${y} L${r(x - 1.3 * s)} ${r(y - 18 * s)} h${q(2.6)} L${r(x + 2.2 * s)} ${y}Z`
    crown += blob([
      [x, y - 31 * s, 12 * s],
      [x - 10 * s, y - 23 * s, 9 * s],
      [x + 10 * s, y - 24 * s, 10 * s],
      [x - 3 * s, y - 39 * s, 8 * s],
    ])
    shade += `M${r(x + 19.6 * s)} ${r(y - 24 * s)}a${q(9.6)} ${q(9.6)} 0 0 1 ${q(-15)} ${q(8)}a${q(14)} ${q(14)} 0 0 0 ${q(15)} ${q(-8)}Z`
    if (dots) pts = pts.concat(scatter(Math.round(5 * s), x - 13 * s, x + 12 * s, y - 40 * s, y - 18 * s, seed++))
  }
  // 樹冠畫兩次：第二次不帶紙邊，蓋掉圓與圓重疊處裡面的邊，只留外緣
  return (
    paper([
      [trunk, C.brown],
      [crown, fill],
    ]) +
    `<path d="${crown}" fill="${fill}"/><path d="${shade}" ${SH}/>` +
    (dots ? specks(pts, 2.4, dots, 0.75) : '')
  )
}

// ---------- 兵庫 ----------
const TILE = C.grey
/**
 * 城（白牆、灰瓦、破風）的畫具：牆、屋頂、破風各自累積成一條 path，最後一次輸出（字數少，前後順序也固定：牆→屋頂→破風）。
 * wall(x, yb, w, h, k)：白牆一層、k 扇窗；roof(x, y, wb, wt, h)：屋簷在 y，屋面內凹、兩端微翹；chidori／kara：三角與弧形的破風
 */
interface CastleKit {
  wall(x: number, yb: number, w: number, h: number, n: number): CastleKit
  roof(x: number, y: number, wb: number, wt: number, h: number): CastleKit
  chidori(x: number, yb: number, w: number, h: number): CastleKit
  kara(x: number, yb: number, w: number, h: number): CastleKit
  out(): string
}
function castleKit(): CastleKit {
  const L = { wall: '', shade: '', win: '', roof: '', eave: '', gable: '', face: '' }
  const k: CastleKit = {
    wall(x: number, yb: number, w: number, h: number, n: number) {
      L.wall += rect(x - w / 2, yb - h, w, h)
      L.shade += rect(x + w * 0.3, yb - h, w * 0.2, h) + rect(x - w / 2, yb - h, w, 2.4)
      // 窗：一排間隔 9 的小窗（全部的窗共用一條虛線 path，每一段 subpath 重新起算虛線）
      const x0 = x - ((n - 1) * 9 + 3) / 2
      L.win += `M${r(x0)} ${r(yb - h * 0.45)}H${r(x0 + (n - 1) * 9 + 3)}`
      return k
    },
    roof(x: number, y: number, wb: number, wt: number, h: number) {
      const a = x - wb / 2
      const b = x + wb / 2
      const d = (wb - wt) / 2
      L.roof += `M${r(a)} ${r(y - 1.6)} Q${r(x)} ${r(y + 1.4)} ${r(b)} ${r(y - 1.6)} Q${r(b - d * 0.64)} ${r(y - h * 0.35)} ${r(x + wt / 2)} ${r(y - h)} L${r(x - wt / 2)} ${r(y - h)} Q${r(a + d * 0.64)} ${r(y - h * 0.35)} ${r(a)} ${r(y - 1.6)}Z`
      L.eave += `M${r(a + 3)} ${r(y - 1.1)} Q${r(x)} ${r(y + 1.7)} ${r(b - 3)} ${r(y - 1.1)}`
      return k
    },
    chidori(x: number, yb: number, w: number, h: number) {
      L.gable += `M${r(x - w / 2)} ${r(yb)} Q${r(x - w * 0.18)} ${r(yb - h * 0.5)} ${r(x)} ${r(yb - h)} Q${r(x + w * 0.18)} ${r(yb - h * 0.5)} ${r(x + w / 2)} ${r(yb)}Z`
      L.face += `M${r(x - w * 0.3)} ${r(yb - 0.8)} L${r(x)} ${r(yb - h * 0.72)} L${r(x + w * 0.3)} ${r(yb - 0.8)}Z`
      return k
    },
    kara(x: number, yb: number, w: number, h: number) {
      const bell = (ww: number, hh: number, y0: number) =>
        `M${r(x - ww / 2)} ${r(y0)} C${r(x - ww * 0.26)} ${r(y0)} ${r(x - ww * 0.3)} ${r(y0 - hh)} ${r(x)} ${r(y0 - hh)} C${r(x + ww * 0.3)} ${r(y0 - hh)} ${r(x + ww * 0.26)} ${r(y0)} ${r(x + ww / 2)} ${r(y0)}Z`
      L.gable += bell(w, h, yb)
      L.face += bell(w * 0.6, h * 0.55, yb - 0.6)
      return k
    },
    out: () =>
      paper([[L.wall, C.white]]) +
      `<path d="${L.shade}" ${SH}/><path d="${L.win}" fill="none" stroke="${C.ink}" stroke-width="4.5" stroke-dasharray="3 6" stroke-opacity=".55"/>` +
      paper([[L.roof, TILE]]) +
      `<path d="${L.eave}" ${line(1, C.white, 0.85)}/>` +
      paper([
        [L.gable, TILE],
        [L.face, C.white],
      ]),
  }
  return k
}
/** 石垣：上陡下緩的扇形勾配。x 中心、y 上緣、wt 上緣寬、wb 下緣寬、h 高 */
function ishigaki(x: number, y: number, wt: number, wb: number, h: number): string {
  const a = wt / 2
  const b = wb / 2
  const d = `M${r(x - b)} ${r(y + h)} Q${r(x - a - 1)} ${r(y + h * 0.65)} ${r(x - a)} ${r(y)} L${r(x + a)} ${r(y)} Q${r(x + a + 1)} ${r(y + h * 0.65)} ${r(x + b)} ${r(y + h)}Z`
  let rows = ''
  for (let i = 1; i < 5; i++) {
    const hw = a + (b - a) * (i / 5) ** 2
    rows += `M${r(x - hw)} ${r(y + (h * i) / 5)}h${r(hw * 2)}`
  }
  return (
    paper([[d, C.grey]]) +
    `<path d="${d}" fill="${C.white}" opacity=".4"/>` +
    `<path d="M${r(x + a * 0.45)} ${r(y)} L${r(x + a)} ${r(y)} Q${r(x + a + 1)} ${r(y + h * 0.65)} ${r(x + b)} ${r(y + h)} L${r(x + b * 0.5)} ${r(y + h)}Z" ${SH}/>` +
    `<path d="${rows}" ${line(1, C.white, 0.6)}/>`
  )
}
/** 姬路城大天守：石垣上五層白牆、一層層的千鳥破風與唐破風，屋脊兩端的鯱。x 中心、y 石垣上緣 */
function himeji(x: number, y: number): string {
  const k = castleKit()
  const lv: Array<[number, number, number, number, number, (e: number) => void]> = [
    [74, 24, 92, 66, 10, (e) => k.chidori(x - 20, e, 30, 15).chidori(x + 20, e, 30, 15)],
    [64, 19, 80, 54, 9, (e) => k.chidori(x, e, 44, 22)],
    [52, 16, 66, 42, 8, (e) => k.chidori(x - 13, e, 20, 11).chidori(x + 13, e, 20, 11)],
    [42, 15, 56, 34, 8, (e) => k.kara(x, e, 28, 11)],
    [32, 15, 52, 24, 15, () => {}],
  ]
  let yb = y
  for (const [w, h, wb, wt, rh, g] of lv) {
    const e = yb - h + 2
    k.wall(x, yb, w, h, Math.round(w / 9)).roof(x, e, wb, wt, rh)
    g(e - 0.5)
    yb = e - rh + 1
  }
  return (
    ishigaki(x, y, 76, 98, 34) +
    k.out() +
    `<path d="M${x - 12} ${yb} L${x + 12} ${yb}" ${line(2.4, TILE)}/>` +
    `<path d="M${x - 12} ${yb} q-1.5 -3.5 0.6 -5.5 q0.6 3 1 5.5Z M${x + 12} ${yb} q1.5 -3.5 -0.6 -5.5 q-0.6 3 -1 5.5Z" fill="${C.ink}" opacity=".5"/>`
  )
}
/** 西之丸：石垣上的長廊（百間廊下）與兩層的角櫓。x0 長廊左端、x1 右端、yb 石垣上緣 */
function nishinomaru(x0: number, x1: number, yb: number): string {
  const k = castleKit()
  const m = (x0 + x1) / 2
  k.wall(m, yb, x1 - x0, 15, Math.round((x1 - x0) / 9)).roof(m, yb - 13, x1 - x0 + 4, x1 - x0 - 6, 7)
  const t = x0 - 6
  k.wall(t, yb, 40, 22, 4).roof(t, yb - 20, 54, 34, 8).wall(t, yb - 27, 26, 12, 3).roof(t, yb - 37, 40, 12, 11).chidori(t, yb - 20.5, 22, 11)
  return k.out() + `<path d="M${t - 6} ${yb - 48} L${t + 6} ${yb - 48}" ${line(2, TILE)}/>`
}

/** 神戶港塔：紅色鋼管組成的鼓形塔（雙曲面），頂上是展望台。x 中心、yb 塔腳、yt 鋼管的上緣 */
function portTower(x: number, yb: number, yt: number): string {
  const R0 = 16
  const R1 = 11
  const ph = (123 * Math.PI) / 180
  const H = yb - yt
  const rad = (t: number) => Math.sqrt((1 - t) ** 2 * R0 * R0 + t * t * R1 * R1 + 2 * t * (1 - t) * R0 * R1 * Math.cos(ph))
  const ts = Array.from({ length: 11 }, (_, i) => i / 10)
  const side = (sg: number) => ts.map((t) => [x + sg * rad(t), yb - t * H] as Pt)
  const outline = poly([...side(-1), ...side(1).reverse()])
  let pipes = ''
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6
    for (const sg of [1, -1]) pipes += `M${r(x + R0 * Math.cos(a))} ${yb}L${r(x + R1 * Math.cos(a + sg * ph))} ${yt}`
  }
  const dt = yt - 24
  return (
    shape(outline, C.red) +
    `<path d="${pipes}" ${line(0.9, C.yellow, 0.45)}/>` +
    `<path d="${poly([...side(1).slice(0, 6), [x + 2, yb - 0.5 * H], [x + 4, yb]])}" ${SH}/>` +
    // 展望台（五層，燈亮著）與屋頂
    paper([
      [rect(x - 15, dt, 30, 26), C.red],
      [rect(x - 10, dt - 6, 20, 6), C.white],
      [rect(x - 5, dt - 11, 10, 5), C.white],
    ]) +
    bars(x - 13, x + 13, dt + 5, 2.6, 2.6, 1.4, C.yellow, 0.9) +
    bars(x - 13, x + 13, dt + 11, 2.6, 2.6, 1.4, C.yellow, 0.9) +
    bars(x - 13, x + 13, dt + 17, 2.6, 2.6, 1.4, C.yellow, 0.9) +
    `<path d="M${x} ${dt - 11} L${x} ${dt - 22}" ${line(1.2, C.white, 0.9)}/>` +
    // 塔腳的低樓
    paper([[rect(x - 27, yb - 11, 54, 11), C.cream]]) +
    bars(x - 24, x + 24, yb - 5.5, 3, 3, 3, C.yellow, 0.85)
  )
}
/** 神戶海洋博物館：白色鋼管組成、像帆與浪的屋頂。x0 左端、yb 地面 */
function museum(x0: number, yb: number): string {
  const top: Pt[] = [
    [x0, yb - 14],
    [x0 + 16, yb - 48],
    [x0 + 30, yb - 24],
    [x0 + 50, yb - 70],
    [x0 + 64, yb - 30],
    [x0 + 80, yb - 54],
    [x0 + 94, yb - 14],
  ]
  let ribs = ''
  for (const i of [1, 3, 5]) {
    const [px, py] = top[i]
    for (let dx = -16; dx <= 16; dx += 8) ribs += `M${px} ${py} L${px + dx} ${yb - 14}`
  }
  return (
    `<path d="${poly(top)}" fill="${C.white}" opacity=".22"/>` +
    `<path d="${ribs}" ${line(0.9, C.white, 0.7)}/>` +
    `<path d="M${top.map(([x, y]) => `${x} ${y}`).join(' L')}" ${line(1.8, C.white, 0.95)}/>` +
    paper([[rect(x0 - 2, yb - 15, 98, 15), C.cream]]) +
    bars(x0 + 2, x0 + 94, yb - 7.5, 5, 6, 3, C.yellow, 0.8)
  )
}

/** 明石海峽大橋的主塔（正面）：兩根塔柱與橫梁，灰綠色。x 中心、yb 海面、yt 塔頂、w 寬 */
function akashiTower(x: number, yb: number, yt: number, w: number): string {
  const lw = w * 0.22
  const tw = w * 0.84
  const leg = (sg: number) =>
    poly([
      [x + (sg * w) / 2, yb],
      [x + sg * (w / 2 - lw), yb],
      [x + sg * (tw / 2 - lw), yt],
      [x + (sg * tw) / 2, yt],
    ])
  let beams = ''
  for (const f of [0, 0.24, 0.5]) {
    const yy = yt + f * (yb - yt)
    const hw = tw / 2 + ((w - tw) / 2) * f - lw * 0.5
    beams += rect(x - hw, yy, hw * 2, Math.max(2, w * 0.1))
  }
  const d = `${leg(-1)} ${leg(1)} ${beams}`
  return shape(d, C.grey) + `<path d="${d}" fill="${C.green}" opacity=".16"/>` + `<path d="${leg(1)}" ${SH}/>`
}
/** 松：往左彎的樹幹與幾片上緣起伏、下緣平的樹冠（濃綠）。x 樹根、y 地面 */
function pine(x: number, y: number, s: number): string {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const pad = (cx: number, cy: number, w: number, h: number) =>
    `M${p(cx - w / 2, cy)} Q${p(cx - w / 2, cy - h * 0.8)} ${p(cx - w / 6, cy - h * 0.85)} Q${p(cx, cy - h * 1.25)} ${p(cx + w / 6, cy - h * 0.85)} Q${p(cx + w / 2, cy - h * 0.8)} ${p(cx + w / 2, cy)}Z`
  const pads = `${pad(-22, -70, 36, 12)} ${pad(0, -52, 30, 10)} ${pad(-34, -46, 22, 8)}`
  return (
    shape(`M${p(-4, 0)} Q${p(-4, -40)} ${p(-24, -70)} L${p(-19, -71)} Q${p(4, -40)} ${p(4, 0)}Z M${p(-2, -40)} L${p(1, -52)} L${p(4, -51)} L${p(1, -38)}Z M${p(-12, -56)} L${p(-30, -46)} L${p(-29, -44)} L${p(-10, -52)}Z`, C.brown) +
    shape(pads, C.green) +
    `<path d="${pads}" fill="${C.ink}" opacity=".18"/>` +
    `<path d="M${p(-38, -71)} h${r(32 * s)} M${p(-13, -53)} h${r(26 * s)} M${p(-43, -47)} h${r(18 * s)}" ${line(2.4 * s, C.white, 0.25)}/>`
  )
}
/** 明石海峽大橋：從舞子的岸邊順著橋看出去，近的主塔在左、遠的主塔在右，兩條主纜垂下來，橋面往淡路島收去 */
function akashiBridge(): string {
  const top = (x: number) => 243 + (x - 52) * 0.163
  const bot = (x: number) => top(x) + (302 - top(x)) * 0.15
  // 橋面（加勁桁）與上面的斜格
  let zig = `M-5 ${r(top(-5))}`
  let up = false
  for (let x = -5; x < 305; ) {
    x += (bot(x) - top(x)) * 1.15
    zig += ` L${r(x)} ${r(up ? top(x) : bot(x))}`
    up = !up
  }
  const deck = poly([
    [-5, top(-5)],
    [305, top(305)],
    [305, bot(305)],
    [-5, bot(-5)],
  ])
  // 主纜：二次曲線，從近塔頂垂到橋面附近再上到遠塔頂（下面的 cables）；吊索從前面那條主纜垂到橋面
  const B = (t: number): Pt => [(1 - t) ** 2 * 63 + 2 * t * (1 - t) * 130 + t * t * 241, (1 - t) ** 2 * 36 + 2 * t * (1 - t) * 330 + t * t * 170]
  let hang = ''
  for (let t = 0.05; t < 0.97; t += 0.034) {
    const [x, y] = B(t)
    if (y < top(x) - 2) hang += `M${r(x)} ${r(y)}V${r(top(x))}`
  }
  const cables =
    `M41 36 Q118 330 231 170 M63 36 Q130 330 241 170 M41 36 Q10 150 -6 226 M63 36 Q26 150 8 222 M231 170 Q262 232 306 260 M241 170 Q270 230 306 252`
  return (
    `<path d="${hang}" ${line(0.6, C.ink, 0.3)}/>` +
    `<path d="${cables}" ${line(1.6, C.grey)}/>` +
    akashiTower(236, 302, 168, 15) +
    shape(deck, C.grey) +
    `<path d="${deck}" fill="${C.green}" opacity=".16"/>` +
    `<path d="${zig}" ${line(0.8, C.white, 0.6)}/>` +
    akashiTower(52, 308, 34, 30) +
    paper([[rect(28, 300, 48, 10), C.grey], [rect(229, 298, 14, 5), C.grey]]) +
    `<path d="${rect(52, 300, 24, 10)}" ${SH}/>`
  )
}

const HYOGO: Outfit[] = [
  // 姫路城（data/spots/hyogo.json wd-Q188754，https://zh.wikipedia.org/wiki/%E5%A7%AC%E8%B7%AF%E5%9F%8E）：春天，姬山上石垣與白色的大天守、層層的千鳥破風與唐破風，左邊是西之丸的長廊與角櫓，城下一片櫻花
  bg({
    id: 'bg-hyogo-himeji',
    name: '姬路城',
    pref: 'hyogo',
    rarity: 3,
    art:
      sky(C.blue, 0.2) +
      cloud(66, 64, 1.15) +
      cloud(204, 30, 0.8, 0.8) +
      himeji(226, 236) +
      canopy(-4, 304, 274, 322, C.green, 0.92, 5, 16) +
      ishigaki(54, 270, 128, 140, 28) +
      nishinomaru(38, 120, 270) +
      canopy(-4, 304, 306, 324, C.pink, 0.95, 9, 13) +
      specks(scatter(22, 0, 300, 298, 318, 3), 2.4, C.white, 0.7) +
      grove(
        [
          [84, 322, 1.7],
          [20, 324, 1.25],
          [290, 324, 1.3],
        ],
        C.pink,
        C.white,
        11,
      ) +
      ground(C.matcha, 320, 0.42) +
      `<path d="M134 320 L166 320 L198 400 L102 400Z" fill="${C.cream}" opacity=".85" ${E}/>` +
      specks(scatter(14, 0, 300, 326, 398, 7), 2.6, C.pink, 0.9),
  }),
  // 神戸ポートタワー（data/spots/hyogo.json wd-Q798766，https://zh.wikipedia.org/wiki/%E7%A5%9E%E6%88%B6%E6%B8%AF%E5%A1%94）：夜裡隔著港口看紅色鼓形的港塔與白色帆形的海洋博物館，後面是六甲山與市區的燈
  bg({
    id: 'bg-hyogo-kobe-port',
    name: '神戶港塔',
    pref: 'hyogo',
    rarity: 2,
    art:
      sky(C.navy, 0.72, C.cream) +
      specks(scatter(18, 10, 290, 8, 150, 21), 1.8, C.white, 0.7) +
      ridge(
        [
          [-4, 236],
          [40, 214],
          [96, 222],
          [150, 204],
          [210, 218],
          [262, 208],
          [304, 224],
        ],
        C.navy,
        0.55,
        300,
      ) +
      specks(scatter(46, 0, 300, 246, 280, 22), 1.6, C.yellow, 0.55) +
      `<path d="${rect(92, 252, 18, 48)} ${rect(112, 262, 14, 38)} ${rect(128, 246, 16, 54)} ${rect(146, 266, 20, 34)} ${rect(168, 256, 14, 44)} ${rect(184, 270, 18, 30)} ${rect(0, 270, 30, 30)} ${rect(270, 268, 30, 32)}" fill="${C.navy}" opacity=".7" ${E}/>` +
      specks(scatter(34, 94, 200, 254, 298, 23), 1.6, C.yellow, 0.75) +
      portTower(60, 298, 150) +
      museum(192, 298) +
      `<rect y="298" width="300" height="24" fill="${C.blue}" opacity=".4"/>` +
      `<path d="M53 304 L67 304 M55 309 L65 309 M57 314 L63 314" ${line(2, C.red, 0.7)}/>` +
      `<path d="M206 304 L280 304 M214 309 L270 309 M226 314 L256 314" ${line(1.6, C.white, 0.55)}/>` +
      ripples(
        [
          [24, 305],
          [110, 304],
          [150, 310],
          [126, 315],
          [182, 305],
        ],
        12,
        0.4,
      ) +
      ground(C.brown, 320, 0.55) +
      `<rect y="320" width="300" height="80" fill="${C.navy}" opacity=".4"/>` +
      `<path d="M0 340 L300 340 M0 362 L300 362 M0 388 L300 388" ${line(1.2, C.white, 0.16)}/>` +
      // 港邊的欄杆
      `<path d="M-2 310 L302 310" ${line(1.8, C.cream, 0.7)}/>` +
      bars(3, 300, 316, 12, 1.6, 14.4, C.cream, 0.6),
  }),
  // 明石海峡大橋（data/spots/hyogo.json wd-Q184213，https://zh.wikipedia.org/wiki/%E6%98%8E%E7%9F%B3%E6%B5%B7%E5%B3%A1%E5%A4%A7%E6%A1%A5）：夏天的白天，從舞子的海邊看灰綠色的吊橋，兩座主塔與主纜，遠方是淡路島，岸邊有松
  bg({
    id: 'bg-hyogo-akashi-bridge',
    name: '明石海峽大橋',
    pref: 'hyogo',
    rarity: 1,
    art:
      sky(C.blue, 0.28) +
      cloud(150, 72, 1.3) +
      cloud(258, 112, 0.8, 0.85) +
      cloud(30, 150, 0.7, 0.8) +
      ridge(
        [
          [150, 302],
          [186, 292],
          [226, 286],
          [264, 289],
          [304, 296],
        ],
        C.green,
        0.34,
        304,
      ) +
      `<rect y="300" width="300" height="22" fill="${C.blue}" opacity=".5"/>` +
      ripples(
        [
          [100, 306],
          [168, 312],
          [212, 306],
          [270, 314],
          [18, 314],
        ],
        14,
        0.5,
      ) +
      akashiBridge() +
      ground(C.yellow, 320, 0.3) +
      `<path d="M-2 322 Q38 317 78 322 T158 322 T238 322 T318 322" ${line(2.4, C.white, 0.85)}/>` +
      specks(scatter(14, 0, 300, 340, 396, 31), 2.4, C.brown, 0.3) +
      pine(292, 340, 1),
  }),
]

// ---------- 奈良 ----------
/** 鹿（側面）：x 身體中心、y 腳底、s 大小、dir 1 朝右／-1 朝左 */
function deer(x: number, y: number, s: number, dir = 1): string {
  const p = (dx: number, dy: number) => `${Math.round(x + dir * dx * s)} ${Math.round(y + dy * s)}`
  const legs = `M${p(-10, -15)} L${p(-11, 0)} M${p(-6, -15)} L${p(-5, 0)} M${p(8, -15)} L${p(9, 0)} M${p(12, -15)} L${p(12.5, 0)}`
  const body = `M${p(-15, -18)} Q${p(-17, -28)} ${p(-7, -28)} L${p(9, -28)} Q${p(15, -27)} ${p(14, -18)} Q${p(12, -13)} ${p(6, -14)} L${p(-9, -14)} Q${p(-15, -13)} ${p(-15, -18)}Z`
  const head = `M${p(8, -26)} L${p(11, -40)} L${p(13, -43)} L${p(18, -42.5)} L${p(24, -38.5)} L${p(23.5, -36)} L${p(17, -35)} L${p(16, -22)}Z M${p(12, -41.5)} L${p(4.5, -46)} L${p(10, -43.5)}Z M${p(13.5, -42.5)} L${p(11, -49.5)} L${p(15.5, -43)}Z`
  return (
    `<path d="${legs}" ${line(2.6 * s, C.brown)}/>` +
    shape(`${body} ${head}`, C.brown) +
    `<path d="M${p(-12, -17)} Q${p(0, -12)} ${p(12, -17)} L${p(9, -15)} L${p(-9, -15)}Z M${p(-15, -24)} q${r(-2.4 * dir * s)} ${r(2 * s)} 0 ${r(5 * s)}" fill="${C.cream}" opacity=".8"/>` +
    `<path d="M${p(-15, -18)} Q${p(-15, -13)} ${p(-9, -14)} L${p(6, -14)} Q${p(12, -13)} ${p(14, -18)}Z" ${SH}/>` +
    specks([[x + dir * 18 * s, y - 40 * s]], 1.8 * s, C.ink, 0.8)
  )
}
/** 東大寺大佛殿：巨大的寄棟屋頂、屋脊兩端金色的鴟尾、下層的裳階屋頂與正中的唐破風。x 中心 */
function daibutsuden(x: number): string {
  const up = `M${x - 132} 211 Q${x} 220 ${x + 132} 211 Q${x + 94} 202 ${x + 68} 152 L${x - 68} 152 Q${x - 94} 202 ${x - 132} 211Z`
  const low = `M${x - 140} 251 Q${x} 258 ${x + 140} 251 Q${x + 122} 245 ${x + 108} 235 L${x - 108} 235 Q${x - 122} 245 ${x - 140} 251Z`
  const bell = (w: number, h: number, y0: number) => `M${x - w / 2} ${y0} C${x - w * 0.26} ${y0} ${x - w * 0.3} ${y0 - h} ${x} ${y0 - h} C${x + w * 0.3} ${y0 - h} ${x + w * 0.26} ${y0} ${x + w / 2} ${y0}Z`
  // 鴟尾：像立起來的魚尾，外緣圓、尖端朝屋脊的中間彎
  const shibi = (sg: number) =>
    `M${x + sg * 75} 147 Q${x + sg * 80} 127 ${x + sg * 62} 117 Q${x + sg * 68} 133 ${x + sg * 60} 147Z`
  return (
    // 上層的牆（白牆與木柱）
    paper([[rect(x - 106, 212, 212, 26), C.white]]) +
    bars(x - 100, x + 106, 225, 26, 4, 22.4, C.brown, 0.85) +
    `<path d="${rect(x - 106, 212, 212, 4)}" ${SH}/>` +
    paper([[up, TILE]]) +
    `<path d="${up}" fill="${C.ink}" opacity=".18"/>` +
    `<path d="M${x - 128} 211.5 Q${x} 220.5 ${x + 128} 211.5" ${line(1.4, C.white, 0.6)}/>` +
    `<path d="M${x - 92} 196 Q${x} 201 ${x + 92} 196 M${x - 80} 178 Q${x} 182 ${x + 80} 178 M${x - 72} 163 L${x + 72} 163" ${line(1, C.white, 0.3)}/>` +
    paper([
      [rect(x - 70, 147, 140, 6), TILE],
      [`${shibi(-1)} ${shibi(1)}`, C.gold],
    ]) +
    `<path d="${rect(x - 70, 147, 140, 6)}" fill="${C.ink}" opacity=".35"/>` +
    `<path d="M${x - 70} 140 l4 -1 M${x - 71} 133 l4 -2 M${x + 70} 140 l-4 -1 M${x + 71} 133 l-4 -2" ${line(1, C.white, 0.7)}/>` +
    // 下層：白牆、柱、裳階的屋頂、正中的唐破風（觀相窗）
    paper([[rect(x - 116, 250, 232, 14), C.white]]) +
    bars(x - 112, x + 116, 257, 14, 4, 20.6, C.brown, 0.85) +
    paper([[low, TILE]]) +
    `<path d="${low}" fill="${C.ink}" opacity=".18"/>` +
    paper([
      [bell(66, 26, 251), TILE],
      [bell(44, 16, 250), C.white],
    ]) +
    `<path d="M${x - 12} 248 h24 v-6 h-24Z" fill="${C.ink}" opacity=".5"/>`
  )
}
/** 回廊：朱柱、連子窗、灰瓦的長廊，從 x0 到 x1，y 屋簷 */
const kairo = (x0: number, x1: number, y: number) =>
  paper([
    [rect(x0, y, x1 - x0, 36), C.white],
    [rect(x0, y + 4, x1 - x0, 16), C.ink],
  ]) +
  bars(x0, x1, y + 12, 16, 2, 3, C.red, 0.9) +
  bars(x0 + 2, x1, y + 18, 36, 5, 17, C.red) +
  `<path d="${rect(x0, y, x1 - x0, 4)}" fill="${C.red}"/>` +
  paper([[`M${x0} ${y + 2} L${x1} ${y + 2} L${x1} ${y - 9} L${x0} ${y - 9}Z`, TILE]]) +
  `<path d="M${x0} ${y + 1} H${x1}" ${line(1.4, C.white, 0.6)}/>`

/** 吉野山的藏王堂：檜皮葺的大屋頂（下面一層裳階，上面入母屋的山牆），木柱不上漆。x 中心、y 地面 */
function zaodo(x: number, y: number): string {
  const roofU = `M${x - 50} ${y - 46} Q${x} ${y - 43} ${x + 50} ${y - 46} Q${x + 39} ${y - 52} ${x + 33} ${y - 63} L${x} ${y - 88} L${x - 33} ${y - 63} Q${x - 39} ${y - 52} ${x - 50} ${y - 46}Z`
  const roofL = `M${x - 48} ${y - 22} Q${x} ${y - 19} ${x + 48} ${y - 22} Q${x + 40} ${y - 27} ${x + 34} ${y - 34} L${x - 34} ${y - 34} Q${x - 40} ${y - 27} ${x - 48} ${y - 22}Z`
  return (
    paper([
      [rect(x - 40, y - 4, 80, 5), C.grey],
      [rect(x - 38, y - 24, 76, 20), C.cream],
      [rect(x - 30, y - 48, 60, 16), C.cream],
    ]) +
    bars(x - 38, x + 38, y - 14, 20, 3, 9.7, C.brown, 0.85) +
    bars(x - 30, x + 30, y - 40, 16, 3, 8.5, C.brown, 0.85) +
    paper([[`${roofL} ${roofU}`, C.brown]]) +
    `<path d="${roofL} ${roofU}" fill="${C.ink}" opacity=".22"/>` +
    paper([[`M${x - 27} ${y - 63} L${x} ${y - 83} L${x + 27} ${y - 63}Z`, C.cream]]) +
    `<path d="M${x - 33} ${y - 62} L${x} ${y - 87} L${x + 33} ${y - 62} M${x} ${y - 82} V${y - 63} M${x - 18} ${y - 70} H${x + 18}" ${line(1.4, C.brown, 0.9)}/>` +
    `<path d="M${x - 46} ${y - 45.5} Q${x} ${y - 42.5} ${x + 46} ${y - 45.5} M${x - 44} ${y - 21.5} Q${x} ${y - 18.5} ${x + 44} ${y - 21.5}" ${line(1, C.white, 0.35)}/>`
  )
}
/** 興福寺五重塔：不上漆的木造、白牆、灰瓦，細長。x 中心、y 塔基上緣、s 大小 */
function kofukujiPagoda(x: number, y: number, s: number, wood: string, roofFill: string): string {
  let body = ''
  let wall = ''
  let roof = ''
  let bottom = y
  for (let i = 0; i < 5; i++) {
    const bw = (24 - i * 2.2) * s
    const rw = (56 - i * 4.6) * s
    const top = bottom - (i === 0 ? 17 : 12) * s
    body += rect(x - bw / 2, top, bw, bottom - top)
    wall += rect(x - bw / 2 + 3 * s, top + 3 * s, bw - 6 * s, bottom - top - 5 * s)
    roof += `M${r(x - rw / 2)} ${r(top + 1 * s)} C${r(x - rw / 4)} ${r(top - 1.5 * s)} ${r(x - rw / 6)} ${r(top - 7 * s)} ${r(x)} ${r(top - 7 * s)} C${r(x + rw / 6)} ${r(top - 7 * s)} ${r(x + rw / 4)} ${r(top - 1.5 * s)} ${r(x + rw / 2)} ${r(top + 1 * s)} L${r(x + rw / 2 - 3 * s)} ${r(top + 3.5 * s)} L${r(x - rw / 2 + 3 * s)} ${r(top + 3.5 * s)}Z`
    bottom = top - 7 * s
  }
  let rings = ''
  for (let i = 0; i < 9; i++) rings += `M${r(x - 3.4 * s)} ${r(bottom - (4 + i * 2.8) * s)} h${r(6.8 * s)}`
  return (
    paper([
      [body, wood],
      [wall, C.cream],
      [roof, roofFill],
    ]) +
    `<path d="M${x} ${r(bottom + 2 * s)} V${r(bottom - 32 * s)}" ${line(2 * s, C.gold, 0.9)}/><path d="${rings}" ${line(1.2 * s, C.gold, 0.9)}/>`
  )
}

/** 垂柳：往左斜的樹幹，樹頂分出幾根彎的枝，一條條細枝從枝上垂下來。x 樹根、y 地面 */
function willow(x: number, y: number, seed: number): string {
  const rand = rng(seed)
  const tx = x - 18
  const ty = y - 104
  const ends: Pt[] = [
    [x - 56, y - 104],
    [x - 40, y - 124],
    [x - 16, y - 132],
    [x + 4, y - 126],
    [x + 16, y - 108],
  ]
  let arms = ''
  let a = ''
  let b = ''
  ends.forEach(([ex, ey], k) => {
    arms += `M${tx} ${ty} Q${r((tx + ex) / 2)} ${r(Math.min(ty, ey) - 8)} ${ex} ${ey}`
    for (let i = 0; i < 7; i++) {
      const t = 0.2 + i * 0.13
      const sx = tx + (ex - tx) * t
      const sy = ty + (ey - ty) * t - 6 * Math.sin(Math.PI * t)
      const len = 70 + rand() * 60
      const dx = (ex - tx) * 0.08
      const d = `M${r(sx)} ${r(sy)} Q${r(sx + dx)} ${r(sy + len * 0.35)} ${r(sx + dx * 1.6)} ${r(sy + len)}`
      if ((i + k) % 2) a += d
      else b += d
    }
  })
  return (
    shape(`M${x - 4} ${y} Q${x - 2} ${y - 50} ${tx - 3} ${ty} L${tx + 4} ${ty - 1} Q${x + 5} ${y - 50} ${x + 5} ${y}Z`, C.brown) +
    `<path d="${arms}" ${line(2.2, C.brown)}/>` +
    `<path d="${a}${b}" ${line(6, C.green, 0.3)}/><path d="${a}" ${line(2.2, C.green, 0.9)}/><path d="${b}" ${line(2, C.matcha, 0.9)}/>`
  )
}

const NARA: Outfit[] = [
  // 東大寺（data/spots/nara.json wd-Q460367，https://zh.wikipedia.org/wiki/%E4%B8%9C%E5%A4%A7%E5%AF%BA）：秋天，朱色回廊後面的大佛殿，巨大的屋頂與金色的鴟尾，草地上的鹿與紅葉
  bg({
    id: 'bg-nara-todaiji',
    name: '東大寺',
    pref: 'nara',
    rarity: 3,
    art:
      sky(C.blue, 0.24) +
      cloud(58, 70, 1.1) +
      cloud(238, 46, 0.9, 0.85) +
      ridge(
        [
          [-4, 262],
          [60, 236],
          [140, 246],
          [230, 228],
          [304, 244],
        ],
        C.green,
        0.32,
      ) +
      daibutsuden(150) +
      kairo(-4, 304, 272) +
      grove(
        [
          [22, 320, 1.5],
          [286, 320, 1.6],
          [252, 316, 1.0],
        ],
        C.red,
        C.orange,
        41,
      ) +
      grove([[50, 318, 1.1]], C.yellow, C.orange, 44) +
      ground(C.matcha, 320, 0.45) +
      `<path d="M128 320 L172 320 L190 400 L110 400Z" fill="${C.cream}" opacity=".8" ${E}/>` +
      specks(scatter(14, 0, 300, 326, 398, 45), 2.6, C.orange, 0.7) +
      deer(56, 352, 1.15, 1) +
      deer(246, 360, 1.25, -1),
  }),
  // 吉野山（data/spots/nara.json wd-Q1036938，https://zh.wikipedia.org/wiki/%E5%90%89%E9%87%8E%E5%B1%B1）：春天，一層層的山被櫻花染成粉紅，左邊是金峯山寺藏王堂的檜皮大屋頂
  bg({
    id: 'bg-nara-yoshino',
    name: '吉野山',
    pref: 'nara',
    rarity: 2,
    art:
      sky(C.blue, 0.2) +
      cloud(70, 58, 1.1, 0.85) +
      cloud(226, 96, 0.8, 0.8) +
      ridge(
        [
          [-4, 168],
          [44, 146],
          [104, 160],
          [168, 132],
          [236, 152],
          [304, 140],
        ],
        C.navy,
        0.12,
      ) +
      band(-4, 178, 304, 168, C.white, 0.55, 48, 12) +
      ridge(
        [
          [-4, 206],
          [70, 184],
          [150, 198],
          [222, 176],
          [304, 192],
        ],
        C.green,
        0.24,
      ) +
      band(-4, 218, 304, 206, C.pink, 0.45, 49, 12) +
      ridge(
        [
          [-4, 246],
          [60, 226],
          [130, 238],
          [200, 218],
          [260, 230],
          [304, 222],
        ],
        C.green,
        0.36,
      ) +
      band(-4, 256, 304, 240, C.pink, 0.65, 50, 12) +
      specks(scatter(26, 0, 300, 214, 262, 51), 2, C.white, 0.7) +
      ridge(
        [
          [110, 324],
          [170, 272],
          [236, 244],
          [304, 230],
        ],
        C.green,
        0.62,
      ) +
      band(150, 302, 304, 250, C.pink, 1, 52, 12) +
      band(196, 316, 304, 284, C.white, 0.8, 53, 10) +
      band(232, 324, 304, 304, C.pink, 1, 54, 12) +
      specks(scatter(24, 170, 300, 262, 312, 55), 2.2, C.white, 0.85) +
      ridge(
        [
          [-4, 274],
          [50, 270],
          [120, 284],
          [190, 300],
        ],
        C.green,
        0.64,
      ) +
      band(-4, 282, 40, 290, C.pink, 1, 56, 9) +
      zaodo(68, 290) +
      band(-4, 298, 190, 314, C.pink, 1, 57, 12) +
      specks(scatter(14, 0, 150, 298, 314, 58), 2.2, C.white, 0.8) +
      canopy(-4, 304, 308, 326, C.pink, 0.95, 61, 13) +
      grove(
        [
          [268, 324, 1.7],
          [22, 326, 1.2],
        ],
        C.pink,
        C.white,
        62,
      ) +
      ground(C.matcha, 320, 0.35) +
      `<path d="M136 320 L164 320 L196 400 L104 400Z" fill="${C.cream}" opacity=".8" ${E}/>` +
      specks(scatter(12, 0, 300, 326, 398, 63), 2.6, C.pink, 0.9),
  }),
  // 猿沢池（data/spots/nara.json wd-Q11572131，https://ja.wikipedia.org/wiki/%E7%8C%BF%E6%B2%A2%E6%B1%A0）：夏夜的月，池對岸樹林上露出興福寺五重塔，塔與柳倒映在水面
  bg({
    id: 'bg-nara-sarusawa',
    name: '猿澤池',
    pref: 'nara',
    rarity: 1,
    art:
      sky(C.navy, 0.62, C.cream) +
      specks(scatter(16, 10, 290, 10, 170, 71), 1.8, C.white, 0.7) +
      `<circle cx="236" cy="128" r="26" fill="${C.cream}" opacity=".12"/>` +
      `<circle cx="236" cy="128" r="15" fill="${C.cream}" opacity=".95" ${E}/>` +
      canopy(-4, 304, 262, 284, C.navy, 0.5, 72, 16) +
      kofukujiPagoda(70, 270, 1.1, C.brown, C.ink) +
      canopy(-4, 304, 272, 286, C.navy, 0.62, 73, 12) +
      `<rect y="283" width="300" height="5" fill="${C.grey}" opacity=".5"/>` +
      `<rect y="288" width="300" height="34" fill="${C.navy}" opacity=".25"/>` +
      ripples(
        [
          [236, 296],
          [236, 304],
          [236, 312],
          [140, 306],
          [30, 316],
        ],
        16,
        0.5,
      ) +
      `<path d="M58 293 h24 M62 299 h16 M60 305 h20 M65 311 h10" ${line(2, C.yellow, 0.45)}/>` +
      `<path d="M46 296 h48 M52 308 h36" ${line(1.4, C.navy, 0.35)}/>` +
      willow(262, 322, 74) +
      ground(C.grey, 320, 0.45) +
      `<rect y="320" width="300" height="80" fill="${C.navy}" opacity=".32"/>` +
      `<path d="M0 321 H300" ${line(2.4, C.grey, 0.8)}/>` +
      `<path d="M0 342 L300 342 M0 366 L300 366 M0 392 L300 392 M60 342 L48 366 M150 342 L150 366 M240 342 L252 366 M100 366 L90 392 M200 366 L210 392" ${line(1.2, C.white, 0.18)}/>`,
  }),
]

// ---------- 和歌山 ----------
/** 三重塔（青岸渡寺）：朱色的塔身、白牆、深色的屋頂，頂上金色的相輪。x 中心、y 塔基上緣、s 大小 */
function sanju(x: number, y: number, s: number): string {
  let body = ''
  let wall = ''
  let roof = ''
  let shade = ''
  let bottom = y
  for (let i = 0; i < 3; i++) {
    const bw = (30 - i * 3.4) * s
    const rw = (70 - i * 7) * s
    const top = bottom - (i === 0 ? 30 : 22) * s
    body += rect(x - bw / 2, top, bw, bottom - top)
    wall += rect(x - 4 * s, top + 7 * s, 8 * s, bottom - top - 9 * s)
    shade += rect(x + bw / 2 - 5 * s, top, 5 * s, bottom - top) + rect(x - bw / 2, top + 4 * s, bw, 2 * s)
    roof += `M${r(x - rw / 2)} ${r(top + 1 * s)} C${r(x - rw / 4)} ${r(top - 2 * s)} ${r(x - rw / 6)} ${r(top - 9 * s)} ${r(x)} ${r(top - 9 * s)} C${r(x + rw / 6)} ${r(top - 9 * s)} ${r(x + rw / 4)} ${r(top - 2 * s)} ${r(x + rw / 2)} ${r(top + 1 * s)} L${r(x + rw / 2 - 3 * s)} ${r(top + 4.5 * s)} L${r(x - rw / 2 + 3 * s)} ${r(top + 4.5 * s)}Z`
    bottom = top - 9 * s
  }
  let rings = ''
  for (let i = 0; i < 9; i++) rings += `M${r(x - 4 * s)} ${r(bottom - (5 + i * 3.2) * s)} h${r(8 * s)}`
  return (
    paper([
      [rect(x - 26 * s, y, 52 * s, 6 * s), C.grey],
      [body, C.red],
    ]) +
    `<path d="${wall}" fill="${C.ink}" opacity=".3"/><path d="${shade}" ${SH}/>` +
    paper([[roof, C.ink]]) +
    `<path d="M${x} ${r(bottom + 2 * s)} V${r(bottom - 40 * s)}" ${line(2.4 * s, C.gold)}/><path d="${rings}" ${line(1.4 * s, C.gold)}/>`
  )
}
/** 根本大塔（多寶塔）：朱色的下層與上層圓筒、中間白色的龜腹、兩層方形大屋頂（積著雪），相輪與四條鍊。x 中心、y 地面 */
function daito(x: number, y: number): string {
  const roof = (y0: number, wb: number, wt: number, h: number) =>
    `M${x - wb / 2} ${y0 - 2} Q${x} ${y0 + 2} ${x + wb / 2} ${y0 - 2} Q${x + wb * 0.3} ${y0 - h * 0.3} ${x + wt / 2} ${y0 - h} L${x - wt / 2} ${y0 - h} Q${x - wb * 0.3} ${y0 - h * 0.3} ${x - wb / 2} ${y0 - 2}Z`
  // 屋頂上的雪：上緣同屋頂，下緣一串圓弧
  const snow = (y0: number, wb: number, wt: number, h: number) => {
    const yb = y0 - h * 0.32
    const xb = wt / 2 + (wb / 2 - wt / 2) * 0.62
    let d = `M${x - xb} ${r(yb)} Q${x - wb * 0.28} ${r(y0 - h * 0.6)} ${x - wt / 2} ${y0 - h - 1} L${x + wt / 2} ${y0 - h - 1} Q${x + wb * 0.28} ${r(y0 - h * 0.6)} ${x + xb} ${r(yb)}`
    for (let k = 1; k <= 6; k++) d += ` Q${r(x + xb - (xb * 2 * (k - 0.5)) / 6)} ${r(yb + 4)} ${r(x + xb - (xb * 2 * k) / 6)} ${r(yb)}`
    return d + 'Z'
  }
  let rings = ''
  for (let i = 0; i < 9; i++) rings += `M${x - 4} ${y - 106 - i * 3.6} h8`
  return (
    paper([
      [rect(x - 42, y - 6, 84, 6), C.grey],
      [rect(x - 32, y - 40, 64, 34), C.red],
      [rect(x - 17, y - 82, 34, 22), C.red],
    ]) +
    bars(x - 27, x + 32, y - 22, 26, 9, 5.8, C.white, 0.9) +
    `<path d="${rect(x + 18, y - 40, 14, 34)} ${rect(x + 9, y - 82, 8, 22)}" ${SH}/>` +
    paper([[`M${x - 25} ${y - 52} Q${x - 24} ${y - 64} ${x - 12} ${y - 66} L${x + 12} ${y - 66} Q${x + 24} ${y - 64} ${x + 25} ${y - 52}Z`, C.white]]) +
    `<path d="M${x + 6} ${y - 66} L${x + 12} ${y - 66} Q${x + 24} ${y - 64} ${x + 25} ${y - 52} L${x + 14} ${y - 52}Z" ${SH}/>` +
    paper([[`${roof(y - 38, 92, 58, 14)} ${roof(y - 80, 98, 20, 28)}`, C.ink]]) +
    paper([[`${snow(y - 38, 92, 58, 14)} ${snow(y - 80, 98, 20, 28)}`, C.white]]) +
    `<path d="M${x} ${y - 100} V${y - 150}" ${line(2.6, C.gold)}/><path d="${rings}" ${line(1.5, C.gold)}/>` +
    `<path d="M${x} ${y - 144} L${x - 47} ${y - 84} M${x} ${y - 144} L${x + 47} ${y - 84}" ${line(0.8, C.gold, 0.8)}/>` +
    specks(
      [
        [x - 47, y - 84],
        [x + 47, y - 84],
      ],
      3,
      C.gold,
    )
  )
}
/** 積雪的杉：三層三角，每層上面一抹白 */
const snowCedar = (x: number, y: number, s: number, op = 1) =>
  `<g opacity="${op}">` +
  shape(
    `M${x} ${r(y - 70 * s)} L${r(x + 11 * s)} ${r(y - 48 * s)} L${r(x + 7 * s)} ${r(y - 48 * s)} L${r(x + 16 * s)} ${r(y - 28 * s)} L${r(x + 11 * s)} ${r(y - 28 * s)} L${r(x + 20 * s)} ${r(y - 8 * s)} L${r(x - 20 * s)} ${r(y - 8 * s)} L${r(x - 11 * s)} ${r(y - 28 * s)} L${r(x - 16 * s)} ${r(y - 28 * s)} L${r(x - 7 * s)} ${r(y - 48 * s)} L${r(x - 11 * s)} ${r(y - 48 * s)}Z M${r(x - 2 * s)} ${r(y - 8 * s)} h${r(4 * s)} v${r(8 * s)} h${r(-4 * s)}Z`,
    C.green,
  ) +
  `<path d="M${x} ${r(y - 70 * s)} L${r(x + 11 * s)} ${r(y - 48 * s)} L${r(x + 7 * s)} ${r(y - 48 * s)} L${r(x + 16 * s)} ${r(y - 28 * s)} L${r(x + 11 * s)} ${r(y - 28 * s)} L${r(x + 20 * s)} ${r(y - 8 * s)} L${x} ${r(y - 8 * s)}Z" ${SH}/>` +
  `<path d="M${r(x - 5 * s)} ${r(y - 60 * s)} L${x} ${r(y - 68 * s)} L${r(x + 5 * s)} ${r(y - 60 * s)} M${r(x - 10 * s)} ${r(y - 42 * s)} L${x} ${r(y - 50 * s)} L${r(x + 10 * s)} ${r(y - 42 * s)} M${r(x - 15 * s)} ${r(y - 22 * s)} L${x} ${r(y - 30 * s)} L${r(x + 15 * s)} ${r(y - 22 * s)}" ${line(3.2 * s, C.white, 0.95)}/></g>`

/** 圓月島的輪廓（外形＋海蝕洞）與島頂的樹 */
const ISLE =
  'M186 302 Q190 286 194 270 Q196 252 206 246 Q220 238 236 240 Q254 238 266 246 Q276 256 278 280 L280 302Z M222 302 Q222 278 234 277 Q246 278 246 302Z'
const ISLE_TOP = blob([
  [204, 250, 8],
  [216, 242, 9],
  [231, 239, 9],
  [246, 239, 9],
  [260, 244, 8],
  [270, 252, 6],
])
/** 那智：岩壁兩側長滿樹的邊，與山稜線上的杉樹梢 */
function nachiEdges(): string {
  const cs: Array<[number, number, number]> = []
  for (let y = 84; y <= 290; y += 13) {
    cs.push([205 - (y > 200 ? 2 : 0) + ((y * 7) % 5), y, 8 + ((y * 3) % 4)])
    cs.push([262 + (y > 230 ? 4 : 0) - ((y * 5) % 4), y - 6, 8 + ((y * 5) % 4)])
  }
  const d = blob(cs)
  let tips = ''
  const sl = (x: number) => (x < 120 ? 206 - ((x + 4) / 124) * 66 : 140 - ((x - 120) / 94) * 76)
  for (let x = 2; x < 206; x += 8) tips += `M${x - 4} ${Math.round(sl(x) + 3)}l4 -${8 + ((x * 7) % 5)}l4 ${8 + ((x * 7) % 5)}Z`
  return `<g opacity=".8"><path d="${d}" fill="${C.green}" ${E}/><path d="${d}" fill="${C.green}"/></g><path d="${tips}" fill="${C.green}" opacity=".72"/>`
}

const WAKAYAMA: Outfit[] = [
  // 那智滝（data/spots/wakayama.json wd-Q1365882，https://zh.wikipedia.org/wiki/%E9%82%A3%E6%99%BA%E7%80%91%E5%B8%83）：夏天，青岸渡寺的朱色三重塔在前，後面深綠的原始林裡一道白色的大瀑布直落而下
  bg({
    id: 'bg-wakayama-nachi',
    name: '那智瀑布',
    pref: 'wakayama',
    rarity: 3,
    art:
      sky(C.blue, 0.22) +
      cloud(120, 40, 1.1, 0.85) +
      cloud(44, 92, 0.8, 0.8) +
      ridge(
        [
          [-4, 150],
          [60, 124],
          [130, 136],
          [190, 84],
          [250, 62],
          [304, 80],
        ],
        C.navy,
        0.14,
      ) +
      // 原始林的山，中間一道岩壁的缺口
      `<path d="M-4 324 L-4 206 Q60 176 120 140 Q176 104 214 64 L222 56 L246 52 L254 60 Q274 70 304 78 L304 324Z" fill="${C.green}" opacity=".72" ${E}/>` +
      `<path d="${scatter(90, 0, 300, 70, 290, 84)
        .filter(([x, y]) => y > 216 - (x + 4) * 0.64 && (x < 190 || x > 276))
        .map(([x, y]) => `M${x} ${y}l3 -8l3 8Z`)
        .join('')}" fill="${C.ink}" opacity=".13"/>` +
      shape(`M214 64 L222 56 L246 52 L254 60 L257 96 L255 130 L260 168 L258 210 L264 250 L266 292 L204 292 L206 246 L203 208 L208 170 L206 130 L211 96Z`, C.grey) +
      `<path d="M214 64 L222 56 L246 52 L254 60 L257 96 L255 130 L260 168 L258 210 L264 250 L266 292 L204 292 L206 246 L203 208 L208 170 L206 130 L211 96Z" fill="${C.brown}" opacity=".22"/>` +
      `<path d="M226 58 L240 56 L246 290 L220 290Z" fill="${C.white}" opacity=".95" ${E}/>` +
      `<path d="M230 64 L227 286 M234 62 L234 288 M238 64 L241 286" ${line(1.2, C.blue, 0.3)}/>` +
      nachiEdges() +
      cloud(233, 288, 1.4, 0.95) +
      canopy(-4, 304, 284, 324, C.green, 0.95, 83, 14) +
      sanju(60, 302, 1.2) +
      ground(C.grey, 320, 0.35) +
      `<path d="M0 338 H300 M0 360 H300 M0 386 H300 M150 320 L130 400 M150 320 L170 400" ${line(1.2, C.white, 0.4)}/>`,
  }),
  // 高野山（data/spots/wakayama.json wd-Q535065，https://zh.wikipedia.org/wiki/%E9%AB%98%E9%87%8E%E5%B1%B1）：冬天下雪，壇上伽藍的根本大塔（朱色的多寶塔）與積雪的高野杉
  bg({
    id: 'bg-wakayama-koyasan',
    name: '高野山',
    pref: 'wakayama',
    rarity: 2,
    art:
      sky(C.grey, 0.32) +
      snowCedar(30, 260, 1.6, 0.3) +
      snowCedar(150, 258, 1.4, 0.3) +
      snowCedar(196, 262, 1.8, 0.3) +
      snowCedar(286, 256, 1.5, 0.3) +
      canopy(-4, 304, 266, 324, C.navy, 0.22, 91, 14) +
      daito(226, 314) +
      snowCedar(30, 324, 2.6) +
      snowCedar(90, 318, 1.7) +
      snowCedar(298, 328, 2.2) +
      ground(C.white, 320) +
      `<path d="M0 322 Q75 316 150 322 T300 322 M140 322 L118 400 M160 322 L182 400" ${line(1.4, C.grey, 0.45)}/>` +
      `<path d="M0 350 Q60 344 120 350 M190 370 Q240 364 300 370" ${line(2, C.grey, 0.25)}/>` +
      specks(scatter(60, 0, 300, 6, 396, 92), 2.6, C.white, 0.9),
  }),
  // 円月島（data/spots/wakayama.json wd-Q5377606，https://zh.wikipedia.org/wiki/%E9%AB%98%E5%B3%B6_%28%E5%92%8C%E6%AD%8C%E5%B1%B1%E7%B8%A3%29）：白濱的夕陽，海上的圓月島中間有圓形的海蝕洞，太陽正落在洞裡，岸邊的岩與松
  bg({
    id: 'bg-wakayama-engetsu',
    name: '圓月島',
    pref: 'wakayama',
    rarity: 1,
    art:
      sky(C.orange, 0.34, C.cream) +
      `<path d="M-10 92 Q60 84 130 92 M150 60 Q220 52 310 60 M170 150 Q230 144 300 152 M-10 196 Q50 190 110 198" ${line(7, C.pink, 0.45)}/>` +
      `<path d="M20 120 Q80 114 140 120 M200 222 Q250 218 300 224" ${line(5, C.yellow, 0.5)}/>` +
      `<circle cx="234" cy="294" r="30" fill="${C.yellow}" opacity=".2"/>` +
      `<circle cx="234" cy="294" r="9" fill="${C.yellow}" opacity=".95" ${E}/>` +
      `<rect y="300" width="300" height="22" fill="${C.navy}" opacity=".3"/>` +
      `<path d="M221 305 h26 M225 310 h18 M217 315 h34 M227 320 h14" ${line(2, C.yellow, 0.75)}/>` +
      ripples(
        [
          [40, 306],
          [120, 312],
          [170, 305],
          [290, 310],
          [90, 318],
        ],
        14,
        0.35,
      ) +
      // 圓月島：陡的岩壁、長滿樹的島頂，下面圓形的海蝕洞（evenodd 挖空）
      `<path d="${ISLE}" fill="${C.brown}" fill-rule="evenodd" ${E}/><path d="${ISLE}" fill="${C.ink}" fill-rule="evenodd" opacity=".38"/>` +
      `<path d="M266 246 Q276 262 278 284 L280 302 L262 302 Q266 276 260 250Z" ${SH}/>` +
      `<path d="M200 270 L208 266 M212 284 L222 282 M258 272 L266 270 M262 288 L270 287" ${line(1.2, C.cream, 0.25)}/>` +
      `<g opacity=".85"><path d="${ISLE_TOP}" fill="${C.green}" ${E}/><path d="${ISLE_TOP}" fill="${C.green}"/></g><path d="${ISLE_TOP}" fill="${C.ink}" opacity=".3"/>` +
      `<path d="M52 150 q5 -4 9 0 q4 -4 9 0 M76 166 q4 -3 7 0 q3 -3 7 0" ${line(1.4, C.ink, 0.5)}/>` +
      // 岸邊的岩與松
      `<path d="M-4 324 L-4 282 Q10 270 26 276 Q40 266 56 278 Q70 284 78 300 Q86 310 96 324Z" fill="${C.brown}" ${E}/>` +
      `<path d="M-4 324 L-4 282 Q10 270 26 276 Q40 266 56 278 Q70 284 78 300 Q86 310 96 324Z" fill="${C.ink}" opacity=".3"/>` +
      pine(36, 280, 0.95) +
      ground(C.orange, 320, 0.22) +
      `<path d="M-2 322 Q38 318 78 322 T158 322 T238 322 T318 322" ${line(2.2, C.white, 0.7)}/>` +
      `<path d="M196 330 h60 M210 340 h34" ${line(2, C.yellow, 0.4)}/>` +
      specks(scatter(12, 0, 300, 340, 396, 93), 2.4, C.brown, 0.3),
  }),
]

export const BG: Outfit[] = [...HYOGO, ...NARA, ...WAKAYAMA]
