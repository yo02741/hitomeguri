import { installDevHook } from './dev'
import { applySettings, createMixer, type Mixer } from './mixer'
import { pump, retempo, startCursor, timeOf, variantPlan, type Cursor, type Variant, type VariantPlan } from './schedule'
import {
  browserStorage,
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  type AudioBus,
  type AudioSettings,
  type StorageLike,
} from './settings'
import { SFX, type SfxDef, type SfxName } from './sfx'
import { JINGLES, parsed, SONGS, type JingleId, type SongId } from './songs'
import { stepDuration, type ParsedSong } from './tracker'
import { playNote, playSfx } from './voices'

/**
 * 遊戲的聲音（DESIGN.md §14b）：createGameAudio() 回傳一組方法，遊戲只跟這裡講話。
 * - AudioContext 第一次 unlock()（要在按鍵／點擊的手勢裡呼叫，iOS 才放得出聲）才建；之前呼叫 bgm() 會記著，unlock 後開始放。
 * - 編曲器：每 25ms 一個 tick，排好之後 120ms 內開始的音（schedule.ts 的 pump）。
 * - 換曲：舊的 0.5 秒淡出、新的淡入；同一首換夜裡／祭典不重來，從下一格換速度、加減軌。
 * - 沒有 Web Audio（測試、舊瀏覽器）或建不起來：每個方法都照常回來，只是沒有聲音。
 */

export interface BgmOptions {
  night?: boolean
  festival?: boolean
}

/** off：這裡沒有聲音；locked：還沒 unlock；running：正在跑；suspended：暫停中 */
export type AudioState = 'off' | 'locked' | 'running' | 'suspended'

export interface GameAudio {
  /** 在使用者手勢裡呼叫（開始／繼續、之後每次按鍵也可以，已經在跑就什麼都不做） */
  unlock(): Promise<void>
  sfx(name: SfxName): void
  /** 短的曲子：鎮曲壓低，放完回來 */
  jingle(name: JingleId): void
  /** 換曲（null 停）；同一首換參數不重來 */
  bgm(name: SongId | null, opts?: BgmOptions): void
  setVolume(bus: AudioBus, volume: number): void
  setMuted(bus: AudioBus, muted: boolean): void
  /** 對話的打字聲 */
  setTyping(on: boolean): void
  /** 鎮曲暫時壓低（手帳打開時 0.45；1 回到原本）：不存設定，jingle 放完回到這個音量 */
  dim(level: number): void
  settings(): AudioSettings
  /** 現在（或 unlock 後）要放的曲子 */
  current(): { bgm: SongId | null; night: boolean; festival: boolean }
  state(): AudioState
  /** 暫停全部聲音；reason 分開記（例 'pause'、'menu'、'hidden'），全部 resume 了才真的繼續 */
  suspend(reason?: string): Promise<void>
  resume(reason?: string): Promise<void>
  dispose(): void
}

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext

export interface GameAudioOptions {
  /** 設定存哪（預設 localStorage；null 不存） */
  storage?: StorageLike | null
  storageKey?: string
  /** 測試用：換掉 AudioContext（null 當作沒有 Web Audio） */
  AudioContext?: AudioContextCtor | null
  /** DEV 時把 window.__gameAudio 掛上（預設掛；false 不掛；正式版一律不掛） */
  devHook?: boolean
}

const TICK_MS = 25
const LOOKAHEAD = 0.12
/** 第一首從現在多久之後開始（給第一批音一點排程的時間） */
const START_DELAY = 0.06
const FADE_OUT = 0.5
const FADE_IN = 0.35
/** 換曲時新的一首晚多久進來 */
const CROSS_DELAY = 0.3
/** 同時最多幾個效果音 */
const MAX_VOICES = 8
/** jingle 時鎮曲壓到多少 */
const DUCK = 0.18

interface Playback {
  id: string
  song: ParsedSong
  bus: GainNode
  cursor: Cursor
  plan: VariantPlan
  v: Variant
  done: boolean
  /** 放完、音尾也收完的時間 */
  endAt: number
}

interface SfxVoice {
  name: SfxName
  gain: GainNode
  end: number
}

/** 瀏覽器的 AudioContext（舊 Safari 是 webkitAudioContext）；沒有就 null */
function findAudioContext(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** promise 最多等 ms（iOS 有時 resume 一直不回） */
function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    p.then(
      () => (clearTimeout(t), resolve()),
      () => (clearTimeout(t), resolve()),
    )
  })
}

/** 自動化排到一半時從現在接手（有 cancelAndHoldAtTime 就用，沒有就直接清掉之後的） */
function holdAt(p: AudioParam, t: number) {
  const h = (p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime
  if (h) h.call(p, t)
  else p.cancelScheduledValues(t)
}

/** iOS 舊版：手勢裡放一個 1 格的無聲 buffer 才會真的解鎖 */
function kickSilent(ctx: AudioContext) {
  try {
    const src = ctx.createBufferSource()
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    src.connect(ctx.destination)
    src.start(0)
    src.onended = () => src.disconnect()
  } catch {
    // 不行就算了
  }
}

export function createGameAudio(options: GameAudioOptions = {}): GameAudio {
  const store = options.storage === undefined ? browserStorage() : options.storage
  const key = options.storageKey ?? SETTINGS_KEY
  let cfg = loadSettings(store, key)
  const Ctor = options.AudioContext === undefined ? findAudioContext() : options.AudioContext

  let ctx: AudioContext | null = null
  let mix: Mixer | null = null
  let broken = !Ctor
  let disposed = false
  let timer: ReturnType<typeof setInterval> | null = null
  let wanted: { id: SongId | null; v: Variant } = { id: null, v: { night: false, festival: false } }
  let song: Playback | null = null
  let jingleP: Playback | null = null
  /** 淡出中、等著拆掉的匯流排 */
  const fading: { node: GainNode; until: number }[] = []
  const voices: SfxVoice[] = []
  const lastAt = new Map<SfxName, number>()
  const reasons = new Set<string>()
  /** 鎮曲壓低的程度（dim）；jingle 的壓低放完回到這裡 */
  let dimLevel = 1

  const save = () => saveSettings(store, cfg, key)
  const ready = () => !!ctx && !!mix && !broken && !disposed
  const running = () => ready() && ctx!.state === 'running'

  // ── 編曲器 ──

  function pumpPlayback(p: Playback, now: number) {
    const r = pump(p.song, p.cursor, now, LOOKAHEAD, p.plan.active)
    p.cursor = r.cursor
    for (const ev of r.events) playNote(mix!.kit, p.bus, p.song.tracks[ev.track]!.def.inst, ev)
    if (r.done && !p.done) {
      p.done = true
      p.endAt = timeOf(p.cursor, p.cursor.abs) + 1
    }
  }

  function retire(node: GainNode, until: number) {
    fading.push({ node, until })
  }

  function sweep(now: number) {
    for (let i = fading.length - 1; i >= 0; i--) {
      if (now < fading[i]!.until) continue
      try {
        fading[i]!.node.disconnect()
      } catch {
        // 已經拆了
      }
      fading.splice(i, 1)
    }
    for (let i = voices.length - 1; i >= 0; i--) if (now > voices[i]!.end + 0.1) retire(voices.splice(i, 1)[0]!.gain, now)
  }

  function tick() {
    if (!running()) return
    const now = ctx!.currentTime
    if (song) pumpPlayback(song, now)
    if (jingleP) {
      if (!jingleP.done) pumpPlayback(jingleP, now)
      if (jingleP.done && now > jingleP.endAt) {
        retire(jingleP.bus, now)
        jingleP = null
      }
    }
    sweep(now)
  }

  function startTimer() {
    if (timer === null && !disposed) timer = setInterval(tick, TICK_MS)
  }
  function stopTimer() {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  function makePlayback(id: string, def: ParsedSong['def'], v: Variant, at: number, dest: AudioNode, fadeIn: boolean): Playback {
    const c = ctx!
    const song = parsed(def)
    const plan = variantPlan(def, v)
    const bus = c.createGain()
    if (fadeIn) {
      bus.gain.setValueAtTime(0, c.currentTime)
      bus.gain.setValueAtTime(0, at)
      bus.gain.linearRampToValueAtTime(plan.vol, at + FADE_IN)
    } else {
      bus.gain.value = plan.vol
    }
    bus.connect(dest)
    const cursor = startCursor(at, stepDuration(def.bpm, def.rows, plan.tempo))
    return { id, song, bus, cursor, plan, v, done: false, endAt: Infinity }
  }

  function fadeOut(p: Playback, now: number, seconds = FADE_OUT) {
    holdAt(p.bus.gain, now)
    p.bus.gain.setTargetAtTime(0, now, seconds / 4)
    retire(p.bus, now + seconds + 0.3)
  }

  /** 同一首換夜裡／祭典：從下一格換速度、加減軌，音量慢慢過去 */
  function changeVariant(p: Playback, v: Variant, now: number) {
    const plan = variantPlan(p.song.def, v)
    if (plan.tempo !== p.plan.tempo) p.cursor = retempo(p.cursor, stepDuration(p.song.def.bpm, p.song.def.rows, plan.tempo))
    holdAt(p.bus.gain, now)
    p.bus.gain.setTargetAtTime(plan.vol, now, 0.3)
    p.plan = plan
    p.v = v
  }

  function applyWanted() {
    if (!ready()) return
    const now = ctx!.currentTime
    const { id, v } = wanted
    if (song && song.id === id) {
      if (song.v.night !== v.night || song.v.festival !== v.festival) changeVariant(song, v, now)
      return
    }
    const had = !!song
    if (song) fadeOut(song, now)
    song = id ? makePlayback(id, SONGS[id], v, now + (had ? CROSS_DELAY : START_DELAY), mix!.songs, had) : null
    if (song && running()) pumpPlayback(song, now)
  }

  // ── 效果音 ──

  function cut(v: SfxVoice, now: number) {
    holdAt(v.gain.gain, now)
    v.gain.gain.setTargetAtTime(0, now, 0.008)
    retire(v.gain, now + 0.1)
  }

  function sfx(name: SfxName) {
    if (!running() || cfg.sfx.muted || cfg.sfx.volume <= 0) return
    if (name === 'type' && !cfg.typing) return
    const def: SfxDef | undefined = SFX[name]
    if (!def) return
    const now = ctx!.currentTime
    const last = lastAt.get(name)
    if (last !== undefined && now - last < (def.gap ?? 0.03)) return
    lastAt.set(name, now)
    sweep(now)
    // 同一個效果音再響：收掉上一個（GBA 的聲道搶占）；太多就收掉最舊的
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i]!.name === name) cut(voices.splice(i, 1)[0]!, now)
    while (voices.length >= MAX_VOICES) cut(voices.shift()!, now)
    const gain = ctx!.createGain()
    gain.connect(mix!.sfx)
    const end = playSfx(mix!.kit, gain, def, now + 0.005)
    voices.push({ name, gain, end })
  }

  function jingle(name: JingleId) {
    if (!ready() || cfg.bgm.muted || cfg.bgm.volume <= 0) return
    const def = JINGLES[name]
    if (!def) return
    const now = ctx!.currentTime
    if (jingleP) fadeOut(jingleP, now, 0.08)
    jingleP = makePlayback(name, def, { night: false, festival: false }, now + 0.03, mix!.bgm, false)
    const len = jingleP.song.length * jingleP.cursor.stepDur
    const duck = mix!.songs.gain
    holdAt(duck, now)
    duck.setTargetAtTime(DUCK, now, 0.03)
    duck.setTargetAtTime(dimLevel, now + 0.03 + len, 0.25)
    if (running()) pumpPlayback(jingleP, now)
  }

  // ── 設定 ──

  function setCfg(next: AudioSettings) {
    cfg = next
    save()
    if (ready()) applySettings(mix!, cfg, ctx!.currentTime)
  }

  // ── 開關 ──

  async function unlock() {
    if (disposed || broken || !Ctor) return
    try {
      if (!ctx) {
        try {
          ctx = new Ctor({ latencyHint: 'interactive' })
        } catch {
          ctx = new Ctor()
        }
        mix = createMixer(ctx, cfg)
        mix.songs.gain.value = dimLevel
      }
      if (ctx.state !== 'running') {
        kickSilent(ctx)
        await withTimeout(ctx.resume(), 800)
      }
      if (reasons.size) await withTimeout(ctx.suspend(), 800)
      else startTimer()
      applyWanted()
    } catch (e) {
      if (import.meta.env.DEV) console.warn('遊戲的聲音：AudioContext 建不起來，改成沒有聲音', e)
      broken = true
      stopTimer()
      try {
        void ctx?.close()
      } catch {
        // 關不掉就算了
      }
      ctx = null
      mix = null
    }
  }

  async function suspend(reason = 'app') {
    reasons.add(reason)
    stopTimer()
    if (ctx && ctx.state === 'running') await withTimeout(ctx.suspend(), 800)
  }

  async function resume(reason = 'app') {
    reasons.delete(reason)
    if (reasons.size || !ready()) return
    if (ctx!.state !== 'running') await withTimeout(ctx!.resume(), 800)
    startTimer()
    applyWanted()
  }

  let removeDevHook = () => {}

  const api: GameAudio = {
    unlock,
    sfx,
    jingle,
    bgm(name, opts) {
      wanted = { id: name, v: { night: !!opts?.night, festival: !!opts?.festival } }
      applyWanted()
    },
    setVolume(bus, volume) {
      const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : cfg[bus].volume
      setCfg({ ...cfg, [bus]: { ...cfg[bus], volume: v } })
    },
    setMuted(bus, muted) {
      setCfg({ ...cfg, [bus]: { ...cfg[bus], muted } })
    },
    setTyping(on) {
      setCfg({ ...cfg, typing: on })
    },
    dim(level) {
      const v = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 1
      if (v === dimLevel) return
      dimLevel = v
      if (!ready()) return
      const now = ctx!.currentTime
      const g = mix!.songs.gain
      holdAt(g, now)
      g.setTargetAtTime(v, now, 0.12)
    },
    settings: () => ({ bgm: { ...cfg.bgm }, sfx: { ...cfg.sfx }, typing: cfg.typing }),
    current: () => ({ bgm: wanted.id, ...wanted.v }),
    state() {
      if (broken || disposed) return 'off'
      if (!ctx) return 'locked'
      return ctx.state === 'running' ? 'running' : 'suspended'
    },
    suspend,
    resume,
    dispose() {
      if (disposed) return
      disposed = true
      stopTimer()
      removeDevHook()
      try {
        void ctx?.close()
      } catch {
        // 關不掉就算了
      }
      ctx = null
      mix = null
      song = null
      jingleP = null
    },
  }

  // 正式版整段拿掉（import.meta.env.DEV 建置時換成 false）
  if (import.meta.env.DEV && options.devHook !== false) removeDevHook = installDevHook(api)
  return api
}

/** 分頁在背景時暫停、回來時繼續（回傳拆掉的函式） */
export function suspendWhenHidden(audio: GameAudio): () => void {
  if (typeof document === 'undefined') return () => {}
  const on = () => void (document.hidden ? audio.suspend('hidden') : audio.resume('hidden'))
  document.addEventListener('visibilitychange', on)
  on()
  return () => document.removeEventListener('visibilitychange', on)
}
