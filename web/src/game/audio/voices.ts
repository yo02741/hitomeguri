import { NOISE_HITS, TAIKO_HITS, type NoiseHit, type TaikoHit } from './drums'
import { noiseSamples, type NoiseMode } from './lfsr'
import { hz, midiToHz } from './notes'
import type { SfxDef, SfxPart } from './sfx'
import { ENV, type Duty, type Envelope, type Instrument, type Vibrato } from './tracker'
import { karplusStrong, pulseWave, tableWave, WAVES, type Coefficients } from './waves'

/**
 * 發聲：把排好的音、效果音變成 Web Audio 的節點。即時（AudioContext）與離線（OfflineAudioContext）共用。
 * 每個音自己一組節點（振盪器 → 濾波 → 音量），放完 onended 拆掉。
 */


/** 一個 AudioContext 的音色快取：方波、波形表、雜訊、撥弦 */
export class Kit {
  readonly ctx: BaseAudioContext
  private readonly waves = new Map<string, PeriodicWave>()
  private readonly noises = new Map<NoiseMode, AudioBuffer>()
  private readonly plucks = new Map<string, { buffer: AudioBuffer; rate: number }>()

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx
  }

  pulse(duty: Duty): PeriodicWave {
    return this.periodic(`p${duty}`, () => pulseWave(duty))
  }

  table(hex: string): PeriodicWave {
    return this.periodic(`w${hex}`, () => tableWave(hex))
  }

  noise(mode: NoiseMode): AudioBuffer {
    let b = this.noises.get(mode)
    if (!b) {
      b = this.buffer(noiseSamples(mode, mode === 'short' ? 64 : 1))
      this.noises.set(mode, b)
    }
    return b
  }

  pluck(midi: number, decay: number, bright: number): { buffer: AudioBuffer; rate: number } {
    const key = `${midi}:${decay}:${bright}`
    let p = this.plucks.get(key)
    if (!p) {
      const ks = karplusStrong(this.ctx.sampleRate, midiToHz(midi), { decay, bright, seconds: 1.6, seed: midi * 7919 })
      p = { buffer: this.buffer(ks.data), rate: ks.rate }
      this.plucks.set(key, p)
    }
    return p
  }

  private periodic(key: string, make: () => Coefficients): PeriodicWave {
    let w = this.waves.get(key)
    if (!w) {
      const { real, imag } = make()
      w = this.ctx.createPeriodicWave(real, imag)
      this.waves.set(key, w)
    }
    return w
  }

  private buffer(data: Float32Array<ArrayBuffer>): AudioBuffer {
    const b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate)
    b.getChannelData(0).set(data)
    return b
  }
}

/** 排程器排出來、要發聲的一個音 */
export interface Voice {
  time: number
  dur: number
  midi: number | null
  hit: string | null
  vel: number
}

/** 放完拆掉節點 */
function release(src: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  src.onended = () => {
    src.disconnect()
    for (const n of nodes) n.disconnect()
  }
}

/**
 * ADSR：attack 直線上去、decay 往 sustain 指數靠近、音停之後 release 直線收到 0。
 * 音停那一刻的值用公式算出來接上（不用 cancelAndHoldAtTime，Firefox 沒有），回傳完全收掉的時間。
 */
export function envelope(p: AudioParam, t: number, dur: number, peak: number, e: Envelope): number {
  const a = Math.max(0.001, e.attack)
  const hold = Math.max(dur, a)
  const tc = Math.max(0.005, e.decay / 3)
  const s = peak * e.sustain
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(peak, t + a)
  p.setTargetAtTime(s, t + a, tc)
  p.setValueAtTime(s + (peak - s) * Math.exp(-(hold - a) / tc), t + hold)
  const end = t + hold + Math.max(0.005, e.release)
  p.linearRampToValueAtTime(0, end)
  return end
}

/** 一開始最大、指數掉到幾乎 0（打擊、短的效果音） */
function decayEnv(p: AudioParam, t: number, dur: number, peak: number, attack = 0.002) {
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(peak, t + attack)
  p.exponentialRampToValueAtTime(0.0005, t + Math.max(dur, attack + 0.001))
  p.setValueAtTime(0, t + Math.max(dur, attack + 0.001))
}

/** 顫音：正弦 LFO → 增益（cent）→ detune；開始 delay 秒後才慢慢晃起來 */
function vibrato(ctx: BaseAudioContext, detune: AudioParam, t: number, end: number, v: Vibrato) {
  if (end - t < v.delay + 0.08) return
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(v.rate, t)
  const depth = ctx.createGain()
  depth.gain.setValueAtTime(0, t)
  depth.gain.setValueAtTime(0, t + v.delay)
  depth.gain.linearRampToValueAtTime(v.cents, t + v.delay + 0.2)
  lfo.connect(depth).connect(detune)
  lfo.start(t)
  lfo.stop(end)
  release(lfo, depth)
}

/** 方波、波形表的一個音 */
function tone(kit: Kit, dest: AudioNode, inst: Extract<Instrument, { kind: 'pulse' | 'wave' }>, ev: Voice, midi: number) {
  const ctx = kit.ctx
  const osc = ctx.createOscillator()
  osc.setPeriodicWave(inst.kind === 'pulse' ? kit.pulse(inst.duty) : kit.table(inst.table))
  osc.frequency.setValueAtTime(midiToHz(midi + (inst.transpose ?? 0)), ev.time)
  const g = ctx.createGain()
  const end = envelope(g.gain, ev.time, ev.dur, inst.vol * ev.vel, inst.env ?? ENV.lead)
  if (inst.vibrato) vibrato(ctx, osc.detune, ev.time, end, inst.vibrato)
  osc.connect(g).connect(dest)
  osc.start(ev.time)
  osc.stop(end + 0.01)
  release(osc, g)
}

/** 撥弦（三線）：預先算好的 Karplus–Strong，鼻音一點（峰值濾波），音停時稍微悶掉 */
function pluck(kit: Kit, dest: AudioNode, inst: Extract<Instrument, { kind: 'pluck' }>, ev: Voice, midi: number) {
  const ctx = kit.ctx
  const { buffer, rate } = kit.pluck(midi + (inst.transpose ?? 0), inst.decay, inst.bright)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.setValueAtTime(rate, ev.time)
  const body = ctx.createBiquadFilter()
  body.type = 'peaking'
  body.frequency.setValueAtTime(1150, ev.time)
  body.Q.setValueAtTime(1.4, ev.time)
  body.gain.setValueAtTime(4, ev.time)
  const g = ctx.createGain()
  const vol = inst.vol * ev.vel
  const stop = Math.min(ev.time + Math.max(ev.dur, 0.14) + 0.06, ev.time + buffer.duration / rate)
  g.gain.setValueAtTime(vol, ev.time)
  g.gain.setValueAtTime(vol, Math.max(ev.time, stop - 0.06))
  g.gain.linearRampToValueAtTime(0, stop)
  src.connect(body).connect(g).connect(dest)
  src.start(ev.time)
  src.stop(stop + 0.01)
  release(src, body, g)
}

/** 循環播的 LFSR 雜訊；clock 是 LFSR 一秒走幾步 */
function noiseSource(kit: Kit, mode: NoiseMode, clock: number, t: number): AudioBufferSourceNode {
  const src = kit.ctx.createBufferSource()
  src.buffer = kit.noise(mode)
  src.loop = true
  src.playbackRate.setValueAtTime(clock / kit.ctx.sampleRate, t)
  return src
}

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, t: number, q?: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (q !== undefined) f.Q.setValueAtTime(q, t)
  return f
}

function noiseHit(kit: Kit, dest: AudioNode, h: NoiseHit, t: number, vol: number) {
  for (const at of h.flam ? [0, h.flam] : [0]) {
    const src = noiseSource(kit, h.mode, h.clock, t + at)
    const f = biquad(kit.ctx, h.filter.type, h.filter.freq, t + at, h.filter.q)
    const g = kit.ctx.createGain()
    decayEnv(g.gain, t + at, h.dur, vol * h.vol * (at ? 0.7 : 1))
    src.connect(f).connect(g).connect(dest)
    src.start(t + at)
    src.stop(t + at + h.dur + 0.01)
    release(src, f, g)
  }
}

/** 太鼓：正弦往下掃（鼓身）＋短雜訊（鼓皮；打鼓邊時是高通的「カッ」） */
function taikoHit(kit: Kit, dest: AudioNode, h: TaikoHit, t: number, vol: number) {
  const ctx = kit.ctx
  const osc = ctx.createOscillator()
  osc.type = h.rim ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(h.from, t)
  osc.frequency.exponentialRampToValueAtTime(h.to, t + Math.min(h.dur, 0.18))
  const g = ctx.createGain()
  decayEnv(g.gain, t, h.dur, vol * h.vol)
  osc.connect(g).connect(dest)
  osc.start(t)
  osc.stop(t + h.dur + 0.01)
  release(osc, g)

  const skinDur = h.rim ? 0.03 : 0.06
  const n = noiseSource(kit, 'long', h.rim ? 30000 : 9000, t)
  const f = biquad(ctx, h.rim ? 'highpass' : 'lowpass', h.rim ? 2200 : 700, t)
  const ng = ctx.createGain()
  decayEnv(ng.gain, t, skinDur, vol * h.vol * h.skin)
  n.connect(f).connect(ng).connect(dest)
  n.start(t)
  n.stop(t + skinDur + 0.01)
  release(n, f, ng)
}

/** 排程器的一個音 → 依聲道發聲 */
export function playNote(kit: Kit, dest: AudioNode, inst: Instrument, ev: Voice) {
  switch (inst.kind) {
    case 'pulse':
    case 'wave':
      if (ev.midi !== null) tone(kit, dest, inst, ev, ev.midi)
      return
    case 'pluck':
      if (ev.midi !== null) pluck(kit, dest, inst, ev, ev.midi)
      return
    case 'noise': {
      const h = ev.hit ? NOISE_HITS[ev.hit] : undefined
      if (h) noiseHit(kit, dest, h, ev.time, inst.vol * ev.vel)
      return
    }
    case 'taiko': {
      const h = ev.hit ? TAIKO_HITS[ev.hit] : undefined
      if (h) taikoHit(kit, dest, h, ev.time, inst.vol * ev.vel)
      return
    }
  }
}

// ── 效果音 ──

function ramp(p: AudioParam, to: number, at: number, curve: 'exp' | 'lin' = 'exp') {
  if (curve === 'lin' || to <= 0) p.linearRampToValueAtTime(to, at)
  else p.exponentialRampToValueAtTime(to, at)
}

/** 效果音一段的音量形狀；回傳結束時間 */
function shape(p: AudioParam, t: number, part: SfxPart): number {
  const { dur, vol } = part
  const attack = Math.min(part.attack ?? 0.003, dur * 0.5)
  const end = t + dur
  p.setValueAtTime(0, t)
  switch (part.shape ?? 'decay') {
    case 'decay':
      p.linearRampToValueAtTime(vol, t + attack)
      p.exponentialRampToValueAtTime(0.0005, end)
      p.setValueAtTime(0, end)
      break
    case 'flat': {
      const r = Math.min(part.release ?? 0.03, dur * 0.4)
      p.linearRampToValueAtTime(vol, t + attack)
      p.setValueAtTime(vol, Math.max(t + attack, end - r))
      p.linearRampToValueAtTime(0, end)
      break
    }
    case 'swell':
      p.linearRampToValueAtTime(vol, t + dur * 0.55)
      p.linearRampToValueAtTime(0, end)
      break
  }
  return end
}

function sfxPart(kit: Kit, dest: AudioNode, part: SfxPart, t: number): number {
  const ctx = kit.ctx
  let src: AudioScheduledSourceNode
  if (part.src === 'noise') {
    const s = noiseSource(kit, part.noise ?? 'long', part.clock ?? 22000, t)
    if (part.clockTo) ramp(s.playbackRate, part.clockTo / ctx.sampleRate, t + part.dur, part.curve)
    src = s
  } else {
    const o = ctx.createOscillator()
    if (part.src === 'pulse') o.setPeriodicWave(kit.pulse(part.duty ?? 0.5))
    else if (part.src === 'wave') o.setPeriodicWave(kit.table(part.table ?? WAVES.tri))
    else o.type = 'sine'
    o.frequency.setValueAtTime(hz(part.freq ?? 440), t)
    if (part.to !== undefined) ramp(o.frequency, hz(part.to), t + part.dur, part.curve)
    if (part.vib) vibrato(ctx, o.detune, t, t + part.dur, { ...part.vib, delay: 0 })
    src = o
  }
  const nodes: AudioNode[] = []
  let out: AudioNode = src
  if (part.filter) {
    const f = biquad(ctx, part.filter.type, part.filter.freq, t, part.filter.q)
    if (part.filter.to) ramp(f.frequency, part.filter.to, t + part.dur)
    out.connect(f)
    out = f
    nodes.push(f)
  }
  const g = ctx.createGain()
  const end = shape(g.gain, t, part)
  out.connect(g).connect(dest)
  nodes.push(g)
  src.start(t)
  src.stop(end + 0.01)
  release(src, ...nodes)
  return end
}

/** 放一個效果音（t0 開始）；回傳最後一段結束的時間 */
export function playSfx(kit: Kit, dest: AudioNode, def: SfxDef, t0: number): number {
  let end = t0
  for (const part of def.parts) {
    const n = part.repeat?.count ?? 1
    for (let i = 0; i < n; i++) {
      const t = t0 + (part.at ?? 0) + i * (part.repeat?.every ?? 0)
      end = Math.max(end, sfxPart(kit, dest, part, t))
    }
  }
  return end
}
