import { ref } from 'vue'
import type { Router } from 'vue-router'

/**
 * 頁面程式載入失敗（各頁是分開下載的）：離線時沒有快取到的頁，或部署之後還開著的舊分頁要的舊檔名。
 * 原本點了完全沒有反應。
 * - 在線上：重新載入一次目標網址（拿到新版的檔案）；同一個網址只重載一次，避免一直重載。
 * - 離線：AppUpdate 的位置顯示一行「離線中，無法開啟這一頁」，連上網路或換頁成功就收起。
 */
export const pageLoadError = ref<'offline' | 'failed' | null>(null)

const KEY = 'hitomeguri:page-reload'
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk/i

export function isPageLoadError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return CHUNK_ERROR.test(msg)
}

/** 這個網址是不是已經重載過一次；記不住（無痕模式等）時當成重載過，不冒一直重載的險 */
function reloadedFor(href: string, key = KEY): boolean {
  try {
    return sessionStorage.getItem(key) === href
  } catch {
    return true
  }
}
function remember(href: string | null, key = KEY) {
  try {
    if (href) sessionStorage.setItem(key, href)
    else sessionStorage.removeItem(key)
  } catch {
    // 存不了就算了
  }
}

/**
 * 不走 router 的程式檔讀不到時（番外篇坐車到東京、北海道時才讀的 kit 檔，部署之後舊分頁要的舊檔名）：
 * 同一個網址重載一次（key 預設跟 router 的錯誤用同一個記號；番外篇用自己的，router 換頁成功時才不會被清掉）。
 * 已經重載過、或記不住時回 false（不冒一直重載的險）。
 */
export function reloadOnce(href: string, key = KEY): boolean {
  if (typeof window === 'undefined' || reloadedFor(href, key)) return false
  remember(href, key)
  window.location.assign(href)
  return true
}
/** 讀到了（重載有用）：下次再讀不到時可以再重載一次 */
export function forgetReload(key = KEY) {
  remember(null, key)
}

export function installPageLoadErrors(router: Router) {
  if (typeof window === 'undefined') return
  router.onError((err, to) => {
    if (!isPageLoadError(err)) return
    if (!navigator.onLine) {
      pageLoadError.value = 'offline'
      return
    }
    const href = router.resolve(to).href
    if (!reloadedFor(href)) {
      remember(href)
      window.location.assign(href)
      return
    }
    pageLoadError.value = 'failed'
  })
  router.afterEach((_to, _from, failure) => {
    if (failure) return
    pageLoadError.value = null
    remember(null)
  })
  window.addEventListener('online', () => {
    if (pageLoadError.value === 'offline') pageLoadError.value = null
  })
}
