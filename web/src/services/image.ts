// 截圖收藏的圖片處理：在瀏覽器裡縮小、壓縮成 data URL，直接存進 Firestore 文件。
// 不用 Cloud Storage（需要 Blaze 方案）。Firestore 一份文件上限 1 MiB，所以原圖壓到 900 KB 以內，
// 另做一張小縮圖放在清單文件裡，gallery 不必載入原圖。

/** 原圖 data URL 的上限（字元數）；firestore.rules 允許到 1,000,000 */
export const FULL_MAX = 900_000
/** 縮圖 data URL 的上限；firestore.rules 允許到 200,000 */
export const THUMB_MAX = 150_000

export interface PreparedImage {
  full: string
  thumb: string
  w: number
  h: number
}

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    return await createImageBitmap(file)
  } catch {
    // 舊版 Safari 等：改用 <img>
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

let webp: boolean | null = null
function supportsWebp(): boolean {
  if (webp === null) {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    webp = c.toDataURL('image/webp').startsWith('data:image/webp')
  }
  return webp
}

function encode(src: CanvasImageSource, w: number, h: number, quality: number): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  // 透明背景的 PNG 轉 JPEG 時會變黑，先鋪白底
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, w, h)
  return c.toDataURL(supportsWebp() ? 'image/webp' : 'image/jpeg', quality)
}

/** 縮到寬 maxW、高 maxH 以內，並壓到 limit 字元以內（先降畫質、再縮小） */
function fit(src: CanvasImageSource, sw: number, sh: number, maxW: number, maxH: number, limit: number, q0: number) {
  let scale = Math.min(1, maxW / sw, maxH / sh)
  for (let i = 0; i < 8; i++) {
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))
    for (const q of [q0, q0 - 0.1, q0 - 0.2]) {
      const out = encode(src, w, h, q)
      if (out.length <= limit) return out
    }
    scale *= 0.8
  }
  throw new Error('image too large')
}

/** 截圖通常是直長的手機畫面：寬最多 1280、高最多 4000，文字還看得清楚 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const src = await decode(file)
  const w = src.width
  const h = src.height
  if (!w || !h) throw new Error('empty image')
  const full = fit(src, w, h, 1280, 4000, FULL_MAX, 0.82)
  const thumb = fit(src, w, h, 480, 1200, THUMB_MAX, 0.72)
  if ('close' in src && typeof src.close === 'function') src.close()
  return { full, thumb, w, h }
}
