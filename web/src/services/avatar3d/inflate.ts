import { BufferGeometry, Float32BufferAttribute } from 'three'

import type { ViewBox } from './raster'

/**
 * 3D 旅人（DESIGN.md §7.24a）：把 2D 剪影「充氣」成有厚度的形狀。
 * 剪影取自點陣的 alpha；每一點離邊緣多遠（距離場）決定鼓多高：h = bulge × √d，邊緣是 0、越往中間越厚，
 * 剖面是圓的，像布偶或軟膠公仔。前後兩面的基準 z 由 base() 決定（平面、或貼著頭的球面）。
 * 網格比美術多出一格，邊緣交給貼圖的 alpha 裁（alphaTest），輪廓才會跟原本的線一樣乾淨。
 */

/** 紙娃娃座標（240×320 的畫布，單位 px）換成 3D：頭的半徑 54px ≈ 1，腳底（y 280）在 0 */
export const PX = 1 / 54
export const worldX = (x: number) => (x - 120) * PX
export const worldY = (y: number) => (280 - y) * PX

export interface Surface {
  /** 這一點正面、背面的基準 z（紙娃娃 px）；null 表示這一面不畫 */
  front: number | null
  back: number | null
  /** 這一點鼓起的比例（0–1，預設 1）：貼在頭上的部分薄一點，出了頭才鼓滿 */
  lift?: number
}

export interface LayerSpec {
  canvas: HTMLCanvasElement
  vb: ViewBox
  /** canvas 每個紙娃娃 px 幾個像素 */
  scale: number
  /** 網格間距（紙娃娃 px） */
  step: number
  /** 鼓起的程度：h = bulge × √d（d 是離邊緣的距離，紙娃娃 px） */
  bulge: number
  /** 最厚到多少（紙娃娃 px） */
  maxH: number
  base: (x: number, y: number) => Surface
  /** 只取這個範圍內的點（例：頭髮後層在頭的範圍內只畫背面） */
  alphaMin?: number
}

/** 兩次掃描的倒角距離（3-4 chamfer），單位是格 */
function distanceField(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      d[i] = Math.min(d[i]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4142, at(x + 1, y - 1) + 1.4142)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (!mask[i]) continue
      d[i] = Math.min(d[i]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4142, at(x - 1, y + 1) + 1.4142)
    }
  return d
}

export function layerGeometry(spec: LayerSpec): BufferGeometry {
  const { canvas, vb, scale, step } = spec
  const [vx, vy, vw, vh] = vb
  const gw = Math.floor(vw / step) + 1
  const gh = Math.floor(vh / step) + 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const alphaAt = (px: number, py: number) => {
    const cx = Math.min(canvas.width - 1, Math.max(0, Math.round(px * scale)))
    const cy = Math.min(canvas.height - 1, Math.max(0, Math.round(py * scale)))
    return data[(cy * canvas.width + cx) * 4 + 3]! / 255
  }
  // 剪影：alpha 過半就算；再往外長一格，邊緣交給貼圖裁
  const core = new Uint8Array(gw * gh)
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) core[j * gw + i] = alphaAt(i * step, j * step) > (spec.alphaMin ?? 0.4) ? 1 : 0
  const mask = new Uint8Array(gw * gh)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      let on = 0
      for (let dj = -1; dj <= 1 && !on; dj++)
        for (let di = -1; di <= 1 && !on; di++) {
          const x = i + di
          const y = j + dj
          if (x >= 0 && y >= 0 && x < gw && y < gh && core[y * gw + x]) on = 1
        }
      mask[j * gw + i] = on
    }
  // 厚度從畫的邊緣（core）算：多長出來的那一圈與 core 的最外圈都是 0，前後兩面在畫的邊緣接起來，側面不會露縫
  const dist = distanceField(core, gw, gh)

  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const front = new Int32Array(gw * gh).fill(-1)
  const back = new Int32Array(gw * gh).fill(-1)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i
      if (!mask[k]) continue
      const x = vx + i * step
      const y = vy + j * step
      const d = core[k] ? Math.max(0, dist[k]! - 1) * step : 0
      const s = spec.base(x, y)
      const h = Math.min(spec.maxH, spec.bulge * Math.sqrt(d)) * (s.lift ?? 1)
      const u = (i * step) / vw
      const v = 1 - (j * step) / vh
      if (s.front !== null) {
        front[k] = pos.length / 3
        pos.push(worldX(x), worldY(y), (s.front + h) * PX)
        uv.push(u, v)
      }
      if (s.back !== null) {
        // 邊緣（h = 0）且前後同一個基準：共用一個點，前後兩面接起來不留縫
        if (h === 0 && s.front !== null && s.front === s.back) back[k] = front[k]!
        else {
          back[k] = pos.length / 3
          pos.push(worldX(x), worldY(y), (s.back - h) * PX)
          uv.push(u, v)
        }
      }
    }
  for (let j = 0; j < gh - 1; j++)
    for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i
      const b = a + 1
      const c = a + gw
      const d = c + 1
      const f = [front[a]!, front[b]!, front[c]!, front[d]!]
      if (f.every((n) => n >= 0)) idx.push(f[0]!, f[2]!, f[1]!, f[1]!, f[2]!, f[3]!)
      const g = [back[a]!, back[b]!, back[c]!, back[d]!]
      if (g.every((n) => n >= 0)) idx.push(g[0]!, g[1]!, g[2]!, g[1]!, g[3]!, g[2]!)
    }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}
