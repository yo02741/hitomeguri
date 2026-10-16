import { drawSprite } from '../build'
import { dotOn, type Gfx } from '../gfx'
import { EMOTES, HERO } from '../hero'
import { chochin, isNight, lantern, machiya, ridge, seasonTree, skyBase, stonePath, torii } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import { sprite } from '../sprite'
import { type AreaDef, type Env, type EventDef, FLOOR, H, type Stage } from '../types'

/**
 * 京都：東山的山、八坂之塔，石板坂道兩旁的町家、石燈籠、朱色鳥居。
 * 範例地區（其他地區照這個寫法）：遠景 0.15、屋頂與塔 0.45、地面 1、前景 1.3。
 */
const PATH = FLOOR - 8

/** 五重塔（八坂之塔）：x 中心、y 塔基 */
function pagoda(g: Gfx, x: number, y: number, s: number, env: Env) {
  const lit = isNight(env)
  for (let i = 0; i < 5; i++) {
    const w = Math.round((26 - i * 3) * s)
    const yy = Math.round(y - (8 + i * 9) * s)
    g.rect(x - Math.round(w * 0.32), yy, Math.round(w * 0.64), Math.round(8 * s), lit ? 'wood-3' : 'shu-2')
    if (lit) g.rect(x - 1, yy + 2, 2, 3, 'lamp-2')
    g.poly([x - w / 2 - 2, yy + 1, x - w * 0.3, yy - 3 * s, x + w * 0.3, yy - 3 * s, x + w / 2 + 2, yy + 1], 'roof-3')
  }
  g.rect(x - 1, Math.round(y - 60 * s), 2, Math.round(16 * s), 'gold-2')
  for (let i = 0; i < 4; i++) g.hline(x - 2, x + 1, Math.round(y - 58 * s + i * 3 * s), 'gold-2')
}

function farHills(g: Gfx, w: number, r: Rng, env: Env) {
  ridge(g, w, 104, 22, 70, r, env.season === 'autumn' ? 'momiji-2' : 'leaf-4')
  ridge(g, w, 112, 12, 44, r, env.season === 'spring' ? 'leaf-3' : env.season === 'autumn' ? 'wood-2' : 'leaf-3')
  if (env.season === 'spring') for (let i = 0; i < w / 6; i++) g.px(r.int(0, w), r.int(96, 118), 'sakura-1')
}

function roofs(g: Gfx, w: number, r: Rng, env: Env) {
  let x = 0
  let lastPagoda = -200
  while (x < w) {
    const kind = r.next()
    if (kind < 0.2 && x - lastPagoda > 280) {
      pagoda(g, x + 20, 122, 1, env)
      lastPagoda = x
      x += 46
      continue
    }
    if (kind < 0.3) {
      // 寺的大屋頂
      const ww = r.int(48, 70)
      g.rect(x + 8, 104, ww - 16, 18, 'wood-3')
      g.poly([x, 106, x + 10, 96, x + ww - 10, 96, x + ww, 106], 'roof-3')
      g.hline(x + 10, x + ww - 10, 96, 'roof-2')
      x += ww + r.int(4, 12)
      continue
    }
    if (kind < 0.5) {
      seasonTree(g, x + 10, 122, r.int(7, 10), env)
      x += 22
      continue
    }
    const ww = r.int(28, 44)
    const top = r.int(104, 110)
    g.rect(x, top + 4, ww, 122 - top, 'wood-3')
    g.poly([x - 2, top + 5, x + 3, top, x + ww - 3, top, x + ww + 2, top + 5], 'roof-2')
    const lit = r.chance(0.5)
    const lx = r.int(3, ww - 8)
    if (isNight(env) && lit) g.rect(x + lx, top + 8, 4, 3, 'lamp-2')
    x += ww + r.int(0, 3)
  }
}

function street(g: Gfx, w: number, r: Rng, env: Env) {
  stonePath(g, w, PATH, r)
  let x = 0
  let sinceTorii = 0
  while (x < w) {
    const roll = r.next()
    if (sinceTorii > 380 && roll < 0.35) {
      // 朱色的鳥居，後面一小段千本鳥居
      g.rect(x, PATH - 50, 70, 50, 'leaf-4')
      for (let i = 0; i < 5; i++) torii(g, x + 14 + i * 11, PATH, 22, 44 - i * 3, i % 2 ? 'shu-2' : 'shu-1', 'shu-2')
      torii(g, x + 40, PATH + 1, 52, 52)
      x += 74
      sinceTorii = 0
      continue
    }
    if (roll < 0.45) {
      // 町家之間的空隙：土塀、樹、石燈籠，看得到後面的屋頂與山
      const gap = r.int(40, 76)
      g.rect(x, PATH - 13, gap, 13, 'paper')
      g.rect(x, PATH - 15, gap, 2, 'roof-2')
      g.hline(x, x + gap - 1, PATH - 4, 'paper-2')
      for (let i = x + 6; i < x + gap - 6; i += r.int(16, 26)) seasonTree(g, i, PATH - 12, r.int(7, 9), env)
      lantern(g, x + gap - 8, PATH, env)
      x += gap
      sinceTorii += gap
      continue
    }
    // 兩到三間町家連在一起
    for (let n = r.int(2, 3); n > 0 && x < w; n--) {
      const ww = r.int(34, 50)
      machiya(g, x, ww, env, r, PATH)
      if (r.chance(0.35)) chochin(g, x + ww - 6, PATH - 30, env)
      x += ww + 1
      sinceTorii += ww
    }
  }
  // 路邊的排水溝與石頭
  g.hline(0, w, PATH + 1, 'stone-3')
}

function front(g: Gfx, w: number, r: Rng, env: Env) {
  for (let x = r.int(80, 200); x < w; x += r.int(220, 420)) {
    // 前景的燈籠柱（駒札）與樹枝
    g.rect(x, H - 34, 4, 34, 'wood-3')
    g.rect(x - 2, H - 40, 8, 7, isNight(env) ? 'lamp-1' : 'paper')
    g.frame(x - 2, H - 40, 8, 7, 'wood-3')
  }
}

// ---------- 京都的腳本 ----------
/** 舞妓：白臉、紅領、垂下的腰帶（だらりの帯），踩著木屐慢慢走 */
const MAIKO = [0, 1].map((f) =>
  drawSprite(14, 26, (g) => {
    g.rect(4, 11, 7, 13, 'sakura-2')
    g.rect(4, 11, 7, 2, 'shu-1')
    g.rect(3, 15, 9, 3, 'gold-1')
    g.rect(2 + f, 16, 3, 9, 'shu-2') // 腰帶
    g.rect(5, 23, 2, 2, 'wood-1')
    g.rect(8 + f, 23, 2, 2, 'wood-1')
    g.ellipse(7, 6, 4, 4, 'hair')
    g.rect(6, 5, 4, 5, 'white')
    g.px(5, 1, 'sakura-1')
    g.px(4, 2, 'sakura-1')
    g.px(3, 3, 'gold-1')
    g.px(7, 8, 'shu-1')
    g.px(8, 6, 'ink')
  }),
)

const MAIKO_EVENT: EventDef = {
  id: 'kyoto-maiko',
  *run(s) {
    // 從右邊走進來（真的在走：一秒 12px），跟旅人錯身而過；旅人停下來點頭
    const m = s.spawn({ frames: MAIKO, fps: 3, x: s.cam + s.W + 12, y: s.FLOOR, flip: true, vx: -12 })
    yield () => m.sx() < s.hero.x + 34
    m.vx = 0
    s.hero.stop()
    s.hero.emote('note', 1.6)
    yield* s.move(m, m.x - 30, 10)
    // 停一下（站著，不踏步）
    m.fps = 0
    m.frame = 0
    yield 0.6
    m.fps = 3
    s.hero.walk()
    // 走出畫面就結束
    m.flip = true
    m.vx = -12
    yield () => m.sx() < -16
  },
}

// ---------- 人力車：空車經過，車夫招手，旅人坐上去跑一段 ----------
const CART = [0, 1, 2].map((f) =>
  drawSprite(37, 31, (g) => {
    // 幌（收起來的車篷）、椅背、座位
    g.poly([2, 3, 9, 0, 12, 3, 10, 16, 4, 16], 'roof-3')
    for (let i = 0; i < 3; i++) g.line(4 + i * 2, 15, 7 + i, 2 + i, 'roof-2')
    g.rect(6, 7, 4, 10, 'roof-3')
    g.rect(8, 14, 13, 2, 'shu-2')
    g.rect(6, 16, 17, 4, 'roof-3')
    g.hline(6, 22, 16, 'roof-2')
    g.rect(19, 18, 9, 2, 'roof-3')
    g.line(27, 19, 25, 23, 'roof-3')
    // 梶棒
    g.line(21, 16, 36, 19, 'roof-3')
    g.line(21, 17, 36, 20, 'roof-2')
    // 大車輪：輻條一格一格轉
    g.ring(13, 21, 9, 'roof-3')
    g.ring(13, 21, 8, 'shu-2')
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4 + (f * Math.PI) / 12
      g.line(13 - Math.cos(a) * 7, 21 - Math.sin(a) * 7, 13 + Math.cos(a) * 7, 21 + Math.sin(a) * 7, 'shu-2')
    }
    g.circle(13, 21, 1, 'gold-2')
  }),
)
/** 客人腿上的紅毯（畫在客人前面） */
const BLANKET = drawSprite(37, 31, (g) => {
  g.rect(10, 12, 11, 6, 'shu-1')
  g.hline(10, 20, 17, 'gold-1')
  g.vline(20, 12, 17, 'shu-2')
})
const RUNNER = [0, 1, 2, 3, 4, 5].map((f) =>
  drawSprite(16, 27, (g) => {
    // f 0–3 跑、4 站、5 回頭招手
    const run = f < 4
    const a = [2, 0, -2, 0][f % 4]!
    const lean = run ? 1 : 0
    // 腿（股引、地下足袋）
    g.rect(6 + a + lean, 17, 2, 8, 'ink-2')
    g.rect(8 - a + lean, 17, 2, 8, 'ink-2')
    g.rect(6 + a + lean, 24, 3, 2, 'ink')
    g.rect(8 - a + lean, 24, 3, 2, 'ink')
    // 法被
    g.rect(5 + lean, 9, 7, 9, 'cloth-2')
    g.vline(8 + lean, 9, 14, 'paper')
    g.hline(5 + lean, 11 + lean, 17, 'paper')
    // 手：往後握著梶棒、或舉起來招手
    if (f === 5) {
      g.rect(3, 6, 2, 5, 'cloth-2')
      g.rect(3, 4, 2, 2, 'skin-1')
    } else {
      g.line(6 + lean, 11, 2, 14, 'cloth-2')
      g.rect(1, 14, 2, 2, 'skin-1')
    }
    // 頭、菅笠
    g.rect(7 + lean, 4, 5, 5, 'skin-1')
    g.px(f === 5 ? 7 + lean : 11 + lean, 6, 'ink')
    g.rect(7 + lean, 4, 5, 1, 'hair')
    g.poly([2 + lean, 4, 9 + lean, 0, 16, 4], 'dirt-1')
    g.hline(3 + lean, 15, 4, 'dirt-2')
  }),
)

interface RickshawState {
  rider: boolean
  run: boolean
  wave: boolean
  spin: number
  note: number
}

function drawRickshaw(g: Gfx, x: number, y: number, flip: boolean, st: RickshawState, t: number) {
  // x 是座位的中心、y 是地面；朝右（flip 朝左）
  const X = (dx: number, w: number) => (flip ? Math.round(x - dx - w) : Math.round(x + dx))
  const top = Math.round(y - 31)
  const wheel = Math.floor(st.spin) % 3
  const legs = st.run ? Math.floor(t * 12) % 4 : st.wave ? 5 : 4
  g.sprite(CART[wheel]!, X(-15, 37), top, { flip })
  if (st.rider) g.sprite(HERO.stand[0]!, X(-10, 16), top - 6, { flip })
  g.sprite(BLANKET, X(-15, 37), top, { flip })
  // 招手的時候車夫回頭（朝旅人那邊）
  g.sprite(RUNNER[legs]!, X(19, 16), top + 4, { flip: st.wave ? !flip : flip })
  if (st.rider && st.note > 0) g.sprite(EMOTES.note, X(-6, 9), top - 18 - (Math.floor(t * 2) % 2))
  if (st.run && st.rider) for (let i = 0; i < 3; i++) g.hline(X(-26 - i * 3, 8), X(-26 - i * 3, 8) + 6 - i * 2, top + 12 + i * 5, 'paper')
}

const RICKSHAW_EVENT: EventDef = {
  id: 'kyoto-rickshaw',
  *run(s) {
    const st: RickshawState = { rider: false, run: true, wave: false, spin: 0, note: 0 }
    let px = s.cam - 40
    const rk = s.spawn({
      x: s.cam - 40,
      y: s.FLOOR + 4,
      z: 'front',
      draw: (g, x, y, a) => drawRickshaw(g, x, y, a.flip, st, a.age),
      update: (a, dt) => {
        st.spin += Math.abs(a.x - px) / 5
        px = a.x
        st.note = Math.max(0, st.note - dt)
      },
    })
    const room = s.cam + s.W + 460 < s.area.length
    try {
      // 從後面追上來
      rk.vx = 64
      yield () => rk.sx() > s.hero.x - 6
      s.hero.stop()
      s.hero.emote('surprise', 1)
      if (!room) {
        yield () => rk.sx() > s.W + 50
        return
      }
      yield () => rk.sx() > s.hero.x + 52
      // 停下來、回頭招手
      for (let i = 0; i < 20; i++) {
        rk.vx *= 0.82
        yield null
      }
      rk.vx = 0
      st.run = false
      st.wave = true
      s.hero.emote('question', 1.4)
      yield 1.6
      // 旅人走過去、跳上車
      s.hero.walk()
      yield () => s.hero.worldX >= rk.x - 2
      s.hero.stop()
      s.hero.emote('heart', 0.8)
      yield 0.7
      s.hero.jump(10)
      yield 0.18
      s.hero.hidden = true
      st.rider = true
      st.wave = false
      yield 0.6
      // 跑一段：畫面捲得飛快
      st.run = true
      st.note = 3
      s.hero.speed = 2.8
      s.hero.walk()
      rk.update = (a, dt) => {
        a.x = s.cam + s.hero.x
        st.spin += (22 * s.hero.speed * dt) / 5
        st.note = Math.max(0, st.note - dt)
      }
      yield 4.2
      s.hero.stop()
      s.hero.speed = 1
      st.run = false
      yield 0.5
      // 下車、車夫往回跑
      st.rider = false
      s.hero.hidden = false
      s.hero.jump(7)
      s.hero.emote('heart', 1.4)
      px = rk.x
      rk.update = (a) => {
        st.spin += Math.abs(a.x - px) / 5
        px = a.x
      }
      yield 0.9
      rk.flip = true
      st.run = true
      rk.vx = -72
      yield 0.6
      s.hero.walk()
      yield () => rk.sx() < -60
    } finally {
      s.hero.hidden = false
      s.hero.speed = 1
    }
  },
}

// ---------- 黃昏的鐘：僧人撞鐘，聲音一圈一圈傳出去，烏鴉飛起來 ----------
const MONK = [0, 1, 2].map((f) =>
  drawSprite(13, 23, (g) => {
    // 朝左；0 站、1 往後拉、2 往前撞
    const lean = [0, 2, -1][f]!
    g.poly([3 + lean, 8, 9 + lean, 8, 11, 22, 1, 22], 'ink-2')
    g.line(4 + lean, 9, 9 + lean, 16, 'gold-2')
    g.line(5 + lean, 9, 10 + lean, 16, 'gold-2')
    g.ellipse(6 + lean, 4, 3, 3, 'skin-1')
    g.px(4 + lean, 4, 'ink')
    g.rect(1 + lean + (f === 1 ? 1 : 0), 11, 3, 2, 'skin-1')
    g.hline(2, 10, 22, 'ink')
  }),
)
const BELL = drawSprite(13, 16, (g) => {
  g.rect(5, 0, 3, 2, 'leaf-4')
  g.ellipse(6, 4, 4, 2, 'leaf-4')
  g.rect(2, 4, 9, 10, 'leaf-4')
  g.hline(1, 11, 14, 'leaf-4')
  g.hline(1, 11, 15, 'stone-4')
  g.hline(2, 10, 8, 'roof-3')
  g.hline(2, 10, 11, 'roof-3')
  g.dither(3, 4, 7, 3, 'stone-3', 6)
  g.vline(3, 5, 13, 'leaf-3')
  g.circle(8, 12, 1, 'stone-3')
})
const KCROW = [
  drawSprite(12, 9, (g) => {
    g.ellipse(6, 6, 3, 1, 'ink-2')
    g.rect(9, 4, 2, 2, 'ink-2')
    g.line(5, 5, 2, 1, 'ink-2')
    g.line(6, 5, 4, 1, 'ink-2')
  }),
  drawSprite(12, 9, (g) => {
    g.ellipse(6, 4, 3, 1, 'ink-2')
    g.rect(9, 3, 2, 2, 'ink-2')
    g.line(5, 5, 2, 7, 'ink-2')
    g.line(6, 5, 4, 8, 'ink-2')
  }),
]

function belfry(g: Gfx, x: number, env: Env, bell: { swing: number; log: number; monk: number }) {
  const P = PATH
  // 後面的林子、筋塀（五條白線的土塀）
  g.rect(x - 58, P - 40, 117, 40, 'leaf-4')
  for (let i = -56; i <= 56; i += 9) g.circle(x + i, P - 41 + ((i * 7) & 3), 7, 'leaf-4')
  for (let i = -52; i <= 52; i += 13) g.dither(x + i - 3, P - 46, 7, 4, 'leaf-3', 6)
  for (const [a, b] of [[x - 60, x - 21], [x + 21, x + 60]] as const) {
    g.rect(a, P - 18, b - a + 1, 18, 'sand-1')
    for (let j = 0; j < 5; j++) g.hline(a, b, P - 15 + j * 2, 'white')
    g.rect(a - 1, P - 21, b - a + 3, 3, 'roof-2')
    g.hline(a - 1, b + 1, P - 21, 'roof-1')
    g.rect(a, P - 3, b - a + 1, 3, 'stone-2')
  }
  // 鐘樓：石基、柱、入母屋的屋根
  g.rect(x - 20, P - 6, 41, 6, 'stone-2')
  g.hline(x - 20, x + 20, P - 6, 'stone-1')
  for (let i = x - 16; i < x + 20; i += 9) g.vline(i, P - 5, P - 1, 'stone-3')
  g.rect(x - 17, P - 37, 3, 31, 'wood-3')
  g.rect(x + 15, P - 37, 3, 31, 'wood-3')
  g.rect(x - 19, P - 38, 39, 3, 'wood-3')
  g.hline(x - 19, x + 19, P - 35, 'wood-2')
  g.poly([x - 28, P - 36, x - 19, P - 46, x + 19, P - 46, x + 28, P - 36], 'roof-3')
  g.poly([x - 13, P - 45, x - 8, P - 53, x + 8, P - 53, x + 13, P - 45], 'roof-3')
  g.hline(x - 28, x + 28, P - 37, 'roof-2')
  g.px(x - 29, P - 38, 'roof-3')
  g.px(x + 29, P - 38, 'roof-3')
  g.rect(x - 9, P - 55, 19, 2, 'roof-2')
  g.rect(x - 10, P - 57, 3, 3, 'roof-3')
  g.rect(x + 8, P - 57, 3, 3, 'roof-3')
  g.tri(x - 5, P - 46, x, P - 51, x + 5, P - 46, 'wood-2')
  g.rect(x - 14, P - 34, 29, 28, 'roof-3')
  if (env.time !== 'day') g.dither(x - 14, P - 12, 29, 6, 'lamp-2', 4)
  // 鐘、撞木（兩條繩子吊著）、僧人
  const bx = x - 4 + Math.round(bell.swing)
  g.vline(bx, P - 35, P - 33, 'wood-3')
  g.sprite(BELL, bx - 6, P - 33)
  const lx = x + 4 + Math.round(bell.log)
  g.line(x + 6, P - 35, lx + 2, P - 25, 'paper-2')
  g.line(x + 13, P - 35, lx + 10, P - 25, 'paper-2')
  g.rect(lx, P - 25, 13, 3, 'wood-2')
  g.vline(lx, P - 25, P - 23, 'wood-3')
  g.hline(lx + 1, lx + 12, P - 25, 'wood-1')
  g.line(lx + 12, P - 23, x + 22, P - 15, 'paper-2')
  g.sprite(MONK[bell.monk]!, x + 19, P - 23)
}

const BELL_EVENT: EventDef = {
  id: 'kyoto-bell',
  when: { time: ['dusk', 'night'] },
  *run(s) {
    const bell = { swing: 0, log: 0, monk: 0, vs: 0 }
    const rings: Array<{ t: number }> = []
    const tower = s.spawn({
      x: s.cam + s.W + 64,
      y: PATH,
      z: 'back',
      draw: (g, x) => belfry(g, Math.round(x), s.env, bell),
      update: (_a, dt) => {
        bell.vs += -bell.swing * 120 * dt
        bell.vs *= 0.96
        bell.swing += bell.vs * dt
        for (const r of rings) r.t += dt
      },
    })
    s.paint('front', (g) => {
      const cx = Math.round(tower.sx()) - 4
      const cy = PATH - 25
      for (const r of rings) {
        for (const d of [0, 0.28]) {
          const tt = r.t - d
          if (tt <= 0 || tt > 2.2) continue
          const rad = 8 + tt * 34
          const level = Math.round(12 * (1 - tt / 2.2))
          const n = Math.round(rad * 6)
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2
            const x = Math.round(cx + Math.cos(a) * rad)
            const y = Math.round(cy + Math.sin(a) * rad * 0.8)
            if (y < PATH + 4 && dotOn(x, y, level)) g.px(x, y, 'lamp-1')
          }
        }
      }
    })
    const strike = function* (): Generator<number | null, void, unknown> {
      bell.monk = 1
      for (let i = 0; i <= 10; i++) {
        bell.log = (i / 10) * 7
        yield 0.05
      }
      bell.monk = 2
      for (let i = 0; i <= 4; i++) {
        bell.log = 7 - (i / 4) * 9
        yield null
      }
      bell.vs = -16
      rings.push({ t: 0 })
      yield 0.3
      bell.monk = 0
      for (let i = 0; i <= 6; i++) {
        bell.log = -2 + (i / 6) * 2
        yield 0.04
      }
    }
    yield () => tower.sx() < s.hero.x + 44
    s.hero.stop()
    yield 0.6
    yield* strike()
    s.hero.jump(6)
    s.hero.emote('surprise', 1)
    yield 1.4
    yield* strike()
    // 烏鴉從屋根飛起來
    for (let i = 0; i < 3; i++)
      s.spawn({ frames: KCROW, fps: 9 + i, x: tower.x - 10 + i * 9, y: PATH - 52 - i * 2, vx: 24 + i * 10, vy: -26 - i * 6, z: 'front' })
    s.hero.emote('note', 1.4)
    yield 1.6
    yield* strike()
    s.hero.emote('zzz', 1.8)
    yield 1.8
    s.hero.jump(4)
    yield 0.4
    s.hero.walk()
    // 走遠了，鐘還在響
    let next = 2.6
    yield () => {
      next -= 1 / 60
      if (next <= 0) {
        next = 99
        bell.vs = -14
        rings.push({ t: 0 })
        next = 2.8
      }
      return tower.sx() < -64
    }
  },
}

// ---------- 秋天的紅葉：一片一片落在頭上，疊成一頂帽子 ----------
const LEAF_ART = `
  ..a..
  a.a.a
  aaaaa
  .aaa.
  ..b..
`
const LEAVES: Px[] = ['momiji-1', 'momiji-2', 'gold-1', 'momiji-1', 'momiji-2']
const LEAF = LEAVES.map((k) => sprite(LEAF_ART, { a: k, b: 'wood-2' }))

const MOMIJI_EVENT: EventDef = {
  id: 'kyoto-momiji',
  when: { season: ['autumn'] },
  *run(s) {
    const head = s.FLOOR - 21
    const pile: Array<ReturnType<Stage['spawn']>> = []
    const drop = (i: number) => {
      const x0 = s.hero.x + s.rng.range(-36, 44)
      const tx = s.hero.x + [0, -3, 3, -1, 1][i]!
      const ty = head + 2 - Math.floor(i * 1.3)
      const p = s.rng.range(0, 6)
      let landed = false
      const leaf = s.spawn({
        frames: [LEAF[i]!],
        x: x0,
        y: -4,
        space: 'screen',
        z: 'front',
        update: (a) => {
          if (landed) return
          const u = Math.min(1, (a.y + 4) / (ty + 4))
          a.x = x0 + (tx - x0) * u + Math.sin(a.age * 3 + p) * 7 * (1 - u)
          a.flip = Math.sin(a.age * 3 + p) > 0
          if (a.y >= ty) {
            a.y = ty
            a.x = tx
            a.vy = 0
            landed = true
            pile.push(a)
          }
        },
      })
      leaf.vy = 30
    }
    for (let i = 0; i < 5; i++) {
      drop(i)
      yield 1.1
    }
    yield () => pile.length >= 5
    yield 0.8
    s.hero.stop()
    s.hero.emote('question', 1.2)
    yield 1.4
    s.hero.emote('surprise', 0.8)
    yield 0.5
    s.hero.jump(8)
    // 散開：飄到地上（世界座標），留一下就消失；最上面那片又落回頭上
    for (let i = 0; i < pile.length - 1; i++) {
      const a = pile[i]!
      a.space = 'world'
      a.x += s.cam
      a.vx = s.rng.range(-34, 34)
      a.vy = s.rng.range(-80, -50)
      const ground = s.FLOOR + s.rng.int(2, 12)
      const p = s.rng.range(0, 6)
      let rest = 0
      a.update = (b, dt) => {
        if (b.y >= ground && b.vy >= 0) {
          b.y = ground
          b.vx = 0
          b.vy = 0
          rest += dt
          if (rest > 2) b.level = 8
          if (rest > 2.8) b.hidden = true
          return
        }
        b.vy = Math.min(22, b.vy + 160 * dt)
        b.vx *= 0.97
        b.x += Math.sin(b.age * 4 + p) * 0.4
        b.flip = Math.sin(b.age * 4 + p) > 0
      }
    }
    const last = pile[pile.length - 1]!
    const y0 = last.y
    last.y = y0 - 10
    last.update = (b) => {
      if (b.y < head + 2) b.y += 0.5
      else b.y = head + 2
    }
    void y0
    yield 1.2
    s.hero.emote('sweat', 1.4)
    yield 1.4
    s.hero.walk()
    yield 2.6
    // 最後一片也滑下來
    last.update = (b) => {
      if (b.y < s.FLOOR + 2) {
        b.y += 0.6
        b.x -= 0.25
      } else b.hidden = true
    }
    yield () => last.hidden
    yield 1.6
  },
}

// ---------- 夜裡的狐狸：稻荷的石像，旅人一轉身就不動了 ----------
const FOX = [0, 1, 2, 3].map((f) =>
  drawSprite(16, 19, (g) => {
    // 0 閉眼朝左、1 睜眼朝左（發光）、2 轉頭朝右看、3 朝右眨一隻眼
    // 月光下白白的石狐（夜裡才出現，用不變暗的 moon 色）
    const right = f >= 2
    const body: Px = 'moon'
    g.ellipse(9, 13, 4, 5, body)
    g.rect(5, 15, 9, 4, body)
    g.ellipse(13, 9, 2, 5, body) // 尾巴
    g.px(13, 4, 'white')
    g.px(14, 5, 'white')
    const hx = right ? 9 : 6
    g.ellipse(hx, 6, 3, 3, body)
    g.rect(right ? hx + 2 : hx - 4, 6, 3, 2, body)
    g.tri(hx - 3, 4, hx - 2, 0, hx, 3, body)
    g.tri(hx, 3, hx + 2, 0, hx + 3, 4, body)
    g.px(hx - 2, 2, 'shu-1')
    g.px(hx + 2, 2, 'shu-1')
    g.rect(5, 9, 7, 3, 'shu-1')
    g.hline(5, 11, 11, 'shu-2')
    const ex = right ? hx + 1 : hx - 2
    if (f === 0) g.hline(ex, ex + 1, 6, 'stone-3')
    else if (f === 3) {
      g.px(ex, 6, 'lamp-2')
      g.hline(ex + 2, ex + 3, 6, 'stone-3')
    } else g.rect(ex, 5, 2, 2, 'lamp-2')
    g.dither(9, 13, 5, 6, 'stone-1', 6)
    g.dither(5, 16, 9, 3, 'stone-1', 6)
  }),
)

const FOX_EVENT: EventDef = {
  id: 'kyoto-fox',
  when: { time: ['night'] },
  *run(s) {
    let face = 0
    const fox = s.spawn({
      x: s.cam + s.W + 24,
      y: PATH,
      z: 'back',
      draw: (g, x, y) => {
        const X = Math.round(x)
        // 後面的樹叢（把町家的燈擋掉，鳥居、石狐才看得清楚）
        g.rect(X - 24, y - 36, 54, 36, 'leaf-4')
        for (let i = -22; i <= 28; i += 8) g.circle(X + i, y - 37 + ((i * 5) & 3), 6, 'leaf-4')
        torii(g, X + 2, y, 30, 34)
        lantern(g, X + 22, y, s.env)
        g.dither(X + 16, y - 6, 13, 6, 'lamp-2', 4)
        g.rect(X - 8, y - 9, 17, 9, 'stone-2')
        g.hline(X - 8, X + 8, y - 9, 'stone-1')
        g.dither(X - 8, y - 6, 17, 6, 'stone-3', 5)
        g.sprite(FOX[face]!, X - 8, y - 9 - 19)
      },
    })
    yield () => fox.sx() < s.hero.x + 10
    s.hero.stop()
    s.hero.emote('question', 1.2)
    yield 1.6
    s.hero.emote('dots', 1)
    yield 1.2
    s.hero.walk()
    yield () => fox.sx() < s.hero.x - 26
    // 背後：睜眼、轉頭
    face = 1
    yield 0.5
    face = 2
    yield 0.9
    s.hero.stop()
    s.hero.face('left')
    face = 0
    s.hero.emote('surprise', 1)
    yield 1.4
    s.hero.emote('question', 1)
    yield 1.2
    s.hero.face('right')
    yield 0.4
    // 狐狸眨一隻眼，狐火飄起來
    face = 3
    for (let i = 0; i < 2; i++) {
      const p = s.rng.range(0, 6)
      s.spawn({
        x: fox.x - 6 + i * 14,
        y: PATH - 24,
        vy: -9,
        z: 'front',
        draw: (g, x, y, a) => {
          const X = Math.round(x + Math.sin(a.age * 2 + p) * 3)
          const Y = Math.round(y)
          const lv = Math.max(0, 16 - Math.floor(a.age * 3))
          g.dither(X - 2, Y - 3, 5, 5, 'lamp-2', Math.min(10, lv))
          if (lv > 4) {
            g.rect(X - 1, Y - 2, 3, 3, 'lamp-1')
            g.px(X, Y - 4 + (Math.floor(a.age * 6) % 2), 'lamp-1')
          }
        },
      })
    }
    yield 0.9
    s.hero.emote('sweat', 1.2)
    s.hero.walk()
    s.hero.speed = 1.5
    try {
      yield () => fox.sx() < -40 || fox.age > 30
    } finally {
      s.hero.speed = 1
    }
  },
}

export const KYOTO: AreaDef = {
  id: 'kyoto',
  name: '京都',
  romaji: 'KYOTO',
  tags: ['town', 'shrine', 'nature'],
  length: 1400,
  sky: (g, env, r) => skyBase(g, env, r, 108),
  layers: [
    { speed: 0.15, draw: farHills },
    { speed: 0.45, draw: roofs },
  ],
  ground: { speed: 1, draw: street },
  front: { speed: 1.3, draw: front },
  events: [MAIKO_EVENT, RICKSHAW_EVENT, BELL_EVENT, MOMIJI_EVENT, FOX_EVENT],
}
