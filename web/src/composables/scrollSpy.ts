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
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const y = getComputedStyle(n).overflowY
    if (y === 'auto' || y === 'scroll') return n
  }
  return null
}

/**
 * 段落目錄的捲動連動（旅前準備的左側目錄）：捲到哪一段，目錄就標哪一段。
 * ids 依文件順序（含子段落）；段落標題捲過容器頂端 offset px 內就算進入。捲到底時標最後一段。
 * go(id) 平滑捲到該段並把網址 hash 設成 #id；捲動途中目錄直接停在目標，不跟著閃過中間的段落。
 */
export function useScrollSpy(root: Ref<HTMLElement | null>, ids: () => string[], offset = 96) {
  const router = useRouter()
  const active = ref<string | null>(null)
  let container: HTMLElement | null = null
  let lock: string | null = null
  let unlockTimer = 0
  let frame = 0

  function update() {
    frame = 0
    if (lock || !container) return
    const list = ids()
    const top = container.getBoundingClientRect().top
    let current = list[0] ?? null
    for (const id of list) {
      const el = document.getElementById(id)
      if (el && el.getBoundingClientRect().top - top <= offset) current = id
    }
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) current = list[list.length - 1] ?? current
    active.value = current
  }
  function onScroll() {
    if (!frame) frame = requestAnimationFrame(update)
  }
  function unlock() {
    lock = null
    window.clearTimeout(unlockTimer)
  }

  function go(id: string, smooth = true) {
    const el = document.getElementById(id)
    if (!el) return
    lock = id
    active.value = id
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    void router.replace({ hash: `#${id}` })
    window.clearTimeout(unlockTimer)
    unlockTimer = window.setTimeout(unlock, smooth ? 900 : 50)
  }

  function detach() {
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
