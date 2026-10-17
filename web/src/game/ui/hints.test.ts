import { describe, expect, it } from 'vitest'

import { KEYMAP } from '../engine/input'

import { FACING_SETTLE_MS, FacingSettle, facingOf, type Hint, type HintCtx, hintKeyOf, hintsFor, hintsSpoken, KEY_NAME, touchCue } from './hints'

// 按鍵提示（P4，規格 §13 的 1）：情境 → 列的鍵。提示要跟實際的按鍵一致（KEYMAP），文案是動詞、沒有驚嘆號。
const walk = (o: Partial<Extract<HintCtx, { at: 'walk' }>> = {}): HintCtx => ({ at: 'walk', facing: null, photo: false, alwaysRun: false, map: true, ...o })
const text = (hs: readonly Hint[]) => hs.map((h) => `${h.hold ? '按住 ' : ''}${KEY_NAME[h.key]} ${h.label}${h.hot ? '*' : ''}`).join('　')

const ALL: HintCtx[] = [
  { at: 'title' },
  walk(),
  walk({ facing: 'talk' }),
  walk({ facing: 'look', photo: true }),
  walk({ facing: 'stamp', alwaysRun: true, map: false }),
  { at: 'say', more: true },
  { at: 'say', more: false },
  { at: 'ask' },
  { at: 'menu', tabs: true, page: 'map' },
  { at: 'menu', tabs: false, page: 'map' },
  { at: 'menu', tabs: false, page: 'settings' },
  ...['viewfinder', 'photo', 'shop', 'travel', 'stamp', 'room', 'book', 'card', 'depart', 'pay'].map((panel): HintCtx => ({ at: 'panel', panel })),
  { at: 'panel', panel: 'viewfinder', zoom: 2 },
  ...['buy', 'eat', 'sit', 'pay', 'pick'].map((mode): HintCtx => ({ at: 'panel', panel: 'shop', mode })),
  ...['list', 'origin', 'board', 'town', 'town-none', 'route'].map((mode): HintCtx => ({ at: 'panel', panel: 'travel', mode })),
  { at: 'menu', tabs: false, page: 'quests' },
  { at: 'menu', tabs: false, page: 'room' },
  { at: 'ride' },
  { at: 'paused' },
  { at: 'busy' },
]

describe('按鍵提示：鍵名跟實際的鍵位一樣', () => {
  it('Z＝A、X＝B、C＝相機、Q＝手帳、P＝暫停（input.ts 的 KEYMAP）', () => {
    expect(KEYMAP[`Key${KEY_NAME.A}`]).toBe('A')
    expect(KEYMAP[`Key${KEY_NAME.B}`]).toBe('B')
    expect(KEYMAP[`Key${KEY_NAME.CAMERA}`]).toBe('CAMERA')
    expect(KEYMAP[`Key${KEY_NAME.START}`]).toBe('START')
    expect(KEYMAP[`Key${KEY_NAME.PAUSE}`]).toBe('PAUSE')
    // M 是介面的開關（PlayView 自己接），不是遊戲的按鍵
    expect(KEYMAP[`Key${KEY_NAME.MAP}`]).toBeUndefined()
  })
})

describe('按鍵提示：各情境', () => {
  it('走路：Z 查看、按住 X 跑、C 相機、Q 手帳、M 小地圖（M 只開關角落的小地圖，不是手帳的地圖頁）', () => {
    expect(text(hintsFor(walk()))).toBe('Z 查看　按住 X 跑　C 相機　Q 手帳　M 小地圖')
  })
  it('面前有人：Z 說話（亮）；告示牌：Z 查看（亮）；章台：Z 蓋章', () => {
    expect(text(hintsFor(walk({ facing: 'talk' })))).toContain('Z 說話*')
    expect(text(hintsFor(walk({ facing: 'look' })))).toContain('Z 查看*')
    expect(text(hintsFor(walk({ facing: 'stamp' })))).toContain('Z 蓋章*')
  })
  it('站在拍攝點上：C 拍照（亮）', () => {
    const t = text(hintsFor(walk({ photo: true })))
    expect(t).toContain('C 拍照*')
    expect(t).not.toContain('C 相機')
  })
  it('一直跑：按住 X 走；室內沒有小地圖', () => {
    const t = text(hintsFor(walk({ alwaysRun: true, map: false })))
    expect(t).toContain('按住 X 走')
    expect(t).not.toContain('M ')
  })
  it('對話：Z 下一頁、最後一頁 Z 繼續；選單：上下選、Z 決定、X 取消', () => {
    expect(text(hintsFor({ at: 'say', more: true }))).toBe('Z 下一頁')
    expect(text(hintsFor({ at: 'say', more: false }))).toBe('Z 繼續')
    expect(text(hintsFor({ at: 'ask' }))).toBe('↑↓ 選　Z 決定　X 取消')
  })
  it('取景框：Z 拍照、C 變焦、X 收起（放大時多一個十字鍵移動）', () => {
    expect(text(hintsFor({ at: 'panel', panel: 'viewfinder' }))).toBe('Z 拍照　C 變焦　X 收起')
    expect(text(hintsFor({ at: 'panel', panel: 'viewfinder', zoom: 2 }))).toBe('Z 拍照　C 變焦　↑↓←→ 移動　X 收起')
  })
  it('手帳：頁籤上換頁、打開、關上；頁裡選、返回（設定頁左右調整；地圖、委託、房間只能看，不列 Z）', () => {
    expect(text(hintsFor({ at: 'menu', tabs: true, page: 'map' }))).toBe('↑↓ 換頁　Z 打開　X 關上')
    expect(text(hintsFor({ at: 'menu', tabs: false, page: 'bag' }))).toBe('↑↓ 選　Z 決定　X 返回')
    for (const page of ['map', 'quests', 'room']) expect(text(hintsFor({ at: 'menu', tabs: false, page }))).toBe('↑↓ 選　X 返回')
    expect(text(hintsFor({ at: 'menu', tabs: false, page: 'settings' }))).toBe('↑↓ 選　←→ 調整　X 返回')
  })
  it('店、剪票口、蓋章、坐車、暫停；不認得的面板用一般的', () => {
    expect(text(hintsFor({ at: 'panel', panel: 'shop' }))).toBe('↑↓ 選　Z 決定　X 離開')
    expect(text(hintsFor({ at: 'panel', panel: 'travel' }))).toBe('↑↓ 選　Z 出發　X 不去了')
    expect(text(hintsFor({ at: 'panel', panel: 'stamp' }))).toBe('Z 收起')
    expect(text(hintsFor({ at: 'ride' }))).toBe('Z 跳過')
    expect(text(hintsFor({ at: 'paused' }))).toBe('P 繼續')
    expect(text(hintsFor({ at: 'panel', panel: 'depart' }))).toBe('↑↓ 選　Z 決定　X 返回')
    expect(hintsFor({ at: 'busy' })).toEqual([])
  })
  it('P4 的面板：付款、出發的城市、出發看板與想去的地方', () => {
    expect(text(hintsFor({ at: 'panel', panel: 'shop', mode: 'buy' }))).toBe('↑↓ 選　Z 買　X 離開')
    expect(text(hintsFor({ at: 'panel', panel: 'shop', mode: 'eat' }))).toBe('↑↓ 選　Z 吃　X 離開')
    expect(text(hintsFor({ at: 'panel', panel: 'shop', mode: 'pay' }))).toBe('↑↓ 選　Z 付款　X 回去')
    // 明信片選照片：面板的鈕寫「回去」
    expect(text(hintsFor({ at: 'panel', panel: 'shop', mode: 'pick' }))).toBe('↑↓ 選　Z 決定　X 回去')
    // 新遊戲的出發城市：一定要選（沒有 X）
    expect(text(hintsFor({ at: 'panel', panel: 'travel', mode: 'origin' }))).toBe('↑↓ 選　Z 決定')
    expect(text(hintsFor({ at: 'panel', panel: 'travel', mode: 'board' }))).toBe('↑↓ 選　←→ 換頁　Z 出發　X 不去了')
    expect(text(hintsFor({ at: 'panel', panel: 'travel', mode: 'town' }))).toBe('↑↓ 選　←→ 換頁　Z 看路線　X 不去了')
    // 選的那一鎮從這個城市去不了：Z 只會響錯的聲音，不列
    expect(text(hintsFor({ at: 'panel', panel: 'travel', mode: 'town-none' }))).toBe('↑↓ 選　←→ 換頁　X 不去了')
    expect(text(hintsFor({ at: 'panel', panel: 'travel', mode: 'route' }))).toBe('↑↓ 選　Z 出發　X 返回')
  })
  it('文案：短的動詞，沒有驚嘆號、句點、emoji；一個情境最多 5 個鍵、同一個鍵不出現兩次', () => {
    for (const c of ALL) {
      const hs = hintsFor(c)
      expect(hs.length, hintKeyOf(c)).toBeLessThanOrEqual(5)
      expect(new Set(hs.map((h) => h.key)).size, hintKeyOf(c)).toBe(hs.length)
      for (const h of hs) {
        expect(h.label, hintKeyOf(c)).not.toMatch(/[!！。？?]|\p{Extended_Pictographic}/u)
        expect([...h.label].length, h.label).toBeLessThanOrEqual(3)
      }
    }
  })
  it('讀屏的一行', () => {
    expect(hintsSpoken(hintsFor(walk({ photo: true })))).toBe('Z 查看，按住 X 跑，C 拍照，Q 手帳，M 小地圖')
    expect(hintsSpoken(hintsFor({ at: 'ask' }))).toBe('上下 選，Z 決定，X 取消')
  })
})

describe('面前的東西 → A 做什麼', () => {
  it('人（NPC、站櫃台的店員）說話；告示牌、桌子查看；章台蓋章', () => {
    expect(facingOf('npc', true)).toBe('talk')
    expect(facingOf('shop', true)).toBe('talk')
    expect(facingOf('travel', true)).toBe('talk')
    // 沒有人的出發看板、巴士站的牌子：查看
    expect(facingOf('travel', false)).toBe('look')
    expect(facingOf('sign', false)).toBe('look')
    expect(facingOf('desk', false)).toBe('look')
    expect(facingOf('stamp', false)).toBe('stamp')
    // 房間的架子、相框：放了東西才有角色（畫出那樣東西），但不是人
    expect(facingOf('shelfSlot', true)).toBe('look')
    expect(facingOf('frameSlot', true)).toBe('look')
    expect(facingOf('shelfSlot', false)).toBe('look')
    expect(facingOf(undefined, false)).toBeNull()
  })
})

describe('面前的東西停一下才亮（走過路人旁邊不閃）', () => {
  const T = FACING_SETTLE_MS
  const npcA = { id: 'a' }
  const npcB = { id: 'b' }
  it('走路中換到面前有人：同一個人停 FACING_SETTLE_MS 才亮，等的時候是不亮的「Z 查看」', () => {
    const s = new FacingSettle()
    const shown = walk()
    expect(s.apply(shown, walk({ facing: 'talk' }), npcA, true, 1000)).toEqual(walk())
    expect(s.apply(shown, walk({ facing: 'talk' }), npcA, true, 1000 + T - 1)).toEqual(walk())
    expect(s.apply(shown, walk({ facing: 'talk' }), npcA, true, 1000 + T)).toEqual(walk({ facing: 'talk' }))
  })
  it('路人從面前走過去（換了一個人、或不在了）：重新算', () => {
    const s = new FacingSettle()
    s.apply(walk(), walk({ facing: 'talk' }), npcA, true, 0)
    expect(s.apply(walk(), walk({ facing: 'talk' }), npcB, true, T)).toEqual(walk())
    expect(s.apply(walk(), walk(), null, true, T + 50)).toEqual(walk())
    expect(s.apply(walk(), walk({ facing: 'talk' }), npcB, true, T + 100)).toEqual(walk())
    expect(s.apply(walk(), walk({ facing: 'talk' }), npcB, true, 2 * T + 100)).toEqual(walk({ facing: 'talk' }))
  })
  it('自己或路人還在走（走過去、原地踏步）：不亮，停下來再算', () => {
    const s = new FacingSettle()
    s.apply(walk(), walk({ facing: 'talk' }), npcA, false, 0)
    expect(s.apply(walk(), walk({ facing: 'talk' }), npcA, false, 2 * T)).toEqual(walk())
    expect(s.apply(walk(), walk({ facing: 'talk' }), npcA, true, 2 * T + 10)).toEqual(walk())
    expect(s.apply(walk(), walk({ facing: 'talk' }), npcA, true, 3 * T + 10)).toEqual(walk({ facing: 'talk' }))
    // 亮著的時候那個人走起來：熄掉
    expect(s.apply(walk({ facing: 'talk' }), walk({ facing: 'talk' }), npcA, false, 3 * T + 80)).toEqual(walk())
  })
  it('不在面前了馬上換回；拍攝點的「拍照」不等', () => {
    const s = new FacingSettle()
    expect(s.apply(walk({ facing: 'talk' }), walk(), null, true, 0)).toEqual(walk())
    expect(s.apply(walk(), walk({ photo: true }), null, true, 10)).toEqual(walk({ photo: true }))
    expect(s.apply(walk(), walk({ facing: 'look', photo: true }), npcA, true, 20)).toEqual(walk({ photo: true }))
  })
  it('從對話、面板回來時面前就有的人：馬上亮', () => {
    const s = new FacingSettle()
    expect(s.apply({ at: 'say', more: false }, walk({ facing: 'talk' }), npcA, true, 0)).toEqual(walk({ facing: 'talk' }))
    // 接著還是同一個人：照亮著
    expect(s.apply(walk({ facing: 'talk' }), walk({ facing: 'talk' }), npcA, true, 70)).toEqual(walk({ facing: 'talk' }))
    expect(s.apply({ at: 'title' }, { at: 'say', more: true }, null, true, 100)).toEqual({ at: 'say', more: true })
  })
})

describe('手機：亮的鈕與鈕上的字', () => {
  it('站在拍攝點上：相機鈕亮、寫「拍照」；面前有人：A 亮', () => {
    expect(touchCue(walk({ photo: true }))).toEqual({ hot: ['CAMERA'], labels: { CAMERA: '拍照' } })
    expect(touchCue(walk({ facing: 'talk' }))).toEqual({ hot: ['A'], labels: {} })
    expect(touchCue(walk())).toEqual({ hot: [], labels: {} })
  })
  it('取景框：A 拍照、B 收起、相機鈕變焦（跟桌機的鍵一樣）', () => {
    const c = touchCue({ at: 'panel', panel: 'viewfinder' })
    expect(c.labels).toEqual({ A: '拍照', B: '收起', CAMERA: '變焦' })
    const desk = hintsFor({ at: 'panel', panel: 'viewfinder' })
    for (const [k, v] of Object.entries(c.labels)) expect(desk.find((h) => h.key === k)?.label).toBe(v)
  })
  it('坐車：A 寫「跳過」；其他情境不換字', () => {
    expect(touchCue({ at: 'ride' }).labels).toEqual({ A: '跳過' })
    expect(touchCue({ at: 'menu', tabs: true, page: 'map' })).toEqual({ hot: [], labels: {} })
  })
})
