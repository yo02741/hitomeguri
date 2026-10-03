/** 瀏覽器空下來時執行；不支援 requestIdleCallback 的瀏覽器稍後執行 */
export function whenIdle(fn: () => void, timeout = 4000) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => fn(), { timeout })
  else setTimeout(fn, 1500)
}

/** 下一個畫面畫出來之後執行：先讓按下去的狀態（篩選鈕）畫出來，再做比較重的更新（地圖） */
export function afterPaint(fn: () => void) {
  requestAnimationFrame(() => setTimeout(fn, 0))
}
