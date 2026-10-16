import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'

import { allEvents, AREAS, EVENTS, TRANSITIONS } from './catalog'
import { PixelWalkEngine } from './engine'
import { PX, type Tokens } from './palette'
import { Runner } from './script'
import type { Env } from './types'
import { simulate } from './preview'

// 像素散步（DESIGN.md §14a）：顏色只用 theme.css 的 --color-px-*；每個地區、時段、腳本、轉場都跑得完、不丟錯

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens

describe('調色盤', () => {
  it('theme.css 有全部的 --color-px-*', () => {
    for (const k of PX) expect(tokens[k], k).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
  it('像素散步的程式不寫死色碼', () => {
    const files = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [f, src] of Object.entries(files)) {
      if (f.endsWith('.test.ts') || f.endsWith('preview.ts')) continue
      expect(src, f).not.toMatch(/#[0-9A-Fa-f]{6}\b|rgb\(|hsl\(/)
    }
  })
})

describe('地區', () => {
  it('id 不重複、名稱與長度合理', () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length)
    for (const a of AREAS) {
      expect(a.name.length, a.id).toBeGreaterThan(0)
      expect(a.romaji, a.id).toMatch(/^[A-Z][A-Z .-]+$/)
      expect(a.length, a.id).toBeGreaterThanOrEqual(800)
      expect(a.length, a.id).toBeLessThanOrEqual(2000)
    }
  })
  for (const a of AREAS)
    for (const time of a.times ?? (['day', 'dusk', 'night'] as const))
      it(`${a.id}・${time}：自己走 45 秒（腳本自己挑）不丟錯`, () => {
        const { log, frames } = simulate({ area: a.id, env: { time }, auto: true, times: [1, 15, 30, 45], W: 320, seed: 7 }, tokens)
        expect(log).toEqual([])
        // 畫面沒有透明的洞（天空要鋪滿）
        for (const f of frames) expect(f.g.buf.includes(0), `${a.id} ${f.t}s`).toBe(false)
      })
})

describe('換時段、天氣時佈景不跑掉', () => {
  // 夕陽、點燈、下雨、下雪的腳本會 setEnv 重畫整區（同一個種子）。畫的時候亂數要不管時段、天氣都抽一樣多次，
  // 不然後半段的房子、樹會換位置。比各層「有畫東西的格子」：差 3% 以內（夜裡多出來的燈光、光暈）。
  type Strip = { buf: Uint32Array }
  type SceneView = { layers: Array<{ g: Strip }>; ground: Strip; front: { g: Strip } | null }
  const strips = (area: string, env: Partial<Env>, seed: number) => {
    const e = new PixelWalkEngine({ tokens, areas: AREAS, events: [], transitions: [], seed: 1, first: area }, 320)
    e.forceArea(area, env, seed)
    const sc = (e as unknown as { scene: SceneView }).scene
    return [...sc.layers.map((l) => l.g.buf), sc.ground.buf, ...(sc.front ? [sc.front.g.buf] : [])]
  }
  const diff = (a: Uint32Array, b: Uint32Array) => {
    let d = 0
    let n = 0
    for (let i = 0; i < a.length; i++) {
      const x = a[i] !== 0
      const y = b[i] !== 0
      if (x || y) n++
      if (x !== y) d++
    }
    return n ? d / n : 0
  }
  for (const a of AREAS) {
    const seasons = a.seasons ?? (['spring', 'summer', 'autumn', 'winter'] as const)
    const warm = seasons.find((x) => x !== 'winter')
    const pairs: Array<[string, Partial<Env>, Partial<Env>]> = []
    for (const season of seasons) {
      pairs.push([`${season} 黃昏→夜`, { time: 'dusk', season }, { time: 'night', season }])
      pairs.push([`${season} 白天→黃昏`, { time: 'day', season }, { time: 'dusk', season }])
    }
    if (warm) pairs.push([`${warm} 晴→雨`, { time: 'day', season: warm }, { time: 'day', season: warm, weather: 'rain' }])
    if (seasons.includes('winter')) pairs.push(['winter 晴→雪', { time: 'day', season: 'winter' }, { time: 'day', season: 'winter', weather: 'snow' }])
    it(`${a.id}：${pairs.length} 種換法`, () => {
      for (const seed of [3, 11, 29])
        for (const [label, e1, e2] of pairs) {
          const A = strips(a.id, e1, seed)
          const B = strips(a.id, e2, seed)
          A.forEach((buf, i) => expect(diff(buf, B[i]!), `${label} 種子 ${seed} 第 ${i} 層`).toBeLessThan(0.03))
        }
    })
  }
})

describe('腳本', () => {
  const ids = allEvents().map((e) => e.def.id)
  it('id 不重複', () => expect(new Set(ids).size).toBe(ids.length))
  for (const { def, area } of allEvents())
    it(`${def.id}：40 秒內跑完、不丟錯`, () => {
      const where = area ?? AREAS.find((a) => (!def.tags || def.tags.some((t) => a.tags.includes(t))) && !def.except?.includes(a.id))?.id ?? AREAS[0]!.id
      const env = { time: def.when?.time?.[0], season: def.when?.season?.[0], weather: def.when?.weather?.[0] }
      const { log, frames } = simulate({ area: where, env: Object.fromEntries(Object.entries(env).filter(([, v]) => v)), event: def.id, times: [0.5, 5, 10, 20, 40], W: 320, seed: 3 }, tokens)
      expect(log).toEqual([])
      expect(frames.at(-1)!.running, `${def.id} 40 秒還沒結束`).not.toContain(def.id)
    })
})

describe('轉場', () => {
  it('id 不重複', () => expect(new Set(TRANSITIONS.map((t) => t.id)).size).toBe(TRANSITIONS.length))
  for (const tr of TRANSITIONS)
    for (const from of AREAS.slice(0, 4)) {
      const to = AREAS.find((a) => a.id !== from.id && (!tr.fits || tr.fits(from, a)))
      if (!to) continue
      it(`${tr.id}：${from.id} → ${to.id} 20 秒內換過去、不丟錯`, () => {
        const { log, frames } = simulate({ area: from.id, transition: tr.id, next: to.id, times: [0.5, 3, 8, 20], W: 320, seed: 5 }, tokens)
        expect(log).toEqual([])
        expect(frames.at(-1)!.area).toBe(to.id)
        expect(frames.at(-1)!.running).not.toContain(tr.id)
      })
    }
})

describe('引擎', () => {
  it('自己走 10 分鐘：一直換區、不丟錯、角色不會越積越多、走到盡頭等主要腳本演完', () => {
    const log: string[] = []
    const warn = console.warn
    console.warn = (...a: unknown[]) => log.push(a.map(String).join(' '))
    // 記下被收掉（不是自己演完）的主要腳本
    const stopped: string[] = []
    const stop = Runner.prototype.stop
    Runner.prototype.stop = function (this: Runner) {
      if (!this.done && this.kind === 'main') stopped.push(this.id)
      stop.call(this)
    }
    try {
      for (const W of [190, 427]) {
        const e = new PixelWalkEngine({ tokens, areas: AREAS, events: EVENTS, transitions: TRANSITIONS, seed: W }, W)
        type Peek = { actors: unknown[]; paints: unknown[]; endWait: number; scene: { area: { length: number } } }
        const peek = e as unknown as Peek
        const areas = new Set<string>()
        let maxActors = 0
        let early = 0
        for (let i = 0; i < 60 * 600; i++) {
          const waited = peek.endWait
          const length = peek.scene.area.length
          stopped.length = 0
          e.update(1 / 60)
          if (i % 4 === 0) e.render()
          // 轉場收掉主要腳本：只有等滿 8 秒或地面到底（這一格走到的）才可以
          const atEnd = e.cam >= length + W * 0.5 - 1
          if (stopped.length && waited < 8 - 1 / 30 && !atEnd) early++
          areas.add(e.area.id)
          maxActors = Math.max(maxActors, peek.actors.length)
        }
        expect(areas.size, `W ${W}`).toBeGreaterThanOrEqual(5)
        expect(maxActors, `W ${W}`).toBeLessThan(80)
        expect(peek.paints.length, `W ${W}`).toBeLessThan(20)
        expect(early, `W ${W}：主要腳本被提早收掉`).toBe(0)
      }
    } finally {
      console.warn = warn
      Runner.prototype.stop = stop
    }
    expect(log).toEqual([])
  }, 120_000)
  it('走完一區會自己換到別區', () => {
    const e = new PixelWalkEngine({ tokens, areas: AREAS, events: [], transitions: TRANSITIONS, seed: 9 }, 320)
    const first = e.area.id
    for (let i = 0; i < 60 * 120 && e.area.id === first; i++) e.update(1 / 60)
    if (AREAS.length > 1) expect(e.area.id).not.toBe(first)
  })
})
