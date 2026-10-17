import type { Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import { registerTileset, tileDef, tileId } from '../../engine/tiles'
import type { TileCtx, TileDef } from '../../engine/types'

import {
  bareBranches,
  bevel,
  blossoms,
  foliage,
  grassTint,
  grassTones,
  GRAY_ROOF,
  hash2,
  icicles,
  leafTones,
  noren,
  shadow,
  speckle,
  stone,
  thickSnow,
  tileRoof,
  type Tones,
  trunk,
  tuft,
  windowPane,
} from './draw'
import { lighthouse, onsen, peak, waterfall } from './nature'
import { defineObject, idRange, objectSpec, registerBloom } from './objects'
import { HOKKAIDO_SNOW_OBJECTS, HOKKAIDO_SNOW_TILES, snowObjectName } from './snowcover'
import {
  apartment,
  boxHouse,
  elevatedStation,
  church,
  hall,
  highrise,
  konbini,
  latticeTower,
  mixedUse,
  officeGlass,
  officeTile,
  shopFront,
  slenderTower,
  streetLamp,
  trafficSignal,
  type UrbanOpts,
  utilityPole,
} from './urban'
// 北海道的街上也放關東的零件（自動販賣機、郵筒：town.ts 的 furnish）：先讓關東的 kit 註冊好；
// 寺社、茶屋沿用近畿的零件（冬天的厚雪版是包近畿的畫法）
import './kanto'
import './kinki'

/**
 * 北海道 kit（id 5120–6143，名字 'hokkaido/…'）：
 * 地面：草（冬天整片是雪原）、郊外的柏油路（冬天是壓實的雪、車轍、路邊的雪堆）、街上的柏油與人行道、斑馬線、
 * 紅磚的鋪面、站前廣場、碎石、河（冬天岸邊結冰）、湖（自然的岸、冬天整面結冰）、鐵橋、
 * 麥田、馬鈴薯田、薰衣草田（只有夏天是紫的）、花田（一畦一種顏色）。
 * 彩色鐵皮屋頂（紅、綠、藍）的平房與風除室、紅色的牧舍與筒倉、紅磚倉庫、時計台、山牆的車站、拉麵屋、旅館、石造的老舖、
 * 牧場的柵欄、板塀、矢羽根（路邊紅白的箭頭）、煤氣燈、直的紅綠燈、捆好的牧草；
 * 樹：白樺、蝦夷松（針葉）、白楊、櫻（開花照札幌等氣象台的平年值）、楓、銀杏、一般的樹。
 * 冬天（11–4 月積雪的那一段，季節照平年值）屋頂、牆頭、樹上都是厚雪，屋簷有冰柱。
 * 札幌這類的街上：辦公大樓、公寓、便利商店用都市的畫法（加上雪）。寺社、城沿用近畿的零件。
 */
const R = idRange(5120, 6143)
const K = 'hokkaido' as const
const U: UrbanOpts = { snow: true }
const N = { kit: K, snow: true }

const winterOf = (c: TileCtx) => c.season === 'winter'

// ---------- 地面 ----------
const ROADS = new Set(['hokkaido/road', 'hokkaido/street', 'hokkaido/zebra-h', 'hokkaido/zebra-v', 'hokkaido/bridge-h', 'hokkaido/bridge-v'])
const isRoad = (name?: string) => !!name && ROADS.has(name)
const isPaved = (name?: string) => !!name && (isRoad(name) || name === 'hokkaido/paving' || name === 'hokkaido/plaza' || name === 'hokkaido/gravel' || name === 'hokkaido/trail' || name.startsWith('world/'))
const LAKE = new Set(['hokkaido/lake'])

function grass(g: Gfx, c: TileCtx) {
  const k = grassTones(c.season, K)
  g.rect(0, 0, 16, 16, k.base)
  const tint = grassTint(c.season, K)
  if (tint) g.dither(0, 0, 16, 16, tint.k, tint.level)
  const v = c.variant
  if (winterOf(c)) {
    // 雪原：吹出來的雪紋、反光、一點點冒出來的草
    if (v === 0) {
      g.line(1, 9, 6, 7, 'snow-2')
      g.line(6, 7, 11, 8, 'snow-2')
      g.hline(2, 9, 6, 'white')
    } else if (v === 1) {
      for (const [x, y] of [[3, 3], [11, 6], [6, 12], [13, 13]] as const) g.px(x, y, 'white')
      g.px(8, 4, 'snow-2')
    } else if (v === 2) {
      g.ellipse(9, 9, 4, 2, 'snow-2')
      g.hline(6, 11, 7, 'white')
      g.hline(8, 12, 11, 'snow-3')
    } else {
      tuft(g, 3, 9, 'leaf-4', 'dirt-2')
      g.px(12, 4, 'dirt-2')
      g.hline(2, 6, 11, 'snow-2')
    }
    return
  }
  if (v === 0) {
    tuft(g, 2, 4, k.dark, k.light)
    tuft(g, 10, 11, k.dark)
    g.px(13, 3, k.light)
  } else if (v === 1) {
    g.px(4, 12, k.light)
    g.px(11, 5, k.light)
    g.px(7, 2, k.dark)
    g.px(13, 13, k.dark)
  } else if (v === 2) {
    tuft(g, 6, 8, k.dark, k.light)
    g.px(2, 13, k.light)
  } else {
    // 春天也不畫殘雪：北海道的春是梅、櫻開的時候（4 月底到 5 月），草地上一團一團的白看起來不像雪
    speckle(g, 0, 0, 16, 16, k.dark, 0.05, 3)
    tuft(g, 11, 3, k.dark)
  }
}

/** 路邊的雪堆（冬天，沒接到路的那一邊） */
function snowBank(g: Gfx, side: 'up' | 'down' | 'left' | 'right') {
  if (side === 'up') {
    g.rect(0, 0, 16, 4, 'snow-1')
    g.hline(0, 15, 0, 'white')
    g.hline(0, 15, 4, 'snow-3')
  } else if (side === 'down') {
    g.rect(0, 12, 16, 4, 'snow-1')
    g.hline(0, 15, 12, 'white')
    g.hline(0, 15, 11, 'snow-3')
  } else if (side === 'left') {
    g.rect(0, 0, 4, 16, 'snow-1')
    g.vline(0, 0, 15, 'white')
    g.vline(4, 0, 15, 'snow-3')
  } else {
    g.rect(12, 0, 4, 16, 'snow-1')
    g.vline(12, 0, 15, 'white')
    g.vline(11, 0, 15, 'snow-3')
  }
}

/** 路：冬天是壓實的雪（車轍順著路的方向）；街上的路旁邊是人行道（冬天被雪蓋住） */
function road(walks: boolean) {
  return (g: Gfx, c: TileCtx) => {
    const m = c.mask
    const sides = (['up', 'right', 'down', 'left'] as const).filter((_, i) => !(m & (1 << i)))
    // 路的方向：左右都接著是橫的（兩格寬的橫路、路口也算橫）；上下都接著是直的；只接一邊的照那一邊
    const hor = (m & 10) === 10 || ((m & 5) !== 5 && !!(m & 10))
    if (winterOf(c)) {
      // 壓實的雪；車轍順著路（街上的車轍露出一點柏油）
      g.rect(0, 0, 16, 16, 'snow-2')
      speckle(g, 0, 0, 16, 16, 'snow-1', 0.12, 71 + c.variant)
      const rut: Px = walks ? 'asphalt-1' : 'snow-3'
      for (const p of [4, 11]) {
        if (hor) {
          g.hline(0, 15, p, rut)
          g.hline(0, 15, p + 1, 'snow-3')
        } else {
          g.vline(p, 0, 15, rut)
          g.vline(p + 1, 0, 15, 'snow-3')
        }
      }
      for (const s of sides) snowBank(g, s)
      return
    }
    g.rect(0, 0, 16, 16, 'asphalt-2')
    speckle(g, 0, 0, 16, 16, 'asphalt-1', 0.07, 11 + c.variant)
    if (walks) {
      const up = !!(m & 1)
      const down = !!(m & 4)
      const left = !!(m & 8)
      const right = !!(m & 2)
      if (left && right && !up && down) for (const x of [2, 10]) g.hline(x, x + 3, 15, 'paper')
      if (left && right && up && !down) for (const x of [2, 10]) g.hline(x, x + 3, 0, 'paper')
      if (up && down && !left && right) for (const y of [2, 10]) g.vline(15, y, y + 3, 'paper')
      if (up && down && left && !right) for (const y of [2, 10]) g.vline(0, y, y + 3, 'paper')
      for (const s of sides) {
        const [x, y, w, h] = s === 'up' ? [0, 0, 16, 4] : s === 'down' ? [0, 12, 16, 4] : s === 'left' ? [0, 0, 4, 16] : [12, 0, 4, 16]
        g.rect(x, y, w, h, 'stone-1')
        if (w === 16) for (let xx = 3; xx < 16; xx += 4) g.vline(xx, y, y + h - 1, 'paper-2')
        else for (let yy = 3; yy < 16; yy += 4) g.hline(x, x + w - 1, yy, 'paper-2')
        if (s === 'up') g.hline(0, 15, 4, 'ink-2')
        if (s === 'down') g.hline(0, 15, 11, 'ink-2')
        if (s === 'left') g.vline(4, 0, 15, 'ink-2')
        if (s === 'right') g.vline(11, 0, 15, 'ink-2')
      }
      return
    }
    // 郊外：路邊的白線、草長到路邊
    const k = grassTones(c.season, K)
    for (const s of sides) {
      if (s === 'up') {
        g.hline(0, 15, 2, 'paper-2')
        g.rect(0, 0, 16, 1, k.base)
      } else if (s === 'down') {
        g.hline(0, 15, 13, 'paper-2')
        g.rect(0, 15, 16, 1, k.base)
      } else if (s === 'left') {
        g.vline(2, 0, 15, 'paper-2')
        g.rect(0, 0, 1, 16, k.base)
      } else {
        g.vline(13, 0, 15, 'paper-2')
        g.rect(15, 0, 1, 16, k.base)
      }
    }
  }
}

function zebra(dir: 'h' | 'v') {
  const base = road(true)
  return (g: Gfx, c: TileCtx) => {
    base(g, c)
    const m = c.mask
    // 冬天的斑馬線被雪蓋住一半
    const k: Px = winterOf(c) ? 'snow-1' : 'white'
    if (dir === 'h') {
      const y0 = m & 1 ? 1 : 5
      const y1 = m & 4 ? 14 : 10
      for (const x of [1, 5, 9, 13]) g.rect(x, y0, 2, y1 - y0 + 1, k)
    } else {
      const x0 = m & 8 ? 1 : 5
      const x1 = m & 2 ? 14 : 10
      for (const y of [1, 5, 9, 13]) g.rect(x0, y, x1 - x0 + 1, 2, k)
    }
  }
}

/** 田的邊（沒接到同一種田的那一邊是草埂；冬天是雪） */
function fieldEdge(g: Gfx, c: TileCtx) {
  const k = grassTones(c.season, K)
  if (!(c.mask & 1)) {
    g.rect(0, 0, 16, 2, k.base)
    g.hline(0, 15, 2, k.dark)
  }
  if (!(c.mask & 4)) g.rect(0, 14, 16, 2, k.base)
  if (!(c.mask & 8)) g.rect(0, 0, 2, 16, k.base)
  if (!(c.mask & 2)) g.rect(14, 0, 2, 16, k.base)
}

/** 冬天的田：雪下面一畦一畦的起伏 */
function snowRows(g: Gfx) {
  g.rect(0, 0, 16, 16, 'snow-1')
  for (let y = 2; y < 16; y += 4) {
    g.hline(0, 15, y, 'snow-2')
    g.hline(0, 15, y - 1, 'white')
  }
}

/** 一畦一畦的作物：rowFn 畫一畦（y 是那一畦的中線） */
function rows(g: Gfx, soil: Px, soilDark: Px, row: (y: number) => void) {
  g.rect(0, 0, 16, 16, soil)
  for (let y = 0; y < 16; y += 4) g.hline(0, 15, y, soilDark)
  for (let y = 2; y < 16; y += 4) row(y)
}

const FIELDS: TileDef[] = [
  {
    id: R.take(1),
    name: 'hokkaido/wheat',
    layer: 'ground',
    behavior: 'block',
    connect: (o) => o?.name === 'hokkaido/wheat',
    draw(g, c) {
      // 麥田：春天綠、夏天金黃（收成前）、秋天是收過的麥稈、冬天雪
      const s = c.season
      if (s === 'winter') snowRows(g)
      else if (s === 'summer') {
        g.rect(0, 0, 16, 16, 'gold-1')
        for (let x = 1; x < 16; x += 2) {
          g.vline(x, 0, 15, 'gold-2')
          for (let y = (x * 5) % 4; y < 16; y += 4) g.px(x - 1, y, 'sand-1')
        }
      } else if (s === 'spring') {
        g.rect(0, 0, 16, 16, 'leaf-2')
        for (let x = 1; x < 16; x += 2) for (let y = (x * 3) % 3; y < 16; y += 3) g.px(x, y, 'leaf-1')
        g.dither(0, 0, 16, 16, 'leaf-3', 2)
      } else {
        g.rect(0, 0, 16, 16, 'sand-2')
        for (let y = 1; y < 16; y += 3) for (let x = (y * 2) % 4; x < 16; x += 4) g.vline(x, y, y + 1, 'dirt-2')
      }
      fieldEdge(g, c)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/potato',
    layer: 'ground',
    behavior: 'block',
    connect: (o) => o?.name === 'hokkaido/potato',
    draw(g, c) {
      // 馬鈴薯田：土壟；夏天是綠的株、白與淡紫的小花；秋天收成後是土
      const s = c.season
      if (s === 'winter') snowRows(g)
      else if (s === 'summer')
        rows(g, 'dirt-1', 'dirt-2', (y) => {
          g.rect(0, y - 1, 16, 3, 'leaf-3')
          for (let x = 1; x < 16; x += 3) {
            g.px(x, y - 1, 'leaf-2')
            if ((x + y) % 2) g.px(x + 1, y - 1, (x + y) % 4 === 1 ? 'white' : 'lavender')
          }
        })
      else if (s === 'spring') rows(g, 'dirt-1', 'dirt-2', (y) => {
        g.hline(0, 15, y, 'sand-2')
        for (let x = 2; x < 16; x += 4) g.px(x, y - 1, 'leaf-2')
      })
      else rows(g, 'dirt-1', 'dirt-2', (y) => g.hline(0, 15, y, 'sand-2'))
      fieldEdge(g, c)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/lavender',
    layer: 'ground',
    behavior: 'block',
    connect: (o) => o?.name === 'hokkaido/lavender',
    draw(g, c) {
      // 薰衣草田：一壟一壟圓圓的株；只有夏天是紫的（春天灰綠的小株、秋天剪過、冬天雪）
      const s = c.season
      if (s === 'winter') {
        snowRows(g)
        for (let x = 2; x < 16; x += 5) g.px(x, 6, 'stone-3')
      } else
        rows(g, 'dirt-1', 'leaf-3', (y) => {
          for (let x = 1; x < 16; x += 5) {
            if (s === 'summer') {
              g.rect(x, y - 2, 4, 3, 'lavender-2')
              g.rect(x, y - 2, 3, 2, 'lavender')
              g.px(x + 1, y - 2, 'white')
              g.px(x + 3, y, 'leaf-3')
            } else if (s === 'spring') {
              g.rect(x + 1, y - 1, 2, 2, 'leaf-2')
              g.px(x + 1, y - 1, 'stone-1')
            } else {
              g.rect(x, y - 1, 3, 2, 'leaf-3')
              g.px(x + 1, y - 1, 'stone-2')
            }
          }
        })
      fieldEdge(g, c)
    },
  },
  ...(['shu-1', 'gold-1', 'white', 'sakura-2'] as const).map(
    (k, i): TileDef => ({
      id: R.take(1),
      name: `hokkaido/flowers-${'abcd'[i]}`,
      layer: 'ground',
      behavior: 'block',
      connect: (o) => o?.name === `hokkaido/flowers-${'abcd'[i]}`,
      draw(g, c) {
        // 花田：一畦一種顏色（夏天開）；春天是苗、秋天剩一點點、冬天雪
        const s = c.season
        if (s === 'winter') snowRows(g)
        else
          rows(g, 'dirt-1', 'leaf-3', (y) => {
            g.hline(0, 15, y, 'leaf-2')
            g.hline(0, 15, y - 1, s === 'spring' ? 'leaf-1' : 'leaf-3')
            if (s === 'summer') for (let x = (y % 3); x < 16; x += 2) g.px(x, y - 1, (x + y) % 5 ? k : 'leaf-1')
            else if (s === 'autumn') for (let x = 1; x < 16; x += 5) g.px(x, y - 1, k)
          })
        fieldEdge(g, c)
      },
    }),
  ),
]

const GROUND: TileDef[] = [
  { id: R.take(1), name: 'hokkaido/grass', layer: 'ground', behavior: 'walk', variants: 4, draw: grass },
  { id: R.take(1), name: 'hokkaido/road', layer: 'ground', behavior: 'walk', variants: 2, connect: (o) => isRoad(o?.name), draw: road(false) },
  { id: R.take(1), name: 'hokkaido/street', layer: 'ground', behavior: 'walk', variants: 2, connect: (o) => isRoad(o?.name), draw: road(true) },
  { id: R.take(1), name: 'hokkaido/zebra-h', layer: 'ground', behavior: 'walk', connect: (o) => isRoad(o?.name), draw: zebra('h') },
  { id: R.take(1), name: 'hokkaido/zebra-v', layer: 'ground', behavior: 'walk', connect: (o) => isRoad(o?.name), draw: zebra('v') },
  {
    id: R.take(1),
    name: 'hokkaido/paving',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    connect: (o) => isPaved(o?.name),
    draw(g, c) {
      // 紅磚的鋪面（運河、倉庫一帶）：人字的磚；冬天被雪蓋住，中間踩出一條
      g.rect(0, 0, 16, 16, 'kawara-2')
      for (let y = 0; y < 16; y += 4)
        for (let x = ((y / 4) % 2) * 4; x < 16; x += 8) {
          g.rect(x, y, 4, 2, 'kawara-1')
          g.rect(x + 4, y + 2, 4, 2, 'kawara-1')
        }
      for (let y = 1; y < 16; y += 2) g.hline(0, 15, y, 'kawara-3')
      g.px(5 + c.variant * 4, 6, 'sand-1')
      if (winterOf(c)) {
        // 冬天：整片雪，踩出來的地方露出幾塊磚
        g.rect(0, 0, 16, 16, 'snow-1')
        speckle(g, 0, 0, 16, 16, 'snow-2', 0.1, 81 + c.variant)
        for (const [x, y] of c.variant ? [[3, 5], [9, 10]] : [[10, 3], [5, 11]]) {
          g.rect(x, y, 4, 2, 'kawara-2')
          g.hline(x, x + 3, y + 1, 'kawara-3')
          g.hline(x - 1, x + 4, y - 1, 'snow-3')
        }
      }
      if (!(c.mask & 1)) g.hline(0, 15, 0, 'stone-3')
      if (!(c.mask & 4)) g.hline(0, 15, 15, 'stone-3')
      if (!(c.mask & 8)) g.vline(0, 0, 15, 'stone-3')
      if (!(c.mask & 2)) g.vline(15, 0, 15, 'stone-3')
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/trail',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    connect: (o) => isPaved(o?.name) || o?.name === 'hokkaido/trail',
    draw(g, c) {
      // 郊外的步道：踩實的土、小石子，邊上長草；冬天是踩出來的雪道
      const k = grassTones(c.season, K)
      if (winterOf(c)) {
        g.rect(0, 0, 16, 16, 'snow-2')
        speckle(g, 0, 0, 16, 16, 'snow-3', 0.08, 51 + c.variant)
        speckle(g, 0, 0, 16, 16, 'white', 0.06, 61 + c.variant)
      } else {
        g.rect(0, 0, 16, 16, 'dirt-1')
        speckle(g, 0, 0, 16, 16, 'dirt-2', 0.08, 51 + c.variant)
        speckle(g, 0, 0, 16, 16, 'sand-1', 0.05, 61 + c.variant)
      }
      for (const [bit, x, y, w, h] of [[1, 0, 0, 16, 2], [4, 0, 14, 16, 2], [8, 0, 0, 2, 16], [2, 14, 0, 2, 16]] as const) {
        if (c.mask & bit) continue
        g.rect(x, y, w, h, k.base)
        g.dither(x, y, w, h, k.dark, 3)
      }
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/plaza',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      // 站前廣場：方磚；冬天剷過雪，縫裡留著雪
      if (winterOf(c)) {
        // 剷過雪的廣場：薄薄一層雪，方磚的縫看得出來
        g.rect(0, 0, 16, 16, 'snow-1')
        g.hline(0, 15, 7, 'snow-2')
        g.vline(7, 0, 15, 'snow-2')
        g.hline(0, 15, 15, 'snow-2')
        g.vline(15, 0, 15, 'snow-2')
        speckle(g, 0, 0, 16, 16, 'white', 0.05, 91 + c.variant)
        return
      }
      for (const y of [0, 8]) for (const x of [0, 8]) bevel(g, x, y, 8, 8, ((x + y) / 8) % 2 ? 'stone-1' : 'paper-2', 'paper', 'stone-2')
      if (c.variant) g.px(4, 11, 'stone-2')
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/gravel',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      if (winterOf(c)) {
        g.rect(0, 0, 16, 16, 'snow-1')
        speckle(g, 0, 0, 16, 16, 'snow-2', 0.12, 31 + c.variant)
        // 雪上的腳印
        if (c.variant) for (const [x, y] of [[4, 3], [7, 7], [4, 11], [7, 15]] as const) g.rect(x, y - 1, 2, 2, 'snow-3')
        return
      }
      g.rect(0, 0, 16, 16, 'stone-1')
      speckle(g, 0, 0, 16, 16, 'stone-2', 0.18, 31 + c.variant)
      speckle(g, 0, 0, 16, 16, 'white', 0.08, 41 + c.variant)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/water',
    layer: 'ground',
    behavior: 'water',
    frames: 4,
    fps: 2.5,
    connect: (o) => !!o && (o.name === 'hokkaido/water' || o.name.startsWith('hokkaido/bridge')),
    draw(g, c) {
      // 河、運河：石砌的岸；冬天水變深、岸邊結一圈冰
      const w = winterOf(c)
      g.rect(0, 0, 16, 16, w ? 'sea-3' : 'sea-2')
      const f = w ? 0 : c.frame
      for (const [x, y] of [[1, 2], [8, 6], [3, 10], [11, 13]] as const) {
        const xx = (x + f * 2) % 16
        g.hline(xx, Math.min(15, xx + 3), y, w ? 'sea-2' : 'sea-1')
      }
      const edge = (x: number, y: number, ww: number, hh: number) => {
        g.rect(x, y, ww, hh, 'stone-2')
        if (w) g.dither(x, y, ww, hh, 'snow-1', 10)
      }
      if (!(c.mask & 1)) {
        edge(0, 0, 16, 4)
        g.hline(0, 15, 0, w ? 'white' : 'stone-1')
        g.hline(0, 15, 4, w ? 'snow-2' : 'sea-3')
        if (w) g.hline(0, 15, 5, 'white')
      }
      if (!(c.mask & 4)) {
        g.hline(0, 15, 15, 'stone-2')
        g.hline(0, 15, 14, w ? 'snow-2' : f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 8)) {
        edge(0, 0, 2, 16)
        g.vline(2, 0, 15, w ? 'snow-2' : f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 2)) {
        edge(14, 0, 2, 16)
        g.vline(13, 0, 15, w ? 'snow-2' : f % 2 ? 'sea-1' : 'foam')
      }
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/lake',
    layer: 'ground',
    behavior: 'water',
    frames: 4,
    fps: 2,
    connect: (o) => !!o && LAKE.has(o.name),
    draw(g, c) {
      // 湖：深藍、慢慢的波紋，岸是沙與草（不是石砌的）；冬天整面結冰（冰的紋路、裂縫）
      const w = winterOf(c)
      if (w) {
        g.rect(0, 0, 16, 16, 'snow-2')
        g.dither(0, 0, 16, 16, 'sky-day-3', 4)
        g.line(2, 3, 9, 6, 'white')
        g.line(9, 6, 14, 5, 'white')
        g.line(4, 12, 8, 10, 'snow-3')
        g.line(8, 10, 12, 13, 'snow-3')
      } else {
        g.rect(0, 0, 16, 16, 'sea-2')
        g.dither(0, 0, 16, 16, 'sea-3', 3)
        for (const [x, y] of [[2, 4], [9, 9], [5, 13]] as const) {
          const xx = (x + c.frame) % 16
          g.hline(xx, Math.min(15, xx + 2), y, 'sea-1')
        }
      }
      // 岸：草一直長到水邊（上岸那一邊看得到一點土的斷面），水邊深一點；冬天是雪
      const gt = grassTones(c.season, K)
      const bank: Px = w ? 'snow-3' : 'dirt-2'
      const edge: Px = w ? 'snow-2' : 'sea-3'
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 3, gt.base)
        g.dither(0, 2, 16, 2, gt.base, 8)
        g.hline(0, 15, 3, bank)
        g.hline(0, 15, 4, edge)
      }
      if (!(c.mask & 4)) {
        g.rect(0, 14, 16, 2, gt.base)
        g.dither(0, 12, 16, 2, gt.base, 6)
        g.hline(0, 15, 13, w ? 'white' : 'sea-1')
      }
      if (!(c.mask & 8)) {
        g.rect(0, 0, 2, 16, gt.base)
        g.dither(2, 0, 1, 16, gt.base, 8)
        g.vline(3, 0, 15, edge)
      }
      if (!(c.mask & 2)) {
        g.rect(14, 0, 2, 16, gt.base)
        g.dither(13, 0, 1, 16, gt.base, 8)
        g.vline(12, 0, 15, edge)
      }
      // 岸邊的蘆葦（夏、秋）
      if (!w && !(c.mask & 1) && c.season !== 'spring') for (const x of [3, 9, 12]) g.vline(x, 1, 3, gt.dark)
    },
  },
  ...(['h', 'v'] as const).map(
    (d): TileDef => ({
      id: R.take(1),
      name: `hokkaido/bridge-${d}`,
      layer: 'ground',
      behavior: 'walk',
      draw(g, c) {
        // 鐵橋：藍色的欄杆、柏油的橋面（冬天是雪）
        const w = winterOf(c)
        g.rect(0, 0, 16, 16, w ? 'sea-3' : 'sea-2')
        const deck: Px = w ? 'snow-2' : 'asphalt-2'
        if (d === 'h') {
          g.rect(0, 2, 16, 12, deck)
          if (w) g.hline(0, 15, 7, 'snow-3')
          for (const y of [1, 13]) {
            g.rect(0, y, 16, 2, 'cloth-1')
            g.hline(0, 15, y + (y === 1 ? 1 : 0), 'cloth-2')
            if (w) g.hline(0, 15, y, 'snow-1')
          }
          for (const x of [3, 11]) {
            g.rect(x, 0, 2, 3, 'cloth-2')
            g.rect(x, 13, 2, 3, 'cloth-2')
          }
        } else {
          g.rect(2, 0, 12, 16, deck)
          if (w) g.vline(7, 0, 15, 'snow-3')
          for (const x of [1, 13]) {
            g.rect(x, 0, 2, 16, 'cloth-1')
            g.vline(x + (x === 1 ? 1 : 0), 0, 15, 'cloth-2')
            if (w) g.vline(x, 0, 15, 'snow-1')
          }
          for (const y of [3, 11]) {
            g.rect(0, y, 3, 2, 'cloth-2')
            g.rect(13, y, 3, 2, 'cloth-2')
          }
        }
      },
    }),
  ),
  ...FIELDS,
]

// ---------- 一格的東西 ----------
const SMALL: TileDef[] = [
  {
    id: R.take(1),
    name: 'hokkaido/sign',
    layer: 'lower',
    behavior: 'sign',
    draw(g, c) {
      // 木的告示牌：兩根柱子、綠的鐵皮小屋頂、白板（冬天屋頂上有雪）
      shadow(g, 8, 14, 6, 1)
      g.rect(3, 6, 2, 9, 'wood-3')
      g.rect(11, 6, 2, 9, 'wood-3')
      g.rect(2, 4, 12, 8, 'wood-3')
      g.rect(3, 5, 10, 6, 'paper')
      g.hline(4, 11, 7, 'stone-2')
      g.hline(4, 9, 9, 'stone-2')
      g.rect(1, 2, 14, 2, 'leaf-3')
      g.hline(1, 14, 2, 'leaf-2')
      if (winterOf(c)) thickSnow(g, 1, 0, 14, 2, 3)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/fence',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'hokkaido/fence',
    draw(g, c) {
      // 牧場的柵欄：木柱、兩條橫木（冬天上面一條雪）
      const w = winterOf(c)
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      if (vert) {
        g.rect(7, 0, 2, 16, 'wood-2')
        g.vline(7, 0, 15, 'wood-1')
        for (const y of [2, 10]) g.rect(6, y, 4, 3, 'wood-3')
        if (w) g.vline(8, 0, 15, 'snow-1')
        return
      }
      shadow(g, 8, 14, 7, 1)
      for (const y of [5, 10]) {
        g.hline(0, 15, y, 'wood-1')
        g.hline(0, 15, y + 1, 'wood-3')
        if (w) g.hline(0, 15, y - 1, 'snow-1')
      }
      for (const x of [2, 12]) {
        g.rect(x, 3, 2, 11, 'wood-2')
        g.vline(x, 3, 13, 'wood-1')
        if (w) g.hline(x, x + 1, 2, 'snow-1')
      }
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/wall',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && (o.name === 'hokkaido/wall' || o.name.startsWith('kinki/gate') || o.name.startsWith('kinki/sanmon')),
    draw(g, c) {
      // 板塀：縱的木板、上面的蓋板（冬天積雪）
      const vert = (c.mask & 5) !== 0 && !(c.mask & 10)
      if (vert) {
        g.rect(5, 0, 6, 16, 'wood-3')
        g.rect(6, 0, 4, 16, 'wood-2')
        if (winterOf(c)) g.rect(6, 0, 4, 16, 'snow-1')
        return
      }
      g.rect(0, 3, 16, 2, 'wood-3')
      g.rect(0, 5, 16, 9, 'wood-2')
      for (let x = 1; x < 16; x += 3) g.vline(x, 5, 13, 'wood-3')
      g.hline(0, 15, 5, 'wood-1')
      g.rect(0, 13, 16, 2, 'stone-2')
      g.hline(0, 15, 15, 'stone-4')
      if (winterOf(c)) thickSnow(g, 0, 1, 16, 3, 9)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/hedge',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'hokkaido/hedge',
    draw(g, c) {
      // 樹籬（冬天被雪蓋成一長條雪丘）
      const t = leafTones('summer', K)
      const l = c.mask & 8 ? 0 : 1
      const r = c.mask & 2 ? 15 : 14
      shadow(g, 8, 14, 8, 1)
      g.rect(l, 3, r - l + 1, 10, t.line)
      g.rect(l + (l ? 1 : 0), 4, r - l + 1 - (l ? 1 : 0) - (r < 15 ? 1 : 0), 8, t.mid)
      g.dither(0, 9, 16, 3, t.dark, 8)
      if (winterOf(c)) {
        g.rect(l, 2, r - l + 1, 6, 'snow-1')
        g.hline(l, r, 2, 'white')
        g.hline(l, r, 8, 'snow-3')
      } else for (let x = l + 1; x < r; x += 4) g.px(x, 5, t.light)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/bush',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      const t = leafTones(c.season === 'winter' ? 'summer' : c.season, K)
      shadow(g, 8, 14, 6, 1)
      foliage(g, 8, 9, 6, 5, t, 5 + c.variant)
      if (winterOf(c)) {
        g.ellipse(8, 7, 6, 3, 'snow-1')
        g.hline(4, 11, 4, 'white')
        g.hline(3, 12, 10, 'snow-3')
      }
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/rock',
    layer: 'lower',
    behavior: 'block',
    draw(g, c) {
      shadow(g, 8, 13, 6, 2)
      stone(g, 1, 7, 9, 7, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
      stone(g, 8, 4, 7, 9, 'stone-2', 'stone-1', 'stone-3', 'stone-4')
      if (winterOf(c)) {
        thickSnow(g, 8, 3, 7, 2, 1)
        thickSnow(g, 1, 6, 8, 2, 2)
      }
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/bench',
    layer: 'lower',
    behavior: 'block',
    draw(g, c) {
      shadow(g, 8, 14, 7, 1)
      g.rect(1, 6, 14, 4, 'wood-1')
      g.hline(1, 14, 6, 'paper-2')
      g.hline(1, 14, 9, 'wood-3')
      g.rect(2, 10, 2, 4, 'wood-3')
      g.rect(12, 10, 2, 4, 'wood-3')
      if (winterOf(c)) thickSnow(g, 1, 4, 14, 3, 5)
    },
  },
  {
    id: R.take(1),
    name: 'hokkaido/haybale',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      // 捲好的牧草：夏天是乾草色的捲（看得到螺旋）、秋天之後包上白的膜；冬天上面有雪
      const straw = c.season === 'summer' && c.variant === 0
      shadow(g, 8, 14, 7, 1)
      g.ellipse(8, 8, 7, 6, 'ink-2')
      g.ellipse(8, 8, 6, 5, straw ? 'gold-2' : 'stone-1')
      g.ellipse(7, 7, 4, 3, straw ? 'gold-1' : 'white')
      if (straw) {
        g.ring(8, 8, 2, 'wood-2')
        g.px(8, 8, 'wood-3')
      } else {
        g.hline(3, 13, 11, 'stone-2')
        g.px(4, 5, 'white')
      }
      if (winterOf(c)) thickSnow(g, 3, 2, 10, 3, c.variant)
    },
  },
]

// ---------- 樹 ----------
const TREES: TileDef[] = [
  ...defineObject({
    id: R.take(2),
    name: 'hokkaido/shirakaba',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 白樺：白的樹幹、黑的橫紋、細的枝、輕的葉叢（秋天金黃、冬天光禿、枝上有雪）
      shadow(g, 8, 29, 5, 1)
      g.rect(7, 8, 3, 22, 'white')
      g.vline(7, 8, 29, 'paper')
      g.vline(9, 8, 29, 'stone-1')
      for (const y of [11, 15, 20, 24, 27]) g.hline(7 + (y % 2), 8 + (y % 2), y, 'ink-2')
      g.px(8, 18, 'ink')
      g.line(8, 13, 4, 7, 'stone-2')
      g.line(9, 11, 13, 6, 'stone-2')
      if (winterOf(c)) {
        bareBranches(g, 8, 8, 6, 7, 'stone-2', 21)
        g.hline(4, 6, 6, 'snow-1')
        g.hline(11, 13, 5, 'snow-1')
        return
      }
      const t: Tones =
        c.season === 'autumn'
          ? { line: 'gold-2', dark: 'gold-2', mid: 'gold-1', light: 'sand-1' }
          : c.season === 'spring'
            ? { line: 'leaf-3', dark: 'leaf-2', mid: 'leaf-1', light: 'white' }
            : { line: 'leaf-4', dark: 'leaf-3', mid: 'leaf-2', light: 'leaf-1' }
      foliage(g, 6, 8, 5, 6, t, 13)
      foliage(g, 11, 6, 4, 5, t, 14)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'hokkaido/ezomatsu',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 蝦夷松（針葉樹）：一層一層垂下的枝、深綠；冬天每一層上面都積雪
      shadow(g, 8, 29, 6, 2)
      trunk(g, 7, 25, 29, 2, 'wood-2', 'wood-3', 'wood-1')
      const tiers: Array<[number, number]> = [
        [1, 3],
        [6, 5],
        [12, 6],
        [18, 7],
      ]
      for (const [y, h] of tiers) {
        g.poly([8, y, 8 + h + 1, y + h + 2, 8 - h - 1, y + h + 2], 'leaf-4')
        g.poly([8, y + 1, 8 + h, y + h + 1, 8 - h, y + h + 1], 'leaf-3')
        g.line(8 - h + 1, y + h, 8, y + 2, 'leaf-2')
        if (winterOf(c)) {
          g.line(8 - h, y + h + 1, 8, y + 1, 'snow-1')
          g.line(8, y + 1, 8 + h - 2, y + h - 1, 'snow-1')
          g.px(8, y, 'white')
        }
      }
    },
  }),
  ...defineObject({
    id: R.take(3),
    name: 'hokkaido/poplar',
    w: 1,
    h: 3,
    cells: ['o', 'o', 'L'],
    draw(g, c) {
      // 白楊：細長的柱形樹冠
      shadow(g, 8, 45, 5, 1)
      trunk(g, 7, 34, 45, 2, 'stone-2', 'stone-3', 'stone-1')
      if (winterOf(c)) {
        g.vline(8, 4, 36, 'stone-3')
        for (let y = 8; y < 34; y += 4) {
          g.line(8, y + 3, 5, y, 'stone-3')
          g.line(8, y + 3, 11, y, 'stone-3')
          g.px(5, y, 'snow-1')
        }
        return
      }
      const t: Tones = c.season === 'autumn' ? { line: 'gold-2', dark: 'gold-2', mid: 'gold-1', light: 'sand-1' } : leafTones(c.season, K)
      g.ellipse(8, 19, 5, 17, t.line)
      g.ellipse(8, 19, 4, 16, t.mid)
      g.dither(9, 5, 4, 30, t.dark, 8)
      for (let y = 6; y < 34; y += 5) g.hline(5, 6, y, t.light)
    },
  }),
  ...defineObject({
    id: R.take(8),
    name: 'hokkaido/sakura',
    w: 2,
    h: 2,
    cells: ['oo', 'LL'],
    bloom: true,
    draw(g, c) {
      // 櫻（蝦夷山櫻風：深一點的粉紅，花與紅的嫩葉一起開）
      shadow(g, 16, 29, 12, 2)
      trunk(g, 14, 17, 29, 4, 'ink-2', 'ink', 'wood-3')
      g.line(15, 19, 8, 12, 'ink-2')
      g.line(17, 18, 24, 11, 'ink-2')
      if (c.bloom) {
        foliage(g, 16, 11, 13, 9, { line: 'shu-2', dark: 'sakura-2', mid: 'sakura-2', light: 'sakura-1' }, 31)
        blossoms(g, 16, 11, 11, 7, 'sakura-1', 'momiji-2', 0.14, 11)
        return
      }
      if (winterOf(c)) {
        bareBranches(g, 16, 12, 12, 9, 'ink-2', 8)
        g.hline(9, 12, 8, 'snow-1')
        g.hline(19, 23, 7, 'snow-1')
        return
      }
      const t: Tones = c.season === 'autumn' ? { line: 'leaf-4', dark: 'momiji-2', mid: 'momiji-1', light: 'gold-1' } : leafTones(c.season, K)
      foliage(g, 16, 11, 13, 9, t, 31)
    },
  }),
  ...defineObject({
    id: R.take(8),
    name: 'hokkaido/kaede',
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
        g.hline(10, 13, 9, 'snow-1')
        g.hline(19, 22, 8, 'snow-1')
        return
      }
      const t: Tones = c.bloom ? { line: 'shu-3', dark: 'momiji-2', mid: 'shu-1', light: 'momiji-1' } : leafTones(c.season === 'winter' ? 'autumn' : c.season === 'autumn' ? 'summer' : c.season, K)
      foliage(g, 16, 12, 13, 9, t, 33)
      speckle(g, 4, 4, 24, 16, c.bloom ? 'gold-1' : t.light, 0.05, 7)
    },
  }),
  ...defineObject({
    id: R.take(6),
    name: 'hokkaido/ichou',
    w: 1,
    h: 3,
    cells: ['o', 'o', 'L'],
    bloom: true,
    draw(g, c) {
      // 銀杏（行道樹）：開花＝黃葉；冬天光禿、枝上有雪
      shadow(g, 8, 45, 6, 2)
      trunk(g, 7, 28, 45, 3)
      if (winterOf(c) && !c.bloom) {
        g.vline(8, 6, 32, 'wood-3')
        for (let y = 9; y < 30; y += 4) {
          g.line(8, y, 4, y - 3, 'wood-3')
          g.line(8, y + 2, 12, y - 1, 'wood-3')
          g.px(4, y - 4, 'snow-1')
          g.px(12, y - 2, 'snow-1')
        }
        return
      }
      const t: Tones = c.bloom ? { line: 'gold-2', dark: 'gold-2', mid: 'gold-1', light: 'sand-1' } : leafTones(c.season === 'winter' || c.season === 'autumn' ? 'summer' : c.season, K)
      g.poly([8, 2, 14, 18, 13, 30, 3, 30, 2, 18], t.line)
      g.poly([8, 4, 13, 18, 12, 29, 4, 29, 3, 18], t.mid)
      g.dither(9, 10, 5, 20, t.dark, 8)
      for (let y = 9; y < 29; y += 5) g.hline(4, 7, y, t.light)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'hokkaido/tree',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 一般的闊葉樹（冬天光禿、枝上有雪）
      shadow(g, 8, 29, 7, 2)
      trunk(g, 6, 18, 29, 4)
      if (winterOf(c)) {
        bareBranches(g, 8, 11, 7, 9, 'wood-3', 2)
        g.hline(3, 5, 6, 'snow-1')
        g.hline(10, 12, 4, 'snow-1')
        return
      }
      foliage(g, 8, 11, 7, 9, leafTones(c.season, K), 11)
    },
  }),
  ...defineObject({
    id: R.take(2),
    name: 'hokkaido/yabane',
    w: 1,
    h: 2,
    cells: ['o', 'L'],
    draw(g, c) {
      // 矢羽根：路邊細高的桿子，頂上紅白的箭頭往下指（下雪時看得到路邊在哪）
      shadow(g, 6, 30, 2, 1)
      g.vline(5, 3, 30, 'stone-3')
      g.vline(6, 3, 30, 'stone-2')
      g.rect(6, 3, 8, 2, 'stone-3')
      for (let y = 5; y < 15; y++) {
        const w = Math.max(1, Math.round((15 - y) * 0.45))
        g.hline(12 - w, 12 + w - 1, y, Math.floor((y - 5) / 2) % 2 ? 'white' : 'shu-1')
      }
      g.px(12, 15, 'shu-2')
      if (winterOf(c)) g.hline(6, 13, 2, 'snow-1')
    },
  }),
  ...defineObject({ id: R.take(2), name: 'hokkaido/pole', w: 1, h: 2, cells: ['o', 'L'], draw: (g, c) => utilityPole(g, c, U) }),
  ...defineObject({ id: R.take(2), name: 'hokkaido/signal', w: 1, h: 2, cells: ['o', 'L'], draw: (g, c) => trafficSignal(g, c, true) }),
  ...defineObject({ id: R.take(2), name: 'hokkaido/lamp', w: 1, h: 2, cells: ['o', 'L'], draw: (g, c) => streetLamp(g, c, true) }),
]

// ---------- 建築 ----------
interface TinTone {
  light: Px
  mid: Px
  dark: Px
  line: Px
}
const TIN: Record<'red' | 'green' | 'blue' | 'gray', TinTone> = {
  red: { light: 'shu-1', mid: 'shu-2', dark: 'shu-3', line: 'ink-2' },
  green: { light: 'leaf-2', mid: 'leaf-3', dark: 'leaf-4', line: 'ink-2' },
  blue: { light: 'cloth-1', mid: 'cloth-2', dark: 'roof-3', line: 'ink' },
  gray: { light: 'stone-1', mid: 'stone-2', dark: 'stone-3', line: 'ink-2' },
}

/** 鐵皮屋頂（從前面看的斜面）：上窄下寬、往下的接縫（每 4px 一條亮線）、屋脊的蓋板 */
function tinRoof(g: Gfx, x: number, y: number, w: number, h: number, t: TinTone, slope: number) {
  const inset = (yy: number) => Math.round(slope * (1 - (yy - y) / Math.max(1, h - 1)))
  for (let yy = y; yy < y + h; yy++) {
    const a = x + inset(yy)
    const b = x + w - 1 - inset(yy)
    g.hline(a, b, yy, t.mid)
    for (let xx = a + 2; xx < b; xx += 4) g.px(xx, yy, t.light)
    for (let xx = a + 3; xx < b; xx += 4) g.px(xx, yy, t.dark)
    g.px(a, yy, t.line)
    g.px(b, yy, t.line)
  }
  g.rect(x + inset(y) + 1, y, w - 2 - inset(y) * 2, 2, t.dark)
  g.hline(x + inset(y), x + w - 1 - inset(y), y, t.line)
  g.hline(x, x + w - 1, y + h - 1, t.line)
  g.hline(x + 1, x + w - 2, y + h - 2, t.dark)
}

/**
 * 冬天的屋頂：雪蓋住斜面的上三分之二（下緣圓圓的、有一點起伏），露出屋簷那一段的鐵皮；
 * 跟 tinRoof 同一個梯形（x、y、w、h、slope 一樣）。
 */
function roofSnow(g: Gfx, x: number, y: number, w: number, h: number, slope: number, seed: number) {
  const inset = (yy: number) => Math.round(slope * (1 - (yy - y) / Math.max(1, h - 1)))
  const bottom = y + Math.round(h * 0.68)
  for (let yy = y; yy <= bottom; yy++) {
    const a = x + inset(yy) + 1
    const b = x + w - 2 - inset(yy)
    g.hline(a, b, yy, 'snow-1')
  }
  // 下緣：雪的邊鼓鼓的，下面一條陰影
  for (let xx = x + inset(bottom) + 1; xx <= x + w - 2 - inset(bottom); xx++) {
    const d = hash2(xx >> 2, y, seed) % 3
    g.vline(xx, bottom, bottom + d, 'snow-1')
    g.px(xx, bottom + d + 1, 'snow-3')
  }
  g.hline(x + inset(y) + 1, x + w - 2 - inset(y), y, 'white')
  for (let yy = y + 4; yy < bottom - 1; yy += 5) g.hline(x + inset(yy) + 4, x + w - 5 - inset(yy), yy, 'snow-2')
}

/** 北海道的平房（4×4）：彩色的鐵皮屋頂、煙囪、雨淋板、雙層窗、玄關前的風除室（玻璃的小間）、高的水泥地基 */
function tinHouse(g: Gfx, c: TileCtx, t: TinTone, seed: number) {
  const night = c.time === 'night'
  const w = winterOf(c)
  tinRoof(g, 0, 6, 64, 24, t, 8)
  // 煙囪（銀色的管子）
  g.rect(46, 0, 4, 12, 'stone-1')
  g.vline(49, 0, 11, 'stone-3')
  g.rect(45, 0, 6, 2, 'stone-3')
  if (w) {
    roofSnow(g, 0, 6, 64, 24, 8, seed)
    g.rect(45, 0, 6, 2, 'snow-1')
  }
  g.rect(3, 30, 58, 27, seed % 2 ? 'sand-1' : 'paper')
  for (let y = 32; y < 56; y += 3) g.hline(3, 60, y, seed % 2 ? 'sand-2' : 'paper-2')
  g.vline(3, 30, 56, 'stone-3')
  g.vline(60, 30, 56, 'stone-3')
  windowPane(g, 7, 34, 14, 12, night, 'stone-3')
  g.vline(14, 35, 44, 'stone-3')
  windowPane(g, 44, 34, 12, 12, night, 'stone-3')
  // 風除室
  g.rect(24, 38, 16, 19, 'stone-3')
  g.rect(25, 39, 14, 18, night ? 'lamp-1' : 'sky-day-2')
  g.vline(32, 39, 56, 'stone-3')
  g.rect(23, 36, 18, 2, t.mid)
  if (!night) g.dither(25, 48, 14, 8, 'sky-day-1', 8)
  if (w) thickSnow(g, 23, 34, 18, 3, seed + 2)
  // 地基
  g.rect(0, 57, 64, 5, 'stone-2')
  g.hline(0, 63, 57, 'stone-1')
  g.hline(0, 63, 62, 'stone-4')
  g.hline(0, 63, 63, 'stone-4')
  if (w) {
    icicles(g, 2, 61, 30, seed)
    // 牆邊的雪堆
    for (const [x0, x1] of [[0, 22], [42, 63]] as const) {
      g.rect(x0, 55, x1 - x0, 7, 'snow-1')
      g.hline(x0 + 1, x1 - 2, 54, 'white')
      g.hline(x0, x1 - 1, 61, 'snow-3')
    }
  }
}

/** 平房（3×3） */
function tinCottage(g: Gfx, c: TileCtx, t: TinTone, seed: number) {
  const night = c.time === 'night'
  const w = winterOf(c)
  tinRoof(g, 0, 3, 48, 18, t, 5)
  if (w) roofSnow(g, 0, 3, 48, 18, 5, seed)
  g.rect(2, 21, 44, 22, 'paper')
  for (let y = 23; y < 42; y += 3) g.hline(2, 45, y, 'paper-2')
  g.vline(2, 21, 42, 'stone-3')
  g.vline(45, 21, 42, 'stone-3')
  windowPane(g, 6, 25, 14, 10, night, 'stone-3')
  g.rect(28, 25, 12, 18, 'stone-3')
  g.rect(29, 26, 10, 17, night ? 'lamp-1' : 'sky-day-2')
  g.rect(0, 43, 48, 5, 'stone-2')
  g.hline(0, 47, 43, 'stone-1')
  g.hline(0, 47, 47, 'stone-4')
  if (w) icicles(g, 2, 45, 21, seed)
}

/** 牧舍（5×4）：山牆面對前面的折線屋頂（紅的鐵皮、白的收邊）、紅的板牆、白的 X 形大門、上面的乾草門 */
function barn(g: Gfx, c: TileCtx) {
  const w = winterOf(c)
  g.poly([1, 31, 11, 13, 40, 2, 69, 13, 79, 31], 'ink-2')
  g.poly([3, 30, 12, 14, 40, 4, 68, 14, 77, 30], 'shu-2')
  for (let x = 6; x < 76; x += 4) g.vline(x, Math.round(4 + Math.abs(x - 40) * 0.37), 29, 'shu-3')
  g.line(3, 30, 12, 14, 'white')
  g.line(12, 14, 40, 4, 'white')
  g.line(40, 4, 68, 14, 'white')
  g.line(68, 14, 77, 30, 'white')
  if (w) {
    g.poly([8, 26, 14, 15, 40, 6, 66, 15, 72, 26], 'snow-1')
    g.line(14, 15, 40, 6, 'white')
    g.line(40, 6, 66, 15, 'white')
    for (let y = 18; y < 26; y += 4) g.hline(12 + Math.round((26 - y) * 0.4), 68 - Math.round((26 - y) * 0.4), y, 'snow-2')
  }
  // 乾草門
  g.rect(33, 12, 14, 12, 'white')
  g.rect(34, 13, 12, 10, 'shu-3')
  g.line(34, 13, 45, 22, 'white')
  g.line(45, 13, 34, 22, 'white')
  // 牆
  g.rect(3, 30, 74, 30, 'shu-2')
  for (let x = 5; x < 76; x += 3) g.vline(x, 30, 59, 'shu-3')
  g.vline(3, 30, 59, 'white')
  g.vline(76, 30, 59, 'white')
  g.rect(26, 34, 28, 26, 'white')
  g.rect(27, 35, 12, 25, 'shu-3')
  g.rect(41, 35, 12, 25, 'shu-3')
  for (const x0 of [27, 41]) {
    g.line(x0, 35, x0 + 11, 59, 'white')
    g.line(x0 + 11, 35, x0, 59, 'white')
  }
  for (const x of [8, 62]) windowPane(g, x, 38, 10, 8, c.time === 'night', 'white')
  g.rect(0, 60, 80, 4, 'stone-2')
  g.hline(0, 79, 63, 'stone-4')
  if (w) {
    g.rect(0, 56, 26, 6, 'snow-1')
    g.rect(54, 56, 26, 6, 'snow-1')
    g.hline(0, 25, 55, 'white')
    g.hline(54, 79, 55, 'white')
  }
}

/** 筒倉（2×4）：圓筒（紅磚）、圓頂、旁邊的梯子 */
function silo(g: Gfx, c: TileCtx) {
  const w = winterOf(c)
  g.ellipse(16, 10, 12, 8, 'ink-2')
  g.ellipse(16, 10, 11, 7, 'stone-2')
  g.ellipse(14, 8, 6, 4, 'stone-1')
  if (w) {
    g.ellipse(16, 8, 10, 5, 'snow-1')
    g.hline(10, 20, 4, 'white')
  }
  g.rect(4, 12, 24, 49, 'ink-2')
  g.rect(5, 12, 22, 48, 'kawara-2')
  for (let y = 14; y < 60; y += 3) g.hline(5, 26, y, 'kawara-3')
  g.vline(6, 12, 59, 'kawara-1')
  g.vline(7, 12, 59, 'kawara-1')
  g.dither(20, 12, 7, 48, 'kawara-3', 8)
  for (const y of [22, 40]) g.hline(5, 26, y, 'stone-3')
  g.vline(24, 16, 58, 'stone-4')
  g.vline(26, 16, 58, 'stone-4')
  for (let y = 18; y < 58; y += 4) g.hline(24, 26, y, 'stone-4')
  g.rect(2, 60, 28, 4, 'stone-2')
  g.hline(2, 29, 63, 'stone-4')
}

/** 紅磚倉庫（5×3）：低的鐵皮屋頂、紅磚的牆（磚縫一排錯開一排）、拱形的鐵門與小窗；裡面是店（夜裡門亮） */
function brickWarehouse(g: Gfx, c: TileCtx, seed: number) {
  const late = c.time !== 'day'
  const w = winterOf(c)
  tinRoof(g, 0, 2, 80, 12, TIN.gray, 3)
  if (w) thickSnow(g, 4, 2, 72, 6, seed)
  g.rect(1, 14, 78, 31, 'kawara-2')
  for (let y = 15; y < 45; y += 3) {
    g.hline(1, 78, y, 'kawara-3')
    for (let x = 2 + ((y / 3) % 2) * 3; x < 78; x += 6) g.px(x, y + 1, 'kawara-3')
  }
  speckle(g, 1, 14, 78, 31, 'kawara-1', 0.05, seed)
  g.hline(1, 78, 14, 'kawara-1')
  g.rect(1, 17, 78, 2, 'kawara-3')
  for (const x of [8, 44]) {
    // 拱形的入口
    g.rect(x, 24, 28, 21, 'ink-2')
    g.rect(x + 2, 26, 24, 19, late ? 'lamp-1' : 'stone-3')
    g.hline(x + 2, x + 25, 25, 'kawara-1')
    g.px(x + 1, 24, 'kawara-2')
    g.px(x + 26, 24, 'kawara-2')
    if (!late) for (let xx = x + 4; xx < x + 25; xx += 4) g.vline(xx, 27, 44, 'stone-4')
  }
  for (const x of [5, 39, 73]) {
    g.rect(x, 20, 4, 3, 'ink-2')
    g.px(x + 1, 21, late ? 'lamp-2' : 'stone-2')
  }
  g.vline(1, 14, 44, 'kawara-3')
  g.vline(78, 14, 44, 'kawara-3')
  g.rect(0, 45, 80, 3, 'stone-2')
  g.hline(0, 79, 47, 'stone-4')
  if (w) icicles(g, 2, 77, 14, seed)
}

/** 時計台（5×6）：前面的鐘塔（尖屋頂、風向雞、鐘面、百葉窗）、紅的鐵皮屋頂、白的雨淋板、直長的上下窗 */
function clockTower(g: Gfx, c: TileCtx) {
  const late = c.time !== 'day'
  const night = c.time === 'night'
  const w = winterOf(c)
  // 主體：紅屋頂
  tinRoof(g, 0, 36, 80, 26, TIN.red, 12)
  if (w) {
    thickSnow(g, 13, 37, 18, 8, 1)
    thickSnow(g, 50, 37, 18, 8, 2)
  }
  g.rect(3, 62, 74, 31, 'white')
  for (let y = 64; y < 92; y += 3) g.hline(3, 76, y, 'paper-2')
  g.vline(3, 62, 92, 'stone-3')
  g.vline(76, 62, 92, 'stone-3')
  for (const x of [8, 20, 54, 66]) {
    g.rect(x, 66, 7, 14, 'wood-3')
    g.rect(x + 1, 67, 5, 12, night ? 'lamp-1' : 'sky-day-2')
    g.hline(x + 1, x + 5, 72, 'wood-3')
  }
  // 鐘塔
  g.vline(40, 0, 6, 'ink-2')
  g.hline(37, 43, 2, 'ink-2')
  g.poly([29, 18, 40, 5, 51, 18], 'ink-2')
  g.poly([31, 17, 40, 7, 49, 17], 'shu-2')
  g.line(40, 7, 32, 17, 'shu-1')
  if (w) g.poly([33, 16, 40, 9, 45, 16], 'snow-1')
  g.rect(30, 18, 20, 46, 'white')
  for (let y = 20; y < 63; y += 3) g.hline(30, 49, y, 'paper-2')
  g.vline(30, 18, 63, 'stone-3')
  g.vline(49, 18, 63, 'stone-3')
  g.circle(40, 28, 6, 'ink-2')
  g.circle(40, 28, 5, late ? 'lamp-1' : 'white')
  g.line(40, 28, 40, 24, 'ink')
  g.line(40, 28, 43, 29, 'ink')
  g.rect(35, 38, 10, 8, 'stone-3')
  for (let y = 39; y < 45; y += 2) g.hline(36, 44, y, 'stone-1')
  // 正面的門與小雨庇
  g.rect(33, 72, 14, 2, 'shu-2')
  g.rect(34, 74, 12, 19, 'wood-3')
  g.rect(35, 75, 10, 18, late ? 'lamp-2' : 'wood-2')
  g.vline(40, 75, 92, 'wood-3')
  g.rect(0, 93, 80, 3, 'stone-2')
  g.hline(0, 79, 95, 'stone-4')
  if (w) icicles(g, 4, 75, 62, 7)
}

/** 北海道的車站（8×4）：綠的鐵皮屋頂、正面的三角山牆（站名牌在上面）、木的牆、玻璃的風除室 */
function chaletStation(g: Gfx, c: TileCtx) {
  const late = c.time !== 'day'
  const w = winterOf(c)
  tinRoof(g, 0, 8, 128, 22, TIN.green, 10)
  if (w) thickSnow(g, 12, 8, 104, 8, 3)
  // 三角山牆
  g.poly([38, 34, 64, 2, 90, 34], 'ink-2')
  g.poly([41, 33, 64, 5, 87, 33], 'leaf-3')
  g.poly([45, 33, 64, 10, 83, 33], 'paper')
  for (let y = 14; y < 33; y += 3) g.hline(64 - Math.round((y - 10) * 0.8), 64 + Math.round((y - 10) * 0.8), y, 'paper-2')
  if (w) {
    g.line(41, 32, 64, 5, 'snow-1')
    g.line(64, 5, 87, 32, 'snow-1')
    g.line(42, 33, 64, 6, 'snow-1')
  }
  g.rect(50, 20, 28, 8, 'cloth-2')
  g.frame(50, 20, 28, 8, 'ink-2')
  for (let x = 53; x < 75; x += 5) g.hline(x, x + 2, 23, 'white')
  // 牆
  g.rect(2, 30, 124, 31, 'wood-1')
  for (let y = 32; y < 60; y += 3) g.hline(2, 125, y, 'wood-2')
  for (const x of [8, 26, 90, 108]) windowPane(g, x, 38, 14, 14, c.time === 'night', 'wood-3')
  for (const x of [2, 125]) g.vline(x, 30, 60, 'wood-3')
  // 風除室與玻璃門
  g.rect(46, 36, 36, 25, 'stone-3')
  g.rect(48, 38, 32, 23, late ? 'lamp-1' : 'sky-day-2')
  g.vline(63, 38, 60, 'stone-3')
  g.vline(64, 38, 60, 'stone-3')
  if (!late) g.dither(48, 52, 32, 8, 'sky-day-1', 8)
  g.rect(44, 34, 40, 2, 'leaf-4')
  if (w) thickSnow(g, 44, 32, 40, 3, 4)
  g.rect(0, 61, 128, 3, 'stone-2')
  g.hline(0, 127, 63, 'stone-4')
  if (w) icicles(g, 2, 125, 30, 5)
}

/** 拉麵屋、食堂（5×4）：藍的鐵皮屋頂、木的正面、招牌（色塊）、紅暖簾、蒸氣、紅燈籠 */
function ramenShop(g: Gfx, c: TileCtx) {
  const late = c.time !== 'day'
  const w = winterOf(c)
  tinRoof(g, 0, 6, 80, 22, TIN.blue, 6)
  g.rect(62, 0, 3, 12, 'stone-1')
  g.vline(64, 0, 11, 'stone-3')
  if (!w) g.dither(58, 0, 10, 4, 'white', 4)
  if (w) thickSnow(g, 8, 6, 64, 7, 2)
  g.rect(1, 28, 78, 33, 'wood-2')
  for (let x = 3; x < 78; x += 4) g.vline(x, 28, 60, 'wood-3')
  g.rect(14, 30, 52, 9, 'ink-2')
  g.rect(15, 31, 50, 7, 'paper')
  for (let x = 19; x < 62; x += 7) g.rect(x, 33, 4, 3, 'shu-2')
  windowPane(g, 5, 42, 18, 12, c.time === 'night', 'wood-3')
  windowPane(g, 57, 42, 18, 12, c.time === 'night', 'wood-3')
  g.rect(30, 40, 20, 21, 'wood-3')
  g.rect(31, 41, 18, 20, late ? 'lamp-1' : 'ink-2')
  noren(g, 29, 40, 22, 10, 'shu-1', 'shu-2')
  for (const x of [25, 52]) {
    g.px(x + 1, 41, 'ink')
    g.rect(x, 42, 3, 4, late ? 'lamp-1' : 'shu-1')
  }
  g.rect(0, 61, 80, 3, 'stone-2')
  g.hline(0, 79, 63, 'stone-4')
  if (w) icicles(g, 2, 77, 28, 3)
}

/** 旅館（6×4）：兩層的木造、綠的鐵皮屋頂、屋頂的老虎窗、亮燈的窗、入口的雨庇與深藍暖簾 */
function lodge(g: Gfx, c: TileCtx) {
  const late = c.time !== 'day'
  const night = c.time === 'night'
  const w = winterOf(c)
  tinRoof(g, 0, 2, 96, 20, TIN.green, 8)
  for (const x of [24, 60]) {
    g.poly([x, 12, x + 6, 6, x + 12, 12], 'ink-2')
    g.rect(x + 1, 12, 10, 6, 'paper')
    g.rect(x + 3, 13, 6, 4, night ? 'lamp-1' : 'sky-day-2')
  }
  if (w) {
    thickSnow(g, 9, 2, 14, 6, 1)
    thickSnow(g, 38, 2, 20, 6, 2)
    thickSnow(g, 74, 2, 13, 6, 3)
  }
  g.rect(2, 22, 92, 39, 'paper')
  for (const x of [2, 32, 62, 92]) g.rect(x, 22, 2, 39, 'wood-3')
  g.rect(2, 38, 92, 2, 'wood-3')
  for (const x of [8, 20, 68, 80]) {
    g.rect(x, 25, 9, 10, 'wood-3')
    g.rect(x + 1, 26, 7, 8, night || late ? 'lamp-1' : 'sky-day-2')
  }
  for (const x of [8, 72]) windowPane(g, x, 43, 16, 12, night, 'wood-3')
  g.rect(36, 40, 24, 21, 'wood-3')
  g.rect(37, 41, 22, 20, late ? 'lamp-1' : 'ink-2')
  noren(g, 35, 41, 26, 9, 'cloth-2', 'roof-3')
  g.rect(33, 38, 30, 3, 'leaf-4')
  if (w) thickSnow(g, 33, 36, 30, 3, 4)
  g.rect(0, 61, 96, 3, 'stone-2')
  g.hline(0, 95, 63, 'stone-4')
  if (w) icicles(g, 2, 93, 22, 9)
}

/** 石造的老舖（5×4）：瓦屋頂、石塊的牆、鐵格子的小窗、木的大門、看板（色塊）、暖簾 */
function stoneShop(g: Gfx, c: TileCtx) {
  const late = c.time !== 'day'
  const w = winterOf(c)
  tileRoof(g, 0, 2, 80, 20, GRAY_ROOF, { slope: 4 })
  if (w) thickSnow(g, 6, 3, 68, 7, 5)
  g.rect(1, 22, 78, 39, 'stone-1')
  for (let y = 22; y < 60; y += 5) {
    g.hline(1, 78, y, 'stone-2')
    for (let x = 1 + ((y / 5) % 2) * 6; x < 78; x += 12) g.vline(x, y, y + 4, 'stone-2')
  }
  speckle(g, 1, 22, 78, 39, 'paper', 0.04, 3)
  for (const x of [8, 62]) {
    g.rect(x, 28, 10, 9, 'ink-2')
    for (let xx = x + 2; xx < x + 9; xx += 2) g.vline(xx, 29, 35, late ? 'lamp-2' : 'stone-3')
  }
  g.rect(22, 26, 36, 10, 'ink-2')
  g.rect(23, 27, 34, 8, 'wood-1')
  for (let x = 27; x < 54; x += 7) g.rect(x, 29, 4, 4, 'ink-2')
  g.rect(28, 40, 24, 21, 'wood-3')
  g.rect(29, 41, 22, 20, late ? 'lamp-1' : 'ink-2')
  noren(g, 27, 40, 26, 10, 'roof-3', 'ink', 'paper')
  g.vline(1, 22, 60, 'stone-3')
  g.vline(78, 22, 60, 'stone-3')
  g.rect(0, 61, 80, 3, 'stone-2')
  g.hline(0, 79, 63, 'stone-4')
  if (w) icicles(g, 2, 77, 22, 6)
}

const ROOF4 = ['OOOO', 'LLLL', 'LLLL', 'LLLL']
const BUILDINGS: TileDef[] = [
  ...(['red', 'green', 'blue'] as const).flatMap((tone, i) =>
    defineObject({ id: R.take(16), name: `hokkaido/house-${'abc'[i]}`, w: 4, h: 4, cells: ['OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => tinHouse(g, c, TIN[tone], i) }),
  ),
  ...(['red', 'blue'] as const).flatMap((tone, i) => defineObject({ id: R.take(9), name: `hokkaido/house-low-${'ab'[i]}`, w: 3, h: 3, cells: ['OOO', 'LLL', 'LLL'], draw: (g, c) => tinCottage(g, c, TIN[tone], i + 3) })),
  ...defineObject({ id: R.take(20), name: 'hokkaido/barn', w: 5, h: 4, cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLLLL'], draw: barn }),
  ...defineObject({ id: R.take(8), name: 'hokkaido/silo', w: 2, h: 4, cells: ['OO', 'OO', 'LL', 'LL'], draw: silo }),
  ...defineObject({ id: R.take(15), name: 'hokkaido/warehouse', w: 5, h: 3, cells: ['OOOOO', 'LLLLL', 'LLLLL'], draw: (g, c) => brickWarehouse(g, c, 4) }),
  ...defineObject({ id: R.take(30), name: 'hokkaido/clocktower', w: 5, h: 6, cells: ['.OOO.', '.OOO.', 'OOOOO', 'OOOOO', 'LLLLL', 'LLLLL'], draw: clockTower }),
  ...defineObject({ id: R.take(32), name: 'hokkaido/station', w: 8, h: 4, cells: ['OOOOOOOO', 'OOOOOOOO', 'LLLLLLLL', 'LLLDDLLL'], draw: chaletStation }),
  // 札幌這類的政令指定都市的區：高架的大車站（都市的畫法，冬天屋頂有雪）
  ...defineObject({ id: R.take(32), name: 'hokkaido/station-city', w: 8, h: 4, cells: ['OOOOOOOO', 'OOOOOOOO', 'LLLLLLLL', 'LLLDDLLL'], draw: (g, c) => elevatedStation(g, c, U) }),
  ...defineObject({ id: R.take(20), name: 'hokkaido/shokudo', w: 5, h: 4, cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'], draw: ramenShop }),
  ...defineObject({ id: R.take(24), name: 'hokkaido/inn', w: 6, h: 4, cells: ['OOOOOO', 'OOOOOO', 'LLLLLL', 'LLDLLL'], draw: lodge }),
  ...defineObject({ id: R.take(20), name: 'hokkaido/shinise', w: 5, h: 4, cells: ['OOOOO', 'OOOOO', 'LLLLL', 'LLDLL'], draw: stoneShop }),
  // 札幌這類的街上：都市的畫法加上雪
  ...[0, 1].flatMap((s) => defineObject({ id: R.take(16), name: `hokkaido/office-${'ab'[s]}`, w: 4, h: 4, cells: ROOF4, draw: (g, c) => (s ? officeTile(g, c, U, 17) : officeGlass(g, c, U, 13)) })),
  ...defineObject({ id: R.take(16), name: 'hokkaido/mixed', w: 4, h: 4, cells: ROOF4, draw: (g, c) => mixedUse(g, c, U, 21, 'sand-1') }),
  ...defineObject({ id: R.take(16), name: 'hokkaido/apartment', w: 4, h: 4, cells: ROOF4, draw: (g, c) => apartment(g, c, U, 15) }),
  ...defineObject({ id: R.take(16), name: 'hokkaido/house-flat', w: 4, h: 4, cells: ROOF4, draw: (g, c) => boxHouse(g, c, U, 6) }),
  ...defineObject({ id: R.take(12), name: 'hokkaido/konbini', w: 4, h: 3, cells: ['OOOO', 'LLLL', 'LLLL'], draw: (g, c) => konbini(g, c, U, 19) }),
  ...defineObject({ id: R.take(24), name: 'hokkaido/hall', w: 6, h: 4, cells: ['OOOOOO', 'LLLLLL', 'LLLLLL', 'LLLLLL'], draw: (g, c) => hall(g, c, U, 18) }),
  ...defineObject({ id: R.take(24), name: 'hokkaido/highrise', w: 4, h: 6, cells: ['OOOO', 'OOOO', 'OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => highrise(g, c, U, 20) }),
  ...defineObject({ id: R.take(4), name: 'hokkaido/shop-front', w: 2, h: 2, cells: ['OO', 'LL'], draw: (g, c) => {
    shopFront(g, c, 1)
    if (winterOf(c)) thickSnow(g, 0, 4, 32, 3, 1)
  } }),
  ...defineObject({ id: R.take(20), name: 'hokkaido/church', w: 4, h: 5, cells: ['.OO.', 'OOOO', 'OOOO', 'LLLL', 'LLLL'], draw: (g, c) => church(g, c, U) }),
  ...defineObject({ id: R.take(21), name: 'hokkaido/tower-lattice', w: 3, h: 7, cells: ['.o.', '.o.', '.o.', 'ooo', 'OOO', 'LLL', 'LLL'], draw: (g, c) => latticeTower(g, c, U) }),
  ...defineObject({ id: R.take(21), name: 'hokkaido/tower-tall', w: 3, h: 7, cells: ['.o.', '.o.', '.o.', 'ooo', 'OOO', 'LLL', 'LLL'], draw: (g, c) => slenderTower(g, c, U) }),
  // 自然的地標（名字寫著山、岳、滝、温泉、灯台）
  ...defineObject({ id: R.take(24), name: 'hokkaido/peak', w: 6, h: 4, cells: ['..OO..', '.OOOO.', 'LLLLLL', 'LLLLLL'], draw: (g, c) => peak(g, c, N) }),
  ...defineObject({ id: R.take(12), name: 'hokkaido/falls', w: 3, h: 4, cells: ['OOO', 'OOO', 'LLL', 'LLL'], frames: 4, fps: 6, draw: (g, c) => waterfall(g, c, N) }),
  ...defineObject({ id: R.take(12), name: 'hokkaido/onsen', w: 4, h: 3, cells: ['OOOO', 'LLLL', 'LLLL'], frames: 4, fps: 3, draw: (g, c) => onsen(g, c, N) }),
  ...defineObject({ id: R.take(8), name: 'hokkaido/lighthouse', w: 2, h: 4, cells: ['oo', 'OO', 'LL', 'LL'], draw: (g, c) => lighthouse(g, c, N) }),
]

// ---------- 近畿的寺社、茶屋、展館、城門：北海道冬天的厚雪版 ----------
/**
 * 北海道的鎮也用近畿的零件（藍圖沒有北海道的版本）：照近畿的畫法畫，冬天再沿著上緣蓋一層厚雪
 * （每一行從最上面那個有顏色的像素往下 depth px；只蓋有東西的像素，鳥居、門的空隙照舊）。
 * 京都、沖繩用的還是近畿的那一份（不變）；換哪些、雪多厚在 snowcover.ts（gen/roles.ts 的北海道 objSub 照同一張表）。
 */
function snowOver(g: Gfx, W: number, H: number, depth: number, seed: number) {
  const tops: number[] = []
  for (let x = 0; x < W; x++) {
    let top = -1
    for (let y = 0; y < H; y++)
      if (g.buf[y * g.w + x]) {
        top = y
        break
      }
    tops.push(top)
  }
  const first = Math.min(...tops.filter((t) => t >= 0))
  for (let x = 0; x < W; x++) {
    const top = tops[x]!
    if (top < 0) continue
    // 屋頂兩端（比最高的地方低很多的那幾行）只蓋一層，不往下流成一條一條
    const d = top - first > depth ? 1 : depth + (hash2(x, top, seed) % 4 === 0 ? 1 : 0)
    for (let y = top; y < Math.min(H, top + d); y++) {
      if (!g.buf[y * g.w + x]) continue
      // 上緣一圈淡藍的邊（雪地上看得出屋頂的輪廓）、下緣一圈影子
      g.px(x, y, y === top ? 'snow-3' : y === top + 1 ? 'white' : y >= top + d - 1 ? 'snow-2' : 'snow-1')
    }
    const below = Math.min(H - 1, top + d)
    if (d > 1 && g.buf[below * g.w + x] && hash2(x, below, seed) % 3 === 0) g.px(x, below, 'snow-3')
  }
}
const SNOW_OBJECTS: TileDef[] = Object.entries(HOKKAIDO_SNOW_OBJECTS).flatMap(([name, depth], k) => {
  const spec = objectSpec(name)
  if (!spec) return []
  return defineObject({
    ...spec,
    id: R.take(spec.w * spec.h * (spec.bloom ? 2 : 1)),
    name: snowObjectName(name),
    draw(g, c) {
      spec.draw(g, c)
      if (winterOf(c)) snowOver(g, spec.w * 16, spec.h * 16, depth, 40 + k)
    },
  })
})
const kinkiArcade = tileDef(tileId('kinki/arcade'))
const SNOW_TILES: TileDef[] = kinkiArcade
  ? [
      {
        id: R.take(1),
        name: HOKKAIDO_SNOW_TILES['kinki/arcade']!,
        layer: 'over',
        connect: (o) => o?.name === HOKKAIDO_SNOW_TILES['kinki/arcade'],
        draw(g, c) {
          kinkiArcade.draw(g, c)
          if (!winterOf(c)) return
          // 拱廊的屋頂：鐵架上積的雪（一格兩道）
          thickSnow(g, c.x, c.y, 16, 2, 7)
          thickSnow(g, c.x, c.y + 8, 16, 2, 8)
        },
      },
    ]
  : []

export const HOKKAIDO_TILES: TileDef[] = [...GROUND, ...SMALL, ...TREES, ...BUILDINGS, ...SNOW_OBJECTS, ...SNOW_TILES]
registerTileset('hokkaido', HOKKAIDO_TILES)

/** 開花的對照（world/season.ts 依平年值換）：一般的名字 → 開花的名字 */
export const HOKKAIDO_BLOOM: Record<string, { flower: 'sakura' | 'kaede' | 'ichou'; bloom: string }> = {
  'hokkaido/sakura': { flower: 'sakura', bloom: 'hokkaido/sakura@bloom' },
  'hokkaido/kaede': { flower: 'kaede', bloom: 'hokkaido/kaede@bloom' },
  'hokkaido/ichou': { flower: 'ichou', bloom: 'hokkaido/ichou@bloom' },
}
registerBloom(HOKKAIDO_BLOOM)

/** 北海道的路（郊外、街上、斑馬線、橋）：生成器判斷路口用 */
export const hokkaidoRoad = isRoad
