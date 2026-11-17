import { describe, expect, it } from 'vitest'

import { collapseLog, type LogItem, logFields, logText } from './tripLog'

describe('修改紀錄的說明', () => {
  it('中文和 DAY 之間有空格，待排不加', () => {
    expect(logText({ kind: 'add', name: '名古屋城', day: 0 })).toBe('把 名古屋城 加到 DAY 1')
    expect(logText({ kind: 'add', name: '名古屋城', day: -1 })).toBe('把 名古屋城 加到待排')
    expect(logText({ kind: 'move', name: '熱田神宮', day: 2 })).toBe('把 熱田神宮 移到 DAY 3')
    expect(logText({ kind: 'order', day: 1 })).toBe('調整了 DAY 2 的順序')
    expect(logText({ kind: 'order', day: -1 })).toBe('調整了待排的順序')
    expect(logText({ kind: 'stay', day: 0, name: '名古屋' })).toBe('把 DAY 1 住的車站改成 名古屋')
    expect(logText({ kind: 'stay', day: 0 })).toBe('清掉了 DAY 1 住的車站')
    expect(logText({ kind: 'days', n: 4 })).toBe('把天數改成 4 天')
  })
  it('沒有值的欄位不寫、名稱截到 80 字', () => {
    expect(logFields({ kind: 'dates' })).toEqual({ kind: 'dates' })
    expect(String(logFields({ kind: 'rename', name: 'x'.repeat(100) }).name)).toHaveLength(80)
  })
  it('同一個人連續調整同一天的順序只留最新一筆', () => {
    const it = (id: string, by: string, day: number, kind: LogItem['kind'] = 'order'): LogItem => ({ id, by, kind, day, at: 0 })
    const out = collapseLog([it('3', 'a', 1), it('2', 'a', 1), it('1', 'b', 1), it('0', 'a', 1, 'move')])
    expect(out.map((x) => x.id)).toEqual(['3', '1', '0'])
  })
})
