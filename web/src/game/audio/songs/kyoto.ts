import { ENV, type SongDef } from '../tracker'
import { WAVES } from '../waves'
import { chordTrack, type Shape } from './chords'

/**
 * 京都的鎮（近畿）：都節音階（Mi Fa La Si Do = E F A B C），白天。原創。
 * 八分音符一格（rows 2）、96 bpm、16 小節＝128 格≈40 秒一個 loop。
 * 結構 A A' B A''：A 在高音域、B 降到低音域放慢；收在 Fa→Mi、Do→Si 的半音（都節的味道）。
 * 聲道：方波 25%（主旋律，笛的顫音）、方波 12.5%（琴的分散和弦）、波形表（低音）、雜訊（木魚＋鈸）；
 * 夜裡拿掉伴奏與打擊、慢 20%；祭典多一軌太鼓。
 */

const MELODY = [
  'E5 - B5 - A5 B5 C6 - | B5 - A5 F5 E5 - - - | A5 - E6 - C6 B5 A5 - | F5 A5 B5 - F5 - E5 -',
  'E5 - B5 - A5 B5 C6 - | E6 - C6 B5 A5 - - - | F5 - A5 - B5 C6 B5 A5 | B5 - - - - - . .',
  'A4 - - B4 C5 - B4 - | A4 - F4 - E4 - - - | A4 - C5 - E5 - F5 E5 | C5 - B4 - - - . .',
  'E5 - B5 - A5 B5 C6 - | B5 - A5 F5 E5 - F5 A5 | B5 - E6 - C6 B5 A5 F5 | E5 - - - - - . .',
].join(' | ')

/** 和弦進行（一小節一個；| 是前後半小節） */
const PLAN_A = 'Am Am|E Am F|E Am Am F|Am E'
const PLAN_B = 'Am F|E Am|F Am|E'
const PLAN_C = 'Am Am|F Am|F E'

/** 琴的分散和弦（八分音符） */
const KOTO: Record<string, Shape> = {
  Am: { full: 'A4 E5 C5 E5 A4 E5 C5 E5', half: 'A4 E5 C5 E5' },
  E: { full: 'E4 B4 E5 B4 E4 B4 E5 B4', half: 'E4 B4 E5 B4' },
  F: { full: 'F4 C5 A4 C5 F4 C5 A4 C5', half: 'F4 C5 A4 C5' },
}
/** B 段：旋律降下來，伴奏也低一個八度、稀一點 */
const KOTO_LOW: Record<string, Shape> = {
  Am: { full: 'A3 - E4 - C4 - E4 -', half: 'A3 - E4 -' },
  E: { full: 'E3 - B3 - E4 - B3 -', half: 'E3 - B3 -' },
  F: { full: 'F3 - C4 - A3 - C4 -', half: 'F3 - C4 -' },
}
const BASS: Record<string, Shape> = {
  Am: { full: 'A2 - - E3 - - A2 -', half: 'A2 - E3 -' },
  E: { full: 'E2 - - B2 - - E2 -', half: 'E2 - B2 -' },
  F: { full: 'F2 - - C3 - - F2 -', half: 'F2 - C3 -' },
}

export const kyoto: SongDef = {
  id: 'kyoto',
  title: '京都的鎮',
  bpm: 96,
  rows: 2,
  scale: 'miyako',
  night: { tempo: 0.8, vol: 0.85 },
  tracks: [
    {
      name: 'melody',
      inst: { kind: 'pulse', duty: 0.25, vol: 0.13, env: ENV.lead, vibrato: { rate: 5.2, cents: 14, delay: 0.22 } },
      notes: MELODY,
    },
    {
      name: 'koto',
      inst: { kind: 'pulse', duty: 0.125, vol: 0.075, env: ENV.koto },
      notes: [chordTrack(PLAN_A, KOTO), chordTrack(PLAN_B, KOTO_LOW), chordTrack(PLAN_C, KOTO)].join(' | '),
      night: false,
    },
    {
      name: 'bass',
      inst: { kind: 'wave', table: WAVES.tri, vol: 0.22, env: ENV.bass },
      notes: chordTrack([PLAN_A, PLAN_B, PLAN_C].join(' '), BASS),
    },
    {
      name: 'perc',
      inst: { kind: 'noise', vol: 0.5 },
      notes: 't . h . . . h . | t . h . t . h h',
      night: false,
    },
    {
      name: 'taiko',
      inst: { kind: 'taiko', vol: 0.45 },
      notes: 'D^ . . d D . K . | D . d . D^ . K k',
      festival: true,
    },
  ],
}
