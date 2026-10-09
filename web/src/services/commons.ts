// Wikimedia Commons 的照片網址。
// 原圖（upload.wikimedia.org/wikipedia/commons/a/ab/File.jpg）常被限流（429）或被 Chrome 的 ORB 擋下，
// 一律換成縮圖網址（thumb.wikimedia.org/…/thumb/a/ab/File.jpg/<寬>px-File.jpg），寬度只用 Commons 的標準寬度。
// 原圖比要的寬度小時縮圖會失敗：依序退回小一號的寬度，最後才用原圖（commonsCandidates）。

export const COMMONS_THUMB_PREFIX = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'
const COMMONS_ORIGINAL_PREFIX = 'https://upload.wikimedia.org/wikipedia/commons/'

export const COMMONS_WIDTHS = [250, 330, 500, 960, 1280, 1920] as const
export type CommonsWidth = (typeof COMMONS_WIDTHS)[number]

// 縮圖檔名照原圖：點陣圖同名；SVG 轉成 PNG（File.svg → 500px-File.svg.png）。其他（TIFF、PDF…）不做縮圖
const RASTER = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
const ORIGINAL_RE = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/
const THUMB_RE = /^https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/commons\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)\/\d+px-([^/]+)$/

/**
 * 檔名段的編碼和 Commons API 給的一樣（encodeURIComponent，`;` 是 %3B、`,` 是 %2C）：
 * 已經編碼過的不再編一次；沒編碼的字元（`;`、空白、括號外的符號）補上。縮圖名與資料夾名用同一個編碼。
 */
export function encodeCommonsName(name: string): string {
  let raw = name
  try {
    raw = decodeURIComponent(name)
  } catch {
    // 不是合法的百分比編碼（單獨的 %）：當成原文
  }
  return encodeURIComponent(raw.replaceAll(' ', '_')).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function thumbOf(a: string, ab: string, name: string, width: number): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const enc = encodeCommonsName(name)
  if (RASTER.has(ext)) return `${COMMONS_THUMB_PREFIX}${a}/${ab}/${enc}/${width}px-${enc}`
  if (ext === 'svg') return `${COMMONS_THUMB_PREFIX}${a}/${ab}/${enc}/${width}px-${enc}.png`
  return null
}

/** Commons 縮圖換成指定寬度；原圖網址換成縮圖網址。不是 Commons 的網址（或不能縮圖的檔案）原樣回傳。 */
export function commonsThumb(url: string, width: CommonsWidth): string {
  const base = url.split('?', 1)[0]
  const t = THUMB_RE.exec(base)
  if (t) return thumbOf(t[1], t[2], t[3], width) ?? base
  const o = ORIGINAL_RE.exec(base)
  if (o) return thumbOf(o[1], o[2], o[3], width) ?? url
  return url
}

/** Commons 照片的原圖網址（縮圖網址反推；本來就是原圖就原樣）；不是 Commons 的網址回傳 null */
export function commonsOriginal(url: string): string | null {
  const base = url.split('?', 1)[0]
  const t = THUMB_RE.exec(base)
  if (t) return `${COMMONS_ORIGINAL_PREFIX}${t[1]}/${t[2]}/${t[3]}`
  return ORIGINAL_RE.test(base) ? base : null
}

/** 依序要試的網址：要的寬度 → 更小的標準寬度 → 原圖。不是 Commons 的網址只有它自己 */
export function commonsCandidates(url: string, width: CommonsWidth): string[] {
  const orig = commonsOriginal(url)
  if (!orig) return [url]
  const smaller = COMMONS_WIDTHS.filter((w) => w < width).reverse()
  return [...new Set([width, ...smaller].map((w) => commonsThumb(url, w)).concat(orig))]
}

/** 畫面上 cssWidth 寬的照片要用的標準寬度（乘上 devicePixelRatio，取第一個夠大的；最大 1920） */
export function commonsWidthFor(cssWidth: number, dpr: number, widths: readonly CommonsWidth[] = [500, 960, 1280, 1920]): CommonsWidth {
  const need = cssWidth * (dpr || 1)
  return widths.find((w) => w >= need) ?? widths[widths.length - 1]!
}
