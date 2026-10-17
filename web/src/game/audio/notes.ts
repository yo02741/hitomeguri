/**
 * 音名、頻率、音階。曲子的檢查（每個音都在那首的音階裡）也用這裡。
 * 音名寫法：C4、F#3、Bb2（字母＋升降＋八度），C4 = 中央 Do = MIDI 60，A4 = 440 Hz。
 */

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'C4'、'F#3'、'Bb2' → MIDI 編號；寫錯回 null */
export function noteToMidi(name: string): number | null {
  const m = /^([A-G])([#b]?)([0-8])$/.exec(name)
  if (!m) return null
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (Number(m[3]) + 1) * 12 + LETTER[m[1]!]! + acc
}

/** MIDI → Hz（十二平均律，A4 = 69 = 440 Hz） */
export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** 音名或 Hz → Hz（效果音兩種都可以寫） */
export function hz(v: number | string): number {
  if (typeof v === 'number') return v
  const m = noteToMidi(v)
  if (m === null) throw new Error(`音名「${v}」看不懂`)
  return midiToHz(m)
}

export const pitchClass = (m: number) => ((m % 12) + 12) % 12

export type ScaleId = 'miyako' | 'ryukyu' | 'yo' | 'major' | 'fpenta'

export interface Scale {
  name: string
  /** 用到的音（pitch class：C = 0 … B = 11） */
  pcs: readonly number[]
}

export const SCALES: Record<ScaleId, Scale> = {
  // 都節音階：Mi Fa La Si Do（E F A B C）
  miyako: { name: '都節音階', pcs: [4, 5, 9, 11, 0] },
  // 琉球音階：Do Mi Fa Sol Si（C E F G B）
  ryukyu: { name: '琉球音階', pcs: [0, 4, 5, 7, 11] },
  // 陽音階：Re Mi Sol La Do（D E G A C）
  yo: { name: '陽音階', pcs: [2, 4, 7, 9, 0] },
  // D 大調（七聲）：D E F# G A B C#（東京）
  major: { name: 'D 大調音階', pcs: [2, 4, 6, 7, 9, 11, 1] },
  // F 大調五聲音階：F G A C D（北海道）
  fpenta: { name: 'F 大調五聲音階', pcs: [5, 7, 9, 0, 2] },
}

export const inScale = (midi: number, id: ScaleId) => SCALES[id].pcs.includes(pitchClass(midi))
