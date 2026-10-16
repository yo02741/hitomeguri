import { drawSprite } from './build'
import type { Gfx } from './gfx'
import type { Sprite } from './sprite'
import { sprite } from './sprite'
import type { Emote, Hero } from './types'
import { FLOOR } from './types'

/**
 * 旅人（像素版）：妹妹頭、藍上衣、背著橘色背包，朝右走。16×24，腳底在 sprite 的最下面一列。
 * 走路 4 格、站著 2 格（眨眼）、跳 1 格；頭上的符號、傘、相機另外畫。
 */
const W = 16
const H = 24

function body(g: Gfx, o: { legA: number; legB: number; bob: number; arm: number; blink?: boolean; tuck?: boolean }) {
  const y0 = o.bob
  // 後面的腳（遠的）先畫，顏色深一點
  const leg = (x: number, lift: number, k: 'roof-2' | 'roof-3') => {
    const top = 18 + y0
    const bottom = o.tuck ? 21 : 22
    g.rect(x, top, 2, bottom - top - lift, k)
    g.rect(x - (k === 'roof-3' ? 0 : 0), bottom - lift, 3, 1, 'wood-3')
  }
  leg(6 + o.legB, o.tuck ? 1 : 0, 'roof-3')
  // 背包（背在左邊＝後面）
  g.rect(2, 11 + y0, 4, 7, 'bag')
  g.rect(2, 11 + y0, 1, 7, 'wood-2')
  g.px(5, 13 + y0, 'wood-2')
  // 身體
  g.rect(5, 12 + y0, 7, 7, 'cloth-1')
  g.rect(10, 12 + y0, 2, 7, 'cloth-2')
  g.rect(5, 12 + y0, 1, 7, 'cloth-2')
  leg(8 + o.legA, 0, 'roof-2')
  // 前面的手（擺動）
  g.rect(8 + o.arm, 13 + y0, 2, 4, 'cloth-2')
  g.rect(8 + o.arm, 17 + y0, 2, 1, 'skin-1')
  // 頭：圓臉、妹妹頭
  g.ellipse(8, 7 + y0, 5, 5, 'hair')
  g.rect(8, 6 + y0, 5, 6, 'skin-1')
  g.rect(12, 7 + y0, 1, 4, 'skin-1')
  g.rect(8, 4 + y0, 6, 2, 'hair') // 瀏海
  g.px(13, 6 + y0, 'hair')
  g.rect(3, 6 + y0, 5, 6, 'hair') // 後面的頭髮
  g.px(8, 11 + y0, 'skin-2')
  // 眼睛、腮紅
  if (o.blink) g.rect(10, 8 + y0, 2, 1, 'ink')
  else g.rect(11, 7 + y0, 1, 2, 'ink')
  g.px(12, 10 + y0, 'sakura-2')
  // 高光
  g.px(6, 4 + y0, 'stone-3')
  g.px(7, 3 + y0, 'stone-3')
}

const mk = (o: Parameters<typeof body>[1]) => drawSprite(W, H, (g) => body(g, o))
export const HERO = {
  walk: [
    mk({ legA: 1, legB: -1, bob: 0, arm: -1 }),
    mk({ legA: 0, legB: 0, bob: -1, arm: 0 }),
    mk({ legA: -1, legB: 1, bob: 0, arm: 1 }),
    mk({ legA: 0, legB: 0, bob: -1, arm: 0 }),
  ],
  stand: [mk({ legA: 0, legB: 0, bob: 0, arm: 0 }), mk({ legA: 0, legB: 0, bob: 0, arm: 0, blink: true })],
  jump: mk({ legA: 1, legB: -1, bob: -1, arm: -1, tuck: true }),
}

// 頭上的符號：9×9 的白色對話框
const BUBBLE = `
  .kkkkkkk.
  kwwwwwwwk
  kwwwwwwwk
  kwwwwwwwk
  kwwwwwwwk
  kwwwwwwwk
  .kkwkkkk.
  ...kk....
`
const glyph: Record<Emote, string> = {
  surprise: `
    ....r....
    ....r....
    ....r....
    .........
    ....r....`,
  question: `
    ...rrr...
    .....r...
    ....r....
    .........
    ....r....`,
  heart: `
    ..rr.rr..
    ..rrrrr..
    ...rrr...
    ....r....
    .........`,
  note: `
    ....bb...
    ....b.b..
    ....b....
    ..bbb....
    ..bb.....`,
  dots: `
    .........
    .........
    .........
    .k..k..k.
    .........`,
  sweat: `
    .....b...
    ....bbb..
    ....bbb..
    .....b...
    .........`,
  zzz: `
    ..bbbb...
    ....b....
    ...b.....
    ..bbbb...
    .........`,
}
export const EMOTES = Object.fromEntries(
  (Object.keys(glyph) as Emote[]).map((e) => {
    const rows = BUBBLE.trim().split('\n').map((r) => r.trim())
    const g = glyph[e].trim().split('\n').map((r) => r.trim())
    // 符號放在框的第 1–5 列
    for (let i = 0; i < 5; i++) {
      const row = rows[i + 1]!.split('')
      const gr = g[i] ?? '.........'
      for (let x = 1; x < 8; x++) if (gr[x] !== '.') row[x] = gr[x]!
      rows[i + 1] = row.join('')
    }
    return [e, sprite(rows.join('\n'), { k: 'ink', w: 'white', r: 'shu-1', b: 'sea-3' })]
  }),
) as Record<Emote, Sprite>

export const UMBRELLA = drawSprite(22, 14, (g) => {
  g.ellipse(11, 7, 10, 6, 'shu-1')
  g.cut(0, 8, 22, 6)
  g.ellipse(11, 7, 6, 4, 'shu-2')
  g.cut(0, 8, 22, 6)
  g.ellipse(11, 7, 4, 3, 'shu-1')
  g.cut(0, 8, 22, 6)
  g.vline(11, 1, 13, 'wood-3')
  g.px(10, 13, 'wood-3')
})

export const CAMERA = drawSprite(6, 5, (g) => {
  g.rect(0, 1, 6, 4, 'stone-4')
  g.rect(1, 0, 2, 1, 'stone-4')
  g.rect(2, 2, 2, 2, 'sea-2')
})

/** 旅人的狀態（引擎用） */
export class HeroState implements Hero {
  x = 0
  y = FLOOR
  cam = 0
  walking = true
  hold: Hero['hold'] = null
  hidden = false
  speed = 1
  flip = false
  private vy = 0
  private jumpY = 0
  private anim = 0
  private emoteKind: Emote | null = null
  private emoteLeft = 0
  private idle = 0

  get worldX() {
    return this.x + this.cam
  }
  get lift() {
    return Math.round(this.jumpY)
  }
  stop() {
    this.walking = false
  }
  walk() {
    this.walking = true
  }
  jump(height = 10) {
    if (this.jumpY < 0) return
    this.vy = -Math.sqrt(2 * 520 * height)
  }
  emote(e: Emote, sec = 1.4) {
    this.emoteKind = e
    this.emoteLeft = sec
  }
  face(dir: 'left' | 'right') {
    this.flip = dir === 'left'
  }

  update(dt: number) {
    this.anim += dt
    this.idle += dt
    if (this.vy !== 0 || this.jumpY < 0) {
      this.vy += 520 * dt
      this.jumpY += this.vy * dt
      if (this.jumpY >= 0) {
        this.jumpY = 0
        this.vy = 0
      }
    }
    if (this.emoteLeft > 0) {
      this.emoteLeft -= dt
      if (this.emoteLeft <= 0) this.emoteKind = null
    }
  }

  /** level < 16：抖色的半透明（被前景擋住時透出來） */
  draw(g: Gfx, level = 16) {
    if (this.hidden) return
    const left = Math.round(this.x - W / 2)
    const top = Math.round(this.y + this.jumpY - H)
    let s: Sprite
    if (this.jumpY < 0) s = HERO.jump
    else if (this.walking) s = HERO.walk[Math.floor(this.anim * 7 * this.speed) % 4]!
    else s = HERO.stand[this.idle % 3.2 > 3.05 ? 1 : 0]!
    if (this.hold === 'umbrella') g.sprite(UMBRELLA, left - 3, top - 10, { level })
    g.sprite(s, left, top, { flip: this.flip, level })
    if (this.hold === 'camera') g.sprite(CAMERA, this.flip ? left + 1 : left + 10, top + 7, { level })
    if (this.emoteKind) {
      const b = EMOTES[this.emoteKind]
      const bounce = this.emoteLeft > 0 && this.anim % 0.5 < 0.25 ? 0 : -1
      g.sprite(b, left + (this.flip ? 0 : 7), top - 10 + bounce, { level })
    }
  }
}
