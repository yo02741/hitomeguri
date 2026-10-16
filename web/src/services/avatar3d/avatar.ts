import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  type Object3D,
  RedFormat,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  Vector2,
} from 'three'

import { splitOver } from '../../data/dollArt'
import { EYES, HAIR, outfitById, type Slot } from '../../data/outfits'
import type { AvatarParts } from '../../stores/avatar'
import { alphaSampler, bleedEdges, inflateLayer, PX, type Surface, worldX, worldY } from './inflate'
import { patternDefs, rasterize, resolveVars, type ViewBox } from './raster'

/**
 * 3D 旅人（DESIGN.md §7.24a）：紙娃娃的美術直接變成立體的軟膠公仔。
 * - 頭是真的球（橢球），臉（眼睛、嘴、腮紅）貼在球面上。
 * - 身體、衣服、手腳：2D 剪影充氣成圓鼓鼓的一塊，正面貼原本的畫，背面同一張。
 * - 頭髮、頭上的、臉上的：在頭的範圍裡貼著球面、往外鼓一點；超出頭的部分（髮尾、帽頂）充氣成一塊。
 * - 疊放照 2D 的順序：後髮 → 身體 → 頭 → 瀏海 → 臉上的 → 頭上的 → 手上的。後面的被前面的蓋住的地方變薄，
 *   出了頭的部分也照順序往前排，不會互相穿出來；長髮貼著背，手上的、夥伴放在身體表面前面。
 * 顏色、花紋、單品全部沿用 2D 的資料（outfits.ts、theme.css 的 token），不另外建模，全部單品都能穿。
 */

const HEAD = { cx: 120, cy: 100, rx: 54, ry: 56, rz: 50 }
/** 頭的球面在 (x, y) 的深度（紙娃娃 px）；出了頭的範圍是 null */
function headZ(x: number, y: number, grow = 1): number | null {
  const u = (x - HEAD.cx) / (HEAD.rx * grow)
  const v = (y - HEAD.cy) / (HEAD.ry * grow)
  const r = 1 - u * u - v * v
  return r > 0 ? HEAD.rz * grow * Math.sqrt(r) : null
}
/** 離頭中心多遠（0 中心、1 邊緣） */
function headR(x: number, y: number): number {
  const u = (x - HEAD.cx) / HEAD.rx
  const v = (y - HEAD.cy) / HEAD.ry
  return Math.sqrt(u * u + v * v)
}
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smooth = (a: number, b: number, t: number) => {
  const k = clamp01((t - a) / (b - a))
  return k * k * (3 - 2 * k)
}

/** 卡通著色的三階明暗；全部材質共用 */
let gradient: DataTexture | null = null
function gradientMap(): DataTexture {
  if (gradient) return gradient
  gradient = new DataTexture(new Uint8Array([120, 210, 255]), 3, 1, RedFormat)
  gradient.minFilter = NearestFilter
  gradient.magFilter = NearestFilter
  gradient.needsUpdate = true
  return gradient
}

function texture(canvas: HTMLCanvasElement): Texture {
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}
/** 充氣的一塊：形狀已經沿輪廓切好，貼圖當不透明用（邊緣先補色） */
function toon(canvas: HTMLCanvasElement): MeshToonMaterial {
  return new MeshToonMaterial({ map: texture(bleedEdges(canvas)), gradientMap: gradientMap(), side: DoubleSide })
}
/** 有挖空的旋轉體：顏色照樣往外補（邊上不混到黑），透明度用原本的，alpha 0.5 以下不畫 */
function toonCut(canvas: HTMLCanvasElement): MeshToonMaterial {
  const bled = bleedEdges(canvas)
  const { width: W, height: H } = canvas
  const a = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data
  const g = bled.getContext('2d', { willReadFrequently: true })!
  const b = g.getImageData(0, 0, W, H)
  for (let i = 3; i < a.length; i += 4) b.data[i] = a[i]!
  g.putImageData(b, 0, 0)
  return new MeshToonMaterial({ map: texture(bled), gradientMap: gradientMap(), side: DoubleSide, alphaTest: 0.5 })
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

type Cover = (x: number, y: number) => number
const none: Cover = () => 0

/** 貼著頭的一層：頭的範圍內只有正面（離球面 lift），越靠近頭的邊緣鼓得越多；出了頭就是以 z 為中心、鼓滿的一塊。
 *  cover：被更前面的東西蓋住的程度（0–1），蓋住的地方薄一點 */
const onHead =
  (lift: number, z: number, opts: { grow?: number; thin?: number; cover?: Cover } = {}) =>
  (x: number, y: number): Surface => {
    const { grow = 1.02, thin = 0.3, cover = none } = opts
    const keep = 1 - 0.8 * cover(x, y)
    const hz = headZ(x, y, grow)
    if (hz === null) return { front: z, back: z, lift: keep }
    return { front: hz + lift, back: null, lift: (thin + (1 - thin) * smooth(0.7, 1, headR(x, y))) * keep }
  }

type Pt = [number, number]
/** 硬的一片（側戴的面具、單側的髮簪髮夾）：在 pts 上找平面 z = z0 + a(x−cx) + b(y−cy)，最小平方貼著 need
 *  （頭的球面、頭髮的表面、帽子的正面再往前一點），斜率最多 maxTilt；再整片往前推到每一點都不低於 need。
 *  一片硬的不跟著球面彎（不會折一道），也不會一半貼在頭上、一半留在頭的中心平面而被扯開。
 *  curve > 0：中間微微拱起（面具）。need 回傳 null 的點不受限（頭與頭髮的外面） */
function rigidPlane(pts: Pt[], need: (x: number, y: number) => number | null, maxTilt: number, curve = 0): ((x: number, y: number) => number) | null {
  if (!pts.length) return null
  const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length
  const cy = pts.reduce((t, p) => t + p[1], 0) / pts.length
  const bowl = (x: number, y: number) => curve * ((x - cx) ** 2 + (y - cy) ** 2)
  const sample: Array<[number, number, number]> = []
  for (const [x, y] of pts) {
    const z = need(x, y)
    if (z !== null) sample.push([x - cx, y - cy, z + bowl(x, y)])
  }
  if (!sample.length) return null
  const n = sample.length
  const mx = sample.reduce((t, p) => t + p[0], 0) / n
  const my = sample.reduce((t, p) => t + p[1], 0) / n
  const mz = sample.reduce((t, p) => t + p[2], 0) / n
  let sxx = 0
  let sxy = 0
  let syy = 0
  let sxz = 0
  let syz = 0
  for (const [x, y, z] of sample) {
    const dx = x - mx
    const dy = y - my
    const dz = z - mz
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
    sxz += dx * dz
    syz += dy * dz
  }
  const det = sxx * syy - sxy * sxy
  let a = 0
  let b = 0
  if (det > 1e-6 * Math.max(1, sxx * syy)) {
    a = (sxz * syy - syz * sxy) / det
    b = (syz * sxx - sxz * sxy) / det
  } else {
    if (sxx > 1e-9) a = sxz / sxx
    if (syy > 1e-9) b = syz / syy
  }
  const tilt = Math.hypot(a, b)
  if (tilt > maxTilt) {
    a *= maxTilt / tilt
    b *= maxTilt / tilt
  }
  // sample 的 z 已經加上拱起的量：平面 + 拱起 ≥ need ⇔ z0 ≥ z − a·dx − b·dy
  let z0 = -Infinity
  for (const [dx, dy, z] of sample) z0 = Math.max(z0, z - a * dx - b * dy)
  return (x, y) => z0 + a * (x - cx) + b * (y - cy) - bowl(x, y)
}
const TILT_MAX = Math.tan((60 * Math.PI) / 180)

/** 單品在格點（每 1px，與 inflateLayer 的網格一致）上的連通塊：2px 內相連的算同一塊 */
function components(alpha: Cover, vb: ViewBox): { label: (x: number, y: number) => number; parts: Pt[][] } {
  const [vx, vy, vw, vh] = vb
  const gw = Math.floor(vw) + 1
  const gh = Math.floor(vh) + 1
  const lab = new Int32Array(gw * gh).fill(-1)
  const parts: Pt[][] = []
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      if (lab[j * gw + i]! >= 0 || alpha(vx + i, vy + j) < 0.5) continue
      const k = parts.length
      const part: Pt[] = []
      const stack: Pt[] = [[i, j]]
      lab[j * gw + i] = k
      while (stack.length) {
        const [pi, pj] = stack.pop()!
        part.push([vx + pi, vy + pj])
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const qi = pi + di
            const qj = pj + dj
            if (qi < 0 || qj < 0 || qi >= gw || qj >= gh) continue
            const q = qj * gw + qi
            if (lab[q]! >= 0 || alpha(vx + qi, vy + qj) < 0.5) continue
            lab[q] = k
            stack.push([qi, qj])
          }
      }
      parts.push(part)
    }
  return {
    parts,
    label: (x, y) => {
      const i = Math.round(x - vx)
      const j = Math.round(y - vy)
      return i < 0 || j < 0 || i >= gw || j >= gh ? -1 : lab[j * gw + i]!
    },
  }
}

export interface Avatar3D {
  root: Group
  /** 夥伴（會跳） */
  buddy: Object3D | null
  dispose: () => void
}

function bodySvg(skin: string, bodyItem: string): string {
  const sk = `fill="${skin}" stroke="var(--color-doll-line)" stroke-opacity=".2" stroke-width="1.4"`
  return (
    `<g ${sk}><rect x="104" y="236" width="13" height="36" rx="5"/><rect x="123" y="236" width="13" height="36" rx="5"/>` +
    `<rect x="77" y="160" width="14" height="60" rx="7"/><rect x="149" y="160" width="14" height="60" rx="7"/></g>` +
    `<g fill="var(--color-item-brown)"><path d="M98 276 C98 270 104 268 110 268 C116 268 119 271 119 276 C119 279 117 280 114 280 L101 280 C99 280 98 278 98 276Z"/>` +
    `<path d="M142 276 C142 270 136 268 130 268 C124 268 121 271 121 276 C121 279 123 280 126 280 L139 280 C141 280 142 278 142 276Z"/></g>` +
    bodyItem +
    `<circle cx="84" cy="222" r="8" ${sk}/><circle cx="156" cy="222" r="8" ${sk}/>`
  )
}

function faceSvg(eyes: string): string {
  return (
    `<ellipse cx="93" cy="123" rx="8.5" ry="5" fill="var(--color-doll-blush)" opacity=".7"/>` +
    `<ellipse cx="147" cy="123" rx="8.5" ry="5" fill="var(--color-doll-blush)" opacity=".7"/>` +
    eyes +
    `<path d="M116 129 Q120 132.5 124 129" fill="none" stroke="var(--color-doll-line)" stroke-width="2.2" stroke-linecap="round"/>`
  )
}

/** 臉：頭的球面前面一塊，貼眼睛、嘴、腮紅（不受光，像畫上去的） */
function faceMesh(canvas: HTMLCanvasElement, vb: ViewBox): Mesh {
  const [vx, vy, vw, vh] = vb
  const step = 1.5
  const gw = Math.floor(vw / step) + 1
  const gh = Math.floor(vh / step) + 1
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const at = new Int32Array(gw * gh).fill(-1)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const x = vx + i * step
      const y = vy + j * step
      const z = headZ(x, y, 0.995)
      if (z === null || z < 8) continue
      at[j * gw + i] = pos.length / 3
      pos.push(worldX(x), worldY(y), (z + 0.8) * PX)
      uv.push((i * step) / vw, 1 - (j * step) / vh)
    }
  for (let j = 0; j < gh - 1; j++)
    for (let i = 0; i < gw - 1; i++) {
      const a = at[j * gw + i]!
      const b = at[j * gw + i + 1]!
      const c = at[(j + 1) * gw + i]!
      const d = at[(j + 1) * gw + i + 1]!
      if (a >= 0 && b >= 0 && c >= 0 && d >= 0) idx.push(a, c, b, b, c, d)
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  const mat = new MeshBasicMaterial({ map: texture(canvas), transparent: true, depthWrite: false })
  return new Mesh(g, mat)
}

/** 地上的影子：中間深、往外淡掉 */
function groundShadow(): Mesh {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  const ink = css('--color-doll-line') || 'black'
  grad.addColorStop(0, ink)
  grad.addColorStop(1, 'transparent')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const mesh = new Mesh(new CircleGeometry(1.25, 48), new MeshBasicMaterial({ map: texture(c), transparent: true, opacity: 0.22, depthWrite: false }))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.002
  mesh.scale.set(1, 0.55, 1)
  return mesh
}

/**
 * 圓帽（左右對稱、比頭寬的斗笠、花笠…）：充氣只會鼓成一片，側面看像頭帶。
 * 改用旋轉成形：每一列剪影的半寬當輪廓轉一圈，帽簷是真的一圈；貼圖從正面投影（花紋留在正面、背面是同一張）。
 */
const ROUND_HATS = new Set([
  'sugegasa',
  'achv-jingasa',
  'yamagata-hanagasa',
  'shizuoka-fuji',
  'kagoshima-sakurajima',
  'tokushima-amigasa',
  'straw-hat',
  'bucket-hat',
  'school-hat',
  'beanie',
  // 2026-10-13：圓的笠、圓頂的帽子也轉一圈（側面、後面都蓋得到）
  'toyama-owaragasa',
  'wakayama-ichimegasa',
  'kanagawa-yabusame',
  'fukui-ajirogasa',
  'nagasaki-kasaboko',
  'hokkaido-melon',
  'hyogo-tamanegi',
  'oita-shiitake',
  'nara-rahotsu',
])
/**
 * 塔（左右對稱、高出頭頂的：鐵塔、燈塔、五重塔、火箭…）：整件轉一圈，立在頭頂的中軸上（2026-10-13 回報：塔貼在額頭前面、
 * 不是立在頭上）。貼圖照原樣投影，不拉寬。頭的範圍裡：畫滿大半個頭寬的列（海浪、岩座、屋簷）轉成貼著頭的一圈；
 * 其他的列（塔腳）照畫的寬度轉，收在頭裡面，塔從頭頂冒出來（hide）；五重塔下層的牆留在那一圈上、旁邊挖空（cut）
 */
const TOWER_HATS = new Map<string, 'hide' | 'cut'>([
  ['tokyo-tower', 'hide'],
  ['osaka-tsutenkaku', 'hide'],
  ['saitama-tokinokane', 'hide'],
  ['hyogo-porttower', 'hide'],
  ['chiba-inubosaki', 'hide'],
  ['kagoshima-rocket', 'hide'],
  ['kumamoto-kintoro', 'hide'],
  ['nara-gojunoto', 'cut'],
])

/** 頭在那一列的半寬（紙娃娃 px） */
const headHalf = (y: number) => {
  const v = (y - HEAD.cy) / HEAD.ry
  return Math.abs(v) < 1 ? HEAD.rx * Math.sqrt(1 - v * v) : 0
}
/** 旋轉體的一列：紙娃娃的 y、轉一圈的半徑、貼圖橫向的縮放（畫的那一列的半寬 ÷ 半徑；1 是照原樣投影） */
interface Ring {
  y: number
  r: number
  sq: number
}
interface Revolved {
  geometry: BufferGeometry
  cover: Cover
  /** 正面在 (x, y) 的深度（轉一圈的半徑）；不在這個旋轉體的列是 null */
  frontAt: (x: number, y: number) => number | null
}
/** 一列一列的半徑轉成一圈：頂上收到中軸、最下面往內收回頭的寬度，是封起來的。貼圖從正面投影 */
function revolve(vb: ViewBox, rows: Ring[]): Revolved | null {
  if (rows.length < 3) return null
  const [vx, vy, vw, vh] = vb
  const rowKey = (wy: number) => Math.round(wy * 1e4)
  const squeeze = new Map<number, number>()
  /** 每一列（紙娃娃的 y，整數）轉成一圈後的半徑：頭髮在這個範圍內要變薄 */
  const radiusAt = new Map<number, number>()
  const pts: Vector2[] = [new Vector2(0, worldY(rows[0]!.y - 0.5))]
  for (const { y, r, sq } of rows) {
    pts.push(new Vector2(r * PX, worldY(y)))
    squeeze.set(rowKey(worldY(y)), sq)
    radiusAt.set(Math.round(y), r)
  }
  const last = rows[rows.length - 1]!
  pts.push(new Vector2(Math.min(last.r, HEAD.rx * 0.9) * PX, worldY(last.y + 1.5)))
  const geo = new LatheGeometry(pts.reverse(), 72)
  // 貼圖從正面投影：3D 的 x 對回紙娃娃的 x（放寬過的列照比例縮回原本的寬度）
  const pos = geo.attributes.position!
  const uv = geo.attributes.uv!
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) / PX) * (squeeze.get(rowKey(pos.getY(i))) ?? 1) + 120
    const y = 280 - pos.getY(i) / PX
    uv.setXY(i, (x - vx) / vw, 1 - (y - vy) / vh)
  }
  uv.needsUpdate = true
  geo.computeVertexNormals()
  const cover: Cover = (x, y) => {
    const r = radiusAt.get(Math.round(y))
    return r === undefined ? 0 : clamp01((r + 2 - Math.abs(x - 120)) / 4)
  }
  const frontAt = (x: number, y: number) => {
    const r = radiusAt.get(Math.round(y))
    const dx = Math.abs(x - 120)
    return r === undefined || dx >= r ? null : Math.sqrt(r * r - dx * dx)
  }
  return { geometry: geo, cover, frontAt }
}

/** 圓帽、塔：每一列剪影的寬度轉一圈 */
function latheHat(vb: ViewBox, alpha: Cover, hairHalf: (y: number) => number, mode: 'brim' | 'hide' | 'cut'): Revolved | null {
  const [vx, vy, vw, vh] = vb
  // 圓帽畫成正面看的帽冠可能比頭窄（草帽、漁夫帽：2D 是透視的樣子），轉一圈後頭和頭髮會從帽冠穿出來：
  // 半徑至少是「頭在那一列的半寬＋6」（瀏海浮在頭上最多約 6px）與「頭髮那一列的半寬＋3」，貼圖照原本的寬度縮放上去。
  // 塔的貼圖不拉寬（照原樣投影）
  const rows: Ring[] = []
  let widest = 0
  for (let y = vy; y <= vy + vh; y += 1) {
    let l = -1
    let r = -1
    let filled = 0
    for (let x = vx; x <= vx + vw; x += 0.5) {
      if (alpha(x, y) < 0.5) continue
      if (l < 0) l = x
      r = x
      filled++
    }
    if (l < 0) continue
    const total = (r - l) / 0.5 + 1
    const rad = Math.max(0.5, (r - l) / 2)
    // 過了最寬的那一列（帽簷）之後，只剩兩條細線（帽帶）就停：帽帶不轉成一圈
    if (mode === 'brim' && widest && rad < widest && filled / total < 0.4) break
    widest = Math.max(widest, rad)
    const used = mode === 'hide' && !coversHead(alpha, y) ? rad : Math.max(rad, headHalf(y) + 6, hairHalf(y) + 3)
    rows.push({ y, r: used, sq: mode === 'brim' ? rad / used : 1 })
  }
  return revolve(vb, rows)
}

/** 這一列畫的有沒有蓋住大半個頭寬（六成以上）；頭以外的列是 false */
function coversHead(alpha: Cover, y: number): boolean {
  const hh = headHalf(y)
  let n = 0
  let on = 0
  for (let x = 120 - hh; x <= 120 + hh; x += 1) {
    n++
    if (alpha(x, y) >= 0.5) on++
  }
  return n > 0 && on / n >= 0.6
}

/**
 * 其他頭上的（頭巾、帽子、頭帶、城的石垣…）：頭的範圍裡蓋住大半個頭寬的那幾列，另外轉一圈貼著頭的帽子，
 * 後腦、側面也蓋得到（2026-10-13 回報：帽子只蓋到前額，後腦都沒有）。正面照舊是充氣的那一層（在這一圈前面）。
 * 髮夾、髮箍這種只蓋到一小段的列不轉
 */
function capRings(vb: ViewBox, alpha: Cover, hairHalf: (y: number) => number): Revolved[] {
  const runs: Ring[][] = []
  let run: Ring[] = []
  const flush = () => {
    if (run.length >= 3) runs.push(run)
    run = []
  }
  const top = Math.ceil(HEAD.cy - HEAD.ry + 1)
  for (let y = Math.max(Math.ceil(vb[1]), top); y <= Math.min(vb[1] + vb[3], 104); y++) {
    if (coversHead(alpha, y)) run.push({ y, r: Math.max(headHalf(y) + 6, hairHalf(y) + 3), sq: 1 })
    else flush()
  }
  flush()
  return runs.map((r) => revolve(vb, r)).filter((r): r is Revolved => !!r)
}

/**
 * 旋轉體的貼圖，一列一列補色（轉一圈後每個角度都投影得到顏色）：
 * - inner：同一列左右兩端之間透明的地方（例如編笠下面露出臉的缺口）用左右最近的顏色補滿（圓帽：畫的寬度會拉滿那一圈）
 * - extend：整列補滿，兩端外面也用最近的顏色（照原樣投影、這一圈比畫的寬：帽子貼著頭的那一圈、塔的底座）
 * - cut：不補，透明的地方挖空（塔腳跨在頭上，旁邊照樣看得到頭髮）
 */
type RowMode = 'inner' | 'extend' | 'cut'
function fillRows(canvas: HTMLCanvasElement, vb: ViewBox, scale: number, mode: (y: number) => RowMode = () => 'inner'): HTMLCanvasElement {
  const { width: W, height: H } = canvas
  const src = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H)
  const d = src.data
  for (let y = 0; y < H; y++) {
    const m = mode(vb[1] + (y + 0.5) / scale)
    if (m === 'cut') continue
    const row = y * W
    let first = -1
    let last = -1
    for (let x = 0; x < W; x++)
      if (d[(row + x) * 4 + 3]! > 160) {
        if (first < 0) first = x
        last = x
      }
    if (first < 0) continue
    const from0 = m === 'extend' ? 0 : first
    const to = m === 'extend' ? W - 1 : last
    let prev = first
    for (let x = from0; x <= to; x++) {
      const i = (row + x) * 4
      if (d[i + 3]! > 160) {
        prev = x
        continue
      }
      let next = Math.max(x + 1, first)
      while (next <= last && d[(row + next) * 4 + 3]! <= 160) next++
      const from = x < first ? first : next > last ? prev : x - prev <= next - x ? prev : next
      const j = (row + from) * 4
      d[i] = d[j]!
      d[i + 1] = d[j + 1]!
      d[i + 2] = d[j + 2]!
      d[i + 3] = 255
    }
  }
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  out.getContext('2d')!.putImageData(src, 0, 0)
  return out
}

/** 一個顏色字串換成 RGB（用 1×1 的 canvas 讓瀏覽器解析） */
function rgbOf(color: string): [number, number, number] {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const d = g.getImageData(0, 0, 1, 1).data
  return [d[0]!, d[1]!, d[2]!]
}

/**
 * 頭的球面貼圖：頭髮剪影蓋到的地方塗髮色，其他是膚色。瀏海那層只沿 z 浮在球面前面，頭的側邊幾乎貼著球面，
 * 與後層頭髮之間會露出一點球面；塗成髮色，轉到側面就不會看到膚色的斑塊。
 * 前半球只看瀏海那層（後層的剪影在臉的後面），後半球兩層都算。球面的 UV 是經緯度（SphereGeometry）
 */
function scalpTexture(front: Cover, back: Cover, skin: string, hair: string): Texture {
  const W = 256
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  const s = rgbOf(skin)
  const h = rgbOf(hair)
  for (let r = 0; r < H; r++) {
    const theta = ((r + 0.5) / H) * Math.PI
    for (let col = 0; col < W; col++) {
      const phi = ((col + 0.5) / W) * Math.PI * 2
      const px = -Math.cos(phi) * Math.sin(theta)
      const py = Math.cos(theta)
      const pz = Math.sin(phi) * Math.sin(theta)
      const x = HEAD.cx + HEAD.rx * px
      const y = HEAD.cy - HEAD.ry * py
      const isHair = pz >= 0 ? front(x, y) >= 0.5 : front(x, y) >= 0.5 || back(x, y) >= 0.5
      const rgb = isHair ? h : s
      const i = (r * W + col) * 4
      img.data[i] = rgb[0]
      img.data[i + 1] = rgb[1]
      img.data[i + 2] = rgb[2]
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return texture(c)
}

/** 單品的範圍：小圖的 viewBox 往外留一點。手上的再加上軀幹（斜背的帶子從肩膀拉下來，小圖裡只畫到一半） */
function itemBox(id: string): ViewBox {
  const o = outfitById.get(id)!
  const [x, y, w, h] = o.icon.split(/\s+/).map(Number) as [number, number, number, number]
  const box: ViewBox = [x - 8, y - 8, w + 16, h + 16]
  if (o.slot !== 'hand') return box
  const x0 = Math.min(box[0], 84)
  const y0 = Math.min(box[1], 128)
  return [x0, y0, Math.max(box[0] + box[2], 156) - x0, Math.max(box[1] + box[3], 238) - y0]
}

export async function buildAvatar(parts: AvatarParts, equipped: Partial<Record<Slot, string>>): Promise<Avatar3D> {
  const local = { '--skin': `var(--color-doll-skin-${parts.skin})`, '--hair': `var(--color-doll-hair-${parts.hairColor})` }
  const defs = resolveVars(patternDefs(), local)
  const svgOf = (slot: Slot) => (equipped[slot] ? resolveVars(outfitById.get(equipped[slot]!)?.svg ?? '', local) : '')
  const skin = css(`--color-doll-skin-${parts.skin}`)
  const SCALE = 4

  const root = new Group()
  const disposables: Array<{ dispose: () => void }> = []
  const add = (mesh: Mesh) => {
    root.add(mesh)
    disposables.push(mesh.geometry)
    const m = mesh.material as Material & { map?: Texture | null }
    disposables.push(m)
    if (m.map) disposables.push(m.map)
    return mesh
  }

  // 先把每一層畫好：後面的層要知道前面的蓋住哪裡
  const item = async (slot: Slot, svg = svgOf(slot)) => {
    const id = equipped[slot]
    if (!id || !outfitById.has(id) || !svg) return null
    const vb = itemBox(id)
    const canvas = await rasterize(svg, vb, SCALE, defs)
    return { vb, canvas, alpha: alphaSampler(canvas, vb, SCALE) }
  }
  // 側戴的面具：綁繩照舊（臉上的那一層），面具本體另外一層，放在頭上的單品前面（同紙娃娃，data/dollArt.ts 的 OVER）
  const faceSvg2 = splitOver(svgOf('face'))
  const [faceItem, faceOver, headItem, handItem, buddyItem] = await Promise.all([
    item('face', faceSvg2.under),
    item('face', faceSvg2.over),
    item('head'),
    item('hand'),
    item('buddy'),
  ])
  const coverOf = (...layers: Array<{ alpha: Cover } | null>): Cover => {
    const list = layers.filter((l): l is { alpha: Cover } => !!l)
    return list.length ? (x, y) => Math.max(...list.map((l) => l.alpha(x, y))) : none
  }

  // 身體＋衣服（手上的、夥伴另外做）：軀幹、腿一塊，兩隻手臂（含袖子、手）各自一塊，
  // 分開鼓才是圓的手臂，側面不會被拉成一片。都以 z = 0 為中心。
  // 兩塊在切線上都是 0 厚，接縫會透出後面（長髮）的顏色：手臂那塊往軀幹多切 3px，互相蓋住接縫
  const bodyVb: ViewBox = [48, 132, 144, 156]
  const bodyArt = resolveVars(bodySvg(skin, svgOf('body')), local)
  const clips =
    `<clipPath id="clip-torso"><path d="M90.5 132 L149.5 132 L149.5 233 L192 233 L192 288 L48 288 L48 233 L90.5 233Z"/></clipPath>` +
    `<clipPath id="clip-arms"><path d="M48 132 L93.5 132 L93.5 233 L48 233Z M146.5 132 L192 132 L192 233 L146.5 233Z"/></clipPath>`
  const [torsoCanvas, armsCanvas] = await Promise.all([
    rasterize(`<g clip-path="url(#clip-torso)">${bodyArt}</g>`, bodyVb, SCALE, defs + clips),
    rasterize(`<g clip-path="url(#clip-arms)">${bodyArt}</g>`, bodyVb, SCALE, defs + clips),
  ])
  const flat = () => ({ front: 0, back: 0 })
  const torso = inflateLayer({ canvas: torsoCanvas, vb: bodyVb, scale: SCALE, step: 1.25, bulge: 4.4, maxH: 28, base: flat })
  const arms = inflateLayer({ canvas: armsCanvas, vb: bodyVb, scale: SCALE, step: 1, bulge: 3.4, maxH: 12, base: flat })
  add(new Mesh(torso.geometry, toon(torsoCanvas)))
  add(new Mesh(arms.geometry, toon(armsCanvas)))
  const body = { heightAt: (x: number, y: number) => Math.max(torso.heightAt(x, y), arms.heightAt(x, y)) }
  // 身體表面「附近 8px 內最高的」：貼著身體的東西（背後的長髮、手上的）用這個，越過手臂、身體的薄邊時
  // 不會一下子掉到 0 而穿出來或折彎。先算成每 2px 一格的表（橫、直各取一次最大），查表很快
  const near = (() => {
    const [bx, by, bw, bh] = bodyVb
    const G = 2
    const R = 4
    const w = Math.floor(bw / G) + 1
    const h = Math.floor(bh / G) + 1
    const raw = new Float32Array(w * h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) raw[j * w + i] = body.heightAt(bx + i * G, by + j * G)
    const row = new Float32Array(w * h)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let m = 0
        for (let k = Math.max(0, i - R); k <= Math.min(w - 1, i + R); k++) m = Math.max(m, raw[j * w + k]!)
        row[j * w + i] = m
      }
    const out = new Float32Array(w * h)
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let m = 0
        for (let k = Math.max(0, j - R); k <= Math.min(h - 1, j + R); k++) m = Math.max(m, row[k * w + i]!)
        out[j * w + i] = m
      }
    return (x: number, y: number) => {
      const i = Math.round((x - bx) / G)
      const j = Math.round((y - by) / G)
      return i < 0 || j < 0 || i >= w || j >= h ? 0 : out[j * w + i]!
    }
  })()

  // 頭髮的兩層先畫好：頭的球面要塗上頭髮蓋到的地方
  const hair = HAIR[parts.hair] ?? HAIR.bob
  const hairVb: ViewBox = [30, 14, 180, 250]
  const frontVb: ViewBox = [40, 20, 160, 150]
  const [backCanvas, frontCanvas] = await Promise.all([
    rasterize(resolveVars(hair.back, local), hairVb, SCALE, defs),
    rasterize(resolveVars(hair.front, local), frontVb, SCALE, defs),
  ])

  // 轉一圈的帽冠要蓋住頭髮，先量每一列頭髮的半寬（頭頂以上不算：雙丸子等不把帽子撐成大圓筒；最多頭寬＋8）
  const ha = [alphaSampler(backCanvas, hairVb, SCALE), alphaSampler(frontCanvas, frontVb, SCALE)]
  const hairRows = new Map<number, number>()
  const hairHalf = (y: number) => {
    const k = Math.round(y)
    if (k < HEAD.cy - HEAD.ry) return 0
    let r = hairRows.get(k)
    if (r === undefined) {
      r = 0
      for (let x = 30; x <= 210; x += 1) if (ha.some((a) => a(x, k) >= 0.5)) r = Math.max(r, Math.abs(x - 120))
      r = Math.min(r, HEAD.rx + 8)
      hairRows.set(k, r)
    }
    return r
  }
  // 圓帽、塔整件轉一圈；其他的正面照舊充氣，頭的範圍裡蓋住頭的那幾列另外轉一圈貼著頭（後腦、側面）
  let lathe: Revolved | null = null
  let rings: Revolved[] = []
  if (headItem) {
    const id = equipped.head!
    if (ROUND_HATS.has(id) || TOWER_HATS.has(id)) lathe = latheHat(headItem.vb, headItem.alpha, hairHalf, TOWER_HATS.get(id) ?? 'brim')
    else rings = capRings(headItem.vb, headItem.alpha, hairHalf)
  }
  // 轉一圈後比 2D 的帽子寬：頭髮變薄的範圍用轉出來的那一圈
  const coverHair = coverOf(faceItem, faceOver, lathe ? { alpha: lathe.cover } : headItem, ...rings.map((r) => ({ alpha: r.cover })))

  // 頭
  const scalp = scalpTexture(alphaSampler(frontCanvas, frontVb, SCALE), alphaSampler(backCanvas, hairVb, SCALE), skin, css(`--color-doll-hair-${parts.hairColor}`))
  const head = new Mesh(new SphereGeometry(1, 64, 48), new MeshToonMaterial({ map: scalp, gradientMap: gradientMap() }))
  head.scale.set(HEAD.rx * PX, HEAD.ry * PX, HEAD.rz * PX)
  head.position.set(worldX(HEAD.cx), worldY(HEAD.cy), 0)
  add(head)
  const faceVb: ViewBox = [66, 44, 108, 112]
  add(faceMesh(await rasterize(resolveVars(faceSvg(EYES[parts.eyes] ?? EYES.round), local), faceVb, 6, defs), faceVb))

  // 頭髮後層：頭的範圍內包住後腦；頭以外是蓬鬆的一塊，往下時貼著背（身體的背面再往後一點）
  const hairBack = (x: number, y: number): Surface => {
    const keep = 1 - 0.8 * coverHair(x, y)
    const t = smooth(120, 165, y)
    const zOut = -2 * (1 - t) - (near(x, y) + 5) * t
    const liftOut = keep * (1 - 0.35 * t)
    const hz = headZ(x, y, 1.1)
    if (hz !== null) {
      // 頭的範圍內藏在後腦勺後面（頭的球面擋住）；出了頭的外緣（頭外 0–5px）高度、厚度漸漸接上外面那塊，
      // 交界是連續的斜面，轉到側面不會缺一格一格或一道陡壁（鋸齒）
      const w = smooth(1, 1.1, headR(x, y))
      const z = zOut - hz * (1 - w)
      return { front: z, back: z, lift: 0.25 * keep + (liftOut - 0.25 * keep) * w, bias: w - 1 }
    }
    return { front: zOut, back: zOut, lift: liftOut }
  }
  const backLayer = inflateLayer({ canvas: backCanvas, vb: hairVb, scale: SCALE, step: 1, bulge: 3, maxH: 13, base: hairBack })
  add(new Mesh(backLayer.geometry, toon(backCanvas)))

  // 瀏海：貼著頭往外鼓一點
  const fringeBase = onHead(1.5, 0, { grow: 1.0, thin: 0.6, cover: coverHair })
  const fringeLayer = inflateLayer({ canvas: frontCanvas, vb: frontVb, scale: SCALE, step: 1, bulge: 1.2, maxH: 4, base: fringeBase })
  add(new Mesh(fringeLayer.geometry, toon(frontCanvas)))
  // 頭髮（後層、瀏海）正面最前面的深度；沒有頭髮是 null。硬的單品、面具要放在它前面
  const surfaceFront = (layer: { heightAt: (x: number, y: number) => number }, base: (x: number, y: number) => Surface, x: number, y: number) => {
    const h = layer.heightAt(x, y)
    if (h <= 0) return null
    const s = base(x, y)
    return s.front === null ? null : s.front + h * (1 + (s.bias ?? 0))
  }
  const hairFront = (x: number, y: number): number | null => {
    const b = surfaceFront(backLayer, hairBack, x, y)
    const f = surfaceFront(fringeLayer, fringeBase, x, y)
    return b === null ? f : f === null ? b : Math.max(b, f)
  }

  // 臉上的（在瀏海前面）、頭上的（再前面）
  if (faceItem)
    add(new Mesh(inflateLayer({ canvas: faceItem.canvas, vb: faceItem.vb, scale: SCALE, step: 1, bulge: 1.4, maxH: 5, base: onHead(7, 3, { grow: 1.0, thin: 0.5, cover: headItem?.alpha }) }).geometry, toon(faceItem.canvas)))
  // 頭上的單品正面的深度：側戴的面具要放在它前面
  let headFront: ((x: number, y: number) => number | null) | null = null
  if (headItem) {
    let geo: BufferGeometry
    if (lathe) {
      geo = lathe.geometry
      headFront = lathe.frontAt
    } else {
      // 包住頭的（帽子、頭巾、頭帶、髮箍：橫跨頭的中線或很寬）貼著球面；單側的髮簪、髮夾、髮飾是一片硬的，
      // 各自一個平面貼著頭髮（2026-10-16 回報：頭上的裝飾被拉開——頭的範圍裡貼著球面、外面留在中心平面，交界被扯開）
      const sphere = onHead(9, 2, { grow: 1.04 })
      const { label, parts } = components(headItem.alpha, headItem.vb)
      const planes = parts.map((pts) => {
        let x0 = Infinity
        let x1 = -Infinity
        let sx = 0
        let inHead = 0
        for (const [x, y] of pts) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          sx += x
          if (headZ(x, y, 1.04) !== null) inHead++
        }
        const oneSided = x1 - x0 <= 70 && Math.abs(sx / pts.length - HEAD.cx) >= 18
        if (!oneSided || inHead < pts.length * 0.05) return null
        return rigidPlane(
          pts,
          (x, y) => {
            const hz = headZ(x, y, 1.04)
            const hf = hairFront(x, y)
            const z = Math.max(hz === null ? -Infinity : hz + 4, hf === null ? -Infinity : hf + 2)
            return z === -Infinity ? null : z
          },
          TILT_MAX,
        )
      })
      const base = (x: number, y: number): Surface => {
        const plane = planes[label(x, y)]
        if (!plane) return sphere(x, y)
        const z = plane(x, y)
        return { front: z, back: z, lift: 0.8, bias: 0.6 }
      }
      const layer = inflateLayer({ canvas: headItem.canvas, vb: headItem.vb, scale: SCALE, step: 1, bulge: 3.2, maxH: 15, base })
      geo = layer.geometry
      const ringFront = (x: number, y: number) => rings.reduce<number | null>((m, r) => {
        const f = r.frontAt(x, y)
        return f === null ? m : Math.max(m ?? f, f)
      }, null)
      headFront = (x, y) => {
        const own = surfaceFront(layer, base, x, y)
        const ring = ringFront(x, y)
        return own === null ? ring : ring === null ? own : Math.max(own, ring)
      }
    }
    const { canvas, vb, alpha } = headItem
    const tower = TOWER_HATS.get(equipped.head!)
    // 塔：畫滿的列補成一整圈；其他的列補滿中間的空隙（收在頭裡的塔腳），五重塔的牆旁邊挖空
    const towerRow = (y: number): RowMode => (coversHead(alpha, y) ? 'extend' : tower === 'cut' && y >= HEAD.cy - HEAD.ry ? 'cut' : 'inner')
    const filled = fillRows(canvas, vb, SCALE, tower ? towerRow : undefined)
    const mat = !lathe ? toon(canvas) : tower === 'cut' ? toonCut(filled) : toon(filled)
    add(new Mesh(geo, mat))
    if (rings.length) {
      const filled = fillRows(canvas, vb, SCALE, () => 'extend')
      for (const r of rings) add(new Mesh(r.geometry, toon(filled)))
    }
  }
  if (faceOver) {
    // 側戴的面具是一片硬的、自己微微拱起，不跟著頭的球面彎（2026-10-13 回報：面具戴在頭上會變形）。
    // 平面貼著頭、頭髮、蓋住的帽子（最小平方），最多斜 60 度，整片往前推到都在它們前面
    // （2026-10-16 回報：面具浮在頭的旁邊——原本只照面具中心的斜率、又限 35 度，頭的邊緣掉得比面具快）
    const [vx, vy, vw, vh] = faceOver.vb
    const pts: Pt[] = []
    for (let y = vy; y <= vy + vh; y += 2) for (let x = vx; x <= vx + vw; x += 2) if (faceOver.alpha(x, y) >= 0.5) pts.push([x, y])
    const plane = rigidPlane(
      pts,
      (x, y) => {
        const hz = headZ(x, y, 1.02)
        const hf = hairFront(x, y)
        const tf = headFront?.(x, y) ?? null
        const z = Math.max(hz === null ? -Infinity : hz + 3, hf === null ? -Infinity : hf + 2, tf === null ? -Infinity : tf + 1.5)
        return z === -Infinity ? null : z
      },
      TILT_MAX,
      1 / 160,
    )
    if (plane) {
      const rigid = (x: number, y: number): Surface => {
        const z = plane(x, y)
        return { front: z, back: z, bias: 0.7 }
      }
      add(new Mesh(inflateLayer({ canvas: faceOver.canvas, vb: faceOver.vb, scale: SCALE, step: 1, bulge: 1.4, maxH: 5, base: rigid }).geometry, toon(faceOver.canvas)))
    }
  }

  // 手上的：背面貼著身體表面（附近最高的）、厚度往前長（握在右手；斜背的帶子貼在衣服上，不會埋進身體）；
  // 夥伴：腳邊、比身體再前面
  if (handItem) {
    const z = (x: number, y: number): Surface => {
      const b = near(x, y)
      return { front: b, back: b, bias: 0.6 }
    }
    add(new Mesh(inflateLayer({ canvas: handItem.canvas, vb: handItem.vb, scale: SCALE, step: 1, bulge: 2.4, maxH: 9, base: z }).geometry, toon(handItem.canvas)))
  }
  let buddy: Object3D | null = null
  if (buddyItem) {
    const z = (x: number, y: number): Surface => {
      const b = body.heightAt(x, y) * 0.85 + 8
      return { front: b, back: b }
    }
    buddy = add(new Mesh(inflateLayer({ canvas: buddyItem.canvas, vb: buddyItem.vb, scale: SCALE, step: 1, bulge: 3, maxH: 14, base: z }).geometry, toon(buddyItem.canvas)))
  }

  add(groundShadow())

  return {
    root,
    buddy,
    dispose: () => {
      for (const d of disposables) d.dispose()
    },
  }
}
