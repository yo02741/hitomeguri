import { drawSprite } from '../../services/pixelwalk/build'
import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Px } from '../../services/pixelwalk/palette'
import type { Sprite } from '../../services/pixelwalk/sprite'

import { type Sheet, sheetLook } from '../engine/looks'
import type { ActorLook, Dir, Pose } from '../engine/types'

/**
 * 手畫的人（P0 的預設旅人、路人、店員）：每格畫布 32×40，本體約 18×29（含外框），腳底在最下面一列。
 * 方向：下、上、左（右用左翻）× 站、左腳、右腳。走路時身體上移 1px、抬起的腳再上移 1px；側面腿張開。
 * 正面、背面先畫左半邊再左右對稱，臉、相機、腳這些不對稱的最後畫。外框由 drawSprite 自動描。
 */
export const W = 32
export const H = 40

export interface PersonStyle {
  skin: Px
  hair: Px
  hairStyle: 'bob' | 'short' | 'bun' | 'long'
  top: Px
  topShade: Px
  bottom: Px
  legs: Px
  shoes: Px
  hat?: { kind: 'bucket' | 'cap' | 'scarf'; color: Px; shade: Px }
  apron?: Px
  camera?: boolean
}

/** 把左半邊（x 0–15）左右對稱貼到右半邊 */
function mirrorHalf(g: Gfx) {
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < W / 2; x++) {
      const v = g.buf[y * g.w + x]!
      if (v) g.buf[y * g.w + (W - 1 - x)] = v
    }
}

/** 左半邊的一列：x0–15 */
const half = (g: Gfx, y: number, x0: number, k: Px) => g.hline(x0, 15, y, k)

function hairBack(g: Gfx, st: PersonStyle, b: number) {
  const k = st.hair
  half(g, 14 + b, 12, k)
  half(g, 15 + b, 10, k)
  half(g, 16 + b, 9, k)
  const end = st.hairStyle === 'long' ? 31 : st.hairStyle === 'bob' ? 27 : 22
  for (let y = 17; y <= end; y++) half(g, y + b, 8, k)
  if (st.hairStyle === 'bob') half(g, 28 + b, 8, k)
  if (st.hairStyle === 'bun') {
    g.rect(13, 10 + b, 3, 4, k)
    g.rect(12, 11 + b, 1, 2, k)
  }
}

function hat(g: Gfx, st: PersonStyle, b: number, side: boolean) {
  const h = st.hat
  if (!h) return
  if (h.kind === 'scarf') {
    // 頭巾：頭頂一條布
    if (side) g.rect(9, 14 + b, 12, 4, h.color)
    else {
      half(g, 14 + b, 11, h.color)
      for (let y = 15; y <= 17; y++) half(g, y + b, 9, h.color)
      half(g, 17 + b, 9, h.shade)
    }
    return
  }
  if (side) {
    g.rect(12, 11 + b, 6, 1, h.color)
    g.rect(10, 12 + b, 10, 4, h.color)
    g.hline(10, 19, 15 + b, h.shade)
    if (h.kind === 'bucket') g.rect(6, 16 + b, 15, 2, h.shade)
    else g.rect(5, 16 + b, 8, 1, h.shade) // 帽舌往前
    return
  }
  half(g, 11 + b, 12, h.color)
  for (let y = 12; y <= 15; y++) half(g, y + b, 10, h.color)
  half(g, 15 + b, 10, h.shade)
  if (h.kind === 'bucket') {
    half(g, 16 + b, 7, h.shade)
    half(g, 17 + b, 7, h.shade)
  } else half(g, 16 + b, 9, h.shade)
}

function front(g: Gfx, st: PersonStyle, pose: Pose, back: boolean) {
  const b = pose === 'stand' ? 0 : -1
  hairBack(g, st, b)
  if (back) {
    // 後腦勺：短髮也整顆是頭髮，下面露一點脖子
    for (let y = 17; y <= 26; y++) half(g, y + b, 9, st.hair)
    half(g, 27 + b, 11, st.hair)
  } else {
    // 臉
    for (let y = 19; y <= 26; y++) half(g, y + b, 10, st.skin)
    half(g, 27 + b, 11, st.skin)
    // 瀏海
    half(g, 17 + b, 9, st.hair)
    half(g, 18 + b, 9, st.hair)
    g.px(10, 19 + b, st.hair)
  }
  // 脖子、身體、袖子、手
  half(g, 28 + b, 14, st.skin)
  for (let y = 29; y <= 34; y++) half(g, y + b, 10, st.top)
  g.vline(10, 29 + b, 34 + b, st.topShade)
  g.rect(8, 29 + b, 2, 3, st.top)
  g.rect(8, 32 + b, 2, 3, st.skin)
  if (st.apron && !back) for (let y = 31; y <= 36; y++) half(g, y + b, 11, st.apron)
  for (let y = 35; y <= 36; y++) half(g, y + b, 11, st.bottom)
  if (st.hairStyle === 'long' && back) for (let y = 29; y <= 31; y++) half(g, y + b, 10, st.hair)
  hat(g, st, b, false)
  mirrorHalf(g)
  if (!back) {
    // 眼睛、腮紅
    g.vline(12, 21 + b, 22 + b, 'ink')
    g.vline(19, 21 + b, 22 + b, 'ink')
    g.px(11, 24 + b, 'sakura-2')
    g.px(20, 24 + b, 'sakura-2')
    if (st.camera) {
      // 胸前的相機與背帶
      g.line(10, 29 + b, 13, 31 + b, 'ink-2')
      g.line(21, 29 + b, 18, 31 + b, 'ink-2')
      g.rect(13, 31 + b, 6, 3, 'stone-4')
      g.rect(15, 32 + b, 2, 1, 'sea-2')
      g.px(14, 31 + b, 'stone-2')
    }
  } else if (st.camera) g.line(11, 29 + b, 20, 34 + b, 'ink-2')
  // 腳：抬起的那隻往上 2px（身體 1px＋腳 1px）
  for (const s of [0, 1] as const) {
    const x = s === 0 ? 12 : 17
    const up = (pose === 'stepL' && s === 0) || (pose === 'stepR' && s === 1) ? 2 : 0
    const shoe = 39 - up
    g.rect(x, 37 + b, 3, shoe - (37 + b), st.legs)
    g.rect(s === 0 ? x - 1 : x, shoe, 4, 1, st.shoes)
  }
}

function side(g: Gfx, st: PersonStyle, pose: Pose) {
  const b = pose === 'stand' ? 0 : -1
  const k = st.hair
  // 頭（朝左）、鼻子
  g.rect(8, 19 + b, 13, 8, st.skin)
  g.rect(9, 27 + b, 5, 1, st.skin)
  g.px(7, 23 + b, st.skin)
  // 頭髮：頭頂、後腦（右邊）、瀏海
  g.rect(12, 14 + b, 7, 1, k)
  g.rect(10, 15 + b, 11, 2, k)
  g.rect(9, 17 + b, 13, 2, k)
  const end = st.hairStyle === 'long' ? 31 : st.hairStyle === 'bob' ? 28 : 25
  g.rect(15, 19 + b, 7, end - 18, k)
  if (st.hairStyle === 'bun') g.rect(19, 11 + b, 4, 4, k)
  g.rect(8, 17 + b, 8, 2, k)
  g.vline(10, 21 + b, 22 + b, 'ink')
  g.px(11, 24 + b, 'sakura-2')
  // 身體
  g.rect(13, 28 + b, 3, 1, st.skin)
  g.rect(11, 29 + b, 9, 6, st.top)
  g.vline(19, 29 + b, 34 + b, st.topShade)
  if (st.apron) g.rect(10, 31 + b, 6, 6, st.apron)
  g.rect(12, 35 + b, 8, 2, st.bottom)
  hat(g, st, b, true)
  // 手：走路時前後擺
  const ax = pose === 'stepL' ? 12 : pose === 'stepR' ? 16 : 14
  g.rect(ax, 29 + b, 3, 4, st.topShade)
  g.rect(ax, 33 + b, 3, 2, st.skin)
  if (st.camera) {
    g.rect(8, 31 + b, 4, 3, 'stone-4')
    g.px(7, 32 + b, 'sea-2')
    g.line(12, 29 + b, 10, 31 + b, 'ink-2')
  }
  // 腳：站著併攏；走路時最下面 3 列前後張開
  if (pose === 'stand') {
    g.rect(14, 37, 4, 2, st.legs)
    g.rect(13, 39, 5, 1, st.shoes)
  } else {
    g.rect(13, 37 + b, 4, 1, st.legs)
    g.rect(12, 37, 3, 2, st.legs)
    g.rect(17, 37, 3, 2, st.legs)
    g.rect(11, 39, 4, 1, st.shoes)
    g.rect(17, 39, 4, 1, st.shoes)
  }
}

export function personSprite(st: PersonStyle, dir: Exclude<Dir, 'right'>, pose: Pose): Sprite {
  // 往上挪 1px：最下面一列留給腳底的外框
  return drawSprite(W, H, (g) => g.at(0, -1, () => (dir === 'left' ? side(g, st, pose) : front(g, st, pose, dir === 'up'))))
}

/** 一個人的整組 sprite → ActorLook */
export function personLook(st: PersonStyle): ActorLook {
  const row = (dir: Exclude<Dir, 'right'>): [Sprite, Sprite, Sprite] => [personSprite(st, dir, 'stand'), personSprite(st, dir, 'stepL'), personSprite(st, dir, 'stepR')]
  const sheet: Sheet<Sprite> = { down: row('down'), up: row('up'), left: row('left') }
  return sheetLook(sheet, { ax: W / 2, ay: H, shadow: 14 })
}
