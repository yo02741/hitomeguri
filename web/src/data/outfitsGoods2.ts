import type { Outfit } from './outfits'
import { C, dots, E, line, SH, shape, vtext } from './dollArt'
import { bowl, castle, cup, hachimaki, ICON, plate } from './outfitsPref'
import { blossom } from './outfitsWa'
import { heartLeaf, HOOD, HOOD_SHADE, PIN, tint } from './outfitsGoods'

/**
 * 各縣的頭上與手上，第三批（使用者回饋 2026-10-12：每縣頭上、手上再各加一件）：47 縣各頭上 1 件、手上 1 件，共 94 件。
 * 規則同 outfitsGoods.ts：去過那個縣之後加進扭蛋（不是代表單品）。題材取自那個縣實際的祭典（data/festivals）、
 * 郷土料理（data/specialties）、經濟產業大臣指定的傳統工藝品、名物與景點，出處寫在每一件上面，和同縣已有的單品不重複。
 * 髮飾放在頭的右側（畫面左邊），左側留給斜戴的面具（DESIGN.md §7.24）。
 */

type Def = Omit<Outfit, 'slot'>
const head = (o: Def): Outfit => ({ ...o, slot: 'head' })
const hand = (o: Def): Outfit => ({ ...o, slot: 'hand' })

// ---------- 小零件 ----------
/** こぎん刺し的菱形 */
const kogin = (x: number, y: number) =>
  `<path d="M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y}Z M${x} ${y - 2.6} L${x + 2.6} ${y} L${x} ${y + 2.6} L${x - 2.6} ${y}Z" ${line(1.1, C.white)}/>`
/** 紅花：綠色的苞，上面一叢橘黃的細花瓣 */
const benibana = (x: number, y: number) =>
  `<path d="M${x} ${y} L${x} ${y - 11} M${x - 3} ${y} L${x - 6} ${y - 10} M${x + 3} ${y} L${x + 6} ${y - 10} M${x - 5} ${y} L${x - 10} ${y - 6} M${x + 5} ${y} L${x + 10} ${y - 6}" ${line(2.2, C.orange)}/>` +
  `<path d="M${x - 1.5} ${y} L${x - 2.6} ${y - 9} M${x + 1.5} ${y} L${x + 2.6} ${y - 9} M${x - 4} ${y} L${x - 8} ${y - 8} M${x + 4} ${y} L${x + 8} ${y - 8}" ${line(1.6, C.yellow)}/>` +
  `<path d="M${x - 8} ${y + 1} L${x - 12} ${y - 2} M${x + 8} ${y + 1} L${x + 12} ${y - 2} M${x - 5} ${y + 6} L${x - 10} ${y + 8} M${x + 5} ${y + 6} L${x + 10} ${y + 8}" ${line(1.4, C.green)}/>` +
  shape(`M${x - 7} ${y} C${x - 8} ${y + 8} ${x + 8} ${y + 8} ${x + 7} ${y}Z`, C.green) +
  `<path d="M${x - 5} ${y + 0.6} L${x + 5} ${y + 0.6}" ${line(1.6, C.red)}/>`
/** 蠶繭：中間細一點的花生形 */
const cocoon = (x: number, y: number, rot: number) =>
  `<g transform="rotate(${rot} ${x} ${y})">` +
  shape(`M${x - 9} ${y} C${x - 9} ${y - 6} ${x - 4} ${y - 6} ${x} ${y - 3.6} C${x + 4} ${y - 6} ${x + 9} ${y - 6} ${x + 9} ${y} C${x + 9} ${y + 6} ${x + 4} ${y + 6} ${x} ${y + 3.6} C${x - 4} ${y + 6} ${x - 9} ${y + 6} ${x - 9} ${y}Z`, C.white) +
  tint(`M${x - 9} ${y} C${x - 9} ${y + 6} ${x - 4} ${y + 6} ${x} ${y + 3.6} C${x + 4} ${y + 6} ${x + 9} ${y + 6} ${x + 9} ${y} C${x + 6} ${y + 3} ${x - 6} ${y + 3} ${x - 9} ${y}Z`, C.cream, 0.9) +
  `</g>`
/** 蓮花：一片片尖瓣，中間黃色的蓮蓬 */
function lotus(x: number, y: number): string {
  const petal = (a: number, s: number, fill: string) =>
    `<path d="M${x} ${y} C${x - 6 * s} ${y - 8 * s} ${x - 5 * s} ${y - 17 * s} ${x} ${y - 22 * s} C${x + 5 * s} ${y - 17 * s} ${x + 6 * s} ${y - 8 * s} ${x} ${y}Z" fill="${fill}" ${E} transform="rotate(${a} ${x} ${y})"/>`
  return (
    petal(-62, 0.8, C.pink) +
    petal(62, 0.8, C.pink) +
    petal(-32, 0.95, C.pink) +
    petal(32, 0.95, C.pink) +
    petal(0, 1, C.pink) +
    `<ellipse cx="${x}" cy="${y - 7}" rx="4" ry="2.4" fill="${C.yellow}" ${E}/>` +
    petal(-14, 0.62, C.pink) +
    petal(14, 0.62, C.pink) +
    `<path d="M${x - 2} ${y - 4} C${x - 3} ${y - 8} ${x - 2} ${y - 11} ${x - 1} ${y - 12}" ${line(1, C.white, 0.6)}/>`
  )
}
/** 鬱金香 */
const tulip = (x: number, y: number, fill: string) =>
  shape(`M${x - 6} ${y} C${x - 7.5} ${y - 7} ${x - 6} ${y - 11} ${x - 4} ${y - 13} L${x - 1.6} ${y - 8} L${x} ${y - 14} L${x + 1.6} ${y - 8} L${x + 4} ${y - 13} C${x + 6} ${y - 11} ${x + 7.5} ${y - 7} ${x + 6} ${y} C${x + 4} ${y + 4} ${x - 4} ${y + 4} ${x - 6} ${y}Z`, fill) +
  `<path d="M${x - 2.4} ${y - 9} C${x - 3.4} ${y - 5} ${x - 2.4} ${y - 1} ${x - 0.6} ${y + 2}" ${line(1, C.white, 0.4)}/>`
/** 一串葡萄：上寬下窄 */
function grapes(x: number, y: number, fill: string): string {
  const pts: Array<[number, number]> = []
  ;[4, 3, 2, 1].forEach((n, row) => {
    for (let i = 0; i < n; i++) pts.push([x + (i - (n - 1) / 2) * 6, y + row * 5.4])
  })
  return dots(fill, 3.4, pts, E) + dots(C.white, 0.9, pts.map(([px, py]): [number, number] => [px - 1.2, py - 1.2]), 'opacity=".5"')
}
/** 楓葉：七個尖，下面一根柄 */
function momiji(x: number, y: number, r: number, rot: number, fill: string): string {
  const tips: Array<[number, number]> = [
    [-168, 0.72],
    [-130, 0.9],
    [-90, 1],
    [-50, 0.9],
    [-12, 0.72],
    [30, 0.42],
    [150, 0.42],
  ]
  const at = (deg: number, k: number) => {
    const a = (deg * Math.PI) / 180
    return `${(x + Math.cos(a) * r * k).toFixed(1)} ${(y + Math.sin(a) * r * k).toFixed(1)}`
  }
  const d = tips
    .map(([a, k], i) => {
      const next = tips[(i + 1) % tips.length]![0]
      const b = next < a ? next + 360 : next
      return `${i ? 'L' : 'M'}${at(a, k)} L${at((a + b) / 2, b - a > 90 ? 0.18 : 0.36)}`
    })
    .join(' ')
  return (
    `<g transform="rotate(${rot} ${x} ${y})">` +
    `<path d="M${x} ${y} L${x} ${y + r * 0.9}" ${line(1.4, fill)}/>` +
    shape(`${d}Z`, fill) +
    `<path d="M${x} ${y + r * 0.1} L${at(-90, 0.8)} M${x} ${y + r * 0.1} L${at(-50, 0.7)} M${x} ${y + r * 0.1} L${at(-130, 0.7)}" ${line(0.7, C.ink, 0.25)}/>` +
    `</g>`
  )
}
/** 勾玉（三つ巴也用它） */
const magatama = (x: number, y: number, s: number, rot: number, fill: string, hole = true) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
  `<path d="M0 -6 C4.4 -6 6 -2.6 5 0.6 C3.8 4.6 -0.4 6.6 -4.6 6.8 C-2 5 -1.4 3 -2 2 C-4 1.2 -4.6 -1.6 -3.8 -3.4 C-3 -5 -1.6 -6 0 -6Z" fill="${fill}" ${E}/>` +
  (hole ? `<circle cx=".6" cy="-2" r="1.1" fill="${C.cream}"/>` : '') +
  `</g>`
/** 盤上的一片：rx、ry 的橢圓，轉一點角度 */
const tilt = (x: number, y: number, rot: number, body: string) => `<g transform="rotate(${rot} ${x} ${y})">${body}</g>`

// ---------- 頭上 ----------
const PAGODA = (() => {
  let s = shape('M72 84 L78 72 L162 72 L168 84Z', C.grey) + `<path d="M76 78 L164 78" ${line(1, C.ink, 0.25)}/>`
  for (let i = 0; i < 5; i++) {
    const wb = 72 - 13 * i
    const wh = 22 - 2.5 * i
    const h = 50 - 6 * i
    const y = wb - 7
    s +=
      shape(`M${120 - wh} ${wb} L${120 - wh} ${y} L${120 + wh} ${y} L${120 + wh} ${wb}Z`, C.white) +
      `<path d="M${120 - wh + 4} ${y} L${120 - wh + 4} ${wb} M${120 + wh - 4} ${y} L${120 + wh - 4} ${wb} M120 ${y} L120 ${wb}" ${line(1.2, C.brown, 0.7)}/>` +
      shape(`M${120 - h} ${y - 2} C${120 - h + 6} ${y} ${120 - h + 12} ${y} ${120 - h + 16} ${y} L${120 + h - 16} ${y} C${120 + h - 12} ${y} ${120 + h - 6} ${y} ${120 + h} ${y - 2} L${120 + wh + 2} ${y - 6} L${120 - wh - 2} ${y - 6}Z`, C.ink) +
      `<path d="M${120 - h + 6} ${y - 1} L${120 + h - 6} ${y - 1}" ${line(1, C.grey, 0.6)}/>`
  }
  return (
    s +
    `<path d="M120 7 L120 -6" ${line(2, C.gold)}/>` +
    `<path d="M116.5 3 L123.5 3 M116.5 0 L123.5 0 M116.5 -3 L123.5 -3" ${line(1.4, C.gold)}/>` +
    shape('M120 -5 C116.6 -8 117.4 -12 120 -14 C122.6 -12 123.4 -8 120 -5Z', C.gold)
  )
})()
const ENGETSU = 'M72 80 C72 62 82 46 98 38 C110 32 130 32 142 38 C158 46 168 62 168 80Z M109 64 A11 11 0 1 0 131 64 A11 11 0 1 0 109 64Z'
const CAMEL = 'M66 84 C62 60 74 46 88 44 C92 24 112 22 117 40 C123 22 146 24 152 44 C166 48 178 62 174 84 C150 76 90 76 66 84Z'
const CAMEL_HEAD = 'M80 62 C72 56 66 48 62 40 C60 34 54 30 48 32 C42 34 42 40 46 42 C50 44 54 44 57 48 C62 58 68 66 74 70Z'
const AJIRO = 'M46 80 C58 48 90 32 120 30 C150 32 182 48 194 80 C178 88 62 88 46 80Z'
const YUKI = 'M66 84 C62 62 84 52 120 52 C156 52 178 62 174 84 C150 76 90 76 66 84Z'
const YUKI_ENDS: Array<[number, number]> = [
  [70, 78],
  [78, 68],
  [88, 61],
  [100, 55],
  [112, 52.4],
  [128, 52.4],
  [140, 55],
  [152, 61],
  [162, 68],
  [170, 78],
]
const WATER = 'M64 84 C66 62 92 52 120 52 C148 52 174 62 176 84 C150 74 90 74 64 84Z'
const PORT = 'M104 76 C112 64 114 54 112 44 C110 34 106 26 102 18 L138 18 C134 26 130 34 128 44 C126 54 128 64 136 76Z'
const OKE = 'M78 84 L84 42 L156 42 L162 84Z'
const BACHI = 'M56 48 C64 44 74 41 82 40 L88 60 C82 64 74 68 66 70Z'
const TOWEL = 'M88 52 C88 42 96 38 104 38 L136 38 C144 38 152 42 152 52 C140 47 100 47 88 52Z'
const STEAM = 'M104 34 C98 28 110 22 104 14 C100 9 104 5 107 3 M120 32 C114 26 126 20 120 12 C116 7 120 2 123 0 M136 34 C130 28 142 22 136 14 C132 9 136 5 139 3'

const HEAD: Outfit[] = [
  head({
    // アイヌのマタンプシ（刺繡的頭帶；白老ウポポイ、平取二風谷）
    id: 'hokkaido-matanpushi',
    name: '愛奴刺繡頭帶',
    pref: 'hokkaido',
    rarity: 2,
    icon: '56 56 128 48',
    svg:
      shape('M64 84 C82 72 158 72 176 84 L176 94 C158 82 82 82 64 94Z', C.navy) +
      `<path d="M66 86.5 C84 75 156 75 174 86.5 M66 91.5 C84 80 156 80 174 91.5" ${line(1, C.red, 0.9)}/>` +
      `<path d="M120 84 C114 84 112 79 116 77.6 C119 76.8 121 79 119.6 80.4 M120 84 C126 84 128 79 124 77.6 C121 76.8 119 79 120.4 80.4 M104 85 C98 84 96 80 100 79 M136 85 C142 84 144 80 140 79 M88 86 C82 85.4 82 81.6 86 81 M152 86 C158 85.4 158 81.6 154 81" ${line(1.4, C.white)}/>`,
  }),
  head({
    // 津輕こぎん刺し：藍布上用白線刺出菱形
    id: 'aomori-kogin',
    name: '小巾刺頭巾',
    pref: 'aomori',
    rarity: 2,
    icon: '56 28 136 72',
    svg:
      shape('M170 80 L186 76 L188 84 L174 88Z', C.navy) +
      shape('M172 86 L184 96 L178 100 L170 90Z', C.navy) +
      shape(HOOD, C.navy) +
      `<path d="${HOOD_SHADE}" ${SH}/>` +
      [92, 106, 120, 134, 148].map((x) => kogin(x, 48)).join('') +
      [78, 92, 106, 120, 134, 148, 162].map((x) => kogin(x, 63)).join('') +
      dots(C.white, 1, [
        [85, 56],
        [99, 56],
        [113, 56],
        [127, 56],
        [141, 56],
        [155, 56],
      ]) +
      `<path d="M68 82 C90 74 150 74 172 82" ${line(1.4, C.white, 0.7)} stroke-dasharray="3 3"/>`,
  }),
  head({
    // チャグチャグ馬コ（盛岡、滝沢；data/festivals）：掛滿鈴鐺與彩色馬衣的馬
    id: 'iwate-chagu',
    name: '恰古恰古馬髮夾',
    pref: 'iwate',
    rarity: 2,
    icon: '36 10 84 80',
    svg:
      PIN +
      `<g transform="translate(80 80) scale(1.3) translate(-80 -80)">` +
      `<path d="M76 66 L74 80 M82 68 L82 82 M90 68 L92 82 M96 66 L98 80" ${line(2.4, C.brown)}/>` +
      `<path d="M98 58 C104 60 105 66 102 72" ${line(2, C.ink)}/>` +
      shape('M72 58 C72 52 98 52 99 58 C99 66 72 67 72 58Z', C.brown) +
      shape('M74 58 L64 42 C62 38 64 35 68 36 L80 54Z', C.brown) +
      shape('M68 36 C64 33 58 35 55 40 C53 44 55 47 58 46.4 C61 46 64 44 68 44Z', C.brown) +
      shape('M66 36 L65.4 30.6 L69 34.6Z', C.brown) +
      `<path d="M68 37 C72 44 76 50 79 54" ${line(2, C.ink, 0.7)}/>` +
      shape('M76 53 C82 49 94 50 98 55 L99 64 C90 70 80 70 74 66Z', C.red) +
      `<path d="M75 59 L99 59 M76 63 L99 63" ${line(1.4, C.yellow)}/>` +
      `<path d="M86 51 L86 68" ${line(1.4, C.blue)}/>` +
      dots(C.gold, 1.7, [
        [77, 69],
        [83, 70.5],
        [89, 70.5],
        [95, 69],
      ], E) +
      `<circle cx="64" cy="31" r="2.6" fill="${C.pink}" ${E}/>` +
      `<circle cx="60.4" cy="39.6" r="0.9" fill="${C.ink}"/>` +
      `</g>`,
  }),
  head({
    // SENDAI光のページェント：定禪寺通的櫸樹掛滿燈泡（冬天）
    id: 'miyagi-pageant',
    name: '光之樂章髮箍',
    pref: 'miyagi',
    rarity: 2,
    icon: '58 2 124 92',
    svg:
      `<path d="M92 46 L84 26 M86 32 L74 24 M88 38 L76 36 M120 40 L120 12 M120 26 L108 16 M120 20 L132 10 M148 46 L156 26 M154 32 L166 24 M152 38 L164 36" ${line(2.2, C.brown)}/>` +
      `<path d="M68 90 C64 58 88 40 120 40 C152 40 176 58 172 90" ${line(5, C.brown)}/>` +
      dots(C.yellow, 3.6, [
        [84, 26],
        [74, 24],
        [76, 36],
        [120, 12],
        [108, 16],
        [132, 10],
        [156, 26],
        [166, 24],
        [164, 36],
      ], 'opacity=".5"') +
      dots(C.yellow, 2, [
        [84, 26],
        [74, 24],
        [76, 36],
        [80, 30],
        [88, 34],
        [120, 12],
        [108, 16],
        [132, 10],
        [114, 21],
        [126, 15],
        [120, 30],
        [156, 26],
        [166, 24],
        [164, 36],
        [160, 30],
        [152, 34],
        [80, 56],
        [96, 44],
        [144, 44],
        [160, 56],
        [120, 40],
      ], E),
  }),
  head({
    // 角館樺細工（經濟產業大臣指定）：山櫻樹皮做的髮簪
    id: 'akita-kabazaiku',
    name: '樺細工髮簪',
    pref: 'akita',
    rarity: 2,
    icon: '50 36 64 54',
    svg:
      `<path d="M76 64 L108 80 M78 60 L110 74" ${line(2.4, C.brown)}/>` +
      `<ellipse cx="70" cy="58" rx="14" ry="11" fill="${C.brown}" ${E} transform="rotate(-18 70 58)"/>` +
      `<ellipse cx="70" cy="58" rx="14" ry="11" fill="${C.red}" opacity=".22" transform="rotate(-18 70 58)"/>` +
      `<ellipse cx="70" cy="58" rx="10" ry="7.4" fill="none" stroke="${C.yellow}" stroke-width="1" opacity=".55" transform="rotate(-18 70 58)"/>` +
      blossom(70, 58, 3.6, C.pink) +
      `<path d="M60 52 C63 48 68 47 72 47" ${line(1.6, C.white, 0.45)}/>`,
  }),
  head({
    // 紅花（山形縣花，最上紅花）
    id: 'yamagata-benibana',
    name: '紅花髮飾',
    pref: 'yamagata',
    rarity: 1,
    icon: '48 32 66 54',
    svg:
      PIN +
      `<path d="M72 66 L80 76 M90 58 L86 72" ${line(1.6, C.green)}/>` +
      shape('M80 74 C74 68 66 68 60 72 C66 76 74 77 80 74Z', C.green) +
      shape('M86 70 C92 62 100 60 106 62 C100 68 92 71 86 70Z', C.green) +
      benibana(72, 60) +
      benibana(90, 52),
  }),
  head({
    // 三春滝桜（日本三大櫻之一，樹齡千年以上的枝垂櫻）
    id: 'fukushima-takizakura',
    name: '三春瀧櫻髮飾',
    pref: 'fukushima',
    rarity: 2,
    icon: '48 32 64 76',
    svg:
      `<path d="M60 54 C70 44 88 40 104 44" ${line(2.8, C.brown)}/>` +
      `<path d="M64 50 C60 64 60 82 62 100 M74 45 C70 60 70 76 72 92 M86 42 C83 54 83 66 84 78 M98 43 C96 52 96 60 97 68" ${line(1, C.brown, 0.7)}/>` +
      dots(C.pink, 2.3, [
        [62, 58],
        [60.6, 74],
        [61, 90],
        [72, 52],
        [70.6, 68],
        [71.4, 84],
        [85, 48],
        [83.6, 64],
        [84, 78],
        [97, 48],
        [96.6, 64],
        [76, 46],
        [92, 42],
      ], E) +
      dots(C.white, 1.8, [
        [61, 66],
        [60.6, 82],
        [62, 98],
        [71, 60],
        [70.8, 76],
        [72, 91],
        [84, 56],
        [83.8, 72],
        [96.4, 56],
        [97, 68],
      ], E),
  }),
  head({
    // 筑波山的ガマの油（蟾蜍油的叫賣口上）
    id: 'ibaraki-gama',
    name: '筑波山蟾蜍帽',
    pref: 'ibaraki',
    rarity: 2,
    icon: '56 26 128 64',
    svg:
      shape(HOOD, C.matcha) +
      tint(HOOD, C.brown, 0.35) +
      `<path d="${HOOD_SHADE}" ${SH}/>` +
      dots(C.brown, 2.2, [
        [84, 62],
        [124, 50],
        [146, 58],
        [160, 66],
        [108, 62],
        [134, 66],
        [92, 72],
        [150, 74],
        [116, 70],
      ], 'opacity=".6"') +
      `<path d="M74 78 C96 70 144 70 166 78" ${line(1.8, C.ink, 0.55)}/>` +
      [100, 140]
        .map(
          (x) =>
            `<circle cx="${x}" cy="42" r="9" fill="${C.matcha}" ${E}/><circle cx="${x}" cy="42" r="9" fill="${C.brown}" opacity=".35"/>` +
            `<circle cx="${x}" cy="41" r="5.4" fill="${C.yellow}"/><ellipse cx="${x}" cy="41" rx="3.4" ry="1.3" fill="${C.ink}"/>` +
            `<circle cx="${x - 1.6}" cy="39.4" r="1" fill="${C.white}"/>`,
        )
        .join(''),
  }),
  head({
    // 日光東照宮陽明門（世界遺產）
    id: 'tochigi-yomeimon',
    name: '日光陽明門帽',
    pref: 'tochigi',
    rarity: 3,
    icon: '58 8 124 82',
    svg:
      shape('M80 84 L82 58 L158 58 L160 84Z', C.white) +
      `<path d="M146 58 L158 58 L160 84 L146 84Z" ${SH}/>` +
      `<path d="M92 60 L92 84 M148 60 L148 84" ${line(3, C.grey, 0.7)}/>` +
      dots(C.gold, 1, [
        [86, 64],
        [86, 72],
        [86, 80],
        [154, 64],
        [154, 72],
        [154, 80],
      ]) +
      shape('M108 84 L108 70 C108 64 132 64 132 70 L132 84Z', C.ink) +
      shape('M78 58 L162 58 L158 50 L82 50Z', C.gold) +
      dots(C.red, 1.3, [
        [90, 54],
        [102, 54],
        [114, 54],
        [126, 54],
        [138, 54],
        [150, 54],
      ]) +
      dots(C.green, 1.3, [
        [96, 54],
        [108, 54],
        [120, 54],
        [132, 54],
        [144, 54],
      ]) +
      shape('M64 52 C88 42 152 42 176 52 C170 42 158 34 146 30 L94 30 C82 34 70 42 64 52Z', C.ink) +
      tint('M64 52 C88 42 152 42 176 52 C170 42 158 34 146 30 L94 30 C82 34 70 42 64 52Z', C.green, 0.22) +
      `<path d="M64 52 C88 42 152 42 176 52" ${line(1.6, C.gold)}/>` +
      shape('M98 31 L104 20 L136 20 L142 31Z', C.ink) +
      `<path d="M104 20 L136 20" ${line(1.4, C.gold)}/>` +
      `<path d="M102 20 C100 16 102 13 105 14 M138 20 C140 16 138 13 135 14" ${line(2, C.gold)}/>` +
      dots(C.gold, 2.4, [
        [64, 52],
        [176, 52],
      ]),
  }),
  head({
    // 富岡製絲場（世界遺產）與上州的養蠶：桑葉上的蠶繭
    id: 'gunma-mayu',
    name: '蠶繭髮飾',
    pref: 'gunma',
    rarity: 1,
    icon: '50 32 64 56',
    svg:
      PIN +
      heartLeaf(82, 56, 13, -30) +
      cocoon(74, 70, -20) +
      cocoon(94, 64, 18) +
      `<path d="M102 62 C108 56 106 48 112 46" ${line(0.9, C.ink, 0.3)}/>`,
  }),
  head({
    // 行田的古代蓮（古代蓮の里）
    id: 'saitama-kodaihasu',
    name: '古代蓮髮飾',
    pref: 'saitama',
    rarity: 2,
    icon: '50 36 64 52',
    svg:
      PIN +
      `<ellipse cx="74" cy="74" rx="16" ry="6.4" fill="${C.green}" ${E} transform="rotate(-14 74 74)"/>` +
      `<path d="M62 76 L86 70 M74 74 L66 69 M74 74 L82 78" ${line(0.9, C.matcha)}/>` +
      lotus(84, 68),
  }),
  head({
    // 銚子的犬吠埼燈塔
    id: 'chiba-inubosaki',
    name: '犬吠埼燈塔帽',
    pref: 'chiba',
    rarity: 2,
    icon: '68 -12 104 98',
    svg:
      shape('M74 84 C78 70 162 70 166 84Z', C.grey) +
      `<path d="M84 78 C92 74 100 76 106 72 M134 72 C142 76 150 74 158 78" ${line(1, C.ink, 0.25)}/>` +
      shape('M104 74 L109 22 L131 22 L136 74Z', C.white) +
      `<path d="M124 22 L131 22 L136 74 L126 74Z" ${SH}/>` +
      `<rect x="117" y="34" width="6" height="8" fill="${C.ink}" opacity=".7"/><rect x="117" y="52" width="6" height="8" fill="${C.ink}" opacity=".7"/>` +
      shape('M100 22 L140 22 L140 17 L100 17Z', C.ink) +
      shape('M110 17 L110 6 L130 6 L130 17Z', C.yellow) +
      `<path d="M116 6 L116 17 M124 6 L124 17" ${line(1, C.ink, 0.4)}/>` +
      shape('M108 7 C108 -3 132 -3 132 7Z', C.ink) +
      `<path d="M120 -2 L120 -7" ${line(1.6, C.ink)}/>`,
  }),
  head({
    // 神田祭（data/festivals）的神輿：屋頂上一隻金色的鳳凰
    id: 'tokyo-mikoshi',
    name: '神田祭神輿帽',
    pref: 'tokyo',
    rarity: 3,
    icon: '56 2 128 88',
    svg:
      shape('M74 84 L80 74 L160 74 L166 84Z', C.ink) +
      `<path d="M74 84 L166 84 M80 74 L160 74" ${line(1.4, C.gold)}/>` +
      shape('M92 74 L92 54 L148 54 L148 74Z', C.red) +
      `<path d="M96 54 L96 74 M144 54 L144 74" ${line(2.4, C.gold)}/>` +
      shape('M110 74 L110 60 L130 60 L130 74Z', C.gold) +
      `<path d="M120 60 L120 74" ${line(1, C.brown, 0.5)}/>` +
      `<path d="M70 56 L70 72 M170 56 L170 72" ${line(1.4, C.purple)}/>` +
      dots(C.purple, 3, [
        [70, 74],
        [170, 74],
      ], E) +
      shape('M66 56 C90 48 150 48 174 56 C164 44 146 30 120 26 C94 30 76 44 66 56Z', C.ink) +
      `<path d="M66 56 C90 48 150 48 174 56 M120 27 L120 49 M96 34 L86 50 M144 34 L154 50" ${line(1.4, C.gold)}/>` +
      `<path d="M66 56 C62 54 61 50 64 48 M174 56 C178 54 179 50 176 48" ${line(2.4, C.gold)}/>` +
      shape('M118 22 C110 16 102 16 98 20 C104 20 110 24 114 28Z', C.gold) +
      shape('M122 22 C130 14 140 12 144 16 C138 18 132 22 126 28Z', C.gold) +
      shape('M116 28 C112 22 114 14 120 12 C124 10 128 12 128 16 C124 16 122 18 122 22Z', C.gold) +
      shape('M127 12.4 L132 11 L128.6 14.6Z', C.gold),
  }),
  head({
    // 鶴岡八幡宮的流鏑馬：射手戴的綾藺笠
    id: 'kanagawa-yabusame',
    name: '流鏑馬綾藺笠',
    pref: 'kanagawa',
    rarity: 2,
    icon: '44 34 152 56',
    svg:
      shape('M50 76 C66 62 174 62 190 76 C178 86 62 86 50 76Z', C.yellow) +
      tint('M50 76 C66 62 174 62 190 76 C178 86 62 86 50 76Z', C.brown, 0.35) +
      `<path d="M60 76 C80 70 160 70 180 76 M72 74 L64 80 M90 71 L86 82 M150 71 L154 82 M168 74 L176 80" ${line(1, C.brown, 0.45)}/>` +
      shape('M98 70 C96 52 104 40 120 40 C136 40 144 52 142 70 C130 72 110 72 98 70Z', C.yellow) +
      tint('M98 70 C96 52 104 40 120 40 C136 40 144 52 142 70 C130 72 110 72 98 70Z', C.brown, 0.45) +
      `<path d="M136 44 C142 52 144 62 142 70 C138 71 134 71 132 71 C134 62 136 52 136 44Z" ${SH}/>` +
      `<path d="M98 64 C112 68 128 68 142 64" ${line(3.4, C.ink)}/>` +
      `<path d="M108 46 C112 43 116 42 120 42" ${line(2, C.white, 0.4)}/>`,
  }),
  head({
    // 佐渡的朱鷺（トキ）：白色的羽毛、紅色的臉、彎彎的嘴
    id: 'niigata-toki',
    name: '朱鷺髮飾',
    pref: 'niigata',
    rarity: 2,
    icon: '46 30 68 58',
    svg:
      PIN +
      shape('M80 56 C82 42 96 34 108 38 C102 44 96 52 90 60Z', C.pink) +
      `<path d="M86 52 C92 46 98 42 104 40" ${line(1, C.red, 0.4)}/>` +
      `<ellipse cx="84" cy="62" rx="14" ry="7" fill="${C.white}" ${E} transform="rotate(-10 84 62)"/>` +
      tint('M78 59 C84 55 92 56 96 61 C90 64 84 64 78 59Z', C.pink, 0.8) +
      shape('M98 60 L106 58 L104 64Z', C.white) +
      shape('M70 52 C74 54 76 58 74 62 L68 60Z', C.white) +
      `<circle cx="67" cy="54" r="5" fill="${C.white}" ${E}/>` +
      `<circle cx="66" cy="55" r="3" fill="${C.red}"/>` +
      `<path d="M68 50 C70 44 76 42 80 44 M70 50 C74 46 80 46 84 48" ${line(1.6, C.cream)}/>` +
      `<path d="M63 56 C59 60 57 66 57 72" ${line(2.2, C.ink)}/>` +
      `<circle cx="57" cy="72" r="1.2" fill="${C.red}"/>` +
      `<circle cx="67" cy="53" r=".9" fill="${C.ink}"/>`,
  }),
  head({
    // 礪波的鬱金香（富山縣花，となみチューリップフェア）
    id: 'toyama-tulip',
    name: '鬱金香髮飾',
    pref: 'toyama',
    rarity: 1,
    icon: '50 32 64 54',
    svg:
      PIN +
      `<path d="M70 58 L80 78 M88 50 L86 76 M100 60 L92 78" ${line(1.8, C.green)}/>` +
      shape('M80 80 C72 74 66 66 66 58 C72 64 78 70 84 76Z', C.green) +
      shape('M88 78 C96 72 104 66 108 58 C108 68 100 76 92 80Z', C.green) +
      tulip(70, 58, C.red) +
      tulip(88, 50, C.yellow) +
      tulip(100, 60, C.pink),
  }),
  head({
    // 兼六園的雪吊り（りんご吊り）：松樹中間立一根柱子，繩子拉成傘狀
    id: 'ishikawa-yukitsuri',
    name: '兼六園雪吊帽',
    pref: 'ishikawa',
    rarity: 2,
    icon: '58 -12 124 100',
    svg:
      shape(YUKI, C.green) +
      `<path d="M74 70 C80 62 90 60 96 64 M104 58 C112 54 124 54 130 58 M144 62 C152 60 160 64 166 72" ${line(3, C.matcha, 0.9)}/>` +
      `<path d="M150 56 C164 62 176 72 174 84 C166 80 158 78 152 77Z" ${SH}/>` +
      `<path d="M120 52 L120 -2" ${line(3, C.brown)}/>` +
      `<path d="${YUKI_ENDS.map(([x, y]) => `M120 0 L${x} ${y}`).join(' ')}" ${line(1, C.yellow)}/>` +
      shape('M114 2 L120 -8 L126 2Z', C.yellow) +
      tint('M114 2 L120 -8 L126 2Z', C.brown, 0.3),
  }),
  head({
    // 永平寺雲水行腳戴的網代笠（竹皮編成）
    id: 'fukui-ajirogasa',
    name: '雲水網代笠',
    pref: 'fukui',
    rarity: 2,
    icon: '40 22 160 70',
    svg:
      shape(AJIRO, C.yellow) +
      tint(AJIRO, C.brown, 0.4) +
      `<path d="${AJIRO}" fill="url(#doll-waffle)" opacity=".55"/>` +
      `<path d="M160 40 C178 50 190 64 194 80 C186 84 176 86 166 86 C170 70 168 54 160 40Z" ${SH}/>` +
      `<path d="M46 80 C62 74 178 74 194 80" ${line(2.4, C.brown)}/>` +
      `<circle cx="120" cy="30" r="3" fill="${C.brown}" ${E}/>`,
  }),
  head({
    // 甲州的葡萄（勝沼）
    id: 'yamanashi-budou',
    name: '葡萄藤冠',
    pref: 'yamanashi',
    rarity: 2,
    icon: '54 22 132 68',
    svg:
      `<path d="M68 88 C62 58 88 42 120 42 C152 42 178 58 172 88" ${line(4, C.brown)}/>` +
      `<path d="M70 60 C66 56 66 52 70 50 M170 60 C174 56 174 52 170 50 M110 42 C108 36 112 32 116 34" ${line(1.2, C.green)}/>` +
      heartLeaf(90, 46, 9, -40) +
      heartLeaf(120, 36, 9, 0) +
      heartLeaf(150, 46, 9, 40) +
      grapes(74, 64, C.purple) +
      grapes(166, 64, C.purple),
  }),
  head({
    // 上田的真田氏：六文錢的家紋
    id: 'nagano-rokumonsen',
    name: '真田六文錢頭帶',
    pref: 'nagano',
    rarity: 2,
    icon: '56 60 140 50',
    svg: hachimaki(
      C.red,
      [96, 105.6, 115.2, 124.8, 134.4, 144]
        .map((x) => {
          const y = 80 + Math.abs(x - 120) * 0.04
          return `<circle cx="${x}" cy="${y}" r="3.6" fill="${C.ink}"/><rect x="${x - 1}" y="${y - 1}" width="2" height="2" fill="${C.red}"/>`
        })
        .join(''),
    ),
  }),
  head({
    // 高山祭（data/festivals）的屋台：金色的屋頂、水引幕與車輪
    id: 'gifu-yatai',
    name: '高山祭屋台帽',
    pref: 'gifu',
    rarity: 3,
    icon: '62 4 116 92',
    svg:
      shape('M84 76 L84 60 L156 60 L156 76Z', C.red) +
      `<path d="M84 60 L156 60 L156 66 C144 70 96 70 84 66Z" fill="${C.purple}" ${E}/>` +
      dots(C.gold, 1.2, [
        [92, 72],
        [104, 72],
        [116, 72],
        [128, 72],
        [140, 72],
        [152, 72],
      ]) +
      `<circle cx="88" cy="80" r="7" fill="${C.ink}" ${E}/><circle cx="152" cy="80" r="7" fill="${C.ink}" ${E}/>` +
      `<path d="M81 80 L95 80 M88 73 L88 87 M145 80 L159 80 M152 73 L152 87" ${line(1, C.gold)}/>` +
      shape('M92 60 L92 42 L148 42 L148 60Z', C.ink) +
      shape('M104 56 L104 46 L136 46 L136 56Z', C.gold) +
      `<path d="M96 46 L144 46 M96 56 L144 56 M112 46 L112 56 M120 46 L120 56 M128 46 L128 56" ${line(1.2, C.gold)}/>` +
      shape('M82 44 C98 38 142 38 158 44 L146 28 L94 28Z', C.ink) +
      `<path d="M82 44 C98 38 142 38 158 44" ${line(1.6, C.gold)}/>` +
      `<path d="M94 28 L146 28" ${line(2, C.gold)}/>` +
      `<path d="M100 28 C96 20 98 14 104 12 M140 28 C144 20 142 14 136 12" ${line(2.4, C.gold)}/>`,
  }),
  head({
    // 下田黑船祭（data/festivals）：培里來航的黑船
    id: 'shizuoka-kurofune',
    name: '下田黑船帽',
    pref: 'shizuoka',
    rarity: 3,
    icon: '58 0 136 92',
    svg:
      `<path d="M92 66 L92 10 M148 66 L148 10 M84 24 L100 24 M140 24 L156 24 M82 41 L102 41 M138 41 L158 41" ${line(2, C.brown)}/>` +
      shape('M92 10 L104 13 L92 16Z', C.red) +
      shape('M83 25 C87 28 97 28 101 25 L100 37 C96 39 88 39 84 37Z', C.white) +
      shape('M81 42 C86 45 98 45 103 42 L101 58 C96 60 88 60 83 58Z', C.white) +
      shape('M139 25 C143 28 153 28 157 25 L156 37 C152 39 144 39 140 37Z', C.white) +
      shape('M137 42 C142 45 154 45 159 42 L157 58 C152 60 144 60 139 58Z', C.white) +
      `<g fill="${C.grey}" opacity=".65" ${E}><circle cx="126" cy="27" r="5"/><circle cx="133" cy="19" r="6.4"/><circle cx="144" cy="12" r="7.4"/></g>` +
      shape('M114 64 L114 32 L126 32 L126 64Z', C.ink) +
      `<path d="M114 38 L126 38" ${line(2, C.white)}/>` +
      shape('M64 64 L176 64 L166 82 C142 86 98 86 74 82Z', C.ink) +
      `<path d="M68 70 L172 70" ${line(2.4, C.white)}/>` +
      dots(C.grey, 1.6, [
        [84, 76],
        [96, 77],
        [144, 77],
        [156, 76],
      ]) +
      shape('M100 72 C100 54 140 54 140 72Z', C.ink) +
      `<path d="M120 72 L106 66 M120 72 L110 59 M120 72 L120 56 M120 72 L130 59 M120 72 L134 66" ${line(1, C.grey)}/>` +
      `<path d="M176 64 L190 58" ${line(1.6, C.brown)}/>`,
  }),
  head({
    // 尾張七寶（經濟產業大臣指定）：七寶燒的髮簪
    id: 'aichi-shippo',
    name: '尾張七寶髮簪',
    pref: 'aichi',
    rarity: 2,
    icon: '52 40 64 52',
    svg:
      `<path d="M80 64 L110 80" ${line(2.4, C.gold)}/>` +
      `<path d="M64 68 L62 80 M70 70 L70 84 M76 69 L78 81" ${line(0.9, C.gold)}/>` +
      dots(C.gold, 1.6, [
        [62, 81],
        [70, 85],
        [78, 82],
      ]) +
      `<circle cx="72" cy="58" r="12" fill="${C.blue}" ${E}/>` +
      `<circle cx="72" cy="58" r="11" fill="none" stroke="${C.gold}" stroke-width="1.8"/>` +
      [0, 72, 144, 216, 288].map((a) => `<ellipse cx="72" cy="52.4" rx="2.8" ry="4.6" fill="${C.pink}" stroke="${C.gold}" stroke-width=".9" transform="rotate(${a} 72 58)"/>`).join('') +
      `<circle cx="72" cy="58" r="2" fill="${C.yellow}" stroke="${C.gold}" stroke-width=".8"/>` +
      dots(C.white, 0.9, [
        [64, 54],
        [80, 54],
        [72, 66.6],
      ]) +
      `<path d="M63 52 C65 48 69 46 73 46" ${line(1.4, C.white, 0.5)}/>`,
  }),
  head({
    // 伊勢志摩英虞灣的養殖珍珠：阿古屋貝與一串珍珠
    id: 'mie-shinju',
    name: '伊勢志摩珍珠髮飾',
    pref: 'mie',
    rarity: 2,
    icon: '50 40 66 50',
    svg:
      dots(C.white, 2.4, [
        [64, 82],
        [70, 80],
        [76, 77.5],
        [82, 74.5],
        [88, 71],
        [94, 67],
        [99, 62.5],
        [104, 57.5],
        [108, 52],
      ], E) +
      shape('M58 70 C56 56 68 46 80 48 C90 50 94 60 90 68Z', C.grey) +
      tint('M58 70 C56 56 68 46 80 48 C90 50 94 60 90 68Z', C.brown, 0.3) +
      shape('M62 68 C60 58 70 51 80 52 C87 54 89 61 86 66Z', C.white) +
      tint('M62 68 C60 58 70 51 80 52 C87 54 89 61 86 66Z', C.pink, 0.3) +
      `<circle cx="74" cy="62" r="4.4" fill="${C.white}" ${E}/>` +
      `<circle cx="72.8" cy="60.8" r="1.2" fill="${C.white}"/><circle cx="75" cy="63.4" r="2.4" fill="${C.pink}" opacity=".25"/>`,
  }),
  head({
    // 琵琶湖的鳰（カイツブリ，滋賀縣鳥）
    id: 'shiga-nio',
    name: '琵琶湖小鸊鷉帽',
    pref: 'shiga',
    rarity: 2,
    icon: '60 22 120 68',
    svg:
      shape(WATER, C.blue) +
      `<path d="M74 72 C80 68 86 68 92 72 C98 76 104 76 110 72 M128 70 C134 66 140 66 146 70 C152 74 158 74 164 70" ${line(1.4, C.white, 0.7)}/>` +
      `<path d="M150 56 C164 62 176 72 176 84 C168 80 160 78 152 77Z" ${SH}/>` +
      shape('M148 46 C154 42 156 38 152 34 C150 40 146 42 144 44Z', C.brown) +
      shape('M100 54 C98 42 110 34 126 34 C142 34 152 42 150 52 C148 58 140 60 126 60 C112 60 102 60 100 54Z', C.brown) +
      `<path d="M118 42 C126 40 136 42 142 48" ${line(1.2, C.ink, 0.3)}/>` +
      `<circle cx="104" cy="34" r="9" fill="${C.brown}" ${E}/>` +
      tint('M96 36 C96 42 102 46 110 44 C108 40 104 38 96 36Z', C.orange, 0.9) +
      shape('M95.4 32 L88 34 L95.4 36Z', C.ink) +
      `<circle cx="96" cy="34" r="1.6" fill="${C.yellow}"/>` +
      `<circle cx="101" cy="31" r="1.6" fill="${C.yellow}"/><circle cx="101" cy="31" r=".8" fill="${C.ink}"/>`,
  }),
  head({
    // 祇園祭（data/festivals）的長刀鉾：真木頂端的長刀
    id: 'kyoto-naginataboko',
    name: '祇園祭長刀鉾帽',
    pref: 'kyoto',
    rarity: 3,
    icon: '64 -20 112 108',
    svg:
      `<path d="M120 50 L120 -2" ${line(2.6, C.brown)}/>` +
      `<ellipse cx="120" cy="20" rx="7" ry="4" fill="${C.green}" ${E}/>` +
      `<path d="M120 22 L104 48 M120 22 L136 48" ${line(1, C.red, 0.8)}/>` +
      shape('M117 -2 C115 -7 116 -12 121 -16 C120 -11 123 -7 123 -2Z', C.white) +
      `<path d="M117 -2 L123 -2" ${line(2, C.gold)}/>` +
      shape('M88 84 L88 60 L152 60 L152 84Z', C.red) +
      `<path d="M88 60 L152 60 L152 84 L88 84Z" fill="url(#doll-yuzen)" opacity=".45"/>` +
      `<path d="M88 64 L152 64 M88 84 L152 84" ${line(2, C.gold)}/>` +
      shape('M104 84 L104 70 L136 70 L136 84Z', C.blue) +
      `<path d="M104 70 L136 70 L136 84 L104 84Z" fill="url(#doll-kikko)" opacity=".5"/>` +
      shape('M78 62 C96 56 144 56 162 62 L150 48 L90 48Z', C.ink) +
      `<path d="M78 62 C96 56 144 56 162 62" ${line(1.6, C.gold)}/>`,
  }),
  head({
    // 今宮戎神社的十日戎：掛著小判、鯛魚、米俵的福笹
    id: 'osaka-fukusasa',
    name: '今宮戎福笹髮飾',
    pref: 'osaka',
    rarity: 2,
    icon: '50 18 68 76',
    svg:
      `<path d="M104 80 C92 66 80 52 66 34" ${line(2.4, C.green)}/>` +
      `<path d="M94 71.6 L98 68.6 M83 56.6 L87 54 M73 44.2 L77 41.4" ${line(1.6, C.matcha)}/>` +
      shape('M80 50 C72 48 64 50 58 54 C64 56 72 56 80 50Z', C.green) +
      shape('M72 40 C70 32 64 26 58 24 C60 30 64 36 72 40Z', C.green) +
      shape('M90 62 C98 56 104 54 110 54 C104 60 98 62 90 62Z', C.green) +
      shape('M68 36 C74 30 80 28 86 28 C80 34 74 36 68 36Z', C.green) +
      `<path d="M70 52 L70 58 M86 60 L86 66 M98 74 L98 80" ${line(0.9, C.red)}/>` +
      `<ellipse cx="70" cy="63" rx="4" ry="5.6" fill="${C.gold}" ${E}/>` +
      `<path d="M70 59 L70 67" ${line(0.8, C.brown, 0.5)}/>` +
      shape('M79 70 C81 66 87 66 91 70 L94.6 67 L94.6 73 L91 70 C87 74 81 74 79 70Z', C.red) +
      `<circle cx="82.4" cy="69.4" r=".8" fill="${C.ink}"/>` +
      shape('M93 82 C93 79 103 79 103 82 L103 86 C103 89 93 89 93 86Z', C.yellow) +
      tint('M93 82 C93 79 103 79 103 82 L103 86 C103 89 93 89 93 86Z', C.brown, 0.3) +
      `<path d="M95 80.6 L95 87.6 M101 80.6 L101 87.6" ${line(1, C.red)}/>`,
  }),
  head({
    // 神戶港塔：紅色的雙曲面塔
    id: 'hyogo-porttower',
    name: '神戶港塔帽',
    pref: 'hyogo',
    rarity: 2,
    icon: '68 -12 104 100',
    svg:
      shape('M78 84 C84 72 156 72 162 84Z', C.blue) +
      `<path d="M86 80 C92 76 98 76 104 80 M136 80 C142 76 148 76 154 80" ${line(1.2, C.white, 0.7)}/>` +
      shape(PORT, C.red) +
      `<path d="M106 72 L134 22 M134 72 L106 22 M110 60 L130 30 M130 60 L110 30 M108 66 L132 66 M112 52 L128 52 M112 38 L128 38 M106 26 L134 26" ${line(1, C.white, 0.55)}/>` +
      `<path d="M124 18 L138 18 C134 26 130 34 128 44 C126 54 128 64 136 76 L128 76 C124 62 122 52 124 40Z" ${SH}/>` +
      shape('M98 18 L142 18 L142 12 L98 12Z', C.white) +
      `<path d="M98 15 L142 15" ${line(1, C.blue, 0.4)}/>` +
      shape('M104 12 L108 4 L132 4 L136 12Z', C.white) +
      `<path d="M120 4 L120 -6" ${line(1.6, C.red)}/>`,
  }),
  head({
    // 興福寺五重塔（世界遺產）
    id: 'nara-gojunoto',
    name: '五重塔帽',
    pref: 'nara',
    rarity: 3,
    icon: '62 -18 116 104',
    svg: PAGODA,
  }),
  head({
    // 白濱的圓月島：夕陽從島上的圓洞看過去
    id: 'wakayama-engetsu',
    name: '圓月島帽',
    pref: 'wakayama',
    rarity: 2,
    icon: '56 22 128 70',
    svg:
      `<circle cx="120" cy="64" r="12" fill="${C.orange}"/>` +
      `<path d="M111 68 L129 68" ${line(1.2, C.yellow, 0.8)}/>` +
      shape(ENGETSU, C.brown, 'fill-rule="evenodd"') +
      `<path d="${ENGETSU}" fill="${C.grey}" opacity=".35" fill-rule="evenodd"/>` +
      `<path d="M80 70 C90 66 100 66 106 68 M134 68 C142 66 152 66 160 70 M88 52 C96 48 106 48 112 50" ${line(1, C.ink, 0.25)}/>` +
      shape('M96 40 C100 30 112 28 116 34 C120 26 132 26 136 34 C142 32 148 36 146 42 C130 36 110 36 96 40Z', C.green) +
      shape('M64 86 C70 78 170 78 176 86 C150 82 90 82 64 86Z', C.blue) +
      `<path d="M78 83 C86 80 94 80 102 83 M138 83 C146 80 154 80 162 83" ${line(1, C.white, 0.7)}/>`,
  }),
  head({
    // 鳥取砂丘的駱駝：兩個駝峰，中間鋪著彩色的鞍布
    id: 'tottori-rakuda',
    name: '砂丘駱駝帽',
    pref: 'tottori',
    rarity: 2,
    icon: '36 14 152 80',
    svg:
      `<path d="M172 66 C182 68 184 78 180 86" ${line(2.4, C.brown)}/>` +
      shape(CAMEL, C.yellow) +
      tint(CAMEL, C.brown, 0.45) +
      `<path d="M150 46 C164 52 176 64 174 84 C166 80 158 78 152 77 C156 66 156 56 150 46Z" ${SH}/>` +
      shape('M106 48 C108 40 126 40 130 48 L132 62 C122 66 112 66 104 62Z', C.red) +
      `<path d="M104 62 C112 66 122 66 132 62" ${line(1.6, C.yellow)}/>` +
      dots(C.yellow, 1.2, [
        [106, 66],
        [112, 67.5],
        [118, 68],
        [124, 67.5],
        [130, 66],
      ]) +
      `<path d="M110 52 L126 52 M110 57 L128 57" ${line(1.2, C.blue)}/>` +
      shape(CAMEL_HEAD, C.yellow) +
      tint(CAMEL_HEAD, C.brown, 0.45) +
      `<path d="M56 32 L58 28" ${line(2, C.brown)}/>` +
      `<circle cx="51" cy="35" r="1.3" fill="${C.ink}"/>` +
      `<path d="M44 38 L46.4 38.6" ${line(1, C.ink, 0.6)}/>`,
  }),
  head({
    // 出雲的玉造（めのう、碧玉、水晶的勾玉）
    id: 'shimane-magatama',
    name: '出雲勾玉髮飾',
    pref: 'shimane',
    rarity: 2,
    icon: '50 38 64 54',
    svg:
      `<path d="M60 86 C64 70 80 56 106 48" ${line(1.4, C.red)}/>` +
      dots(C.white, 1.8, [
        [62.6, 77],
        [68, 68.5],
        [79, 59.4],
        [93, 52.6],
      ], E) +
      magatama(73, 72, 1.2, 20, C.green) +
      magatama(86, 63, 1.2, 10, C.red) +
      magatama(100, 56, 1.1, 0, C.white),
  }),
  head({
    // 岡山城（烏城）：黑色的下見板、金色的鯱
    id: 'okayama-ujo',
    name: '岡山烏城帽',
    pref: 'okayama',
    rarity: 2,
    icon: '40 -6 160 96',
    svg: castle({ wall: C.ink, roof: C.grey, trim: C.gold }),
  }),
  head({
    // 宮島的紅葉谷（宮島 = 廣島縣廿日市市）
    id: 'hiroshima-momijidani',
    name: '宮島紅葉髮飾',
    pref: 'hiroshima',
    rarity: 1,
    icon: '44 26 70 64',
    svg: PIN + momiji(80, 74, 10, -5, C.yellow) + momiji(68, 56, 15, -20, C.red) + momiji(92, 48, 12, 25, C.orange),
  }),
  head({
    // 岩國的錦帶橋：五連的木造拱橋
    id: 'yamaguchi-kintaikyo',
    name: '錦帶橋帽',
    pref: 'yamaguchi',
    rarity: 2,
    icon: '54 32 132 60',
    svg:
      shape('M60 86 C78 76 162 76 180 86 C160 82 80 82 60 86Z', C.blue) +
      [84, 108, 132, 156].map((x) => shape(`M${x - 5} 82 L${x - 3} 63 L${x + 3} 63 L${x + 5} 82Z`, C.grey)).join('') +
      shape('M62 70 L84 64 L84 58 L62 64Z', C.brown) +
      shape('M156 64 L178 70 L178 64 L156 58Z', C.brown) +
      shape('M84 64 C88 46 104 46 108 64 C112 46 128 46 132 64 C136 46 152 46 156 64 L156 58 C152 40 136 40 132 58 C128 40 112 40 108 58 C104 40 88 40 84 58Z', C.brown) +
      `<path d="M84 56 C88 38 104 38 108 56 C112 38 128 38 132 56 C136 38 152 38 156 56 M62 62 L84 56 M156 56 L178 62" ${line(1.2, C.brown)}/>` +
      `<path d="M88 51 C92 46 100 45 104 48 M112 51 C116 46 124 45 128 48 M136 51 C140 46 148 45 152 48" ${line(1, C.cream, 0.45)}/>`,
  }),
  head({
    // 阿波狸合戰（小松島的狸）：頭上頂一片葉子
    id: 'tokushima-tanuki',
    name: '阿波狸耳髮箍',
    pref: 'tokushima',
    rarity: 1,
    icon: '62 14 116 80',
    svg:
      `<path d="M68 90 C64 58 88 40 120 40 C152 40 176 58 172 90" ${line(4.4, C.ink)}/>` +
      `<circle cx="88" cy="48" r="11" fill="${C.brown}" ${E}/><circle cx="88" cy="49" r="6" fill="${C.ink}" opacity=".7"/>` +
      `<circle cx="152" cy="48" r="11" fill="${C.brown}" ${E}/><circle cx="152" cy="49" r="6" fill="${C.ink}" opacity=".7"/>` +
      shape('M120 42 C112 36 112 26 120 20 C128 26 128 36 120 42Z', C.green) +
      `<path d="M120 44 L120 23" ${line(1, C.matcha)}/>`,
  }),
  head({
    // 小豆島的醬油（木桶釀造）
    id: 'kagawa-shoyu',
    name: '小豆島醬油桶帽',
    pref: 'kagawa',
    rarity: 2,
    icon: '62 28 116 64',
    svg:
      shape(OKE, C.brown) +
      tint(OKE, C.yellow, 0.25) +
      `<path d="M96 42 L93 84 M108 42 L107 84 M132 42 L133 84 M144 42 L147 84" ${line(1, C.ink, 0.25)}/>` +
      `<path d="M146 42 L156 42 L162 84 L148 84Z" ${SH}/>` +
      shape('M82.6 51 L157.4 51 L158.2 57 L81.8 57Z', C.yellow) +
      shape('M80 72 L160 72 L160.8 78 L79.2 78Z', C.yellow) +
      tint('M82.6 51 L157.4 51 L158.2 57 L81.8 57Z M80 72 L160 72 L160.8 78 L79.2 78Z', C.brown, 0.2) +
      shape('M113 59 L127 59 L127 70 L113 70Z', C.white) +
      vtext('醤', 120, 64.6, 9, C.ink) +
      `<ellipse cx="120" cy="42" rx="36" ry="6" fill="${C.brown}" ${E}/>` +
      `<ellipse cx="120" cy="42" rx="30" ry="4" fill="${C.ink}" opacity=".3"/>`,
  }),
  head({
    // 道後溫泉本館：屋頂上的振鷺閣與白鷺
    id: 'ehime-dogo',
    name: '道後溫泉本館帽',
    pref: 'ehime',
    rarity: 3,
    icon: '56 0 128 90',
    svg:
      shape('M72 84 L74 70 L166 70 L168 84Z', C.brown) +
      tint('M72 84 L74 70 L166 70 L168 84Z', C.yellow, 0.2) +
      `<path d="M84 74 L84 82 M96 74 L96 82 M108 74 L108 82 M132 74 L132 82 M144 74 L144 82 M156 74 L156 82" ${line(4, C.cream, 0.9)}/>` +
      shape('M62 72 C88 66 152 66 178 72 L162 62 L78 62Z', C.grey) +
      `<path d="M62 72 C88 66 152 66 178 72" ${line(1.2, C.white, 0.6)}/>` +
      shape('M86 62 L86 52 L154 52 L154 62Z', C.brown) +
      `<path d="M96 54.6 L96 60 M108 54.6 L108 60 M120 54.6 L120 60 M132 54.6 L132 60 M144 54.6 L144 60" ${line(3.4, C.cream, 0.9)}/>` +
      shape('M78 54 C96 48 144 48 162 54 L150 44 L90 44Z', C.grey) +
      shape('M108 44 L108 28 L132 28 L132 44Z', C.red) +
      `<path d="M114 28 L114 44 M120 28 L120 44 M126 28 L126 44 M108 36 L132 36" ${line(1, C.white, 0.8)}/>` +
      shape('M102 30 C110 26 130 26 138 30 L128 20 L112 20Z', C.grey) +
      shape('M112 16 C114 10 122 9 126 13 L132 7 C134 6 135 8 133 9 L128 15 C124 19 116 20 112 16Z', C.white) +
      `<path d="M133 8 L138 7" ${line(1.2, C.yellow)}/>` +
      `<path d="M118 19 L118 22 M122 19 L122 22" ${line(1, C.ink, 0.6)}/>`,
  }),
  head({
    // 土佐珊瑚（高知的寶石珊瑚）的髮簪
    id: 'kochi-sango',
    name: '土佐珊瑚髮簪',
    pref: 'kochi',
    rarity: 2,
    icon: '42 24 70 62',
    svg:
      `<path d="M72 62 L108 80" ${line(2.4, C.grey)}/>` +
      `<g transform="translate(74 64) scale(1.35) translate(-74 -64)">` +
      shape('M66 66 C64 58 60 52 56 48 C60 48 64 52 66 56 C66 50 66 44 70 40 C70 46 70 52 70 58 C72 52 76 48 80 48 C76 52 72 60 72 66Z', C.red) +
      tint('M66 66 C64 58 60 52 56 48 C60 48 64 52 66 56 C66 50 66 44 70 40 C70 46 70 52 70 58 C72 52 76 48 80 48 C76 52 72 60 72 66Z', C.pink, 0.35) +
      dots(C.red, 1.6, [
        [56, 47.6],
        [70, 39.6],
        [80, 47.6],
      ], E) +
      `<circle cx="76" cy="64" r="6" fill="${C.red}" ${E}/>` +
      `<circle cx="74" cy="62" r="1.8" fill="${C.white}" opacity=".6"/>` +
      `</g>`,
  }),
  head({
    // 太宰府天滿宮的鷽替え神事：木雕的鷽鳥
    id: 'fukuoka-uso',
    name: '太宰府木鷽髮飾',
    pref: 'fukuoka',
    rarity: 2,
    icon: '50 34 64 54',
    svg:
      PIN +
      shape('M70 76 C64 66 66 52 76 46 C86 42 94 50 94 60 C94 70 88 78 80 80 C76 80 72 79 70 76Z', C.yellow) +
      tint('M70 76 C64 66 66 52 76 46 C86 42 94 50 94 60 C94 70 88 78 80 80 C76 80 72 79 70 76Z', C.brown, 0.35) +
      shape('M76 47 C80 41 90 42 93 50 C88 48 82 48 76 47Z', C.ink) +
      `<path d="M93 53 L98 54.4 L93 56" ${line(1.2, C.ink)}/>` +
      `<circle cx="88" cy="53" r="1.3" fill="${C.ink}"/>` +
      `<circle cx="89" cy="59" r="2.6" fill="${C.red}" opacity=".85"/>` +
      `<path d="M80 56 C84 60 86 66 84 72" ${line(2.4, C.green, 0.8)}/>` +
      `<path d="M72 58 C78 56 82 60 78 63 M70 64 C76 62 80 66 76 69 M71 70 C77 68 81 72 77 75" ${line(1.4, C.brown)}/>`,
  }),
  head({
    // 吉野ヶ里遺跡：茅草屋頂的物見櫓與一圈木柵
    id: 'saga-yoshinogari',
    name: '吉野里物見櫓帽',
    pref: 'saga',
    rarity: 2,
    icon: '58 -10 124 98',
    svg:
      `<path d="M98 72 L106 34 M142 72 L134 34 M110 72 L112 34 M130 72 L128 34" ${line(2.6, C.brown)}/>` +
      `<path d="M100 62 L140 46 M140 62 L100 46" ${line(1.4, C.brown, 0.8)}/>` +
      `<path d="${Array.from({ length: 12 }, (_, i) => {
        const x = +(67 + i * 9.4).toFixed(1)
        return `M${x} 84 L${x} 72 L${x + 3} 68 L${x + 6} 72 L${x + 6} 84Z`
      }).join(' ')}" fill="${C.brown}" ${E}/>` +
      `<path d="M66 78 L174 78" ${line(1.6, C.yellow)}/>` +
      shape('M96 36 L144 36 L144 30 L96 30Z', C.brown) +
      shape('M90 30 C100 20 110 8 120 0 C130 8 140 20 150 30Z', C.yellow) +
      tint('M90 30 C100 20 110 8 120 0 C130 8 140 20 150 30Z', C.brown, 0.4) +
      `<path d="M104 18 L100 30 M112 10 L110 30 M120 4 L120 30 M128 10 L130 30 M136 18 L140 30" ${line(1, C.brown, 0.5)}/>` +
      `<path d="M114 3 L126 -5 M126 3 L114 -5" ${line(2, C.brown)}/>`,
  }),
  head({
    // 長崎くんち（data/festivals）的傘鉾：圓傘下面垂一圈刺繡的幕
    id: 'nagasaki-kasaboko',
    name: '長崎傘鉾帽',
    pref: 'nagasaki',
    rarity: 3,
    icon: '54 0 132 84',
    svg:
      shape('M70 46 L170 46 L173 72 C150 80 90 80 67 72Z', C.red) +
      `<path d="M70 46 L170 46 L173 72 C150 80 90 80 67 72Z" fill="url(#doll-yuzen)" opacity=".4"/>` +
      `<path d="M90 50 L88 74 M110 50 L110 77 M130 50 L130 77 M150 50 L152 74" ${line(1, C.gold, 0.6)}/>` +
      `<path d="M67 72 C90 80 150 80 173 72" ${line(2.4, C.gold)}/>` +
      shape('M62 48 C80 38 160 38 178 48 C160 54 80 54 62 48Z', C.ink) +
      `<path d="M62 48 C80 54 160 54 178 48" ${line(1.4, C.gold)}/>` +
      shape('M110 42 L130 42 L126 32 L114 32Z', C.gold) +
      `<circle cx="120" cy="24" r="8" fill="${C.gold}" ${E}/>` +
      shape('M120 16 C116 12 118 6 120 4 C122 6 124 12 120 16Z', C.gold) +
      `<path d="M116 22 C118 20 120 19 122 19" ${line(1.4, C.white, 0.5)}/>`,
  }),
  head({
    // 肥後象嵌（經濟產業大臣指定）：黑鐵上嵌金銀的撥形髮簪
    id: 'kumamoto-zogan',
    name: '肥後象嵌髮簪',
    pref: 'kumamoto',
    rarity: 2,
    icon: '50 34 64 54',
    svg:
      `<path d="M80 62 L108 78 M84 58 L110 72" ${line(2.2, C.ink)}/>` +
      shape(BACHI, C.ink) +
      `<path d="M59 49.6 C66 46.4 74 43.6 80.4 42.8 L85.4 59.4 C80 62.6 73.6 66 67 67.6Z" fill="none" stroke="${C.grey}" stroke-width="1"/>` +
      blossom(70, 54, 3.4, C.gold) +
      `<path d="M62 62 C68 60 72 64 78 60 C82 58 84 54 82 50" ${line(1, C.gold)}/>` +
      dots(C.gold, 1, [
        [64, 50],
        [78, 46],
        [80, 62],
      ]) +
      dots(C.grey, 1, [
        [61, 56],
        [84, 55],
      ]),
  }),
  head({
    // 別府溫泉的湯煙：頭上頂一條摺好的毛巾
    id: 'oita-yukemuri',
    name: '別府湯煙毛巾',
    pref: 'oita',
    rarity: 1,
    icon: '80 -4 80 60',
    svg:
      `<path d="${STEAM}" ${line(4.4, C.grey, 0.5)}/>` +
      `<path d="${STEAM}" ${line(2.8, C.white)}/>` +
      shape(TOWEL, C.white) +
      `<path d="M96 41.2 L144 41.2 M91 46.4 C104 43 136 43 149 46.4" ${line(1.6, C.blue)}/>` +
      `<path d="M140 38 C146 40 150 44 152 52 C148 50 144 49 140 48Z" ${SH}/>`,
  }),
  head({
    // 日向夏（宮崎原產的柑橘，連白色的內皮一起吃）
    id: 'miyazaki-hyuganatsu',
    name: '日向夏髮飾',
    pref: 'miyazaki',
    rarity: 1,
    icon: '50 36 60 50',
    svg:
      PIN +
      shape('M74 50 C78 42 86 40 92 42 C88 48 82 51 74 50Z', C.green) +
      `<circle cx="70" cy="62" r="10" fill="${C.yellow}" ${E}/>` +
      `<circle cx="70" cy="62" r="10" fill="${C.cream}" opacity=".3"/>` +
      dots(C.orange, 0.6, [
        [66, 58],
        [72, 56],
        [75, 62],
        [70, 67],
        [64, 64],
      ], 'opacity=".5"') +
      `<path d="M63 57 C65 54 68 53 71 53" ${line(1.8, C.white, 0.5)}/>` +
      `<circle cx="90" cy="58" r="8" fill="${C.yellow}" ${E}/>` +
      `<circle cx="90" cy="58" r="7" fill="${C.white}"/>` +
      `<circle cx="90" cy="58" r="5" fill="${C.yellow}"/>` +
      `<path d="M90 58 L90 53 M90 58 L94.3 55.5 M90 58 L94.3 60.5 M90 58 L90 63 M90 58 L85.7 60.5 M90 58 L85.7 55.5" ${line(0.8, C.white, 0.9)}/>`,
  }),
  head({
    // 屋久島的繩文杉（世界遺產）
    id: 'kagoshima-jomonsugi',
    name: '繩文杉帽',
    pref: 'kagoshima',
    rarity: 3,
    icon: '58 -6 124 92',
    svg:
      shape('M72 84 C78 72 162 72 168 84Z', C.matcha) +
      dots(C.green, 2, [
        [84, 78],
        [96, 76],
        [146, 76],
        [158, 79],
      ]) +
      shape('M100 80 C104 68 102 56 106 46 C100 40 92 38 86 34 C96 33 104 36 109 40 C110 32 110 26 114 20 C117 28 117 34 119 40 C125 34 131 31 140 30 C135 36 131 42 131 48 C134 60 136 70 142 80Z', C.brown) +
      `<path d="M108 76 C110 66 108 56 112 46 M124 76 C122 64 126 54 124 44 M116 78 C118 70 116 62 118 54" ${line(1.2, C.ink, 0.35)}/>` +
      `<g fill="${C.green}" ${E}><ellipse cx="84" cy="30" rx="16" ry="9"/><ellipse cx="142" cy="24" rx="18" ry="10"/><ellipse cx="112" cy="16" rx="18" ry="10"/><ellipse cx="128" cy="6" rx="14" ry="8"/><ellipse cx="98" cy="22" rx="12" ry="7"/></g>` +
      `<path d="M76 28 C82 24 88 24 92 26 M104 12 C110 8 118 8 122 10 M134 20 C140 16 148 16 152 18 M122 3 C126 0 132 0 136 2" ${line(2, C.matcha, 0.9)}/>` +
      `<path d="M142 34 C150 34 158 30 160 24 M112 26 C118 26 126 22 130 16" ${line(2, C.ink, 0.16)}/>`,
  }),
  head({
    // 扶桑花（ハイビスカス，沖繩的花）
    id: 'okinawa-hibiscus',
    name: '扶桑花髮飾',
    pref: 'okinawa',
    rarity: 1,
    icon: '48 34 64 54',
    svg:
      shape('M84 74 C92 70 100 70 106 74 C100 78 92 78 84 74Z', C.green) +
      shape('M60 78 C58 72 60 66 64 64 C66 70 66 74 60 78Z', C.green) +
      [0, 72, 144, 216, 288].map((a) => `<path d="M72 60 C62 54 62 42 72 41 C82 42 82 54 72 60Z" fill="${C.red}" ${E} transform="rotate(${a} 72 60)"/>`).join('') +
      [0, 72, 144, 216, 288].map((a) => `<path d="M72 58 L72 47" ${line(0.8, C.pink, 0.8)} transform="rotate(${a} 72 60)"/>`).join('') +
      `<circle cx="72" cy="60" r="4" fill="${C.ink}" opacity=".35"/>` +
      `<path d="M72 60 L86 48" ${line(1.6, C.cream)}/>` +
      dots(C.yellow, 1.2, [
        [84, 46.4],
        [87.6, 46.8],
        [86, 50],
      ]) +
      `<circle cx="87" cy="47.4" r="1.4" fill="${C.red}"/>`,
  }),
]

// ---------- 手上 ----------
const FOIL = 'M134 214 C136 232 150 240 166 240 C182 240 196 232 198 214 C188 222 144 222 134 214Z'
const POT = 'M134 206 C134 230 148 238 166 238 C184 238 198 230 198 206Z'
const TABI = 'M150 166 L166 166 L167 212 C168 220 176 224 186 226 C194 228 196 236 190 240 L156 240 C150 240 148 234 148 226Z'
const PURSE = 'M140 208 C140 200 192 200 192 208 L194 228 C194 238 186 242 166 242 C146 242 138 238 138 228Z'
const KIRIKO = 'M142 192 L192 192 C190 210 182 222 167 222 C152 222 144 210 142 192Z'
const senbei = (x: number, y: number, rot: number) =>
  tilt(
    x,
    y,
    rot,
    shape(`M${x - 8} ${y + 4} L${x} ${y - 7} L${x + 8} ${y + 4}Z`, C.cream) +
      tint(`M${x - 8} ${y + 4} L${x} ${y - 7} L${x + 8} ${y + 4}Z`, C.yellow, 0.45) +
      `<path d="M${x - 7} ${y + 3.4} L${x + 7} ${y + 3.4}" ${line(1.6, C.brown, 0.5)}/>`,
  )
const chestnut = (x: number, y: number, rot: number) =>
  tilt(
    x,
    y,
    rot,
    shape(`M${x} ${y - 9} C${x + 7} ${y - 6} ${x + 9} ${y + 2} ${x + 8} ${y + 7} C${x + 3} ${y + 9} ${x - 3} ${y + 9} ${x - 8} ${y + 7} C${x - 9} ${y + 2} ${x - 7} ${y - 6} ${x} ${y - 9}Z`, C.brown) +
      `<path d="M${x - 8} ${y + 7} C${x - 3} ${y + 9} ${x + 3} ${y + 9} ${x + 8} ${y + 7} C${x + 7} ${y + 3} ${x - 7} ${y + 3} ${x - 8} ${y + 7}Z" fill="${C.cream}"/>` +
      `<path d="M${x - 4} ${y - 4} C${x - 3} ${y - 6} ${x - 1} ${y - 7} ${x} ${y - 7}" ${line(1.4, C.white, 0.45)}/>`,
  )
const yubaRoll = (x: number, y: number) =>
  shape(`M${x - 12} ${y - 5} L${x + 10} ${y - 5} C${x + 14} ${y - 5} ${x + 14} ${y + 5} ${x + 10} ${y + 5} L${x - 12} ${y + 5} C${x - 15} ${y + 5} ${x - 15} ${y - 5} ${x - 12} ${y - 5}Z`, C.yellow) +
  tint(`M${x - 12} ${y - 5} L${x + 10} ${y - 5} C${x + 14} ${y - 5} ${x + 14} ${y + 5} ${x + 10} ${y + 5} L${x - 12} ${y + 5}Z`, C.cream, 0.4) +
  `<ellipse cx="${x - 12}" cy="${y}" rx="3" ry="5" fill="${C.cream}" ${E}/>` +
  `<path d="M${x - 12} ${y - 2.4} C${x - 10.4} ${y - 2.4} ${x - 10.4} ${y + 2.4} ${x - 12} ${y + 2.4} C${x - 13.2} ${y + 2.4} ${x - 13.2} ${y} ${x - 12} ${y}" ${line(0.9, C.brown, 0.5)}/>`
const clam = (x: number, y: number) =>
  shape(`M${x - 14} ${y} C${x - 14} ${y - 12} ${x + 14} ${y - 12} ${x + 14} ${y}Z`, C.cream) +
  `<path d="M${x - 8} ${y - 1} L${x - 6} ${y - 8} M${x} ${y - 1} L${x} ${y - 9} M${x + 8} ${y - 1} L${x + 6} ${y - 8}" ${line(1, C.brown, 0.5)}/>` +
  shape(`M${x - 15} ${y} C${x - 14} ${y + 8} ${x + 14} ${y + 8} ${x + 15} ${y}Z`, C.cream) +
  tint(`M${x - 15} ${y} C${x - 14} ${y + 8} ${x + 14} ${y + 8} ${x + 15} ${y}Z`, C.brown, 0.3) +
  `<ellipse cx="${x}" cy="${y + 1}" rx="10" ry="3.4" fill="${C.yellow}" ${E}/>` +
  `<ellipse cx="${x - 2}" cy="${y + 0.6}" rx="5" ry="1.6" fill="${C.orange}" opacity=".6"/>`
const shumai = (x: number, y: number) =>
  shape(`M${x - 7} ${y} L${x - 6} ${y - 9} C${x - 3} ${y - 11} ${x + 3} ${y - 11} ${x + 6} ${y - 9} L${x + 7} ${y}Z`, C.yellow) +
  tint(`M${x - 7} ${y} L${x - 6} ${y - 9} C${x - 3} ${y - 11} ${x + 3} ${y - 11} ${x + 6} ${y - 9} L${x + 7} ${y}Z`, C.cream, 0.4) +
  `<ellipse cx="${x}" cy="${y - 9}" rx="6" ry="2.4" fill="${C.pink}" ${E}/>` +
  `<ellipse cx="${x}" cy="${y - 9}" rx="6" ry="2.4" fill="${C.brown}" opacity=".35"/>` +
  `<path d="M${x - 4} ${y - 1} L${x - 3.6} ${y - 7.6} M${x} ${y - 1} L${x} ${y - 8} M${x + 4} ${y - 1} L${x + 3.6} ${y - 7.6}" ${line(0.7, C.brown, 0.3)}/>` +
  `<circle cx="${x}" cy="${y - 9.6}" r="1.4" fill="${C.green}"/>`
const kakiSeed = (x: number, y: number, rot: number) =>
  `<path d="M${x - 5} ${y} C${x - 3} ${y - 3} ${x + 3} ${y - 3} ${x + 6} ${y + 1} C${x + 2} ${y + 1} ${x - 2} ${y + 2} ${x - 5} ${y}Z" fill="${C.orange}" ${E} transform="rotate(${rot} ${x} ${y})"/>`
const funa = (x: number, y: number, rot: number) =>
  tilt(
    x,
    y,
    rot,
    `<ellipse cx="${x}" cy="${y}" rx="10" ry="5.4" fill="${C.cream}" ${E}/>` +
      `<ellipse cx="${x}" cy="${y}" rx="10" ry="5.4" fill="${C.orange}" opacity=".25"/>` +
      `<ellipse cx="${x + 1}" cy="${y}" rx="5" ry="3" fill="${C.orange}"/>` +
      `<path d="M${x - 9} ${y - 2} C${x - 4} ${y - 6} ${x + 4} ${y - 6} ${x + 9} ${y - 2}" ${line(1.2, C.grey, 0.8)}/>`,
  )
const bun = (x: number, y: number) =>
  shape(`M${x - 15} ${y} C${x - 15} ${y - 16} ${x + 15} ${y - 16} ${x + 15} ${y} C${x + 15} ${y + 4} ${x - 15} ${y + 4} ${x - 15} ${y}Z`, C.white) +
  tint(`M${x - 15} ${y} C${x - 15} ${y - 16} ${x + 15} ${y - 16} ${x + 15} ${y} C${x + 15} ${y + 4} ${x - 15} ${y + 4} ${x - 15} ${y}Z`, C.cream, 0.6) +
  `<path d="M${x + 6} ${y - 10} C${x + 12} ${y - 8} ${x + 15} ${y - 4} ${x + 15} ${y} C${x + 15} ${y + 2} ${x + 10} ${y + 3} ${x + 6} ${y + 3.4} C${x + 10} ${y - 2} ${x + 9} ${y - 7} ${x + 6} ${y - 10}Z" ${SH}/>` +
  `<path d="M${x - 5} ${y - 9} C${x - 2} ${y - 13} ${x + 2} ${y - 13} ${x + 5} ${y - 9} M${x - 2} ${y - 12} L${x - 3} ${y - 8} M${x + 2} ${y - 12} L${x + 3} ${y - 8} M${x} ${y - 13} L${x} ${y - 9}" ${line(1, C.ink, 0.3)}/>`
const sara = (x: number, y: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="22" ry="6" fill="${C.white}" ${E}/>` + `<ellipse cx="${x}" cy="${y}" rx="19" ry="4.6" fill="none" stroke="${C.blue}" stroke-width="1.2" opacity=".8"/>`
const rakkyo = (x: number, y: number) =>
  `<path d="M${x} ${y - 6} C${x + 4} ${y - 3} ${x + 5} ${y + 3} ${x} ${y + 5} C${x - 5} ${y + 3} ${x - 4} ${y - 3} ${x} ${y - 6}Z" fill="${C.cream}" ${E}/>` +
  `<path d="M${x} ${y - 6} L${x + 0.6} ${y - 8}" ${line(1, C.matcha, 0.8)}/>`
const bouro = (x: number, y: number) =>
  `<ellipse cx="${x}" cy="${y + 3}" rx="16" ry="5" fill="${C.brown}" ${E}/>` +
  `<ellipse cx="${x}" cy="${y}" rx="16" ry="5" fill="${C.yellow}" ${E}/>` +
  `<ellipse cx="${x}" cy="${y}" rx="16" ry="5" fill="${C.brown}" opacity=".3"/>` +
  `<ellipse cx="${x - 2}" cy="${y - 1}" rx="9" ry="2.4" fill="${C.cream}" opacity=".35"/>`
const sabaSlice = (x: number, y: number) =>
  shape(`M${x - 8} ${y + 7} C${x - 9} ${y} ${x - 6} ${y - 7} ${x - 1} ${y - 10} L${x + 7} ${y - 9} C${x + 3} ${y - 5} ${x + 1} ${y + 1} ${x + 2} ${y + 8}Z`, C.pink) +
  tint(`M${x - 1} ${y - 10} L${x + 7} ${y - 9} C${x + 5.6} ${y - 7.4} ${x + 4.4} ${y - 5.6} ${x + 3.6} ${y - 4} L${x - 4.6} ${y - 5.4} C${x - 3.6} ${y - 7.4} ${x - 2.4} ${y - 8.8} ${x - 1} ${y - 10}Z`, C.blue, 0.9) +
  `<path d="M${x - 2} ${y - 7.6} L${x + 5} ${y - 6.6}" ${line(0.9, C.ink, 0.6)}/>` +
  `<path d="M${x - 5} ${y - 2} C${x - 3} ${y} ${x - 3} ${y + 3} ${x - 4} ${y + 5}" ${line(0.8, C.white, 0.6)}/>`
const uiro = (x: number, fill: string) =>
  shape(`M${x} 228 L${x} 206 L${x + 12} 204 L${x + 12} 226Z`, fill) + `<path d="M${x + 2} 222 L${x + 2} 210" ${line(1.2, C.white, 0.4)}/>`

const HAND: Outfit[] = [
  hand({
    // じゃがバター：北海道的馬鈴薯，鋁箔裡蒸熟，放一塊奶油
    id: 'hokkaido-jagabata',
    name: '奶油馬鈴薯',
    pref: 'hokkaido',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M142 216 C138 200 150 188 166 188 C182 188 194 200 190 216 C180 222 152 222 142 216Z', C.yellow) +
      tint('M142 216 C138 200 150 188 166 188 C182 188 194 200 190 216 C180 222 152 222 142 216Z', C.cream, 0.45) +
      `<path d="M146 210 C140 200 152 190 166 190 C180 190 192 200 186 210" ${line(2.4, C.brown, 0.5)}/>` +
      `<path d="M154 204 L178 202 M166 192 L166 214" ${line(1.6, C.brown, 0.55)}/>` +
      shape('M156 196 L170 193 L175 201 L161 204Z', C.cream) +
      tint('M156 196 L170 193 L175 201 L161 204Z', C.yellow, 0.5) +
      `<path d="M162 204 C162 208 160 210 161 213" ${line(2, C.yellow)}/>` +
      shape(FOIL, C.grey) +
      tint(FOIL, C.white, 0.45) +
      `<path d="M142 222 L148 226 M158 226 L162 232 M176 226 L182 230 M188 222 L190 228" ${line(1, C.white, 0.8)}/>`,
  }),
  hand({
    // 八戶せんべい汁（data/specialties）：南部仙貝煮進醬油湯裡
    id: 'aomori-senbeijiru',
    name: '八戶仙貝湯',
    pref: 'aomori',
    rarity: 1,
    icon: ICON.bowl,
    svg: bowl({
      bowl: C.ink,
      soup: C.brown,
      rim: C.red,
      top:
        senbei(150, 205, -14) +
        senbei(170, 202, 10) +
        senbei(186, 207, 24) +
        `<ellipse cx="160" cy="210" rx="4" ry="2.4" fill="${C.cream}" ${E}/>` +
        dots(C.green, 1.6, [
          [158, 204],
          [176, 210],
          [142, 210],
          [190, 211],
        ]),
    }),
  }),
  hand({
    // 盛岡冷麵：牛骨湯、泡菜、半顆蛋、西瓜
    id: 'iwate-reimen',
    name: '盛岡冷麵',
    pref: 'iwate',
    rarity: 1,
    icon: ICON.bowl,
    svg: bowl({
      bowl: C.grey,
      soup: C.brown,
      soupOp: 0.45,
      noodle: C.cream,
      top:
        shape('M142 206 C144 198 156 196 160 204Z', C.red) +
        `<ellipse cx="172" cy="203" rx="6" ry="4" fill="${C.white}" ${E}/><circle cx="172" cy="203" r="2.4" fill="${C.yellow}"/>` +
        shape('M182 206 L194 199 L193 210Z', C.red) +
        `<path d="M194 199 L193 210" ${line(1.6, C.green)}/>` +
        dots(C.matcha, 2, [
          [158, 211],
          [164, 212],
        ], E) +
        dots(C.cream, 0.7, [
          [150, 203],
          [154, 201],
          [180, 208],
        ]),
    }),
  }),
  hand({
    // 仙台的牛舌（炭火烤的厚切牛舌，配高麗菜）
    id: 'miyagi-gyutan',
    name: '仙台牛舌',
    pref: 'miyagi',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      plate() +
      shape('M182 228 C178 220 190 214 198 220 C202 224 200 228 196 230Z', C.green) +
      `<path d="M186 222 L194 220 M184 226 L196 224" ${line(0.9, C.white, 0.8)}/>` +
      [
        [148, 222, -12],
        [166, 219, 6],
        [184, 222, 14],
      ]
        .map(([x, y, r]) =>
          tilt(
            x!,
            y!,
            r!,
            `<ellipse cx="${x}" cy="${y}" rx="13" ry="5.5" fill="${C.brown}" ${E}/>` +
              `<ellipse cx="${x}" cy="${y}" rx="10" ry="3.4" fill="${C.pink}" opacity=".35"/>` +
              `<path d="M${x! - 6} ${y! - 3} L${x! - 3} ${y! + 3} M${x} ${y! - 3.4} L${x! + 3} ${y! + 3} M${x! + 6} ${y! - 3} L${x! + 8} ${y! + 2}" ${line(1, C.ink, 0.4)}/>`,
          ),
        )
        .join(''),
  }),
  hand({
    // いぶりがっこ（data/specialties）：煙燻的蘿蔔漬
    id: 'akita-iburigakko',
    name: '煙燻蘿蔔漬',
    pref: 'akita',
    rarity: 1,
    icon: '124 184 92 60',
    svg:
      shape('M138 210 C150 198 186 190 200 194 C204 198 198 206 188 208 C172 212 150 218 138 210Z', C.brown) +
      tint('M138 210 C150 198 186 190 200 194 C204 198 198 206 188 208 C172 212 150 218 138 210Z', C.yellow, 0.3) +
      `<path d="M150 206 L152 210 M160 202 L162 207 M172 199 L173 204 M184 196 L185 201" ${line(1, C.ink, 0.3)}/>` +
      plate() +
      [
        [148, 224],
        [162, 222],
        [176, 225],
      ]
        .map(
          ([x, y]) =>
            `<ellipse cx="${x}" cy="${y}" rx="7" ry="4.6" fill="${C.brown}" ${E}/><ellipse cx="${x}" cy="${y}" rx="5.4" ry="3.2" fill="${C.cream}"/><ellipse cx="${x}" cy="${y}" rx="5.4" ry="3.2" fill="${C.yellow}" opacity=".5"/>`,
        )
        .join(''),
  }),
  hand({
    // 山形的芋煮（data/specialties）：鐵鍋裡的芋頭、牛肉、蒟蒻與蔥
    id: 'yamagata-imoni',
    name: '芋煮',
    pref: 'yamagata',
    rarity: 1,
    icon: ICON.bowl,
    svg:
      shape('M126 205 L136 205 L136 212 L128 212Z', C.ink) +
      shape('M196 205 L206 205 L204 212 L196 212Z', C.ink) +
      shape(POT, C.ink) +
      `<path d="M140 214 C142 224 148 230 156 234" ${line(2, C.white, 0.25)}/>` +
      `<ellipse cx="166" cy="206" rx="32" ry="7" fill="${C.brown}" ${E}/>` +
      `<ellipse cx="166" cy="206" rx="32" ry="7" fill="${C.yellow}" opacity=".25"/>` +
      `<path d="M176 206 L200 172" ${line(3, C.brown)}/>` +
      [
        [150, 204],
        [164, 206],
        [178, 203],
      ]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="4" fill="${C.cream}" ${E}/><ellipse cx="${x}" cy="${y! + 1}" rx="5" ry="2.4" fill="${C.grey}" opacity=".35"/>`)
        .join('') +
      shape('M156 210 C160 206 168 206 172 210 C166 212 162 212 156 210Z', C.brown) +
      `<rect x="184" y="205" width="7" height="4" fill="${C.grey}" ${E} transform="rotate(-10 187 207)"/>` +
      dots(C.green, 1.6, [
        [144, 208],
        [160, 202],
        [186, 210],
        [172, 211],
      ]),
  }),
  hand({
    // 大堀相馬燒（經濟產業大臣指定）：青色的裂紋與奔跑的馬
    id: 'fukushima-somayaki',
    name: '大堀相馬燒杯',
    pref: 'fukushima',
    rarity: 2,
    icon: ICON.hand,
    svg: cup(
      C.blue,
      C.blue,
      tint('M140 200 L192 200 L188 236 C186 240 146 240 144 236Z', C.white, 0.4) +
        `<path d="M146 206 L152 212 L150 220 M152 212 L160 214 M164 228 L170 232 L178 228 M180 208 L184 216 L182 222 M184 216 L188 214" ${line(0.7, C.ink, 0.35)}/>` +
        shape('M152 220 C154 214 164 213 168 216 L171 210 C173 207 176 208 175 211 L173 218 C171 222 166 223 160 223 C156 223 153 222 152 220Z', C.ink) +
        `<path d="M154 221 L150 228 M158 223 L157 230 M166 222 L170 229 M169 221 L174 226 M152 218 C148 216 146 218 145 222" ${line(1.3, C.ink)}/>` +
        `<ellipse cx="166" cy="200" rx="23" ry="3.6" fill="none" stroke="${C.ink}" stroke-opacity=".2"/>`,
    ),
  }),
  hand({
    // 笠間的栗子（茨城縣是日本栗子產量第一）
    id: 'ibaraki-kasamakuri',
    name: '笠間栗',
    pref: 'ibaraki',
    rarity: 1,
    icon: '128 176 80 72',
    svg:
      `<path d="${Array.from({ length: 32 }, (_, k) => {
        const a = (k / 32) * Math.PI * 2
        const [c, s] = [Math.cos(a), Math.sin(a)]
        return `M${(166 + c * 20).toFixed(1)} ${(214 + s * 20).toFixed(1)} L${(166 + c * 28).toFixed(1)} ${(214 + s * 28).toFixed(1)}`
      }).join(' ')}" ${line(1.4, C.matcha)}/>` +
      `<circle cx="166" cy="214" r="22" fill="${C.matcha}" ${E}/>` +
      `<circle cx="166" cy="214" r="22" fill="${C.brown}" opacity=".15"/>` +
      `<path d="M148 210 C156 202 176 202 184 210" ${line(2, C.brown, 0.5)}/>` +
      chestnut(154, 216, -22) +
      chestnut(178, 216, 22) +
      chestnut(166, 210, 0),
  }),
  hand({
    // 日光ゆば（data/specialties）：捲起來的湯波
    id: 'tochigi-yuba',
    name: '日光湯波',
    pref: 'tochigi',
    rarity: 1,
    icon: '124 192 92 52',
    svg: plate() + yubaRoll(152, 223) + yubaRoll(178, 221) + yubaRoll(165, 213),
  }),
  hand({
    // 下仁田蔥：又粗又短的白蔥
    id: 'gunma-shimonita',
    name: '下仁田蔥',
    pref: 'gunma',
    rarity: 1,
    icon: '124 136 92 120',
    svg:
      `<g transform="rotate(28 158 224)">` +
      `<path d="M152 250 L148 256 M155 250 L155 257 M158 250 L162 256 M153 250 L150 254" ${line(1, C.brown, 0.8)}/>` +
      shape('M151 196 C151 190 147 178 140 166 C148 172 154 182 156 196Z', C.green) +
      shape('M155 196 C154 180 154 164 158 150 C162 164 162 180 161 196Z', C.green) +
      shape('M160 196 C162 182 168 170 176 160 C172 174 166 186 165 198Z', C.green) +
      `<path d="M158 156 L158 192" ${line(0.8, C.matcha)}/>` +
      shape('M151 250 L151 196 L165 196 L165 250 C165 253 151 253 151 250Z', C.white) +
      tint('M151 214 L165 214 L165 196 L151 196Z', C.matcha, 0.35) +
      `<path d="M154 244 L154 200 M158 246 L158 200 M162 244 L162 200" ${line(0.7, C.ink, 0.15)}/>` +
      `</g>`,
  }),
  hand({
    // 行田足袋（行田市曾是日本最大的足袋產地）
    id: 'saitama-tabi',
    name: '行田足袋',
    pref: 'saitama',
    rarity: 1,
    icon: '124 152 92 96',
    svg:
      `<g transform="translate(12 -6)">` +
      shape(TABI, C.navy) +
      dots(C.gold, 1.2, [
        [151, 172],
        [151, 180],
        [151, 188],
        [151, 196],
      ]) +
      `</g>` +
      shape(TABI, C.white) +
      `<path d="M166 172 L166 210" ${line(1, C.ink, 0.2)}/>` +
      shape('M150 236 C160 238 180 240 192 239 C192 242 156 242 150 240Z', C.grey) +
      dots(C.gold, 1.4, [
        [151, 172],
        [151, 182],
        [151, 192],
        [151, 202],
      ]),
  }),
  hand({
    // 九十九里濱的烤文蛤（焼きはまぐり）
    id: 'chiba-hamaguri',
    name: '九十九里烤文蛤',
    pref: 'chiba',
    rarity: 1,
    icon: '124 196 92 48',
    svg: plate() + clam(148, 224) + clam(180, 222) + `<path d="M178 208 C176 204 180 200 178 196 M184 208 C182 204 186 200 184 196" ${line(1.2, C.grey, 0.6)}/>`,
  }),
  hand({
    // 人形町的人形燒（雷門燈籠、五重塔、鴿子的形狀）
    id: 'tokyo-ningyoyaki',
    name: '人形燒',
    pref: 'tokyo',
    rarity: 1,
    icon: '124 190 92 54',
    svg:
      shape('M132 232 L144 204 L200 210 L190 238Z', C.white) +
      `<path d="M136 230 L146 208" ${line(1, C.ink, 0.12)}/>` +
      shape('M144 222 C144 210 160 210 160 222 C160 232 144 232 144 222Z', C.yellow) +
      tint('M144 222 C144 210 160 210 160 222 C160 232 144 232 144 222Z', C.brown, 0.45) +
      `<path d="M145 216 L159 216 M145 228 L159 228" ${line(1.4, C.brown, 0.6)}/>` +
      shape('M164 228 L168 222 L166 222 L170 216 L168 216 L172 208 L176 216 L174 216 L178 222 L176 222 L180 228Z', C.yellow) +
      tint('M164 228 L168 222 L166 222 L170 216 L168 216 L172 208 L176 216 L174 216 L178 222 L176 222 L180 228Z', C.brown, 0.45) +
      shape('M180 230 C178 222 184 216 190 218 C194 214 198 216 196 220 C198 226 194 232 186 232Z', C.yellow) +
      tint('M180 230 C178 222 184 216 190 218 C194 214 198 216 196 220 C198 226 194 232 186 232Z', C.brown, 0.45) +
      `<circle cx="193" cy="219" r=".9" fill="${C.ink}"/>`,
  }),
  hand({
    // 橫濱中華街的燒賣（蒸籠裡）
    id: 'kanagawa-shumai',
    name: '橫濱燒賣',
    pref: 'kanagawa',
    rarity: 1,
    icon: ICON.bowl,
    svg:
      shape('M134 214 L198 214 L194 236 C190 240 142 240 138 236Z', C.yellow) +
      tint('M134 214 L198 214 L194 236 C190 240 142 240 138 236Z', C.brown, 0.25) +
      `<path d="M136 222 L196 222 M137 229 L195 229" ${line(1, C.brown, 0.4)}/>` +
      `<ellipse cx="166" cy="214" rx="32" ry="7" fill="${C.cream}" ${E}/>` +
      shumai(150, 212) +
      shumai(166, 210) +
      shumai(182, 212) +
      shumai(158, 217) +
      shumai(174, 217),
  }),
  hand({
    // 柿の種（長岡生的米果）：橘色的柿子種子形，配花生
    id: 'niigata-kakinotane',
    name: '柿種米果',
    pref: 'niigata',
    rarity: 1,
    icon: '124 186 92 56',
    svg:
      [
        [146, 212, 10],
        [156, 208, -20],
        [168, 206, 30],
        [180, 209, -10],
        [188, 214, 40],
        [152, 216, 60],
        [176, 214, 0],
        [162, 212, -40],
      ]
        .map(([x, y, r]) => kakiSeed(x!, y!, r!))
        .join('') +
      [
        [164, 216],
        [184, 210],
        [144, 216],
      ]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="2.2" fill="${C.cream}" ${E}/>`)
        .join('') +
      shape('M134 216 C138 234 194 234 198 216Z', C.white) +
      `<ellipse cx="166" cy="216" rx="32" ry="3" fill="${C.white}" ${E}/>` +
      `<path d="M140 222 C150 228 182 228 192 222" ${line(1.4, C.blue, 0.7)}/>`,
  }),
  hand({
    // 越中富山的賣藥郎送的紙風船
    id: 'toyama-kamifusen',
    name: '富山紙風船',
    pref: 'toyama',
    rarity: 1,
    icon: '124 164 92 82',
    svg:
      `<circle cx="170" cy="196" r="22" fill="${C.green}" ${E}/>` +
      [
        [16, C.blue],
        [10, C.yellow],
        [4, C.red],
      ]
        .map(([w, c]) => `<path d="M170 174 C${170 - +w! * 1.33} 180 ${170 - +w! * 1.33} 212 170 218 C${170 + +w! * 1.33} 212 ${170 + +w! * 1.33} 180 170 174Z" fill="${c}"/>`)
        .join('') +
      `<path d="M148 196 L192 196" ${line(0.8, C.ink, 0.2)}/>` +
      `<circle cx="170" cy="175.6" r="2" fill="${C.ink}" opacity=".5"/>` +
      `<path d="M154 188 C156 182 160 178 164 177" ${line(2.4, C.white, 0.5)}/>`,
  }),
  hand({
    // 金澤的喉黑魚（のどぐろ，赤鯥）鹽烤
    id: 'ishikawa-nodoguro',
    name: '烤喉黑魚',
    pref: 'ishikawa',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      shape('M128 222 L204 216 L206 228 L130 234Z', C.white) +
      `<path d="M130 230 L205 224" ${line(2, C.blue, 0.7)}/>` +
      shape('M138 218 C146 208 170 204 186 210 L198 202 L196 214 L200 222 L186 218 C170 226 146 226 138 218Z', C.red) +
      tint('M140 220 C150 226 170 226 186 218 C170 220 150 222 140 220Z', C.white, 0.6) +
      `<path d="M152 212 L156 220 M162 210 L166 220 M172 209 L175 218" ${line(1.4, C.ink, 0.4)}/>` +
      `<circle cx="144" cy="215" r="2.4" fill="${C.white}"/><circle cx="144" cy="215" r="1.2" fill="${C.ink}"/>` +
      `<path d="M138 218 L143 219.4" ${line(1.6, C.ink)}/>` +
      dots(C.white, 0.9, [
        [196, 204],
        [197, 214],
        [190, 210],
      ]),
  }),
  hand({
    // 若狹塗箸（小濱市產的漆筷，日本八成以上）
    id: 'fukui-wakasabashi',
    name: '若狹塗筷',
    pref: 'fukui',
    rarity: 1,
    icon: '124 160 92 92',
    svg:
      `<g transform="rotate(38 158 222)">` +
      shape('M152 162 L156 162 L155 250 L153 250Z', C.ink) +
      shape('M160 162 L164 162 L163 250 L161 250Z', C.ink) +
      dots(C.gold, 0.8, [
        [154, 166],
        [154, 174],
        [154, 184],
        [154, 194],
        [162, 168],
        [162, 178],
        [162, 188],
        [162, 198],
      ]) +
      dots(C.red, 0.7, [
        [154, 170],
        [154, 188],
        [162, 174],
        [162, 192],
      ]) +
      dots(C.green, 0.7, [
        [154, 180],
        [154, 198],
        [162, 184],
      ]) +
      `<path d="M152 204 L156 204 M160 204 L164 204" ${line(1.4, C.gold)}/>` +
      `</g>`,
  }),
  hand({
    // 甲州印傳（經濟產業大臣指定）：鹿皮上用漆點出花紋的口金包
    id: 'yamanashi-inden',
    name: '甲州印傳錢包',
    pref: 'yamanashi',
    rarity: 2,
    icon: ICON.hand,
    svg:
      shape(PURSE, C.navy) +
      dots(
        C.blue,
        1.3,
        Array.from({ length: 5 }, (_, r) => Array.from({ length: 7 }, (_, c): [number, number] => [146 + c * 6 + (r % 2) * 3, 211 + r * 6])).flat(),
      ) +
      `<path d="M182 206 L192 208 L194 228 C194 238 186 242 176 242 C184 232 186 218 182 206Z" ${SH}/>` +
      `<path d="M140 208 C140 202 156 198 166 198 C176 198 192 202 192 208" ${line(2.6, C.gold)}/>` +
      `<circle cx="163" cy="196" r="2.8" fill="${C.gold}" ${E}/><circle cx="169" cy="196" r="2.8" fill="${C.gold}" ${E}/>`,
  }),
  hand({
    // 野沢菜漬（data/specialties）
    id: 'nagano-nozawana',
    name: '野澤菜漬',
    pref: 'nagano',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      plate() +
      shape('M138 228 C140 212 160 204 168 206 C180 204 196 214 196 228Z', C.green) +
      `<path d="M146 222 L152 218 M158 224 L164 218 M170 222 L178 218 M182 224 L188 220 M152 214 L158 210 M166 212 L172 210" ${line(3, C.matcha)}/>` +
      `<path d="M148 226 L154 222 M174 226 L180 222" ${line(3, C.cream, 0.8)}/>`,
  }),
  hand({
    // 五平餅（data/specialties）：塗上味噌胡桃醬烤的米餅
    id: 'gifu-gohei',
    name: '五平餅',
    pref: 'gifu',
    rarity: 1,
    icon: '124 150 92 94',
    svg:
      `<path d="M156 238 L176 164" ${line(3.4, C.cream)}/>` +
      tilt(
        172,
        186,
        16,
        shape('M172 160 C162 160 160 172 160 186 C160 200 162 212 172 212 C182 212 184 200 184 186 C184 172 182 160 172 160Z', C.cream) +
          dots(C.white, 0.9, [
            [164, 200],
            [170, 206],
            [178, 202],
            [166, 192],
          ]) +
          shape('M172 163 C165 163 163 172 163 184 C163 194 166 200 172 200 C178 200 181 194 181 184 C181 172 179 163 172 163Z', C.brown) +
          tint('M172 163 C165 163 163 172 163 184 C163 194 166 200 172 200 C178 200 181 194 181 184 C181 172 179 163 172 163Z', C.orange, 0.3) +
          dots(C.ink, 1.2, [
            [168, 170],
            [176, 180],
            [168, 190],
          ], 'opacity=".5"') +
          `<path d="M166 172 C166 168 168 166 170 166" ${line(1.6, C.white, 0.4)}/>`,
      ),
  }),
  hand({
    // 駿河竹千筋細工（經濟產業大臣指定）：細竹條編成的蟲籠
    id: 'shizuoka-mushikago',
    name: '駿河竹蟲籠',
    pref: 'shizuoka',
    rarity: 2,
    icon: '124 164 92 82',
    svg:
      `<path d="M162 186 C158 172 178 172 174 186" ${line(1.8, C.red)}/>` +
      `<path d="M168 174 L168 168" ${line(1.4, C.red)}/>` +
      `<path d="M172 214 L170 220 M178 214 L180 220" ${line(1, C.green)}/>` +
      `<ellipse cx="174" cy="214" rx="6" ry="3" fill="${C.green}" ${E}/>` +
      `<path d="M178 212 L190 204 M178 212 L188 206" ${line(0.8, C.green)}/>` +
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${150 + i * 3} 190 L${150 + i * 3} 232`).join(' ')}" ${line(1, C.yellow)}/>` +
      `<path d="${Array.from({ length: 14 }, (_, i) => `M${150 + i * 3} 190 L${150 + i * 3} 232`).join(' ')}" ${line(1, C.brown, 0.3)}/>` +
      `<ellipse cx="169" cy="188" rx="21" ry="5" fill="${C.brown}" ${E}/>` +
      `<ellipse cx="169" cy="232" rx="21" ry="5" fill="${C.brown}" ${E}/>` +
      `<path d="M150 230 C162 234 176 234 188 230" ${line(1, C.cream, 0.4)}/>`,
  }),
  hand({
    // 豐橋的手筒花火（data/festivals）：抱著竹筒噴出火花
    id: 'aichi-tezutsu',
    name: '手筒煙火',
    pref: 'aichi',
    rarity: 3,
    icon: '124 128 96 124',
    svg:
      (() => {
        const rays: string[] = []
        const ends: Array<[number, number]> = []
        for (let k = 0; k < 11; k++) {
          const a = ((-125 + k * 10) * Math.PI) / 180
          const r = k % 2 ? 26 : 34
          rays.push(`M${(180 + Math.cos(a) * 6).toFixed(1)} ${(166 + Math.sin(a) * 6).toFixed(1)} L${(180 + Math.cos(a) * r).toFixed(1)} ${(166 + Math.sin(a) * r).toFixed(1)}`)
          ends.push([+(180 + Math.cos(a) * (r + 3)).toFixed(1), +(166 + Math.sin(a) * (r + 3)).toFixed(1)])
        }
        return `<path d="${rays.join(' ')}" ${line(1.8, C.yellow)}/>` + dots(C.gold, 1.5, ends) + dots(C.orange, 1.2, [
          [170, 150],
          [192, 148],
          [182, 140],
          [200, 158],
        ])
      })() +
      `<g transform="rotate(20 166 206)">` +
      shape('M158 248 L158 166 C158 162 174 162 174 166 L174 248Z', C.matcha) +
      tint('M158 248 L158 166 C158 162 174 162 174 166 L174 248Z', C.yellow, 0.4) +
      `<path d="M158 176 L174 184 M158 186 L174 194 M158 196 L174 204 M158 206 L174 214 M158 216 L174 224 M158 226 L174 234 M158 236 L174 244" ${line(2.2, C.yellow)}/>` +
      `<path d="M158 176 L174 184 M158 186 L174 194 M158 196 L174 204 M158 206 L174 214 M158 216 L174 224 M158 226 L174 234 M158 236 L174 244" ${line(2.2, C.brown, 0.3)}/>` +
      `<ellipse cx="166" cy="165" rx="8" ry="2.4" fill="${C.ink}"/>` +
      `</g>`,
  }),
  hand({
    // 萬古燒（四日市，經濟產業大臣指定）的紫泥急須
    id: 'mie-banko',
    name: '萬古燒急須',
    pref: 'mie',
    rarity: 2,
    icon: '124 180 92 66',
    svg:
      [
        'M148 206 L128 190 L132 186 L152 200Z',
        'M186 214 C192 210 198 202 202 196 L206 199 C202 208 196 216 190 222Z',
        'M140 216 C140 200 192 200 192 216 C192 232 180 240 166 240 C152 240 140 232 140 216Z',
        'M146 204 C146 198 186 198 186 204 C178 208 154 208 146 204Z',
      ]
        .map((d) => shape(d, C.purple) + tint(d, C.brown, 0.45))
        .join('') +
      `<path d="M182 210 C190 216 190 228 182 236 C178 238 174 240 170 240 C182 232 186 220 182 210Z" ${SH}/>` +
      `<circle cx="166" cy="198" r="3.4" fill="${C.purple}" ${E}/><circle cx="166" cy="198" r="3.4" fill="${C.brown}" opacity=".45"/>` +
      blossom(170, 222, 3, C.white) +
      `<path d="M148 214 C148 208 152 206 156 206" ${line(2, C.white, 0.3)}/>`,
  }),
  hand({
    // 滋賀的鮒壽司（data/specialties）：切片，中間是橘色的魚卵
    id: 'shiga-funazushi',
    name: '鮒壽司',
    pref: 'shiga',
    rarity: 1,
    icon: '124 196 92 48',
    svg: plate() + funa(148, 222, -10) + funa(166, 220, 0) + funa(184, 222, 10) + dots(C.white, 1.6, [[158, 228], [176, 228], [192, 228]], E),
  }),
  hand({
    // 京都的上生菓子：菊花與金團
    id: 'kyoto-namagashi',
    name: '京都上生菓子',
    pref: 'kyoto',
    rarity: 1,
    icon: '124 194 92 50',
    svg:
      plate(C.ink) +
      `<circle cx="154" cy="217" r="10" fill="${C.pink}" ${E}/>` +
      `<path d="${Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2
        return `M${(154 + Math.cos(a) * 3).toFixed(1)} ${(217 + Math.sin(a) * 3).toFixed(1)} L${(154 + Math.cos(a) * 9).toFixed(1)} ${(217 + Math.sin(a) * 9).toFixed(1)}`
      }).join(' ')}" ${line(0.8, C.white, 0.8)}/>` +
      `<circle cx="154" cy="217" r="2.2" fill="${C.yellow}"/>` +
      `<circle cx="178" cy="215" r="10" fill="${C.matcha}" ${E}/>` +
      dots(C.green, 0.9, [
        [172, 210],
        [178, 208],
        [184, 212],
        [174, 216],
        [182, 218],
        [178, 222],
        [186, 216],
        [170, 220],
      ]) +
      dots(C.pink, 1.2, [
        [176, 212],
        [182, 214],
        [174, 219],
      ]) +
      `<path d="M188 230 L204 222" ${line(2, C.brown)}/>`,
  }),
  hand({
    // 大阪的豬肉包（豚まん）
    id: 'osaka-butaman',
    name: '大阪豬肉包',
    pref: 'osaka',
    rarity: 1,
    icon: '124 196 92 48',
    svg: plate(C.navy) + bun(180, 226) + bun(152, 228),
  }),
  hand({
    // 出石皿そば（data/specialties）：出石燒的小白盤一盤一盤疊起來
    id: 'hyogo-sarasoba',
    name: '出石皿蕎麥',
    pref: 'hyogo',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      sara(170, 234) +
      sara(170, 229) +
      sara(170, 224) +
      sara(170, 219) +
      shape('M152 219 C154 206 186 206 188 219Z', C.grey) +
      tint('M152 219 C154 206 186 206 188 219Z', C.brown, 0.5) +
      `<path d="M156 216 C160 209 164 218 168 210 C172 218 176 209 180 216 M160 212 C164 207 172 207 178 211" ${line(1.2, C.brown, 0.8)}/>` +
      dots(C.green, 1.5, [
        [166, 208],
        [174, 210],
        [170, 213],
      ]) +
      `<circle cx="180" cy="212" r="2.4" fill="${C.yellow}" ${E}/>`,
  }),
  hand({
    // 高山茶筌（生駒市高山，經濟產業大臣指定）
    id: 'nara-chasen',
    name: '高山茶筅',
    pref: 'nara',
    rarity: 2,
    icon: '124 162 92 84',
    svg:
      shape('M150 204 L164 204 L164 238 C164 241 150 241 150 238Z', C.yellow) +
      tint('M150 204 L164 204 L164 238 C164 241 150 241 150 238Z', C.brown, 0.3) +
      `<path d="M150 226 L164 226" ${line(1.2, C.brown, 0.6)}/>` +
      shape('M146 204 C138 192 140 176 157 170 C174 176 176 192 168 204Z', C.cream) +
      tint('M146 204 C138 192 140 176 157 170 C174 176 176 192 168 204Z', C.yellow, 0.35) +
      `<path d="M148 202 C142 192 146 180 152 174 M152 203 C148 192 150 180 155 172 M157 204 L157 171 M162 203 C166 192 164 180 159 172 M166 202 C172 192 168 180 162 174" ${line(0.8, C.brown, 0.5)}/>` +
      `<path d="M150 177 C154 183 160 183 164 177" ${line(1.2, C.brown, 0.5)}/>` +
      `<path d="M146 204 L168 204" ${line(1.6, C.ink, 0.8)}/>`,
  }),
  hand({
    // めはり寿司（data/specialties）：高菜葉包的大飯糰
    id: 'wakayama-mehari',
    name: '目張壽司',
    pref: 'wakayama',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      plate() +
      `<ellipse cx="146" cy="214" rx="15" ry="13" fill="${C.green}" ${E}/>` +
      `<ellipse cx="146" cy="214" rx="15" ry="13" fill="${C.ink}" opacity=".25"/>` +
      `<path d="M136 206 C142 212 148 212 156 208 M134 218 C142 222 150 222 158 218 M146 202 L146 226" ${line(1, C.matcha, 0.8)}/>` +
      `<ellipse cx="182" cy="222" rx="13" ry="11" fill="${C.green}" ${E}/>` +
      `<ellipse cx="182" cy="222" rx="13" ry="11" fill="${C.ink}" opacity=".25"/>` +
      `<ellipse cx="182" cy="222" rx="10" ry="8" fill="${C.white}"/>` +
      dots(C.cream, 0.8, [
        [178, 218],
        [184, 216],
        [186, 225],
        [179, 226],
        [182, 221],
      ]),
  }),
  hand({
    // 鳥取砂丘らっきょう（data/specialties）：一罐甜醋醃的蕗蕎
    id: 'tottori-rakkyo',
    name: '砂丘蕗蕎',
    pref: 'tottori',
    rarity: 1,
    icon: '124 178 92 68',
    svg:
      shape('M142 196 L190 196 L192 236 C192 241 140 241 140 236Z', C.white) +
      [
        [150, 208],
        [160, 206],
        [170, 208],
        [180, 206],
        [154, 218],
        [165, 217],
        [176, 218],
        [186, 216],
        [148, 228],
        [159, 229],
        [170, 228],
        [181, 229],
      ]
        .map(([x, y]) => rakkyo(x!, y!))
        .join('') +
      `<path d="M142 202 L190 202 L192 236 C192 241 140 241 140 236Z" fill="${C.yellow}" opacity=".16"/>` +
      `<path d="M146 204 L145 232" ${line(2.4, C.white, 0.7)}/>` +
      shape('M140 186 L192 186 L192 196 L140 196Z', C.red) +
      `<path d="M140 191 L192 191" ${line(1, C.ink, 0.2)}/>`,
  }),
  hand({
    // 出雲ぜんざい（神在月的神在餅是善哉的起源之說）：紅白年糕
    id: 'shimane-zenzai',
    name: '出雲善哉',
    pref: 'shimane',
    rarity: 1,
    icon: ICON.bowl,
    svg: bowl({
      bowl: C.red,
      soup: C.brown,
      rim: C.gold,
      top:
        `<ellipse cx="166" cy="208" rx="32" ry="7" fill="${C.red}" opacity=".3"/>` +
        `<ellipse cx="156" cy="206" rx="7" ry="4" fill="${C.white}" ${E}/>` +
        `<ellipse cx="174" cy="207" rx="7" ry="4" fill="${C.pink}" ${E}/>` +
        dots(C.ink, 1.3, [
          [144, 209],
          [148, 205],
          [186, 209],
          [190, 206],
          [166, 211],
        ], 'opacity=".5"'),
    }),
  }),
  hand({
    // 倉敷帆布（兒島、倉敷的帆布）托特包
    id: 'okayama-hanpu',
    name: '倉敷帆布包',
    pref: 'okayama',
    rarity: 1,
    icon: '120 206 72 66',
    svg:
      `<path d="M144 236 C144 222 152 216 156 216 C160 216 168 222 168 236" ${line(3, C.navy)}/>` +
      shape('M136 234 L176 234 L180 266 L132 266Z', C.cream) +
      tint('M136 234 L176 234 L180 266 L132 266Z', C.yellow, 0.15) +
      `<path d="M166 234 L176 234 L180 266 L168 266Z" ${SH}/>` +
      shape('M133.2 256 L178.8 256 L180 266 L132 266Z', C.navy) +
      `<path d="M138 238 L174 238" ${line(1, C.brown, 0.4)} stroke-dasharray="2 2"/>` +
      shape('M162 242 L172 242 L172 248 L162 248Z', C.brown),
  }),
  hand({
    // 熊野筆（經濟產業大臣指定）：化妝刷
    id: 'hiroshima-kumanofude',
    name: '熊野筆',
    pref: 'hiroshima',
    rarity: 2,
    icon: '124 140 92 112',
    svg:
      `<g transform="rotate(30 158 222)">` +
      shape('M154 250 L154 196 L162 196 L162 250 C162 253 154 253 154 250Z', C.red) +
      tint('M154 250 L154 196 L162 196 L162 250 C162 253 154 253 154 250Z', C.ink, 0.2) +
      `<path d="M156 200 L156 246" ${line(1, C.white, 0.35)}/>` +
      shape('M152 196 L164 196 L165 184 L151 184Z', C.gold) +
      shape('M151 184 C144 176 144 160 150 150 C154 144 162 144 166 150 C172 160 172 176 165 184Z', C.cream) +
      tint('M150 150 C154 144 162 144 166 150 C168 154 168 158 167 161 C162 158 154 158 149 161 C148 158 148 154 150 150Z', C.brown, 0.5) +
      `<path d="M152 180 C150 170 151 162 154 156 M158 182 L158 156 M164 180 C166 170 165 162 162 156" ${line(0.8, C.brown, 0.3)}/>` +
      `</g>`,
  }),
  hand({
    // 山口外郎（data/specialties）：蕨粉做的外郎，紅豆、抹茶、白三色
    id: 'yamaguchi-uiro',
    name: '山口外郎',
    pref: 'yamaguchi',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      shape('M130 230 C150 220 186 218 204 224 C188 234 150 236 130 230Z', C.green) +
      `<path d="M134 229 C160 226 184 224 200 224" ${line(1, C.matcha)}/>` +
      uiro(144, C.brown) +
      uiro(158, C.matcha) +
      uiro(172, C.cream),
  }),
  hand({
    // 德島的竹ちくわ（小松島）：烤在竹子上的竹輪
    id: 'tokushima-takechikuwa',
    name: '竹竹輪',
    pref: 'tokushima',
    rarity: 1,
    icon: '124 148 92 104',
    svg:
      `<path d="M146 246 L198 158" ${line(4.4, C.matcha)}/>` +
      `<path d="M149.6 233.9 L154.8 236.9 M190.2 165.3 L195.4 168.3" ${line(1.4, C.green)}/>` +
      `<g transform="rotate(30.6 172 202)">` +
      shape('M164 222 L164 182 C164 178 180 178 180 182 L180 222 C180 226 164 226 164 222Z', C.yellow) +
      tint('M164 222 L164 182 C164 178 180 178 180 182 L180 222 C180 226 164 226 164 222Z', C.brown, 0.45) +
      `<path d="M164 188 L180 190 M164 196 L180 198 M164 204 L180 206 M164 212 L180 214" ${line(2, C.brown, 0.7)}/>` +
      `<path d="M167 186 L167 218" ${line(1.4, C.white, 0.35)}/>` +
      `</g>`,
  }),
  hand({
    // 丸龜團扇（經濟產業大臣指定，日本的團扇九成產自丸龜）
    id: 'kagawa-uchiwa',
    name: '丸龜團扇',
    pref: 'kagawa',
    rarity: 1,
    icon: '124 150 92 96',
    svg:
      `<path d="M156 236 L172 204" ${line(4, C.yellow)}/>` +
      `<path d="M156 236 L172 204" ${line(4, C.brown, 0.25)}/>` +
      `<circle cx="180" cy="182" r="26" fill="${C.white}" ${E}/>` +
      `<circle cx="180" cy="182" r="26" fill="url(#doll-ryusui)" opacity=".6"/>` +
      `<path d="${Array.from({ length: 13 }, (_, k) => {
        const a = ((-170 + k * 13) * Math.PI) / 180
        return `M172 204 L${(180 + Math.cos(a) * 25).toFixed(1)} ${(182 + Math.sin(a) * 25).toFixed(1)}`
      }).join(' ')}" ${line(0.6, C.brown, 0.25)}/>` +
      `<ellipse cx="184" cy="176" rx="5" ry="3.4" fill="${C.red}"/>` +
      shape('M188 176 L194 171 L193 181Z', C.red) +
      tilt(172, 190, 30, `<ellipse cx="172" cy="190" rx="4" ry="2.6" fill="${C.red}"/><path d="M175 190 L180 186 L179 194Z" fill="${C.red}"/>`) +
      `<circle cx="180" cy="182" r="25" fill="none" stroke="${C.blue}" stroke-width="2"/>`,
  }),
  hand({
    // 鯛めし（data/specialties）：松山一帶整條鯛魚放在飯上炊
    id: 'ehime-taimeshi',
    name: '鯛魚飯',
    pref: 'ehime',
    rarity: 1,
    icon: ICON.bowl,
    svg:
      shape('M128 206 L136 206 L136 212 L130 212Z', C.brown) +
      shape('M196 206 L204 206 L202 212 L196 212Z', C.brown) +
      shape(POT, C.brown) +
      tint(POT, C.ink, 0.25) +
      dots(C.cream, 0.9, [
        [146, 220],
        [158, 228],
        [176, 226],
        [188, 216],
        [166, 232],
      ], 'opacity=".6"') +
      `<ellipse cx="166" cy="206" rx="32" ry="7" fill="${C.white}" ${E}/>` +
      shape('M144 206 C150 196 172 194 184 200 L194 194 L192 204 L196 212 L184 206 C172 212 152 212 144 206Z', C.red) +
      tint('M146 207 C156 211 172 211 184 206 C172 208 156 209 146 207Z', C.white, 0.5) +
      `<path d="M160 200 L162 206 M168 199 L170 206 M176 200 L177 205" ${line(0.9, C.ink, 0.3)}/>` +
      `<circle cx="150" cy="202" r="1.6" fill="${C.ink}"/>` +
      dots(C.green, 1.4, [
        [140, 208],
        [188, 209],
      ]),
  }),
  hand({
    // 高知的帽子麵包（ぼうしパン）
    id: 'kochi-boshipan',
    name: '帽子麵包',
    pref: 'kochi',
    rarity: 1,
    icon: '124 186 92 56',
    svg:
      `<ellipse cx="166" cy="222" rx="30" ry="12" fill="${C.yellow}" ${E}/>` +
      `<ellipse cx="166" cy="222" rx="30" ry="12" fill="${C.cream}" opacity=".5"/>` +
      `<path d="M140 226 C150 234 182 234 192 226 C186 232 176 234 166 234 C156 234 146 232 140 226Z" ${SH}/>` +
      shape('M146 220 C146 198 186 198 186 220 C176 224 156 224 146 220Z', C.brown) +
      tint('M146 220 C146 198 186 198 186 220 C176 224 156 224 146 220Z', C.orange, 0.25) +
      `<path d="M152 210 C154 205 158 203 162 203" ${line(2, C.white, 0.4)}/>`,
  }),
  hand({
    // 博多もつ鍋：牛腸、高麗菜、中間一大把韭菜
    id: 'fukuoka-motsunabe',
    name: '博多牛腸鍋',
    pref: 'fukuoka',
    rarity: 1,
    icon: '120 180 96 64',
    svg:
      shape('M124 208 L134 208 L134 214 L126 214Z', C.grey) +
      shape('M198 208 L208 208 L206 214 L198 214Z', C.grey) +
      shape('M132 210 C132 228 148 236 166 236 C184 236 200 228 200 210Z', C.grey) +
      tint('M132 210 C132 228 148 236 166 236 C184 236 200 228 200 210Z', C.white, 0.25) +
      `<ellipse cx="166" cy="210" rx="34" ry="8" fill="${C.cream}" ${E}/>` +
      `<ellipse cx="166" cy="210" rx="34" ry="8" fill="${C.yellow}" opacity=".35"/>` +
      shape('M138 212 C140 202 154 200 160 208Z', C.matcha) +
      shape('M172 208 C176 200 190 200 194 210Z', C.green) +
      `<path d="M140 210 L156 206 M176 206 L190 208" ${line(1, C.white, 0.6)}/>` +
      [
        [146, 213],
        [184, 213],
        [170, 214],
      ]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="${C.cream}" ${E}/><ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="${C.pink}" opacity=".4"/>`)
        .join('') +
      `<path d="M152 206 L176 200 M154 210 L180 204 M156 203 L182 198 M150 208 L174 202" ${line(2, C.green)}/>` +
      `<circle cx="160" cy="214" r="2" fill="none" stroke="${C.red}" stroke-width="1.2"/><circle cx="178" cy="210" r="2" fill="none" stroke="${C.red}" stroke-width="1.2"/>` +
      dots(C.white, 1.6, [
        [164, 214],
        [190, 214],
      ], E),
  }),
  hand({
    // 佐賀的丸芳露（丸ぼうろ，葡萄牙傳來的圓餅乾）
    id: 'saga-marubouro',
    name: '佐賀丸芳露',
    pref: 'saga',
    rarity: 1,
    icon: '124 188 92 54',
    svg:
      shape('M132 236 L140 222 L196 220 L202 236Z', C.white) +
      bouro(160, 229) +
      bouro(162, 223) +
      bouro(160, 217) +
      bouro(163, 211) +
      `<circle cx="188" cy="216" r="14" fill="${C.yellow}" ${E}/>` +
      `<circle cx="188" cy="216" r="14" fill="${C.brown}" opacity=".35"/>` +
      `<path d="M182 212 C186 210 190 212 194 210 M182 220 C186 218 192 222 195 219" ${line(1, C.cream, 0.6)}/>`,
  }),
  hand({
    // 長崎的ぽっぺん（ビードロ）：吹了會發出聲音的玻璃玩具
    id: 'nagasaki-poppen',
    name: '長崎玻璃喇叭',
    pref: 'nagasaki',
    rarity: 2,
    icon: '124 164 92 82',
    svg:
      shape('M154 236 L170 204 L174 206 L158 238Z', C.white) +
      tint('M154 236 L170 204 L174 206 L158 238Z', C.blue, 0.2) +
      `<circle cx="180" cy="190" r="18" fill="${C.white}" ${E}/>` +
      `<circle cx="180" cy="190" r="18" fill="${C.blue}" opacity=".2"/>` +
      `<path d="M164 186 C172 182 188 182 196 186 M163 194 C172 198 188 198 197 194" ${line(1.6, C.red)}/>` +
      dots(C.pink, 1.6, [
        [172, 190],
        [180, 190],
        [188, 190],
      ], E) +
      `<path d="M168 180 C170 176 174 174 178 173" ${line(2.4, C.white, 0.9)}/>`,
  }),
  hand({
    // 八代的晚白柚（世界最大的柑橘之一）
    id: 'kumamoto-banpeiyu',
    name: '八代晚白柚',
    pref: 'kumamoto',
    rarity: 1,
    icon: '124 146 92 96',
    svg:
      `<path d="M170 168 L172 160" ${line(2.6, C.brown)}/>` +
      `<circle cx="170" cy="198" r="30" fill="${C.yellow}" ${E}/>` +
      `<circle cx="170" cy="198" r="30" fill="${C.green}" opacity=".18"/>` +
      `<path d="M182 172 C198 180 204 196 200 210 C196 222 186 228 176 228 C190 216 194 192 182 172Z" ${SH}/>` +
      dots(C.orange, 0.9, [
        [156, 192],
        [164, 206],
        [178, 196],
        [184, 212],
        [168, 218],
        [152, 210],
        [176, 182],
        [162, 180],
      ], 'opacity=".5"') +
      `<path d="M150 186 C154 178 160 174 166 172" ${line(3, C.white, 0.5)}/>` +
      shape('M172 162 C178 152 190 152 194 156 C188 164 180 166 172 162Z', C.green),
  }),
  hand({
    // 關鯖（佐賀關的一本釣青花魚）生魚片
    id: 'oita-sekisaba',
    name: '關鯖',
    pref: 'oita',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      plate() +
      shape('M132 228 C132 216 152 212 158 226Z', C.white) +
      `<path d="M136 224 C140 218 146 216 152 218 M138 226 C142 221 148 220 154 222" ${line(0.8, C.grey, 0.6)}/>` +
      heartLeaf(146, 214, 9, -60) +
      sabaSlice(166, 222) +
      sabaSlice(176, 221) +
      sabaSlice(186, 220) +
      sabaSlice(196, 221),
  }),
  hand({
    // 宮崎的肉巻きおにぎり：甜醬油烤的豬肉包住飯糰
    id: 'miyazaki-nikumaki',
    name: '肉捲飯糰',
    pref: 'miyazaki',
    rarity: 1,
    icon: '124 172 92 74',
    svg:
      `<g transform="rotate(-12 166 214)">` +
      shape('M150 190 C150 184 182 184 182 190 L182 222 L150 222Z', C.brown) +
      tint('M150 190 C150 184 182 184 182 190 L182 222 L150 222Z', C.orange, 0.3) +
      `<path d="M150 198 L182 192 M150 208 L182 202 M150 218 L182 212" ${line(1.2, C.ink, 0.3)}/>` +
      `<path d="M154 194 L154 216" ${line(2, C.white, 0.35)}/>` +
      `<ellipse cx="166" cy="189" rx="16" ry="4.6" fill="${C.white}" ${E}/>` +
      dots(C.cream, 0.8, [
        [160, 188],
        [166, 190],
        [172, 188],
      ]) +
      shape('M150 220 L182 220 L184 240 L148 240Z', C.white) +
      `<path d="M148.6 230 L183.4 230" ${line(1.2, C.red, 0.6)}/>` +
      `</g>`,
  }),
  hand({
    // 薩摩切子（鹿兒島縣指定的傳統工藝品）：紅色的暈色切子玻璃
    id: 'kagoshima-kiriko',
    name: '薩摩切子',
    pref: 'kagoshima',
    rarity: 3,
    icon: '124 174 92 72',
    svg:
      shape('M152 238 C152 234 182 234 182 238 C182 242 152 242 152 238Z', C.white) +
      shape('M163 220 L171 220 L170 236 L164 236Z', C.white) +
      tint('M152 238 C152 234 182 234 182 238 C182 242 152 242 152 238Z M163 220 L171 220 L170 236 L164 236Z', C.blue, 0.2) +
      shape(KIRIKO, C.white) +
      tint(KIRIKO, C.blue, 0.18) +
      `<path d="M142 192 L192 192 C191.6 198 190.6 203 189 207 C176 210 158 210 145 207 C143.4 203 142.4 198 142 192Z" fill="${C.red}"/>` +
      `<path d="M145 207 C158 210 176 210 189 207 C188 211 186 214 184 216 C172 218 162 218 150 216 C148 214 146 211 145 207Z" fill="${C.red}" opacity=".5"/>` +
      `<path d="M150 194 L158 206 L166 194 L174 206 L182 194 L188 202 M146 200 L150 194 M154 206 L162 216 L170 206 L178 216 L184 208" ${line(1, C.white, 0.85)}/>` +
      `<ellipse cx="167" cy="192" rx="25" ry="4.4" fill="${C.red}" ${E}/>` +
      `<ellipse cx="167" cy="192" rx="22" ry="3.2" fill="${C.white}" opacity=".5"/>`,
  }),
  hand({
    // エイサー的パーランクー：小小的單面手鼓，鼓面畫三つ巴
    id: 'okinawa-paranku',
    name: '艾薩手鼓',
    pref: 'okinawa',
    rarity: 2,
    icon: '124 164 92 84',
    svg:
      `<path d="M150 240 L206 176" ${line(3, C.brown)}/>` +
      `<circle cx="176" cy="204" r="24" fill="${C.ink}" ${E}/>` +
      `<path d="M184 184 L190 190 L186 198 L192 206 L186 214 L190 222" ${line(1, C.yellow, 0.7)}/>` +
      `<circle cx="172" cy="202" r="22" fill="${C.cream}" ${E}/>` +
      `<circle cx="172" cy="202" r="21" fill="none" stroke="${C.red}" stroke-width="3"/>` +
      [0, 120, 240].map((a) => `<g transform="rotate(${a} 172 202)">${magatama(172, 196, 0.9, -30, C.ink, false)}</g>`).join(''),
  }),
]

export const GOODS2_OUTFITS: Outfit[] = [...HEAD, ...HAND]
