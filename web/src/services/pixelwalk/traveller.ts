import { packRgb, type Rgb, type TimeOfDay, tintRgb, type Tokens } from './palette'

/**
 * 散步的旅人換成「你的旅人」（規格 §7）：讀番外篇（/play）生成時順便存的快取。
 * 這裡只讀：localStorage 的指標（uid → key）＋IndexedDB 的那一筆；不打 Firestore、不載 three.js、不 import 遊戲。
 * 格式由 game/avatar/cache.ts 寫（常數兩邊一樣，game/avatar/cache.test.ts 對過）；讀不到、格式不對就回 null（照舊用 hero.ts 的旅人）。
 * 顏色是旅人自己的 SVG 解析出來的 RGB，畫的時候照時段用 tintRgb 換色（跟 makePalette 同一套）。
 */
export const TRAVELLER_DB = 'hitomeguri-traveller'
export const TRAVELLER_STORE = 'sprites'
export const TRAVELLER_DB_VERSION = 1
export const TRAVELLER_POINTER = 'hitomeguri:traveller:v1:'

/** 存起來的一格：idx 0 透明、1 起算，rgb 是調色盤 */
export interface RgbCell {
  w: number
  h: number
  idx: Uint8Array
  rgb: Rgb[]
}

/** 換好三個時段顏色的一格 */
export interface SkinFrame {
  w: number
  h: number
  idx: Uint8Array
  /** 最上面有東西的一列（傘、頭上的符號對齊用） */
  top: number
  lut: Record<TimeOfDay, Uint32Array>
}

export type Facing = 'left' | 'right' | 'front'

/** 散步用的旅人（朝右）：走 4、站 2（第 2 格眨眼）、跳 1；拿相機的位置；自己的傘；夥伴 */
export interface HeroSkin {
  w: number
  h: number
  box: [number, number, number, number]
  walk: SkinFrame[]
  stand: SkinFrame[]
  jump: SkinFrame
  camera: [number, number]
  overhead: { frame: SkinFrame; x: number; dy: number } | null
  buddy: { frame: SkinFrame; facing: Facing } | null
}

const TIMES: TimeOfDay[] = ['day', 'dusk', 'night']

function validCell(c: unknown): c is RgbCell {
  const s = c as RgbCell | null
  if (!s || typeof s.w !== 'number' || typeof s.h !== 'number' || !(s.idx instanceof Uint8Array) || !Array.isArray(s.rgb)) return false
  if (s.w < 1 || s.h < 1 || s.w > 64 || s.h > 64 || s.idx.length !== s.w * s.h || s.rgb.length > 255) return false
  if (!s.rgb.every((x) => Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === 'number' && v >= 0 && v <= 255))) return false
  for (let i = 0; i < s.idx.length; i++) if (s.idx[i]! > s.rgb.length) return false
  return true
}

function cell(c: RgbCell, tokens: Tokens): SkinFrame {
  let top = c.h
  for (let i = 0; i < c.idx.length; i++)
    if (c.idx[i]) {
      top = Math.floor(i / c.w)
      break
    }
  const lut = {} as Record<TimeOfDay, Uint32Array>
  for (const t of TIMES) {
    const l = new Uint32Array(c.rgb.length + 1)
    c.rgb.forEach((x, i) => (l[i + 1] = packRgb(tintRgb(x, tokens, t))))
    lut[t] = l
  }
  return { w: c.w, h: c.h, idx: c.idx, top, lut }
}

/** IndexedDB 讀回來的一筆 → HeroSkin（不對就 null） */
export function skinFromRecord(rec: unknown, tokens: Tokens): HeroSkin | null {
  const r = rec as Record<string, unknown> | null
  if (!r || r.fmt !== 1 || r.kind !== 'walk') return null
  const walk = r.walk as unknown[]
  const stand = r.stand as unknown[]
  if (!Array.isArray(walk) || walk.length !== 4 || !walk.every(validCell)) return null
  if (!Array.isArray(stand) || stand.length !== 2 || !stand.every(validCell) || !validCell(r.jump)) return null
  const w = Number(r.w)
  const h = Number(r.h)
  const box = r.box as number[]
  const cam = r.camera as number[]
  if (!(w > 0 && h > 0) || !Array.isArray(box) || box.length !== 4 || !Array.isArray(cam) || cam.length !== 2) return null
  try {
    const o = r.overhead as { sprite?: unknown; x?: unknown; dy?: unknown } | null
    const b = r.buddy as { sprite?: unknown; facing?: unknown } | null
    const facing: Facing = b?.facing === 'left' || b?.facing === 'right' ? b.facing : 'front'
    return {
      w,
      h,
      box: box.map(Number) as HeroSkin['box'],
      walk: walk.map((c) => cell(c, tokens)),
      stand: stand.map((c) => cell(c, tokens)),
      jump: cell(r.jump, tokens),
      camera: [Number(cam[0]) || 0, Number(cam[1]) || 0],
      overhead: o && validCell(o.sprite) ? { frame: cell(o.sprite, tokens), x: Number(o.x) || 0, dy: Number(o.dy) || 0 } : null,
      buddy: b && validCell(b.sprite) ? { frame: cell(b.sprite, tokens), facing } : null,
    }
  } catch {
    // 顏色 token 讀不懂之類：照舊
    return null
  }
}

/** 這台裝置上這個人的旅人（/about 的 key）：沒有就 null */
export function pointerKey(uid: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(TRAVELLER_POINTER + uid) ?? 'null') as { about?: unknown } | null
    return v && typeof v.about === 'string' && v.about ? v.about : null
  } catch {
    return null
  }
}

/** IndexedDB 讀一筆。資料庫還不存在（從沒進過 /play）就不建，直接回 null */
function readIdb(key: string): Promise<unknown> {
  return new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') return ok(null)
      const r = indexedDB.open(TRAVELLER_DB, TRAVELLER_DB_VERSION)
      r.onupgradeneeded = () => r.transaction?.abort()
      r.onerror = () => ok(null)
      r.onblocked = () => ok(null)
      r.onsuccess = () => {
        const db = r.result
        try {
          if (!db.objectStoreNames.contains(TRAVELLER_STORE)) {
            db.close()
            return ok(null)
          }
          const g = db.transaction(TRAVELLER_STORE, 'readonly').objectStore(TRAVELLER_STORE).get(key)
          g.onsuccess = () => {
            ok(g.result ?? null)
            db.close()
          }
          g.onerror = () => {
            ok(null)
            db.close()
          }
        } catch {
          db.close()
          ok(null)
        }
      }
    } catch {
      ok(null)
    }
  })
}

/** 登入的人：讀他在這台裝置上的旅人（沒有、讀不到就 null） */
export async function readTravellerSkin(uid: string, tokens: Tokens): Promise<HeroSkin | null> {
  const key = pointerKey(uid)
  if (!key) return null
  const rec = await readIdb(key)
  const r = rec as { key?: unknown } | null
  return r && r.key === key ? skinFromRecord(rec, tokens) : null
}
