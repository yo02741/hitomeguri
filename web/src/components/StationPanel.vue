<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { mapThumbFallback, mapThumbUrl } from '../services/bundles'
import { googleMapsUrl } from '../services/maps'
import { type NearbySpots, NEAR_M, osmUrl, type StationInfo } from '../services/stations'
import { canSpeak, speakJa } from '../services/tts'

// 車站卡片（DESIGN.md §7.13a，UX-FLOW.md B5）：地圖上點了車站（縮放 12 以上；新幹線站 9 以上）。
// 名稱帶（站名、英文、播放、關閉）固定，下面捲動：停靠的路線（路線色、新幹線）、附近的景點（點了打開景點）。
// 手機和擴充包的點一樣依內容高度，最高 60dvh，不能拖；手機打橫在左側欄。
const props = defineProps<{ station: StationInfo; pref: string; nearby: NearbySpots }>()
const emit = defineEmits<{ close: []; select: [id: string] }>()

// 附近的景點先列這麼多，其餘展開
const FIRST = 8
// 路線超過這麼多（東京、上野、新宿）先列前面幾條（新幹線排在前面），其餘展開
const LINES_FIRST = 9
const expanded = ref(false)
const linesExpanded = ref(false)
watch(
  () => props.station.id,
  () => {
    expanded.value = false
    linesExpanded.value = false
  },
)
const rows = computed(() => (expanded.value ? props.nearby.rows : props.nearby.rows.slice(0, FIRST)))
const lines = computed(() =>
  linesExpanded.value || props.station.lines.length <= LINES_FIRST + 1 ? props.station.lines : props.station.lines.slice(0, LINES_FIRST),
)
const mapsUrl = computed(() => googleMapsUrl(`${props.station.name}駅`, props.pref))
const source = computed(() => osmUrl(props.station.id))

function distance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}
function hidePhoto(e: Event, i: string) {
  const img = e.target as HTMLImageElement
  const next = mapThumbFallback(i, img.src)
  if (next && !img.dataset.fallback) {
    img.dataset.fallback = '1'
    img.src = next
    return
  }
  img.hidden = true
}
</script>

<template>
  <section :data-pref="pref" class="flex h-full flex-col bg-paper text-ink max-lg:max-h-[60dvh] land:max-h-none" aria-label="車站">
    <div class="paper-grain flex shrink-0 items-start gap-1 bg-region py-4 pr-3 pl-5 text-on-region">
      <div class="mr-2 flex min-w-0 flex-col gap-0.5">
        <span class="flex items-center gap-1.5 text-caption font-bold">
          <!-- 車站的記號：和地圖上一樣，新幹線站是雙圈 -->
          <span class="grid size-3.5 place-items-center rounded-full border-2 border-on-region" aria-hidden="true">
            <span v-if="station.shinkansen" class="size-1.5 rounded-full bg-on-region"></span>
          </span>
          車站<template v-if="station.shinkansen">・新幹線</template>
        </span>
        <h2 lang="ja" class="text-h2 font-black tracking-name">{{ station.name }}</h2>
        <span v-if="station.en" lang="en" class="font-latin text-base font-semibold wrap-anywhere">{{ station.en }}</span>
      </div>
      <button
        v-if="canSpeak()"
        type="button"
        :aria-label="`播放 ${station.name}`"
        class="ml-auto grid size-tap shrink-0 place-items-center rounded-full border-[1.5px] border-on-region bg-transparent text-on-region active:not-disabled:translate-y-px"
        @click="speakJa(`${station.name}駅`)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="關閉"
        class="grid size-tap shrink-0 place-items-center rounded-full text-on-region hover:bg-region-accent active:not-disabled:translate-y-px"
        :class="canSpeak() ? '' : 'ml-auto'"
        @click="emit('close')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <section v-if="station.lines.length" class="flex flex-col px-5 pt-3.5" aria-labelledby="station-lines">
        <h3 id="station-lines" class="flex items-baseline gap-1.5 pb-2 text-caption font-bold tracking-section text-sub">
          路線<span class="font-num font-normal tracking-normal">{{ station.lines.length }}</span>
        </h3>
        <ul class="flex flex-wrap gap-1.5">
          <li
            v-for="l in lines"
            :key="l.name"
            class="flex min-h-8 max-w-full items-center gap-1.5 rounded-tag border border-line py-1 pr-2 pl-1.5 text-body-sm"
            :title="l.operator"
          >
            <!-- 路線色是資料（OSM 的 colour），沒有時畫空心圈 -->
            <span
              v-if="l.color"
              class="size-3 shrink-0 rounded-full"
              :style="{ backgroundColor: l.color }"
              aria-hidden="true"
            ></span>
            <span v-else class="size-3 shrink-0 rounded-full border-2 border-sub" aria-hidden="true"></span>
            <span lang="ja" class="min-w-0 truncate">{{ l.name }}</span>
            <span v-if="l.shinkansen" class="shrink-0 rounded-tag bg-ink px-1 text-caption font-bold text-paper">新幹線</span>
          </li>
          <li v-if="lines.length < station.lines.length">
            <button
              type="button"
              class="flex min-h-8 items-center rounded-tag px-2 text-body-sm font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:min-h-tap"
              @click="linesExpanded = true"
            >
              全部 <span class="mx-0.5 font-num">{{ station.lines.length }}</span> 條
            </button>
          </li>
        </ul>
      </section>

      <section class="flex flex-col px-5 pt-4" aria-labelledby="station-near">
        <h3 id="station-near" class="flex items-baseline gap-1.5 pb-1 text-caption font-bold tracking-section text-sub">
          附近的景點<span v-if="nearby.rows.length" class="font-num font-normal tracking-normal">{{ nearby.rows.length }}</span>
        </h3>
        <p v-if="!nearby.rows.length" class="py-1 text-body-sm text-sub">
          <span class="font-num">{{ NEAR_M / 1000 }}</span> km 內沒有收錄的景點。
        </p>
        <button
          v-for="r in rows"
          :key="r.spot.id"
          type="button"
          class="-mx-1.5 flex min-h-tap items-center gap-3 rounded-control px-1.5 py-1.5 text-left text-ink hover:bg-surface active:bg-surface"
          @click="emit('select', r.spot.id)"
        >
          <span class="size-11 shrink-0 overflow-hidden rounded-control bg-placeholder">
            <img
              v-if="r.spot.i"
              data-photo
              :src="mapThumbUrl(r.spot.i)"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              class="size-full object-cover"
              @error="hidePhoto($event, r.spot.i)"
            />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span v-if="r.spot.h" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ r.spot.h }}</span>
            <span lang="ja" class="line-clamp-2 text-body-sm font-bold break-words">{{ r.spot.n }}</span>
          </span>
          <span class="shrink-0 font-num text-caption text-sub">{{ distance(r.d) }}</span>
        </button>
        <button
          v-if="nearby.rows.length > FIRST && !expanded"
          type="button"
          class="mt-1 flex h-9 w-fit items-center gap-1 rounded-control border border-line px-3 text-body-sm font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
          @click="expanded = true"
        >
          全部 <span class="font-num">{{ nearby.rows.length }}</span> 個
        </button>
      </section>

      <div v-if="source" class="mx-5 mt-3 flex flex-wrap gap-x-3 text-caption text-sub pointer-coarse:-my-3.5 pointer-coarse:items-center">
        <span>來源</span>
        <a :href="source" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-3.5">OpenStreetMap</a>
      </div>

      <div class="mt-auto flex border-t border-line px-5 pt-3.5 pb-5 max-lg:mt-4 max-lg:px-3 max-lg:pt-2 max-lg:pb-2">
        <a
          :href="mapsUrl"
          target="_blank"
          rel="noopener"
          class="flex h-11 grow items-center justify-center rounded-control bg-region-strong px-4 text-body-sm font-bold whitespace-nowrap text-white no-underline active:translate-y-px"
        >在 Google Maps 開啟</a>
      </div>
    </div>
  </section>
</template>
