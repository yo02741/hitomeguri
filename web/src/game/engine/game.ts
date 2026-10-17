import { dotOn, Gfx } from '../../services/pixelwalk/gfx'
import type { Tokens } from '../../services/pixelwalk/palette'
import { rng, type Rng } from '../../services/pixelwalk/rng'

import { Actor, BUMP, JUMP, type Move, RUN, TURN, WALK } from './actor'
import { type CalendarDate, GameClock, periodOf } from './clock'
import { Emitter } from './emitter'
import { entityKind } from './entities'
import { Follower } from './follower'
import { attachKeyboard, type Button, GamepadSource, InputState } from './input'
import { lookOf } from './looks'
import { MapView } from './map'
import { Npc } from './npc'
import { findPath, type Cell } from './path'
import { Renderer, WeatherFx, type Weather } from './render'
import { DEFAULT_SETTINGS, type FlagValue, type GameSettings, localStore, readSave, SAVE_VERSION, type SaveData, saveKey, type SaveStorage, writeSave } from './save'
import { type CommandCtx, makeApi, Runner, type SayOpts } from './script'
import { TileCache } from './tiles'
import {
  type ActorLook,
  B,
  type Dir,
  DX,
  DY,
  type GameMap,
  LEDGE,
  type MapEntity,
  type MapName,
  OPPOSITE,
  passable,
  type Script,
  type ScriptFn,
  type Season,
  type SourceRef,
  TILE,
  type TimeOfDay,
  VIEW_H,
  VIEW_H_MAX,
  VIEW_W_MAX,
  VIEW_W_MIN,
  type Warp,
} from './types'
import './commands'

/**
 * 番外篇的遊戲（facade）：載入地圖、每次更新（固定 60 次／秒）、畫一格、事件。
 * 不碰 DOM（鍵盤用 attachKeyboard 另外接）；介面（對話框、手帳、取景框）聽事件，做完呼叫 resolve 或 resume。
 *
 *   const game = new Game({ tokens: readTokens(), maps: (id) => MAPS[id] ?? null, start: { map: 'town', x: 5, y: 9 } })
 *   game.on('say', (e) => showDialog(e.text).then(e.resolve))
 *   game.continueGame()               // 有存檔就接著玩，沒有就新遊戲
 *   每 1/60 秒 game.update()；每一格 putImageData(game.render())
 */
export type MapSource = (id: string) => GameMap | null

export interface GameOptions {
  tokens: Tokens
  maps: MapSource
  /** 新遊戲、找不到存檔的地圖時的起點 */
  start: { map: string; x: number; y: number; dir?: Dir }
  /** 邏輯寬（176–240，預設 240） */
  width?: number
  /** 邏輯高（160–256，預設 160） */
  height?: number
  /** 玩家與夥伴的外觀（預設 registerLook 的 traveler、shiba）；夥伴給 null 就沒有 */
  player?: ActorLook
  follower?: ActorLook | null
  /** 存檔放哪（預設 localStorage；null 不存） */
  storage?: SaveStorage | null
  /** 存檔的 key（預設 hitomeguri:game:v1:guest） */
  saveKey?: string
  /** 減少動態：淡出淡入直接切、時段不交替 */
  reducedMotion?: boolean
  /** 日曆的「今天」（測試用） */
  now?: Date
  seed?: number
  /** 世界生成器的版本（P2）：跟存檔的不一樣時把玩家放回起點 */
  genVersion?: number
  /** 季節（P2 換成氣象台的平年值）；預設照月份 */
  seasonOf?(d: CalendarDate): Season
  /** 新遊戲的現金（預設 NEW_GAME_MONEY 円） */
  money?: number
}

export interface SayEvent {
  text: string
  who?: string
  source?: SourceRef
  /** 介面把這句話放完、玩家按了 A 之後呼叫 */
  resolve(): void
}
export interface AskEvent {
  text: string
  options: string[]
  who?: string
  source?: SourceRef
  /** 按 B 選哪一個（預設最後一個） */
  cancel: number
  resolve(index: number): void
}

export interface GameEvents {
  say: SayEvent
  ask: AskEvent
  /** 進到一張地圖（地名牌、aria-live 讀出地名） */
  mapEnter: { id: string; name: MapName; outdoor: boolean }
  sfx: { name: string }
  /** null = 停 */
  bgm: { name: string | null }
  /** START：介面打開旅人手帳（世界已經停了，關的時候呼叫 closeMenu） */
  menu: { open: boolean }
  /** 相機鍵：站在拍攝點上時帶著那個拍攝點 */
  camera: { spot: MapEntity | null }
  interact: { entity: MapEntity; actor: Actor | null }
  /** 世界停住時（對話、選單、暫停）的按鍵，交給介面 */
  button: { button: Button }
  /** 換時段、換日 */
  clock: { date: CalendarDate; hhmm: string; time: TimeOfDay; season: Season }
  save: { ok: boolean; bytes: number }
  step: { map: string; x: number; y: number }
  change: { what: 'money' | 'items' | 'flags' | 'stamps' }
  pause: { paused: boolean; reasons: string[] }
}

/**
 * 新遊戲的現金（円，P4 規格 §13 第 3 點；P3 以前是 5000「文」）。舊存檔的換算（×10、至少這麼多）在 systems/wallet.ts 的 ensureYen。
 */
export const NEW_GAME_MONEY = 50_000

/** 遊戲的紀錄（存檔的內容，除了位置與日曆） */
export class GameState {
  flags: Record<string, FlagValue> = {}
  money = NEW_GAME_MONEY
  items: Record<string, number> = {}
  stamps: string[] = []
  seen = new Set<string>()
  album: string[] = []
  room: Record<string, unknown> = {}
  ext: Record<string, unknown> = {}
}

type Dialog = { kind: 'say'; resolve(): void } | { kind: 'ask'; resolve(i: number): void; cancel: number }

const FADE_STEP = 1
const BLEND_SEC = 1.2
/** 換時段前幾分鐘（遊戲時間）開始把下一個時段的 tile 畫進快取 */
const WARM_AHEAD_MIN = 20
/** 一格畫幾列 tile 進快取（畫面外多一圈） */
const WARM_ROWS = 2
const clampW = (w: number) => Math.max(VIEW_W_MIN, Math.min(VIEW_W_MAX, Math.round(w)))
const clampH = (h: number) => Math.max(VIEW_H, Math.min(VIEW_H_MAX, Math.round(h)))

/**
 * 鏡頭的一軸：center 置中、到地圖邊停；地圖比畫面小時置中。focus（[起點, 長度]）有給時，
 * 從置中的位置挪最少的距離讓 focus 整段在畫面裡（放不下就對齊 focus 的開頭），再夾回地圖裡。
 */
export function cameraAxis(center: number, size: number, view: number, focus?: readonly [number, number]): number {
  if (size <= view) return Math.round((size - view) / 2)
  let v = center - Math.floor(view / 2)
  if (focus) {
    const [a, len] = focus
    if (len >= view) v = a
    else v = Math.max(a + len - view, Math.min(a, v))
  }
  return Math.max(0, Math.min(size - view, v))
}

export class Game {
  /** 邏輯高（160；手機直拿時可以到 VIEW_H_MAX） */
  H: number
  W: number
  readonly input = new InputState()
  readonly clock: GameClock
  readonly state = new GameState()
  settings: GameSettings = { ...DEFAULT_SETTINGS }
  readonly player: Actor
  readonly follower: Follower | null
  npcs: Actor[] = []
  map: GameMap | null = null
  view: MapView | null = null
  weather: Weather = 'clear'
  readonly reducedMotion: boolean

  private readonly opts: GameOptions
  private readonly events = new Emitter<GameEvents>()
  private readonly cache: TileCache
  private readonly renderer: Renderer
  private readonly pad: GamepadSource
  private readonly weatherFx = new WeatherFx()
  private readonly rng: Rng
  private readonly store: SaveStorage | null
  private key: string
  private frame: Gfx
  private blendFrame: Gfx | null = null
  private runners: Runner[] = []
  private dialog: Dialog | null = null
  private pauses = new Set<string>()
  /** 動畫的秒數（暫停時不走） */
  private t = 0
  private fade = 16
  private fadeGoal = 16
  /** 時段交替：從哪個時段淡過來、還剩幾秒 */
  private blend: { from: TimeOfDay; left: number } | null = null
  private lastTime: TimeOfDay | null = null
  private lastDate = ''
  private turnT = 0
  private queued: Dir | null = null
  private readonly buffered = new Set<'A' | 'START' | 'CAMERA'>()
  private autoPath: Dir[] = []
  /** 點畫面的目的地：走到 goals 任一格，之後面向 target */
  private autoGoal: { goals: Cell[]; target: Cell | null; retried: boolean } | null = null
  private pendingFace: Dir | null = null
  private lastBgm: string | null | undefined = undefined
  private started = false

  constructor(opts: GameOptions) {
    this.opts = opts
    this.W = clampW(opts.width ?? VIEW_W_MAX)
    this.H = clampH(opts.height ?? VIEW_H)
    this.reducedMotion = !!opts.reducedMotion
    this.cache = new TileCache(opts.tokens)
    this.renderer = new Renderer(opts.tokens, this.cache)
    this.frame = new Gfx(this.W, this.H, this.cache.palette('day'))
    this.clock = new GameClock(opts.now, opts.seasonOf)
    this.pad = new GamepadSource(this.input)
    this.rng = rng(opts.seed ?? (Date.now() & 0xffffffff))
    this.store = opts.storage === undefined ? localStore : opts.storage
    this.key = opts.saveKey ?? saveKey(null)
    this.player = new Actor('player', 'player', opts.player ?? lookOf('traveler'))
    this.follower = opts.follower === null ? null : new Follower(new Actor('follower', 'follower', opts.follower ?? lookOf('shiba')))
    this.state.money = opts.money ?? NEW_GAME_MONEY
  }

  // ---------- 事件 ----------
  on<K extends keyof GameEvents>(name: K, fn: (e: GameEvents[K]) => void): () => void {
    return this.events.on(name, fn)
  }
  emit<K extends keyof GameEvents>(name: K, e: GameEvents[K]) {
    this.events.emit(name, e)
  }

  // ---------- 開始 ----------
  hasSave(): boolean {
    return !!(this.store && readSave(this.store, this.key))
  }

  /** 換存檔的 key（登入狀態晚一點才確定：標題畫面還沒開始時換成那個人的） */
  setSaveKey(key: string) {
    this.key = key
  }

  /** 存檔的內容（不讀進來；重新開始前清掉舊遊戲的照片用） */
  savedData(): SaveData | null {
    return this.store ? readSave(this.store, this.key) : null
  }

  /** 新遊戲：日曆從今天早上開始，放在起點 */
  newGame() {
    const s = this.state
    s.flags = {}
    s.items = {}
    s.stamps = []
    s.seen = new Set()
    s.album = []
    s.room = {}
    s.ext = {}
    s.money = this.opts.money ?? NEW_GAME_MONEY
    const fresh = new GameClock(this.opts.now, this.opts.seasonOf)
    this.clock.date = fresh.date
    this.clock.minutes = fresh.minutes
    const st = this.opts.start
    this.begin(st.map, st.x, st.y, st.dir ?? 'down')
  }

  /** 有存檔就接著玩（回傳 true）；沒有就新遊戲 */
  continueGame(): boolean {
    const data = this.store ? readSave(this.store, this.key) : null
    if (!data) {
      this.newGame()
      return false
    }
    this.restore(data)
    return true
  }

  /** 讀進一份存檔：生成器版本變了 → 放回那張地圖的起點（鎮的車站）；找不到地圖 → 放回遊戲的起點。旗標與東西保留 */
  restore(d: SaveData) {
    const s = this.state
    s.flags = { ...d.flags }
    s.money = d.money
    s.items = { ...d.items }
    s.stamps = [...d.stamps]
    s.seen = new Set(d.seen)
    s.album = [...d.album]
    s.room = { ...d.room }
    s.ext = { ...d.ext }
    this.settings = { ...d.settings }
    this.clock.load(d.calendar)
    const map = d.map ? this.opts.maps(d.map) : null
    const sameGen = d.gen === (this.opts.genVersion ?? 0)
    if (map && sameGen && d.x >= 0 && d.y >= 0 && d.x < map.w && d.y < map.h) this.begin(map.id, d.x, d.y, d.dir, map)
    else if (map?.start) this.begin(map.id, map.start.x, map.start.y, map.start.dir ?? 'down', map)
    else {
      const st = this.opts.start
      this.begin(st.map, st.x, st.y, st.dir ?? 'down')
    }
  }

  private begin(mapId: string, x: number, y: number, dir: Dir, map?: GameMap) {
    for (const r of this.runners) r.stop()
    this.runners = []
    this.dialog = null
    this.pauses.clear()
    this.started = true
    if (!this.enter(map ?? this.opts.maps(mapId), x, y, dir)) {
      const st = this.opts.start
      if (!this.enter(this.opts.maps(st.map), st.x, st.y, st.dir ?? 'down')) throw new Error(`game：起點的地圖 ${st.map} 不存在`)
    }
    // 開場淡入
    this.fade = this.reducedMotion ? 0 : 16
    this.fadeGoal = 0
  }

  // ---------- 存檔 ----------
  serialize(): SaveData {
    const p = this.player
    return {
      v: SAVE_VERSION,
      gen: this.opts.genVersion ?? 0,
      map: this.map?.id ?? '',
      x: p.x,
      y: p.y,
      dir: p.dir,
      flags: { ...this.state.flags },
      money: this.state.money,
      items: { ...this.state.items },
      stamps: [...this.state.stamps],
      room: this.state.room,
      calendar: this.clock.toJSON(),
      settings: { ...this.settings },
      seen: [...this.state.seen],
      album: [...this.state.album],
      ext: this.state.ext,
      savedAt: Date.now(),
    }
  }

  /** 存檔（換地圖時自動；手帳的「存檔」也叫這個）。腳本走到一半、在門裡時存的是腳下那一格 */
  save(): { ok: boolean; bytes: number } {
    if (!this.store || !this.map) return { ok: false, bytes: 0 }
    const r = writeSave(this.store, this.key, this.serialize())
    this.emit('save', r)
    return r
  }

  // ---------- 暫停 ----------
  get paused(): boolean {
    return this.pauses.size > 0
  }
  /** 世界停住（menu：手帳、hidden：分頁在背景、user：P 鍵…） */
  pause(reason: string) {
    if (this.pauses.has(reason)) return
    this.pauses.add(reason)
    this.input.clear()
    this.emit('pause', { paused: true, reasons: [...this.pauses] })
  }
  resume(reason: string) {
    if (!this.pauses.delete(reason)) return
    this.input.clear()
    this.emit('pause', { paused: this.paused, reasons: [...this.pauses] })
  }
  closeMenu() {
    if (!this.pauses.has('menu')) return
    this.resume('menu')
    this.emit('menu', { open: false })
  }

  /** 有擋住玩家的腳本（對話、傳送）在跑 */
  get busy(): boolean {
    return this.runners.some((r) => !r.done && r.blocking) || this.dialog !== null
  }

  // ---------- 畫面 ----------
  resize(w: number, h: number = this.H) {
    const W = clampW(w)
    const H = clampH(h)
    if (W === this.W && H === this.H) return
    this.W = W
    this.H = H
    this.frame = new Gfx(W, H, this.frame.pal)
    this.blendFrame = null
  }

  /** 鏡頭要讓這一塊（地圖的像素座標）整個在畫面裡（取景框：拍攝點的地標）；null 回到跟著玩家 */
  private focus: { x: number; y: number; w: number; h: number } | null = null
  setFocus(r: { x: number; y: number; w: number; h: number } | null) {
    this.focus = r
  }

  /** 鏡頭：玩家置中，到地圖邊停；地圖比畫面小時置中；有 focus 時挪到看得到那一塊 */
  camera(): { x: number; y: number } {
    const map = this.map
    if (!map) return { x: 0, y: 0 }
    const p = this.player
    const f = this.focus
    return {
      x: cameraAxis(p.px + 8, map.w * TILE, this.W, f ? [f.x, f.w] : undefined),
      y: cameraAxis(p.py + 8, map.h * TILE, this.H, f ? [f.y, f.h] : undefined),
    }
  }

  private get renderTime(): TimeOfDay {
    return this.map?.outdoor ? this.clock.time : 'day'
  }

  private drawWorld(g: Gfx, time: TimeOfDay) {
    const view = this.view
    if (!view) {
      g.pal = this.cache.palette('day')
      g.clear('ink')
      return
    }
    const cam = this.camera()
    const actors: Actor[] = [this.player, ...this.npcs]
    if (this.follower) actors.push(this.follower.actor)
    this.renderer.draw(g, { view, camX: cam.x, camY: cam.y, season: this.clock.season, time, t: this.t, actors })
    if (this.map?.outdoor) this.weatherFx.draw(g, cam.x, cam.y, time)
  }

  /** 畫一格：回傳同一塊 Gfx（Uint32 緩衝，直接 putImageData） */
  render(): Gfx {
    const g = this.frame
    const time = this.renderTime
    this.drawWorld(g, time)
    if (this.blend) {
      // 時段交替：舊時段的那一張照抖色慢慢被新的蓋過去
      this.blendFrame ??= new Gfx(this.W, this.H, g.pal)
      const old = this.blendFrame
      this.drawWorld(old, this.blend.from)
      const level = Math.round((1 - this.blend.left / BLEND_SEC) * 16)
      const { buf, w, h } = g
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!dotOn(x, y, level)) buf[y * w + x] = old.buf[y * w + x]!
    }
    if (this.overlay) {
      try {
        g.ox = 0
        g.oy = 0
        this.overlay(g, this.t)
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('game：overlay 畫不出來', e)
        this.overlay = null
      }
    }
    if (this.fade > 0) g.cover('ink', this.fade)
    this.warmNext()
    return g
  }

  // 換時段（06、17、19 點）的那 1.2 秒每格要畫兩次世界；新時段的 tile 第一次畫最慢（手機上第一格 10–28 ms）。
  // 快換的時候，每格先把畫面（多一圈）的兩列 tile 用新時段畫進快取，換的時候就都是快取裡的了。
  private warm: { key: string; row: number; x: number; y: number; g: Gfx | null } = { key: '', row: 0, x: 0, y: 0, g: null }
  private warmNext() {
    const view = this.view
    if (!view || this.blend || !this.map?.outdoor || this.reducedMotion) return
    const next = periodOf(this.clock.minutes + WARM_AHEAD_MIN)
    if (next === this.clock.time) return
    const cam = this.camera()
    const w = this.warm
    const key = `${this.map.id}|${next}|${this.clock.season}|${this.W}x${this.H}`
    // 換了地圖、時段、畫面大小，或鏡頭走開超過 4 格：從頭再畫一次
    if (w.key !== key || Math.abs(cam.x - w.x) > 4 * TILE || Math.abs(cam.y - w.y) > 4 * TILE) Object.assign(w, { key, row: 0, x: cam.x, y: cam.y })
    const rows = Math.ceil(this.H / TILE) + 4
    if (w.row >= rows) return
    if (!w.g || w.g.w !== this.W + 4 * TILE) w.g = new Gfx(this.W + 4 * TILE, WARM_ROWS * TILE, this.cache.palette(next))
    this.renderer.draw(w.g, { view, camX: w.x - 2 * TILE, camY: w.y - 2 * TILE + w.row * TILE, season: this.clock.season, time: next, t: this.t, actors: [] })
    w.row += WARM_ROWS
  }

  /** 疊在世界上面畫的東西（P2：電車的窗外、取景框）：每格 render 時呼叫，不進 snapshot；null 拿掉 */
  setOverlay(fn: ((g: Gfx, t: number) => void) | null) {
    this.overlay = fn
  }
  private overlay: ((g: Gfx, t: number) => void) | null = null

  /** 不含介面、不含淡出的畫面拷貝（P2 拍照） */
  snapshot(): Gfx {
    const g = new Gfx(this.W, this.H, this.frame.pal)
    this.drawWorld(g, this.renderTime)
    return g
  }

  // ---------- 一次更新 ----------
  update(dt = 1 / 60) {
    this.pad.poll()
    const edges = this.input.take()
    if (!this.map || !this.view || !this.started) return
    if (this.paused) {
      for (const b of edges) {
        if (b === 'PAUSE' && this.pauses.has('user')) this.resume('user')
        else this.emit('button', { button: b })
      }
      return
    }
    this.t += dt
    // 淡出淡入、時段交替、天氣：一直走
    this.stepFade()
    if (this.blend && (this.blend.left -= dt) <= 0) this.blend = null
    this.weatherFx.set(this.map.outdoor ? this.weather : 'clear', this.W, this.H)
    this.weatherFx.update(dt)

    if (this.dialog) {
      // 對話中：世界停住（走到一半的就走完），按鍵交給對話框
      for (const b of edges) this.emit('button', { button: b })
      this.tickActors(false)
      return
    }
    const done = this.tickActors(true)
    // 走到一格（撞牆的原地踏步不算）
    const arrived = done.player !== null && done.player.kind !== 'bump'
    if (arrived) this.onArrive()
    for (const r of [...this.runners]) r.step(dt)
    this.runners = this.runners.filter((r) => !r.done)
    if (!this.paused && !this.dialog) this.control(edges, arrived)
    else for (const b of edges) this.emit('button', { button: b })
    if (this.follower) {
      this.follower.update(this.followerWorld)
      if (done.follower) this.follower.arrived(this.followerWorld)
    }
    if (!this.busy) for (const n of this.npcs) if (n instanceof Npc) n.think(this.npcWorld, this.rng)
    if (this.map.outdoor && this.player.moving && !this.busy) this.clock.advance(dt * this.settings.timeRate)
    this.watchClock()
  }

  /** 走一次所有角色；回傳玩家剛走完的那一步、夥伴有沒有剛走完。對話中（all = false）玩家不動、別人只把走到一半的走完 */
  private tickActors(all: boolean): { player: Move | null; follower: boolean } {
    const player = all ? this.player.tick() : null
    const follower = this.follower ? this.follower.actor.tick() !== null : false
    for (const n of this.npcs) if (all || n.moving) n.tick()
    return { player, follower }
  }

  private stepFade() {
    if (this.fade === this.fadeGoal) return
    if (this.reducedMotion) this.fade = this.fadeGoal
    else this.fade += Math.sign(this.fadeGoal - this.fade) * FADE_STEP
  }

  private watchClock() {
    const time = this.renderTime
    const date = `${this.clock.date.y}-${this.clock.date.m}-${this.clock.date.d}`
    if (time !== this.lastTime || date !== this.lastDate) {
      if (this.lastTime && time !== this.lastTime && this.map?.outdoor && !this.reducedMotion) this.blend = { from: this.lastTime, left: BLEND_SEC }
      this.lastTime = time
      this.lastDate = date
      this.emit('clock', { date: { ...this.clock.date }, hhmm: this.clock.hhmm, time: this.clock.time, season: this.clock.season })
    }
  }

  // ---------- 玩家 ----------
  private get running(): boolean {
    return this.settings.alwaysRun !== this.input.held('B')
  }

  private control(edges: Button[], arrived: boolean) {
    const p = this.player
    const pressed = new Set(edges)
    for (const b of edges) if (b === 'up' || b === 'down' || b === 'left' || b === 'right') this.queued = b
    // A、START、相機在走路中按的：走到那一格再處理
    for (const b of ['A', 'START', 'CAMERA'] as const) if (pressed.has(b)) this.buffered.add(b)
    if (pressed.has('PAUSE')) return this.pause('user')
    if (this.busy || this.fade > 0 || this.fadeGoal > 0) {
      this.queued = null
      this.buffered.clear()
      return
    }
    if (p.moving) return
    if (this.buffered.delete('START')) {
      this.buffered.clear()
      this.cancelAuto()
      this.pause('menu')
      this.emit('menu', { open: true })
      return
    }
    if (this.buffered.delete('CAMERA')) this.emit('camera', { spot: this.photoSpotHere() })
    if (this.buffered.delete('A') && this.interact()) {
      this.queued = null
      return
    }
    const held = this.input.dir
    if (held) this.cancelAuto()
    const queued = this.queued
    this.queued = null
    // 走的中途輕點過的方向：到了先走那一步；再來是按住的；停著時輕點＝轉身；最後是點畫面的路線
    let d: Dir | null = arrived && queued && queued !== held ? queued : (held ?? (!arrived ? queued : null))
    let auto = false
    if (!d && this.autoPath.length) {
      d = this.autoPath[0]!
      auto = true
    }
    if (!d) {
      this.turnT = 0
      this.settleFace()
      return
    }
    if (!auto && !arrived) {
      // 輕點只轉身：原本不是朝這邊就先轉，按住超過 TURN 次才走
      if (d !== p.dir) {
        p.dir = d
        this.turnT = 1
        return
      }
      if (this.turnT > 0 && this.turnT < TURN) {
        // 放開了：就只是轉身
        if (held !== d) this.turnT = 0
        else this.turnT++
        return
      }
    }
    const firstTry = pressed.has(d) || arrived || this.turnT >= TURN || auto
    this.turnT = 0
    const r = this.movePlayer(d, this.running, firstTry)
    if (auto) {
      if (r === 'step' || r === 'jump') this.autoPath.shift()
      else if (r === 'blocked') this.replan(true)
      else this.cancelAuto()
    }
  }

  /** 玩家往 d 走一步（腳本的 walk 也用）：台階、交換夥伴、撞牆、門墊的傳送 */
  movePlayer(d: Dir, run: boolean, firstTry = true): 'step' | 'jump' | 'blocked' | 'warp' | 'script' {
    const p = this.player
    const view = this.view!
    const w = view.warpAt(p.x, p.y)
    if (w && w.on === 'push' && (w.push ?? 'down') === d) {
      p.dir = d
      this.startWarp(w)
      return 'warp'
    }
    const nx = p.x + DX[d]
    const ny = p.y + DY[d]
    const b = view.beh(nx, ny)
    const dur = run ? RUN : WALK
    const fx = p.x
    const fy = p.y
    if (LEDGE[b] === d) {
      const lx = nx + DX[d]
      const ly = ny + DY[d]
      if (passable(view.beh(lx, ly)) && !this.occupant(lx, ly, p)) {
        p.begin('jump', d, JUMP)
        this.follower?.playerLeft(fx, fy)
        this.emit('sfx', { name: 'jump' })
        return 'jump'
      }
    } else if (passable(b)) {
      const o = this.occupant(nx, ny, p)
      const fol = this.follower?.actor
      if (!o) {
        p.begin('step', d, dur)
        this.follower?.playerLeft(fx, fy)
        return 'step'
      }
      if (o === fol && !fol.moving && this.follower) {
        p.begin('step', d, dur)
        this.follower.swap(fx, fy, dur)
        return 'step'
      }
    }
    // 撞到：鎖著的門之類的會說話（剛按下、剛走到時才觸發，按住不會一直跳出來）
    if (firstTry) {
      const hit = this.bumpScript(nx, ny)
      if (hit) {
        p.dir = d
        this.cancelAuto()
        this.run(hit.fn, { self: hit.e, actor: null })
        return 'script'
      }
    }
    p.begin('bump', d, BUMP)
    this.emit('sfx', { name: 'bump' })
    return 'blocked'
  }

  private bumpScript(x: number, y: number): { fn: ScriptFn; e: MapEntity } | null {
    for (const e of this.view!.entitiesAt(x, y)) {
      const fn = entityKind(e.kind)?.bump?.(e, this)
      if (fn) return { fn, e }
    }
    return null
  }

  /** 走到一格之後：傳送點、觸發點 */
  private onArrive() {
    const p = this.player
    const view = this.view!
    this.emit('step', { map: view.map.id, x: p.x, y: p.y })
    const w = view.warpAt(p.x, p.y)
    if (w && (w.on ?? 'step') === 'step') {
      this.cancelAuto()
      this.startWarp(w)
      return
    }
    for (const e of view.entitiesAt(p.x, p.y)) {
      const fn = entityKind(e.kind)?.step?.(e, this)
      if (fn) {
        this.cancelAuto()
        this.run(fn, { self: e, actor: null })
        return
      }
    }
  }

  private photoSpotHere(): MapEntity | null {
    const p = this.player
    return this.view?.entitiesAt(p.x, p.y).find((e) => e.kind === 'photoSpot') ?? null
  }

  /** A：查看面前（櫃台隔一格）的 NPC、告示牌 */
  private interact(): boolean {
    const { x, y } = this.frontCell()
    return this.interactAt(x, y)
  }

  /** A 查看的那一格：面前一格，面前是櫃台就隔一格 */
  private frontCell(): Cell {
    const p = this.player
    const f = p.front()
    return this.view?.beh(f.x, f.y) === B.counter ? p.front(2) : f
  }

  private targetAt(x: number, y: number): { entity: MapEntity; actor: Actor | null } | null {
    const npc = this.npcs.find((a) => !a.hidden && a.covers(x, y)) ?? null
    const ent = npc?.entity ?? this.view?.entitiesAt(x, y).find((e) => entityKind(e.kind)?.interact) ?? null
    return ent ? { entity: ent, actor: npc } : null
  }

  /**
   * 現在按 A 會查看的東西（面前的人、告示牌，隔著櫃台的店員）；沒有 null。
   * 只是查詢（不跑腳本、不轉身）：介面的按鍵提示用（P4，「Z 說話」「Z 查看」）。走路中、腳本中也照當下的格子算。
   */
  facing(): { entity: MapEntity; actor: Actor | null } | null {
    if (!this.view) return null
    const { x, y } = this.frontCell()
    return this.targetAt(x, y)
  }

  /** 有疊在世界上的畫面（坐車的車窗、取景框） */
  get overlaid(): boolean {
    return this.overlay !== null
  }

  /** 對話框開著（say、ask 等玩家按） */
  get talking(): boolean {
    return this.dialog !== null
  }

  /** 淡出的程度（0 = 看得清楚、16 = 全黑）：介面疊在畫面上的東西（小地圖）跟著藏起來 */
  get fadeLevel(): number {
    return this.fade
  }

  private interactAt(x: number, y: number): boolean {
    const p = this.player
    const hit = this.targetAt(x, y)
    if (!hit) return false
    const npc = hit.actor
    const ent = hit.entity
    const fn = entityKind(ent.kind)?.interact?.(ent, this, npc)
    this.emit('interact', { entity: ent, actor: npc })
    if (!fn) return false
    this.cancelAuto()
    if (npc) {
      if (!npc.moving) npc.dir = OPPOSITE[p.dir]
      npc.busy = true
    }
    this.run(fn, { self: ent, actor: npc }, () => {
      if (npc) npc.busy = false
    })
    return true
  }

  // ---------- 點畫面走過去（A*） ----------
  /** 點畫面（邏輯像素）：走到那一格；點到 NPC、告示牌就走到旁邊面向它，已經面向它再點一次就查看 */
  tap(sx: number, sy: number) {
    if (!this.view || this.busy || this.paused) return
    const cam = this.camera()
    this.walkTo(Math.floor((sx + cam.x) / TILE), Math.floor((sy + cam.y) / TILE))
  }

  walkTo(tx: number, ty: number): boolean {
    const view = this.view
    if (!view) return false
    const p = this.player
    const npc = this.npcs.find((a) => !a.hidden && a.covers(tx, ty)) ?? null
    const ent = npc?.entity ?? view.entitiesAt(tx, ty).find((e) => entityKind(e.kind)?.interact) ?? null
    if (!ent && passable(view.beh(tx, ty))) {
      this.autoGoal = { goals: [{ x: tx, y: ty }], target: null, retried: false }
      return this.replan()
    }
    // 已經在旁邊、面向它：查看
    const fr = p.front()
    const fr2 = p.front(2)
    if (ent && !p.moving && ((fr.x === tx && fr.y === ty) || (view.beh(fr.x, fr.y) === B.counter && fr2.x === tx && fr2.y === ty))) {
      this.buffered.add('A')
      return true
    }
    // 走到旁邊（上下左右的一格；隔著櫃台的話是櫃台這一邊），到了面向它
    const goals: Cell[] = []
    for (const d of ['down', 'up', 'left', 'right'] as Dir[]) {
      const ax = tx + DX[d]
      const ay = ty + DY[d]
      if (view.beh(ax, ay) === B.counter) goals.push({ x: ax + DX[d], y: ay + DY[d] })
      else goals.push({ x: ax, y: ay })
    }
    this.autoGoal = { goals: goals.filter((c) => passable(view.beh(c.x, c.y))), target: { x: tx, y: ty }, retried: false }
    return this.replan()
  }

  /** 重新找路（被走過來的 NPC 擋住時再找一次，還是不行就停） */
  private replan(retry = false): boolean {
    const goal = this.autoGoal
    const p = this.player
    if (!goal || !this.view) return false
    if (retry) {
      if (goal.retried) {
        this.cancelAuto()
        return false
      }
      goal.retried = true
    }
    const path = findPath({ x: p.x, y: p.y }, goal.goals, (x, y, d) => this.neighbor(x, y, d), { w: this.view.map.w, h: this.view.map.h })
    if (!path) {
      this.cancelAuto()
      return false
    }
    this.autoPath = path
    this.pendingFace = goal.target ? this.faceAfter(path, goal.target) : null
    if (!path.length) this.settleFace()
    return true
  }

  /** 走完這條路之後要面向哪（目標在旁邊那一格，或隔著櫃台） */
  private faceAfter(path: Dir[], target: Cell): Dir | null {
    let x = this.player.x
    let y = this.player.y
    for (const d of path) {
      const n = this.neighbor(x, y, d)
      if (!n) break
      x = n.x
      y = n.y
    }
    const dx = target.x - x
    const dy = target.y - y
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? 'right' : 'left'
    if (dy !== 0) return dy > 0 ? 'down' : 'up'
    return null
  }

  /** 點畫面的路線走完：轉身面向目標 */
  private settleFace() {
    if (this.autoPath.length || this.player.moving) return
    if (this.pendingFace) this.player.dir = this.pendingFace
    this.pendingFace = null
    this.autoGoal = null
  }

  private cancelAuto() {
    this.autoPath = []
    this.autoGoal = null
    this.pendingFace = null
  }

  /** A* 的鄰居：一般一格；往台階的方向跳兩格；NPC 當作擋住 */
  private neighbor(x: number, y: number, d: Dir): Cell | null {
    const view = this.view!
    const nx = x + DX[d]
    const ny = y + DY[d]
    const b = view.beh(nx, ny)
    if (LEDGE[b] === d) {
      const lx = nx + DX[d]
      const ly = ny + DY[d]
      return passable(view.beh(lx, ly)) && !this.npcAt(lx, ly) ? { x: lx, y: ly } : null
    }
    return passable(b) && !this.npcAt(nx, ny) ? { x: nx, y: ny } : null
  }

  private npcAt(x: number, y: number): boolean {
    return this.npcs.some((a) => !a.hidden && a.solid && a.covers(x, y))
  }

  // ---------- 角色與碰撞 ----------
  /** 這一格被誰佔著（玩家不看夥伴；夥伴不看玩家） */
  occupant(x: number, y: number, self: Actor): Actor | null {
    const fol = this.follower?.actor ?? null
    const p = this.player
    const all: Actor[] = [p, ...this.npcs]
    if (fol) all.push(fol)
    for (const a of all) {
      if (a === self || a.hidden || !a.solid) continue
      if (self === p && a === fol) {
        if (a.covers(x, y)) return a
        continue
      }
      if (self === fol && a === p) continue
      if (a.covers(x, y)) return a
    }
    return null
  }

  private canEnter(a: Actor, x: number, y: number): boolean {
    return passable(this.view!.beh(x, y)) && !this.occupant(x, y, a)
  }

  private readonly npcWorld = {
    canEnter: (a: Actor, x: number, y: number) => this.canEnter(a, x, y),
    nearDoor: (x: number, y: number) => {
      const v = this.view!
      if (v.beh(x, y) === B.door || v.warpAt(x, y)) return true
      // 門前一格（門在上面）
      return v.beh(x, y - 1) === B.door || !!v.warpAt(x, y - 1)
    },
  }

  private readonly followerWorld = {
    beh: (x: number, y: number) => this.view!.beh(x, y),
    blocked: (x: number, y: number) => this.npcAt(x, y),
    playerMoving: () => this.player.moving,
    playerRunning: () => this.player.move?.dur === RUN,
  }

  /** 'player'、'follower'、NPC 的 id → 角色 */
  actorOf(ref: string | Actor): Actor | null {
    if (typeof ref !== 'string') return ref
    if (ref === 'player') return this.player
    if (ref === 'follower') return this.follower?.actor ?? null
    return this.npcs.find((a) => a.id === ref) ?? null
  }

  /** 腳本讓角色走一步（玩家走 movePlayer；NPC 照碰撞走、不跳台階） */
  walkStep(a: Actor, d: Dir, run = false): 'step' | 'jump' | 'blocked' {
    if (a === this.player) {
      const r = this.movePlayer(d, run, false)
      return r === 'step' || r === 'jump' ? r : 'blocked'
    }
    const nx = a.x + DX[d]
    const ny = a.y + DY[d]
    if (!this.canEnter(a, nx, ny)) {
      a.dir = d
      return 'blocked'
    }
    a.begin('step', d, run ? RUN : WALK)
    return 'step'
  }

  // ---------- 地圖 ----------
  /** 進一張地圖：放玩家、夥伴、NPC，地名牌、BGM，自動存檔 */
  private enter(map: GameMap | null, x: number, y: number, dir: Dir): boolean {
    if (!map) return false
    this.map = map
    this.view = new MapView(map)
    const spot = this.landing(x, y)
    this.player.place(spot.x, spot.y, dir)
    this.npcs = []
    for (const e of map.entities) {
      const a = entityKind(e.kind)?.spawn?.(e, this)
      if (a) this.npcs.push(a)
    }
    if (this.follower) {
      const bx = spot.x - DX[dir]
      const by = spot.y - DY[dir]
      const ok = passable(this.view.beh(bx, by)) && !this.npcAt(bx, by)
      this.follower.reset(ok ? bx : spot.x, ok ? by : spot.y, dir)
    }
    this.cancelAuto()
    this.queued = null
    this.buffered.clear()
    this.turnT = 0
    this.lastTime = null
    this.blend = null
    this.emit('mapEnter', { id: map.id, name: map.name, outdoor: map.outdoor })
    const bgm = map.bgm ?? null
    if (bgm !== this.lastBgm) {
      this.lastBgm = bgm
      this.emit('bgm', { name: bgm })
    }
    this.watchClock()
    this.save()
    return true
  }

  /** 存的位置站不上去（地圖改過）：找最近站得上去的一格 */
  private landing(x: number, y: number): Cell {
    const v = this.view!
    const ok = (cx: number, cy: number) => v.inside(cx, cy) && passable(v.beh(cx, cy))
    if (ok(x, y)) return { x, y }
    for (let r = 1; r < 12; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) === r && ok(x + dx, y + dy)) return { x: x + dx, y: y + dy }
    const s = v.map.start
    return s ? { x: s.x, y: s.y } : { x: Math.max(0, Math.min(v.map.w - 1, x)), y: Math.max(0, Math.min(v.map.h - 1, y)) }
  }

  /** 傳送（門、門墊）：開門聲、淡出、換地圖、淡入 */
  startWarp(w: Warp) {
    const self = this
    this.run(function* (s) {
      yield* s.sfx(w.sfx ?? 'door')
      yield* s.fade('out')
      yield* s.warp(w.to, w.tx, w.ty, w.dir ?? self.player.dir)
      yield* s.fade('in')
    }, { self: null, actor: null })
  }

  /** 馬上換地圖（不淡出；腳本的 warp、DEV 傳送） */
  warpNow(mapId: string, x: number, y: number, dir?: Dir): boolean {
    const ok = this.enter(this.opts.maps(mapId), x, y, dir ?? this.player.dir)
    if (!ok && import.meta.env?.DEV) console.warn(`game：沒有地圖 ${mapId}`)
    return ok
  }

  // ---------- 腳本 ----------
  /** 跑一段腳本（預設擋住玩家）；回傳 Runner */
  run(fn: ScriptFn, ctx: Omit<CommandCtx, 'game'> = { self: null, actor: null }, onEnd?: () => void, blocking = true): Runner {
    const api = makeApi({ game: this, ...ctx })
    let gen: Script<unknown>
    try {
      gen = fn(api)
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('game：腳本起不來', e)
      gen = (function* () {})()
    }
    const r = new Runner(gen, ctx.self?.id ?? 'script', blocking, onEnd)
    this.runners.push(r)
    // 同一次更新就開始（說話不延遲一格）
    r.step(0)
    return r
  }

  /** say：交給介面，介面呼叫 resolve 之後回傳 true（沒有人聽 say 時直接往下） */
  openSay(text: string, opts: SayOpts = {}): () => boolean {
    if (!this.events.has('say')) return () => true
    let done = false
    const d: Dialog = { kind: 'say', resolve: () => (done = true) }
    this.dialog = d
    this.emit('say', {
      text,
      who: opts.who,
      source: opts.source,
      resolve: () => {
        if (done) return
        done = true
        if (this.dialog === d) this.dialog = null
      },
    })
    return () => done
  }

  openAsk(text: string, options: string[], opts: SayOpts & { cancel?: number } = {}): { done: () => boolean; value: () => number } {
    const cancel = Math.max(0, Math.min(options.length - 1, opts.cancel ?? options.length - 1))
    if (!this.events.has('ask')) return { done: () => true, value: () => 0 }
    let value = -1
    const d: Dialog = { kind: 'ask', cancel, resolve: (i: number) => (value = i) }
    this.dialog = d
    this.emit('ask', {
      text,
      options,
      who: opts.who,
      source: opts.source,
      cancel,
      resolve: (i: number) => {
        if (value >= 0) return
        value = Math.max(0, Math.min(options.length - 1, Math.round(i)))
        if (this.dialog === d) this.dialog = null
      },
    })
    return { done: () => value >= 0, value: () => value }
  }

  /** 淡出（畫面變黑）／淡入 */
  fadeTo(dir: 'out' | 'in') {
    this.fadeGoal = dir === 'out' ? 16 : 0
    if (this.reducedMotion) this.fade = this.fadeGoal
  }
  get fadeDone(): boolean {
    return this.fade === this.fadeGoal
  }

  changed(what: GameEvents['change']['what']) {
    this.emit('change', { what })
  }

  setWeather(w: Weather) {
    this.weather = w
  }

  /** 換玩家、夥伴的外觀（P1：生成好的旅人） */
  setLook(look: ActorLook) {
    this.player.look = look
  }
  setFollowerLook(look: ActorLook) {
    if (this.follower) this.follower.actor.look = look
  }

  /** 接上鍵盤（回傳拆掉的函式） */
  attachKeyboard(target: Window = window): () => void {
    return attachKeyboard(this.input, target)
  }

  /** DEV、測試：把對話、選項、淡出淡入都跳過 */
  skip() {
    const d = this.dialog
    if (d?.kind === 'say') d.resolve()
    else if (d?.kind === 'ask') d.resolve(d.cancel)
    this.dialog = null
    this.fade = this.fadeGoal
  }
}
