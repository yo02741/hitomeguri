import type { Dir } from './types'

/**
 * 存檔（規格 §5）：localStorage 一份 JSON，key「hitomeguri:game:v1:<uid 或 guest>」。讀寫都包 try/catch；
 * 讀到壞掉的、版本不認得的就當沒有（不會當掉），欄位型別不對的換成預設值。50 KB 以內。
 * 照片、旅人 sprite 的快取不在這裡（IndexedDB）。
 */
export const SAVE_VERSION = 1
export const SAVE_LIMIT = 50 * 1024

export type FlagValue = boolean | number | string

export interface GameSettings {
  /** 一直跑（按住 B 反而是走） */
  alwaysRun: boolean
  /** 對話的字：一般（約每秒 40 字）、快、直接出現 */
  textSpeed: 'normal' | 'fast' | 'instant'
  /** 戶外走路時，現實 1 秒＝遊戲幾分鐘 */
  timeRate: number
}

export const DEFAULT_SETTINGS: GameSettings = { alwaysRun: false, textSpeed: 'normal', timeRate: 1 }

export interface SaveData {
  v: number
  /** 世界生成器的版本（P2）：變了就把玩家放回起點，東西與旗標保留 */
  gen: number
  map: string
  x: number
  y: number
  dir: Dir
  flags: Record<string, FlagValue>
  /** 現金（円；P3 以前的存檔是「文」，systems/wallet.ts 的 ensureYen 換算） */
  money: number
  /** 行李：品項 id → 數量 */
  items: Record<string, number>
  /** 印（蓋過的章 id） */
  stamps: string[]
  /** 房間擺設（P2） */
  room: Record<string, unknown>
  calendar: { y: number; m: number; d: number; min: number }
  settings: GameSettings
  /** 已看過的告示牌（實體 id） */
  seen: string[]
  /** 相簿索引（照片 id；照片在 IndexedDB） */
  album: string[]
  /** 其他系統自己的狀態（P2：委託、聽來的…），每個系統一個 key */
  ext: Record<string, unknown>
  savedAt: number
}

export interface SaveStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export const saveKey = (uid?: string | null) => `hitomeguri:game:v${SAVE_VERSION}:${uid || 'guest'}`

/** 瀏覽器的 localStorage（私密視窗、關掉網站資料時讀寫會丟錯：當作沒有） */
export const localStore: SaveStorage = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // 滿了、被擋：這次沒存到
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // 同上
    }
  },
}

/** 記憶體裡的（測試、沒有 localStorage 的時候） */
export function memoryStore(init: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  const data = { ...init }
  return {
    data,
    get: (k) => data[k] ?? null,
    set: (k, v) => void (data[k] = v),
    remove: (k) => void delete data[k],
  }
}

const DIRSET = new Set(['up', 'down', 'left', 'right'])
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const int = (v: unknown, d: number) => Math.round(num(v, d))
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** 文字 → 存檔；壞掉的、不是存檔的、以後版本的回 null（不丟錯） */
export function parseSave(raw: string | null | undefined): SaveData | null {
  if (!raw) return null
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(o) || typeof o.v !== 'number' || o.v < 1 || o.v > SAVE_VERSION) return null
  const flags: Record<string, FlagValue> = {}
  if (isObj(o.flags)) for (const [k, v] of Object.entries(o.flags)) if (typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) flags[k] = v
  const items: Record<string, number> = {}
  if (isObj(o.items)) for (const [k, v] of Object.entries(o.items)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) items[k] = Math.round(v)
  const cal = isObj(o.calendar) ? o.calendar : {}
  const set = isObj(o.settings) ? o.settings : {}
  const speed = set.textSpeed
  return {
    v: SAVE_VERSION,
    gen: int(o.gen, 0),
    map: typeof o.map === 'string' ? o.map : '',
    x: int(o.x, -1),
    y: int(o.y, -1),
    dir: typeof o.dir === 'string' && DIRSET.has(o.dir) ? (o.dir as Dir) : 'down',
    flags,
    money: Math.max(0, int(o.money, 0)),
    items,
    stamps: strs(o.stamps),
    room: isObj(o.room) ? o.room : {},
    calendar: { y: int(cal.y, 2026), m: int(cal.m, 1), d: int(cal.d, 1), min: int(cal.min, 9 * 60) },
    settings: {
      alwaysRun: typeof set.alwaysRun === 'boolean' ? set.alwaysRun : DEFAULT_SETTINGS.alwaysRun,
      textSpeed: speed === 'normal' || speed === 'fast' || speed === 'instant' ? speed : DEFAULT_SETTINGS.textSpeed,
      timeRate: Math.max(0, Math.min(60, num(set.timeRate, DEFAULT_SETTINGS.timeRate))),
    },
    seen: strs(o.seen),
    album: strs(o.album),
    ext: isObj(o.ext) ? o.ext : {},
    savedAt: num(o.savedAt, 0),
  }
}

export function readSave(store: SaveStorage, key: string): SaveData | null {
  return parseSave(store.get(key))
}

/** 寫進去；回傳寫了多大。超過 50 KB 時先把最舊的「看過的告示牌」裁掉（相簿索引不動） */
export function writeSave(store: SaveStorage, key: string, data: SaveData): { ok: boolean; bytes: number } {
  let json = JSON.stringify(data)
  if (json.length > SAVE_LIMIT && data.seen.length > 200) {
    json = JSON.stringify({ ...data, seen: data.seen.slice(-200) })
  }
  const bytes = new TextEncoder().encode(json).length
  try {
    store.set(key, json)
    // localStore 自己吞掉錯誤：讀回來確認
    return { ok: store.get(key) === json, bytes }
  } catch {
    return { ok: false, bytes }
  }
}
