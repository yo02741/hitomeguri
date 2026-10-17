import type { Dir } from './types'

/**
 * 輸入：鍵盤、觸控、手把都寫進同一個 InputState。方向是「按住」（最後按的優先），
 * A／B／START／CAMERA／PAUSE 另外記「按下的那一下」（邊緣），每次更新拿走一次。
 * B 按住是跑步。來源分開記（鍵盤放開不會放掉觸控按著的）。
 */
export type Button = Dir | 'A' | 'B' | 'START' | 'CAMERA' | 'PAUSE'
export const DIR_BUTTONS: readonly Dir[] = ['up', 'down', 'left', 'right']
const isDir = (b: Button): b is Dir => (DIR_BUTTONS as readonly string[]).includes(b)

export class InputState {
  private readonly holds = new Map<Button, Set<string>>()
  /** 按住的方向，依按下的順序（最後一個優先） */
  private order: Dir[] = []
  private edges: Button[] = []

  /** 按下（src：key、touch、pad…） */
  press(b: Button, src = 'touch') {
    let set = this.holds.get(b)
    if (!set) {
      set = new Set()
      this.holds.set(b, set)
    }
    const was = set.size > 0
    set.add(src)
    if (!was) {
      this.edges.push(b)
      if (isDir(b)) this.order = [...this.order.filter((d) => d !== b), b]
    }
  }

  release(b: Button, src = 'touch') {
    const set = this.holds.get(b)
    if (!set) return
    set.delete(src)
    if (!set.size && isDir(b)) this.order = this.order.filter((d) => d !== b)
  }

  /** 觸控的十字鍵：按住滑動換方向（null = 放開） */
  setDir(d: Dir | null, src = 'touch') {
    for (const x of DIR_BUTTONS) if (x !== d && this.holds.get(x)?.has(src)) this.release(x, src)
    if (d) this.press(d, src)
  }

  /** 按一下（press＋release；DEV、測試、無障礙按鈕用） */
  tap(b: Button, src = 'tap') {
    this.press(b, src)
    this.release(b, src)
  }

  /** 現在按住的方向（最後按的） */
  get dir(): Dir | null {
    return this.order.length ? this.order[this.order.length - 1]! : null
  }

  held(b: Button): boolean {
    return (this.holds.get(b)?.size ?? 0) > 0
  }

  /** 這次更新的按下邊緣（拿了就清掉） */
  take(): Button[] {
    const e = this.edges
    this.edges = []
    return e
  }

  /** 全部放開（視窗失焦、切到背景） */
  clear() {
    this.holds.clear()
    this.order = []
    this.edges = []
  }
}

/** 鍵盤的鍵位（規格 §3）：方向鍵／WASD 走；Z、Space、Enter＝A；X、Shift＝B；C＝相機；Escape、Q＝START；P＝暫停 */
export const KEYMAP: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'A',
  Space: 'A',
  Enter: 'A',
  NumpadEnter: 'A',
  KeyX: 'B',
  ShiftLeft: 'B',
  ShiftRight: 'B',
  KeyC: 'CAMERA',
  Escape: 'START',
  KeyQ: 'START',
  KeyP: 'PAUSE',
}

/** 在輸入框打字時不搶鍵；焦點在按鈕、連結上時 Enter／Space 留給它（對話框的選項按鈕） */
function skip(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  if (el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true
  return (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && !!el.closest('button, a[href], [role="button"], [role="option"]')
}

/** 接上鍵盤：回傳拆掉的函式 */
export function attachKeyboard(input: InputState, target: Window = window): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const b = KEYMAP[e.code]
    if (!b || skip(e)) return
    e.preventDefault()
    if (e.repeat) return
    input.press(b, 'key')
  }
  const up = (e: KeyboardEvent) => {
    const b = KEYMAP[e.code]
    if (!b) return
    input.release(b, 'key')
  }
  const blur = () => input.clear()
  target.addEventListener('keydown', down)
  target.addEventListener('keyup', up)
  target.addEventListener('blur', blur)
  return () => {
    target.removeEventListener('keydown', down)
    target.removeEventListener('keyup', up)
    target.removeEventListener('blur', blur)
  }
}

/**
 * 手把（選配，標準配置）：每次更新讀一次。0＝A、1＝B、9＝START、8＝相機、12–15＝十字鍵、左搖桿也可以。
 * 沒有手把或瀏覽器不支援就什麼都不做。
 */
export class GamepadSource {
  private readonly input: InputState
  private prev = new Set<Button>()

  constructor(input: InputState) {
    this.input = input
  }

  poll() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
    const now = new Set<Button>()
    for (const p of pads) {
      if (!p || !p.connected) continue
      const on = (i: number) => !!p.buttons[i]?.pressed
      const ax = p.axes[0] ?? 0
      const ay = p.axes[1] ?? 0
      if (on(0)) now.add('A')
      if (on(1)) now.add('B')
      if (on(9)) now.add('START')
      if (on(8)) now.add('CAMERA')
      if (on(12) || ay < -0.5) now.add('up')
      if (on(13) || ay > 0.5) now.add('down')
      if (on(14) || ax < -0.5) now.add('left')
      if (on(15) || ax > 0.5) now.add('right')
    }
    for (const b of now) if (!this.prev.has(b)) this.input.press(b, 'pad')
    for (const b of this.prev) if (!now.has(b)) this.input.release(b, 'pad')
    this.prev = now
  }
}
