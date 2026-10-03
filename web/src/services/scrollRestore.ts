import { nextTick } from 'vue'
import type { Router } from 'vue-router'

/**
 * 換頁的捲動位置。整站共用 App.vue 的 <main> 捲動，瀏覽器與 router 的 scrollBehavior 只管 window，都不會處理它：
 * - 換到另一頁（push、replace 到別的路徑）時回到頂端；
 * - 返回、往前（popstate）時回到那一筆歷史離開時的位置；
 * - 帶 #hash 的交給頁面自己的 scrollSpy；只換 query（地圖上選景點）不動。
 * 位置以 vue-router 的 history.state.position 為鍵，存在這個分頁的 sessionStorage，重新整理後返回也找得回來。
 * 深度探索頁用自己的內層捲動，不在這裡處理。
 */
const STORE_KEY = 'hitomeguri:scroll'
const RESTORE_MS = 2000

function load(): Map<number, number> {
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (raw) return new Map(JSON.parse(raw) as [number, number][])
  } catch {
    // 讀不到就從空的開始
  }
  return new Map()
}

export function installScrollRestore(router: Router, getMain: () => HTMLElement | null) {
  if (typeof window === 'undefined') return
  const saved = load()
  const entryKey = (): number => {
    const pos = (history.state as { position?: unknown } | null)?.position
    return typeof pos === 'number' ? pos : -1
  }
  // 畫面上正在顯示的那一筆歷史；popstate 時 history.state 已經換成目的地，所以自己記
  let shown = -1
  let popped = false
  window.addEventListener('popstate', () => (popped = true))

  function persist() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify([...saved]))
    } catch {
      // 存不了就只在記憶體裡
    }
  }

  router.beforeEach(() => {
    const main = getMain()
    if (main && shown >= 0) {
      saved.set(shown, main.scrollTop)
      persist()
    }
  })

  let cancel: (() => void) | null = null
  function scrollTo(main: HTMLElement, top: number) {
    cancel?.()
    main.scrollTop = top
    if (top === 0 || Math.abs(main.scrollTop - top) < 1) return
    // 資料還在載入、頁面還不夠高：等內容長出來再補，最多 2 秒；使用者一動手就停
    const until = performance.now() + RESTORE_MS
    let raf = 0
    const stop = () => {
      cancelAnimationFrame(raf)
      for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) main.removeEventListener(ev, stop)
      cancel = null
    }
    for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) main.addEventListener(ev, stop, { passive: true })
    cancel = stop
    const step = () => {
      main.scrollTop = top
      if (Math.abs(main.scrollTop - top) < 1 || performance.now() > until) stop()
      else raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }

  router.afterEach(async (to, from, failure) => {
    const pop = popped
    popped = false
    if (failure) return
    shown = entryKey()
    if (!pop && saved.delete(shown)) persist() // 新的一筆歷史（或 replace）：這個鍵以前存的位置作廢，離開時再存
    let top: number
    if (pop && saved.has(shown)) top = saved.get(shown)!
    else if (to.hash || to.path === from.path) return
    else top = 0
    await nextTick()
    const main = getMain()
    if (main) scrollTo(main, top)
  })
}
