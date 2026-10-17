import type { SaveStorage } from '../engine/save'

/**
 * 標題畫面（規格 §5）：有存檔時「繼續」「重新開始」（重新開始要再確認一次），沒有存檔時「開始」。
 * 標題後面的畫面就是遊戲本身（同一個 Game 自己慢慢走），那段期間不能寫到存檔：用 gateStore 包住，
 * 按下開始／繼續之後才打開。
 */
export type TitleChoice = 'continue' | 'new' | 'restart'

export interface TitleOption {
  id: TitleChoice
  label: string
}

export function titleOptions(hasSave: boolean): TitleOption[] {
  return hasSave
    ? [
        { id: 'continue', label: '繼續' },
        { id: 'restart', label: '重新開始' },
      ]
    : [{ id: 'new', label: '開始' }]
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
