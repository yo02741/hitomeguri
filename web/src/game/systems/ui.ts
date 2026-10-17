import { shallowReactive } from 'vue'

import type { CalendarDate } from '../engine/clock'
import type { Button } from '../engine/input'
import type { MapEntity, Season, TimeOfDay } from '../engine/types'

import type { ItemCardData } from './inventory'
import type { ShotScore } from './photo'
import type { SlotRef } from './room'
import type { Stock } from './shop'
import type { PhotoSlot } from './state'
import type { StampView } from './stamps'
import type { TravelData, TravelLink } from './types'

/**
 * 遊戲裡的面板（DOM，components/game/SystemsLayer.vue 依 panel.kind 換元件）：取景框、拍好的照片、店、
 * 目的地、蓋章、房間的擺設、桌上的印帳、品項卡。打開時世界停住（Game 停在 'systems'），按鍵交給面板；
 * 關上時世界繼續，等著的腳本往下走（panel 的結果交給腳本，例：選了哪一個目的地）。
 */
export interface PhotoResult {
  id: string
  name: { ja: string; zh?: string }
  slot: PhotoSlot
  score: ShotScore
  date: CalendarDate
  time: TimeOfDay
  season: Season
  /** 縮圖（PNG 的 object URL；做不出來 null） */
  url: string | null
  /** 這一格原本有照片：換不換 */
  replace: { id: string; score: number } | null
  /** 順便完成的委託（照片可以拿給委託的人看） */
  quest: boolean
}

export type Panel =
  | { kind: 'viewfinder'; spot: MapEntity | null; name: string | null }
  | { kind: 'photo'; result: PhotoResult }
  | { kind: 'shop'; id: string; stock: Stock; pref: string; mode: 'buy' | 'eat' }
  | { kind: 'travel'; data: TravelData }
  | { kind: 'stamp'; view: StampView }
  | { kind: 'room'; focus: SlotRef | null }
  | { kind: 'book' }
  | { kind: 'card'; card: ItemCardData }

export type PanelResult = TravelLink | 'sit' | null

export interface SystemsUi {
  panel: Panel | null
  /** 站在拍攝點上：畫面角落的「拍照」 */
  hint: { name: string | null; spot: MapEntity } | null
  /** 面板的版本（同一個面板的內容變了：買了東西、換了擺設） */
  tick: number
  /** 減少動態 */
  reduced: boolean
}

export function createUi(reduced: boolean): SystemsUi {
  return shallowReactive<SystemsUi>({ panel: null, hint: null, tick: 0, reduced })
}

/** 面板元件的按鍵處理（SystemsLayer 綁上目前的那一個） */
export type PanelPress = (b: Button) => boolean
