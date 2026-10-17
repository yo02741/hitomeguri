/**
 * 聲音的設定：BGM、效果音各自的音量與靜音、打字聲開關。存這台裝置的 localStorage（讀寫都包 try/catch）。
 * 不跟存檔放一起：換存檔、重新開始都不影響音量。
 */

export type AudioBus = 'bgm' | 'sfx'

export interface BusSetting {
  /** 0–1 */
  volume: number
  muted: boolean
}

export interface AudioSettings {
  bgm: BusSetting
  sfx: BusSetting
  /** 對話的打字聲 */
  typing: boolean
}

export const SETTINGS_KEY = 'hitomeguri:game:audio:v1'

export const DEFAULT_SETTINGS: AudioSettings = {
  bgm: { volume: 0.7, muted: false },
  sfx: { volume: 0.8, muted: false },
  typing: true,
}

/** 只要 getItem／setItem（測試可以給假的） */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback

function bus(raw: unknown, d: BusSetting): BusSetting {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof BusSetting, unknown>>
  return { volume: clamp01(r.volume, d.volume), muted: typeof r.muted === 'boolean' ? r.muted : d.muted }
}

/** 隨便什麼（壞掉的 JSON、舊版本）→ 合法的設定；看不懂的欄位用預設值 */
export function sanitize(raw: unknown): AudioSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof AudioSettings, unknown>>
  return {
    bgm: bus(r.bgm, DEFAULT_SETTINGS.bgm),
    sfx: bus(r.sfx, DEFAULT_SETTINGS.sfx),
    typing: typeof r.typing === 'boolean' ? r.typing : DEFAULT_SETTINGS.typing,
  }
}

export function loadSettings(store: StorageLike | null, key = SETTINGS_KEY): AudioSettings {
  try {
    const s = store?.getItem(key)
    return sanitize(s ? JSON.parse(s) : null)
  } catch {
    return sanitize(null)
  }
}

export function saveSettings(store: StorageLike | null, s: AudioSettings, key = SETTINGS_KEY) {
  try {
    store?.setItem(key, JSON.stringify(s))
  } catch {
    // 私密瀏覽、容量滿：這次記在記憶體就好
  }
}

/** 瀏覽器的 localStorage；沒有（node、被擋）就 null */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
