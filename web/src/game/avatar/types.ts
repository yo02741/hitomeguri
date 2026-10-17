import type { Slot } from '../../data/outfits'
import type { AvatarParts } from '../../stores/avatar'

/**
 * 你的旅人變像素人（規格 §7）的型別。
 * 流程：紙娃娃的 SVG 畫成大圖（每個像素 F×F 個細格）→ 縮小成點陣（每格一個調色盤索引）→ 外框、眼睛、清理 → RgbSprite。
 * 點陣在處理中用 Int16Array（-1 透明、0 起算的調色盤索引），最後才轉成 RgbSprite（0 透明、1 起算）。
 */
export type Rgb = [number, number, number]

/** ImageData 的樣子（測試在 node 裡用假的） */
export interface Img {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** 一隻旅人的外觀：avatar store 的 parts 與穿著（背景不算） */
export interface TravellerLook {
  parts: AvatarParts
  equipped: Partial<Record<Exclude<Slot, 'bg'>, string>>
}

/**
 * 尺寸：w×h 是本體（含 1px 外框）的大小，cw×ch 是一格畫布（帽子、手上的東西可以超出本體）。
 * 腳底對齊畫布下緣：最下面一列是腳底的外框。
 */
export interface SpriteSize {
  w: number
  h: number
  cw: number
  ch: number
}

/** 處理中的點陣：raw 是還沒描外框的、-1 透明 */
export interface Raster {
  w: number
  h: number
  raw: Int16Array
}

/** RGB 調色盤的 sprite（跟 engine/types.ts 的 RgbSprite 同一個樣子，存進 IndexedDB 也是這個） */
export interface RgbFrame {
  w: number
  h: number
  /** 0 透明、1 起算 */
  idx: Uint8Array
  rgb: Rgb[]
}

/** 夥伴的 2D 圖朝哪邊（左右翻用）；front 是正面的（招財貓、達摩） */
export type Facing = 'left' | 'right' | 'front'

/** 頭頂的傘：畫在本體上面（x 相對畫布左上；y 是這一格最上面一列再加 dy） */
export interface Overhead {
  sprite: RgbFrame
  x: number
  dy: number
}

/** 遊戲用的一組（20×28，畫布 32×40）：下、上、左 × 站、左腳、右腳；右邊用左邊翻 */
export interface GameRecord {
  fmt: 1
  kind: 'game'
  key: string
  at: number
  w: number
  h: number
  box: [number, number, number, number]
  down: [RgbFrame, RgbFrame, RgbFrame]
  up: [RgbFrame, RgbFrame, RgbFrame]
  left: [RgbFrame, RgbFrame, RgbFrame]
  overhead: Overhead | null
  buddy: { sprite: RgbFrame; facing: Facing } | null
  /** 側面怎麼來的：3d（buildAvatar 轉 90 度）或 template（沒有 WebGL 時的參數化範本） */
  side: '3d' | 'template'
  /** 生成花了幾毫秒 */
  ms: number
}

/** /about 像素散步用的一組（16×24）：朝右的側面，走路 4 格、站 2 格（眨眼）、跳 1 格 */
export interface WalkerRecord {
  fmt: 1
  kind: 'walk'
  key: string
  at: number
  w: number
  h: number
  box: [number, number, number, number]
  walk: RgbFrame[]
  stand: RgbFrame[]
  jump: RgbFrame
  /** 拿相機時相機的左上角（相對畫布左上，朝右的時候） */
  camera: [number, number]
  overhead: Overhead | null
  buddy: { sprite: RgbFrame; facing: Facing } | null
}

export type TravellerRecord = GameRecord | WalkerRecord
