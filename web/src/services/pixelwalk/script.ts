import type { Script } from './types'

/**
 * 執行一段腳本（generator）：yield 秒數等那麼久、yield null 等一格、yield 函式等到它回傳 true。
 * 腳本丟錯就停掉那一段（開發時印出來），不影響其他的。
 */
export class Runner {
  done = false
  private wait = 0
  private until: (() => boolean) | null = null

  private readonly gen: Script
  readonly kind: 'main' | 'ambient' | 'transition'
  readonly id: string

  constructor(gen: Script, kind: 'main' | 'ambient' | 'transition', id: string) {
    this.gen = gen
    this.kind = kind
    this.id = id
  }

  step(dt: number) {
    if (this.done) return
    try {
      if (this.wait > 0) {
        this.wait -= dt
        if (this.wait > 0) return
      }
      if (this.until) {
        if (!this.until()) return
        this.until = null
      }
      for (let guard = 0; guard < 64; guard++) {
        const r = this.gen.next()
        if (r.done) {
          this.done = true
          return
        }
        const v = r.value
        if (typeof v === 'number') {
          if (v > 0) this.wait = v
          return
        }
        if (typeof v === 'function') {
          if (v()) continue
          this.until = v
          return
        }
        return
      }
    } catch (e) {
      this.done = true
      if (import.meta.env?.DEV) console.warn(`pixelwalk：腳本 ${this.id} 停了`, e)
    }
  }

  stop() {
    if (this.done) return
    this.done = true
    try {
      this.gen.return(undefined)
    } catch {
      // 停的時候腳本自己丟錯就算了
    }
  }
}
