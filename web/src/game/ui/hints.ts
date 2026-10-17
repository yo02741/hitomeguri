import type { Button } from '../engine/input'

/**
 * 按鍵提示（P4，規格 §13 的 1；使用者決定要有，優先於 §6a「不放說明」）：依情境換內容的一條小小的按鍵列，
 * 像遊戲的按鍵說明，不是說明卡。文案是動詞（查看、說話、跑、相機、拍照、手帳、變焦、返回…），沒有驚嘆號。
 * 純函式：PlayView 每 4 格（約 0.07 秒）照現在的樣子組一個 HintCtx（走路時面前的東西先經過 FacingSettle），hintsFor 回傳要列的鍵（桌機的提示列），
 * touchCue 回傳手機上要亮的鈕與鈕上的字（手機不放提示列，按鈕本身有字）。
 *
 * 各情境的按鍵實際做什麼（照程式查過，提示跟著寫）：
 *  - 走路：A＝查看面前的人、告示牌、櫃台後的店員；按住 B＝跑（設定「一直跑」時按住是走）；相機＝打開取景框
 *    （站在拍攝點上時是那個地標）；START＝旅人手帳；M＝小地圖（PlayView 自己接；手帳的「地圖」頁是另一個）；P＝暫停。
 *    面前是房間的架子、相框（放了東西才有角色，但不是人）：查看。
 *  - 對話：A、B 先把這頁出完，再換頁／結束；選單：上下選、A 決定、B 選「取消」的那一個（通常是最後一個）。
 *  - 手帳：頁籤上下換頁、A 或右進頁、B 或 START 關上；頁裡上下一列一列、B 或左回頁籤（設定頁左右改）。
 *    地圖、委託、房間這三頁只有上下（A 沒有事）：不列 A。
 *  - 取景框：A 拍、B 收起（START 也是）、相機鍵變焦（全畫面 ↔ 中間放大一半）、放大時十字鍵移框。
 *  - 拍好的照片：左右選按鈕、A 按下去、B 收起。店、剪票口：上下選、A 買／出發、B 離開。蓋章、品項卡：A 收起。
 *  - P4 的面板（面板元件的 mode() 回報現在在哪一層，HintCtx 的 mode）：
 *    店的付款（車站、機場的賣店）：上下（左右也可以）換現金／刷卡、A 付款、B 回去（回到架上）；明信片選照片：上下選、A 決定、B 回去（面板的鈕也是「回去」）。
 *    新遊戲選出發的城市（origin）：上下選、A 決定（一定要選，B 不關）。
 *    出發看板（board）：上下選、右換到「想去的地方」（左邊沒有頁）、A 出發、B 不去了；
 *    想去的地方選鎮（town）：上下選、左換回「出發看板」（右邊沒有頁）、A 看路線、B 不去了；
 *    選的那一鎮從這個城市去不了（town-none）：A 只會響錯的聲音，不列 A；路線（route）：上下選、A 出發、B 或左回到鎮。
 *  - 坐車：A 或 B 跳過。暫停：P 繼續（點一下也可以）。
 */
export type HintKey = 'A' | 'B' | 'CAMERA' | 'START' | 'MAP' | 'PAUSE' | 'UD' | 'LR' | 'DIR'

/** 鍵盤上寫的鍵名（input.ts KEYMAP 的第一個鍵：Z＝A、X＝B、C＝相機、Q＝手帳、P＝暫停；M 是 PlayView 自己接的小地圖） */
export const KEY_NAME: Record<HintKey, string> = { A: 'Z', B: 'X', CAMERA: 'C', START: 'Q', MAP: 'M', PAUSE: 'P', UD: '↑↓', LR: '←→', DIR: '↑↓←→' }
/** 讀屏唸的鍵名 */
export const KEY_SPOKEN: Record<HintKey, string> = { A: 'Z', B: 'X', CAMERA: 'C', START: 'Q', MAP: 'M', PAUSE: 'P', UD: '上下', LR: '左右', DIR: '方向鍵' }

export interface Hint {
  key: HintKey
  label: string
  /** 「按住 X 跑」：鍵的前面寫「按住」 */
  hold?: boolean
  /** 這個情境的重點（站在拍攝點上的「拍照」、面前有人的「說話」）：亮一點 */
  hot?: boolean
}

/** 面前是什麼（Game.facing() 的實體種類）：說話、查看、蓋章；沒有 null */
export type Facing = 'talk' | 'look' | 'stamp' | null

/** 有角色、但不是人的實體：房間的架子、相框（放了東西才畫出來；按 A 打開房間的擺設） */
const THINGS = new Set(['shelfSlot', 'frameSlot'])

/**
 * 實體的種類 → 按 A 做的事：蓋章台是蓋章；有人（站櫃台的人、NPC）是說話；
 * 沒有人的（告示牌、巴士站的牌子、台灣的大廳牆上的出發看板、房間的架子與相框）是查看。
 */
export function facingOf(kind: string | null | undefined, person: boolean): Facing {
  if (!kind) return null
  if (kind === 'stamp') return 'stamp'
  if (THINGS.has(kind)) return 'look'
  if (person || kind === 'npc') return 'talk'
  return 'look'
}

const FACING_LABEL: Record<NonNullable<Facing>, string> = { talk: '說話', look: '查看', stamp: '蓋章' }

export type HintCtx =
  | { at: 'title' }
  | {
      at: 'walk'
      facing: Facing
      /** 站在拍攝點上 */
      photo: boolean
      alwaysRun: boolean
      /** 這張地圖有小地圖（戶外） */
      map: boolean
    }
  | { at: 'say'; more: boolean }
  | { at: 'ask' }
  | { at: 'menu'; tabs: boolean; page: string }
  /** mode：面板裡現在在哪一層（店：buy／eat／sit／pay／pick；目的地：list／origin／board／town／town-none／route） */
  | { at: 'panel'; panel: string; zoom?: number; mode?: string }
  | { at: 'ride' }
  | { at: 'paused' }
  /** 腳本、淡出淡入中（玩家不能動）：不列 */
  | { at: 'busy' }

const UD = (label = '選'): Hint => ({ key: 'UD', label })
const A = (label: string, hot = false): Hint => (hot ? { key: 'A', label, hot } : { key: 'A', label })
const Bk = (label: string): Hint => ({ key: 'B', label })

/** 這個情境要列的鍵（桌機的提示列，由左而右） */
export function hintsFor(c: HintCtx): Hint[] {
  switch (c.at) {
    case 'title':
      return [UD(), A('決定')]
    case 'walk': {
      const out: Hint[] = [c.facing ? A(FACING_LABEL[c.facing], true) : A('查看')]
      out.push({ key: 'B', label: c.alwaysRun ? '走' : '跑', hold: true })
      out.push(c.photo ? { key: 'CAMERA', label: '拍照', hot: true } : { key: 'CAMERA', label: '相機' })
      out.push({ key: 'START', label: '手帳' })
      // M 只開關角落的小地圖（手帳的「地圖」頁是另一個）
      if (c.map) out.push({ key: 'MAP', label: '小地圖' })
      return out
    }
    case 'say':
      return [A(c.more ? '下一頁' : '繼續')]
    case 'ask':
      return [UD(), A('決定'), Bk('取消')]
    case 'menu':
      if (c.tabs) return [UD('換頁'), A('打開'), Bk('關上')]
      if (c.page === 'settings') return [UD(), { key: 'LR', label: '調整' }, Bk('返回')]
      // 地圖、委託、房間：只是看（A 沒有事）
      return LOOK_PAGES.has(c.page) ? [UD(), Bk('返回')] : [UD(), A('決定'), Bk('返回')]
    case 'panel':
      return panelHints(c.panel, c.zoom, c.mode)
    case 'ride':
      return [A('跳過')]
    case 'paused':
      return [{ key: 'PAUSE', label: '繼續' }]
    case 'busy':
      return []
  }
}

const LR = (label: string): Hint => ({ key: 'LR', label })
/** 手帳裡只能上下看的頁（notebook/MapPage、QuestsPage、RoomPage 的 press 只有上下） */
const LOOK_PAGES = new Set(['map', 'quests', 'room'])

function panelHints(panel: string, zoom?: number, mode?: string): Hint[] {
  switch (panel) {
    case 'viewfinder': {
      const out: Hint[] = [A('拍照'), { key: 'CAMERA', label: '變焦' }]
      if (zoom === 2) out.push({ key: 'DIR', label: '移動' })
      out.push(Bk('收起'))
      return out
    }
    case 'photo':
      return [{ key: 'LR', label: '選' }, A('決定'), Bk('收起')]
    case 'shop':
      switch (mode) {
        case 'pay':
          return [UD(), A('付款'), Bk('回去')]
        case 'pick':
          return [UD(), A('決定'), Bk('回去')]
        case 'buy':
          return [UD(), A('買'), Bk('離開')]
        case 'eat':
          return [UD(), A('吃'), Bk('離開')]
        case 'sit':
          return [UD(), A('坐下來'), Bk('離開')]
        default:
          return [UD(), A('決定'), Bk('離開')]
      }
    case 'travel':
      switch (mode) {
        case 'origin':
          return [UD(), A('決定')]
        case 'board':
          return [UD(), LR('換頁'), A('出發'), Bk('不去了')]
        case 'town':
          return [UD(), LR('換頁'), A('看路線'), Bk('不去了')]
        case 'town-none':
          return [UD(), LR('換頁'), Bk('不去了')]
        case 'route':
          return [UD(), A('出發'), Bk('返回')]
        default:
          // 剪票口、巴士站、櫃台：面板下面的鈕是「出發」「不去了」
          return [UD(), A('出發'), Bk('不去了')]
      }
    case 'stamp':
    case 'card':
      return [A('收起')]
    case 'room':
      return [{ key: 'DIR', label: '選' }, A('決定'), Bk('返回')]
    case 'book':
      return [UD(), Bk('闔上')]
    default:
      // 之後加的面板（付款、出發的機場…）：上下選、A 決定、B 返回
      return [UD(), A('決定'), Bk('返回')]
  }
}

/** 面前的人、東西要在面前停多久，「Z 說話」「Z 查看」才亮 */
export const FACING_SETTLE_MS = 250

/**
 * 走路時面前的東西：自己與面前的那一個（人或東西，who）都停著、同一個在面前 FACING_SETTLE_MS 以上才亮，
 * 等的時候列不亮的「Z 查看」。走過路人旁邊、路人從面前走過去、推著路人原地踏步時提示列不一閃一閃。
 * 不在面前了馬上換回；從對話、面板、坐車回來時面前就有的人馬上亮（不等）。
 * 拍攝點的「拍照」不等（跟畫面上的「拍照」同時出來）。
 */
export class FacingSettle {
  private who: unknown = null
  private since = 0

  /**
   * shown：現在列著的情境；next：照現在的樣子組的；who：面前的那一個（同一個才算停著）；
   * still：自己與面前的人都沒在走（走路、原地踏步中是 false）
   */
  apply(shown: HintCtx, next: HintCtx, who: unknown, still: boolean, now: number): HintCtx {
    if (next.at !== 'walk' || !next.facing) {
      this.who = null
      return next
    }
    if (shown.at !== 'walk') {
      this.who = who
      this.since = now - FACING_SETTLE_MS
      return next
    }
    if (who !== this.who || !still) {
      this.who = who
      this.since = now
    }
    return still && now - this.since >= FACING_SETTLE_MS ? next : { ...next, facing: null }
  }
}

/** 比較用：情境一樣就不用換 */
export const hintKeyOf = (c: HintCtx) => JSON.stringify(c)

/** 手機（觸控的版面）：要亮的鈕、鈕上的字（取景框裡 A 拍照、B 收起、相機鈕變焦） */
export interface TouchCue {
  hot: Button[]
  labels: Partial<Record<'A' | 'B' | 'CAMERA' | 'START', string>>
}

export function touchCue(c: HintCtx): TouchCue {
  if (c.at === 'walk') {
    const hot: Button[] = []
    if (c.photo) hot.push('CAMERA')
    if (c.facing) hot.push('A')
    return { hot, labels: c.photo ? { CAMERA: '拍照' } : {} }
  }
  if (c.at === 'panel' && c.panel === 'viewfinder') return { hot: [], labels: { A: '拍照', B: '收起', CAMERA: '變焦' } }
  if (c.at === 'ride') return { hot: [], labels: { A: '跳過' } }
  return { hot: [], labels: {} }
}

/** 讀屏用的一行（提示列本身不是 live region，這是給 aria-label 的）：「Z 說話，按住 X 跑，C 相機」 */
export function hintsSpoken(list: readonly Hint[]): string {
  return list.map((h) => `${h.hold ? '按住 ' : ''}${KEY_SPOKEN[h.key]} ${h.label}`).join('，')
}
