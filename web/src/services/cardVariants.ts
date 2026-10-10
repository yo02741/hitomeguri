/**
 * 收集卡的樣式（DESIGN.md §7.19a）：像寶可夢卡同一隻有基本卡、全圖卡、特別插畫卡，
 * 同一個景點也有好幾種樣式。每一種都有固定的拿法：
 * - 基本：去過就有
 * - 季節（春夏秋冬）：去的那天是什麼季節就有那一張（看日期）；沒去過的季節用抽獎券抽（只抽得到季節卡）
 * - 全景：這個景點在一趟已結束的行程裡（自動）。照片鋪滿整張卡，照片用那趟的季節
 * - 夜景：勾「晚上去過」。只有找得到真的夜景照片（season_images.night）的景點才有
 * - 墨繪：勾「拿到御朱印」（寺社）或「寫了旅日記」（其他景點）
 * - 切手：勾「蓋了紀念章或寄了明信片」
 * - 特別全景：紀念卡。這個景點其他樣式都有了才有，卡面印上去過的日期、行程、收齊的各樣式小章；不能抽
 * 勾選（任務）存在 Firestore users/{uid}/cards/{spotId} 的 t；抽到的季節存在 v（stores/cards.ts）。
 * 全景以外的樣式都由現在的紀錄算出來：取消勾選、刪掉行程，那張卡（和紀念卡）就跟著拿掉。
 * 以前的銀箔、金箔、抽到的全景等代號讀到時略過。
 * 測試期（UNLIMITED_DRAWS）不扣抽獎券；正式上線前改成 false 並清空所有人的 users/{uid}/cards。
 */
export const UNLIMITED_DRAWS = true

export type VariantKind = 'base' | 'season' | 'full' | 'night' | 'sumi' | 'stamp' | 'special'
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
/** 照片的種類：四季或夜景（data/spots 的 season_images） */
export type PhotoKey = SeasonKey | 'night'
/** 景點的任務（勾選）：夜景＝晚上去過、切手＝紀念章或明信片、墨繪＝御朱印或旅日記 */
export type TaskKey = 'night' | 'stamp' | 'ink'
export const TASK_KEYS: readonly TaskKey[] = ['night', 'stamp', 'ink']

/** 紀念卡（特別全景）卡面上的紀錄 */
export interface MemorialRecord {
  /** 去過的日期（舊到新，不含沒填日期的） */
  dates: string[]
  /** 包含這個景點、已結束的行程名稱 */
  trip?: string
  /** 收齊的各樣式（小章）：季節、夜景、墨繪、切手、全景的 key */
  stamps: string[]
}

export interface Variant {
  kind: VariantKind
  season?: SeasonKey
  /** base、full、special、season-spring… */
  key: string
  label: string
  /** 越大越稀有：收集冊顯示最稀有的那張 */
  rank: number
  /** 卡面照片：季節卡是自己的季節；全景是那趟行程的季節；夜景卡固定是夜景 */
  photo?: PhotoKey
  /** 紀念卡的紀錄（只有 special） */
  record?: MemorialRecord
}

export const SEASON_LABEL: Record<SeasonKey, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
export const SEASON_ORDER: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter']

const BASE: Variant = { kind: 'base', key: 'base', label: '基本', rank: 0 }
const FULL: Variant = { kind: 'full', key: 'full', label: '全景', rank: 2 }
const NIGHT: Variant = { kind: 'night', key: 'night', label: '夜景', rank: 2, photo: 'night' }
const SUMI: Variant = { kind: 'sumi', key: 'sumi', label: '墨繪', rank: 2 }
const STAMP: Variant = { kind: 'stamp', key: 'stamp', label: '切手', rank: 2 }
const SPECIAL: Variant = { kind: 'special', key: 'special', label: '特別全景', rank: 4 }
export function seasonVariant(s: SeasonKey): Variant {
  return { kind: 'season', season: s, key: `season-${s}`, label: `${SEASON_LABEL[s]}景`, rank: 1, photo: s }
}
const BY_KEY = new Map<string, Variant>([BASE, FULL, NIGHT, SUMI, STAMP, SPECIAL].map((v) => [v.key, v]))
const PHOTO_KEYS: PhotoKey[] = [...SEASON_ORDER, 'night']
/** 任務 → 樣式 */
const TASK_VARIANT: Record<TaskKey, Variant> = { night: NIGHT, stamp: STAMP, ink: SUMI }

/** 存檔用的代號：season-spring（只存抽到的季節） */
export function encodeVariant(v: Variant): string {
  return v.photo && v.kind !== 'season' ? `${v.key}@${v.photo}` : v.key
}
/** 代號 → 樣式；以前的銀箔、金箔等已經沒有的樣式回傳 undefined */
export function decodeVariant(code: string): Variant | undefined {
  const [key, photo] = code.split('@') as [string, PhotoKey | undefined]
  if (key.startsWith('season-')) {
    const s = key.slice(7) as SeasonKey
    return SEASON_ORDER.includes(s) ? seasonVariant(s) : undefined
  }
  const v = BY_KEY.get(key)
  if (!v) return undefined
  // 夜景卡永遠用夜景照片
  if (v.kind === 'night') return v
  return photo && PHOTO_KEYS.includes(photo) ? { ...v, photo } : v
}

/** 存著的代號裡還算數的：只有抽到的季節卡（以前抽到的全景、銀箔、金箔等略過） */
export function drawnSeasons(codes: Iterable<string>): SeasonKey[] {
  const out = new Set<SeasonKey>()
  for (const c of codes) {
    const v = decodeVariant(c)
    if (v?.kind === 'season' && v.season) out.add(v.season)
  }
  return SEASON_ORDER.filter((s) => out.has(s))
}

/** 存著的任務裡還算數的（不認得的略過、不重複） */
export function cleanTasks(list: Iterable<unknown>): TaskKey[] {
  const have = new Set(list)
  return TASK_KEYS.filter((k) => have.has(k))
}

export function seasonOfMonth(month: number): SeasonKey {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}
const seasonOfDate = (d: string | null | undefined): SeasonKey | undefined => (d ? seasonOfMonth(Number(d.slice(5, 7))) : undefined)

/** 一次「去過」拿到的樣式：基本卡，有日期就加那個季節的卡 */
export function drawVariants(date: string | null | undefined): Variant[] {
  const s = seasonOfDate(date)
  return s ? [BASE, seasonVariant(s)] : [BASE]
}

/** 這個景點有沒有真的夜景照片（沒有就沒有夜景卡） */
export function hasNight(face: { seasonImages?: Partial<Record<PhotoKey, unknown>> }): boolean {
  return Boolean(face.seasonImages?.night)
}

/** 紀念卡（特別全景）加虹色箔片與亮片的景點：世界遺產、國寶 */
export function memorialFoil(designation: string | undefined): boolean {
  return designation === '世界遺產' || designation === '國寶'
}

/** 寺社（寺院、神社）：墨繪的任務是御朱印；其他景點是旅日記 */
export function isShrine(kind: string | undefined): boolean {
  return kind === '寺院' || kind === '神社'
}

/** 這個景點全部的樣式（收集冊顯示「3 / 9 種」；有夜景照片的多夜景） */
export function allVariants(night: boolean): Variant[] {
  return [BASE, ...SEASON_ORDER.map(seasonVariant), FULL, ...(night ? [NIGHT] : []), SUMI, STAMP, SPECIAL]
}

/** 一個景點的紀錄：樣式全部由這些算出來 */
export interface SpotRecord {
  /** 每一次去過的日期（自己標的＋已結束的行程） */
  dates: ReadonlyArray<string | null | undefined>
  /** 有沒有夜景照片 */
  night: boolean
  /** 勾了的任務 */
  tasks?: readonly string[]
  /** 包含這個景點、已結束的行程（有就有全景） */
  trip?: { name: string; date?: string | null } | null
  /** 存著的代號（抽到的季節） */
  drawn?: readonly string[]
}

function seasonIndex(v: Variant): number {
  return v.season ? SEASON_ORDER.indexOf(v.season) : -1
}
const byRank = (a: Variant, b: Variant) => b.rank - a.rank || seasonIndex(a) - seasonIndex(b)
const STAMP_ORDER = ['season-spring', 'season-summer', 'season-autumn', 'season-winter', 'night', 'sumi', 'stamp', 'full']

/** 行程給的全景卡：照片用那天的季節（沒有日期用主照片） */
export function fullVariant(date?: string | null): Variant {
  const s = seasonOfDate(date)
  return s ? { ...FULL, photo: s } : FULL
}

/** 任務與行程給的樣式（夜景只有有夜景照片的才有） */
export function taskVariants(r: Pick<SpotRecord, 'tasks' | 'trip' | 'night'>): Variant[] {
  const out: Variant[] = []
  if (r.trip) out.push(fullVariant(r.trip.date))
  for (const t of cleanTasks(r.tasks ?? [])) if (t !== 'night' || r.night) out.push(TASK_VARIANT[t])
  return out
}

/**
 * 收集到的樣式（稀有的在前）：去過的日期（基本、季節）＋抽到的季節＋任務與行程；
 * 其他樣式都有了再加紀念卡（特別全景）。
 */
export function ownedVariants(r: SpotRecord): Variant[] {
  const seen = new Map<string, Variant>()
  for (const d of r.dates.length ? r.dates : [null]) for (const v of drawVariants(d)) seen.set(v.key, v)
  for (const s of drawnSeasons(r.drawn ?? [])) if (!seen.has(`season-${s}`)) seen.set(`season-${s}`, seasonVariant(s))
  for (const v of taskVariants(r)) seen.set(v.key, v)
  const others = allVariants(r.night).filter((v) => v.kind !== 'special')
  if (others.every((v) => seen.has(v.key))) {
    const dates = [...new Set(r.dates.filter((d): d is string => Boolean(d)))].sort()
    const stamps = STAMP_ORDER.filter((k) => seen.has(k))
    seen.set(SPECIAL.key, { ...SPECIAL, record: { dates, trip: r.trip?.name, stamps } })
  }
  return [...seen.values()].sort(byRank)
}

/** 這個景點還沒有的季節（抽獎券只抽這些） */
export function missingSeasons(owned: Iterable<string>): SeasonKey[] {
  const have = new Set(owned)
  return SEASON_ORDER.filter((s) => !have.has(`season-${s}`))
}

/** 從還沒有的季節裡抽一張（不會重複）；四季都有了回傳 null */
export function drawSeason(owned: Iterable<string>, rand: () => number = Math.random): Variant | null {
  const pool = missingSeasons(owned)
  if (!pool.length) return null
  return seasonVariant(pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!)
}

/**
 * 十連抽：還缺季節的景點裡抽 n 張（剩不到 n 張就抽剩下的）。景點依還缺幾季加權，同一批不重複。
 * 回傳 [景點 id, 季節卡]；owned 是景點 id → 已經有的樣式 key
 */
export function drawSeasonsAcross(owned: ReadonlyMap<string, Iterable<string>>, n: number, rand: () => number = Math.random): Array<[string, Variant]> {
  const have = new Map([...owned].map(([id, list]) => [id, new Set(list)]))
  const remaining = () => [...have].map(([id, set]) => [id, missingSeasons(set).length] as const).filter(([, k]) => k > 0)
  const out: Array<[string, Variant]> = []
  for (let rem = remaining(); out.length < n && rem.length; rem = remaining()) {
    let r = rand() * rem.reduce((s, [, k]) => s + k, 0)
    let id = rem[rem.length - 1]![0]
    for (const [x, k] of rem) {
      r -= k
      if (r < 0) {
        id = x
        break
      }
    }
    const set = have.get(id)!
    const v = drawSeason(set, rand)
    if (!v) break
    set.add(v.key)
    out.push([id, v])
  }
  return out
}

/** 還缺幾張季節卡（十連抽最多抽幾張） */
export function missingSeasonCount(owned: Iterable<Iterable<string>>): number {
  let n = 0
  for (const list of owned) n += missingSeasons(list).length
  return n
}

export const BASE_VARIANT = BASE
