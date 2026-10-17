import { rng } from '../../services/pixelwalk/rng'

import { dist2, type Lab, oklab } from './color'
import type { Img, Rgb } from './types'

/**
 * 用旅人自己的顏色做調色盤（規格 §7：k-means 分 10 色）。在 OKLab 裡分群，
 * 每群的顏色取群裡原本 RGB 的平均（留住 token 的顏色，不會被 OKLab 的來回換算弄髒）。
 * 決定性：抽樣用固定種子的亂數；起點是最常見的顏色，接著每次挑離現有中心最遠的一點（farthest point），不靠 Math.random。
 */

/** 從大圖抽不透明的像素（alpha ≥ minAlpha），最多 cap 個；同一張圖、同一個種子抽到的一樣 */
export function samplePixels(img: Img, cap: number, seed = 1, minAlpha = 230): Rgb[] {
  const d = img.data
  const n = img.width * img.height
  const opaque: number[] = []
  for (let i = 0; i < n; i++) if (d[i * 4 + 3]! >= minAlpha) opaque.push(i)
  let pick = opaque
  if (opaque.length > cap) {
    // 部分洗牌（Fisher–Yates 前 cap 個），再照原本的順序排回去：抽樣跟掃描順序無關
    const r = rng(seed)
    const a = opaque.slice()
    for (let i = 0; i < cap; i++) {
      const j = i + Math.floor(r.next() * (a.length - i))
      const t = a[i]!
      a[i] = a[j]!
      a[j] = t
    }
    pick = a.slice(0, cap).sort((x, y) => x - y)
  }
  return pick.map((i) => [d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!] as Rgb)
}

export interface KmeansOptions {
  /** 最多幾次（預設 14） */
  iters?: number
  /** 中心移動小於這個（OKLab 距離平方）就停 */
  eps?: number
}

/**
 * k-means：回傳最多 k 個顏色，依群的大小由大到小排（同樣大小依 L 由亮到暗）。
 * 顏色種類比 k 少時就少回傳幾個。
 */
export function kmeans(px: readonly Rgb[], k: number, o: KmeansOptions = {}): Rgb[] {
  if (!px.length || k <= 0) return []
  const iters = o.iters ?? 14
  const eps = o.eps ?? 1e-7
  // 同一個顏色只算一次（帶權重）：紙娃娃是平塗的，大部分像素顏色一樣，快很多
  const uniq = new Map<number, { rgb: Rgb; w: number }>()
  for (const c of px) {
    const key = (c[0] << 16) | (c[1] << 8) | c[2]
    const u = uniq.get(key)
    if (u) u.w++
    else uniq.set(key, { rgb: c, w: 1 })
  }
  // 固定順序：依顏色的數值排，跟抽樣順序無關
  const pts = [...uniq.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  const labs = pts.map((p) => oklab(p.rgb))
  // 起點：最常見的顏色
  let first = 0
  for (let i = 1; i < pts.length; i++) if (pts[i]!.w > pts[first]!.w) first = i
  const C: Lab[] = [[...labs[first]!] as Lab]
  const dist = labs.map((l) => dist2(l, C[0]!))
  while (C.length < k) {
    // 離現有中心最遠（乘上權重的平方根：一點點雜色不會搶走一個位置）
    let bi = -1
    let bv = 1e-6
    for (let i = 0; i < pts.length; i++) {
      const v = dist[i]! * Math.sqrt(pts[i]!.w)
      if (v > bv) {
        bv = v
        bi = i
      }
    }
    if (bi < 0 || dist[bi]! < 1e-5) break
    C.push([...labs[bi]!] as Lab)
    for (let i = 0; i < pts.length; i++) dist[i] = Math.min(dist[i]!, dist2(labs[i]!, C[C.length - 1]!))
  }
  const label = new Int32Array(pts.length)
  for (let it = 0; it < iters; it++) {
    const sum = C.map(() => [0, 0, 0, 0])
    for (let i = 0; i < pts.length; i++) {
      let bj = 0
      let bd = Infinity
      for (let j = 0; j < C.length; j++) {
        const dd = dist2(labs[i]!, C[j]!)
        if (dd < bd) {
          bd = dd
          bj = j
        }
      }
      label[i] = bj
      const w = pts[i]!.w
      const s = sum[bj]!
      s[0]! += labs[i]![0] * w
      s[1]! += labs[i]![1] * w
      s[2]! += labs[i]![2] * w
      s[3]! += w
    }
    let moved = 0
    C.forEach((c, j) => {
      const s = sum[j]!
      if (!s[3]) return
      const n: Lab = [s[0]! / s[3], s[1]! / s[3], s[2]! / s[3]]
      moved = Math.max(moved, dist2(n, c))
      c[0] = n[0]
      c[1] = n[1]
      c[2] = n[2]
    })
    if (moved < eps) break
  }
  // 每群的 RGB 平均
  const acc = C.map(() => [0, 0, 0, 0])
  for (let i = 0; i < pts.length; i++) {
    const a = acc[label[i]!]!
    const w = pts[i]!.w
    a[0]! += pts[i]!.rgb[0] * w
    a[1]! += pts[i]!.rgb[1] * w
    a[2]! += pts[i]!.rgb[2] * w
    a[3]! += w
  }
  const out = acc
    .map((a, j) => ({ n: a[3]!, l: C[j]![0], rgb: [Math.round(a[0]! / (a[3] || 1)), Math.round(a[1]! / (a[3] || 1)), Math.round(a[2]! / (a[3] || 1))] as Rgb }))
    .filter((c) => c.n > 0)
  out.sort((a, b) => b.n - a.n || b.l - a.l)
  return out.map((c) => c.rgb)
}
