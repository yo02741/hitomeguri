<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { type MarkedSpot, useMarkedSpots } from '../composables/markedSpots'
import { useVisitedEntries } from '../composables/visited'
import { regionOf } from '../data/regions'
import { hasSpot, type Trip } from '../services/trip'
import { type SpotRef, spotRef } from '../stores/marks'
import BottomDialog from './BottomDialog.vue'
import MarkedSpotList from './MarkedSpotList.vue'

// 行程頁「從去過的地方加入」（使用者回饋 2026-10-11，UX-FLOW.md C2）：回填以前的旅行時，
// 先把這趟去過的景點一次勾進來，再拉到哪一天。去過的日期落在這趟期間的排最前面、預先勾好，
// 加入時直接放到那一天；其他的放待排。這趟已經有的不列。
const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ close: []; add: [items: Array<{ spot: SpotRef; day: number | null }>] }>()

const { entries } = useVisitedEntries()
const { rows, loading } = useMarkedSpots(() => entries.value.filter(([id]) => !hasSpot(props.trip, id)))

const DAY_MS = 86_400_000
/** 去過的日期是這趟的第幾天（索引）；沒有日期、不在期間內是 null */
function dayOf(r: MarkedSpot): number | null {
  const d = r.mark.visited_on
  const start = props.trip.start_date
  if (!d || !start) return null
  const i = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS)
  return i >= 0 && i < props.trip.days.length ? i : null
}

const q = ref('')
const matches = (r: MarkedSpot, text: string) => {
  const region = regionOf(r.pref)
  return [r.name, r.kana, r.zh, region?.name.ja, region?.name.zh_tw].some((s) => s?.includes(text))
}
const inTrip = computed(() =>
  rows.value
    .filter((r) => dayOf(r) !== null)
    .sort((a, b) => (a.mark.visited_on ?? '').localeCompare(b.mark.visited_on ?? '') || b.score - a.score),
)
const others = computed(() => rows.value.filter((r) => dayOf(r) === null))
const shown = computed(() => {
  const text = q.value.trim()
  return {
    inTrip: text ? inTrip.value.filter((r) => matches(r, text)) : inTrip.value,
    others: text ? others.value.filter((r) => matches(r, text)) : others.value,
  }
})

// 這趟期間去過的預先勾好（清單載入後才知道有哪些，只勾一次）
const selected = ref(new Set<string>())
let preset = false
watch(
  inTrip,
  (list) => {
    if (preset || loading.value) return
    preset = true
    selected.value = new Set(list.map((r) => r.id))
  },
  { immediate: true },
)
function toggle(r: MarkedSpot) {
  const next = new Set(selected.value)
  if (next.has(r.id)) next.delete(r.id)
  else next.add(r.id)
  selected.value = next
}

function submit() {
  const items = rows.value
    .filter((r) => selected.value.has(r.id))
    .map((r) => ({ spot: spotRef(r.id, r.pref, r.name), day: dayOf(r) }))
  if (items.length) emit('add', items)
}
</script>

<template>
  <BottomDialog title="從去過的地方加入" @close="emit('close')">
    <input
      v-model="q"
      type="search"
      placeholder="景點、縣"
      aria-label="找去過的地方"
      enterkeyhint="search"
      class="mb-2 h-10 w-full rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong pointer-coarse:h-tap"
    />
    <section v-if="shown.inTrip.length" aria-labelledby="add-visited-in">
      <h3 id="add-visited-in" class="pt-2 pb-1 text-caption font-bold tracking-section text-sub">這趟期間</h3>
      <MarkedSpotList :rows="shown.inTrip" show-date :selected="selected" @toggle="toggle" />
    </section>
    <section v-if="shown.others.length" aria-labelledby="add-visited-others">
      <h3 id="add-visited-others" class="pt-3 pb-1 text-caption font-bold tracking-section text-sub">其他去過的地方</h3>
      <MarkedSpotList :rows="shown.others" show-date :selected="selected" @toggle="toggle" />
    </section>
    <MarkedSpotList v-if="loading && !rows.length" :rows="[]" loading />
    <p v-else-if="!shown.inTrip.length && !shown.others.length" class="py-6 text-center text-body-sm text-sub">
      {{ q.trim() ? '找不到' : '沒有可以加入的地方' }}
    </p>
    <div class="sticky bottom-0 -mx-5 mt-3 flex items-center gap-3 border-t border-line-soft bg-paper px-5 pt-3">
      <span class="text-body-sm text-sub" aria-live="polite">已選 <span class="font-num text-ink">{{ selected.size }}</span></span>
      <button
        type="button"
        class="ml-auto h-11 rounded-control bg-ink px-5 text-body-sm font-bold text-paper disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
        :disabled="!selected.size"
        @click="submit"
      >
        加入
      </button>
    </div>
  </BottomDialog>
</template>
