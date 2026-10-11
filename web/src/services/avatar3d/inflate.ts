import { BufferGeometry, Float32BufferAttribute } from 'three'

import type { ViewBox } from './raster'

/**
 * 3D 旅人（DESIGN.md §7.24a）：把 2D 剪影「充氣」成有厚度的形狀。
 * 剪影取自點陣的 alpha；每一點離邊緣多遠（距離場）決定鼓多高：h = bulge × √d，邊緣是 0、越往中間越厚，
 * 剖面是圓的，像布偶或軟膠公仔。前後兩面的基準 z 由 base() 決定（平面、或貼著頭的球面）。
 * 網格沿著輪廓走（marching squares：格線兩端一裡一外時，在 alpha 0.5 的地方補一個點，位置在點陣上二分搜尋），
 * 前後兩面在輪廓上共用同一個點，轉到側面不會有裂縫或鋸齒。
 */

/** 紙娃娃座標（240×320 的畫布，單位 px）換成 3D：頭的半徑 54px ≈ 1，腳底（y 280）在 0 */
export const PX = 1 / 54
export const worldX = (x: number) => (x - 120) * PX
export const worldY = (y: number) => (280 - y) * PX

export interface Surface {
  /** 這一點正面、背面的基準 z（紙娃娃 px）；null 表示這一面不畫 */
  front: number | null
  back: number | null
  /** 這一點鼓起的比例（0–1，預設 1）：貼在頭上、被別的東西蓋住的地方薄一點 */
  lift?: number
  /** 厚度往前偏多少（-1–1，預設 0 前後一樣厚）：放在身體表面上的東西背面貼著、厚度往前長 */
  bias?: number
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
}

export interface Layer {
  geometry: BufferGeometry
  /** 這一層在 (x, y) 鼓了多高（紙娃娃 px，不含基準）；不在剪影裡是 0 */
  heightAt: (x: number, y: number) => number
}

/** canvas 的 alpha 取樣（紙娃娃座標，雙線性） */
export function alphaSampler(canvas: HTMLCanvasElement, vb: ViewBox, scale: number): (x: number, y: number) => number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const { width: W, height: H } = canvas
  const data = ctx.getImageData(0, 0, W, H).data
  const at = (cx: number, cy: number) => (cx < 0 || cy < 0 || cx >= W || cy >= H ? 0 : data[(cy * W + cx) * 4 + 3]! / 255)
  return (x, y) => {
    const fx = (x - vb[0]) * scale - 0.5
    const fy = (y - vb[1]) * scale - 0.5
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty
  }
}

/**
 * 兩次掃描的倒角距離，單位是格。起點是輪廓旁邊的點：到輪廓的精確距離（edge[i]，0–1 格，沒有就是 Infinity），
 * 再往裡面傳；輪廓用精確位置起算，斜邊上的厚度才不會一格高一格低（側面看像階梯）
 */
function distanceField(mask: Uint8Array, edge: Float32Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? edge[i]! : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h || !mask[y * w + x] ? Infinity : d[y * w + x]!)
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

const LEVEL = 0.5

export function inflateLayer(spec: LayerSpec): Layer {
  const { canvas, vb, scale, step } = spec
  const [vx, vy, vw, vh] = vb
  const gw = Math.floor(vw / step) + 1
  const gh = Math.floor(vh / step) + 1
  const alpha = alphaSampler(canvas, vb, scale)
  const inside = new Uint8Array(gw * gh)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i
      // 畫布最外一圈當作外面，形狀一定封閉
      const v = i === 0 || j === 0 || i === gw - 1 || j === gh - 1 ? 0 : alpha(vx + i * step, vy + j * step)
      inside[k] = v >= LEVEL ? 1 : 0
    }
  // 格點一格 1px，點陣的反鋸齒邊只有 1/4px 寬：格點上的 alpha 幾乎只有 0 或 1，看不出邊在格子的哪裡。
  // 沿著格邊在點陣上二分搜尋 alpha 0.5 的位置（從裡面那端算起的比例），輪廓與距離都用這個
  const crossCache = new Map<number, number>()
  const crossing = (kin: number, kout: number): number => {
    // 同一條格邊只算一次（裡外哪端在前都一樣，t 一律從裡面那端算）
    const key = Math.min(kin, kout) * 2 + (Math.abs(kin - kout) === 1 ? 0 : 1)
    const hit = crossCache.get(key)
    if (hit !== undefined) return hit
    const xi = vx + (kin % gw) * step
    const yi = vy + Math.floor(kin / gw) * step
    const xo = vx + (kout % gw) * step
    const yo = vy + Math.floor(kout / gw) * step
    let lo = 0
    let hi = 1
    // 最外一圈當作外面，那裡不搜尋（取中間）
    const border = (k: number) => k % gw === 0 || k % gw === gw - 1 || k < gw || k >= gw * (gh - 1)
    if (border(kout)) lo = hi = 0.5
    for (let n = 0; n < 6 && hi - lo > 1e-3; n++) {
      const m = (lo + hi) / 2
      if (alpha(xi + (xo - xi) * m, yi + (yo - yi) * m) >= LEVEL) lo = m
      else hi = m
    }
    const t = (lo + hi) / 2
    crossCache.set(key, t)
    return t
  }
  const edge = new Float32Array(gw * gh).fill(Infinity)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i
      if (!inside[k]) continue
      for (const q of [i > 0 ? k - 1 : -1, i < gw - 1 ? k + 1 : -1, j > 0 ? k - gw : -1, j < gh - 1 ? k + gw : -1])
        if (q >= 0 && !inside[q]) edge[k] = Math.min(edge[k]!, crossing(k, q))
    }
  const dist = distanceField(inside, edge, gw, gh)
  const height = new Float32Array(gw * gh)

  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const front = new Int32Array(gw * gh).fill(-1)
  const back = new Int32Array(gw * gh).fill(-1)
  const bases: Array<Surface | undefined> = new Array(gw * gh)

  const push = (x: number, y: number, z: number) => {
    pos.push(worldX(x), worldY(y), z * PX)
    uv.push((x - vx) / vw, 1 - (y - vy) / vh)
    return pos.length / 3 - 1
  }

  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i
      if (!inside[k]) continue
      const x = vx + i * step
      const y = vy + j * step
      const s = spec.base(x, y)
      bases[k] = s
      const d = dist[k]! * step
      const h = Math.min(spec.maxH, spec.bulge * Math.sqrt(d)) * (s.lift ?? 1)
      height[k] = h
      const bias = s.bias ?? 0
      if (s.front !== null) front[k] = push(x, y, s.front + h * (1 + bias))
      if (s.back !== null) back[k] = push(x, y, s.back - h * (1 - bias))
    }

  // 輪廓上的點：h = 0；前後基準相同時前後共用一個點，兩面在這裡接起來
  const edgeFront = new Map<number, number>()
  const edgeBack = new Map<number, number>()
  const edgeVertex = (k1: number, k2: number, horizontal: boolean): [number, number] => {
    const key = horizontal ? k1 * 2 : k1 * 2 + 1
    const f = edgeFront.get(key)
    if (f !== undefined) return [f, edgeBack.get(key)!]
    const kin = inside[k1] ? k1 : k2
    const kout = kin === k1 ? k2 : k1
    const t = crossing(kin, kout)
    const xi = vx + (kin % gw) * step
    const yi = vy + Math.floor(kin / gw) * step
    const xo = vx + (kout % gw) * step
    const yo = vy + Math.floor(kout / gw) * step
    const x = xi + (xo - xi) * t
    const y = yi + (yo - yi) * t
    const s = bases[kin]!
    let fi = -1
    let bi = -1
    if (s.front !== null) fi = push(x, y, s.front)
    if (s.back !== null) bi = s.front !== null && s.front === s.back ? fi : push(x, y, s.back)
    edgeFront.set(key, fi)
    edgeBack.set(key, bi)
    return [fi, bi]
  }

  for (let j = 0; j < gh - 1; j++)
    for (let i = 0; i < gw - 1; i++) {
      // 格子四角：左上、右上、右下、左下
      const c = [j * gw + i, j * gw + i + 1, (j + 1) * gw + i + 1, (j + 1) * gw + i]
      if (!c.some((k) => inside[k])) continue
      const pf: number[] = []
      const pb: number[] = []
      for (let e = 0; e < 4; e++) {
        const p = c[e]!
        const q = c[(e + 1) % 4]!
        if (inside[p]) {
          pf.push(front[p]!)
          pb.push(back[p]!)
        }
        if (inside[p] !== inside[q]) {
          // 上、下兩邊是水平線，左、右是垂直線；鍵用比較小的那一端
          const [fi, bi] = edgeVertex(Math.min(p, q), Math.max(p, q), e === 0 || e === 2)
          pf.push(fi)
          pb.push(bi)
        }
      }
      if (pf.length < 3) continue
      // 紙娃娃的 y 往下、3D 的 Y 往上：這個走法在 3D 是順時針，正面反過來接
      if (pf.every((v) => v >= 0)) for (let t = 1; t < pf.length - 1; t++) idx.push(pf[0]!, pf[t + 1]!, pf[t]!)
      if (pb.every((v) => v >= 0)) for (let t = 1; t < pb.length - 1; t++) idx.push(pb[0]!, pb[t]!, pb[t + 1]!)
    }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(idx)
  geometry.computeVertexNormals()
  return {
    geometry,
    heightAt: (x, y) => {
      const i = Math.round((x - vx) / step)
      const j = Math.round((y - vy) / step)
      if (i < 0 || j < 0 || i >= gw || j >= gh) return 0
      return height[j * gw + i]!
    },
  }
}

/** 貼圖邊緣往外補色：網格沿輪廓切，邊上取樣會混到透明的黑。把原圖往八個方向各錯開 1–3 像素、
 *  疊在「下面」（destination-over），透明的地方就補上旁邊的顏色；剪影外緣半透明的淡邊也只剩一點點深色。
 *  最後墊一層底色變成不透明（形狀已經由網格決定，要用原本的 canvas 算）。全部交給 canvas 畫，不跑逐像素的迴圈 */
export function bleedEdges(canvas: HTMLCanvasElement, radius = 3): HTMLCanvasElement {
  const { width: W, height: H } = canvas
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const g = out.getContext('2d')!
  g.drawImage(canvas, 0, 0)
  g.globalCompositeOperation = 'destination-over'
  for (let r = 1; r <= radius; r++)
    for (const [dx, dy] of [
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r, r],
      [r, -r],
      [-r, r],
      [-r, -r],
    ] as const)
      g.drawImage(canvas, dx, dy)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, W, H)
  return out
}
