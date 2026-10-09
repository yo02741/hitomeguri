import { describe, expect, it } from 'vitest'

import { commonsCandidates, commonsOriginal, commonsThumb, commonsWidthFor, encodeCommonsName } from './commons'

const T = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'

describe('commonsThumb', () => {
  it('換掉縮圖的寬度、去掉追蹤參數', () => {
    const url = `${T}3/3b/Torii%2C_Honjo.jpg/960px-Torii%2C_Honjo.jpg?utm_source=commons.wikimedia.org`
    expect(commonsThumb(url, 500)).toBe(`${T}3/3b/Torii%2C_Honjo.jpg/500px-Torii%2C_Honjo.jpg`)
  })
  it('原圖網址換成縮圖網址', () => {
    const url = 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Sogenji_Stone_Gate.jpg?utm_content=thumbnail_unscaled'
    expect(commonsThumb(url, 960)).toBe(`${T}6/6d/Sogenji_Stone_Gate.jpg/960px-Sogenji_Stone_Gate.jpg`)
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/9/91/Enkaku-ji%28Shuri%29200703.jpg', 250)).toBe(
      `${T}9/91/Enkaku-ji%28Shuri%29200703.jpg/250px-Enkaku-ji%28Shuri%29200703.jpg`,
    )
  })
  it('SVG 的縮圖是 PNG；TIFF 不做縮圖', () => {
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/a/ab/Map.svg', 500)).toBe(`${T}a/ab/Map.svg/500px-Map.svg.png`)
    const tif = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Scan.tif'
    expect(commonsThumb(tif, 500)).toBe(tif)
  })
  it('檔名的編碼和 Commons API 一樣，縮圖名與資料夾名一致', () => {
    expect(encodeCommonsName('Aeria;_photograph.jpg')).toBe('Aeria%3B_photograph.jpg')
    expect(encodeCommonsName('Aeria%3B_photograph.jpg')).toBe('Aeria%3B_photograph.jpg')
    expect(encodeCommonsName('A (b), c.jpg')).toBe('A_%28b%29%2C_c.jpg')
    expect(encodeCommonsName('清水寺.jpg')).toBe('%E6%B8%85%E6%B0%B4%E5%AF%BA.jpg')
    const url = `${T}6/6c/Aeria%3B_photo.jpg/960px-Aeria%3B_photo.jpg`
    expect(commonsThumb(url, 250)).toBe(`${T}6/6c/Aeria%3B_photo.jpg/250px-Aeria%3B_photo.jpg`)
  })
  it('不是 Commons 的網址原樣', () => {
    expect(commonsThumb('https://example.com/a.jpg', 500)).toBe('https://example.com/a.jpg')
  })
})

describe('commonsCandidates', () => {
  it('要的寬度 → 更小的標準寬度 → 原圖', () => {
    const url = `${T}6/6d/S.jpg/960px-S.jpg`
    expect(commonsCandidates(url, 960)).toEqual([
      `${T}6/6d/S.jpg/960px-S.jpg`,
      `${T}6/6d/S.jpg/500px-S.jpg`,
      `${T}6/6d/S.jpg/330px-S.jpg`,
      `${T}6/6d/S.jpg/250px-S.jpg`,
      'https://upload.wikimedia.org/wikipedia/commons/6/6d/S.jpg',
    ])
    expect(commonsCandidates('https://example.com/a.jpg', 500)).toEqual(['https://example.com/a.jpg'])
  })
  it('原圖反推', () => {
    expect(commonsOriginal(`${T}6/6d/S.jpg/250px-S.jpg`)).toBe('https://upload.wikimedia.org/wikipedia/commons/6/6d/S.jpg')
    expect(commonsOriginal('https://example.com/a.jpg')).toBeNull()
  })
})

describe('commonsWidthFor', () => {
  it('畫面寬 × devicePixelRatio 取夠大的標準寬度', () => {
    expect(commonsWidthFor(400, 1)).toBe(500)
    expect(commonsWidthFor(390, 2)).toBe(960)
    expect(commonsWidthFor(390, 3)).toBe(1280)
    expect(commonsWidthFor(820, 2)).toBe(1920)
    expect(commonsWidthFor(1600, 3)).toBe(1920)
  })
})
