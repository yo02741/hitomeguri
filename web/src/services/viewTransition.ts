import { nextTick } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'

/**
 * 換頁過場（DESIGN.md §9）：換到另一個頁面時用 View Transitions API 淡入淡出；
 * 地圖頁的地區標籤與深度探索頁的標頭用同樣的 view-transition-name，從一個長成另一個。
 * 換縣（點了縣名、地區標籤、全國）時，新的地區色像墨水從點的位置暈開（data-vt="ink"，theme.css）；
 * 拖曳地圖跨縣、選景點不做。瀏覽器不支援或系統設定減少動態時照常換頁。
 *
 * 過場期間瀏覽器把整頁換成過場的截圖，點擊都落在 <html> 上（CSS 的 pointer-events 擋不掉），
 * 換到地圖頁時過場會拖到一秒以上，看起來就是「按了沒反應」。所以過場中一按下就結束過場，
 * 記下指標底下真正的元素，這次的 click 落在 <html> 時轉給它。
 */
export function installViewTransitions(router: Router) {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const root = document.documentElement
  let finish: (() => void) | null = null
  let active: ViewTransition | null = null
  let replay: { el: Element; x: number; y: number } | null = null
  window.addEventListener(
    'pointerdown',
    (e) => {
      replay = null
      if (!active) return
      active.skipTransition()
      active = null
      if (e.target !== root) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (el && el !== root) replay = { el, x: e.clientX, y: e.clientY }
    },
    true,
  )
  window.addEventListener(
    'click',
    (e) => {
      const r = replay
      replay = null
      if (!r || e.target !== root || !r.el.isConnected) return
      e.stopImmediatePropagation()
      r.el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.x, clientY: r.y, button: 0, detail: 1 }))
    },
    true,
  )
  // 最近一次點擊：換縣是點出來的才暈開（拖曳地圖不會觸發 click）
  let lastClick = { t: -Infinity, x: 0, y: 0 }
  window.addEventListener('click', (e) => (lastClick = { t: performance.now(), x: e.clientX, y: e.clientY }), true)

  router.beforeResolve((to, from) => {
    if (reduced.matches || !from.matched.length) return
    const same = sameView(to, from)
    const ink = same && prefOf(to) !== prefOf(from) && performance.now() - lastClick.t < 600
    if (same && !ink) return
    if (ink) {
      root.style.setProperty('--vt-x', `${lastClick.x}px`)
      root.style.setProperty('--vt-y', `${lastClick.y}px`)
      root.dataset.vt = 'ink'
    } else delete root.dataset.vt
    return new Promise<void>((resolve) => {
      // 先拍下舊畫面，再讓路由換頁；新頁面畫好（afterEach 的下一個 tick）才開始過場
      const t = document.startViewTransition(
        () =>
          new Promise<void>((done) => {
            finish = done
            resolve()
          }),
      )
      active = t
      void t.finished.finally(() => {
        if (active === t) active = null
        delete root.dataset.vt
      })
    })
  })
  router.afterEach(async () => {
    const done = finish
    finish = null
    if (!done) return
    await nextTick()
    done()
  })
  router.onError(() => {
    finish?.()
    finish = null
  })
}

function prefOf(r: RouteLocationNormalized): string | null {
  return typeof r.params.pref === 'string' ? r.params.pref : null
}

function sameView(a: RouteLocationNormalized, b: RouteLocationNormalized): boolean {
  return a.matched[0]?.components?.default === b.matched[0]?.components?.default
}
