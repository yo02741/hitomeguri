import type { BufferGeometry, Material, Mesh, Object3D } from 'three'

import { type Chibi, CHIBI, DOLL, type Frame } from './geometry'
import { readImage, yieldMain } from './draw2d'
import type { TravellerLook } from './types'

/**
 * 側面（規格 §7）：用 3D 旅人（services/avatar3d/avatar.ts 的 buildAvatar），拿掉夥伴與地上的影子，
 * 頂點照 2D 的 chibi 變形（脖子附近平滑接起來），正交鏡頭轉 90 度（朝左），只開環境光 π（顏色就是貼圖原本的顏色）。
 * three.js 與 3D 旅人只在這裡動態載入，遊戲本身不帶 three。沒有 WebGL、或哪裡失敗就回 null（改用參數化範本）。
 */
type Three = typeof import('./three3d')

/** 紙娃娃 px → 3D 的單位（inflate.ts 的 PX：頭的半徑 54px ≈ 1） */
const PXW = 1 / 54
/**
 * 前後的厚度再放大一點：3D 旅人是 2D 剪影充氣的，身體很薄，轉到側面只剩 3–4px 寬的一條；
 * 像素畫的側面要看得出身體，身體 ×1.6、頭 ×1.1（只影響側面，正面、背面是 2D）
 */
const DEPTH = { body: 1.6, head: 1.1 }
/**
 * 轉幾度：正側面（90 度）時頭髮兩側（妹妹頭、長髮）會把臉整個蓋住，只剩 1px 的皮膚、放不下眼睛；
 * 少轉一點（約 73 度）臉頰露出來，像 GBA 的側面那樣看得到眼睛與臉
 */
export const SIDE_YAW = -(Math.PI / 2 - 0.3)

/** 每個 mesh 的變換烤進頂點，再照 chibi 變形：脖子以上 ×kh（以脖子為中心）、以下寬 ×kbx 高 ×kb；脖子上下 8px 平滑過去 */
function chibiWarp(T: Three, root: Object3D, c: Chibi): BufferGeometry[] {
  const neck = (DOLL.feet - DOLL.neck) * PXW
  const neckN = neck * c.kb
  const band = 8 * PXW
  const made: BufferGeometry[] = []
  root.updateMatrixWorld(true)
  const v = new T.Vector3()
  root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    const geo = m.geometry.clone()
    made.push(geo)
    geo.applyMatrix4(m.matrixWorld)
    const p = geo.attributes.position!
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const t = Math.min(1, Math.max(0, (v.y - (neck - band)) / (2 * band)))
      const k = t * t * (3 - 2 * t)
      const bx = v.x * c.kbx
      const by = v.y * c.kb
      const bz = v.z * c.kbx * DEPTH.body
      const hx = v.x * c.kh
      const hy = neckN + (v.y - neck) * c.kh
      const hz = v.z * c.kh * DEPTH.head
      p.setXYZ(i, bx + (hx - bx) * k, by + (hy - by) * k, bz + (hz - bz) * k)
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
    m.geometry = geo
    m.position.set(0, 0, 0)
    m.rotation.set(0, 0, 0)
    m.scale.set(1, 1, 1)
  })
  return made
}

let broken = false
let probed: boolean | null = null

/**
 * WebGL 的 renderer 留著用一陣子：第一次畫要編譯 shader（軟體算圖的機器上約 1 秒），
 * 換衣服再生成時就不用重編。30 秒沒用就放掉（一頁只占一個 WebGL context）。
 */
const KEEP_MS = 30_000
let shared: { r: import('three').WebGLRenderer; timer: number } | null = null
function rendererOf(T: Three): import('three').WebGLRenderer {
  if (shared) {
    clearTimeout(shared.timer)
    return shared.r
  }
  const r = new T.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true })
  r.outputColorSpace = T.SRGBColorSpace
  r.setPixelRatio(1)
  r.setClearColor(0, 0)
  shared = { r, timer: 0 }
  return r
}
function releaseLater() {
  if (!shared) return
  clearTimeout(shared.timer)
  shared.timer = window.setTimeout(dropRenderer, KEEP_MS)
}
function dropRenderer() {
  if (!shared) return
  clearTimeout(shared.timer)
  shared.r.dispose()
  shared.r.forceContextLoss()
  shared = null
}
/**
 * 這個瀏覽器能不能用 WebGL（先用一個小 canvas 試，不載 three.js）；3D 失敗過一次，這一次開頁面就不再試。
 */
export function canRender3D(): boolean {
  if (broken) return false
  if (probed !== null) return probed
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null
    probed = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    probed = false
  }
  return probed
}

/** 這張圖有沒有畫出東西（WebGL 掉了、讀回來是空的就算失敗） */
function hasPixels(img: ImageData): boolean {
  const d = img.data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i]! > 200 && ++n > 40) return true
  return false
}

/**
 * 朝左的側面大圖：frames 每一個都畫一張（大小 cw·F × ch·F，跟 2D 的大圖對得起來）。
 * equipped 不帶夥伴；傘類（頭頂的疊加 sprite）由呼叫的人先拿掉。
 */
export async function renderSide3D(look: TravellerLook, frames: Frame[], F: number, timings?: Record<string, number>, isStale: () => boolean = () => false): Promise<ImageData[] | null> {
  if (!canRender3D()) return null
  let mark = performance.now()
  const tm = (k: string) => {
    const t = performance.now()
    if (timings) timings[k] = Math.round((timings[k] ?? 0) + (t - mark))
    mark = t
  }
  let T: Three
  let A: typeof import('../../services/avatar3d/avatar')
  try {
    ;[T, A] = await Promise.all([import('./three3d'), import('../../services/avatar3d/avatar')])
  } catch {
    return null
  }
  tm('3d-load')
  let av: Awaited<ReturnType<typeof A.buildAvatar>> | null = null
  let made: BufferGeometry[] = []
  let failed = false
  try {
    const renderer = rendererOf(T)
    const eq = { ...look.equipped }
    delete eq.buddy
    av = await A.buildAvatar(look.parts, eq)
    tm('3d-build')
    // 分段做：建模、變形、每一張畫之間讓出主執行緒（遊戲照常跑）；外觀又改了就放棄（不把舊的做完）
    await yieldMain()
    if (isStale()) return null
    // 地上的影子（遊戲自己畫）
    const drop: Object3D[] = []
    av.root.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && m.geometry.type === 'CircleGeometry' && (m.material as Material).transparent) drop.push(o)
    })
    for (const o of drop) o.parent?.remove(o)
    // 畫得很小（每格 8×8 細格再多數決），貼圖不用 mipmap：省掉上傳時產生 mipmap（軟體算圖時很慢）
    av.root.traverse((o) => {
      const m = o as Mesh
      const map = m.isMesh ? (m.material as Material & { map?: import('three').Texture | null }).map : null
      if (map) {
        map.generateMipmaps = false
        map.minFilter = T.LinearFilter
        map.needsUpdate = true
      }
    })
    made = chibiWarp(T, av.root, CHIBI)
    tm('3d-warp')
    await yieldMain()
    if (isStale()) return null
    const scene = new T.Scene()
    const light = new T.AmbientLight()
    light.intensity = Math.PI
    scene.add(light)
    const holder = new T.Group()
    holder.add(av.root)
    holder.rotation.y = SIDE_YAW
    scene.add(holder)
    const out: ImageData[] = []
    for (const fr of frames) {
      if (isStale()) return null
      const w = fr.size.cw * F
      const h = fr.size.ch * F
      renderer.setSize(w, h, false)
      const cam = new T.OrthographicCamera(
        (fr.x0 - DOLL.cx) * PXW,
        (fr.x0 + fr.vw - DOLL.cx) * PXW,
        (DOLL.feet - fr.y0) * PXW,
        (DOLL.feet - fr.y0 - fr.vh) * PXW,
        0.1,
        100,
      )
      cam.position.set(0, 0, 20)
      cam.lookAt(0, 0, 0)
      renderer.render(scene, cam)
      const img = readImage(renderer.domElement, w, h)
      tm('3d-render')
      if (!hasPixels(img)) {
        broken = failed = true
        return null
      }
      out.push(img)
      await yieldMain()
    }
    return out
  } catch (e) {
    broken = failed = true
    if (import.meta.env?.DEV) console.warn('traveller：3D 側面畫不出來，改用範本', e)
    return null
  } finally {
    for (const g of made) g.dispose()
    av?.dispose()
    if (failed) dropRenderer()
    else releaseLater()
  }
}
