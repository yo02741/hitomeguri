import type { Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import { registerTileset } from '../../engine/tiles'
import type { TileCtx, TileDef } from '../../engine/types'

import { bareBranches, blossoms, foliage, grassTint, grassTones, lantern, leafTones, noren, RED_ROOF, shadow, speckle, stone, tileRoof, type Tones, trunk, tuft, windowPane } from './draw'
import { defineObject, idRange } from './objects'

/**
 * 沖繩 kit（id 2048–3071，名字 'okinawa/…'）：
 * 地面：草、珊瑚砂的白路、柏油路、琉球石灰岩的石畳、白沙灘、礁湖（淺）、海、深海（三層藍，會動）、礁岩、甘蔗田。
 * 赤瓦＋白漆喰的屋頂（屋脊上有シーサー）、水泥的平頂房子（屋頂的水塔）、珊瑚石垣、花ブロック的牆、ヒンプン、
 * グスク的彎石垣與石拱門（不畫正殿這類資料沒寫的建築）、御嶽的岩石與樹林、機場航廈、單軌的車站、巴士站牌、碼頭、橋。
 * 植物：フクギ、ガジュマル、椰子、扶桑花、九重葛、寒緋櫻（開花的一份照那覇等氣象台的平年值換）、一般的樹。
 * 沖繩沒有楓、銀杏、雪：冬天只是顏色淡一點。
 */
const R = idRange(2048, 3071)
const K = 'okinawa' as const

const PAVED = new Set(['okinawa/road', 'okinawa/street', 'okinawa/stone', 'okinawa/pier', 'okinawa/bridge-h', 'okinawa/bridge-v', 'okinawa/sand'])
const isPaved = (name?: string) => !!name && (PAVED.has(name) || name.startsWith('world/'))
const WATER = ['okinawa/shallow', 'okinawa/sea', 'okinawa/deep', 'okinawa/reef']
const isWater = (name?: string) => !!name && (WATER.includes(name) || name.startsWith('okinawa/bridge') || name === 'okinawa/pier')
/** 水的深淺：0 淺、1 海、2 深 */
const depthOf = (name?: string) => (name === 'okinawa/deep' ? 2 : name === 'okinawa/sea' ? 1 : 0)

function grass(g: Gfx, c: TileCtx) {
  const k = grassTones(c.season, K)
  g.rect(0, 0, 16, 16, k.base)
  const tint = grassTint(c.season, K)
  if (tint) g.dither(0, 0, 16, 16, tint.k, tint.level)
  if (c.variant === 0) {
    tuft(g, 3, 4, k.dark, k.light)
    tuft(g, 10, 11, k.dark)
  } else if (c.variant === 1) {
    speckle(g, 0, 0, 16, 16, k.dark, 0.05, 7)
    g.px(12, 4, k.light)
  } else {
    tuft(g, 7, 8, k.dark, k.light)
    g.px(2, 13, k.light)
    g.px(13, 2, k.dark)
  }
}

function fringe(g: Gfx, c: TileCtx, k: Px, deep = 2) {
  if (!(c.mask & 1)) {
    g.rect(0, 0, 16, 1, k)
    g.dither(0, 1, 16, deep, k, 8)
  }
  if (!(c.mask & 4)) {
    g.rect(0, 15, 16, 1, k)
    g.dither(0, 15 - deep, 16, deep, k, 8)
  }
  if (!(c.mask & 8)) {
    g.rect(0, 0, 1, 16, k)
    g.dither(1, 0, deep, 16, k, 8)
  }
  if (!(c.mask & 2)) {
    g.rect(15, 0, 1, 16, k)
    g.dither(15 - deep, 0, deep, 16, k, 8)
  }
}

/** 水：底色、波紋（往右漂）；旁邊是陸地的那一邊有白浪；旁邊比較淺的那一邊抖色過去 */
function water(depth: 0 | 1 | 2) {
  const tone: Array<[Px, Px, Px]> = [
    ['lagoon-2', 'lagoon-1', 'sea-1'],
    ['sea-1', 'lagoon-2', 'sea-2'],
    ['sea-2', 'sea-1', 'sea-3'],
  ]
  return (g: Gfx, c: TileCtx) => {
    const [base, hi, lo] = tone[depth]!
    g.rect(0, 0, 16, 16, base)
    if (depth === 2) g.dither(0, 0, 16, 16, 'sea-3', 4)
    const f = c.frame
    for (const [x, y] of [[2, 3], [9, 7], [4, 11], [12, 14]] as const) {
      const xx = (x + f * 2) % 16
      g.hline(xx, Math.min(15, xx + 2), y, hi)
      g.px((xx + 8) % 16, (y + 3) % 16, lo)
    }
    if (depth === 0) speckle(g, 0, 0, 16, 16, 'lagoon-1', 0.03, 5 + f)
  }
}

/** 水的邊：c.mask 是「旁邊也是水」；陸地的那一邊畫沙＋白浪 */
function shore(g: Gfx, c: TileCtx) {
  const foam: Px = c.frame % 2 ? 'foam' : 'white'
  if (!(c.mask & 1)) {
    g.rect(0, 0, 16, 2, 'sand-1')
    g.hline(0, 15, 2, foam)
    g.dither(0, 3, 16, 1, 'foam', 8)
  }
  if (!(c.mask & 4)) {
    g.rect(0, 14, 16, 2, 'sand-2')
    g.hline(0, 15, 13, foam)
  }
  if (!(c.mask & 8)) {
    g.rect(0, 0, 2, 16, 'sand-1')
    g.vline(2, 0, 15, foam)
  }
  if (!(c.mask & 2)) {
    g.rect(14, 0, 2, 16, 'sand-1')
    g.vline(13, 0, 15, foam)
  }
}

const GROUND: TileDef[] = [
  { id: R.take(1), name: 'okinawa/grass', layer: 'ground', behavior: 'walk', variants: 3, draw: grass },
  {
    id: R.take(1),
    name: 'okinawa/road',
    layer: 'ground',
    behavior: 'walk',
    variants: 3,
    connect: (o) => isPaved(o?.name),
    draw(g, c) {
      // 珊瑚砂的白路
      g.rect(0, 0, 16, 16, 'coral-1')
      speckle(g, 0, 0, 16, 16, 'coral-2', 0.1, 11 + c.variant)
      speckle(g, 0, 0, 16, 16, 'white', 0.05, 21 + c.variant)
      fringe(g, c, grassTones(c.season, K).base)
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/street',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    connect: (o) => isPaved(o?.name),
    draw(g, c) {
      // 柏油路＋人行道的路緣
      g.rect(0, 0, 16, 16, 'stone-3')
      speckle(g, 0, 0, 16, 16, 'stone-2', 0.12, 31 + c.variant)
      speckle(g, 0, 0, 16, 16, 'stone-4', 0.05, 41 + c.variant)
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 3, 'coral-1')
        g.hline(0, 15, 3, 'stone-4')
      }
      if (!(c.mask & 4)) {
        g.rect(0, 13, 16, 3, 'coral-1')
        g.hline(0, 15, 12, 'stone-4')
      }
      if (!(c.mask & 8)) {
        g.rect(0, 0, 3, 16, 'coral-1')
        g.vline(3, 0, 15, 'stone-4')
      }
      if (!(c.mask & 2)) {
        g.rect(13, 0, 3, 16, 'coral-1')
        g.vline(12, 0, 15, 'stone-4')
      }
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/stone',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      // 琉球石灰岩的石畳：不規則的石塊
      g.rect(0, 0, 16, 16, 'coral-3')
      const cells: Array<[number, number, number, number]> = c.variant
        ? [[0, 0, 7, 6], [7, 0, 9, 5], [0, 6, 5, 5], [5, 5, 6, 6], [11, 5, 5, 6], [0, 11, 8, 5], [8, 11, 8, 5]]
        : [[0, 0, 5, 5], [5, 0, 6, 6], [11, 0, 5, 7], [0, 5, 7, 6], [7, 6, 9, 5], [0, 11, 6, 5], [6, 11, 10, 5]]
      for (const [x, y, w, h] of cells) {
        g.rect(x, y, w - 1, h - 1, 'coral-2')
        g.hline(x, x + w - 2, y, 'coral-1')
      }
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/sand',
    layer: 'ground',
    behavior: 'walk',
    variants: 3,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'sand-1')
      speckle(g, 0, 0, 16, 16, 'white', 0.08, 51 + c.variant)
      speckle(g, 0, 0, 16, 16, 'sand-2', 0.06, 61 + c.variant)
      if (c.variant === 2) {
        // 貝殼
        g.px(5, 9, 'sakura-1')
        g.px(6, 9, 'white')
      }
    },
  },
  ...([0, 1, 2] as const).map(
    (d): TileDef => ({
      id: R.take(1),
      name: ['okinawa/shallow', 'okinawa/sea', 'okinawa/deep'][d]!,
      layer: 'ground',
      behavior: 'water',
      frames: 4,
      fps: 2,
      connect: (o) => isWater(o?.name),
      draw(g, c) {
        water(d)(g, c)
        if (d === 0) shore(g, c)
      },
    }),
  ),
  {
    id: R.take(1),
    name: 'okinawa/reef',
    layer: 'ground',
    behavior: 'water',
    frames: 4,
    fps: 2,
    variants: 2,
    draw(g, c) {
      water(0)(g, c)
      // 礁岩：深色的岩、上面一點白浪
      if (c.variant) stone(g, 3, 5, 10, 8, 'coral-3', 'coral-2', 'stone-4', 'ink-2')
      else {
        stone(g, 2, 7, 7, 6, 'coral-3', 'coral-2', 'stone-4', 'ink-2')
        stone(g, 9, 3, 5, 6, 'coral-3', 'coral-2', 'stone-4', 'ink-2')
      }
      g.hline(2, 13, 13 + (c.frame % 2), 'foam')
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/cane',
    layer: 'ground',
    behavior: 'block',
    variants: 2,
    connect: (o) => o?.name === 'okinawa/cane',
    draw(g, c) {
      // 甘蔗田：一叢一叢高高的葉子（冬天顏色淡一點）
      const k = c.season === 'winter' ? { a: 'leaf-3' as Px, b: 'sand-2' as Px, c: 'leaf-2' as Px } : { a: 'leaf-3' as Px, b: 'leaf-1' as Px, c: 'leaf-2' as Px }
      g.rect(0, 0, 16, 16, 'leaf-4')
      for (let x = 1 + c.variant; x < 16; x += 4) {
        g.vline(x, 2, 15, k.a)
        g.line(x, 4, x - 3, 1, k.c)
        g.line(x, 6, x + 3, 2, k.b)
        g.line(x, 9, x - 2, 6, k.b)
        g.px(x, 1, k.b)
      }
      const t = grassTones(c.season, K)
      if (!(c.mask & 4)) {
        g.rect(0, 14, 16, 2, t.base)
        g.hline(0, 15, 13, t.dark)
      }
      if (!(c.mask & 1)) g.rect(0, 0, 16, 1, t.base)
      if (!(c.mask & 8)) g.rect(0, 0, 1, 16, t.base)
      if (!(c.mask & 2)) g.rect(15, 0, 1, 16, t.base)
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/pier',
    layer: 'ground',
    behavior: 'walk',
    frames: 4,
    fps: 2,
    draw(g, c) {
      water(1)(g, c)
      g.rect(1, 0, 14, 16, 'wood-1')
      for (let y = 1; y < 16; y += 3) g.hline(1, 14, y, 'wood-2')
      g.vline(1, 0, 15, 'wood-3')
      g.vline(14, 0, 15, 'wood-3')
    },
  },
  ...(['h', 'v'] as const).map(
    (d): TileDef => ({
      id: R.take(1),
      name: `okinawa/bridge-${d}`,
      layer: 'ground',
      behavior: 'walk',
      frames: 4,
      fps: 2,
      draw(g, c) {
        // 海上的橋：水泥的橋面、兩側的白欄杆
        water(0)(g, c)
        if (d === 'h') {
          g.rect(0, 3, 16, 10, 'stone-1')
          g.hline(0, 15, 8, 'white')
          g.rect(0, 1, 16, 2, 'white')
          g.rect(0, 13, 16, 2, 'stone-2')
          g.hline(0, 15, 15, 'stone-3')
        } else {
          g.rect(3, 0, 10, 16, 'stone-1')
          g.vline(8, 0, 15, 'white')
          g.rect(1, 0, 2, 16, 'white')
          g.rect(13, 0, 2, 16, 'stone-2')
        }
      },
    }),
  ),
]

// ---------- 一格的東西 ----------
const SMALL: TileDef[] = [
  {
    id: R.take(1),
    name: 'okinawa/sign',
    layer: 'lower',
    behavior: 'sign',
    draw(g) {
      // 石灰岩的台座＋木板
      shadow(g, 8, 14, 6, 1)
      g.rect(3, 11, 10, 4, 'coral-3')
      g.hline(3, 12, 11, 'coral-2')
      g.rect(2, 2, 12, 9, 'wood-3')
      g.rect(3, 3, 10, 7, 'coral-1')
      g.hline(4, 11, 5, 'coral-3')
      g.hline(4, 9, 7, 'coral-3')
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/coralwall',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && (o.name === 'okinawa/coralwall' || o.name.startsWith('okinawa/hinpun')),
    draw(g, c) {
      // 珊瑚石垣：圓圓的石頭疊起來，轉角是圓的
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      const x0 = vert ? 3 : c.mask & 8 ? 0 : 2
      const x1 = vert ? 12 : c.mask & 2 ? 15 : 13
      shadow(g, 8, 15, 7, 1)
      g.rect(x0, vert ? 0 : 4, x1 - x0 + 1, vert ? 16 : 11, 'coral-3')
      for (let y = vert ? 0 : 4; y < 15; y += 4)
        for (let x = x0 + ((y >> 2) % 2) * 2; x < x1; x += 4) {
          g.rect(x, y, 4, 4, 'coral-2')
          g.px(x, y, 'coral-1')
          g.px(x + 1, y, 'coral-1')
          g.px(x + 3, y + 3, 'coral-3')
        }
      if (!vert) {
        g.hline(x0, x1, 4, 'coral-1')
        if (!(c.mask & 8)) g.px(x0, 4, 'coral-3')
        if (!(c.mask & 2)) g.px(x1, 4, 'coral-3')
      }
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/gusuku',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && (o.name === 'okinawa/gusuku' || o.name.startsWith('okinawa/gusuku-gate')),
    draw(g, c) {
      // グスクの石垣：大きな切石、上緣圓，轉角（只接兩邊時）畫成弧
      g.rect(0, 0, 16, 16, 'coral-3')
      for (let y = 0; y < 16; y += 5)
        for (let x = (y / 5) % 2 ? -3 : 0; x < 16; x += 7) stone(g, Math.max(0, x), y, Math.min(7, 16 - Math.max(0, x)), 5, 'coral-2', 'coral-1', 'coral-3', 'stone-4')
      const m = c.mask
      // 弧形的轉角：外側切掉
      const cut = (cx: number, cy: number) => {
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const dx = x - cx
            const dy = y - cy
            if (dx * dx + dy * dy > 15.5 * 15.5) g.cut(x, y, 1, 1)
          }
      }
      if (m === (2 | 4)) cut(15, 15)
      else if (m === (8 | 4)) cut(0, 15)
      else if (m === (2 | 1)) cut(15, 0)
      else if (m === (8 | 1)) cut(0, 0)
      if (!(m & 1)) {
        g.hline(0, 15, 0, 'coral-1')
        g.hline(0, 15, 1, 'leaf-3')
      }
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/blockwall',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'okinawa/blockwall',
    draw(g, c) {
      // 花ブロック的牆：水泥塊，中間有花樣的洞
      const l = c.mask & 8 ? 0 : 1
      const r = c.mask & 2 ? 15 : 14
      shadow(g, 8, 15, 7, 1)
      g.rect(l, 4, r - l + 1, 11, 'stone-1')
      g.hline(l, r, 4, 'white')
      g.hline(l, r, 14, 'stone-3')
      for (let x = l + 1; x < r - 2; x += 5) {
        g.rect(x, 7, 4, 4, 'stone-3')
        g.px(x + 1, 8, 'stone-1')
        g.px(x + 2, 9, 'stone-1')
      }
    },
  },
  ...(['hibiscus', 'bougain'] as const).map(
    (kind): TileDef => ({
      id: R.take(1),
      name: `okinawa/${kind}`,
      layer: 'lower',
      behavior: 'block',
      variants: 2,
      draw(g, c) {
        // 扶桑花（紅）、九重葛（紫紅）：灌木＋花（冬天少一點）
        const t = leafTones(c.season, K)
        shadow(g, 8, 14, 6, 1)
        foliage(g, 8, 9, 6, 5, t, 5 + c.variant)
        const k: Px = kind === 'hibiscus' ? 'shu-1' : 'bougain'
        const spots = c.season === 'winter' ? [[5, 7]] : [[5, 7], [10, 6], [7, 11], [11, 10], [3, 10]]
        for (const [x, y] of spots) {
          g.rect(x! - 1, y! - 1, 3, 3, k)
          g.px(x!, y!, kind === 'hibiscus' ? 'gold-1' : 'white')
        }
      },
    }),
  ),
  {
    id: R.take(1),
    name: 'okinawa/shisa',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // シーサー：台座の上の獅子（赤瓦の色）
      shadow(g, 8, 15, 6, 1)
      g.rect(3, 11, 10, 4, 'coral-2')
      g.hline(3, 12, 11, 'coral-1')
      g.rect(4, 3, 8, 8, 'kawara-2')
      g.rect(5, 2, 6, 3, 'kawara-1')
      g.px(6, 4, 'ink')
      g.px(9, 4, 'ink')
      g.hline(5, 10, 7, 'kawara-3')
      g.px(4, 2, 'kawara-3')
      g.px(11, 2, 'kawara-3')
      for (const x of [4, 6, 9, 11]) g.px(x, 10, 'kawara-3')
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/rock',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      shadow(g, 8, 13, 6, 2)
      if (c.variant) stone(g, 2, 4, 12, 10, 'coral-2', 'coral-1', 'coral-3', 'stone-4')
      else {
        stone(g, 1, 7, 8, 7, 'coral-2', 'coral-1', 'coral-3', 'stone-4')
        stone(g, 7, 3, 8, 10, 'coral-2', 'coral-1', 'coral-3', 'stone-4')
      }
      g.px(4, 9, 'leaf-3')
      g.px(10, 5, 'leaf-2')
    },
  },
  {
    id: R.take(1),
    name: 'okinawa/bench',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      shadow(g, 8, 14, 7, 1)
      g.rect(1, 7, 14, 4, 'coral-1')
      g.hline(1, 14, 7, 'white')
      g.hline(1, 14, 10, 'coral-3')
      g.rect(2, 11, 3, 3, 'coral-3')
      g.rect(11, 11, 3, 3, 'coral-3')
    },
  },
]

// ---------- 樹 ----------
const TREES: TileDef[] = [
  ...defineObject({
    id: R.take(2),
    name: 'okinawa/fukugi',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // フクギ：直立、葉子厚而密（防風林），一年四季都綠
      shadow(g, 8, 29, 6, 2)
      trunk(g, 7, 20, 29, 2, 'wood-3', 'ink-2', 'wood-2')
      const t: Tones = c.season === 'winter' ? { line: 'leaf-4', dark: 'leaf-4', mid: 'leaf-3', light: 'leaf-2' } : { line: 'leaf-4', dark: 'leaf-4', mid: 'leaf-3', light: 'leaf-1' }
      g.ellipse(8, 11, 7, 11, t.line)
      g.ellipse(8, 11, 6, 10, t.mid)
      g.dither(9, 4, 6, 17, t.dark, 8)
      for (let y = 3; y < 20; y += 3) {
        g.px(4 + (y % 2), y, t.light)
        g.px(5 + (y % 2), y + 1, t.light)
      }
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'okinawa/gajumaru',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    draw(g, c) {
      // ガジュマル：大的樹冠、從枝垂下的氣根、粗而扭曲的幹
      shadow(g, 16, 29, 13, 2)
      const t = leafTones(c.season, K)
      g.rect(10, 15, 12, 15, 'wood-2')
      for (let x = 10; x < 22; x += 3) g.vline(x, 15, 29, 'wood-3')
      g.vline(11, 15, 29, 'wood-1')
      foliage(g, 16, 10, 15, 9, t, 51)
      for (const x of [5, 8, 24, 27]) {
        g.vline(x, 14, 24 + (x % 3), 'wood-2')
        g.px(x, 25 + (x % 3), 'wood-3')
      }
    },
  }),
  ...defineObject({
    id: R.take(3),
    name: 'okinawa/palm',
    w: 1,
    h: 3,
    cells: ['o', 'o', 'L'],
    draw(g, c) {
      // 椰子：細長微彎的幹（一節一節）、放射狀的葉
      shadow(g, 9, 45, 6, 2)
      for (let y = 12; y < 46; y++) {
        const x = 7 + Math.round(Math.sin(y / 14) * 2)
        g.rect(x, y, 3, 1, (y % 4) === 0 ? 'wood-3' : 'wood-2')
        g.px(x, y, 'wood-1')
      }
      const t = leafTones(c.season, K)
      const fronds: Array<[number, number]> = [[-8, 4], [-7, -3], [-2, -7], [4, -6], [8, -1], [8, 5], [0, 7]]
      for (const [dx, dy] of fronds) {
        g.line(8, 11, 8 + dx, 11 + dy, t.line)
        g.line(8, 10, 8 + dx, 10 + dy, t.mid)
        g.px(8 + Math.round(dx / 2), 10 + Math.round(dy / 2) - 1, t.light)
      }
      g.rect(6, 10, 4, 3, 'wood-3')
      g.px(7, 13, 'gold-2')
      g.px(9, 13, 'gold-2')
    },
  }),
  ...defineObject({
    id: R.take(8),
    name: 'okinawa/kanhi',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    bloom: true,
    draw(g, c) {
      // 寒緋櫻：開花時是深一點的粉紅（吊鐘形的小花）；其他時候是綠葉
      shadow(g, 16, 29, 11, 2)
      trunk(g, 14, 17, 29, 3, 'ink-2', 'ink', 'wood-3')
      g.line(15, 19, 9, 12, 'ink-2')
      g.line(16, 18, 23, 12, 'ink-2')
      if (c.bloom) {
        bareBranches(g, 16, 12, 11, 8, 'ink-2', 3)
        blossoms(g, 16, 11, 12, 8, 'kanhi-1', 'kanhi-2', 0.35, 9)
        speckle(g, 6, 5, 20, 12, 'sakura-2', 0.04, 3)
        return
      }
      foliage(g, 16, 11, 12, 9, leafTones(c.season, K), 61)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'okinawa/tree',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      shadow(g, 8, 29, 7, 2)
      trunk(g, 6, 18, 29, 4)
      foliage(g, 8, 11, 7, 9, leafTones(c.season, K), 71)
    },
  }),
]

// ---------- 建築 ----------
/** 赤瓦的屋頂（寄棟）：瓦與瓦之間的白漆喰、屋脊正中的シーサー */
function redRoof(g: Gfx, x: number, y: number, w: number, h: number, shisa = true) {
  tileRoof(g, x, y, w, h, RED_ROOF, { slope: Math.round(w / 8), mortar: 'white' })
  // 屋脊、四邊的漆喰
  g.hline(x + Math.round(w / 8) + 1, x + w - Math.round(w / 8) - 2, y + 1, 'white')
  if (shisa) {
    const cx = x + Math.round(w / 2) - 3
    g.rect(cx, y - 3, 6, 5, 'kawara-2')
    g.rect(cx + 1, y - 4, 4, 2, 'kawara-1')
    g.px(cx + 1, y - 2, 'ink')
    g.px(cx + 4, y - 2, 'ink')
  }
}

/** 赤瓦的房子（4×4）：低而寬的屋頂、白牆或木的雨戶、前面的緣側 */
function redHouse(g: Gfx, c: TileCtx, style: 0 | 1, door: 'none' | 'door' | 'shop') {
  const night = c.time === 'night'
  redRoof(g, 0, 6, 64, 28)
  g.rect(2, 34, 60, 27, style ? 'wood-2' : 'white')
  if (style) for (let x = 4; x < 62; x += 4) g.vline(x, 34, 60, 'wood-3')
  else g.dither(2, 34, 60, 4, 'coral-1', 8)
  for (const x of [2, 60]) g.rect(x, 34, 2, 27, 'wood-3')
  windowPane(g, 6, 39, 12, 10, night)
  windowPane(g, 46, 39, 12, 10, night)
  g.rect(22, 38, 20, 23, 'wood-3')
  if (door === 'none') {
    g.rect(23, 39, 18, 22, 'wood-2')
    for (let y = 41; y < 60; y += 3) g.hline(23, 40, y, 'wood-3')
  } else {
    g.rect(23, 39, 18, 22, night ? 'lamp-1' : 'ink-2')
    if (door === 'shop') noren(g, 21, 38, 22, 9, 'cloth-2', 'roof-3')
  }
  g.rect(0, 61, 64, 3, 'coral-2')
  g.hline(0, 63, 63, 'coral-3')
}

/** 水泥的平頂房子（那覇的街上）：屋頂的水塔、陽台 */
function concrete(g: Gfx, c: TileCtx, style: 0 | 1) {
  const night = c.time === 'night'
  g.rect(0, 8, 64, 20, 'stone-1')
  g.hline(0, 63, 8, 'white')
  g.rect(0, 26, 64, 3, 'stone-2')
  // 水塔
  g.rect(style ? 42 : 8, 0, 14, 12, 'white')
  g.frame(style ? 42 : 8, 0, 14, 12, 'stone-3')
  g.rect(style ? 44 : 10, 12, 2, 4, 'stone-3')
  g.rect(style ? 52 : 18, 12, 2, 4, 'stone-3')
  g.rect(2, 29, 60, 32, style ? 'paper' : 'coral-1')
  g.dither(2, 29, 60, 3, 'stone-1', 8)
  for (const x of [6, 26, 46]) windowPane(g, x, 32, 12, 9, night, 'stone-3')
  g.rect(4, 43, 56, 3, 'stone-2')
  for (let x = 5; x < 60; x += 6) g.rect(x, 46, 3, 2, 'stone-2')
  windowPane(g, 6, 49, 12, 10, night, 'stone-3')
  g.rect(26, 48, 14, 13, 'stone-3')
  g.rect(27, 49, 12, 12, style ? 'cloth-1' : 'sea-2')
  windowPane(g, 46, 49, 12, 10, night, 'stone-3')
  g.rect(0, 61, 64, 3, 'stone-2')
  g.hline(0, 63, 63, 'stone-4')
}

const BUILDINGS: TileDef[] = [
  ...[0, 1].flatMap((s) =>
    defineObject({ id: R.take(16), name: `okinawa/house-${'ab'[s]}`, w: 4, h: 4, cells: ['OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => redHouse(g, c, s as 0 | 1, 'none') }),
  ),
  ...[0, 1].flatMap((st) =>
    defineObject({
      id: R.take(12),
      name: `okinawa/house-low-${'ab'[st]}`,
      w: 4,
      h: 3,
      cells: ['OOOO', 'LLLL', 'LLLL'],
      draw(g, c) {
        // 小的赤瓦平屋（シーサーは小さく）
        const night = c.time === 'night'
        redRoof(g, 0, 4, 64, 16, st === 0)
        g.rect(2, 20, 60, 23, st ? 'wood-2' : 'white')
        if (st) for (let x = 4; x < 62; x += 4) g.vline(x, 20, 42, 'wood-3')
        windowPane(g, 8, 24, 12, 9, night)
        g.rect(36, 23, 18, 20, 'wood-3')
        g.rect(37, 24, 16, 19, 'wood-2')
        g.rect(0, 43, 64, 5, 'coral-2')
        g.hline(0, 63, 47, 'coral-3')
      },
    }),
  ),
  ...defineObject({ id: R.take(16), name: 'okinawa/house-door', w: 4, h: 4, cells: ['OOOO', 'OOOO', 'LLLL', 'LDLL'], draw: (g, c) => redHouse(g, c, 0, 'door') }),
  ...defineObject({ id: R.take(16), name: 'okinawa/house-shop', w: 4, h: 4, cells: ['OOOO', 'OOOO', 'LLLL', 'LDLL'], draw: (g, c) => redHouse(g, c, 1, 'shop') }),
  ...[0, 1].flatMap((s) =>
    defineObject({ id: R.take(16), name: `okinawa/concrete-${'ab'[s]}`, w: 4, h: 4, cells: ['OOOO', 'LLLL', 'LLLL', 'LLLL'], draw: (g, c) => concrete(g, c, s as 0 | 1) }),
  ),
  ...defineObject({
    id: R.take(2),
    name: 'okinawa/hinpun',
    w: 2,
    h: 1,
    cells: ['LL'],
    draw(g) {
      // ヒンプン：門後的一道石屏風
      shadow(g, 16, 15, 14, 1)
      g.rect(1, 3, 30, 12, 'coral-3')
      for (let y = 3; y < 14; y += 4) for (let x = 1 + ((y >> 2) % 2) * 3; x < 30; x += 6) stone(g, x, y, 6, 4, 'coral-2', 'coral-1', 'coral-3', 'coral-3')
      g.hline(1, 30, 3, 'coral-1')
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'okinawa/shokudo',
    w: 5,
    h: 4,
    cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      const night = c.time !== 'day'
      redRoof(g, 0, 6, 80, 24)
      g.rect(2, 30, 76, 31, 'white')
      g.rect(8, 33, 64, 7, 'cloth-2')
      for (let x = 12; x < 68; x += 6) g.hline(x, x + 3, 36, 'white')
      windowPane(g, 6, 43, 18, 12, c.time === 'night')
      windowPane(g, 56, 43, 18, 12, c.time === 'night')
      g.rect(30, 41, 20, 20, 'wood-3')
      g.rect(31, 42, 18, 19, night ? 'lamp-1' : 'ink-2')
      noren(g, 29, 40, 22, 10, 'white', 'stone-2', 'cloth-2')
      lantern(g, 24, 42, night)
      lantern(g, 53, 42, night)
      g.rect(0, 61, 80, 3, 'coral-2')
      g.hline(0, 79, 63, 'coral-3')
    },
  }),
  ...defineObject({
    id: R.take(24),
    name: 'okinawa/minshuku',
    w: 6,
    h: 4,
    cells: ['OOOOOO', 'OOOOOO', 'LLLLLL', 'LLDLLL'],
    draw(g, c) {
      // 民宿：大的赤瓦屋頂、木的緣側、門口的扶桑花盆
      const night = c.time !== 'day'
      redRoof(g, 0, 6, 96, 28)
      g.rect(2, 34, 92, 24, 'wood-2')
      for (let x = 4; x < 94; x += 4) g.vline(x, 34, 57, 'wood-3')
      for (const x of [8, 66]) windowPane(g, x, 38, 20, 12, night)
      g.rect(36, 37, 24, 24, 'wood-3')
      g.rect(37, 38, 22, 23, night ? 'lamp-1' : 'ink-2')
      noren(g, 35, 37, 26, 10, 'sea-2', 'sea-3')
      g.rect(0, 56, 96, 5, 'wood-1')
      g.hline(0, 95, 56, 'paper-2')
      for (const x of [26, 64]) {
        g.rect(x, 50, 6, 6, 'kawara-2')
        g.rect(x - 1, 46, 8, 5, 'leaf-3')
        g.px(x + 1, 47, 'shu-1')
        g.px(x + 4, 48, 'shu-1')
      }
      g.rect(0, 61, 96, 3, 'coral-2')
      g.hline(0, 95, 63, 'coral-3')
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'okinawa/teahouse',
    w: 5,
    h: 4,
    cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      // 茶屋：赤瓦、木的格子窗、紅暖簾，門前的石垣
      const night = c.time !== 'day'
      redRoof(g, 0, 6, 80, 26)
      g.rect(2, 32, 76, 29, 'wood-2')
      for (const x of [6, 54]) {
        g.rect(x, 36, 20, 14, 'wood-3')
        for (let xx = x + 1; xx < x + 20; xx += 2) g.vline(xx, 37, 48, night ? 'lamp-2' : 'wood-1')
      }
      g.rect(30, 38, 20, 23, 'wood-3')
      g.rect(31, 39, 18, 22, night ? 'lamp-1' : 'ink-2')
      noren(g, 29, 37, 22, 10, 'shu-1', 'shu-2')
      g.rect(0, 61, 80, 3, 'coral-2')
      g.hline(0, 79, 63, 'coral-3')
    },
  }),
  ...defineObject({
    id: R.take(9),
    name: 'okinawa/gusuku-gate',
    w: 3,
    h: 3,
    cells: ['OoO', 'LoL', 'L.L'],
    draw(g) {
      // グスクの石の拱門（アーチ）：切石を積んだ門、上は石垣の続き
      g.rect(0, 2, 48, 44, 'coral-3')
      for (let y = 2; y < 46; y += 6)
        for (let x = (y / 6) % 2 ? -4 : 0; x < 48; x += 8) stone(g, Math.max(0, x), y, Math.min(8, 48 - Math.max(0, x)), 6, 'coral-2', 'coral-1', 'coral-3', 'stone-4')
      g.hline(0, 47, 2, 'coral-1')
      g.hline(0, 47, 3, 'leaf-3')
      // 拱的開口
      for (let y = 18; y < 48; y++) {
        const t = y < 26 ? Math.sqrt(Math.max(0, 1 - ((26 - y) / 8) ** 2)) : 1
        const half = Math.round(8 * t)
        g.hline(24 - half, 23 + half, y, y < 30 ? 'ink-2' : 'ink')
      }
      g.cut(16, 32, 16, 16)
      for (let y = 18; y < 32; y++) {
        const t = y < 26 ? Math.sqrt(Math.max(0, 1 - ((26 - y) / 8) ** 2)) : 1
        const half = Math.round(8 * t)
        g.px(24 - half - 1, y, 'coral-1')
        g.px(23 + half + 1, y, 'stone-4')
      }
    },
  }),
  ...defineObject({
    id: R.take(9),
    name: 'okinawa/gate',
    w: 3,
    h: 3,
    cells: ['OoO', 'LoL', 'L.L'],
    draw(g) {
      // 門（名字有「門」的地標）：赤瓦的屋頂、朱色的柱子（一般的門，不照任何真的門畫）
      tileRoof(g, 0, 2, 48, 14, RED_ROOF, { slope: 4, mortar: 'white' })
      for (const x of [4, 38]) {
        g.rect(x, 16, 6, 30, 'shu-2')
        g.vline(x, 16, 45, 'shu-1')
        g.vline(x + 5, 16, 45, 'shu-3')
      }
      g.rect(10, 16, 28, 4, 'shu-3')
      g.hline(10, 37, 16, 'gold-2')
      g.rect(0, 44, 16, 4, 'coral-2')
      g.rect(32, 44, 16, 4, 'coral-2')
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'okinawa/utaki',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    draw(g, c) {
      // 御嶽：大的岩石、岩縫、旁邊的樹（不畫建築）
      shadow(g, 16, 30, 14, 2)
      stone(g, 1, 6, 16, 24, 'coral-3', 'coral-2', 'stone-3', 'stone-4')
      stone(g, 14, 2, 17, 28, 'coral-2', 'coral-1', 'coral-3', 'stone-4')
      g.vline(16, 8, 29, 'ink-2')
      g.vline(17, 10, 29, 'ink')
      const t = leafTones(c.season, K)
      foliage(g, 6, 6, 6, 5, t, 81)
      g.px(26, 12, 'leaf-3')
      g.px(25, 18, 'leaf-2')
    },
  }),
  ...defineObject({
    id: R.take(36),
    name: 'okinawa/airport',
    w: 9,
    h: 4,
    cells: ['OOOOOOOOO', 'LLLLLLLLL', 'LLLLLLLLL', 'LLLDDDLLL'],
    draw(g, c) {
      // 機場航廈：白的長建築、玻璃帷幕、入口的雨遮
      const night = c.time === 'night'
      g.rect(0, 2, 144, 14, 'stone-1')
      g.hline(0, 143, 2, 'white')
      g.rect(0, 14, 144, 3, 'stone-3')
      g.rect(2, 17, 140, 44, 'white')
      for (let x = 4; x < 140; x += 8) {
        g.rect(x, 20, 7, 22, night ? 'lamp-2' : 'sky-day-1')
        g.vline(x, 20, 41, 'stone-2')
        if (!night) g.px(x + 1, 21, 'white')
      }
      g.hline(2, 141, 42, 'stone-2')
      g.rect(40, 44, 64, 3, 'stone-3')
      g.rect(46, 47, 52, 14, 'stone-3')
      g.rect(48, 48, 48, 13, night ? 'lamp-1' : 'sky-day-2')
      for (let x = 56; x < 96; x += 8) g.vline(x, 48, 60, 'stone-3')
      g.rect(0, 61, 144, 3, 'stone-2')
      g.hline(0, 143, 63, 'stone-4')
    },
  }),
  ...defineObject({
    id: R.take(20),
    name: 'okinawa/monorail',
    w: 5,
    h: 4,
    cells: ['ooooo', 'OOOOO', 'LLLLL', 'LLDLL'],
    draw(g, c) {
      // 單軌的車站：高架的軌道與月台、下面的入口與樓梯
      const night = c.time === 'night'
      g.rect(0, 4, 80, 6, 'stone-2')
      g.hline(0, 79, 4, 'white')
      g.hline(0, 79, 9, 'stone-3')
      g.rect(4, 10, 72, 18, 'white')
      g.rect(4, 14, 72, 8, night ? 'lamp-1' : 'sky-day-2')
      for (let x = 8; x < 76; x += 10) g.vline(x, 14, 21, 'stone-2')
      g.rect(0, 26, 80, 4, 'stone-3')
      for (const x of [8, 66]) {
        g.rect(x, 30, 6, 31, 'stone-1')
        g.vline(x + 5, 30, 60, 'stone-2')
      }
      g.rect(28, 34, 24, 27, 'stone-1')
      g.rect(30, 38, 20, 23, night ? 'lamp-1' : 'ink-2')
      g.rect(30, 34, 20, 3, 'cloth-1')
      g.rect(0, 61, 80, 3, 'stone-2')
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'okinawa/busstop',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g) {
      // 巴士站牌：圓牌＋柱子＋水泥台
      shadow(g, 8, 30, 5, 1)
      g.rect(4, 26, 8, 4, 'stone-2')
      g.vline(8, 10, 27, 'stone-3')
      g.vline(7, 10, 27, 'stone-1')
      g.ellipse(8, 7, 6, 6, 'cloth-2')
      g.ellipse(8, 7, 5, 5, 'white')
      g.rect(5, 6, 7, 3, 'cloth-1')
      g.rect(5, 14, 6, 8, 'paper')
      g.frame(5, 14, 6, 8, 'stone-3')
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'okinawa/stall',
    w: 2,
    h: 2,
    cells: ['OO', 'LL'],
    draw(g, c) {
      const night = c.time !== 'day'
      for (let x = 0; x < 32; x += 4) g.rect(x, 6, 4, 8, (x / 4) % 2 ? 'white' : 'sea-2')
      g.hline(0, 31, 5, 'sea-3')
      g.hline(0, 31, 14, 'sea-3')
      g.rect(2, 16, 2, 14, 'wood-3')
      g.rect(28, 16, 2, 14, 'wood-3')
      g.rect(1, 22, 30, 8, 'wood-2')
      g.hline(1, 30, 22, 'wood-1')
      for (const [x, k] of [[6, 'gold-1'], [12, 'shu-1'], [18, 'lagoon-2'], [24, 'kawara-1']] as const) g.rect(x, 19, 4, 3, k)
      lantern(g, 14, 15, night)
    },
  }),
  ...defineObject({
    id: R.take(24),
    name: 'okinawa/museum',
    w: 6,
    h: 4,
    cells: ['OOOOOO', 'LLLLLL', 'LLLLLL', 'LLLLLL'],
    draw(g, c) {
      // 展館：石灰岩色的牆、深的屋簷、格子狀的遮陽
      const night = c.time === 'night'
      g.rect(0, 4, 96, 10, 'coral-2')
      g.hline(0, 95, 4, 'coral-1')
      g.rect(0, 12, 96, 4, 'coral-3')
      g.rect(2, 16, 92, 44, 'coral-1')
      for (let x = 4; x < 92; x += 6) g.rect(x, 18, 3, 22, 'coral-2')
      g.rect(36, 36, 24, 24, 'stone-3')
      g.rect(38, 38, 20, 22, night ? 'lamp-1' : 'sky-day-2')
      g.vline(47, 38, 59, 'stone-3')
      g.rect(0, 60, 96, 4, 'coral-2')
      g.hline(0, 95, 63, 'coral-3')
    },
  }),
]

export const OKINAWA_TILES: TileDef[] = [...GROUND, ...SMALL, ...TREES, ...BUILDINGS]
registerTileset('okinawa', OKINAWA_TILES)

export const OKINAWA_BLOOM: Record<string, { flower: 'kanhi'; bloom: string }> = {
  'okinawa/kanhi': { flower: 'kanhi', bloom: 'okinawa/kanhi@bloom' },
}

/** 水的深淺（生成器用）：0 淺、1 海、2 深 */
export const okinawaDepth = depthOf
