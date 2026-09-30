<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import DatePicker from '../components/DatePicker.vue'
import DateRangePicker from '../components/DateRangePicker.vue'
import ExportButtons from '../components/ExportButtons.vue'
import MapView from '../components/MapView.vue'
import MarkedSpotList from '../components/MarkedSpotList.vue'
import TripCard from '../components/TripCard.vue'
import { type MarkedSpot, useMarkedSpots } from '../composables/markedSpots'
import { markRow } from '../services/export'
import type { MapSpot } from '../services/bundles'
import { dayDate, TRIP_NAME_MAX, tripStatus } from '../services/trip'
import { todayIso } from '../services/userdb'
import { useCatalogStore } from '../stores/catalog'
import { type Mark, useMarksStore } from '../stores/marks'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 旅行紀錄（UX-FLOW.md E1、E4、E5、E6）：上方「全部去過」地圖，接著已結束的旅行，最後是去過的景點（依日期新到舊，可批次補日期）。
// 「去過」＝已結束的行程裡的停留點 ∪ 標了去過的景點（UX-FLOW.md §3）。
const userStore = useUserStore()
const marks = useMarksStore()
const trips = useTripsStore()
const catalog = useCatalogStore()
const router = useRouter()

const doneTrips = computed(() => trips.sorted.filter((t) => tripStatus(t, trips.today) === 'done'))
const visitedEntries = computed<Array<[string, Mark]>>(() => {
  const out = new Map<string, Mark>()
  for (const t of doneTrips.value) {
    t.days.forEach((d, i) => {
      for (const s of d.stops) {
        if (!out.has(s.spot_id)) out.set(s.spot_id, { pref: s.pref, name: s.name, visited: true, visited_on: dayDate(t, i) })
      }
    })
  }
  // 自己標的去過優先（日期以自己填的為準）
  for (const [id, m] of marks.visited) out.set(id, { ...m, visited_on: m.visited_on ?? out.get(id)?.visited_on })
  return [...out.entries()]
})
const { rows, loading } = useMarkedSpots(() => visitedEntries.value)
const sorted = computed(() =>
  [...rows.value].sort((a, b) => (b.mark.visited_on ?? '').localeCompare(a.mark.visited_on ?? '')),
)

// 地圖只標去過（印章色小圓點），不畫收藏外圈
const visitedOnly = computed(() => Object.fromEntries(visitedEntries.value.map(([id]) => [id, { visited: true }])))
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

// 補登以前的旅行（UX-FLOW.md E1）：日期在今天以前就直接是紀錄
const name = ref('')
const start = ref('')
const end = ref('')
const today = todayIso()
async function addPast() {
  if (!start.value) return
  const e = end.value && end.value >= start.value ? end.value : start.value
  const id = await trips.create({ name: name.value.trim(), start_date: start.value, end_date: e })
  if (id) await router.push(`/trips/${id}`)
}

// 批次補日期（UX-FLOW.md E6）：從清單快捷標的去過沒有日期，這裡一次補
const picking = ref(false)
const selected = ref(new Set<string>())
const batchDate = ref('')
const applying = ref(false)
const undated = computed(() => rows.value.filter((r) => !r.mark.visited_on))
function startPicking() {
  picking.value = true
  selected.value = new Set(undated.value.map((r) => r.id))
}
function toggleRow(r: MarkedSpot) {
  const next = new Set(selected.value)
  if (next.has(r.id)) next.delete(r.id)
  else next.add(r.id)
  selected.value = next
}
async function applyDate() {
  const spots = rows.value.filter((r) => selected.value.has(r.id)).map((r) => ({ id: r.id, pref: r.pref, name: r.name }))
  if (!spots.length || !batchDate.value) return
  applying.value = true
  await marks.setVisitedOnMany(spots, batchDate.value)
  applying.value = false
  selected.value = new Set()
}

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

      <section class="flex flex-col gap-3" aria-labelledby="trips-title">
        <h2 id="trips-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
          旅行<span class="font-latin text-body font-normal tracking-normal text-sub">{{ doneTrips.length }}</span>
        </h2>
        <ul v-if="doneTrips.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="t in doneTrips" :key="t.id"><TripCard :trip="t" /></li>
        </ul>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="addPast">
          <label class="flex min-w-[180px] flex-1 flex-col gap-1 text-caption text-sub">
            補登旅行
            <input
              v-model="name"
              type="text"
              :maxlength="TRIP_NAME_MAX"
              placeholder="名稱"
              class="h-10 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
            />
          </label>
          <div class="flex flex-col gap-1 text-caption text-sub">
            <span>日期</span>
            <DateRangePicker label="日期" :start="start" :end="end" :max="today" @change="(s, e) => ((start = s), (end = e))" />
          </div>
          <button
            type="submit"
            :disabled="!start"
            class="h-10 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            新增
          </button>
        </form>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="visited-title">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="visited-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
            去過<span class="font-latin text-body font-normal tracking-normal text-sub">{{ rows.length }}</span>
          </h2>
          <div class="ml-auto flex flex-wrap gap-2">
            <button
              v-if="rows.length && !picking"
              type="button"
              class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface"
              @click="startPicking"
            >
              補日期
            </button>
            <ExportButtons title="ひとめぐり 去過" :rows="sorted.map(markRow)" />
          </div>
        </div>

        <!-- 批次補日期：勾選景點 → 選日期 → 套用 -->
        <div
          v-if="picking"
          class="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card bg-paper p-2 shadow-float"
          role="group"
          aria-label="補日期"
        >
          <button
            type="button"
            class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!undated.length"
            @click="selected = new Set(undated.map((r) => r.id))"
          >
            沒有日期的<span class="ml-1 font-latin">{{ undated.length }}</span>
          </button>
          <button
            type="button"
            class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface"
            @click="selected = selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))"
          >
            {{ selected.size === rows.length ? '全不選' : '全選' }}
          </button>
          <span class="px-1 text-label text-sub" aria-live="polite">已選 <span class="font-latin text-ink">{{ selected.size }}</span></span>
          <DatePicker v-model="batchDate" label="去過日期" size="sm" :max="today" :clearable="false" class="ml-auto" />
          <button
            type="button"
            class="h-9 rounded-control bg-region-strong px-3.5 text-label font-bold text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!selected.size || !batchDate || applying"
            @click="applyDate"
          >
            套用
          </button>
          <button type="button" class="h-9 rounded-control px-3 text-label text-sub hover:bg-surface hover:text-ink" @click="picking = false">
            完成
          </button>
        </div>

        <MarkedSpotList
          v-if="rows.length"
          :rows="sorted"
          :loading="loading"
          show-date
          :selected="picking ? selected : null"
          @toggle="toggleRow"
        />
        <p v-else-if="marks.loaded" class="text-body-sm text-sub">還沒有去過的地方</p>
        <p v-if="marks.error" class="text-caption text-danger" role="alert">{{ marks.error }}</p>
      </section>
    </template>
    <p v-else class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>
