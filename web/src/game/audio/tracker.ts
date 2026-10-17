import { NOISE_HITS, TAIKO_HITS } from './drums'
import { noteToMidi, type ScaleId } from './notes'

/**
 * 曲子的寫法（tracker）：一軌一列字串，空白分開，一個字一格。
 *
 *   C4 F#3 Bb2  音名＋八度：這一格開始一個音（C4 = 中央 Do，A4 = 440 Hz）
 *   -           延長前一個音一格（休止後面的 - 就是休止繼續）
 *   .           休止：前一個音到這裡停
 *   h s t c o   單一字母：打擊。雜訊聲道用 h s t c o，太鼓聲道用 D d K k（drums.ts）
 *   後綴 ^ _    重音 ×1.3、輕 ×0.6，例 `D^`、`E5_`
 *   |           小節線：不佔格，只用來檢查每小節的格數
 *
 * 例：`C4 . E4 . G4 - - .` 是 C4 一格、休一格、E4 一格、休一格、G4 三格、休一格。
 * 一格多長看曲子的 bpm（每分鐘幾拍）與 rows（每拍幾格）：rows 2 一格是八分音符、4 是十六分音符。
 * 每一軌的長度要能整除整首（短的軌一直重複，例：一小節的鼓）；loop 回到 loopFrom 那一格。
 */

export type Duty = 0.125 | 0.25 | 0.5

export interface Envelope {
  /** 起音（秒，直線上到最大） */
  attack: number
  /** 衰減（秒，往 sustain 指數靠近，大約這麼久到） */
  decay: number
  /** 持續的比例（0–1） */
  sustain: number
  /** 音尾（秒，音停之後直線收到 0） */
  release: number
}

/** 預設的音量封包 */
export const ENV = {
  /** 主旋律：短起音、留一點持續 */
  lead: { attack: 0.006, decay: 0.35, sustain: 0.55, release: 0.07 },
  /** 撥的感覺（琴）：很快掉完 */
  koto: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.04 },
  /** 低音 */
  bass: { attack: 0.004, decay: 0.3, sustain: 0.7, release: 0.05 },
  /** 跳的低音（短） */
  bounce: { attack: 0.004, decay: 0.15, sustain: 0.35, release: 0.04 },
  /** 墊底、笛：慢慢起來 */
  pad: { attack: 0.12, decay: 0.5, sustain: 0.75, release: 0.3 },
  /** 輕的旋律 */
  soft: { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.15 },
} satisfies Record<string, Envelope>

/** 顫音：LFO 接 detune */
export interface Vibrato {
  /** 每秒幾次 */
  rate: number
  /** 幅度（cent） */
  cents: number
  /** 音開始多久之後才晃（秒） */
  delay: number
}

interface Tonal {
  /** 這一軌的音量（0–1，混音前） */
  vol: number
  env?: Envelope
  vibrato?: Vibrato
  /** 整軌移調（半音） */
  transpose?: number
}

/** 聲道與音色：方波（佔空比）、波形表（32 個 16 進位字）、撥弦、雜訊、太鼓 */
export type Instrument =
  | (Tonal & { kind: 'pulse'; duty: Duty })
  | (Tonal & { kind: 'wave'; table: string })
  | { kind: 'pluck'; vol: number; decay: number; bright: number; transpose?: number }
  | { kind: 'noise'; vol: number }
  | { kind: 'taiko'; vol: number }

export type ChannelKind = Instrument['kind']

export interface TrackDef {
  /** 這一軌的名字（錯誤訊息、測試用） */
  name: string
  inst: Instrument
  notes: string
  /** 夜裡的版本要不要留這一軌（預設留） */
  night?: boolean
  /** 只在祭典時出現 */
  festival?: boolean
}

export interface SongDef {
  id: string
  /** 曲名（只在開發工具裡看得到） */
  title: string
  /** 每分鐘幾拍 */
  bpm: number
  /** 每拍幾格 */
  rows: number
  /** 每小節幾拍（預設 4；只用來檢查小節線） */
  beats?: number
  /** 要不要 loop（jingle 不要；預設要） */
  loop?: boolean
  /** loop 回到第幾格（預設 0） */
  loopFrom?: number
  /** 搖擺：奇數格往後挪一格的多少（0–0.4） */
  swing?: number
  /** 這首的音階（測試檢查每個音都在裡面；jingle 不寫） */
  scale?: ScaleId
  /** 夜裡的版本：速度（0.75–0.85 = 慢 15–25%）與音量；沒寫就沒有夜裡的版本 */
  night?: { tempo: number; vol: number }
  tracks: TrackDef[]
}

export interface NoteEvent {
  /** 這一軌的第幾格開始 */
  step: number
  /** 幾格長 */
  len: number
  /** 音（MIDI，還沒加 transpose）；打擊是 null */
  midi: number | null
  /** 打擊的字母；音是 null */
  hit: string | null
  /** 力度（重音、輕） */
  vel: number
}

export interface ParsedTrack {
  def: TrackDef
  length: number
  events: NoteEvent[]
  /** 第幾格開始的音（沒有就 undefined） */
  byStep: (NoteEvent | undefined)[]
  /** 每小節幾格（照 | 分；沒寫 | 就整軌一個） */
  bars: number[]
}

export interface ParsedSong {
  def: SongDef
  /** 整首幾格（最長那一軌） */
  length: number
  loopFrom: number
  loop: boolean
  tracks: ParsedTrack[]
}

const VELOCITY: Record<string, number> = { '^': 1.3, _: 0.6 }

const isPerc = (kind: ChannelKind) => kind === 'noise' || kind === 'taiko'

function hitTable(kind: ChannelKind): Record<string, unknown> {
  return kind === 'taiko' ? TAIKO_HITS : NOISE_HITS
}

/** 一軌的字串 → 音的列表；寫錯就丟錯（說第幾個字、哪裡錯） */
export function parseTrack(text: string, kind: ChannelKind): Omit<ParsedTrack, 'def' | 'byStep'> {
  const tokens = text.split(/\s+/).filter(Boolean)
  const events: NoteEvent[] = []
  const bars: number[] = []
  let step = 0
  let barStart = 0
  let last: NoteEvent | null = null
  tokens.forEach((tok, i) => {
    const where = `第 ${i + 1} 個字「${tok}」`
    if (tok === '|') {
      bars.push(step - barStart)
      barStart = step
      return
    }
    if (tok === '-') {
      if (last) last.len++
      step++
      return
    }
    if (tok === '.') {
      last = null
      step++
      return
    }
    const suffix = tok.length > 1 ? tok.slice(-1) : ''
    const vel = VELOCITY[suffix] ?? 1
    const base = vel === 1 ? tok : tok.slice(0, -1)
    const midi = noteToMidi(base)
    let ev: NoteEvent
    if (midi !== null) {
      if (isPerc(kind)) throw new Error(`${where}：${kind} 聲道只能寫打擊的字母`)
      ev = { step, len: 1, midi, hit: null, vel }
    } else if (/^[A-Za-z]$/.test(base)) {
      if (!isPerc(kind)) throw new Error(`${where}：${kind} 聲道要寫音名（例 C4）`)
      if (!(base in hitTable(kind))) throw new Error(`${where}：${kind} 沒有這種打擊`)
      ev = { step, len: 1, midi: null, hit: base, vel }
    } else {
      throw new Error(`${where}看不懂`)
    }
    events.push(ev)
    last = ev
    step++
  })
  if (step > barStart) bars.push(step - barStart)
  return { length: step, events, bars }
}

/** 整首解析＋檢查：每軌長度整除整首、loop 起點對得上重複的軌 */
export function parseSong(def: SongDef): ParsedSong {
  const tracks: ParsedTrack[] = def.tracks.map((t) => {
    let p: Omit<ParsedTrack, 'def' | 'byStep'>
    try {
      p = parseTrack(t.notes, t.inst.kind)
    } catch (e) {
      throw new Error(`${def.id}/${t.name}：${(e as Error).message}`)
    }
    if (p.length === 0) throw new Error(`${def.id}/${t.name}：是空的`)
    const byStep: (NoteEvent | undefined)[] = new Array(p.length).fill(undefined)
    for (const ev of p.events) byStep[ev.step] = ev
    return { def: t, byStep, ...p }
  })
  if (!tracks.length) throw new Error(`${def.id}：沒有軌`)
  const length = Math.max(...tracks.map((t) => t.length))
  const loop = def.loop ?? true
  const loopFrom = def.loopFrom ?? 0
  if (loopFrom < 0 || loopFrom >= length) throw new Error(`${def.id}：loopFrom ${loopFrom} 不在曲子裡`)
  for (const t of tracks) {
    if (length % t.length) throw new Error(`${def.id}/${t.def.name}：${t.length} 格不能整除整首的 ${length} 格`)
    // 比整首短、一直重複的軌：loop 回去時要剛好在它的開頭，不然音型會錯開
    if (t.length < length && loopFrom % t.length) throw new Error(`${def.id}/${t.def.name}：loopFrom ${loopFrom} 不在這一軌的開頭`)
  }
  return { def, length, loopFrom, loop, tracks }
}

/** 一格幾秒 */
export const stepDuration = (bpm: number, rows: number, tempo = 1) => 60 / (bpm * tempo) / rows

/** 一個 loop 幾秒（從 loopFrom 到最後；tempo 是速度倍率） */
export const loopSeconds = (song: ParsedSong, tempo = 1) =>
  (song.length - song.loopFrom) * stepDuration(song.def.bpm, song.def.rows, tempo)
