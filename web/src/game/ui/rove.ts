import type { Button } from '../engine/input'

/**
 * 選單的游標（roving focus）：方向鍵、十字鍵、Home／End 在一排或一格一格的選項裡移動。
 * 純函式，回傳新的索引；這個方向在這種排法裡沒有意義、或到邊了（不繞回）就回傳原本的。
 */
export type RoveKey = 'up' | 'down' | 'left' | 'right' | 'home' | 'end'

export interface RoveOpts {
  /** vertical：上下；horizontal：左右；grid：cols 欄一格一格 */
  orientation?: 'vertical' | 'horizontal' | 'grid'
  cols?: number
  /** 到頭再按就繞到另一頭（預設 true） */
  wrap?: boolean
}

export function rove(i: number, key: RoveKey, n: number, o: RoveOpts = {}): number {
  if (n <= 0) return -1
  const cur = Math.max(0, Math.min(n - 1, i))
  const wrap = o.wrap ?? true
  const orient = o.orientation ?? 'vertical'
  if (key === 'home') return 0
  if (key === 'end') return n - 1
  const step = (d: number) => {
    const j = cur + d
    if (j >= 0 && j < n) return j
    return wrap ? (j + n) % n : cur
  }
  if (orient === 'vertical') return key === 'up' ? step(-1) : key === 'down' ? step(1) : cur
  if (orient === 'horizontal') return key === 'left' ? step(-1) : key === 'right' ? step(1) : cur
  // grid：左右在同一列裡走（不跨列），上下同一欄（最後一列不滿時落在最後一格）
  const cols = Math.max(1, o.cols ?? 1)
  const rows = Math.ceil(n / cols)
  const r = Math.floor(cur / cols)
  const c = cur % cols
  const rowLen = r === rows - 1 ? n - r * cols : cols
  if (key === 'left') return c > 0 ? cur - 1 : wrap ? r * cols + rowLen - 1 : cur
  if (key === 'right') return c < rowLen - 1 ? cur + 1 : wrap ? r * cols : cur
  let nr = key === 'up' ? r - 1 : r + 1
  if (nr < 0 || nr >= rows) {
    if (!wrap) return cur
    nr = (nr + rows) % rows
  }
  return Math.min(n - 1, nr * cols + c)
}

/** 遊戲的按鍵 → 游標的方向（不是方向就 null） */
export function roveKeyOf(b: Button): RoveKey | null {
  return b === 'up' || b === 'down' || b === 'left' || b === 'right' ? b : null
}
