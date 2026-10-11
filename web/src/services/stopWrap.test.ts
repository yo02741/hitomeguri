import { describe, expect, it } from 'vitest'

import { wrapStops } from './stopWrap'

// 每個字寬 10，方便算
const w = (t: string) => t.length * 10

describe('wrapStops', () => {
  it('放得下就一行', () => {
    expect(wrapStops(['浅草寺', '雷門'], 200, w)).toEqual(['浅草寺 → 雷門'])
  })

  it('在「→」處換行，新的一行以「→ 」開頭', () => {
    expect(wrapStops(['明治神宮', '東京スカイツリー', '渋谷スクランブル交差点'], 160, w)).toEqual([
      '明治神宮 → 東京スカイツリー',
      '→ 渋谷スクランブル交差点',
    ])
  })

  it('一個地點太長時照字切', () => {
    const lines = wrapStops(['ワーナー ブラザース スタジオツアー東京 - メイキング・オブ・ハリー・ポッター'], 100, w)
    expect(lines.every((l) => w(l) <= 100)).toBe(true)
    expect(lines.join('')).toBe('ワーナー ブラザース スタジオツアー東京 - メイキング・オブ・ハリー・ポッター')
  })
})
