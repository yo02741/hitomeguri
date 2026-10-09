import { describe, expect, it } from 'vitest'

import { regions } from '../data/regions'
import type { UkiyoeSpot, UkiyoeWork } from './bundles'
import { flattenPrints, groupUkiyoe, printUrl, workCredit, workMeta } from './ukiyoe'

const work = (i: string, extra: Partial<UkiyoeWork> = {}): UkiyoeWork => ({
  i,
  t: '',
  c: '葛飾北斎',
  f: `a/ab/${i}.jpg/960px-${i}.jpg`,
  a: 'Katsushika Hokusai',
  l: 'Public domain',
  u: `https://commons.wikimedia.org/wiki/File:${i}.jpg`,
  ...extra,
})
const spot = (s: string, p: string, sc: number, w: UkiyoeWork[]): UkiyoeSpot => ({ s, p, n: s, sc, w })

describe('printUrl', () => {
  it('換成 Commons 的標準縮圖寬度', () => {
    expect(printUrl('a/ab/Great_Wave.jpg/960px-Great_Wave.jpg', 500)).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Great_Wave.jpg/500px-Great_Wave.jpg',
    )
  })
  it('只換最後一段（檔名裡有 px- 也不動）', () => {
    expect(printUrl('a/ab/100px-x.jpg/960px-100px-x.jpg', 500)).toMatch(/\/100px-x\.jpg\/500px-100px-x\.jpg$/)
  })
  it('完整網址照原樣', () => {
    const u = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/small.jpg'
    expect(printUrl(u, 960)).toBe(u)
  })
})

describe('workMeta, workCredit', () => {
  it('系列與年份有的才寫', () => {
    expect(workMeta(work('Q1', { se: '冨嶽三十六景', y: 1831 }))).toBe('冨嶽三十六景・1831年')
    expect(workMeta(work('Q1', { y: 1856 }))).toBe('1856年')
    expect(workMeta(work('Q1'))).toBe('')
  })
  it('作者不明時只寫授權', () => {
    expect(workCredit(work('Q1'))).toBe('Katsushika Hokusai・Public domain')
    expect(workCredit(work('Q1', { a: '不明' }))).toBe('Public domain')
  })
})

describe('groupUkiyoe', () => {
  it('依縣北到南分組，縣內依分數', () => {
    const groups = groupUkiyoe(
      [spot('wd-Q2', 'kyoto', 50, [work('Q9')]), spot('wd-Q3', 'tokyo', 60, [work('Q7')]), spot('wd-Q4', 'tokyo', 90, [work('Q8'), work('Q6')])],
      regions,
    )
    expect(groups.map((g) => g.region.prefecture)).toEqual(['tokyo', 'kyoto'])
    expect(groups[0]!.spots.map((s) => s.s)).toEqual(['wd-Q4', 'wd-Q3'])
    expect(flattenPrints(groups).map((p) => p.work.i)).toEqual(['Q8', 'Q6', 'Q7', 'Q9'])
  })
})
