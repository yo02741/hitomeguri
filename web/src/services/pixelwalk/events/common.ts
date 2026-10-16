import { drawSprite } from '../build'
import { dotOn } from '../gfx'
import type { EventDef } from '../types'

/**
 * 到處都會遇到的腳本（共用；地區自己的腳本在 areas/*.ts）。
 * 寫法：*run(s) 是 generator；yield 秒數等待、yield null 等一格、yield () => 條件 等到成立。
 * 角色用 s.spawn() 放，腳本結束時一起收掉；旅人用 s.hero.stop()/walk()/emote()/jump() 互動。
 */

// ---------- 貓 ----------
const CAT = [0, 1, 2, 3].map((f) =>
  drawSprite(14, 10, (g) => {
    const leg = [0, 1, 0, -1][f]!
    g.rect(3, 4, 8, 4, 'paper')
    g.rect(5, 4, 3, 2, 'momiji-1')
    g.rect(9, 3, 4, 4, 'paper')
    g.px(9, 2, 'paper')
    g.px(12, 2, 'paper')
    g.px(11, 4, 'ink')
    g.rect(3 + leg, 8, 1, 2, 'paper')
    g.rect(9 - leg, 8, 1, 2, 'paper')
    g.line(3, 4, 1, 1 + (f % 2), 'momiji-1')
  }),
)

export const CAT_CROSS: EventDef = {
  id: 'cat-cross',
  tags: ['town', 'shrine', 'coast', 'city'],
  *run(s) {
    // 貓從前面慢慢走過來（腳在動就要真的在走），旅人停下來看
    const cat = s.spawn({ frames: CAT, fps: 8, x: s.cam + s.W + 10, y: s.FLOOR + 6, z: 'front', flip: true, vx: -14 })
    yield () => cat.sx() < s.hero.x + 40
    yield* s.clearOfFront()
    s.hero.stop()
    s.hero.emote('surprise', 1)
    cat.vx = 0
    yield* s.move(cat, s.hero.worldX + 14, 26)
    cat.fps = 0
    cat.frame = 0
    s.hero.emote('heart', 1.4)
    yield 1.4
    cat.fps = 8
    s.hero.walk()
    yield* s.move(cat, s.cam - 20, 34)
  },
}

// ---------- 春天的花瓣 ----------
export const PETALS: EventDef = {
  id: 'petals',
  kind: 'ambient',
  when: { season: ['spring'] },
  // 沖繩的櫻花（寒緋櫻）一、二月就開完了，而且整朵掉，不會飄花瓣
  except: ['okinawa'],
  *run(s) {
    const len = 18
    const n = Math.round(s.W / 6)
    const ps = Array.from({ length: n }, () => ({ x: s.rng.range(0, s.W), y: s.rng.range(-80, 0), v: s.rng.range(10, 18), p: s.rng.range(0, 6) }))
    s.paint('over', (g, t) => {
      // 最後 2 秒抖色淡掉（不要在同一格全部不見）
      const lv = Math.round(16 * Math.max(0, Math.min(1, t / 1, (len - t) / 2)))
      for (const p of ps) {
        const y = Math.round((p.y + t * p.v) % (s.H + 10))
        const x = Math.round((p.x + Math.sin(t * 1.5 + p.p) * 6 - t * 8 + s.W * 4) % s.W)
        if (lv >= 16 || dotOn(x, y, lv)) g.px(x, y, (Math.floor(t * 4 + p.p) & 1) === 0 ? 'sakura-1' : 'sakura-2')
      }
    })
    yield len
  },
}

export const COMMON_EVENTS: EventDef[] = [CAT_CROSS, PETALS]
