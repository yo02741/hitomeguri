import { computed, nextTick, onBeforeUnmount, ref, type Ref, watch } from 'vue'

/**
 * 貼著觸發鈕的浮動面板（日期選擇器等）。面板 Teleport 到 body，避開外層的 overflow 與 bottom sheet：
 * 位置用 fixed 算，下方放不下就翻到上方；左右不超出畫面，手機也不超過底部分頁列。點面板與觸發鈕以外的地方就收起。
 * 面板離開原本的 DOM 後吃不到地區色，所以沿用觸發鈕所在的 data-pref。
 * 觸發鈕在打開的原生 <dialog>（showModal，top layer）裡時改 Teleport 到那個 dialog：
 * 放在 body 會被 top layer 蓋住、也點不到（背後的頁面是 inert）。元件寫 <Teleport :to="host">。
 * side 與 origin（DESIGN.md §9）：往下開的從上方長出（animate-pop-in）、翻到上方的從下方長出（animate-pop-up），
 * transform-origin 對準觸發鈕那一角。打開後第一次定位就決定方向，捲動時不換，進場動畫不重播。
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
  const host = ref<HTMLElement | string>('body')
  const side = ref<'top' | 'bottom'>('bottom')
  let sideFixed = false
  const origin = computed(() => `${opts.align === 'end' ? 'right' : 'left'} ${side.value === 'top' ? 'bottom' : 'top'}`)
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
    // 手機的底部分頁列（app-tabbar）在畫面上時，面板的下緣不超過分頁列
    const tab = document.querySelector<HTMLElement>('.app-tabbar')
    const tabTop = tab && tab.offsetHeight ? tab.getBoundingClientRect().top : 0
    const vh = tabTop > 0 ? Math.min(window.innerHeight, tabTop) : window.innerHeight
    let top = r.bottom + gap
    const flip = top + h > vh - margin && r.top - gap - h >= margin
    if (flip) top = r.top - gap - h
    if (!sideFixed) {
      side.value = flip ? 'top' : 'bottom'
      sideFixed = true
    }
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
      sideFixed = false
      listen(false)
      observer?.disconnect()
      observer = null
      style.value = OFFSCREEN
      return
    }
    pref.value = trigger.value?.closest<HTMLElement>('[data-pref]')?.dataset.pref
    // pre-flush 的 watcher：在面板畫出來之前換好 Teleport 的目標
    host.value = trigger.value?.closest<HTMLDialogElement>('dialog[open]') ?? 'body'
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

  return { open, style, pref, place, side, origin, host }
}

/**
 * 不 Teleport 的小面板（清單、加入行程、成員、經縣值的級數選單）：打開時按 Esc 關閉並把焦點還給觸發鈕，
 * 點 root 以外的地方也關閉。close 由呼叫端決定怎麼關（open 可能是 boolean 或「哪一個」）。
 * 面板裡的 Dropdown、DatePicker 會 Teleport 到 body（標 data-floating）：點在那裡面不算外面；
 * 它們自己處理掉的 Esc（preventDefault 或 stopPropagation）只關它們自己。
 */
export function useDismiss(
  root: Ref<HTMLElement | null>,
  open: Ref<unknown>,
  close: () => void,
  trigger?: () => HTMLElement | null | undefined,
) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented) return
    e.preventDefault()
    const t = trigger?.()
    close()
    t?.focus()
  }
  function onPointerDown(e: PointerEvent) {
    const n = e.target as Element
    if (root.value && !root.value.contains(n) && !n.closest?.('[data-floating]')) close()
  }
  function listen(on: boolean) {
    if (on) {
      document.addEventListener('keydown', onKey)
      document.addEventListener('pointerdown', onPointerDown, true)
    } else {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }
  watch(open, (o, old) => {
    if (Boolean(o) !== Boolean(old)) listen(Boolean(o))
  })
  onBeforeUnmount(() => listen(false))
}
