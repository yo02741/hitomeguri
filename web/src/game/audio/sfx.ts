import type { NoiseMode } from './lfsr'
import type { Duty } from './tracker'
import { WAVES } from './waves'

/**
 * 效果音：每個是幾段（part）疊起來，資料寫在這裡，發聲在 voices.ts 的 playSfx。
 * 一段＝一個聲源（方波／波形表／正弦／LFSR 雜訊）＋可選的掃頻、濾波、顫音＋音量形狀。
 * 加新的效果音：在 SFX 加一個名字與幾段，測試會檢查長度與音量。
 */

export interface SfxPart {
  /** 從效果音開始算幾秒後（預設 0） */
  at?: number
  /** 長度（秒） */
  dur: number
  src: 'pulse' | 'wave' | 'sine' | 'noise'
  duty?: Duty
  /** 波形表（32 個 16 進位字） */
  table?: string
  /** 音高：Hz 或音名 */
  freq?: number | string
  /** 掃頻的終點 */
  to?: number | string
  curve?: 'exp' | 'lin'
  /** 雜訊：LFSR 模式與一秒幾步（可以掃到 clockTo） */
  noise?: NoiseMode
  clock?: number
  clockTo?: number
  vol: number
  attack?: number
  /** flat 的收尾（秒） */
  release?: number
  /** decay：一開始最大、掉下去；flat：持平到最後；swell：慢慢起來再收 */
  shape?: 'decay' | 'flat' | 'swell'
  filter?: { type: BiquadFilterType; freq: number; to?: number; q?: number }
  vib?: { rate: number; cents: number }
  /** 同一段重複幾次、間隔幾秒 */
  repeat?: { count: number; every: number }
}

export interface SfxDef {
  parts: SfxPart[]
  /** 同一個效果音最短間隔（秒）：連按、打字聲限速 */
  gap?: number
}

/** 鐵軌接縫的「タタン」 */
const joint = (at: number, every: number): SfxPart => ({
  at,
  src: 'noise',
  clock: 5000,
  dur: 0.05,
  vol: 0.3,
  filter: { type: 'lowpass', freq: 900 },
  repeat: { count: 2, every },
})

/** 空氣的「プシュー」 */
const air = (at: number, dur: number, vol: number): SfxPart => ({
  at,
  src: 'noise',
  clock: 44000,
  dur,
  vol,
  filter: { type: 'highpass', freq: 2600 },
})

export const SFX = {
  // 撞牆：低的「ドッ」
  bump: {
    gap: 0.18,
    parts: [
      { src: 'pulse', duty: 0.5, freq: 98, to: 55, dur: 0.09, vol: 0.45, filter: { type: 'lowpass', freq: 900 } },
      { src: 'noise', clock: 3500, dur: 0.05, vol: 0.2, filter: { type: 'lowpass', freq: 700 } },
    ],
  },
  // A 確認：往上的兩聲
  confirm: {
    gap: 0.04,
    parts: [
      { src: 'pulse', duty: 0.25, freq: 'B5', dur: 0.035, vol: 0.26, shape: 'flat', release: 0.005 },
      { at: 0.035, src: 'pulse', duty: 0.25, freq: 'E6', dur: 0.075, vol: 0.26 },
    ],
  },
  // 選單移動：一下輕的
  cursor: { gap: 0.025, parts: [{ src: 'pulse', duty: 0.125, freq: 'E6', dur: 0.03, vol: 0.2 }] },
  // 取消：往下的兩聲
  cancel: {
    gap: 0.04,
    parts: [
      { src: 'pulse', duty: 0.25, freq: 'E5', dur: 0.035, vol: 0.24, shape: 'flat', release: 0.005 },
      { at: 0.04, src: 'pulse', duty: 0.25, freq: 'A4', dur: 0.07, vol: 0.24 },
    ],
  },
  // 打字聲：很短很輕，最多一秒 16 下
  type: {
    gap: 0.06,
    parts: [{ src: 'pulse', duty: 0.5, freq: 'A5', dur: 0.02, vol: 0.08, filter: { type: 'lowpass', freq: 2600 } }],
  },
  // 開門：拉門的「ガラガラ」＋停住的一聲
  door: {
    gap: 0.2,
    parts: [
      { src: 'noise', clock: 9000, dur: 0.03, vol: 0.28, filter: { type: 'bandpass', freq: 1400, q: 1.2 }, repeat: { count: 4, every: 0.035 } },
      { at: 0.16, src: 'pulse', duty: 0.5, freq: 147, to: 98, dur: 0.06, vol: 0.26, filter: { type: 'lowpass', freq: 800 } },
      { at: 0.16, src: 'noise', clock: 6000, dur: 0.05, vol: 0.2, filter: { type: 'lowpass', freq: 1200 } },
    ],
  },
  // 樓梯：三步，一步比一步低
  stairs: {
    gap: 0.25,
    parts: [
      { src: 'noise', clock: 7000, dur: 0.05, vol: 0.32, filter: { type: 'lowpass', freq: 1500 } },
      { at: 0.09, src: 'noise', clock: 6000, dur: 0.05, vol: 0.3, filter: { type: 'lowpass', freq: 1150 } },
      { at: 0.18, src: 'noise', clock: 5000, dur: 0.06, vol: 0.28, filter: { type: 'lowpass', freq: 850 } },
    ],
  },
  // 跳下台階：往上掃的一聲＋落地的輕「トッ」（引擎跳台階時發 jump）
  jump: {
    gap: 0.2,
    parts: [
      { src: 'pulse', duty: 0.25, freq: 'C5', to: 'G5', dur: 0.12, vol: 0.2, curve: 'exp' },
      { at: 0.48, src: 'noise', clock: 5000, dur: 0.04, vol: 0.18, filter: { type: 'lowpass', freq: 900 } },
    ],
  },
  // 快門：「カシャ」
  shutter: {
    gap: 0.15,
    parts: [
      { src: 'noise', clock: 48000, dur: 0.02, vol: 0.38, filter: { type: 'highpass', freq: 2500 } },
      { src: 'pulse', duty: 0.125, freq: 'C7', dur: 0.012, vol: 0.1 },
      { at: 0.075, src: 'noise', clock: 36000, dur: 0.065, vol: 0.3, filter: { type: 'highpass', freq: 1400 } },
    ],
  },
  // 蓋章：悶的「ポン」
  stamp: {
    gap: 0.15,
    parts: [
      { src: 'sine', freq: 190, to: 62, dur: 0.13, vol: 0.55 },
      { src: 'noise', clock: 7000, dur: 0.04, vol: 0.26, filter: { type: 'lowpass', freq: 1300 } },
    ],
  },
  // 收銀：抽屜「ガチャ」＋高的「チーン」
  register: {
    gap: 0.3,
    parts: [
      { src: 'noise', clock: 24000, dur: 0.06, vol: 0.2, filter: { type: 'bandpass', freq: 2800, q: 1 }, repeat: { count: 2, every: 0.04 } },
      { at: 0.08, src: 'pulse', duty: 0.5, freq: 'B6', dur: 0.22, vol: 0.12 },
      { at: 0.13, src: 'pulse', duty: 0.5, freq: 'E7', dur: 0.4, vol: 0.11 },
    ],
  },
  // 拿到東西：短的往上琶音
  item: {
    gap: 0.2,
    parts: [
      { src: 'pulse', duty: 0.25, freq: 'G5', dur: 0.06, vol: 0.2 },
      { at: 0.05, src: 'pulse', duty: 0.25, freq: 'C6', dur: 0.06, vol: 0.2 },
      { at: 0.1, src: 'pulse', duty: 0.25, freq: 'E6', dur: 0.06, vol: 0.2 },
      { at: 0.15, src: 'pulse', duty: 0.25, freq: 'G6', dur: 0.2, vol: 0.2 },
    ],
  },
  // 電車出發：放氣、馬達聲往上、鐵軌接縫越來越密
  trainDepart: {
    gap: 1,
    parts: [
      air(0, 0.3, 0.12),
      { at: 0.2, src: 'wave', table: WAVES.tri, freq: 140, to: 520, curve: 'lin', dur: 1.6, vol: 0.2, shape: 'swell' },
      { at: 0.2, src: 'pulse', duty: 0.125, freq: 280, to: 1040, curve: 'lin', dur: 1.6, vol: 0.04, shape: 'swell' },
      joint(0.55, 0.11),
      joint(1.15, 0.09),
      joint(1.6, 0.075),
    ],
  },
  // 電車到站：馬達聲往下、接縫越來越疏、剎車、放氣
  trainArrive: {
    gap: 1,
    parts: [
      { src: 'wave', table: WAVES.tri, freq: 480, to: 120, curve: 'lin', dur: 1.5, vol: 0.18, shape: 'flat', release: 0.3 },
      joint(0.05, 0.08),
      joint(0.5, 0.1),
      joint(1, 0.13),
      { at: 0.9, src: 'pulse', duty: 0.125, freq: 2350, to: 2200, dur: 0.55, vol: 0.04, shape: 'swell', vib: { rate: 9, cents: 25 } },
      air(1.5, 0.4, 0.12),
    ],
  },
  // 飛機：噴射的低吼慢慢變大變亮
  plane: {
    gap: 1.5,
    parts: [
      { src: 'noise', clock: 8000, clockTo: 22000, dur: 2.4, vol: 0.34, filter: { type: 'lowpass', freq: 380, to: 2400 }, shape: 'swell' },
      { src: 'wave', table: WAVES.tri, freq: 55, to: 98, curve: 'lin', dur: 2.4, vol: 0.16, shape: 'swell' },
      { src: 'pulse', duty: 0.125, freq: 900, to: 1500, dur: 2.2, vol: 0.025, shape: 'swell' },
    ],
  },
  // 巴士：引擎的「ドドド」＋開門放氣
  bus: {
    gap: 1,
    parts: [
      { src: 'noise', clock: 2600, dur: 0.06, vol: 0.32, filter: { type: 'lowpass', freq: 320 }, repeat: { count: 9, every: 0.075 } },
      { src: 'pulse', duty: 0.125, freq: 62, dur: 0.7, vol: 0.1, shape: 'flat', filter: { type: 'lowpass', freq: 400 } },
      air(0.72, 0.35, 0.15),
    ],
  },
  // 渡輪的汽笛：低的一長聲
  ferry: {
    gap: 1.5,
    parts: [
      { src: 'wave', table: WAVES.reed, freq: 'A2', dur: 1.3, vol: 0.3, shape: 'flat', attack: 0.07, release: 0.25, filter: { type: 'lowpass', freq: 900 } },
      { src: 'pulse', duty: 0.5, freq: 'E3', dur: 1.3, vol: 0.08, shape: 'flat', attack: 0.07, release: 0.25, filter: { type: 'lowpass', freq: 700 }, vib: { rate: 3, cents: 6 } },
    ],
  },
  // 存檔完成：往上三聲
  saved: {
    gap: 0.3,
    parts: [
      { src: 'pulse', duty: 0.25, freq: 'E5', dur: 0.06, vol: 0.2 },
      { at: 0.07, src: 'pulse', duty: 0.25, freq: 'A5', dur: 0.06, vol: 0.2 },
      { at: 0.14, src: 'pulse', duty: 0.25, freq: 'E6', dur: 0.2, vol: 0.2 },
    ],
  },
  // 錯誤：低的「ブブッ」
  error: {
    gap: 0.2,
    parts: [
      { src: 'pulse', duty: 0.125, freq: 196, dur: 0.07, vol: 0.28, shape: 'flat', filter: { type: 'lowpass', freq: 2500 } },
      { at: 0.1, src: 'pulse', duty: 0.125, freq: 165, dur: 0.1, vol: 0.28, shape: 'flat', filter: { type: 'lowpass', freq: 2500 } },
    ],
  },
} satisfies Record<string, SfxDef>

export type SfxName = keyof typeof SFX

export const SFX_NAMES = Object.keys(SFX) as SfxName[]

/** 效果音的長度（秒，最後一段結束） */
export function sfxLength(def: SfxDef): number {
  let end = 0
  for (const p of def.parts) end = Math.max(end, (p.at ?? 0) + ((p.repeat?.count ?? 1) - 1) * (p.repeat?.every ?? 0) + p.dur)
  return end
}
