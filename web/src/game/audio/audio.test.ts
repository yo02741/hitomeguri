import { afterEach, describe, expect, it, vi } from 'vitest'

import { rng } from '../../services/pixelwalk/rng'
import { createGameAudio } from './gameAudio'
import { lfsrBits, lfsrPeriod, noiseSamples } from './lfsr'
import { softClipCurve } from './mixer'
import { hz, inScale, midiToHz, noteToMidi, SCALES } from './notes'
import { advance, LATE_OK, pump, resync, retempo, songStep, startCursor, timeOf, variantPlan, type Cursor, type Scheduled } from './schedule'
import { DEFAULT_SETTINGS, loadSettings, sanitize, saveSettings, type StorageLike } from './settings'
import { SFX, SFX_NAMES, sfxLength, type SfxDef } from './sfx'
import { JINGLE_IDS, JINGLES, parsed, SONG_IDS, SONGS } from './songs'
import { chordTrack } from './songs/chords'
import { loopSeconds, parseSong, parseTrack, stepDuration, type ParsedSong, type SongDef } from './tracker'
import { dutyLevels, evalWave, karplusStrong, parseTable, pulseWave, stepWave, tableWave, WAVES } from './waves'

const ALL_SONGS: [string, SongDef][] = [...Object.entries(SONGS), ...Object.entries(JINGLES)]

describe('音名與音階', () => {
  it('音名 → MIDI → Hz', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(noteToMidi('A4')).toBe(69)
    expect(noteToMidi('F#3')).toBe(54)
    expect(noteToMidi('Bb2')).toBe(46)
    expect(noteToMidi('H4')).toBeNull()
    expect(noteToMidi('C9')).toBeNull()
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(60)).toBeCloseTo(261.63, 2)
    expect(hz('A5')).toBeCloseTo(880, 6)
    expect(() => hz('X1')).toThrow()
  })
  it('三個音階各五個音，都節是 Mi Fa La Si Do、琉球是 Do Mi Fa Sol Si', () => {
    for (const s of Object.values(SCALES)) expect(new Set(s.pcs).size).toBe(5)
    expect([...SCALES.miyako.pcs].sort((a, b) => a - b)).toEqual([0, 4, 5, 9, 11])
    expect([...SCALES.ryukyu.pcs].sort((a, b) => a - b)).toEqual([0, 4, 5, 7, 11])
    expect(inScale(noteToMidi('D4')!, 'ryukyu')).toBe(false)
    expect(inScale(noteToMidi('B2')!, 'ryukyu')).toBe(true)
  })
})

describe('tracker 格式', () => {
  it('音、延長、休止', () => {
    const t = parseTrack('C4 . E4 . G4 - - .', 'pulse')
    expect(t.length).toBe(8)
    expect(t.events.map((e) => [e.step, e.len, e.midi])).toEqual([
      [0, 1, 60],
      [2, 1, 64],
      [4, 3, 67],
    ])
  })
  it('重音、輕、打擊', () => {
    const t = parseTrack('D^ d_ K . k', 'taiko')
    expect(t.events.map((e) => [e.hit, e.vel])).toEqual([
      ['D', 1.3],
      ['d', 0.6],
      ['K', 1],
      ['k', 1],
    ])
    expect(parseTrack('E5_ -', 'pulse').events[0]).toMatchObject({ midi: 76, len: 2, vel: 0.6 })
  })
  it('小節線不佔格；開頭的 - 是休止', () => {
    expect(parseTrack('C4 - | E4 - - -', 'wave').bars).toEqual([2, 4])
    const t = parseTrack('- C4', 'pulse')
    expect(t.length).toBe(2)
    expect(t.events[0]!.step).toBe(1)
  })
  it('寫錯就丟錯', () => {
    expect(() => parseTrack('C4 X9', 'pulse')).toThrow(/X9/)
    expect(() => parseTrack('h', 'pulse')).toThrow()
    expect(() => parseTrack('C4', 'noise')).toThrow()
    expect(() => parseTrack('h', 'taiko')).toThrow()
    expect(() => parseTrack('Q', 'noise')).toThrow()
    const bad: SongDef = {
      id: 'bad',
      title: '',
      bpm: 120,
      rows: 2,
      tracks: [
        { name: 'a', inst: { kind: 'noise', vol: 1 }, notes: 'h . h' },
        { name: 'b', inst: { kind: 'noise', vol: 1 }, notes: 'h . h . h . h .' },
      ],
    }
    expect(() => parseSong(bad)).toThrow(/整除/)
    // 一直重複的短軌：loop 起點要在它的開頭
    const intro: SongDef = { ...bad, loopFrom: 3, tracks: [bad.tracks[1]!, { name: 'c', inst: { kind: 'noise', vol: 1 }, notes: 'h . . .' }] }
    expect(() => parseSong(intro)).toThrow(/loopFrom/)
  })
  it('和弦小幫手', () => {
    const s = chordTrack('A A|B', { A: { full: 'A2 - - -', half: 'A2 -' }, B: { full: 'B2 - - -', half: 'B2 -' } })
    expect(s).toBe('A2 - - - | A2 - B2 -')
    expect(() => chordTrack('Z', {})).toThrow()
  })
})

describe('曲子', () => {
  for (const [key, def] of ALL_SONGS)
    it(`${key}：解析得了、id 對得上、每軌長度整除整首`, () => {
      expect(def.id).toBe(key)
      const p = parsed(def)
      for (const t of p.tracks) expect(p.length % t.length).toBe(0)
    })

  for (const id of SONG_IDS) {
    const def = SONGS[id] as SongDef
    const p = parsed(def)
    it(`${id}：每小節格數一樣`, () => {
      const bar = def.rows * (def.beats ?? 4)
      for (const t of p.tracks) for (const b of t.bars) expect(b, `${id}/${t.def.name}`).toBe(bar)
    })
    it(`${id}：每個音都在${SCALES[def.scale!].name}裡`, () => {
      expect(def.scale).toBeDefined()
      for (const t of p.tracks) {
        const tr = 'transpose' in t.def.inst ? (t.def.inst.transpose ?? 0) : 0
        for (const ev of t.events) if (ev.midi !== null) expect(inScale(ev.midi + tr, def.scale!), `${t.def.name} 第 ${ev.step} 格`).toBe(true)
      }
    })
    it(`${id}：loop 長度合理`, () => {
      const s = loopSeconds(p)
      if (id === 'interior') {
        expect(s).toBeGreaterThanOrEqual(15)
        expect(s).toBeLessThanOrEqual(30)
      } else {
        expect(s).toBeGreaterThanOrEqual(30)
        expect(s).toBeLessThanOrEqual(60)
      }
      if (def.night) expect(loopSeconds(p, def.night.tempo)).toBeLessThanOrEqual(75)
      // 搖擺的曲子 loop 格數要是偶數，接回去時後半拍才對得上
      if (def.swing) expect((p.length - p.loopFrom) % 2).toBe(0)
    })
  }

  it('鎮曲有夜裡的版本（慢 15–25%、軌比較少）與祭典的太鼓；室內沒有', () => {
    for (const id of ['kyoto', 'okinawa'] as const) {
      const def: SongDef = SONGS[id]
      expect(def.night!.tempo).toBeGreaterThanOrEqual(0.75)
      expect(def.night!.tempo).toBeLessThanOrEqual(0.85)
      const day = variantPlan(def, { night: false, festival: false })
      const night = variantPlan(def, { night: true, festival: false })
      const fest = variantPlan(def, { night: false, festival: true })
      const count = (a: boolean[]) => a.filter(Boolean).length
      expect(count(night.active)).toBeLessThan(count(day.active))
      expect(count(night.active)).toBeGreaterThanOrEqual(2)
      expect(count(fest.active)).toBe(count(day.active) + 1)
      const extra = def.tracks.filter((_, i) => fest.active[i] && !day.active[i])
      expect(extra.map((t) => t.inst.kind)).toEqual(['taiko'])
    }
    const interior: SongDef = SONGS.interior
    expect(variantPlan(interior, { night: true, festival: true })).toEqual(variantPlan(interior, { night: false, festival: false }))
    expect(interior.tracks.some((t) => t.inst.kind === 'noise' || t.inst.kind === 'taiko')).toBe(false)
  })

  it('沖繩的鎮有撥弦（三線）與太鼓', () => {
    const kinds = (SONGS.okinawa as SongDef).tracks.map((t) => t.inst.kind)
    expect(kinds).toContain('pluck')
    expect(kinds).toContain('taiko')
  })

  for (const id of JINGLE_IDS)
    it(`jingle ${id}：不 loop、1–2 秒`, () => {
      const def: SongDef = JINGLES[id]
      expect(def.loop).toBe(false)
      const s = parsed(def).length * stepDuration(def.bpm, def.rows)
      expect(s).toBeGreaterThanOrEqual(0.8)
      expect(s).toBeLessThanOrEqual(2)
    })
})

/** 參考答案：一次排完 */
const allAtOnce = (p: ParsedSong, c: Cursor, until: number, active: boolean[]) => advance(p, c, until, active).events
const keyOf = (e: Scheduled) => `${e.track}:${e.abs}`

describe('排程', () => {
  it('第幾格 → 曲子的第幾格（loop 回到 loopFrom）', () => {
    expect(songStep(5, 8, 0, true)).toBe(5)
    expect(songStep(8, 8, 0, true)).toBe(0)
    expect(songStep(8, 8, 2, true)).toBe(2)
    expect(songStep(13, 8, 2, true)).toBe(7)
    expect(songStep(8, 8, 0, false)).toBeNull()
  })

  for (const id of SONG_IDS)
    it(`${id}：分很多次排（亂的間隔）跟一次排完一樣，不漏不重複`, () => {
      const def: SongDef = SONGS[id]
      const p = parsed(def)
      const active = variantPlan(def, { night: false, festival: true }).active
      const c0 = startCursor(1, stepDuration(def.bpm, def.rows))
      const until = 1 + loopSeconds(p) * 2.5
      const ref = allAtOnce(p, c0, until, active)
      const r = rng(42)
      let c = c0
      const got: Scheduled[] = []
      for (let t = 1; t < until; ) {
        t = Math.min(until, t + r.range(0.001, 0.3))
        const a = advance(p, c, t, active)
        got.push(...a.events)
        c = a.cursor
      }
      expect(got).toEqual(ref)
      expect(new Set(got.map(keyOf)).size).toBe(got.length)
    })

  it('即時播放：每 25ms（會抖）排 120ms 內的音，每個音都排在它開始之前', () => {
    const def: SongDef = SONGS.okinawa
    const p = parsed(def)
    const active = variantPlan(def, { night: false, festival: true }).active
    const lookahead = 0.12
    const swingMax = (def.swing ?? 0) * stepDuration(def.bpm, def.rows)
    let c = startCursor(0.06, stepDuration(def.bpm, def.rows))
    const ref = allAtOnce(p, c, 60, active)
    const r = rng(7)
    const got: Scheduled[] = []
    for (let now = 0; now < 60 - lookahead; now += 0.025 + r.range(-0.01, 0.015)) {
      const a = pump(p, c, now, lookahead, active)
      expect(a.skipped).toBe(0)
      for (const e of a.events) {
        expect(e.time).toBeGreaterThanOrEqual(now)
        expect(e.time - now).toBeLessThanOrEqual(lookahead + swingMax + 1e-9)
      }
      got.push(...a.events)
      c = a.cursor
    }
    expect(got).toEqual(ref.slice(0, got.length))
    expect(got.length).toBeGreaterThan(ref.length * 0.98)
  })

  it('loop 接得上：第二圈的每個音剛好晚一個 loop', () => {
    const def: SongDef = SONGS.kyoto
    const p = parsed(def)
    const active = def.tracks.map(() => true)
    const d = stepDuration(def.bpm, def.rows)
    const ev = allAtOnce(p, startCursor(0, d), loopSeconds(p) * 2 - 1e-6, active)
    const first = ev.filter((e) => e.abs < p.length)
    const second = ev.filter((e) => e.abs >= p.length)
    expect(second.length).toBe(first.length)
    second.forEach((e, i) => {
      const f = first[i]!
      expect([e.track, e.step, e.midi, e.hit]).toEqual([f.track, f.step, f.midi, f.hit])
      expect(e.time - f.time).toBeCloseTo(p.length * d, 9)
    })
  })

  it('loop 回到 loopFrom（前奏只放一次）', () => {
    const def: SongDef = {
      id: 'intro',
      title: '',
      bpm: 120,
      rows: 2,
      loopFrom: 4,
      tracks: [{ name: 'a', inst: { kind: 'pulse', duty: 0.5, vol: 1 }, notes: 'C4 D4 E4 F4 G4 A4 B4 C5' }],
    }
    const p = parseSong(def)
    const ev = allAtOnce(p, startCursor(0, 0.25), 0.25 * 16, [true])
    expect(ev.map((e) => e.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7, 4, 5, 6, 7])
    expect(ev.map((e) => e.time)).toEqual(ev.map((_, i) => i * 0.25))
  })

  it('換速度：下一格的時間不變，之後間隔換掉', () => {
    const def: SongDef = SONGS.kyoto
    const p = parsed(def)
    const active = def.tracks.map((t) => !t.festival)
    const d = stepDuration(def.bpm, def.rows)
    const a = advance(p, startCursor(0, d), 2, active)
    const boundary = timeOf(a.cursor, a.cursor.abs)
    const slow = retempo(a.cursor, d / 0.8)
    expect(timeOf(slow, slow.abs)).toBeCloseTo(boundary, 12)
    const b = advance(p, slow, 10, active)
    const times = [...new Set(b.events.map((e) => e.time))]
    expect(times[0]).toBeCloseTo(boundary, 12)
    for (let i = 1; i < times.length; i++) {
      const gap = (times[i]! - times[i - 1]!) / (d / 0.8)
      expect(Math.abs(gap - Math.round(gap))).toBeLessThan(1e-9)
    }
    // 前後沒有重複的格
    const seen = new Set([...a.events, ...b.events].map(keyOf))
    expect(seen.size).toBe(a.events.length + b.events.length)
  })

  it('計時器被拖住回來：過去的格跳過、不一口氣補', () => {
    const def: SongDef = SONGS.kyoto
    const p = parsed(def)
    const active = def.tracks.map(() => true)
    const d = stepDuration(def.bpm, def.rows)
    let c = startCursor(0, d)
    c = pump(p, c, 0, 0.12, active).cursor
    const late = pump(p, c, 3, 0.12, active)
    expect(late.skipped).toBeGreaterThan(5)
    for (const e of late.events) expect(e.time).toBeGreaterThanOrEqual(3 - LATE_OK)
    const r = resync(c, 0)
    expect(r.skipped).toBe(0)
  })

  it('不 loop 的曲子放完就停', () => {
    const def: SongDef = JINGLES.arrive
    const p = parsed(def)
    const a = advance(p, startCursor(0, stepDuration(def.bpm, def.rows)), 100, def.tracks.map(() => true))
    expect(a.done).toBe(true)
    expect(Math.max(...a.events.map((e) => e.abs))).toBeLessThan(p.length)
  })

  it('搖擺：奇數格往後挪、長度跟著算', () => {
    const def: SongDef = {
      id: 'sw',
      title: '',
      bpm: 120,
      rows: 2,
      swing: 0.25,
      tracks: [{ name: 'a', inst: { kind: 'pulse', duty: 0.5, vol: 1 }, notes: 'C4 D4 E4 F4' }],
    }
    const ev = advance(parseSong(def), startCursor(0, 0.25), 1, [true]).events
    expect(ev.map((e) => e.time)).toEqual([0, 0.3125, 0.5, 0.8125])
    expect(ev[0]!.dur).toBeCloseTo(0.3125, 9)
    expect(ev[1]!.dur).toBeCloseTo(0.1875, 9)
  })
})

describe('雜訊與波形', () => {
  it('LFSR：長週期 32767、短週期 127', () => {
    expect(lfsrPeriod('long')).toBe(32767)
    expect(lfsrPeriod('short')).toBe(127)
  })
  it('長週期一圈裡 1 有 16384 個（m 序列）', () => {
    const bits = lfsrBits('long', 32767)
    expect(bits.reduce((s, b) => s + b, 0)).toBe(16384)
  })
  it('雜訊樣本一圈一圈接起來無縫', () => {
    const s = noiseSamples('short', 4)
    expect(s.length).toBe(127 * 4)
    for (let i = 0; i < 127 * 3; i++) expect(s[i + 127]).toBe(s[i])
    const l = noiseSamples('long')
    expect(l.length).toBe(32767)
    expect(new Set(l)).toEqual(new Set([1, -1]))
  })
  it('方波的佔空比：12.5% 一段高、50% 沒有偶次諧波', () => {
    expect(dutyLevels(0.125)).toEqual([1, -1, -1, -1, -1, -1, -1, -1])
    expect(dutyLevels(0.25).filter((v) => v > 0).length).toBe(2)
    const sq = pulseWave(0.5)
    for (let k = 2; k < sq.real.length; k += 2) {
      expect(Math.abs(sq.real[k]!)).toBeLessThan(1e-6)
      expect(Math.abs(sq.imag[k]!)).toBeLessThan(1e-6)
    }
    expect(sq.imag[1]).toBeCloseTo(4 / Math.PI, 5)
  })
  it('係數還原回去：每段中間的值對得上（去掉直流）', () => {
    for (const duty of [0.125, 0.25, 0.5] as const) {
      const levels = dutyLevels(duty)
      const mean = levels.reduce((s, v) => s + v, 0) / levels.length
      const w = pulseWave(duty, 200)
      levels.forEach((v, j) => expect(evalWave(w, (j + 0.5) / levels.length), `${duty} 第 ${j} 段`).toBeCloseTo(v - mean, 1))
    }
    const tri = parseTable(WAVES.tri).map((v) => (v - 7.5) / 7.5)
    const w = stepWave(tri, 400)
    const mean = tri.reduce((s, v) => s + v, 0) / 32
    tri.forEach((v, j) => expect(Math.abs(evalWave(w, (j + 0.5) / 32) - (v - mean))).toBeLessThan(0.05))
  })
  it('波形表：32 個 16 進位字，寫錯丟錯', () => {
    for (const hex of Object.values(WAVES)) expect(parseTable(hex)).toHaveLength(32)
    expect(() => parseTable('0123')).toThrow()
    expect(() => parseTable('G'.repeat(32))).toThrow()
    expect(tableWave(WAVES.soft).real.length).toBe(49)
  })
  it('撥弦（Karplus–Strong）：有聲音、會衰減、音高修正小、同一個種子一樣', () => {
    const a = karplusStrong(44100, 261.63, { decay: 0.9965, bright: 0.75, seconds: 1.6, seed: 3 })
    const b = karplusStrong(44100, 261.63, { decay: 0.9965, bright: 0.75, seconds: 1.6, seed: 3 })
    expect(a.data).toEqual(b.data)
    let peak = 0
    for (const x of a.data) peak = Math.max(peak, Math.abs(x))
    expect(peak).toBeCloseTo(1, 6)
    const energy = (from: number, to: number) => {
      let s = 0
      for (let i = from; i < to; i++) s += a.data[i]! ** 2
      return s
    }
    expect(energy(0, 4410)).toBeGreaterThan(energy(44100, 48510) * 4)
    expect(a.rate).toBeGreaterThan(0.98)
    expect(a.rate).toBeLessThan(1.02)
    expect(Math.abs(a.data[a.data.length - 1]!)).toBeLessThan(1e-3)
  })
  it('軟限幅：0.7 以下不變、單調、不會到 0.98', () => {
    const c = softClipCurve()
    const at = (x: number) => c[Math.round(((x + 1) / 2) * (c.length - 1))]!
    expect(at(0.5)).toBeCloseTo(0.5, 2)
    expect(at(-0.3)).toBeCloseTo(-0.3, 2)
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]!)
    expect(Math.max(...c)).toBeLessThan(0.98)
  })
})

describe('效果音', () => {
  const UI = ['bump', 'confirm', 'cursor', 'cancel', 'type'] as const
  it('規格的清單都有', () => {
    for (const n of ['bump', 'confirm', 'cursor', 'cancel', 'type', 'door', 'stairs', 'shutter', 'stamp', 'register', 'item', 'trainDepart', 'trainArrive', 'plane', 'bus', 'ferry', 'saved', 'error'])
      expect(SFX_NAMES).toContain(n)
  })
  for (const name of SFX_NAMES)
    it(`${name}：短、音量合理、音名寫得對`, () => {
      const def: SfxDef = SFX[name]
      expect(def.parts.length).toBeGreaterThan(0)
      const len = sfxLength(def)
      expect(len).toBeGreaterThan(0)
      expect(len).toBeLessThanOrEqual((UI as readonly string[]).includes(name) ? 0.25 : 2.6)
      for (const p of def.parts) {
        expect(p.dur).toBeGreaterThan(0)
        expect(p.vol).toBeGreaterThan(0)
        expect(p.vol).toBeLessThanOrEqual(0.6)
        if (p.freq !== undefined) expect(hz(p.freq)).toBeGreaterThan(20)
        if (p.to !== undefined) expect(hz(p.to)).toBeGreaterThan(20)
        if (p.table) expect(parseTable(p.table)).toHaveLength(32)
      }
    })
  it('打字聲限速（一秒最多約 16 下）', () => {
    expect(SFX.type.gap).toBeGreaterThanOrEqual(0.05)
  })
})

/** 記憶體裡的 localStorage */
function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

describe('設定', () => {
  it('壞掉的、舊的、超出範圍的都變成合法的', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitize('x')).toEqual(DEFAULT_SETTINGS)
    expect(sanitize({ bgm: { volume: 3, muted: 'yes' }, sfx: { volume: -1 }, typing: 0 })).toEqual({
      bgm: { volume: 1, muted: false },
      sfx: { volume: 0, muted: false },
      typing: true,
    })
  })
  it('存了讀得回來；localStorage 丟錯也不會壞', () => {
    const m = memoryStorage()
    const s = { bgm: { volume: 0.3, muted: true }, sfx: { volume: 0.5, muted: false }, typing: false }
    saveSettings(m, s)
    expect(loadSettings(m)).toEqual(s)
    m.data.set('hitomeguri:game:audio:v1', '{壞掉')
    expect(loadSettings(m)).toEqual(DEFAULT_SETTINGS)
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(throwing, s)).not.toThrow()
  })
})

describe('沒有 Web Audio', () => {
  it('node 裡（沒有 AudioContext）每個方法都不丟錯，設定照樣存', async () => {
    const m = memoryStorage()
    const audio = createGameAudio({ storage: m })
    expect(audio.state()).toBe('off')
    await expect(audio.unlock()).resolves.toBeUndefined()
    audio.bgm('kyoto', { night: true })
    expect(audio.current()).toEqual({ bgm: 'kyoto', night: true, festival: false })
    for (const n of SFX_NAMES) audio.sfx(n)
    for (const n of JINGLE_IDS) audio.jingle(n)
    audio.setVolume('bgm', 0.25)
    audio.setMuted('sfx', true)
    audio.setTyping(false)
    await audio.suspend('menu')
    await audio.resume('menu')
    audio.bgm(null)
    audio.dispose()
    audio.dispose()
    expect(createGameAudio({ storage: m }).settings()).toEqual({ bgm: { volume: 0.25, muted: false }, sfx: { volume: 0.8, muted: true }, typing: false })
  })
  it('AudioContext 建不起來：unlock 不丟錯，變成沒有聲音', async () => {
    const Broken = function () {
      throw new Error('no audio')
    } as unknown as typeof AudioContext
    const audio = createGameAudio({ storage: null, AudioContext: Broken })
    expect(audio.state()).toBe('locked')
    await audio.unlock()
    expect(audio.state()).toBe('off')
    expect(() => audio.sfx('confirm')).not.toThrow()
  })
})

// ── 假的 AudioContext：只記下呼叫，檢查即時播放的流程 ──

type Ev = [string, number, number]
class FakeParam {
  value: number
  log: Ev[] = []
  constructor(v = 0) {
    this.value = v
  }
  setValueAtTime(v: number, t: number) {
    this.log.push(['set', v, t])
    return this
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.log.push(['lin', v, t])
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (!(v > 0)) throw new RangeError('exponential ramp 到 0')
    this.log.push(['exp', v, t])
    return this
  }
  setTargetAtTime(v: number, t: number, tc: number) {
    if (!(tc > 0)) throw new RangeError('timeConstant')
    this.log.push(['target', v, t])
    return this
  }
  cancelScheduledValues(t: number) {
    this.log.push(['cancel', 0, t])
    return this
  }
}
class FakeNode {
  readonly ctx: FakeCtx
  constructor(ctx: FakeCtx) {
    this.ctx = ctx
  }
  connect<T>(n: T): T {
    return n
  }
  disconnect() {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1)
}
class FakeSource extends FakeNode {
  onended: (() => void) | null = null
  start(t = 0) {
    if (t < this.ctx.currentTime - LATE_OK - 1e-9) this.ctx.late.push(t)
    this.ctx.started.push({ t, now: this.ctx.currentTime })
  }
  stop() {}
}
class FakeOsc extends FakeSource {
  type = 'sine'
  frequency = new FakeParam(440)
  detune = new FakeParam(0)
  setPeriodicWave() {}
}
class FakeBufferSource extends FakeSource {
  buffer: unknown = null
  loop = false
  playbackRate = new FakeParam(1)
}
class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam(350)
  Q = new FakeParam(1)
  gain = new FakeParam(0)
}
class FakeCtx {
  currentTime = 0
  sampleRate = 8000
  state = 'suspended'
  destination = new FakeNode(this)
  started: { t: number; now: number }[] = []
  late: number[] = []
  gains: FakeGain[] = []
  createGain() {
    const g = new FakeGain(this)
    this.gains.push(g)
    return g
  }
  createOscillator() {
    return new FakeOsc(this)
  }
  createBufferSource() {
    return new FakeBufferSource(this)
  }
  createBiquadFilter() {
    return new FakeFilter(this)
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(this), { curve: null, oversample: 'none' })
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array) {
    return { real, imag }
  }
  createBuffer(_ch: number, length: number, sampleRate: number) {
    const data = new Float32Array(length)
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data }
  }
  async resume() {
    this.state = 'running'
  }
  async suspend() {
    this.state = 'suspended'
  }
  async close() {
    this.state = 'closed'
  }
}

describe('即時播放（假的 AudioContext）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  async function setup() {
    vi.useFakeTimers()
    let ctx: FakeCtx | null = null
    const Ctor = function () {
      ctx = new FakeCtx()
      return ctx
    } as unknown as typeof AudioContext
    const audio = createGameAudio({ storage: memoryStorage(), AudioContext: Ctor, devHook: false })
    audio.bgm('kyoto')
    await audio.unlock()
    const c = ctx as unknown as FakeCtx
    const run = (seconds: number) => {
      for (let i = 0; i < seconds / 0.025; i++) {
        c.currentTime += 0.025
        vi.advanceTimersByTime(25)
      }
    }
    return { audio, ctx: c, run }
  }

  it('unlock 之後開始放之前要的曲子；每個音都排在開始之前', async () => {
    const { audio, ctx, run } = await setup()
    expect(audio.state()).toBe('running')
    expect(ctx.started.length).toBeGreaterThan(0)
    run(10)
    expect(ctx.started.length).toBeGreaterThan(60)
    expect(ctx.late).toEqual([])
    for (const s of ctx.started) expect(s.t - s.now).toBeLessThanOrEqual(0.12 + 0.35)
  })

  it('換曲：舊的淡出（目標 0），新的晚一點進來', async () => {
    const { audio, ctx, run } = await setup()
    run(2)
    const before = ctx.started.length
    const now = ctx.currentTime
    audio.bgm('okinawa')
    const faded = ctx.gains.filter((g) => g.gain.log.some(([k, v, t]) => k === 'target' && v === 0 && t === now))
    expect(faded.length).toBeGreaterThanOrEqual(1)
    run(1)
    const fresh = ctx.started.slice(before).filter((s) => s.now >= now)
    expect(fresh.length).toBeGreaterThan(0)
    // 同一首換夜裡：不重來（不會多一個淡出）
    audio.bgm('okinawa', { night: true })
    const t2 = ctx.currentTime
    expect(ctx.gains.filter((g) => g.gain.log.some(([k, v, t]) => k === 'target' && v === 0 && t === t2))).toEqual([])
    run(1)
    expect(ctx.late).toEqual([])
  })

  it('效果音：同一個太快只響一次、靜音與關掉打字聲就不響', async () => {
    const { audio, ctx, run } = await setup()
    audio.bgm(null)
    run(1)
    const n0 = ctx.started.length
    audio.sfx('type')
    audio.sfx('type')
    expect(ctx.started.length).toBe(n0 + 1)
    run(0.1)
    audio.sfx('type')
    expect(ctx.started.length).toBe(n0 + 2)
    audio.setTyping(false)
    run(0.1)
    audio.sfx('type')
    expect(ctx.started.length).toBe(n0 + 2)
    audio.setMuted('sfx', true)
    audio.sfx('confirm')
    expect(ctx.started.length).toBe(n0 + 2)
    audio.setMuted('sfx', false)
    for (const name of SFX_NAMES) {
      run(1)
      expect(() => audio.sfx(name)).not.toThrow()
    }
    expect(ctx.started.length).toBeGreaterThan(n0 + SFX_NAMES.length)
  })

  it('jingle：鎮曲壓低再回來', async () => {
    const { audio, ctx, run } = await setup()
    run(1)
    audio.jingle('arrive')
    const ducked = ctx.gains.filter((g) => g.gain.log.some(([k, v]) => k === 'target' && v === 0.18))
    expect(ducked.length).toBe(1)
    expect(ducked[0]!.gain.log.at(-1)![1]).toBe(1)
    run(3)
    expect(ctx.late).toEqual([])
  })

  it('dim：鎮曲壓低（不存設定）；jingle 放完回到壓低的音量', async () => {
    const { audio, ctx, run } = await setup()
    run(1)
    const before = audio.settings()
    audio.dim(0.45)
    const dimmed = ctx.gains.filter((g) => g.gain.log.some(([k, v]) => k === 'target' && v === 0.45))
    expect(dimmed.length).toBe(1)
    expect(audio.settings()).toEqual(before)
    audio.jingle('bought')
    expect(dimmed[0]!.gain.log.at(-1)![1]).toBe(0.45)
    audio.dim(1)
    expect(dimmed[0]!.gain.log.at(-1)![1]).toBe(1)
    run(2)
    expect(ctx.late).toEqual([])
  })

  it('suspend 分原因：全部 resume 了才繼續；dispose 之後都不丟錯', async () => {
    const { audio, ctx, run } = await setup()
    await audio.suspend('menu')
    await audio.suspend('hidden')
    expect(audio.state()).toBe('suspended')
    const n = ctx.started.length
    run(1)
    expect(ctx.started.length).toBe(n)
    await audio.resume('menu')
    expect(audio.state()).toBe('suspended')
    await audio.resume('hidden')
    expect(audio.state()).toBe('running')
    run(1)
    expect(ctx.started.length).toBeGreaterThan(n)
    audio.dispose()
    expect(audio.state()).toBe('off')
    expect(() => {
      audio.sfx('confirm')
      audio.bgm('kyoto')
      audio.jingle('stamp')
      audio.dim(0.5)
    }).not.toThrow()
  })
})

describe('不寫色碼', () => {
  it('聲音的程式沒有色碼', () => {
    const files = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [f, src] of Object.entries(files)) expect(src, f).not.toMatch(/#[0-9A-Fa-f]{6}\b|rgb\(|hsl\(/)
  })
})
