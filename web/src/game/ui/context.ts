import type { InjectionKey } from 'vue'

import type { AudioBus, AudioSettings } from '../audio/settings'
import type { SfxName } from '../audio/sfx'
import type { Button } from '../engine/input'

import type { UiSettings } from './settings'

/**
 * PlayView 給遊戲介面元件（手帳的每一頁、對話框、標題）的東西：provide(GAME_UI, …)，元件 inject(GAME_UI)。
 * 元件不直接碰 Game 與 AudioContext，只透過這裡；資料用 props 傳（P2 填手帳的頁面時只要給資料）。
 */
export interface GameUiContext {
  sfx(name: SfxName): void
  /** 手帳的「存檔」 */
  save(): { ok: boolean; bytes: number }
  /** 聲音的設定（音量、靜音、打字聲） */
  audioSettings(): AudioSettings
  setVolume(bus: AudioBus, v: number): void
  setMuted(bus: AudioBus, m: boolean): void
  setTyping(on: boolean): void
  /** 介面的設定（文字速度、一直跑）：reactive，改了會存起來並套到 Game */
  ui: UiSettings
  setUi(patch: Partial<UiSettings>): void
  /** 減少動態 */
  reduced: boolean
  /** 有觸控按鈕（手機）：設定頁不列鍵盤的鍵位 */
  touch(): boolean
}

export const GAME_UI: InjectionKey<GameUiContext> = Symbol('game-ui')

/** 手帳的每一頁、標題、對話框對外的介面：PlayView 把遊戲的按鍵（鍵盤、十字鍵、手把）交給它 */
export interface PressTarget {
  /** 處理了回 true；沒處理（例：頁面裡按 B）回 false，交給外面那一層 */
  press(b: Button): boolean
}

/** 手帳的一頁：多一個「進到這一頁」（焦點移到第一個可以操作的東西；沒有就回 false） */
export interface NotebookPage extends PressTarget {
  focusFirst(): boolean
}
