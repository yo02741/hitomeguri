import { type Lab, nearest, oklab, shade, dist2 } from './color'
import type { Img, Raster, Rgb, RgbFrame } from './types'

/**
 * 大圖 → 點陣的每一步（規格 §7），都是純函式：
 * 1. majority：每格 F×F 個細格各自取最近的調色盤色，再多數決（深色加權，細線、眼睛、外框不會被淺色吃掉）。
 * 2. outline：透明的格子旁邊有東西就描 1px 墨色。
 * 3. stampEyes：眼睛看得到的格子蓋成墨色（帽子、面具擋住的地方照實不畫）。
 * 4. cleanOrphans：孤立的單一像素（四鄰沒有同色、而且有三個鄰居是同一種別的顏色）換成鄰居的顏色。
 * 5. layer ids：每格屬於哪一層（後髮、身體、臉、瀏海、臉上的、頭上的、手上的），edgeShade 用。
 * 6. edgeShade：不同圖層相鄰、顏色又很像（ΔE(OKLab) < 0.11）時，後面那格加深一階，帽子與臉、面具與頭髮才分得開。
 */

/** OKLab 的 L 低於這個算深色：多數決時加權 */
const DARK_L = 0.36

/**
 * 多數決縮小：img 是 (w·F)×(h·F) 的大圖，回傳 w×h 的點陣（-1 透明）。
 * 一格的不透明度（細格 alpha 的平均）不到一半就是透明。
 */
export function majority(img: Img, w: number, h: number, F: number, pal: readonly Rgb[], darkBoost = 2.5): Raster {
  const labs = pal.map(oklab)
  const weight = labs.map((l) => (l[0] < DARK_L ? darkBoost : 1))
  const memo = new Map<number, number>()
  const near = (r: number, g: number, b: number) => {
    const key = (r << 16) | (g << 8) | b
    let v = memo.get(key)
    if (v === undefined) {
      v = nearest(labs, oklab([r, g, b]))
      memo.set(key, v)
    }
    return v
  }
  const W2 = img.width
  const d = img.data
  const raw = new Int16Array(w * h).fill(-1)
  const votes = new Float32Array(pal.length)
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++) {
      votes.fill(0)
      let a = 0
      for (let yy = 0; yy < F; yy++) {
        const row = (cy * F + yy) * W2
        for (let xx = 0; xx < F; xx++) {
          const i = (row + cx * F + xx) * 4
          const al = d[i + 3]! / 255
          if (!al) continue
          a += al
          if (al > 0.5) votes[near(d[i]!, d[i + 1]!, d[i + 2]!)]! += al
        }
      }
      if (a / (F * F) < 0.5) continue
      let bj = -1
      let bv = 0
      for (let j = 0; j < pal.length; j++) {
        const v = votes[j]! * weight[j]!
        if (v > bv) {
          bv = v
          bj = j
        }
      }
      if (bj >= 0) raw[cy * w + cx] = bj
    }
  return { w, h, raw }
}

/** 外框：透明、而且上下左右有東西的格子描成 ink */
export function outline(r: Raster, ink: number): Int16Array {
  const { w, h, raw } = r
  const out = raw.slice()
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (raw[y * w + x]! >= 0) continue
      const on = (dx: number, dy: number) => {
        const X = x + dx
        const Y = y + dy
        return X >= 0 && Y >= 0 && X < w && Y < h && raw[Y * w + X]! >= 0
      }
      if (on(1, 0) || on(-1, 0) || on(0, 1) || on(0, -1)) out[y * w + x] = ink
    }
  return out
}

/**
 * 眼睛：cov 是每格「看得到眼睛」的細格比例。左右兩半各自：比例 ≥ 0.22 的格子都蓋，
 * 一格都沒有就蓋最多的那一格（> 0.06 才算看得到）。回傳新的點陣與「蓋過的格子」（清理時不動）。
 */
export function stampEyes(r: Raster, cov: Float32Array, ink: number): { raster: Raster; fixed: Uint8Array } {
  const { w, h } = r
  const raw = r.raw.slice()
  const fixed = new Uint8Array(w * h)
  for (const half of [0, 1]) {
    let best = -1
    let bv = 0
    const picks: number[] = []
    for (let i = 0; i < cov.length; i++) {
      const x = i % w
      if ((x < w / 2 ? 0 : 1) !== half) continue
      if (cov[i]! > bv) {
        bv = cov[i]!
        best = i
      }
      if (cov[i]! >= 0.22) picks.push(i)
    }
    if (!picks.length && bv > 0.06) picks.push(best)
    for (const i of picks)
      if (raw[i]! >= 0) {
        raw[i] = ink
        fixed[i] = 1
      }
  }
  return { raster: { w, h, raw }, fixed }
}

/** 孤立的像素：四鄰沒有同色，而且有 ≥3 個鄰居是同一種（不是墨色的）顏色 → 換成那個顏色 */
export function cleanOrphans(r: Raster, ink: number, fixed?: Uint8Array): Raster {
  const { w, h } = r
  const src = r.raw
  const raw = src.slice()
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const v = src[i]!
      if (v < 0 || v === ink || fixed?.[i]) continue
      const nb = [src[i - 1]!, src[i + 1]!, src[i - w]!, src[i + w]!]
      if (nb.includes(v)) continue
      const cnt = new Map<number, number>()
      for (const n of nb) if (n >= 0 && n !== ink) cnt.set(n, (cnt.get(n) ?? 0) + 1)
      for (const [n, k] of cnt) if (k >= 3) raw[i] = n
    }
  return { w, h, raw }
}

/**
 * 側面（3D 轉過來）身體那幾列（y0 ≤ y < y1）的縫：1 格寬、往下連 3 格以上的雜色直線（袖子外框轉過來變成的），
 * 換成那幾列衣服佔大宗的顏色裡最接近的；左右都是皮膚的那一格換成皮膚（手不被縫切成兩半）。
 * keep 裡的顏色（衣服、皮膚、下身、外框、頭髮、手上的東西）不動；腰帶這種橫的色塊不是 1 格寬，也不動。
 */
export function cleanSeams(r: Raster, y0: number, y1: number, keep: ReadonlySet<number>, pal: readonly Rgb[], skin: number): Raster {
  const { w, h, raw } = r
  const top = Math.max(0, y0)
  const end = Math.min(h, y1)
  const at = (x: number, y: number) => (x < 0 || x >= w || y < 0 || y >= h ? -1 : raw[y * w + x]!)
  // 那幾列衣服佔大宗的顏色（≥ 20%，皮膚、外框不算）
  const cnt = new Map<number, number>()
  let total = 0
  for (let y = top; y < end; y++)
    for (let x = 0; x < w; x++) {
      const v = at(x, y)
      if (v < 0 || v === skin) continue
      cnt.set(v, (cnt.get(v) ?? 0) + 1)
      total++
    }
  const main = [...cnt].filter(([, n]) => n >= total * 0.2).map(([v]) => v)
  if (!main.length) return r
  const labs = new Map(main.map((v) => [v, oklab(pal[v]!)]))
  const nearestMain = (c: number) => {
    const l = oklab(pal[c]!)
    let best = main[0]!
    let bd = Infinity
    for (const [v, m] of labs) {
      const d = dist2(l, m)
      if (d < bd) {
        bd = d
        best = v
      }
    }
    return best
  }
  const out = raw.slice()
  const thin = (x: number, y: number, c: number) => at(x, y) === c && at(x - 1, y) !== c && at(x + 1, y) !== c
  for (let x = 0; x < w; x++) {
    let y = top
    while (y < end) {
      const c = at(x, y)
      if (c < 0 || keep.has(c) || main.includes(c) || !thin(x, y, c)) {
        y++
        continue
      }
      let e = y
      while (e < end && thin(x, e, c)) e++
      if (e - y >= 3) for (let yy = y; yy < e; yy++) out[yy * w + x] = at(x - 1, yy) === skin && at(x + 1, yy) === skin ? skin : nearestMain(c)
      y = e
    }
  }
  return { w, h, raw: out }
}

// ---------- 圖層 ----------
/**
 * 圖層 id（畫圖層那一趟，每層整片塗成一個代碼色）：1 後髮、2 身體、3 臉、4 瀏海、5 臉上的、6 頭上的、7 側戴的面具、8 手上的、9 眼睛。
 * 代碼：R = 28k、G = 255 − 28k、B = 奇數 255／偶數 0。兩層交界的反鋸齒會混出中間值，B 對不上就不算。
 */
export const LAYER = { hairBack: 1, body: 2, skin: 3, hairFront: 4, face: 5, hat: 6, faceOver: 7, hand: 8, eyes: 9 } as const
export const LAYER_COUNT = 9
export const layerCode = (k: number): Rgb => [28 * k, 255 - 28 * k, k % 2 ? 255 : 0]

/** 每格的圖層（細格多數決，-1 沒有）與眼睛的覆蓋比例 */
export function layerMap(img: Img, w: number, h: number, F: number): { ids: Int8Array; eyes: Float32Array } {
  const ids = new Int8Array(w * h).fill(-1)
  const eyes = new Float32Array(w * h)
  const W2 = img.width
  const d = img.data
  const votes = new Int32Array(LAYER_COUNT + 1)
  for (let cy = 0; cy < h; cy++)
    for (let cx = 0; cx < w; cx++) {
      votes.fill(0)
      for (let yy = 0; yy < F; yy++)
        for (let xx = 0; xx < F; xx++) {
          const i = ((cy * F + yy) * W2 + cx * F + xx) * 4
          if (d[i + 3]! < 150) continue
          const k = decodeLayer(d[i]!, d[i + 1]!, d[i + 2]!)
          if (k > 0) votes[k]!++
        }
      // 眼睛算在臉那一層（眼睛本身會蓋成墨色，不參加交界的加深）
      eyes[cy * w + cx] = votes[LAYER.eyes]! / (F * F)
      votes[LAYER.skin]! += votes[LAYER.eyes]!
      let bk = -1
      let bv = 0
      for (let k = 1; k < LAYER_COUNT; k++)
        if (votes[k]! > bv) {
          bv = votes[k]!
          bk = k
        }
      ids[cy * w + cx] = bk
    }
  return { ids, eyes }
}

export function decodeLayer(r: number, g: number, b: number): number {
  const k = Math.round(r / 28)
  if (k < 1 || k > LAYER_COUNT) return 0
  const [R, G, B] = layerCode(k)
  return Math.abs(r - R) < 8 && Math.abs(g - G) < 8 && Math.abs(b - B) < 40 ? k : 0
}

/** 交界加深用的分組：同一組的相鄰不算交界（後髮與瀏海、臉上的兩層） */
const GROUP: Record<number, string> = { 1: 'hair', 4: 'hair', 2: 'body', 3: 'skin', 9: 'skin', 5: 'face', 7: 'face', 6: 'hat', 8: 'hand' }
/** 圖層由後到前的順序（手上的放在頭後面時，8 排在 2 後面） */
export const ORDER_FRONT = [1, 2, 3, 9, 4, 5, 6, 7, 8]
export const ORDER_HAND_BEHIND = [1, 2, 8, 3, 9, 4, 5, 6, 7]

/**
 * 圖層交界加深：上下左右相鄰的兩格屬於不同組、顏色 ΔE < T 時，後面那一格換成自己顏色的深一階。
 * 深一階的顏色如果調色盤裡已經有很接近的就用那個，不然加進調色盤（pal 會被改，回傳新的長度）。
 */
export function edgeShade(r: Raster, ids: Int8Array, pal: Rgb[], order: readonly number[], ink: number, T = 0.11): Raster {
  const { w, h } = r
  const src = r.raw
  const raw = src.slice()
  const z = new Map(order.map((k, i) => [k, i]))
  const labs: Lab[] = pal.map(oklab)
  const shadeOf = new Map<number, number>()
  const shadeIdx = (v: number) => {
    let s = shadeOf.get(v)
    if (s === undefined) {
      s = addShade(pal, v)
      shadeOf.set(v, s)
    }
    return s
  }
  const T2 = T * T
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const a = src[i]!
      if (a < 0 || a === ink || ids[i]! < 0) continue
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ] as const) {
        const X = x + dx
        const Y = y + dy
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue
        const j = Y * w + X
        const b = src[j]!
        if (b < 0 || b === ink || ids[j]! < 0 || GROUP[ids[i]!] === GROUP[ids[j]!]) continue
        if (dist2(labs[a]!, labs[b]!) > T2) continue
        // i 在 j 後面 → i 加深
        if ((z.get(ids[i]!) ?? 0) < (z.get(ids[j]!) ?? 0)) {
          raw[i] = shadeIdx(a)
          break
        }
      }
    }
  return { w, h, raw }
}

/**
 * pal[v] 深一階的顏色在調色盤的哪裡：已經有很接近的（OKLab 距離 < 0.05）就用那個，不然加在最後面。
 * k 是線性亮度的倍率（0.5 一階；0.75 半階，皮膚的眼皮、衣服背光面）
 */
export function addShade(pal: Rgb[], v: number, k = 0.5): number {
  const rgb = shade(pal[v]!, k)
  const l = oklab(rgb)
  let bj = -1
  let bd = 0.0025
  pal.forEach((q, j) => {
    const dd = dist2(l, oklab(q))
    if (dd < bd) {
      bd = dd
      bj = j
    }
  })
  if (bj >= 0) return bj
  pal.push(rgb)
  return pal.length - 1
}

// ---------- 小工具 ----------
/** 左右翻 */
export function mirror(r: Raster): Raster {
  const { w, h, raw } = r
  const out = new Int16Array(raw.length)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = raw[y * w + (w - 1 - x)]!
  return { w, h, raw: out }
}

/** 最上面有東西的一列（沒有就是 h） */
export function topRow(raw: Int16Array | Uint8Array, w: number, h: number, empty = -1): number {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (raw[y * w + x] !== empty) return y
  return h
}

/** 用到幾種顏色 */
export const colorCount = (raw: Int16Array) => new Set([...raw].filter((v) => v >= 0)).size

/** 點陣（已描外框）→ RgbSprite：idx 1 起算；調色盤共用同一個陣列（存檔時一起複製） */
export function toFrame(w: number, h: number, raw: Int16Array, pal: Rgb[]): RgbFrame {
  const idx = new Uint8Array(w * h)
  for (let i = 0; i < raw.length; i++) idx[i] = raw[i]! < 0 ? 0 : raw[i]! + 1
  return { w, h, idx, rgb: pal }
}

/** 調色盤裡最接近某個顏色的（皮膚、頭髮） */
export function nearestIndex(pal: readonly Rgb[], c: Rgb): number {
  return nearest(pal.map(oklab), oklab(c))
}

/** 某些格子（cells）裡最常見的顏色索引（-1 沒有） */
export function dominant(raw: Int16Array, cells: Iterable<number>, skip: ReadonlySet<number> = new Set()): number {
  const cnt = new Map<number, number>()
  for (const i of cells) {
    const v = raw[i]!
    if (v < 0 || skip.has(v)) continue
    cnt.set(v, (cnt.get(v) ?? 0) + 1)
  }
  let best = -1
  let bn = 0
  for (const [v, n] of cnt)
    if (n > bn) {
      bn = n
      best = v
    }
  return best
}
