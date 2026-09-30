import { nextTick, onBeforeUnmount, onMounted, type Ref, ref, watch } from 'vue'

export interface IndicatorRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 滑動指示（DESIGN.md §9）：分頁、段落目錄的選中標示量出目前那一項的位置，
 * 由一條絕對定位的線或底色滑過去，不在各項之間跳。
 * target 回傳目前選中的元素（沒有時隱藏）；deps 變了、容器大小變了、字型載完都重新量。
 * 第一次出現時直接放到位置（animate 為 false），之後才滑動。
 */
export function useIndicator(container: Ref<HTMLElement | null>, target: () => HTMLElement | null | undefined, deps: () => unknown) {
  const rect = ref<IndicatorRect | null>(null)
  const animate = ref(false)

  async function update() {
    await nextTick()
    const c = container.value
    const el = target()
    if (!c || !el) {
      rect.value = null
      return
    }
    const cr = c.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const next = { x: r.left - cr.left + c.scrollLeft, y: r.top - cr.top + c.scrollTop, w: r.width, h: r.height }
    // 容器還沒排版（display: none 等）時不要記成 0
    if (!cr.width && !cr.height) return
    // 從隱藏到出現：直接放到位置，下一次才滑動
    if (rect.value === null) {
      animate.value = false
      requestAnimationFrame(() => requestAnimationFrame(() => (animate.value = true)))
    }
    rect.value = next
  }

  watch(deps, () => void update(), { flush: 'post' })
  let ro: ResizeObserver | null = null
  onMounted(() => {
    void update()
    ro = new ResizeObserver(() => void update())
    if (container.value) ro.observe(container.value)
    void document.fonts?.ready.then(() => update())
  })
  onBeforeUnmount(() => ro?.disconnect())

  return { rect, animate, update }
}
