import { type App, createApp } from 'vue'

import { patternDefs, rasterize, resolveVars, type ViewBox } from '../../services/avatar3d/raster'

import { layerFilters } from './compose'

/**
 * 瀏覽器裡把 SVG 畫成大圖（要 DOM canvas）：沿用 3D 旅人的 rasterize（var(--…) 換成算好的顏色、DollDefs 的花紋寫回屬性）。
 * 花紋在 DollDefs.vue 裡（App 只在登入後才掛），頁面上沒有就自己掛一份看不見的。
 */
let defs: { app: App; el: HTMLElement } | null = null
let users = 0

/** 確定頁面上有紙娃娃的花紋（DollDefs）；回傳的函式在不用的時候叫 */
export async function ensureDollDefs(): Promise<() => void> {
  users++
  let released = false
  const release = () => {
    if (released) return
    released = true
    users--
    if (users <= 0 && defs) {
      defs.app.unmount()
      defs.el.remove()
      defs = null
      users = 0
    }
  }
  if (defs || document.querySelector('pattern[id^="doll-"]')) return release
  try {
    const DollDefs = (await import('../../components/DollDefs.vue')).default
    if (!defs && !document.querySelector('pattern[id^="doll-"]')) {
      const el = document.createElement('div')
      el.setAttribute('aria-hidden', 'true')
      document.body.append(el)
      const app = createApp(DollDefs)
      app.mount(el)
      defs = { app, el }
    }
  } catch {
    // 下載不到：沒有花紋的衣服畫成平塗（照樣能用）
  }
  return release
}

/** canvas → 指定大小的 ImageData（大圖剛好是 w·F × h·F，縮放只有零點幾的誤差） */
export function readImage(canvas: HTMLCanvasElement, w: number, h: number): ImageData {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(canvas, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/**
 * 一段紙娃娃的 SVG → w×h 的 ImageData。vb 是紙娃娃座標的範圍，scale 是每個紙娃娃 px 幾個像素。
 * ids：圖層代碼那一趟，加上代碼色的濾鏡。
 */
export async function drawDoll(inner: string, local: Record<string, string>, vb: ViewBox, scale: number, w: number, h: number, ids = false): Promise<ImageData> {
  const d = resolveVars(patternDefs(), local) + (ids ? layerFilters() : '')
  const canvas = await rasterize(resolveVars(inner, local), vb, scale, d)
  return readImage(canvas, w, h)
}

/** 讓出主執行緒一下（生成分好幾段做，遊戲的畫面不會卡） */
export const yieldMain = () => new Promise<void>((r) => setTimeout(r, 0))

/** 閒下來再做（requestIdleCallback，最多等 timeout 毫秒；沒有就 setTimeout） */
export function whenIdle(timeout = 1200): Promise<void> {
  return new Promise((r) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => r(), { timeout })
    else setTimeout(r, 120)
  })
}
