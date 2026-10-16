import { drawSprite } from '../build'
import type { Gfx } from '../gfx'
import { EMOTES } from '../hero'
import { skyBase } from '../kit'
import type { Px } from '../palette'
import { rng, type Rng } from '../rng'
import type { Sprite } from '../sprite'
import { type Actor, type AreaDef, type Emote, type Env, type EventDef, FLOOR, H, type Script, type Stage } from '../types'

/**
 * 東京：遠景是高樓的天際線，東京鐵塔或晴空塔；中景是辦公大樓的窗格與高架鐵路（電車從上面開過）；
 * 地面是人行道：斑馬線與行人號誌、自動販賣機、便利商店樣式的店、雜居大樓的直招牌、夜裡的拉麵屋台、
 * 春天上野、千鳥之淵那樣的櫻花步道（秋天是銀杏）。前景偶爾有電線桿與電線。
 * 遠景 0.12、中景 0.4、地面 1、前景 1.3。
 */
const PATH = FLOOR - 8
const FAR = 0.12
const MID = 0.4
const FRONT = 1.3
/** 高架橋護欄的上緣（電車只露出這以上） */
const RAIL = 92
/** 架空線 */
const WIRE = 77

/** 依時段選 */
export const tod = <T>(env: Env, day: T, dusk: T, night: T): T => (env.time === 'day' ? day : env.time === 'dusk' ? dusk : night)
/** 燈亮著嗎（黃昏也開燈） */
const lit = (env: Env) => env.time !== 'day'

// ---------- 路人（東京、大阪共用） ----------
export interface Look {
  top: Px
  shade: Px
  legs: Px
  hair: Px
  /** 裙子 */
  skirt?: boolean
  /** 長髮 */
  long?: boolean
  /** 襯衫領口與領帶 */
  shirt?: Px
  tie?: Px
  /** 手上提的包 */
  bag?: Px
  /** 帽子 */
  cap?: Px
  shoes?: Px
  /** 矮幾格 */
  short?: number
}

const DARKER: Partial<Record<Px, Px>> = {
  'roof-1': 'roof-2', 'roof-2': 'roof-3', 'roof-3': 'ink-2', 'stone-1': 'stone-2', 'stone-2': 'stone-3', 'stone-3': 'stone-4', 'stone-4': 'ink-2',
  'wood-1': 'wood-2', 'wood-2': 'wood-3', 'cloth-1': 'cloth-2', 'cloth-2': 'roof-3', 'paper': 'paper-2', 'paper-2': 'stone-2', 'white': 'stone-1',
  'shu-1': 'shu-2', 'leaf-2': 'leaf-3', 'leaf-3': 'leaf-4', 'sakura-1': 'sakura-2', 'momiji-1': 'momiji-2', 'gold-1': 'gold-2', 'sea-2': 'sea-3',
  'lavender': 'roof-1', 'dirt-1': 'dirt-2', 'sand-2': 'dirt-2',
}
export const dark = (k: Px): Px => DARKER[k] ?? 'ink-2'

/** 路人一格（15×25，朝右，腳底在最下面）：f 0–3 走、-1 站、run 跑 */
function personFrame(l: Look, f: number, run = false): Sprite {
  return drawSprite(15, 25, (g) => {
    const stand = f < 0
    const st = stand ? 0 : run ? [2, 0, -2, 0][f % 4]! : [1, 0, -1, 0][f % 4]!
    const y = (l.short ?? 0) + (!stand && f % 2 ? -1 : 0)
    const lean = run ? 1 : 0
    const shoes = l.shoes ?? 'ink-2'
    const legTop = 18 + y
    const leg = (x: number, k: Px, lift: number) => {
      g.rect(x, legTop, 2, 23 - legTop - lift, k)
      g.rect(x, 23 - lift, 3, 1, shoes)
    }
    // 後面的腳
    leg(5 - st, l.skirt ? 'skin-2' : dark(l.legs), run && st < 0 ? 1 : 0)
    // 長髮在身體後面
    if (l.long) g.rect(3 + lean, 6 + y, 4, 8, l.hair)
    // 身體
    g.rect(4 + lean, 11 + y, 7, 7, l.top)
    g.rect(4 + lean, 11 + y, 1, 7, l.shade)
    g.rect(10 + lean, 11 + y, 1, 7, l.shade)
    if (l.shirt) {
      g.rect(8 + lean, 11 + y, 2, 2, l.shirt)
      if (l.tie) g.rect(9 + lean, 12 + y, 1, run && f % 2 ? 2 : 4, l.tie)
      if (l.tie && run) g.px(10 + lean + (f % 2), 12 + y, l.tie) // 跑起來領帶飛
    }
    if (l.skirt) {
      g.rect(4, 16 + y, 7, 3, l.legs)
      g.rect(3, 18 + y, 9, 2, l.legs)
    }
    // 前面的腳
    leg(7 + st, l.skirt ? 'skin-1' : l.legs, run && st > 0 ? 1 : 0)
    // 手（擺動）與包
    const arm = stand ? 0 : run ? -st : -st
    g.rect(7 + lean + arm, 12 + y, 2, 4, l.shade)
    g.rect(7 + lean + arm, 16 + y, 2, 1, 'skin-1')
    if (l.bag) {
      g.rect(6 + lean + arm, 17 + y, 5, 4, l.bag)
      g.hline(7 + lean + arm, 9 + lean + arm, 16 + y, dark(l.bag))
    }
    // 頭
    const hx = lean
    g.ellipse(7 + hx, 6 + y, 4, 4, l.hair)
    g.rect(7 + hx, 5 + y, 4, 5, 'skin-1')
    g.px(11 + hx, 7 + y, 'skin-1')
    g.rect(6 + hx, 2 + y, 5, 3, l.hair) // 瀏海
    g.px(11 + hx, 4 + y, l.hair)
    g.px(9 + hx, 6 + y, 'ink')
    g.px(7 + hx, 10 + y, 'skin-2')
    if (l.cap) {
      g.rect(3 + hx, 1 + y, 8, 3, l.cap)
      g.rect(10 + hx, 3 + y, 3, 1, dark(l.cap))
    }
  })
}

export interface People {
  walk: Sprite[]
  stand: Sprite[]
  run: Sprite[]
}
export function people(l: Look): People {
  return {
    walk: [0, 1, 2, 3].map((f) => personFrame(l, f)),
    stand: [personFrame(l, -1)],
    run: [0, 1, 2, 3].map((f) => personFrame(l, f, true)),
  }
}

/** 東京的路人：上班族、學生、觀光客… */
const LOOKS: Look[] = [
  { top: 'roof-3', shade: 'ink-2', legs: 'roof-3', hair: 'hair', shirt: 'white', tie: 'shu-2', bag: 'ink-2' },
  { top: 'stone-4', shade: 'ink-2', legs: 'stone-4', hair: 'hair', shirt: 'white', tie: 'cloth-1', bag: 'wood-3' },
  { top: 'paper-2', shade: 'dirt-2', legs: 'roof-3', hair: 'wood-3', long: true, skirt: true, bag: 'shu-2' },
  { top: 'white', shade: 'stone-1', legs: 'cloth-2', hair: 'hair', long: true },
  { top: 'roof-2', shade: 'roof-3', legs: 'roof-3', hair: 'hair', skirt: true, shirt: 'white', tie: 'shu-1', short: 1 },
  { top: 'momiji-1', shade: 'momiji-2', legs: 'cloth-2', hair: 'gold-2', cap: 'stone-4' },
  { top: 'leaf-3', shade: 'leaf-4', legs: 'stone-3', hair: 'stone-1', cap: 'wood-2' },
  { top: 'sakura-2', shade: 'shu-2', legs: 'paper', hair: 'wood-3', long: true, skirt: true },
  { top: 'sea-2', shade: 'sea-3', legs: 'stone-1', hair: 'hair', bag: 'bag' },
  { top: 'lavender', shade: 'roof-1', legs: 'roof-3', hair: 'wood-2', long: true },
]
const CROWD = LOOKS.map(people)
const SALARYMAN = CROWD[0]!

// ---------- 小東西 ----------
/** NPC 頭上的符號（同旅人的框）：跟著 who */
export function say(s: Stage, who: Actor, e: Emote, top = 30, sec = 1.3): Actor {
  return s.spawn({
    frames: EMOTES[e],
    fps: 0,
    x: who.x,
    y: who.y - top,
    space: who.space,
    z: 'over',
    update(a) {
      a.x = who.x + (who.flip ? -3 : 3)
      a.y = who.y - top - (Math.floor(a.age * 4) % 2)
      if (a.age > sec || !who.alive) a.remove()
    },
  })
}

/** 一群人一起動（各走各的，不擋腳本）：to 走到哪、v 速度；走到就站著 */
export interface Npc {
  a: Actor
  to: number | null
  v: number
  ty: number | null
  vy: number
  set: People
}
export function npc(s: Stage, set: People, x: number, y: number, flip = false): Npc {
  const n: Npc = { a: null as unknown as Actor, to: null, v: 0, ty: null, vy: 0, set }
  n.a = s.spawn({
    frames: set.stand,
    fps: 0,
    x,
    y,
    flip,
    z: y > s.FLOOR ? 'front' : 'back',
    update(a, dt) {
      let moving = false
      if (n.to !== null) {
        const d = n.to - a.x
        const step = n.v * dt
        if (Math.abs(d) <= step) {
          a.x = n.to
          n.to = null
        } else {
          a.x += Math.sign(d) * step
          a.flip = d < 0
          moving = true
        }
      }
      if (n.ty !== null) {
        const d = n.ty - a.y
        const step = n.vy * dt
        if (Math.abs(d) <= step) {
          a.y = n.ty
          n.ty = null
        } else {
          a.y += Math.sign(d) * step
          moving = true
        }
      }
      if (moving && a.frames !== n.set.walk && a.frames !== n.set.run) {
        a.frames = n.set.walk
        a.fps = 7
      } else if (!moving && a.frames !== n.set.stand) {
        a.frames = n.set.stand
        a.fps = 0
        a.frame = 0
      }
      a.z = a.y > s.FLOOR ? 'front' : 'back'
    },
  })
  return n
}

// ---------- 天空 ----------
function sky(g: Gfx, env: Env, r: Rng) {
  skyBase(g, env, r, 108)
  if (env.time === 'night') {
    // 城市的光害：地平線附近亮一點
    g.dither(0, 70, g.w, 14, 'sky-dusk-1', 2)
    g.dither(0, 84, g.w, 30, 'sky-dusk-1', 5)
  }
}

// ---------- 遠景：天際線與鐵塔 ----------
/** 東京鐵塔：cx 中心、base 塔腳、h 高 */
function tokyoTower(g: Gfx, cx: number, base: number, h: number, env: Env) {
  const night = env.time === 'night'
  const red: Px = night ? 'lamp-2' : 'momiji-2'
  const white: Px = night ? 'lamp-1' : 'paper'
  const lattice: Px = night ? 'momiji-1' : 'shu-2'
  const top = base - h
  const mast = top + Math.round(h * 0.2)
  g.vline(cx, top, mast, white)
  g.vline(cx, top + 3, mast, red)
  for (let y = mast; y <= base; y++) {
    const hf = (base - y) / h
    const half = Math.round(0.6 + 14 * Math.pow(1 - hf, 3) * (h / 70))
    const band = (Math.floor((y - mast) / 5) % 3 === 2 && hf > 0.3) || (hf > 0.72 && hf < 0.78)
    const k: Px = band ? white : red
    const archH = Math.round(h * 0.13)
    if (y > base - archH) {
      // 塔腳之間的拱
      const t = (y - (base - archH)) / archH
      const inner = Math.round((half - 3) * Math.sqrt(t))
      g.hline(cx - half, cx - inner - 1, y, k)
      g.hline(cx + inner + 1, cx + half, y, k)
    } else g.hline(cx - half, cx + half, y, k)
    if (half >= 2 && (y & 1) === 0) for (let x = cx - half + 1; x < cx + half; x += 2) g.px(x + ((y >> 1) & 1), y, lattice)
  }
  // 大展望台、特別展望台
  const deck = (hf: number, w: number, dh: number) => {
    const y = Math.round(base - h * hf)
    g.rect(cx - w, y, w * 2 + 1, dh, white)
    g.hline(cx - w, cx + w, y + dh - 1, night ? 'lamp-2' : 'stone-2')
    if (night) for (let x = cx - w + 1; x < cx + w; x += 2) g.px(x, y + 1, 'lamp-2')
  }
  deck(0.45, Math.round(h / 14), 4)
  deck(0.73, Math.round(h / 30) + 1, 2)
}

/** 晴空塔：細長、兩層展望台、上面一根天線 */
function skytree(g: Gfx, cx: number, base: number, h: number, env: Env, lr: Rng) {
  const night = env.time === 'night'
  const miyabi = lr.chance(0.5)
  const body: Px = night ? 'sky-night-3' : 'snow-1'
  const line: Px = night ? (miyabi ? 'sky-dusk-1' : 'neon-2') : 'snow-2'
  const deckK: Px = night ? 'lamp-1' : 'white'
  const top = base - h
  const latticeTop = Math.round(base - h * 0.8)
  g.vline(cx, top, latticeTop, night ? line : 'stone-1')
  g.px(cx, top, night ? 'neon-1' : 'shu-1')
  for (let y = latticeTop; y <= base; y++) {
    const hf = (base - y) / h
    const half = Math.round(1.4 + 4.6 * Math.pow(1 - hf, 2.4) * (h / 96))
    g.hline(cx - half, cx + half, y, body)
    if (half >= 2) {
      g.px(cx - half + 1, y, line)
      g.px(cx + half - 1, y, line)
      if ((y & 3) === 0) g.hline(cx - half + 1, cx + half - 1, y, line)
    }
  }
  if (night && miyabi) g.vline(cx, latticeTop, base, 'neon-1')
  const deck = (hf: number, half: number, dh: number) => {
    const y = Math.round(base - h * hf)
    g.rect(cx - half, y, half * 2 + 1, dh, deckK)
    g.hline(cx - half, cx + half, y + dh - 1, night ? 'lamp-2' : 'stone-1')
  }
  deck(0.55, 4, 4)
  deck(0.7, 3, 2)
}

/** 遠處的一棟樓（剪影） */
function farBlock(g: Gfx, x: number, bw: number, top: number, k: Px, env: Env, r: Rng, lr: Rng) {
  g.rect(x, top, bw, H - top, k)
  const kind = r.next()
  if (kind < 0.18) {
    // 尖頂
    g.tri(x, top, x + bw / 2, top - Math.round(bw * 0.6), x + bw, top, k)
  } else if (kind < 0.4) {
    // 階梯狀
    g.rect(x + 3, top - 5, bw - 6, 5, k)
    if (bw > 12) g.rect(x + 6, top - 9, bw - 12, 4, k)
  } else if (kind < 0.55) {
    g.vline(x + Math.round(bw / 2), top - r.int(5, 10), top, k)
  }
  if (env.time === 'night') {
    for (let yy = top + 3; yy < 112; yy += 4) for (let xx = x + 2; xx < x + bw - 1; xx += 3) if (lr.chance(0.22)) g.px(xx, yy, lr.chance(0.7) ? 'lamp-1' : 'lamp-2')
    if (top < 84) g.px(x + 1, top, 'neon-1')
  } else if (env.time === 'dusk') {
    for (let yy = top + 3; yy < 112; yy += 4) for (let xx = x + 2; xx < x + bw - 1; xx += 3) if (lr.chance(0.06)) g.px(xx, yy, 'lamp-2')
  }
}

function farCity(g: Gfx, w: number, r: Rng, env: Env) {
  const lr = rng(r.int(1, 1e9))
  const back = tod<Px>(env, 'cloud-2', 'sky-dusk-1', 'sky-night-2')
  const front = tod<Px>(env, 'snow-2', 'roof-1', 'roof-2')
  for (let x = -4; x < w; ) {
    const bw = r.int(8, 20)
    farBlock(g, x, bw, r.int(66, 96), back, env, r, lr)
    x += bw + r.int(-2, 4)
  }
  // 鐵塔：一座一開始就看得到，另一座（有時候）走到一半才出來
  const firstTower = r.chance(0.5)
  const both = r.chance(0.6)
  const at1 = Math.round(w * r.range(0.42, 0.5))
  const at2 = Math.round(w * r.range(0.78, 0.84))
  const draw = (tower: boolean, x: number) => (tower ? tokyoTower(g, x, 112, 84, env) : skytree(g, x, 112, 100, env, lr))
  draw(firstTower, at1)
  if (both) draw(!firstTower, at2)
  for (let x = -6; x < w; ) {
    const bw = r.int(10, 24)
    const top = r.int(82, 104)
    // 鐵塔前面留空，塔腳才看得到一點
    const near = Math.abs(x + bw / 2 - at1) < 22 || (both && Math.abs(x + bw / 2 - at2) < 22)
    farBlock(g, x, bw, near ? Math.max(top, 100) : top, front, env, r, lr)
    x += bw + r.int(0, 6)
  }
}

// ---------- 中景：辦公大樓與高架鐵路 ----------
/** 大螢幕（中景座標）：之後要讓螢幕換畫面的腳本用 */
const screens: Array<{ x: number; y: number; w: number; h: number }> = []

function office(g: Gfx, x: number, bw: number, top: number, env: Env, r: Rng, lr: Rng) {
  const kind = r.next()
  const face = r.pick<Px>(['stone-1', 'paper-2', 'stone-2', 'paper', 'roof-1'])
  const bottom = RAIL + 2
  if (kind < 0.35) {
    // 玻璃帷幕
    const glass = tod<Px>(env, 'sky-day-2', 'sky-dusk-3', 'roof-3')
    const glass2 = tod<Px>(env, 'sky-day-1', 'sky-dusk-2', 'ink-2')
    g.rect(x, top, bw, bottom - top, glass)
    for (let i = 2; i < bw - 1; i += 6) g.rect(x + i, top, 2, bottom - top, glass2)
    for (let yy = top + 4; yy < bottom; yy += 5) {
      g.hline(x, x + bw - 1, yy, env.time === 'day' ? 'stone-1' : 'roof-2')
      if (lit(env) && lr.chance(env.time === 'night' ? 0.55 : 0.25)) g.hline(x + 1, x + bw - 2, yy + 2, lr.chance(0.7) ? 'lamp-1' : 'lamp-2')
    }
    g.vline(x, top, bottom, 'stone-3')
    g.rect(x - 1, top - 2, bw + 2, 2, 'stone-3')
  } else {
    // 窗格
    g.rect(x, top, bw, bottom - top, face)
    g.vline(x + bw - 1, top, bottom, dark(face))
    g.rect(x - 1, top - 2, bw + 2, 2, dark(face))
    const ribbon = kind > 0.75
    for (let yy = top + 4; yy < bottom; yy += 6) {
      if (ribbon) {
        const on = lit(env) && lr.chance(env.time === 'night' ? 0.6 : 0.3)
        g.rect(x + 2, yy, bw - 4, 3, on ? 'lamp-1' : env.time === 'day' ? 'roof-1' : 'roof-3')
        continue
      }
      for (let xx = x + 3; xx + 3 < x + bw; xx += 5) {
        const on = lit(env) && lr.chance(env.time === 'night' ? 0.5 : 0.18)
        g.rect(xx, yy, 3, 3, on ? (lr.chance(0.8) ? 'lamp-1' : 'lamp-2') : env.time === 'day' ? 'roof-1' : 'roof-3')
      }
    }
  }
  // 屋頂：水塔、天線、廣告塔、航空障礙燈
  const roof = r.next()
  if (roof < 0.25) {
    const tx = x + r.int(3, Math.max(4, bw - 10))
    g.rect(tx, top - 7, 7, 5, 'stone-2')
    g.hline(tx, tx + 6, top - 7, 'stone-1')
    g.vline(tx + 1, top - 2, top - 1, 'stone-3')
    g.vline(tx + 5, top - 2, top - 1, 'stone-3')
  } else if (roof < 0.5 && bw >= 30) {
    // 屋頂的廣告塔（色塊）
    const bx = x + r.int(2, bw - 26)
    const bwid = 24
    g.rect(bx, top - 16, bwid, 11, lit(env) ? 'roof-3' : 'paper')
    const c1 = r.pick<Px>(['shu-1', 'sea-2', 'leaf-2', 'gold-1', 'momiji-1'])
    if (lit(env)) {
      g.rect(bx + 2, top - 14, 9, 7, lr.pick<Px>(['neon-1', 'neon-2', 'lamp-2']))
      g.rect(bx + 13, top - 13, 9, 2, 'lamp-1')
      g.rect(bx + 13, top - 10, 6, 2, 'lamp-1')
    } else {
      g.rect(bx + 2, top - 14, 9, 7, c1)
      g.rect(bx + 13, top - 13, 9, 2, 'stone-3')
      g.rect(bx + 13, top - 10, 6, 2, 'stone-3')
    }
    for (let i = 0; i < bwid; i += 4) g.line(bx + i, top - 1, bx + i + 4, top - 5, 'stone-3')
    g.hline(bx, bx + bwid - 1, top - 5, 'stone-3')
  } else if (roof < 0.7) {
    const ax = x + r.int(2, bw - 3)
    g.vline(ax, top - r.int(8, 14), top - 2, 'stone-3')
    g.hline(ax - 2, ax + 2, top - 6, 'stone-3')
  }
  if (top < 70) {
    const k: Px = env.time === 'night' ? 'neon-1' : 'shu-1'
    g.px(x, top - 3, k)
    g.px(x + bw - 1, top - 3, k)
  }
  // 大螢幕
  if (bw >= 34 && r.chance(0.3) && top < 72) {
    const sx = x + Math.round((bw - 22) / 2)
    const sy = top + 8
    g.rect(sx - 1, sy - 1, 24, 15, 'ink-2')
    screen(g, sx, sy, 22, 13, env, r.int(0, 3), 0)
    screens.push({ x: sx, y: sy, w: 22, h: 13 })
  }
}

/** 大螢幕的畫面（色塊）：pat 是哪一種、t 讓霓虹腳本換畫面 */
function screen(g: Gfx, x: number, y: number, w: number, h: number, env: Env, pat: number, t: number) {
  const on = lit(env)
  const a: Px = on ? 'neon-2' : 'sea-1'
  const b: Px = on ? 'neon-1' : 'sakura-1'
  const c: Px = on ? 'lamp-1' : 'gold-1'
  const bg: Px = on ? 'sky-night-2' : 'sea-3'
  g.rect(x, y, w, h, bg)
  switch (pat % 4) {
    case 0: // 人像（剪影）＋字
      g.circle(x + 6, y + 5, 3, b)
      g.rect(x + 2, y + 9, 9, 4, b)
      g.rect(x + 13, y + 3, 7, 2, c)
      g.rect(x + 13, y + 7, 5, 2, a)
      break
    case 1: // 飲料罐
      g.rect(x + 4, y + 2, 5, 9, a)
      g.rect(x + 4, y + 4, 5, 2, c)
      g.rect(x + 12, y + 4, 7, 5, b)
      break
    case 2: // 條紋
      for (let i = 0; i < w; i += 4) g.rect(x + ((i + t * 2) % w), y, 2, h, i % 8 ? a : c)
      break
    default: // 大字（色塊）
      g.rect(x + 2, y + 3, 4, 7, c)
      g.rect(x + 8, y + 3, 4, 7, b)
      g.rect(x + 14, y + 3, 4, 7, a)
  }
}

function viaduct(g: Gfx, w: number, env: Env, r: Rng, lr: Rng) {
  const base = RAIL + 8
  // 高架下：柱與拱，拱下的小店（ガード下），夜裡亮燈
  for (let x = 0; x < w; x += 44) {
    g.rect(x + 7, base + 1, 37, PATH - base + 2, 'roof-3')
    g.poly([x + 7, base + 1, x + 44, base + 1, x + 44, base + 7, x + 38, base + 4, x + 13, base + 4, x + 7, base + 7], 'stone-2')
    if (r.chance(0.6)) {
      const on = lit(env) && lr.chance(0.8)
      g.rect(x + 12, base + 10, 27, PATH - base - 10, on ? 'lamp-2' : 'roof-2')
      g.rect(x + 12, base + 9, 27, 3, r.pick<Px>(['shu-2', 'roof-3', 'cloth-2']))
      if (on) for (let i = x + 14; i < x + 38; i += 5) g.ellipse(i, base + 14, 1, 2, 'shu-1')
    }
    g.rect(x, base, 7, PATH - base + 4, 'stone-2')
    g.vline(x + 6, base, PATH, 'stone-3')
  }
  // 護欄（高架的側面）
  g.rect(0, RAIL, w, 8, 'stone-1')
  g.hline(0, w, RAIL, 'paper')
  g.hline(0, w, RAIL + 7, 'stone-3')
  for (let x = 0; x < w; x += 22) g.vline(x, RAIL + 1, RAIL + 6, 'stone-2')
  g.dither(0, base, w, 2, 'stone-4', 8)
  // 電車線的柱子與架空線
  for (let x = 30; x < w; x += 44) {
    g.vline(x, WIRE - 4, RAIL - 1, 'stone-3')
    g.hline(x - 3, x + 5, WIRE - 3, 'stone-3')
    g.px(x + 4, WIRE - 2, 'stone-3')
  }
  g.hline(0, w, WIRE, 'ink-2')
  for (let x = 8; x < w; x += 11) g.px(x, WIRE - 1, 'stone-3')
  g.hline(0, w, WIRE - 2, 'stone-3')
  void env
}

function midCity(g: Gfx, w: number, r: Rng, env: Env) {
  const lr = rng(r.int(1, 1e9))
  screens.length = 0
  for (let x = r.int(-10, 0); x < w; ) {
    const bw = r.int(24, 52)
    office(g, x, bw, r.int(46, 84), env, r, lr)
    x += bw + (r.chance(0.45) ? r.int(8, 26) : r.int(0, 2))
  }
  viaduct(g, w, env, r, lr)
}

// ---------- 地面：人行道與路旁 ----------
/** 地面的東西在哪（世界座標）：腳本用 */
const crossings: Array<{ x: number; w: number }> = []
const vendings: number[] = []

function sidewalk(g: Gfx, w: number) {
  g.rect(0, PATH, w, H - PATH, 'stone-1')
  for (let row = PATH + 5, n = 0; row < 150; row += 5, n++) {
    g.hline(0, w, row, 'stone-2')
    for (let x = (n % 2) * 5; x < w; x += 10) g.vline(x, row - 4, row - 1, 'paper-2')
  }
  // 點字磚
  g.rect(0, 149, w, 3, 'gold-1')
  for (let x = 1; x < w; x += 3) g.px(x, 150, 'gold-2')
  g.rect(0, 152, w, 2, 'stone-1')
  // 緣石、車道
  g.rect(0, 154, w, 2, 'stone-2')
  g.hline(0, w, 154, 'paper')
  g.rect(0, 156, w, H - 156, 'stone-4')
  g.hline(0, w, 158, 'paper')
  // 建築的影子
  g.hline(0, w, PATH, 'stone-2')
  g.dither(0, PATH + 1, w, 2, 'stone-2', 6)
}

/** 行人號誌（燈頭左上角 hx, hy；7×13）：state red／green／off */
function pedHead(g: Gfx, hx: number, hy: number, state: 'red' | 'green' | 'off', env: Env) {
  g.rect(hx, hy, 7, 13, 'roof-3')
  g.frame(hx, hy, 7, 13, 'ink')
  const redK: Px = state === 'red' ? (env.time === 'night' ? 'neon-1' : 'shu-1') : 'stone-4'
  const greenK: Px = state === 'green' ? 'neon-2' : 'stone-4'
  // 站著的人（紅）
  g.px(hx + 3, hy + 1, redK)
  g.rect(hx + 2, hy + 2, 3, 2, redK)
  g.px(hx + 2, hy + 4, redK)
  g.px(hx + 4, hy + 4, redK)
  g.hline(hx + 1, hx + 5, hy + 6, 'ink')
  // 走路的人（綠）
  g.px(hx + 3, hy + 7, greenK)
  g.rect(hx + 2, hy + 8, 2, 2, greenK)
  g.px(hx + 4, hy + 9, greenK)
  g.px(hx + 1, hy + 11, greenK)
  g.px(hx + 4, hy + 10, greenK)
  g.px(hx + 5, hy + 11, greenK)
}
/** 車用號誌（橫的三燈：綠、黃、紅） */
function carHead(g: Gfx, x: number, y: number, state: 'green' | 'yellow' | 'red', env: Env) {
  g.rect(x, y, 17, 6, 'roof-3')
  g.frame(x, y, 17, 6, 'ink')
  g.rect(x + 2, y + 2, 3, 2, state === 'green' ? 'neon-2' : 'stone-4')
  g.rect(x + 7, y + 2, 3, 2, state === 'yellow' ? 'lamp-2' : 'stone-4')
  g.rect(x + 12, y + 2, 3, 2, state === 'red' ? (env.time === 'night' ? 'neon-1' : 'shu-1') : 'stone-4')
  g.hline(x + 1, x + 15, y - 1, 'stone-3') // 遮陽
}
/** 路口的號誌位置（相對路口左緣） */
const SIG = { left: -6, headY: 99, car: (cw: number) => Math.round(cw / 2) - 8, carY: 93 }
const sigRight = (cw: number) => cw + 5

function crossing(g: Gfx, x: number, cw: number, env: Env) {
  // 橫向的路往後延伸
  const top = 104
  g.poly([x, PATH + 1, x + cw, PATH + 1, x + cw * 0.64, top, x + cw * 0.36, top], 'stone-3')
  g.poly([x + 3, PATH + 1, x + 8, PATH + 1, x + cw * 0.38 + 1, top, x + cw * 0.37, top], 'stone-2')
  g.poly([x + cw - 8, PATH + 1, x + cw - 3, PATH + 1, x + cw * 0.63, top, x + cw * 0.62 - 1, top], 'stone-2')
  for (let y = top + 2, n = 0; y < PATH - 2; y += 4 + n, n++) g.vline(Math.round(x + cw / 2), y, y + 1 + Math.floor(n / 2), 'paper')
  // 斑馬線
  g.rect(x, PATH, cw, H - PATH, 'stone-4')
  for (let sx = x + 3; sx + 4 <= x + cw - 2; sx += 8) g.rect(sx, PATH + 2, 5, 22, 'white')
  g.hline(x, x + cw - 1, 158, 'paper')
  // 路口兩側的警示點字磚、緣石斜坡
  for (const ex of [x - 6, x + cw + 1]) {
    g.rect(ex, PATH + 6, 5, 14, 'gold-1')
    for (let yy = PATH + 7; yy < PATH + 19; yy += 2) for (let xx = ex + 1; xx < ex + 5; xx += 2) g.px(xx, yy, 'gold-2')
  }
  signals(g, x, cw, env)
}

/** 路口的號誌（桿子、燈頭、車用的懸臂）：右邊那支站在下一棟的前面，所以整條畫完再補畫一次 */
function signals(g: Gfx, x: number, cw: number, env: Env) {
  const pole = (px: number, top: number) => {
    g.rect(px, top, 2, PATH + 2 - top, 'stone-3')
    g.vline(px, top, PATH + 1, 'stone-2')
  }
  const lx = x + SIG.left
  const rx = x + sigRight(cw)
  pole(lx, SIG.headY + 12)
  pole(rx, SIG.carY + 2)
  g.rect(lx - 1, 119, 4, 5, 'gold-1') // 押しボタン
  g.frame(lx - 1, 119, 4, 5, 'ink-2')
  pedHead(g, lx - 3, SIG.headY, 'green', env)
  pedHead(g, rx - 3, SIG.headY, 'green', env)
  // 車用號誌的懸臂
  g.hline(x + SIG.car(cw) + 8, rx, SIG.carY + 2, 'stone-3')
  g.hline(x + SIG.car(cw) + 8, rx, SIG.carY + 3, 'stone-3')
  carHead(g, x + SIG.car(cw), SIG.carY, 'red', env)
}

/** 自動販賣機：x 中心，站在建築線上 */
const VM = { w: 16, h: 30 }
const vmTop = () => PATH + 1 - VM.h
function vending(g: Gfx, x: number, env: Env, body: Px, r: Rng) {
  const l = x - VM.w / 2
  const t = vmTop()
  g.rect(l, t, VM.w, VM.h, body)
  g.vline(l + VM.w - 2, t + 1, t + VM.h - 2, dark(body))
  // 樣品窗
  g.rect(l + 2, t + 2, VM.w - 4, 13, lit(env) ? 'lamp-1' : 'white')
  g.frame(l + 2, t + 2, VM.w - 4, 13, 'stone-3')
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 4; i++) {
      const cx = l + 3 + i * 3
      const cy = t + 4 + row * 6
      g.rect(cx, cy, 2, 4, r.pick<Px>(['shu-1', 'sea-2', 'leaf-2', 'gold-1', 'momiji-1', 'stone-4', 'sakura-2']))
      g.px(cx, cy + 5, row === 0 && r.chance(0.5) ? 'shu-1' : 'sea-1')
    }
  // 抽獎的數字窗、投幣口
  g.rect(l + 1, t + 16, 13, 7, 'ink')
  g.rect(l + 14, t + 17, 1, 4, 'stone-3')
  // 取出口
  g.rect(l + 2, t + 24, VM.w - 5, 4, 'ink-2')
  g.hline(l + 2, l + VM.w - 4, t + 24, 'stone-3')
  g.frame(l, t, VM.w, VM.h, 'ink')
}

/** 便利商店樣式的店（不寫店名、不用品牌的配色） */
function konbini(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  const top = PATH - 30
  g.rect(x, top, w, 30, 'white')
  g.rect(x - 1, top - 2, w + 2, 2, 'stone-2')
  // 招牌：單一色帶＋24H
  const band = r.pick<Px>(['momiji-1', 'lavender', 'leaf-3', 'gold-2'])
  g.rect(x, top, w, 7, lit(env) ? 'lamp-1' : 'white')
  g.rect(x, top + 5, w, 2, band)
  g.text('24H', x + w - 16, top + 1, 'ink-2')
  g.hline(x, x + w - 1, top + 7, 'stone-3')
  // 玻璃：白天反光，夜裡店裡的燈
  const gy = top + 9
  const gh = PATH - gy - 1
  const glass = lit(env) ? 'lamp-1' : 'sky-day-3'
  g.rect(x + 2, gy, w - 4, gh, glass)
  // 貨架
  for (const sy of [gy + 5, gy + 10]) {
    g.hline(x + 3, x + w - 4, sy, 'stone-2')
    for (let i = x + 4; i < x + w - 4; i += 2) if (r.chance(0.8)) g.px(i, sy - 1, r.pick<Px>(['shu-1', 'gold-1', 'leaf-2', 'sea-2', 'sakura-2', 'paper', 'momiji-1']))
  }
  // 雜誌架
  for (let i = x + 3; i < x + w - 5; i += 4) g.rect(i, PATH - 6, 3, 4, r.pick<Px>(['shu-1', 'sea-2', 'gold-1', 'sakura-2', 'white']))
  if (!lit(env)) for (let i = 0; i < 3; i++) g.line(x + 6 + i * 18, gy + 1, x + 12 + i * 18, gy + gh - 2, 'white')
  // 自動門
  const dx = x + Math.round(w / 2) - 8
  g.rect(dx, gy - 1, 16, gh + 1, lit(env) ? 'lamp-1' : 'sky-day-2')
  g.frame(dx, gy - 1, 16, gh + 1, 'stone-3')
  g.vline(dx + 8, gy, PATH - 1, 'stone-3')
  for (let i = x + 2; i < x + w - 2; i += 12) g.vline(i, gy, PATH - 1, 'stone-3')
  g.vline(x + w - 3, gy, PATH - 1, 'stone-3')
  g.rect(dx + 2, PATH - 1, 12, 1, 'stone-3')
  // 外面的垃圾桶
  for (let i = 0; i < 2; i++) {
    g.rect(x + w - 14 + i * 6, PATH - 8, 5, 8, 'stone-2')
    g.rect(x + w - 14 + i * 6, PATH - 8, 5, 2, i ? 'leaf-2' : 'sea-2')
    g.frame(x + w - 14 + i * 6, PATH - 8, 5, 8, 'ink-2')
  }
}

/** 遮陽篷（條紋、下緣波浪） */
function awning(g: Gfx, x: number, y: number, w: number, a: Px, b: Px) {
  for (let i = 0; i < w; i++) g.vline(x + i, y, y + 4, Math.floor(i / 3) % 2 ? b : a)
  for (let i = 0; i < w; i += 3) g.px(x + i + 1, y + 5, Math.floor(i / 3) % 2 ? b : a)
  g.hline(x, x + w - 1, y, dark(a))
}

/** 一樓的小店：拉麵、居酒屋、咖啡、不動產、藥妝 */
function shop(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  const kind = r.int(0, 4)
  const top = PATH - r.int(26, 30)
  const wall = r.pick<Px>(['paper', 'paper-2', 'stone-1', 'wood-2', 'stone-3'])
  g.rect(x, top, w, PATH - top, wall)
  g.rect(x - 1, top - 2, w + 2, 2, dark(wall))
  const signY = top + 1
  const front = top + 9
  if (kind === 0) {
    // 拉麵：木頭門面、暖簾、紅燈籠
    g.rect(x, top, w, PATH - top, 'wood-2')
    g.rect(x + 2, signY, w - 4, 6, 'paper')
    for (let i = x + 4; i < x + w - 6; i += 6) g.rect(i, signY + 1, 4, 4, 'ink-2')
    g.rect(x + 3, front + 1, w - 6, PATH - front - 1, lit(env) ? 'lamp-2' : 'wood-3')
    for (let i = x + 4; i < x + w - 4; i += 3) g.vline(i, front + 1, PATH - 1, 'wood-3')
    g.rect(x + 4, front, w - 8, 8, 'shu-2')
    for (let i = x + 4 + 5; i < x + w - 4; i += 6) g.vline(i, front + 2, front + 7, 'paper')
    g.ellipse(x + 3, front + 4, 2, 3, lit(env) ? 'lamp-2' : 'shu-1')
    g.hline(x + 2, x + 4, front + 1, 'ink-2')
  } else if (kind === 1) {
    // 居酒屋：一排紅燈籠、拉門透光
    g.rect(x, top, w, PATH - top, 'wood-3')
    g.rect(x + 2, signY, w - 4, 6, 'wood-1')
    for (let i = x + 4; i < x + w - 5; i += 5) g.rect(i, signY + 1, 3, 4, 'ink-2')
    for (let i = x + 3; i < x + w - 3; i += 5) {
      g.vline(i, front - 1, front, 'ink-2')
      g.ellipse(i, front + 3, 2, 2, lit(env) ? 'lamp-2' : 'shu-1')
    }
    g.rect(x + 3, front + 7, w - 6, PATH - front - 7, lit(env) ? 'lamp-1' : 'paper')
    for (let i = x + 3; i < x + w - 3; i += 4) g.vline(i, front + 7, PATH - 1, 'wood-3')
    g.hline(x + 3, x + w - 4, front + 12, 'wood-3')
  } else if (kind === 2) {
    // 咖啡：遮陽篷、暖色的窗、立牌
    const [a, b] = r.pick<[Px, Px]>([
      ['leaf-3', 'paper'],
      ['shu-2', 'paper'],
      ['roof-2', 'paper'],
    ])
    g.rect(x + 2, signY, w - 4, 5, 'roof-3')
    g.rect(x + 4, signY + 2, Math.min(14, w - 8), 1, 'paper')
    g.rect(x + 3, front + 4, w - 6, PATH - front - 5, lit(env) ? 'lamp-2' : 'roof-2')
    g.frame(x + 3, front + 4, w - 6, PATH - front - 5, 'wood-3')
    if (!lit(env)) g.line(x + 5, front + 6, x + 10, PATH - 3, 'sky-day-2')
    awning(g, x, front, w, a, b)
    // 立牌（黑板）
    const bx = x + w - 9
    g.poly([bx, PATH + 1, bx + 3, PATH - 9, bx + 5, PATH - 9, bx + 8, PATH + 1], 'wood-3')
    g.rect(bx + 2, PATH - 7, 4, 5, 'leaf-4')
    g.hline(bx + 3, bx + 4, PATH - 6, 'white')
    g.hline(bx + 3, bx + 4, PATH - 4, 'white')
  } else if (kind === 3) {
    // 不動產：窗上貼滿物件
    g.rect(x + 2, signY, w - 4, 6, 'sea-2')
    g.rect(x + 4, signY + 2, 10, 2, 'white')
    g.rect(x + 2, front, w - 4, PATH - front, lit(env) ? 'lamp-1' : 'sky-day-3')
    for (let yy = front + 1; yy < PATH - 5; yy += 6)
      for (let xx = x + 3; xx < x + w - 6; xx += 5) {
        g.rect(xx, yy, 4, 5, 'white')
        g.px(xx + 1, yy + 1, r.pick<Px>(['shu-1', 'sea-2', 'leaf-2']))
        g.hline(xx + 1, xx + 2, yy + 3, 'stone-2')
      }
    g.frame(x + 2, front, w - 4, PATH - front, 'stone-3')
  } else {
    // 藥妝：黃色大招牌、門口堆滿東西
    g.rect(x + 1, signY - 1, w - 2, 8, 'gold-1')
    g.rect(x + 3, signY + 1, 5, 4, 'shu-1')
    g.rect(x + 10, signY + 2, Math.min(16, w - 13), 2, 'ink-2')
    g.rect(x + 2, front, w - 4, PATH - front, lit(env) ? 'lamp-1' : 'white')
    for (let yy = front + 2; yy < PATH - 2; yy += 3)
      for (let xx = x + 3; xx < x + w - 3; xx += 2) g.px(xx, yy, r.pick<Px>(['shu-1', 'sea-2', 'leaf-2', 'gold-1', 'sakura-2', 'lavender', 'paper']))
    // 門口的籃子
    g.rect(x + 2, PATH - 7, 10, 7, 'shu-2')
    for (let xx = x + 3; xx < x + 11; xx += 2) g.rect(xx, PATH - 9, 1, 2, r.pick<Px>(['gold-1', 'sea-1', 'sakura-1', 'white']))
    g.rect(x + w - 10, PATH - 9, 8, 9, 'cloth-1')
    g.hline(x + w - 10, x + w - 3, PATH - 9, 'gold-1')
  }
  g.frame(x, top - 1, w, PATH - top + 1, 'ink-2')
}

/** 雜居大樓：窄、高，側面一整串直招牌 */
function zakkyo(g: Gfx, x: number, w: number, env: Env, r: Rng, lr: Rng) {
  const top = r.int(54, 72)
  const face = r.pick<Px>(['stone-1', 'paper-2', 'roof-1', 'stone-2'])
  g.rect(x, top, w, PATH - top, face)
  g.rect(x - 1, top - 2, w + 2, 2, dark(face))
  g.vline(x + w - 1, top, PATH, dark(face))
  for (let yy = top + 4; yy < PATH - 22; yy += 9) {
    const on = lit(env) && lr.chance(0.6)
    g.rect(x + 3, yy, w - 14, 5, on ? lr.pick<Px>(['lamp-1', 'lamp-2', 'neon-1']) : env.time === 'day' ? 'roof-1' : 'roof-3')
    g.hline(x + 3, x + w - 12, yy + 5, dark(face))
  }
  // 直招牌（一層一塊）
  const sx = x + w - 9
  g.rect(sx + 3, top + 2, 2, PATH - top - 24, 'stone-3')
  for (let yy = top + 3; yy < PATH - 26; yy += 9) {
    const dayK = r.pick<Px>(['shu-1', 'gold-1', 'sea-2', 'leaf-2', 'paper', 'sakura-2', 'momiji-1'])
    const k = lit(env) ? lr.pick<Px>(['lamp-1', 'lamp-2', 'neon-1', 'neon-2', 'shu-1']) : dayK
    g.rect(sx, yy, 8, 8, k)
    g.frame(sx, yy, 8, 8, 'ink-2')
    g.vline(sx + 3, yy + 2, yy + 5, k === 'paper' || k === 'lamp-1' || k === 'gold-1' ? 'ink-2' : 'white')
    g.px(sx + 4, yy + 3, k === 'paper' || k === 'lamp-1' || k === 'gold-1' ? 'ink-2' : 'white')
  }
  // 一樓：樓梯口＋小店
  g.rect(x + 2, PATH - 20, 9, 20, 'ink-2')
  for (let i = 0; i < 5; i++) g.hline(x + 3, x + 9, PATH - 3 - i * 4, 'stone-3')
  g.rect(x + 12, PATH - 18, w - 15, 18, lit(env) ? 'lamp-2' : 'sky-day-3')
  g.frame(x + 12, PATH - 18, w - 15, 18, 'stone-3')
  g.rect(x + 11, PATH - 22, w - 12, 4, r.pick<Px>(['shu-2', 'leaf-3', 'cloth-2']))
  g.frame(x, top - 1, w, PATH - top + 1, 'ink-2')
}

/** 公園邊的步道：石牆、鐵欄杆、行道樹（春櫻、夏綠、秋銀杏、冬天枯枝；夜裡掛燈） */
function parkTree(g: Gfx, x: number, y: number, s: number, env: Env) {
  g.rect(x - 1, y - s, 3, s, 'wood-3')
  g.px(x + 1, y - s, 'wood-2')
  if (env.season === 'winter') {
    for (let i = 0; i < 4; i++) {
      const yy = y - s - 2 - i * 4
      g.line(x, yy + 4, x - s + i * 2, yy - 2, 'wood-3')
      g.line(x, yy + 5, x + s - i * 2, yy - 1, 'wood-3')
    }
    g.vline(x, y - s * 2 - 4, y - s, 'wood-3')
    if (lit(env)) for (let i = 0; i < 14; i++) g.px(x - s + ((i * 7) % (s * 2)), y - s - 2 - ((i * 5) % (s + 4)), 'lamp-1')
    return
  }
  if (env.season === 'autumn') {
    // 銀杏：直立的橢圓
    g.ellipse(x, y - s * 1.9, s * 0.8, s * 1.15, 'gold-1')
    g.dither(x - s, y - s * 2, s * 2, s * 1.4, 'gold-2', 5)
    g.px(x - 2, y - Math.round(s * 2.6), 'lamp-1')
    return
  }
  const [a, b] = env.season === 'spring' ? (['sakura-1', 'sakura-2'] as const) : (['leaf-2', 'leaf-3'] as const)
  g.circle(x, y - s * 1.7, s * 0.85, a)
  g.circle(x - s * 0.7, y - s * 1.25, s * 0.6, a)
  g.circle(x + s * 0.7, y - s * 1.3, s * 0.6, a)
  g.dither(x - s * 1.3, y - s * 1.3, s * 2.6, s * 0.6, b, 7)
  g.px(x - Math.round(s * 0.3), y - Math.round(s * 2.2), 'white')
}

function park(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  const wallTop = PATH - 11
  // 樹（後面）
  const trees: number[] = []
  for (let tx = x + 10; tx < x + w - 8; tx += r.int(20, 28)) trees.push(tx)
  for (const tx of trees) parkTree(g, tx, wallTop + 2, r.int(9, 12), env)
  // 春天：賞花的燈籠串
  if (env.season === 'spring' && trees.length > 1) {
    const ly = wallTop - 16
    g.hline(x + 4, x + w - 5, ly, 'ink-2')
    for (let lx = x + 7; lx < x + w - 6; lx += 7) {
      g.ellipse(lx, ly + 3, 2, 2, lit(env) ? 'lamp-2' : 'paper')
      g.px(lx, ly + 3, lit(env) ? 'lamp-1' : 'shu-1')
    }
  }
  // 石牆（千鳥之淵的石垣）＋欄杆
  g.rect(x, wallTop, w, PATH - wallTop, 'stone-2')
  for (let yy = wallTop + 3, n = 0; yy < PATH; yy += 4, n++) {
    g.hline(x, x + w - 1, yy, 'stone-3')
    for (let xx = x + (n % 2) * 4; xx < x + w; xx += 8) g.vline(xx, yy - 3, yy - 1, 'stone-3')
  }
  g.hline(x, x + w - 1, wallTop, 'stone-1')
  g.hline(x, x + w - 1, wallTop - 5, 'ink-2')
  for (let xx = x + 2; xx < x + w; xx += 4) g.vline(xx, wallTop - 5, wallTop - 1, 'ink-2')
  // 地上的花瓣、落葉
  if (env.season === 'spring' || env.season === 'autumn')
    for (let i = 0; i < w / 4; i++) g.px(x + r.int(0, w), r.int(PATH + 1, 147), env.season === 'spring' ? 'sakura-1' : 'gold-1')
}

/** 投幣停車場（白天停著車）／夜裡的拉麵屋台 */
function lot(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  const back = PATH - 18
  g.rect(x, back, w, PATH - back, 'stone-3')
  g.hline(x, x + w - 1, back, 'stone-2')
  for (let i = x + 4; i < x + w; i += 20) g.line(i, PATH - 1, i + 6, back + 1, 'paper')
  // 後面的圍欄
  g.hline(x, x + w - 1, back - 4, 'stone-2')
  for (let i = x; i < x + w; i += 6) g.vline(i, back - 6, back, 'stone-2')
  // P 的招牌
  g.rect(x + 2, back - 22, 2, 22, 'stone-2')
  g.rect(x - 1, back - 30, 9, 9, 'sea-2')
  g.frame(x - 1, back - 30, 9, 9, 'ink-2')
  g.text('P', x + 2, back - 28, 'white')
  const carK = r.pick<Px>(['white', 'shu-2', 'stone-1', 'roof-2'])
  const cx = x + r.int(14, Math.max(15, w - 40))
  if (env.time === 'night') {
    // 拉麵屋台：木頭車台、屋頂、紅燈籠、暖簾、湯氣
    const yx = x + Math.round(w / 2) - 16
    g.rect(yx, PATH - 14, 32, 13, 'wood-2')
    g.hline(yx, yx + 31, PATH - 14, 'wood-1')
    g.rect(yx + 2, PATH - 34, 2, 20, 'wood-3')
    g.rect(yx + 28, PATH - 34, 2, 20, 'wood-3')
    g.poly([yx - 3, PATH - 33, yx + 16, PATH - 38, yx + 35, PATH - 33, yx + 35, PATH - 31, yx - 3, PATH - 31], 'wood-3')
    g.rect(yx + 4, PATH - 31, 24, 7, 'shu-2')
    for (let i = yx + 9; i < yx + 28; i += 6) g.vline(i, PATH - 30, PATH - 25, 'paper')
    g.rect(yx + 5, PATH - 24, 22, 10, 'lamp-2')
    g.ellipse(yx + 34, PATH - 26, 3, 4, 'lamp-2')
    g.hline(yx + 32, yx + 36, PATH - 29, 'ink-2')
    g.hline(yx + 32, yx + 36, PATH - 22, 'ink-2')
    g.px(yx + 34, PATH - 26, 'lamp-1')
    // 車輪、凳子
    g.circle(yx + 6, PATH - 2, 2, 'ink-2')
    g.circle(yx + 26, PATH - 2, 2, 'ink-2')
    for (const sx of [yx - 6, yx + 36]) {
      g.rect(sx, PATH - 6, 5, 2, 'shu-2')
      g.vline(sx + 2, PATH - 4, PATH - 1, 'stone-3')
    }
    for (let i = 0; i < 3; i++) g.dither(yx + 8 + i * 6, PATH - 44 - i * 2, 3, 6, 'white', 4)
    g.frame(yx, PATH - 14, 32, 13, 'ink-2')
  } else {
    // 停著的車（側面）
    g.rect(cx, PATH - 9, 30, 7, carK)
    g.poly([cx + 6, PATH - 9, cx + 9, PATH - 15, cx + 22, PATH - 15, cx + 26, PATH - 9], carK)
    g.rect(cx + 10, PATH - 14, 5, 4, env.time === 'day' ? 'sky-day-2' : 'roof-3')
    g.rect(cx + 16, PATH - 14, 6, 4, env.time === 'day' ? 'sky-day-2' : 'roof-3')
    g.circle(cx + 7, PATH - 2, 2, 'ink-2')
    g.circle(cx + 23, PATH - 2, 2, 'ink-2')
    g.px(cx + 29, PATH - 7, 'lamp-2')
    g.hline(cx, cx + 29, PATH - 6, dark(carK))
  }
}

/** 地下鐵的出入口 */
function subway(g: Gfx, x: number, env: Env) {
  const w = 36
  g.rect(x, PATH - 22, w, 22, 'stone-1')
  g.rect(x + 3, PATH - 18, w - 6, 18, 'ink-2')
  for (let i = 0; i < 6; i++) g.hline(x + 4 + i * 3, x + w - 4, PATH - 16 + i * 3, 'stone-3')
  g.rect(x - 2, PATH - 25, w + 4, 3, env.time === 'day' ? 'sky-day-2' : 'roof-1')
  g.frame(x - 2, PATH - 25, w + 4, 3, 'stone-3')
  // 站牌
  g.rect(x + w - 6, PATH - 42, 2, 17, 'stone-3')
  g.rect(x + w - 12, PATH - 50, 14, 9, lit(env) ? 'lamp-1' : 'white')
  g.frame(x + w - 12, PATH - 50, 14, 9, 'ink-2')
  g.circle(x + w - 8, PATH - 46, 2, 'sea-2')
  g.hline(x + w - 5, x + w - 1, PATH - 47, 'stone-3')
  g.hline(x + w - 5, x + w - 2, PATH - 45, 'stone-3')
  g.frame(x, PATH - 22, w, 22, 'ink-2')
}

/** 販賣機兩三台排在牆前 */
function vendRow(g: Gfx, x: number, n: number, env: Env, r: Rng) {
  const w = n * (VM.w + 1) + 8
  g.rect(x, PATH - 34, w, 34, 'stone-1')
  g.hline(x, x + w - 1, PATH - 34, 'paper')
  for (let yy = PATH - 30; yy < PATH; yy += 6) g.hline(x, x + w - 1, yy, 'stone-2')
  g.frame(x, PATH - 34, w, 34, 'ink-2')
  for (let i = 0; i < n; i++) {
    const cx = x + 4 + i * (VM.w + 1) + VM.w / 2
    vending(g, cx, env, r.pick<Px>(['white', 'shu-1', 'sea-2', 'white', 'stone-1']), r)
    vendings.push(cx)
  }
  return w
}

function street(g: Gfx, w: number, r: Rng, env: Env) {
  const lr = rng(r.int(1, 1e9))
  crossings.length = 0
  vendings.length = 0
  sidewalk(g, w)
  let x = 0
  let nextCross = r.int(190, 250)
  let lastPark = -400
  let lastKonbini = -200
  let lastLot = -200
  while (x < w) {
    if (x >= nextCross) {
      const cw = r.int(78, 92)
      crossing(g, x, cw, env)
      crossings.push({ x, w: cw })
      x += cw
      nextCross = x + r.int(260, 380)
      continue
    }
    const room = nextCross - x
    const roll = r.next()
    let used = 0
    if (room >= 130 && x - lastPark > 420 && roll < 0.3) {
      used = Math.min(room - 10, r.int(110, 160))
      park(g, x, used, env, r)
      lastPark = x
    } else if (room >= 70 && x - lastKonbini > 260 && roll < 0.5) {
      used = r.int(64, 70)
      konbini(g, x, used, env, r)
      lastKonbini = x
    } else if (room >= 60 && x - lastLot > 300 && roll < 0.62) {
      used = r.int(58, Math.min(70, room))
      lot(g, x, used, env, r)
      lastLot = x
    } else if (room >= 44 && roll < 0.72) {
      used = vendRow(g, x, r.int(2, 3), env, r)
    } else if (room >= 40 && roll < 0.8) {
      subway(g, x + 2, env)
      used = 40
    } else if (room >= 32 && roll < 0.9) {
      used = r.int(30, 38)
      zakkyo(g, x, used, env, r, lr)
    } else if (room >= 30) {
      used = r.int(30, Math.min(46, room))
      shop(g, x, used, env, r)
    } else {
      // 剩一點：窄巷（看得到後面）或一台販賣機
      if (room >= 22) {
        g.rect(x, PATH - 34, room, 34, 'stone-1')
        g.frame(x, PATH - 34, room, 34, 'ink-2')
        vending(g, x + Math.round(room / 2), env, 'white', r)
        vendings.push(x + Math.round(room / 2))
      }
      used = room
    }
    x += used + (r.chance(0.25) ? r.int(1, 3) : 0)
  }
  // 號誌蓋在旁邊的建築前面（腳本畫的燈號才不會一出來就浮在建築上）
  for (const c of crossings) signals(g, c.x, c.w, env)
}

// ---------- 前景：電線桿與電線 ----------
/** 電線桿在哪（前景長條的 x）：腳本讓旅人別停在桿子後面 */
const poleXs: number[] = []
/** 地面捲到 cam 時，畫面 x 這裡有沒有被電線桿擋住（桿子連招牌約 8px 寬，旅人 16px） */
const poleAt = (cam: number, x: number) => poleXs.some((px) => Math.abs(px - Math.round(cam * FRONT) - x) < 14)
/** 停下來之前：桿子正好在旅人前面就再走幾步（前景捲得比地面快，不到一秒就過去） */
function* clearOfPoles(s: Stage): Script {
  yield () => !poleAt(s.cam, s.hero.x)
}

function poles(g: Gfx, w: number, r: Rng, env: Env) {
  const xs = poleXs
  xs.length = 0
  for (let x = r.int(120, 260); x < w; x += r.int(300, 460)) xs.push(x)
  // 電線（先畫，桿子蓋在上面）
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i]!
    const b = xs[i + 1]!
    for (const [dy, sag] of [
      [0, 10],
      [3, 13],
      [24, 9],
    ] as const) {
      for (let x = a; x <= b; x++) {
        const t = (x - a) / (b - a)
        g.px(x, Math.round(14 + dy + sag * 4 * t * (1 - t)), 'ink-2')
      }
    }
  }
  for (const x of xs) {
    // 桿子
    g.rect(x - 3, 6, 6, H - 6, 'stone-2')
    g.vline(x - 2, 6, H, 'stone-1')
    g.vline(x + 2, 6, H, 'stone-3')
    g.vline(x - 4, 6, H, 'ink')
    g.vline(x + 3, 6, H, 'ink')
    g.hline(x - 3, x + 2, 5, 'ink')
    // 橫擔、礙子
    g.rect(x - 12, 13, 25, 2, 'stone-3')
    g.frame(x - 13, 12, 27, 4, 'ink')
    for (const ix of [x - 11, x - 6, x + 6, x + 11]) g.rect(ix, 10, 2, 2, 'white')
    // 變壓器
    g.rect(x + 4, 28, 7, 11, 'stone-2')
    g.frame(x + 4, 28, 7, 11, 'ink')
    g.hline(x + 5, x + 9, 30, 'stone-1')
    // 腳踏釘
    for (let y = 50; y < 104; y += 6) g.px(y % 12 ? x - 4 : x + 3, y, 'stone-3')
    // 路燈（夜裡亮）
    g.hline(x - 10, x - 4, 56, 'stone-3')
    g.rect(x - 13, 56, 5, 2, lit(env) ? 'lamp-1' : 'stone-1')
    g.frame(x - 14, 55, 7, 4, 'ink')
    // 桿子上的牌子、下面的黃黑護套
    g.rect(x - 3, 96, 6, 22, r.pick<Px>(['paper', 'sea-2', 'leaf-3']))
    g.hline(x - 2, x + 1, 100, 'stone-3')
    g.hline(x - 2, x, 103, 'stone-3')
    g.hline(x - 2, x + 1, 107, 'stone-3')
    for (let y = 132; y < H; y++) g.hline(x - 3, x + 2, y, Math.floor((y + x) / 3) % 2 ? 'gold-1' : 'ink-2')
  }
}

// ---------- 東京的腳本 ----------
const LINE_COLORS: Px[] = ['leaf-2', 'momiji-1', 'gold-1', 'sea-1']

/** 一列電車（x 左緣、畫面座標）：銀色車身、路線色帶，夜裡車窗亮 */
function drawTrain(g: Gfx, x0: number, cars: number, dir: number, line: Px, env: Env, t: number) {
  const top = RAIL - 12
  const night = lit(env)
  for (let i = 0; i < cars; i++) {
    const cx = x0 + i * 36
    if (cx > g.w + 2 || cx + 36 < -2) continue
    g.rect(cx, top, 34, 13, 'stone-1')
    g.hline(cx, cx + 33, top, 'stone-2')
    g.rect(cx, top + 9, 34, 2, line)
    for (let k = 0; k < 4; k++) {
      const wx = cx + 2 + k * 8
      g.rect(wx, top + 3, 5, 4, night ? 'lamp-1' : 'roof-2')
      if (night && (i + k) % 3 !== 0) g.rect(wx + 1 + ((i + k) % 2) * 2, top + 4, 2, 3, 'ink-2')
      g.rect(wx + 6, top + 2, 1, 10, 'stone-2') // 門縫
    }
    g.frame(cx, top, 34, 13, 'stone-3')
    // 屋頂的冷氣、集電弓（碰到架空線）
    g.rect(cx + 10, top - 2, 12, 2, 'stone-2')
    if (i % 2 === 1) {
      g.line(cx + 6, top - 1, cx + 10, WIRE + 1, 'ink-2')
      g.line(cx + 14, top - 1, cx + 10, WIRE + 1, 'ink-2')
      g.hline(cx + 7, cx + 13, WIRE + 1, 'ink-2')
      if (night && Math.floor(t * 12) % 7 === 0) g.px(cx + 10, WIRE, 'neon-2')
    }
  }
  // 車頭：圓一點、頭燈、行先表示
  const head = dir > 0 ? x0 + cars * 36 - 3 : x0
  const sgn = dir > 0 ? 1 : -1
  const nose = dir > 0 ? head : head - 3
  g.rect(nose, top + 2, 3, 11, 'stone-1')
  g.px(nose + (dir > 0 ? 2 : 0), top + 2, null)
  g.px(head + sgn * 2 + (dir > 0 ? 0 : 1), top + 8, night ? 'lamp-1' : 'paper')
  g.rect(dir > 0 ? head - 8 : head + 2, top + 2, 6, 2, night ? 'lamp-2' : 'ink-2')
}

const TRAIN: EventDef = {
  id: 'tokyo-train',
  *run(s) {
    const dir = s.rng.chance(0.5) ? 1 : -1
    const cars = s.rng.int(5, 7)
    const len = cars * 36
    const line = s.rng.pick(LINE_COLORS)
    const speed = s.rng.range(120, 150)
    const x = dir > 0 ? s.cam * MID - len - 12 : s.cam * MID + s.W + 12
    const train = s.spawn({ x, y: RAIL, space: MID, z: 'mid', vx: dir * speed, draw: (g, sx, _y, a) => drawTrain(g, Math.round(sx), cars, dir, line, s.env, a.age) })
    const photo = s.rng.chance(0.6)
    // 車頭進畫面
    yield () => (dir > 0 ? train.sx() + len > 10 : train.sx() < s.W - 10)
    if (photo) {
      s.hero.emote('surprise', 0.8)
      yield* clearOfPoles(s)
      s.hero.stop()
      yield 0.6
      s.hero.hold = 'camera'
      // 車頭經過旅人前面時按快門
      yield () => (dir > 0 ? train.sx() + len > s.hero.x + 30 : train.sx() < s.hero.x - 10)
      s.paint('over', (g, t) => {
        if (t < 0.12) g.cover('white', 6)
      })
      s.hero.emote('note', 1.2)
    } else s.hero.emote('note', 1.4)
    yield () => (dir > 0 ? train.sx() > s.W + 4 : train.sx() + len < -4)
    s.hero.hold = null
    s.hero.walk()
  },
}

/**
 * 全向十字路口：旅人前面 40–260px、這一區走完之前走得到，停下來等的地方不在電線桿後面。
 * 號誌已經在畫面裡也可以：先照路上畫的樣子（行人綠燈），閃一閃才轉紅。
 * lead：ready() 多留幾 px（挑中之後下一格才開始跑，旅人又往前走了一點）
 */
function scrambleAt(s: Stage, lead = 0) {
  return crossings.find((k) => {
    const d = k.x - 12 - s.hero.worldX
    return d >= 40 + lead && d <= 260 && k.x + k.w - s.hero.x + 120 < s.area.length && !poleAt(k.x - 12 - s.hero.x, s.hero.x)
  })
}

/** 全向十字路口：紅燈等、綠燈一群人一起過（有人斜著走），旅人夾在裡面 */
const SCRAMBLE: EventDef = {
  id: 'tokyo-scramble',
  weight: 1.4,
  ready: (s) => scrambleAt(s, 4) !== undefined,
  *run(s) {
    const c = scrambleAt(s)
    if (!c) return
    // 號誌進畫面了沒：進來了就從路上畫的燈號（行人綠、車紅）開始，不會一下子跳成紅燈
    const seen = c.x + SIG.left - 3 - s.cam < s.W
    let ped: 'red' | 'green' | 'blink' = seen ? 'green' : 'red'
    let car: 'green' | 'yellow' | 'red' = seen ? 'red' : 'green'
    s.paint('back', (g) => {
      const lx = c.x + SIG.left - 3 - s.cam
      const rx = c.x + sigRight(c.w) - 3 - s.cam
      const st = ped === 'blink' ? (Math.floor(s.t * 4) % 2 ? 'off' : 'green') : ped
      pedHead(g, lx, SIG.headY, st, s.env)
      pedHead(g, rx, SIG.headY, st, s.env)
      carHead(g, c.x + SIG.car(c.w) - s.cam, SIG.carY, car, s.env)
    })
    /** sec 秒後做 fn（號誌照自己的時間換，不擋著腳本） */
    const after = (sec: number, fn: () => void) =>
      s.spawn({
        x: 0,
        y: 0,
        space: 'screen',
        draw() {},
        update(a) {
          if (a.age < sec) return
          fn()
          a.remove()
        },
      })
    if (seen) {
      after(0.4, () => (ped = 'blink'))
      after(2, () => (ped = 'red'))
      after(2.8, () => (car = 'green'))
    }
    const crowd = () => s.rng.pick(CROWD)
    // 對面在等的人（前後錯開）：等的地方在畫面外就站在那裡，在畫面裡就從右邊外面走過來
    const farLanes = [s.FLOOR - 5, s.FLOOR + 6, s.FLOOR - 2, s.FLOOR + 9, s.FLOOR - 4, s.FLOOR + 3]
    const far: Npc[] = farLanes.map((y, i) => {
      const spot = c.x + c.w + 7 + i * 6 + s.rng.int(0, 2)
      if (spot - s.cam > s.W + 10) return npc(s, crowd(), spot, y, true)
      const n = npc(s, crowd(), s.cam + s.W + 12 + i * 10, y, true)
      n.to = spot
      n.v = s.rng.range(40, 48)
      return n
    })
    // 這一邊：從後面走來，站在旅人的後面（不擋住旅人）
    const slots: Array<[number, number]> = [
      [-3, s.FLOOR - 5],
      [-28, s.FLOOR + 6],
      [-36, s.FLOOR - 3],
      [-46, s.FLOOR + 9],
    ]
    const near: Npc[] = slots.map(([dx, y], i) => {
      const n = npc(s, crowd(), s.cam - 12 - i * 12, y)
      n.to = c.x + dx
      n.v = 46 + s.rng.int(0, 8)
      return n
    })
    const all = [...far, ...near]
    yield () => s.hero.worldX >= c.x - 12
    s.hero.stop()
    yield 0.6
    s.hero.emote('dots', 1.3)
    const t0 = s.t
    yield () => (all.every((n) => n.to === null) && car === 'green') || s.t - t0 > 4
    yield 0.8
    // 車的號誌轉黃、轉紅，行人綠燈
    car = 'yellow'
    yield 0.7
    car = 'red'
    yield 0.5
    ped = 'green'
    s.hero.emote('note', 1)
    yield 0.3
    // 一起過：對面的往左、這一邊的往右（比旅人快，畫面寬就再快一點），一直走出畫面，不會停在半路
    for (const n of far) {
      n.to = Number.NEGATIVE_INFINITY
      n.v = s.rng.range(24, 32)
    }
    for (const n of near) {
      n.to = Number.POSITIVE_INFINITY
      n.v = s.rng.range(46, 54) + s.W / 64
    }
    // 斜著過的兩個人：一前一後交錯
    far[0]!.ty = s.FLOOR + 10
    far[0]!.vy = 6
    near[1]!.ty = s.FLOOR - 5
    near[1]!.vy = 5
    yield 0.6
    s.hero.walk()
    yield () => s.hero.worldX > c.x + c.w * 0.4
    s.hero.emote('sweat', 1.2)
    yield () => s.hero.worldX > c.x + c.w - 4
    ped = 'blink'
    yield 1.6
    ped = 'red'
    yield 0.8
    car = 'green'
    // 人都走出畫面、號誌也捲出畫面才收（號誌還在畫面裡就收，燈會跳回路上畫的綠燈）
    const t1 = s.t
    yield () => (all.every((n) => n.a.sx() < -16 || n.a.sx() > s.W + 16) && c.x + sigRight(c.w) + 4 < s.cam) || s.t - t1 > 20
  },
}

/** 自動販賣機：買一罐，偶爾數字對中再送一罐 */
const CAN = drawSprite(5, 7, (g) => {
  g.rect(1, 1, 3, 5, 'shu-1')
  g.rect(1, 1, 3, 1, 'stone-1')
  g.rect(1, 3, 3, 1, 'white')
})
const CAN_SIDE = drawSprite(7, 5, (g) => {
  g.rect(1, 1, 5, 3, 'shu-1')
  g.rect(1, 1, 1, 3, 'stone-1')
  g.rect(3, 1, 1, 3, 'white')
})
/** 前面的販賣機（路上畫的）：18–260px（走過去不到 12 秒）、這一區走完之前，停下來的地方不在電線桿後面（lead 同 scrambleAt） */
function vendingAt(s: Stage, lead = 0) {
  return vendings.find((x) => x - 12 > s.hero.worldX + 6 + lead && x < s.hero.worldX + 260 && x - 12 - s.hero.x < s.area.length - 60 && !poleAt(x - 12 - s.hero.x, s.hero.x))
}
const VENDING: EventDef = {
  id: 'tokyo-vending',
  // 前面沒有販賣機就不挑（不在別的店前面另外貼一台）
  ready: (s) => vendingAt(s, 4) !== undefined,
  *run(s) {
    const v = vendingAt(s)
    if (v === undefined) return
    const l = v - VM.w / 2
    const t = vmTop()
    yield () => s.hero.worldX >= v - 12
    s.hero.stop()
    yield 0.4
    s.hero.emote('dots', 1.3)
    yield 1.5
    // 按下按鈕
    let press = 0
    let digits = ''
    let flash = false
    s.paint('back', (g, tt) => {
      const x = l - s.cam
      if (press > 0) g.px(x + 3 + (press - 1) * 3, t + 9, Math.floor(tt * 8) % 2 ? 'lamp-1' : 'neon-1')
      if (digits) {
        g.rect(x + 1, t + 16, 13, 7, 'ink')
        g.text(digits, x + 2, t + 17, flash && Math.floor(tt * 6) % 2 ? 'lamp-2' : 'neon-1')
      }
    })
    press = s.rng.int(1, 4)
    yield 0.4
    // 喀咚：罐子掉下來，數字開始轉
    const drop = () =>
      s.spawn({
        frames: CAN_SIDE,
        x: v - 2,
        y: t + 28,
        z: 'back',
        fps: 0,
      })
    const can1 = drop()
    s.hero.emote('surprise', 0.6)
    const win = s.rng.chance(0.3)
    for (let i = 0; i < 14; i++) {
      digits = `${s.rng.int(0, 9)}${s.rng.int(0, 9)}${s.rng.int(0, 9)}`
      yield 0.07
    }
    digits = win ? '777' : s.rng.pick(['736', '771', '208', '775'])
    // 旅人拿罐子
    yield 0.3
    can1.frames = [CAN]
    yield* s.move(can1, s.hero.worldX + 2, 30)
    can1.space = 'screen'
    can1.x = s.hero.x + 2
    can1.y = s.hero.y - 6
    can1.z = 'front'
    if (win) {
      flash = true
      s.hero.jump(8)
      s.hero.emote('surprise', 1)
      yield 0.9
      const can2 = drop()
      yield 0.5
      can2.frames = [CAN]
      yield* s.move(can2, s.hero.worldX - 2, 30)
      can2.space = 'screen'
      can2.x = s.hero.x - 3
      can2.y = s.hero.y - 6
      can2.z = 'front'
      s.hero.emote('heart', 1.6)
      yield 1.8
      can2.remove()
    } else {
      s.hero.emote('dots', 1)
      yield 1.1
    }
    // 喝一口
    can1.y = s.hero.y - 14
    can1.x = s.hero.x + 4
    yield 0.8
    s.hero.emote(s.env.season === 'winter' ? 'heart' : s.env.season === 'summer' ? 'note' : 'heart', 1.4)
    can1.y = s.hero.y - 6
    can1.x = s.hero.x + 2
    yield 0.6
    s.hero.walk()
    // 拿著走一下就收起來
    can1.update = (a) => {
      a.x = s.hero.x + 2
      a.y = s.hero.y - 6
    }
    yield 1.2
    can1.remove()
  },
}

/** 趕路的上班族：從後面衝過去，旅人也跟著快走；過一下又衝回來（忘了東西） */
const RUSH: EventDef = {
  id: 'tokyo-rush',
  *run(s) {
    const set = SALARYMAN
    // 他從後面追上來時旅人停下來回頭：算得出停在哪（他跑 80、旅人走 22），那裡有電線桿就晚一點出來
    const catchUp = (s.hero.x - 34 + 20) / (80 - 22)
    yield () => !poleAt(s.cam + 22 * catchUp, s.hero.x)
    const man = s.spawn({ frames: set.run, fps: 12, x: s.cam - 20, y: s.FLOOR + 5, z: 'front', vx: 80 })
    // 汗
    s.spawn({
      x: 0,
      y: 0,
      z: 'front',
      draw(g) {
        if (!man.alive) return
        const x = Math.round(man.sx() + (man.flip ? 4 : -4))
        const y = man.y - 22 + (Math.floor(man.age * 8) % 2)
        g.px(x, y, 'sea-1')
        g.px(x + (man.flip ? 1 : -1), y + 2, 'sea-1')
      },
    })
    yield () => man.sx() > s.hero.x - 34
    // 停下來回頭看（邊走邊朝左會像倒著走）
    s.hero.stop()
    s.hero.emote('surprise', 0.9)
    s.hero.face('left')
    yield () => man.sx() > s.hero.x + 4
    s.hero.face('right')
    yield 0.3
    s.hero.walk()
    s.hero.speed = 1.9
    s.hero.emote('sweat', 1.2)
    yield 1.3
    yield* clearOfPoles(s)
    s.hero.speed = 1
    s.hero.stop()
    s.hero.emote('dots', 1.2)
    yield 1.4
    s.hero.walk()
    yield () => man.sx() > s.W + 20
    yield 1.4
    // 衝回來（旅人在他跑到前面 40px 時停下來：那時別在電線桿後面）
    const meet = (s.W + 20 - (s.hero.x + 40)) / (70 + 22)
    yield () => !poleAt(s.cam + 22 * meet, s.hero.x)
    man.x = s.cam + s.W + 20
    man.vx = -70
    man.flip = true
    man.y = s.FLOOR + 6
    yield () => man.sx() < s.hero.x + 40
    s.hero.stop()
    s.hero.emote('question', 1.6)
    s.hero.face('left')
    yield () => man.sx() < -20
    s.hero.face('right')
    yield 0.4
    s.hero.walk()
  },
}

/** 鴿子：路上啄東西，旅人一靠近全飛走，一隻停到旅人頭上 */
const PIGEON = {
  peck: [0, 1].map((f) =>
    drawSprite(10, 9, (g) => {
      const d = f ? 2 : 0
      g.ellipse(4, 5, 3, 2, 'stone-2')
      g.rect(1, 4, 3, 2, 'stone-3')
      g.hline(2, 4, 5, 'ink-2')
      g.rect(6, 2 + d, 2, 3, 'leaf-2')
      g.px(6, 3 + d, 'lavender')
      g.rect(6, 1 + d, 3, 2, 'stone-2')
      g.px(8, 1 + d, 'shu-1')
      g.px(9, 2 + d, 'stone-4')
      g.px(4, 7, 'sakura-2')
      g.px(5, 7, 'sakura-2')
    }),
  ),
  fly: [0, 1].map((f) =>
    drawSprite(12, 10, (g) => {
      g.ellipse(5, 6, 3, 2, 'stone-2')
      g.rect(8, 4, 2, 2, 'stone-2')
      g.px(9, 4, 'shu-1')
      g.px(10, 5, 'stone-4')
      g.rect(2, 6, 2, 1, 'stone-3')
      if (f) {
        g.poly([3, 5, 6, 5, 9, 1, 6, 1], 'stone-1')
        g.hline(6, 8, 2, 'stone-3')
      } else {
        g.poly([3, 6, 7, 6, 6, 9, 3, 9], 'stone-1')
        g.hline(4, 6, 8, 'stone-3')
      }
    }),
  ),
}
const PIGEONS: EventDef = {
  id: 'tokyo-pigeons',
  *run(s) {
    const n = s.rng.int(4, 6)
    const birds: Actor[] = []
    // 從右上飛下來，落在前面的人行道上。旅人走到第一隻前面 26px 停下來：那時電線桿會擋著就落近一點（或遠一點）
    const stopCam = (l: number) => l - 26 - s.hero.x
    const clear = (l: number) => !poleAt(stopCam(l), s.hero.x) && !poleAt(stopCam(l + 5), s.hero.x)
    const base = s.hero.worldX + Math.min(s.W - s.hero.x - 40, 96)
    const land = base + ([0, -14, -28, 14, 28].find((d) => clear(base + d)) ?? 0)
    for (let i = 0; i < n; i++) {
      const y = s.FLOOR + s.rng.pick([-4, -2, 3, 6, 9])
      const tx = land + i * 9 + s.rng.int(0, 5)
      const b = s.spawn({ frames: PIGEON.fly, fps: 10, x: tx + 50 + i * 6, y: y - 80 - i * 6, z: y > s.FLOOR ? 'front' : 'back', flip: true })
      const from = { x: b.x, y: b.y }
      const dur = s.rng.range(1, 1.4)
      b.update = (a) => {
        const t = Math.min(1, a.age / dur)
        const e = 1 - (1 - t) * (1 - t)
        a.x = from.x + (tx - from.x) * e
        a.y = from.y + (y - from.y) * e
        if (t >= 1) {
          a.update = undefined
          a.frames = PIGEON.peck
          a.fps = s.rng.range(2, 4)
          a.flip = s.rng.chance(0.4)
        }
      }
      birds.push(b)
    }
    yield () => birds[0]!.sx() < s.hero.x + 26
    s.hero.stop()
    s.hero.emote('surprise', 0.9)
    s.hero.jump(5)
    for (const b of birds) {
      b.frames = PIGEON.fly
      b.fps = 10
      b.flip = s.rng.chance(0.3)
      b.vx = (b.flip ? -1 : 1) * s.rng.range(30, 60)
      b.vy = -s.rng.range(50, 80)
      b.z = 'front'
    }
    yield 1.2
    // 一隻繞回來停在頭上
    const sp = s.spawn({ frames: PIGEON.fly, fps: 10, x: s.W + 8, y: s.hero.y - 60, space: 'screen', z: 'back', flip: true })
    const from = { x: sp.x, y: sp.y }
    yield 0.3
    for (let t = 0; t < 1; t += s.rng.range(0.018, 0.02)) {
      const e = 1 - (1 - t) * (1 - t)
      sp.x = from.x + (s.hero.x - from.x) * e
      sp.y = from.y + (s.hero.y - 21 - from.y) * t
      yield null
    }
    sp.x = s.hero.x
    sp.y = s.hero.y - 21
    sp.frames = [PIGEON.peck[0]!]
    sp.fps = 0
    yield 1
    s.hero.emote('dots', 1.4)
    yield 1.6
    s.hero.walk()
    sp.update = (a) => {
      a.x = s.hero.x - 1
      a.y = s.hero.y - 21 + (Math.floor(a.age * 3.5) % 2)
    }
    yield 2.2
    s.hero.jump(6)
    sp.update = undefined
    sp.frames = PIGEON.fly
    sp.fps = 10
    sp.flip = false
    sp.vx = 50
    sp.vy = -60
    sp.z = 'front'
    yield 0.3
    s.hero.emote('sweat', 1.3)
    yield 1.4
  },
}

export const TOKYO: AreaDef = {
  id: 'tokyo',
  name: '東京',
  romaji: 'TOKYO',
  tags: ['city', 'station'],
  length: 1500,
  sky,
  layers: [
    { speed: FAR, draw: farCity },
    { speed: MID, draw: midCity },
  ],
  ground: { speed: 1, draw: street },
  front: { speed: FRONT, draw: poles },
  events: [TRAIN, SCRAMBLE, VENDING, RUSH, PIGEONS],
}
