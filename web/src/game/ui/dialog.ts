import type { Button } from '../engine/input'
import type { SourceRef } from '../engine/types'

import { audibleAt, length, typed } from './text'

/**
 * 對話框的流程（規格 §4）：一句話（say）或一個問題（ask）分成好幾頁，一頁兩行，打字機一個字一個字出。
 * A：字還在跑就先把這一頁出完；出完了換下一頁；最後一頁 say 就結束、ask 就選游標那一個。
 * B：say 跟 A 一樣；ask 出完了選「取消」那一個。上下：移動 ask 的游標（最後一頁出完之後）。
 * 純邏輯，DialogBox.vue 只負責畫與把時間、按鍵交進來。
 */
export interface DialogLine {
  /** 每一句不一樣（同一句話再出現也要重新打字） */
  id: number
  kind: 'say' | 'ask'
  text: string
  who?: string
  source?: SourceRef
  options: string[]
  /** 按 B 選哪一個 */
  cancel: number
}

/** 按了之後發生什麼：none 沒事、finish 這頁出完、page 換頁、cursor 游標動了、done 結束（index 是選的） */
export type DialogStep = { kind: 'none' | 'finish' | 'page' | 'cursor' } | { kind: 'done'; index: number }

export class DialogFlow {
  readonly line: DialogLine
  pages: string[]
  page = 0
  /** 這一頁出了幾個字 */
  shown = 0
  choice = 0
  private t = 0
  private cps: number

  constructor(line: DialogLine, pages: string[], cps: number) {
    this.line = line
    this.pages = pages.length ? pages : ['']
    this.cps = cps
    this.choice = 0
    this.shown = typed(0, cps, this.total)
  }

  /** 這一頁一共幾個字 */
  get total(): number {
    return length(this.pages[this.page] ?? '')
  }
  get typing(): boolean {
    return this.shown < this.total
  }
  get last(): boolean {
    return this.page >= this.pages.length - 1
  }
  /** 是／否、多選的選單出來了 */
  get asking(): boolean {
    return this.line.kind === 'ask' && this.last && !this.typing
  }
  /** ▼：這一頁出完、按 A 會往下 */
  get more(): boolean {
    return !this.typing && (!this.last || this.line.kind === 'say')
  }

  /** 換速度（設定改了、減少動態） */
  setSpeed(cps: number) {
    this.cps = cps
    if (!Number.isFinite(cps)) this.shown = this.total
  }

  /** 字型、寬度變了重新分頁：停在差不多的地方 */
  repaginate(pages: string[]) {
    const done = !this.typing
    this.pages = pages.length ? pages : ['']
    this.page = Math.min(this.page, this.pages.length - 1)
    this.shown = done ? this.total : Math.min(this.shown, this.total)
  }

  /** 時間往前 dt 秒；回傳這次多出來、要響打字聲的字數 */
  tick(dt: number): number {
    if (!this.typing) return 0
    this.t += dt
    const before = this.shown
    this.shown = Math.max(before, typed(this.t, this.cps, this.total))
    let n = 0
    for (let i = before; i < this.shown; i++) if (audibleAt(this.pages[this.page] ?? '', i)) n++
    return n
  }

  /** 這頁直接出完 */
  finish() {
    this.shown = this.total
  }

  private nextPage(): DialogStep {
    this.page++
    this.t = 0
    this.shown = typed(0, this.cps, this.total)
    return { kind: 'page' }
  }

  press(b: Button): DialogStep {
    const ask = this.line.kind === 'ask'
    if (b === 'A' || b === 'B') {
      if (this.typing) {
        this.finish()
        return { kind: 'finish' }
      }
      if (!this.last) return this.nextPage()
      if (!ask) return { kind: 'done', index: 0 }
      return { kind: 'done', index: b === 'A' ? this.choice : this.line.cancel }
    }
    if ((b === 'up' || b === 'down') && this.asking) {
      const n = this.line.options.length
      if (n < 2) return { kind: 'none' }
      this.choice = (this.choice + (b === 'up' ? n - 1 : 1)) % n
      return { kind: 'cursor' }
    }
    return { kind: 'none' }
  }

  /** 點選項：字還沒出完就先出完 */
  pick(i: number): DialogStep {
    if (this.typing || !this.last) return this.press('A')
    if (!this.asking || i < 0 || i >= this.line.options.length) return { kind: 'none' }
    this.choice = i
    return { kind: 'done', index: i }
  }
}
