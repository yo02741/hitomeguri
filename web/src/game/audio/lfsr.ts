/**
 * 雜訊聲道（仿 GBA 第 4 聲道）：15-bit 線性回饋移位暫存器（LFSR）。
 * 每走一步：最低兩位 XOR 當回饋、整個右移、回饋放進第 14 位；短週期模式另外也放進第 6 位，
 * 低 7 位自己成一個 7-bit 的 LFSR。輸出是最低位。
 * 長週期（long）32767 步才重複：沙沙的白雜訊；短週期（short）127 步：帶音高、金屬感的「ジー」。
 */

export type NoiseMode = 'long' | 'short'

/** 起始狀態（不能是 0，0 會一直是 0） */
export const LFSR_SEED = 0x7fff

export function lfsrStep(x: number, mode: NoiseMode): number {
  const bit = (x ^ (x >> 1)) & 1
  let y = (x >> 1) | (bit << 14)
  if (mode === 'short') y = (y & ~0x40) | (bit << 6)
  return y & 0x7fff
}

/** 從 seed 開始走 count 步，每步的輸出位（0／1） */
export function lfsrBits(mode: NoiseMode, count: number, seed = LFSR_SEED): Uint8Array {
  const out = new Uint8Array(count)
  let x = seed
  for (let i = 0; i < count; i++) {
    x = lfsrStep(x, mode)
    out[i] = x & 1
  }
  return out
}

/**
 * 週期：先走一段（短週期模式剛開始高位還不在循環裡），再數走幾步回到同一個狀態。
 * 測試用；超過 65536 步還沒回來就回 0。
 */
export function lfsrPeriod(mode: NoiseMode, seed = LFSR_SEED): number {
  let x = seed
  for (let i = 0; i < 64; i++) x = lfsrStep(x, mode)
  const start = x
  for (let n = 1; n <= 65536; n++) {
    x = lfsrStep(x, mode)
    if (x === start) return n
  }
  return 0
}

/** 一個週期的雜訊樣本（±1，放進 AudioBuffer 循環播）；短週期重複 reps 次免得循環太短 */
export function noiseSamples(mode: NoiseMode, reps = 1): Float32Array<ArrayBuffer> {
  const period = mode === 'long' ? 32767 : 127
  const bits = lfsrBits(mode, period + 64)
  const out = new Float32Array(period * reps)
  // 跳過開頭 64 步（進到循環裡），之後一個週期一個週期接起來剛好無縫
  for (let i = 0; i < out.length; i++) out[i] = bits[64 + (i % period)]! ? 1 : -1
  return out
}
