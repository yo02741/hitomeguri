import { ENV, type SongDef } from '../tracker'
import { WAVES } from '../waves'

/**
 * 短的 jingle（1–2 秒，不 loop）：抵達新的鎮、蓋章、買到東西。原創。
 * 放的時候鎮曲壓低，放完再回來（gameAudio.ts 的 jingle）。音量跟著 BGM 的設定。
 */

const lead = { kind: 'pulse', duty: 0.25, vol: 0.14, env: ENV.lead } as const
const harm = { kind: 'pulse', duty: 0.125, vol: 0.08, env: ENV.lead } as const
const bass = { kind: 'wave', table: WAVES.tri, vol: 0.2, env: ENV.bass } as const

/** 抵達新的鎮（約 1.7 秒） */
export const arrive: SongDef = {
  id: 'arrive',
  title: '抵達',
  bpm: 140,
  rows: 4,
  loop: false,
  tracks: [
    { name: 'lead', inst: lead, notes: 'E5 . G5 . A5 . C6 - - - E6 - - - - .' },
    { name: 'harm', inst: harm, notes: 'C5 . E5 . F5 . A5 - - - C6 - - - - .' },
    { name: 'bass', inst: bass, notes: 'C3 - - - F3 - - - C3 - - - - - - .' },
  ],
}

/** 蓋章（約 1 秒） */
export const stamp: SongDef = {
  id: 'stamp',
  title: '蓋章',
  bpm: 150,
  rows: 4,
  loop: false,
  tracks: [
    { name: 'lead', inst: lead, notes: 'G5 . C6 . E6 - - - - .' },
    { name: 'harm', inst: harm, notes: 'E5 . G5 . C6 - - - - .' },
    { name: 'bass', inst: bass, notes: 'C3 - - - - - - - - .' },
  ],
}

/** 買到東西（約 1 秒） */
export const bought: SongDef = {
  id: 'bought',
  title: '買到東西',
  bpm: 150,
  rows: 4,
  loop: false,
  tracks: [
    { name: 'lead', inst: lead, notes: 'C6 . D6 . E6 . G6 - - .' },
    { name: 'harm', inst: harm, notes: 'G5 . A5 . C6 . E6 - - .' },
    { name: 'bass', inst: bass, notes: 'C3 - - - - - G3 - - .' },
  ],
}
