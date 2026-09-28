// 地圖照片預先下載：閒置時在背景依序抓 Commons 縮圖進瀏覽器快取，
// 之後地圖上出現照片時不必等。一次最多 4 張、低優先度；省流量模式下不做。

import { mapThumbUrl } from './bundles'

const CONCURRENCY = 4
const queued = new Set<string>()
const queue: string[] = []
let active = 0

function saveData(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(conn?.saveData)
}

function pump() {
  while (active < CONCURRENCY && queue.length) {
    const url = queue.shift()!
    active++
    const img = new Image()
    img.referrerPolicy = 'no-referrer'
    img.decoding = 'async'
    ;(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low'
    img.onload = img.onerror = () => {
      active--
      pump()
    }
    img.src = url
  }
}

/**
 * 依給定順序排入下載佇列（已排過的略過）。thumbs 為 map bundle 的 `i` 欄位。
 * front：插到佇列最前面（目前正在看的地區）。
 */
export function prefetchThumbs(thumbs: string[], front = false) {
  if (typeof window === 'undefined' || saveData()) return
  const fresh: string[] = []
  for (const t of thumbs) {
    const url = mapThumbUrl(t)
    if (queued.has(url)) continue
    queued.add(url)
    fresh.push(url)
  }
  if (front) queue.unshift(...fresh)
  else queue.push(...fresh)
  const start = () => pump()
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2000 })
  else setTimeout(start, 500)
}
