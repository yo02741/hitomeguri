import type { Outfit } from './outfits'
import { C, dots, E, line, SH, shape, vtext } from './dollArt'
import { bowl, cup, fruit, hachimaki, ICON, plate, skewer } from './outfitsPref'
import { blossom, shade } from './outfitsWa'

/**
 * 各縣的頭上與手上，第二批（使用者回饋 2026-10-12：頭上、手上也各縣多加幾件）：47 縣各頭上 1 件、手上 1 件，共 94 件。
 * 去過那個縣之後加進扭蛋（不是代表單品）。題材取自那個縣實際的名物、祭典（data/festivals）、郷土料理（data/specialties）、
 * 經濟產業大臣指定的傳統工藝品與代表的景點，出處寫在每一件上面。和同縣、不限縣已有的單品不重複。
 * 頭的右側（畫面左邊）放髮飾，左側留給斜戴的面具（DESIGN.md §7.24）。畫法同 outfitsPref.ts。
 */

type Def = Omit<Outfit, 'slot'>
const head = (o: Def): Outfit => ({ ...o, slot: 'head' })
const hand = (o: Def): Outfit => ({ ...o, slot: 'hand' })

/** 髮夾：從頭的右側（畫面左邊）斜斜插進去的金色夾子 */
const PIN = `<path d="M58 84 L102 74" ${line(2.4, C.gold)}/>`
/** 包住頭頂的頭巾、帽子的輪廓（額頭到 y≈84） */
const HOOD = 'M66 84 C62 52 88 36 120 36 C152 36 178 52 174 84 C150 76 90 76 66 84Z'
const HOOD_SHADE = 'M150 42 C164 50 176 64 174 84 C168 82 160 80 152 79 C156 66 156 54 150 42Z'
/** 半透明的疊色（米色、焦色） */
const tint = (d: string, color: string, op: number) => `<path d="${d}" fill="${color}" opacity="${op}"/>`

// ---------- 小零件 ----------
const koboshi = (x: number, y: number, body: string) =>
  shape(`M${x} ${y - 12} C${x - 7} ${y - 12} ${x - 9} ${y - 4} ${x - 9} ${y + 2} C${x - 9} ${y + 10} ${x - 5} ${y + 13} ${x} ${y + 13} C${x + 5} ${y + 13} ${x + 9} ${y + 10} ${x + 9} ${y + 2} C${x + 9} ${y - 4} ${x + 7} ${y - 12} ${x} ${y - 12}Z`, body) +
  `<ellipse cx="${x}" cy="${y - 3}" rx="5.4" ry="5" fill="${C.white}"/>` +
  `<path d="M${x - 5.4} ${y - 4} C${x - 5} ${y - 10} ${x + 5} ${y - 10} ${x + 5.4} ${y - 4} C${x + 3} ${y - 7} ${x - 3} ${y - 7} ${x - 5.4} ${y - 4}Z" fill="${C.ink}"/>` +
  dots(C.ink, 0.9, [
    [x - 2, y - 2.5],
    [x + 2, y - 2.5],
  ]) +
  `<path d="M${x - 1.4} ${y + 0.6} L${x + 1.4} ${y + 0.6}" ${line(1, C.red)}/>`
const burst = (x: number, y: number, r: number, c: string) => {
  const ends: Array<[number, number]> = []
  let rays = ''
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    const [cx, cy] = [Math.cos(a), Math.sin(a)]
    rays += `M${(x + cx * r * 0.35).toFixed(1)} ${(y + cy * r * 0.35).toFixed(1)} L${(x + cx * r).toFixed(1)} ${(y + cy * r).toFixed(1)} `
    ends.push([+(x + cx * r * 1.12).toFixed(1), +(y + cy * r * 1.12).toFixed(1)])
  }
  return `<path d="${rays}" ${line(2, c)}/>` + dots(c, 1.6, ends) + `<circle cx="${x}" cy="${y}" r="2.2" fill="${C.white}"/>`
}
const lantern = (x: number, y: number) =>
  `<path d="M${x} ${y - 14} L${x} ${y - 9}" ${line(1.2, C.gold)}/>` +
  shape(`M${x - 6} ${y - 9} L${x + 6} ${y - 9} L${x + 6} ${y - 7} L${x - 6} ${y - 7}Z`, C.gold) +
  shape(`M${x - 10} ${y} C${x - 10} ${y - 9} ${x + 10} ${y - 9} ${x + 10} ${y} C${x + 10} ${y + 9} ${x - 10} ${y + 9} ${x - 10} ${y}Z`, C.red) +
  `<path d="M${x - 4} ${y - 7} C${x - 6.5} ${y - 2} ${x - 6.5} ${y + 2} ${x - 4} ${y + 7} M${x + 4} ${y - 7} C${x + 6.5} ${y - 2} ${x + 6.5} ${y + 2} ${x + 4} ${y + 7}" ${line(1, C.ink, 0.25)}/>` +
  shape(`M${x - 6} ${y + 7} L${x + 6} ${y + 7} L${x + 6} ${y + 9} L${x - 6} ${y + 9}Z`, C.gold) +
  `<path d="M${x} ${y + 9} L${x} ${y + 18}" ${line(1.6, C.gold)}/>`
/** 心形的葉子（葵、山葵） */
const heartLeaf = (x: number, y: number, r: number, rot: number, fill = C.green) =>
  `<g transform="rotate(${rot} ${x} ${y})">` +
  shape(`M${x} ${y + r} C${x - r * 1.4} ${y} ${x - r} ${y - r * 1.1} ${x} ${y - r * 0.4} C${x + r} ${y - r * 1.1} ${x + r * 1.4} ${y} ${x} ${y + r}Z`, fill) +
  `<path d="M${x} ${y - r * 0.3} L${x} ${y + r * 0.85}" ${line(1, C.matcha, 0.8)}/>` +
  `</g>`
/** 大佛的螺髮：頭頂圓頂裡一顆一顆排滿 */
const CURLS = (() => {
  const pts: Array<[number, number]> = []
  for (let y = 40; y <= 72; y += 8)
    for (let x = 72; x <= 168; x += 9) {
      const xx = x + ((y / 8) % 2 ? 4.5 : 0)
      if (((xx - 120) / 50) ** 2 + ((y - 80) / 46) ** 2 < 1) pts.push([xx, y])
    }
  return pts
})()
const curl = ([x, y]: [number, number]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${C.grey}" ${E}/><path d="M${x - 1.2} ${y} a1.3 1.3 0 1 1 1.3 1.3" ${line(0.8, C.ink, 0.5)}/>`
/** 豆絞り：白頭巾上的藍點 */
const MAME = (() => {
  const pts: Array<[number, number]> = []
  for (let y = 44; y <= 98; y += 9)
    for (let x = 70; x <= 170; x += 9) {
      const xx = x + ((y / 9) % 2 ? 4.5 : 0)
      const inHood = ((xx - 120) / 52) ** 2 + ((y - 92) / 54) ** 2 < 1 && (y <= 82 || Math.abs(xx - 120) > 40)
      if (inHood) pts.push([xx, y])
    }
  return pts
})()

const HEAD: Outfit[] = [
  head({
    // 鄂霍次克海的流冰天使（クリオネ）
    id: 'hokkaido-clione',
    name: '流冰天使髮夾',
    pref: 'hokkaido',
    rarity: 2,
    icon: '46 30 64 64',
    svg:
      `<path d="M64 82 L96 74" ${line(2.6, C.gold)}/>` +
      shape('M69 60 C61 55 57 60 59 65 C61 68 66 67 70 64Z', C.white) +
      shape('M89 58 C97 53 101 58 99 63 C97 66 92 65 88 62Z', C.white) +
      shape('M79 40 C71 40 68 48 70 58 C72 68 75 76 79 82 C83 76 86 68 88 58 C90 48 87 40 79 40Z', C.white) +
      tint('M79 40 C71 40 68 48 70 58 C72 68 75 76 79 82 C83 76 86 68 88 58 C90 48 87 40 79 40Z', C.blue, 0.2) +
      `<path d="M75 50 C77 46 81 46 83 50 C81 54 77 54 75 50Z" fill="${C.orange}"/>` +
      `<path d="M79 59 C76 56 72 59 75 63 L79 67 L83 63 C86 59 82 56 79 59Z" fill="${C.red}"/>` +
      `<path d="M73 46 C74 43 76 42 78 42" ${line(1.6, C.blue, 0.5)}/>`,
  }),
  head({
    // 青森ねぶた祭（data/festivals）：武者的睡魔燈
    id: 'aomori-nebuta',
    name: '睡魔武者燈帽',
    pref: 'aomori',
    rarity: 3,
    icon: '62 -2 116 74',
    svg:
      shape('M74 64 C70 36 88 10 120 8 C152 10 170 36 166 64 C150 70 90 70 74 64Z', C.white) +
      `<path d="M74 64 C70 36 88 10 120 8 C152 10 170 36 166 64" ${line(1.6, C.gold, 0.9)}/>` +
      shape('M92 16 C104 4 136 4 148 16 C136 13 104 13 92 16Z', C.ink) +
      `<path d="M84 22 C80 30 80 42 84 50 M156 22 C160 30 160 42 156 50" ${line(2, C.blue)}/>` +
      `<path d="M88 30 C96 24 104 26 112 32 M152 30 C144 24 136 26 128 32" ${line(4, C.ink)}/>` +
      `<ellipse cx="102" cy="40" rx="7" ry="5" fill="${C.yellow}" ${E}/><circle cx="103" cy="40" r="2.6" fill="${C.ink}"/>` +
      `<ellipse cx="138" cy="40" rx="7" ry="5" fill="${C.yellow}" ${E}/><circle cx="137" cy="40" r="2.6" fill="${C.ink}"/>` +
      `<path d="M86 46 C92 52 98 50 102 55 M154 46 C148 52 142 50 138 55" ${line(2.4, C.red)}/>` +
      `<path d="M120 34 L117 47 L123 47" ${line(2, C.ink, 0.6)}/>` +
      shape('M106 55 C112 61 128 61 134 55 C128 53 112 53 106 55Z', C.red) +
      `<path d="M110 56 L130 56" ${line(1.2, C.white)}/>`,
  }),
  head({
    // 平泉中尊寺金色堂（世界遺產）
    id: 'iwate-konjikido',
    name: '中尊寺金色堂帽',
    pref: 'iwate',
    rarity: 3,
    icon: '62 -8 116 78',
    svg:
      shape('M76 66 L82 56 L158 56 L164 66Z', C.grey) +
      shape('M88 56 L88 36 L152 36 L152 56Z', C.yellow) +
      `<path d="M100 36 L100 56 M140 36 L140 56" ${line(1.6, C.gold)}/>` +
      shape('M108 56 L108 42 L132 42 L132 56Z', C.gold) +
      `<path d="M120 42 L120 56" ${line(1, C.brown, 0.5)}/>` +
      shape('M68 40 C88 32 152 32 172 40 L146 18 L94 18Z', C.gold) +
      `<path d="M146 18 L172 40 C164 37 156 35 150 35Z" ${SH}/>` +
      `<path d="M68 40 C88 32 152 32 172 40" ${line(1.4, C.white, 0.7)}/>` +
      shape('M94 18 L120 6 L146 18Z', C.gold) +
      `<circle cx="120" cy="2" r="4" fill="${C.gold}" ${E}/>`,
  }),
  head({
    // 仙台七夕まつり：くす玉と吹き流し
    id: 'miyagi-tanabata',
    name: '仙台七夕吹流',
    pref: 'miyagi',
    rarity: 2,
    icon: '52 30 60 92',
    svg:
      [C.pink, C.yellow, C.blue, C.green, C.purple, C.red, C.orange]
        .map((c, i) => shape(`M${66 + i * 4} 62 L${69.6 + i * 4} 62 L${68.2 + i * 4.6} ${108 + (i % 3) * 6} L${64.6 + i * 4.6} ${108 + (i % 3) * 6}Z`, c))
        .join('') +
      `<path d="M80 42 L80 34" ${line(1.6, C.gold)}/>` +
      `<circle cx="80" cy="54" r="12" fill="${C.pink}" ${E}/>` +
      dots(C.white, 1.6, [
        [74, 48],
        [82, 46],
        [87, 54],
        [78, 59],
        [72, 55],
        [84, 61],
        [80, 52],
      ]) +
      `<path d="M66 40 L96 34" ${line(2.4, C.gold)}/>`,
  }),
  head({
    // 秋田竿燈まつり：一根竹竿掛滿提燈，頂在額頭上
    id: 'akita-kanto',
    name: '竿燈帽',
    pref: 'akita',
    rarity: 3,
    icon: '74 -8 92 66',
    svg:
      `<path d="M120 52 L120 -4" ${line(2.6, C.brown)}/>` +
      `<path d="M120 -4 L115 1 L120 3 L115 8" ${line(1.4, C.white)}/>` +
      `<path d="M88 4 L152 4 M84 18 L156 18 M80 32 L160 32" ${line(1.6, C.brown)}/>` +
      (
        [
          [4, 88, 152],
          [18, 84, 156],
          [32, 80, 160],
        ] as const
      )
        .map(([y, x0, x1]) => {
          let s = ''
          for (let x = x0 + 5; x <= x1 - 4; x += 10)
            s += `<rect x="${x - 3.6}" y="${y + 1}" width="7.2" height="9" rx="3" fill="${C.yellow}" ${E}/><path d="M${x - 3} ${y + 5.5} L${x + 3} ${y + 5.5}" ${line(1.2, C.red, 0.7)}/>`
          return s
        })
        .join('') +
      shape('M106 52 C110 46 130 46 134 52 C130 56 110 56 106 52Z', C.white),
  }),
  head({
    // 藏王的樹冰
    id: 'yamagata-juhyo',
    name: '藏王樹冰帽',
    pref: 'yamagata',
    rarity: 2,
    icon: '62 8 116 66',
    svg:
      shape('M80 66 C68 54 76 42 86 44 C84 30 96 22 106 28 C108 14 132 14 134 28 C144 22 156 30 154 44 C164 42 172 54 160 66 C140 72 100 72 80 66Z', C.white) +
      `<path d="M140 30 C150 34 156 44 154 54 C160 56 162 62 158 66 C150 68 144 68 138 68 C148 60 150 44 140 30Z" fill="${C.blue}" opacity=".22"/>` +
      `<path d="M96 52 L100 58 M118 44 L114 52 M136 50 L132 58 M108 34 L104 40" ${line(2.2, C.green, 0.7)}/>` +
      dots(
        C.blue,
        1.4,
        [
          [92, 40],
          [128, 24],
          [150, 48],
          [112, 60],
        ],
        'opacity=".35"',
      ),
  }),
  head({
    // 會津的起上小法師（起き上がり小法師）
    id: 'fukushima-okiagari',
    name: '起上小法師髮夾',
    pref: 'fukushima',
    rarity: 1,
    icon: '56 40 56 50',
    svg: `<path d="M62 80 L106 68" ${line(2.6, C.gold)}/>` + koboshi(74, 62, C.red) + koboshi(95, 58, C.navy),
  }),
  head({
    // 水戸黄門まつり（data/festivals）：黃門大人的宗匠頭巾
    id: 'ibaraki-sosho',
    name: '黃門宗匠頭巾',
    pref: 'ibaraki',
    rarity: 2,
    icon: '64 24 112 62',
    svg:
      shape('M72 78 L76 42 C92 32 148 32 164 42 L168 78 C148 72 92 72 72 78Z', C.brown) +
      shade('M150 36 C158 38 162 40 164 42 L168 78 C162 76 156 75 150 74Z') +
      shape('M76 42 C92 50 148 50 164 42 C148 36 92 36 76 42Z', C.brown) +
      `<path d="M76 42 C92 50 148 50 164 42 C148 36 92 36 76 42Z" ${SH}/>` +
      `<path d="M74 70 C94 64 146 64 166 70" ${line(1.4, C.ink, 0.25)}/>` +
      `<circle cx="120" cy="60" r="5" fill="${C.gold}" ${E}/><path d="M120 56 L120 64 M116.5 58 L123.5 62 M123.5 58 L116.5 62" ${line(1, C.brown)}/>`,
  }),
  head({
    // 日光東照宮的眠貓
    id: 'tochigi-nemurineko',
    name: '日光眠貓髮夾',
    pref: 'tochigi',
    rarity: 2,
    icon: '46 40 66 48',
    svg:
      `<path d="M54 80 L106 72" ${line(2.4, C.gold)}/>` +
      `<ellipse cx="98" cy="74" rx="4" ry="2.2" fill="${C.green}" transform="rotate(-30 98 74)"/>` +
      `<circle cx="94" cy="68" r="7" fill="${C.pink}" ${E}/><circle cx="94" cy="68" r="3.4" fill="${C.red}" opacity=".55"/>` +
      `<path d="M96 66 C102 62 102 56 98 54" ${line(3, C.white)}/>` +
      shape('M64 72 C62 62 72 56 84 58 C94 60 98 66 96 72 C90 76 70 76 64 72Z', C.white) +
      shape('M56 57 L55 50 L60 54Z', C.white) +
      shape('M64 54 L68 49 L68 56Z', C.white) +
      `<circle cx="62" cy="62" r="8" fill="${C.white}" ${E}/>` +
      `<path d="M57 62 Q59 64 61 62 M64 62 Q66 64 68 62" ${line(1.1, C.ink)}/>` +
      `<path d="M62 66 L62 67" ${line(1.2, C.pink)}/>`,
  }),
  head({
    // 尾瀨的水芭蕉
    id: 'gunma-mizubasho',
    name: '尾瀨水芭蕉髮飾',
    pref: 'gunma',
    rarity: 1,
    icon: '52 32 60 62',
    svg:
      `<path d="M58 86 L102 74" ${line(2.4, C.gold)}/>` +
      shape('M66 80 C60 70 60 58 66 50 C70 62 72 72 70 82Z', C.green) +
      shape('M96 78 C102 68 102 56 96 48 C92 60 90 70 92 80Z', C.green) +
      shape('M80 36 C70 44 68 62 80 76 C92 62 90 44 80 36Z', C.white) +
      `<path d="M84 40 C90 48 90 62 80 76 C86 62 88 50 84 40Z" ${SH}/>` +
      `<ellipse cx="80" cy="62" rx="3.6" ry="7" fill="${C.matcha}"/>` +
      dots(C.yellow, 0.9, [
        [79, 58],
        [81, 62],
        [79, 66],
      ]),
  }),
  head({
    // 川越的時之鐘
    id: 'saitama-tokinokane',
    name: '川越時之鐘帽',
    pref: 'saitama',
    rarity: 2,
    icon: '82 -4 76 76',
    svg:
      shape('M98 66 L102 46 L138 46 L142 66Z', C.brown) +
      `<path d="M108 48 L108 64 M120 48 L120 64 M132 48 L132 64" ${line(1.2, C.ink, 0.35)}/>` +
      shape('M88 48 C104 43 136 43 152 48 L138 38 L102 38Z', C.ink) +
      shape('M106 38 L106 26 L134 26 L134 38Z', C.brown) +
      shape('M96 28 C108 24 132 24 144 28 L132 18 L108 18Z', C.ink) +
      shape('M110 18 L110 8 L130 8 L130 18Z', C.brown) +
      `<path d="M115 9 C115 16 125 16 125 9Z" fill="${C.gold}" ${E}/>` +
      shape('M102 10 C112 6 128 6 138 10 L120 0Z', C.ink) +
      `<path d="M88 48 C104 43 136 43 152 48 M96 28 C108 24 132 24 144 28 M102 10 C112 6 128 6 138 10" ${line(1.2, C.white, 0.35)}/>`,
  }),
  head({
    // 勝浦大漁まつり（data/festivals）：大漁旗染的頭巾
    id: 'chiba-tairyo',
    name: '大漁旗頭巾',
    pref: 'chiba',
    rarity: 1,
    icon: '56 28 132 64',
    svg:
      shape('M170 70 L184 62 L186 70 L176 76Z', C.white) +
      shape('M172 76 L184 86 L178 90 L170 80Z', C.white) +
      shape(HOOD, C.white) +
      shape('M66 84 C64 76 66 70 68 64 C90 58 150 58 172 64 C174 70 176 76 174 84 C150 76 90 76 66 84Z', C.blue) +
      `<path d="M70 72 C80 66 90 70 98 66 C108 62 118 70 128 66 C138 62 150 70 168 66" ${line(1.6, C.white)}/>` +
      `<path d="M98 40 L98 34 M108 42 L112 37 M88 42 L84 37 M112 50 L118 48 M84 50 L78 48" ${line(2, C.red)}/>` +
      `<circle cx="98" cy="50" r="7" fill="${C.red}"/>` +
      `<text x="136" y="56" font-size="13" font-weight="900" fill="${C.red}" text-anchor="middle" font-family="var(--font-ja)">大漁</text>` +
      shade(HOOD_SHADE),
  }),
  head({
    // 東京鐵塔（景點）
    id: 'tokyo-tower',
    name: '東京鐵塔帽',
    pref: 'tokyo',
    rarity: 2,
    icon: '86 -14 68 88',
    svg:
      shape('M94 70 L106 46 L134 46 L146 70 L138 70 C134 60 106 60 102 70Z', C.red) +
      `<path d="M104 52 L136 66 M136 52 L104 66" ${line(1, C.white, 0.55)}/>` +
      shape('M100 40 L140 40 L140 47 L100 47Z', C.white) +
      `<path d="M104 43.5 L136 43.5" ${line(1.6, C.ink, 0.35)}/>` +
      shape('M107 40 L114 6 L126 6 L133 40Z', C.red) +
      `<path d="M111 30 L129 38 M129 30 L111 38 M112 10 L128 20 M128 10 L112 20" ${line(1, C.white, 0.55)}/>` +
      shape('M110 23 L130 23 L131 28 L109 28Z', C.white) +
      shape('M112 13 L128 13 L128 17 L112 17Z', C.white) +
      `<path d="M120 6 L120 -12" ${line(2, C.red)}/>` +
      `<path d="M120 -2 L120 -8" ${line(2, C.white)}/>`,
  }),
  head({
    // 鎌倉明月院的紫陽花
    id: 'kanagawa-ajisai',
    name: '明月院紫陽花髮飾',
    pref: 'kanagawa',
    rarity: 1,
    icon: '50 36 62 56',
    svg:
      PIN +
      shape('M60 76 C54 68 58 60 66 62 C68 68 66 74 60 76Z', C.green) +
      shape('M100 72 C108 66 106 58 98 58 C96 64 96 70 100 72Z', C.green) +
      `<circle cx="80" cy="60" r="16" fill="${C.blue}" ${E}/>` +
      (
        [
          [72, 52, C.purple],
          [83, 48, C.white],
          [91, 57, C.purple],
          [87, 68, C.white],
          [76, 69, C.purple],
          [69, 61, C.white],
          [80, 59, C.purple],
        ] as const
      )
        .map(
          ([x, y, c]) =>
            `<g fill="${c}" opacity=".85"><circle cx="${x - 2.4}" cy="${y}" r="2.4"/><circle cx="${x + 2.4}" cy="${y}" r="2.4"/><circle cx="${x}" cy="${y - 2.4}" r="2.4"/><circle cx="${x}" cy="${y + 2.4}" r="2.4"/></g><circle cx="${x}" cy="${y}" r="1" fill="${C.yellow}"/>`,
        )
        .join(''),
  }),
  head({
    // 長岡まつり大花火大会：日本三大煙火之一
    id: 'niigata-hanabi',
    name: '長岡煙火髮飾',
    pref: 'niigata',
    rarity: 2,
    icon: '46 26 72 70',
    svg: PIN + burst(76, 54, 18, C.red) + burst(98, 42, 11, C.yellow) + burst(64, 76, 9, C.blue),
  }),
  head({
    // おわら風の盆（data/festivals）：壓得很低的編笠
    id: 'toyama-owaragasa',
    name: '風之盆編笠',
    pref: 'toyama',
    rarity: 2,
    icon: '58 26 124 96',
    svg:
      `<path d="M70 90 C76 104 82 112 90 118 M170 90 C164 104 158 112 150 118" ${line(1.6, C.red)}/>` +
      shape('M66 92 C64 58 88 32 120 32 C152 32 176 58 174 92 C164 82 146 76 120 76 C94 76 76 82 66 92Z', C.yellow) +
      tint('M66 92 C64 58 88 32 120 32 C152 32 176 58 174 92 C164 82 146 76 120 76 C94 76 76 82 66 92Z', C.brown, 0.28) +
      `<path d="M76 70 C90 46 150 46 164 70 M70 82 C88 62 152 62 170 82 M90 42 C104 52 136 52 150 42" ${line(1, C.brown, 0.5)}/>` +
      `<path d="M120 32 L120 76" ${line(1.4, C.brown, 0.6)}/>` +
      shade('M150 40 C166 52 176 70 174 92 C168 86 160 81 152 79 C158 64 156 52 150 40Z'),
  }),
  head({
    // 加賀水引（金澤）：梅結
    id: 'ishikawa-mizuhiki',
    name: '加賀水引髮飾',
    pref: 'ishikawa',
    rarity: 2,
    icon: '50 34 60 62',
    svg:
      PIN +
      `<path d="M76 66 L66 90 M82 66 L76 92" ${line(2.6, C.red)}/>` +
      `<path d="M76 66 L66 90 M82 66 L76 92" ${line(1, C.gold)}/>` +
      [0, 72, 144, 216, 288]
        .map((a) => `<ellipse cx="80" cy="50" rx="5" ry="9" transform="rotate(${a} 80 59)" fill="none" stroke="${C.red}" stroke-width="4.4"/>`)
        .join('') +
      [0, 72, 144, 216, 288].map((a) => `<ellipse cx="80" cy="50" rx="5" ry="9" transform="rotate(${a} 80 59)" fill="none" stroke="${C.gold}" stroke-width="1.4"/>`).join('') +
      `<circle cx="80" cy="59" r="3.4" fill="${C.white}" ${E}/>`,
  }),
  head({
    // 福井縣立恐龍博物館：恐龍的頭套
    id: 'fukui-dinohood',
    name: '恐龍帽',
    pref: 'fukui',
    rarity: 2,
    icon: '58 12 124 76',
    svg:
      (
        [
          [84, 42],
          [100, 32],
          [120, 28],
          [140, 32],
          [156, 42],
        ] as const
      )
        .map(([x, y]) => shape(`M${x - 7} ${y + 8} L${x} ${y - 8} L${x + 7} ${y + 8}Z`, C.orange))
        .join('') +
      shape(HOOD, C.green) +
      shade(HOOD_SHADE) +
      dots(
        C.matcha,
        3,
        [
          [92, 64],
          [150, 62],
          [122, 50],
        ],
        'opacity=".6"',
      ) +
      `<circle cx="100" cy="50" r="7" fill="${C.white}" ${E}/><circle cx="102" cy="50" r="3.2" fill="${C.ink}"/>` +
      `<circle cx="140" cy="50" r="7" fill="${C.white}" ${E}/><circle cx="138" cy="50" r="3.2" fill="${C.ink}"/>` +
      shape('M74 79 L78 86 L82 78 L86 85 L90 77 L94 84 L98 77 L102 84 L106 77 L110 84 L114 77 L118 84 L122 77 L126 84 L130 77 L134 84 L138 77 L142 84 L146 77 L150 84 L154 78 L158 85 L162 78 L166 86 L168 80Z', C.white),
  }),
  head({
    // 笛吹的桃源郷：滿山的桃花
    id: 'yamanashi-momo',
    name: '桃花冠',
    pref: 'yamanashi',
    rarity: 1,
    icon: '58 46 124 46',
    svg:
      `<path d="M66 84 C80 66 160 66 174 84" ${line(4, C.brown)}/>` +
      (
        [
          [82, 74, -30],
          [120, 64, 0],
          [158, 74, 30],
        ] as const
      )
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.4" fill="${C.green}" transform="rotate(${r} ${x} ${y})"/>`)
        .join('') +
      blossom(74, 78, 6, C.pink) +
      blossom(92, 68, 7, C.pink) +
      blossom(110, 63, 6.5, C.pink) +
      blossom(130, 63, 6.5, C.pink) +
      blossom(148, 68, 7, C.pink) +
      blossom(166, 78, 6, C.pink),
  }),
  head({
    // 諏訪大社御柱祭：從山上拖下來的大木
    id: 'nagano-onbashira',
    name: '御柱帽',
    pref: 'nagano',
    rarity: 3,
    icon: '50 28 136 48',
    svg:
      shape('M106 56 C110 50 130 50 134 56 C130 60 110 60 106 56Z', C.white) +
      shape('M70 50 L170 40 L172 56 L72 66Z', C.brown) +
      `<path d="M80 55 L160 47 M84 61 L164 53" ${line(1, C.ink, 0.25)}/>` +
      shape('M70 50 L58 59 L72 66Z', C.brown) +
      `<ellipse cx="171" cy="48" rx="4" ry="8" fill="${C.cream}" ${E}/><ellipse cx="171" cy="48" rx="2" ry="4" fill="none" stroke="${C.brown}" stroke-opacity=".5"/>` +
      [96, 122, 148].map((x) => `<path d="M${x} ${48 - (x - 70) * 0.1} L${x + 1} ${64 - (x - 70) * 0.1}" ${line(3.4, C.red)}/>`).join('') +
      [96, 122, 148]
        .map((x) => `<path d="M${x} ${48 - (x - 70) * 0.1} L${x + 1} ${64 - (x - 70) * 0.1}" fill="none" stroke="${C.white}" stroke-width="3.4" stroke-dasharray="2 2"/>`)
        .join(''),
  }),
  head({
    // 白川鄉的合掌造（世界遺產）
    id: 'gifu-gassho',
    name: '白川鄉合掌屋帽',
    pref: 'gifu',
    rarity: 2,
    icon: '64 0 112 80',
    svg:
      shape('M70 74 L120 6 L170 74Z', C.yellow) +
      tint('M70 74 L120 6 L170 74Z', C.brown, 0.35) +
      `<path d="M120 6 L170 74 L140 74Z" ${SH}/>` +
      `<path d="M78 70 L120 14 M88 72 L120 28 M162 70 L120 14 M152 72 L120 28" ${line(1, C.brown, 0.5)}/>` +
      shape('M100 74 L120 46 L140 74Z', C.brown) +
      `<rect x="112" y="58" width="16" height="10" fill="${C.cream}"/><path d="M120 58 L120 68 M112 63 L128 63" ${line(0.8, C.brown)}/>` +
      `<rect x="116" y="50" width="8" height="5" fill="${C.cream}"/>` +
      `<path d="M74 70 L120 8 L166 70" ${line(3.4, C.white, 0.85)}/>`,
  }),
  head({
    // 浜松まつり（data/festivals）的凧揚げ合戦
    id: 'shizuoka-tako',
    name: '濱松風箏髮飾',
    pref: 'shizuoka',
    rarity: 1,
    icon: '46 30 64 82',
    svg:
      `<path d="M66 76 C62 88 70 96 64 108" ${line(1.4, C.ink, 0.6)}/>` +
      PIN +
      `<g transform="rotate(-12 76 56)">` +
      shape('M60 38 L92 38 L92 74 L60 74Z', C.white) +
      `<path d="M60 38 L92 74 M92 38 L60 74" ${line(0.8, C.brown, 0.4)}/>` +
      `<path d="M60 38 L92 38 L92 74 L60 74Z" fill="none" stroke="${C.red}" stroke-width="3"/>` +
      `<circle cx="76" cy="56" r="9" fill="${C.red}"/><circle cx="76" cy="56" r="5" fill="${C.white}"/>` +
      `<path d="M76 51 L76 61 M71 56 L81 56" ${line(1.6, C.red)}/>` +
      `</g>`,
  }),
  head({
    // 有松・鳴海絞（data/specialties）的頭帶
    id: 'aichi-shibori',
    name: '有松絞頭帶',
    pref: 'aichi',
    rarity: 1,
    icon: '56 64 140 46',
    svg: hachimaki(C.navy, `<path d="M64 84 C82 72 158 72 176 84 L176 94 C158 82 82 82 64 94Z" fill="url(#doll-shibori)"/>`),
  }),
  head({
    // 志摩的海女：頭巾上畫著護身的セーマン（星）與ドーマン（格子）
    id: 'mie-sema',
    name: '海女磯頭巾',
    pref: 'mie',
    rarity: 2,
    icon: '56 30 132 64',
    svg:
      shape('M170 70 L184 62 L186 70 L176 76Z', C.white) +
      shape('M172 76 L184 86 L178 90 L170 80Z', C.white) +
      shape(HOOD, C.white) +
      shade(HOOD_SHADE) +
      `<path d="M106 48 L112 66 L96 55 L116 55 L100 66Z" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M126 50 L146 50 M126 56 L146 56 M126 62 L146 62 M128 48 L128 64 M134 48 L134 64 M140 48 L140 64 M144 48 L144 64" ${line(1.4, C.ink)}/>`,
  }),
  head({
    // 甲賀流忍術屋敷（甲賀忍者裝已有）：忍者的頭巾
    id: 'shiga-zukin',
    name: '甲賀忍者頭巾',
    pref: 'shiga',
    rarity: 2,
    icon: '56 28 140 70',
    svg:
      shape('M172 74 L190 66 L192 76 L178 82Z', C.navy) +
      shape('M174 82 L188 94 L182 98 L172 88Z', C.navy) +
      shape('M64 94 C60 52 86 34 120 34 C154 34 180 52 176 94 C170 86 160 82 120 82 C80 82 70 86 64 94Z', C.navy) +
      shade('M150 40 C166 50 178 68 176 94 C170 88 162 84 154 83 C158 68 156 54 150 40Z') +
      `<path d="M66 88 C80 80 160 80 174 88" ${line(1.4, C.ink, 0.4)}/>` +
      `<circle cx="174" cy="78" r="5" fill="${C.navy}" ${E}/>`,
  }),
  head({
    // 葵祭（京都三大祭）：葵與桂的髮飾
    id: 'kyoto-aoi',
    name: '葵祭葵葉髮飾',
    pref: 'kyoto',
    rarity: 2,
    icon: '50 32 62 62',
    svg:
      PIN +
      `<path d="M80 80 C80 66 76 56 70 50 M80 80 C84 66 92 58 98 54" ${line(1.6, C.green)}/>` +
      `<path d="M80 80 L66 66" ${line(1.4, C.brown)}/>` +
      dots(C.matcha, 2.8, [
        [70, 70],
        [66, 64],
        [75, 66],
      ]) +
      heartLeaf(70, 46, 9, -20) +
      heartLeaf(98, 50, 9, 20),
  }),
  head({
    // 通天閣（景點）
    id: 'osaka-tsutenkaku',
    name: '通天閣帽',
    pref: 'osaka',
    rarity: 2,
    icon: '86 -10 68 84',
    svg:
      shape('M94 72 L104 50 L136 50 L146 72 L138 72 C134 62 106 62 102 72Z', C.grey) +
      `<path d="M104 56 L136 70 M136 56 L104 70" ${line(1, C.white, 0.5)}/>` +
      shape('M108 50 L111 20 L129 20 L132 50Z', C.grey) +
      `<path d="M110 30 L130 30 M109.5 40 L130.5 40" ${line(2, C.yellow, 0.9)}/>` +
      shape('M104 12 L136 12 L136 21 L104 21Z', C.white) +
      `<path d="M108 16.5 L132 16.5" ${line(2, C.ink, 0.35)}/>` +
      shape('M108 12 C108 0 132 0 132 12Z', C.gold) +
      `<path d="M120 0 L120 -8" ${line(2, C.grey)}/>`,
  }),
  head({
    // 淡路島的洋蔥
    id: 'hyogo-tamanegi',
    name: '淡路島洋蔥帽',
    pref: 'hyogo',
    rarity: 1,
    icon: '62 -6 116 84',
    svg:
      shape('M72 74 C66 46 92 26 120 22 C148 26 174 46 168 74 C150 68 90 68 72 74Z', C.yellow) +
      tint('M72 74 C66 46 92 26 120 22 C148 26 174 46 168 74 C150 68 90 68 72 74Z', C.orange, 0.35) +
      `<path d="M92 70 C88 50 100 34 118 24 M148 70 C152 50 140 34 122 24 M120 24 L120 70" ${line(1.2, C.brown, 0.45)}/>` +
      shade('M140 28 C158 36 172 54 168 74 C162 72 156 71 150 70 C154 54 150 40 140 28Z') +
      shape('M118 24 C114 14 112 6 114 -2 C118 6 120 14 122 22Z', C.green) +
      shape('M122 24 C126 14 130 8 134 2 C132 12 128 18 124 24Z', C.green),
  }),
  head({
    // 東大寺的大佛：螺髮與肉髻
    id: 'nara-rahotsu',
    name: '大佛螺髮帽',
    pref: 'nara',
    rarity: 2,
    icon: '60 10 120 74',
    svg:
      shape('M66 80 C62 46 88 32 120 32 C152 32 178 46 174 80 C150 72 90 72 66 80Z', C.grey) +
      shape('M104 34 C104 20 136 20 136 34 C128 38 112 38 104 34Z', C.grey) +
      CURLS.map(curl).join('') +
      (
        [
          [112, 28],
          [120, 25],
          [128, 28],
        ] as Array<[number, number]>
      )
        .map(curl)
        .join('') +
      shade(HOOD_SHADE.replace('M150 42', 'M150 44')),
  }),
  head({
    // 熊野古道（壺裝束已有）：市女笠與虫垂衣
    id: 'wakayama-ichimegasa',
    name: '熊野市女笠',
    pref: 'wakayama',
    rarity: 3,
    icon: '40 30 160 116',
    svg:
      `<path d="M56 76 L52 140 L66 142 L69 80Z" fill="${C.white}" opacity=".78" ${E}/>` +
      `<path d="M184 76 L188 140 L174 142 L171 80Z" fill="${C.white}" opacity=".78" ${E}/>` +
      `<path d="M60 96 L58 136 M180 96 L182 136" ${line(1, C.ink, 0.15)}/>` +
      shape('M48 76 C60 66 92 58 120 58 C148 58 180 66 192 76 C176 84 64 84 48 76Z', C.ink) +
      shape('M98 62 C100 46 108 38 120 36 C132 38 140 46 142 62 C132 65 108 65 98 62Z', C.ink) +
      `<path d="M64 72 C84 66 106 64 120 64 M106 50 C108 44 112 41 116 40" ${line(1.6, C.white, 0.25)}/>` +
      `<path d="M98 62 C100 70 104 74 108 77 M142 62 C140 70 136 74 132 77" ${line(1.6, C.red)}/>`,
  }),
  head({
    // 鳥取東部的麒麟獅子舞（日本遺產）：一隻角的獅子頭
    id: 'tottori-kirin',
    name: '麒麟獅子頭',
    pref: 'tottori',
    rarity: 3,
    icon: '80 -8 80 74',
    svg:
      shape('M116 16 L120 -4 L124 16Z', C.gold) +
      shape('M92 64 C88 42 100 26 120 24 C140 26 152 42 148 64 C140 68 100 68 92 64Z', C.red) +
      shape('M90 42 C92 24 106 14 120 14 C134 14 148 24 150 42 C140 32 100 32 90 42Z', C.green) +
      dots(C.gold, 1.6, [
        [100, 26],
        [110, 20],
        [130, 20],
        [140, 26],
        [120, 18],
      ]) +
      `<path d="M100 36 C104 33 110 33 113 36 M127 36 C130 33 136 33 140 36" ${line(2, C.gold)}/>` +
      `<circle cx="107" cy="44" r="6" fill="${C.gold}" ${E}/><circle cx="107" cy="44" r="2.8" fill="${C.ink}"/>` +
      `<circle cx="133" cy="44" r="6" fill="${C.gold}" ${E}/><circle cx="133" cy="44" r="2.8" fill="${C.ink}"/>` +
      `<ellipse cx="120" cy="52" rx="6" ry="4" fill="${C.ink}" opacity=".7"/>` +
      shape('M104 59 C112 65 128 65 136 59 L132 63 C124 67 116 67 108 63Z', C.white),
  }),
  head({
    // 安來節的泥鰍舞（どじょうすくい）：豆絞的頰被，在鼻子下面打結
    id: 'shimane-hokkamuri',
    name: '泥鰍舞頰被',
    pref: 'shimane',
    rarity: 2,
    icon: '58 30 124 106',
    svg:
      shape('M66 104 C60 58 86 36 120 36 C154 36 180 58 174 104 C166 94 156 88 146 86 C130 84 110 84 94 86 C84 88 74 94 66 104Z', C.white) +
      dots(C.blue, 1.8, MAME) +
      shade('M150 42 C166 52 180 74 174 104 C168 96 160 90 152 87 C158 70 158 54 150 42Z') +
      `<path d="M70 102 C78 116 96 124 113 126 M170 102 C162 116 144 124 127 126" ${line(6, C.white)}/>` +
      `<path d="M70 102 C78 116 96 124 113 126 M170 102 C162 116 144 124 127 126" fill="none" stroke="${C.blue}" stroke-width="1.8" stroke-dasharray="0.1 8" stroke-linecap="round"/>` +
      shape('M113 124 L103 117 L105 131Z', C.white) +
      shape('M127 124 L137 117 L135 131Z', C.white) +
      `<ellipse cx="120" cy="126" rx="7" ry="5" fill="${C.white}" ${E}/>`,
  }),
  head({
    // 兒島（倉敷）是國產牛仔褲的發源地
    id: 'okayama-denim',
    name: '兒島丹寧帽',
    pref: 'okayama',
    rarity: 1,
    icon: '66 26 108 70',
    svg:
      shape('M72 80 C70 48 92 32 120 32 C148 32 170 48 168 80Z', C.navy) +
      `<path d="M72 80 C70 48 92 32 120 32 C112 40 100 56 98 80Z" fill="${C.blue}" opacity=".35"/>` +
      `<path d="M120 33 L120 80 M120 33 C104 42 96 60 96 80 M120 33 C136 42 144 60 144 80" fill="none" stroke="${C.orange}" stroke-width="1.2" stroke-dasharray="2 2"/>` +
      `<circle cx="120" cy="33" r="3" fill="${C.navy}" ${E}/>` +
      shape('M78 78 C94 72 146 72 162 78 C152 92 88 92 78 78Z', C.navy) +
      `<path d="M84 81 C98 76 142 76 156 81" fill="none" stroke="${C.orange}" stroke-width="1.2" stroke-dasharray="2 2"/>` +
      shape('M112 56 L128 56 L128 66 L112 66Z', C.brown),
  }),
  head({
    // 嚴島神社的大鳥居（世界遺產），立在海上
    id: 'hiroshima-torii',
    name: '嚴島鳥居帽',
    pref: 'hiroshima',
    rarity: 3,
    icon: '76 6 88 72',
    svg:
      shape('M86 68 C100 62 140 62 154 68 C140 74 100 74 86 68Z', C.blue) +
      `<path d="M92 68 C100 65 108 69 116 66 C124 69 132 65 140 68 C144 66 148 67 150 68" ${line(1.2, C.white)}/>` +
      shape('M98 66 L100 26 L106 26 L106 66Z', C.red) +
      shape('M134 66 L134 26 L140 26 L142 66Z', C.red) +
      shape('M90 36 L150 36 L150 41 L90 41Z', C.red) +
      shape('M88 26 L152 26 L152 30 L88 30Z', C.red) +
      shape('M117 30 L123 30 L123 36 L117 36Z', C.gold) +
      shape('M84 24 C100 28 140 28 156 24 L158 17 C140 21 100 21 82 17Z', C.ink),
  }),
  head({
    // 先帝祭（data/festivals）：上臈的簪，前插後插好幾支
    id: 'yamaguchi-kogai',
    name: '上臈花簪',
    pref: 'yamaguchi',
    rarity: 3,
    icon: '54 14 132 56',
    svg:
      `<path d="M110 52 L64 34 M110 56 L60 50 M112 48 L72 22 M130 52 L176 34 M130 56 L180 50 M128 48 L168 22" ${line(2.6, C.brown)}/>` +
      `<path d="M110 52 L64 34 M110 56 L60 50 M112 48 L72 22 M130 52 L176 34 M130 56 L180 50 M128 48 L168 22" ${line(1, C.orange, 0.5)}/>` +
      `<path d="M64 34 L64 46 M60 50 L60 62 M176 34 L176 46 M180 50 L180 62" ${line(1, C.gold)}/>` +
      dots(C.gold, 2.4, [
        [64, 34],
        [60, 50],
        [72, 22],
        [176, 34],
        [180, 50],
        [168, 22],
        [64, 47],
        [60, 63],
        [176, 47],
        [180, 63],
      ]) +
      shape('M94 54 C98 42 142 42 146 54 L146 58 L94 58Z', C.brown) +
      `<path d="M100 50 C110 46 130 46 140 50" ${line(1.4, C.gold)}/>` +
      `<circle cx="120" cy="44" r="5" fill="${C.red}" ${E}/>`,
  }),
  head({
    // 鳴門的漩渦
    id: 'tokushima-uzushio',
    name: '鳴門渦潮帽',
    pref: 'tokushima',
    rarity: 2,
    icon: '58 26 124 62',
    svg:
      shape('M66 80 C62 50 88 32 120 32 C152 32 178 50 174 80 C150 72 90 72 66 80Z', C.blue) +
      shade(HOOD_SHADE) +
      `<path d="M120 52 C126 52 128 58 122 60 C112 62 108 52 116 46 C128 38 144 48 140 60 C136 72 104 72 98 58 C92 44 106 34 124 36" ${line(2.4, C.white)}/>` +
      dots(C.white, 1.6, [
        [84, 64],
        [90, 56],
        [150, 58],
        [156, 66],
        [100, 44],
        [142, 44],
      ]) +
      `<path d="M68 78 C74 72 80 72 86 76 C92 72 98 72 104 75 C110 71 130 71 136 75 C142 72 148 72 154 76 C160 72 166 72 172 78" ${line(2, C.white)}/>`,
  }),
  head({
    // 高松的盆栽（鬼無、國分寺是松樹盆栽的產地）
    id: 'kagawa-bonsai',
    name: '松盆栽帽',
    pref: 'kagawa',
    rarity: 2,
    icon: '72 -8 96 66',
    svg:
      shape('M90 56 L94 44 L146 44 L150 56Z', C.blue) +
      shape('M88 44 L152 44 L152 40 L88 40Z', C.navy) +
      shape('M92 40 C104 36 136 36 148 40Z', C.green) +
      `<path d="M116 40 C110 32 118 24 112 16 C108 10 116 4 124 6" ${line(5, C.brown)}/>` +
      `<path d="M114 26 C126 22 136 24 146 18 M112 18 C104 16 98 18 92 14" ${line(3.2, C.brown)}/>` +
      (
        [
          [96, 12, 13, 6],
          [146, 15, 13, 6],
          [124, 2, 13, 6],
          [150, 27, 9, 4.5],
        ] as const
      )
        .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.green}" ${E}/><ellipse cx="${x - 2}" cy="${y - 2}" rx="${rx * 0.6}" ry="${ry * 0.45}" fill="${C.matcha}" opacity=".7"/>`)
        .join(''),
  }),
  head({
    // 宇和島の牛鬼（和霊大祭・牛鬼まつり；data/festivals）
    id: 'ehime-ushioni',
    name: '宇和島牛鬼帽',
    pref: 'ehime',
    rarity: 3,
    icon: '64 -6 112 86',
    svg:
      shape('M96 30 C88 20 80 10 74 -2 C86 4 96 14 102 26Z', C.cream) +
      shape('M144 30 C152 20 160 10 166 -2 C154 4 144 14 138 26Z', C.cream) +
      shape('M84 62 C100 70 140 70 156 62 L158 70 L152 66 L148 76 L142 68 L136 78 L130 68 L124 78 L118 68 L112 78 L106 68 L100 78 L94 68 L88 76 L84 68Z', C.brown) +
      shape('M88 64 C82 40 98 22 120 22 C142 22 158 40 152 64 C140 70 100 70 88 64Z', C.red) +
      shade('M140 26 C154 34 158 50 152 64 C146 66 140 67 134 68 C144 56 146 40 140 26Z') +
      `<path d="M96 36 L112 40 M144 36 L128 40" ${line(3.4, C.ink)}/>` +
      `<circle cx="106" cy="45" r="6.4" fill="${C.gold}" ${E}/><circle cx="106" cy="45" r="3" fill="${C.ink}"/>` +
      `<circle cx="134" cy="45" r="6.4" fill="${C.gold}" ${E}/><circle cx="134" cy="45" r="3" fill="${C.ink}"/>` +
      shape('M104 56 C112 62 128 62 136 56 C128 59 112 59 104 56Z', C.ink) +
      shape('M108 57 L111 62 L113 58Z M132 57 L129 62 L127 58Z', C.white),
  }),
  head({
    // 土佐的長尾雞（特別天然紀念物）
    id: 'kochi-onagadori',
    name: '尾長雞髮飾',
    pref: 'kochi',
    rarity: 2,
    icon: '42 30 70 104',
    svg:
      `<path d="M84 58 C70 62 58 80 56 100 C54 112 58 122 62 128 M86 60 C76 70 66 88 64 108 C62 118 64 124 66 128 M88 62 C82 74 76 94 76 112" ${line(3.8, C.ink, 0.18)}/>` +
      `<path d="M84 58 C70 62 58 80 56 100 C54 112 58 122 62 128 M86 60 C76 70 66 88 64 108 C62 118 64 124 66 128 M88 62 C82 74 76 94 76 112" ${line(2.4, C.white)}/>` +
      PIN +
      shape('M80 50 C74 52 72 60 76 66 C82 70 92 68 94 60 C96 54 90 48 84 48Z', C.white) +
      shape('M86 50 C84 44 88 40 92 42 C94 46 92 50 88 52Z', C.orange) +
      `<circle cx="90" cy="42" r="5" fill="${C.white}" ${E}/>` +
      shape('M86 38 L88 33 L90 37 L92 32 L94 38Z', C.red) +
      shape('M95 42 L99 43 L95 45Z', C.yellow) +
      `<circle cx="91" cy="41" r="1" fill="${C.ink}"/>`,
  }),
  head({
    // 博多仁和加（博多にわか）的半面，推到額頭上
    id: 'fukuoka-niwaka',
    name: '博多仁和加面',
    pref: 'fukuoka',
    rarity: 2,
    icon: '62 42 116 40',
    svg:
      `<path d="M84 64 C76 66 70 70 66 76 M156 64 C164 66 170 70 174 76" ${line(1.6, C.red)}/>` +
      shape('M84 70 C82 54 96 46 120 46 C144 46 158 54 156 70 C150 78 138 76 132 70 C126 76 114 76 108 70 C102 76 90 78 84 70Z', C.brown) +
      `<path d="M92 54 C98 50 106 50 112 54 M128 54 C134 50 142 50 148 54" ${line(2.4, C.ink)}/>` +
      shape('M94 63 C98 57 106 57 110 63 C106 61 98 61 94 63Z', C.white) +
      shape('M130 63 C134 57 142 57 146 63 C142 61 134 61 130 63Z', C.white) +
      `<path d="M100 50 C104 48 108 48 110 49" ${line(1.4, C.white, 0.35)}/>`,
  }),
  head({
    // 佐賀國際熱氣球節（嘉瀨川）
    id: 'saga-balloon',
    name: '熱氣球帽',
    pref: 'saga',
    rarity: 2,
    icon: '86 -16 68 74',
    svg:
      `<path d="M108 34 L113 46 M132 34 L127 46" ${line(1, C.ink, 0.5)}/>` +
      shape('M110 44 L130 44 L128 55 L112 55Z', C.brown) +
      `<path d="M111 48 L129 48 M120 44 L120 55" ${line(0.8, C.ink, 0.3)}/>` +
      shape('M120 -12 C138 -12 148 2 146 16 C144 26 134 32 130 36 L110 36 C106 32 96 26 94 16 C92 2 102 -12 120 -12Z', C.red) +
      shape('M120 -12 C126 -12 130 2 130 16 C130 26 128 32 126 36 L114 36 C112 32 110 26 110 16 C110 2 114 -12 120 -12Z', C.yellow) +
      `<path d="M100 -2 C98 12 102 26 110 36 M140 -2 C142 12 138 26 130 36" ${line(3, C.blue)}/>` +
      `<path d="M134 -8 C144 -2 148 8 146 16 C144 24 138 30 132 34 C140 24 142 6 134 -8Z" ${SH}/>` +
      `<path d="M104 -2 C106 -6 110 -9 114 -10" ${line(2, C.white, 0.45)}/>`,
  }),
  head({
    // 長崎ランタンフェスティバル（data/festivals）
    id: 'nagasaki-lantern',
    name: '長崎燈會燈籠髮飾',
    pref: 'nagasaki',
    rarity: 1,
    icon: '50 30 60 86',
    svg: PIN + lantern(72, 52) + lantern(93, 62),
  }),
  head({
    // 山鹿灯籠まつり（data/festivals；山鹿燈籠浴衣已有）：頭上頂的金燈籠
    id: 'kumamoto-kintoro',
    name: '山鹿金燈籠',
    pref: 'kumamoto',
    rarity: 3,
    icon: '88 -6 64 70',
    svg:
      shape('M104 58 C108 52 132 52 136 58 C132 62 108 62 104 58Z', C.white) +
      shape('M104 54 L106 28 L134 28 L136 54Z', C.gold) +
      `<path d="M109 31 L131 31 L131 51 L109 51Z" fill="${C.yellow}" opacity=".55"/>` +
      `<path d="M113 30 L112 54 M120 30 L120 54 M127 30 L128 54 M105 41 L135 41" ${line(1, C.brown, 0.5)}/>` +
      shape('M96 30 C108 24 132 24 144 30 L130 14 L110 14Z', C.gold) +
      `<path d="M96 30 C108 24 132 24 144 30" ${line(1.4, C.white, 0.6)}/>` +
      shape('M114 14 L120 2 L126 14Z', C.gold) +
      `<circle cx="120" cy="0" r="3" fill="${C.gold}" ${E}/>`,
  }),
  head({
    // 大分縣的乾香菇（花冬菇）產量日本第一
    id: 'oita-shiitake',
    name: '香菇帽',
    pref: 'oita',
    rarity: 1,
    icon: '58 20 124 64',
    svg:
      shape('M66 74 C82 66 158 66 174 74 C158 82 82 82 66 74Z', C.cream) +
      `<path d="M80 75 L78 78 M92 73 L90 79 M106 72 L104 79 M120 72 L120 80 M134 72 L136 79 M148 73 L150 79 M160 75 L162 78" ${line(1, C.brown, 0.4)}/>` +
      shape('M64 72 C62 42 90 26 120 26 C150 26 178 42 176 72 C160 64 80 64 64 72Z', C.brown) +
      shade('M148 32 C166 40 178 54 176 72 C170 70 162 68 154 67 C160 56 158 44 148 32Z') +
      `<path d="M100 40 L108 48 L104 56 M108 48 L118 46 M132 36 L128 46 L136 52 M128 46 L120 46 M88 56 L98 60 M146 54 L152 60" ${line(1.8, C.cream)}/>`,
  }),
  head({
    // 西都原古墳群、西都古墳まつり（data/festivals；古墳時代衣褌已有）：古墳時代的美豆良
    id: 'miyazaki-mizura',
    name: '美豆良',
    pref: 'miyazaki',
    rarity: 2,
    icon: '42 90 156 48',
    svg: [60, 180]
      .map(
        (x) =>
          `<path d="M${x} 98 C${x - 10} 100 ${x - 10} 112 ${x} 114 C${x + 10} 116 ${x + 10} 128 ${x} 130 C${x - 10} 128 ${x - 10} 116 ${x} 114 C${x + 10} 112 ${x + 10} 100 ${x} 98Z" fill="none" stroke="var(--hair, var(--color-doll-hair-1))" stroke-width="5"/>` +
          `<path d="M${x - 6} 114 L${x + 6} 114" ${line(3, C.red)}/>` +
          `<path d="M${x} 114 L${x - 2} 124" ${line(1.4, C.red)}/>`,
      )
      .join(''),
  }),
  head({
    // 種子島宇宙中心
    id: 'kagoshima-rocket',
    name: '種子島火箭帽',
    pref: 'kagoshima',
    rarity: 2,
    icon: '92 -14 56 74',
    svg:
      shape('M100 58 L140 58 L136 50 L104 50Z', C.grey) +
      shape('M104 50 L104 22 C104 16 110 16 110 22 L110 50Z', C.white) +
      shape('M130 50 L130 22 C130 16 136 16 136 22 L136 50Z', C.white) +
      shape('M112 50 L112 2 C112 -10 128 -10 128 2 L128 50Z', C.white) +
      `<path d="M124 -6 C127 -2 128 2 128 2 L128 50 L123 50Z" ${SH}/>` +
      shape('M112 30 L128 30 L128 35 L112 35Z', C.blue) +
      `<path d="M117 -9 C118 -11 122 -11 123 -9" ${line(2.6, C.red)}/>` +
      shape('M114 50 L126 50 L124 54 L116 54Z', C.grey),
  }),
  head({
    // 琉球舞踊的花笠：紅色的大花與藍色的浪
    id: 'okinawa-hanagasa',
    name: '琉球花笠',
    pref: 'okinawa',
    rarity: 2,
    icon: '52 22 136 58',
    svg:
      shape('M58 70 C58 58 182 58 182 70 C170 78 70 78 58 70Z', C.blue) +
      `<path d="M64 70 C72 66 80 74 88 70 C96 66 104 74 112 70 C120 66 128 74 136 70 C144 66 152 74 160 70 C168 66 174 72 178 70" ${line(1.6, C.white)}/>` +
      shape('M80 66 C76 44 96 30 120 30 C144 30 164 44 160 66 C140 60 100 60 80 66Z', C.red) +
      shape('M88 52 C86 38 98 32 106 40 C108 28 132 28 134 40 C142 32 154 38 152 52 C140 46 100 46 88 52Z', C.red) +
      `<path d="M88 52 C86 38 98 32 106 40 C108 28 132 28 134 40 C142 32 154 38 152 52" ${line(1.6, C.yellow, 0.9)}/>` +
      `<path d="M96 62 C96 54 104 50 110 52 M144 62 C144 54 136 50 130 52 M120 36 L120 58" ${line(1.4, C.yellow, 0.7)}/>` +
      shade('M146 40 C156 46 162 54 160 66 C154 65 148 64 142 63 C148 56 150 48 146 40Z'),
  }),
]

// ---------- 手上 ----------
/** 圓圓、扁扁的串（玉蒟蒻、烤饅頭、串炸） */
const ball = (fill: string, r = 10) => (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${E}/><circle cx="${x - 3}" cy="${y - 3}" r="${r * 0.3}" fill="${C.white}" opacity=".35"/>`
const sasa = (rot: number) =>
  `<g transform="rotate(${rot} 160 232)">` +
  shape('M160 232 C152 214 156 190 170 172 C182 188 182 214 168 232Z', C.cream) +
  `<path d="M162 226 C160 212 162 196 170 180" ${line(1.4, C.brown, 0.35)}/>` +
  dots(
    C.brown,
    2,
    [
      [167, 200],
      [171, 212],
      [165, 190],
    ],
    'opacity=".45"',
  ) +
  `</g>`
const imo = (rot: number, fill: string) =>
  `<g transform="rotate(${rot} 158 232)">` +
  shape('M150 236 C146 220 150 196 160 180 C170 182 174 192 172 206 C170 222 164 234 156 238Z', fill) +
  `<path d="M157 190 C155 206 155 222 157 232" ${line(1, C.brown, 0.3)}/>` +
  dots(
    C.white,
    0.9,
    [
      [161, 196],
      [165, 210],
      [159, 222],
    ],
    'opacity=".6"',
  ) +
  `</g>`
const ika = (x: number, y: number) =>
  shape(`M${x - 10} ${y} C${x - 10} ${y - 4} ${x + 2} ${y - 5} ${x + 8} ${y} C${x + 2} ${y + 5} ${x - 10} ${y + 4} ${x - 10} ${y}Z`, C.brown) +
  `<path d="M${x + 8} ${y} L${x + 14} ${y - 2} M${x + 8} ${y} L${x + 14} ${y + 2}" ${line(1.2, C.brown)}/>` +
  dots(C.blue, 1.1, [
    [x - 6, y - 1],
    [x - 2, y + 1],
    [x + 2, y - 1],
  ])
const wing = (x: number, y: number, rot: number) =>
  `<g transform="rotate(${rot} ${x} ${y})">` +
  shape(`M${x - 14} ${y + 4} C${x - 14} ${y - 4} ${x - 4} ${y - 6} ${x} ${y - 2} L${x + 12} ${y - 10} C${x + 16} ${y - 10} ${x + 18} ${y - 6} ${x + 14} ${y - 2} L${x + 2} ${y + 8} C${x - 4} ${y + 12} ${x - 14} ${y + 10} ${x - 14} ${y + 4}Z`, C.orange) +
  tint(`M${x - 14} ${y + 4} C${x - 14} ${y - 4} ${x - 4} ${y - 6} ${x} ${y - 2} L${x + 12} ${y - 10} C${x + 16} ${y - 10} ${x + 18} ${y - 6} ${x + 14} ${y - 2} L${x + 2} ${y + 8} C${x - 4} ${y + 12} ${x - 14} ${y + 10} ${x - 14} ${y + 4}Z`, C.brown, 0.35) +
  dots(C.white, 0.9, [
    [x - 8, y + 2],
    [x - 4, y + 5],
    [x + 6, y - 4],
    [x - 10, y + 6],
  ]) +
  `</g>`
const tri = (x: number, y: number, fill: string, rot: number) =>
  `<g transform="rotate(${rot} ${x} ${y})">` +
  shape(`M${x - 14} ${y + 6} L${x} ${y - 12} L${x + 14} ${y + 6}Z`, fill) +
  `<path d="M${x - 8} ${y + 3} C${x - 4} ${y - 1} ${x + 4} ${y - 1} ${x + 8} ${y + 3}" ${line(2.4, C.brown, 0.7)}/>` +
  `</g>`
const oyster = (x: number, y: number, rot: number) =>
  `<g transform="rotate(${rot} ${x} ${y})">` +
  shape(`M${x - 16} ${y} C${x - 16} ${y - 10} ${x - 4} ${y - 14} ${x + 8} ${y - 10} C${x + 18} ${y - 6} ${x + 18} ${y + 8} ${x + 6} ${y + 10} C${x - 6} ${y + 12} ${x - 16} ${y + 8} ${x - 16} ${y}Z`, C.grey) +
  `<path d="M${x - 12} ${y - 6} C${x - 4} ${y - 10} ${x + 6} ${y - 9} ${x + 12} ${y - 5}" ${line(1, C.white, 0.4)}/>` +
  `<ellipse cx="${x}" cy="${y}" rx="10" ry="6" fill="${C.cream}" ${E}/>` +
  `<ellipse cx="${x}" cy="${y}" rx="10" ry="6" fill="none" stroke="${C.ink}" stroke-opacity=".35" stroke-width="1"/>` +
  `</g>`
const egg = (x: number, y: number, rot: number) =>
  `<g transform="rotate(${rot} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="9" ry="12" fill="${C.ink}" ${E}/><ellipse cx="${x - 3}" cy="${y - 4}" rx="2.2" ry="3.4" fill="${C.white}" opacity=".35"/></g>`

const HAND: Outfit[] = [
  hand({
    // 札幌大通公園的烤玉米（焼きとうきび）
    id: 'hokkaido-corn',
    name: '烤玉米',
    pref: 'hokkaido',
    rarity: 1,
    icon: '124 134 96 110',
    svg:
      `<path d="M154 236 L166 208" ${line(3, C.cream)}/>` +
      `<g transform="rotate(28 180 180)">` +
      shape('M170 146 C170 140 190 140 190 146 L190 210 C190 216 170 216 170 210Z', C.yellow) +
      `<path d="M170 154 L190 154 M170 162 L190 162 M170 170 L190 170 M170 178 L190 178 M170 186 L190 186 M170 194 L190 194 M170 202 L190 202 M176 142 L176 214 M184 142 L184 214" ${line(1, C.orange, 0.5)}/>` +
      `<path d="M172 168 L188 166 M172 188 L188 186" ${line(3, C.brown, 0.55)}/>` +
      tint('M182 141 C186 141 190 142 190 146 L190 210 C190 214 188 216 184 216Z', C.brown, 0.25) +
      `</g>`,
  }),
  hand({
    // 貝焼き味噌（青森的郷土料理）：帆立貝殼當鍋子煮的蛋與味噌
    id: 'aomori-kaiyaki',
    name: '帆立貝燒味噌',
    pref: 'aomori',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M156 234 L176 234 L172 243 L160 243Z', C.cream) +
      shape('M136 214 C136 196 152 186 166 186 C180 186 196 196 196 214 C196 226 184 236 166 236 C148 236 136 226 136 214Z', C.cream) +
      `<path d="M166 188 L166 234 M152 192 L146 230 M180 192 L186 230 M142 202 L138 222 M190 202 L194 222" ${line(1.2, C.brown, 0.4)}/>` +
      `<ellipse cx="166" cy="212" rx="22" ry="14" fill="${C.yellow}" ${E}/>` +
      `<ellipse cx="164" cy="210" rx="13" ry="7" fill="${C.orange}" opacity=".35"/>` +
      dots(C.green, 1.6, [
        [156, 206],
        [172, 216],
        [178, 206],
        [160, 218],
      ]),
  }),
  hand({
    // 南部鐵器（經濟產業大臣指定）：霰紋的鐵壺
    id: 'iwate-tetsubin',
    name: '南部鐵壺',
    pref: 'iwate',
    rarity: 2,
    icon: '124 160 92 86',
    svg:
      `<path d="M144 202 C144 174 188 174 188 202" ${line(4, C.ink)}/>` +
      shape('M186 214 L204 200 L206 204 L192 222Z', C.ink) +
      shape('M140 216 C140 200 192 200 192 216 C192 234 178 242 166 242 C154 242 140 234 140 216Z', C.ink) +
      dots(
        C.grey,
        1.5,
        [
          [148, 214],
          [156, 210],
          [164, 212],
          [172, 210],
          [180, 212],
          [186, 216],
          [146, 224],
          [154, 222],
          [162, 224],
          [170, 222],
          [178, 224],
          [184, 228],
          [152, 232],
          [160, 234],
          [168, 232],
          [176, 234],
        ],
        'opacity=".7"',
      ) +
      shape('M150 204 C150 198 182 198 182 204 C176 208 156 208 150 204Z', C.ink) +
      `<circle cx="166" cy="199" r="3" fill="${C.ink}" ${E}/>` +
      `<path d="M148 214 C148 208 152 206 156 206" ${line(2, C.white, 0.3)}/>`,
  }),
  hand({
    // 仙台的笹蒲鉾
    id: 'miyagi-sasakama',
    name: '笹蒲鉾',
    pref: 'miyagi',
    rarity: 1,
    icon: ICON.hand,
    svg: sasa(-18) + sasa(12),
  }),
  hand({
    // 大館曲木便當盒（大館曲げわっぱ，經濟產業大臣指定）
    id: 'akita-magewappa',
    name: '曲木便當盒',
    pref: 'akita',
    rarity: 2,
    icon: ICON.hand,
    svg:
      shape('M136 216 C136 208 196 208 196 216 L196 232 C196 240 136 240 136 232Z', C.yellow) +
      tint('M136 216 C136 208 196 208 196 216 L196 232 C196 240 136 240 136 232Z', C.brown, 0.3) +
      `<path d="M140 228 C160 232 176 232 192 228" ${line(0.8, C.brown, 0.4)}/>` +
      shape('M134 208 C134 198 198 198 198 208 L198 216 C198 224 134 224 134 216Z', C.yellow) +
      tint('M134 208 C134 198 198 198 198 208 L198 216 C198 224 134 224 134 216Z', C.brown, 0.22) +
      `<path d="M138 210 C158 214 176 214 194 210" ${line(0.8, C.brown, 0.4)}/>` +
      shape('M180 202 L186 202 L186 238 L180 238Z', C.brown),
  }),
  hand({
    // 玉こんにゃく（山形的郷土料理；data/specialties）
    id: 'yamagata-tamakon',
    name: '玉蒟蒻',
    pref: 'yamagata',
    rarity: 1,
    icon: '124 140 92 104',
    svg: skewer(ball(C.brown), [0.32, 0.6, 0.88]) + `<path d="M175 155 C177 152 181 152 183 155" ${line(2.4, C.yellow)}/>`,
  }),
  hand({
    // 大內宿的蔥蕎麥：用一整根蔥代替筷子
    id: 'fukushima-negisoba',
    name: '大內宿蔥蕎麥',
    pref: 'fukushima',
    rarity: 2,
    icon: '124 140 96 104',
    svg:
      bowl({
        bowl: C.red,
        soup: C.brown,
        noodle: C.grey,
        rim: C.ink,
        sticks: false,
        top: dots(C.white, 2, [
          [154, 206],
          [160, 208],
          [174, 207],
        ]),
      }) +
      `<path d="M150 214 L196 150" ${line(6, C.green)}/>` +
      `<path d="M150 214 L168 189" ${line(6, C.white)}/>` +
      `<path d="M196 150 L200 140 M196 150 L206 146" ${line(3, C.green)}/>`,
  }),
  hand({
    // 茨城的乾番薯（干し芋），產量日本第一
    id: 'ibaraki-hoshiimo',
    name: '乾番薯',
    pref: 'ibaraki',
    rarity: 1,
    icon: ICON.hand,
    svg: imo(-22, C.orange) + imo(0, C.yellow) + imo(22, C.orange),
  }),
  hand({
    // 益子燒（經濟產業大臣指定；益子陶器市在 data/festivals）
    id: 'tochigi-mashiko',
    name: '益子燒湯吞',
    pref: 'tochigi',
    rarity: 2,
    icon: ICON.hand,
    svg: cup(C.brown, C.matcha, shape('M140 200 L192 200 L191 210 C186 214 182 208 178 214 C174 220 170 210 166 214 C160 220 156 210 150 216 C146 218 142 212 141 210Z', C.cream)),
  }),
  hand({
    // 焼きまんじゅう（群馬）：串起來刷上甜味噌烤
    id: 'gunma-yakimanju',
    name: '烤饅頭',
    pref: 'gunma',
    rarity: 1,
    icon: '124 140 92 104',
    svg: skewer(
      (x, y) =>
        `<ellipse cx="${x}" cy="${y}" rx="11" ry="9" fill="${C.cream}" ${E}/>` +
        `<path d="M${x - 10} ${y - 2} C${x - 6} ${y - 9} ${x + 6} ${y - 9} ${x + 10} ${y - 2} C${x + 6} ${y + 1} ${x - 6} ${y + 1} ${x - 10} ${y - 2}Z" fill="${C.red}" opacity=".55"/>` +
        dots(C.brown, 1.2, [
          [x - 4, y - 4],
          [x + 3, y - 3],
        ]),
      [0.25, 0.47, 0.69, 0.91],
    ),
  }),
  hand({
    // 狹山茶
    id: 'saitama-sayamacha',
    name: '狹山茶罐',
    pref: 'saitama',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M146 178 L186 178 L186 238 L146 238Z', C.green) +
      `<path d="M176 178 L186 178 L186 238 L176 238Z" ${SH}/>` +
      shape('M144 170 L188 170 L188 180 L144 180Z', C.grey) +
      shape('M152 190 L180 190 L180 230 L152 230Z', C.white) +
      vtext('狭山茶', 166, 210, 9, C.green),
  }),
  hand({
    // 房州枇杷
    id: 'chiba-biwa',
    name: '房州枇杷',
    pref: 'chiba',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M150 198 C160 178 186 166 204 162 C196 178 176 194 156 202Z', C.green) +
      `<path d="M154 200 C168 186 184 176 202 164" ${line(1, C.matcha)}/>` +
      `<path d="M160 203 L166 196 M180 198 L172 194" ${line(1.6, C.brown)}/>` +
      ([
        [160, 216, 13],
        [181, 210, 12],
        [172, 231, 11],
      ] as const)
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${r * 0.85}" ry="${r}" fill="${C.orange}" ${E}/><ellipse cx="${x - 3}" cy="${y - 4}" rx="2.4" ry="3.2" fill="${C.white}" opacity=".35"/><circle cx="${x}" cy="${y + r - 1.5}" r="1.6" fill="${C.brown}"/>`,
        )
        .join(''),
  }),
  hand({
    // 江戶風鈴
    id: 'tokyo-furin',
    name: '江戶風鈴',
    pref: 'tokyo',
    rarity: 2,
    icon: '130 192 64 92',
    svg:
      `<path d="M158 198 L160 228" ${line(1.4, C.ink, 0.7)}/>` +
      `<path d="M160 246 L160 254" ${line(1, C.ink, 0.5)}/>` +
      shape('M156 254 L164 254 L164 280 L156 280Z', C.pink) +
      shape('M144 246 C144 233 151 227 160 227 C169 227 176 233 176 246Z', C.white, 'fill-opacity=".85"') +
      `<ellipse cx="156" cy="239" rx="4" ry="2.4" fill="${C.red}"/><path d="M152 239 L148 236 L148 242Z" fill="${C.red}"/>` +
      `<path d="M146 243 C152 241 168 241 174 243" ${line(1.2, C.blue)}/>` +
      `<path d="M150 236 C150 232 153 230 156 229" ${line(1.4, C.white, 0.8)}/>`,
  }),
  hand({
    // 箱根大涌谷的黑玉子
    id: 'kanagawa-kurotamago',
    name: '大涌谷黑玉子',
    pref: 'kanagawa',
    rarity: 1,
    icon: ICON.hand,
    svg:
      `<path d="M176 196 C172 188 180 184 176 176 M186 200 C182 192 190 188 186 180" ${line(2, C.grey, 0.6)}/>` +
      egg(162, 206, 0) +
      egg(152, 226, -10) +
      egg(172, 224, 8),
  }),
  hand({
    // へぎそば（新潟的郷土料理）：片木盒裡一口一口排好的蕎麥
    id: 'niigata-hegisoba',
    name: '片木蕎麥',
    pref: 'niigata',
    rarity: 2,
    icon: '124 180 92 64',
    svg:
      shape('M132 216 L176 202 L208 222 L164 238Z', C.yellow) +
      tint('M132 216 L176 202 L208 222 L164 238Z', C.brown, 0.3) +
      `<path d="M136 216 L176 204 L204 222 L164 236Z" fill="none" stroke="${C.brown}" stroke-opacity=".45" stroke-width="1"/>` +
      ([
        [150, 216],
        [163, 212],
        [176, 208],
        [158, 223],
        [171, 219],
        [184, 215],
        [167, 229],
        [180, 225],
        [193, 221],
      ] as const)
        .map(([x, y]) => `<path d="M${x - 6} ${y} C${x - 4} ${y - 4} ${x - 2} ${y + 2} ${x} ${y - 2} C${x + 2} ${y + 2} ${x + 4} ${y - 4} ${x + 6} ${y}" ${line(2.4, C.matcha)}/>`)
        .join(''),
  }),
  hand({
    // 富山灣的螢烏賊
    id: 'toyama-hotaruika',
    name: '螢烏賊',
    pref: 'toyama',
    rarity: 1,
    icon: '124 196 92 48',
    svg: plate(C.navy) + ika(150, 226) + ika(170, 222) + ika(160, 231) + ika(184, 229),
  }),
  hand({
    // 輪島塗（經濟產業大臣指定）：黑漆、朱內、金蒔繪
    id: 'ishikawa-wajima',
    name: '輪島塗碗',
    pref: 'ishikawa',
    rarity: 3,
    icon: ICON.bowl,
    svg:
      shape('M156 237 L176 237 L174 244 L158 244Z', C.ink) +
      shape('M136 212 C136 230 150 238 166 238 C182 238 196 230 196 212Z', C.ink) +
      `<ellipse cx="166" cy="212" rx="30" ry="6" fill="${C.red}" ${E}/>` +
      `<path d="M144 224 C150 218 156 222 160 218 M170 226 C176 220 182 224 188 218" ${line(1.6, C.gold)}/>` +
      dots(C.gold, 1.2, [
        [150, 230],
        [182, 230],
        [166, 228],
      ]) +
      `<path d="M140 216 C142 222 146 228 150 230" ${line(1.6, C.white, 0.2)}/>`,
  }),
  hand({
    // 羽二重餅（福井的名菓）
    id: 'fukui-habutae',
    name: '羽二重餅',
    pref: 'fukui',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M136 234 L148 208 L198 210 L190 238Z', C.pink) +
      ([
        [146, 214, -6],
        [150, 222, -2],
        [154, 230, 2],
      ] as const)
        .map(([x, y, r]) => `<rect x="${x}" y="${y - 5}" width="36" height="10" rx="5" fill="${C.white}" ${E} transform="rotate(${r} ${x + 18} ${y})"/>`)
        .join('') +
      dots(C.cream, 0.9, [
        [156, 212],
        [170, 218],
        [162, 226],
        [178, 229],
      ]),
  }),
  hand({
    // 甲州水晶貴石細工（經濟產業大臣指定）
    id: 'yamanashi-suisho',
    name: '甲州水晶球',
    pref: 'yamanashi',
    rarity: 3,
    icon: ICON.hand,
    svg:
      shape('M150 238 L182 238 L178 228 L154 228Z', C.brown) +
      shape('M152 228 C152 222 180 222 180 228Z', C.gold) +
      `<circle cx="166" cy="206" r="20" fill="${C.white}" fill-opacity=".85" ${E}/>` +
      `<circle cx="166" cy="206" r="20" fill="${C.blue}" opacity=".18"/>` +
      `<circle cx="174" cy="214" r="5" fill="${C.purple}" opacity=".25"/>` +
      `<path d="M154 198 C156 192 160 190 164 189" ${line(3, C.white, 0.9)}/>`,
  }),
  hand({
    // おやき（信州的郷土料理；data/specialties）：裡面包野澤菜
    id: 'nagano-oyaki',
    name: '信州烤餅',
    pref: 'nagano',
    rarity: 1,
    icon: ICON.hand,
    svg:
      `<ellipse cx="176" cy="210" rx="18" ry="14" fill="${C.cream}" ${E}/>` +
      `<ellipse cx="170" cy="205" rx="6" ry="3" fill="${C.brown}" opacity=".35"/><ellipse cx="184" cy="214" rx="5" ry="2.6" fill="${C.brown}" opacity=".35"/>` +
      shape('M140 228 C140 214 150 206 160 206 C170 206 180 214 180 228Z', C.cream) +
      shape('M146 228 C146 218 152 214 160 214 C168 214 174 218 174 228Z', C.green) +
      dots(C.matcha, 1.2, [
        [154, 222],
        [162, 219],
        [168, 224],
      ]),
  }),
  hand({
    // 岐阜提灯（經濟產業大臣指定）：細長的燈籠，畫著秋草
    id: 'gifu-chochin',
    name: '岐阜燈籠',
    pref: 'gifu',
    rarity: 2,
    icon: '124 160 96 86',
    svg:
      `<path d="M154 236 L190 168" ${line(3, C.brown)}/>` +
      `<path d="M190 168 L194 166 L194 172" ${line(1.6, C.ink)}/>` +
      shape('M186 172 L202 172 L200 178 L188 178Z', C.ink) +
      `<ellipse cx="194" cy="200" rx="13" ry="22" fill="${C.white}" ${E}/>` +
      `<ellipse cx="194" cy="200" rx="13" ry="22" fill="${C.blue}" opacity=".15"/>` +
      `<path d="M182 192 L206 192 M181.5 200 L206.5 200 M182 208 L206 208" ${line(0.8, C.ink, 0.2)}/>` +
      `<path d="M186 214 C188 206 190 200 194 196 M192 216 C194 208 198 202 202 200" ${line(1.2, C.green)}/>` +
      dots(C.purple, 1.4, [
        [194, 196],
        [202, 200],
        [189, 206],
      ]) +
      shape('M188 222 L200 222 L198 226 L190 226Z', C.ink) +
      `<path d="M194 226 L194 240" ${line(3, C.purple)}/>`,
  }),
  hand({
    // 伊豆、靜岡的山葵（わさび田）
    id: 'shizuoka-wasabi',
    name: '山葵',
    pref: 'shizuoka',
    rarity: 1,
    icon: '124 146 92 98',
    svg:
      `<path d="M170 198 L184 170 M166 196 L170 166 M174 200 L198 182" ${line(2, C.green)}/>` +
      heartLeaf(184, 164, 10, 20) +
      heartLeaf(170, 158, 9, -10) +
      heartLeaf(200, 178, 9, 50) +
      shape('M156 236 C150 230 150 216 156 204 C160 196 170 194 174 200 C176 210 170 226 162 236Z', C.matcha) +
      `<path d="M154 222 L160 220 M156 212 L164 210 M160 202 L168 202 M156 230 L162 228" ${line(1.2, C.green, 0.6)}/>`,
  }),
  hand({
    // 名古屋的手羽先
    id: 'aichi-tebasaki',
    name: '名古屋手羽先',
    pref: 'aichi',
    rarity: 1,
    icon: '124 192 92 52',
    svg: plate(C.white) + wing(160, 220, -10) + wing(178, 214, 12) + wing(168, 226, 0),
  }),
  hand({
    // 伊賀くみひも（經濟產業大臣指定）
    id: 'mie-kumihimo',
    name: '伊賀組紐',
    pref: 'mie',
    rarity: 2,
    icon: ICON.hand,
    svg:
      `<path d="M150 230 C140 210 160 196 176 204 C192 212 186 232 168 230 C156 228 158 214 170 214" fill="none" stroke="${C.purple}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M150 230 C140 210 160 196 176 204 C192 212 186 232 168 230 C156 228 158 214 170 214" fill="none" stroke="${C.gold}" stroke-width="6" stroke-dasharray="2 3"/>` +
      `<path d="M150 230 L146 244 M170 214 L178 238" ${line(4, C.purple)}/>` +
      dots(C.gold, 3, [
        [150, 230],
        [171, 216],
      ]),
  }),
  hand({
    // 大津繪：鬼的寒念仏
    id: 'shiga-otsue',
    name: '大津繪',
    pref: 'shiga',
    rarity: 2,
    icon: '134 132 72 112',
    svg:
      `<path d="M156 148 L171 138 L186 148" ${line(1.2, C.ink, 0.6)}/>` +
      shape('M150 152 L192 152 L192 232 L150 232Z', C.cream) +
      shape('M146 148 L196 148 L196 154 L146 154Z', C.brown) +
      shape('M146 230 L196 230 L196 236 L146 236Z', C.brown) +
      shape('M160 188 L182 188 L188 224 L154 224Z', C.ink) +
      `<circle cx="171" cy="177" r="8" fill="${C.red}" ${E}/>` +
      `<path d="M165 171 L163 165 M177 171 L179 165" ${line(2, C.cream)}/>` +
      dots(C.white, 1.2, [
        [168, 176],
        [174, 176],
      ]) +
      `<path d="M182 198 L192 190" ${line(1.4, C.brown)}/>` +
      `<circle cx="157" cy="202" r="4" fill="${C.gold}" ${E}/>`,
  }),
  hand({
    // 京都的生八橋（肉桂、抹茶、櫻）
    id: 'kyoto-yatsuhashi',
    name: '生八橋',
    pref: 'kyoto',
    rarity: 1,
    icon: '124 192 92 52',
    svg: plate(C.white) + tri(150, 220, C.cream, -8) + tri(176, 216, C.matcha, 8) + tri(163, 227, C.pink, 0),
  }),
  hand({
    // 大阪新世界的串炸
    id: 'osaka-kushikatsu',
    name: '串炸',
    pref: 'osaka',
    rarity: 1,
    icon: '124 140 92 104',
    svg: skewer(
      (x, y, i) =>
        `<ellipse cx="${x}" cy="${y}" rx="${i === 1 ? 7 : 10}" ry="${i === 1 ? 13 : 10}" fill="${C.orange}" ${E}/>` +
        dots(C.yellow, 1, [
          [x - 4, y - 4],
          [x + 3, y - 2],
          [x - 2, y + 4],
          [x + 4, y + 5],
        ]) +
        (i === 0 ? `<path d="M${x - 9} ${y + 2} C${x - 6} ${y + 10} ${x + 6} ${y + 10} ${x + 9} ${y + 2}Z" fill="${C.brown}" opacity=".7"/>` : ''),
      [0.32, 0.6, 0.88],
    ),
  }),
  hand({
    // 播州算盤（經濟產業大臣指定）
    id: 'hyogo-soroban',
    name: '播州算盤',
    pref: 'hyogo',
    rarity: 2,
    icon: '124 160 96 86',
    svg:
      `<g transform="rotate(-24 172 204)">` +
      shape('M136 186 L208 186 L208 222 L136 222Z', C.brown) +
      shape('M140 190 L204 190 L204 218 L140 218Z', C.cream) +
      [146, 154, 162, 170, 178, 186, 194, 200]
        .map(
          (x, i) =>
            `<path d="M${x} 190 L${x} 218" ${line(1, C.brown, 0.6)}/>` +
            `<ellipse cx="${x}" cy="${i % 3 ? 193 : 195}" rx="3.4" ry="1.9" fill="${C.ink}"/>` +
            [204, 208, 212, 216].map((y, k) => `<ellipse cx="${x}" cy="${k < i % 3 ? y - 4 : y}" rx="3.4" ry="1.9" fill="${C.ink}"/>`).join(''),
        )
        .join('') +
      `<path d="M140 198 L204 198" ${line(2.4, C.brown)}/>` +
      `</g>`,
  }),
  hand({
    // 奈良公園的鹿仙貝
    id: 'nara-shikasenbei',
    name: '鹿仙貝',
    pref: 'nara',
    rarity: 1,
    icon: '124 188 92 56',
    svg:
      [0, 1, 2, 3, 4].map((i) => `<ellipse cx="166" cy="${232 - i * 5}" rx="22" ry="7" fill="${C.cream}" ${E}/>`).join('') +
      dots(C.brown, 1.4, [
        [156, 211],
        [170, 210],
        [178, 214],
      ], 'opacity=".4"') +
      shape('M150 208 L158 208 L158 238 L150 238Z', C.white) +
      `<circle cx="154" cy="222" r="2.6" fill="${C.red}"/>`,
  }),
  hand({
    // 紀州へら竿（經濟產業大臣指定）：釣鯽魚的竹竿
    id: 'wakayama-herazao',
    name: '紀州竹竿',
    pref: 'wakayama',
    rarity: 2,
    icon: '124 112 110 136',
    svg:
      `<path d="M226 120 C228 150 226 180 222 204" ${line(0.8, C.ink, 0.5)}/>` +
      `<path d="M222 198 L222 222" ${line(2.4, C.red)}/><path d="M222 210 L222 216" ${line(2.4, C.white)}/>` +
      `<path d="M150 240 L226 120" ${line(3, C.red)}/>` +
      `<path d="M150 240 L163 220" ${line(5, C.brown)}/>` +
      dots(C.gold, 2, [
        [170, 208],
        [186, 183],
        [202, 158],
        [216, 136],
      ]),
  }),
  hand({
    // 鳥取しゃんしゃん祭（data/festivals）：掛著鈴鐺的傘
    id: 'tottori-shanshan',
    name: '傘舞花傘',
    pref: 'tottori',
    rarity: 2,
    icon: '124 120 100 126',
    svg:
      `<path d="M156 236 L176 150" ${line(3, C.brown)}/>` +
      shape('M136 162 C142 132 212 132 218 162 C200 156 156 156 136 162Z', C.red) +
      [
        [C.yellow, 'M150 159 C152 142 164 136 177 134 C168 140 162 150 162 157Z'],
        [C.blue, 'M192 157 C192 150 186 140 177 134 C190 136 202 142 204 159Z'],
      ]
        .map(([c, d]) => shape(d!, c!))
        .join('') +
      `<path d="M136 162 C156 156 200 156 218 162" ${line(1.4, C.gold)}/>` +
      [140, 152, 164, 176, 188, 200, 212]
        .map((x, i) => `<path d="M${x} ${161 - (i % 2)} L${x} ${172 + (i % 3) * 3}" ${line(1.6, [C.white, C.pink, C.blue][i % 3]!)}/>`)
        .join('') +
      dots(
        C.gold,
        2.2,
        [140, 152, 164, 176, 188, 200, 212].map((x, i): [number, number] => [x, 174 + (i % 3) * 3]),
      ),
  }),
  hand({
    // 安來節的泥鰍舞（頭上的頰被同組）：撈泥鰍的竹簍
    id: 'shimane-zaru',
    name: '泥鰍舞竹簍',
    pref: 'shimane',
    rarity: 1,
    icon: ICON.bowl,
    svg:
      shape('M134 212 C134 204 198 204 198 212 C198 230 182 238 166 238 C150 238 134 230 134 212Z', C.yellow) +
      tint('M134 212 C134 204 198 204 198 212 C198 230 182 238 166 238 C150 238 134 230 134 212Z', C.brown, 0.3) +
      `<path d="M140 218 L192 218 M144 226 L188 226 M152 232 L180 232 M150 212 L146 230 M166 212 L166 236 M182 212 L186 230" ${line(1, C.brown, 0.5)}/>` +
      shape('M150 208 C158 202 176 202 186 206 C176 210 160 212 150 208Z', C.grey) +
      `<circle cx="182" cy="206" r="1" fill="${C.ink}"/><path d="M186 206 L192 204 M186 207 L192 209" ${line(0.8, C.ink, 0.6)}/>` +
      `<ellipse cx="166" cy="211" rx="32" ry="6" fill="none" stroke="${C.brown}" stroke-width="2.4"/>`,
  }),
  hand({
    // 備前燒（經濟產業大臣指定）：不上釉，燒出紅色的火痕與芝麻點
    id: 'okayama-bizen',
    name: '備前燒德利',
    pref: 'okayama',
    rarity: 2,
    icon: ICON.hand,
    svg:
      shape('M158 238 C144 238 142 222 146 212 C150 202 158 198 158 188 L158 176 L174 176 L174 188 C174 198 182 202 186 212 C190 222 188 238 174 238Z', C.brown) +
      `<path d="M150 218 C160 210 170 226 182 214 M152 230 C164 222 172 234 184 226" ${line(2, C.red, 0.55)}/>` +
      dots(
        C.yellow,
        1.2,
        [
          [160, 204],
          [168, 200],
          [176, 206],
          [164, 212],
        ],
        'opacity=".6"',
      ) +
      shape('M156 176 L176 176 L176 171 L156 171Z', C.brown) +
      `<path d="M174 190 C178 198 186 204 186 216 C188 226 186 234 176 238 C182 226 182 208 174 198Z" ${SH}/>`,
  }),
  hand({
    // 廣島的牡蠣
    id: 'hiroshima-kaki',
    name: '烤牡蠣',
    pref: 'hiroshima',
    rarity: 1,
    icon: ICON.hand,
    svg: oyster(157, 224, -8) + oyster(179, 210, 12) + shape('M182 232 C190 226 198 228 200 234 C194 238 186 238 182 232Z', C.yellow),
  }),
  hand({
    // 萩燒（經濟產業大臣指定）：淡淡的枇杷色、冰裂紋、切口的高台
    id: 'yamaguchi-hagi',
    name: '萩燒茶碗',
    pref: 'yamaguchi',
    rarity: 2,
    icon: ICON.bowl,
    svg:
      shape('M156 236 L176 236 L178 243 L170 241 L166 244 L162 241 L154 243Z', C.cream) +
      shape('M136 206 C136 226 150 237 166 237 C182 237 196 226 196 206Z', C.pink) +
      tint('M136 206 C136 226 150 237 166 237 C182 237 196 226 196 206Z', C.cream, 0.45) +
      `<path d="M146 214 L152 222 L150 228 M170 216 L176 210 M182 222 L188 216 M160 226 L166 230" ${line(0.8, C.brown, 0.35)}/>` +
      `<ellipse cx="166" cy="206" rx="30" ry="6" fill="${C.matcha}" ${E}/>` +
      dots(
        C.cream,
        1.2,
        [
          [158, 205],
          [170, 207],
          [178, 204],
        ],
        'opacity=".6"',
      ),
  }),
  hand({
    // 阿波人形淨琉璃（阿波十郎兵衛屋敷）：人形的頭與衣裳
    id: 'tokushima-ningyo',
    name: '阿波人形淨琉璃',
    pref: 'tokushima',
    rarity: 3,
    icon: '128 140 86 106',
    svg:
      shape('M150 238 C148 218 156 196 170 190 C184 196 192 214 194 238Z', C.red) +
      `<path d="M150 238 C148 218 156 196 170 190 C184 196 192 214 194 238Z" fill="url(#doll-yuzen)" opacity=".7"/>` +
      `<path d="M162 194 L170 208 L178 194" ${line(3, C.white)}/>` +
      `<ellipse cx="170" cy="178" rx="10" ry="12" fill="${C.white}" ${E}/>` +
      shape('M158 175 C156 160 166 152 176 154 C186 156 188 168 182 176 C178 168 166 166 158 175Z', C.ink) +
      shape('M163 157 C163 146 179 146 179 157Z', C.ink) +
      `<path d="M178 152 L190 146 M176 150 L186 140" ${line(1.4, C.gold)}/>` +
      `<path d="M165 178 L168 178 M172 178 L175 178" ${line(1, C.ink)}/>` +
      `<circle cx="170" cy="184" r="1.4" fill="${C.red}"/>`,
  }),
  hand({
    // 和三盆（香川、德島）：壓成花與波的模樣
    id: 'kagawa-wasanbon',
    name: '和三盆',
    pref: 'kagawa',
    rarity: 1,
    icon: '124 196 92 48',
    svg:
      shape('M134 222 L198 222 L194 234 L138 234Z', C.brown) +
      shape('M134 222 L198 222 L192 212 L140 212Z', C.yellow) +
      tint('M134 222 L198 222 L192 212 L140 212Z', C.brown, 0.25) +
      blossom(150, 215, 4, C.pink) +
      `<circle cx="166" cy="215" r="5" fill="${C.white}" ${E}/>` +
      shape('M176 219 C176 212 186 210 188 216 C184 214 180 216 180 220Z', C.matcha),
  }),
  hand({
    // 砥部燒（經濟產業大臣指定）：厚厚的白瓷，畫上藍色的唐草
    id: 'ehime-tobe',
    name: '砥部燒碗',
    pref: 'ehime',
    rarity: 2,
    icon: ICON.bowl,
    svg:
      shape('M134 206 C134 228 150 238 166 238 C182 238 198 228 198 206Z', C.white) +
      `<path d="M182 208 L198 206 C198 228 184 238 168 238 C184 228 186 218 182 208Z" ${SH}/>` +
      `<ellipse cx="166" cy="206" rx="32" ry="6" fill="${C.white}" ${E}/>` +
      `<ellipse cx="166" cy="206" rx="22" ry="3.6" fill="${C.blue}" opacity=".25"/>` +
      `<path d="M140 216 C146 210 152 222 158 216 C164 210 170 222 176 216 C182 210 188 222 194 216 M146 228 C152 224 160 232 166 228 C172 224 180 232 186 228" ${line(2.6, C.navy)}/>`,
  }),
  hand({
    // 高知的芋けんぴ
    id: 'kochi-imokenpi',
    name: '土佐芋條',
    pref: 'kochi',
    rarity: 1,
    icon: '124 160 92 84',
    svg:
      `<path d="M152 204 L146 178 M158 202 L158 172 M164 204 L170 176 M170 204 L180 182 M160 200 L152 176" ${line(3.4, C.orange)}/>` +
      `<path d="M152 204 L146 178 M164 204 L170 176" ${line(1, C.yellow, 0.7)}/>` +
      shape('M144 200 L190 200 L186 238 L148 238Z', C.cream) +
      tint('M144 200 L190 200 L186 238 L148 238Z', C.brown, 0.25) +
      `<path d="M144 200 L150 205 L156 200 L162 205 L168 200 L174 205 L180 200 L186 205 L190 200" ${line(1.2, C.brown, 0.5)}/>` +
      shape('M156 214 L178 214 L177 228 L157 228Z', C.white) +
      `<circle cx="167" cy="221" r="4" fill="${C.red}"/>`,
  }),
  hand({
    // 太宰府的梅枝餅
    id: 'fukuoka-umegae',
    name: '梅枝餅',
    pref: 'fukuoka',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M136 232 L148 206 L198 210 L190 238Z', C.white) +
      `<ellipse cx="181" cy="214" rx="14" ry="10" fill="${C.cream}" ${E}/>` +
      `<ellipse cx="160" cy="222" rx="17" ry="12" fill="${C.cream}" ${E}/>` +
      `<path d="M150 216 L156 212 M166 228 L172 224 M152 228 L156 226 M178 208 L184 206" ${line(2.4, C.brown, 0.5)}/>` +
      [0, 72, 144, 216, 288].map((a) => `<circle cx="160" cy="218.6" r="2.2" fill="none" stroke="${C.brown}" stroke-opacity=".5" transform="rotate(${a} 160 222)"/>`).join(''),
  }),
  hand({
    // 小城羊羹（佐賀）：外面一層糖結成白色的「昔羊羹」
    id: 'saga-yokan',
    name: '小城羊羹',
    pref: 'saga',
    rarity: 1,
    icon: ICON.hand,
    svg:
      `<g transform="rotate(-18 170 216)">` +
      shape('M146 206 L194 206 L194 226 L146 226Z', C.red) +
      tint('M146 206 L194 206 L194 226 L146 226Z', C.ink, 0.5) +
      shape('M146 206 L194 206 L194 211 L146 211Z', C.cream) +
      dots(C.white, 0.9, [
        [152, 214],
        [166, 218],
        [180, 215],
      ], 'opacity=".5"') +
      shape('M144 204 L162 204 L162 228 L144 228Z', C.white) +
      `<circle cx="153" cy="216" r="3.4" fill="${C.red}"/>` +
      `</g>`,
  }),
  hand({
    // 長崎的角煮包（角煮まんじゅう）
    id: 'nagasaki-kakuni',
    name: '角煮包',
    pref: 'nagasaki',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M140 226 C150 234 182 234 196 226 C196 236 182 242 168 242 C154 242 140 236 140 226Z', C.white) +
      `<path d="M144 230 C152 226 160 230 168 226 C176 230 184 226 194 228" ${line(3, C.green)}/>` +
      shape('M144 222 C156 214 182 212 196 218 L194 226 C180 222 158 224 146 230Z', C.brown) +
      `<path d="M150 222 C162 217 180 216 192 220" ${line(1.4, C.cream, 0.7)}/>` +
      shape('M138 222 C138 202 152 194 170 194 C188 194 200 204 200 220 C190 214 176 212 168 214 C156 216 146 220 138 222Z', C.white),
  }),
  hand({
    // 辛子蓮根（熊本的郷土料理）
    id: 'kumamoto-karashirenkon',
    name: '辛子蓮藕',
    pref: 'kumamoto',
    rarity: 1,
    icon: ICON.hand,
    svg:
      shape('M140 226 L180 200 C190 196 200 206 192 214 L152 240 C142 244 134 232 140 226Z', C.yellow) +
      tint('M140 226 L180 200 C190 196 200 206 192 214 L152 240 C142 244 134 232 140 226Z', C.orange, 0.3) +
      `<ellipse cx="189" cy="207" rx="8" ry="10" fill="${C.cream}" ${E} transform="rotate(-34 189 207)"/>` +
      dots(C.yellow, 1.8, [
        [189, 202],
        [193, 207],
        [186, 210],
        [189, 213],
        [185, 204],
      ]) +
      `<circle cx="158" cy="194" r="12" fill="${C.yellow}" ${E}/><circle cx="158" cy="194" r="9" fill="${C.cream}"/>` +
      dots(C.yellow, 2, [
        [158, 194],
        [153, 190],
        [163, 190],
        [153, 198],
        [163, 198],
      ]),
  }),
  hand({
    // 大分的臭橙（かぼす），產量日本第一
    id: 'oita-kabosu',
    name: '臭橙',
    pref: 'oita',
    rarity: 1,
    icon: ICON.hand,
    svg:
      fruit(C.green, { leaf: false, stem: C.green }) +
      dots(
        C.white,
        0.9,
        [
          [154, 212],
          [160, 224],
          [176, 214],
          [182, 226],
          [168, 232],
        ],
        'opacity=".35"',
      ) +
      `<circle cx="146" cy="230" r="11" fill="${C.green}" ${E}/><circle cx="146" cy="230" r="9" fill="${C.yellow}"/>` +
      `<path d="M146 222 L146 238 M138.5 226 L153.5 234 M153.5 226 L138.5 234" ${line(1, C.white, 0.9)}/>` +
      `<circle cx="146" cy="230" r="1.6" fill="${C.white}"/>`,
  }),
  hand({
    // 西都原古墳群的埴輪（舞蹈的人）
    id: 'miyazaki-haniwa',
    name: '埴輪',
    pref: 'miyazaki',
    rarity: 2,
    icon: '128 156 80 88',
    svg:
      `<path d="M182 202 L194 182 M160 206 L150 222" ${line(6, C.orange)}/>` +
      `<path d="M182 202 L194 182 M160 206 L150 222" ${line(6, C.brown, 0.3)}/>` +
      shape('M156 238 L160 198 C160 186 182 186 182 198 L186 238Z', C.orange) +
      tint('M156 238 L160 198 C160 186 182 186 182 198 L186 238Z', C.brown, 0.3) +
      `<path d="M158 222 L184 222" ${line(1.4, C.brown, 0.45)}/>` +
      `<ellipse cx="171" cy="180" rx="11" ry="13" fill="${C.orange}" ${E}/>` +
      `<ellipse cx="171" cy="180" rx="11" ry="13" fill="${C.brown}" opacity=".3"/>` +
      `<ellipse cx="167" cy="178" rx="2" ry="3" fill="${C.ink}"/><ellipse cx="175" cy="178" rx="2" ry="3" fill="${C.ink}"/><ellipse cx="171" cy="188" rx="2.4" ry="3" fill="${C.ink}"/>`,
  }),
  hand({
    // 薩摩揚（鹿兒島的郷土料理）
    id: 'kagoshima-satsumaage',
    name: '薩摩炸魚餅',
    pref: 'kagoshima',
    rarity: 1,
    icon: '124 192 92 52',
    svg:
      plate(C.white) +
      `<ellipse cx="150" cy="223" rx="13" ry="8" fill="${C.orange}" ${E}/>` +
      shape('M162 222 C162 216 196 216 196 222 C196 228 162 228 162 222Z', C.orange) +
      `<circle cx="178" cy="211" r="10" fill="${C.orange}" ${E}/>` +
      tint('M162 222 C162 216 196 216 196 222 C196 228 162 228 162 222Z', C.brown, 0.25) +
      dots(C.green, 1.2, [
        [174, 208],
        [182, 212],
      ]) +
      dots(C.red, 1.2, [
        [178, 205],
        [176, 214],
      ]),
  }),
  hand({
    // 沖繩的三線：蛇皮的胴、黑色的棹
    id: 'okinawa-sanshin',
    name: '三線',
    pref: 'okinawa',
    rarity: 3,
    icon: '124 108 104 140',
    svg:
      `<path d="M160 222 L214 132" ${line(5, C.ink)}/>` +
      `<path d="M214 132 C218 126 220 120 216 116" ${line(5, C.ink)}/>` +
      `<path d="M208 136 L200 132 M212 130 L220 132 M206 142 L198 138" ${line(2.4, C.cream)}/>` +
      `<g transform="rotate(-30 160 222)">` +
      shape('M144 208 L176 208 C178 208 178 236 176 236 L144 236 C142 236 142 208 144 208Z', C.ink) +
      shape('M146 210 L174 210 L174 234 L146 234Z', C.grey) +
      `<path d="M146 210 L174 210 L174 234 L146 234Z" fill="url(#doll-kikko)"/>` +
      `</g>` +
      `<path d="M158 226 L212 136 M161 227 L215 138" ${line(0.6, C.white, 0.7)}/>`,
  }),
]

export const GOODS_OUTFITS: Outfit[] = [...HEAD, ...HAND]
