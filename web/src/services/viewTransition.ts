import { nextTick } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'

/**
 * 換頁過場（DESIGN.md §9）：換到另一個頁面時用 View Transitions API 淡入淡出；
 * 地圖頁的地區標籤與深度探索頁的標頭用同樣的 view-transition-name，從一個長成另一個。
 * 同一個頁面內只換網址參數（選景點、換縣）不做。瀏覽器不支援或系統設定減少動態時照常換頁。
 */
export function installViewTransitions(router: Router) {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let finish: (() => void) | null = null

  router.beforeResolve((to, from) => {
    if (reduced.matches || !from.matched.length || sameView(to, from)) return
    return new Promise<void>((resolve) => {
      // 先拍下舊畫面，再讓路由換頁；新頁面畫好（afterEach 的下一個 tick）才開始過場
      document.startViewTransition(
        () =>
          new Promise<void>((done) => {
            finish = done
            resolve()
          }),
      )
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

function sameView(a: RouteLocationNormalized, b: RouteLocationNormalized): boolean {
  return a.matched[0]?.components?.default === b.matched[0]?.components?.default
}
