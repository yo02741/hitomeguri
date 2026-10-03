import { onBeforeUnmount, ref, type Ref, watch } from 'vue'
import { useRouter } from 'vue-router'

/** 段落目錄的一項（components/SectionNav.vue） */
export interface NavItem {
  id: string
  label: string
  count?: number
  children?: { id: string; label: string }[]
}

/** 最近的可捲動祖先（App 的 <main> 或頁面自己的捲動容器） */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const y = getComputedStyle(n).overflowY
    if (y === 'auto' || y === 'scroll') return n
  }
  return null
}

/**
 * 段落目錄的捲動連動（旅前準備的左側目錄）：捲到哪一段，目錄就標哪一段。
 * ids 依文件順序（含子段落）；段落標題捲過容器頂端 offset px 內就算進入。捲過、而且捲到底時標最後一段
 * （資料還沒到時頁面很短，一開始就「在底部」，這時仍標第一段）。內容高度變了會重新判斷。
 * go(id) 平滑捲到該段並把網址 hash 設成 #id；捲動途中目錄直接停在目標，不跟著閃過中間的段落。
 * offset 可以是函式（頁頂的 sticky 列高度會依寬度不同時）。
 */
export function useScrollSpy(root: Ref<HTMLElement | null>, ids: () => string[], offset: number | (() => number) = 96) {
  const router = useRouter()
  const active = ref<string | null>(null)
  let container: HTMLElement | null = null
  let lock: string | null = null
  let unlockTimer = 0
  let frame = 0
  // 資料到了、圖片載入後內容會變高，段落位置跟著變
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => onScroll())

  function update() {
    frame = 0
    if (lock || !container) return
    const list = ids()
    const top = container.getBoundingClientRect().top
    let current = list[0] ?? null
    const within = typeof offset === 'function' ? offset() : offset
    for (const id of list) {
      const el = document.getElementById(id)
      if (el && el.getBoundingClientRect().top - top <= within) current = id
    }
    const { scrollTop, clientHeight, scrollHeight } = container
    if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 2) current = list[list.length - 1] ?? current
    active.value = current
  }
  function onScroll() {
    if (!frame) frame = requestAnimationFrame(update)
  }
  function unlock() {
    lock = null
    window.clearTimeout(unlockTimer)
    container?.removeAttribute('data-lay-out')
  }

  const frame2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  let goSeq = 0
  async function go(id: string, smooth = true) {
    const el = document.getElementById(id)
    if (!el) return
    const seq = ++goSeq
    lock = id
    active.value = id
    // 畫面外先不畫的段落（.cv-auto）高度還是估計值：先全部排一次版、等畫面記下實際高度再捲，停的位置才準。
    // 捲完拿掉；記住的高度留著（contain-intrinsic-size: auto）
    const c = container
    if (c?.querySelector('.cv-auto') && !c.hasAttribute('data-lay-out')) {
      c.setAttribute('data-lay-out', '')
      await frame2()
      // 等的時候又點了別的段落：交給後來那一次
      if (seq !== goSeq) return
      lock = id
      c.setAttribute('data-lay-out', '')
    }
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    void router.replace({ hash: `#${id}` })
    window.clearTimeout(unlockTimer)
    unlockTimer = window.setTimeout(unlock, smooth ? 900 : 50)
  }

  function detach() {
    resize?.disconnect()
    container?.removeEventListener('scroll', onScroll)
    container?.removeEventListener('scrollend', unlock)
    container = null
  }
  // 頁面內容常常等資料到了才出現，root 有值時才接上捲動容器
  watch(
    root,
    (el) => {
      detach()
      container = scrollParent(el)
      container?.addEventListener('scroll', onScroll, { passive: true })
      container?.addEventListener('scrollend', unlock)
      if (el) resize?.observe(el)
      update()
    },
    { immediate: true, flush: 'post' },
  )
  onBeforeUnmount(() => {
    detach()
    if (frame) cancelAnimationFrame(frame)
    window.clearTimeout(unlockTimer)
  })

  return { active, go, refresh: update }
}
