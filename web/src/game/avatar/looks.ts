import { sheetLook } from '../engine/looks'
import type { ActorLook, Dir, LookFrame, Pose } from '../engine/types'

import { topRow } from './pixelize'
import type { Facing, GameRecord, RgbFrame } from './types'

/**
 * 生成的一組 → 引擎的 ActorLook（engine/looks.ts）：
 * - 旅人：下、上、左 × 站、左步、右步（右邊用左邊翻，左右腳跟著換），錨點在畫布下緣中間；
 *   有頭頂的傘就每格疊一個 extra（跟著那一格的頭頂高低，邁步時一起上下）。
 * - 夥伴：四個方向共用一張，左右照原本朝向翻；走路時「站、步、站、步」的步那一格往上 1px（每 4 格跳 1px）。
 */
export function travellerLook(r: GameRecord): ActorLook {
  const base = sheetLook({ down: r.down, up: r.up, left: r.left }, { ax: r.w / 2, ay: r.h, shadow: 12 })
  const o = r.overhead
  if (!o) return base
  const tops = new Map<RgbFrame, number>()
  const memo = new Map<string, LookFrame>()
  return {
    shadow: base.shadow,
    frame(dir: Dir, pose: Pose): LookFrame {
      const k = `${dir}:${pose}`
      let f = memo.get(k)
      if (f) return f
      const b = base.frame(dir, pose)
      const s = b.sprite as RgbFrame
      let t = tops.get(s)
      if (t === undefined) {
        t = topRow(s.idx, s.w, s.h, 0)
        tops.set(s, t)
      }
      const x = b.flip ? r.w - o.x - o.sprite.w : o.x
      f = { ...b, extra: [{ sprite: o.sprite, x, y: t + o.dy }] }
      memo.set(k, f)
      return f
    },
  }
}

/** 夥伴往 dir 走時要不要左右翻 */
export function buddyFlip(facing: Facing, dir: Dir): boolean {
  if (facing === 'left') return dir === 'right'
  if (facing === 'right') return dir === 'left'
  return dir === 'left'
}

export function buddyLook(b: { sprite: RgbFrame; facing: Facing }): ActorLook {
  const s = b.sprite
  const memo = new Map<string, LookFrame>()
  return {
    shadow: Math.max(6, s.w - 4),
    frame(dir: Dir, pose: Pose): LookFrame {
      const k = `${dir}:${pose}`
      let f = memo.get(k)
      if (!f) {
        f = { sprite: s, ax: Math.floor(s.w / 2), ay: s.h + (pose === 'stand' ? 0 : 1), flip: buddyFlip(b.facing, dir) }
        memo.set(k, f)
      }
      return f
    },
  }
}
