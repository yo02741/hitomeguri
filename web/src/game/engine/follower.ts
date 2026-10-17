import { type Actor, JUMP, RUN, WALK } from './actor'
import { type Dir, dirOf, DX, DY, LEDGE, OPPOSITE } from './types'

/**
 * 夥伴：走玩家剛離開的那一格（臉朝移動方向）。玩家每走一步就在 trail 記下出發的格子，
 * 夥伴一格一格追（落後兩格以上就用跑的追上）；跳台階也跟著跳；停下來時原地小跳一下。
 * 玩家回頭撞到夥伴：兩個交換位置（Game 叫 swap）。過門：Game 叫 reset 放到玩家後面。
 */
export interface FollowerWorld {
  /** 行為碼 */
  beh(x: number, y: number): number
  /** 這一格有別的角色（NPC）擋著嗎（玩家不算） */
  blocked(x: number, y: number): boolean
  /** 玩家正在走嗎 */
  playerMoving(): boolean
  /** 玩家在跑嗎 */
  playerRunning(): boolean
}

export class Follower {
  readonly actor: Actor
  trail: Array<{ x: number; y: number }> = []
  /** 被擋住等了多久 */
  private stuck = 0

  constructor(actor: Actor) {
    this.actor = actor
  }

  /** 傳送之後：放在 (x, y)，臉朝 dir */
  reset(x: number, y: number, dir: Dir) {
    this.actor.place(x, y, dir)
    this.trail = []
    this.stuck = 0
  }

  /** 玩家從 (x, y) 出發了 */
  playerLeft(x: number, y: number) {
    const last = this.trail[this.trail.length - 1]
    if (last && last.x === x && last.y === y) return
    this.trail.push({ x, y })
    // 落後太多（被擋太久）：只留最近的幾格
    if (this.trail.length > 6) this.trail.splice(0, this.trail.length - 6)
  }

  /** 玩家往夥伴那一格走：夥伴同時走到玩家原本的格子 */
  swap(toX: number, toY: number, dur: number) {
    const a = this.actor
    this.trail = []
    const d = dirOf(toX - a.x, toY - a.y)
    if (!d || a.moving) {
      a.place(toX, toY, d ?? a.dir)
      return
    }
    a.begin('step', d, dur)
  }

  /** 每次更新（在玩家決定這一步之後） */
  update(w: FollowerWorld) {
    const a = this.actor
    if (a.moving) return
    while (this.trail.length && this.trail[0]!.x === a.x && this.trail[0]!.y === a.y) this.trail.shift()
    const next = this.trail[0]
    if (!next) return
    const dx = next.x - a.x
    const dy = next.y - a.y
    const dist = Math.abs(dx) + Math.abs(dy)
    const d = dirOf(Math.sign(dx), Math.sign(dy))
    const dur = this.trail.length > 1 || w.playerRunning() ? RUN : WALK
    if (dist === 1 && d) {
      if (w.blocked(next.x, next.y)) {
        // NPC 走進來擋住了：等一下，太久就直接過去
        if (++this.stuck < 90) return
        a.place(next.x, next.y, d)
      } else a.begin('step', d, dur)
      this.trail.shift()
      this.stuck = 0
      return
    }
    // 兩格、中間是往那邊的台階：跳過去
    if (dist === 2 && d && (dx === 0 || dy === 0) && LEDGE[w.beh(a.x + DX[d], a.y + DY[d])] === d) {
      a.begin('jump', d, JUMP)
      this.trail.shift()
      return
    }
    // 其他（傳送、被擋太久）：直接放過去
    a.place(next.x, next.y, d ?? OPPOSITE[a.dir])
    this.trail.shift()
  }

  /** 走完一步時（Game 在 tick 之後叫）：沒有要追的、玩家也停了 → 小跳 */
  arrived(w: FollowerWorld) {
    if (!this.trail.length && !w.playerMoving()) this.actor.hop = 10
  }
}
