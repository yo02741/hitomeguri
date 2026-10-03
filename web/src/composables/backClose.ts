import { onBeforeUnmount, watch, type Ref } from 'vue'
import { type Router, useRouter } from 'vue-router'

import { wide } from '../services/viewport'

/**
 * 手機（<1024）的浮層（header 的搜尋列、帳號選單）與返回手勢：
 * - 打開時新增一筆同網址的歷史（history.state.overlay），返回先關浮層，不會直接離開這一頁；
 * - 用取消、Esc、點外面關掉時，自己退回那一筆；
 * - 浮層開著時換頁（點選單裡的連結、選了搜尋結果）：新頁面取代那一筆，返回時不會先回到同一頁。
 * 原生 <dialog>（卡片檢視、截圖）在 Android 會自己處理返回鍵，不用這個。
 */
let seq = 0
let navigating = false
let installed: Router | null = null

function overlayOf(): unknown {
  return (window.history.state as { overlay?: unknown } | null)?.overlay
}

function install(router: Router) {
  if (installed === router) return
  installed = router
  router.beforeEach((to, from) => {
    navigating = true
    // 停在浮層那一筆上換頁：改成 replace（redirectedFrom：已經改過的那一次不再改）。
    // replace 會沿用原本的 history.state，overlay 要明確清掉
    if (overlayOf() && to.fullPath !== from.fullPath && !to.redirectedFrom) {
      return { path: to.path, query: to.query, hash: to.hash, replace: true, state: { overlay: null } }
    }
  })
  router.afterEach(() => {
    navigating = false
  })
  router.onError(() => {
    navigating = false
  })
}

export function useBackClose(open: Ref<boolean>, close: () => void) {
  const router = useRouter()
  install(router)
  const id = ++seq
  const mine = () => overlayOf() === id

  watch(open, (on) => {
    if (on) {
      if (wide.value || mine()) return
      const r = router.currentRoute.value
      void router.push({ path: r.path, query: r.query, hash: r.hash, force: true, state: { overlay: id } })
      return
    }
    // 關掉的同一次點擊可能也在換頁（選單裡的連結）：等導航開始後再看，沒有換頁才退回浮層那一筆
    window.setTimeout(() => {
      if (!navigating && mine()) router.back()
    }, 0)
  })

  function onPop() {
    if (open.value && !mine()) close()
  }
  window.addEventListener('popstate', onPop)
  onBeforeUnmount(() => window.removeEventListener('popstate', onPop))
}
