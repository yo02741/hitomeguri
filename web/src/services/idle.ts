/** 瀏覽器空下來時執行；不支援 requestIdleCallback 的瀏覽器稍後執行 */
export function whenIdle(fn: () => void, timeout = 4000) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => fn(), { timeout })
  else setTimeout(fn, 1500)
}
