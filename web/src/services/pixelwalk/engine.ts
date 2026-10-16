import { Gfx, dotOn } from './gfx'
import { HeroState } from './hero'
import { makePalette, type Palette, type Season, type TimeOfDay, type Tokens } from './palette'
import { rng, type Rng, seedOf } from './rng'
import { Runner } from './script'
import type { Sprite } from './sprite'
import {
  type Actor,
  type ActorInit,
  type AreaDef,
  type Env,
  type EventDef,
  FLOOR,
  H,
  type Handle,
  type Script,
  type Stage,
  type TransitionDef,
  type TransitionStage,
  type Z,
} from './types'

/**
 * 像素散步的引擎（DESIGN.md §14a）：一區一區走下去。每一區照時段、季節先把天空與各層背景畫成長條（軟體點陣），
 * 每一格把長條依視差貼上、再畫腳本的角色與旅人，整格 putImageData。腳本隨機挑（地區自己的優先），
 * 走到這一區的盡頭就挑一個轉場換到下一區。不碰 DOM，Vue 元件只負責 canvas、大小與暫停。
 */
export const WALK_SPEED = 22
/** 走到盡頭後地面還能再捲多遠：轉場（隧道、鳥居）要旅人再走一段 */
const RUNOUT = 120
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
const TIMES: TimeOfDay[] = ['day', 'dusk', 'night']
const TIME_WEIGHT: Record<TimeOfDay, number> = { day: 0.55, dusk: 0.25, night: 0.2 }

export interface EngineOpts {
  tokens: Tokens
  areas: AreaDef[]
  events: EventDef[]
  transitions: TransitionDef[]
  seed?: number
  /** 第一區（預設京都） */
  first?: string
  /** 換到新的一區（banner） */
  onArea?(area: AreaDef, env: Env): void
}

interface Scene {
  area: AreaDef
  env: Env
  pal: Palette
  sky: Gfx
  layers: Array<{ speed: number; g: Gfx }>
  ground: Gfx
  front: { speed: number; g: Gfx } | null
  /** 幾格寬時畫的（變寬了要重畫） */
  builtW: number
  seed: number
}

interface ActorRec extends Actor {
  owner: Runner | null
}
interface PaintRec {
  z: Z
  fn: (g: Gfx, t: number) => void
  t: number
  owner: Runner | null
  alive: boolean
}

export class PixelWalkEngine {
  W: number
  readonly rng: Rng
  readonly hero = new HeroState()
  frame: Gfx
  private readonly opts: EngineOpts
  private readonly palettes = new Map<TimeOfDay, Palette>()
  private scene: Scene
  private old: { scene: Scene; left: number } | null = null
  private oldFrame: Gfx | null = null
  cam = 0
  t = 0
  dt = 1 / 60
  private visits = 0
  private runners: Runner[] = []
  private actors: ActorRec[] = []
  private paints: PaintRec[] = []
  private walkT = 0
  /** 地名牌還要等幾秒（轉場還蓋著畫面）；0 = 沒有在等 */
  private announceIn = 0
  /** 走到盡頭時還有主要腳本在跑：等它跑完（最多 8 秒）再轉場 */
  private endWait = 0
  private gap = 4
  private recent: string[] = []
  private ambientAt = Infinity
  private transition: { runner: Runner; next: AreaDef; nextEnv: Env; swapped: boolean; t: number } | null = null
  private prevArea: string | null = null
  private lastTransition: string | null = null
  /** 目前在跑的腳本（除錯、預覽用） */
  current: string[] = []

  constructor(opts: EngineOpts, W: number) {
    if (!opts.areas.length) throw new Error('pixelwalk：沒有地區')
    this.opts = opts
    this.W = Math.round(W)
    this.rng = rng(opts.seed ?? (Date.now() & 0xffffffff))
    this.frame = new Gfx(this.W, H, this.pal('day'))
    const first = opts.areas.find((a) => a.id === (opts.first ?? 'kyoto')) ?? opts.areas[0]!
    this.scene = this.build(first, this.pickEnv(first))
    this.enter()
  }

  // ---------- 外面用的 ----------
  get area() {
    return this.scene.area
  }
  get env() {
    return this.scene.env
  }

  resize(W: number) {
    W = Math.round(W)
    if (W === this.W) return
    this.W = W
    this.frame = new Gfx(W, H, this.scene.pal)
    this.oldFrame = null
    if (W > this.scene.builtW) {
      // 變寬要重畫整條（排法會變）：正在跑的腳本指著舊的位置，收掉（轉場留著）
      this.killAll(this.transition?.runner ?? null)
      // 驟雨、下雪的腳本收掉了：天氣也回到晴天
      this.scene = this.build(this.scene.area, { ...this.scene.env, weather: 'clear' }, this.scene.seed)
    } else this.scene.sky = this.drawSky(this.scene.area, this.scene.env, this.scene.pal, this.scene.seed)
    this.old = null
    const busy = this.transition !== null || this.runners.some((r) => r.kind === 'main' && !r.done)
    if (busy) {
      // 腳本、轉場進行中：旅人留在原地（跟道具對齊），只是別跑出畫面
      this.hero.x = Math.min(this.hero.x, W - 16)
    } else {
      // 旅人回到 0.32W，地面跟著挪，腳下還是同一個地方
      const nx = Math.round(W * 0.32)
      this.cam = Math.min(Math.max(0, this.cam - (nx - this.hero.x)), this.camMax())
      this.hero.x = nx
    }
    this.hero.cam = this.cam
  }

  /** 點一下：旅人跳一下 */
  poke() {
    this.hero.jump(9)
  }

  /** 預覽、測試：換到指定的一區與環境 */
  forceArea(id: string, env: Partial<Env> = {}, seed?: number) {
    const area = this.opts.areas.find((a) => a.id === id)
    if (!area) throw new Error(`pixelwalk：沒有 ${id}`)
    this.killAll()
    this.transition = null
    this.scene = this.build(area, { ...this.pickEnv(area), ...env }, seed)
    this.enter()
  }
  /** 預覽、測試：馬上跑某個腳本 */
  startEvent(def: EventDef) {
    return this.run(def, def.kind ?? 'main')
  }
  /** 預覽、測試：馬上用某個轉場到某一區 */
  startTransition(def: TransitionDef, nextId?: string) {
    const next = (nextId && this.opts.areas.find((a) => a.id === nextId)) || this.pickNext()
    this.beginTransition(def, next)
  }
  /** 預覽：不要自己挑腳本 */
  autoEvents = true

  // ---------- 一格 ----------
  update(dt: number) {
    this.dt = dt
    const hero = this.hero
    hero.cam = this.cam
    hero.update(dt)
    if (hero.walking) this.cam = Math.min(this.cam + WALK_SPEED * hero.speed * dt, this.camMax())
    // 旅人不在 0.32W（轉場中途調過視窗大小）：沒有腳本時一秒挪 10 格回去，看起來是走快一點或慢一點
    const home = Math.round(this.W * 0.32)
    if (hero.walking && hero.x !== home && !this.transition && !this.runners.some((r) => r.kind === 'main' && !r.done)) {
      const d = home - hero.x
      hero.x += Math.sign(d) * Math.min(Math.abs(d), 10 * dt)
      if (Math.abs(home - hero.x) < 0.01) hero.x = home
    }
    hero.cam = this.cam
    this.t += dt

    for (const r of [...this.runners]) r.step(dt)
    // 轉場卡住（等的條件一直不成立）：25 秒後收掉，直接換過去
    if (this.transition && (this.transition.t += dt) > 25) this.transition.runner.stop()
    this.reap()
    for (const a of this.actors) {
      if (!a.alive) continue
      a.age += dt
      a.vy += a.gravity * dt
      a.x += a.vx * dt
      a.y += a.vy * dt
      if (a.fps > 0 && a.frames.length > 1) a.frame = Math.floor(a.age * a.fps) % a.frames.length
      try {
        a.update?.(a, dt)
      } catch (e) {
        // 一個角色壞掉不要讓整段停住
        a.alive = false
        if (import.meta.env?.DEV) console.warn('pixelwalk：角色動不了', e)
      }
    }
    for (const p of this.paints) p.t += dt
    if (this.announceIn > 0) {
      this.announceIn -= dt
      if (this.announceIn <= 0) this.announce()
    }
    if (this.old) {
      this.old.left -= dt
      if (this.old.left <= 0) this.old = null
    }
    this.schedule(dt)
  }

  render(): Gfx {
    if (this.old) {
      this.oldFrame ??= new Gfx(this.W, H, this.old.scene.pal)
      this.oldFrame.pal = this.old.scene.pal
      this.draw(this.old.scene, this.oldFrame)
    }
    this.frame.pal = this.scene.pal
    this.draw(this.scene, this.frame)
    if (this.old && this.oldFrame) {
      // 新的一層抖色慢慢蓋過來：還沒輪到的格子用舊的
      const level = Math.round((1 - this.old.left / 1.2) * 16)
      const { buf, w, h } = this.frame
      const ob = this.oldFrame.buf
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!dotOn(x, y, level)) buf[y * w + x] = ob[y * w + x]!
    }
    return this.frame
  }

  // ---------- 畫 ----------
  private pal(time: TimeOfDay) {
    let p = this.palettes.get(time)
    if (!p) {
      p = makePalette(this.opts.tokens, time)
      this.palettes.set(time, p)
    }
    return p
  }

  private drawSky(area: AreaDef, env: Env, pal: Palette, seed: number) {
    const g = new Gfx(this.W, H, pal)
    try {
      area.sky(g, env, rng(seedOf(seed, 'sky')))
    } catch (e) {
      if (import.meta.env?.DEV) console.warn(`pixelwalk：${area.id} 的天空畫不出來`, e)
    }
    return g
  }

  private build(area: AreaDef, env: Env, seed = seedOf(area.id, this.visits, this.rng.int(0, 1e9))): Scene {
    const pal = this.pal(env.time)
    const margin = this.W + 64
    const strip = (speed: number, draw: AreaDef['ground']['draw'], key: string) => {
      const w = Math.ceil((area.length + this.W * 0.5 + RUNOUT) * speed) + margin
      const g = new Gfx(w, H, pal)
      try {
        draw(g, w, rng(seedOf(seed, key)), env, this.W)
      } catch (e) {
        if (import.meta.env?.DEV) console.warn(`pixelwalk：${area.id} 的 ${key} 畫不出來`, e)
      }
      return g
    }
    return {
      area,
      env,
      pal,
      seed,
      builtW: this.W,
      sky: this.drawSky(area, env, pal, seed),
      layers: area.layers.map((l, i) => ({ speed: l.speed, g: strip(l.speed, l.draw.bind(l), `layer${i}`) })),
      ground: strip(1, area.ground.draw.bind(area.ground), 'ground'),
      front: area.front ? { speed: area.front.speed, g: strip(area.front.speed, area.front.draw.bind(area.front), 'front') } : null,
    }
  }

  /** 旅人畫在暫存的一張上，前景長條在那一格不透明時才用抖色貼回去 */
  private ghost(g: Gfx, front: Gfx, fx: number) {
    const x0 = Math.max(0, Math.round(this.hero.x) - 16)
    const x1 = Math.min(this.W, Math.round(this.hero.x) + 16)
    const y0 = Math.max(0, Math.round(this.hero.y) - 48)
    const y1 = Math.min(H, Math.round(this.hero.y) + 3)
    if (x1 <= x0 || y1 <= y0) return
    if (!this.ghostBuf || this.ghostBuf.w !== this.W) this.ghostBuf = new Gfx(this.W, H, g.pal)
    const t = this.ghostBuf
    t.pal = g.pal
    t.cut(x0, y0, x1 - x0, y1 - y0)
    this.hero.draw(t)
    const fw = front.w
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const v = t.buf[y * t.w + x]!
        const sx = x + fx
        if (v !== 0 && sx >= 0 && sx < fw && front.buf[y * fw + sx] !== 0 && dotOn(x, y, 8)) g.buf[y * g.w + x] = v
      }
  }
  private ghostBuf: Gfx | null = null

  private draw(sc: Scene, g: Gfx) {
    const W = this.W
    g.ox = 0
    g.oy = 0
    g.blit(sc.sky, 0, 0, W, H, 0, 0, true)
    this.drawZ(g, 'sky')
    for (const l of sc.layers) g.blit(l.g, Math.round(this.cam * l.speed), 0, W, H, 0, 0)
    this.drawZ(g, 'mid')
    g.blit(sc.ground, Math.round(this.cam), 0, W, H, 0, 0)
    this.drawZ(g, 'back')
    this.hero.draw(g)
    this.drawZ(g, 'front')
    if (sc.front) {
      const fx = Math.round(this.cam * sc.front.speed)
      g.blit(sc.front.g, fx, 0, W, H, 0, 0)
      // 停下來看東西時被前景的樹、柱子擋住：旅人用抖色透出來（只在前景蓋住的格子，拿在手上的東西照舊）
      if (!this.hero.walking && !this.transition && !this.hero.hidden) this.ghost(g, sc.front.g, fx)
    }
    this.drawZ(g, 'over')
  }

  private drawZ(g: Gfx, z: Z) {
    for (const a of this.actors) {
      if (a.z !== z || !a.alive || a.hidden) continue
      const sx = a.sx()
      try {
        if (a.draw) a.draw(g, sx, a.y, a)
        else {
          const s: Sprite | undefined = a.frames[a.frame % Math.max(1, a.frames.length)]
          if (s) g.sprite(s, Math.round(sx - s.w / 2), Math.round(a.y - s.h), { flip: a.flip, level: a.level })
        }
      } catch (e) {
        a.alive = false
        if (import.meta.env?.DEV) console.warn('pixelwalk：角色畫不出來', e)
      }
    }
    for (const p of this.paints) {
      if (p.z !== z || !p.alive) continue
      try {
        g.ox = 0
        g.oy = 0
        p.fn(g, p.t)
      } catch (e) {
        p.alive = false
        if (import.meta.env?.DEV) console.warn('pixelwalk：畫不出來', e)
      } finally {
        g.ox = 0
        g.oy = 0
      }
    }
  }

  // ---------- 一區 ----------
  private pickEnv(area: AreaDef): Env {
    const seasons = area.seasons?.length ? area.seasons : SEASONS
    const times = area.times?.length ? area.times : TIMES
    return { season: this.rng.pick(seasons), time: this.rng.weighted(times, (t) => TIME_WEIGHT[t]), weather: 'clear' }
  }

  private enter(later = false) {
    this.cam = 0
    this.t = 0
    this.visits++
    this.walkT = 0
    this.gap = this.rng.range(2.5, 5)
    this.ambientAt = this.rng.chance(0.65) ? this.rng.range(5, Math.max(8, this.scene.area.length / WALK_SPEED - 15)) : Infinity
    // 轉場換過去：旅人留在轉場畫他的地方（中途調過視窗大小也一樣），之後慢慢走回 0.32W
    this.hero.x = later ? Math.min(this.hero.x, this.W - 16) : Math.round(this.W * 0.32)
    this.hero.walk()
    this.hero.hold = null
    this.hero.speed = 1
    this.hero.face('right')
    // 轉場換過去時畫面通常還蓋著：地名牌等轉場揭開（結束或 1.4 秒後）再出來
    this.endWait = 0
    if (later) this.announceIn = 3
    else this.announce()
  }

  /** 換時段、天氣：同一個種子重畫，1.2 秒抖色淡過去 */
  private restyle(patch: Partial<Env>) {
    const env = { ...this.scene.env, ...patch }
    if (env.weather === 'rain' && env.season === 'winter' && this.scene.area.snowy) env.weather = 'snow'
    if (env.time === this.scene.env.time && env.season === this.scene.env.season && env.weather === this.scene.env.weather) return
    const prev = this.scene
    this.scene = this.build(prev.area, env, prev.seed)
    this.old = { scene: prev, left: 1.2 }
  }

  private announce() {
    this.announceIn = 0
    this.opts.onArea?.(this.scene.area, this.scene.env)
  }

  private pickNext(): AreaDef {
    const all = this.opts.areas
    const pool = all.filter((a) => a.id !== this.scene.area.id && (all.length < 3 || a.id !== this.prevArea))
    return this.rng.pick(pool.length ? pool : all)
  }

  private schedule(dt: number) {
    if (!this.autoEvents) return
    const area = this.scene.area
    if (!this.transition && this.cam >= area.length) {
      // 主要腳本還在演：等它（最多 8 秒，或地面到底）再轉場，道具不會一下子消失
      const busy = this.runners.some((r) => r.kind === 'main' && !r.done)
      if (busy && this.endWait < 8 && this.cam < area.length + this.W * 0.5 - 1) {
        this.endWait += dt
        return
      }
      const next = this.pickNext()
      const fits = this.opts.transitions.filter((t) => !t.fits || t.fits(area, next))
      const pool = fits.filter((t) => t.id !== this.lastTransition)
      const def = this.rng.weighted(pool.length ? pool : fits, (t) => t.weight ?? 1)
      if (def) this.beginTransition(def, next)
      else this.swapTo(next, this.pickEnv(next))
      return
    }
    if (this.transition) return
    const hasMain = this.runners.some((r) => r.kind === 'main' && !r.done)
    if (!hasMain && this.hero.walking) {
      this.walkT += dt
      if (this.walkT >= this.gap && this.cam < area.length - this.W * 0.7 - 120) {
        const def = this.pick('main')
        if (def) this.run(def, 'main')
        this.walkT = 0
        this.gap = this.rng.range(3, 6.5)
      }
    }
    if (this.t >= this.ambientAt && !this.runners.some((r) => r.kind === 'ambient' && !r.done)) {
      this.ambientAt = Infinity
      const def = this.pick('ambient')
      if (def) this.run(def, 'ambient')
    }
  }

  private fitsEnv(e: EventDef) {
    const { env, area } = this.scene
    if (e.when?.time && !e.when.time.includes(env.time)) return false
    if (e.when?.season && !e.when.season.includes(env.season)) return false
    if (e.when?.weather && !e.when.weather.includes(env.weather)) return false
    if (e.tags && !e.tags.some((t) => area.tags.includes(t))) return false
    if (e.except?.includes(area.id)) return false
    if (e.ready) {
      try {
        if (!e.ready(this.probe)) return false
      } catch (err) {
        if (import.meta.env?.DEV) console.warn(`pixelwalk：${e.id} 的 ready 丟錯`, err)
        return false
      }
    }
    return true
  }

  /** 給 ready() 看的 Stage（只能讀） */
  private get probe(): Stage {
    return (this.probeStage ??= this.stage(() => {
      throw new Error('ready() 不能 spawn、paint')
    }))
  }
  private probeStage: Stage | null = null

  private pick(kind: 'main' | 'ambient'): EventDef | null {
    const local = (this.scene.area.events ?? []).filter((e) => (e.kind ?? 'main') === kind && this.fitsEnv(e))
    const shared = this.opts.events.filter((e) => (e.kind ?? 'main') === kind && this.fitsEnv(e))
    const all = [...local.map((e) => ({ e, w: (e.weight ?? 1) * 2.5 })), ...shared.map((e) => ({ e, w: e.weight ?? 1 }))]
    const fresh = all.filter((x) => !this.recent.includes(x.e.id))
    const pool = fresh.length ? fresh : all
    if (!pool.length) return null
    const { e } = this.rng.weighted(pool, (x) => x.w)
    this.recent.push(e.id)
    if (this.recent.length > 8) this.recent.shift()
    return e
  }

  // ---------- 腳本 ----------
  private run(def: EventDef, kind: 'main' | 'ambient'): Runner {
    let runner: Runner
    const stage = this.stage(() => runner)
    runner = new Runner(def.run(stage), kind, def.id)
    this.runners.push(runner)
    return runner
  }

  private beginTransition(def: TransitionDef, next: AreaDef) {
    // 這一區的腳本都收掉；驟雨、下雪收掉了，天空也回到晴天（淡過去）
    this.killAll()
    if (this.scene.env.weather !== 'clear') this.restyle({ weather: 'clear' })
    const nextEnv = this.pickEnv(next)
    let runner: Runner
    const base = this.stage(() => runner)
    const tr = { runner: null as unknown as Runner, next, nextEnv, swapped: false, t: 0 }
    const stage: TransitionStage = Object.assign(Object.create(base) as TransitionStage, {
      next,
      swap: () => {
        if (tr.swapped) return
        tr.swapped = true
        this.swapTo(next, nextEnv, runner)
      },
      reveal: () => {
        if (this.announceIn > 0) this.announce()
      },
    })
    Object.defineProperty(stage, 'next', { value: next })
    runner = new Runner(def.run(stage), 'transition', def.id)
    tr.runner = runner
    this.transition = tr
    this.lastTransition = def.id
    this.runners.push(runner)
  }

  private swapTo(next: AreaDef, env: Env, keep: Runner | null = null) {
    this.killAll(keep)
    this.prevArea = this.scene.area.id
    this.scene = this.build(next, env)
    this.old = null
    this.enter(keep !== null)
  }

  private killAll(keep: Runner | null = null) {
    for (const r of this.runners) if (r !== keep) r.stop()
    this.runners = this.runners.filter((r) => r === keep)
    this.actors = this.actors.filter((a) => a.owner === keep && keep !== null)
    this.paints = this.paints.filter((p) => p.owner === keep && keep !== null)
    if (!keep) {
      this.hero.walk()
      this.hero.hidden = false
      this.hero.hold = null
      this.hero.speed = 1
      this.hero.face('right')
    }
  }

  /** 前景長條蓋住旅人身體（腳到肩）的比例 */
  private frontCover() {
    const f = this.scene.front
    if (!f) return 0
    const fx = Math.round(this.cam * f.speed)
    const x0 = Math.round(this.hero.x) - 5
    let n = 0
    let on = 0
    for (let y = FLOOR - 18; y < FLOOR - 3; y++)
      for (let x = x0; x < x0 + 10; x++) {
        const sx = x + fx
        if (sx < 0 || sx >= f.g.w) continue
        n++
        if (f.g.buf[y * f.g.w + sx] !== 0) on++
      }
    return n ? on / n : 0
  }

  /** 地面最多捲到哪：這一區的長度＋半個畫面＋轉場要走的一段（RUNOUT） */
  private camMax() {
    return this.scene.area.length + this.W * 0.5 + RUNOUT
  }

  private reap() {
    const done = this.runners.filter((r) => r.done)
    if (done.length) {
      for (const r of done) {
        for (const a of this.actors) if (a.owner === r) a.alive = false
        for (const p of this.paints) if (p.owner === r) p.alive = false
        if (this.transition?.runner === r) {
          const tr = this.transition
          this.transition = null
          if (!tr.swapped) this.swapTo(tr.next, tr.nextEnv)
          if (this.announceIn > 0) this.announce()
          this.hero.hidden = false
          this.hero.walk()
        }
        if (r.kind === 'main') {
          // 腳本結束：旅人照常走（腳本忘了 walk() 也不會停在原地）
          this.hero.walk()
          this.hero.face('right')
          this.hero.speed = 1
          this.hero.hidden = false
          this.hero.hold = this.scene.env.weather === 'rain' ? this.hero.hold : null
        }
      }
      this.runners = this.runners.filter((r) => !r.done)
    }
    this.actors = this.actors.filter((a) => a.alive)
    this.paints = this.paints.filter((p) => p.alive)
    this.current = this.runners.map((r) => r.id)
  }

  private stage(owner: () => Runner): Stage {
    const self = this
    const stage: Stage = {
      get W() {
        return self.W
      },
      H,
      FLOOR,
      get dt() {
        return self.dt
      },
      get rng() {
        return self.rng
      },
      get env() {
        return self.scene.env
      },
      get area() {
        return self.scene.area
      },
      get cam() {
        return self.cam
      },
      get t() {
        return self.t
      },
      get hero() {
        return self.hero
      },
      spawn(init: ActorInit): Actor {
        const frames = init.frames === undefined ? [] : Array.isArray(init.frames) ? init.frames : [init.frames]
        const a: ActorRec = {
          x: init.x,
          y: init.y,
          space: init.space ?? 'world',
          z: init.z ?? 'back',
          flip: init.flip ?? false,
          vx: init.vx ?? 0,
          vy: init.vy ?? 0,
          gravity: init.gravity ?? 0,
          level: init.level ?? 16,
          fps: init.fps ?? 6,
          frames,
          frame: 0,
          age: 0,
          alive: true,
          hidden: false,
          draw: init.draw,
          update: init.update,
          owner: owner(),
          sx() {
            return this.space === 'screen' ? this.x : this.x - self.cam * (this.space === 'world' ? 1 : this.space)
          },
          remove() {
            this.alive = false
          },
        }
        self.actors.push(a)
        return a
      },
      paint(z: Z, fn: (g: Gfx, t: number) => void): Handle {
        const p: PaintRec = { z, fn, t: 0, owner: owner(), alive: true }
        self.paints.push(p)
        return { stop: () => (p.alive = false) }
      },
      setEnv(patch: Partial<Env>) {
        self.restyle(patch)
      },
      *wait(sec: number): Script {
        yield sec
      },
      *clearOfFront(max = 3): Script {
        let t = 0
        while (t < max && self.frontCover() > 0.2) {
          t += self.dt
          yield null
        }
      },
      *move(a: Actor, x: number, speed: number): Script {
        a.flip = x < a.x
        while (Math.abs(x - a.x) > 0.01 && a.alive) {
          const step = speed * self.dt
          a.x = Math.abs(x - a.x) <= step ? x : a.x + Math.sign(x - a.x) * step
          yield null
        }
      },
    }
    return stage
  }
}

export { H, FLOOR }
