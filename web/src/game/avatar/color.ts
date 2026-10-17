import type { Rgb } from './types'

/**
 * 顏色的小工具：OKLab（感知上均勻的色彩空間，k-means 與「兩個顏色像不像」都在這裡算）、加深一階。
 * 旅人的顏色來自旅人自己的 SVG（--color-doll-*、--color-item-* 解析後的 RGB），這裡只做運算。
 */
export type Lab = [number, number, number]

const s2l = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const l2s = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(c * 255)))
}

/** sRGB → OKLab（Björn Ottosson 的係數） */
export function oklab([r, g, b]: Rgb): Lab {
  const R = s2l(r)
  const G = s2l(g)
  const B = s2l(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab 距離的平方 */
export const dist2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/** ΔE（OKLab 的歐氏距離）：0.02 以下幾乎看不出來，0.1 左右是明顯不同的同色系 */
export const deltaE = (a: Rgb, b: Rgb) => Math.sqrt(dist2(oklab(a), oklab(b)))

/** 加深一階：線性亮度乘 k（預設一半）再換回 sRGB（陰影、圖層交界） */
export function shade(rgb: Rgb, k = 0.5): Rgb {
  return [l2s(s2l(rgb[0]) * k), l2s(s2l(rgb[1]) * k), l2s(s2l(rgb[2]) * k)]
}

/** 調色盤裡最接近的顏色（OKLab） */
export function nearest(labs: readonly Lab[], c: Lab): number {
  let best = 0
  let bd = Infinity
  for (let j = 0; j < labs.length; j++) {
    const d = dist2(c, labs[j]!)
    if (d < bd) {
      bd = d
      best = j
    }
  }
  return best
}
