<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import { regionOf } from '../data/regions'
import { buildGraph, searchStations, type StationOption } from '../services/daytrip'
import type { Stay } from '../services/trip'
import { coarse } from '../services/viewport'
import { useCatalogStore } from '../stores/catalog'
import BottomDialog from './BottomDialog.vue'
import RegionChip from './RegionChip.vue'
import SkeletonRows from './SkeletonRows.vue'

// 行程某一天住的車站（日帰り，UX-FLOW.md C8，DESIGN.md §7.9c）：站名搜尋（全國的車站路網）；
// 還沒打字時列建議（前一天、後一天住的，這天第一站最近的車站）。選了就存進那一天。
const props = defineProps<{
  title: string
  current?: Stay | null
  /** 建議：hint 是右邊的小字（「前一天」「浅草寺附近」） */
  suggestions: Array<{ hint: string; station: StationOption }>
}>()
const emit = defineEmits<{ close: []; pick: [stay: Stay | null] }>()

const catalog = useCatalogStore()
const state = ref<'loading' | 'ready' | 'failed'>(catalog.railGraph ? 'ready' : 'loading')
async function load() {
  state.value = 'loading'
  state.value = (await catalog.loadRailGraph()) ? 'ready' : 'failed'
}
if (!catalog.railGraph) void load()

const q = ref('')
const input = ref<HTMLInputElement | null>(null)
// 桌機直接打字；觸控不自動叫出鍵盤（先看建議）
onMounted(async () => {
  await nextTick()
  if (!coarse.value) input.value?.focus()
})

const results = computed<StationOption[]>(() => {
  const g = catalog.railGraph ? buildGraph(catalog.railGraph) : null
  return g && q.value.trim() ? searchStations(g, q.value) : []
})
const shownSuggestions = computed(() => {
  const seen = new Set<string>()
  return props.suggestions.filter((s) => !seen.has(s.station.id) && seen.add(s.station.id))
})

function pick(s: StationOption) {
  emit('pick', { st: s.id, n: s.name })
}
</script>

<template>
  <BottomDialog :title="props.title" @close="emit('close')">
    <input
      ref="input"
      v-model="q"
      type="search"
      placeholder="車站名稱"
      aria-label="找車站"
      enterkeyhint="search"
      class="mb-2 h-10 w-full rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong pointer-coarse:h-tap"
      @keydown.enter="results[0] && pick(results[0])"
    />
    <SkeletonRows v-if="state === 'loading'" :rows="3" />
    <p v-else-if="state === 'failed'" class="flex items-center gap-3 py-6 text-body-sm text-sub">
      讀不到車站資料
      <button type="button" class="min-h-tap rounded-control px-2 font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px" @click="load">重試</button>
    </p>
    <template v-else>
      <ul v-if="q.trim()" class="flex flex-col" aria-label="車站">
        <li v-for="s in results" :key="s.id" class="border-b border-line-soft last:border-b-0">
          <button
            type="button"
            class="flex min-h-tap w-full items-center gap-3 rounded-control px-2 py-2 text-left text-ink hover:bg-surface active:bg-surface"
            :aria-pressed="current?.st === s.id"
            @click="pick(s)"
          >
            <RegionChip :pref="s.pref" :size="14" />
            <span lang="ja" class="min-w-0 truncate text-body-sm font-bold">{{ s.name }}</span>
            <span v-if="s.shinkansen" class="shrink-0 rounded-tag bg-ink px-1 text-caption font-bold text-paper">新幹線</span>
            <span lang="ja" class="ml-auto shrink-0 text-caption text-sub">{{ regionOf(s.pref)?.name.ja }}</span>
            <svg v-if="current?.st === s.id" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-region-strong" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </button>
        </li>
        <li v-if="!results.length" class="py-6 text-center text-body-sm text-sub">找不到</li>
      </ul>
      <ul v-else class="flex flex-col" aria-label="建議">
        <li v-for="s in shownSuggestions" :key="s.station.id" class="border-b border-line-soft last:border-b-0">
          <button
            type="button"
            class="flex min-h-tap w-full items-center gap-3 rounded-control px-2 py-2 text-left text-ink hover:bg-surface active:bg-surface"
            :aria-pressed="current?.st === s.station.id"
            @click="pick(s.station)"
          >
            <RegionChip :pref="s.station.pref" :size="14" />
            <span lang="ja" class="min-w-0 truncate text-body-sm font-bold">{{ s.station.name }}</span>
            <span v-if="s.station.shinkansen" class="shrink-0 rounded-tag bg-ink px-1 text-caption font-bold text-paper">新幹線</span>
            <span class="ml-auto shrink-0 truncate text-caption text-sub">{{ s.hint }}</span>
          </button>
        </li>
      </ul>
    </template>
    <div v-if="current" class="sticky bottom-0 -mx-5 mt-3 flex items-center gap-3 border-t border-line-soft bg-paper px-5 pt-3">
      <span class="min-w-0 truncate text-body-sm text-sub">住在 <span lang="ja" class="font-bold text-ink">{{ current.n }}</span></span>
      <button
        type="button"
        class="ml-auto h-11 shrink-0 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
        @click="emit('pick', null)"
      >
        清除
      </button>
    </div>
  </BottomDialog>
</template>
