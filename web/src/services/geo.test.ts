import { beforeAll, describe, expect, it, vi } from 'vitest'

import shapes from '../../public/geo/prefectures.json'
import { focusArea, loadPrefectureShapes, outsideOf, prefectureShape } from './geo'

// 縣界是 public/geo/prefectures.json（網站上的靜態檔）：測試直接匯入，不經網路
beforeAll(async () => {
  vi.stubGlobal('fetch', async () => ({ json: async () => shapes }))
  await loadPrefectureShapes()
  vi.unstubAllGlobals()
})

const contains = (b: number[], lng: number, lat: number) => b[0]! <= lng && lng <= b[2]! && b[1]! <= lat && lat <= b[3]!

describe('focusArea（專心模式的範圍）', () => {
  it('沖繩：範圍與拉遠的極限都含八重山、與那國、大東', () => {
    const f = focusArea('okinawa')!
    for (const [lng, lat] of [
      [123.0, 24.45], // 與那國
      [124.15, 24.34], // 石垣
      [125.3, 24.8], // 宮古
      [131.25, 25.85], // 南大東
      [127.68, 26.21], // 那霸
    ] as const) {
      expect(contains(f.bounds, lng, lat)).toBe(true)
      expect(contains(f.frame, lng, lat)).toBe(true)
    }
  })

  it('東京：小笠原到得了，但拉遠的極限不含小笠原（伊豆諸島照算）', () => {
    const f = focusArea('tokyo')!
    expect(contains(f.bounds, 142.19, 27.09)).toBe(true) // 父島
    expect(contains(f.frame, 142.19, 27.09)).toBe(false)
    expect(contains(f.frame, 139.79, 33.11)).toBe(true) // 八丈島
    expect(contains(f.frame, 139.69, 35.69)).toBe(true) // 新宿
  })

  it('縣界外不遠的景點算進範圍；座標錯得很遠的不跟著擴大', () => {
    const shimane = focusArea('shimane', [{ lng: 131.87, lat: 37.24 }])! // 竹島
    expect(contains(shimane.bounds, 131.87, 37.24)).toBe(true)
    expect(shimane.points).toContainEqual([131.87, 37.24])
    const tokyo = focusArea('tokyo', [{ lng: 133.59, lat: 34.58 }])!
    expect(contains(tokyo.bounds, 133.59, 34.58)).toBe(false)
  })

  it('四周留海：至少 0.15 度、最多 1 度', () => {
    const k = focusArea('kanagawa')!
    const shape = prefectureShape('kanagawa')!
    const lats = shape.geometry.coordinates.flatMap((poly) => poly[0]!.map((p) => p[1]!))
    const m = Math.min(...lats) - k.bounds[1]
    expect(m).toBeGreaterThanOrEqual(0.15 - 1e-9)
    expect(m).toBeLessThanOrEqual(1)
    expect(focusArea('hokkaido')!.bounds[3] - 45.56).toBeLessThanOrEqual(1 + 0.01)
  })

  it('縣界多邊形裡的景點不另外算一點；日帰り（extra）的地點一定算進範圍', () => {
    const f = focusArea('kanagawa', [{ lng: 139.55, lat: 35.32 }], [{ lng: 138.73, lat: 35.36 }])! // 鎌倉、富士山（靜岡・山梨）
    expect(f.points).toEqual([[138.73, 35.36]])
    expect(contains(f.bounds, 138.73, 35.36)).toBe(true)
    expect(f.rings).toHaveLength(prefectureShape('kanagawa')!.geometry.coordinates.length)
  })
})

describe('outsideOf（縣外變淡）', () => {
  it('外圈蓋住全世界，每一塊陸地是一個和外圈反向的洞', () => {
    const shape = prefectureShape('nagasaki')!
    const mask = outsideOf(shape)
    const [world, ...holes] = mask.geometry.coordinates
    expect(holes).toHaveLength(shape.geometry.coordinates.length)
    const signed = (r: number[][]) => r.reduce((a, p, i) => a + (r[(i + r.length - 1) % r.length]![0]! - p[0]!) * (r[(i + r.length - 1) % r.length]![1]! + p[1]!), 0)
    const dir = Math.sign(signed(world!))
    for (const h of holes) expect(Math.sign(signed(h))).toBe(-dir)
  })
})
