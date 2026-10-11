// 原地編輯的文字欄（行程名稱等）：欄位的值同時來自自己打的字與 Firestore 的 snapshot。
// 打字時畫面一律以自己的草稿為準，不讓 snapshot（對方的修改、自己存檔的回音）在打字中途改掉欄位的值；
// 改欄位的值會打斷輸入法組字，造成字重複又被刪掉。
// 規則：
// - 沒在編輯：草稿跟著 snapshot。
// - 編輯中（focus）：snapshot 只記下來，不動草稿；組字中不存檔。
// - 存檔後到 snapshot 帶回同一個值之前，不採用比它舊的 snapshot（不然離開欄位後會閃回舊名稱）。
// - 離開欄位：跟編輯前不一樣才存；沒改就採用最新的 snapshot。

export interface DraftFieldOptions {
  /** 存檔前的整理（例：去頭尾空白） */
  normalize?: (v: string) => string
  /** 存檔後等 snapshot 帶回同一個值的上限（毫秒）；過了就採用最新的 snapshot */
  pendingMs?: number
}

export class DraftField {
  /** 欄位上顯示的值 */
  draft: string
  /** 最新的 snapshot 值 */
  private remote: string
  /** 開始編輯（或上次存檔）時的值：離開欄位時用來判斷有沒有改 */
  private base: string
  /** 已存、還沒從 snapshot 回來的值 */
  private pending: string | null = null
  private pendingAt = 0
  editing = false
  composing = false
  private readonly normalize: (v: string) => string
  private readonly pendingMs: number

  constructor(initial: string, opts: DraftFieldOptions = {}) {
    this.draft = initial
    this.remote = initial
    this.base = initial
    this.normalize = opts.normalize ?? ((v) => v)
    this.pendingMs = opts.pendingMs ?? 5000
  }

  /** snapshot 帶來的新值；回傳草稿要不要跟著換 */
  receive(v: string, now = Date.now()): boolean {
    this.remote = v
    if (this.pending !== null) {
      if (v === this.pending || now - this.pendingAt > this.pendingMs) this.pending = null
      else return false
    }
    if (this.editing) return false
    this.base = v
    if (this.draft === v) return false
    this.draft = v
    return true
  }

  focus() {
    if (this.editing) return
    this.editing = true
    this.base = this.pending ?? this.remote
  }

  input(v: string) {
    this.draft = v
  }

  compositionStart() {
    this.composing = true
  }

  compositionEnd(v: string) {
    this.composing = false
    this.draft = v
  }

  /** 打字中途存檔（停下來一陣子）：組字中、沒改都不存。回傳要存的值 */
  flush(now = Date.now()): string | null {
    if (this.composing) return null
    const v = this.normalize(this.draft)
    if (v === this.normalize(this.base)) return null
    this.base = v
    this.pending = v
    this.pendingAt = now
    return v
  }

  /** 離開欄位：回傳要存的值；canSave 為 false（例：離線）時放棄草稿、回到最新的 snapshot */
  blur(canSave = true, now = Date.now()): string | null {
    this.editing = false
    this.composing = false
    if (!canSave) {
      this.pending = null
      this.draft = this.remote
      this.base = this.remote
      return null
    }
    const out = this.flush(now)
    if (out !== null) this.draft = out
    else if (this.pending === null) {
      // 沒改：採用編輯中錯過的 snapshot（對方改的名稱）
      this.draft = this.remote
      this.base = this.remote
    }
    return out
  }

  /** Esc：放棄這次的修改 */
  revert() {
    this.draft = this.base
  }
}

/** Enter 是不是在確定輸入法的字（注音、日文選字）：這時不能當成「完成」 */
export function isImeEnter(e: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>): boolean {
  return e.isComposing || e.keyCode === 229
}
