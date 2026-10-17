import { IndexCanvas } from './canvas'
import type { Raster, SpriteSize } from './types'

/**
 * 側面的參數化範本（規格 §7：沒有 WebGL、或 3D 失敗時用）：像 pixelwalk/hero.ts 的旅人，朝左，
 * 顏色換成這隻旅人各圖層的顏色（generate.ts 從正面的點陣、依圖層取最常見的顏色）。比例照尺寸算，16×24 與 20×28 都能畫。
 * 回傳還沒描外框的點陣、眼睛的格子、腿從哪一列開始。
 */
export interface TemplateInk {
  hair: number
  skin: number
  top: number
  topShade: number
  bottom: number
  shoes: number
  /** 有戴帽子才有 */
  hat?: number
  /** 手上有東西才有 */
  hand?: number
  ink: number
}

export function sideTemplate(size: SpriteSize, c: TemplateInk): { raster: Raster; eyes: number[]; legTop: number } {
  const { w, h, cw, ch } = size
  const g = new IndexCanvas(cw, ch)
  const bx = Math.round((cw - w) / 2)
  const by = ch - h
  const ih = h - 2
  const feet = ch - 2
  const cx = bx + Math.floor(w / 2)
  // 頭：chibi 的大頭，約本體高的一半多
  const headH = Math.round(ih * 0.55)
  const headW = Math.max(8, w - 4)
  const top = by + 1
  const hl = cx - Math.floor(headW / 2)
  g.ellipse(hl + (headW - 1) / 2, top + (headH - 1) / 2, (headW - 1) / 2, (headH - 1) / 2, c.hair)
  // 臉：前面（左邊）下半部，頭髮蓋住上面與後面
  const faceTop = top + Math.round(headH * 0.42)
  const faceRight = hl + Math.round(headW * 0.55)
  for (let y = faceTop; y < top + headH; y++) for (let x = hl; x <= faceRight; x++) if (g.at(x, y) === c.hair) g.px(x, y, c.skin)
  // 眼睛：臉的最前面往裡一格
  const eyeY = faceTop + Math.max(1, Math.round(headH * 0.14))
  let front = hl
  while (front < cw && g.at(front, eyeY) !== c.skin) front++
  const eyes: number[] = []
  const eyeRows = h >= 28 ? 2 : 1
  for (let k = 0; k < eyeRows; k++) {
    const i = (eyeY + k) * cw + front + 1
    if (g.at(front + 1, eyeY + k) === c.skin) {
      g.raw[i] = c.ink
      eyes.push(i)
    }
  }
  // 帽子：頭頂幾列、帽簷往前伸
  if (c.hat !== undefined) {
    const hh = Math.max(2, Math.round(headH * 0.32))
    g.ellipse(hl + (headW - 1) / 2, top + hh - 1, (headW + 1) / 2, hh, c.hat, true)
    g.rect(hl - 2, top + hh - 1, Math.ceil(headW / 2) + 2, 1, c.hat)
  }
  // 身體
  const legTop = by + Math.round(h * 0.86)
  const bodyW = Math.max(5, Math.round(w * 0.4))
  const tl = cx - Math.floor(bodyW / 2)
  const torsoTop = top + headH - 1
  g.rect(tl, torsoTop, bodyW, legTop - torsoTop, c.top)
  g.rect(tl + bodyW - 1, torsoTop + 1, 1, legTop - torsoTop - 1, c.topShade)
  // 前面的手臂、手
  g.rect(tl + 1, torsoTop + 1, 2, legTop - torsoTop - 2, c.topShade)
  g.rect(tl + 1, legTop - 1, 2, 1, c.skin)
  if (c.hand !== undefined) g.rect(tl - 2, legTop - 4, 3, 3, c.hand)
  // 腿、鞋（前腳在左）
  g.rect(cx - 2, legTop, 2, feet - legTop, c.bottom)
  g.rect(cx, legTop, 2, feet - legTop, c.bottom)
  g.rect(cx - 3, feet, 5, 1, c.shoes)
  return { raster: g, eyes, legTop }
}
