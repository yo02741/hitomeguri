import { rng } from '../../services/pixelwalk/rng'
import type { Duty } from './tracker'

/**
 * 波形（純函式，測試可以直接算）：
 * - 方波：GBA 第 1、2 聲道的佔空比 12.5／25／50%，用 PeriodicWave 的傅立葉係數做（瀏覽器會依音高去掉會疊頻的高次諧波）。
 * - 波形表：GBA 第 3 聲道，32 格、每格 0–15（4-bit），寫成 32 個 16 進位字；一樣轉成係數，保留階梯的味道。
 * - 撥弦：Karplus–Strong，預先算成一段樣本（三線的感覺）。
 */

export interface Coefficients {
  /** cos 項（第 0 項是直流，留 0） */
  real: Float32Array<ArrayBuffer>
  /** sin 項 */
  imag: Float32Array<ArrayBuffer>
}

/**
 * 等寬階梯波（一個週期 levels.length 段、每段一個值）的傅立葉係數，解析解：
 * a_k = Σ v_j [sin(2πk(j+1)/M) − sin(2πkj/M)] / (πk)、b_k = Σ v_j [cos(2πkj/M) − cos(2πk(j+1)/M)] / (πk)
 */
export function stepWave(levels: readonly number[], harmonics: number): Coefficients {
  const M = levels.length
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let k = 1; k <= harmonics; k++) {
    let a = 0
    let b = 0
    for (let j = 0; j < M; j++) {
      const v = levels[j]!
      const p0 = (2 * Math.PI * k * j) / M
      const p1 = (2 * Math.PI * k * (j + 1)) / M
      a += v * (Math.sin(p1) - Math.sin(p0))
      b += v * (Math.cos(p0) - Math.cos(p1))
    }
    real[k] = a / (Math.PI * k)
    imag[k] = b / (Math.PI * k)
  }
  return { real, imag }
}

/** 係數 → 相位 x（0–1）的值（不含直流；測試用） */
export function evalWave(w: Coefficients, x: number): number {
  let y = 0
  for (let k = 1; k < w.real.length; k++) y += w.real[k]! * Math.cos(2 * Math.PI * k * x) + w.imag[k]! * Math.sin(2 * Math.PI * k * x)
  return y
}

/** 佔空比 → 8 段的高低（GBA 的佔空比都是 1/8 的倍數） */
export function dutyLevels(duty: Duty): number[] {
  const high = Math.round(duty * 8)
  return Array.from({ length: 8 }, (_, i) => (i < high ? 1 : -1))
}

/** 諧波數：48 次對 GBA 的音域夠了（瀏覽器會依音高再濾） */
export const HARMONICS = 48

export const pulseWave = (duty: Duty, harmonics = HARMONICS) => stepWave(dutyLevels(duty), harmonics)

/** 32 個 16 進位字 → 32 個 0–15 */
export function parseTable(hex: string): number[] {
  if (!/^[0-9A-Fa-f]{32}$/.test(hex)) throw new Error(`波形表要 32 個 16 進位字：${hex}`)
  return [...hex].map((ch) => parseInt(ch, 16))
}

/** 波形表 → 係數（0–15 換成 −1…1） */
export const tableWave = (hex: string, harmonics = HARMONICS) =>
  stepWave(
    parseTable(hex).map((v) => (v - 7.5) / 7.5),
    harmonics,
  )

/** 4-bit 量化的正弦（柔的笛聲、墊底） */
export function sineTable(): string {
  return Array.from({ length: 32 }, (_, i) => Math.round(7.5 + 7.5 * Math.sin((2 * Math.PI * i) / 32)).toString(16))
    .join('')
    .toUpperCase()
}

/** 常用的波形表 */
export const WAVES = {
  /** 三角波：溫和的低音 */
  tri: '0123456789ABCDEFFEDCBA9876543210',
  /** 正弦（量化）：笛、墊底 */
  soft: sineTable(),
  /** 一半方一半斜：有點鼻音的汽笛、簧片 */
  reed: 'FFFFEEDDCCBA98765432100000000000',
} as const

export interface PluckOptions {
  /** 每走一圈留下多少（0.99–0.999，越大越長） */
  decay: number
  /** 明亮度（0–1，初始雜訊的低通） */
  bright: number
  /** 算多長（秒） */
  seconds: number
  /** 亂數種子（同一個音每次一樣） */
  seed: number
}

/**
 * Karplus–Strong 撥弦：一段長 N 的雜訊在延遲線裡一圈一圈平均（低通）＋衰減。
 * N 取整數會讓高音走音，所以另外回傳播放速率修正（rate），播的時候乘上去剛好是 freq。
 * 結果最大值正規化到 1，尾巴 5ms 收掉免得爆音。
 */
export function karplusStrong(sampleRate: number, freq: number, o: PluckOptions): { data: Float32Array<ArrayBuffer>; rate: number } {
  const S = 0.5
  const N = Math.max(2, Math.floor(sampleRate / freq - S))
  const len = Math.max(N + 1, Math.floor(sampleRate * o.seconds))
  const out = new Float32Array(len)
  const r = rng(o.seed)
  let lp = 0
  let mean = 0
  for (let i = 0; i < N; i++) {
    lp += o.bright * (r.next() * 2 - 1 - lp)
    out[i] = lp
    mean += lp
  }
  mean /= N
  for (let i = 0; i < N; i++) out[i]! -= mean
  for (let n = N; n < len; n++) out[n] = o.decay * ((1 - S) * out[n - N]! + S * (n - N - 1 >= 0 ? out[n - N - 1]! : 0))
  let peak = 0
  for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(out[n]!))
  const fade = Math.min(len, Math.floor(sampleRate * 0.005))
  for (let n = 0; n < len; n++) {
    out[n] = peak > 0 ? out[n]! / peak : 0
    const left = len - n
    if (left <= fade) out[n]! *= left / fade
  }
  return { data: out, rate: (freq * (N + S)) / sampleRate }
}
