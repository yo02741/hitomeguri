import { ENV, type SongDef } from '../tracker'
import { WAVES } from '../waves'
import { chordTrack, repeat, rest, type Shape } from './chords'

/**
 * 沖繩的鎮：琉球音階（Do Mi Fa Sol Si = C E F G B）。原創。
 * 八分音符一格（rows 2）、116 bpm、搖擺（後半拍晚一點，跳的感覺）、16 小節＝128 格≈33 秒一個 loop。
 * 聲道：撥弦（Karplus–Strong，三線的感覺，主旋律）、方波 12.5%（後半段的長音，笛）、波形表（跳的低音）、
 * 太鼓（輕的）、雜訊（三板的「カチャ」）；夜裡只留三線與低音、慢 18%；祭典多一軌大鼓。
 * 音階沒有 Re、La，所以和弦只用 C（C E G）、Em（E G B）、G（G B）、F（F C）。
 */

const MELODY = [
  'G5 - E5 F5 G5 - C6 - | B5 G5 F5 E5 F5 - - . | E5 - F5 G5 B5 G5 F5 E5 | C5 - E5 - C5 - - .',
  'G5 - E5 F5 G5 - C6 - | E6 - C6 B5 G5 - - . | F5 G5 B5 G5 F5 E5 F5 G5 | E5 - - - C5 - . .',
  'C5 - E5 - F5 - G5 - | B4 - C5 - E5 - - . | F5 - E5 F5 G5 B5 G5 F5 | E5 F5 E5 C5 B4 - - .',
  'G5 - E5 F5 G5 - C6 - | B5 G5 F5 E5 F5 - G5 - | B5 - C6 B5 G5 F5 E5 F5 | C5 - - - . . . .',
].join(' | ')

/** 後半段的長音（前 8 小節休息） */
const FUE = [
  repeat(rest(8), 8),
  'E5 - - - F5 - - - | G5 - - - E5 - - - | F5 - - - G5 - - - | E5 - - - G5 - - -',
  'C6 - - - - - - - | B5 - - - C6 - - - | B5 - - - G5 - - - | G5 - - - . . . .',
].join(' | ')

const PLAN = 'C G|F C|Em C C C|Em F|C C C|F G|C F|G C|G C G|F Em|G C'

const BASS: Record<string, Shape> = {
  C: { full: 'C3 . G2 . C3 . G2 .', half: 'C3 . G2 .' },
  Em: { full: 'E2 . B2 . E2 . B2 .', half: 'E2 . B2 .' },
  G: { full: 'G2 . B2 . G2 . B2 .', half: 'G2 . B2 .' },
  F: { full: 'F2 . C3 . F2 . C3 .', half: 'F2 . C3 .' },
}

export const okinawa: SongDef = {
  id: 'okinawa',
  title: '沖繩的鎮',
  bpm: 116,
  rows: 2,
  swing: 0.22,
  scale: 'ryukyu',
  night: { tempo: 0.82, vol: 0.85 },
  tracks: [
    {
      name: 'sanshin',
      inst: { kind: 'pluck', vol: 0.34, decay: 0.9965, bright: 0.75, transpose: -12 },
      notes: MELODY,
    },
    {
      name: 'fue',
      inst: { kind: 'pulse', duty: 0.125, vol: 0.05, env: ENV.pad, vibrato: { rate: 5, cents: 12, delay: 0.3 } },
      notes: FUE,
      night: false,
    },
    {
      name: 'bass',
      inst: { kind: 'wave', table: WAVES.tri, vol: 0.22, env: ENV.bounce },
      notes: chordTrack(PLAN, BASS),
    },
    {
      name: 'taiko',
      inst: { kind: 'taiko', vol: 0.4 },
      notes: 'd . . k d . k . | d . k . d k . k',
      night: false,
    },
    {
      name: 'sanba',
      inst: { kind: 'noise', vol: 0.45 },
      notes: '. c . c . c . c',
      night: false,
    },
    {
      name: 'eisa',
      inst: { kind: 'taiko', vol: 0.42 },
      notes: 'D^ . D . D . . K | D^ . D K D . D .',
      festival: true,
    },
  ],
}
