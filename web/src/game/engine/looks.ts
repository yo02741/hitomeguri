import type { Sprite } from '../../services/pixelwalk/sprite'

import type { ActorLook, AnySprite, Dir, LookFrame, Pose } from './types'

/**
 * 角色外觀：registerLook 註冊（sprites/ 的預設旅人、柴犬、路人；P1 換成生成的旅人），NPC 的 data.look 指到 id。
 * sheetLook 把「下、上、左（右用左翻過來）× 站、左腳、右腳」的 sprite 組成 ActorLook。
 */
const looks = new Map<string, ActorLook>()

export function registerLook(id: string, look: ActorLook) {
  looks.set(id, look)
}
export const lookIds = () => [...looks.keys()]

/** 沒有這個 id 時用的（不讓遊戲起不來）：一個墨色的小剪影 */
const PLACEHOLDER: Sprite = { w: 8, h: 12, keys: ['ink-2'], idx: new Uint8Array(8 * 12).fill(1) }
const placeholder: ActorLook = { frame: () => ({ sprite: PLACEHOLDER, ax: 4, ay: 12 }) }

export function lookOf(id: string | undefined): ActorLook {
  return (id && looks.get(id)) || placeholder
}

export interface Sheet<S extends AnySprite = AnySprite> {
  down: [S, S, S]
  up: [S, S, S]
  left: [S, S, S]
  /** 沒有就用 left 左右翻 */
  right?: [S, S, S]
}

const POSE_I: Record<Pose, number> = { stand: 0, stepL: 1, stepR: 2 }

/** 一組「方向 × 站、左腳、右腳」的 sprite；錨點預設在 sprite 的下緣中間 */
export function sheetLook<S extends AnySprite>(sheet: Sheet<S>, o: { ax?: number; ay?: number; shadow?: number } = {}): ActorLook {
  const pick = (dir: Dir, pose: Pose): LookFrame => {
    const i = POSE_I[pose]
    const s = dir === 'right' ? (sheet.right?.[i] ?? sheet.left[i]) : sheet[dir][i]
    // 右邊用左邊翻：左腳、右腳也跟著換（看起來才是同一隻腳在前）
    const flip = dir === 'right' && !sheet.right
    const sp = flip && pose !== 'stand' ? sheet.left[i === 1 ? 2 : 1] : s
    return { sprite: sp, ax: o.ax ?? Math.floor(sp.w / 2), ay: o.ay ?? sp.h, flip }
  }
  return { frame: pick, shadow: o.shadow }
}
