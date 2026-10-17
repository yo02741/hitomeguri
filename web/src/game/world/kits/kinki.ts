import type { Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import { registerTileset } from '../../engine/tiles'
import type { Season, TileCtx, TileDef } from '../../engine/types'

import {
  BARK_ROOF,
  bareBranches,
  bevel,
  blossoms,
  foliage,
  grassTint,
  grassTones,
  GRAY_ROOF,
  hash2,
  lantern,
  lattice,
  leafTones,
  noren,
  shadow,
  shoji,
  snowCap,
  speckle,
  stone,
  tileRoof,
  type Tones,
  trunk,
  tuft,
  windowPane,
} from './draw'
import { defineObject, idRange, type ObjectCtx } from './objects'

/**
 * 近畿 kit（id 1024–2047，名字 'kinki/…'）：京都的鎮。
 * 地面：草、土路、石畳、碎石、參道、廣場、河、沙、田（四季：水田、綠、金黃＋稻架、冬天的殘株與雪）、苔。
 * 町家（格子、虫籠窓、瓦、暖簾）、民家、土藏、車站、食堂、旅館、老舖、茶屋；
 * 寺社零件（朱色鳥居、拝殿、授与所、石燈籠、狛犬、手水舍、繪馬架、山門、本堂、鐘樓、土塀）；
 * 城（石垣、城門、城跡的平房）、博物館、塔、大門、攤子、提燈、看台的欄杆、橋；
 * 樹：松、櫻、楓、銀杏、梅、柳、竹、杉、闊葉樹、灌木、紫陽花。櫻、梅、楓、銀杏、紫陽花有「開花」的一份，
 * 世界依氣象台的平年值換上去（season.ts）；資料沒有的現象不畫。
 */
const R = idRange(1024, 2047)
const K = 'kinki' as const

// ---------- 地面 ----------
const PAVED = new Set(['kinki/road', 'kinki/stone', 'kinki/sando', 'kinki/plaza', 'kinki/bridge-h', 'kinki/bridge-v', 'kinki/gravel'])
const isPaved = (name?: string) => !!name && (PAVED.has(name) || name.startsWith('world/'))

function grassBase(g: Gfx, c: TileCtx) {
  const k = grassTones(c.season, K)
  g.rect(0, 0, 16, 16, k.base)
  const tint = grassTint(c.season, K)
  if (tint) g.dither(0, 0, 16, 16, tint.k, tint.level)
  const v = c.variant
  if (v === 0) {
    tuft(g, 2, 4, k.dark, k.light)
    tuft(g, 10, 11, k.dark)
    g.px(13, 3, k.light)
  } else if (v === 1) {
    g.px(4, 12, k.light)
    g.px(11, 5, k.light)
    g.px(7, 2, k.dark)
    g.px(13, 13, k.dark)
    g.px(1, 7, k.dark)
  } else if (v === 2) {
    tuft(g, 6, 8, k.dark, k.light)
    g.px(2, 13, k.light)
    g.px(13, 1, k.dark)
  } else {
    speckle(g, 0, 0, 16, 16, k.dark, 0.05, 3)
    tuft(g, 11, 3, k.dark)
    if (c.season === 'winter') {
      // 冬：偶爾一小塊殘雪
      g.dither(2, 9, 6, 3, 'snow-2', 8)
      g.hline(3, 6, 10, 'snow-1')
    }
  }
}

/** 沒接到同類的那一邊：草長進來（土路、石畳的邊） */
function grassFringe(g: Gfx, c: TileCtx, deep = 2) {
  const k = grassTones(c.season, K)
  if (!(c.mask & 1)) {
    g.rect(0, 0, 16, 1, k.base)
    g.dither(0, 1, 16, deep, k.base, 8)
  }
  if (!(c.mask & 4)) {
    g.rect(0, 15, 16, 1, k.base)
    g.dither(0, 15 - deep, 16, deep, k.base, 8)
  }
  if (!(c.mask & 8)) {
    g.rect(0, 0, 1, 16, k.base)
    g.dither(1, 0, deep, 16, k.base, 8)
  }
  if (!(c.mask & 2)) {
    g.rect(15, 0, 1, 16, k.base)
    g.dither(15 - deep, 0, deep, 16, k.base, 8)
  }
}

const GROUND: TileDef[] = [
  { id: R.take(1), name: 'kinki/grass', layer: 'ground', behavior: 'walk', variants: 4, draw: grassBase },
  {
    id: R.take(1),
    name: 'kinki/road',
    layer: 'ground',
    behavior: 'walk',
    variants: 3,
    connect: (o) => isPaved(o?.name),
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'dirt-1')
      speckle(g, 0, 0, 16, 16, 'dirt-2', 0.06, c.variant + 11)
      speckle(g, 0, 0, 16, 16, 'sand-1', 0.03, c.variant + 21)
      if (c.variant === 1) {
        g.hline(3, 5, 9, 'dirt-2')
        g.px(4, 8, 'sand-2')
      }
      grassFringe(g, c)
    },
  },
  {
    id: R.take(1),
    name: 'kinki/stone',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    connect: (o) => isPaved(o?.name),
    draw(g, c) {
      // 石畳：錯開的長方形石板
      g.rect(0, 0, 16, 16, 'stone-1')
      for (let row = 0; row < 4; row++) {
        const y = row * 4
        g.hline(0, 15, y + 3, 'stone-2')
        const off = (row + c.variant) % 2 ? 2 : 6
        for (let x = off; x < 16; x += 8) g.vline(x, y, y + 2, 'stone-2')
        g.px(((row * 5 + c.variant * 3) % 14) + 1, y + 1, 'white')
      }
      // 路緣：沒接到的那一邊是深一點的石
      if (!(c.mask & 1)) g.hline(0, 15, 0, 'stone-3')
      if (!(c.mask & 4)) {
        g.hline(0, 15, 15, 'stone-3')
        g.hline(0, 15, 14, 'stone-2')
      }
      if (!(c.mask & 8)) g.vline(0, 0, 15, 'stone-3')
      if (!(c.mask & 2)) g.vline(15, 0, 15, 'stone-3')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/gravel',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'stone-1')
      speckle(g, 0, 0, 16, 16, 'stone-2', 0.18, 31 + c.variant)
      speckle(g, 0, 0, 16, 16, 'white', 0.08, 41 + c.variant)
      speckle(g, 0, 0, 16, 16, 'paper-2', 0.06, 51 + c.variant)
    },
  },
  {
    id: R.take(1),
    name: 'kinki/sando',
    layer: 'ground',
    behavior: 'walk',
    connect: (o) => o?.name === 'kinki/sando',
    draw(g, c) {
      // 參道：碎石上一塊一塊的長石板
      g.rect(0, 0, 16, 16, 'stone-1')
      speckle(g, 0, 0, 16, 16, 'stone-2', 0.16, 61)
      const l = c.mask & 8 ? 0 : 2
      const r = c.mask & 2 ? 15 : 13
      for (const y of [0, 8]) {
        g.rect(l, y + 1, r - l + 1, 6, 'paper-2')
        g.hline(l, r, y + 1, 'white')
        g.hline(l, r, y + 7, 'stone-3')
        if (!(c.mask & 8)) g.vline(l, y + 1, y + 7, 'stone-3')
        if (!(c.mask & 2)) g.vline(r, y + 1, y + 7, 'stone-3')
        g.px(l + 3, y + 4, 'stone-2')
      }
    },
  },
  {
    id: R.take(1),
    name: 'kinki/plaza',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      // 站前廣場：方磚
      g.rect(0, 0, 16, 16, 'paper-2')
      for (const y of [0, 8]) for (const x of [0, 8]) bevel(g, x, y, 8, 8, (x + y) / 8 % 2 ? 'stone-1' : 'paper-2', 'paper', 'stone-2')
      if (c.variant) g.px(5, 11, 'stone-2')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/water',
    layer: 'ground',
    behavior: 'water',
    frames: 4,
    fps: 2.5,
    connect: (o) => !!o && (o.name === 'kinki/water' || o.name.startsWith('kinki/bridge')),
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'sea-2')
      const f = c.frame
      for (const [x, y] of [[1, 2], [8, 6], [3, 10], [11, 13]] as const) {
        const xx = (x + f * 2) % 16
        g.hline(xx, Math.min(15, xx + 3), y, 'sea-1')
        g.px((xx + 9) % 16, (y + 2) % 16, 'sea-3')
      }
      // 岸：石砌的河岸（上面那一邊看得到石的側面）
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 4, 'stone-2')
        g.hline(0, 15, 0, 'stone-1')
        for (let x = 1; x < 16; x += 5) g.vline(x, 1, 3, 'stone-3')
        g.hline(0, 15, 4, 'sea-3')
      }
      if (!(c.mask & 4)) {
        g.hline(0, 15, 15, 'stone-2')
        g.hline(0, 15, 14, f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 8)) {
        g.rect(0, 0, 2, 16, 'stone-2')
        g.vline(2, 0, 15, f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 2)) {
        g.rect(14, 0, 2, 16, 'stone-2')
        g.vline(13, 0, 15, f % 2 ? 'sea-1' : 'foam')
      }
    },
  },
  {
    id: R.take(1),
    name: 'kinki/sand',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'sand-1')
      speckle(g, 0, 0, 16, 16, 'sand-2', 0.1, 71 + c.variant)
      speckle(g, 0, 0, 16, 16, 'stone-1', 0.03, 81 + c.variant)
    },
  },
  {
    id: R.take(1),
    name: 'kinki/field',
    layer: 'ground',
    behavior: 'block',
    variants: 3,
    connect: (o) => o?.name === 'kinki/field',
    draw: field,
  },
  {
    id: R.take(1),
    name: 'kinki/moss',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      const winter = c.season === 'winter'
      g.rect(0, 0, 16, 16, winter ? 'leaf-4' : 'leaf-3')
      g.dither(0, 0, 16, 16, winter ? 'leaf-3' : 'leaf-2', 4)
      speckle(g, 0, 0, 16, 16, winter ? 'stone-2' : 'leaf-1', 0.04, 91 + c.variant)
    },
  },
  {
    id: R.take(1),
    name: 'kinki/stepstone',
    layer: 'ground',
    behavior: 'walk',
    draw(g, c) {
      const winter = c.season === 'winter'
      g.rect(0, 0, 16, 16, winter ? 'leaf-4' : 'leaf-3')
      g.dither(0, 0, 16, 16, winter ? 'leaf-3' : 'leaf-2', 4)
      stone(g, 3, 4, 10, 8, 'stone-1', 'white', 'stone-2', 'stone-3')
    },
  },
  ...(['h', 'v'] as const).map(
    (d): TileDef => ({
      id: R.take(1),
      name: `kinki/bridge-${d}`,
      layer: 'ground',
      behavior: 'walk',
      draw(g, c) {
        // 木橋：下面是水，橋板、欄杆（欄杆畫在兩側，不擋路）
        g.rect(0, 0, 16, 16, 'sea-2')
        g.hline(0, 15, (c.frame * 3) % 16, 'sea-1')
        if (d === 'h') {
          g.rect(0, 2, 16, 12, 'wood-1')
          for (let x = 1; x < 16; x += 3) g.vline(x, 3, 12, 'wood-2')
          g.rect(0, 1, 16, 2, 'wood-3')
          g.rect(0, 13, 16, 2, 'wood-3')
          g.hline(0, 15, 1, 'wood-2')
          for (const x of [3, 11]) {
            g.rect(x, 0, 2, 3, 'wood-3')
            g.rect(x, 13, 2, 3, 'wood-3')
          }
        } else {
          g.rect(2, 0, 12, 16, 'wood-1')
          for (let y = 1; y < 16; y += 3) g.hline(3, 12, y, 'wood-2')
          g.rect(1, 0, 2, 16, 'wood-3')
          g.rect(13, 0, 2, 16, 'wood-3')
          g.vline(1, 0, 15, 'wood-2')
          for (const y of [3, 11]) {
            g.rect(0, y, 3, 2, 'wood-3')
            g.rect(13, y, 3, 2, 'wood-3')
          }
        }
      },
    }),
  ),
]

/** 田（規格 §8.2：季節換：水田、綠、金黃、稻架、雪） */
function field(g: Gfx, c: TileCtx) {
  const s = c.season
  if (s === 'spring') {
    // 水田：水面＋一排一排的秧苗
    g.rect(0, 0, 16, 16, 'sea-1')
    g.dither(0, 0, 16, 16, 'sea-2', 3)
    for (let y = 2; y < 16; y += 4) for (let x = 1 + ((y / 4) % 2); x < 16; x += 3) g.px(x, y, 'leaf-2')
    g.hline(0, 15, (c.variant * 5 + 3) % 16, 'foam')
  } else if (s === 'summer') {
    g.rect(0, 0, 16, 16, 'leaf-2')
    for (let x = 1; x < 16; x += 3) {
      g.vline(x, 0, 15, 'leaf-3')
      for (let y = (x * 3) % 4; y < 16; y += 4) g.px(x + 1, y, 'leaf-1')
    }
  } else if (s === 'autumn') {
    g.rect(0, 0, 16, 16, 'gold-1')
    for (let x = 1; x < 16; x += 3) {
      g.vline(x, 0, 15, 'gold-2')
      for (let y = (x * 5) % 4; y < 16; y += 4) g.px(x + 1, y, 'sand-1')
    }
    if (c.variant === 2) {
      // 稻架：木樁＋掛著的稻束
      g.rect(0, 0, 16, 16, 'dirt-1')
      speckle(g, 0, 0, 16, 16, 'gold-2', 0.2, 101)
      g.vline(1, 2, 13, 'wood-3')
      g.vline(14, 2, 13, 'wood-3')
      g.hline(0, 15, 3, 'wood-3')
      for (let x = 2; x < 14; x += 2) {
        g.vline(x, 4, 10, 'gold-2')
        g.vline(x + 1, 4, 9, 'gold-1')
      }
      g.dither(1, 12, 14, 2, 'ink-2', 6)
    }
  } else {
    // 冬：收割後的殘株，偶爾積雪
    g.rect(0, 0, 16, 16, 'dirt-1')
    for (let y = 2; y < 16; y += 4) for (let x = 1 + ((y / 4) % 2) * 2; x < 16; x += 4) g.vline(x, y, y + 1, 'dirt-2')
    if (c.variant === 1) {
      g.dither(0, 0, 16, 16, 'snow-1', 10)
      speckle(g, 0, 0, 16, 16, 'snow-2', 0.2, 111)
    }
  }
  // 田埂：沒接到田的那一邊是一條草
  const k = grassTones(s, K)
  if (!(c.mask & 1)) {
    g.rect(0, 0, 16, 2, k.base)
    g.hline(0, 15, 2, k.dark)
  }
  if (!(c.mask & 4)) g.rect(0, 14, 16, 2, k.base)
  if (!(c.mask & 8)) g.rect(0, 0, 2, 16, k.base)
  if (!(c.mask & 2)) g.rect(14, 0, 2, 16, k.base)
}

// ---------- 一格的東西（下層、上層） ----------
const SMALL: TileDef[] = [
  {
    id: R.take(1),
    name: 'kinki/sign',
    layer: 'lower',
    behavior: 'sign',
    draw(g) {
      // 高札風的告示牌：兩根柱子、小屋頂、白板
      shadow(g, 8, 14, 6, 1)
      g.rect(3, 6, 2, 9, 'wood-3')
      g.rect(11, 6, 2, 9, 'wood-3')
      g.rect(2, 4, 12, 8, 'wood-3')
      g.rect(3, 5, 10, 6, 'paper')
      g.hline(4, 11, 7, 'stone-2')
      g.hline(4, 9, 9, 'stone-2')
      g.rect(1, 2, 14, 2, 'roof-2')
      g.hline(1, 14, 2, 'roof-1')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/dobe',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && (o.name === 'kinki/dobe' || o.name.startsWith('kinki/sanmon') || o.name.startsWith('kinki/gate')),
    draw(g, c) {
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      if (vert) {
        // 縱向的土塀：從上面看是一條瓦頂
        g.rect(4, 0, 8, 16, 'dirt-1')
        g.rect(5, 0, 6, 16, 'roof-2')
        g.vline(5, 0, 15, 'roof-1')
        g.vline(10, 0, 15, 'roof-3')
        for (let y = 1; y < 16; y += 4) g.hline(6, 9, y, 'roof-3')
        if (!(c.mask & 4)) {
          g.rect(4, 12, 8, 4, 'dirt-1')
          g.hline(4, 11, 15, 'stone-3')
        }
        return
      }
      // 橫向：瓦頂、白壁（定規筋）、石基
      g.rect(0, 3, 16, 3, 'roof-2')
      g.hline(0, 15, 3, 'roof-1')
      g.hline(0, 15, 6, 'roof-3')
      for (let x = (c.mask & 8 ? 0 : 1); x < 16; x += 4) g.vline(x, 4, 5, 'roof-3')
      g.rect(0, 7, 16, 7, 'paper')
      g.dither(0, 7, 16, 2, 'paper-2', 8)
      g.rect(0, 13, 16, 3, 'stone-2')
      g.hline(0, 15, 13, 'stone-3')
      g.hline(0, 15, 15, 'stone-4')
      if (!(c.mask & 8)) g.vline(0, 3, 15, 'stone-4')
      if (!(c.mask & 2)) g.vline(15, 3, 15, 'stone-4')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/ishigaki',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && (o.name === 'kinki/ishigaki' || o.name.startsWith('kinki/castle-gate')),
    draw(g, c) {
      // 石垣：大小不一的石頭，上緣一條亮
      g.rect(0, 0, 16, 16, 'stone-3')
      const rows: Array<[number, number[]]> = [
        [0, [0, 7, 12]],
        [5, [0, 4, 10]],
        [10, [0, 6, 11]],
      ]
      for (const [y, xs] of rows)
        xs.forEach((x, i) => {
          const w = (xs[i + 1] ?? 16) - x
          stone(g, x, y, w, y === 10 ? 6 : 5, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
        })
      if (!(c.mask & 1)) {
        g.hline(0, 15, 0, 'stone-1')
        g.hline(0, 15, 1, 'leaf-3')
      }
      if (!(c.mask & 8)) g.vline(0, 0, 15, 'stone-4')
      if (!(c.mask & 2)) g.vline(15, 0, 15, 'stone-4')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/fence',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'kinki/fence',
    draw(g, c) {
      // 竹垣（四ツ目垣）
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      if (vert) {
        g.vline(7, 0, 15, 'wood-1')
        g.vline(8, 0, 15, 'wood-2')
        for (const y of [3, 11]) g.rect(5, y, 6, 2, 'leaf-3')
        return
      }
      const l = c.mask & 8 ? 0 : 2
      const r = c.mask & 2 ? 15 : 13
      shadow(g, 8, 14, 7, 1)
      for (const y of [6, 10]) {
        g.hline(l, r, y, 'leaf-1')
        g.hline(l, r, y + 1, 'leaf-3')
      }
      for (const x of [2, 7, 12]) {
        g.rect(x, 4, 2, 10, 'leaf-2')
        g.vline(x + 1, 4, 13, 'leaf-3')
        g.px(x, 4, 'leaf-1')
      }
    },
  },
  {
    id: R.take(1),
    name: 'kinki/hedge',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'kinki/hedge',
    draw(g, c) {
      const t = leafTones(c.season === 'winter' ? 'summer' : c.season, K)
      shadow(g, 8, 14, 8, 1)
      g.rect(c.mask & 8 ? 0 : 1, 3, 16 - (c.mask & 8 ? 0 : 1) - (c.mask & 2 ? 0 : 1), 11, t.line)
      g.rect(c.mask & 8 ? 0 : 2, 4, 16 - (c.mask & 8 ? 0 : 2) - (c.mask & 2 ? 0 : 2), 9, t.mid)
      g.dither(0, 9, 16, 4, t.dark, 8)
      for (let x = 1; x < 15; x += 4) {
        g.px(x, 5, t.light)
        g.px(x + 1, 5, t.light)
        g.px(x + 2, 6, t.light)
      }
    },
  },
  {
    id: R.take(1),
    name: 'kinki/bush',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      const t = leafTones(c.season === 'winter' ? 'summer' : c.season, K)
      shadow(g, 8, 14, 6, 1)
      foliage(g, 8, 9, 6, 5, t, 3 + c.variant)
      if (c.season === 'winter') g.hline(4, 10, 4, 'snow-2')
    },
  },
  ...ajisai(),
  {
    id: R.take(1),
    name: 'kinki/rock',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      shadow(g, 8, 13, 6, 2)
      if (c.variant) stone(g, 2, 5, 12, 9, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
      else {
        stone(g, 1, 7, 9, 7, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
        stone(g, 8, 4, 7, 9, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
      }
      if (c.season !== 'winter') g.px(4, 8, 'leaf-3')
    },
  },
  ...(['l', 'r'] as const).map(
    (side): TileDef => ({
      id: R.take(1),
      name: `kinki/komainu-${side}`,
      layer: 'lower',
      behavior: 'block',
      draw(g) {
        // 狛犬：石台＋坐著的石獸（左右相對）
        const f = side === 'r'
        const X = (x: number) => (f ? 15 - x : x)
        shadow(g, 8, 15, 7, 1)
        g.rect(2, 11, 12, 4, 'stone-3')
        g.rect(3, 11, 10, 3, 'stone-2')
        g.hline(3, 12, 11, 'stone-1')
        // 身體
        for (const [x, y, w, h] of [[5, 5, 6, 6], [4, 3, 5, 4], [9, 7, 3, 4]] as const) {
          const xx = f ? 16 - x - w : x
          g.rect(xx, y, w, h, 'stone-2')
        }
        g.px(X(4), 3, 'stone-4')
        g.px(X(5), 4, 'ink-2')
        g.hline(Math.min(X(4), X(8)), Math.max(X(4), X(8)), 2, 'stone-1')
        g.px(X(11), 5, 'stone-3')
        g.px(X(12), 4, 'stone-3')
        g.vline(X(10), 7, 10, 'stone-3')
      },
    }),
  ),
  {
    id: R.take(1),
    name: 'kinki/bench',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      shadow(g, 8, 14, 7, 1)
      g.rect(1, 6, 14, 4, 'wood-1')
      g.hline(1, 14, 6, 'paper-2')
      g.hline(1, 14, 9, 'wood-3')
      g.rect(2, 10, 2, 4, 'wood-3')
      g.rect(12, 10, 2, 4, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/bench-red',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 茶屋的床几：紅毛氈
      shadow(g, 8, 14, 7, 1)
      g.rect(1, 5, 14, 5, 'shu-1')
      g.hline(1, 14, 5, 'momiji-1')
      g.rect(1, 9, 14, 2, 'shu-2')
      g.rect(2, 11, 2, 3, 'wood-3')
      g.rect(12, 11, 2, 3, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/telescope',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      shadow(g, 8, 14, 4, 1)
      g.vline(8, 7, 14, 'stone-3')
      g.hline(6, 10, 14, 'stone-4')
      g.rect(4, 3, 8, 4, 'cloth-1')
      g.hline(4, 11, 3, 'sky-day-3')
      g.rect(10, 4, 3, 2, 'ink-2')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/railing',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'kinki/railing',
    draw(g, c) {
      // 看台的欄杆（地面是木板）
      g.rect(0, 0, 16, 16, 'wood-1')
      for (let y = 1; y < 16; y += 4) g.hline(0, 15, y, 'wood-2')
      g.rect(0, 9, 16, 2, 'wood-3')
      g.hline(0, 15, 9, 'wood-2')
      for (const x of [1, 8, 14]) if ((x !== 1 || !(c.mask & 8)) && (x !== 14 || !(c.mask & 2))) g.rect(x, 7, 2, 8, 'wood-3')
      g.rect(0, 14, 16, 2, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/deck',
    layer: 'ground',
    behavior: 'walk',
    draw(g) {
      g.rect(0, 0, 16, 16, 'wood-1')
      for (let y = 3; y < 16; y += 4) g.hline(0, 15, y, 'wood-2')
      g.vline(5, 0, 2, 'wood-2')
      g.vline(11, 4, 6, 'wood-2')
      g.vline(3, 8, 10, 'wood-2')
      g.vline(13, 12, 14, 'wood-2')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/chochin',
    layer: 'over',
    connect: (o) => o?.name === 'kinki/chochin',
    draw(g, c) {
      // 祭典的提燈：一條繩子、紅白相間，夜裡亮
      const night = c.time !== 'day'
      g.line(0, 2, 7, 4, 'ink-2')
      g.line(8, 4, 15, 2, 'ink-2')
      lantern(g, 2, 3, night, 'shu-1')
      lantern(g, 10, 3, night, c.mask & 2 ? 'white' : 'shu-1')
    },
  },
  {
    id: R.take(1),
    name: 'kinki/arcade',
    layer: 'over',
    connect: (o) => o?.name === 'kinki/arcade',
    draw(g, c) {
      // 拱廊的屋頂：鐵架（橫梁兩道）＋採光板的細條（只畫條，不整塊抖色：下面的路與人看得清楚）
      g.hline(0, 15, 0, 'stone-3')
      g.hline(0, 15, 1, 'stone-4')
      g.hline(0, 15, 8, 'stone-3')
      g.hline(0, 15, 9, 'stone-4')
      g.hline(0, 15, 3, 'sky-day-3')
      g.hline(0, 15, 11, 'sky-day-3')
      // 縱的鐵架：每格兩根細的，外側（沒有接著拱廊的那一邊）粗一點
      g.vline(4, 0, 9, 'stone-3')
      g.vline(11, 0, 9, 'stone-3')
      if (!(c.mask & 8)) g.rect(0, 0, 2, 16, 'stone-4')
      if (!(c.mask & 2)) g.rect(14, 0, 2, 16, 'stone-4')
    },
  },
]

/** 紫陽花：葉叢＋開花的一份（平年的開花日起約一個月） */
function ajisai(): TileDef[] {
  const draw = (bloom: boolean) => (g: Gfx, c: TileCtx) => {
    const winter = c.season === 'winter'
    const t: Tones = winter ? { line: 'wood-3', dark: 'wood-2', mid: 'dirt-2', light: 'dirt-1' } : leafTones('summer', K)
    shadow(g, 8, 14, 6, 1)
    foliage(g, 8, 9, 6, 5, t, 9)
    if (bloom && !winter)
      for (const [x, y, k] of [[5, 6, 'ajisai'], [10, 7, 'lavender'], [7, 10, 'ajisai'], [11, 11, 'lavender'], [4, 10, 'lavender']] as const) {
        g.rect(x - 1, y - 1, 3, 3, k)
        g.px(x, y, 'white')
        g.px(x + 1, y + 1, 'cloth-2')
      }
  }
  return [
    { id: R.take(1), name: 'kinki/ajisai', layer: 'lower', behavior: 'block', draw: draw(false) },
    { id: R.take(1), name: 'kinki/ajisai@bloom', layer: 'lower', behavior: 'block', draw: draw(true) },
  ]
}

// ---------- 樹 ----------
const winterOf = (c: TileCtx) => c.season === 'winter'

const TREES: TileDef[] = [
  ...defineObject({
    id: R.take(4),
    name: 'kinki/pine',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    draw(g, c) {
      // 松：一層一層的雲形葉叢，枝幹斜出
      const t: Tones = { line: 'leaf-4', dark: 'leaf-4', mid: 'leaf-3', light: 'leaf-2' }
      shadow(g, 16, 29, 11, 2)
      trunk(g, 14, 16, 29, 4)
      g.line(16, 18, 9, 13, 'wood-3')
      g.line(17, 16, 25, 10, 'wood-3')
      for (const [x, y, rx, ry] of [[15, 6, 8, 4], [7, 13, 6, 3], [25, 11, 6, 3], [16, 17, 5, 2]] as const) {
        g.ellipse(x, y, rx + 1, ry + 1, t.line)
        g.ellipse(x, y, rx, ry, t.mid)
        g.dither(x - rx, y, rx * 2, ry + 1, t.dark, 8)
        g.hline(x - rx + 2, x, y - ry + 1, t.light)
        speckle(g, x - rx, y - ry, rx * 2, ry, t.light, 0.1, x + y)
      }
      if (winterOf(c)) for (const [x, y, rx, ry] of [[15, 6, 8, 4], [7, 13, 6, 3], [25, 11, 6, 3]] as const) g.hline(x - rx + 2, x + rx - 2, y - ry, 'snow-1')
    },
  }),
  ...defineObject({
    id: R.take(8),
    name: 'kinki/sakura',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    bloom: true,
    draw(g, c) {
      shadow(g, 16, 29, 12, 2)
      trunk(g, 14, 17, 29, 4, 'ink-2', 'ink', 'wood-3')
      g.line(15, 19, 8, 12, 'ink-2')
      g.line(17, 18, 24, 11, 'ink-2')
      if (c.bloom) {
        foliage(g, 16, 11, 14, 10, { line: 'sakura-2', dark: 'sakura-2', mid: 'sakura-1', light: 'white' }, 21)
        blossoms(g, 16, 11, 12, 8, 'white', 'sakura-2', 0.12, 5)
        return
      }
      if (winterOf(c)) {
        bareBranches(g, 16, 12, 12, 9, 'ink-2', 4)
        return
      }
      const t: Tones = c.season === 'autumn' ? { line: 'leaf-4', dark: 'momiji-2', mid: 'leaf-3', light: 'momiji-1' } : leafTones(c.season, K)
      foliage(g, 16, 11, 13, 9, t, 21)
    },
  }),
  ...defineObject({
    id: R.take(8),
    name: 'kinki/kaede',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    bloom: true,
    draw(g, c) {
      // 楓：開花＝紅葉（平年的紅葉日前後）
      shadow(g, 16, 29, 11, 2)
      trunk(g, 15, 18, 29, 3, 'wood-3', 'ink-2', 'wood-2')
      if (winterOf(c) && !c.bloom) {
        bareBranches(g, 16, 13, 11, 9, 'wood-3', 8)
        return
      }
      const t: Tones = c.bloom ? { line: 'shu-3', dark: 'momiji-2', mid: 'shu-1', light: 'momiji-1' } : leafTones(c.season === 'winter' ? 'autumn' : c.season, K)
      foliage(g, 16, 12, 13, 9, t, 33)
      // 楓葉的星形小點
      speckle(g, 4, 4, 24, 16, c.bloom ? 'gold-1' : t.light, 0.05, 7)
    },
  }),
  ...defineObject({
    id: R.take(6),
    name: 'kinki/ichou',
    w: 1,
    h: 3,
    cells: ['o', 'o', 'L'],
    bloom: true,
    draw(g, c) {
      // 銀杏：細高的樹形；開花＝黃葉
      shadow(g, 8, 45, 6, 2)
      trunk(g, 7, 26, 45, 3)
      if (winterOf(c) && !c.bloom) {
        g.vline(8, 6, 30, 'wood-3')
        for (let y = 10; y < 30; y += 5) {
          g.line(8, y, 3, y - 4, 'wood-3')
          g.line(8, y + 2, 13, y - 2, 'wood-3')
        }
        return
      }
      const t: Tones = c.bloom ? { line: 'gold-2', dark: 'gold-2', mid: 'gold-1', light: 'sand-1' } : leafTones(c.season === 'winter' ? 'autumn' : c.season, K)
      g.poly([8, 1, 15, 22, 13, 31, 3, 31, 1, 22], t.line)
      g.poly([8, 3, 14, 22, 12, 30, 4, 30, 2, 22], t.mid)
      g.dither(9, 8, 6, 22, t.dark, 8)
      for (let y = 8; y < 30; y += 6) {
        g.hline(4, 7, y, t.light)
        g.px(5, y + 1, t.light)
      }
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'kinki/ume',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    bloom: true,
    draw(g, c) {
      // 梅：彎曲的枝；開花時白、粉的小花點在枝上
      shadow(g, 8, 29, 6, 2)
      trunk(g, 7, 20, 29, 2, 'wood-3', 'ink-2', 'wood-2')
      g.line(8, 21, 3, 12, 'wood-3')
      g.line(8, 20, 12, 10, 'wood-3')
      g.line(4, 13, 6, 6, 'wood-3')
      g.line(11, 12, 13, 5, 'wood-3')
      g.line(6, 7, 9, 4, 'wood-3')
      if (c.bloom) {
        for (const [x, y] of [[3, 11], [5, 7], [6, 5], [9, 4], [12, 6], [13, 9], [11, 11], [7, 9], [4, 9], [10, 8]] as const) {
          g.px(x, y, 'white')
          g.px(x + 1, y, 'sakura-1')
          g.px(x, y - 1, 'sakura-2')
        }
        return
      }
      if (winterOf(c)) return
      const t = leafTones(c.season, K)
      foliage(g, 8, 9, 6, 6, t, 41)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/willow',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 柳：垂下的枝條（春天是嫩綠）
      shadow(g, 8, 29, 6, 2)
      trunk(g, 7, 14, 29, 3, 'wood-2', 'wood-3', 'wood-1')
      const k: Px = c.season === 'spring' ? 'leaf-1' : c.season === 'winter' ? 'dirt-2' : 'leaf-2'
      const d: Px = c.season === 'winter' ? 'wood-3' : 'leaf-3'
      g.ellipse(8, 5, 7, 4, d)
      g.ellipse(8, 5, 6, 3, k)
      for (let x = 1; x < 16; x += 2) {
        const len = 12 + (hash2(x, 3) % 8)
        g.vline(x, 4, Math.min(25, 4 + len), x % 4 ? k : d)
      }
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/bamboo',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 竹：幾根細長的竹竿、竹節，頂上的竹葉
      const stalk: Px = c.season === 'winter' ? 'leaf-3' : 'leaf-2'
      shadow(g, 8, 29, 7, 2, 'leaf-4')
      for (const x of [2, 7, 12]) {
        g.vline(x, 4, 30, stalk)
        g.vline(x + 1, 4, 30, 'leaf-3')
        for (let y = 8 + (x % 3) * 2; y < 30; y += 6) g.hline(x, x + 1, y, 'leaf-4')
        g.px(x, 6, 'leaf-1')
      }
      const t = leafTones(c.season === 'winter' ? 'summer' : 'spring', K)
      for (const [x, y] of [[3, 5], [9, 3], [13, 6], [6, 9]] as const) {
        g.line(x, y, x - 3, y + 2, t.mid)
        g.line(x, y, x + 3, y + 2, t.dark)
        g.px(x, y - 1, t.light)
      }
      if (winterOf(c)) g.hline(1, 14, 3, 'snow-2')
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/sugi',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 杉：深綠的尖錐形（神社的森）
      shadow(g, 8, 29, 6, 2)
      trunk(g, 7, 24, 29, 2, 'wood-2', 'wood-3', 'wood-1')
      const t: Tones = { line: 'leaf-4', dark: 'leaf-4', mid: 'leaf-3', light: 'leaf-2' }
      g.poly([8, 0, 15, 25, 1, 25], t.line)
      g.poly([8, 2, 14, 24, 2, 24], t.mid)
      g.poly([8, 2, 14, 24, 9, 24], t.dark)
      for (let y = 8; y < 24; y += 5) g.line(5, y, 8, y - 3, t.light)
      if (winterOf(c)) {
        g.px(8, 2, 'snow-1')
        g.hline(6, 9, 9, 'snow-2')
      }
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/tree',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 一般的闊葉樹
      shadow(g, 8, 29, 7, 2)
      trunk(g, 6, 18, 29, 4)
      if (winterOf(c)) {
        bareBranches(g, 8, 11, 7, 9, 'wood-3', 2)
        return
      }
      foliage(g, 8, 11, 7, 9, leafTones(c.season, K), 11)
    },
  }),
]

// ---------- 建築 ----------
/** 町家的屋頂：灰瓦、兩側不斜（切妻、平入） */
function machiyaRoof(g: Gfx, x: number, y: number, w: number, h: number, c: TileCtx) {
  tileRoof(g, x, y, w, h, GRAY_ROOF, { slope: 0 })
  if (c.season === 'winter') snowCap(g, x + 2, y + 2, w - 4, x)
}

/** 町家（4×4）：上兩列屋頂、二樓的虫籠窓、一樓的格子與門、暖簾 */
function machiya(g: Gfx, c: TileCtx, o: { style: 0 | 1 | 2; shop?: boolean; door?: boolean }) {
  const night = c.time === 'night'
  machiyaRoof(g, 0, 2, 64, 22, c)
  // 二樓：白壁＋虫籠窓（或深色的木板）
  if (o.style === 1) {
    g.rect(1, 24, 62, 13, 'wood-3')
    for (let x = 2; x < 62; x += 3) g.vline(x, 25, 35, 'wood-2')
  } else {
    g.rect(1, 24, 62, 13, o.style === 2 ? 'paper-2' : 'paper')
    g.dither(1, 24, 62, 3, 'paper-2', 8)
    for (const x of o.style === 2 ? [10, 38] : [6, 24, 42]) {
      g.rect(x, 27, 16, 7, 'ink-2')
      for (let xx = x + 1; xx < x + 16; xx += 2) g.vline(xx, 27, 33, night ? 'lamp-2' : 'paper-2')
      g.frame(x - 1, 26, 18, 9, 'wood-3')
    }
  }
  g.vline(0, 24, 63, 'wood-3')
  g.vline(63, 24, 63, 'wood-3')
  // 一樓的小屋簷
  tileRoof(g, 0, 36, 64, 7, GRAY_ROOF, { ridge: false, rows: 3 })
  // 一樓：千本格子、門
  g.rect(1, 43, 62, 18, 'wood-3')
  const doorX = o.style === 1 ? 6 : 24
  lattice(g, 2, 44, 62 - 2, 16, night ? 'lamp-2' : 'wood-3', 'wood-2', 2)
  // 門（拉門）
  g.rect(doorX, 44, 16, 17, 'wood-3')
  if (o.door || o.shop) {
    g.rect(doorX + 1, 45, 14, 16, night ? 'lamp-1' : 'ink-2')
    lattice(g, doorX + 1, 45, 14, 16, night ? 'lamp-1' : 'paper-2', 'wood-2', 3)
  } else lattice(g, doorX + 1, 45, 14, 16, 'wood-2', 'wood-3', 2)
  if (o.shop) noren(g, doorX - 2, 43, 20, 9, 'cloth-2', 'roof-3')
  // 犬矢來（牆角的竹簾）＋石基
  for (const [a, b] of [[2, doorX - 1], [doorX + 17, 62]] as const) {
    if (b - a < 4) continue
    g.rect(a, 56, b - a, 5, 'wood-2')
    for (let x = a; x < b; x += 2) g.vline(x, 56, 60, 'wood-3')
    g.hline(a, b - 1, 56, 'wood-1')
  }
  g.rect(0, 61, 64, 3, 'stone-2')
  g.hline(0, 63, 63, 'stone-4')
  if (o.shop && night) lantern(g, doorX + 18, 46, true)
}

/** 民家（郊外，4×4）：入母屋的灰瓦、白牆、木柱、緣側 */
function minka(g: Gfx, c: TileCtx, style: 0 | 1) {
  const night = c.time === 'night'
  tileRoof(g, 0, 4, 64, 30, style ? BARK_ROOF : GRAY_ROOF, { slope: 6 })
  if (c.season === 'winter') snowCap(g, 8, 6, 48, 3)
  g.rect(2, 34, 60, 27, 'paper')
  g.dither(2, 34, 60, 4, 'paper-2', 8)
  for (const x of [2, 20, 43, 60]) g.rect(x, 34, 2, 27, 'wood-2')
  g.hline(2, 61, 47, 'wood-2')
  windowPane(g, 6, 38, 11, 8, night)
  windowPane(g, 47, 38, 11, 8, night)
  shoji(g, 24, 38, 16, 22, 'wood-3', night ? 'lamp-1' : 'white')
  g.rect(0, 58, 64, 3, 'wood-1')
  g.hline(0, 63, 58, 'paper-2')
  g.rect(0, 61, 64, 3, 'stone-2')
  g.hline(0, 63, 63, 'stone-4')
}

/** 土藏（3×3）：白漆喰、黑色的腰壁（なまこ壁）、小窗 */
function kura(g: Gfx, c: TileCtx) {
  tileRoof(g, 0, 2, 48, 16, GRAY_ROOF, { slope: 2 })
  if (c.season === 'winter') snowCap(g, 4, 4, 40, 7)
  g.rect(2, 18, 44, 27, 'white')
  g.dither(2, 18, 44, 3, 'paper', 8)
  g.rect(16, 21, 16, 9, 'ink-2')
  g.frame(15, 20, 18, 11, 'stone-3')
  // なまこ壁：深色底＋白的斜格
  g.rect(2, 34, 44, 11, 'roof-3')
  for (let x = 2; x < 46; x += 6) {
    g.line(x, 34, x + 5, 44, 'paper-2')
    g.line(x + 5, 34, x, 44, 'paper-2')
  }
  g.vline(1, 18, 46, 'stone-3')
  g.vline(46, 18, 46, 'stone-3')
  g.rect(0, 45, 48, 3, 'stone-2')
  g.hline(0, 47, 47, 'stone-4')
}

const BUILDINGS: TileDef[] = [
  ...[0, 1, 2].flatMap((style) =>
    defineObject({
      id: R.take(16),
      name: `kinki/machiya-${'abc'[style]}`,
      w: 4,
      h: 4,
      cells: ['OOOO', 'OOOO', 'LLLL', 'LLLL'],
      draw: (g, c) => machiya(g, c, { style: style as 0 | 1 | 2 }),
    }),
  ),
  ...defineObject({
    id: R.take(16),
    name: 'kinki/machiya-shop',
    w: 4,
    h: 4,
    cells: ['OOOO', 'OOOO', 'LLLL', 'LDLL'],
    draw: (g, c) => machiya(g, c, { style: 0, shop: true }),
  }),
  ...defineObject({
    id: R.take(16),
    name: 'kinki/machiya-door',
    w: 4,
    h: 4,
    cells: ['OOOO', 'OOOO', 'LLLL', 'LDLL'],
    draw: (g, c) => machiya(g, c, { style: 2, door: true }),
  }),
  ...[0, 1].flatMap((style) =>
    defineObject({
      id: R.take(12),
      name: `kinki/nagaya-${'ab'[style]}`,
      w: 4,
      h: 3,
      cells: ['OOOO', 'LLLL', 'LLLL'],
      draw(g, c) {
        // 平屋的町家（長屋）：低的瓦屋頂、格子、門
        const night = c.time === 'night'
        tileRoof(g, 0, 1, 64, 17, GRAY_ROOF, { slope: 0 })
        if (c.season === 'winter') snowCap(g, 2, 3, 60, style + 5)
        g.rect(1, 18, 62, 25, style ? 'paper' : 'wood-3')
        if (style) for (const x of [1, 31, 61]) g.rect(x, 18, 2, 25, 'wood-3')
        lattice(g, 4, 22, 22, 16, night ? 'lamp-2' : 'wood-3', 'wood-2', 2)
        g.rect(34, 21, 14, 22, 'wood-3')
        lattice(g, 35, 22, 12, 21, 'wood-2', 'wood-3', 2)
        if (style) shoji(g, 50, 22, 10, 14, 'wood-3', night ? 'lamp-1' : 'white')
        g.rect(0, 43, 64, 5, 'stone-2')
        g.hline(0, 63, 47, 'stone-4')
      },
    }),
  ),
  ...[0, 1].flatMap((style) =>
    defineObject({
      id: R.take(16),
      name: `kinki/minka-${'ab'[style]}`,
      w: 4,
      h: 4,
      cells: ['OOOO', 'OOOO', 'LLLL', 'LLLL'],
      draw: (g, c) => minka(g, c, style as 0 | 1),
    }),
  ),
  ...defineObject({ id: R.take(9), name: 'kinki/kura', w: 3, h: 3, cells: ['OOO', 'LLL', 'LLL'], draw: kura }),
  ...defineObject({
    id: R.take(32),
    name: 'kinki/station',
    w: 8,
    h: 4,
    cells: ['OOOOOOOO', 'OOOOOOOO', 'LLLLLLLL', 'LLLDDLLL'],
    draw(g, c) {
      // 車站：大屋頂、白牆、大片玻璃、站名牌（不寫字：細線代表字）、玻璃門
      const night = c.time === 'night'
      tileRoof(g, 0, 2, 128, 26, GRAY_ROOF, { slope: 8 })
      if (c.season === 'winter') snowCap(g, 10, 4, 108, 5)
      g.rect(2, 28, 124, 33, 'paper')
      g.dither(2, 28, 124, 4, 'paper-2', 8)
      // 站名牌
      g.rect(40, 30, 48, 9, 'cloth-2')
      g.frame(40, 30, 48, 9, 'ink-2')
      for (let x = 44; x < 84; x += 6) g.hline(x, x + 3, 34, 'white')
      for (const x of [6, 22, 92, 108]) windowPane(g, x, 42, 14, 14, night, 'stone-3')
      for (const x of [2, 38, 89, 125]) g.rect(x, 28, 2, 33, 'stone-3')
      // 玻璃門
      g.rect(46, 41, 36, 20, 'stone-3')
      g.rect(48, 43, 32, 18, night ? 'lamp-1' : 'sky-day-2')
      g.vline(63, 43, 60, 'stone-3')
      g.vline(64, 43, 60, 'stone-3')
      if (!night) g.dither(48, 54, 32, 6, 'sky-day-1', 8)
      g.rect(40, 39, 48, 2, 'stone-3')
      g.rect(0, 61, 128, 3, 'stone-2')
      g.hline(0, 127, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'kinki/shokudo',
    w: 5,
    h: 4,
    cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      // 食堂：灰瓦、木牆、紅提燈、白暖簾
      const night = c.time !== 'day'
      tileRoof(g, 0, 4, 80, 24, GRAY_ROOF, { slope: 4 })
      if (c.season === 'winter') snowCap(g, 8, 6, 64, 2)
      g.rect(1, 28, 78, 33, 'wood-2')
      for (let x = 3; x < 78; x += 4) g.vline(x, 28, 60, 'wood-3')
      g.rect(10, 30, 60, 8, 'wood-3')
      g.rect(12, 31, 56, 6, 'paper')
      for (let x = 16; x < 64; x += 6) g.hline(x, x + 3, 34, 'ink-2')
      windowPane(g, 6, 42, 18, 12, c.time === 'night')
      windowPane(g, 56, 42, 18, 12, c.time === 'night')
      g.rect(30, 40, 20, 21, 'wood-3')
      g.rect(31, 41, 18, 20, c.time === 'night' ? 'lamp-1' : 'ink-2')
      noren(g, 29, 39, 22, 10, 'white', 'stone-2', 'cloth-2')
      lantern(g, 24, 40, night)
      lantern(g, 53, 40, night)
      g.rect(0, 61, 80, 3, 'stone-2')
      g.hline(0, 79, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(24),
    name: 'kinki/inn',
    w: 6,
    h: 4,
    cells: ['OOOOOO', 'OOOOOO', 'LLLLLL', 'LLDLLL'],
    draw(g, c) {
      // 旅館：二層的木造、障子、門前的燈籠、深藍的暖簾
      const night = c.time !== 'day'
      tileRoof(g, 0, 0, 96, 18, GRAY_ROOF, { slope: 5 })
      if (c.season === 'winter') snowCap(g, 6, 2, 84, 9)
      g.rect(2, 18, 92, 12, 'wood-3')
      for (const x of [6, 30, 54, 78]) shoji(g, x, 19, 14, 10, 'wood-2', night ? 'lamp-1' : 'white')
      tileRoof(g, 0, 29, 96, 8, GRAY_ROOF, { ridge: false, rows: 3 })
      g.rect(2, 37, 92, 24, 'paper')
      for (const x of [2, 30, 64, 92]) g.rect(x, 37, 2, 24, 'wood-3')
      shoji(g, 6, 41, 20, 16, 'wood-3', night ? 'lamp-1' : 'white')
      shoji(g, 68, 41, 20, 16, 'wood-3', night ? 'lamp-1' : 'white')
      g.rect(34, 40, 28, 21, 'wood-3')
      g.rect(35, 41, 26, 20, night ? 'lamp-1' : 'ink-2')
      noren(g, 33, 39, 30, 11, 'cloth-2', 'roof-3')
      lantern(g, 28, 44, night, 'white')
      lantern(g, 65, 44, night, 'white')
      g.rect(0, 61, 96, 3, 'stone-2')
      g.hline(0, 95, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'kinki/shinise',
    w: 5,
    h: 4,
    cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      // 老舖：大看板（不寫字）、格子、深色暖簾
      const night = c.time !== 'day'
      machiyaRoof(g, 0, 2, 80, 22, c)
      g.rect(1, 24, 78, 13, 'wood-3')
      g.rect(14, 25, 52, 11, 'wood-1')
      g.frame(14, 25, 52, 11, 'ink-2')
      for (let x = 20; x < 60; x += 8) g.rect(x, 28, 5, 5, 'ink-2')
      tileRoof(g, 0, 36, 80, 7, GRAY_ROOF, { ridge: false, rows: 3 })
      g.rect(1, 43, 78, 18, 'wood-3')
      lattice(g, 2, 44, 76, 16, night ? 'lamp-2' : 'wood-3', 'wood-2', 2)
      g.rect(31, 44, 18, 17, night ? 'lamp-1' : 'ink-2')
      noren(g, 28, 43, 24, 11, 'roof-3', 'ink', 'paper')
      g.rect(0, 61, 80, 3, 'stone-2')
      g.hline(0, 79, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'kinki/teahouse',
    w: 5,
    h: 4,
    cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      // 茶屋：茅葺風的屋頂（木皮色）、竹簾、紅暖簾
      const night = c.time !== 'day'
      tileRoof(g, 0, 4, 80, 26, BARK_ROOF, { slope: 5, rows: 3 })
      if (c.season === 'winter') snowCap(g, 8, 6, 64, 1)
      g.rect(1, 30, 78, 31, 'paper-2')
      for (const x of [1, 24, 55, 77]) g.rect(x, 30, 2, 31, 'wood-3')
      for (const x of [5, 59]) {
        g.rect(x, 34, 16, 16, 'wood-1')
        for (let y = 35; y < 50; y += 2) g.hline(x, x + 15, y, 'wood-2')
      }
      g.rect(30, 38, 20, 23, 'wood-3')
      g.rect(31, 39, 18, 22, night ? 'lamp-1' : 'ink-2')
      noren(g, 29, 37, 22, 10, 'shu-1', 'shu-2')
      g.rect(0, 61, 80, 3, 'stone-2')
      g.hline(0, 79, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/umbrella',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g) {
      // 野点傘（紅）
      shadow(g, 8, 29, 7, 2)
      g.vline(8, 8, 29, 'wood-3')
      g.poly([0, 10, 8, 2, 16, 10], 'shu-2')
      g.poly([1, 9, 8, 3, 15, 9], 'shu-1')
      for (const x of [3, 8, 13]) g.line(8, 3, x, 9, 'shu-2')
      g.hline(0, 15, 10, 'shu-3')
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'kinki/stall',
    w: 2,
    h: 2,
    cells: ['OO', 'LL'],
    draw(g, c) {
      // 祭典的攤子：紅白的布篷、台子、燈
      const night = c.time !== 'day'
      for (let x = 0; x < 32; x += 4) g.rect(x, 6, 4, 8, (x / 4) % 2 ? 'white' : 'shu-1')
      g.hline(0, 31, 5, 'shu-2')
      g.hline(0, 31, 14, 'shu-3')
      for (let x = 0; x < 32; x += 4) g.px(x + 2, 15, (x / 4) % 2 ? 'white' : 'shu-1')
      g.rect(2, 16, 2, 14, 'wood-3')
      g.rect(28, 16, 2, 14, 'wood-3')
      g.rect(1, 22, 30, 8, 'wood-2')
      g.hline(1, 30, 22, 'wood-1')
      for (const [x, k] of [[6, 'gold-1'], [12, 'momiji-1'], [18, 'sakura-2'], [24, 'leaf-2']] as const) g.rect(x, 19, 4, 3, k)
      lantern(g, 14, 15, night)
    },
  }),
]

// ---------- 寺社 ----------
const SHRINE: TileDef[] = [
  ...defineObject({
    id: R.take(9),
    name: 'kinki/torii',
    w: 3,
    h: 3,
    cells: ['ooo', 'ooo', 'L.L'],
    draw(g) {
      // 朱色的鳥居：笠木（兩端翹起）、島木、貫、兩根柱子
      shadow(g, 8, 46, 5, 1)
      shadow(g, 40, 46, 5, 1)
      g.poly([0, 5, 48, 5, 46, 11, 2, 11], 'shu-3')
      g.poly([1, 6, 47, 6, 45, 10, 3, 10], 'roof-3')
      g.rect(3, 11, 42, 4, 'shu-2')
      g.hline(3, 44, 11, 'shu-1')
      g.rect(5, 22, 38, 3, 'shu-2')
      g.hline(5, 42, 22, 'shu-1')
      g.rect(21, 14, 6, 8, 'shu-2')
      g.rect(22, 15, 4, 5, 'paper')
      for (const x of [6, 38]) {
        g.rect(x, 15, 4, 32, 'shu-2')
        g.vline(x, 15, 46, 'shu-1')
        g.vline(x + 3, 15, 46, 'shu-3')
        g.rect(x - 1, 44, 6, 3, 'ink-2')
      }
    },
  }),
  ...haiden('kinki/haiden', 5, 4),
  ...haiden('kinki/haiden-l', 7, 5),
  ...defineObject({
    id: R.take(9),
    name: 'kinki/juyosho',
    w: 3,
    h: 3,
    cells: ['OOO', 'LLL', 'LDL'],
    draw(g, c) {
      // 授与所：小屋頂、白牆、窗口（架上的御守，只是彩色小點）
      const night = c.time === 'night'
      tileRoof(g, 0, 2, 48, 15, BARK_ROOF, { slope: 3 })
      if (c.season === 'winter') snowCap(g, 4, 4, 40, 13)
      g.rect(1, 17, 46, 28, 'white')
      g.vline(1, 17, 44, 'shu-2')
      g.vline(46, 17, 44, 'shu-2')
      g.rect(4, 20, 14, 12, 'wood-3')
      g.rect(5, 21, 12, 10, night ? 'lamp-1' : 'paper')
      for (const [x, y, k] of [[6, 26, 'shu-1'], [9, 26, 'gold-1'], [12, 26, 'cloth-1'], [15, 26, 'leaf-2']] as const) g.rect(x, y, 2, 4, k)
      g.rect(3, 31, 16, 2, 'wood-1')
      g.rect(18, 22, 14, 23, 'wood-3')
      g.rect(19, 23, 12, 22, night ? 'lamp-1' : 'ink-2')
      g.rect(0, 45, 48, 3, 'stone-2')
      g.hline(0, 47, 47, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/toro',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 石燈籠：笠、火袋（夜裡亮）、竿、台
      const lit = c.time !== 'day'
      shadow(g, 8, 30, 5, 1)
      g.rect(4, 26, 8, 4, 'stone-3')
      g.hline(4, 11, 26, 'stone-2')
      g.rect(6, 17, 4, 9, 'stone-2')
      g.vline(9, 17, 25, 'stone-3')
      g.rect(4, 15, 8, 2, 'stone-3')
      g.rect(5, 9, 6, 6, 'stone-2')
      g.rect(6, 10, 4, 4, lit ? 'lamp-1' : 'ink-2')
      g.poly([1, 9, 8, 3, 15, 9], 'stone-3')
      g.poly([2, 8, 8, 4, 14, 8], 'stone-2')
      g.hline(3, 8, 5, 'stone-1')
      g.rect(7, 1, 2, 3, 'stone-3')
      if (c.season === 'winter') g.hline(4, 11, 4, 'snow-1')
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'kinki/chozuya',
    w: 2,
    h: 2,
    cells: ['OO', 'LL'],
    draw(g, c) {
      // 手水舍：小屋頂、四根柱子、石的水盤
      shadow(g, 16, 30, 13, 2)
      tileRoof(g, 0, 2, 32, 12, BARK_ROOF, { slope: 2, rows: 3 })
      if (c.season === 'winter') snowCap(g, 3, 4, 26, 5)
      for (const x of [3, 27]) g.rect(x, 14, 2, 16, 'wood-3')
      g.rect(5, 20, 22, 9, 'stone-3')
      g.rect(6, 21, 20, 4, 'sea-2')
      g.hline(7, 24, 21, 'sea-1')
      g.rect(6, 25, 20, 3, 'stone-2')
      g.line(9, 18, 14, 21, 'wood-1')
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/ema',
    w: 2,
    h: 1,
    cells: ['LL'],
    draw(g) {
      // 繪馬架：木架上掛著的五角形木牌
      shadow(g, 16, 15, 14, 1)
      g.rect(1, 1, 30, 2, 'wood-3')
      g.rect(2, 1, 2, 14, 'wood-3')
      g.rect(28, 1, 2, 14, 'wood-3')
      for (let x = 5; x < 27; x += 4)
        for (const y of [4, 9]) {
          g.rect(x, y, 3, 4, 'wood-1')
          g.px(x + 1, y - 1, 'wood-1')
          g.px(x + 1, y + 1, 'shu-1')
        }
    },
  }),
]

/** 拝殿：木皮色的屋頂、朱色的柱子、注連繩、賽錢箱 */
function haiden(name: string, w: number, h: number): TileDef[] {
  const cells = Array.from({ length: h }, (_, y) => (y < h - 2 ? 'O' : 'L').repeat(w))
  return defineObject({
    id: R.take(w * h),
    name,
    w,
    h,
    cells,
    draw(g, c) {
      const W = w * 16
      const H = h * 16
      const night = c.time === 'night'
      const roofH = Math.round(H * 0.5)
      tileRoof(g, 0, 2, W, roofH, BARK_ROOF, { slope: Math.round(w * 1.4), rows: 3 })
      // 千鳥破風（正面的三角）
      const cx = W / 2
      g.poly([cx - 14, roofH - 2, cx, roofH - 14, cx + 14, roofH - 2], 'wood-3')
      g.poly([cx - 11, roofH - 3, cx, roofH - 12, cx + 11, roofH - 3], 'wood-1')
      g.px(cx, roofH - 9, 'gold-1')
      if (c.season === 'winter') snowCap(g, 6, 4, W - 12, w)
      const top = roofH + 2
      g.rect(2, top, W - 4, H - top - 3, 'paper')
      for (let x = 2; x < W - 2; x += 16) g.rect(x, top, 3, H - top - 3, 'shu-2')
      g.rect(W - 5, top, 3, H - top - 3, 'shu-2')
      g.rect(2, top, W - 4, 3, 'shu-1')
      // 注連繩與紙垂
      g.hline(10, W - 11, top + 5, 'gold-2')
      g.hline(10, W - 11, top + 6, 'sand-2')
      for (let x = 16; x < W - 12; x += 12) {
        g.px(x, top + 7, 'white')
        g.px(x + 1, top + 8, 'white')
        g.px(x, top + 9, 'white')
      }
      // 正面：深色的開口（夜裡有燈）＋賽錢箱
      g.rect(cx - 12, top + 10, 24, H - top - 13, night ? 'lamp-2' : 'ink-2')
      g.rect(cx - 9, H - 11, 18, 7, 'wood-2')
      g.hline(cx - 9, cx + 8, H - 11, 'wood-1')
      for (let x = cx - 8; x < cx + 8; x += 2) g.px(x, H - 9, 'wood-3')
      g.rect(0, H - 4, W, 4, 'stone-2')
      g.hline(0, W - 1, H - 4, 'stone-1')
      g.hline(0, W - 1, H - 1, 'stone-4')
    },
  })
}

const TEMPLE: TileDef[] = [
  ...defineObject({
    id: R.take(20),
    name: 'kinki/sanmon',
    w: 5,
    h: 4,
    cells: ['OOoOO', 'OOoOO', 'LLoLL', 'LL.LL'],
    draw(g, c) {
      // 山門：大屋頂（兩層）、中間的通道（走得過去）、兩側的木格子
      const night = c.time === 'night'
      tileRoof(g, 0, 0, 80, 14, GRAY_ROOF, { slope: 6 })
      g.rect(6, 14, 68, 6, 'wood-2')
      for (let x = 8; x < 72; x += 6) g.rect(x, 15, 3, 4, 'paper')
      tileRoof(g, 0, 20, 80, 14, GRAY_ROOF, { slope: 4, ridge: false })
      if (c.season === 'winter') {
        snowCap(g, 8, 1, 64, 1)
        snowCap(g, 6, 21, 68, 2)
      }
      g.rect(4, 34, 72, 26, 'wood-2')
      for (const x of [4, 22, 54, 72]) g.rect(x, 34, 4, 26, 'wood-3')
      for (const x of [8, 58]) lattice(g, x, 37, 12, 20, 'ink-2', 'wood-1', 3)
      // 通道：深色，下面是門檻
      g.rect(32, 34, 16, 26, night ? 'ink' : 'ink-2')
      g.dither(32, 34, 16, 26, 'roof-3', 6)
      g.cut(33, 49, 14, 15)
      g.rect(0, 60, 32, 4, 'stone-2')
      g.rect(48, 60, 32, 4, 'stone-2')
      g.hline(0, 79, 63, 'stone-4')
    },
  }),
  ...hondo('kinki/hondo', 7, 5),
  ...hondo('kinki/hondo-l', 9, 6),
  ...hondo('kinki/hondo-b', 7, 5, true),
  ...hondo('kinki/hondo-l-b', 9, 6, true),
  ...defineObject({
    id: R.take(9),
    name: 'kinki/shoro',
    w: 3,
    h: 3,
    cells: ['OOO', 'OOO', 'LLL'],
    draw(g, c) {
      // 鐘樓：屋頂、吊鐘、四根柱子、石台
      tileRoof(g, 0, 2, 48, 16, GRAY_ROOF, { slope: 5 })
      if (c.season === 'winter') snowCap(g, 6, 4, 36, 4)
      for (const x of [6, 40]) g.rect(x, 18, 3, 22, 'wood-3')
      g.rect(18, 19, 12, 2, 'wood-3')
      g.rect(19, 21, 10, 13, 'gold-2')
      g.vline(20, 22, 33, 'gold-1')
      g.rect(18, 33, 12, 2, 'wood-3')
      g.rect(2, 40, 44, 7, 'stone-2')
      g.hline(2, 45, 40, 'stone-1')
      g.hline(2, 45, 46, 'stone-4')
    },
  }),
]

/** 本堂：大屋頂（入母屋，灰瓦）、木柱、正面的階梯；d 是國寶、世界遺產時用大一號 */
function hondo(name: string, w: number, h: number, bark = false): TileDef[] {
  const cells = Array.from({ length: h }, (_, y) => (y < h - 2 ? 'O' : 'L').repeat(w))
  return defineObject({
    id: R.take(w * h),
    name,
    w,
    h,
    cells,
    draw(g, c) {
      const W = w * 16
      const H = h * 16
      const night = c.time === 'night'
      const roofH = Math.round(H * 0.56)
      // bark：檜皮葺風的屋頂、白壁（另一種寺的樣子，不代表哪一座）
      tileRoof(g, 0, 2, W, roofH, bark ? BARK_ROOF : GRAY_ROOF, { slope: Math.round(w * 2), rows: bark ? 3 : 4 })
      // 屋脊兩端的鴟尾、正面的唐破風
      g.rect(w * 2 + 2, 0, 4, 5, 'roof-3')
      g.rect(W - w * 2 - 6, 0, 4, 5, 'roof-3')
      const cx = W / 2
      g.poly([cx - 18, roofH, cx, roofH - 10, cx + 18, roofH], 'roof-3')
      g.poly([cx - 15, roofH - 1, cx, roofH - 8, cx + 15, roofH - 1], 'roof-1')
      if (c.season === 'winter') snowCap(g, w * 2 + 4, 4, W - w * 4 - 8, w + 1)
      const top = roofH + 2
      g.rect(2, top, W - 4, H - top - 6, bark ? 'paper' : 'wood-2')
      for (let x = 2; x < W - 4; x += 12) g.rect(x, top, 3, H - top - 6, bark ? 'shu-2' : 'wood-3')
      g.rect(W - 5, top, 3, H - top - 6, 'wood-3')
      for (let x = 6; x < W - 10; x += 12) shoji(g, x, top + 4, 8, H - top - 13, 'wood-3', night ? 'lamp-1' : 'paper')
      // 正面中間的開口與階梯
      g.rect(cx - 10, top + 2, 20, H - top - 8, night ? 'lamp-2' : 'ink-2')
      for (let i = 0; i < 3; i++) g.rect(cx - 12 - i * 2, H - 8 + i * 2, 24 + i * 4, 2, i % 2 ? 'stone-2' : 'stone-1')
      g.rect(0, H - 6, cx - 14, 6, 'stone-2')
      g.rect(cx + 14, H - 6, W - cx - 14, 6, 'stone-2')
      g.hline(0, W - 1, H - 6, 'stone-1')
      g.hline(0, W - 1, H - 1, 'stone-4')
    },
  })
}

// ---------- 城、博物館、塔、大門、和風建築 ----------
const OTHER: TileDef[] = [
  ...defineObject({
    id: R.take(20),
    name: 'kinki/castle-gate',
    w: 5,
    h: 4,
    cells: ['OOoOO', 'OOoOO', 'LLoLL', 'LL.LL'],
    draw(g, c) {
      // 城門（櫓門）：石垣的兩側、上面是白壁的櫓與灰瓦
      const night = c.time === 'night'
      tileRoof(g, 0, 0, 80, 14, GRAY_ROOF, { slope: 5 })
      if (c.season === 'winter') snowCap(g, 6, 1, 68, 6)
      g.rect(3, 14, 74, 14, 'white')
      g.dither(3, 14, 74, 3, 'paper', 8)
      for (const x of [12, 36, 60]) {
        g.rect(x, 18, 8, 6, 'ink-2')
        for (let xx = x + 1; xx < x + 8; xx += 2) g.vline(xx, 18, 23, night ? 'lamp-2' : 'wood-3')
      }
      g.rect(3, 26, 74, 2, 'roof-3')
      // 兩側的石垣
      for (const x0 of [0, 48]) {
        g.rect(x0, 28, 32, 32, 'stone-3')
        for (let y = 28; y < 60; y += 6)
          for (let x = x0 + ((y / 6) % 2) * 4; x < x0 + 32; x += 8) stone(g, x, y, 8, 6, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
      }
      g.rect(32, 28, 16, 32, 'ink-2')
      g.rect(33, 29, 2, 31, 'wood-3')
      g.rect(45, 29, 2, 31, 'wood-3')
      g.cut(35, 48, 10, 16)
      g.rect(0, 60, 32, 4, 'stone-3')
      g.rect(48, 60, 32, 4, 'stone-3')
    },
  }),
  ...defineObject({
    id: R.take(15),
    name: 'kinki/castle-house',
    w: 5,
    h: 3,
    cells: ['OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      // 城跡的平房（休憩所、受付）：低的灰瓦、白牆、木門
      const night = c.time === 'night'
      tileRoof(g, 0, 2, 80, 18, GRAY_ROOF, { slope: 6 })
      if (c.season === 'winter') snowCap(g, 8, 4, 64, 8)
      g.rect(2, 20, 76, 25, 'white')
      for (const x of [2, 26, 52, 76]) g.rect(x, 20, 2, 25, 'wood-3')
      windowPane(g, 7, 25, 14, 10, night)
      windowPane(g, 58, 25, 14, 10, night)
      g.rect(31, 24, 18, 21, 'wood-3')
      g.rect(32, 25, 16, 20, night ? 'lamp-1' : 'wood-2')
      g.vline(40, 25, 44, 'wood-3')
      g.rect(0, 45, 80, 3, 'stone-2')
      g.hline(0, 79, 47, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(24),
    name: 'kinki/museum',
    w: 6,
    h: 4,
    cells: ['OOOOOO', 'LLLLLL', 'LLLLLL', 'LLLLLL'],
    draw(g, c) {
      // 博物館、美術館：白牆的展館、平的屋頂、柱廊、玻璃門
      const night = c.time === 'night'
      g.rect(0, 4, 96, 10, 'stone-2')
      g.hline(0, 95, 4, 'stone-1')
      g.rect(0, 12, 96, 3, 'stone-3')
      if (c.season === 'winter') g.dither(2, 5, 92, 4, 'snow-1', 10)
      g.rect(2, 15, 92, 45, 'white')
      g.dither(2, 15, 92, 4, 'paper', 6)
      for (let x = 8; x < 90; x += 14) {
        g.rect(x, 18, 6, 40, 'paper')
        g.vline(x, 18, 57, 'white')
        g.vline(x + 5, 18, 57, 'stone-2')
      }
      g.rect(36, 34, 24, 26, 'stone-3')
      g.rect(38, 36, 20, 24, night ? 'lamp-1' : 'sky-day-2')
      g.vline(47, 36, 59, 'stone-3')
      g.vline(48, 36, 59, 'stone-3')
      g.rect(0, 60, 96, 4, 'stone-1')
      g.hline(0, 95, 63, 'stone-3')
    },
  }),
  ...defineObject({
    id: R.take(21),
    name: 'kinki/tower',
    w: 3,
    h: 7,
    cells: ['.o.', '.o.', 'ooo', '.o.', 'OOO', 'LLL', 'LLL'],
    draw(g, c) {
      // 塔：細長的白塔、展望台（窗夜裡亮）、底下的大樓
      const night = c.time === 'night'
      g.rect(23, 2, 2, 8, 'stone-3')
      g.rect(20, 10, 8, 22, 'white')
      g.vline(27, 10, 31, 'stone-2')
      g.rect(14, 32, 20, 14, 'white')
      g.rect(14, 36, 20, 6, night ? 'lamp-1' : 'sky-day-2')
      g.hline(14, 33, 32, 'stone-1')
      g.vline(33, 32, 45, 'stone-2')
      g.rect(18, 46, 12, 22, 'white')
      g.vline(29, 46, 67, 'stone-2')
      g.rect(2, 68, 44, 42, 'paper')
      g.dither(2, 68, 44, 4, 'paper-2', 8)
      for (let y = 74; y < 104; y += 8) for (let x = 6; x < 44; x += 8) windowPane(g, x, y, 6, 5, night, 'stone-3')
      g.rect(18, 98, 12, 12, 'stone-3')
      g.rect(0, 108, 48, 4, 'stone-2')
      g.hline(0, 47, 111, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(15),
    name: 'kinki/gate-big',
    w: 5,
    h: 3,
    cells: ['ooooo', 'LLoLL', 'LL.LL'],
    draw(g, c) {
      // 大門（動物園、水族館、遊樂園）：兩根門柱＋橫的看板（不寫字）
      const night = c.time !== 'day'
      g.rect(2, 4, 76, 18, 'cloth-1')
      g.frame(2, 4, 76, 18, 'cloth-2')
      for (let x = 10; x < 70; x += 8) g.rect(x, 10, 4, 4, 'white')
      for (const x of [4, 64]) {
        g.rect(x, 16, 12, 30, 'paper')
        g.frame(x, 16, 12, 30, 'stone-3')
        g.rect(x + 3, 20, 6, 6, night ? 'lamp-1' : 'leaf-2')
      }
      g.rect(16, 16, 16, 30, 'leaf-3')
      g.rect(48, 16, 16, 30, 'leaf-3')
      for (let x = 17; x < 32; x += 3) g.vline(x, 17, 45, 'leaf-4')
      for (let x = 49; x < 64; x += 3) g.vline(x, 17, 45, 'leaf-4')
      g.rect(0, 44, 32, 4, 'stone-2')
      g.rect(48, 44, 32, 4, 'stone-2')
    },
  }),
  ...defineObject({
    id: R.take(9),
    name: 'kinki/gate',
    w: 3,
    h: 3,
    cells: ['OoO', 'LoL', 'L.L'],
    draw(g, c) {
      // 門（名字有「門」的地標、御所的門）：木皮色的屋頂、兩根柱子、門扉
      tileRoof(g, 0, 2, 48, 14, BARK_ROOF, { slope: 4 })
      if (c.season === 'winter') snowCap(g, 4, 3, 40, 1)
      for (const x of [4, 38]) g.rect(x, 16, 6, 30, 'wood-2')
      g.vline(4, 16, 45, 'wood-1')
      g.vline(43, 16, 45, 'wood-3')
      g.rect(10, 16, 28, 4, 'wood-3')
      g.rect(10, 20, 6, 26, 'wood-3')
      g.rect(32, 20, 6, 26, 'wood-3')
      for (const y of [26, 36]) for (const x of [12, 34]) g.px(x, y, 'gold-1')
      g.rect(0, 44, 16, 4, 'stone-2')
      g.rect(32, 44, 16, 4, 'stone-2')
    },
  }),
  ...defineObject({
    id: R.take(28),
    name: 'kinki/hall',
    w: 7,
    h: 4,
    cells: ['OOOOOOO', 'OOOOOOO', 'LLLLLLL', 'LLLLLLL'],
    draw(g, c) {
      // 一般的和風建築（大）：寬的入母屋、白壁、木柱、障子
      const night = c.time === 'night'
      tileRoof(g, 0, 2, 112, 30, BARK_ROOF, { slope: 12, rows: 3 })
      if (c.season === 'winter') snowCap(g, 14, 4, 84, 11)
      g.rect(2, 32, 108, 28, 'paper')
      for (let x = 2; x < 110; x += 18) g.rect(x, 32, 3, 28, 'wood-3')
      g.rect(107, 32, 3, 28, 'wood-3')
      for (let x = 7; x < 104; x += 18) shoji(g, x, 36, 13, 21, 'wood-3', night ? 'lamp-1' : 'white')
      g.rect(0, 58, 112, 6, 'wood-1')
      g.hline(0, 111, 58, 'paper-2')
      g.hline(0, 111, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kinki/monument',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 石碑：台座＋立石（史跡）
      shadow(g, 8, 30, 6, 1)
      g.rect(2, 25, 12, 5, 'stone-3')
      g.hline(2, 13, 25, 'stone-2')
      g.rect(4, 6, 8, 20, 'stone-2')
      g.vline(4, 6, 25, 'stone-1')
      g.vline(11, 6, 25, 'stone-3')
      g.poly([4, 6, 8, 2, 12, 6], 'stone-2')
      for (let y = 9; y < 23; y += 3) g.hline(7, 8, y, 'stone-3')
      if (c.season === 'winter') g.px(8, 3, 'snow-1')
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'kinki/shop-front',
    w: 2,
    h: 2,
    cells: ['OO', 'LL'],
    draw(g, c) {
      // 市場、商店街的店面：布篷、擺滿東西的台子
      const night = c.time !== 'day'
      for (let x = 0; x < 32; x += 4) g.rect(x, 4, 4, 9, (x / 4) % 2 ? 'paper' : 'cloth-1')
      g.hline(0, 31, 3, 'cloth-2')
      g.hline(0, 31, 13, 'cloth-2')
      g.rect(0, 14, 32, 16, night ? 'lamp-2' : 'ink-2')
      g.rect(1, 22, 30, 8, 'wood-2')
      g.hline(1, 30, 22, 'wood-1')
      for (const [x, k] of [[3, 'gold-1'], [8, 'leaf-2'], [13, 'momiji-1'], [18, 'paper'], [23, 'shu-1'], [27, 'sakura-2']] as const) g.rect(x, 18, 3, 4, k)
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'kinki/sanmon-b',
    w: 5,
    h: 4,
    cells: ['OOoOO', 'OOoOO', 'LLoLL', 'LL.LL'],
    draw(g, c) {
      // 山門的另一種樣子（一層的大屋頂、白壁）：同一鎮的寺不要長得一模一樣，不代表哪一座
      const night = c.time === 'night'
      tileRoof(g, 0, 6, 80, 26, BARK_ROOF, { slope: 10, rows: 3 })
      if (c.season === 'winter') snowCap(g, 12, 7, 56, 3)
      g.rect(4, 32, 72, 3, 'wood-3')
      g.rect(4, 35, 72, 25, 'paper')
      g.dither(4, 35, 72, 3, 'paper-2', 8)
      for (const x of [4, 24, 52, 72]) g.rect(x, 35, 4, 25, 'wood-3')
      for (const x of [10, 60]) g.rect(x, 44, 10, 3, 'wood-2')
      // 通道：深色，下面是門檻
      g.rect(30, 35, 20, 25, night ? 'ink' : 'ink-2')
      g.dither(30, 35, 20, 25, 'wood-3', 6)
      g.cut(31, 49, 18, 15)
      g.rect(0, 60, 30, 4, 'stone-2')
      g.rect(50, 60, 30, 4, 'stone-2')
      g.hline(0, 79, 63, 'stone-4')
    },
  }),
]

export const KINKI_TILES: TileDef[] = [...GROUND, ...SMALL, ...TREES, ...BUILDINGS, ...SHRINE, ...TEMPLE, ...OTHER]
registerTileset('kinki', KINKI_TILES)

/** 開花的對照（world/season.ts 依平年值換）：一般的名字 → 開花的名字 */
export const KINKI_BLOOM: Record<string, { flower: 'ume' | 'sakura' | 'kaede' | 'ichou' | 'ajisai'; bloom: string }> = {
  'kinki/ume': { flower: 'ume', bloom: 'kinki/ume@bloom' },
  'kinki/sakura': { flower: 'sakura', bloom: 'kinki/sakura@bloom' },
  'kinki/kaede': { flower: 'kaede', bloom: 'kinki/kaede@bloom' },
  'kinki/ichou': { flower: 'ichou', bloom: 'kinki/ichou@bloom' },
  'kinki/ajisai': { flower: 'ajisai', bloom: 'kinki/ajisai@bloom' },
}

export type { ObjectCtx, Season }
