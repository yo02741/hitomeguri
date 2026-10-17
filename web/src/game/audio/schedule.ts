import type { ParsedSong, SongDef } from './tracker'

/**
 * 編曲器的排程：全部是純函式（沒有 AudioContext、沒有計時器），可以測。
 * 游標記「下一格是從開始算的第幾格（abs，只往前）」與「時間基準」：第 baseAbs 格在 baseTime 秒，
 * 之後每格 stepDur 秒。換速度＝在下一格重新定基準；loop 只是 abs → 曲子第幾格的換算，時間軸不回頭，所以接縫不會錯開。
 * 即時播放每 25ms 呼叫一次 pump(now)，排好 now + 120ms 之前開始的音（lookahead）。
 */

export interface Cursor {
  /** 下一個要排的格（從這次開始播算起） */
  abs: number
  baseAbs: number
  baseTime: number
  /** 一格幾秒（現在的速度） */
  stepDur: number
}

/** 排好的一個音：哪一軌、什麼時候開始、多長 */
export interface Scheduled {
  track: number
  /** 從開始播算起第幾格 */
  abs: number
  /** 曲子的第幾格 */
  step: number
  time: number
  dur: number
  midi: number | null
  hit: string | null
  vel: number
}

export interface Advanced {
  events: Scheduled[]
  cursor: Cursor
  /** 不 loop 的曲子放完了 */
  done: boolean
}

export const startCursor = (time: number, stepDur: number): Cursor => ({ abs: 0, baseAbs: 0, baseTime: time, stepDur })

/** 第 abs 格（格線上）的時間 */
export const timeOf = (c: Cursor, abs: number) => c.baseTime + (abs - c.baseAbs) * c.stepDur

/** 從下一格開始換速度：下一格的時間不變，之後的間隔換掉 */
export const retempo = (c: Cursor, stepDur: number): Cursor => ({
  abs: c.abs,
  baseAbs: c.abs,
  baseTime: timeOf(c, c.abs),
  stepDur,
})

/** 下一格改在 time 開始（暫停後接著播） */
export const rebase = (c: Cursor, time: number): Cursor => ({ ...c, baseAbs: c.abs, baseTime: time })

/** 從開始算的第 abs 格 → 曲子的第幾格；不 loop 的曲子放完回 null */
export function songStep(abs: number, length: number, loopFrom: number, loop: boolean): number | null {
  if (abs < length) return abs
  if (!loop) return null
  return loopFrom + ((abs - length) % (length - loopFrom))
}

/** 搖擺：奇數格往後挪 */
const swingOffset = (abs: number, swing: number, stepDur: number) => (abs % 2 === 1 ? swing * stepDur : 0)

/**
 * 排 [下一格, until) 之間開始的格：每一格看每一軌（active 的）有沒有音在這格開始。
 * 每一格只會被排一次（游標往前走），所以分幾次排、每次多長都一樣，不漏也不重複。
 */
export function advance(song: ParsedSong, cursor: Cursor, until: number, active: readonly boolean[]): Advanced {
  const events: Scheduled[] = []
  const swing = song.def.swing ?? 0
  let c = cursor
  for (let guard = 0; guard < 100000 && timeOf(c, c.abs) < until; guard++) {
    const step = songStep(c.abs, song.length, song.loopFrom, song.loop)
    if (step === null) return { events, cursor: c, done: true }
    const t0 = timeOf(c, c.abs) + swingOffset(c.abs, swing, c.stepDur)
    song.tracks.forEach((tr, i) => {
      if (!active[i]) return
      const ev = tr.byStep[step % tr.length]
      if (!ev) return
      const endAbs = c.abs + ev.len
      const end = timeOf(c, endAbs) + swingOffset(endAbs, swing, c.stepDur)
      events.push({ track: i, abs: c.abs, step, time: t0, dur: end - t0, midi: ev.midi, hit: ev.hit, vel: ev.vel })
    })
    c = { ...c, abs: c.abs + 1 }
  }
  const done = songStep(c.abs, song.length, song.loopFrom, song.loop) === null
  return { events, cursor: c, done }
}

/**
 * 計時器被拖住（分頁在背景、主執行緒卡住）回來時，已經過去的格不補（不然會一口氣全響），
 * 直接跳到 now 之後的第一格。時間格線不變。
 */
export function resync(c: Cursor, now: number): { cursor: Cursor; skipped: number } {
  const t = timeOf(c, c.abs)
  if (t >= now) return { cursor: c, skipped: 0 }
  const skipped = Math.ceil((now - t) / c.stepDur - 1e-9)
  return { cursor: { ...c, abs: c.abs + skipped }, skipped }
}

/** 遲到多少以內還照排（Web Audio 會馬上放），超過就跳過 */
export const LATE_OK = 0.02

/** 即時播放每個 tick 做的事：跳過太晚的格、排到 now + lookahead */
export function pump(
  song: ParsedSong,
  cursor: Cursor,
  now: number,
  lookahead: number,
  active: readonly boolean[],
): Advanced & { skipped: number } {
  const r = resync(cursor, now - LATE_OK)
  return { ...advance(song, r.cursor, now + lookahead, active), skipped: r.skipped }
}

/** 白天／夜裡／祭典：同一首曲子的參數 */
export interface Variant {
  night: boolean
  festival: boolean
}

export interface VariantPlan {
  /** 速度倍率 */
  tempo: number
  /** 這首的音量倍率 */
  vol: number
  /** 每一軌要不要出 */
  active: boolean[]
}

/** 夜裡：慢一點、拿掉標了 night: false 的軌；祭典：加上標了 festival 的軌 */
export function variantPlan(def: SongDef, v: Variant): VariantPlan {
  const night = v.night && def.night ? def.night : null
  return {
    tempo: night?.tempo ?? 1,
    vol: night?.vol ?? 1,
    active: def.tracks.map((t) => (!t.festival || v.festival) && (!night || t.night !== false)),
  }
}
