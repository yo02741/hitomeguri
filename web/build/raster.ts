import { deflateSync } from 'node:zlib'

// 建置時畫圖示用的小型點陣化（build/icons.ts）：不另外裝影像套件。
// 每個圖形先算出每個像素被蓋住的比例（覆蓋率，邊緣抗鋸齒），再用 source-over 疊上去；
// 和瀏覽器畫 SVG 一樣在 sRGB 數值上混色。畫布存 premultiplied 的 RGB（0–255）與 alpha（0–1）。

export type Rgb = readonly [number, number, number]

/** '#rrggbb' → [r, g, b]；what 用在錯誤訊息 */
export function hex(c: string | undefined, what: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c ?? '')
  if (!m) throw new Error(`icons：${what} 不是 #rrggbb（${c}）`)
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
}

const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v)

/** 字形放到畫面上的位置：x' = x·k + tx、y' = y·k + ty */
export interface Transform {
  k: number
  tx: number
  ty: number
}

interface Edge {
  /** 上端（y 較小）的 y 與 x、下端的 y */
  ya: number
  xa: number
  yb: number
  /** dx / dy */
  slope: number
  /** 原本的方向：往下 +1、往上 -1（nonzero 規則） */
  dir: number
}

/** SVG path 的 d（只有絕對座標的 M、L、Q、C、Z，opentype.js toPathData 的輸出）→ 畫面座標的折線 */
export function flattenPath(d: string, t: Transform): [number, number][][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const polys: [number, number][][] = []
  let cur: [number, number][] = []
  let i = 0
  const num = () => {
    const v = Number(tokens[i++])
    if (!Number.isFinite(v)) throw new Error(`raster：path 的數字不對（${tokens[i - 1]}）`)
    return v
  }
  const pt = (): [number, number] => {
    const x = num()
    const y = num()
    return [x * t.k + t.tx, y * t.k + t.ty]
  }
  const last = (): [number, number] => cur[cur.length - 1] ?? [0, 0]
  // 曲線切成直線段：每段約 1px 以下
  const steps = (...p: [number, number][]) => {
    let len = 0
    for (let j = 1; j < p.length; j++) len += Math.hypot(p[j]![0] - p[j - 1]![0], p[j]![1] - p[j - 1]![1])
    return Math.min(128, Math.max(2, Math.ceil(len)))
  }
  let cmd = ''
  while (i < tokens.length) {
    const tok = tokens[i]!
    if (/^[A-Za-z]$/.test(tok)) {
      cmd = tok
      i++
      if (cmd === 'Z' || cmd === 'z') {
        if (cur.length) polys.push(cur)
        cur = []
        continue
      }
      if (cmd !== cmd.toUpperCase()) throw new Error(`raster：只支援絕對座標的指令（${cmd}）`)
    }
    if (cmd === 'M') {
      if (cur.length) polys.push(cur)
      cur = [pt()]
      cmd = 'L' // M 後面接的座標是 L
    } else if (cmd === 'L') {
      cur.push(pt())
    } else if (cmd === 'Q') {
      const p0 = last()
      const p1 = pt()
      const p2 = pt()
      const n = steps(p0, p1, p2)
      for (let s = 1; s <= n; s++) {
        const u = s / n
        const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u
        cur.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]])
      }
    } else if (cmd === 'C') {
      const p0 = last()
      const p1 = pt()
      const p2 = pt()
      const p3 = pt()
      const n = steps(p0, p1, p2, p3)
      for (let s = 1; s <= n; s++) {
        const u = s / n
        const v = 1 - u
        const a = v * v * v, b = 3 * u * v * v, c = 3 * u * u * v, e = u * u * u
        cur.push([
          a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
          a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
        ])
      }
    } else {
      throw new Error(`raster：不支援的 path 指令（${cmd || tok}）`)
    }
  }
  if (cur.length) polys.push(cur)
  return polys
}

/** 點陣畫布：size × size，一開始全透明 */
export class Canvas {
  readonly size: number
  /** premultiplied：r、g、b（0–255）、a（0–1） */
  readonly px: Float32Array

  constructor(size: number) {
    this.size = size
    this.px = new Float32Array(size * size * 4)
  }

  /** 在像素 (x, y) 疊上顏色 rgb，覆蓋率 a */
  blend(x: number, y: number, rgb: Rgb, a: number): void {
    if (a <= 0 || x < 0 || y < 0 || x >= this.size || y >= this.size) return
    const k = (y * this.size + x) * 4
    const px = this.px
    px[k] = rgb[0] * a + px[k]! * (1 - a)
    px[k + 1] = rgb[1] * a + px[k + 1]! * (1 - a)
    px[k + 2] = rgb[2] * a + px[k + 2]! * (1 - a)
    px[k + 3] = a + px[k + 3]! * (1 - a)
  }

  /** 整張填色 */
  fill(rgb: Rgb): void {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) this.blend(x, y, rgb, 1)
  }

  /** 圓角矩形（覆蓋率用到邊界的距離算） */
  roundRect(x: number, y: number, w: number, h: number, r: number, rgb: Rgb): void {
    const cx = x + w / 2, cy = y + h / 2
    for (let py = Math.floor(y); py < Math.ceil(y + h); py++)
      for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
        const qx = Math.abs(px + 0.5 - cx) - (w / 2 - r)
        const qy = Math.abs(py + 0.5 - cy) - (h / 2 - r)
        const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
        this.blend(px, py, rgb, clamp01(0.5 - sd))
      }
  }

  /** 實心圓 */
  circle(cx: number, cy: number, r: number, rgb: Rgb): void {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
        this.blend(x, y, rgb, clamp01(r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)))
  }

  /** 圓周的線（線寬 width，置中在半徑 r 上） */
  ring(cx: number, cy: number, r: number, width: number, rgb: Rgb): void {
    const half = width / 2
    for (let y = Math.floor(cy - r - half - 1); y <= Math.ceil(cy + r + half + 1); y++)
      for (let x = Math.floor(cx - r - half - 1); x <= Math.ceil(cx + r + half + 1); x++)
        this.blend(x, y, rgb, clamp01(half + 0.5 - Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r)))
  }

  /** 等寬色段橫排成一條（各段之間不留縫：像素顏色是蓋到的各段依面積平均） */
  band(x: number, y: number, w: number, h: number, colors: readonly Rgb[]): void {
    const n = colors.length
    for (let px = Math.floor(x); px < Math.ceil(x + w); px++) {
      let tot = 0
      const sum = [0, 0, 0]
      colors.forEach((c, i) => {
        const ov = Math.min(px + 1, x + (w * (i + 1)) / n) - Math.max(px, x + (w * i) / n)
        if (ov <= 0) return
        tot += ov
        for (let j = 0; j < 3; j++) sum[j]! += c[j]! * ov
      })
      if (tot <= 0) continue
      const rgb: Rgb = [sum[0]! / tot, sum[1]! / tot, sum[2]! / tot]
      for (let py = Math.floor(y); py < Math.ceil(y + h); py++) {
        const ov = Math.min(py + 1, y + h) - Math.max(py, y)
        this.blend(px, py, rgb, clamp01(tot) * clamp01(ov))
      }
    }
  }

  /** 填滿 path（nonzero 規則）：每列取 16 條掃描線，每條線上的水平覆蓋算到小數 */
  path(d: string, t: Transform, rgb: Rgb): void {
    const edges: Edge[] = []
    for (const poly of flattenPath(d, t)) {
      for (let j = 0; j < poly.length; j++) {
        const [x0, y0] = poly[j]!
        const [x1, y1] = poly[(j + 1) % poly.length]!
        if (y0 === y1) continue
        const down = y1 > y0
        const ya = down ? y0 : y1
        edges.push({ ya, xa: down ? x0 : x1, yb: down ? y1 : y0, slope: (x1 - x0) / (y1 - y0), dir: down ? 1 : -1 })
      }
    }
    if (!edges.length) return
    const SS = 16
    const size = this.size
    const cov = new Float32Array(size + 1)
    const top = Math.max(0, Math.floor(Math.min(...edges.map((e) => e.ya))))
    const bottom = Math.min(size, Math.ceil(Math.max(...edges.map((e) => e.yb))))
    const span = (a: number, b: number, w: number) => {
      a = Math.max(0, a)
      b = Math.min(size, b)
      if (b <= a) return
      const ia = Math.floor(a), ib = Math.floor(b)
      if (ia === ib) {
        cov[ia]! += (b - a) * w
        return
      }
      cov[ia]! += (ia + 1 - a) * w
      for (let k = ia + 1; k < ib; k++) cov[k]! += w
      cov[ib]! += (b - ib) * w
    }
    for (let row = top; row < bottom; row++) {
      const active = edges.filter((e) => e.yb > row && e.ya < row + 1)
      if (!active.length) continue
      cov.fill(0)
      for (let s = 0; s < SS; s++) {
        const sy = row + (s + 0.5) / SS
        const xs: { x: number; dir: number }[] = []
        for (const e of active) if (sy >= e.ya && sy < e.yb) xs.push({ x: e.xa + (sy - e.ya) * e.slope, dir: e.dir })
        xs.sort((p, q) => p.x - q.x)
        let wind = 0
        for (let j = 0; j < xs.length - 1; j++) {
          wind += xs[j]!.dir
          if (wind !== 0) span(xs[j]!.x, xs[j + 1]!.x, 1 / SS)
        }
      }
      for (let x = 0; x < size; x++) if (cov[x]! > 0) this.blend(x, row, rgb, clamp01(cov[x]!))
    }
  }

  /**
   * 紙紋：每個像素疊一層黑色、alpha = amount × 雜訊（平均 0.5）。
   * 和 SVG 的 feTurbulence（fractalNoise）＋ feColorMatrix 只留 alpha 的做法相近，雜訊固定（同樣的輸入畫出同一張圖）。
   */
  grain(amount: number): void {
    const black: Rgb = [0, 0, 0]
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        let u = 0
        for (let j = 0; j < 4; j++) u += hash(x, y, j)
        this.blend(x, y, black, amount * clamp01(0.5 + (u / 4 - 0.5) * 0.85))
      }
  }

  /** 讀一個像素（straight RGBA，0–255），測試用 */
  rgba(x: number, y: number): [number, number, number, number] {
    const k = (y * this.size + x) * 4
    const a = this.px[k + 3]!
    if (a <= 0) return [0, 0, 0, 0]
    return [
      Math.round(this.px[k]! / a),
      Math.round(this.px[k + 1]! / a),
      Math.round(this.px[k + 2]! / a),
      Math.round(a * 255),
    ]
  }

  /** 編成 PNG：全部不透明時存 RGB，否則 RGBA */
  toPng(): Buffer {
    const n = this.size * this.size
    let opaque = true
    for (let i = 0; i < n; i++) if (Math.round(this.px[i * 4 + 3]! * 255) < 255) opaque = false
    const ch = opaque ? 3 : 4
    const out = new Uint8Array(n * ch)
    for (let i = 0; i < n; i++) {
      const a = this.px[i * 4 + 3]!
      for (let j = 0; j < 3; j++) out[i * ch + j] = a > 0 ? Math.min(255, Math.round(this.px[i * 4 + j]! / a)) : 0
      if (!opaque) out[i * ch + 3] = Math.round(a * 255)
    }
    return encodePng(this.size, out, ch)
  }
}

/** 0–1 的固定雜訊 */
function hash(x: number, y: number, i: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(i + 1, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  out.set(data, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/**
 * 8-bit RGB（ch 3）或 RGBA（ch 4）的 PNG（https://www.w3.org/TR/png-3/）。
 * 每列試五種 filter，取差值絕對值總和最小的（PNG 規格建議的做法），平的底色壓得比較小。
 */
export function encodePng(size: number, pixels: Uint8Array, ch: 3 | 4): Buffer {
  const stride = size * ch
  const raw = Buffer.alloc((stride + 1) * size)
  const cand = Array.from({ length: 5 }, () => new Uint8Array(stride))
  for (let y = 0; y < size; y++) {
    const line = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : new Uint8Array(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch]! : 0
      const b = prev[i]!
      const c = i >= ch ? prev[i - ch]! : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      const v = line[i]!
      cand[0]![i] = v
      cand[1]![i] = (v - a) & 0xff
      cand[2]![i] = (v - b) & 0xff
      cand[3]![i] = (v - ((a + b) >> 1)) & 0xff
      cand[4]![i] = (v - paeth) & 0xff
    }
    let best = 0
    let bestSum = Infinity
    cand.forEach((row, f) => {
      let s = 0
      for (const v of row) s += v < 128 ? v : 256 - v
      if (s < bestSum) {
        bestSum = s
        best = f
      }
    })
    raw[y * (stride + 1)] = best
    raw.set(cand[best]!, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, ch === 3 ? 2 : 6, 0, 0, 0], 8) // bit depth 8、color type 2（RGB）或 6（RGBA）
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ])
}
