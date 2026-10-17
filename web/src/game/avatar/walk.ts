import type { Raster } from './types'

/**
 * 走路的格子（規格 §7）：都在還沒描外框的點陣上做，做完再描。
 * - 正面、背面：站、左步、右步。邁步時整個身體上移 1px，著地的那隻腳（另一半）留在原地，看起來被拉長 1px；
 *   抬起的腳跟著身體上去，所以比著地的腳高 1px。
 * - 側面：站、邁步。邁步時腿以上上移 1px，腿留在原地；最下面 3 列（腳）以腿的中心為界，前後各張開 1px。
 */

/** 整張往上移 1px */
function shiftUp(r: Raster): Int16Array {
  const { w, h, raw } = r
  const out = new Int16Array(raw.length).fill(-1)
  for (let y = 1; y < h; y++) out.set(raw.subarray(y * w, (y + 1) * w), (y - 1) * w)
  return out
}

/** 正面、背面：[站, 左步, 右步]。legTop 是腿開始的那一列；左步抬起畫面左半邊的腳 */
export function walkFrontBack(r: Raster, legTop: number): [Raster, Raster, Raster] {
  const { w, h, raw } = r
  const cx = w / 2
  const step = (liftLeft: boolean): Raster => {
    const up = shiftUp(r)
    for (let y = Math.max(0, legTop); y < h; y++)
      for (let x = 0; x < w; x++) {
        if (x < cx === liftLeft) continue
        up[y * w + x] = raw[y * w + x]!
      }
    return { w, h, raw: up }
  }
  return [r, step(true), step(false)]
}

/** 側面：[站, 邁步] */
export function walkSide(r: Raster, legTop: number): [Raster, Raster] {
  const { w, h, raw } = r
  // 腿的中心：腿那幾列不透明像素的平均 x
  let sx = 0
  let n = 0
  for (let y = Math.max(0, legTop); y < h; y++)
    for (let x = 0; x < w; x++)
      if (raw[y * w + x]! >= 0) {
        sx += x
        n++
      }
  const cx = n ? sx / n : w / 2
  const up = shiftUp(r)
  for (let y = Math.max(0, legTop); y < h; y++) {
    up.fill(-1, y * w, (y + 1) * w)
    const k = y >= h - 3 ? 1 : 0
    for (let x = 0; x < w; x++) {
      const v = raw[y * w + x]!
      if (v < 0) continue
      const nx = k === 0 ? x : x < cx ? x - k : x + k
      if (nx >= 0 && nx < w) up[y * w + nx] = v
    }
  }
  return [r, { w, h, raw: up }]
}

/** 眨眼：眼睛那幾格換成 lid（皮膚的深一階） */
export function blink(r: Raster, eyes: readonly number[], lid: number): Raster {
  const raw = r.raw.slice()
  for (const i of eyes) if (raw[i]! >= 0) raw[i] = lid
  return { w: r.w, h: r.h, raw }
}
