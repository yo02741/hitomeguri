import { allEvents, AREAS, EVENTS, TRANSITIONS } from './catalog'
import { PixelWalkEngine } from './engine'
import { Gfx } from './gfx'
import type { Tokens } from './palette'
import { readTokens } from './palette'
import type { Env } from './types'

/**
 * 預覽與測試（不在正式頁面用）：指定地區、環境、腳本或轉場，跑固定步長的模擬，在指定的秒數取下畫面。
 * 瀏覽器裡用 previewSheet() 拼成一張圖（scratchpad 的 pxprev.mjs 呼叫），node 的測試用 simulate()。
 */
export interface PreviewOpts {
  area: string
  env?: Partial<Env>
  /** 馬上開始的腳本 id（共用或地區的） */
  event?: string
  /** 馬上開始的轉場 id，與下一區 */
  transition?: string
  next?: string
  seed?: number
  W?: number
  /** 取畫面的秒數（由小到大） */
  times: number[]
  /** 一開始先走到哪（地面 px） */
  startCam?: number
  /** 要不要讓引擎自己挑腳本、走到盡頭自己轉場 */
  auto?: boolean
}

export function simulate(o: PreviewOpts, tokens: Tokens): { frames: Array<{ t: number; g: Gfx; running: string[]; area: string }>; log: string[] } {
  const log: string[] = []
  const warn = console.warn
  console.warn = (...a: unknown[]) => log.push(a.map((x) => (x instanceof Error ? `${x.message}\n${x.stack}` : String(x))).join(' '))
  try {
    const e = new PixelWalkEngine({ tokens, areas: AREAS, events: EVENTS, transitions: TRANSITIONS, seed: o.seed ?? 1, first: o.area }, o.W ?? 320)
    e.autoEvents = o.auto ?? false
    e.forceArea(o.area, o.env ?? {}, o.seed ?? 1)
    if (o.startCam) e.cam = o.startCam
    if (o.event) {
      const hit = allEvents().find((x) => x.def.id === o.event)
      if (!hit) throw new Error(`沒有腳本 ${o.event}`)
      e.startEvent(hit.def)
    }
    if (o.transition) {
      const def = TRANSITIONS.find((t) => t.id === o.transition)
      if (!def) throw new Error(`沒有轉場 ${o.transition}`)
      e.startTransition(def, o.next)
    }
    const frames: Array<{ t: number; g: Gfx; running: string[]; area: string }> = []
    const dt = 1 / 60
    let t = 0
    for (const at of [...o.times].sort((a, b) => a - b)) {
      while (t < at - 1e-9) {
        e.update(dt)
        t += dt
      }
      const f = e.render()
      frames.push({ t: at, g: new Gfx(f.w, f.h, f.pal, new Uint32Array(f.buf)), running: [...e.current], area: e.area.id })
    }
    return { frames, log }
  } finally {
    console.warn = warn
  }
}

/** 瀏覽器：拼成一張圖（每格放大 scale 倍，下面寫秒數與正在跑的腳本） */
export function previewSheet(o: PreviewOpts & { scale?: number; cols?: number }): { url: string; log: string[] } {
  const { frames, log } = simulate(o, readTokens())
  const scale = o.scale ?? 2
  const cols = o.cols ?? Math.min(4, frames.length)
  const fw = frames[0]!.g.w * scale
  const fh = frames[0]!.g.h * scale
  const rows = Math.ceil(frames.length / cols)
  const c = document.createElement('canvas')
  c.width = cols * (fw + 8) + 8
  c.height = rows * (fh + 26) + 8
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#eeeeee'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.imageSmoothingEnabled = false
  frames.forEach((f, i) => {
    const tmp = document.createElement('canvas')
    tmp.width = f.g.w
    tmp.height = f.g.h
    tmp.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(f.g.buf.buffer.slice(0) as ArrayBuffer), f.g.w, f.g.h), 0, 0)
    const x = 8 + (i % cols) * (fw + 8)
    const y = 8 + Math.floor(i / cols) * (fh + 26)
    ctx.drawImage(tmp, x, y, fw, fh)
    ctx.fillStyle = '#222'
    ctx.font = '12px sans-serif'
    ctx.fillText(`${f.t.toFixed(1)}s ${f.area} ${f.running.join(',')}`, x, y + fh + 15)
  })
  return { url: c.toDataURL('image/png'), log }
}

export { AREAS, EVENTS, TRANSITIONS }
