import { ref } from 'vue'

/** 桌機寬度（≥1024，Tailwind 的 lg，DESIGN.md §5.1）：手機不放散步的旅人、不放地圖的「立體」鈕 */
const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
export const wide = ref(mq?.matches ?? true)
mq?.addEventListener('change', (e) => (wide.value = e.matches))

/** 手機寬度（<640，Tailwind 的 sm 以下）：深度探索的地區特色卡改橫排，簡介少一行 */
const mqNarrow = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null
export const narrow = ref(mqNarrow?.matches ?? false)
mqNarrow?.addEventListener('change', (e) => (narrow.value = e.matches))
