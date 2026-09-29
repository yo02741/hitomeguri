<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import ExportButtons from '../components/ExportButtons.vue'
import MapView from '../components/MapView.vue'
import MarkedSpotList from '../components/MarkedSpotList.vue'
import { useMarkedSpots } from '../composables/markedSpots'
import type { MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 旅行紀錄（UX-FLOW.md E4）：上方「全部去過」地圖，下方去過的景點（有日期的依日期新到舊）。
// 各趟旅行的卡片在 Phase 7（行程）加入。
const userStore = useUserStore()
const marks = useMarksStore()
const catalog = useCatalogStore()
const router = useRouter()

const { rows, loading } = useMarkedSpots(() => marks.visited)
const sorted = computed(() =>
  [...rows.value].sort((a, b) => (b.mark.visited_on ?? '').localeCompare(a.mark.visited_on ?? '')),
)

// 地圖只標去過（印章色小圓點），不畫收藏外圈
const visitedOnly = computed(() => Object.fromEntries(marks.visited.map(([id]) => [id, { visited: true }])))
const spots = computed<MapSpot[]>(() =>
  rows.value.flatMap((r) => catalog.mapSpots[r.pref]?.find((s) => s.id === r.id) ?? []),
)
const bounds = computed<[number, number, number, number] | null>(() => {
  const s = spots.value
  if (!s.length) return null
  const lngs = s.map((x) => x.lng)
  const lats = s.map((x) => x.lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
})

function open(id: string) {
  const r = rows.value.find((x) => x.id === id)
  if (r) void router.push({ path: `/map/${r.pref}`, query: { spot: id } })
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-9">
    <h1 class="text-h2 font-black tracking-[2px]">紀錄</h1>

    <template v-if="userStore.user">
      <div class="relative h-[360px] overflow-hidden rounded-card border border-line max-md:h-[260px]">
        <MapView :spots="spots" :bounds="bounds" :marked="visitedOnly" @select="open" />
      </div>

      <section class="flex flex-col gap-3" aria-labelledby="visited-title">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="visited-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
            去過<span class="font-latin text-body font-normal tracking-normal text-sub">{{ rows.length }}</span>
          </h2>
          <ExportButtons class="ml-auto" title="ひとめぐり 去過" :rows="sorted" />
        </div>
        <MarkedSpotList v-if="rows.length" :rows="sorted" :loading="loading" show-date />
        <p v-else-if="marks.loaded" class="text-body-sm text-sub">還沒有去過的地方</p>
      </section>
    </template>
    <p v-else class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>
