import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Game } from '../engine/game'
import type { Button } from '../engine/input'
import type { MapEntity } from '../engine/types'

import { dayKey } from './data'
import { bodyRect, clampFrame, crop, frameSize, photoId, type Rect, scoreShot, type ShotInput, type ShotScore, ZOOM_LABEL, zoomFrame, type Zoom } from './photo'
import { photoStore, toPng } from './photoStore'
import type { PhotoMeta } from './state'
import type { PhotoSpotData } from './types'

/**
 * 取景框（規格 §8.4）：相機鍵（C／手機的相機鈕）打開，世界停住；框畫在畫面上（setOverlay，不進照片）。
 * 十字鍵移框（放大時）、A 拍、B 收起、再按相機鍵換變焦（全畫面 ↔ 中間放大一半）。
 * 拍下去：照片＝當下真正的像素畫面（game.snapshot() 裁切；季節、時段、天氣、路人、自己與夥伴都在裡面），
 * 快門聲、畫面閃一下（減少動態不閃），算構圖分數，存 IndexedDB，打開「拍好的照片」面板。
 */
export interface CameraHost {
  readonly game: Game
  readonly reduced: boolean
  sfx(name: string): void
  /** 變焦換了（介面的字跟著換） */
  changed(): void
  /** 打開／關上取景框面板（世界停住、繼續） */
  showViewfinder(spot: MapEntity | null, name: string | null): void
  hideViewfinder(): void
  /** 這一張的頁（拍攝點的景點，或這張地圖）與分數要的環境（祭典、花季、會不會積雪） */
  pageOf(spot: MapEntity | null): { page: string; name: { ja: string; zh?: string }; spotId?: string }
  scene(): Pick<ShotInput, 'festival' | 'bloom' | 'snowy'>
  /** 框裡（畫面座標）有祭典的東西嗎（攤子、提燈、祭典的人）：祭典的鎮也只有拍到這些才算祭典照 */
  festivalIn?(frame: Rect): boolean
  /** 拍好了：交給相簿（決定放不放進去） */
  shot(meta: PhotoMeta, score: ShotScore, spotId: string | undefined, png: Promise<boolean>): void
}

const SPEED = 96
const FLASH_MS = 220

export class Camera {
  open = false
  zoom: Zoom = 1
  frame: Rect = { x: 0, y: 0, w: 240, h: 160 }
  spot: MapEntity | null = null
  private flash = 0
  private last = 0
  private readonly host: CameraHost

  constructor(host: CameraHost) {
    this.host = host
  }

  private get game(): Game {
    return this.host.game
  }

  start(spot: MapEntity | null) {
    if (this.open) return
    const g = this.game
    this.open = true
    this.spot = spot
    this.zoom = 1
    this.frame = { x: 0, y: 0, ...frameSize(g.W, g.H, 1) }
    this.last = 0
    // 拍攝點：鏡頭挪到看得到整個地標的地方（旅人在拍攝點上，地標可能比畫面上半還高）
    const t = (spot?.data as PhotoSpotData | undefined)?.target
    g.setFocus(t ? { x: t.x * 16, y: t.y * 16, w: t.w * 16, h: t.h * 16 } : null)
    const name = spot ? this.host.pageOf(spot).name.ja : null
    this.host.showViewfinder(spot, name)
    g.setOverlay(this.draw)
  }

  /** 收起（閃光還在的話等它閃完才拿掉疊加） */
  stop() {
    if (!this.open) return
    this.open = false
    this.game.setFocus(null)
    this.host.hideViewfinder()
    if (this.flash <= 0) this.game.setOverlay(null)
  }

  /** 世界停住時的按鍵 */
  press(b: Button): boolean {
    if (!this.open) return false
    if (b === 'A') {
      void this.shoot()
      return true
    }
    if (b === 'B' || b === 'START') {
      this.host.sfx('cancel')
      this.stop()
      return true
    }
    if (b === 'CAMERA') {
      this.setZoom(this.zoom === 1 ? 2 : 1)
      return true
    }
    if (b === 'up' || b === 'down' || b === 'left' || b === 'right') {
      this.nudge(b === 'left' ? -2 : b === 'right' ? 2 : 0, b === 'up' ? -2 : b === 'down' ? 2 : 0)
      return true
    }
    return true
  }

  setZoom(z: Zoom) {
    const g = this.game
    this.zoom = z
    this.frame = zoomFrame(this.frame, g.W, g.H, z)
    this.host.sfx('cursor')
    this.host.changed()
  }

  nudge(dx: number, dy: number) {
    const g = this.game
    this.frame = clampFrame({ ...this.frame, x: this.frame.x + dx, y: this.frame.y + dy }, g.W, g.H)
  }

  /** 這一格的分數要的東西：框、地標、路人、自己與夥伴（畫面座標） */
  shotInput(): ShotInput {
    const g = this.game
    const cam = g.camera()
    const d = (this.spot?.data ?? {}) as PhotoSpotData
    const t = d.target
    const target = t ? { x: t.x * 16 - cam.x, y: t.y * 16 - cam.y, w: t.w * 16, h: t.h * 16 } : null
    const people = g.npcs.filter((a) => !a.hidden && a.solid && a.kind === 'npc').map((a) => bodyRect(a.px, a.py, cam.x, cam.y))
    const selves = [g.player, ...(g.follower ? [g.follower.actor] : [])].filter((a) => !a.hidden).map((a) => bodyRect(a.px, a.py, cam.x, cam.y))
    const outdoor = !!g.map?.outdoor
    const scene = this.host.scene()
    return {
      frame: this.frame,
      target,
      people,
      selves,
      time: outdoor ? g.clock.time : 'day',
      season: g.clock.season,
      weather: outdoor ? g.weather : 'clear',
      ...scene,
      festival: scene.festival && (this.host.festivalIn?.(this.frame) ?? true),
    }
  }

  async shoot() {
    if (!this.open) return
    const g = this.game
    const snap = g.snapshot()
    const f = clampFrame(this.frame, snap.w, snap.h)
    const px = crop(snap, f)
    const input = this.shotInput()
    const score = scoreShot(input)
    this.host.sfx('shutter')
    if (!this.host.reduced) this.flash = FLASH_MS
    const page = this.host.pageOf(this.spot)
    const id = photoId()
    const meta: PhotoMeta = {
      id,
      page: page.page,
      name: page.name,
      slot: score.slot,
      d: dayKey(g.clock.date),
      t: input.time,
      s: input.season,
      score: score.score,
      w: f.w,
      h: f.h,
      tg: score.together || undefined,
    }
    const png = toPng(px, f.w, f.h).then((blob) => (blob ? photoStore().put({ id, w: f.w, h: f.h, png: blob }) : false))
    this.open = false
    g.setFocus(null)
    this.host.shot(meta, score, page.spotId, png)
  }

  /** 每格疊在世界上：框外變暗、四個角、變焦的字、閃光 */
  readonly draw = (g: Gfx) => {
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0
    this.last = now
    if (!this.open && this.flash <= 0) {
      this.game.setOverlay(null)
      return
    }
    if (this.flash > 0) {
      this.flash -= dt * 1000
      if (this.flash <= 0 && !this.open) {
        this.game.setOverlay(null)
        return
      }
    }
    if (this.open) {
      const dir = this.game.input.dir
      if (dir && this.zoom === 2) this.nudge(dir === 'left' ? -SPEED * dt : dir === 'right' ? SPEED * dt : 0, dir === 'up' ? -SPEED * dt : dir === 'down' ? SPEED * dt : 0)
      this.drawFrame(g)
    }
    if (this.flash > 0) g.cover('white', Math.max(0, Math.min(16, Math.round((this.flash / FLASH_MS) * 16))))
  }

  private drawFrame(g: Gfx) {
    const { x, y, w, h } = this.frame
    const W = g.w
    const H = g.h
    // 框外：抖色變暗
    g.dither(0, 0, W, y, 'ink', 8)
    g.dither(0, y + h, W, H - y - h, 'ink', 8)
    g.dither(0, y, x, h, 'ink', 8)
    g.dither(x + w, y, W - x - w, h, 'ink', 8)
    // 四個角（白線、墨色的邊），全畫面時往內縮一點
    const i = this.zoom === 1 ? 6 : 1
    const L = 10
    const corners: Array<[number, number, number, number]> = [
      [x + i, y + i, 1, 1],
      [x + w - 1 - i, y + i, -1, 1],
      [x + i, y + h - 1 - i, 1, -1],
      [x + w - 1 - i, y + h - 1 - i, -1, -1],
    ]
    const bar = (x0: number, y0: number, x1: number, y1: number, k: 'ink' | 'white') =>
      g.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1, k)
    for (const [cx, cy, sx, sy] of corners) {
      bar(cx - sx, cy - sy, cx + sx * (L + 1), cy + sy * 2, 'ink')
      bar(cx - sx, cy - sy, cx + sx * 2, cy + sy * (L + 1), 'ink')
      bar(cx, cy, cx + sx * L, cy + sy, 'white')
      bar(cx, cy, cx + sx, cy + sy * L, 'white')
    }
    // 中間的十字
    const mx = Math.round(x + w / 2)
    const my = Math.round(y + h / 2)
    g.hline(mx - 3, mx + 3, my, 'white')
    g.vline(mx, my - 3, my + 3, 'white')
    // 變焦（右上角的內側，跟白線隔 2 格；左上角是取景框的地名牌，全畫面時會蓋住）
    const label = ZOOM_LABEL[this.zoom]
    const lx = x + w - i - 5 - (label.length * 4 - 1)
    g.text(label, lx + 1, y + i + 6, 'ink')
    g.text(label, lx, y + i + 5, 'white')
  }
}
