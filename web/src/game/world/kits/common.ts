import type { Gfx } from '../../../services/pixelwalk/gfx'
import type { Px } from '../../../services/pixelwalk/palette'

import { registerTileset } from '../../engine/tiles'
import type { TileCtx, TileDef } from '../../engine/types'

import { bevel, lantern, noren, shadow, shoji, speckle } from './draw'
import { defineObject, idRange } from './objects'

/**
 * 兩縣共用的室內 kit（id 3072–4095，名字 'world/…'）：
 * 地板（木、磁磚、疊、地毯）、牆（上緣、牆面、窗、時刻板、相框、掛軸、障子）、
 * 櫃台（木、白）、剪票口、售票機、站章台、賣店的架子、展示架（你的房間）、矮桌、坐墊、長椅、盆栽、
 * 廚房、桌子、被褥、書桌（印帳）、出口的門墊、上樓的樓梯、門口的暖簾、機場的櫃台與座位。
 * 室內一律白天的顏色（引擎）；窗戶照時段（白天藍、夜裡深）。
 */
const R = idRange(3072, 4095)

const FLOOR: TileDef[] = [
  {
    id: R.take(1),
    name: 'world/floor',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'wood-1')
      for (let y = 3; y < 16; y += 4) g.hline(0, 15, y, 'wood-2')
      const off = c.variant ? 4 : 10
      g.vline(off, 0, 2, 'wood-2')
      g.vline((off + 6) % 16, 4, 6, 'wood-2')
      g.vline((off + 3) % 16, 8, 10, 'wood-2')
      g.vline((off + 9) % 16, 12, 14, 'wood-2')
      g.px((off + 2) % 16, 1, 'sand-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/tile',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      // 車站、機場的磁磚：大方塊、接縫、一點反光
      g.rect(0, 0, 16, 16, 'paper')
      g.hline(0, 15, 15, 'paper-2')
      g.vline(15, 0, 15, 'paper-2')
      g.hline(0, 14, 0, 'white')
      g.vline(0, 0, 14, 'white')
      if (c.variant) g.px(4, 5, 'white')
      else speckle(g, 2, 2, 12, 12, 'paper-2', 0.03, 3)
    },
  },
  {
    id: R.take(1),
    name: 'world/tatami',
    layer: 'ground',
    behavior: 'walk',
    variants: 2,
    draw(g, c) {
      // 疊：草蓆的細紋、深色的布邊（兩種方向交錯）
      g.rect(0, 0, 16, 16, 'tatami-1')
      if (c.variant) {
        for (let x = 1; x < 16; x += 2) g.vline(x, 0, 15, 'tatami-2')
        g.rect(0, 0, 16, 2, 'leaf-4')
      } else {
        for (let y = 1; y < 16; y += 2) g.hline(0, 15, y, 'tatami-2')
        g.rect(0, 0, 2, 16, 'leaf-4')
      }
    },
  },
  {
    id: R.take(1),
    name: 'world/carpet',
    layer: 'ground',
    behavior: 'walk',
    draw(g) {
      g.rect(0, 0, 16, 16, 'cloth-2')
      g.dither(0, 0, 16, 16, 'cloth-1', 4)
      g.px(3, 4, 'cloth-1')
      g.px(11, 12, 'cloth-1')
    },
  },
  {
    id: R.take(1),
    name: 'world/wall-top',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      g.rect(0, 0, 16, 16, 'paper-2')
      g.rect(0, 0, 16, 6, 'ink-2')
      g.hline(0, 15, 6, 'wood-3')
      g.dither(0, 7, 16, 4, 'paper', 8)
    },
  },
  {
    id: R.take(1),
    name: 'world/wall',
    layer: 'ground',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      g.rect(0, 0, 16, 16, 'paper')
      g.dither(0, 0, 16, 4, 'paper-2', 6)
      g.rect(0, 11, 16, 5, 'wood-2')
      g.hline(0, 15, 11, 'wood-1')
      g.hline(0, 15, 15, 'wood-3')
      if (c.variant) g.vline(8, 11, 15, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/wall-shoji',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      g.rect(0, 0, 16, 16, 'wood-2')
      shoji(g, 1, 0, 14, 13, 'wood-3', 'white')
      g.rect(0, 13, 16, 3, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/wall-window',
    layer: 'ground',
    behavior: 'block',
    draw(g, c) {
      // 牆上的窗：時段照外面（室內是白天的調色盤，所以夜裡用深的天空色）
      g.rect(0, 0, 16, 16, 'paper')
      g.rect(0, 11, 16, 5, 'wood-2')
      g.hline(0, 15, 11, 'wood-1')
      g.rect(2, 1, 12, 9, 'wood-3')
      const sky: Px = c.time === 'night' ? 'sky-night-2' : c.time === 'dusk' ? 'sky-dusk-3' : 'sky-day-2'
      g.rect(3, 2, 10, 7, sky)
      g.vline(8, 2, 8, 'wood-3')
      if (c.time === 'day') {
        g.px(4, 3, 'white')
        g.px(5, 3, 'white')
      } else if (c.time === 'night') g.px(11, 3, 'star')
    },
  },
  {
    id: R.take(1),
    name: 'world/wall-board',
    layer: 'ground',
    behavior: 'block',
    connect: (o) => o?.name === 'world/wall-board',
    draw(g, c) {
      // 時刻板（不寫字、不寫時間：一排一排的燈點）
      g.rect(0, 0, 16, 16, 'paper')
      g.rect(0, 1, 16, 10, 'ink')
      g.hline(0, 15, 1, 'stone-3')
      g.hline(0, 15, 10, 'stone-3')
      for (const y of [3, 5, 7]) for (let x = 2; x < 15; x += 3) g.hline(x, x + 1, y, (x + y) % 4 ? 'lamp-2' : 'lamp-1')
      if (!(c.mask & 8)) g.vline(0, 1, 10, 'stone-3')
      if (!(c.mask & 2)) g.vline(15, 1, 10, 'stone-3')
      g.rect(0, 11, 16, 5, 'stone-2')
      g.hline(0, 15, 11, 'stone-1')
    },
  },
  {
    id: R.take(1),
    name: 'world/wall-frame',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      // 你的房間的相框位（空的框；照片由系統畫）
      g.rect(0, 0, 16, 16, 'paper')
      g.dither(0, 0, 16, 4, 'paper-2', 6)
      g.rect(0, 11, 16, 5, 'wood-2')
      g.hline(0, 15, 11, 'wood-1')
      g.rect(3, 1, 10, 9, 'wood-3')
      g.rect(4, 2, 8, 7, 'paper-2')
      g.frame(4, 2, 8, 7, 'wood-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/wall-scroll',
    layer: 'ground',
    behavior: 'block',
    draw(g) {
      // 床の間的掛軸（墨的幾筆，不寫字）
      g.rect(0, 0, 16, 16, 'paper-2')
      g.rect(5, 0, 6, 13, 'paper')
      g.frame(4, 0, 8, 13, 'leaf-4')
      g.line(7, 3, 9, 6, 'ink-2')
      g.line(8, 7, 7, 10, 'ink-2')
      g.rect(4, 13, 8, 2, 'wood-3')
      g.rect(0, 14, 16, 2, 'wood-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/mat',
    layer: 'ground',
    behavior: 'walk',
    draw(g) {
      // 出口的門墊（室內往下走就出去）
      g.rect(0, 0, 16, 16, 'wood-1')
      g.hline(0, 15, 3, 'wood-2')
      g.hline(0, 15, 11, 'wood-2')
      g.rect(1, 4, 14, 10, 'cloth-2')
      g.frame(2, 5, 12, 8, 'cloth-1')
      g.hline(4, 11, 9, 'cloth-1')
    },
  },
]

const FURNITURE: TileDef[] = [
  {
    id: R.take(1),
    name: 'world/counter',
    layer: 'lower',
    behavior: 'counter',
    connect: (o) => o?.name === 'world/counter',
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
    id: R.take(1),
    name: 'world/counter-white',
    layer: 'lower',
    behavior: 'counter',
    connect: (o) => o?.name === 'world/counter-white',
    draw(g, c) {
      // 機場、車站的櫃台：白的檯面、深藍的板
      g.rect(0, 2, 16, 5, 'white')
      g.hline(0, 15, 6, 'stone-2')
      g.rect(0, 7, 16, 9, 'cloth-2')
      g.hline(0, 15, 7, 'roof-3')
      g.hline(0, 15, 10, 'cloth-1')
      if (!(c.mask & 8)) g.vline(0, 2, 15, 'roof-3')
      if (!(c.mask & 2)) g.vline(15, 2, 15, 'roof-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/gate',
    layer: 'lower',
    behavior: 'counter',
    connect: (o) => o?.name === 'world/gate',
    draw(g) {
      // 剪票口：一排機器（灰的機身、藍的票口、綠燈），中間是窄的通道
      g.rect(1, 3, 6, 12, 'stone-1')
      g.rect(9, 3, 6, 12, 'stone-1')
      for (const x of [1, 9]) {
        g.hline(x, x + 5, 3, 'white')
        g.vline(x + 5, 3, 14, 'stone-3')
        g.hline(x, x + 5, 14, 'stone-3')
        g.rect(x + 1, 6, 4, 2, 'cloth-1')
        g.px(x + 4, 4, 'leaf-1')
      }
      g.rect(7, 8, 2, 2, 'shu-2')
      shadow(g, 8, 15, 7, 1)
    },
  },
  {
    id: R.take(1),
    name: 'world/ticket',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 售票機
      g.rect(1, 1, 14, 14, 'stone-3')
      g.rect(2, 2, 12, 12, 'stone-1')
      g.rect(3, 3, 10, 5, 'sea-3')
      g.dither(3, 3, 10, 5, 'sea-2', 6)
      for (let x = 3; x < 13; x += 3) g.rect(x, 9, 2, 2, 'white')
      g.rect(4, 12, 8, 1, 'ink-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/stamp-table',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 站章台、印台：小桌、印、紅的印泥
      shadow(g, 8, 15, 6, 1)
      g.rect(1, 5, 14, 6, 'wood-3')
      g.rect(2, 5, 12, 4, 'wood-1')
      g.hline(2, 13, 5, 'paper')
      g.rect(3, 11, 2, 4, 'wood-3')
      g.rect(11, 11, 2, 4, 'wood-3')
      g.rect(4, 3, 3, 4, 'wood-2')
      g.rect(4, 6, 3, 1, 'shu-2')
      g.rect(9, 5, 4, 2, 'shu-1')
      g.frame(8, 4, 6, 4, 'ink-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/goods',
    layer: 'lower',
    behavior: 'block',
    variants: 2,
    draw(g, c) {
      // 賣店的架子：一格一格的小盒子（顏色是遊戲自己的，不代表真的商品）
      g.rect(0, 0, 16, 16, 'wood-3')
      g.rect(1, 1, 14, 14, 'wood-2')
      for (const y of [5, 10]) g.hline(1, 14, y, 'wood-3')
      const goods: Px[] = c.variant ? ['gold-1', 'sea-2', 'shu-1', 'leaf-2', 'paper', 'momiji-1'] : ['shu-1', 'paper', 'leaf-2', 'gold-2', 'sea-1', 'sakura-2']
      goods.forEach((k, i) => {
        const row = Math.floor(i / 3)
        const col = i % 3
        g.rect(2 + col * 4, 2 + row * 5, 3, 3, k)
        g.px(2 + col * 4, 2 + row * 5, 'white')
      })
      g.hline(2, 13, 13, 'wood-1')
    },
  },
  {
    id: R.take(1),
    name: 'world/display',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 你的房間的展示架（一格放一樣東西；東西由系統畫）
      shadow(g, 8, 15, 7, 1)
      g.rect(1, 2, 14, 13, 'wood-3')
      g.rect(2, 3, 12, 9, 'wood-2')
      g.dither(2, 3, 12, 3, 'wood-3', 8)
      g.rect(1, 12, 14, 3, 'wood-1')
      g.hline(1, 14, 12, 'paper-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/table',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      shadow(g, 8, 15, 7, 1)
      g.rect(2, 10, 2, 5, 'wood-3')
      g.rect(12, 10, 2, 5, 'wood-3')
      g.rect(0, 3, 16, 8, 'wood-3')
      g.rect(1, 4, 14, 6, 'wood-1')
      g.hline(1, 14, 4, 'paper')
      g.rect(6, 5, 3, 2, 'white')
      g.px(9, 5, 'stone-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/table-low',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // ちゃぶ台：圓的矮桌、茶杯
      shadow(g, 8, 14, 7, 2)
      g.ellipse(8, 8, 7, 4, 'wood-3')
      g.ellipse(8, 7, 6, 3, 'wood-1')
      g.hline(4, 9, 5, 'paper')
      g.rect(6, 6, 2, 2, 'leaf-3')
      g.px(10, 7, 'white')
      g.rect(4, 11, 2, 3, 'wood-3')
      g.rect(10, 11, 2, 3, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/zabuton',
    layer: 'lower',
    behavior: 'walk',
    draw(g) {
      g.rect(3, 5, 10, 8, 'shu-2')
      g.rect(4, 6, 8, 6, 'shu-1')
      g.px(8, 9, 'gold-1')
    },
  },
  {
    id: R.take(1),
    name: 'world/bench',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'world/bench',
    draw(g, c) {
      // 候車的長椅
      const l = c.mask & 8 ? 0 : 1
      const r = c.mask & 2 ? 15 : 14
      shadow(g, 8, 14, 7, 1)
      g.rect(l, 4, r - l + 1, 4, 'cloth-1')
      g.hline(l, r, 4, 'sky-day-3')
      g.rect(l, 8, r - l + 1, 3, 'cloth-2')
      if (!(c.mask & 8)) g.rect(2, 11, 2, 3, 'stone-3')
      if (!(c.mask & 2)) g.rect(12, 11, 2, 3, 'stone-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/plant',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      shadow(g, 8, 15, 5, 1)
      g.rect(5, 10, 6, 5, 'kawara-2')
      g.hline(4, 11, 10, 'kawara-3')
      g.ellipse(8, 6, 5, 4, 'leaf-4')
      g.ellipse(8, 6, 4, 3, 'leaf-2')
      g.px(6, 4, 'leaf-1')
      g.px(10, 5, 'leaf-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/kitchen',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'world/kitchen',
    draw(g) {
      // 食堂的廚房（櫃台後面）：灶台、鍋、碗
      g.rect(0, 2, 16, 14, 'stone-2')
      g.hline(0, 15, 2, 'stone-1')
      g.rect(0, 9, 16, 7, 'stone-3')
      g.rect(3, 3, 7, 5, 'ink-2')
      g.rect(4, 2, 5, 2, 'stone-4')
      g.px(6, 1, 'white')
      g.rect(11, 4, 4, 3, 'white')
      g.hline(11, 14, 6, 'stone-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/futon',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      g.rect(1, 1, 14, 14, 'white')
      g.rect(1, 6, 14, 9, 'cloth-1')
      g.dither(1, 6, 14, 9, 'cloth-2', 4)
      g.rect(3, 2, 10, 3, 'paper')
      g.hline(1, 14, 15, 'stone-2')
    },
  },
  {
    id: R.take(1),
    name: 'world/desk',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 書桌＋桌上的印帳（蛇腹帳的樣子）
      shadow(g, 8, 15, 7, 1)
      g.rect(0, 3, 16, 9, 'wood-3')
      g.rect(1, 4, 14, 6, 'wood-1')
      g.hline(1, 14, 4, 'paper')
      g.rect(4, 5, 8, 4, 'roof-3')
      g.rect(5, 5, 6, 3, 'shu-2')
      g.hline(5, 10, 6, 'gold-1')
      g.rect(1, 12, 2, 3, 'wood-3')
      g.rect(13, 12, 2, 3, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/stairs',
    layer: 'lower',
    behavior: 'door',
    draw(g) {
      // 往上的樓梯（旅館、民宿進你的房間）
      for (let i = 0; i < 4; i++) {
        bevel(g, 1, 12 - i * 4, 14, 4, 'wood-1', 'paper', 'wood-3')
      }
      g.vline(0, 0, 15, 'wood-3')
      g.vline(15, 0, 15, 'wood-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/noren-door',
    layer: 'lower',
    behavior: 'door',
    draw(g) {
      // 室內的門口：暖簾
      g.rect(0, 0, 16, 16, 'ink-2')
      noren(g, 1, 0, 14, 10, 'cloth-2', 'roof-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/seat',
    layer: 'lower',
    behavior: 'block',
    connect: (o) => o?.name === 'world/seat',
    draw(g) {
      // 機場的座位：一排藍色的椅子
      shadow(g, 8, 15, 7, 1)
      for (const x of [1, 9]) {
        g.rect(x, 3, 6, 6, 'cloth-1')
        g.hline(x, x + 5, 3, 'sky-day-3')
        g.rect(x, 9, 6, 3, 'cloth-2')
      }
      g.rect(0, 12, 16, 2, 'stone-3')
    },
  },
  {
    id: R.take(1),
    name: 'world/lamp',
    layer: 'lower',
    behavior: 'block',
    draw(g) {
      // 行燈（旅館）
      shadow(g, 8, 15, 4, 1)
      g.rect(5, 4, 6, 9, 'wood-3')
      g.rect(6, 5, 4, 7, 'lamp-1')
      g.hline(6, 9, 8, 'wood-2')
      g.rect(4, 13, 8, 2, 'wood-3')
      lantern(g, 13, 0, false, 'wood-1')
    },
  },
]

const OBJECTS: TileDef[] = [
  ...defineObject({
    id: R.take(2),
    name: 'world/tokonoma',
    w: 2,
    h: 1,
    cells: ['LL'],
    draw(g) {
      // 床の間：一段高的木台、花瓶
      g.rect(0, 6, 32, 10, 'wood-2')
      g.hline(0, 31, 6, 'wood-1')
      g.rect(0, 14, 32, 2, 'wood-3')
      g.rect(20, 1, 4, 6, 'roof-2')
      g.line(22, 1, 19, -3, 'leaf-3')
      g.px(22, 0, 'shu-1')
    },
  }),
]

/** 窗外的海與飛機（機場大廳的大窗：給一點點動的） */
function bigWindow(g: Gfx, c: TileCtx) {
  const sky: Px = c.time === 'night' ? 'sky-night-2' : c.time === 'dusk' ? 'sky-dusk-2' : 'sky-day-1'
  g.rect(0, 0, 16, 16, 'stone-3')
  g.rect(0, 1, 16, 11, sky)
  g.dither(0, 8, 16, 4, c.time === 'night' ? 'sky-night-1' : 'sky-day-2', 6)
  g.vline(15, 1, 11, 'stone-2')
  g.rect(0, 12, 16, 4, 'stone-2')
  g.hline(0, 15, 12, 'stone-1')
}

const WINDOWS: TileDef[] = [{ id: R.take(1), name: 'world/wall-glass', layer: 'ground', behavior: 'block', draw: bigWindow }]

const BOARDS: TileDef[] = [
  {
    id: R.take(1),
    name: 'world/info-board',
    layer: 'lower',
    behavior: 'sign',
    draw(g) {
      // 室內的立牌（車站大廳裡的觀光案內所）：兩根細腳、上緣一條色帶、白板上幾行灰線（不寫字）
      shadow(g, 8, 15, 5, 1)
      g.rect(4, 11, 1, 4, 'stone-3')
      g.rect(11, 11, 1, 4, 'stone-3')
      g.rect(2, 2, 12, 10, 'ink-2')
      g.rect(3, 3, 10, 8, 'white')
      g.rect(3, 3, 10, 2, 'cloth-2')
      g.hline(4, 11, 6, 'stone-2')
      g.hline(4, 11, 8, 'stone-2')
      g.hline(4, 8, 10, 'stone-2')
    },
  },
]

export const COMMON_TILES: TileDef[] = [...FLOOR, ...FURNITURE, ...OBJECTS, ...WINDOWS, ...BOARDS]
registerTileset('world', COMMON_TILES)
