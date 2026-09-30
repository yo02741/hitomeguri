import { nextTick, onBeforeUnmount, ref, type Ref, watch } from 'vue'

/**
 * 貼著觸發鈕的浮動面板（日期選擇器等）。面板 Teleport 到 body，避開外層的 overflow 與 bottom sheet：
 * 位置用 fixed 算，下方放不下就翻到上方；左右不超出畫面。點面板與觸發鈕以外的地方就收起。
 * 面板離開原本的 DOM 後吃不到地區色，所以沿用觸發鈕所在的 data-pref。
 */
export function useFloating(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  opts: { align?: 'start' | 'end'; gap?: number } = {},
) {
  const open = ref(false)
  // 定位前先放在畫面外（不能用 visibility: hidden，否則打開時無法把焦點移進面板）
  const OFFSCREEN = { top: '-9999px', left: '-9999px' }
  const style = ref<Record<string, string>>(OFFSCREEN)
  const pref = ref<string | undefined>()
  let observer: ResizeObserver | null = null

  function place() {
    const t = trigger.value
    const p = panel.value
    if (!t || !p) return
    const r = t.getBoundingClientRect()
    const w = p.offsetWidth
    const h = p.offsetHeight
    const gap = opts.gap ?? 6
    const margin = 8
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    let top = r.bottom + gap
    if (top + h > vh - margin && r.top - gap - h >= margin) top = r.top - gap - h
    top = Math.max(margin, Math.min(top, vh - h - margin))
    let left = opts.align === 'end' ? r.right - w : r.left
    left = Math.max(margin, Math.min(left, vw - w - margin))
    style.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
  }

  function onPointerDown(e: PointerEvent) {
    const n = e.target as Node
    if (!trigger.value?.contains(n) && !panel.value?.contains(n)) open.value = false
  }

  function listen(on: boolean) {
    if (on) {
      document.addEventListener('pointerdown', onPointerDown, true)
      window.addEventListener('resize', place)
      window.addEventListener('scroll', place, true)
    } else {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }

  watch(open, async (o) => {
    if (!o) {
      listen(false)
      observer?.disconnect()
      observer = null
      style.value = OFFSCREEN
      return
    }
    pref.value = trigger.value?.closest<HTMLElement>('[data-pref]')?.dataset.pref
    await nextTick()
    place()
    listen(true)
    if (panel.value && 'ResizeObserver' in window) {
      observer = new ResizeObserver(() => place())
      observer.observe(panel.value)
    }
  })

  onBeforeUnmount(() => {
    listen(false)
    observer?.disconnect()
  })

  return { open, style, pref, place }
}
