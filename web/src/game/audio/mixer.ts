import type { AudioSettings, BusSetting } from './settings'
import { Kit } from './voices'

/**
 * 混音：鎮曲 → songs（jingle 時壓低）→ bgm ─┐
 *        jingle ─────────────────────→ bgm ─┤→ master → 低通（GBA 喇叭的溫度）→ 軟限幅 → 輸出
 *        效果音 ────────────────────→ sfx ─┘
 * 軟限幅只是保險：0.7 以下原樣，之上慢慢彎到最多 0.92，不會爆音。
 */

/** 音量 1 時各匯流排的實際增益 */
export const BGM_LEVEL = 0.75
export const SFX_LEVEL = 0.8
const MASTER = 0.9

export interface Mixer {
  kit: Kit
  master: GainNode
  bgm: GainNode
  sfx: GainNode
  /** 鎮曲（jingle 放的時候壓低這一個） */
  songs: GainNode
}

export const busLevel = (b: BusSetting, base: number) => (b.muted ? 0 : base * b.volume)

/** 軟限幅的曲線：|x| ≤ knee 不變，之上用 tanh 彎到 knee + room */
export function softClipCurve(n = 2049, knee = 0.7, room = 0.22): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    curve[i] = a <= knee ? x : Math.sign(x) * (knee + room * Math.tanh((a - knee) / room))
  }
  return curve
}

export function createMixer(ctx: BaseAudioContext, s: AudioSettings, opt: { limiter?: boolean } = {}): Mixer {
  const master = ctx.createGain()
  master.gain.value = MASTER
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 9500
  tone.Q.value = 0.5
  master.connect(tone)
  if (opt.limiter === false) {
    tone.connect(ctx.destination)
  } else {
    const clip = ctx.createWaveShaper()
    clip.curve = softClipCurve()
    clip.oversample = 'none'
    tone.connect(clip).connect(ctx.destination)
  }
  const bgm = ctx.createGain()
  bgm.connect(master)
  const sfx = ctx.createGain()
  sfx.connect(master)
  const songs = ctx.createGain()
  songs.connect(bgm)
  const m: Mixer = { kit: new Kit(ctx), master, bgm, sfx, songs }
  applySettings(m, s, ctx.currentTime, true)
  return m
}

/** 設定 → 增益（平常 30ms 滑過去，免得「喀」一聲） */
export function applySettings(m: Mixer, s: AudioSettings, now: number, immediate = false) {
  const set = (g: GainNode, v: number) => {
    if (immediate) g.gain.value = v
    else g.gain.setTargetAtTime(v, now, 0.03)
  }
  set(m.bgm, busLevel(s.bgm, BGM_LEVEL))
  set(m.sfx, busLevel(s.sfx, SFX_LEVEL))
}
