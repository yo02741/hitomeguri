import { VIEW_H, VIEW_H_MAX, VIEW_W_MAX, VIEW_W_MIN } from '../engine/types'

/**
 * /play 的版面（規格 §2、§3）：畫面整數倍放大，倍數取放得進「可用的寬、高」的最大整數；
 * 寬照可用寬算（176–240，桌機是 240）。可用範圍依版面扣掉控制區與返回列：
 * - desktop：有鍵盤／滑鼠，沒有觸控按鈕，畫面置中（上面留返回列），GBA 的比例（高 160）
 * - portrait：手機直拿，畫面在上、下面是十字鍵與 A/B；窄而高的螢幕：倍數照寬算，邏輯高照可用高度變高
 *   （160–256，寬照舊），控制區貼在下面，中間不空一大段
 * - landscape：手機打橫，十字鍵與 A/B 分到畫面兩側，高 160；可用高度放不下 2 倍時（工具列佔掉一些）
 *   用非整數倍（1.75 倍這種，四分之一一級，pixelated 照舊），不掉到 1 倍
 */
export type Layout = 'desktop' | 'portrait' | 'landscape'

/** 返回列的高（desktop、portrait 在畫面上面留這麼多） */
export const TOP_BAR = 44
/** 直拿時下面控制區至少要的高（十字鍵 3×48、START 列、上下留白） */
export const PAD_H = 236
/** 打橫時兩側控制區各要的寬 */
export const PAD_W = 156
/** 桌機下緣留白 */
const DESK_BOTTOM = 24
export const MAX_SCALE = 5

export function layoutOf(w: number, h: number, touch: boolean): Layout {
  if (!touch) return 'desktop'
  return w > h ? 'landscape' : 'portrait'
}

/** 畫面能用的寬高（CSS px） */
export function available(w: number, h: number, layout: Layout): { w: number; h: number } {
  if (layout === 'portrait') return { w, h: h - TOP_BAR - PAD_H }
  if (layout === 'landscape') return { w: w - PAD_W * 2, h }
  return { w, h: h - TOP_BAR - DESK_BOTTOM }
}

export interface Fit {
  /** 倍數（整數 1–5；打橫放不下 2 倍時是四分之一一級的非整數） */
  scale: number
  /** 邏輯寬（176–240） */
  width: number
  /** 邏輯高（160；直拿時 160–256） */
  height: number
}

export function fitScreen(w: number, h: number, layout: Layout): Fit {
  const a = available(w, h, layout)
  let s = MAX_SCALE
  while (s > 1 && (VIEW_W_MIN * s > a.w || VIEW_H * s > a.h)) s--
  let scale = s
  if (layout === 'landscape' && VIEW_H * 2 > a.h) {
    const q = Math.floor((a.h / VIEW_H) * 4) / 4
    if (q > 1 && VIEW_W_MIN * q <= a.w) scale = q
  }
  const width = Math.max(VIEW_W_MIN, Math.min(VIEW_W_MAX, Math.floor(a.w / scale)))
  const height = layout === 'portrait' ? Math.max(VIEW_H, Math.min(VIEW_H_MAX, Math.floor(a.h / scale))) : VIEW_H
  return { scale, width, height }
}
