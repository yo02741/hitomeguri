import type { GameSettings } from '../engine/save'

import { TEXT_SPEEDS, type TextSpeed } from './text'

/**
 * 遊戲介面的設定（文字速度、一直跑、按鍵提示、小地圖）：存這台裝置的 localStorage（讀寫都包 try/catch），跟聲音的設定一樣不放進存檔，
 * 換存檔、重新開始都不會變。開始遊戲時套到 Game 的 settings（存檔裡也會有一份，讀回來時以這裡為準）。
 * 音量、靜音、打字聲在聲音那邊（game/audio/settings.ts，key hitomeguri:game:audio:v1）。
 */
export interface UiSettings {
  textSpeed: TextSpeed
  /** 一直跑（按住 B 反而是走） */
  alwaysRun: boolean
  /** 按鍵提示（P4）：桌機畫面下面的提示列、手機上情境時亮一下的鈕。預設開 */
  hints: boolean
  /** 小地圖（P4）：畫面右上角的小框開著（false＝收成一個小鈕）。預設開；M 鍵、小鈕、設定都能切 */
  minimap: boolean
}

export const UI_KEY = 'hitomeguri:game:ui:v1'
export const UI_DEFAULTS: UiSettings = { textSpeed: 'normal', alwaysRun: false, hints: true, minimap: true }

/** 只要 getItem／setItem（測試可以給假的） */
export type UiStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 隨便什麼（壞掉的 JSON、舊版本）→ 合法的設定；看不懂的欄位用預設值 */
export function sanitizeUi(raw: unknown): UiSettings {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Partial<Record<keyof UiSettings, unknown>>
  const speed = r.textSpeed
  return {
    textSpeed: typeof speed === 'string' && (TEXT_SPEEDS as readonly string[]).includes(speed) ? (speed as TextSpeed) : UI_DEFAULTS.textSpeed,
    alwaysRun: typeof r.alwaysRun === 'boolean' ? r.alwaysRun : UI_DEFAULTS.alwaysRun,
    hints: typeof r.hints === 'boolean' ? r.hints : UI_DEFAULTS.hints,
    minimap: typeof r.minimap === 'boolean' ? r.minimap : UI_DEFAULTS.minimap,
  }
}

export function loadUi(store: UiStorage | null, key = UI_KEY): UiSettings {
  try {
    const s = store?.getItem(key)
    return sanitizeUi(s ? JSON.parse(s) : null)
  } catch {
    return sanitizeUi(null)
  }
}

export function saveUi(store: UiStorage | null, s: UiSettings, key = UI_KEY) {
  try {
    store?.setItem(key, JSON.stringify(sanitizeUi(s)))
  } catch {
    // 私密瀏覽、容量滿：這次記在記憶體就好
  }
}

/** 瀏覽器的 localStorage；沒有（node、被擋）就 null */
export function uiStorage(): UiStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** 套到引擎的設定（引擎只認一般／快／立即，慢的存成一般；字的速度由介面自己管） */
export function toEngine(s: UiSettings, base: GameSettings): GameSettings {
  return { ...base, alwaysRun: s.alwaysRun, textSpeed: s.textSpeed === 'slow' ? 'normal' : s.textSpeed }
}
