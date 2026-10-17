import { ENV, type SongDef } from '../tracker'
import { WAVES } from '../waves'
import { chordTrack, rest, type Shape } from './chords'

/**
 * 北海道的鎮：F 大調五聲音階（F G A C D）。原創。
 * 三拍子、八分音符一格（rows 2、每小節 3 拍＝6 格）、76 bpm、16 小節＝96 格≈38 秒一個 loop。開闊、慢：
 * 主旋律是波形表的長音（一個音拉兩三拍），下面是撥弦的分散和弦（空心的五度）與很低的長音；高音的方波偶爾點一下。
 * 夜裡拿掉高音、慢 20%；祭典多一軌太鼓。
 */

const MELODY = [
  'C5 - - - A4 - | C5 - D5 - F5 - | A5 - - - G5 - | F5 - - - - -',
  'G5 - - - F5 - | D5 - C5 - D5 - | F5 - - - - - | - - - - . .',
  'D5 - - - F5 - | A5 - - - C6 - | D6 - - - C6 - | A5 - G5 - - -',
  'F5 - G5 - A5 - | G5 - - - D5 - | F5 - - - - - | - - - - . .',
].join(' | ')

const PLAN = 'F F Dm Dm C C F F Dm Dm G G C C F F'

/** 撥弦：根音、五度、八度往上再回來 */
const PLUCK: Record<string, Shape> = {
  F: { full: 'F3 C4 F4 A4 F4 C4', half: 'F3 C4 F4' },
  Dm: { full: 'D3 A3 D4 F4 D4 A3', half: 'D3 A3 D4' },
  C: { full: 'C3 G3 C4 D4 C4 G3', half: 'C3 G3 C4' },
  G: { full: 'G2 D3 G3 C4 G3 D3', half: 'G2 D3 G3' },
}
const BASS: Record<string, Shape> = {
  F: { full: 'F2 - - - - -', half: 'F2 - -' },
  Dm: { full: 'D2 - - - - -', half: 'D2 - -' },
  C: { full: 'C2 - - - - -', half: 'C2 - -' },
  G: { full: 'G2 - - - - -', half: 'G2 - -' },
}

/** 高音的點（兩小節一個） */
const BELL = ['F6', 'D6', 'C6', 'F6', 'A6', 'G6', 'C6', null].map((n) => `${rest(6)} | ${n ? `. . . . ${n} -` : rest(6)}`).join(' | ')

export const hokkaido: SongDef = {
  id: 'hokkaido',
  title: '北海道的鎮',
  bpm: 76,
  rows: 2,
  beats: 3,
  scale: 'fpenta',
  night: { tempo: 0.8, vol: 0.85 },
  tracks: [
    {
      name: 'melody',
      inst: { kind: 'wave', table: WAVES.soft, vol: 0.095, env: ENV.pad, vibrato: { rate: 4.4, cents: 12, delay: 0.4 } },
      notes: MELODY,
    },
    {
      name: 'pluck',
      inst: { kind: 'pluck', vol: 0.165, decay: 0.997, bright: 0.6 },
      notes: chordTrack(PLAN, PLUCK),
    },
    {
      name: 'bass',
      inst: { kind: 'wave', table: WAVES.tri, vol: 0.2, env: ENV.pad },
      notes: chordTrack(PLAN, BASS),
    },
    {
      name: 'bell',
      inst: { kind: 'pulse', duty: 0.125, vol: 0.04, env: ENV.soft },
      notes: BELL,
      night: false,
    },
    {
      name: 'taiko',
      inst: { kind: 'taiko', vol: 0.4 },
      notes: 'D . d . K . | D^ . d d K k',
      festival: true,
    },
  ],
}
