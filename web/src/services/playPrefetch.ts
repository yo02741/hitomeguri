import { useCatalogStore } from '../stores/catalog'

import { fetchGameBundle } from './bundles'

/**
 * 番外篇（/play）的資料先抓：路由一進 /play（beforeEnter）就開始抓遊戲用的小 bundle（game/{縣}.json），
 * 不用等遊戲的程式（game-*.js、PlayView-*.js、旅人的 avatar）下載、執行完才開始。
 * 這一檔不在 game 分檔裡（只有 fetch），PlayView 讀資料時拿同一個 promise（prefetchedGame），不會再抓一次。
 * P3（延遲載入）：只先抓世界索引（game/_world.json）與起點的縣（京都）；別的縣坐車到那裡、或存檔在那裡時才抓。
 * 索引裡沒有 _world（舊的 bundles）時退回 P2：京都＋沖繩。
 */
const FIRST = ['_world', 'kyoto'] as const
const P2 = ['kyoto', 'okinawa'] as const
const started = new Map<string, Promise<unknown>>()

export function prefetchPlay(): void {
  void useCatalogStore()
    .loadIndex()
    .then((idx) => {
      for (const pref of idx.game?._world ? FIRST : P2) {
        const v = idx.game?.[pref]?.version
        const key = `${pref}@${v}`
        if (v && !started.has(key)) {
          const p = fetchGameBundle(pref, v)
          // 失敗的不留著（PlayView 自己再抓一次，錯誤照它的規則處理）
          p.catch(() => started.delete(key))
          started.set(key, p)
        }
      }
    })
    .catch(() => undefined)
}

/** 先抓好的那一份（沒有就自己抓） */
export function prefetchedGame(pref: string, version: string): Promise<unknown> {
  return started.get(`${pref}@${version}`) ?? fetchGameBundle(pref, version)
}
