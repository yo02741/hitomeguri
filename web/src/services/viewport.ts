import { ref } from 'vue'

/** 桌機寬度（≥1024，Tailwind 的 lg，DESIGN.md §5.1）：手機不放散步的旅人 */
const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
export const wide = ref(mq?.matches ?? true)
mq?.addEventListener('change', (e) => (wide.value = e.matches))

/** 手機寬度（<640，Tailwind 的 sm 以下）：深度探索的地區特色卡改橫排，簡介少一行 */
const mqNarrow = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null
export const narrow = ref(mqNarrow?.matches ?? false)
mqNarrow?.addEventListener('change', (e) => (narrow.value = e.matches))

/** 觸控為主的裝置（手機、平板）：Google Maps 路線用手機瀏覽器的 waypoint 上限，共編邀請用系統分享 */
const mqCoarse = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null
export const coarse = ref(mqCoarse?.matches ?? false)
mqCoarse?.addEventListener('change', (e) => (coarse.value = e.matches))

/** 手機打橫（高 ≤500、寬 <1024，Tailwind 的 land:，決定事項 N2）：分頁放進 header、地圖頁的清單與景點卡片改成左側欄 */
const mqLand = typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape) and (max-height: 500px) and (max-width: 1023.98px)') : null
export const land = ref(mqLand?.matches ?? false)
mqLand?.addEventListener('change', (e) => (land.value = e.matches))
