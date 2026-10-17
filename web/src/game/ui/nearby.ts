import { nearestPlace, type Place, placeDistance } from '../engine/places'

/**
 * 走近地標時畫面上方浮出的地名（P4，規格 §13 的 2）：什麼時候浮出、同一個地方多久不重複。純邏輯，時間由外面給（ms）。
 *  - 走進某個地方的附近（reach 格內，最近的那一個）才浮出；一直待在附近不會再浮出，走開再回來也要過了 cooldown。
 *  - 進一張地圖時，腳下附近（reach＋ENTER_EXTRA 格）的地方當作剛看過（坐車到站、出門時不跟左上的地名牌一起出來，
 *    剛下車走出站前廣場也不會馬上浮出車站的名字）。
 *  - 記錄照「地圖＋地方」分開（不同鎮的同名車站各算各的）。
 *
 *   const notice = new PlaceNotice()
 *   notice.enter(map.id, placesOf(map), x, y, now)
 *   const p = notice.step(x, y, now)      // 走到一格；回傳要浮出的地方（或 null）
 */
export const NOTICE_REACH = 2
/** 同一個地方多久之內不再浮出（現實的毫秒） */
export const NOTICE_COOLDOWN_MS = 90_000
/** 浮出多久（減少動態時也一樣久，只是不淡入淡出） */
export const NOTICE_SHOW_MS = 3200
/** 進地圖時，比 reach 再遠幾格的地方也當作剛看過 */
export const ENTER_EXTRA = 3

export class PlaceNotice {
  private map = ''
  private places: readonly Place[] = []
  private here: string | null = null
  private readonly last = new Map<string, number>()
  readonly reach: number
  readonly cooldown: number

  constructor(o: { reach?: number; cooldown?: number } = {}) {
    this.reach = o.reach ?? NOTICE_REACH
    this.cooldown = o.cooldown ?? NOTICE_COOLDOWN_MS
  }

  /** 進到一張地圖（換地圖、讀檔）；腳下附近的地方不浮出 */
  enter(mapId: string, places: readonly Place[], x: number, y: number, now: number) {
    this.map = mapId
    this.places = places
    const p = nearestPlace(places, x, y, this.reach)
    this.here = p?.id ?? null
    for (const q of places) if (placeDistance(q, x, y) <= this.reach + ENTER_EXTRA) this.last.set(this.key(q.id), now)
  }

  private key(id: string) {
    return `${this.map}|${id}`
  }

  /** 走到 (x, y)：剛走進一個地方、而且 cooldown 過了 → 回傳那個地方 */
  step(x: number, y: number, now: number): Place | null {
    const p = nearestPlace(this.places, x, y, this.reach)
    const id = p?.id ?? null
    if (id === this.here) return null
    this.here = id
    if (!p) return null
    const k = this.key(p.id)
    const t = this.last.get(k)
    if (t !== undefined && now - t < this.cooldown) return null
    this.last.set(k, now)
    return p
  }

  /** 現在在哪個地方的附近（小地圖、測試用） */
  get current(): string | null {
    return this.here
  }

  /** 新遊戲：全部忘掉 */
  reset() {
    this.last.clear()
    this.here = null
    this.places = []
    this.map = ''
  }
}
