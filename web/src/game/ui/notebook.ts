import type { StampArt } from '../content/icons'
import type { CalendarDate } from '../engine/clock'
import type { Game } from '../engine/game'
import type { Minimap } from '../engine/minimap'
import type { PlaceKind } from '../engine/places'
import type { Dir, Season, SourceRef, TimeOfDay } from '../engine/types'
import type { ItemCardData } from '../systems/inventory'
import type { Wallet } from '../systems/wallet'

/**
 * 旅人手帳（START 選單，規格 §4、§8）：一頁一個元件（components/game/notebook/*Page.vue），資料都從 Game 的狀態算出來。
 * P0 只有「存檔」「設定」有功能，其他頁是安靜的空狀態；P2 的系統用 provideNotebook 把自己那一頁的資料接上：
 *
 *   provideNotebook('stamps', (game, base) => ({ books: [{ pref: 'kyoto', title: { ja: '京都府' }, stamps: … }] }))
 *
 * 加新的一頁：NOTEBOOK_PAGES 加一個 id、NotebookData 加那一頁的資料型別與預設值（defaults）、
 * 寫 components/game/notebook/XxxPage.vue，在 Notebook.vue 的 PAGE_COMPONENTS 對上。
 */
export type NotebookPageId = 'map' | 'stamps' | 'album' | 'bag' | 'heard' | 'quests' | 'room' | 'save' | 'settings'

export interface NotebookPageDef {
  id: NotebookPageId
  label: string
}

export const NOTEBOOK_PAGES: readonly NotebookPageDef[] = [
  { id: 'map', label: '地圖' },
  { id: 'stamps', label: '印帳' },
  { id: 'album', label: '相簿' },
  { id: 'bag', label: '行李' },
  { id: 'heard', label: '聽來的' },
  { id: 'quests', label: '委託' },
  { id: 'room', label: '房間' },
  { id: 'save', label: '存檔' },
  { id: 'settings', label: '設定' },
]

/** 地名、品名（日文一定有；假名、羅馬字、中文有才寫） */
export interface PlaceLabel {
  ja: string
  kana?: string
  romaji?: string
  zh?: string
}

/** 遊戲裡的「現在」 */
export interface Moment {
  date: CalendarDate
  hhmm: string
  time: TimeOfDay
  season: Season
}

// ---------- 每一頁的資料 ----------
export interface MapTown {
  id: string
  name: PlaceLabel
  visited: boolean
  here: boolean
}
/** 一縣的鎮（P2：京都、沖繩各一組） */
export interface MapPref {
  pref: string
  title: PlaceLabel
  towns: MapTown[]
}
/** P4：這一鎮的大張地圖（小地圖的整張）；在室內時是那一鎮的戶外，自己在進來的那個門 */
export interface TownChart {
  name: PlaceLabel
  mini: Minimap
  here: { x: number; y: number; dir: Dir } | null
  /** 地圖上有名字的地方（告示牌、車站、店、茶屋…，北到南） */
  places: Array<{ id: string; kind: PlaceKind; name: PlaceLabel; x: number; y: number }>
}
export interface MapPageData {
  here: PlaceLabel | null
  now: Moment
  /** P2：這一縣的鎮（照北到南） */
  towns: MapTown[]
  /** P2：分縣的鎮（有就照這個分組，沒有就只列 towns） */
  prefs?: MapPref[]
  /** P4：這一鎮的地圖（PlayView 打開手帳時放進來；沒有鎮的地方——你的房間——沒有） */
  chart?: TownChart | null
}

export type StampKind = 'station' | 'sanpai' | 'castle'
export interface StampEntry {
  id: string
  kind: StampKind
  name: PlaceLabel
  /** 印面上的字（只寫資料裡有的，例：日本100名城 No.53） */
  face?: string
  date?: CalendarDate
  source?: SourceRef
  /** P2：印的圖案（剪影、站名的羅馬字、名城番號；content/icons.ts 的 StampArt） */
  art?: StampArt
  /** 蓋章地點（名城：資料的 st） */
  where?: string
}
/** 一縣一頁 */
export interface StampBook {
  pref: string
  title: PlaceLabel
  stamps: StampEntry[]
  /** 這一縣蓋得到的章一共幾個（不知道就不寫） */
  total?: number
}
export interface StampsPageData {
  books: StampBook[]
}

export interface PhotoEntry {
  id: string
  spot: PlaceLabel
  date: CalendarDate
  time: TimeOfDay
  season: Season
  /** 構圖分數（數字） */
  score?: number
  /** 縮圖（object URL 或 data URL；P2 從 IndexedDB 讀） */
  thumb?: string
  /** P2：相簿的格（平常、春櫻、秋楓、雪、夜、祭典） */
  slot?: string
  /** 自己或夥伴入鏡 */
  together?: boolean
  w?: number
  h?: number
}
/** P2：一個地標一頁，六格 */
export interface AlbumSpotPage {
  key: string
  name: PlaceLabel
  slots: Array<{ slot: string; label: string; photo: PhotoEntry | null }>
}
export interface AlbumPageData {
  photos: PhotoEntry[]
  /** P2：照地標分頁（有就照這個畫） */
  pages?: AlbumSpotPage[]
}

export interface BagEntry {
  id: string
  name: PlaceLabel
  count: number
  /** 類別（甜點、飲料、明信片…） */
  kind: string
  source?: SourceRef
  /** P2：品項卡（A 打開；game/systems/inventory.ts 的 ItemCardData） */
  card?: ItemCardData
  /** 吃過的：第一次吃的日期 */
  date?: CalendarDate
}
export interface BagPageData {
  /** 現金（円） */
  money: number
  /** P4：現金與刷卡累計（円）；沒有時 money 當現金 */
  wallet?: Wallet
  items: BagEntry[]
  /** 吃過的（郷土料理，帶不走） */
  eaten: BagEntry[]
}

export interface HeardEntry {
  id: string
  text: string
  source: SourceRef
  where?: PlaceLabel
  date?: CalendarDate
}
export interface HeardPageData {
  facts: HeardEntry[]
  /** 有幾句的那一縣資料還沒讀進來（P3 的延遲載入）：頁面寫「讀取中」，讀好了換上 */
  pending?: boolean
}

/** P2：進行中的委託 */
export interface QuestEntry {
  id: string
  /** 委託的話（說法虛構，東西與地名是資料） */
  text: string
  /** 在哪一鎮接的 */
  from: PlaceLabel | null
  /** 做完給的旅費（円） */
  reward: number
  /** 拍到了、找到了：回去找委託的人 */
  ready: boolean
  date?: CalendarDate
  /** 期限（這一天過了還沒做好就取消） */
  until?: CalendarDate
}
export interface QuestsPageData {
  quests: QuestEntry[]
}

export interface RoomPageData {
  /** 住的地方（還沒有就 null） */
  name: PlaceLabel | null
  placed: number
  slots: number
}

export interface SavePageData {
  here: PlaceLabel | null
  now: Moment
  money: number
  stamps: number
  photos: number
  /** 上次存檔的時間（Date.now()；還沒存過 null） */
  savedAt: number | null
}

export interface NotebookData {
  map: MapPageData
  stamps: StampsPageData
  album: AlbumPageData
  bag: BagPageData
  heard: HeardPageData
  quests: QuestsPageData
  room: RoomPageData
  save: SavePageData
}

export type NotebookProvider<K extends keyof NotebookData> = (game: Game, base: NotebookData[K]) => NotebookData[K]
type Providers = { [K in keyof NotebookData]?: NotebookProvider<K> }
const providers: Providers = {}

/** P2 的系統接上自己那一頁的資料（同一頁再註冊會換掉）；回傳拆掉的函式 */
export function provideNotebook<K extends keyof NotebookData>(page: K, fn: NotebookProvider<K>): () => void {
  ;(providers as Record<K, NotebookProvider<K> | undefined>)[page] = fn
  return () => {
    if ((providers as Record<K, NotebookProvider<K> | undefined>)[page] === fn) delete providers[page]
  }
}

function momentOf(game: Game): Moment {
  const c = game.clock
  return { date: { ...c.date }, hhmm: c.hhmm, time: c.time, season: c.season }
}

/** 引擎自己知道的部分（P0）：現在在哪、日期、旅費、存檔 */
export function notebookDefaults(game: Game, savedAt: number | null): NotebookData {
  const here: PlaceLabel | null = game.map ? { ...game.map.name } : null
  const now = momentOf(game)
  const s = game.state
  return {
    map: { here, now, towns: [] },
    stamps: { books: [] },
    album: { photos: [] },
    bag: { money: s.money, items: [], eaten: [] },
    heard: { facts: [] },
    quests: { quests: [] },
    room: { name: null, placed: 0, slots: 0 },
    save: { here, now, money: s.money, stamps: s.stamps.length, photos: s.album.length, savedAt },
  }
}

function apply<K extends keyof NotebookData>(k: K, game: Game, data: NotebookData) {
  const fn = providers[k] as NotebookProvider<K> | undefined
  if (!fn) return
  try {
    data[k] = fn(game, data[k])
  } catch (e) {
    // 一頁壞了不要拖垮整本手帳：那一頁用預設的
    if (import.meta.env?.DEV) console.warn(`notebook：${k} 這一頁的資料算不出來`, e)
  }
}

/** 打開手帳時算一次（之後 Game 發 change、save 時再算） */
export function notebookData(game: Game, savedAt: number | null): NotebookData {
  const data = notebookDefaults(game, savedAt)
  for (const k of Object.keys(data) as Array<keyof NotebookData>) apply(k, game, data)
  return data
}

/** 遊戲日期的寫法：2026 年 10 月 16 日 */
export function dateText(d: CalendarDate): string {
  return `${d.y} 年 ${d.m} 月 ${d.d} 日`
}

export const TIME_LABEL: Record<TimeOfDay, string> = { day: '白天', dusk: '黃昏', night: '夜晚' }
export const SEASON_LABEL: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }

/** 存檔時間（現實的）：10 月 16 日 21:05 */
export function savedText(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${p(d.getHours())}:${p(d.getMinutes())}`
}
