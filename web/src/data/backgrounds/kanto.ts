import type { Outfit } from '../outfits'
import { bg, C, cedar, cloud, E, ground, line, ridge, ripples, roofs, SH, shape, sky, sun, torii, tree } from './kit'

/**
 * 地區背景：關東（埼玉、千葉、東京、神奈川）。題材取自 data/spots 的景點（或 data/festivals 的祭典），出處是那筆資料的 source_url。
 */

type Pt = [number, number]
const r = (v: number) => Math.round(v * 10) / 10
/** 折線封起來的形狀（座標取 1 位小數） */
const poly = (pts: Pt[]) => 'M' + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L') + 'Z'
/** 一組共用紙邊的形狀：[d, fill] 排在同一個 <g> 裡（省去每個 path 重複 E） */
const paper = (parts: Array<[string, string]>, op = 1) =>
  `<g ${E}${op < 1 ? ` opacity="${op}"` : ''}>${parts.map(([d, f]) => `<path d="${d}" fill="${f}"/>`).join('')}</g>`
/** 一排圓點（提燈、燈火、窗）：用虛線畫，x0 到 x1、間隔 gap、直徑 w */
const dotRow = (x0: number, x1: number, y: number, gap: number, w: number, color: string, op = 1) =>
  `<path d="M${r(x0)} ${r(y)} L${r(x1 + 0.1)} ${r(y)}" fill="none" stroke="${color}" stroke-width="${r(w)}" stroke-linecap="round" stroke-dasharray="0 ${r(gap)}" stroke-opacity="${op}"/>`
/** 一排直條（格子、欄杆、窗櫺）：用不圓頭的虛線畫，條寬 bw、間隔 gap、高 h（y 是中線） */
const bars = (x0: number, x1: number, y: number, h: number, bw: number, gap: number, color: string, op = 1) =>
  `<path d="M${r(x0)} ${r(y)} L${r(x1)} ${r(y)}" fill="none" stroke="${color}" stroke-width="${r(h)}" stroke-dasharray="${r(bw)} ${r(gap)}" stroke-opacity="${op}"/>`
/** 星星：幾個小白點 */
const stars = (pts: Pt[], op = 0.75) => `<path d="${pts.map(([x, y]) => `M${x} ${y}h0`).join('')}" ${line(2.2, C.white, op)}/>`
/** 樹林的樹冠：一連串圓弧的輪廓，底部封到 base；round 時兩端圓圓地收下來（花叢、灌木） */
function canopy(x0: number, x1: number, y: number, base: number, fill: string, op = 1, seed = 1, round = false): string {
  const e = round ? 8 : 0
  let d = round ? `M${x0} ${base} Q${x0} ${y} ${x0 + e} ${y}` : `M${x0} ${base} L${x0} ${y}`
  let x = x0 + e
  let k = seed
  let yy = y
  while (x < x1 - e) {
    k = (k * 9301 + 49297) % 233280
    const w = 12 + (k % 11)
    yy = y + ((k >> 4) % 9) - 4
    const nx = Math.min(x1 - e, x + w)
    d += ` Q${r((x + nx) / 2)} ${r(yy - (nx - x) * 0.75)} ${r(nx)} ${r(yy)}`
    x = nx
  }
  d += round ? ` Q${x1} ${r(yy)} ${x1} ${base}Z` : ` L${x1} ${base}Z`
  return `<path d="${d}" fill="${fill}" opacity="${op}" ${E}/>`
}

// ---------- 埼玉 ----------
/** 花火：一圈虛線當放射的光（每一段是一條細的放射線）＋外圈的光點。k 條光 */
function firework(x: number, y: number, rad: number, color: string, k = 18): string {
  const ring = (rr: number, dash: number, w: number, cap: string, op: number) => {
    const c = 2 * Math.PI * rr
    return `<circle cx="${x}" cy="${y}" r="${r(rr)}" fill="none" stroke="${color}" stroke-width="${r(w)}" stroke-dasharray="${dash} ${r(c / k - dash)}" stroke-linecap="${cap}" opacity="${op}"/>`
  }
  return ring(rad * 0.65, 1.2, rad * 0.7, 'butt', 0.85) + ring(rad * 1.14, 0, 3, 'round', 0.9) + `<circle cx="${x}" cy="${y}" r="${r(rad * 0.12)}" fill="${color}" opacity=".7"/>`
}
/** 秩父夜祭的屋台（正面）：大輪子、朱色的雕刻、厚重的屋頂，屋簷下掛滿點亮的提燈。x 中心、y 地面、s 大小 */
function yatai(x: number, y: number, s: number): string {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const row = (dy: number, w: number, k: number) => dotRow(x - w * s, x + w * s, y + dy * s, (2 * w * s) / (k - 1), 8 * s, C.yellow)
  return (
    paper([
      [`M${p(-30, -26)} L${p(30, -26)} L${p(30, -8)} L${p(-30, -8)}Z`, C.ink],
      [`M${p(-41, -36)} L${p(41, -36)} L${p(41, -24)} L${p(-41, -24)}Z`, C.brown],
      [`M${p(-28, -84)} L${p(28, -84)} L${p(28, -36)} L${p(-28, -36)}Z`, C.red],
      [`M${p(-52, -80)} C${p(-32, -84)} ${p(-22, -116)} ${p(0, -117)} C${p(22, -116)} ${p(32, -84)} ${p(52, -80)} L${p(47, -74)} L${p(-47, -74)}Z`, C.ink],
      [`M${p(-5, -116)} L${p(0, -128)} L${p(5, -116)}Z`, C.gold],
      [`M${p(-25, -12)} m${r(-12 * s)} 0 a${r(12 * s)} ${r(12 * s)} 0 1 0 ${r(24 * s)} 0 a${r(12 * s)} ${r(12 * s)} 0 1 0 ${r(-24 * s)} 0Z M${p(25, -12)} m${r(-12 * s)} 0 a${r(12 * s)} ${r(12 * s)} 0 1 0 ${r(24 * s)} 0 a${r(12 * s)} ${r(12 * s)} 0 1 0 ${r(-24 * s)} 0Z`, C.brown],
    ]) +
    // 雕刻的金框、屋脊的金線、輪軸
    `<path d="M${p(-22, -78)} L${p(22, -78)} L${p(22, -42)} L${p(-22, -42)}Z M${p(-10, -78)} L${p(-10, -42)} M${p(10, -78)} L${p(10, -42)} M${p(-41, -30)} L${p(41, -30)}" ${line(1.2 * s, C.gold, 0.85)}/>` +
    `<path d="M${p(-44, -80)} C${p(-28, -84)} ${p(-20, -112)} ${p(0, -113)} C${p(20, -112)} ${p(28, -84)} ${p(44, -80)}" ${line(1.4 * s, C.gold, 0.8)}/>` +
    `<path d="M${p(14, -84)} L${p(28, -84)} L${p(28, -36)} L${p(14, -36)}Z" ${SH}/>` +
    `<path d="M${p(-25, -12)}h0M${p(25, -12)}h0" ${line(8 * s, C.gold)}/>` +
    // 提燈：屋簷下兩排、台座上一排，上緣一條掛繩
    row(-68, 44, 11) +
    row(-56, 36, 9) +
    row(-30, 38, 9) +
    `<path d="M${p(-46, -72)} L${p(46, -72)} M${p(-46, -66)} L${p(46, -66)}" ${line(1 * s, C.orange, 0.7)}/>`
  )
}
/** 武甲山：北面被採石削成一階一階的山 */
const bukosan = (op: number) =>
  `<path d="${poly([
    [130, 324],
    [156, 280],
    [178, 252],
    [186, 252],
    [194, 236],
    [202, 236],
    [210, 220],
    [218, 220],
    [226, 204],
    [234, 204],
    [244, 176],
    [262, 168],
    [280, 180],
    [298, 210],
    [310, 222],
    [310, 324],
  ])}" fill="${C.navy}" opacity="${op}" ${E}/>` + `<path d="M186 252 L182 262 M202 236 L198 246 M218 220 L214 230 M234 204 L230 214" ${line(1.2, C.white, 0.2)}/>`

/** 川越的藏造（正面）：一樓店面、二樓黑漆喰牆與厚窗、厚重的屋頂、兩端高起的鬼瓦。x 左緣、w 寬 */
function kura(x: number, w: number, y = 322): string {
  const R = x + w
  return (
    paper([
      // 一樓店面（暗的開口）、二樓黑牆
      [`M${x + 2} ${y} L${x + 2} ${y - 44} L${R - 2} ${y - 44} L${R - 2} ${y}Z`, C.brown],
      [`M${x + 6} ${y} L${x + 6} ${y - 36} L${R - 6} ${y - 36} L${R - 6} ${y}Z`, C.ink],
      [`M${x + 4} ${y - 44} L${x + 4} ${y - 88} L${R - 4} ${y - 88} L${R - 4} ${y - 44}Z`, C.ink],
      // 一樓的庇
      [`M${x - 4} ${y - 40} L${x + 2} ${y - 50} L${R - 2} ${y - 50} L${R + 4} ${y - 40}Z`, C.ink],
      // 大屋頂、箱棟、鬼瓦
      [`M${x - 6} ${y - 84} L${x + 8} ${y - 112} L${R - 8} ${y - 112} L${R + 6} ${y - 84}Z`, C.ink],
      [`M${x + 6} ${y - 110} L${x + 6} ${y - 120} L${R - 6} ${y - 120} L${R - 6} ${y - 110}Z`, C.ink],
      [`M${x + 2} ${y - 108} L${x + 3} ${y - 128} Q${x + 10} ${y - 130} ${x + 17} ${y - 124} L${x + 17} ${y - 108}Z`, C.ink],
      [`M${R - 2} ${y - 108} L${R - 3} ${y - 128} Q${R - 10} ${y - 130} ${R - 17} ${y - 124} L${R - 17} ${y - 108}Z`, C.ink],
      // 二樓的觀音開窗、暖簾
      [`M${x + 14} ${y - 58} L${x + 14} ${y - 76} L${x + 28} ${y - 76} L${x + 28} ${y - 58}Z M${R - 28} ${y - 58} L${R - 28} ${y - 76} L${R - 14} ${y - 76} L${R - 14} ${y - 58}Z`, C.grey],
      [`M${x + 8} ${y - 36} L${R - 8} ${y - 36} L${R - 8} ${y - 24} L${x + 8} ${y - 24}Z`, C.navy],
    ]) +
    // 屋瓦的橫紋、窗兩側的厚門、一樓的格子、暖簾的縫
    `<path d="M${x + 2} ${y - 92} L${R - 2} ${y - 92} M${x + 5} ${y - 100} L${R - 5} ${y - 100} M${x - 1} ${y - 45} L${R + 1} ${y - 45} M${(x + R) / 2} ${y - 36} L${(x + R) / 2} ${y - 24} M${x + 4} ${y - 88} L${x + 4} ${y - 44}" ${line(1, C.white, 0.22)}/>` +
    `<path d="M${x + 11} ${y - 58} L${x + 11} ${y - 76} M${x + 31} ${y - 58} L${x + 31} ${y - 76} M${R - 31} ${y - 58} L${R - 31} ${y - 76} M${R - 11} ${y - 58} L${R - 11} ${y - 76}" ${line(3, C.ink)}/>` +
    bars(x + 10, R - 8, y - 11, 22, 1.6, 4.4, C.brown, 0.9)
  )
}
/** 時の鐘：木造三層的鐘樓。x 中心、y 地面 */
function tokiNoKane(x: number, y = 322): string {
  return (
    paper([
      [poly([[x - 22, y], [x - 22, y - 8], [x + 22, y - 8], [x + 22, y]]), C.grey],
      // 下層的板牆與庇
      [poly([[x - 17, y - 8], [x - 17, y - 72], [x + 17, y - 72], [x + 17, y - 8]]), C.brown],
      [poly([[x - 27, y - 68], [x - 18, y - 80], [x + 18, y - 80], [x + 27, y - 68]]), C.ink],
      // 中段：細長的柱身
      [poly([[x - 11, y - 80], [x - 11, y - 146], [x + 11, y - 146], [x + 11, y - 80]]), C.brown],
      // 鐘的平台
      [poly([[x - 20, y - 144], [x + 20, y - 144], [x + 20, y - 150], [x - 20, y - 150]]), C.brown],
      // 鐘樓：兩根柱子、中間的鐘
      [poly([[x - 15, y - 150], [x - 15, y - 182], [x - 11, y - 182], [x - 11, y - 150]]) + poly([[x + 11, y - 150], [x + 11, y - 182], [x + 15, y - 182], [x + 15, y - 150]]), C.brown],
      [`M${x - 7} ${y - 156} L${x - 6} ${y - 172} C${x - 6} ${y - 178} ${x + 6} ${y - 178} ${x + 6} ${y - 172} L${x + 7} ${y - 156}Z`, C.brown],
      // 屋頂（寶形）與頂上的寶珠
      [`M${x - 29} ${y - 178} C${x - 18} ${y - 182} ${x - 8} ${y - 196} ${x} ${y - 206} C${x + 8} ${y - 196} ${x + 18} ${y - 182} ${x + 29} ${y - 178} L${x + 25} ${y - 174} L${x - 25} ${y - 174}Z`, C.ink],
      [`M${x - 3} ${y - 204} L${x - 3} ${y - 210} L${x + 3} ${y - 210} L${x + 3} ${y - 204}Z`, C.ink],
    ]) +
    `<circle cx="${x}" cy="${y - 214}" r="3" fill="${C.ink}"/>` +
    `<path d="M${x + 7} ${y - 8} L${x + 7} ${y - 72} L${x + 17} ${y - 72} L${x + 17} ${y - 8}Z M${x + 4} ${y - 80} L${x + 4} ${y - 146} L${x + 11} ${y - 146} L${x + 11} ${y - 80}Z" ${SH}/>` +
    `<path d="M${x - 9} ${y - 8} L${x - 9} ${y - 72} M${x - 1} ${y - 8} L${x - 1} ${y - 72} M${x - 6} ${y - 84} L${x + 6} ${y - 113} L${x - 6} ${y - 142} M${x + 6} ${y - 84} L${x - 6} ${y - 113} L${x + 6} ${y - 142}" ${line(1, C.ink, 0.35)}/>` +
    bars(x - 19, x + 19, y - 154, 8, 1.4, 3.4, C.brown) +
    `<path d="M${x - 4} ${y - 160} L${x - 4} ${y - 172}" ${line(1, C.white, 0.3)}/>` +
    `<path d="M${x - 6} ${y - 32} L${x - 6} ${y - 8} L${x + 6} ${y - 8} L${x + 6} ${y - 32}Z" fill="${C.ink}" opacity=".55"/>`
  )
}

/** 長瀞的ライン下り：細長的木船、坐著的乘客、船頭撐著竹篙。x 船頭、y 水面、s 大小 */
function rafting(x: number, y: number, s: number): string {
  const p = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  return (
    paper([
      [`M${p(-6, -12)} L${p(2, -6)} L${p(74, -6)} L${p(78, -9)} L${p(76, 0)} L${p(4, 0)}Z`, C.brown],
      // 船頭：法被、笠
      [`M${p(8, -6)} L${p(9, -30)} L${p(17, -30)} L${p(18, -6)}Z`, C.navy],
      [`M${p(4, -31)} L${p(13, -38)} L${p(22, -31)}Z`, C.yellow],
    ]) +
    `<circle cx="${r(x + 13 * s)}" cy="${r(y - 33 * s)}" r="${r(3.4 * s)}" fill="${C.cream}"/>` +
    `<path d="M${p(4, -52)} L${p(26, 10)}" ${line(1.6 * s, C.brown)}/>` +
    // 乘客：一排頭與救生衣
    dotRow(x + 22 * s, x + 62 * s, y - 12 * s, 8 * s, 6.4 * s, C.ink, 0.75) +
    dotRow(x + 22 * s, x + 62 * s, y - 7 * s, 8 * s, 8 * s, C.orange, 0.9) +
    `<path d="M${p(2, -6)} L${p(74, -6)}" ${line(1.2, C.white, 0.35)}/>`
  )
}
/** 長瀞對岸的秩父赤壁 */
const CLIFF = poly([
  [-4, 300],
  [-4, 244],
  [30, 238],
  [52, 246],
  [84, 236],
  [120, 244],
  [150, 234],
  [186, 242],
  [222, 232],
  [256, 240],
  [304, 234],
  [304, 300],
])

const SAITAMA: Outfit[] = [
  // 秩父夜祭（data/festivals/saitama.json saitama-Q11596116，https://zh.wikipedia.org/wiki/%E7%A7%A9%E7%88%B6%E5%A4%9C%E7%A5%AD）：冬夜裡掛滿提燈的屋台、武甲山上的花火
  bg({
    id: 'bg-saitama-chichibu-yomatsuri',
    name: '秩父夜祭',
    pref: 'saitama',
    rarity: 3,
    art:
      sky(C.navy, 0.74, C.cream) +
      stars([
        [40, 40],
        [118, 24],
        [196, 52],
        [262, 30],
        [30, 196],
        [150, 96],
        [282, 132],
        [92, 70],
        [196, 150],
      ]) +
      firework(70, 140, 34, C.yellow) +
      firework(70, 140, 18, C.pink, 12) +
      firework(232, 104, 40, C.pink, 22) +
      firework(232, 104, 20, C.yellow, 12) +
      firework(150, 40, 24, C.white, 14) +
      bukosan(0.62) +
      roofs(-4, 304, 324, C.navy, 0.75, 7) +
      `<path d="M18 312h0M52 306h0M124 314h0M170 310h0M206 314h0M288 310h0" ${line(3, C.yellow, 0.9)}/>` +
      yatai(234, 322, 0.78) +
      yatai(72, 324, 0.9) +
      ground(C.navy, 320, 0.48) +
      `<path d="M0 352 L300 352 M0 378 L300 378" ${line(1.2, C.white, 0.14)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".12" ${E}/>`,
  }),
  // 時の鐘（data/spots/saitama.json wd-Q17221309，https://zh.wikipedia.org/wiki/%E6%99%82%E4%B9%8B%E9%90%98_%28%E5%B7%9D%E8%B6%8A%E5%B8%82%29）：黃昏的川越，木造鐘樓與兩側的藏造老店
  bg({
    id: 'bg-saitama-kawagoe',
    name: '川越時之鐘',
    pref: 'saitama',
    rarity: 2,
    art:
      sky(C.orange, 0.2, C.cream) +
      sun(74, 150, 18, C.orange, 0.5) +
      cloud(206, 60, 1.1, 0.8, C.cream) +
      cloud(60, 92, 0.8, 0.7, C.cream) +
      roofs(-4, 304, 324, C.brown, 0.26, 5) +
      `<g opacity=".42">${kura(118, 64)}</g>` +
      tokiNoKane(236) +
      kura(264, 56) +
      kura(28, 74) +
      ground(C.grey, 320, 0.4) +
      `<path d="M0 338 L300 338 M0 360 L300 360 M0 386 L300 386" ${line(1.3, C.white, 0.4)}/>` +
      `<path d="M150 322 L110 400 M150 322 L190 400" ${line(1.2, C.white, 0.35)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".1" ${E}/>`,
  }),
  // 長瀞渓谷（data/spots/saitama.json wd-Q11653371，https://zh.wikipedia.org/wiki/%E9%95%BF%E7%80%9E%E6%BA%AA%E8%B0%B7）：秋天的岩疊、對岸的秩父赤壁與紅葉、順流而下的木船
  bg({
    id: 'bg-saitama-nagatoro',
    name: '長瀞溪谷',
    pref: 'saitama',
    rarity: 1,
    art:
      sky(C.blue, 0.2) +
      cloud(70, 70, 1.1) +
      cloud(230, 110, 0.8, 0.8) +
      ridge(
        [
          [-4, 186],
          [60, 164],
          [130, 178],
          [200, 152],
          [262, 170],
          [304, 160],
        ],
        C.green,
        0.3,
        300,
      ) +
      canopy(-4, 304, 214, 300, C.green, 0.5, 3) +
      canopy(-4, 304, 226, 300, C.orange, 0.72, 5) +
      canopy(96, 206, 230, 300, C.yellow, 0.6, 4) +
      canopy(-4, 92, 228, 300, C.red, 0.8, 2) +
      canopy(212, 304, 226, 300, C.red, 0.8, 9) +
      // 對岸的秩父赤壁：岩層的橫紋
      `<path d="${CLIFF}" fill="${C.cream}"/><path d="${CLIFF}" fill="${C.brown}" opacity=".5" ${E}/>` +
      `<path d="M-4 258 L60 254 L130 260 L210 252 L304 256 M-4 276 L80 270 L160 278 L240 268 L304 274 M30 244 L20 262 M70 258 L60 280 M232 240 L224 256 M270 262 L262 284" ${line(1.2, C.ink, 0.18)}/>` +
      canopy(10, 62, 266, 276, C.red, 0.8, 11) +
      canopy(232, 290, 262, 272, C.orange, 0.85, 12) +
      // 荒川
      `<rect y="292" width="300" height="34" fill="${C.cream}"/><rect y="292" width="300" height="34" fill="${C.green}" opacity=".45"/><rect y="292" width="300" height="34" fill="${C.blue}" opacity=".2"/>` +
      ripples(
        [
          [150, 300],
          [230, 306],
          [124, 314],
          [270, 316],
          [190, 296],
        ],
        16,
      ) +
      rafting(36, 316, 1.25) +
      // 岩疊
      `<rect y="322" width="300" height="78" fill="${C.cream}"/>` +
      `<path d="${poly([
        [-4, 324],
        [70, 320],
        [150, 323],
        [230, 319],
        [304, 322],
        [304, 400],
        [-4, 400],
      ])}" fill="${C.grey}" opacity=".9" ${E}/>` +
      `<path d="${poly([
        [-4, 346],
        [58, 340],
        [120, 344],
        [110, 352],
        [-4, 358],
      ])}" fill="${C.ink}" opacity=".12"/>` +
      `<path d="${poly([
        [186, 352],
        [250, 344],
        [304, 348],
        [304, 360],
        [196, 362],
      ])}" fill="${C.ink}" opacity=".12"/>` +
      `<path d="${poly([
        [-4, 384],
        [90, 378],
        [190, 382],
        [304, 376],
        [304, 386],
        [-4, 392],
      ])}" fill="${C.ink}" opacity=".1"/>` +
      `<path d="M-4 324 L70 320 L150 323 L230 319 L304 322 M-4 346 L58 340 L120 344 M186 352 L250 344 L304 348 M-4 384 L90 378 L190 382 L304 376" ${line(1.3, C.white, 0.55)}/>` +
      `<path d="M34 330 L44 338 M150 334 L164 342 M248 364 L262 372 M120 366 L106 374 M60 370 L72 376" ${line(1.2, C.ink, 0.22)}/>` +
      tree(262, 340, 1.25, C.red) +
      tree(44, 350, 0.9, C.orange),
  }),
]

// ---------- 千葉 ----------
/** 弧形的屋頂（兩端翹起）：x 中心、y 簷口、w 寬、h 高 */
const curvedRoof = (x: number, y: number, w: number, h: number) =>
  `M${r(x - w / 2)} ${r(y + 1)} C${r(x - w / 4)} ${r(y - 2)} ${r(x - w / 6)} ${r(y - h)} ${x} ${r(y - h)} C${r(x + w / 6)} ${r(y - h)} ${r(x + w / 4)} ${r(y - 2)} ${r(x + w / 2)} ${r(y + 1)} L${r(x + w / 2 - 3)} ${r(y + 4)} L${r(x - w / 2 + 3)} ${r(y + 4)}Z`
/** 成田山的三重塔：朱色的塔身、簷下彩色的垂木、金色的相輪。x 中心、y 地面、s 大小 */
function sanjunoto(x: number, y: number, s: number): string {
  const parts: Array<[string, string]> = [[poly([[x - 26 * s, y], [x - 24 * s, y - 8 * s], [x + 24 * s, y - 8 * s], [x + 26 * s, y]]), C.grey]]
  let deco = ''
  let bottom = y - 8 * s
  for (let i = 0; i < 3; i++) {
    const bw = (32 - i * 4) * s
    const rw = (78 - i * 8) * s
    const top = bottom - (i === 0 ? 34 : 24) * s
    parts.push([poly([[x - bw / 2, bottom], [x - bw / 2, top], [x + bw / 2, top], [x + bw / 2, bottom]]), C.red])
    parts.push([curvedRoof(x, top, rw, 12 * s), C.ink])
    deco += `<path d="M${r(x + bw / 2 - 7 * s)} ${r(bottom)} L${r(x + bw / 2 - 7 * s)} ${r(top)} L${r(x + bw / 2)} ${r(top)} L${r(x + bw / 2)} ${r(bottom)}Z" ${SH}/>`
    // 簷下的彩色垂木、斗栱
    deco += bars(x - rw / 2 + 8 * s, x + rw / 2 - 8 * s, top + 6 * s, 3.4 * s, 1.4 * s, 1.6 * s, C.green)
    deco += `<path d="M${r(x - bw / 2)} ${r(top + 9 * s)} L${r(x + bw / 2)} ${r(top + 9 * s)}" ${line(1.6 * s, C.yellow, 0.9)}/>`
    deco += `<path d="M${r(x - bw / 4)} ${r(bottom)} L${r(x - bw / 4)} ${r(top + 12 * s)} M${r(x + bw / 4)} ${r(bottom)} L${r(x + bw / 4)} ${r(top + 12 * s)}" ${line(1 * s, C.ink, 0.25)}/>`
    bottom = top - 12 * s
  }
  // 相輪：柱子＋九輪（直的虛線疊成一圈圈）＋寶珠
  deco += `<path d="M${x} ${r(bottom + 2 * s)} L${x} ${r(bottom - 44 * s)}" ${line(2.2 * s, C.gold)}/>`
  deco += `<path d="M${x} ${r(bottom - 6 * s)} L${x} ${r(bottom - 34 * s)}" fill="none" stroke="${C.gold}" stroke-width="${r(9 * s)}" stroke-dasharray="${r(1.4 * s)} ${r(1.7 * s)}"/>`
  deco += `<circle cx="${x}" cy="${r(bottom - 46 * s)}" r="${r(2.6 * s)}" fill="${C.gold}"/>`
  return paper(parts) + deco
}
/** 成田山的大本堂：石基、朱色的殿身、大屋頂與入母屋的山牆。x0–x1 寬、y 地面 */
function hondo(x0: number, x1: number, y: number): string {
  const cx = (x0 + x1) / 2
  return (
    paper([
      [poly([[x0 - 8, y], [x0 - 4, y - 14], [x1 + 4, y - 14], [x1 + 8, y]]), C.grey],
      [poly([[x0 + 6, y - 14], [x0 + 6, y - 60], [x1 - 6, y - 60], [x1 - 6, y - 14]]), C.red],
      [`M${x0 - 16} ${y - 54} C${x0 - 2} ${y - 57} ${x0 + 12} ${y - 68} ${x0 + 24} ${y - 80} L${x1 - 24} ${y - 80} C${x1 - 12} ${y - 68} ${x1 + 2} ${y - 57} ${x1 + 16} ${y - 54} L${x1 + 10} ${y - 49} L${x0 - 10} ${y - 49}Z`, C.ink],
      [poly([[x0 + 24, y - 80], [x0 + 32, y - 100], [x1 - 32, y - 100], [x1 - 24, y - 80]]), C.ink],
      [poly([[cx - 20, y - 80], [cx, y - 98], [cx + 20, y - 80]]), C.red],
      // 向拝：正面突出的小屋頂
      [`M${cx - 30} ${y - 40} C${cx - 18} ${y - 42} ${cx - 10} ${y - 54} ${cx} ${y - 54} C${cx + 10} ${y - 54} ${cx + 18} ${y - 42} ${cx + 30} ${y - 40} L${cx + 26} ${y - 36} L${cx - 26} ${y - 36}Z`, C.ink],
    ]) +
    // 格子戶、正面的石階、山牆的金飾、屋脊
    bars(x0 + 12, x1 - 12, y - 30, 26, 1.4, 3.2, C.ink, 0.3) +
    `<path d="M${x0 + 6} ${y - 48} L${x1 - 6} ${y - 48}" ${line(3, C.ink, 0.55)}/>` +
    `<path d="M${cx - 22} ${y - 36} L${cx - 22} ${y - 14} M${cx + 22} ${y - 36} L${cx + 22} ${y - 14}" ${line(3, C.red)}/>` +
    `<path d="M${cx - 18} ${y - 2} L${cx + 18} ${y - 2} M${cx - 16} ${y - 7} L${cx + 16} ${y - 7} M${cx - 14} ${y - 12} L${cx + 14} ${y - 12}" ${line(1.4, C.white, 0.6)}/>` +
    `<path d="M${cx - 16} ${y - 81} L${cx} ${y - 95} L${cx + 16} ${y - 81} M${cx} ${y - 90} L${cx} ${y - 83}" ${line(1.6, C.gold, 0.9)}/>` +
    `<path d="M${x0 + 32} ${y - 100} L${x1 - 32} ${y - 100}" ${line(3, C.ink)}/>` +
    `<path d="M${x0 + 28} ${y - 77} L${x1 - 28} ${y - 77} M${x0 + 4} ${y - 54} L${x1 - 4} ${y - 54} M${cx - 24} ${y - 41} L${cx + 24} ${y - 41}" ${line(1, C.white, 0.25)}/>`
  )
}
/** 犬吠埼燈塔：白色的圓塔、迴廊與欄杆、燈室、黑色的圓頂。x 中心、y 塔腳、h 塔高 */
function lighthouse(x: number, y: number, h: number): string {
  const t = y - h
  return (
    paper([
      [poly([[x - 13, y], [x - 8, t], [x + 8, t], [x + 13, y]]), C.white],
      [poly([[x - 14, t], [x + 14, t], [x + 14, t - 4], [x - 14, t - 4]]), C.ink],
      [poly([[x - 7, t - 4], [x - 7, t - 18], [x + 7, t - 18], [x + 7, t - 4]]), C.yellow],
      [`M${x - 9} ${t - 18} C${x - 9} ${t - 26} ${x + 9} ${t - 26} ${x + 9} ${t - 18}Z`, C.ink],
      // 塔腳的附屬屋
      [poly([[x - 34, y], [x - 34, y - 14], [x - 12, y - 14], [x - 12, y]]), C.white],
      [poly([[x - 36, y - 13], [x - 36, y - 17], [x - 11, y - 17], [x - 11, y - 13]]), C.grey],
    ]) +
    `<path d="M${x + 4} ${y} L${x + 3} ${t} L${x + 8} ${t} L${x + 13} ${y}Z" ${SH}/>` +
    bars(x - 13, x + 13, t - 7, 6, 1, 2.6, C.ink, 0.7) +
    `<path d="M${x - 2} ${t - 4} L${x - 2} ${t - 18} M${x + 3} ${t - 4} L${x + 3} ${t - 18}" ${line(1, C.ink, 0.5)}/>` +
    `<path d="M${x} ${t - 24} L${x} ${t - 32}" ${line(1.4, C.ink)}/>` +
    `<path d="M${x - 3} ${y} L${x - 3} ${y - 9} C${x - 3} ${y - 12} ${x + 3} ${y - 12} ${x + 3} ${y - 9} L${x + 3} ${y}Z" fill="${C.ink}" opacity=".5"/>` +
    `<path d="M${x - 2} ${r(t + h * 0.35)}h0M${x - 2} ${r(t + h * 0.65)}h0" ${line(3, C.ink, 0.45)}/>` +
    `<path d="M${x - 30} ${y - 8} L${x - 26} ${y - 8} M${x - 21} ${y - 8} L${x - 17} ${y - 8}" ${line(3, C.blue, 0.5)}/>`
  )
}
/** 浪花：岩腳的白色碎浪 */
const surf = (pts: Pt[]) => pts.map(([x, y]) => `<path d="M${x - 10} ${y} Q${x - 6} ${y - 7} ${x} ${y - 5} Q${x + 3} ${y - 9} ${x + 8} ${y - 4} Q${x + 11} ${y - 2} ${x + 12} ${y}" fill="${C.white}" opacity=".9" ${E}/>`).join('')

/** 佐原的商家（對岸）：二樓的燈、一樓的格子、瓦屋頂。x 左緣、w 寬、h 高、y 地面、kura 是白壁的土藏 */
function shoka(x: number, w: number, h: number, y: number, kura = false): string {
  const R = x + w
  return (
    paper([
      [poly([[x, y], [x, y - h], [R, y - h], [R, y]]), kura ? C.cream : C.brown],
      [poly([[x - 4, y - h + 2], [x + 4, y - h - 12], [R - 4, y - h - 12], [R + 4, y - h + 2]]), C.ink],
      [poly([[x - 3, y - h * 0.48], [x + 2, y - h * 0.48 - 7], [R - 2, y - h * 0.48 - 7], [R + 3, y - h * 0.48]]), C.ink],
      [poly([[x + 5, y - h * 0.62], [x + 5, y - h * 0.84], [R - 5, y - h * 0.84], [R - 5, y - h * 0.62]]), kura ? C.ink : C.yellow],
    ]) +
    (kura ? '' : bars(x + 4, R - 4, y - h * 0.22, h * 0.36, 1.2, 2.6, C.yellow, 0.75)) +
    `<path d="M${x + 4} ${y - h - 6} L${R - 4} ${y - h - 6}" ${line(1, C.white, 0.25)}/>`
  )
}
/** 柳：樹幹＋垂下來的細枝。x 樹腳、y 地面、s 大小、dir = -1 時往左彎 */
function willow(x: number, y: number, s: number, dir = 1): string {
  const top = y - 96 * s
  const d = ['', '']
  for (let i = 0; i < 14; i++) {
    const dx = (-32 + i * 5) * s
    const len = (48 + ((i * 37) % 26)) * s
    d[i % 2] += `M${r(x + dx * 0.4)} ${r(top + 4 * s)} Q${r(x + dx * 1.1 + 6 * dir * s)} ${r(top + 10 * s)} ${r(x + dx + 4 * dir * s)} ${r(top + len)}`
  }
  return (
    `<path d="M${r(x - 3 * s)} ${y} C${r(x - 2 * s)} ${r(y - 40 * s)} ${r(x + 6 * dir * s)} ${r(y - 60 * s)} ${r(x + 2 * dir * s)} ${r(top + 6 * s)} L${r(x + 6 * dir * s)} ${r(top + 6 * s)} C${r(x + 10 * dir * s)} ${r(y - 60 * s)} ${r(x + 4 * s)} ${r(y - 40 * s)} ${r(x + 4 * s)} ${y}Z" fill="${C.brown}" ${E}/>` +
    `<ellipse cx="${x}" cy="${r(top + 14 * s)}" rx="${r(34 * s)}" ry="${r(16 * s)}" fill="${C.matcha}" opacity=".8" ${E}/>` +
    `<path d="${d[0]}" ${line(2.2 * s, C.matcha)}/><path d="${d[1]}" ${line(2 * s, C.green, 0.85)}/>`
  )
}
/** 小野川的遊覽小船：平底船、船頭與乘客。x 船頭、y 水面 */
const sawaraBoat = (x: number, y: number) =>
  paper([
    [`M${x} ${y - 7} L${x + 4} ${y} L${x + 52} ${y} L${x + 58} ${y - 7}Z`, C.brown],
    [poly([[x + 44, y - 7], [x + 45, y - 26], [x + 51, y - 26], [x + 52, y - 7]]), C.navy],
    [`M${x + 41} ${y - 27} L${x + 48} ${y - 33} L${x + 55} ${y - 27}Z`, C.yellow],
  ]) +
  dotRow(x + 12, x + 34, y - 11, 7.3, 5.6, C.ink, 0.7) +
  `<path d="M${x + 40} ${y - 44} L${x + 58} ${y + 8}" ${line(1.4, C.brown)}/>` +
  `<path d="M${x + 2} ${y - 7} L${x + 56} ${y - 7}" ${line(1.2, C.white, 0.35)}/>`

const CHIBA: Outfit[] = [
  // 成田山新勝寺（data/spots/chiba.json wd-Q3083875，https://zh.wikipedia.org/wiki/%E6%88%90%E7%94%B0%E5%B1%B1%E6%96%B0%E5%8B%9D%E5%AF%BA）：秋天的大本堂與朱色的三重塔、境內的紅葉
  bg({
    id: 'bg-chiba-naritasan',
    name: '成田山新勝寺',
    pref: 'chiba',
    rarity: 3,
    art:
      sky(C.blue, 0.2) +
      cloud(150, 54, 1.2) +
      cloud(54, 124, 0.8, 0.8) +
      canopy(-4, 304, 266, 324, C.green, 0.4, 6) +
      canopy(-4, 304, 284, 324, C.orange, 0.45, 13) +
      hondo(28, 136, 322) +
      sanjunoto(234, 322, 1.05) +
      tree(178, 324, 1.1, C.yellow) +
      ground(C.grey, 320, 0.42) +
      `<path d="M0 340 L300 340 M0 364 L300 364 M0 390 L300 390" ${line(1.4, C.white, 0.45)}/>` +
      `<path d="M150 322 L120 400 M150 322 L180 400" ${line(1.2, C.white, 0.35)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".08" ${E}/>` +
      tree(46, 358, 1.3, C.red) +
      tree(278, 352, 1.1, C.orange) +
      `<path d="M70 344 l3 -2 l1 3z M96 372 l3 -2 l1 3z M212 366 l3 -2 l1 3z M240 384 l3 -2 l1 3z" fill="${C.red}" opacity=".8"/>`,
  }),
  // 犬吠埼（data/spots/chiba.json wd-Q2937063，https://zh.wikipedia.org/wiki/%E7%8A%AC%E5%90%A0%E5%9F%BC）：太平洋上的日出、岬角岩礁上的白色燈塔與浪花
  bg({
    id: 'bg-chiba-inubosaki',
    name: '犬吠埼',
    pref: 'chiba',
    rarity: 2,
    art:
      sky(C.orange, 0.22, C.cream) +
      `<rect width="300" height="130" fill="${C.pink}" opacity=".14"/><rect width="300" height="60" fill="${C.purple}" opacity=".08"/>` +
      `<path d="M10 206 L120 206 M40 222 L150 222 M180 190 L270 190 M-4 240 L60 240" ${line(4, C.white, 0.6)}/>` +
      `<path d="M30 214 L104 214 M200 198 L240 198" ${line(3, C.pink, 0.5)}/>` +
      sun(74, 266, 24, C.orange, 0.8) +
      // 太平洋
      `<rect y="266" width="300" height="58" fill="${C.cream}"/><rect y="266" width="300" height="58" fill="${C.blue}" opacity=".42"/>` +
      `<path d="M58 272 L90 272 M52 280 L96 280 M62 288 L86 288 M48 297 L100 297 M60 306 L88 306 M54 315 L94 315" ${line(2, C.yellow, 0.75)}/>` +
      ripples(
        [
          [160, 278],
          [130, 300],
          [200, 292],
          [20, 290],
          [150, 314],
        ],
        14,
      ) +
      // 岬角的岩礁
      paper([
        [poly([[164, 324], [176, 304], [196, 296], [214, 286], [262, 282], [304, 288], [304, 324]]), C.brown],
        [poly([[214, 288], [262, 284], [304, 290], [304, 298], [212, 296]]), C.matcha],
      ]) +
      `<path d="M180 304 L196 312 M226 300 L240 314 M270 298 L282 312" ${line(1.2, C.ink, 0.2)}/>` +
      lighthouse(246, 290, 158) +
      surf([
        [172, 318],
        [190, 312],
        [298, 316],
      ]) +
      ground(C.grey, 320, 0.5) +
      `<path d="M-4 322 L304 322" ${line(2, C.white, 0.6)}/>` +
      `<path d="M0 344 L300 344 M0 370 L300 370" ${line(1.3, C.white, 0.4)}/>` +
      `<path d="M226 120 l6 -3 l6 3 M248 104 l5 -2.6 l5 2.6" ${line(1.4, C.ink, 0.5)}/>`,
  }),
  // 佐原の町並み（data/spots/chiba.json wd-Q11383027，https://ja.wikipedia.org/wiki/%E4%BD%90%E5%8E%9F%E3%81%AE%E7%94%BA%E4%B8%A6%E3%81%BF）：傍晚的小野川，對岸點燈的商家與土藏、岸邊的柳樹、遊覽小船
  bg({
    id: 'bg-chiba-sawara',
    name: '佐原老街',
    pref: 'chiba',
    rarity: 1,
    art:
      sky(C.blue, 0.36, C.cream) +
      `<rect width="300" height="150" fill="${C.navy}" opacity=".09"/><rect width="300" height="70" fill="${C.navy}" opacity=".09"/><rect y="210" width="300" height="90" fill="${C.orange}" opacity=".18"/>` +
      sun(220, 66, 10, C.cream, 0.9) +
      stars([
        [60, 40],
        [140, 70],
        [30, 130],
        [270, 120],
      ]) +
      `<g opacity=".55">${shoka(96, 56, 80, 298) + shoka(152, 46, 70, 298, true)}</g>` +
      shoka(-8, 60, 92, 298) +
      shoka(52, 48, 76, 298, true) +
      shoka(198, 58, 86, 298) +
      shoka(256, 52, 96, 298, true) +
      // 對岸的石垣與下到水邊的石階
      `<rect y="296" width="300" height="8" fill="${C.grey}" ${E}/>` +
      bars(0, 300, 300, 8, 10, 2, C.white, 0.25) +
      dotRow(20, 300, 292, 40, 5, C.yellow, 0.9) +
      // 小野川
      `<rect y="304" width="300" height="20" fill="${C.cream}"/><rect y="304" width="300" height="20" fill="${C.navy}" opacity=".45"/>` +
      `<path d="M8 310 L30 310 M60 314 L74 314 M186 309 L210 309 M268 314 L290 314 M236 318 L248 318" ${line(2, C.yellow, 0.6)}/>` +
      sawaraBoat(196, 320) +
      ground(C.grey, 322, 0.45) +
      `<rect y="322" width="300" height="5" fill="${C.grey}" ${E}/>` +
      `<path d="M0 350 L300 350 M0 376 L300 376" ${line(1.2, C.white, 0.3)}/>` +
      willow(34, 340, 1.25, 1) +
      willow(270, 336, 1.1, -1),
  }),
]

// ---------- 東京 ----------
/** 五重塔：x 中心、y 台基上緣、s 大小 */
function pagoda(x: number, y: number, s = 1): string {
  let out = shape(`M${x - 24 * s} ${y + 4 * s} L${x + 24 * s} ${y + 4 * s} L${x + 22 * s} ${y - 2 * s} L${x - 22 * s} ${y - 2 * s}Z`, C.grey)
  let bottom = y - 2 * s
  for (let i = 0; i < 5; i++) {
    const bw = (26 - i * 2.6) * s
    const rw = (58 - i * 5) * s
    const top = bottom - (i === 0 ? 20 : 15) * s
    out += shape(`M${x - bw / 2} ${bottom} L${x - bw / 2} ${top} L${x + bw / 2} ${top} L${x + bw / 2} ${bottom}Z`, C.red)
    out += `<path d="M${x + bw / 2 - 5 * s} ${bottom} L${x + bw / 2 - 5 * s} ${top} L${x + bw / 2} ${top} L${x + bw / 2} ${bottom}Z" ${SH}/>`
    out += shape(
      `M${x - rw / 2} ${top + 1 * s} C${x - rw / 4} ${top - 2 * s} ${x - rw / 6} ${top - 8 * s} ${x} ${top - 8 * s} C${x + rw / 6} ${top - 8 * s} ${x + rw / 4} ${top - 2 * s} ${x + rw / 2} ${top + 1 * s} L${x + rw / 2 - 3 * s} ${top + 4 * s} L${x - rw / 2 + 3 * s} ${top + 4 * s}Z`,
      C.ink,
    )
    bottom = top - 8 * s
  }
  // 相輪：細長的柱子與九個輪
  out += `<path d="M${x} ${bottom + 2 * s} L${x} ${bottom - 34 * s}" ${line(2.2 * s, C.gold)}/>`
  for (let i = 0; i < 9; i++) out += `<path d="M${x - 4 * s} ${bottom - (4 + i * 3) * s} L${x + 4 * s} ${bottom - (4 + i * 3) * s}" ${line(1.4 * s, C.gold)}/>`
  return out
}
/** 雷門：左右兩根朱柱、屋頂、中間的大提燈 */
function kaminarimon(x: number, y: number): string {
  const lantern =
    `<path d="M${x} 236 L${x} 244" ${line(1.6)}/>` +
    shape(`M${x - 18} 246 C${x - 21} 262 ${x - 21} 280 ${x - 18} 296 L${x + 18} 296 C${x + 21} 280 ${x + 21} 262 ${x + 18} 246Z`, C.red) +
    `<path d="M${x + 8} 246 C${x + 13} 262 ${x + 13} 280 ${x + 8} 296 L${x + 18} 296 C${x + 21} 280 ${x + 21} 262 ${x + 18} 246Z" ${SH}/>` +
    shape(`M${x - 19} 242 L${x + 19} 242 L${x + 19} 248 L${x - 19} 248Z`, C.ink) +
    shape(`M${x - 19} 294 L${x + 19} 294 L${x + 19} 300 L${x - 19} 300Z`, C.ink) +
    `<path d="M${x - 20} 258 L${x + 20} 258 M${x - 20.6} 271 L${x + 20.6} 271 M${x - 20} 284 L${x + 20} 284" ${line(1, C.ink, 0.35)}/>`
  return (
    shape(`M${x - 38} ${y} L${x - 38} 232 L${x - 30} 232 L${x - 30} ${y}Z`, C.red) +
    shape(`M${x + 30} ${y} L${x + 30} 232 L${x + 38} 232 L${x + 38} ${y}Z`, C.red) +
    `<path d="M${x + 33} ${y} L${x + 33} 232 L${x + 38} 232 L${x + 38} ${y}Z" ${SH}/>` +
    shape(`M${x - 42} 230 L${x + 42} 230 L${x + 42} 238 L${x - 42} 238Z`, C.red) +
    shape(`M${x - 52} 226 C${x - 30} 222 ${x - 20} 206 ${x} 206 C${x + 20} 206 ${x + 30} 222 ${x + 52} 226 L${x + 48} 231 L${x - 48} 231Z`, C.ink) +
    lantern
  )
}
/** 晴空塔：遠景的淡剪影 */
const skytree = (x: number, op: number) =>
  `<g fill="${C.navy}" opacity="${op}">` +
  `<path d="M${x - 1} 30 L${x + 1} 30 L${x + 1.6} 64 L${x - 1.6} 64Z"/>` +
  `<path d="M${x - 3} 64 L${x + 3} 64 L${x + 13} 322 L${x - 13} 322Z"/>` +
  `<path d="M${x - 6} 84 L${x + 6} 84 L${x + 7} 92 L${x - 7} 92Z M${x - 9} 128 L${x + 9} 128 L${x + 10} 140 L${x - 10} 140Z"/></g>`

/** 東京鐵塔：腳張開的鐵塔、大展望台與頂上的展望台、天線，點燈的格子。x 中心、y 地面 */
function tokyoTower(x: number, y: number): string {
  // 塔身的半寬（大展望台以下往外彎）
  const hw = (yy: number) => (yy < 184 ? 5 + ((yy - 96) / 88) * 9 : 13 + ((yy - 184) / (y - 184)) ** 2 * 24)
  let lat = ''
  const ys = [100, 120, 140, 160, 196, 214, 234, 256]
  for (let i = 0; i < ys.length - 1; i++) {
    const [a, b] = [ys[i], ys[i + 1]]
    if (a === 160) continue
    lat += `M${r(x - hw(a))} ${a}L${r(x + hw(b))} ${b}M${r(x + hw(a))} ${a}L${r(x - hw(b))} ${b}M${r(x - hw(b))} ${b}L${r(x + hw(b))} ${b}`
  }
  return (
    paper([
      // 下半：兩隻腳與中間的拱
      [`M${x - 14} 184 Q${x - 18} 290 ${x - 44} ${y} L${x - 30} ${y} Q${x - 22} 272 ${x} 268 Q${x + 22} 272 ${x + 30} ${y} L${x + 44} ${y} Q${x + 18} 290 ${x + 14} 184Z`, C.orange],
      // 上半與兩層展望台
      [poly([[x - 14, 186], [x - 5, 96], [x + 5, 96], [x + 14, 186]]), C.orange],
      [poly([[x - 19, 186], [x - 19, 172], [x - 16, 166], [x + 16, 166], [x + 19, 172], [x + 19, 186]]), C.white],
      [poly([[x - 8, 100], [x - 8, 90], [x + 8, 90], [x + 8, 100]]), C.white],
      [poly([[x - 2.4, 90], [x - 1.4, 40], [x + 1.4, 40], [x + 2.4, 90]]), C.orange],
    ]) +
    `<path d="${lat}" ${line(1, C.yellow, 0.85)}/>` +
    `<path d="M${x - 17} 177 L${x + 17} 177 M${x - 6} 95 L${x + 6} 95" fill="none" stroke="${C.yellow}" stroke-width="4" stroke-dasharray="2 1.6"/>` +
    `<path d="M${x - 4} 186 L${x + 14} 186 Q${x + 18} 290 ${x + 44} ${y} L${x + 36} ${y} Q${x + 14} 260 ${x + 4} 186Z" ${SH}/>` +
    `<path d="M${x} 40 L${x} 28 M${x - 1} 60 L${x + 1} 60 M${x - 1.6} 76 L${x + 1.6} 76" ${line(1.4, C.white, 0.9)}/>`
  )
}
/** 高樓群的剪影＋亮著的窗：x0 到 x1、底 y */
function skyline(x0: number, x1: number, y: number, fill: string, op: number, seed: number, win: string, winOp: number, hMin = 28, hRange = 60): string {
  let d = ''
  let w = ''
  let x = x0
  let k = seed
  while (x < x1) {
    k = (k * 9301 + 49297) % 233280
    const bw = 16 + (k % 16)
    const h = hMin + ((k >> 3) % hRange)
    d += `M${x} ${y}V${y - h}H${x + bw}V${y}Z`
    // 窗：一欄一欄的直虛線
    for (let wx = x + 5; wx < x + bw - 3; wx += 6) w += `M${wx} ${y - h + 6}V${y - 4}`
    x += bw + 2
  }
  return `<path d="${d}" fill="${fill}" opacity="${op}" ${E}/><path d="${w}" fill="none" stroke="${win}" stroke-width="2" stroke-dasharray="2.4 4" stroke-opacity="${winOp}"/>`
}
/** 增上寺大殿的屋頂（夜裡的剪影，簷下點燈） */
const zojoji = (x0: number, x1: number, y: number) =>
  paper([
    [poly([[x0 + 10, y], [x0 + 10, y - 40], [x1 - 10, y - 40], [x1 - 10, y]]), C.red],
    [`M${x0 - 10} ${y - 36} C${x0 + 6} ${y - 40} ${x0 + 16} ${y - 58} ${x0 + 26} ${y - 72} L${x1 - 26} ${y - 72} C${x1 - 16} ${y - 58} ${x1 - 6} ${y - 40} ${x1 + 10} ${y - 36} L${x1 + 4} ${y - 31} L${x0 - 4} ${y - 31}Z`, C.navy],
    [poly([[x0 + 26, y - 72], [x0 + 36, y - 92], [x1 - 36, y - 92], [x1 - 26, y - 72]]), C.navy],
  ]) +
  bars(x0 + 16, x1 - 16, y - 14, 24, 2, 7, C.yellow, 0.75) +
  `<path d="M${x0 + 36} ${y - 92} L${x1 - 36} ${y - 92}" ${line(3, C.navy)}/>` +
  `<path d="M${x0 + 2} ${y - 36} L${x1 - 2} ${y - 36} M${x0 + 30} ${y - 70} L${x1 - 30} ${y - 70}" ${line(1, C.gold, 0.6)}/>` +
  dotRow(x0 + 4, x1 - 4, y - 28, (x1 - x0 - 8) / 6, 5, C.yellow, 0.95)

/** 濱離宮的老黑松：短而斜的樹幹、往兩側長長伸出去的枝、幾片扁平的松葉、撐著枝的支柱。x 樹腳、y 地面、s 大小 */
function pine(x: number, y: number, s: number): string {
  const P = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const PADS: Array<[number, number, number]> = [
    [-50, -34, 20],
    [-22, -50, 20],
    [32, -46, 22],
    [58, -32, 15],
    [-6, -70, 18],
    [20, -64, 15],
  ]
  const pads = PADS.map(
    ([dx, dy, w]) => `M${P(dx - w, dy)} C${P(dx - w, dy - 8)} ${P(dx - w * 0.4, dy - 12)} ${P(dx, dy - 11)} C${P(dx + w * 0.5, dy - 12)} ${P(dx + w, dy - 7)} ${P(dx + w, dy)}Z`,
  ).join('')
  return (
    `<path d="M${P(-44, -36)} L${P(-44, 0)} M${P(-60, -28)} L${P(-60, 0)} M${P(46, -40)} L${P(46, 0)} M${P(60, -30)} L${P(60, 0)}" ${line(1.6 * s, C.brown)}/>` +
    `<path d="M${P(-4, -44)} Q${P(-30, -46)} ${P(-60, -30)} M${P(2, -46)} Q${P(34, -48)} ${P(60, -32)} M${P(-2, -48)} L${P(-6, -70)} M${P(2, -48)} L${P(20, -64)}" ${line(3.4 * s, C.brown)}/>` +
    `<path d="M${P(-7, 0)} C${P(-5, -18)} ${P(-14, -32)} ${P(-6, -50)} L${P(4, -50)} C${P(-2, -34)} ${P(8, -18)} ${P(8, 0)}Z" fill="${C.brown}" ${E}/>` +
    `<path d="${pads}" transform="translate(0 ${r(3 * s)})" fill="${C.ink}" opacity=".16"/>` +
    `<path d="${pads}" fill="${C.green}" ${E}/>`
  )
}
/** 中島の御茶屋：池中小島上的茶屋（寄棟的屋頂、四周的緣側）。x 中心、y 水面 */
const ochaya = (x: number, y: number) =>
  paper([
    [`M${x - 34} ${y} C${x - 30} ${y - 8} ${x + 30} ${y - 8} ${x + 34} ${y}Z`, C.matcha],
    [poly([[x - 24, y - 4], [x - 24, y - 26], [x + 24, y - 26], [x + 24, y - 4]]), C.cream],
    [poly([[x - 34, y - 24], [x - 18, y - 46], [x + 18, y - 46], [x + 34, y - 24]]), C.brown],
  ]) +
  bars(x - 22, x + 22, y - 16, 16, 1.6, 6, C.brown, 0.8) +
  `<path d="M${x - 26} ${y - 6} L${x + 26} ${y - 6}" ${line(2, C.brown)}/>` +
  `<path d="M${x - 18} ${y - 46} L${x + 18} ${y - 46}" ${line(2.4, C.ink, 0.6)}/>` +
  `<path d="M${x - 26} ${y - 30} L${x + 26} ${y - 30}" ${line(1, C.white, 0.3)}/>`
/** 菜の花：一叢叢綠色的花株上點滿黃花。x0–x1、y 上緣、h 高 */
const nanohana = (x0: number, x1: number, y: number, h: number, seed: number, rows: number) =>
  canopy(x0, x1, y, y + h, C.matcha, 1, seed, true) +
  Array.from({ length: rows }, (_, i) => dotRow(x0 + 6 + (i % 2) * 4, x1 - 6, y - 4 + i * 10, 8 + (i % 3), 4.8, C.yellow, 1 - i * 0.08)).join('')

const TOKYO: Outfit[] = [
  // 浅草寺（data/spots/tokyo.json wd-Q615183，https://zh.wikipedia.org/wiki/%E6%B7%BA%E8%8D%89%E5%AF%BA）：雷門的大提燈、五重塔，遠方的晴空塔
  bg({
    id: 'bg-tokyo-sensoji',
    name: '淺草寺',
    pref: 'tokyo',
    rarity: 2,
    art:
      sky() +
      cloud(64, 76, 1.2) +
      cloud(226, 44, 0.9, 0.8) +
      skytree(190, 0.26) +
      roofs(-4, 304, 322, C.brown, 0.28, 3) +
      tree(118, 322, 1.6, C.green) +
      tree(160, 322, 1.3, C.matcha) +
      pagoda(236, 320, 1.15) +
      kaminarimon(64, 322) +
      ground(C.grey, 320, 0.42) +
      `<path d="M0 340 L300 340 M0 364 L300 364 M0 390 L300 390" ${line(1.4, C.white, 0.45)}/>` +
      `<path d="M150 320 L120 400 M150 320 L180 400" ${line(1.2, C.white, 0.35)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".08" ${E}/>`,
  }),
  // 東京タワー（data/spots/tokyo.json wd-Q183536，https://zh.wikipedia.org/wiki/%E4%B8%9C%E4%BA%AC%E9%93%81%E5%A1%94）：夜裡點燈的東京鐵塔、腳下增上寺大殿的屋頂、亮著窗的高樓
  bg({
    id: 'bg-tokyo-tokyo-tower',
    name: '東京鐵塔',
    pref: 'tokyo',
    rarity: 3,
    art:
      sky(C.navy, 0.72, C.cream) +
      stars([
        [36, 30],
        [120, 50],
        [176, 22],
        [270, 64],
        [24, 150],
        [282, 170],
        [150, 110],
      ]) +
      sun(64, 76, 12, C.cream, 0.9) +
      skyline(-4, 304, 322, C.navy, 0.5, 3, C.yellow, 0.5, 40, 80) +
      canopy(-4, 304, 300, 324, C.navy, 0.55, 8) +
      tokyoTower(226, 322) +
      zojoji(28, 124, 322) +
      ground(C.navy, 320, 0.45) +
      `<path d="M0 344 L300 344 M0 370 L300 370 M0 394 L300 394" ${line(1.2, C.white, 0.16)}/>` +
      `<rect y="320" width="300" height="3" fill="${C.ink}" opacity=".12" ${E}/>`,
  }),
  // 浜離宮恩賜庭園（data/spots/tokyo.json wd-Q1033333，https://zh.wikipedia.org/wiki/%E6%BB%A8%E7%A6%BB%E5%AE%AB%E6%81%A9%E8%B5%90%E5%BA%AD%E5%9B%AD）：春天的菜花田、潮入之池與中島的茶屋、長長的木橋、黑松，後面是汐留的高樓
  bg({
    id: 'bg-tokyo-hamarikyu',
    name: '濱離宮恩賜庭園',
    pref: 'tokyo',
    rarity: 1,
    art:
      sky(C.blue, 0.22) +
      cloud(60, 66, 1.1) +
      cloud(236, 40, 0.9, 0.8) +
      skyline(-4, 304, 296, C.blue, 0.2, 5, C.white, 0.3, 70, 90) +
      skyline(-4, 304, 296, C.grey, 0.32, 9, C.white, 0.3, 30, 50) +
      canopy(-4, 304, 280, 300, C.green, 0.6, 4) +
      // 潮入之池
      `<rect y="292" width="300" height="30" fill="${C.cream}"/><rect y="292" width="300" height="30" fill="${C.blue}" opacity=".34"/>` +
      ripples(
        [
          [150, 314],
          [210, 316],
          [40, 316],
          [270, 308],
        ],
        14,
      ) +
      ochaya(62, 304) +
      // 御伝い橋
      `<path d="M96 304 Q200 294 304 302" ${line(3.4, C.brown)}/><path d="M96 298 Q200 288 304 296" ${line(1.4, C.brown)}/>` +
      `<path d="M98 301 Q200 291 304 299" fill="none" stroke="${C.brown}" stroke-width="6" stroke-dasharray="1.4 10"/>` +
      ground(C.grey, 320, 0.3) +
      `<path d="M-4 322 L304 322" ${line(2, C.white, 0.6)}/>` +
      pine(250, 334, 1.1) +
      nanohana(-4, 88, 346, 54, 3, 4) +
      nanohana(192, 304, 372, 28, 7, 3),
  }),
]

// ---------- 神奈川 ----------
/** 鎌倉大佛：坐在石台上的青銅阿彌陀佛（螺髮、肉髻、長耳垂、腿上結定印的手）。x 中心、y 石台上緣、s 大小 */
function daibutsu(x: number, y: number, s: number): string {
  const P = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const ell = (dx: number, dy: number, rx: number, ry: number) =>
    `M${P(dx - rx, dy)} a${r(rx * s)} ${r(ry * s)} 0 1 0 ${r(2 * rx * s)} 0 a${r(rx * s)} ${r(ry * s)} 0 1 0 ${r(-2 * rx * s)} 0Z`
  const body =
    `M${P(-15, -96)} C${P(-34, -95)} ${P(-44, -88)} ${P(-46, -66)} L${P(-50, -26)} C${P(-60, -20)} ${P(-62, -5)} ${P(-58, 0)} L${P(58, 0)} C${P(62, -5)} ${P(60, -20)} ${P(50, -26)} L${P(46, -66)} C${P(44, -88)} ${P(34, -95)} ${P(15, -96)}Z` +
    ell(-21, -114, 5, 13) +
    ell(21, -114, 5, 13) +
    ell(0, -120, 21, 25) +
    ell(0, -144, 11, 7)
  return (
    // 石台
    paper([
      [poly([[x - 60 * s, y + 26 * s], [x - 57 * s, y], [x + 57 * s, y], [x + 60 * s, y + 26 * s]]), C.grey],
      [poly([[x - 62 * s, y + 2 * s], [x - 62 * s, y - 4 * s], [x + 62 * s, y - 4 * s], [x + 62 * s, y + 2 * s]]), C.grey],
    ]) +
    `<path d="M${P(-58, 12)} L${P(58, 12)}" ${line(1.2, C.white, 0.4)}/>` +
    // 青銅（銅綠）：米色底＋灰＋一層綠
    `<g transform="translate(0 ${r(-4 * s)})"><path d="${body}" fill="${C.cream}" ${E}/><path d="${body}" fill="${C.grey}" opacity=".7"/><path d="${body}" fill="${C.green}" opacity=".32"/>` +
    // 盤著的腿、定印的手
    `<path d="${ell(0, -12, 56, 12)}" fill="${C.ink}" opacity=".1"/>` +
    `<path d="M${P(-22, -26)} C${P(-22, -36)} ${P(-4, -38)} ${P(0, -30)} C${P(4, -38)} ${P(22, -36)} ${P(22, -26)} C${P(10, -20)} ${P(-10, -20)} ${P(-22, -26)}Z" fill="${C.white}" opacity=".18"/>` +
    `<path d="M${P(-22, -26)} C${P(-22, -36)} ${P(-4, -38)} ${P(0, -30)} C${P(4, -38)} ${P(22, -36)} ${P(22, -26)} M${P(-12, -29)} C${P(-10, -33)} ${P(-3, -33)} ${P(-1, -29)} M${P(12, -29)} C${P(10, -33)} ${P(3, -33)} ${P(1, -29)}" ${line(1.2, C.ink, 0.35)}/>` +
    // 衣紋
    `<path d="M${P(-15, -96)} C${P(-20, -80)} ${P(-30, -60)} ${P(-40, -40)} M${P(15, -96)} C${P(8, -78)} ${P(-4, -70)} ${P(-14, -58)} M${P(24, -88)} C${P(16, -72)} ${P(6, -60)} ${P(-4, -48)} M${P(-46, -60)} C${P(-40, -44)} ${P(-30, -36)} ${P(-24, -30)} M${P(46, -60)} C${P(40, -44)} ${P(30, -36)} ${P(24, -30)}" ${line(1.2, C.ink, 0.2)}/>` +
    // 右半邊的影子
    `<path d="M${P(15, -96)} C${P(34, -95)} ${P(44, -88)} ${P(46, -66)} L${P(50, -26)} C${P(60, -20)} ${P(62, -5)} ${P(58, 0)} L${P(30, 0)} C${P(40, -30)} ${P(36, -70)} ${P(15, -96)}Z" ${SH}/>` +
    // 螺髮、白毫、垂下的眼、鼻、口
    [0, 1, 2, 3].map((i) => dotRow(x - (15 - i * 1.5) * s, x + (15 - i * 1.5) * s, y + (-140 + i * 5) * s, 4.2 * s, 3 * s, C.ink, 0.22)).join('') +
    `<path d="M${P(0, -118)}h0" ${line(2.4 * s, C.ink, 0.45)}/>` +
    `<path d="M${P(-12, -112)} Q${P(-8, -110)} ${P(-4, -112)} M${P(4, -112)} Q${P(8, -110)} ${P(12, -112)} M${P(-13, -118)} Q${P(-8, -122)} ${P(-3, -119)} M${P(3, -119)} Q${P(8, -122)} ${P(13, -118)} M${P(0, -114)} L${P(-2, -104)} L${P(2, -104)} M${P(-5, -100)} Q${P(0, -98)} ${P(5, -100)}" ${line(1.2, C.ink, 0.5)}/>` +
    `<path d="M${P(-12, -96)} Q${P(0, -92)} ${P(12, -96)}" ${line(1.2, C.ink, 0.25)}/></g>`
  )
}
/** 櫻：一大團粉紅的樹冠（幾個圓疊起來）＋樹幹 */
function sakura(x: number, y: number, s: number): string {
  const P = (dx: number, dy: number) => `${r(x + dx * s)} ${r(y + dy * s)}`
  const blobs: Array<[number, number, number]> = [
    [-26, -58, 20],
    [0, -74, 26],
    [26, -60, 22],
    [-8, -50, 22],
    [14, -46, 18],
  ]
  const d = blobs.map(([dx, dy, rr]) => `M${P(dx - rr, dy)} a${r(rr * s)} ${r(rr * s)} 0 1 0 ${r(2 * rr * s)} 0 a${r(rr * s)} ${r(rr * s)} 0 1 0 ${r(-2 * rr * s)} 0Z`).join('')
  return (
    `<path d="M${P(-4, 0)} C${P(-3, -20)} ${P(-10, -34)} ${P(-18, -48)} L${P(-14, -50)} C${P(-6, -40)} ${P(0, -34)} ${P(2, -40)} L${P(14, -54)} L${P(17, -51)} C${P(8, -38)} ${P(5, -20)} ${P(5, 0)}Z" fill="${C.brown}" ${E}/>` +
    `<path d="${d}" fill="${C.pink}" ${E}/>` +
    `<path d="M${P(4, -44)} a${r(20 * s)} ${r(12 * s)} 0 0 0 ${r(36 * s)} -10 a${r(22 * s)} ${r(22 * s)} 0 0 1 ${r(-36 * s)} 10Z" ${SH}/>` +
    `<path d="M${P(-18, -66)}h0M${P(6, -84)}h0M${P(24, -66)}h0M${P(-6, -58)}h0M${P(30, -52)}h0M${P(-30, -50)}h0" ${line(3 * s, C.white, 0.7)}/>`
  )
}
/** 飄落的花瓣（或葉子）：小小的橢圓 */
const petals = (pts: Pt[], fill: string) => `<path d="${pts.map(([x, y]) => `M${x} ${y}q2 -3 4 0q-2 3 -4 0Z`).join('')}" fill="${fill}" opacity=".85"/>`

/** 橫濱地標大廈：越往上越窄、頂上切平的超高層，亮著的窗。x 中心、y 地面 */
const landmark = (x: number, y: number) =>
  paper([
    [poly([[x - 22, y], [x - 16, 92], [x - 12, 76], [x + 12, 76], [x + 16, 92], [x + 22, y]]), C.navy],
    [poly([[x - 10, 76], [x - 8, 66], [x + 8, 66], [x + 10, 76]]), C.navy],
  ]) +
  `<path d="M${x - 14} 102 L${x - 18} ${y} M${x - 7} 86 L${x - 9} ${y} M${x} 86 L${x} ${y} M${x + 7} 86 L${x + 9} ${y} M${x + 14} 102 L${x + 18} ${y}" fill="none" stroke="${C.yellow}" stroke-width="2.2" stroke-dasharray="2.4 4.4" stroke-opacity=".6"/>` +
  `<path d="M${x - 12} 76 L${x + 12} 76 M${x - 16} 92 L${x + 16} 92" ${line(1.4, C.white, 0.6)}/>` +
  `<path d="M${x + 8} 92 L${x + 16} 92 L${x + 22} ${y} L${x + 12} ${y}Z" ${SH}/>`
/** 洲際飯店：帆的形狀（半月形的白色高樓） */
const sailHotel = (x: number, y: number) =>
  paper([[`M${x - 26} ${y} L${x - 26} ${y - 8} C${x - 22} ${y - 60} ${x - 4} ${y - 92} ${x + 16} ${y - 104} C${x + 14} ${y - 70} ${x + 18} ${y - 30} ${x + 26} ${y - 8} L${x + 26} ${y}Z`, C.cream]]) +
  `<path d="M${x - 16} ${y - 10} C${x - 12} ${y - 50} ${x} ${y - 76} ${x + 12} ${y - 90} M${x - 6} ${y - 10} C${x - 2} ${y - 40} ${x + 6} ${y - 62} ${x + 14} ${y - 76}" fill="none" stroke="${C.yellow}" stroke-width="2" stroke-dasharray="2.4 4" stroke-opacity=".7"/>`
/** 皇后廣場的三棟階梯狀高樓 */
const queens = (x: number, y: number) =>
  `<path d="M${x} ${y}V${y - 120}l6 -8h18l6 8V${y}Z M${x + 34} ${y}V${y - 104}l6 -8h16l6 8V${y}Z M${x + 66} ${y}V${y - 88}l5 -7h14l5 7V${y}Z" fill="${C.navy}" opacity=".7" ${E}/>` +
  `<path d="M${x + 8} ${y - 116}V${y - 4} M${x + 22} ${y - 116}V${y - 4} M${x + 42} ${y - 100}V${y - 4} M${x + 54} ${y - 100}V${y - 4} M${x + 74} ${y - 84}V${y - 4} M${x + 86} ${y - 84}V${y - 4}" fill="none" stroke="${C.yellow}" stroke-width="2" stroke-dasharray="2.4 4.4" stroke-opacity=".5"/>`
/** 摩天輪 Cosmo Clock 21：點燈的輪圈、輻條、一圈車廂、支架。x,y 中心、rad 半徑 */
function cosmoClock(x: number, y: number, rad: number, base: number): string {
  let spokes = ''
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    spokes += `M${x} ${y}L${r(x + Math.cos(a) * rad)} ${r(y + Math.sin(a) * rad)}`
  }
  const c = 2 * Math.PI * (rad + 5)
  return (
    `<path d="M${x} ${y} L${x - 26} ${base} M${x} ${y} L${x + 26} ${base}" ${line(4, C.white, 0.85)}/>` +
    `<path d="${spokes}" ${line(1, C.pink, 0.7)}/>` +
    `<circle cx="${x}" cy="${y}" r="${rad}" fill="none" stroke="${C.pink}" stroke-width="3" opacity=".9"/>` +
    `<circle cx="${x}" cy="${y}" r="${r(rad * 0.62)}" fill="none" stroke="${C.blue}" stroke-width="2" opacity=".8"/>` +
    `<circle cx="${x}" cy="${y}" r="${r(rad + 5)}" fill="none" stroke="${C.yellow}" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 ${r(c / 30)}"/>` +
    `<circle cx="${x}" cy="${y}" r="${r(rad * 0.24)}" fill="${C.white}" ${E}/><circle cx="${x}" cy="${y}" r="${r(rad * 0.16)}" fill="${C.green}" opacity=".7"/>` +
    paper([[poly([[x - 40, base], [x - 40, base - 12], [x + 40, base - 12], [x + 40, base]]), C.navy]]) +
    dotRow(x - 34, x + 34, base - 6, 8.5, 3, C.yellow, 0.8)
  )
}

/** 富士山：山頂積雪（雪的下緣是鋸齒）。x 山頂、y 山頂、w 半寬、h 高 */
const fuji = (x: number, y: number, w: number, h: number, op = 1) =>
  `<g opacity="${op}">` +
  `<path d="M${x - w} ${y + h} C${x - w * 0.5} ${y + h * 0.7} ${x - w * 0.22} ${y + h * 0.28} ${x - w * 0.1} ${y} L${x + w * 0.1} ${y} C${x + w * 0.22} ${y + h * 0.28} ${x + w * 0.5} ${y + h * 0.7} ${x + w} ${y + h}Z" fill="${C.blue}" ${E}/>` +
  `<path d="M${x - w * 0.1} ${y} L${x + w * 0.1} ${y} C${x + w * 0.16} ${y + h * 0.14} ${x + w * 0.22} ${y + h * 0.26} ${r(x + w * 0.28)} ${r(y + h * 0.34)} L${r(x + w * 0.2)} ${r(y + h * 0.3)} L${r(x + w * 0.14)} ${r(y + h * 0.38)} L${r(x + w * 0.06)} ${r(y + h * 0.3)} L${x} ${r(y + h * 0.4)} L${r(x - w * 0.07)} ${r(y + h * 0.3)} L${r(x - w * 0.14)} ${r(y + h * 0.37)} L${r(x - w * 0.2)} ${r(y + h * 0.29)} L${r(x - w * 0.28)} ${r(y + h * 0.34)} C${x - w * 0.22} ${y + h * 0.26} ${x - w * 0.16} ${y + h * 0.14} ${x - w * 0.1} ${y}Z" fill="${C.white}" ${E}/>` +
  `<path d="M${x + w * 0.1} ${y} C${x + w * 0.22} ${y + h * 0.28} ${x + w * 0.5} ${y + h * 0.7} ${x + w} ${y + h} L${x + w * 0.4} ${y + h} C${x + w * 0.3} ${y + h * 0.6} ${x + w * 0.16} ${y + h * 0.3} ${x + w * 0.1} ${y}Z" ${SH}/></g>`
/** 箱根海賊船：船身、三根桅杆與帆。x 船頭、y 水面 */
const pirateShip = (x: number, y: number) =>
  paper([
    [`M${x} ${y - 12} L${x + 6} ${y} L${x + 52} ${y} L${x + 58} ${y - 14} L${x + 50} ${y - 10} L${x + 8} ${y - 10}Z`, C.red],
    [poly([[x + 44, y - 10], [x + 44, y - 18], [x + 56, y - 18], [x + 58, y - 14]]), C.brown],
    [`M${x + 14} ${y - 14} Q${x + 20} ${y - 22} ${x + 14} ${y - 32}Z M${x + 28} ${y - 14} Q${x + 36} ${y - 26} ${x + 28} ${y - 40}Z M${x + 42} ${y - 20} Q${x + 48} ${y - 26} ${x + 42} ${y - 34}Z`, C.cream],
  ]) +
  `<path d="M${x + 14} ${y - 10} L${x + 14} ${y - 36} M${x + 28} ${y - 10} L${x + 28} ${y - 44} M${x + 42} ${y - 18} L${x + 42} ${y - 38}" ${line(1.2, C.brown)}/>` +
  `<path d="M${x + 8} ${y - 6} L${x + 50} ${y - 6}" ${line(1.4, C.gold, 0.8)}/>`

const KANAGAWA: Outfit[] = [
  // 高徳院（data/spots/kanagawa.json wd-Q672056，https://zh.wikipedia.org/wiki/%E9%AB%98%E5%BE%B7%E9%99%A2）：春天的鎌倉大佛，石台上的青銅阿彌陀佛、身後的山、盛開的櫻
  bg({
    id: 'bg-kanagawa-kamakura-daibutsu',
    name: '鎌倉大佛',
    pref: 'kanagawa',
    rarity: 3,
    art:
      sky(C.blue, 0.2) +
      cloud(210, 70, 1.2) +
      cloud(60, 110, 0.8, 0.8) +
      ridge(
        [
          [-4, 236],
          [50, 214],
          [120, 228],
          [190, 206],
          [250, 222],
          [304, 210],
        ],
        C.green,
        0.38,
        300,
      ) +
      canopy(-4, 304, 266, 324, C.green, 0.55, 2) +
      sakura(22, 304, 0.95) +
      daibutsu(80, 300, 0.86) +
      ground(C.grey, 320, 0.38) +
      `<path d="M0 342 L300 342 M0 366 L300 366 M0 392 L300 392" ${line(1.4, C.white, 0.45)}/>` +
      `<path d="M150 322 L120 400 M150 322 L180 400" ${line(1.2, C.white, 0.35)}/>` +
      sakura(250, 336, 1.3) +
      petals(
        [
          [60, 140],
          [120, 226],
          [212, 196],
          [40, 350],
          [100, 380],
          [190, 372],
          [224, 352],
          [280, 386],
          [140, 340],
        ],
        C.pink,
      ),
  }),
  // 横浜みなとみらい21（data/spots/kanagawa.json wd-Q1140617，https://zh.wikipedia.org/wiki/%E6%A9%AB%E6%BF%B1%E6%B8%AF%E6%9C%AA%E4%BE%8621）：港邊的夜景，地標大廈、皇后廣場、帆形的洲際飯店、點燈的摩天輪與水面的倒影
  bg({
    id: 'bg-kanagawa-minatomirai',
    name: '橫濱港未來',
    pref: 'kanagawa',
    rarity: 2,
    art:
      sky(C.navy, 0.72, C.cream) +
      stars([
        [30, 30],
        [130, 40],
        [200, 20],
        [280, 50],
        [250, 120],
        [110, 90],
      ]) +
      skyline(-4, 304, 298, C.navy, 0.45, 4, C.yellow, 0.35, 20, 40) +
      queens(96, 298) +
      landmark(58, 298) +
      sailHotel(170, 298) +
      cosmoClock(224, 226, 45, 298) +
      // 港的水面與倒影
      `<rect y="296" width="300" height="28" fill="${C.cream}"/><rect y="296" width="300" height="28" fill="${C.navy}" opacity=".62"/>` +
      `<path d="M58 302 V320 M170 302 V320 M224 302 V320" fill="none" stroke="${C.yellow}" stroke-width="5" stroke-dasharray="6 4" stroke-opacity=".45"/>` +
      `<path d="M212 304 V318 M236 304 V318" fill="none" stroke="${C.pink}" stroke-width="3" stroke-dasharray="5 4" stroke-opacity=".5"/>` +
      ground(C.navy, 322, 0.42) +
      bars(0, 300, 316, 12, 1.6, 14, C.white, 0.5) +
      `<path d="M0 310 L300 310" ${line(1.6, C.white, 0.55)}/>` +
      `<rect y="322" width="300" height="3" fill="${C.ink}" opacity=".12" ${E}/>` +
      `<path d="M0 350 L300 350 M0 378 L300 378" ${line(1.2, C.white, 0.14)}/>`,
  }),
  // 芦ノ湖（data/spots/kanagawa.json wd-Q187053，https://zh.wikipedia.org/wiki/%E8%98%86%E4%B9%8B%E6%B9%96）：秋天的湖面，遠方積雪的富士山、立在湖水裡的鳥居、湖上的海賊船
  bg({
    id: 'bg-kanagawa-ashinoko',
    name: '蘆之湖',
    pref: 'kanagawa',
    rarity: 1,
    art:
      sky(C.blue, 0.24) +
      cloud(80, 60, 1.1) +
      cloud(260, 96, 0.7, 0.8) +
      fuji(222, 168, 104, 120, 0.85) +
      ridge(
        [
          [-4, 250],
          [60, 236],
          [120, 256],
          [170, 262],
          [230, 252],
          [304, 240],
        ],
        C.green,
        0.55,
        300,
      ) +
      canopy(110, 304, 268, 300, C.orange, 0.7, 6) +
      canopy(200, 304, 272, 300, C.red, 0.7, 3) +
      // 左岸的杉林
      `<path d="M-4 300 L-4 222 Q50 214 110 290 L110 300Z" fill="${C.green}" opacity=".85" ${E}/>` +
      ridge(
        [
          [-4, 214],
          [6, 202],
          [14, 214],
          [24, 200],
          [34, 216],
          [44, 210],
          [54, 226],
          [64, 222],
          [74, 240],
          [84, 248],
          [96, 270],
          [110, 290],
        ],
        C.green,
        0.9,
        300,
        false,
      ) +
      [
        [14, 262, 1.1],
        [40, 272, 1],
        [66, 284, 0.8],
      ]
        .map(([x, y, s]) => cedar(x, y, s, C.green))
        .join('') +
      // 湖
      `<rect y="292" width="300" height="32" fill="${C.cream}"/><rect y="292" width="300" height="32" fill="${C.blue}" opacity=".4"/>` +
      ripples(
        [
          [150, 300],
          [190, 312],
          [120, 316],
          [270, 318],
          [30, 318],
        ],
        14,
      ) +
      torii(66, 314, 1) +
      `<path d="M47 314 L56 314 M76 314 L85 314" ${line(2, C.white, 0.6)}/>` +
      pirateShip(222, 304) +
      ground(C.matcha, 322, 0.42) +
      `<path d="M-4 322 L304 322" ${line(2, C.white, 0.55)}/>` +
      tree(262, 350, 1.2, C.red) +
      tree(36, 360, 0.9, C.orange) +
      petals(
        [
          [210, 360],
          [120, 378],
          [70, 388],
          [240, 384],
        ],
        C.red,
      ),
  }),
]

export const BG: Outfit[] = [...SAITAMA, ...CHIBA, ...TOKYO, ...KANAGAWA]
