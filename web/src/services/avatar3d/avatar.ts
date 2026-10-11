import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
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
} from 'three'

import { EYES, HAIR, outfitById, type Slot } from '../../data/outfits'
import type { AvatarParts } from '../../stores/avatar'
import { layerGeometry, PX, type Surface, worldX, worldY } from './inflate'
import { patternDefs, rasterize, resolveVars, type ViewBox } from './raster'

/**
 * 3D 旅人（DESIGN.md §7.24a）：紙娃娃的美術直接變成立體的軟膠公仔。
 * - 頭是真的球（橢球），臉（眼睛、嘴、腮紅）貼在球面上。
 * - 身體、衣服、手腳：2D 剪影充氣成圓鼓鼓的一塊，正面貼原本的畫，背面同一張。
 * - 頭髮、頭上的、臉上的：在頭的範圍裡貼著球面、往外鼓一點；超出頭的部分（髮尾、帽頂）充氣成一片。
 * - 手上的：在右手的位置充氣；夥伴：腳邊稍前面。
 * 顏色、花紋、單品全部沿用 2D 的資料（outfits.ts、theme.css 的 token），不另外建模，163 件都能穿。
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
const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)))
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
function toon(map: Texture, extra: Partial<MeshToonMaterial> = {}): MeshToonMaterial {
  return new MeshToonMaterial({ map, gradientMap: gradientMap(), alphaTest: 0.5, side: DoubleSide, ...extra })
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** 平面上的一片：前後以 z 為中心 */
const plane =
  (z = 0) =>
  (): Surface => ({ front: z, back: z })
/** 貼著頭的一層：頭的範圍內只有正面（離球面 lift），越靠近頭的邊緣鼓得越多；出了頭就是平面、鼓滿的一塊 */
const onHead =
  (lift: number, grow = 1.02, thin = 0.3) =>
  (x: number, y: number): Surface => {
    const z = headZ(x, y, grow)
    return z === null ? { front: 0, back: 0 } : { front: z + lift, back: null, lift: thin + (1 - thin) * smooth(0.7, 1, headR(x, y)) }
  }
/** 頭髮後層：頭的範圍內只有背面（包住後腦），頭以外是蓬鬆的一塊；髮尾往下時退到身體後面 */
const hairBack = (x: number, y: number): Surface => {
  const z = headZ(x, y, 1.04)
  if (z !== null) return { front: null, back: -(z + 1), lift: 0.5 }
  const t = Math.min(1, Math.max(0, (y - 130) / 40))
  const zz = -2 - 16 * t
  return { front: zz, back: zz }
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

/** 單品的範圍：小圖的 viewBox 往外留一點 */
function itemBox(id: string): ViewBox {
  const o = outfitById.get(id)!
  const [x, y, w, h] = o.icon.split(/\s+/).map(Number) as [number, number, number, number]
  return [x - 8, y - 8, w + 16, h + 16]
}

export async function buildAvatar(parts: AvatarParts, equipped: Partial<Record<Slot, string>>): Promise<Avatar3D> {
  const local = { '--skin': `var(--color-doll-skin-${parts.skin})`, '--hair': `var(--color-doll-hair-${parts.hairColor})` }
  const defs = resolveVars(patternDefs(), local)
  const svgOf = (slot: Slot) => (equipped[slot] ? resolveVars(outfitById.get(equipped[slot]!)?.svg ?? '', local) : '')
  const skin = css(`--color-doll-skin-${parts.skin}`)
  const SCALE = 4

  const root = new Group()
  const disposables: Array<{ dispose: () => void }> = []
  const add = (parent: Object3D, mesh: Mesh) => {
    parent.add(mesh)
    disposables.push(mesh.geometry)
    const m = mesh.material as Material & { map?: Texture | null }
    disposables.push(m)
    if (m.map) disposables.push(m.map)
    return mesh
  }

  // 身體＋衣服（手上的、夥伴另外做）
  const bodyVb: ViewBox = [48, 132, 144, 156]
  const bodyCanvas = await rasterize(resolveVars(bodySvg(skin, svgOf('body')), local), bodyVb, SCALE, defs)
  add(root, new Mesh(layerGeometry({ canvas: bodyCanvas, vb: bodyVb, scale: SCALE, step: 1.25, bulge: 4.4, maxH: 28, base: plane(0) }), toon(texture(bodyCanvas))))

  // 頭
  const head = new Mesh(new SphereGeometry(1, 64, 48), new MeshToonMaterial({ color: new Color(skin), gradientMap: gradientMap() }))
  head.scale.set(HEAD.rx * PX, HEAD.ry * PX, HEAD.rz * PX)
  head.position.set(worldX(HEAD.cx), worldY(HEAD.cy), 0)
  add(root, head)
  const faceVb: ViewBox = [66, 44, 108, 112]
  add(root, faceMesh(await rasterize(resolveVars(faceSvg(EYES[parts.eyes] ?? EYES.round), local), faceVb, 6, defs), faceVb))

  // 頭髮：後層、瀏海
  const hair = HAIR[parts.hair] ?? HAIR.bob
  const hairVb: ViewBox = [30, 14, 180, 250]
  const backCanvas = await rasterize(resolveVars(hair.back, local), hairVb, SCALE, defs)
  add(root, new Mesh(layerGeometry({ canvas: backCanvas, vb: hairVb, scale: SCALE, step: 1, bulge: 3, maxH: 13, base: hairBack }), toon(texture(backCanvas))))
  const frontVb: ViewBox = [40, 20, 160, 150]
  const frontCanvas = await rasterize(resolveVars(hair.front, local), frontVb, SCALE, defs)
  add(root, new Mesh(layerGeometry({ canvas: frontCanvas, vb: frontVb, scale: SCALE, step: 1, bulge: 1.2, maxH: 4, base: onHead(1.5, 1.0, 0.6) }), toon(texture(frontCanvas))))

  // 單品
  const item = async (slot: Slot, base: (x: number, y: number) => Surface, bulge: number, maxH: number) => {
    const id = equipped[slot]
    if (!id || !outfitById.has(id)) return null
    const vb = itemBox(id)
    const canvas = await rasterize(svgOf(slot), vb, SCALE, defs)
    return add(root, new Mesh(layerGeometry({ canvas, vb, scale: SCALE, step: 1, bulge, maxH, base }), toon(texture(canvas))))
  }
  await item('face', onHead(4, 1.0, 0.5), 1.2, 4)
  await item('head', onHead(6, 1.04), 3, 14)
  await item('hand', plane(0), 2.4, 9)
  const buddy = await item('buddy', plane(10), 3, 14)

  add(root, groundShadow())

  return {
    root,
    buddy,
    dispose: () => {
      for (const d of disposables) d.dispose()
    },
  }
}
