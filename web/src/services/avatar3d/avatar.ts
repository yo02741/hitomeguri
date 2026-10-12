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
const ROUND_HATS = new Set(['sugegasa', 'achv-jingasa', 'yamagata-hanagasa', 'shizuoka-fuji', 'kagoshima-sakurajima', 'tokushima-amigasa', 'straw-hat', 'bucket-hat', 'school-hat', 'beanie'])

function latheHat(vb: ViewBox, alpha: Cover, hairHalf: (y: number) => number): { geometry: BufferGeometry; cover: Cover } | null {
  const [vx, vy, vw, vh] = vb
  const pts: Vector2[] = []
  // 畫成正面看的帽冠可能比頭窄（草帽、漁夫帽：2D 是透視的樣子），轉一圈後頭和頭髮會從帽冠穿出來：
  // 半徑至少是「頭在那一列的半寬＋6」（瀏海浮在頭上最多約 6px）與「頭髮那一列的半寬＋3」，貼圖照原本的寬度縮放上去
  const headHalf = (y: number) => {
    const v = (y - HEAD.cy) / HEAD.ry
    return Math.abs(v) < 1 ? HEAD.rx * Math.sqrt(1 - v * v) : 0
  }
  const squeeze = new Map<number, number>()
  /** 每一列（紙娃娃的 y，整數）轉成一圈後的半徑：頭髮在這個範圍內要變薄 */
  const radiusAt = new Map<number, number>()
  const rowKey = (wy: number) => Math.round(wy * 1e4)
  let last = { r: 0, y: 0 }
  let widest = 0
  for (let y = vy; y <= vy + vh; y += 1) {
    let l = -1
    let r = -1
    let filled = 0
    let total = 0
    for (let x = vx; x <= vx + vw; x += 0.5) {
      if (alpha(x, y) < 0.5) continue
      if (l < 0) l = x
      r = x
      filled++
    }
    if (l < 0) continue
    total = (r - l) / 0.5 + 1
    const rad = Math.max(0.5, (r - l) / 2)
    // 過了最寬的那一列（帽簷）之後，只剩兩條細線（帽帶）就停：帽帶不轉成一圈
    if (widest && rad < widest && filled / total < 0.4) break
    widest = Math.max(widest, rad)
    const used = Math.max(rad, headHalf(y) + 6, hairHalf(y) + 3)
    if (!pts.length) pts.push(new Vector2(0, worldY(y - 0.5)))
    pts.push(new Vector2(used * PX, worldY(y)))
    squeeze.set(rowKey(worldY(y)), rad / used)
    radiusAt.set(Math.round(y), used)
    last = { r: used, y }
  }
  if (pts.length < 3) return null
  // 帽簷底下往內收回到頭的寬度，帽子是封起來的
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
  return { geometry: geo, cover }
}

/** 圓帽的貼圖：同一列裡透明的地方（例如編笠下面露出臉的缺口）用左右最近的顏色補滿；轉一圈後每個角度都投影得到顏色 */
function rowFill(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { width: W, height: H } = canvas
  const src = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H)
  const d = src.data
  for (let y = 0; y < H; y++) {
    const row = y * W
    let first = -1
    let last = -1
    for (let x = 0; x < W; x++)
      if (d[(row + x) * 4 + 3]! > 160) {
        if (first < 0) first = x
        last = x
      }
    if (first < 0) continue
    let prev = first
    for (let x = first; x <= last; x++) {
      const i = (row + x) * 4
      if (d[i + 3]! > 160) {
        prev = x
        continue
      }
      let next = x + 1
      while (next <= last && d[(row + next) * 4 + 3]! <= 160) next++
      const from = x - prev <= next - x || next > last ? prev : next
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
  const item = async (slot: Slot) => {
    const id = equipped[slot]
    if (!id || !outfitById.has(id)) return null
    const vb = itemBox(id)
    const canvas = await rasterize(svgOf(slot), vb, SCALE, defs)
    return { vb, canvas, alpha: alphaSampler(canvas, vb, SCALE) }
  }
  const [faceItem, headItem, handItem, buddyItem] = await Promise.all([item('face'), item('head'), item('hand'), item('buddy')])
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

  // 圓帽：轉一圈的帽冠要蓋住頭髮，先量每一列頭髮的半寬（頭頂以上不算：雙丸子等不把帽子撐成大圓筒；最多頭寬＋8）
  let lathe: ReturnType<typeof latheHat> = null
  if (headItem && ROUND_HATS.has(equipped.head!)) {
    const ha = [alphaSampler(backCanvas, hairVb, SCALE), alphaSampler(frontCanvas, frontVb, SCALE)]
    const rows = new Map<number, number>()
    const hairHalf = (y: number) => {
      const k = Math.round(y)
      if (k < HEAD.cy - HEAD.ry) return 0
      let r = rows.get(k)
      if (r === undefined) {
        r = 0
        for (let x = 30; x <= 210; x += 1) if (ha.some((a) => a(x, k) >= 0.5)) r = Math.max(r, Math.abs(x - 120))
        r = Math.min(r, HEAD.rx + 8)
        rows.set(k, r)
      }
      return r
    }
    lathe = latheHat(headItem.vb, headItem.alpha, hairHalf)
  }
  // 圓帽轉一圈後比 2D 的帽子寬：頭髮變薄的範圍用轉出來的那一圈
  const coverHair = coverOf(faceItem, lathe ? { alpha: lathe.cover } : headItem)

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
  add(new Mesh(inflateLayer({ canvas: backCanvas, vb: hairVb, scale: SCALE, step: 1, bulge: 3, maxH: 13, base: hairBack }).geometry, toon(backCanvas)))

  // 瀏海：貼著頭往外鼓一點
  add(new Mesh(inflateLayer({ canvas: frontCanvas, vb: frontVb, scale: SCALE, step: 1, bulge: 1.2, maxH: 4, base: onHead(1.5, 0, { grow: 1.0, thin: 0.6, cover: coverHair }) }).geometry, toon(frontCanvas)))

  // 臉上的（在瀏海前面）、頭上的（再前面）
  if (faceItem)
    add(new Mesh(inflateLayer({ canvas: faceItem.canvas, vb: faceItem.vb, scale: SCALE, step: 1, bulge: 1.4, maxH: 5, base: onHead(7, 3, { grow: 1.0, thin: 0.5, cover: headItem?.alpha }) }).geometry, toon(faceItem.canvas)))
  if (headItem) {
    const geo = lathe?.geometry ?? inflateLayer({ canvas: headItem.canvas, vb: headItem.vb, scale: SCALE, step: 1, bulge: 3.2, maxH: 15, base: onHead(9, 2, { grow: 1.04 }) }).geometry
    add(new Mesh(geo, toon(lathe ? rowFill(headItem.canvas) : headItem.canvas)))
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
