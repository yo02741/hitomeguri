import type { Rng } from '../../services/pixelwalk/rng'

import { Actor, WALK } from './actor'
import { type ActorLook, type Dir, DIRS, DX, DY, type MapEntity, parsePath } from './types'

/**
 * NPC：站著、左右看、小範圍亂走（不出範圍、不擋門）、照路線走。被搭話時轉向玩家（Game 設 busy，腳本跑完才放開）。
 * 實體的 data：look（外觀 id）、move（stand／look／wander／route）、range（亂走的半徑，預設 2）、
 * route（'R3D2L3U2' 這種，走完一輪從頭）、dirs（look 時輪流看的方向）。
 */
export type NpcMove = 'stand' | 'look' | 'wander' | 'route'

export interface NpcBrain {
  move: NpcMove
  home: { x: number; y: number }
  range: number
  route: Dir[]
  ri: number
  /** 還要等幾次更新才動 */
  wait: number
  dirs: Dir[]
}

/** NPC 想走的時候要問世界的事 */
export interface NpcWorld {
  /** 這一格可以走進去嗎（行為、別的角色） */
  canEnter(a: Actor, x: number, y: number): boolean
  /** 門、傳送點與門前一格：亂走的 NPC 不站上去 */
  nearDoor(x: number, y: number): boolean
}

export class Npc extends Actor {
  brain: NpcBrain

  constructor(e: MapEntity, look: ActorLook) {
    super(e.id, 'npc', look, e.x, e.y, e.facing ?? 'down')
    this.entity = e
    const d = e.data ?? {}
    const move = (['stand', 'look', 'wander', 'route'] as const).find((m) => m === d.move) ?? 'stand'
    const dirs = Array.isArray(d.dirs) ? (d.dirs as unknown[]).filter((x): x is Dir => (DIRS as readonly unknown[]).includes(x)) : []
    this.brain = {
      move,
      home: { x: e.x, y: e.y },
      range: typeof d.range === 'number' ? Math.max(0, d.range) : 2,
      route: typeof d.route === 'string' ? parsePath(d.route) : [],
      ri: 0,
      wait: 30 + ((e.x * 7 + e.y * 13) % 60),
      dirs: dirs.length ? dirs : ['left', 'right', 'down'],
    }
  }

  /** 亂走的範圍裡嗎 */
  inRange(x: number, y: number): boolean {
    const b = this.brain
    return Math.abs(x - b.home.x) <= b.range && Math.abs(y - b.home.y) <= b.range
  }

  /** 每次更新（世界沒停、自己沒在走、沒被搭話時）想一下要不要動 */
  think(w: NpcWorld, r: Rng) {
    const b = this.brain
    if (this.busy || this.moving || b.move === 'stand') return
    if (--b.wait > 0) return
    if (b.move === 'look') {
      const next = b.dirs.filter((d) => d !== this.dir)
      this.dir = next.length ? r.pick(next) : this.dir
      b.wait = r.int(90, 220)
      return
    }
    if (b.move === 'wander') {
      const d = r.pick(DIRS)
      const nx = this.x + DX[d]
      const ny = this.y + DY[d]
      if (this.inRange(nx, ny) && !w.nearDoor(nx, ny) && w.canEnter(this, nx, ny)) this.begin('step', d, WALK)
      else this.dir = d
      b.wait = r.int(50, 170)
      return
    }
    // route：照路線一格一格走；被擋住就面向那邊等一下再試
    if (!b.route.length) return
    const d = b.route[b.ri % b.route.length]!
    const nx = this.x + DX[d]
    const ny = this.y + DY[d]
    if (w.canEnter(this, nx, ny)) {
      this.begin('step', d, WALK)
      b.ri = (b.ri + 1) % b.route.length
      b.wait = 1
    } else {
      this.dir = d
      b.wait = 30
    }
  }
}
