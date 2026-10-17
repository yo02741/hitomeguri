import { type ActorLook, type Dir, DX, DY, type MapEntity, type Pose, TILE } from './types'

/**
 * 地圖上的角色（玩家、夥伴、NPC）：站在一格上，走路時從 (fx, fy) 移到 (x, y)。
 * 時間用「更新次數」算（每秒 60 次）：走一步 16 次（1px/次）、跑步 8 次、跳台階 32 次（兩格）。
 * 移動中 (x, y) 已經是目的地，出發的格子也還算佔著，別人進不來。
 */
export const WALK = 16
export const RUN = 8
export const JUMP = 32
/** 撞牆原地踏步一次 */
export const BUMP = 16
/** 輕點方向轉身之後，按住多久才開始走 */
export const TURN = 6
/** 跳台階的高度（px） */
const JUMP_H = 10

export type MoveKind = 'step' | 'jump' | 'bump'
export interface Move {
  kind: MoveKind
  dir: Dir
  /** 走了幾次 */
  t: number
  dur: number
}

export type ActorKind = 'player' | 'follower' | 'npc'

export class Actor {
  readonly id: string
  readonly kind: ActorKind
  look: ActorLook
  x = 0
  y = 0
  fx = 0
  fy = 0
  dir: Dir = 'down'
  move: Move | null = null
  /** 下一步出哪一腳（0 左、1 右）：站、左、站、右 */
  foot = 0
  hidden = false
  /** 別人撞得到（夥伴對玩家不算） */
  solid = true
  /** 原地小跳還剩幾次更新 */
  hop = 0
  /** 被搭話、腳本在用：NPC 自己不亂動 */
  busy = false
  /** 生成這個角色的地圖實體（NPC） */
  entity: MapEntity | null = null

  constructor(id: string, kind: ActorKind, look: ActorLook, x = 0, y = 0, dir: Dir = 'down') {
    this.id = id
    this.kind = kind
    this.look = look
    this.place(x, y, dir)
  }

  /** 直接放到某一格（傳送、讀檔） */
  place(x: number, y: number, dir?: Dir) {
    this.x = this.fx = x
    this.y = this.fy = y
    this.move = null
    this.hop = 0
    if (dir) this.dir = dir
  }

  get moving(): boolean {
    return this.move !== null
  }

  /** 開始走：step 一格、jump 兩格（跳過台階）、bump 原地踏步 */
  begin(kind: MoveKind, dir: Dir, dur: number) {
    this.dir = dir
    this.fx = this.x
    this.fy = this.y
    const dist = kind === 'jump' ? 2 : kind === 'step' ? 1 : 0
    this.x += DX[dir] * dist
    this.y += DY[dir] * dist
    this.move = { kind, dir, t: 0, dur }
  }

  /** 更新一次；這一次剛好走完就回傳那一步 */
  tick(): Move | null {
    if (this.hop > 0) this.hop--
    const m = this.move
    if (!m) return null
    m.t++
    if (m.t < m.dur) return null
    this.move = null
    this.fx = this.x
    this.fy = this.y
    this.foot ^= 1
    return m
  }

  /** 世界座標（這一格的左上角，像素） */
  get px(): number {
    const m = this.move
    if (!m || m.kind === 'bump') return this.x * TILE
    return Math.round((this.fx + ((this.x - this.fx) * m.t) / m.dur) * TILE)
  }
  get py(): number {
    const m = this.move
    if (!m || m.kind === 'bump') return this.y * TILE
    return Math.round((this.fy + ((this.y - this.fy) * m.t) / m.dur) * TILE)
  }
  /** 離地多高（跳台階、小跳） */
  get z(): number {
    const m = this.move
    let z = 0
    if (m?.kind === 'jump') {
      const p = m.t / m.dur
      z = Math.round(4 * JUMP_H * p * (1 - p))
    }
    if (this.hop > 0) z += Math.round(Math.sin((this.hop / 10) * Math.PI) * 2)
    return z
  }

  /** 走路的前半步出腳、後半步站好；跳的時候縮腳 */
  pose(): Pose {
    const m = this.move
    if (!m) return 'stand'
    if (m.kind === 'jump') return m.t < m.dur * 0.8 ? (this.foot ? 'stepR' : 'stepL') : 'stand'
    return m.t < m.dur / 2 ? (this.foot ? 'stepR' : 'stepL') : 'stand'
  }

  /** 佔著這一格嗎（移動中：出發與目的地都算） */
  covers(x: number, y: number): boolean {
    return (this.x === x && this.y === y) || (this.move !== null && this.fx === x && this.fy === y)
  }

  /** 面前那一格 */
  front(n = 1): { x: number; y: number } {
    return { x: this.x + DX[this.dir] * n, y: this.y + DY[this.dir] * n }
  }
}
