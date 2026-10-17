import type { Raster } from './types'

/**
 * 小小的索引畫布（-1 透明）：傘、側面範本這種「用畫的」sprite，直接畫調色盤的索引，
 * 畫完交給 pixelize.ts 的 outline 描邊。座標都是整數格。
 */
export class IndexCanvas implements Raster {
  readonly w: number
  readonly h: number
  readonly raw: Int16Array

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.raw = new Int16Array(w * h).fill(-1)
  }

  px(x: number, y: number, v: number) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.raw[y * this.w + x] = v
  }

  rect(x: number, y: number, w: number, h: number, v: number) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.px(xx, yy, v)
  }

  /** 實心橢圓；half：只畫上半（含中線） */
  ellipse(cx: number, cy: number, rx: number, ry: number, v: number, half = false) {
    for (let dy = -Math.round(ry); dy <= (half ? 0 : Math.round(ry)); dy++) {
      const t = 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))
      const dx = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, t)))
      for (let x = -dx; x <= dx; x++) this.px(cx + x, cy + dy, v)
    }
  }

  at(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.raw[y * this.w + x]!
  }
}
