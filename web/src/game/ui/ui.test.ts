import { describe, expect, it } from 'vitest'

import { memoryStore } from '../engine/save'

import { DialogFlow, type DialogLine } from './dialog'
import { available, fitScreen, layoutOf, PAD_H, PAD_W, TOP_BAR } from './layout'
import { NOTEBOOK_PAGES } from './notebook'
import { rove, roveKeyOf } from './rove'
import { loadUi, sanitizeUi, saveUi, toEngine, UI_DEFAULTS, UI_KEY, type UiStorage } from './settings'
import { moodOf, sfxOf, songOf } from './sound'
import { charsPerSecond, isWide, length, paginate, tokens, typed, unitMeasure, visible, wrap } from './text'
import { gateStore, RESTART_ASK, RESTART_OPTIONS, titleOptions } from './title'

// 估寬：全形 2、半形 1（fontPx = 2）
const m = unitMeasure(2)

describe('對話框的字：折行與兩行一頁', () => {
  it('全形、半形的寬', () => {
    expect(isWide('あ')).toBe(true)
    expect(isWide('京')).toBe(true)
    expect(isWide('。')).toBe(true)
    expect(isWide('A')).toBe(false)
    expect(m('京都 A')).toBe(6)
  })

  it('一行放不下就換行，兩行一頁', () => {
    // 一行 10 個單位 = 5 個全形字
    const pages = paginate('一二三四五六七八九十甲乙丙丁戊己', 10, m)
    expect(pages).toEqual(['一二三四五\n六七八九十', '甲乙丙丁戊\n己'])
  })

  it('句讀、收尾的括號不放在行首，開頭的括號不放在行尾', () => {
    // 「。」跟著「五」一起推到下一行（追い出し），一行不會超過寬度
    expect(wrap('一二三四五。六', 10, m)).toEqual(['一二三四', '五。六'])
    expect(wrap('一二三四。五', 10, m)).toEqual(['一二三四。', '五'])
    expect(wrap('一二三四「五六」', 10, m)).toEqual(['一二三四', '「五六」'])
    expect(tokens('「好」。')).toEqual(['「好」。'])
  })

  it('英文字不從中間斷；太長的字才拆', () => {
    expect(wrap('ab hello world', 8, m)).toEqual(['ab hello', 'world'])
    expect(wrap('abcdefghijkl', 5, m)).toEqual(['abcde', 'fghij', 'kl'])
  })

  it('換行符一定換行；行首的空白丟掉', () => {
    expect(wrap('一二\n三', 10, m)).toEqual(['一二', '三'])
    expect(wrap('一二三四五 六', 10, m)).toEqual(['一二三四五', '六'])
    expect(paginate('', 10, m)).toEqual([''])
  })

  it('每一頁都不超過兩行、每行不超過寬度', () => {
    const text = '繞著池子走一圈，腳步就輕了。草長得比我還高。今天的風很舒服。池子邊的花，晚上會合起來，天亮了再打開。'
    for (const max of [12, 20, 34, 46]) {
      const pages = paginate(text, max, m)
      for (const p of pages) {
        const lines = p.split('\n')
        expect(lines.length).toBeLessThanOrEqual(2)
        for (const l of lines) expect(m(l)).toBeLessThanOrEqual(max)
      }
      expect(pages.join('').replace(/\n/g, '')).toBe(text)
    }
  })

  it('打字機：一般每秒 40 字、減少動態直接出現', () => {
    expect(charsPerSecond('normal')).toBe(40)
    expect(charsPerSecond('slow')).toBe(20)
    expect(charsPerSecond('fast')).toBe(80)
    expect(charsPerSecond('instant')).toBe(Infinity)
    expect(charsPerSecond('slow', true)).toBe(Infinity)
    expect(typed(0.5, 40, 100)).toBe(20)
    expect(typed(10, 40, 12)).toBe(12)
    expect(typed(0, Infinity, 12)).toBe(12)
    expect(visible('一二\n三四', 3)).toBe('一二\n三')
    expect(length('一二\n三四')).toBe(4)
  })
})

const say = (text: string): DialogLine => ({ id: 1, kind: 'say', text, options: [], cancel: 0 })
const ask = (text: string, options: string[], cancel = options.length - 1): DialogLine => ({ id: 2, kind: 'ask', text, options, cancel })

describe('對話框的流程', () => {
  it('A：先出完這一頁、再換頁、最後結束', () => {
    const f = new DialogFlow(say('x'), ['一二\n三四', '五'], 40)
    expect(f.typing).toBe(true)
    expect(f.press('A')).toEqual({ kind: 'finish' })
    expect(f.typing).toBe(false)
    expect(f.more).toBe(true)
    expect(f.press('A')).toEqual({ kind: 'page' })
    expect(f.page).toBe(1)
    expect(f.shown).toBe(0)
    f.tick(1)
    expect(f.typing).toBe(false)
    expect(f.press('A')).toEqual({ kind: 'done', index: 0 })
  })

  it('打字聲：空白不算', () => {
    const f = new DialogFlow(say('x'), ['一 二'], 10)
    expect(f.tick(0.3)).toBe(2) // 一、空白 → 響一下；（0.3 秒 3 個字）一、空白、二 → 兩下
    expect(f.typing).toBe(false)
  })

  it('立即：一打開就出完', () => {
    const f = new DialogFlow(say('x'), ['一二三'], Infinity)
    expect(f.typing).toBe(false)
    expect(f.press('A')).toEqual({ kind: 'done', index: 0 })
  })

  it('是／否：最後一頁出完才有游標；上下繞一圈；A 選、B 取消', () => {
    const f = new DialogFlow(ask('要嗎', ['要', '不要']), ['要嗎'], 40)
    expect(f.asking).toBe(false)
    expect(f.press('down')).toEqual({ kind: 'none' })
    f.finish()
    expect(f.asking).toBe(true)
    expect(f.more).toBe(false)
    expect(f.press('down')).toEqual({ kind: 'cursor' })
    expect(f.choice).toBe(1)
    expect(f.press('down')).toEqual({ kind: 'cursor' })
    expect(f.choice).toBe(0)
    expect(f.press('up')).toEqual({ kind: 'cursor' })
    expect(f.choice).toBe(1)
    expect(f.press('A')).toEqual({ kind: 'done', index: 1 })
    const g = new DialogFlow(ask('要嗎', ['甲', '乙', '丙'], 0), ['要嗎'], Infinity)
    g.press('down')
    expect(g.press('B')).toEqual({ kind: 'done', index: 0 })
  })

  it('點選項：字沒出完先出完；出完了點哪個選哪個', () => {
    const f = new DialogFlow(ask('要嗎', ['要', '不要']), ['要嗎'], 40)
    expect(f.pick(1)).toEqual({ kind: 'finish' })
    expect(f.pick(1)).toEqual({ kind: 'done', index: 1 })
    expect(f.pick(5)).toEqual({ kind: 'none' })
  })

  it('重新分頁：停在差不多的地方', () => {
    const f = new DialogFlow(say('x'), ['一二', '三四', '五六'], 40)
    f.finish()
    f.press('A')
    f.finish()
    f.press('A')
    f.finish()
    expect(f.page).toBe(2)
    f.repaginate(['一二三四五六'])
    expect(f.page).toBe(0)
    expect(f.typing).toBe(false)
  })
})

describe('選單的游標（roving focus）', () => {
  it('直的一排：上下、繞回、Home／End', () => {
    expect(rove(0, 'down', 8)).toBe(1)
    expect(rove(7, 'down', 8)).toBe(0)
    expect(rove(0, 'up', 8)).toBe(7)
    expect(rove(0, 'up', 8, { wrap: false })).toBe(0)
    expect(rove(3, 'left', 8)).toBe(3)
    expect(rove(3, 'home', 8)).toBe(0)
    expect(rove(3, 'end', 8)).toBe(7)
    expect(rove(0, 'down', 0)).toBe(-1)
    expect(rove(99, 'down', 3, { wrap: false })).toBe(2)
  })

  it('橫的一排：左右', () => {
    expect(rove(1, 'right', 4, { orientation: 'horizontal' })).toBe(2)
    expect(rove(3, 'right', 4, { orientation: 'horizontal' })).toBe(0)
    expect(rove(3, 'right', 4, { orientation: 'horizontal', wrap: false })).toBe(3)
    expect(rove(1, 'down', 4, { orientation: 'horizontal' })).toBe(1)
  })

  it('格子：左右不跨列、上下同一欄、最後一列不滿', () => {
    const g = { orientation: 'grid' as const, cols: 3 }
    // 0 1 2 / 3 4 5 / 6 7
    expect(rove(1, 'right', 8, g)).toBe(2)
    expect(rove(2, 'right', 8, g)).toBe(0)
    expect(rove(2, 'right', 8, { ...g, wrap: false })).toBe(2)
    expect(rove(3, 'left', 8, g)).toBe(5)
    expect(rove(7, 'right', 8, g)).toBe(6)
    expect(rove(1, 'down', 8, g)).toBe(4)
    expect(rove(5, 'down', 8, g)).toBe(7)
    expect(rove(7, 'down', 8, g)).toBe(1)
    expect(rove(1, 'up', 8, g)).toBe(7)
    expect(rove(0, 'up', 8, { ...g, wrap: false })).toBe(0)
  })

  it('遊戲的按鍵 → 方向', () => {
    expect(roveKeyOf('up')).toBe('up')
    expect(roveKeyOf('A')).toBe(null)
  })

  it('手帳的頁：九頁、id 不重複', () => {
    expect(NOTEBOOK_PAGES.map((p) => p.label)).toEqual(['地圖', '印帳', '相簿', '行李', '聽來的', '委託', '房間', '存檔', '設定'])
    expect(new Set(NOTEBOOK_PAGES.map((p) => p.id)).size).toBe(9)
  })
})

/** 假的 localStorage */
function fakeStorage(init: Record<string, string> = {}, broken = false): UiStorage & { data: Record<string, string> } {
  const data = { ...init }
  return {
    data,
    getItem: (k) => {
      if (broken) throw new Error('blocked')
      return data[k] ?? null
    },
    setItem: (k, v) => {
      if (broken) throw new Error('quota')
      data[k] = v
    },
  }
}

describe('介面的設定：讀寫、壞資料', () => {
  it('沒有、壞掉的 JSON、型別不對：用預設值', () => {
    expect(loadUi(fakeStorage())).toEqual(UI_DEFAULTS)
    expect(loadUi(fakeStorage({ [UI_KEY]: '{oops' }))).toEqual(UI_DEFAULTS)
    expect(loadUi(fakeStorage({ [UI_KEY]: '[1,2]' }))).toEqual(UI_DEFAULTS)
    expect(sanitizeUi({ textSpeed: 'warp', alwaysRun: 'yes' })).toEqual(UI_DEFAULTS)
    expect(sanitizeUi({ textSpeed: 'slow', alwaysRun: true, extra: 1 })).toEqual({ textSpeed: 'slow', alwaysRun: true, hints: true, minimap: true })
    expect(loadUi(null)).toEqual(UI_DEFAULTS)
  })

  it('按鍵提示、小地圖（P4）：預設開；舊的設定（沒有這兩個欄位）也是開', () => {
    expect(UI_DEFAULTS).toMatchObject({ hints: true, minimap: true })
    expect(loadUi(fakeStorage({ [UI_KEY]: JSON.stringify({ textSpeed: 'fast', alwaysRun: false }) }))).toEqual({ textSpeed: 'fast', alwaysRun: false, hints: true, minimap: true })
    expect(sanitizeUi({ hints: false, minimap: false })).toMatchObject({ hints: false, minimap: false })
    expect(sanitizeUi({ hints: 'no', minimap: 0 })).toMatchObject({ hints: true, minimap: true })
  })

  it('存了讀回來一樣；localStorage 丟錯也不壞', () => {
    const st = fakeStorage()
    saveUi(st, { textSpeed: 'fast', alwaysRun: true, hints: false, minimap: true })
    expect(JSON.parse(st.data[UI_KEY]!)).toEqual({ textSpeed: 'fast', alwaysRun: true, hints: false, minimap: true })
    expect(loadUi(st)).toEqual({ textSpeed: 'fast', alwaysRun: true, hints: false, minimap: true })
    const broken = fakeStorage({}, true)
    expect(() => saveUi(broken, UI_DEFAULTS)).not.toThrow()
    expect(loadUi(broken)).toEqual(UI_DEFAULTS)
  })

  it('套到引擎：慢的存成一般，其他設定不動', () => {
    const base = { alwaysRun: false, textSpeed: 'normal' as const, timeRate: 2 }
    expect(toEngine({ ...UI_DEFAULTS, textSpeed: 'slow', alwaysRun: true }, base)).toEqual({ alwaysRun: true, textSpeed: 'normal', timeRate: 2 })
    expect(toEngine({ ...UI_DEFAULTS, textSpeed: 'instant', alwaysRun: false }, base).textSpeed).toBe('instant')
  })
})

describe('版面與放大', () => {
  it('桌機 1280×800：4 倍、寬 240、高 160（GBA 的比例）', () => {
    expect(fitScreen(1280, 800, 'desktop')).toEqual({ scale: 4, width: 240, height: 160 })
  })
  it('iPhone 直拿 390×844：2 倍、寬 195，畫面往下長（高 256），控制區貼在下面', () => {
    expect(fitScreen(390, 844, 'portrait')).toEqual({ scale: 2, width: 195, height: 256 })
    expect(available(390, 844, 'portrait').h).toBe(844 - TOP_BAR - PAD_H)
    // 畫面下面剩的就是控制區（不會空一大段）
    const f = fitScreen(390, 844, 'portrait')
    expect(844 - TOP_BAR - f.height * f.scale).toBeGreaterThanOrEqual(PAD_H)
    // iPhone SE：高度不夠多，還是 160 起跳
    expect(fitScreen(375, 667, 'portrait').height).toBeGreaterThanOrEqual(160)
  })
  it('iPhone 打橫 844×390：2 倍、寬 240、高 160，兩側留給十字鍵與 A/B', () => {
    const f = fitScreen(844, 390, 'landscape')
    expect(f).toEqual({ scale: 2, width: 240, height: 160 })
    expect((844 - f.width * f.scale) / 2).toBeGreaterThanOrEqual(PAD_W)
  })
  it('打橫、瀏覽器的工具列佔掉高度（高 300、319、340）：不掉到 1 倍（放不下 2 倍時用 1.75 倍這種）', () => {
    for (const [w, h] of [[740, 300], [844, 319], [844, 340]] as const) {
      const f = fitScreen(w, h, 'landscape')
      expect(f.scale, `${w}×${h}`).toBeGreaterThanOrEqual(1.75)
      expect(f.height * f.scale).toBeLessThanOrEqual(h)
      expect(Number.isInteger(f.scale * 4)).toBe(true)
    }
  })
  it('倍數是整數（打橫放不下 2 倍時四分之一一級）、寬在 176–240、放得進可用範圍', () => {
    for (const [w, h] of [[320, 568], [375, 667], [414, 896], [768, 1024], [1024, 768], [1920, 1080], [600, 400], [2560, 1440]] as const) {
      for (const touch of [false, true]) {
        const lay = layoutOf(w, h, touch)
        const f = fitScreen(w, h, lay)
        const a = available(w, h, lay)
        expect(Number.isInteger(lay === 'landscape' ? f.scale * 4 : f.scale)).toBe(true)
        expect(f.width).toBeGreaterThanOrEqual(176)
        expect(f.width).toBeLessThanOrEqual(240)
        expect(f.height).toBeGreaterThanOrEqual(160)
        expect(f.height).toBeLessThanOrEqual(256)
        if (f.scale > 1) {
          expect(f.width * f.scale).toBeLessThanOrEqual(a.w)
          expect(f.height * f.scale).toBeLessThanOrEqual(a.h)
        }
      }
    }
  })
  it('有觸控才分直拿、打橫', () => {
    expect(layoutOf(1280, 800, false)).toBe('desktop')
    expect(layoutOf(390, 844, true)).toBe('portrait')
    expect(layoutOf(844, 390, true)).toBe('landscape')
  })
})

describe('聲音的名字', () => {
  it('引擎的效果音對到聲音那邊（跳台階有聲音）', () => {
    expect(sfxOf('bump')).toBe('bump')
    expect(sfxOf('jump')).toBe('jump')
    expect(sfxOf('door')).toBe('door')
    expect(sfxOf('stairs')).toBe('stairs')
    expect(sfxOf('nope')).toBe(null)
  })
  it('地圖的 bgm：P0 的 town、indoor 對到京都的鎮曲與室內曲', () => {
    expect(songOf('town')).toBe('kyoto')
    expect(songOf('indoor')).toBe('interior')
    expect(songOf('okinawa')).toBe('okinawa')
    expect(songOf(null)).toBe(null)
    expect(songOf('nope')).toBe(null)
  })
  it('夜裡換慢版', () => {
    expect(moodOf('night')).toEqual({ night: true, festival: false })
    expect(moodOf('dusk', true)).toEqual({ night: false, festival: true })
  })
})

describe('標題畫面', () => {
  it('有存檔：繼續、重新開始；沒有：開始', () => {
    expect(titleOptions(true).map((o) => o.label)).toEqual(['繼續', '重新開始'])
    expect(titleOptions(false).map((o) => o.label)).toEqual(['開始'])
  })
  it('存檔所在的縣（P3）還在讀、讀不到：「繼續」先不能選或換成「再試一次」，「重新開始」一直在', () => {
    const loading = titleOptions(true, 'loading')
    expect(loading.map((o) => [o.id, o.label, !!o.disabled])).toEqual([
      ['continue', '繼續', true],
      ['restart', '重新開始', false],
    ])
    expect(titleOptions(true, 'error').map((o) => [o.id, o.label, !!o.disabled])).toEqual([
      ['retry', '再試一次', false],
      ['restart', '重新開始', false],
    ])
    expect(titleOptions(true, 'ready').some((o) => o.disabled)).toBe(false)
    expect(titleOptions(false, 'error').map((o) => o.id)).toEqual(['new'])
  })
  it('文案沒有驚嘆號', () => {
    for (const s of [RESTART_ASK, ...RESTART_OPTIONS, ...titleOptions(true).map((o) => o.label)]) expect(s).not.toMatch(/[!！]/)
  })
  it('標題時的自動存檔不寫進去，開始之後才寫', () => {
    const base = memoryStore({ k: 'old' })
    const gate = gateStore(base)
    gate.store.set('k', 'title')
    gate.store.remove('k')
    expect(base.data.k).toBe('old')
    expect(gate.store.get('k')).toBe('old')
    expect(gate.isOpen).toBe(false)
    gate.open()
    gate.store.set('k', 'new')
    expect(base.data.k).toBe('new')
  })
})

describe('介面的文案（§6a）', () => {
  it('components/game、PlayView 沒有全形驚嘆號、emoji', () => {
    const files = import.meta.glob(['../../components/game/**/*.vue', '../../views/PlayView.vue'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    expect(Object.keys(files).length).toBeGreaterThan(8)
    for (const [f, src] of Object.entries(files)) {
      expect(src, f).not.toMatch(/！/)
      expect(src, f).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})
