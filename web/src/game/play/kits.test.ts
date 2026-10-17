import { afterEach, describe, expect, it, vi } from 'vitest'

import { hasTile } from '../engine/tiles'
import { importErrorUrl, isStaleModule, type KitLoaderDeps, kitLoader, loadKitModule, setKitStaleHandler } from './world'

/**
 * P3：關東、北海道的 tile kit 是另一檔（vite 的 game-kits，kits/lazy.ts），/play 一開始只有基本、室內、近畿、沖繩；
 * 第一次到東京、北海道（坐車、讀存檔）時 world 的 ensurePref 連同 loadKitModule 一起等。
 * 這一檔只 import play/world.ts（跟 PlayView 一樣），看得出一開始沒有關東、北海道。
 */
describe('kit 分檔', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setKitStaleHandler(null)
  })

  it('一開始只有近畿、沖繩；讀一次（不管哪一個 kit）關東、北海道都有；之後離線也不再讀', async () => {
    expect(hasTile('kinki/grass')).toBe(true)
    expect(hasTile('okinawa/grass')).toBe(true)
    expect(hasTile('kanto/street')).toBe(false)
    expect(hasTile('hokkaido/grass')).toBe(false)
    await loadKitModule('hokkaido')
    // 同一檔：北海道讀好了，關東也在（北海道的鎮也用得到關東的自動販賣機、郵筒）
    expect(hasTile('kanto/street')).toBe(true)
    expect(hasTile('kanto/vending-a')).toBe(true)
    expect(hasTile('hokkaido/grass')).toBe(true)
    vi.stubGlobal('navigator', { onLine: false })
    await expect(loadKitModule('kanto')).resolves.toBeUndefined()
    await expect(loadKitModule('hokkaido')).resolves.toBeUndefined()
    await expect(loadKitModule('kinki')).resolves.toBeUndefined()
  })

  it('kit 讀不到時下次換網址：錯誤訊息裡的網址（瀏覽器記住失敗的 import）', () => {
    expect(importErrorUrl(new TypeError('Failed to fetch dynamically imported module: https://x.web.app/assets/game-kits-AB12.js'))).toBe('https://x.web.app/assets/game-kits-AB12.js')
    expect(importErrorUrl(new TypeError('error loading dynamically imported module: http://localhost:5173/src/game/world/kits/kanto.ts?r=2'))).toBe('http://localhost:5173/src/game/world/kits/kanto.ts')
    expect(importErrorUrl(new TypeError('Importing a module script failed.'))).toBe(null)
  })

  /** 假的 import：照順序回成功或失敗（失敗的訊息帶網址，像 Chromium） */
  function fake(results: Array<'ok' | 'fail'>, o: { offline?: () => boolean; stale?: boolean } = {}) {
    const calls: string[] = []
    let registered = false
    const URL = 'https://x.web.app/assets/game-kits-AB12.js'
    const next = (what: string) => {
      calls.push(what)
      const r = results.shift() ?? 'fail'
      if (r === 'ok') {
        registered = true
        return Promise.resolve({})
      }
      return Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${URL}`))
    }
    const deps: KitLoaderDeps = {
      importKits: () => next('first'),
      importUrl: (url) => next(url),
      ready: () => registered,
      offline: o.offline ?? (() => false),
      stale: async () => !!o.stale,
    }
    return { load: kitLoader(deps), calls, URL }
  }

  it('關東讀不到 → 重試成功 → 第一次去北海道直接好（同一檔，不再 import 記住失敗的網址）', async () => {
    const f = fake(['fail', 'ok'])
    await expect(f.load('kanto')).rejects.toThrow(TypeError)
    await expect(f.load('kanto')).resolves.toBeUndefined()
    await expect(f.load('hokkaido')).resolves.toBeUndefined()
    expect(f.calls).toEqual(['first', `${f.URL}?r=1`])
  })

  it('北海道讀不到之後先去東京：重試的網址是同一個（不照 kit 分開記）', async () => {
    const f = fake(['fail', 'fail', 'ok'])
    await expect(f.load('hokkaido')).rejects.toThrow()
    await expect(f.load('kanto')).rejects.toThrow()
    await expect(f.load('hokkaido')).resolves.toBeUndefined()
    expect(f.calls).toEqual(['first', `${f.URL}?r=1`, `${f.URL}?r=2`])
  })

  it('同時要兩個 kit：只 import 一次', async () => {
    const f = fake(['ok'])
    await Promise.all([f.load('kanto'), f.load('hokkaido')])
    expect(f.calls).toEqual(['first'])
  })

  it('離線：沒讀過的照樣 import（HTTP 快取裡可能有）；重試的網址不去試', async () => {
    let off = true
    const f = fake(['ok'], { offline: () => off })
    await expect(f.load('kanto')).resolves.toBeUndefined()
    expect(f.calls).toEqual(['first'])
    const g = fake(['fail', 'ok'], { offline: () => off })
    await expect(g.load('kanto')).rejects.toThrow()
    await expect(g.load('kanto')).rejects.toThrow('offline')
    expect(g.calls).toEqual(['first'])
    off = false
    await expect(g.load('kanto')).resolves.toBeUndefined()
    expect(g.calls).toEqual(['first', `${g.URL}?r=1`])
  })

  it('部署之後的舊檔名（伺服器回 index.html）：叫 stale handler', async () => {
    const seen: number[] = []
    setKitStaleHandler(() => seen.push(1))
    const f = fake(['fail'], { stale: true })
    await expect(f.load('kanto')).rejects.toThrow()
    expect(seen).toEqual([1])
    const g = fake(['fail'], { stale: false })
    await expect(g.load('kanto')).rejects.toThrow()
    expect(seen).toEqual([1])
  })

  it('isStaleModule：HTML、404 是舊檔；JavaScript、5xx、連不上不是', async () => {
    const res = (status: number, type: string) => async () => new Response(status === 200 ? 'x' : null, { status, headers: { 'content-type': type } })
    expect(await isStaleModule('u', res(200, 'text/html; charset=utf-8') as unknown as typeof fetch)).toBe(true)
    expect(await isStaleModule('u', res(404, 'text/html') as unknown as typeof fetch)).toBe(true)
    expect(await isStaleModule('u', res(200, 'application/javascript') as unknown as typeof fetch)).toBe(false)
    expect(await isStaleModule('u', res(503, 'text/html') as unknown as typeof fetch)).toBe(false)
    expect(await isStaleModule('u', (async () => Promise.reject(new TypeError('x'))) as unknown as typeof fetch)).toBe(false)
  })
})
