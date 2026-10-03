<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { SeasonStation } from '../services/bundles'

// 深度探索「季節」：氣象廳生物季節観測的平年值，畫在 12 個月的時間軸上。
// 一個縣可能有好幾個觀測站（北海道、沖繩），用索引列切換；第一個是代表站。
const props = defineProps<{ stations: SeasonStation[]; sourceUrl: string }>()

interface Row {
  key: string
  name: string
  what: string
  from: string
  to?: string
}
// 順序即一年裡大致的先後
const ROWS: { key: string; name: string; what: string; to?: string }[] = [
  { key: 'ume', name: '梅花', what: '開花' },
  { key: 'sakura_kaika', name: '櫻花', what: '開花～滿開', to: 'sakura_mankai' },
  { key: 'fuji', name: '紫藤', what: '開花' },
  { key: 'ajisai', name: '繡球花', what: '開花' },
  { key: 'ichou', name: '銀杏', what: '黃葉' },
  { key: 'kaede', name: '楓葉', what: '紅葉' },
]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const current = ref(0)
watch(
  () => props.stations,
  () => (current.value = 0),
)
const station = computed(() => props.stations[current.value] ?? props.stations[0])

const rows = computed<Row[]>(() => {
  const n = station.value?.normals ?? {}
  return ROWS.filter((r) => n[r.key]).map((r) => ({
    key: r.key,
    name: r.name,
    // 只有開花沒有滿開時不寫「～滿開」
    what: r.to && !n[r.to] ? '開花' : r.what,
    from: n[r.key]!,
    to: r.to ? n[r.to] : undefined,
  }))
})

/** "MM-DD" → 一年中的位置（0–100%） */
function pos(md: string): number {
  const [m, d] = md.split('-').map(Number) as [number, number]
  return ((m - 1 + (d - 0.5) / DAYS[m - 1]!) / 12) * 100
}
function label(md: string): string {
  const [m, d] = md.split('-').map(Number)
  return `${m}.${d}`
}
const nearEnd = (r: Row) => pos(r.to ?? r.from) > 78

// 時間軸的寬度（px）：始、終兩點（12px）的間隔不到一個點寬時會疊成「(●」，改畫成一條（例：360 寬的櫻花開花～滿開）
const DOT = 12
const axis = ref<HTMLElement | null>(null)
const axisW = ref(0)
const axisObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(([e]) => (axisW.value = e?.contentRect.width ?? 0)) : null
watch(axis, (el, old) => {
  if (old) axisObserver?.unobserve(old)
  if (el) axisObserver?.observe(el)
})
onBeforeUnmount(() => axisObserver?.disconnect())
const merged = (r: Row) => !!r.to && axisW.value > 0 && ((pos(r.to) - pos(r.from)) / 100) * axisW.value < DOT
const thisMonth = new Date().getMonth() + 1
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 觀測站：文字索引列，選中的加底線（同地圖頁的類型列）。觸控時每站左右 6px 已隔開，不另加間距：北海道 8 站在 360 寬排得進一行 -->
    <nav v-if="stations.length > 1" class="flex flex-wrap gap-x-3.5 gap-y-1 pointer-coarse:-mx-1.5 pointer-coarse:-my-2.5 pointer-coarse:gap-x-0 pointer-coarse:gap-y-0" aria-label="觀測地點">
      <button
        v-for="(s, i) in stations"
        :key="s.name"
        type="button"
        lang="ja"
        class="text-body-sm pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="i === current ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="i === current"
        @click="current = i"
      >
        <span class="block border-b-2 border-inherit pb-0.5">{{ s.name }}</span>
      </button>
    </nav>

    <div class="flex flex-col">
      <!-- 月份 -->
      <div class="flex items-end">
        <span class="w-24 shrink-0 sm:w-32"></span>
        <!-- 窄螢幕只標奇數月（格線照舊 12 格） -->
        <div ref="axis" class="grid flex-1 grid-cols-12">
          <span
            v-for="m in MONTHS"
            :key="m"
            class="pb-1.5 text-center font-latin text-caption"
            :class="[m === thisMonth ? 'font-bold text-ink' : 'text-sub', m % 2 === 0 ? 'max-sm:invisible' : '']"
          >{{ m }}<span class="hidden sm:inline">月</span></span>
        </div>
      </div>
      <div
        v-for="r in rows"
        :key="r.key"
        class="flex min-h-tap items-center border-t border-line-soft"
      >
        <span class="flex w-24 shrink-0 flex-col pr-2 sm:w-32 sm:flex-row sm:items-baseline sm:gap-1.5">
          <span class="text-body-sm font-bold">{{ r.name }}</span>
          <span class="text-caption text-sub">{{ r.what }}</span>
        </span>
        <div class="relative h-tap flex-1">
          <!-- 月份格線與本月底色 -->
          <div class="absolute inset-0 grid grid-cols-12" aria-hidden="true">
            <span
              v-for="m in MONTHS"
              :key="m"
              class="border-l border-line-soft"
              :class="m === thisMonth ? 'bg-region-tint' : ''"
            ></span>
          </div>
          <!-- 始、終兩點太近：一條從始點左緣到終點右緣的膠囊 -->
          <span
            v-if="merged(r)"
            class="absolute top-1/2 h-3 -translate-y-1/2 rounded-full border-2 border-paper bg-region-strong"
            :style="{ left: `calc(${pos(r.from)}% - ${DOT / 2}px)`, width: `calc(${pos(r.to!) - pos(r.from)}% + ${DOT}px)` }"
            aria-hidden="true"
          ></span>
          <template v-else>
            <span
              v-if="r.to && pos(r.to) > pos(r.from)"
              class="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-region-strong"
              :style="{ left: `${pos(r.from)}%`, width: `${pos(r.to) - pos(r.from)}%` }"
              aria-hidden="true"
            ></span>
            <span
              class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-region-strong"
              :style="{ left: `${pos(r.from)}%` }"
              aria-hidden="true"
            ></span>
            <span
              v-if="r.to"
              class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-region-strong"
              :style="{ left: `${pos(r.to)}%` }"
              aria-hidden="true"
            ></span>
          </template>
          <!-- 日期：靠近年底時放在點的左邊 -->
          <span
            class="absolute top-1/2 -translate-y-1/2 font-latin text-caption font-bold whitespace-nowrap"
            :class="nearEnd(r) ? '-translate-x-full pr-3' : 'pl-3'"
            :style="{ left: `${nearEnd(r) ? pos(r.from) : pos(r.to ?? r.from)}%` }"
          >{{ label(r.from) }}<template v-if="r.to"> – {{ label(r.to) }}</template></span>
        </div>
      </div>
    </div>

    <p class="text-caption text-sub">
      平年值・<span lang="ja">{{ station?.name }}</span>・<a :href="sourceUrl" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-4">氣象廳 生物季節觀測</a>
    </p>
  </div>
</template>
