import { drawSprite } from '../build'
import { dotOn, type Gfx } from '../gfx'
import { EMOTES } from '../hero'
import type { Px } from '../palette'
import type { Sprite } from '../sprite'
import type { Actor, Emote, EventDef, Script, Stage } from '../types'

/**
 * 共用的腳本，第二批：哪裡都可能遇到的小事（遛狗、氣球、腳踏車、拍照…），與依季節、時段出現的天氣與天空。
 * 路上有兩條「道」：旅人後面（BACK，z back）與前面（FRONT，z front，離鏡頭近一點）。
 */
const BACK = (s: Stage) => s.FLOOR - 2
const FRONT = (s: Stage) => s.FLOOR + 7

/** NPC 頭上的符號（跟旅人同一種框）：跟著 who，top 是頭頂離 who 底邊多高 */
function say(s: Stage, who: Actor, e: Emote, top: number, sec = 1.3, dx = 3): Actor {
  return s.spawn({
    frames: EMOTES[e],
    fps: 0,
    x: who.x,
    y: who.y - top,
    space: who.space,
    z: 'over',
    update(a) {
      a.x = who.x + (who.flip ? -dx : dx)
      a.y = who.y - top - (Math.floor(a.age * 4) % 2)
      if (a.age > sec || !who.alive) a.remove()
    },
  })
}

/** 平移到 x（不改朝向：倒車、被拖著走） */
function* slide(a: Actor, x: number, speed: number): Script {
  const dir = Math.sign(x - a.x)
  if (!dir) return
  a.vx = dir * speed
  yield () => !a.alive || (x - a.x) * dir <= 0
  a.vx = 0
  a.x = x
}

/** 走出畫面（左邊）才結束 */
const gone = (s: Stage, a: Actor, margin = 16) => () => a.sx() < -margin || a.sx() > s.W + margin

// ---------- 柴犬與遛狗的阿伯 ----------
type DogPose = 'walk' | 'sniff' | 'sit' | 'brace'
function shiba(pose: DogPose, f: number): Sprite {
  return drawSprite(19, 13, (g) => {
    const B = 'wood-1'
    const W = 'paper'
    const low = pose === 'sniff' ? 2 : pose === 'brace' ? 1 : 0
    // 身體
    if (pose === 'sit') {
      // 坐著：屁股著地、前腳打直、胸口白
      g.poly([3, 12, 4, 8, 8, 5, 12, 5, 12, 12], B)
      g.ellipse(6, 9, 3, 2, B)
      g.rect(10, 6, 2, 5, W)
      g.rect(11, 9, 1, 3, B)
      g.px(11, 11, W)
      g.rect(3, 11, 4, 1, 'wood-2')
    } else {
      g.rect(3, 6, 10, 4, B)
      g.rect(5, 9, 7, 1, W)
      const step = pose === 'walk' ? [0, 1, 0, -1][f % 4]! : 0
      const lean = pose === 'brace' ? 1 : 0
      for (const [x, d] of [
        [4, step],
        [6, -step],
        [10, -step],
        [12, step],
      ] as const) {
        g.rect(x + d + lean, 10, 1, 2, B)
        g.px(x + d + lean, 11, W)
      }
    }
    // 頭（低頭聞的時候往下）
    const hx = pose === 'sit' ? 10 : 11
    const hy = (pose === 'sit' ? 1 : 2) + low
    g.rect(hx, hy + 1, 5, 4, B)
    g.rect(hx + 1, hy, 3, 1, B)
    g.px(hx, hy, B)
    g.px(hx + 3, hy - 1 + (pose === 'brace' ? 1 : 0), B)
    g.px(hx, hy - 1 + (pose === 'brace' ? 1 : 0), B)
    g.rect(hx + 3, hy + 3, 3, 2, W)
    g.px(hx + 6, hy + 3, 'ink')
    g.px(hx + 3, hy + 1 + (pose === 'sniff' && f % 2 ? 1 : 0), 'ink')
    if (pose === 'sniff' && f % 2) g.px(hx + 7, hy + 2, 'stone-1')
    // 捲尾巴（坐著搖）
    if (pose === 'sit') {
      // 坐著搖尾巴：在地上左右掃
      const wx = f % 2 ? 1 : 0
      g.rect(1 + wx, 10 - wx, 3, 1, B)
      g.px(1 + wx, 9 - wx, B)
    } else {
      const wag = pose === 'walk' ? (f % 2 ? 0 : -1) : 0
      const ty = 4 + (pose === 'brace' ? 2 : 0)
      g.rect(2, ty, 2, 2, B)
      g.px(3 + (wag < 0 ? 0 : 1), ty - 1, B)
      g.px(3, ty + 1, W)
    }
  })
}
const DOG = {
  walk: [0, 1, 2, 3].map((f) => shiba('walk', f)),
  sniff: [0, 1].map((f) => shiba('sniff', f)),
  sit: [0, 1].map((f) => shiba('sit', f)),
  brace: [shiba('brace', 0)],
}

/** 戴鴨舌帽的阿伯（14×26）：pose leash＝手往前牽著狗；bow＝點頭；back＝回頭拉 */
function ojisan(f: number, pose: 'walk' | 'stand' | 'bow' | 'pull'): Sprite {
  return drawSprite(15, 27, (g) => {
    const step = pose === 'walk' ? [1, 0, -1, 0][f % 4]! : 0
    const bob = pose === 'walk' && f % 2 ? -1 : 0
    const y = bob
    const leg = (x: number, k: 'stone-3' | 'stone-4') => {
      g.rect(x, 19 + y, 2, 6 - y - 1, k)
      g.rect(x, 24, 3, 1, 'wood-3')
    }
    leg(5 - step + (pose === 'pull' ? -1 : 0), 'stone-4')
    // 上身：綠背心、白襯衫
    const lean = pose === 'pull' ? -1 : 0
    g.rect(4 + lean, 11 + y, 7, 8, 'leaf-3')
    g.rect(4 + lean, 11 + y, 1, 8, 'leaf-4')
    g.rect(9 + lean, 11 + y, 2, 2, 'paper')
    leg(7 + step, 'stone-3')
    // 牽繩的手往前
    if (pose === 'pull') {
      g.rect(9, 14 + y, 4, 2, 'paper')
      g.px(13, 14 + y, 'skin-1')
    } else {
      g.rect(9, 13 + y, 3, 2, 'paper')
      g.rect(11, 15 + y, 2, 1, 'paper')
      g.px(12, 16 + y, 'skin-1')
    }
    // 頭
    const hy = y + (pose === 'bow' ? 2 : 0)
    const hx = pose === 'bow' ? 1 : 0
    g.ellipse(7 + hx, 6 + hy, 4, 4, 'stone-1')
    g.rect(7 + hx, 5 + hy, 4, 5, 'skin-1')
    g.px(11 + hx, 6 + hy, 'skin-1')
    g.rect(10 + hx, 8 + hy, 2, 1, 'stone-1')
    g.px(9 + hx, 6 + hy, 'ink')
    // 鴨舌帽
    g.rect(3 + hx, 2 + hy, 8, 3, 'roof-1')
    g.rect(10 + hx, 4 + hy, 3, 1, 'roof-2')
    g.hline(4 + hx, 9 + hx, 2 + hy, 'roof-2')
  })
}
const OJI = {
  walk: [0, 1, 2, 3].map((f) => ojisan(f, 'walk')),
  stand: [ojisan(0, 'stand')],
  bow: [ojisan(0, 'bow')],
  pull: [ojisan(0, 'pull')],
}

export const SHIBA_WALK: EventDef = {
  id: 'shiba-walk',
  *run(s) {
    const lane = BACK(s)
    // 阿伯先放（畫在狗的後面）
    const man = s.spawn({ frames: OJI.walk, fps: 6, x: s.cam + s.W + 44, y: lane - 1, flip: true, vx: -24 })
    const dog = s.spawn({ frames: DOG.walk, fps: 9, x: s.cam + s.W + 14, y: lane, flip: true, vx: -24 })
    // 牽繩：阿伯的手到狗的項圈，鬆的時候垂下來
    s.spawn({
      x: 0,
      y: 0,
      z: 'back',
      draw(g: Gfx) {
        const hx = Math.round(man.sx() + (man.flip ? -6 : 6))
        const hy = man.y - 10
        const dx = Math.round(dog.sx() + (dog.flip ? 1 : -1) * (dog.frames === DOG.sit ? 3 : 4))
        const dy = dog.y - (dog.frames === DOG.sniff ? 6 : 8)
        const len = 34
        const d = Math.hypot(hx - dx, hy - dy)
        const sag = Math.min(5, Math.round(Math.max(0, len - d) * 0.4))
        const mx = Math.round((hx + dx) / 2)
        const my = Math.min(lane - 2, Math.round(Math.max(hy, dy) + sag))
        g.line(hx, hy, mx, my, 'shu-2')
        g.line(mx, my, dx, dy, 'shu-2')
      },
    })
    const walkBoth = (dogTo: number, manTo: number, v: number) => {
      const a = s.move(dog, dogTo, v)
      const b = s.move(man, manTo, v)
      return (function* () {
        for (;;) {
          const ra = a.next()
          const rb = b.next()
          if (ra.done && rb.done) return
          yield null
        }
      })()
    }
    // 走過來；狗看到旅人，拉著阿伯小跑過來
    yield () => dog.sx() < s.hero.x + 58
    dog.vx = 0
    man.vx = 0
    yield* s.clearOfFront()
    s.hero.stop()
    s.hero.emote('surprise', 0.9)
    dog.fps = 14
    yield* walkBoth(s.hero.worldX + 13, s.hero.worldX + 40, 40)
    man.frames = OJI.stand
    man.fps = 0
    // 聞一聞
    dog.frames = DOG.sniff
    dog.fps = 5
    yield 1.4
    s.hero.emote('heart', 1.6)
    dog.frames = DOG.sit
    dog.fps = 7
    yield 0.8
    man.frames = OJI.bow
    yield 0.6
    man.frames = OJI.stand
    yield 0.4
    // 阿伯要走了（從後面繞過去），狗坐著不走（柴犬拒走）：拉一下、被拖著滑一點
    man.frames = OJI.walk
    man.fps = 7
    yield* s.move(man, s.hero.worldX - 30, 34)
    man.frames = OJI.pull
    man.flip = false
    dog.frames = DOG.brace
    say(s, man, 'sweat', 30, 1.8)
    yield 0.3
    yield* slide(dog, dog.x - 4, 5)
    s.hero.emote('note', 1.2)
    yield 0.9
    // 旅人一走，狗也就跟著阿伯走了
    s.hero.walk()
    yield 0.4
    dog.frames = DOG.walk
    dog.fps = 10
    man.frames = OJI.walk
    const a = s.move(dog, s.cam - 80, 34)
    const b = s.move(man, s.cam - 60, 34)
    for (;;) {
      a.next()
      b.next()
      if (man.sx() < -20 && dog.sx() < -20) break
      yield null
    }
  },
}

// ---------- 小孩的氣球 ----------
/** 戴黃色小帽、背紅書包的小孩（13×20）：arm up＝手舉高拉著氣球；wave＝揮手 */
function kid(f: number, pose: 'walk' | 'stand' | 'wave'): Sprite {
  return drawSprite(14, 21, (g) => {
    const step = pose === 'walk' ? [1, 0, -1, 0][f % 4]! : 0
    const y = pose === 'walk' && f % 2 ? -1 : 0
    g.rect(5 - step, 14 + y, 2, 5 - y, 'skin-2')
    g.rect(5 - step, 19, 2, 1, 'shu-2')
    g.rect(4, 12 + y, 6, 3, 'cloth-2')
    g.rect(4, 8 + y, 6, 5, 'paper')
    g.rect(1, 8 + y, 4, 5, 'shu-1')
    g.hline(1, 4, 8 + y, 'shu-2')
    g.px(2, 10 + y, 'gold-1')
    g.rect(7 + step, 14 + y, 2, 5 - y, 'skin-1')
    g.rect(7 + step, 19, 2, 1, 'shu-2')
    // 手：舉高拉著氣球的線／揮手
    if (pose === 'wave') {
      const up = f % 2
      g.rect(8, 5 + y - up, 2, 4, 'paper')
      g.px(9 + up, 4 + y - up, 'skin-1')
    } else {
      g.rect(8, 6 + y, 2, 4, 'paper')
      g.px(9, 5 + y, 'skin-1')
    }
    // 頭、黃色小帽
    g.ellipse(7, 5 + y, 4, 3, 'hair')
    g.rect(7, 4 + y, 4, 4, 'skin-1')
    g.px(9, 5 + y, 'ink')
    g.px(10, 7 + y, 'sakura-2')
    g.ellipse(6, 2 + y, 4, 2, 'gold-1')
    g.hline(2, 11, 3 + y, 'gold-1')
    g.hline(3, 8, 1 + y, 'lamp-1')
  })
}
const KID = {
  walk: [0, 1, 2, 3].map((f) => kid(f, 'walk')),
  stand: [kid(0, 'stand')],
  wave: [0, 1].map((f) => kid(f, 'wave')),
}
const BALLOON = drawSprite(10, 12, (g) => {
  g.ellipse(4, 4, 4, 4, 'shu-1')
  g.rect(1, 5, 7, 2, 'shu-1')
  g.dither(5, 4, 3, 4, 'shu-2', 8)
  g.rect(2, 2, 1, 2, 'white')
  g.px(3, 1, 'white')
  g.tri(3, 9, 4, 8, 5, 9, 'shu-2')
  g.px(4, 9, 'shu-2')
})

export const BALLOON_EVENT: EventDef = {
  id: 'balloon-away',
  tags: ['city', 'town', 'shrine', 'coast', 'station'],
  when: { time: ['day', 'dusk'] },
  *run(s) {
    const lane = BACK(s)
    const k = s.spawn({ frames: KID.walk, fps: 9, x: s.cam + s.W + 12, y: lane, flip: true, vx: -30 })
    // 氣球：線的一頭在小孩手上；放手之後線垂在下面晃
    let held = true
    const b = s.spawn({
      x: k.x,
      y: k.y - 34,
      update(a) {
        if (held) {
          a.x = k.x - 2 + Math.round(Math.sin(a.age * 2.2) * 1.5)
          a.y = k.y - 34 + Math.round(Math.sin(a.age * 3.1))
        } else {
          // 先往旁邊飄（旅人差一點搆到），過了頭頂才越升越快
          a.vy = Math.max(-28, a.vy - (a.sx() < s.hero.x ? 14 : 5) / 60)
        }
      },
      draw(g, x, y, a) {
        const bx = Math.round(x)
        const by = Math.round(y)
        const sway = Math.round(Math.sin(a.age * 5) * 2)
        const hx = held ? Math.round(k.sx() + (k.flip ? -2 : 2)) : bx + sway
        const hy = held ? k.y - 15 : by + 14
        g.line(bx, by - 2, Math.round((bx + hx) / 2) + (held ? 0 : -sway), Math.round((by + hy) / 2), 'ink-2')
        g.line(Math.round((bx + hx) / 2) + (held ? 0 : -sway), Math.round((by + hy) / 2), hx, hy, 'ink-2')
        g.sprite(BALLOON, bx - 5, by - 12)
      },
    })
    yield () => k.sx() < s.hero.x + 30
    k.vx = 0
    k.fps = 7
    k.frames = KID.stand
    yield* s.clearOfFront()
    s.hero.stop()
    say(s, k, 'note', 25, 1.1, -9)
    yield 1.2
    // 風一吹，線從手裡滑掉
    say(s, k, 'surprise', 25, 1.2, -9)
    held = false
    b.vx = -16
    b.vy = -8
    yield () => b.sx() < s.hero.x + 9
    s.hero.jump(13)
    yield 0.6
    s.hero.emote('sweat', 1.4)
    yield 1.4
    // 一起看著氣球飛上天，小孩揮手說再見
    k.frames = KID.wave
    k.fps = 4
    say(s, k, 'dots', 25, 1.2, -9)
    yield 1.8
    k.frames = KID.walk
    k.fps = 7
    s.hero.walk()
    yield* s.move(k, s.cam + 20, 24)
    yield () => k.sx() < -14 || !k.alive
    k.vx = -24
    yield () => k.sx() < -14 && (b.y < -6 || b.sx() < -10)
  },
}

// ---------- 腳踏車的阿伯按鈴 ----------
/** 戴草帽、穿汗衫的阿伯騎菜籃車（籃子裡插著蔥），朝右；f 踩踏板的兩格；wave 舉手 */
function bike(f: number, wave = false): Sprite {
  return drawSprite(31, 30, (g) => {
    const wheel = (cx: number) => {
      g.ring(cx, 24, 5, 'ink-2')
      g.ring(cx, 24, 4, 'stone-1')
      if (f % 2) {
        g.line(cx - 3, 24, cx + 3, 24, 'stone-2')
        g.line(cx, 21, cx, 27, 'stone-2')
      } else {
        g.line(cx - 2, 22, cx + 2, 26, 'stone-2')
        g.line(cx - 2, 26, cx + 2, 22, 'stone-2')
      }
      g.px(cx, 24, 'ink-2')
    }
    wheel(7)
    wheel(24)
    // 車架（紅）
    g.line(7, 24, 14, 24, 'shu-2')
    g.line(14, 24, 11, 16, 'shu-2')
    g.line(11, 17, 22, 17, 'shu-2')
    g.line(14, 24, 22, 17, 'shu-2')
    g.line(22, 16, 24, 24, 'shu-2')
    g.line(7, 24, 11, 17, 'shu-2')
    g.rect(9, 15, 4, 1, 'ink-2')
    g.line(22, 16, 21, 13, 'stone-3')
    g.hline(19, 22, 13, 'stone-3')
    // 前面的籃子與蔥
    g.rect(23, 13, 6, 4, 'wood-1')
    g.hline(23, 28, 15, 'wood-2')
    g.line(26, 12, 28, 6, 'paper')
    g.line(27, 6, 29, 2, 'leaf-2')
    g.line(28, 6, 26, 3, 'leaf-2')
    // 腳：踏板一前一後
    const [kx, px, py] = f % 2 ? [16, 17, 26] : [15, 12, 22]
    g.line(11, 14, kx, 19, 'stone-3')
    g.line(12, 14, kx + 1, 19, 'stone-3')
    g.line(kx, 19, px, py, 'stone-3')
    g.rect(px - 1, py, 3, 1, 'wood-3')
    // 上身：白色汗衫、手抓把手（或舉手）
    g.rect(10, 7, 5, 8, 'paper')
    g.rect(10, 7, 1, 8, 'paper-2')
    if (wave) {
      g.rect(14, 3, 2, 5, 'skin-1')
      g.rect(14, 2, 2, 1, 'skin-1')
    } else g.line(14, 9, 20, 13, 'skin-1')
    // 頭、草帽
    g.ellipse(13, 4, 3, 3, 'skin-1')
    g.px(15, 4, 'ink')
    g.rect(10, 3, 2, 3, 'stone-1')
    g.rect(9, 2, 9, 1, 'sand-2')
    g.rect(11, 0, 5, 2, 'sand-2')
    g.hline(11, 15, 1, 'shu-1')
  })
}
const BIKE = { ride: [bike(0), bike(1)], wave: [bike(0, true), bike(1, true)] }

export const BICYCLE_BELL: EventDef = {
  id: 'bicycle-bell',
  tags: ['town', 'city', 'farm', 'station', 'coast'],
  // 草帽、短袖汗衫：冬天不騎（北海道、白川鄉的雪路也不會有）
  when: { time: ['day', 'dusk'], season: ['spring', 'summer', 'autumn'] },
  *run(s) {
    // 後面騎過來（前面那條道），老遠就叮鈴叮鈴
    const b = s.spawn({ frames: BIKE.ride, fps: 8, x: s.cam - 30, y: FRONT(s), z: 'front', vx: 72 })
    let ringing = 0
    s.spawn({
      x: 0,
      y: 0,
      z: 'over',
      draw(g) {
        if (ringing <= 0 || Math.floor(ringing * 10) % 2) return
        const x = Math.round(b.sx() + 7)
        const y = b.y - 19
        g.px(x, y - 3, 'gold-1')
        g.line(x + 2, y - 5, x + 3, y - 6, 'gold-1')
        g.line(x + 3, y - 2, x + 5, y - 2, 'gold-1')
      },
      update(_a, dt) {
        ringing -= dt
      },
    })
    yield () => b.sx() > -6
    ringing = 0.9
    yield () => b.sx() > s.hero.x - 44
    ringing = 0.9
    s.hero.stop()
    s.hero.face('left')
    s.hero.emote('surprise', 0.8)
    s.hero.jump(12)
    yield 0.5
    s.hero.face('right')
    yield () => b.sx() > s.hero.x + 18
    // 騎過去才回頭舉手；旅人冒冷汗
    b.frames = BIKE.wave
    say(s, b, 'note', 34, 1.2, -2)
    s.hero.emote('sweat', 1.4)
    yield 0.9
    b.frames = BIKE.ride
    yield 0.6
    s.hero.walk()
    yield gone(s, b, 20)
  },
}

// ---------- 拍照 ----------
/** 烏鴉（朝右）：翅膀上下兩格；n 倍大（離鏡頭很近的時候） */
const crow = (f: number, n: number) =>
  drawSprite(11 * n, 9 * n, (g) => {
    g.ellipse(5 * n, 4 * n, 3 * n, 2 * n, 'roof-3')
    g.rect(7 * n, 2 * n, 2 * n, 2 * n, 'roof-3')
    g.rect(9 * n, 3 * n, n, n, 'stone-3')
    g.rect(8 * n, 2 * n, n, n, 'roof-1')
    g.rect(n, 4 * n, 2 * n, n, 'roof-3')
    if (f) g.tri(3 * n, 4 * n, 6 * n, 4 * n, 4 * n, 0, 'roof-2')
    else g.tri(3 * n, 4 * n, 6 * n, 4 * n, 4 * n, 8 * n, 'roof-2')
  })
const CROW_NEAR = [crow(0, 2), crow(1, 2)]

/** 從畫面取一塊縮小（每 n 格取一格）：拍下來的照片 */
function capture(g: Gfx, x: number, y: number, w: number, h: number, n: number): Uint32Array {
  const out = new Uint32Array(w * h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const xx = Math.min(g.w - 1, Math.max(0, x + i * n + 1))
      const yy = Math.min(g.h - 1, Math.max(0, y + j * n + 1))
      out[j * w + i] = g.buf[yy * g.w + xx]!
    }
  return out
}

/** 拍立得：白框、照片慢慢顯影（抖色由淡到滿） */
function polaroid(s: Stage, img: Uint32Array | null, tw: number, th: number, from: [number, number], to: [number, number]): Actor {
  return s.spawn({
    x: from[0],
    y: from[1],
    space: 'screen',
    z: 'over',
    update(a) {
      const k = Math.min(1, a.age / 0.5)
      if (a.vy === 0 && a.gravity === 0) {
        a.x = from[0] + (to[0] - from[0]) * k
        a.y = from[1] + (to[1] - from[1]) * k
      }
    },
    draw(g, x, y, a) {
      const w = tw + 4
      const h = th + 9
      const L = Math.round(x - w / 2)
      const T = Math.round(y - h)
      const lv = a.level
      const put = (xx: number, yy: number, v: number) => {
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h || (lv < 16 && !dotOn(xx, yy, lv))) return
        g.buf[yy * g.w + xx] = v
      }
      const ink = g.pal.u32['ink']
      const paper = g.pal.u32['white']
      const dark = g.pal.u32['stone-4']
      const dev = Math.min(16, Math.max(0, Math.round((a.age - 0.4) * 14)))
      for (let j = -1; j <= h; j++)
        for (let i = -1; i <= w; i++) {
          const edge = i < 0 || j < 0 || i >= w || j >= h
          if (edge) {
            if (!((i < 0 || i >= w) && (j < 0 || j >= h))) put(L + i, T + j, ink)
            continue
          }
          const pi = i - 2
          const pj = j - 2
          if (pi >= 0 && pj >= 0 && pi < tw && pj < th) put(L + i, T + j, img && dotOn(pi, pj, dev) ? img[pj * tw + pi]! : dark)
          else put(L + i, T + j, paper)
        }
    },
  })
}

export const PHOTO_SNAP: EventDef = {
  id: 'photo-snap',
  *run(s) {
    const prev = s.hero.hold
    yield* s.clearOfFront()
    s.hero.stop()
    yield 0.3
    s.hero.hold = 'camera'
    // 取景框：旅人前面那一塊
    const vx = Math.round(s.hero.x + 14)
    const vw = Math.max(48, Math.min(105, s.W - vx - 8))
    const vy = 50
    const vh = 72
    const tw = Math.floor(vw / 3)
    const th = Math.floor(vh / 3)
    let finder = true
    let flash = 0
    let snap = false
    let shot: Uint32Array | null = null
    s.paint('over', (g, t) => {
      if (snap) {
        shot = capture(g, vx, vy, tw, th, 3)
        snap = false
      }
      if (finder && flash <= 0 && Math.floor(t * 3) % 4 !== 3) {
        for (const [cx, cy, dx, dy] of [
          [vx, vy, 1, 1],
          [vx + vw - 1, vy, -1, 1],
          [vx, vy + vh - 1, 1, -1],
          [vx + vw - 1, vy + vh - 1, -1, -1],
        ] as const) {
          g.hline(cx, cx + dx * 5, cy, 'white')
          g.vline(cx, cy, cy + dy * 5, 'white')
        }
      }
      if (flash > 0) g.cover('white', Math.round(Math.min(1, flash) * 16))
    })
    // 按快門：下一次畫畫面的時候取下來（引擎一格可能更新好幾次才畫一次）
    const shoot = function* (): Script {
      shot = null
      snap = true
      const t0 = s.t
      yield () => shot !== null || s.t - t0 > 0.4
      snap = false
      for (let i = 4; i >= 0; i--) {
        flash = i / 4
        yield 0.05
      }
    }
    // 有時候正要按的時候烏鴉飛過去
    const bomb = s.rng.chance(0.45)
    if (bomb) {
      yield 0.5
      const c = s.spawn({ frames: CROW_NEAR, fps: 10, x: s.W + 14, y: vy + vh / 2 + 10, space: 'screen', z: 'front', vx: -130, flip: true })
      yield () => c.sx() < vx + vw / 2 + 4
      yield* shoot()
      const p1 = polaroid(s, shot, tw, th, [s.hero.x + 8, s.FLOOR - 14], [s.hero.x + 12 + tw / 2, 48])
      yield 1.6
      s.hero.emote('sweat', 1.4)
      yield 1.0
      // 這張不要了：掉下去，重拍
      p1.vy = 30
      p1.gravity = 300
      yield 1.0
      p1.remove()
    } else yield 1.1
    yield* shoot()
    finder = false
    const p = polaroid(s, shot, tw, th, [s.hero.x + 8, s.FLOOR - 14], [s.hero.x + 12 + tw / 2, 48])
    yield 1.4
    s.hero.emote('heart', 1.5)
    yield 1.4
    for (let i = 16; i >= 0; i -= 2) {
      p.level = i
      yield 0.04
    }
    s.hero.hold = prev
    s.hero.walk()
    yield 0.3
  },
}

// ---------- 小鳥停在頭上 ----------
type BirdPose = 'up' | 'down' | 'sit' | 'chirp'
const sparrow = (pose: BirdPose) =>
  drawSprite(11, 9, (g) => {
    g.ellipse(4, 5, 3, 2, 'wood-1')
    g.rect(2, 6, 4, 1, 'paper-2')
    g.rect(5, 2, 3, 3, 'wood-2')
    g.px(7, 4, 'paper')
    g.px(7, 3, 'ink')
    g.px(6, 4, 'ink-2')
    g.rect(0, 4, 2, 1, 'wood-3')
    g.px(4, 4, 'wood-3')
    if (pose === 'chirp') {
      g.px(8, 2, 'stone-4')
      g.px(8, 4, 'stone-4')
    } else g.px(8, 3, 'stone-4')
    if (pose === 'up') g.tri(2, 4, 6, 4, 3, 0, 'wood-2')
    if (pose === 'down') g.tri(2, 5, 6, 5, 3, 8, 'wood-2')
    if (pose === 'sit' || pose === 'chirp') {
      g.px(4, 8, 'wood-3')
      g.px(6, 8, 'wood-3')
      g.hline(2, 5, 5, 'wood-2')
    }
  })
const SPARROW = { fly: [sparrow('up'), sparrow('down')], sit: [sparrow('sit')], chirp: [sparrow('chirp'), sparrow('sit')] }

export const BIRD_ON_HEAD: EventDef = {
  id: 'bird-on-head',
  when: { time: ['day', 'dusk'] },
  *run(s) {
    const hx = s.hero.x - 3
    const top = s.FLOOR - 22
    let perched = false
    const start: [number, number] = [s.W + 8, 26]
    const bird = s.spawn({
      frames: SPARROW.fly,
      fps: 12,
      x: start[0],
      y: start[1],
      space: 'screen',
      z: 'front',
      flip: true,
      draw(g, x, y, a) {
        // 停在頭上：跟著旅人走路的上下（看頭頂那一格是不是頭髮）
        const bob = perched && g.buf[(s.FLOOR - 23) * g.w + Math.round(s.hero.x)] === g.pal.u32['hair'] ? -1 : 0
        const f = a.frames[a.frame % a.frames.length]!
        g.sprite(f, Math.round(x - f.w / 2), Math.round(y - f.h) + bob, { flip: a.flip })
      },
    })
    // 飛過來（往下一沉再拉上來），停在旅人頭上
    const dur = 2.2
    for (let t = 0; t < dur; t += 1 / 60) {
      const k = t / dur
      const e = 1 - (1 - k) * (1 - k)
      bird.x = start[0] + (hx - start[0]) * e
      bird.y = start[1] + (top - start[1]) * e + Math.sin(k * Math.PI) * 18
      yield null
    }
    bird.x = hx
    bird.y = top
    bird.frames = SPARROW.sit
    bird.fps = 0
    bird.flip = false
    perched = true
    yield 0.9
    yield* s.clearOfFront()
    s.hero.stop()
    s.hero.emote('question', 1.2)
    yield 1.4
    bird.frames = SPARROW.chirp
    bird.fps = 4
    yield 1.0
    bird.frames = SPARROW.sit
    s.hero.emote('dots', 1.6)
    yield 1.2
    // 不敢動：放輕腳步慢慢走
    s.hero.speed = 0.45
    s.hero.walk()
    try {
      yield 2.4
      bird.frames = SPARROW.chirp
      bird.fps = 4
      yield 0.8
      // 飛走了
      perched = false
      bird.frames = SPARROW.fly
      bird.fps = 12
      bird.flip = true
      bird.vx = -30
      bird.vy = -50
      s.hero.speed = 1
      s.hero.emote('heart', 1.4)
      yield () => bird.y < -10 || bird.sx() < -10
    } finally {
      s.hero.speed = 1
    }
  },
}

// ---------- 神社抽籤 ----------
const kujiStand = (box: boolean, knots: number) =>
  drawSprite(33, 24, (g) => {
    // 籤筒的台子
    g.rect(2, 13, 14, 2, 'wood-2')
    g.rect(3, 15, 2, 8, 'wood-3')
    g.rect(13, 15, 2, 8, 'wood-3')
    g.rect(2, 3, 5, 10, 'paper')
    g.rect(3, 4, 3, 2, 'shu-1')
    g.vline(4, 7, 11, 'ink-2')
    if (box) {
      g.rect(9, 4, 5, 9, 'wood-1')
      g.rect(9, 6, 5, 2, 'shu-1')
      g.px(11, 4, 'wood-3')
    }
    // 綁籤的架子：繩上綁著白紙
    g.rect(19, 6, 2, 17, 'wood-3')
    g.rect(30, 6, 2, 17, 'wood-3')
    g.hline(19, 31, 9, 'paper-2')
    g.hline(19, 31, 14, 'paper-2')
    for (let i = 0; i < 4 + knots; i++) {
      const x = 22 + ((i * 3) % 8)
      const y = i % 2 ? 14 : 9
      g.rect(x, y - 1, 2, 3, 'white')
    }
  })
const KUJI_BOX = [0, 1, 2].map((f) =>
  drawSprite(9, 12, (g) => {
    const lean = [0, -1, 1][f]!
    g.poly([3 + lean, 1, 6 + lean, 1, 6, 11, 3, 11], 'wood-1')
    g.rect(3, 4, 4, 2, 'shu-1')
    g.px(4 + lean, 1, 'wood-3')
  }),
)

export const OMIKUJI: EventDef = {
  id: 'omikuji',
  tags: ['shrine'],
  when: { time: ['day', 'dusk'] },
  *run(s) {
    const lane = s.FLOOR - 4
    const stand = s.spawn({ frames: kujiStand(true, 0), x: s.cam + s.W + 20, y: lane })
    // 看到籤筒，小跑過去
    s.hero.emote('note', 1)
    const dist = stand.sx() - 16 - s.hero.x
    s.hero.speed = Math.min(3.4, Math.max(1, dist / 3.2 / 22))
    try {
      yield () => stand.sx() - 16 <= s.hero.x
    } finally {
      s.hero.speed = 1
    }
    s.hero.stop()
    yield 0.4
    // 拿起籤筒搖一搖，掉出一支籤
    stand.frames = [kujiStand(false, 0)]
    const box = s.spawn({ frames: KUJI_BOX, fps: 0, x: s.hero.worldX + 7, y: s.FLOOR - 7, z: 'front' })
    for (let i = 0; i < 12; i++) {
      box.frame = i % 2 ? 1 : 2
      box.x = s.hero.worldX + 7 + (i % 2 ? -1 : 1)
      yield 0.08
    }
    box.frame = 0
    box.x = s.hero.worldX + 7
    s.spawn({
      x: box.x,
      y: box.y - 10,
      z: 'front',
      vy: -70,
      gravity: 380,
      draw(g, x, y) {
        g.vline(Math.round(x), Math.round(y) - 6, Math.round(y), 'paper')
        g.px(Math.round(x), Math.round(y) - 6, 'shu-1')
      },
      update(a) {
        if (a.age > 0.36) a.remove()
      },
    })
    yield 0.6
    // 籤紙打開（畫面中間，直書的字＋紅印）
    const lucky = s.rng.chance(0.65)
    let open = 0
    let stamp = -1
    const px = Math.round(s.W / 2 - 13)
    const slip = s.paint('over', (g) => {
      const h = Math.round(46 * open)
      if (h <= 0) return
      const top = 22 + 23 - Math.round(h / 2)
      g.rect(px - 1, top - 1, 28, h + 2, 'ink')
      g.rect(px, top, 26, h, 'white')
      g.hline(px, px + 25, top + 1, 'shu-1')
      g.hline(px, px + 25, top + h - 2, 'shu-1')
      if (open < 1) return
      for (let c = 0; c < 4; c++) for (let r = 0; r < 6; r++) if ((c * 7 + r * 3) % 5 !== 0) g.rect(px + 4 + c * 5, top + 16 + r * 4, 2, 2, 'ink-2')
      if (stamp >= 0) {
        const big = stamp < 0.12 ? 1 : 0
        const sz = (lucky ? 9 : 7) + big * 2
        const sx = px + 13 - Math.floor(sz / 2)
        const sy = top + 7 - Math.floor(sz / 2) - big
        g.rect(sx, sy, sz, sz, 'shu-1')
        g.frame(sx + 1, sy + 1, sz - 2, sz - 2, 'white')
        g.rect(sx + 3, sy + 3, sz - 6, sz - 6, 'white')
      }
    })
    for (let i = 1; i <= 8; i++) {
      open = i / 8
      yield 0.04
    }
    yield 0.4
    const t0 = s.t
    s.spawn({ x: 0, y: 0, update: () => void (stamp = s.t - t0) })
    yield 0.9
    if (lucky) {
      s.hero.jump(10)
      s.hero.emote('heart', 1.6)
      yield 0.55
      s.hero.jump(8)
      yield 1.1
    } else {
      s.hero.emote('sweat', 1.4)
      yield 1.4
    }
    for (let i = 8; i >= 0; i--) {
      open = i / 8
      yield 0.03
    }
    slip.stop()
    box.remove()
    stand.frames = [kujiStand(true, lucky ? 0 : 1)]
    if (!lucky) {
      // 不好的籤綁在架子上
      s.hero.emote('dots', 1)
      yield 1
    }
    s.hero.walk()
    yield gone(s, stand, 20)
  },
}

// ---------- 夜裡的狸貓 ----------
const tanuki = (f: number, leaf = false) =>
  drawSprite(17, 13, (g) => {
    const step = f % 2
    g.ellipse(2, 7, 2, 3, 'wood-1')
    g.hline(1, 3, 6, 'wood-3')
    g.hline(1, 3, 9, 'wood-3')
    g.ellipse(8, 7, 5, 4, 'wood-1')
    g.ellipse(9, 9, 2, 1, 'dirt-1')
    g.rect(5 + step, 10, 2, 2, 'wood-3')
    g.rect(10 - step, 10, 2, 2, 'wood-3')
    g.ellipse(12, 5, 3, 3, 'wood-1')
    g.rect(11, 4, 4, 2, 'hair')
    g.px(13, 4, 'white')
    g.px(15, 6, 'ink')
    g.rect(13, 6, 2, 1, 'dirt-1')
    g.px(10, 2, 'hair')
    g.px(13, 2, 'hair')
    if (leaf) {
      g.tri(10, 2, 15, 1, 12, -1, 'leaf-2')
      g.px(12, 1, 'leaf-3')
    }
  })
const KETTLE = [0, 1].map((f) =>
  drawSprite(17, 13, (g) => {
    // 茶釜（文福茶釜）：尾巴還露在外面
    g.ellipse(2 - f, 8, 1, 3, 'wood-1')
    g.hline(1 - f, 2 - f, 7, 'wood-3')
    g.hline(1 - f, 2 - f, 10, 'wood-3')
    g.ellipse(9, 8, 6, 4, 'stone-3')
    g.rect(4, 7, 11, 1, 'stone-2')
    g.dither(5, 9, 4, 3, 'stone-2', 6)
    g.rect(6, 3, 6, 2, 'stone-2')
    g.px(9, 2, 'stone-1')
    g.line(15, 7, 16, 4, 'stone-3')
    g.line(5, 4, 4, 1, 'stone-1')
    g.line(13, 4, 14, 1, 'stone-1')
    g.hline(5, 13, 0, 'stone-1')
  }),
)
const TANUKI = { walk: [tanuki(0), tanuki(1)], sit: [tanuki(0)], leaf: [tanuki(0, true)] }

/** 一團煙（變身） */
function poof(s: Stage, x: number, y: number): Actor {
  const puffs = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2 + s.rng.range(0, 0.6), r: s.rng.range(2.5, 4) }))
  return s.spawn({
    x,
    y,
    z: 'front',
    draw(g, cx, cy, a) {
      const t = a.age / 0.6
      const lv = Math.round(16 * (1 - t * t))
      for (const p of puffs) {
        const d = 3 + t * 8
        const px = Math.round(cx + Math.cos(p.a) * d)
        const py = Math.round(cy - 6 + Math.sin(p.a) * d * 0.7 - t * 4)
        const r = p.r + t * 1.5
        for (let yy = -Math.ceil(r); yy <= r; yy++)
          for (let xx = -Math.ceil(r); xx <= r; xx++)
            if (xx * xx + yy * yy <= r * r && dotOn(px + xx, py + yy, lv)) g.px(px + xx, py + yy, xx + yy > 1 ? 'stone-1' : s.env.time === 'night' ? 'star' : 'white')
      }
    },
    update(a) {
      if (a.age > 0.6) a.remove()
    },
  })
}

export const TANUKI_NIGHT: EventDef = {
  id: 'tanuki-night',
  tags: ['nature', 'mountain', 'farm', 'shrine'],
  when: { time: ['night', 'dusk'] },
  // 沖繩沒有狸貓
  except: ['okinawa'],
  *run(s) {
    const lane = BACK(s)
    const t = s.spawn({ frames: TANUKI.walk, fps: 6, x: s.cam + s.W + 12, y: lane, flip: true, vx: -20 })
    yield () => t.sx() < s.hero.x + 44
    t.vx = 0
    t.frames = TANUKI.sit
    yield* s.clearOfFront()
    s.hero.stop()
    say(s, t, 'surprise', 22, 0.9, -3)
    s.hero.emote('surprise', 0.9)
    yield 1.0
    // 頭上頂一片葉子，碰！變成茶釜
    t.frames = TANUKI.leaf
    yield 0.6
    poof(s, t.x, t.y)
    yield 0.12
    t.frames = KETTLE
    t.fps = 0
    t.frame = 0
    yield 0.6
    s.hero.emote('question', 1.4)
    yield 1.6
    // 尾巴動了一下
    t.fps = 6
    yield 0.6
    t.fps = 0
    t.frame = 0
    s.hero.emote('dots', 1.4)
    yield 1.2
    s.hero.walk()
    // 旅人走遠了，變回來溜走
    yield () => t.sx() < s.hero.x - 26
    poof(s, t.x, t.y)
    yield 0.12
    t.frames = TANUKI.walk
    t.fps = 12
    t.flip = true
    t.vx = -60
    yield gone(s, t, 20)
  },
}

// ---------- 自動販賣機 ----------
const vendo = (night: boolean, body: Px) =>
  drawSprite(24, 34, (g) => {
    g.rect(1, 1, 22, 32, body)
    g.rect(1, 1, 22, 2, 'stone-1')
    g.rect(21, 3, 2, 30, 'stone-3')
    g.rect(3, 4, 17, 13, night ? 'lamp-1' : 'white')
    const cans: Px[] = ['shu-1', 'gold-1', 'leaf-2', 'cloth-1', 'momiji-1', 'wood-2', 'sakura-2', 'stone-4']
    for (let i = 0; i < 8; i++) {
      const cx = 4 + (i % 4) * 4
      const cy = 5 + Math.floor(i / 4) * 6
      g.rect(cx, cy, 3, 4, cans[i]!)
      g.px(cx + 1, cy + 5, night ? 'neon-1' : 'shu-1')
    }
    g.rect(4, 19, 13, 7, 'ink')
    g.rect(18, 19, 2, 4, 'stone-2')
    g.rect(4, 28, 15, 3, 'ink-2')
    g.rect(1, 32, 22, 1, 'stone-4')
  })
const BIN = drawSprite(9, 13, (g) => {
  g.rect(1, 2, 7, 10, 'stone-2')
  g.rect(1, 2, 7, 2, 'stone-3')
  g.rect(3, 2, 3, 1, 'ink')
  g.dither(5, 4, 3, 8, 'stone-3', 6)
})
const CAN = (k: Px) =>
  drawSprite(5, 7, (g) => {
    g.rect(1, 1, 3, 5, k)
    g.hline(1, 3, 1, 'stone-1')
    g.px(1, 3, 'white')
  })

export const VENDING: EventDef = {
  id: 'vending-machine',
  // 東京有自己的自動販賣機（tokyo-vending），這個不去東京
  tags: ['town', 'farm', 'coast'],
  *run(s) {
    const hot = s.env.season === 'winter' || s.env.season === 'autumn'
    const lane = s.FLOOR - 3
    const vm = s.spawn({ frames: vendo(s.env.time !== 'day', hot ? 'shu-1' : 'cloth-1'), x: s.cam + s.W + 16, y: lane })
    const bin = s.spawn({ frames: BIN, x: vm.x + 16, y: lane })
    const can = CAN(hot ? 'shu-2' : 'sea-2')
    // 看到販賣機，快步走過去（冬天：好冷）
    s.hero.emote(hot ? 'sweat' : 'surprise', 1)
    s.hero.speed = Math.min(3.6, Math.max(1, (vm.sx() - 15 - s.hero.x) / 3 / 22))
    try {
      yield () => vm.sx() - 15 <= s.hero.x
    } finally {
      s.hero.speed = 1
    }
    s.hero.stop()
    yield 0.4
    // 投幣、按下去：咚
    const coin = s.spawn({ x: s.hero.worldX + 6, y: s.FLOOR - 10, z: 'front', draw: (g, x, y) => g.rect(Math.round(x), Math.round(y), 2, 2, 'gold-1') })
    yield* s.move(coin, vm.x + 7, 40)
    coin.remove()
    yield 0.3
    let digits = [0, 0, 0, 0]
    let spinning = 4
    let blink = false
    let drops = 0
    s.spawn({
      x: 0,
      y: 0,
      z: 'back',
      draw(g) {
        const L = Math.round(vm.sx() - 12)
        const T = vm.y - 34
        if (!blink || Math.floor(s.t * 8) % 2) for (let i = 0; i < 4; i++) g.text(String(digits[i]), L + 4 + i * 4, T + 20, 'neon-2')
        for (let i = 0; i < drops; i++) g.sprite(can, L + 6 + i * 6, T + 26)
      },
      update() {
        for (let i = 4 - spinning; i < 4; i++) digits[i] = s.rng.int(0, 9)
      },
    })
    drops = 1
    yield 0.8
    // 數字輪盤：7 7 7 …
    const win = s.rng.chance(0.3)
    for (let i = 0; i < 4; i++) {
      yield i === 3 ? 0.7 : 0.35
      spinning--
      digits[i] = i < 3 || win ? 7 : s.rng.pick([1, 3, 6, 8])
    }
    if (win) {
      blink = true
      s.hero.jump(9)
      s.hero.emote('surprise', 1)
      yield 0.8
      drops = 2
      yield 0.6
    } else {
      s.hero.emote('dots', 1.1)
      yield 1.2
    }
    blink = false
    // 拿起來喝
    drops = 0
    const held = s.spawn({ frames: can, x: s.hero.x + 6, y: s.FLOOR - 7, space: 'screen', z: 'front' })
    const steam = s.paint('front', (g, t) => {
      if (!hot || !held.alive) return
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.9 + i / 3) % 1
        g.px(Math.round(held.x + Math.sin(k * 6 + i) * 1.5), Math.round(held.y - 8 - k * 9), k < 0.6 ? 'white' : 'stone-1')
      }
    })
    yield 0.6
    held.y = s.FLOOR - 12
    yield 0.8
    s.hero.emote('heart', 1.3)
    held.y = s.FLOOR - 7
    yield 1.0
    steam.stop()
    // 空罐丟進旁邊的回收桶
    held.space = 'world'
    held.x += s.cam
    const dx = bin.x - held.x
    const tt = 0.55
    held.vx = dx / tt
    held.gravity = 420
    held.vy = (bin.y - 12 - held.y - 0.5 * 420 * tt * tt) / tt
    yield tt
    held.remove()
    if (drops === 0 && win) {
      s.hero.emote('note', 1)
    }
    s.hero.speed = 1.4
    s.hero.walk()
    try {
      yield gone(s, bin, 14)
    } finally {
      s.hero.speed = 1
    }
  },
}

// ---------- 烤地瓜的車 ----------
const yakiimoTruck = (night: boolean) =>
  drawSprite(48, 26, (g) => {
    // 車斗：石窯、煙囪、紅燈籠
    g.rect(1, 15, 30, 5, 'paper-2')
    g.hline(1, 30, 15, 'stone-1')
    g.rect(4, 7, 17, 8, 'stone-4')
    g.rect(4, 7, 17, 1, 'stone-3')
    g.rect(8, 10, 8, 4, 'ink-2')
    g.rect(9, 12, 6, 2, 'lamp-2')
    g.px(11, 11, 'lamp-1')
    g.rect(16, 1, 3, 6, 'stone-3')
    g.vline(26, 4, 7, 'ink-2')
    g.ellipse(26, 10, 2, 3, night ? 'lamp-2' : 'shu-1')
    g.hline(25, 27, 7, 'ink-2')
    g.hline(25, 27, 13, 'ink-2')
    // 車頭
    g.rect(31, 7, 14, 13, 'white')
    g.rect(31, 7, 1, 13, 'stone-1')
    g.rect(36, 9, 7, 5, night ? 'sky-night-3' : 'sea-1')
    g.rect(37, 11, 3, 3, 'skin-1')
    g.hline(37, 39, 10, 'paper')
    g.rect(44, 15, 2, 2, 'lamp-1')
    g.rect(30, 20, 17, 2, 'stone-3')
    g.rect(1, 20, 29, 2, 'stone-3')
    for (const cx of [9, 38]) {
      g.circle(cx, 22, 3, 'ink-2')
      g.px(cx, 22, 'stone-2')
    }
  })
const POTATO = [0, 1, 2].map((f) =>
  drawSprite(9, 6, (g) => {
    // 烤地瓜：紫紅的皮，剝開是金黃色
    if (f < 2) {
      g.rect(2, 1, 5, 3, 'shu-2')
      g.px(1, 2, 'shu-2')
      g.px(7, 2, 'shu-2')
      g.dither(2, 1, 5, 3, 'lavender', 5)
      g.px(3, 1, 'sakura-2')
      if (f === 1) g.rect(4, 1, 3, 2, 'gold-1')
    } else {
      g.rect(3, 1, 3, 2, 'shu-2')
      g.rect(4, 1, 2, 2, 'gold-1')
    }
  }),
)
const NOTE = drawSprite(6, 7, (g) => {
  g.vline(3, 0, 4, 'white')
  g.rect(1, 3, 3, 2, 'white')
  g.px(4, 1, 'white')
})

export const YAKIIMO: EventDef = {
  id: 'yakiimo',
  tags: ['town', 'city', 'snow', 'farm'],
  when: { season: ['winter'] },
  *run(s) {
    const lane = BACK(s) + 1
    const truck = s.spawn({ frames: yakiimoTruck(s.env.time === 'night'), x: s.cam + s.W + 30, y: lane, flip: true, vx: -40 })
    // 煙囪的煙、一路放著叫賣的旋律（音符）
    const fx: Array<{ x: number; y: number; t: number; note: boolean }> = []
    let tick = 0
    s.spawn({
      x: 0,
      y: 0,
      z: 'back',
      update(_a, dt) {
        tick += dt
        if (truck.sx() > -30 && Math.floor((tick - dt) * 5) !== Math.floor(tick * 5)) fx.push({ x: truck.x + 7, y: truck.y - 25, t: 0, note: false })
        if (truck.sx() > -30 && Math.floor((tick - dt) / 0.7) !== Math.floor(tick / 0.7) && truck.vx !== 0) fx.push({ x: truck.x - 14, y: truck.y - 20, t: 0, note: true })
        for (const p of fx) {
          p.t += dt
          p.y -= dt * (p.note ? 10 : 7)
          p.x += dt * (p.note ? Math.sin(p.t * 6) * 6 : 4)
        }
        for (let i = fx.length - 1; i >= 0; i--) if (fx[i]!.t > (fx[i]!.note ? 1.6 : 1.8)) fx.splice(i, 1)
      },
      draw(g) {
        for (const p of fx) {
          const x = Math.round(p.x - s.cam)
          const y = Math.round(p.y)
          if (p.note) g.sprite(NOTE, x - 3, y - 7, { level: Math.round(16 * (1 - p.t / 1.6)) })
          else {
            const r = 1 + p.t * 2
            const lv = Math.round(14 * (1 - p.t / 1.8))
            for (let yy = -Math.ceil(r); yy <= r; yy++)
              for (let xx = -Math.ceil(r); xx <= r; xx++) if (xx * xx + yy * yy <= r * r && dotOn(x + xx, y + yy, lv)) g.px(x + xx, y + yy, 'stone-1')
          }
        }
      },
    })
    yield () => truck.sx() < s.hero.x + 90
    s.hero.stop()
    s.hero.emote('heart', 1.4)
    truck.vx = 0
    yield* s.move(truck, s.hero.worldX + 34, 34)
    truck.flip = true
    yield 0.7
    // 從石窯丟過來一顆
    const imo = s.spawn({ frames: POTATO, fps: 0, x: s.hero.worldX + 26, y: s.FLOOR - 14, z: 'front' })
    const tt = 0.5
    imo.vx = (s.hero.worldX + 6 - imo.x) / tt
    imo.gravity = 400
    imo.vy = (s.FLOOR - 8 - imo.y - 0.5 * 400 * tt * tt) / tt
    yield tt
    imo.vx = 0
    imo.vy = 0
    imo.gravity = 0
    imo.y = s.FLOOR - 8
    // 好燙：手上跳來跳去
    s.hero.emote('sweat', 1.6)
    for (let i = 0; i < 3; i++) {
      imo.vy = -80
      imo.gravity = 520
      imo.x = s.hero.worldX + (i % 2 ? 8 : 4)
      yield () => imo.vy > 0 && imo.y >= s.FLOOR - 8
      imo.vy = 0
      imo.gravity = 0
      imo.y = s.FLOOR - 8
    }
    imo.x = s.hero.worldX + 6
    imo.frame = 1
    s.hero.emote('heart', 1.4)
    const steam = s.paint('front', (g, t) => {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.8 + i / 3) % 1
        g.px(Math.round(imo.sx() + i - 1 + Math.sin(k * 5 + i)), Math.round(imo.y - 4 - k * 10), k < 0.6 ? 'white' : 'stone-1')
      }
    })
    yield 1.4
    imo.frame = 2
    yield 0.7
    steam.stop()
    imo.remove()
    s.hero.emote('note', 1)
    // 車開走
    truck.vx = -26
    yield 0.5
    s.hero.walk()
    yield () => truck.sx() < -30 && fx.length === 0
  },
}

// ================= ambient：天氣、天空、季節 =================

/** 0→1→0 的強度：前 a 秒淡入、最後 b 秒淡出（總長 len） */
const envelope = (t: number, len: number, a: number, b: number) => Math.max(0, Math.min(1, t / a, (len - t) / b))

/** 在 (x, y) 點一格，level 0–16 抖色（淡入淡出） */
function dot(g: Gfx, x: number, y: number, k: Px, level: number) {
  x = Math.round(x)
  y = Math.round(y)
  if (level >= 16 || dotOn(x, y, level)) g.px(x, y, k)
}

// ---------- 陣雨（雨停了偶爾有彩虹） ----------
export const SHOWER: EventDef = {
  id: 'shower',
  kind: 'ambient',
  when: { season: ['spring', 'summer', 'autumn'], weather: ['clear'] },
  *run(s) {
    const len = 11
    const night = s.env.time === 'night'
    const rain: Px = night ? 'sky-night-3' : 'snow-2'
    const drops = Array.from({ length: Math.round(s.W / 2.6) }, () => ({ x: s.rng.range(0, s.W + 40), y: s.rng.range(0, s.H), v: s.rng.range(170, 230), l: s.rng.int(3, 5), hit: s.rng.int(s.FLOOR - 6, s.H - 2) }))
    const splash: Array<{ x: number; y: number; t: number }> = []
    let amount = 0
    s.setEnv({ weather: 'rain' })
    yield 0.6
    s.spawn({
      x: 0,
      y: 0,
      update(a, dt) {
        amount = envelope(a.age, len, 2, 2)
        if (amount > 0.35 && s.hero.hold === null && a.age < len - 1.5) s.hero.hold = 'umbrella'
        for (let i = 0; i < 3; i++) if (s.rng.chance(amount * 0.9)) splash.push({ x: s.rng.range(0, s.W), y: s.rng.int(s.FLOOR - 6, s.H - 2), t: 0 })
        for (const p of splash) p.t += dt
        for (let i = splash.length - 1; i >= 0; i--) if (splash[i]!.t > 0.2) splash.splice(i, 1)
      },
    })
    s.paint('over', (g, t) => {
      const n = Math.round(drops.length * amount)
      for (let i = 0; i < n; i++) {
        const d = drops[i]!
        const y = ((d.y + t * d.v) % (s.H + 12)) - 12
        if (y > d.hit) continue
        const x = (((d.x - y * 0.3 + (s.cam % (s.W + 40)) * -0.2) % (s.W + 40)) + s.W + 40) % (s.W + 40)
        g.line(x, y, x + 1, y - d.l, i % 4 ? rain : 'white')
      }
      for (const p of splash) {
        if (p.t < 0.07) g.px(p.x, p.y, rain)
        else {
          g.px(p.x - 1, p.y - 1, rain)
          g.px(p.x + 1, p.y - 1, rain)
          if (p.t > 0.13) {
            g.px(p.x - 2, p.y, rain)
            g.px(p.x + 2, p.y, rain)
          }
        }
      }
    })
    yield len - 1.4
    s.setEnv({ weather: 'clear' })
    yield 1.4
    if (s.hero.hold === 'umbrella') s.hero.hold = null
    if (s.env.time !== 'day' || !s.rng.chance(0.6)) return
    // 彩虹（畫在遠景後面）：下面越來越淡；有海的地方（海畫在天空裡）畫到海平線為止，靠近海平線淡得快一點
    const cx = Math.round(s.W * s.rng.range(0.5, 0.75))
    const R = Math.round(Math.min(110, s.W * 0.3) + 20)
    const bands: Px[] = ['shu-1', 'momiji-1', 'gold-1', 'leaf-1', 'sea-1', 'cloth-1', 'lavender']
    const bottom = Math.min(122, s.area.horizon ?? 122)
    const [fadeFrom, fadeStep] = bottom < 122 ? [bottom - 10, 2] : [90, 6]
    s.paint('sky', (g, t) => {
      const lv = Math.round(10 * envelope(t, 5, 1.2, 1.5))
      if (lv <= 0) return
      for (let y = Math.max(0, 150 - R - 1); y < bottom; y++)
        for (let x = Math.max(0, cx - R - 1); x <= Math.min(s.W - 1, cx + R + 1); x++) {
          const b = Math.floor((R - Math.hypot(x - cx, y - 150)) / 2)
          if (b >= 0 && b < bands.length && dotOn(x, y, lv - Math.max(0, Math.round((y - fadeFrom) / fadeStep)))) g.px(x, y, bands[b]!)
        }
    })
    yield 5
  },
}

// ---------- 下雪 ----------
export const SNOWFALL: EventDef = {
  id: 'snowfall',
  kind: 'ambient',
  tags: ['snow', 'mountain', 'town', 'city', 'shrine', 'farm', 'nature', 'station'],
  when: { season: ['winter'], weather: ['clear'] },
  // 沖繩不下雪
  except: ['okinawa'],
  *run(s) {
    const len = 15
    const night = s.env.time === 'night'
    const mk = (n: number, near: boolean) =>
      Array.from({ length: n }, () => ({ x: s.rng.range(0, s.W), y: s.rng.range(-s.H, s.H), v: near ? s.rng.range(20, 30) : s.rng.range(9, 15), p: s.rng.range(0, 7), w: near ? s.rng.range(4, 8) : s.rng.range(2, 4) }))
    const far = mk(Math.round(s.W / 4), false)
    const near = mk(Math.round(s.W / 9), true)
    let amount = 0
    let gust = 0
    s.setEnv({ weather: 'snow' })
    s.spawn({
      x: 0,
      y: 0,
      update(a) {
        amount = envelope(a.age, len, 2.5, 2.5)
        // 中間一陣風：雪往旁邊斜
        gust = Math.max(0, Math.sin(Math.min(1, Math.max(0, (a.age - 6) / 2.5)) * Math.PI))
      },
    })
    const draw = (g: Gfx, t: number, list: typeof far, par: number, big: boolean, k: Px) => {
      const n = Math.round(list.length * amount)
      for (let i = 0; i < n; i++) {
        const f = list[i]!
        const y = ((f.y + t * f.v) % (s.H + 8) + s.H + 8) % (s.H + 8) - 4
        const x = (((f.x + Math.sin(t * 1.3 + f.p) * f.w - s.cam * par - gust * t * (big ? 30 : 14)) % s.W) + s.W) % s.W
        g.px(x, y, k)
        if (big) {
          g.px(x - 1, y, k)
          g.px(x, y - 1, k)
        }
      }
    }
    s.paint('mid', (g, t) => draw(g, t, far, 0.3, false, night ? 'sky-night-3' : 'snow-2'))
    s.paint('over', (g, t) => draw(g, t, near, 1.15, true, night ? 'sky-day-3' : 'snow-1'))
    yield len - 1.5
    s.setEnv({ weather: 'clear' })
    yield 1.5
  },
}

// ---------- 秋天的落葉 ----------
const LEAF_SHAPES = [
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 1], [1, 1], [2, 0], [1, 0]],
  [[1, 0], [1, 1], [2, 1], [1, 2]],
] as const

export const FALLING_LEAVES: EventDef = {
  id: 'falling-leaves',
  kind: 'ambient',
  when: { season: ['autumn'] },
  // 楓葉、銀杏：沖繩的秋天沒有
  except: ['okinawa'],
  *run(s) {
    const len = 14
    const cols: Px[] = ['momiji-1', 'momiji-2', 'gold-1', 'momiji-1', 'wood-1']
    type Leaf = { x: number; y: number; v: number; p: number; amp: number; k: Px; land: number; wx: number | null; spin: number; vx: number }
    const leaves: Leaf[] = []
    let fade = 16
    s.spawn({
      x: 0,
      y: 0,
      update(a, dt) {
        fade = Math.round(16 * envelope(a.age, len, 0.1, 1.5))
        if (a.age < len - 4 && s.rng.chance(dt * (s.W / 45))) {
          leaves.push({ x: s.rng.range(0, s.W + 30), y: -4, v: s.rng.range(13, 20), p: s.rng.range(0, 6), amp: s.rng.range(0.8, 1.6), k: s.rng.pick(cols), land: s.rng.int(s.FLOOR - 5, s.H - 3), wx: null, spin: s.rng.range(3, 7), vx: -6 })
        }
        // 一陣風：空中的葉子一起往左吹
        const gust = a.age > 5 && a.age < 7 ? 1 : 0
        for (const l of leaves) {
          if (l.wx !== null) continue
          l.vx += ((gust ? -70 : -6) - l.vx) * Math.min(1, dt * 2.5)
          l.x += (l.vx + Math.cos(a.age * 2.2 + l.p) * 18 * l.amp) * dt
          l.y += l.v * dt * (gust ? 0.6 : 1)
          if (l.y >= l.land) l.wx = l.x + s.cam
        }
      },
    })
    s.paint('over', (g, t) => {
      for (const l of leaves) {
        if (l.wx !== null) continue
        const sh = LEAF_SHAPES[Math.floor(t * l.spin + l.p) % 4]!
        for (const [dx, dy] of sh) dot(g, l.x + dx, l.y + dy, l.k, fade)
      }
    })
    s.paint('front', (g) => {
      for (const l of leaves) {
        if (l.wx === null) continue
        const x = l.wx - s.cam
        if (x < -3 || x > s.W + 3) continue
        dot(g, x, l.y, l.k, fade)
        dot(g, x + 1, l.y, l.k, fade)
        dot(g, x + 1, l.y - 1, l.k, fade)
      }
    })
    yield len
  },
}

// ---------- 紅蜻蜓 ----------
export const AKATOMBO: EventDef = {
  id: 'akatombo',
  kind: 'ambient',
  tags: ['nature', 'farm', 'mountain', 'town', 'shrine'],
  when: { season: ['autumn'], time: ['day', 'dusk'] },
  *run(s) {
    const len = 14
    type Fly = { x: number; y: number; tx: number; ty: number; wait: number; dir: number }
    const flies: Fly[] = Array.from({ length: s.rng.int(3, 5) }, (_, i) => ({ x: s.W + 10 + i * 14, y: s.rng.range(86, 124), tx: 0, ty: 0, wait: 0, dir: -1 }))
    for (const f of flies) {
      f.tx = s.rng.range(s.W * 0.3, s.W * 0.95)
      f.ty = f.y
    }
    let leaving = false
    s.spawn({
      x: 0,
      y: 0,
      update(a, dt) {
        leaving = a.age > len - 2
        for (const f of flies) {
          const dx = f.tx - f.x
          const dy = f.ty - f.y
          const d = Math.hypot(dx, dy)
          if (d > 1) {
            // 一下子衝過去
            const step = Math.min(d, 150 * dt)
            f.x += (dx / d) * step
            f.y += (dy / d) * step
            if (Math.abs(dx) > 1) f.dir = Math.sign(dx)
          } else if ((f.wait -= dt) <= 0) {
            // 停在空中一下，再換個地方
            f.wait = s.rng.range(0.5, 1.6)
            if (leaving) {
              f.tx = -20
              f.ty = f.y - 30
            } else if (f === flies[0]) {
              // 一隻老是在旅人頭上繞
              f.tx = s.hero.x + s.rng.range(-8, 12)
              f.ty = s.FLOOR - s.rng.range(30, 38)
            } else {
              f.tx = Math.max(8, Math.min(s.W - 8, f.x + s.rng.range(-50, 40)))
              f.ty = Math.max(84, Math.min(128, f.y + s.rng.range(-16, 16)))
            }
          }
        }
      },
    })
    s.paint('front', (g, t) => {
      for (const [i, f] of flies.entries()) {
        const hover = Math.hypot(f.tx - f.x, f.ty - f.y) <= 1 ? Math.round(Math.sin(t * 9 + i) * 0.6) : 0
        const x = Math.round(f.x)
        const y = Math.round(f.y) + hover
        const d = f.dir
        g.hline(x - 4 * d, x, y, 'shu-1')
        g.px(x - 4 * d, y, 'shu-2')
        g.px(x + d, y, 'shu-2')
        g.px(x + d, y - 1, 'shu-2')
        g.px(x + 2 * d, y, 'ink-2')
        // 翅膀：一上一下（很快）
        const up = (Math.floor(t * 30) + i) % 2
        for (const w of [-1, 0, 1]) dot(g, x + w - (up ? 0 : 1) * d, y - 1 - up, 'white', 13)
        dot(g, x - 2 * d, y - 2 + up, 'white', 9)
      }
    })
    yield len
    yield () => flies.every((f) => f.x < -10)
  },
}

// ---------- 螢火蟲 ----------
export const HOTARU: EventDef = {
  id: 'hotaru',
  kind: 'ambient',
  tags: ['nature', 'farm', 'mountain', 'shrine'],
  when: { season: ['summer'], time: ['night'] },
  *run(s) {
    const len = 16
    const mk = (n: number, y0: number, y1: number) =>
      Array.from({ length: n }, () => ({ x: s.rng.range(0, s.W), y: s.rng.range(y0, y1), p: s.rng.range(0, 7), sp: s.rng.range(1.2, 2.2), a: s.rng.range(6, 14), b: s.rng.range(3, 7), f: s.rng.range(0.3, 0.7) }))
    const far = mk(Math.round(s.W / 18), 92, 116)
    const near = mk(Math.round(s.W / 12), 104, 150)
    const draw = (g: Gfx, t: number, list: typeof far, par: number, big: boolean) => {
      const env = envelope(t, len, 2.5, 2.5)
      for (const f of list) {
        const glow = Math.sin(t * f.sp + f.p) * 0.5 + 0.5
        if (glow < 0.35) continue
        const x = (((f.x + Math.sin(t * f.f + f.p) * f.a - s.cam * par) % s.W) + s.W) % s.W
        const y = f.y + Math.sin(t * f.f * 1.7 + f.p * 2) * f.b
        const lv = Math.round(16 * env * Math.min(1, (glow - 0.35) * 3))
        // 亮的時候一圈光暈（抖色）
        if (big && glow > 0.6) g.at(0, 0, () => g.dither(Math.round(x) - 1, Math.round(y) - 1, 3, 3, 'lamp-1', Math.round(lv * 0.45)))
        dot(g, x, y, glow > 0.8 ? 'star' : 'lamp-1', lv)
        if (big && glow > 0.85) dot(g, x + 1, y, 'lamp-1', lv)
      }
    }
    s.paint('mid', (g, t) => draw(g, t, far, 0.35, false))
    s.paint('front', (g, t) => draw(g, t, near, 1.1, true))
    yield len
  },
}

// ---------- 煙火 ----------
export const HANABI: EventDef = {
  id: 'hanabi',
  kind: 'ambient',
  tags: ['town', 'coast', 'city'],
  when: { season: ['summer'], time: ['night', 'dusk'] },
  *run(s) {
    type Shell = { x: number; top: number; t0: number; k: Px; k2: Px; n: number; v: number; kind: 'peony' | 'willow' | 'ring' }
    const shells: Shell[] = []
    const colors: Px[] = ['neon-1', 'neon-2', 'lamp-1', 'lamp-2', 'star']
    const rise = 0.9
    const fire = (at: number) =>
      shells.push({
        x: s.rng.range(s.W * 0.12, s.W * 0.88),
        top: s.rng.range(20, 52),
        t0: at,
        k: s.rng.pick(colors),
        k2: s.rng.pick(colors),
        n: s.rng.int(22, 34),
        v: s.rng.range(26, 38),
        kind: s.rng.pick(['peony', 'peony', 'willow', 'ring'] as const),
      })
    let at = 0.5
    for (let i = 0; i < 8; i++) {
      fire(at)
      at += s.rng.range(0.7, 1.7)
    }
    for (let i = 0; i < 3; i++) fire(at + i * 0.25)
    const end = at + 0.5 + rise + 2.8
    s.paint('sky', (g, t) => {
      for (const sh of shells) {
        const age = t - sh.t0
        if (age < 0) continue
        if (age < rise) {
          // 往上竄的火球，尾巴一閃一閃
          const k = age / rise
          const y = 112 - (112 - sh.top) * (1 - (1 - k) * (1 - k))
          const x = sh.x + Math.sin(age * 20) * 0.6
          g.px(x, y, 'lamp-1')
          for (let j = 1; j < 5; j++) dot(g, x, y + j * 2, 'lamp-2', 12 - j * 3)
          continue
        }
        const a = age - rise
        const life = sh.kind === 'willow' ? 2.6 : 1.8
        if (a > life) continue
        const lv = Math.round(16 * Math.min(1, (life - a) / (life * 0.6)))
        for (let i = 0; i < sh.n; i++) {
          const ang = (i / sh.n) * Math.PI * 2
          const v = sh.kind === 'ring' ? sh.v : sh.v * (0.55 + ((i * 7) % 5) * 0.11)
          const drag = sh.kind === 'willow' ? 1.6 : 2.2
          const grav = sh.kind === 'willow' ? 16 : 9
          const pos = (tt: number) => {
            const r = (v * (1 - Math.exp(-drag * tt))) / drag
            return [sh.x + Math.cos(ang) * r, sh.top + Math.sin(ang) * r * 0.9 + 0.5 * grav * tt * tt] as const
          }
          const [x, y] = pos(a)
          const k = i % 3 === 0 ? sh.k2 : sh.k
          if (a < 0.08) {
            dot(g, sh.x, sh.top, 'star', 16)
            continue
          }
          dot(g, x, y, a > life * 0.75 && (i + Math.floor(a * 20)) % 3 ? 'star' : k, lv)
          // 尾巴
          const trail = sh.kind === 'willow' ? 4 : 2
          for (let j = 1; j <= trail; j++) {
            const [px, py] = pos(Math.max(0, a - j * 0.06))
            dot(g, px, py, sh.kind === 'willow' ? 'gold-1' : k, Math.round(lv * (1 - j / (trail + 1)) * 0.7))
          }
        }
      }
    })
    yield end
  },
}

// ---------- 流星 ----------
export const SHOOTING_STAR: EventDef = {
  id: 'shooting-star',
  kind: 'ambient',
  when: { time: ['night'] },
  *run(s) {
    type Meteor = { x: number; y: number; t0: number; life: number; v: number; tail: number; big: boolean }
    const ms: Meteor[] = []
    let at = s.rng.range(0.6, 1.5)
    const n = s.rng.int(2, 3)
    for (let i = 0; i < n; i++) {
      const big = i === n - 1
      ms.push({ x: s.rng.range(s.W * 0.3, s.W * 0.95), y: s.rng.range(6, 34), t0: at, life: big ? 0.9 : s.rng.range(0.45, 0.7), v: big ? 150 : s.rng.range(170, 220), tail: big ? 30 : s.rng.int(14, 20), big })
      at += s.rng.range(1.6, 3.2)
    }
    const dx = -0.88
    const dy = 0.47
    s.paint('sky', (g, t) => {
      for (const m of ms) {
        const a = t - m.t0
        if (a < 0 || a > m.life + 0.5) continue
        const d = Math.min(a, m.life) * m.v
        const hx = m.x + dx * d
        const hy = m.y + dy * d
        const fade = a > m.life ? 1 - (a - m.life) / 0.5 : 1
        const tail = Math.min(m.tail, d)
        for (let j = 0; j <= tail; j++) {
          const lv = Math.round(16 * (1 - j / (tail + 1)) * fade * (a > m.life ? 0.6 : 1))
          dot(g, hx - dx * j, hy - dy * j, j < 3 ? 'star' : 'moon', lv)
        }
        if (a <= m.life) {
          g.px(hx, hy, 'star')
          if (m.big) {
            g.px(hx + 1, hy, 'star')
            g.px(hx, hy + 1, 'star')
          }
        } else if (m.big) {
          // 最後一閃
          const sp = Math.round(3 * fade)
          for (const [ox, oy] of [[sp, 0], [-sp, 0], [0, sp], [0, -sp]] as const) dot(g, hx + ox, hy + oy, 'star', Math.round(16 * fade))
        }
      }
    })
    yield at + 0.6
  },
}

// ---------- 飛機雲 ----------
export const CONTRAIL: EventDef = {
  id: 'contrail',
  kind: 'ambient',
  when: { time: ['day'], weather: ['clear'] },
  *run(s) {
    const v = Math.max(24, (s.W + 30) / 13)
    const y0 = s.rng.range(18, 34)
    const ltr = s.rng.chance(0.6)
    const x0 = ltr ? -10 : s.W + 10
    const dir = ltr ? 1 : -1
    const cross = (s.W + 20) / v
    const keep = 4.5
    const yAt = (x: number) => y0 - ((x - x0) * dir) / 26
    s.paint('sky', (g, t) => {
      const head = x0 + dir * v * t
      // 雲：剛拉出來細細一條，慢慢變粗、散開
      for (let i = 0; i < v * keep; i++) {
        const x = head - dir * i
        if (x < -2 || x > s.W + 2) continue
        if ((x - x0) * dir < 0) break
        const age = i / v
        const lv = Math.round(16 * Math.max(0, 1 - age / keep))
        const y = yAt(x)
        if (i < 2) continue
        dot(g, x, y, 'white', lv)
        if (age > 0.8) dot(g, x, y + 1, 'cloud-2', Math.round(lv * 0.8))
        if (age > 2) dot(g, x, y - 1, 'cloud-1', Math.round(lv * 0.5))
      }
      // 飛機（很小，在雲的最前面）
      if (head > -4 && head < s.W + 4) {
        const hy = Math.round(yAt(head))
        const hx = Math.round(head)
        g.hline(hx - 2, hx + 2, hy, 'stone-1')
        g.px(hx + 2 * dir, hy, 'white')
        g.px(hx - dir, hy - 1, 'stone-2')
        g.px(hx - dir, hy + 1, 'stone-2')
        g.px(hx - 2 * dir, hy - 1, 'stone-2')
      }
    })
    yield cross + keep
  },
}

// ---------- 候鳥排成人字 ----------
export const WILD_GEESE: EventDef = {
  id: 'wild-geese',
  kind: 'ambient',
  when: { season: ['autumn', 'winter'], time: ['day', 'dusk'] },
  *run(s) {
    const v = Math.max(28, (s.W + 110) / 14)
    const ltr = s.rng.chance(0.5)
    const dir = ltr ? 1 : -1
    const y0 = s.rng.range(28, 46)
    const slots: Array<[number, number]> = [[0, 0]]
    for (let i = 1; i <= 3; i++) slots.push([-i * 7, -i * 4], [-i * 7, i * 4])
    const last: [number, number] = [-4 * 7, 4 * 4]
    // 最後一隻落後了，拍得特別快追上來
    let lag = 34
    let lead = ltr ? -10 : s.W + 10
    s.spawn({
      x: 0,
      y: 0,
      update(a, dt) {
        lead += dir * v * dt
        if (a.age > 3) lag = Math.max(0, lag - 9 * dt)
      },
    })
    const k: Px = s.env.time === 'dusk' ? 'ink-2' : 'roof-2'
    const bird = (g: Gfx, x: number, y: number, flap: number) => {
      x = Math.round(x)
      y = Math.round(y)
      g.px(x, y, k)
      g.px(x + dir, y, k)
      if (flap === 0) {
        g.px(x - 1, y - 1, k)
        g.px(x + 1, y - 1, k)
        g.px(x - 2, y - 2, k)
        g.px(x + 2, y - 2, k)
      } else if (flap === 1) {
        g.px(x - 1, y, k)
        g.px(x + 1, y, k)
        g.px(x - 2, y, k)
        g.px(x + 2, y, k)
      } else {
        g.px(x - 1, y + 1, k)
        g.px(x + 1, y + 1, k)
      }
    }
    s.paint('sky', (g, t) => {
      const wob = Math.sin(t * 0.8) * 2
      for (const [i, [ox, oy]] of slots.entries()) bird(g, lead + ox * dir, y0 + oy + wob, Math.floor(t * 5 + i * 0.7) % 3)
      bird(g, lead + (last[0] - lag) * dir, y0 + last[1] + wob + Math.sin(t * 3) * 1.5, Math.floor(t * (lag > 2 ? 10 : 5)) % 3)
    })
    yield () => (ltr ? lead - 80 > s.W : lead + 80 < 0)
  },
}

export const EXTRA_EVENTS: EventDef[] = [
  SHIBA_WALK,
  BALLOON_EVENT,
  BICYCLE_BELL,
  PHOTO_SNAP,
  BIRD_ON_HEAD,
  OMIKUJI,
  TANUKI_NIGHT,
  VENDING,
  YAKIIMO,
  SHOWER,
  SNOWFALL,
  FALLING_LEAVES,
  AKATOMBO,
  HOTARU,
  HANABI,
  SHOOTING_STAR,
  CONTRAIL,
  WILD_GEESE,
]
