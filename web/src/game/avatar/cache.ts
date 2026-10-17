import { GEN_VERSION } from './version'
import type { GameRecord, RgbFrame, SpriteSize, TravellerLook, TravellerRecord, WalkerRecord } from './types'

/**
 * 旅人 sprite 的快取（規格 §7）：記憶體＋IndexedDB（每個動作都包 try/catch；沒有 IndexedDB 就只放記憶體）。
 * key：`v{產生器版本}:{尺寸}:{hash}`，hash 是外觀（膚色、髮型、髮色、眼睛、各位置穿的 id）＋紙娃娃顏色 token 的指紋
 * （theme.css 改了顏色會換一個 key，不會一直用舊的顏色）。
 * 另外在 localStorage 放「這台裝置上這個人的旅人」的指標（uid → 兩組的 key），給 /about 的像素散步讀
 * （/about 不打 Firestore、不載 three.js，只讀這個指標與 IndexedDB；讀的程式在 services/pixelwalk/traveller.ts）。
 * 不存 Firestore。
 */
export const DB_NAME = 'hitomeguri-traveller'
export const DB_STORE = 'sprites'
export const DB_VERSION = 1
/** 最多留幾筆（換衣服會一直產生新的） */
const KEEP = 8
export const POINTER_PREFIX = 'hitomeguri:traveller:v1:'

// ---------- key ----------
/** FNV-1a 32 位元 → 36 進位 */
export function hashString(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/** 外觀的簽名：順序固定，沒穿的是空字串 */
export function lookSignature(look: TravellerLook): string {
  const { parts: p, equipped: e } = look
  return JSON.stringify([p.skin, p.hair, p.hairColor, p.eyes, e.head ?? '', e.face ?? '', e.body ?? '', e.hand ?? '', e.buddy ?? ''])
}

export function cacheKey(size: SpriteSize, look: TravellerLook, fingerprint = '', gen = GEN_VERSION): string {
  return `v${gen}:${size.w}x${size.h}:${hashString(lookSignature(look) + '|' + fingerprint)}`
}

/** 紙娃娃顏色 token 的指紋（瀏覽器裡讀 :root；node 裡是空的） */
export function colourFingerprint(): string {
  if (typeof document === 'undefined') return ''
  const cs = getComputedStyle(document.documentElement)
  const names: string[] = []
  for (let i = 1; i <= 6; i++) names.push(`--color-doll-skin-${i}`)
  for (let i = 1; i <= 9; i++) names.push(`--color-doll-hair-${i}`)
  names.push('--color-doll-line', '--color-doll-blush', '--color-gold-2', '--color-px-ink')
  for (const k of ['red', 'pink', 'green', 'matcha', 'blue', 'navy', 'yellow', 'orange', 'brown', 'cream', 'white', 'grey', 'purple']) names.push(`--color-item-${k}`)
  return hashString(names.map((n) => cs.getPropertyValue(n).trim()).join(','))
}

// ---------- 檢查（讀回來的東西不可信：壞了、舊格式就當沒有） ----------
export function validFrame(f: unknown): f is RgbFrame {
  const s = f as RgbFrame | null
  if (!s || typeof s.w !== 'number' || typeof s.h !== 'number' || !(s.idx instanceof Uint8Array) || !Array.isArray(s.rgb)) return false
  if (s.w < 1 || s.h < 1 || s.w > 64 || s.h > 64 || s.idx.length !== s.w * s.h || s.rgb.length > 255) return false
  if (!s.rgb.every((c) => Array.isArray(c) && c.length === 3 && c.every((v) => typeof v === 'number' && v >= 0 && v <= 255))) return false
  for (let i = 0; i < s.idx.length; i++) if (s.idx[i]! > s.rgb.length) return false
  return true
}
const validTriple = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every(validFrame)
const validBuddy = (b: unknown) => b === null || (typeof b === 'object' && validFrame((b as { sprite?: unknown }).sprite))
const validOverhead = (o: unknown) => o === null || (typeof o === 'object' && validFrame((o as { sprite?: unknown }).sprite) && typeof (o as { x?: unknown }).x === 'number')

export function validRecord(r: unknown): r is TravellerRecord {
  const x = r as { [K in keyof GameRecord | keyof WalkerRecord]?: unknown } | null
  if (!x || x.fmt !== 1 || typeof x.key !== 'string' || !validBuddy(x.buddy ?? null) || !validOverhead(x.overhead ?? null)) return false
  if (x.kind === 'game') return validTriple(x.down) && validTriple(x.up) && validTriple(x.left)
  if (x.kind === 'walk')
    return (
      Array.isArray(x.walk) &&
      x.walk.length === 4 &&
      x.walk.every(validFrame) &&
      Array.isArray(x.stand) &&
      x.stand.length === 2 &&
      x.stand.every(validFrame) &&
      validFrame(x.jump) &&
      Array.isArray(x.camera)
    )
  return false
}

// ---------- 存放 ----------
export interface KV {
  get(key: string): Promise<unknown>
  put(key: string, value: unknown): Promise<void>
  /** 只留最新的 keep 筆（依 at） */
  prune(keep: number): Promise<void>
}

/** 測試用 */
export function memoryKV(): KV & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>()
  return {
    map,
    get: async (k) => map.get(k),
    put: async (k, v) => void map.set(k, v),
    prune: async (keep) => {
      const all = [...map.entries()].sort((a, b) => ((b[1] as { at?: number }).at ?? 0) - ((a[1] as { at?: number }).at ?? 0))
      for (const [k] of all.slice(keep)) map.delete(k)
    },
  }
}

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((ok, bad) => {
    r.onsuccess = () => ok(r.result)
    r.onerror = () => bad(r.error)
  })

/** IndexedDB（打不開就每次都回 undefined、寫不進去就算了） */
export function idbKV(): KV {
  let db: Promise<IDBDatabase | null> | null = null
  const open = () =>
    (db ??= new Promise<IDBDatabase | null>((ok) => {
      try {
        if (typeof indexedDB === 'undefined') return ok(null)
        const r = indexedDB.open(DB_NAME, DB_VERSION)
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE)
        }
        r.onsuccess = () => ok(r.result)
        r.onerror = () => ok(null)
        r.onblocked = () => ok(null)
      } catch {
        ok(null)
      }
    }))
  const store = async (mode: IDBTransactionMode) => {
    const d = await open()
    return d ? d.transaction(DB_STORE, mode).objectStore(DB_STORE) : null
  }
  return {
    async get(key) {
      try {
        const s = await store('readonly')
        return s ? await req(s.get(key)) : undefined
      } catch {
        return undefined
      }
    },
    async put(key, value) {
      try {
        const s = await store('readwrite')
        if (s) await req(s.put(value, key))
      } catch {
        // 空間不夠、私密瀏覽：只放記憶體
      }
    },
    async prune(keep) {
      try {
        const s = await store('readwrite')
        if (!s) return
        const keys = (await req(s.getAllKeys())) as string[]
        if (keys.length <= keep) return
        const rows = await Promise.all(keys.map(async (k) => ({ k, at: ((await req(s.get(k))) as { at?: number } | undefined)?.at ?? 0 })))
        rows.sort((a, b) => b.at - a.at)
        await Promise.all(rows.slice(keep).map((r) => req(s.delete(r.k))))
      } catch {
        // 清不掉就下次再清
      }
    },
  }
}

/** 記憶體＋KV 的兩層快取 */
export class SpriteCache {
  private readonly mem = new Map<string, TravellerRecord>()
  private readonly kv: KV

  constructor(kv: KV) {
    this.kv = kv
  }

  /** 先找記憶體，再找 KV；回傳是從哪裡來的 */
  async get(key: string): Promise<{ rec: TravellerRecord; from: 'memory' | 'idb' } | null> {
    const m = this.mem.get(key)
    if (m) return { rec: m, from: 'memory' }
    const v = await this.kv.get(key)
    if (!validRecord(v) || v.key !== key) return null
    this.mem.set(key, v)
    return { rec: v, from: 'idb' }
  }

  async put(rec: TravellerRecord) {
    this.mem.set(rec.key, rec)
    await this.kv.put(rec.key, rec)
    await this.kv.prune(KEEP)
  }
}

let shared: SpriteCache | null = null
/** 整個 app 共用一份（IndexedDB） */
export const travellerCache = () => (shared ??= new SpriteCache(idbKV()))

// ---------- /about 用的指標 ----------
export interface Pointer {
  game: string
  about: string
  at: number
}

export function writePointer(uid: string, p: Omit<Pointer, 'at'>) {
  try {
    localStorage.setItem(POINTER_PREFIX + uid, JSON.stringify({ ...p, at: Date.now() }))
  } catch {
    // 存不了：/about 照舊用預設的旅人
  }
}

export function readPointer(uid: string): Pointer | null {
  try {
    const v = JSON.parse(localStorage.getItem(POINTER_PREFIX + uid) ?? 'null') as Partial<Pointer> | null
    return v && typeof v.game === 'string' && typeof v.about === 'string' ? { game: v.game, about: v.about, at: Number(v.at) || 0 } : null
  } catch {
    return null
  }
}
