import { describe, expect, it } from 'vitest'

import { inAppBrowser, withLineExternal } from './inApp'

describe('inAppBrowser（App 內建的瀏覽器）', () => {
  it('LINE', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.6.1')).toBe('line')
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 Line/13.6.1/IAB')).toBe('line')
  })

  it('其他 App', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]')).toBe('other')
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0')).toBe('other')
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36')).toBe('other')
  })

  it('一般瀏覽器', () => {
    expect(inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBeNull()
    expect(inAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')).toBeNull()
  })
})

describe('withLineExternal', () => {
  it('加上 openExternalBrowser=1，保留原本的參數', () => {
    expect(withLineExternal('https://example.com/join/abc')).toBe('https://example.com/join/abc?openExternalBrowser=1')
    expect(withLineExternal('https://example.com/join/abc?x=1&openExternalBrowser=1')).toBe('https://example.com/join/abc?x=1&openExternalBrowser=1')
  })
})
