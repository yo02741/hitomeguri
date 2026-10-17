import type { BundleIndex } from '../../services/bundles'
import type { MapSource } from '../engine/game'
import type { SaveData } from '../engine/save'
import { tilesetNames } from '../engine/tiles'
import { townCodeOfMap } from '../systems/data'
import type { SystemsSave } from '../systems/state'
import { BUNDLES, type BundleApi, createWorld, type GameWorld, type Kit, loadWorldData, loadWorldIndex, type PrefData, prefLoader, WorldDataError, type WorldIndex, type WorldOptions } from '../world'

/**
 * /play 的世界（規格 §8、§8.8、§12）。PlayView 只呼叫這裡。
 *
 *   const r = await loadPlayWorld(() => catalog.loadIndex())
 *   if (!r.ok) 標題畫面寫「資料讀不到…」＋再試一次
 *   else new Game({ maps: r.world.mapSource, start: r.world.start, genVersion: r.world.genVersion, seasonOf: … })
 *
 * P3（延遲載入）：一開始只抓世界索引（game/_world.json，gzip 約 4 KB）與起點的縣（京都）；存檔在別的縣時
 * PlayView 照 savePrefs 先讀那一縣再繼續；坐車到別的縣時 world 自己讀（車窗畫面裡等）。
 * 索引裡沒有世界索引（舊的 bundles）時跟 P2 一樣讀京都、沖繩（PLAY_PREFS）。
 * 版本號用網站的 catalog store 讀到的 _index.json（同一份，不重抓）；catalog 讀不到時它會給空的索引，
 * 這時自己再抓一次（連不上就是 offline 的錯誤）。
 */
export const PLAY_PREFS = ['kyoto', 'okinawa'] as const

export type PlayWorld =
  | { ok: true; world: GameWorld; prefs: PrefData[]; errors: WorldDataError[]; warnings: string[]; index: WorldIndex | null }
  | { ok: false; errors: WorldDataError[]; warnings: string[] }

/** catalog store 的索引；空的（讀不到）就自己再抓一次，讓錯誤分得出 offline／failed */
export function indexVia(catalogIndex: () => Promise<BundleIndex>, api: BundleApi = BUNDLES): BundleApi {
  return {
    ...api,
    fetchIndex: async () => {
      const idx = await catalogIndex().catch(() => null)
      if (idx && Object.keys(idx.prefectures ?? {}).length) return idx
      return api.fetchIndex()
    },
  }
}

/** kits/lazy.ts 註冊的 kit（tilesetNames() 的名字）；這裡不能靜態 import lazy.ts（會把整檔拉進 game-*.js） */
const LAZY_KITS: readonly Kit[] = ['kanto', 'hokkaido']

export interface KitLoaderDeps {
  /** import kits/lazy.ts（第一次） */
  importKits(): Promise<unknown>
  /** 換一個網址再 import（重試） */
  importUrl(url: string): Promise<unknown>
  /** 關東、北海道的 tile 已經註冊了 */
  ready(): boolean
  offline(): boolean
  /** 那個網址是不是部署之後就不在的舊檔 */
  stale(url: string): Promise<boolean>
}

/**
 * 關東、北海道的 tile kit（P3）：在另一檔（game-kits-*.js，kits/lazy.ts），第一次到東京、北海道（坐車、讀存檔）才下載，
 * 跟那一縣的資料一起等（world 的 ensurePref）。近畿、沖繩的 kit 一開始就在（kits/core.ts）。
 *  - 兩個 kit 在同一檔：照檔管，不照 kit 管。讀過一次（或 tile 已經註冊了）兩個都直接好；同時要的共用一個 promise；重試的網址也只有一個。
 *  - 不先看 navigator.onLine：讀過的檔在 HTTP 快取裡（immutable），離線也 import 得到；真的讀不到才當作失敗。
 *  - 讀不到：瀏覽器會記住失敗的 import（照網址），下次換一個網址（?r=n）再 import。離線時不去試重試的網址（一定不在快取裡）。
 *  - 部署之後還開著的舊分頁：舊的檔名已經不在（Firebase 回 index.html、Pages 回 404），換網址也一樣。
 *    看得出是這種情況時叫 setKitStaleHandler 給的函式（PlayView：存檔、同一個網址重載一次），這一次照樣當作失敗。
 */
export function kitLoader(deps: KitLoaderDeps): (kit: Kit) => Promise<unknown> {
  let loading: Promise<unknown> | null = null
  let retry: string | null = null
  let tries = 0
  return (kit) => {
    if (!LAZY_KITS.includes(kit) || deps.ready()) return Promise.resolve()
    if (loading) return loading
    if (retry && deps.offline()) return Promise.reject(new TypeError('offline'))
    const load = retry ? deps.importUrl(`${retry}${retry.includes('?') ? '&' : '?'}r=${++tries}`) : deps.importKits()
    const p = load.then(
      () => undefined,
      async (e: unknown) => {
        // 讀不到（坐車時斷線）：下次換一個網址再 import（錯誤訊息裡有那一檔的網址：Chromium、Firefox；Safari 沒寫就只能重新整理）
        const url = importErrorUrl(e)
        if (url) retry = url
        if (url && !deps.offline() && kitStaleHandler && (await deps.stale(url))) kitStaleHandler()
        throw e
      },
    )
    loading = p
    const done = () => {
      if (loading === p) loading = null
    }
    p.then(done, done)
    return p
  }
}

export const loadKitModule = kitLoader({
  importKits: () => import('../world/kits/lazy'),
  importUrl: (url) => import(/* @vite-ignore */ url),
  ready: () => {
    const have = tilesetNames()
    return LAZY_KITS.every((k) => have.includes(k))
  },
  offline: () => offline(),
  stale: (url) => isStaleModule(url),
})

/** 動態 import 失敗的錯誤訊息裡的網址（Chromium、Firefox 有寫；Safari 沒有就回 null） */
export function importErrorUrl(e: unknown): string | null {
  return /(https?:\/\/\S+?\.(?:js|ts))(?:\?\S*)?$/.exec(String((e as Error)?.message ?? e))?.[1] ?? null
}
/**
 * 這個網址是不是部署之後就不在的舊檔：伺服器回的不是 JavaScript（Firebase Hosting 的 rewrites 回 index.html）或 404、410（GitHub Pages）。
 * 連不上（fetch 丟錯）、5xx 不算（那是網路或伺服器的問題，換網址再試就好）。
 */
export async function isStaleModule(url: string, get: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await get(url, { cache: 'no-store' })
    if (res.status === 404 || res.status === 410) return true
    if (!res.ok) return false
    return /text\/html/i.test(res.headers.get('content-type') ?? '')
  } catch {
    return false
  }
}
/** 舊分頁要的 kit 檔已經不在時（PlayView：存檔、重載一次；重載過了就讓坐車說要重新整理） */
export function setKitStaleHandler(fn: (() => void) | null) {
  kitStaleHandler = fn
}
let kitStaleHandler: (() => void) | null = null

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const kindOf = (e: unknown) => (offline() || e instanceof TypeError ? 'offline' : 'failed')

export async function loadPlayWorld(catalogIndex: () => Promise<BundleIndex>, opts: { api?: BundleApi; world?: WorldOptions } = {}): Promise<PlayWorld> {
  const api = indexVia(catalogIndex, opts.api)
  let index: BundleIndex
  try {
    index = await api.fetchIndex()
  } catch (e) {
    return { ok: false, errors: [new WorldDataError('kyoto', 'index', kindOf(e), e)], warnings: [] }
  }
  // 索引讀過了：之後（P2 的退路、一縣一縣讀）都用同一份，不再抓
  const cached: BundleApi = { ...api, fetchIndex: async () => index }
  const warnings: string[] = []
  let atlas: WorldIndex | null = null
  try {
    atlas = await loadWorldIndex(cached, index)
  } catch (e) {
    if (offline() || e instanceof TypeError) return { ok: false, errors: [new WorldDataError('kyoto', 'world', 'offline', e)], warnings }
    warnings.push('世界索引讀不到，只有京都、沖繩')
  }
  if (!atlas) {
    const r = await loadWorldData(PLAY_PREFS, cached)
    if (!r.prefs.length) return { ok: false, errors: r.errors, warnings: [...warnings, ...r.warnings] }
    return made(() => createWorld(r.prefs, opts.world), r.prefs, r.errors, [...warnings, ...r.warnings], null)
  }
  const load = prefLoader(cached, index, warnings)
  let first: PrefData
  try {
    first = await load(atlas.start)
  } catch (e) {
    const err = e instanceof WorldDataError ? e : new WorldDataError(atlas.start, 'pref', kindOf(e), e)
    return { ok: false, errors: [err], warnings }
  }
  const index0 = atlas
  return made(() => createWorld([first], { loadKit: loadKitModule, ...opts.world, index: index0, loadPref: (p) => load(p) }), [first], [], warnings, atlas)
}

function made(make: () => GameWorld, prefs: PrefData[], errors: WorldDataError[], warnings: string[], index: WorldIndex | null): PlayWorld {
  try {
    const world = make()
    if (!world.start.map || !world.mapSource(world.start.map)) return { ok: false, errors, warnings: [...warnings, '起點的地圖做不出來'] }
    return { ok: true, world, prefs, errors, warnings, index }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('game：世界做不出來', e)
    return { ok: false, errors, warnings: [...warnings, '世界做不出來'] }
  }
}

/**
 * 存檔要哪幾縣（P3）：need＝繼續之前一定要讀好的（存檔所在的鎮；在你的房間時是房間出口那一間旅館的鎮），
 * also＝去過的縣（行李裡的特色、印帳、聽來的、委託要那一縣的資料才寫得出名字），背景讀。
 * prefOf：鎮（市区町村碼）→ 縣（world.prefOfTown：讀進來的、世界索引的）。
 * hallPref（P4）：不在任何鎮上的機場大廳（air:KIX…）→ 機場所在的縣（賣店賣那一縣的東西）；台灣的大廳不要哪一縣。
 */
export function savePrefs(
  save: SaveData | null | undefined,
  prefOf: (town: string) => string | null,
  hallPref?: (mapId: string) => string | null,
): { need: string[]; also: string[] } {
  if (!save) return { need: [], also: [] }
  const ofMap = (m: string | null | undefined) => {
    const code = townCodeOfMap(m)
    return code ? prefOf(code) : m && hallPref ? hallPref(m) : null
  }
  const sys = (save.ext?.systems ?? null) as Partial<SystemsSave> | null
  const lastInn = (save.ext?.world as { lastInn?: string } | undefined)?.lastInn
  const need = new Set<string>()
  const here = save.map === 'room' ? (ofMap(lastInn) ?? ofMap(sys?.roomFrom?.map)) : ofMap(save.map)
  if (here) need.add(here)
  const also = new Set<string>()
  for (const p of visitedPrefs(save.ext, prefOf)) if (!need.has(p)) also.add(p)
  return { need: [...need], also: [...also] }
}

/**
 * 存檔（或遊戲現在的 state.ext）裡用得到的縣：最後住的旅館、房間的出口、最後在的鎮、去過的鎮、蓋過的章。
 * PlayView 打開手帳、連上網路時用它把還沒讀進來的縣再讀一次（印帳、聽來的要那一縣的資料）。
 */
export function visitedPrefs(ext: Record<string, unknown> | null | undefined, prefOf: (town: string) => string | null): string[] {
  const ofMap = (m: string | null | undefined) => {
    const code = townCodeOfMap(m)
    return code ? prefOf(code) : null
  }
  const sys = (ext?.systems ?? null) as Partial<SystemsSave> | null
  const lastInn = (ext?.world as { lastInn?: string } | undefined)?.lastInn
  const out = new Set<string>()
  const add = (p: string | null | undefined) => {
    if (p) out.add(p)
  }
  add(ofMap(lastInn))
  add(ofMap(sys?.roomFrom?.map))
  if (sys?.lastTown) add(prefOf(sys.lastTown))
  for (const t of Array.isArray(sys?.visited) ? sys.visited : []) if (typeof t === 'string') add(prefOf(t))
  for (const m of Object.values(sys?.stamps ?? {})) add(m && typeof m === 'object' ? m.p : null)
  return [...out]
}

/**
 * 遊戲的地圖：世界的鎮、室內、你的房間。DEV 時另外接 P0 的測試小鎮（id 前面加 p0:，例 __game.warp('p0:town', 14, 20)），
 * 正式版沒有（extra 不給）。舊的 P0 存檔（map 'town'、'shop'）在這裡找不到，Game 讀檔時放回世界的起點。
 */
export function playMaps(world: GameWorld, extra?: MapSource | null): MapSource {
  if (!extra) return world.mapSource
  return (id) => world.mapSource(id) ?? extra(id)
}

/**
 * 抵達新鎮的短曲（systems 在第一次進那一鎮時放）：坐車時等車窗畫面、到站音效放完再響，不跟電車到站聲疊在一起。
 *   const arrive = arrivalJingle((n) => audio.jingle(n))
 *   deps.jingle = arrive.jingle；deps.travel = (g, l) => { arrive.ride(); world.travel(g, l.link, { onArrive: arrive.arrived }) }
 */
export function arrivalJingle(play: (name: 'arrive' | 'stamp' | 'bought') => void, delayMs = 900, later: (fn: () => void, ms: number) => unknown = setTimeout) {
  let riding = false
  let queued = false
  return {
    jingle(name: 'arrive' | 'stamp' | 'bought') {
      if (name === 'arrive' && riding) queued = true
      else play(name)
    },
    /** 開始坐車 */
    ride() {
      riding = true
      queued = false
    },
    /** 到了（淡入之後） */
    arrived() {
      riding = false
      if (!queued) return
      queued = false
      later(() => play('arrive'), delayMs)
    },
    /** 坐到一半被打斷（重新開始、離開頁面） */
    reset() {
      riding = false
      queued = false
    },
  }
}
