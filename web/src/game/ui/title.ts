import type { SaveStorage } from '../engine/save'

/**
 * 標題畫面（規格 §5）：有存檔時「繼續」「重新開始」（重新開始要再確認一次），沒有存檔時「開始」。
 * 標題後面的畫面就是遊戲本身（同一個 Game 自己慢慢走），那段期間不能寫到存檔：用 gateStore 包住，
 * 按下開始／繼續之後才打開。
 */
export type TitleChoice = 'continue' | 'new' | 'restart'

/** 存檔所在的縣（P3）：讀好了、讀中、讀不到 */
export type SaveLoad = 'ready' | 'loading' | 'error'

export interface TitleOption {
  id: TitleChoice | 'retry'
  label: string
  /** 先不能選（存檔所在的縣還在讀） */
  disabled?: boolean
}

/**
 * 存檔所在的縣（P3）還在讀、讀不到時：「繼續」先不能選（讀不到時換成「再試一次」）；
 * 「重新開始」只要起點的縣（京都，世界讀好時就有），一直可以選。
 */
export function titleOptions(hasSave: boolean, save: SaveLoad = 'ready'): TitleOption[] {
  if (!hasSave) return [{ id: 'new', label: '開始' }]
  const first: TitleOption = save === 'error' ? { id: 'retry', label: '再試一次' } : { id: 'continue', label: '繼續', ...(save === 'loading' ? { disabled: true } : {}) }
  return [first, { id: 'restart', label: '重新開始' }]
}

/** 重新開始的確認：預設停在「不要」 */
export const RESTART_ASK = '要從頭開始嗎？現在的存檔會被蓋過去。'
export const RESTART_OPTIONS = ['從頭開始', '不要'] as const

/** 讀照常、寫要等 open() 之後（標題畫面時的自動存檔不會蓋掉真的存檔） */
export function gateStore(base: SaveStorage): { store: SaveStorage; open(): void; readonly isOpen: boolean } {
  let on = false
  return {
    store: {
      get: (k) => base.get(k),
      set: (k, v) => {
        if (on) base.set(k, v)
      },
      remove: (k) => {
        if (on) base.remove(k)
      },
    },
    open() {
      on = true
    },
    get isOpen() {
      return on
    },
  }
}
