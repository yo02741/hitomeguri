/**
 * 照片放 IndexedDB（規格 §5、§8.4）：自己的資料庫 hitomeguri-game（不跟旅人的 hitomeguri-traveller 共用），
 * 一張一筆 { id, w, h, png: Blob }（PNG 由瀏覽器壓縮，一張幾 KB）。讀寫都包 try/catch；
 * 沒有 IndexedDB（私密視窗、被擋）時只放記憶體，遊戲照樣能玩（關掉頁面就沒了，相簿只剩說明）。
 * 縮圖給 object URL（同一張只做一次，之後一直用同一個）。
 */
export const PHOTO_DB = 'hitomeguri-game'
export const PHOTO_STORE = 'photos'

export interface PhotoRecord {
  id: string
  w: number
  h: number
  png: Blob
}

export interface PhotoStore {
  /** 存進去：記憶體一定有；回傳有沒有也存進 IndexedDB（沒有的話關掉頁面就沒了） */
  put(r: PhotoRecord): Promise<boolean>
  get(id: string): Promise<PhotoRecord | null>
  delete(id: string): Promise<void>
}

/** 記憶體裡的（測試、沒有 IndexedDB 的時候） */
export function memoryPhotos(): PhotoStore & { data: Map<string, PhotoRecord> } {
  const data = new Map<string, PhotoRecord>()
  return {
    data,
    put: async (r) => {
      data.set(r.id, r)
      return true
    },
    get: async (id) => data.get(id) ?? null,
    delete: async (id) => void data.delete(id),
  }
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, bad) => {
    r.onsuccess = () => ok(r.result)
    r.onerror = () => bad(r.error)
  })
}

let dbp: Promise<IDBDatabase | null> | null = null
function openDb(): Promise<IDBDatabase | null> {
  dbp ??= new Promise<IDBDatabase | null>((ok) => {
    try {
      if (typeof indexedDB === 'undefined') return ok(null)
      const r = indexedDB.open(PHOTO_DB, 1)
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(PHOTO_STORE)) r.result.createObjectStore(PHOTO_STORE, { keyPath: 'id' })
      }
      r.onsuccess = () => ok(r.result)
      r.onerror = () => ok(null)
      r.onblocked = () => ok(null)
    } catch {
      ok(null)
    }
  })
  return dbp
}

/** IndexedDB，打不開就落到記憶體 */
export function idbPhotos(): PhotoStore {
  const mem = memoryPhotos()
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
    const db = await openDb()
    if (!db) return null
    try {
      return await req(fn(db.transaction(PHOTO_STORE, mode).objectStore(PHOTO_STORE)))
    } catch {
      return null
    }
  }
  return {
    async put(r) {
      await mem.put(r)
      const ok = await tx('readwrite', (s) => s.put(r))
      return ok !== null
    },
    async get(id) {
      const hit = await mem.get(id)
      if (hit) return hit
      const r = await tx('readonly', (s) => s.get(id) as IDBRequest<PhotoRecord | undefined>)
      if (r && r.png instanceof Blob) {
        await mem.put(r)
        return r
      }
      return null
    },
    async delete(id) {
      await mem.delete(id)
      await tx('readwrite', (s) => s.delete(id))
      revoke(id)
    },
  }
}

let store: PhotoStore | null = null
/** 這一頁共用的一個（測試可以換成 memoryPhotos） */
export function photoStore(): PhotoStore {
  store ??= idbPhotos()
  return store
}
export function setPhotoStore(s: PhotoStore | null) {
  store = s
  for (const id of [...urls.keys()]) revoke(id)
}

// ---------- 縮圖 ----------
const urls = new Map<string, string>()
const pending = new Map<string, Promise<string | null>>()

function revoke(id: string) {
  const u = urls.get(id)
  if (u) {
    try {
      URL.revokeObjectURL(u)
    } catch {
      // 沒有 URL（測試）就算了
    }
  }
  urls.delete(id)
}

/** 已經做好的縮圖（沒有就 undefined，可以先用 loadThumb 去拿） */
export const thumbUrl = (id: string) => urls.get(id)

/** 照片的 object URL（PNG）；沒有這張回 null */
export function loadThumb(id: string): Promise<string | null> {
  const hit = urls.get(id)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(id)
  if (!p) {
    p = photoStore()
      .get(id)
      .then((r) => {
        if (!r || typeof URL === 'undefined' || !URL.createObjectURL) return null
        const u = URL.createObjectURL(r.png)
        urls.set(id, u)
        return u
      })
      .catch(() => null)
      .finally(() => pending.delete(id))
    pending.set(id, p)
  }
  return p
}

// ---------- 像素 → PNG（瀏覽器） ----------
/** Uint32 的像素（0xAABBGGRR）→ PNG；沒有 canvas 時 null */
export async function toPng(px: Uint32Array, w: number, h: number): Promise<Blob | null> {
  try {
    const data = new Uint8ClampedArray(px.buffer.slice(px.byteOffset, px.byteOffset + px.byteLength) as ArrayBuffer)
    const img = new ImageData(data, w, h)
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h)
      c.getContext('2d')?.putImageData(img, 0, 0)
      return await c.convertToBlob({ type: 'image/png' })
    }
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')?.putImageData(img, 0, 0)
    return await new Promise<Blob | null>((ok) => c.toBlob((b) => ok(b), 'image/png'))
  } catch {
    return null
  }
}

/** 存成 PNG（下載）：放大幾倍（照片是 240×160 的點，原尺寸太小） */
export async function downloadPhoto(id: string, name: string, scale = 3): Promise<boolean> {
  const r = await photoStore().get(id)
  if (!r) return false
  try {
    const bmp = await createImageBitmap(r.png)
    const c = document.createElement('canvas')
    c.width = r.w * scale
    c.height = r.h * scale
    const ctx = c.getContext('2d')
    if (!ctx) return false
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((ok) => c.toBlob((b) => ok(b), 'image/png'))
    if (!blob) return false
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return true
  } catch {
    return false
  }
}
