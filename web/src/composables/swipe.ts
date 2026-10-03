/**
 * 左右滑換上一張、下一張（卡片檢視、截圖檢視共用）：元素跟著手指走（沒有上一張／下一張的方向往外拉有阻力），
 * 放開時拉過 48px 或甩得夠快就換，不然彈回原位；滑過的那一下不算點擊。只接觸控與手寫筆，滑鼠用按鈕和方向鍵。
 * 直接寫 style，不經過 reactive。換張後元素通常會用 :key 重建，舊元素的 inline style 跟著消失。
 */
export interface SwipeOptions {
  /** 跟著手指動的元素 */
  el: () => HTMLElement | null
  /** 這個方向有沒有下一張（-1 上一張、1 下一張） */
  canStep: (delta: -1 | 1) => boolean
  step: (delta: -1 | 1) => void
  /** 拖曳中的位移（預設只平移） */
  transform?: (dx: number) => string
  /** 這次按下要不要開始拖（例：只有一張時） */
  enabled?: () => boolean
}

/** 放開時要不要換張：拉過 48px 依位移方向，否則看速度（px/ms）。往左拉（dx < 0）是下一張 */
export function swipeDecision(dx: number, v: number): -1 | 1 | 0 {
  if (Math.abs(dx) > 48) return dx < 0 ? 1 : -1
  if (Math.abs(v) > 0.11) return v < 0 ? 1 : -1
  return 0
}

export function useSwipe(o: SwipeOptions) {
  let drag: { x: number; lastX: number; lastT: number; prevX: number; prevT: number } | null = null
  let swiped = false
  const transform = o.transform ?? ((dx: number) => `translateX(${dx}px)`)

  function onPointerDown(e: PointerEvent) {
    swiped = false
    drag = null
    if (e.pointerType === 'mouse' || (o.enabled && !o.enabled())) return
    const t = performance.now()
    drag = { x: e.clientX, lastX: e.clientX, lastT: t, prevX: e.clientX, prevT: t }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function dragDx(clientX: number): number {
    const dx = clientX - (drag?.x ?? clientX)
    const edge = (dx > 0 && !o.canStep(-1)) || (dx < 0 && !o.canStep(1))
    return edge ? dx * 0.3 : dx
  }
  function onPointerMove(e: PointerEvent) {
    const el = o.el()
    if (!drag || !el) return
    drag.prevX = drag.lastX
    drag.prevT = drag.lastT
    drag.lastX = e.clientX
    drag.lastT = performance.now()
    // 進場動畫的 fill 會蓋住 inline transform：拖的時候先拿掉（動畫早就播完，看起來不變）
    el.style.animation = 'none'
    el.style.transition = 'none'
    el.style.transform = transform(dragDx(e.clientX))
  }
  // 沒換張：彈回原位
  function settle() {
    const el = o.el()
    if (!el || !el.style.transform) return
    el.style.transition = 'transform 0.2s var(--ease-out-soft)'
    el.style.transform = ''
    el.addEventListener('transitionend', () => (el.style.transition = ''), { once: true })
  }
  function onPointerUp(e: PointerEvent) {
    if (!drag) return
    const dx = dragDx(e.clientX)
    // 速度：放開前最後一段移動
    const dt = performance.now() - drag.prevT
    const v = dt > 0 && dt < 100 ? (e.clientX - drag.prevX) / dt : 0
    drag = null
    const delta = swipeDecision(dx, v)
    if (delta && o.canStep(delta)) {
      swiped = true
      o.step(delta)
    } else {
      if (Math.abs(dx) > 8) swiped = true
      settle()
    }
  }
  function onPointerCancel() {
    drag = null
    settle()
  }
  /** 點擊事件裡呼叫：剛剛那一下是滑動就回傳 true（並清掉），不要當成點擊 */
  function consumeSwipe(): boolean {
    const was = swiped
    swiped = false
    return was
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, consumeSwipe }
}
