import { describe, expect, it } from 'vitest'

import { DraftField, isImeEnter } from './draftField'

const trim = { normalize: (v: string) => v.trim() }

describe('DraftField', () => {
  it('沒在編輯：草稿跟著 snapshot', () => {
    const f = new DraftField('東京')
    expect(f.receive('大阪')).toBe(true)
    expect(f.draft).toBe('大阪')
    expect(f.receive('大阪')).toBe(false)
  })

  it('編輯中：snapshot 不改草稿（對方改名、自己存檔的回音）', () => {
    const f = new DraftField('東京', trim)
    f.focus()
    f.input('東京旅')
    expect(f.receive('大阪')).toBe(false)
    expect(f.draft).toBe('東京旅')
    expect(f.blur()).toBe('東京旅')
    expect(f.draft).toBe('東京旅')
  })

  it('組字中不存檔，組完才存', () => {
    const f = new DraftField('', trim)
    f.focus()
    f.compositionStart()
    f.input('東ㄐㄧㄥ')
    expect(f.flush()).toBeNull()
    f.compositionEnd('東京')
    expect(f.flush()).toBe('東京')
    // 沒有再改就不重複存
    expect(f.flush()).toBeNull()
  })

  it('存檔後舊的 snapshot 不會讓草稿閃回去', () => {
    const f = new DraftField('東京', trim)
    f.focus()
    f.input('東京旅')
    expect(f.flush(1000)).toBe('東京旅')
    f.input('東京旅行')
    expect(f.blur(true, 1100)).toBe('東京旅行')
    // 第一次存的回音、然後第二次的
    expect(f.receive('東京旅', 1200)).toBe(false)
    expect(f.draft).toBe('東京旅行')
    expect(f.receive('東京旅行', 1300)).toBe(false)
    expect(f.draft).toBe('東京旅行')
    // 之後對方改名照常跟著變
    expect(f.receive('大阪', 1400)).toBe(true)
  })

  it('存檔一直沒回來：過了期限採用最新的 snapshot', () => {
    const f = new DraftField('東京', { pendingMs: 1000 })
    f.focus()
    f.input('東京旅')
    f.blur(true, 0)
    expect(f.receive('東京', 500)).toBe(false)
    expect(f.receive('大阪', 2000)).toBe(true)
    expect(f.draft).toBe('大阪')
  })

  it('沒改就離開：採用編輯中錯過的 snapshot，不把對方的修改蓋回去', () => {
    const f = new DraftField('東京')
    f.focus()
    f.receive('大阪')
    expect(f.blur()).toBeNull()
    expect(f.draft).toBe('大阪')
  })

  it('只差頭尾空白不算修改', () => {
    const f = new DraftField('東京', trim)
    f.focus()
    f.input('東京 ')
    expect(f.blur()).toBeNull()
    expect(f.draft).toBe('東京')
  })

  it('不能存（離線）：回到最新的值', () => {
    const f = new DraftField('東京')
    f.focus()
    f.input('東京旅')
    expect(f.blur(false)).toBeNull()
    expect(f.draft).toBe('東京')
  })

  it('Esc：回到編輯前的值', () => {
    const f = new DraftField('東京')
    f.focus()
    f.input('東京旅')
    f.revert()
    expect(f.draft).toBe('東京')
    expect(f.blur()).toBeNull()
  })
})

describe('isImeEnter', () => {
  it('組字中的 Enter（選字）不算完成', () => {
    expect(isImeEnter({ isComposing: true, keyCode: 13 })).toBe(true)
    // Safari：compositionend 先到，Enter 的 keyCode 是 229
    expect(isImeEnter({ isComposing: false, keyCode: 229 })).toBe(true)
    expect(isImeEnter({ isComposing: false, keyCode: 13 })).toBe(false)
  })
})
