import { ENV, type SongDef } from '../tracker'
import { WAVES } from '../waves'
import { chordTrack, type Shape } from './chords'

/**
 * 東京的鎮（關東）：D 大調（七聲：D E F# G A B C#）。原創。
 * 八分音符一格（rows 2）、132 bpm、20 小節＝160 格≈36 秒一個 loop。明快、都市的感覺：
 * 主旋律在高音域跳（A A' B C A''），B 段切分、C 段往上推。
 * 聲道：方波 50%（主旋律，亮）、方波 12.5%（反拍的和弦，像城市的節奏）、波形表（八度跳的低音）、雜訊（鈸＋小鼓）；
 * 夜裡拿掉反拍與打擊、慢 20%；祭典多一軌太鼓。
 */

const MELODY = [
  'F#5 - A5 - D6 - A5 F#5 | B5 - A5 F#5 D5 - E5 F#5 | G5 - B5 - D6 C#6 B5 A5 | A5 - - - E5 - . .',
  'F#5 - A5 - D6 - E6 F#6 | E6 - C#6 A5 F#5 - A5 C#6 | B5 - G5 B5 D6 - B5 G5 | A5 - - - - - . .',
  'E5 . G5 B5 . A5 G5 E5 | C#5 - E5 - A5 - G5 E5 | F#5 . A5 C#6 . B5 A5 F#5 | D5 - F#5 - B5 - A5 F#5',
  'G5 A5 B5 D6 - B5 A5 G5 | A5 B5 C#6 E6 - C#6 B5 A5 | B5 - F#5 - B5 C#6 D6 - | E6 - - - C#6 - A5 -',
  'F#5 - A5 - D6 - A5 F#5 | B5 - A5 F#5 D5 - E5 F#5 | G5 - B5 - A5 - C#6 E6 | D6 - - - - - . .',
].join(' | ')

/** 和弦進行（一小節一個；| 是前後半小節） */
const PLAN = 'D Bm G A D F#m G A Em A F#m Bm G A Bm A D Bm G|A D'

/** 反拍的和弦（方波 12.5%） */
const OFFBEAT: Record<string, Shape> = {
  D: { full: '. F#4 . A4 . F#4 . D5', half: '. F#4 . A4' },
  Bm: { full: '. D4 . F#4 . D4 . B4', half: '. D4 . F#4' },
  G: { full: '. D4 . G4 . B4 . G4', half: '. D4 . G4' },
  A: { full: '. C#4 . E4 . A4 . E4', half: '. C#4 . E4' },
  Em: { full: '. E4 . G4 . B4 . G4', half: '. E4 . G4' },
  'F#m': { full: '. C#4 . F#4 . A4 . F#4', half: '. C#4 . F#4' },
}
/** 低音：根音的八度跳 */
const BASS: Record<string, Shape> = {
  D: { full: 'D2 . D3 D2 . D2 D3 A2', half: 'D2 . D3 D2' },
  Bm: { full: 'B1 . B2 B1 . B1 B2 F#2', half: 'B1 . B2 B1' },
  G: { full: 'G2 . G3 G2 . G2 G3 D3', half: 'G2 . G3 G2' },
  A: { full: 'A2 . A3 A2 . A2 A3 E3', half: 'A2 . A3 A2' },
  Em: { full: 'E2 . E3 E2 . E2 E3 B2', half: 'E2 . E3 E2' },
  'F#m': { full: 'F#2 . F#3 F#2 . F#2 F#3 C#3', half: 'F#2 . F#3 F#2' },
}

export const tokyo: SongDef = {
  id: 'tokyo',
  title: '東京的鎮',
  bpm: 132,
  rows: 2,
  scale: 'major',
  night: { tempo: 0.8, vol: 0.85 },
  tracks: [
    {
      name: 'melody',
      inst: { kind: 'pulse', duty: 0.5, vol: 0.1, env: ENV.lead, vibrato: { rate: 5.6, cents: 10, delay: 0.25 } },
      notes: MELODY,
    },
    {
      name: 'offbeat',
      inst: { kind: 'pulse', duty: 0.125, vol: 0.06, env: ENV.koto },
      notes: chordTrack(PLAN, OFFBEAT),
      night: false,
    },
    {
      name: 'bass',
      inst: { kind: 'wave', table: WAVES.tri, vol: 0.22, env: ENV.bounce },
      notes: chordTrack(PLAN, BASS),
    },
    {
      name: 'drums',
      inst: { kind: 'noise', vol: 0.45 },
      notes: 'h . s . h h s . | h . s . h h s o',
      night: false,
    },
    {
      name: 'taiko',
      inst: { kind: 'taiko', vol: 0.42 },
      notes: 'D^ . . d D . K . | D . d . D^ . K k',
      festival: true,
    },
  ],
}
