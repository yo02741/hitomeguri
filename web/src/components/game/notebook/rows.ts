import type { Ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { rove } from '../../../game/ui/rove'

/**
 * 手帳一頁裡的「列」：標了 data-row 的元素，上下鍵（十字鍵）一列一列移動焦點，不繞回。
 * 每一列的焦點落在列裡 tabindex="0" 的那一個（例：文字速度落在選中的那一個），沒有就是第一個按鈕或連結。
 * 頁面元件用它實作 NotebookPage 的 focusFirst 與上下鍵；左右、A 由頁面自己看是哪一列。
 */
export function useRows(root: Ref<HTMLElement | null>) {
  const rows = (): HTMLElement[] => Array.from(root.value?.querySelectorAll<HTMLElement>('[data-row]') ?? [])

  function target(row: HTMLElement): HTMLElement | null {
    if (row.matches('[tabindex="0"], button, a[href]')) return row
    return row.querySelector<HTMLElement>('[tabindex="0"], button:not([tabindex="-1"]), a[href]')
  }

  /** 焦點在第幾列（不在這一頁 -1） */
  function index(): number {
    const a = document.activeElement
    return a ? rows().findIndex((r) => r.contains(a)) : -1
  }

  /** 焦點所在那一列的 data-row */
  function current(): string | null {
    const r = rows()[index()]
    return r?.dataset.row ?? null
  }

  function focusAt(i: number): boolean {
    const r = rows()[i]
    const t = r ? target(r) : null
    if (!t) return false
    t.focus({ preventScroll: true })
    t.scrollIntoView?.({ block: 'nearest' })
    return true
  }

  const focusFirst = () => focusAt(0)

  /** 上下：移到上一列、下一列；回傳有沒有動 */
  function move(b: Button): boolean {
    if (b !== 'up' && b !== 'down') return false
    const n = rows().length
    if (!n) return false
    const i = index()
    const j = rove(i < 0 ? 0 : i, b, n, { wrap: false })
    if (j === i) return false
    return focusAt(j)
  }

  return { rows, index, current, focusAt, focusFirst, move }
}
