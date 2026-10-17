import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Px } from '../../services/pixelwalk/palette'

import { bigTiles, registerTileset } from '../engine/tiles'
import type { Season, TileCtx, TileDef } from '../engine/types'

/**
 * 基本 tile（P0，id 1–1023）：草、草叢、路、石板、水（動畫、接岸）、沙、花（動畫）、台階、
 * 樹（下半 lower、樹冠 over）、矮牆、柵欄、告示牌、拍攝點記號、門、房子與店（牆 lower、屋頂 over）、
 * 室內的地板、牆、櫃台、桌、架子、門墊。顏色只用 px token；季節換草、花、樹的顏色，夜裡窗戶亮燈。
 */

// ---------- 小工具 ----------
interface Greens {
  base: Px
  dark: Px
  light: Px
}
function greens(s: Season): Greens {
  if (s === 'autumn') return { base: 'leaf-2', dark: 'leaf-3', light: 'sand-2' }
  if (s === 'winter') return { base: 'leaf-3', dark: 'leaf-4', light: 'snow-2' }
  if (s === 'summer') return { base: 'leaf-2', dark: 'leaf-3', light: 'leaf-1' }
  return { base: 'leaf-2', dark: 'leaf-3', light: 'leaf-1' }
}

/** 一小撮草（ʌʌ） */
function tuft(g: Gfx, x: number, y: number, k: Px) {
  g.px(x, y + 1, k)
  g.px(x + 1, y, k)
  g.px(x + 2, y + 1, k)
  g.px(x + 3, y, k)
  g.px(x + 4, y + 1, k)
}

/** 有外框的橢圓（樹冠） */
function blob(g: Gfx, cx: number, cy: number, rx: number, ry: number, fill: Px, line: Px) {
  g.ellipse(cx, cy, rx + 1, ry + 1, line)
  g.ellipse(cx, cy, rx, ry, fill)
}

function grass(g: Gfx, c: TileCtx) {
  const k = greens(c.season)
  g.rect(0, 0, 16, 16, k.base)
  if (c.variant === 0) {
    tuft(g, 2, 3, k.dark)
    tuft(g, 9, 10, k.dark)
    g.px(12, 4, k.light)
  } else if (c.variant === 1) {
    g.px(3, 11, k.light)
    g.px(11, 6, k.light)
    g.px(7, 2, k.dark)
    g.px(13, 13, k.dark)
  } else {
    tuft(g, 6, 7, k.dark)
    g.px(2, 13, k.light)
  }
}

// ---------- 地面 ----------
const GROUND: TileDef[] = [
  { id: 1, name: 'basic/grass', layer: 'ground', behavior: 'walk', variants: 3, draw: grass },
  {
    id: 2,
    name: 'basic/tallgrass',
    layer: 'ground',
    behavior: 'grass',
    draw(g, c) {
      const k = greens(c.season)
      g.rect(0, 0, 16, 16, k.dark)
      for (let x = 0; x < 16; x += 4) {
        g.vline(x + 1, 2, 7, k.base)
        g.vline(x + 3, 9, 14, k.base)
        g.px(x + 1, 1, k.light)
        g.px(x + 3, 8, k.light)
      }
    },
  },
  {
    id: 3,
    name: 'basic/path',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    connect: (o) => !!o && (o.name === 'basic/path' || o.name === 'basic/stone'),
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'dirt-1')
      if (c.variant) {
        g.px(4, 5, 'dirt-2')
        g.px(11, 10, 'dirt-2')
        g.px(9, 3, 'sand-2')
      } else {
        g.px(6, 12, 'dirt-2')
        g.px(12, 4, 'sand-2')
        g.px(2, 8, 'sand-2')
      }
      // 沒有接路的那一邊：草長進來一點
      const k = greens(c.season)
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 1, k.base)
        g.dither(0, 1, 16, 2, k.base, 8)
      }
      if (!(c.mask & 4)) {
        g.rect(0, 15, 16, 1, k.base)
        g.dither(0, 13, 16, 2, k.base, 8)
      }
      if (!(c.mask & 8)) {
        g.rect(0, 0, 1, 16, k.base)
        g.dither(1, 0, 2, 16, k.base, 8)
      }
      if (!(c.mask & 2)) {
        g.rect(15, 0, 1, 16, k.base)
        g.dither(13, 0, 2, 16, k.base, 8)
      }
    },
  },
  {
    id: 4,
    name: 'basic/stone',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'stone-1')
      // 兩排石板，接縫錯開
      g.hline(0, 15, 7, 'stone-2')
      g.hline(0, 15, 15, 'stone-2')
      g.vline(c.variant ? 5 : 10, 0, 6, 'stone-2')
      g.vline(c.variant ? 12 : 3, 8, 14, 'stone-2')
      g.px(c.variant ? 2 : 13, 2, 'white')
      g.px(c.variant ? 9 : 6, 11, 'stone-2')
    },
  },
  {
    id: 5,
    name: 'basic/water',
    layer: 'ground',
    behavior: 'water',
    frames: 4,
    fps: 2.5,
    connect: (o) => !!o && o.name === 'basic/water',
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'sea-2')
      const f = c.frame
      // 波紋往右漂
      for (const [x, y] of [[2, 3], [9, 7], [4, 11], [12, 13]] as const) {
        const xx = (x + f) % 16
        g.hline(xx, xx + 2, y, 'sea-1')
        g.px((xx + 8) % 16, (y + 2) % 16, 'sea-3')
      }
      // 岸：沒有接水的那一邊是沙與白浪
      if (!(c.mask & 1)) {
        g.rect(0, 0, 16, 2, 'sand-1')
        g.hline(0, 15, 2, f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 4)) {
        g.rect(0, 14, 16, 2, 'sand-2')
        g.hline(0, 15, 13, 'sea-3')
      }
      if (!(c.mask & 8)) {
        g.rect(0, 0, 2, 16, 'sand-1')
        g.vline(2, 0, 15, f % 2 ? 'foam' : 'sea-1')
      }
      if (!(c.mask & 2)) {
        g.rect(14, 0, 2, 16, 'sand-1')
        g.vline(13, 0, 15, f % 2 ? 'sea-1' : 'foam')
      }
    },
  },
  {
    id: 6,
    name: 'basic/sand',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'sand-1')
      g.px(c.variant ? 3 : 10, 4, 'sand-2')
      g.px(c.variant ? 12 : 5, 11, 'sand-2')
      g.px(c.variant ? 8 : 13, 14, 'white')
    },
  },
  {
    id: 7,
    name: 'basic/flowers',
    layer: 'ground',
    behavior: 'walk',
    frames: 2,
    fps: 2,
    variants: 2,
    draw(g, c) {
      grass(g, { ...c, variant: 1 })
      const pal: Record<Season, [Px, Px] | null> = {
        spring: ['sakura-1', 'white'],
        summer: ['lavender', 'gold-1'],
        autumn: ['momiji-1', 'gold-1'],
        winter: null,
      }
      const p = pal[c.season]
      const spots = c.variant ? [[3, 4], [10, 2], [7, 10], [13, 12]] : [[2, 9], [8, 4], [12, 9], [5, 13]]
      spots.forEach(([x, y], i) => {
        const sway = (c.frame + i) % 2
        if (!p) {
          // 冬天：枯了的莖
          g.vline(x!, y!, y! + 2, 'dirt-2')
          return
        }
        g.px(x!, y! + 2, 'leaf-3')
        const fx = x! + (sway ? 1 : 0)
        g.px(fx, y!, p[0])
        g.px(fx - 1, y! + 1, p[0])
        g.px(fx + 1, y! + 1, p[0])
        g.px(fx, y! + 1, p[1])
      })
    },
  },
  ...(['down', 'left', 'right'] as const).map(
    (d, i): TileDef => ({
      id: 8 + i,
      name: `basic/ledge-${d}`,
      layer: 'ground',
      behavior: `ledge-${d}`,
      draw(g, c) {
        const k = greens(c.season)
        grass(g, { ...c, variant: 2 })
        // 台階的邊：往下跳的那一邊是一道深色的坎
        // 台階：亮的邊、深色的坎面（直紋）、坎下的影子
        if (d === 'down') {
          g.hline(0, 15, 7, k.light)
          g.rect(0, 8, 16, 5, k.dark)
          for (let x = 1; x < 16; x += 3) g.vline(x, 9, 12, 'leaf-4')
          g.hline(0, 15, 13, 'leaf-4')
          g.dither(0, 14, 16, 2, 'leaf-4', 6)
        } else if (d === 'left') {
          g.vline(8, 0, 15, k.light)
          g.rect(3, 0, 5, 16, k.dark)
          for (let y = 1; y < 16; y += 3) g.hline(4, 7, y, 'leaf-4')
          g.vline(2, 0, 15, 'leaf-4')
          g.dither(0, 0, 2, 16, 'leaf-4', 6)
        } else {
          g.vline(7, 0, 15, k.light)
          g.rect(8, 0, 5, 16, k.dark)
          for (let y = 1; y < 16; y += 3) g.hline(8, 11, y, 'leaf-4')
          g.vline(13, 0, 15, 'leaf-4')
          g.dither(14, 0, 2, 16, 'leaf-4', 6)
        }
      },
    }),
  ),
  {
    id: 11,
    name: 'basic/floor',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'wood-1')
      for (let y = 3; y < 16; y += 4) g.hline(0, 15, y, 'wood-2')
      // 木板的接縫錯開
      const off = c.variant ? 4 : 10
      g.vline(off, 0, 2, 'wood-2')
      g.vline((off + 6) % 16, 4, 6, 'wood-2')
      g.vline((off + 3) % 16, 8, 10, 'wood-2')
      g.vline((off + 9) % 16, 12, 14, 'wood-2')
    },
  },
  {
    id: 12,
    name: 'basic/wall-in',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      g.rect(0, 0, 16, 16, 'paper')
      g.dither(0, 0, 16, 4, 'paper-2', 6)
      g.rect(0, 12, 16, 4, 'wood-2')
      g.hline(0, 15, 12, 'wood-3')
      g.hline(0, 15, 15, 'wood-3')
    },
  },
  {
    id: 13,
    name: 'basic/wall-in-top',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      g.rect(0, 0, 16, 16, 'paper-2')
      g.rect(0, 0, 16, 5, 'ink-2')
      g.hline(0, 15, 5, 'wood-3')
      g.dither(0, 6, 16, 4, 'paper', 8)
    },
  },
  {
    id: 14,
    name: 'basic/void',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      g.rect(0, 0, 16, 16, 'ink')
    },
  },
]

// ---------- 物件（lower：畫在角色下面） ----------
const LOWER: TileDef[] = [
  {
    id: 20,
    name: 'basic/wall',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && o.name === 'basic/wall',
    draw(g, c) {
      // 矮石牆：下面 11px，上面露出地面
      g.rect(0, 5, 16, 11, 'stone-2')
      g.hline(0, 15, 5, 'stone-1')
      g.hline(0, 15, 10, 'stone-3')
      g.vline(4, 6, 9, 'stone-3')
      g.vline(11, 11, 15, 'stone-3')
      g.hline(0, 15, 15, 'stone-4')
      if (!(c.mask & 8)) g.vline(0, 5, 15, 'stone-4')
      if (!(c.mask & 2)) g.vline(15, 5, 15, 'stone-4')
    },
  },
  {
    id: 21,
    name: 'basic/fence',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => !!o && o.name === 'basic/fence',
    draw(g, c) {
      const left = c.mask & 8 ? 0 : 3
      const right = c.mask & 2 ? 15 : 12
      g.rect(left, 6, right - left + 1, 2, 'wood-1')
      g.rect(left, 10, right - left + 1, 2, 'wood-1')
      g.hline(left, right, 8, 'wood-3')
      g.hline(left, right, 12, 'wood-3')
      for (const x of [3, 11]) {
        g.rect(x, 3, 2, 12, 'wood-2')
        g.vline(x + 2, 4, 14, 'wood-3')
        g.px(x, 3, 'wood-1')
      }
    },
  },
  {
    id: 22,
    name: 'basic/sign',
    layer: 'lower',
    behavior: 'sign',
    draw(g) {
      g.rect(7, 10, 2, 5, 'wood-2')
      g.vline(9, 10, 14, 'wood-3')
      g.rect(1, 2, 14, 9, 'wood-3')
      g.rect(2, 3, 12, 7, 'wood-1')
      g.hline(4, 11, 5, 'wood-2')
      g.hline(4, 9, 7, 'wood-2')
      g.dither(5, 14, 6, 2, 'ink-2', 6)
    },
  },
  {
    id: 23,
    name: 'basic/photo',
    layer: 'lower',
    behavior: 'photo',
    draw(g) {
      // 取景框的四個角
      const k: Px = 'shu-1'
      for (const [x, y, sx, sy] of [[2, 2, 1, 1], [13, 2, -1, 1], [2, 13, 1, -1], [13, 13, -1, -1]] as const) {
        g.px(x, y, k)
        g.px(x + sx, y, k)
        g.px(x + sx * 2, y, k)
        g.px(x, y + sy, k)
        g.px(x, y + sy * 2, k)
      }
      g.rect(7, 7, 2, 2, 'white')
    },
  },
  {
    id: 24,
    name: 'basic/door',
    layer: 'lower',
    behavior: 'door',
    draw(g) {
      g.rect(2, 0, 12, 16, 'wood-3')
      g.rect(3, 1, 10, 15, 'wood-2')
      g.vline(8, 1, 15, 'wood-3')
      g.px(6, 9, 'gold-1')
      g.px(10, 9, 'gold-1')
    },
  },
  {
    id: 25,
    name: 'basic/counter',
    layer: 'lower',
    behavior: 'counter',
    connect: (o) => !!o && o.name === 'basic/counter',
    draw(g, c) {
      g.rect(0, 2, 16, 5, 'wood-1')
      g.hline(0, 15, 2, 'paper')
      g.rect(0, 7, 16, 9, 'wood-2')
      g.hline(0, 15, 7, 'wood-3')
      g.vline(4, 8, 15, 'wood-3')
      g.vline(11, 8, 15, 'wood-3')
      if (!(c.mask & 8)) g.vline(0, 2, 15, 'wood-3')
      if (!(c.mask & 2)) g.vline(15, 2, 15, 'wood-3')
    },
  },
  {
    id: 26,
    name: 'basic/table',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      g.dither(2, 13, 12, 3, 'ink-2', 6)
      g.rect(2, 10, 2, 5, 'wood-3')
      g.rect(12, 10, 2, 5, 'wood-3')
      g.rect(0, 3, 16, 8, 'wood-3')
      g.rect(1, 4, 14, 6, 'wood-1')
      g.hline(1, 14, 4, 'paper')
      // 桌上的茶杯
      g.rect(6, 5, 3, 2, 'white')
      g.px(9, 5, 'stone-2')
    },
  },
  {
    id: 27,
    name: 'basic/shelf',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'wood-3')
      g.rect(1, 1, 14, 14, 'wood-2')
      for (const y of [5, 10]) g.hline(1, 14, y, 'wood-3')
      const goods: Px[] = c.variant ? ['gold-1', 'sea-2', 'shu-1', 'leaf-2', 'paper', 'momiji-1'] : ['shu-1', 'paper', 'leaf-2', 'gold-2', 'sea-1', 'sakura-2']
      goods.forEach((k, i) => {
        const row = Math.floor(i / 3)
        const col = i % 3
        g.rect(2 + col * 4, 2 + row * 5, 3, 3, k)
      })
      g.hline(2, 13, 13, 'wood-1')
    },
  },
  {
    id: 28,
    name: 'basic/mat',
    layer: 'lower',
    behavior: 'walk',
    draw(g) {
      g.rect(1, 4, 14, 10, 'cloth-2')
      g.frame(2, 5, 12, 8, 'cloth-1')
    },
  },
  {
    id: 29,
    name: 'basic/pot',
    layer: 'lower',
    behavior: 'block',
    draw(g, c) {
      const k = greens(c.season === 'winter' ? 'summer' : c.season)
      g.dither(3, 14, 10, 2, 'ink-2', 6)
      g.rect(4, 9, 8, 6, 'momiji-2')
      g.hline(3, 12, 9, 'wood-3')
      blob(g, 8, 6, 4, 4, k.base, 'leaf-4')
      g.px(6, 4, k.light)
    },
  },
]

// ---------- 上層（over：畫在角色前面） ----------
const OVER: TileDef[] = [
  {
    id: 40,
    name: 'basic/tallgrass-top',
    layer: 'over',
    draw(g, c) {
      // 草叢的草尖：蓋住腳
      const k = greens(c.season)
      for (let x = 0; x < 16; x += 4) {
        g.vline(x + 1, 11, 15, k.base)
        g.vline(x + 2, 12, 15, k.dark)
        g.px(x + 1, 10, k.light)
      }
    },
  },
]

// ---------- 大東西 ----------
/** 樹：上一格是樹冠（over，可以從後面走過），下一格是樹幹（lower，擋住） */
const TREE = bigTiles({
  id: 100,
  name: 'basic/tree',
  w: 1,
  h: 2,
  layer: (_x, y) => (y === 0 ? 'over' : 'lower'),
  behavior: (_x, y) => (y === 1 ? 'block' : undefined),
  draw(g, c) {
    const col: Record<Season, [Px, Px, Px, Px]> = {
      spring: ['leaf-2', 'leaf-3', 'leaf-1', 'leaf-4'],
      summer: ['leaf-3', 'leaf-4', 'leaf-2', 'ink-2'],
      autumn: ['momiji-1', 'momiji-2', 'gold-1', 'wood-3'],
      winter: ['leaf-3', 'leaf-4', 'snow-1', 'ink-2'],
    }
    const [body, shade, light, line] = col[c.season]
    // 影子、樹幹
    g.dither(2, 28, 12, 3, 'ink-2', 7)
    g.rect(6, 20, 4, 10, 'wood-2')
    g.vline(9, 20, 29, 'wood-3')
    g.vline(6, 22, 29, 'wood-1')
    // 樹冠：兩層圓
    blob(g, 8, 13, 7, 9, body, line)
    g.ellipse(9, 17, 5, 4, shade)
    g.ellipse(6, 9, 3, 3, light)
    g.ellipse(7, 10, 3, 3, body)
    if (c.season === 'winter') {
      // 樹冠上的雪
      g.hline(4, 11, 4, 'snow-1')
      g.hline(3, 6, 5, 'snow-2')
    }
  },
})

/** 房子 5×4：上兩列屋頂（over），下兩列牆（lower），門在 (2, 3) */
function house(id: number, name: string, roof: [Px, Px, Px], shop: boolean): TileDef[] {
  return bigTiles({
    id,
    name,
    w: 5,
    h: 4,
    layer: (_x, y) => (y < 2 ? 'over' : 'lower'),
    behavior: (x, y) => (x === 2 && y === 3 ? 'door' : 'block'),
    draw(g, c) {
      const [r1, r2, r3] = roof
      const night = c.time === 'night'
      // 牆
      g.rect(1, 30, 78, 34, 'paper')
      g.dither(1, 30, 78, 6, 'paper-2', 8)
      g.rect(1, 60, 78, 4, 'stone-2')
      g.hline(1, 78, 63, 'stone-4')
      g.vline(1, 30, 63, 'wood-3')
      g.vline(78, 30, 63, 'wood-3')
      for (const x of [26, 53]) g.rect(x, 30, 2, 30, 'wood-2')
      // 窗：夜裡亮燈
      for (const x of [8, 60]) {
        g.rect(x, 38, 12, 10, 'wood-3')
        g.rect(x + 1, 39, 10, 8, night ? 'lamp-1' : 'sky-day-2')
        g.vline(x + 6, 39, 46, 'wood-3')
        if (!night) g.px(x + 2, 40, 'white')
      }
      // 門
      g.rect(31, 42, 18, 22, 'wood-3')
      g.rect(33, 44, 14, 20, 'wood-2')
      g.vline(40, 44, 63, 'wood-3')
      g.px(38, 54, 'gold-1')
      g.px(42, 54, 'gold-1')
      if (shop) {
        // 店：門上掛布簾
        g.rect(30, 40, 20, 9, 'cloth-1')
        g.vline(36, 41, 48, 'cloth-2')
        g.vline(43, 41, 48, 'cloth-2')
        g.rect(38, 43, 4, 3, 'white')
      }
      // 屋頂
      g.poly([0, 34, 6, 6, 74, 6, 80, 34], 'ink-2')
      g.poly([1, 33, 7, 7, 73, 7, 79, 33], r1)
      for (let y = 11; y < 33; y += 5) g.hline(Math.round(6 - (y - 6) * 0.2), Math.round(74 + (y - 6) * 0.2), y, r2)
      g.rect(6, 4, 68, 4, r3)
      g.hline(6, 73, 4, 'ink-2')
      g.hline(0, 79, 34, 'ink-2')
      if (c.season === 'winter') {
        g.rect(8, 7, 64, 2, 'snow-1')
        g.dither(8, 9, 64, 2, 'snow-2', 8)
      }
    },
  })
}

const HOUSES = [...house(110, 'basic/house', ['roof-1', 'roof-2', 'roof-3'], false), ...house(130, 'basic/shop', ['wood-1', 'wood-2', 'wood-3'], true)]

export const BASIC_TILES: TileDef[] = [...GROUND, ...LOWER, ...OVER, ...TREE, ...HOUSES]
registerTileset('basic', BASIC_TILES)
