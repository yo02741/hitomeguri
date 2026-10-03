import { ref } from 'vue'

/** 桌機寬度（≥1024，Tailwind 的 lg，DESIGN.md §5.1）：手機不放散步的旅人、不放地圖的「立體」鈕 */
const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
export const wide = ref(mq?.matches ?? true)
mq?.addEventListener('change', (e) => (wide.value = e.matches))
