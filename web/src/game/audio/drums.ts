import type { NoiseMode } from './lfsr'

/**
 * 打擊的音色表。tracker 裡打擊聲道寫一個字母（例 `h`、`D`），這裡查是什麼聲音。
 * 雜訊（noise 聲道）用 LFSR 雜訊＋濾波；太鼓（taiko 聲道）是正弦往下掃（鼓身）＋一小段雜訊（鼓皮）。
 */

export interface NoiseHit {
  /** 哪一種 LFSR */
  mode: NoiseMode
  /** LFSR 一秒走幾步（越低越粗） */
  clock: number
  /** 長度（秒） */
  dur: number
  /** 音量（乘上這一軌的 vol） */
  vol: number
  filter: { type: 'highpass' | 'bandpass' | 'lowpass'; freq: number; q?: number }
  /** 隔這麼久（秒）再一下：拍板的「喀嚓」 */
  flam?: number
}

export interface TaikoHit {
  /** 鼓身：正弦從 from Hz 掃到 to Hz */
  from: number
  to: number
  dur: number
  vol: number
  /** 鼓皮雜訊的比例 */
  skin: number
  /** 打鼓邊（「カッ」）：雜訊改高通、短 */
  rim?: boolean
}

export const NOISE_HITS: Record<string, NoiseHit> = {
  // 閉合的鈸
  h: { mode: 'long', clock: 48000, dur: 0.035, vol: 0.2, filter: { type: 'highpass', freq: 7000 } },
  // 打開的鈸
  o: { mode: 'long', clock: 48000, dur: 0.16, vol: 0.14, filter: { type: 'highpass', freq: 5500 } },
  // 小鼓
  s: { mode: 'long', clock: 18000, dur: 0.11, vol: 0.3, filter: { type: 'bandpass', freq: 1900, q: 0.8 } },
  // 木魚、拍子木一類的「コッ」（短週期，帶一點音高）
  t: { mode: 'short', clock: 26000, dur: 0.03, vol: 0.3, filter: { type: 'bandpass', freq: 2600, q: 4 } },
  // 拍板（三板）的「カチャ」
  c: { mode: 'long', clock: 40000, dur: 0.03, vol: 0.24, filter: { type: 'bandpass', freq: 3600, q: 2.5 }, flam: 0.018 },
}

export const TAIKO_HITS: Record<string, TaikoHit> = {
  // 大的「ドン」
  D: { from: 150, to: 58, dur: 0.5, vol: 0.9, skin: 0.35 },
  // 小的「ドン」
  d: { from: 170, to: 80, dur: 0.3, vol: 0.55, skin: 0.25 },
  // 鼓邊「カッ」
  K: { from: 1100, to: 820, dur: 0.05, vol: 0.32, skin: 0.6, rim: true },
  // 輕的「カッ」
  k: { from: 1000, to: 780, dur: 0.04, vol: 0.2, skin: 0.45, rim: true },
}
