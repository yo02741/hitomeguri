import { drawSprite } from '../../services/pixelwalk/build'
import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Sprite } from '../../services/pixelwalk/sprite'

import { sheetLook } from '../engine/looks'
import type { ActorLook, Dir, Pose } from '../engine/types'

/**
 * 夥伴的佔位（P0）：小柴犬，約 14px。正面、背面、側面（右用左翻）× 站、左腳、右腳。P1 換成生成的夥伴。
 */
const W = 16
const H = 14

function front(g: Gfx, pose: Pose, back: boolean) {
  // 腳
  const lift = (s: 0 | 1) => ((pose === 'stepL' && s === 0) || (pose === 'stepR' && s === 1) ? 1 : 0)
  g.rect(5, 10, 2, 4 - lift(0), 'wood-2')
  g.rect(9, 10, 2, 4 - lift(1), 'wood-2')
  // 身體
  g.rect(4, 7, 8, 5, 'wood-1')
  if (!back) g.rect(6, 8, 4, 3, 'paper')
  // 頭與耳朵
  g.rect(3, 2, 10, 6, 'wood-1')
  g.rect(3, 0, 2, 2, 'wood-2')
  g.rect(11, 0, 2, 2, 'wood-2')
  if (back) {
    // 捲起來的尾巴
    g.rect(6, 6, 4, 3, 'wood-1')
    g.rect(7, 6, 2, 2, 'paper')
    return
  }
  g.rect(5, 5, 6, 3, 'paper')
  g.px(5, 4, 'ink')
  g.px(10, 4, 'ink')
  g.rect(7, 5, 2, 1, 'ink')
}

function side(g: Gfx, pose: Pose) {
  // 四隻腳：走路時前後張開
  const legs = pose === 'stand' ? [5, 7, 10, 12] : pose === 'stepL' ? [4, 7, 9, 12] : [5, 8, 10, 13]
  for (const x of legs) g.rect(x, 11, 1, 3, 'wood-2')
  // 身體、肚子
  g.rect(4, 6, 10, 5, 'wood-1')
  g.rect(5, 10, 8, 1, 'paper')
  // 尾巴（捲在背上）
  g.rect(12, 3, 3, 3, 'wood-1')
  g.px(13, 4, 'paper')
  // 頭（朝左）
  g.rect(1, 2, 6, 6, 'wood-1')
  g.rect(0, 5, 3, 3, 'paper')
  g.px(0, 5, 'ink')
  g.px(3, 4, 'ink')
  g.rect(4, 0, 2, 2, 'wood-2')
}

const mk = (dir: Exclude<Dir, 'right'>, pose: Pose): Sprite => drawSprite(W + 2, H + 2, (g) => g.at(1, 1, () => (dir === 'left' ? side(g, pose) : front(g, pose, dir === 'up'))))
const row = (dir: Exclude<Dir, 'right'>): [Sprite, Sprite, Sprite] => [mk(dir, 'stand'), mk(dir, 'stepL'), mk(dir, 'stepR')]

export function shibaLook(): ActorLook {
  return sheetLook({ down: row('down'), up: row('up'), left: row('left') }, { ax: (W + 2) / 2, ay: H + 2, shadow: 10 })
}
