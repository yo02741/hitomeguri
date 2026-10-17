import type { Gfx } from '../../../services/pixelwalk/gfx'

import { registerTileset } from '../../engine/tiles'
import type { TileCtx, TileDef } from '../../engine/types'

import { bareBranches, bevel, blossoms, foliage, grassTint, grassTones, hash2, leafTones, shadow, speckle, type Tones, trunk, tuft } from './draw'
import { lighthouse, onsen, peak, waterfall } from './nature'
import { defineObject, idRange, registerBloom } from './objects'
import {
  apartment,
  bicycles,
  boxHouse,
  church,
  cityInn,
  eatery,
  elevatedStation,
  hall,
  highrise,
  kanbanShop,
  konbini,
  latticeTower,
  mixedUse,
  officeGlass,
  officeTile,
  postbox,
  screenBuilding,
  shopFront,
  slenderTower,
  smallHouse,
  streetLamp,
  tiledHouse,
  trafficSignal,
  type UrbanOpts,
  utilityPole,
  vending,
} from './urban'

/**
 * 關東 kit（id 4096–5119，名字 'kanto/…'）：東京的鎮。
 * 地面：草皮（冬天枯成淺褐、不積雪）、柏油路（沒接到路的那一邊是人行道與路緣）、郊外的柏油路、斑馬線（橫、直）、
 * 花崗岩的鋪石、站前廣場（有導盲磚）、水泥護岸的河、水泥橋、旱田。
 * 辦公大樓（玻璃、磁磚）、住商混合、公寓、獨棟（灰瓦、平屋頂）、平房、便利商店（色帶不是哪一家的）、高架的車站、
 * 高樓、大螢幕的大樓、會館、定食屋、旅館、看板建築的老舖、教堂、鐵塔、細長的塔、高架鐵道（橋面、橋墩）、
 * 自動販賣機、紅綠燈、電線桿、路燈、郵筒、腳踏車、圍籬、ブロック塀、樹籬、長椅、告示牌；
 * 樹：銀杏、櫻、櫸、行道樹、一般的樹。寺社、城、茶屋沿用近畿的零件。招牌只畫色塊、不寫字。
 */
const R = idRange(4096, 5119)
const K = 'kanto' as const
const U: UrbanOpts = { snow: false }
const N = { kit: K, snow: false }

// ---------- 地面 ----------
const ROADS = new Set(['kanto/street', 'kanto/road', 'kanto/zebra-h', 'kanto/zebra-v', 'kanto/bridge-h', 'kanto/bridge-v'])
const isRoad = (name?: string) => !!name && ROADS.has(name)
const PAVED = new Set(['kanto/paving', 'kanto/plaza'])
const isPaved = (name?: string) => !!name && (PAVED.has(name) || isRoad(name) || name.startsWith('world/') || name === 'kinki/gravel' || name === 'kinki/sando')

function grass(g: Gfx, c: TileCtx) {
  const k = grassTones(c.season, K)
  g.rect(0, 0, 16, 16, k.base)
  const tint = grassTint(c.season, K)
  if (tint) g.dither(0, 0, 16, 16, tint.k, tint.level)
  if (c.variant === 0) {
    tuft(g, 2, 4, k.dark, k.light)
    tuft(g, 10, 11, k.dark)
    g.px(13, 3, k.light)
  } else if (c.variant === 1) {
    g.px(4, 12, k.light)
    g.px(11, 5, k.light)
    g.px(7, 2, k.dark)
    g.px(13, 13, k.dark)
  } else if (c.variant === 2) {
    tuft(g, 6, 8, k.dark, k.light)
    g.px(2, 13, k.light)
  } else {
    speckle(g, 0, 0, 16, 16, k.dark, 0.05, 3)
    tuft(g, 11, 3, k.dark)
    // 秋、冬：幾片落葉
    if (c.season === 'autumn' || c.season === 'winter') for (const [x, y] of [[4, 10], [9, 13]] as const) g.px(x, y, c.season === 'autumn' ? 'gold-1' : 'wood-2')
  }
}

/** 人行道（路緣石＋鋪面）：沒接到路的那一邊，寬 4px */
function sidewalk(g: Gfx, side: 'up' | 'down' | 'left' | 'right') {
  const hor = side === 'up' || side === 'down'
  const [x, y, w, h] = side === 'up' ? [0, 0, 16, 4] : side === 'down' ? [0, 12, 16, 4] : side === 'left' ? [0, 0, 4, 16] : [12, 0, 4, 16]
  g.rect(x, y, w, h, 'stone-1')
  if (hor) for (let xx = 3; xx < 16; xx += 4) g.vline(xx, y, y + h - 1, 'paper-2')
  else for (let yy = 3; yy < 16; yy += 4) g.hline(x, x + w - 1, yy, 'paper-2')
  // 路緣：亮的石＋車道那一邊的影子
  if (side === 'up') {
    g.hline(0, 15, 3, 'white')
    g.hline(0, 15, 4, 'asphalt-2')
    g.dither(0, 4, 16, 1, 'ink-2', 6)
  } else if (side === 'down') {
    g.hline(0, 15, 12, 'white')
    g.hline(0, 15, 11, 'ink-2')
  } else if (side === 'left') {
    g.vline(3, 0, 15, 'white')
    g.vline(4, 0, 15, 'ink-2')
  } else {
    g.vline(12, 0, 15, 'white')
    g.vline(11, 0, 15, 'ink-2')
  }
}

/** 柏油（街上的路）：沒接到路的那一邊是人行道；兩格寬的路中間是白的虛線 */
function asphalt(g: Gfx, c: TileCtx, walks = true) {
  g.rect(0, 0, 16, 16, 'asphalt-2')
  speckle(g, 0, 0, 16, 16, 'asphalt-1', 0.07, 11 + c.variant)
  speckle(g, 0, 0, 16, 16, 'roof-3', 0.03, 21 + c.variant)
  const m = c.mask
  const up = !!(m & 1)
  const right = !!(m & 2)
  const down = !!(m & 4)
  const left = !!(m & 8)
  // 兩格寬的路：中線（白的虛線）在兩格的交界
  if (left && right && !up && down) for (const x of [2, 10]) g.hline(x, x + 3, 15, 'paper')
  if (left && right && up && !down) for (const x of [2, 10]) g.hline(x, x + 3, 0, 'paper')
  if (up && down && !left && right) for (const y of [2, 10]) g.vline(15, y, y + 3, 'paper')
  if (up && down && left && !right) for (const y of [2, 10]) g.vline(0, y, y + 3, 'paper')
  if (!walks) {
    // 郊外：路邊的白線
    if (!up) g.hline(0, 15, 1, 'paper-2')
    if (!down) g.hline(0, 15, 14, 'paper-2')
    if (!left) g.vline(1, 0, 15, 'paper-2')
    if (!right) g.vline(14, 0, 15, 'paper-2')
    if (!up) g.hline(0, 15, 0, 'stone-3')
    if (!down) g.hline(0, 15, 15, 'stone-3')
    if (!left) g.vline(0, 0, 15, 'stone-3')
    if (!right) g.vline(15, 0, 15, 'stone-3')
    return
  }
  if (!up) sidewalk(g, 'up')
  if (!down) sidewalk(g, 'down')
  if (!left) sidewalk(g, 'left')
  if (!right) sidewalk(g, 'right')
}

/** 斑馬線：h＝橫的路上（白條是直的）、v＝直的路上（白條是橫的） */
function zebra(dir: 'h' | 'v') {
  return (g: Gfx, c: TileCtx) => {
    asphalt(g, c)
    const m = c.mask
    if (dir === 'h') {
      const y0 = m & 1 ? 1 : 5
      const y1 = m & 4 ? 14 : 10
      for (const x of [1, 5, 9, 13]) {
        g.rect(x, y0, 2, y1 - y0 + 1, 'white')
        g.vline(x + 1, y0, y1, 'paper-2')
      }
    } else {
      const x0 = m & 8 ? 1 : 5
      const x1 = m & 2 ? 14 : 10
      for (const y of [1, 5, 9, 13]) {
        g.rect(x0, y, x1 - x0 + 1, 2, 'white')
        g.hline(x0, x1, y + 1, 'paper-2')
      }
    }
  }
}

const GROUND: TileDef[] = [
  { id: R.take(1), name: 'kanto/grass', layer: 'ground', behavior: 'walk', variants: 4, draw: grass },
  { id: R.take(1), name: 'kanto/street', layer: 'ground', behavior: 'walk', variants: 2, connect: (o) => isRoad(o?.name), draw: (g, c) => asphalt(g, c) },
  { id: R.take(1), name: 'kanto/road', layer: 'ground', behavior: 'walk', variants: 2, connect: (o) => isRoad(o?.name), draw: (g, c) => asphalt(g, c, false) },
  { id: R.take(1), name: 'kanto/zebra-h', layer: 'ground', behavior: 'walk', connect: (o) => isRoad(o?.name), draw: zebra('h') },
  { id: R.take(1), name: 'kanto/zebra-v', layer: 'ground', behavior: 'walk', connect: (o) => isRoad(o?.name), draw: zebra('v') },
  {
    id: R.take(1),
    name: 'kanto/paving',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    connect: (o) => isPaved(o?.name),
    draw(g, c) {
      // 花崗岩的鋪石：錯開的長方形、偶爾一塊顏色深一點
      g.rect(0, 0, 16, 16, 'stone-1')
      for (let row = 0; row < 4; row++) {
        const y = row * 4
        g.hline(0, 15, y + 3, 'stone-2')
        const off = (row + c.variant) % 2 ? 3 : 7
        for (let x = off; x < 16; x += 8) g.vline(x, y, y + 2, 'stone-2')
        if (hash2(row, c.variant, 5) % 3 === 0) g.rect(((row * 5) % 8) + 1, y, 4, 3, 'paper-2')
        g.px(((row * 7 + c.variant * 3) % 14) + 1, y + 1, 'white')
      }
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
    name: 'kanto/plaza',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      // 站前廣場：兩色的方磚（花樣只差一點點的磨損）
      for (const y of [0, 8]) for (const x of [0, 8]) bevel(g, x, y, 8, 8, ((x + y) / 8) % 2 ? 'stone-1' : 'paper-2', 'paper', 'stone-2')
      if (c.variant) {
        g.px(3, 12, 'stone-2')
        g.px(12, 4, 'stone-2')
      }
    },
  },
  {
    id: R.take(1),
    name: 'kanto/water',
    layer: 'ground',
    behavior: 'water',
    frames: 4,
    fps: 2.5,
    connect: (o) => !!o && (o.name === 'kanto/water' || o.name.startsWith('kanto/bridge')),
    draw(g, c) {
      // 都市的河：深一點的水、水泥的護岸（上緣亮、壁面、水線）
      g.rect(0, 0, 16, 16, 'sea-3')
      g.dither(0, 0, 16, 16, 'sea-2', 6)
      const f = c.frame
      for (const [x, y] of [[1, 3], [9, 7], [4, 11], [12, 14]] as const) {
        const xx = (x + f * 2) % 16
        g.hline(xx, Math.min(15, xx + 2), y, 'sea-1')
      }
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 5, 'stone-2')
        g.hline(0, 15, 0, 'stone-1')
        for (let x = 3; x < 16; x += 8) g.vline(x, 1, 4, 'stone-3')
        g.hline(0, 15, 5, 'ink-2')
      }
      if (!(c.mask & 4)) {
        g.hline(0, 15, 15, 'stone-2')
        g.hline(0, 15, 14, f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 8)) {
        g.rect(0, 0, 2, 16, 'stone-2')
        g.vline(2, 0, 15, 'ink-2')
      }
      if (!(c.mask & 2)) {
        g.rect(14, 0, 2, 16, 'stone-2')
        g.vline(13, 0, 15, 'ink-2')
      }
    },
  },
  ...(['h', 'v'] as const).map(
    (d): TileDef => ({
      id: R.take(1),
      name: `kanto/bridge-${d}`,
      layer: 'ground',
      behavior: 'walk',
      draw(g, c) {
        // 水泥橋：下面是水，柏油的橋面、兩側的欄杆（不擋路）
        g.rect(0, 0, 16, 16, 'sea-3')
        g.hline(0, 15, (c.frame * 3) % 16, 'sea-2')
        if (d === 'h') {
          g.rect(0, 2, 16, 12, 'asphalt-2')
          speckle(g, 0, 3, 16, 10, 'asphalt-1', 0.06, 3)
          for (const y of [1, 13]) {
            g.rect(0, y, 16, 2, 'stone-1')
            g.hline(0, 15, y + (y === 1 ? 0 : 1), 'stone-3')
          }
          for (const x of [2, 10]) {
            g.rect(x, 0, 2, 3, 'stone-2')
            g.rect(x, 13, 2, 3, 'stone-2')
          }
        } else {
          g.rect(2, 0, 12, 16, 'asphalt-2')
          speckle(g, 3, 0, 10, 16, 'asphalt-1', 0.06, 4)
          for (const x of [1, 13]) {
            g.rect(x, 0, 2, 16, 'stone-1')
            g.vline(x + (x === 1 ? 0 : 1), 0, 15, 'stone-3')
          }
          for (const y of [2, 10]) {
            g.rect(0, y, 3, 2, 'stone-2')
            g.rect(13, y, 3, 2, 'stone-2')
          }
        }
      },
    }),
  ),
  {
    id: R.take(1),
    name: 'kanto/field',
    layer: 'ground',
    behavior: 'block',
    variants: 2,
    connect: (o) => o?.name === 'kanto/field',
    draw(g, c) {
      // 旱田：一畦一畦的土，季節換：春天的嫩芽、夏天圓圓的菜、秋天收成後、冬天的土與一點綠
      const s = c.season
      g.rect(0, 0, 16, 16, 'dirt-1')
      for (let y = 1; y < 16; y += 4) {
        g.hline(0, 15, y, 'dirt-2')
        g.hline(0, 15, y + 3, 'sand-2')
      }
      for (let y = 2; y < 16; y += 4)
        for (let x = 1 + ((y / 4) % 2) * 2; x < 16; x += 4) {
          if (s === 'spring') {
            g.px(x, y, 'leaf-1')
            g.px(x + 1, y - 1, 'leaf-2')
          } else if (s === 'summer') {
            g.rect(x - 1, y - 1, 3, 2, 'leaf-2')
            g.px(x, y - 1, 'leaf-1')
            g.px(x + 1, y, 'leaf-3')
          } else if (s === 'autumn') {
            if (c.variant) g.px(x, y, 'leaf-3')
            else g.rect(x - 1, y - 1, 2, 2, 'gold-2')
          } else if ((x + y + c.variant) % 3 === 0) g.px(x, y, 'leaf-3')
        }
      const k = grassTones(s, K)
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 2, k.base)
        g.hline(0, 15, 2, k.dark)
      }
      if (!(c.mask & 4)) g.rect(0, 14, 16, 2, k.base)
      if (!(c.mask & 8)) g.rect(0, 0, 2, 16, k.base)
      if (!(c.mask & 2)) g.rect(14, 0, 2, 16, k.base)
    },
  },
]

// ---------- 高架鐵道 ----------
const VIADUCT: TileDef[] = [
  {
    id: R.take(1),
    name: 'kanto/viaduct',
    layer: 'over',
    overhead: true,
    connect: (o) => !!o && o.name.startsWith('kanto/viaduct'),
    draw(g, c) {
      // 高架的橋面（從上面看：碎石、枕木、兩條鐵軌、兩側的護欄）＋下面一條大樑的側面
      g.rect(0, 0, 16, 2, 'stone-1')
      g.hline(0, 15, 0, 'white')
      g.rect(0, 2, 16, 7, 'stone-2')
      speckle(g, 0, 2, 16, 7, 'stone-3', 0.2, 9)
      for (let x = 1; x < 16; x += 3) g.vline(x, 2, 8, 'wood-3')
      g.hline(0, 15, 3, 'stone-1')
      g.hline(0, 15, 7, 'stone-1')
      g.hline(0, 15, 4, 'stone-4')
      g.hline(0, 15, 8, 'stone-4')
      g.rect(0, 9, 16, 1, 'stone-1')
      g.rect(0, 10, 16, 5, 'stone-2')
      g.hline(0, 15, 10, 'stone-1')
      g.hline(0, 15, 14, 'stone-3')
      g.hline(0, 15, 15, 'ink-2')
      if (!(c.mask & 8)) g.vline(0, 0, 15, 'ink-2')
      if (!(c.mask & 2)) g.vline(15, 0, 15, 'ink-2')
    },
  },
  {
    id: R.take(1),
    name: 'kanto/viaduct-pillar',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 橋墩：粗的水泥柱、上面的橋影
      g.dither(0, 0, 16, 4, 'ink-2', 6)
      shadow(g, 8, 15, 6, 1)
      g.rect(4, 0, 8, 15, 'ink-2')
      g.rect(5, 0, 6, 14, 'stone-2')
      g.vline(5, 0, 13, 'stone-1')
      g.vline(10, 0, 13, 'stone-3')
      g.hline(5, 10, 13, 'stone-3')
    },
  },
  {
    id: R.take(1),
    name: 'kanto/viaduct-shade',
    layer: 'over',
    draw(g) {
      // 高架下面的影子（地面暗一點）：只有抖色，下面的路、人看得到
      g.dither(0, 0, 16, 5, 'ink-2', 4)
      g.dither(0, 5, 16, 3, 'ink-2', 2)
    },
  },
]

// ---------- 一格的東西 ----------
const SMALL: TileDef[] = [
  {
    id: R.take(1),
    name: 'kanto/sign',
    layer: 'lower',
    behavior: 'sign',
    draw(g) {
      // 告示牌：兩根鐵柱、藍框的白板
      shadow(g, 8, 14, 6, 1)
      g.rect(3, 8, 2, 7, 'stone-3')
      g.rect(11, 8, 2, 7, 'stone-3')
      g.rect(1, 2, 14, 9, 'cloth-2')
      g.rect(2, 3, 12, 7, 'white')
      g.hline(3, 12, 5, 'stone-2')
      g.hline(3, 9, 7, 'stone-2')
      g.hline(1, 14, 2, 'cloth-1')
    },
  },
  ...[0, 1].map(
    (v): TileDef => ({
      id: R.take(1),
      name: `kanto/vending-${'ab'[v]}`,
      layer: 'lower',
      behavior: 'block',
      draw: (g, c) => vending(g, c, v ? 'shu-1' : 'white', v ? 'shu-2' : 'stone-1'),
    }),
  ),
  { id: R.take(1), name: 'kanto/postbox', layer: 'lower', behavior: 'block', draw: (g) => postbox(g) },
  { id: R.take(1), name: 'kanto/bicycle', layer: 'lower', behavior: 'block', draw: (g) => bicycles(g) },
  {
    id: R.take(1),
    name: 'kanto/fence',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'kanto/fence',
    draw(g, c) {
      // 鐵網的圍籬：柱子、上下兩條橫桿、菱形的網
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      if (vert) {
        g.vline(7, 0, 15, 'stone-3')
        g.vline(8, 0, 15, 'stone-2')
        for (let y = 1; y < 16; y += 3) g.px(6 + (y % 2) * 3, y, 'stone-2')
        return
      }
      shadow(g, 8, 14, 7, 1)
      g.hline(0, 15, 4, 'stone-2')
      g.hline(0, 15, 12, 'stone-3')
      for (let x = 0; x < 16; x += 2) {
        g.px(x, 6 + (x % 4 ? 0 : 1), 'stone-2')
        g.px(x + 1, 9 + (x % 4 ? 1 : 0), 'stone-2')
      }
      for (const x of [1, 14]) if ((x === 1 && !(c.mask & 8)) || (x === 14 && !(c.mask & 2)) || x === 1) g.rect(x, 3, 2, 11, 'stone-3')
    },
  },
  {
    id: R.take(1),
    name: 'kanto/wall',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && (o.name === 'kanto/wall' || o.name.startsWith('kinki/gate') || o.name.startsWith('kinki/sanmon')),
    draw(g, c) {
      // ブロック塀：水泥磚的格子、上面的蓋石
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      if (vert) {
        g.rect(4, 0, 8, 16, 'stone-2')
        g.rect(5, 0, 6, 16, 'stone-1')
        for (let y = 2; y < 16; y += 4) g.hline(5, 10, y, 'stone-2')
        g.vline(10, 0, 15, 'stone-3')
        return
      }
      g.rect(0, 3, 16, 2, 'stone-1')
      g.hline(0, 15, 3, 'white')
      g.rect(0, 5, 16, 9, 'paper-2')
      for (let y = 7; y < 14; y += 3) g.hline(0, 15, y, 'stone-2')
      for (let y = 5; y < 14; y += 3) for (let x = (y % 2) * 4; x < 16; x += 8) g.vline(x, y, y + 1, 'stone-2')
      g.rect(0, 13, 16, 2, 'stone-3')
      g.hline(0, 15, 15, 'stone-4')
      if (!(c.mask & 8)) g.vline(0, 3, 15, 'stone-4')
      if (!(c.mask & 2)) g.vline(15, 3, 15, 'stone-4')
    },
  },
  {
    id: R.take(1),
    name: 'kanto/hedge',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'kanto/hedge',
    draw(g, c) {
      // 修剪成方形的樹籬（常綠）＋石的花台
      const t = leafTones('summer', K)
      const l = c.mask & 8 ? 0 : 1
      const r = c.mask & 2 ? 15 : 14
      g.rect(l, 3, r - l + 1, 9, t.line)
      g.rect(l + (l ? 1 : 0), 4, r - l + 1 - (l ? 1 : 0) - (r < 15 ? 1 : 0), 7, t.mid)
      g.dither(0, 8, 16, 3, t.dark, 8)
      for (let x = l + 1; x < r; x += 4) {
        g.px(x, 5, t.light)
        g.px(x + 1, 5, t.light)
      }
      g.rect(0, 12, 16, 3, 'stone-2')
      g.hline(0, 15, 12, 'stone-1')
      g.hline(0, 15, 15, 'stone-4')
    },
  },
  {
    id: R.take(1),
    name: 'kanto/bush',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      // 圓圓的灌木（常綠）
      const t = leafTones('summer', K)
      shadow(g, 8, 14, 6, 1)
      foliage(g, 8, 9, 6, 5, t, 5 + c.variant)
    },
  },
  {
    id: R.take(1),
    name: 'kanto/planter',
    layer: 'lower',
    behavior: 'block',
    draw(g, c) {
      // 花台（花是遊戲自己的顏色；冬天只剩葉子）
      shadow(g, 8, 15, 7, 1)
      g.rect(1, 9, 14, 6, 'stone-3')
      g.rect(2, 9, 12, 5, 'stone-1')
      g.hline(2, 13, 9, 'white')
      const t = leafTones('summer', K)
      foliage(g, 8, 7, 6, 3, t, 2)
      if (c.season !== 'winter') for (const [x, y, k] of [[4, 6, 'shu-1'], [8, 5, 'gold-1'], [11, 7, 'sakura-2'], [6, 8, 'white']] as const) g.px(x, y, k)
    },
  },
  {
    id: R.take(1),
    name: 'kanto/bench',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 公園的長椅：木條、黑的鐵腳
      shadow(g, 8, 14, 7, 1)
      g.rect(1, 4, 14, 3, 'wood-2')
      g.hline(1, 14, 4, 'wood-1')
      g.rect(1, 8, 14, 3, 'wood-1')
      g.hline(1, 14, 10, 'wood-3')
      for (const x of [2, 12]) g.rect(x, 4, 2, 10, 'ink-2')
    },
  },
]

// ---------- 樹 ----------
const winterOf = (c: TileCtx) => c.season === 'winter'
const TREES: TileDef[] = [
  ...defineObject({
    id: R.take(6),
    name: 'kanto/ichou',
    w: 1,
    h: 3,
    cells: ['o', 'o', 'L'],
    bloom: true,
    draw(g, c) {
      // 銀杏（行道樹）：修整過的尖卵形；開花＝黃葉（平年的黃葉日前後）
      shadow(g, 8, 45, 6, 2)
      trunk(g, 7, 28, 45, 3)
      g.rect(4, 43, 9, 3, 'stone-3')
      g.hline(4, 12, 43, 'stone-2')
      if (winterOf(c) && !c.bloom) {
        g.vline(8, 6, 32, 'wood-3')
        for (let y = 9; y < 30; y += 4) {
          g.line(8, y, 4, y - 3, 'wood-3')
          g.line(8, y + 2, 12, y - 1, 'wood-3')
        }
        return
      }
      const t: Tones = c.bloom ? { line: 'gold-2', dark: 'gold-2', mid: 'gold-1', light: 'sand-1' } : leafTones(c.season === 'winter' ? 'autumn' : c.season, K)
      g.poly([8, 2, 14, 18, 13, 30, 3, 30, 2, 18], t.line)
      g.poly([8, 4, 13, 18, 12, 29, 4, 29, 3, 18], t.mid)
      g.dither(9, 10, 5, 20, t.dark, 8)
      for (let y = 9; y < 29; y += 5) {
        g.hline(4, 7, y, t.light)
        g.px(5, y + 1, t.light)
      }
    },
  }),
  ...defineObject({
    id: R.take(8),
    name: 'kanto/sakura',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    bloom: true,
    draw(g, c) {
      // 櫻（染井吉野風的淡粉紅）：開花時整棵是花
      shadow(g, 16, 29, 12, 2)
      trunk(g, 14, 17, 29, 4, 'ink-2', 'ink', 'wood-3')
      g.line(15, 19, 7, 11, 'ink-2')
      g.line(17, 18, 25, 10, 'ink-2')
      if (c.bloom) {
        foliage(g, 16, 11, 14, 10, { line: 'sakura-2', dark: 'sakura-1', mid: 'sakura-1', light: 'white' }, 27)
        blossoms(g, 16, 11, 12, 8, 'white', 'sakura-2', 0.14, 9)
        return
      }
      if (winterOf(c)) {
        bareBranches(g, 16, 12, 12, 9, 'ink-2', 6)
        return
      }
      const t: Tones = c.season === 'autumn' ? { line: 'leaf-4', dark: 'momiji-2', mid: 'leaf-3', light: 'momiji-1' } : leafTones(c.season, K)
      foliage(g, 16, 11, 13, 9, t, 27)
    },
  }),
  ...defineObject({
    id: R.take(4),
    name: 'kanto/keyaki',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    draw(g, c) {
      // 櫸（大的行道樹、公園的樹）：往上散開的掃帚形，秋天轉成紅褐
      shadow(g, 16, 29, 12, 2)
      trunk(g, 14, 18, 29, 4, 'wood-2', 'wood-3', 'stone-1')
      g.line(15, 19, 9, 10, 'wood-3')
      g.line(17, 19, 23, 10, 'wood-3')
      g.line(16, 18, 16, 8, 'wood-3')
      if (winterOf(c)) {
        bareBranches(g, 16, 11, 13, 10, 'wood-3', 12)
        bareBranches(g, 10, 12, 6, 6, 'wood-2', 13)
        bareBranches(g, 22, 12, 6, 6, 'wood-2', 14)
        return
      }
      const t: Tones = c.season === 'autumn' ? { line: 'wood-3', dark: 'momiji-2', mid: 'momiji-1', light: 'gold-1' } : leafTones(c.season, K)
      foliage(g, 16, 10, 14, 9, t, 41)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kanto/street-tree',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 人行道的行道樹：方形的樹穴（鐵格柵）、修剪過的小樹冠
      g.rect(3, 26, 10, 5, 'stone-3')
      g.rect(4, 27, 8, 3, 'ink-2')
      for (let x = 5; x < 12; x += 2) g.vline(x, 27, 29, 'stone-2')
      trunk(g, 7, 16, 28, 2)
      if (winterOf(c)) {
        bareBranches(g, 8, 10, 6, 7, 'wood-3', 3)
        return
      }
      foliage(g, 8, 10, 6, 7, leafTones(c.season, K), 17)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kanto/tree',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 一般的樹（公園、庭院）：常綠的闊葉樹，冬天也是綠的
      shadow(g, 8, 29, 7, 2)
      trunk(g, 6, 18, 29, 4)
      const t = c.season === 'winter' ? leafTones('summer', K) : leafTones(c.season === 'autumn' ? 'summer' : c.season, K)
      foliage(g, 8, 11, 7, 9, t, 19)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kanto/pole',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw: (g, c) => utilityPole(g, c, U),
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kanto/signal',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw: (g, c) => trafficSignal(g, c, false),
  }),
  ...defineObject({
    id: R.take(2),
    name: 'kanto/lamp',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw: (g, c) => streetLamp(g, c, false),
  }),
]

// ---------- 建築 ----------
const ROOF4 = ['OOOO', 'LLLL', 'LLLL', 'LLLL']
const BUILDINGS: TileDef[] = [
  ...[0, 1].flatMap((s) => defineObject({ id: R.take(16), name: `kanto/office-${'ab'[s]}`, w: 4, h: 4, cells: ROOF4, draw: (g, c) => (s ? officeTile(g, c, U, 7) : officeGlass(g, c, U, 3)) })),
  ...[0, 1].flatMap((s) => defineObject({ id: R.take(16), name: `kanto/mixed-${'ab'[s]}`, w: 4, h: 4, cells: ROOF4, draw: (g, c) => mixedUse(g, c, U, 11 + s, s ? 'sand-1' : 'paper') })),
  ...defineObject({ id: R.take(16), name: 'kanto/apartment', w: 4, h: 4, cells: ROOF4, draw: (g, c) => apartment(g, c, U, 5) }),
  ...defineObject({ id: R.take(16), name: 'kanto/house-a', w: 4, h: 4, cells: ['OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => tiledHouse(g, c, 1) }),
  ...defineObject({ id: R.take(16), name: 'kanto/house-b', w: 4, h: 4, cells: ROOF4, draw: (g, c) => boxHouse(g, c, U, 2) }),
  ...[0, 1].flatMap((s) => defineObject({ id: R.take(9), name: `kanto/house-low-${'ab'[s]}`, w: 3, h: 3, cells: ['OOO', 'LLL', 'LLL'], draw: (g, c) => smallHouse(g, c, U, s === 1, 4 + s) })),
  ...defineObject({ id: R.take(12), name: 'kanto/konbini', w: 4, h: 3, cells: ['OOOO', 'LLLL', 'LLLL'], draw: (g, c) => konbini(g, c, U, 9) }),
  ...defineObject({ id: R.take(32), name: 'kanto/station', w: 8, h: 4, cells: ['OOOOOOOO', 'OOOOOOOO', 'LLLLLLLL', 'LLLDDLLL'], draw: (g, c) => elevatedStation(g, c, U) }),
  ...defineObject({ id: R.take(20), name: 'kanto/shokudo', w: 5, h: 4, cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'], draw: (g, c) => eatery(g, c, U, 3) }),
  ...defineObject({ id: R.take(24), name: 'kanto/inn', w: 6, h: 4, cells: ['OOOOOO', 'OOOOOO', 'LLLLLL', 'LLDLLL'], draw: (g, c) => cityInn(g, c, U, 4) }),
  ...defineObject({ id: R.take(20), name: 'kanto/shinise', w: 5, h: 4, cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'], draw: (g, c) => kanbanShop(g, c, U, 6) }),
  ...defineObject({ id: R.take(24), name: 'kanto/hall', w: 6, h: 4, cells: ['OOOOOO', 'LLLLLL', 'LLLLLL', 'LLLLLL'], draw: (g, c) => hall(g, c, U, 8) }),
  ...defineObject({ id: R.take(24), name: 'kanto/highrise', w: 4, h: 6, cells: ['OOOO', 'OOOO', 'OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => highrise(g, c, U, 10) }),
  ...defineObject({ id: R.take(16), name: 'kanto/screen', w: 4, h: 4, cells: ROOF4, draw: (g, c) => screenBuilding(g, c, U, 12) }),
  ...[0, 1, 2].flatMap((s) => defineObject({ id: R.take(4), name: `kanto/shop-front-${'abc'[s]}`, w: 2, h: 2, cells: ['OO', 'LL'], draw: (g, c) => shopFront(g, c, s) })),
  ...defineObject({ id: R.take(20), name: 'kanto/church', w: 4, h: 5, cells: ['.OO.', 'OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => church(g, c, U) }),
  ...defineObject({ id: R.take(21), name: 'kanto/tower-lattice', w: 3, h: 7, cells: ['.o.', '.o.', '.o.', 'ooo', 'OOO', 'LLL', 'LLL'], draw: (g, c) => latticeTower(g, c, U) }),
  ...defineObject({ id: R.take(21), name: 'kanto/tower-tall', w: 3, h: 7, cells: ['.o.', '.o.', '.o.', 'ooo', 'OOO', 'LLL', 'LLL'], draw: (g, c) => slenderTower(g, c, U) }),
  // 自然的地標（名字寫著山、岳、滝、温泉、灯台）
  ...defineObject({ id: R.take(24), name: 'kanto/peak', w: 6, h: 4, cells: ['..OO..', '.OOOO.', 'LLLLLL', 'LLLLLL'], draw: (g, c) => peak(g, c, N) }),
  ...defineObject({ id: R.take(12), name: 'kanto/falls', w: 3, h: 4, cells: ['OOO', 'OOO', 'LLL', 'LLL'], frames: 4, fps: 6, draw: (g, c) => waterfall(g, c, N) }),
  ...defineObject({ id: R.take(12), name: 'kanto/onsen', w: 4, h: 3, cells: ['OOOO', 'LLLL', 'LLLL'], frames: 4, fps: 3, draw: (g, c) => onsen(g, c, N) }),
  ...defineObject({ id: R.take(8), name: 'kanto/lighthouse', w: 2, h: 4, cells: ['oo', 'OO', 'LL', 'LL'], draw: (g, c) => lighthouse(g, c, N) }),
]

export const KANTO_TILES: TileDef[] = [...GROUND, ...VIADUCT, ...SMALL, ...TREES, ...BUILDINGS]
registerTileset('kanto', KANTO_TILES)

/** 開花的對照（world/season.ts 依平年值換）：一般的名字 → 開花的名字 */
export const KANTO_BLOOM: Record<string, { flower: 'sakura' | 'ichou'; bloom: string }> = {
  'kanto/sakura': { flower: 'sakura', bloom: 'kanto/sakura@bloom' },
  'kanto/ichou': { flower: 'ichou', bloom: 'kanto/ichou@bloom' },
}
registerBloom(KANTO_BLOOM)

/** 關東的路（街上、郊外、斑馬線、橋）：生成器判斷斑馬線、路口用 */
export const kantoRoad = isRoad
