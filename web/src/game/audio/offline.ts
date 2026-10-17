import { createMixer } from './mixer'
import { advance, startCursor, variantPlan } from './schedule'
import { DEFAULT_SETTINGS } from './settings'
import { SFX, SFX_NAMES, sfxLength, type SfxName } from './sfx'
import { JINGLE_IDS, JINGLES, parsed, SONG_IDS, SONGS, type JingleId, type SongId } from './songs'
import { stepDuration, type SongDef } from './tracker'
import { playNote, playSfx } from './voices'

/**
 * 離線算聲音（OfflineAudioContext）：開發時檢查每首曲子、每個效果音不是全靜音、也沒有爆音。
 * 跟即時播放同一套混音（預設音量）、同一套排程，只是一次排完。限幅器拿掉，量到的是真正的峰值。
 * 只在瀏覽器裡能跑（node 沒有 OfflineAudioContext）；window.__gameAudio.check() 會呼叫這裡。
 */

export interface RenderStats {
  name: string
  seconds: number
  /** 最大的絕對值（1 就是爆音） */
  peak: number
  rms: number
  silent: boolean
}

export interface Rendered {
  stats: RenderStats
  /** 單聲道樣本（要聽的話可以存成 WAV） */
  samples: Float32Array
  sampleRate: number
}

const SR = 44100

function measure(name: string, data: Float32Array, sampleRate: number): RenderStats {
  let peak = 0
  let sum = 0
  for (const x of data) {
    peak = Math.max(peak, Math.abs(x))
    sum += x * x
  }
  const rms = Math.sqrt(sum / Math.max(1, data.length))
  return { name, seconds: data.length / sampleRate, peak, rms, silent: peak < 0.01 || rms < 0.001 }
}

async function render(name: string, seconds: number, draw: (ctx: OfflineAudioContext, mix: ReturnType<typeof createMixer>) => void): Promise<Rendered> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR)
  const mix = createMixer(ctx, DEFAULT_SETTINGS, { limiter: false })
  draw(ctx, mix)
  const buf = await ctx.startRendering()
  const samples = buf.getChannelData(0)
  return { stats: measure(name, samples, SR), samples, sampleRate: SR }
}

function scheduleSong(def: SongDef, ctx: BaseAudioContext, dest: AudioNode, kit: ReturnType<typeof createMixer>['kit'], seconds: number, night: boolean, festival: boolean) {
  const song = parsed(def)
  const plan = variantPlan(def, { night, festival })
  const bus = ctx.createGain()
  bus.gain.value = plan.vol
  bus.connect(dest)
  const { events } = advance(song, startCursor(0.02, stepDuration(def.bpm, def.rows, plan.tempo)), seconds, plan.active)
  for (const ev of events) playNote(kit, bus, song.tracks[ev.track]!.def.inst, ev)
}

/** 一首曲子的前 seconds 秒 */
export function renderSong(id: SongId, opt: { seconds?: number; night?: boolean; festival?: boolean } = {}): Promise<Rendered> {
  const seconds = opt.seconds ?? 5
  const label = `${id}${opt.night ? '・夜' : ''}${opt.festival ? '・祭典' : ''}`
  return render(label, seconds, (ctx, mix) => scheduleSong(SONGS[id], ctx, mix.songs, mix.kit, seconds, !!opt.night, !!opt.festival))
}

export function renderJingle(id: JingleId): Promise<Rendered> {
  const def = JINGLES[id]
  const seconds = parsed(def).length * stepDuration(def.bpm, def.rows) + 0.6
  return render(`jingle:${id}`, seconds, (ctx, mix) => scheduleSong(def, ctx, mix.bgm, mix.kit, seconds, false, false))
}

export function renderSfx(name: SfxName): Promise<Rendered> {
  const def = SFX[name]
  return render(`sfx:${name}`, sfxLength(def) + 0.2, (_ctx, mix) => {
    playSfx(mix.kit, mix.sfx, def, 0.01)
  })
}

/**
 * A 加權的音量（dBFS，A 加權濾波器：44.1 kHz 的雙線性轉換係數，IEC 61672 的 A 曲線）：
 * 手機、筆電的喇叭幾乎放不出低音，聽起來大不大聲看的是中音域，所以鎮曲之間的音量用這個比。
 */
const A_B = [0.255741125204258, -0.511482250408516, -0.255741125204258, 1.022964500817033, -0.255741125204258, -0.511482250408516, 0.255741125204258]
const A_A = [1, -4.019576181115832, 6.189406442920693, -4.453198903544116, 1.420842949621876, 0.14182547383042, 0.004351177233495]
export async function aWeightedDb(samples: Float32Array, sampleRate = SR): Promise<number> {
  const ctx = new OfflineAudioContext(1, samples.length, sampleRate)
  const buf = ctx.createBuffer(1, samples.length, sampleRate)
  buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.createIIRFilter(A_B, A_A)).connect(ctx.destination)
  src.start()
  const out = (await ctx.startRendering()).getChannelData(0)
  // 前 0.5 秒（濾波器暖身、第一個音之前）不算
  let sum = 0
  const from = Math.min(out.length - 1, Math.round(0.5 * sampleRate))
  for (let i = from; i < out.length; i++) sum += out[i]! * out[i]!
  return 10 * Math.log10(sum / Math.max(1, out.length - from) + 1e-12)
}

/** 鎮曲（白天）一整個 loop（最多 60 秒）的 A 加權音量：鎮與鎮之間換曲子時不要忽大忽小（相差 3 dB 以內） */
export const TOWN_SONGS = ['kyoto', 'okinawa', 'tokyo', 'hokkaido'] as const satisfies readonly SongId[]
export async function townLevels(): Promise<Array<{ id: SongId; dBA: number }>> {
  const out: Array<{ id: SongId; dBA: number }> = []
  for (const id of TOWN_SONGS) {
    const def = SONGS[id]
    const seconds = Math.min(60, parsed(def).length * stepDuration(def.bpm, def.rows))
    const r = await renderSong(id, { seconds })
    out.push({ id, dBA: Math.round((await aWeightedDb(r.samples, r.sampleRate)) * 10) / 10 })
  }
  return out
}

/** 全部：每首（白天、夜裡、祭典）前 5 秒、每個 jingle、每個效果音 */
export async function renderAll(seconds = 5): Promise<RenderStats[]> {
  const out: RenderStats[] = []
  for (const id of SONG_IDS) {
    out.push((await renderSong(id, { seconds })).stats)
    if (SONGS[id].night) out.push((await renderSong(id, { seconds, night: true })).stats)
    if (SONGS[id].tracks.some((t) => t.festival)) out.push((await renderSong(id, { seconds, festival: true })).stats)
  }
  for (const id of JINGLE_IDS) out.push((await renderJingle(id)).stats)
  for (const name of SFX_NAMES) out.push((await renderSfx(name)).stats)
  return out
}
