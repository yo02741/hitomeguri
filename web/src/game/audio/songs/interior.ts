import { ENV, type SongDef } from '../tracker'
import { WAVES } from '../waves'
import { chordTrack, type Shape } from './chords'

/**
 * 室內與車站：陽音階（Re Mi Sol La Do = D E G A C，等於 C 的大調五聲音階）。原創。
 * 安靜、短：八分音符一格（rows 2）、72 bpm、8 小節＝64 格≈27 秒一個 loop。沒有打擊。
 * 聲道：方波 25%（輕的旋律）、方波 12.5%（分散和弦）、波形表（長的低音）。沒有夜裡、祭典的版本。
 */

const MELODY = [
  'G5 - - - E5 - D5 - | E5 - - - - - . . | C5 - D5 - E5 - G5 - | A5 - - - G5 - . .',
  'A5 - - - G5 - E5 - | D5 - - - - - . . | C5 - D5 - E5 - D5 - | C5 - - - - - . .',
].join(' | ')

/** C6、Am7、G（G D）、Dsus（D G A） */
const PLAN = 'C Am C Dsus Am G C C'

const ARP: Record<string, Shape> = {
  C: { full: 'C4 . E4 . G4 . E4 .', half: 'C4 . G4 .' },
  Am: { full: 'A3 . C4 . E4 . C4 .', half: 'A3 . E4 .' },
  G: { full: 'G3 . D4 . G4 . D4 .', half: 'G3 . D4 .' },
  Dsus: { full: 'D4 . G4 . A4 . G4 .', half: 'D4 . A4 .' },
}
const BASS: Record<string, Shape> = {
  C: { full: 'C3 - - - - - - -', half: 'C3 - - -' },
  Am: { full: 'A2 - - - - - - -', half: 'A2 - - -' },
  G: { full: 'G2 - - - - - - -', half: 'G2 - - -' },
  Dsus: { full: 'D3 - - - - - - -', half: 'D3 - - -' },
}

export const interior: SongDef = {
  id: 'interior',
  title: '室內與車站',
  bpm: 72,
  rows: 2,
  scale: 'yo',
  tracks: [
    {
      name: 'melody',
      inst: { kind: 'pulse', duty: 0.25, vol: 0.085, env: ENV.soft, vibrato: { rate: 4.6, cents: 10, delay: 0.35 } },
      notes: MELODY,
    },
    {
      name: 'arp',
      inst: { kind: 'pulse', duty: 0.125, vol: 0.05, env: ENV.koto },
      notes: chordTrack(PLAN, ARP),
    },
    {
      name: 'bass',
      inst: { kind: 'wave', table: WAVES.soft, vol: 0.2, env: ENV.pad },
      notes: chordTrack(PLAN, BASS),
    },
  ],
}
