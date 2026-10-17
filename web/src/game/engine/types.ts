import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Season, TimeOfDay } from '../../services/pixelwalk/palette'
import type { Sprite } from '../../services/pixelwalk/sprite'

import type { ScriptApi } from './script'

/**
 * 番外篇（像素遊戲）引擎的型別：方向、行為碼、地圖、實體、tile、角色外觀。
 * 畫面是 W×160 的點陣（GBA 的高度），W 在 176–240 之間；一格 tile 16×16。
 * 地圖三層：ground（地面，不透明）、lower（物件下半，畫在角色下面）、over（屋頂、樹冠，畫在角色前面）。
 */
export const TILE = 16
export const VIEW_H = 160
/** 手機直拿（窄而高的螢幕）時邏輯高度可以變高到這麼多（寬照舊）；桌機、打橫是 VIEW_H（GBA 的比例） */
export const VIEW_H_MAX = 256
export const VIEW_W_MIN = 176
export const VIEW_W_MAX = 240

export type { Season, TimeOfDay }

// ---------- 方向 ----------
export type Dir = 'up' | 'down' | 'left' | 'right'
export const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right']
export const DX: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1 }
export const DY: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0 }
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
/** (dx, dy) → 方向；不是上下左右的一格就回 null */
export function dirOf(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy < 0) return 'up'
  if (dx === 0 && dy > 0) return 'down'
  if (dy === 0 && dx < 0) return 'left'
  if (dy === 0 && dx > 0) return 'right'
  return null
}
/** 'UDLR' 這種字串 → 方向的陣列（腳本的路線、NPC 的路線） */
export function parsePath(path: string | readonly Dir[]): Dir[] {
  if (typeof path !== 'string') return [...path]
  const out: Dir[] = []
  const map: Record<string, Dir> = { U: 'up', D: 'down', L: 'left', R: 'right' }
  // 'R3U2' 也可以：字母後面接次數
  const re = /([UDLR])(\d*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(path))) {
    const d = map[m[1]!.toUpperCase()]!
    const n = m[2] ? Number(m[2]) : 1
    for (let i = 0; i < n; i++) out.push(d)
  }
  return out
}

// ---------- 行為碼（碰撞） ----------
/**
 * 每種 tile 一個行為；地圖另外有一層 Uint8 可以覆寫（0 = 照 tile，其他 = 行為碼 + 1）。
 * ledge-*：單向台階，只能往箭頭的方向跳過去（落在台階的下一格）。
 * counter：櫃台，擋住，A 可以查看櫃台後面那一格（隔著說話）。
 */
export const BEHAVIORS = ['walk', 'block', 'water', 'ledge-down', 'ledge-right', 'ledge-left', 'ledge-up', 'door', 'counter', 'sign', 'photo', 'grass'] as const
export type BehaviorName = (typeof BEHAVIORS)[number]
export const B = Object.fromEntries(BEHAVIORS.map((b, i) => [b, i])) as Record<BehaviorName, number>
export const LEDGE: Partial<Record<number, Dir>> = { [B['ledge-down']]: 'down', [B['ledge-right']]: 'right', [B['ledge-left']]: 'left', [B['ledge-up']]: 'up' }
/** 站得上去的行為 */
export const passable = (b: number) => b === B.walk || b === B.door || b === B.photo || b === B.grass

// ---------- 地圖 ----------
/** 地名：日文、羅馬字（地名牌的小字）、中文（台灣用字） */
export interface MapName {
  ja: string
  romaji: string
  zh: string
}

export interface Warp {
  x: number
  y: number
  /** 目的地的地圖 id 與格子、到了之後朝哪 */
  to: string
  tx: number
  ty: number
  dir?: Dir
  /** step：走到這一格就傳送（門、樓梯，預設）；push：站在這一格往 push 的方向走才傳送（室內的門墊、地圖邊） */
  on?: 'step' | 'push'
  push?: Dir
  /** 傳送時的效果音（預設 door） */
  sfx?: string
}

/**
 * 地圖上的東西（通用）：kind 決定怎麼生成、怎麼查看（entities.ts 的 registerEntityKind，P2 會加 shop、stamp…）。
 * data 是 kind 自己的資料（例：npc 的 look、move、text、script；sign 的 text）。
 */
export interface MapEntity {
  id: string
  kind: string
  x: number
  y: number
  facing?: Dir
  data?: Record<string, unknown>
}

export interface BorderTiles {
  ground: number
  lower?: number
  over?: number
}

export interface GameMap {
  id: string
  name: MapName
  w: number
  h: number
  /** 三層的 tile id（0 = 沒有），長度 w×h，索引 y×w + x */
  ground: Uint16Array
  lower: Uint16Array
  over: Uint16Array
  /** 行為覆寫：0 = 照 tile，其他 = 行為碼 + 1 */
  beh: Uint8Array
  /** 地圖外面鋪的 tile（地圖比畫面小、走到邊的時候） */
  border: BorderTiles
  warps: Warp[]
  entities: MapEntity[]
  /** 戶外：時段換色、天氣、走路時時間往前；室內一律白天的顏色 */
  outdoor: boolean
  bgm?: string
  /** 找不到存檔位置時放這裡（例：車站門口） */
  start?: { x: number; y: number; dir?: Dir }
  /** 這張地圖自己的腳本（實體的 data.script 先找這裡，再找全域的 registerScript） */
  scripts?: Record<string, ScriptFn>
}

// ---------- tile ----------
export interface TileCtx {
  season: Season
  time: TimeOfDay
  /** 動畫的第幾格（0..frames-1） */
  frame: number
  /** 依格子位置挑的花樣（0..variants-1） */
  variant: number
  /** 自動接邊：上 1、右 2、下 4、左 8，有一樣的鄰居就是 1 */
  mask: number
  /** 這一格在 g 裡的左上角（畫進快取時是 0, 0） */
  x: number
  y: number
}

export type TileLayer = 'ground' | 'lower' | 'over'

export interface TileDef {
  /** 全域的 tile id（1–65535）。各套 kit 用自己的範圍：basic 1–1023、近畿 1024–2047、沖繩 2048–3071 */
  id: number
  /** 'basic/grass' 這種名字（ASCII 地圖、生成器用） */
  name: string
  layer: TileLayer
  /** ground 必填；lower、over 沒寫 = 照下面那層 */
  behavior?: BehaviorName
  frames?: number
  /** 動畫每秒幾格（預設 3） */
  fps?: number
  variants?: number
  /** 自動接邊：哪些鄰居算「一樣」（例：水接水）；有寫才算 mask */
  connect?(other: TileDef | undefined): boolean
  /** 畫在 (c.x, c.y) 起的 16×16；只能依 c 的內容變化（快取的 key 是 id×季節×時段×格×花樣×接邊） */
  draw(g: Gfx, c: TileCtx): void
}

// ---------- 角色外觀 ----------
export type Pose = 'stand' | 'stepL' | 'stepR'

/** 旅人生成器的輸出（P1）：每格調色盤索引（0 透明、1 起算）＋ RGB 調色盤，畫的時候依時段換色 */
export interface RgbSprite {
  w: number
  h: number
  idx: Uint8Array
  rgb: Array<[number, number, number]>
}

export type AnySprite = Sprite | RgbSprite
export const isRgbSprite = (s: AnySprite): s is RgbSprite => (s as RgbSprite).rgb !== undefined

export interface LookFrame {
  sprite: AnySprite
  /** 錨點：sprite 裡對齊「腳底中心」的像素（畫在格子的 x+8、y+16） */
  ax: number
  ay: number
  flip?: boolean
  /** 疊在上面的 sprite（P1：頭頂的傘、手上的東西）：x、y 相對主 sprite 的左上角 */
  extra?: Array<{ sprite: AnySprite; x: number; y: number; flip?: boolean }>
}

export interface ActorLook {
  /** 給方向與動畫格，回傳要畫的 sprite 與錨點 */
  frame(dir: Dir, pose: Pose): LookFrame
  /** 跳的時候地上影子的寬（預設 12） */
  shadow?: number
}

// ---------- 腳本 ----------
/** yield 的東西：秒數（等多久）、null（等一格）、函式（等到它回傳 true） */
export type Wait = number | null | undefined | (() => boolean)
export type Script<T = void> = Generator<Wait, T, unknown>
/** 一段腳本：拿到腳本的指令（script.ts 的 ScriptApi），回傳 generator */
export type ScriptFn = (s: ScriptApi) => Script<unknown>

/** 事實台詞的出處（對話框右下角的「出處」） */
export interface SourceRef {
  label: string
  url: string
}
