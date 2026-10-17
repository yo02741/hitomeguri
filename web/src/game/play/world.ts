import type { BundleIndex } from '../../services/bundles'
import type { MapSource } from '../engine/game'
import { BUNDLES, type BundleApi, createWorld, type GameWorld, loadWorldData, type PrefData, type WorldDataError, type WorldOptions } from '../world'

/**
 * /play 的世界（規格 §8、§8.8）：讀京都、沖繩的 bundles → createWorld。PlayView 只呼叫這裡。
 *
 *   const r = await loadPlayWorld(() => catalog.loadIndex())
 *   if (!r.ok) 標題畫面寫「資料讀不到…」＋再試一次
 *   else new Game({ maps: r.world.mapSource, start: r.world.start, genVersion: r.world.genVersion, seasonOf: … })
 *
 * 版本號用網站的 catalog store 讀到的 _index.json（同一份，不重抓）；catalog 讀不到時它會給空的索引，
 * 這時自己再抓一次（連不上就是 offline 的錯誤）。
 */
export const PLAY_PREFS = ['kyoto', 'okinawa'] as const

export type PlayWorld =
  | { ok: true; world: GameWorld; prefs: PrefData[]; errors: WorldDataError[]; warnings: string[] }
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

export async function loadPlayWorld(catalogIndex: () => Promise<BundleIndex>, opts: { api?: BundleApi; world?: WorldOptions } = {}): Promise<PlayWorld> {
  const r = await loadWorldData(PLAY_PREFS, indexVia(catalogIndex, opts.api))
  if (!r.prefs.length) return { ok: false, errors: r.errors, warnings: r.warnings }
  try {
    const world = createWorld(r.prefs, opts.world)
    if (!world.start.map || !world.mapSource(world.start.map)) return { ok: false, errors: r.errors, warnings: [...r.warnings, '起點的地圖做不出來'] }
    return { ok: true, world, prefs: r.prefs, errors: r.errors, warnings: r.warnings }
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('game：世界做不出來', e)
    return { ok: false, errors: r.errors, warnings: [...r.warnings, '世界做不出來'] }
  }
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
