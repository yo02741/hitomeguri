import type { Game } from '../engine/game'
import type { Season, TimeOfDay } from '../engine/types'

import type { Place } from './types'

/**
 * systems 的存檔（規格 §11：Game 存檔的 systems 欄位＝game.state.ext.systems，自己帶版本）。
 * 跟引擎共用的：旅費 state.money、行李 state.items（key → 數量）、印 state.stamps（章的 id）、
 * 相簿 state.album（照片 id，照片本身在 IndexedDB）、房間擺設 state.room。
 * 這裡放其他的：照片的說明、印的日期、吃過的、聽來的（只記樣板與參照，打開手帳時再從資料算）、委託、去過的鎮、房間的出口。
 * 讀的時候型別不對的欄位換成預設（舊檔、壞檔不會讓遊戲起不來）。整份要小（存檔 50 KB 以內）。
 */
export const SYSTEMS_VERSION = 1

export type PhotoSlot = 'normal' | 'sakura' | 'momiji' | 'snow' | 'night' | 'festival'
export const PHOTO_SLOTS: readonly PhotoSlot[] = ['normal', 'sakura', 'momiji', 'snow', 'night', 'festival']
export const SLOT_LABEL: Record<PhotoSlot, string> = { normal: '平常', sakura: '春櫻', momiji: '秋楓', snow: '雪', night: '夜', festival: '祭典' }

export interface PhotoMeta {
  id: string
  /** 相簿的哪一頁：spot:<景點 id> 或 map:<地圖 id>（不在拍攝點拍的） */
  page: string
  /** 那一頁的名字（資料裡的地名） */
  name: { ja: string; zh?: string }
  slot: PhotoSlot
  /** 遊戲日期 YYYY-MM-DD、時段、季節 */
  d: string
  t: TimeOfDay
  s: Season
  score: number
  w: number
  h: number
  /** 自己或夥伴入鏡（合照） */
  tg?: boolean
}

/** 蓋過的章：日期、在哪一鎮，以及章的資料（之後在別的鎮打開印帳也畫得出來） */
export interface StampMeta {
  d: string
  /** 蓋的時候在哪一鎮 */
  town?: string
  k: 'station' | 'sanpai' | 'castle'
  p: string
  n: string
  sp?: string
  c?: string
  st?: string
  /**
   * 蓋的時候印面上的樣子（P3：那一縣的資料延遲載入，還沒讀進來、讀不到時印帳照這些畫）：
   * f 印面的字（名城「日本100名城 No.2」、站章的羅馬字）、no 名城的 No.、w 蓋章地點（名城：資料的 st）、u 出處、a 剪影。
   */
  f?: string
  no?: number
  w?: string
  u?: string
  a?: string
}

export interface EatenMeta {
  d: string
  n: number
}

/** 聽來的一句：fact＝事實樣板（template＋ref＋params），sign＝告示牌的簡介（景點 id） */
export interface HeardMeta {
  k: 'fact' | 'sign'
  id: string
  ref?: { kind: string; id: string }
  p?: Record<string, string | number>
  d: string
  /** 在哪一張地圖聽到的 */
  m?: string
  /** world 給的出處（鐵路 km、直線 km 這種算出來的） */
  s?: { label: string; url: string }
}

export type QuestType = 'deliver' | 'photo' | 'lost'

/** 委託（規格 §8.7：{ type, from, to, item?, spot?, when? }） */
export interface Quest {
  id: string
  type: QuestType
  /** 委託的人在的鎮、他的實體 id */
  from: string
  giver: string
  /** deliver：送到哪一鎮 */
  to?: string
  /** deliver：送的東西（行李的 key） */
  item?: string
  /** photo、lost：景點 */
  spot?: string
  /** photo：夜景 */
  when?: 'night'
  /** lost：掉的東西 */
  thing?: string
  reward: number
  /** 接下的日期 */
  d: string
  /** photo：拍好了（照片 id）；lost：找到了 */
  ready?: string | boolean
}

export interface QuestBook {
  active: Quest[]
  /** 做完的委託 id（只留最近的） */
  done: string[]
}

export interface SystemsSave {
  v: number
  photos: Record<string, PhotoMeta>
  /** 相簿頁 → 格 → 照片 id */
  album: Record<string, Partial<Record<PhotoSlot, string>>>
  stamps: Record<string, StampMeta>
  eaten: Record<string, EatenMeta>
  heard: HeardMeta[]
  quests: QuestBook
  visited: string[]
  /** 從哪裡進房間（出房間回到那裡） */
  roomFrom?: Place
  /** 最後在哪一鎮（房間、車窗畫面時用） */
  lastTown?: string
  /** 最後拿鑰匙的旅館、民宿的名字（手帳「房間」） */
  inn?: string
  /**
   * 從台灣出發（P4）：city＝最後在的台灣的城市（台北…）；plan＝出發看板「想去的地方」記下的鎮（市区町村碼；
   * 先飛到機場大廳、再從大廳的剪票口或那一鎮的車站坐車時排在最前面，到了就清掉）；choosing＝新遊戲的「出發的城市」
   * 還沒選（選的時候切到背景、關掉分頁也會存檔：繼續時再選一次）
   */
  trip?: { city?: string; plan?: string; choosing?: true }
}

export interface RoomLayout {
  /** 架子 6×3：每一格放的東西（行李的 key）或 null */
  shelf: Array<string | null>
  /** 牆上 4 個相框：照片 id 或 null */
  frames: Array<string | null>
}
export const SHELF_COLS = 6
export const SHELF_ROWS = 3
export const SHELF_SLOTS = SHELF_COLS * SHELF_ROWS
export const FRAME_SLOTS = 4

export const HEARD_MAX = 200
export const DONE_MAX = 60
export const PHOTO_MAX = 120

export function emptySystems(): SystemsSave {
  return { v: SYSTEMS_VERSION, photos: {}, album: {}, stamps: {}, eaten: {}, heard: [], quests: { active: [], done: [] }, visited: [] }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const TIMES = new Set(['day', 'dusk', 'night'])
const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter'])
const SLOTS = new Set<string>(PHOTO_SLOTS)

function photoOf(id: string, v: unknown): PhotoMeta | null {
  if (!isObj(v) || !str(v.page) || !isObj(v.name) || !str(v.name.ja) || !str(v.d)) return null
  return {
    id,
    page: v.page,
    name: { ja: v.name.ja, zh: str(v.name.zh) ? v.name.zh : undefined },
    slot: str(v.slot) && SLOTS.has(v.slot) ? (v.slot as PhotoSlot) : 'normal',
    d: v.d,
    t: str(v.t) && TIMES.has(v.t) ? (v.t as TimeOfDay) : 'day',
    s: str(v.s) && SEASONS.has(v.s) ? (v.s as Season) : 'spring',
    score: Math.max(0, Math.min(100, Math.round(num(v.score)))),
    w: Math.round(num(v.w, 240)),
    h: Math.round(num(v.h, 160)),
    tg: v.tg === true ? true : undefined,
  }
}

function questOf(v: unknown): Quest | null {
  if (!isObj(v) || !str(v.id) || !str(v.from) || !str(v.giver) || !str(v.d)) return null
  const type = v.type === 'deliver' || v.type === 'photo' || v.type === 'lost' ? v.type : null
  if (!type) return null
  return {
    id: v.id,
    type,
    from: v.from,
    giver: v.giver,
    to: str(v.to) ? v.to : undefined,
    item: str(v.item) ? v.item : undefined,
    spot: str(v.spot) ? v.spot : undefined,
    when: v.when === 'night' ? 'night' : undefined,
    thing: str(v.thing) ? v.thing : undefined,
    reward: Math.max(0, Math.round(num(v.reward))),
    d: v.d,
    ready: str(v.ready) || typeof v.ready === 'boolean' ? v.ready : undefined,
  }
}

function placeOf(v: unknown): Place | undefined {
  if (!isObj(v) || !str(v.map)) return undefined
  const dir = v.dir === 'up' || v.dir === 'down' || v.dir === 'left' || v.dir === 'right' ? v.dir : 'down'
  return { map: v.map, x: Math.round(num(v.x)), y: Math.round(num(v.y)), dir }
}

/** 存檔裡的一份 → 乾淨的 SystemsSave（以後的版本、不是物件：當作沒有） */
export function parseSystems(raw: unknown): SystemsSave {
  const out = emptySystems()
  if (!isObj(raw) || num(raw.v) > SYSTEMS_VERSION) return out
  if (isObj(raw.photos))
    for (const [id, v] of Object.entries(raw.photos)) {
      const p = photoOf(id, v)
      if (p) out.photos[id] = p
    }
  if (isObj(raw.album))
    for (const [page, slots] of Object.entries(raw.album)) {
      if (!isObj(slots)) continue
      const row: Partial<Record<PhotoSlot, string>> = {}
      for (const [slot, id] of Object.entries(slots)) if (SLOTS.has(slot) && str(id) && out.photos[id]) row[slot as PhotoSlot] = id
      if (Object.keys(row).length) out.album[page] = row
    }
  if (isObj(raw.stamps))
    for (const [id, v] of Object.entries(raw.stamps)) {
      if (!isObj(v) || !str(v.d) || !str(v.p) || !str(v.n)) continue
      const k = v.k === 'station' || v.k === 'sanpai' || v.k === 'castle' ? v.k : null
      if (!k) continue
      const opt = (x: unknown) => (str(x) ? x : undefined)
      const no = typeof v.no === 'number' && Number.isFinite(v.no) ? Math.round(v.no) : undefined
      out.stamps[id] = { d: v.d, town: opt(v.town), k, p: v.p, n: v.n, sp: opt(v.sp), c: opt(v.c), st: opt(v.st), f: opt(v.f), no, w: opt(v.w), u: opt(v.u), a: opt(v.a) }
      for (const key of ['town', 'sp', 'c', 'st', 'f', 'no', 'w', 'u', 'a'] as const) if (out.stamps[id]![key] === undefined) delete out.stamps[id]![key]
    }
  if (isObj(raw.eaten)) for (const [id, v] of Object.entries(raw.eaten)) if (isObj(v) && str(v.d)) out.eaten[id] = { d: v.d, n: Math.max(1, Math.round(num(v.n, 1))) }
  if (Array.isArray(raw.heard))
    for (const h of raw.heard) {
      if (!isObj(h) || (h.k !== 'fact' && h.k !== 'sign') || !str(h.id) || !str(h.d)) continue
      const ref = isObj(h.ref) && str(h.ref.kind) && str(h.ref.id) ? { kind: h.ref.kind, id: h.ref.id } : undefined
      const p: Record<string, string | number> = {}
      if (isObj(h.p)) for (const [k, v] of Object.entries(h.p)) if (str(v) || (typeof v === 'number' && Number.isFinite(v))) p[k] = v
      const src = isObj(h.s) && str(h.s.label) && str(h.s.url) ? { label: h.s.label, url: h.s.url } : undefined
      out.heard.push({ k: h.k, id: h.id, ref, p: Object.keys(p).length ? p : undefined, d: h.d, m: str(h.m) ? h.m : undefined, s: src })
    }
  out.heard = out.heard.slice(-HEARD_MAX)
  if (isObj(raw.quests)) {
    const q = raw.quests
    if (Array.isArray(q.active)) out.quests.active = q.active.map(questOf).filter((x): x is Quest => !!x)
    if (Array.isArray(q.done)) out.quests.done = q.done.filter(str).slice(-DONE_MAX)
  }
  if (Array.isArray(raw.visited)) out.visited = [...new Set(raw.visited.filter(str))]
  out.roomFrom = placeOf(raw.roomFrom)
  if (str(raw.lastTown)) out.lastTown = raw.lastTown
  if (str(raw.inn)) out.inn = raw.inn
  if (isObj(raw.trip)) {
    const trip: NonNullable<SystemsSave['trip']> = {}
    if (str(raw.trip.city)) trip.city = raw.trip.city
    if (str(raw.trip.plan)) trip.plan = raw.trip.plan
    if (raw.trip.choosing === true) trip.choosing = true
    if (trip.city || trip.plan) out.trip = trip
  }
  return out
}

/** 房間擺設（引擎的 state.room）→ 架子 18 格、相框 4 格 */
export function parseRoom(raw: unknown): RoomLayout {
  const o = isObj(raw) ? raw : {}
  const fix = (v: unknown, n: number) => Array.from({ length: n }, (_, i) => (Array.isArray(v) && str(v[i]) ? (v[i] as string) : null))
  return { shelf: fix(o.shelf, SHELF_SLOTS), frames: fix(o.frames, FRAME_SLOTS) }
}

const checked = new WeakSet<object>()

/**
 * 這個 Game 的 systems 存檔：每次都從 game.state.ext.systems 拿（newGame、restore 會換掉 ext），
 * 第一次看到的那一份先整理過（舊檔、壞檔換成乾淨的）。
 */
export function systemsOf(game: Game): SystemsSave {
  const ext = game.state.ext
  const cur = ext.systems
  if (isObj(cur) && checked.has(cur)) return cur as unknown as SystemsSave
  const clean = parseSystems(cur)
  ext.systems = clean
  checked.add(clean)
  return clean
}

/** 房間擺設：同上，從 game.state.room 拿 */
export function roomOf(game: Game): RoomLayout {
  const cur = game.state.room as Partial<RoomLayout>
  if (checked.has(cur) && Array.isArray(cur.shelf) && Array.isArray(cur.frames)) return cur as RoomLayout
  const clean = parseRoom(cur)
  game.state.room = clean as unknown as Record<string, unknown>
  checked.add(clean)
  return clean
}
