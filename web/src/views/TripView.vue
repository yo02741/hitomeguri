<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ExportButtons from '../components/ExportButtons.vue'
import MapView from '../components/MapView.vue'
import TripStopList from '../components/TripStopList.vue'
import { useCatalogSpots } from '../composables/catalogSpots'
import { regionOf } from '../data/regions'
import type { MapSpot } from '../services/bundles'
import type { ExportFolder, ExportRow } from '../services/export'
import {
  addDays,
  allStops,
  dayCount,
  dayDate,
  dayPref,
  MAX_DAYS,
  moveStop,
  removeStop,
  resizeDays,
  shortDate,
  type Stop,
  type StopPos,
  type Trip,
  TRIP_NAME_MAX,
  tripStatus,
} from '../services/trip'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 行程編輯（UX-FLOW.md C1–C5）：左側每天的停留點（拖曳排序、換天）與待排，右側地圖只顯示這趟的點；
// 點某一天時地圖只顯示當天並依順序連線。每段相鄰停留點有 Google Maps 轉乘連結；整趟可匯出 KML / CSV。
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const trips = useTripsStore()
const router = useRouter()

const trip = computed(() => trips.get(props.id))
const status = computed(() => (trip.value ? tripStatus(trip.value, trips.today) : 'planning'))
const { byId, loading } = useCatalogSpots(() => (trip.value ? allStops(trip.value).map((s) => ({ id: s.spot_id, pref: s.pref })) : []))

function save(patch: Partial<Trip>) {
  if (trip.value) void trips.save({ ...trip.value, ...patch })
}

// 名稱
const nameDraft = ref('')
watch(
  () => trip.value?.name,
  (n) => (nameDraft.value = n ?? ''),
  { immediate: true },
)
function saveName() {
  if (trip.value && nameDraft.value.trim() !== trip.value.name) save({ name: nameDraft.value.trim() })
}

// 日期：起訖都有時天數跟著日期；只填出發日時回程預設同一天
function setDates(start: string, end: string) {
  const t = trip.value
  if (!t) return
  const s = start || undefined
  let e = end || undefined
  if (s && (!e || e < s)) e = addDays(s, Math.max(t.days.length, 1) - 1)
  if (!s) e = undefined
  const n = dayCount(s, e)
  save({ start_date: s, end_date: e, ...(n ? resizeDays(t, n) : {}) })
}
const hasDates = computed(() => Boolean(trip.value?.start_date && trip.value?.end_date))

function addDay() {
  const t = trip.value
  if (t && t.days.length < MAX_DAYS) save(resizeDays(t, t.days.length + 1))
}
function removeDay(i: number) {
  const t = trip.value
  if (!t || t.days.length <= 1) return
  const days = t.days.filter((_, j) => j !== i).map((d) => ({ stops: [...d.stops] }))
  save({ days, unscheduled: [...t.unscheduled, ...t.days[i]!.stops] })
}

// 拖曳
const dragging = ref<StopPos | null>(null)
const dropAt = ref<StopPos | null>(null)
function onDrop() {
  const t = trip.value
  if (t && dragging.value && dropAt.value) save(moveStop(t, dragging.value, dropAt.value))
  dragging.value = null
  dropAt.value = null
}
function onDragEnd() {
  dragging.value = null
  dropAt.value = null
}
function onMove(from: StopPos, toDay: number) {
  const t = trip.value
  if (!t || toDay === from.day) return
  const len = toDay === -1 ? t.unscheduled.length : (t.days[toDay]?.stops.length ?? 0)
  save(moveStop(t, from, { day: toDay, idx: len }))
}
function onShift(from: StopPos, delta: -1 | 1) {
  const t = trip.value
  if (t) save(moveStop(t, from, { day: from.day, idx: from.idx + (delta === 1 ? 2 : -1) }))
}
function onRemove(at: StopPos) {
  const t = trip.value
  if (t) save(removeStop(t, at))
}

const targets = computed(() => [
  { value: -1, label: '待排' },
  ...(trip.value?.days ?? []).map((_, i) => ({ value: i, label: `DAY ${i + 1}` })),
])

// 地圖：全部或某一天
const selectedDay = ref<number | null>(null)
watch(
  () => trip.value?.days.length,
  (n) => {
    if (selectedDay.value !== null && (n ?? 0) <= selectedDay.value) selectedDay.value = null
  },
)
const shownStops = computed<Stop[]>(() => {
  const t = trip.value
  if (!t) return []
  return selectedDay.value === null ? allStops(t) : (t.days[selectedDay.value]?.stops ?? [])
})
const mapSpots = computed<MapSpot[]>(() => shownStops.value.flatMap((s) => byId.value.get(s.spot_id) ?? []))
const route = computed<[number, number][] | null>(() =>
  selectedDay.value === null ? null : mapSpots.value.map((s) => [s.lng, s.lat] as [number, number]),
)
// 顯示的地點組合變了才重新定位（同一天換順序不動地圖）
const bounds = ref<[number, number, number, number] | null>(null)
watch(
  () => mapSpots.value.map((s) => s.id).sort().join(','),
  () => {
    const s = mapSpots.value
    if (!s.length) return
    const lngs = s.map((x) => x.lng)
    const lats = s.map((x) => x.lat)
    bounds.value = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
  },
  { immediate: true },
)

// 地圖上點選：清單捲到那個停留點並標示
const focusId = ref<string | null>(null)
async function focusStop(id: string) {
  focusId.value = id
  await nextTick()
  document.getElementById(`stop-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// 匯出：每天一個 folder（PLAN.md §8），待排放最後
function row(s: Stop, extra: Record<string, string>): ExportRow {
  const m = byId.value.get(s.spot_id)
  return { name: m?.n ?? s.name, pref: s.pref, kana: m?.h, zh: m?.z && m.z !== m.n ? m.z : undefined, romaji: m?.r, lat: m?.lat, lng: m?.lng, extra }
}
const folders = computed<ExportFolder[]>(() => {
  const t = trip.value
  if (!t) return []
  const out = t.days.map((d, i) => {
    const date = dayDate(t, i)
    const label = `DAY ${i + 1}${date ? ` ${date}` : ''}`
    return { name: label, rows: d.stops.map((s, j) => row(s, { 日: label, 順序: String(j + 1) })) }
  })
  out.push({ name: '待排', rows: t.unscheduled.map((s) => row(s, { 日: '待排', 順序: '' })) })
  return out
})

async function del() {
  const t = trip.value
  if (!t || !window.confirm(`刪除行程「${t.name || '未命名行程'}」？`)) return
  await trips.remove(t.id)
  await router.push(status.value === 'done' ? '/log' : '/trips')
}
</script>

<template>
  <div v-if="trip" class="flex min-h-0 flex-1 max-lg:flex-col">
    <!-- 左：行程內容 -->
    <section class="flex min-h-0 flex-col gap-5 overflow-y-auto border-line px-5 py-6 lg:w-[460px] lg:shrink-0 lg:border-r max-lg:order-2">
      <RouterLink :to="status === 'done' ? '/log' : '/trips'" class="flex w-fit items-center gap-1 text-label text-sub no-underline hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        {{ status === 'done' ? '紀錄' : '行程' }}
      </RouterLink>

      <div class="flex flex-col gap-3">
        <input
          v-model="nameDraft"
          type="text"
          :maxlength="TRIP_NAME_MAX"
          placeholder="未命名行程"
          aria-label="行程名稱"
          class="h-12 rounded-control border border-transparent bg-transparent px-1 text-h3 font-black tracking-[1px] text-ink outline-none placeholder:text-sub hover:border-line focus:border-region-strong"
          @blur="saveName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex flex-col gap-1 text-caption text-sub">
            出發
            <input
              type="date"
              :value="trip.start_date ?? ''"
              class="h-10 rounded-control border border-line bg-paper px-2 font-latin text-body-sm text-ink outline-none focus:border-region-strong"
              @change="setDates(($event.target as HTMLInputElement).value, trip.end_date ?? '')"
            />
          </label>
          <label class="flex flex-col gap-1 text-caption text-sub">
            回程
            <input
              type="date"
              :value="trip.end_date ?? ''"
              :min="trip.start_date"
              :disabled="!trip.start_date"
              class="h-10 rounded-control border border-line bg-paper px-2 font-latin text-body-sm text-ink outline-none focus:border-region-strong disabled:opacity-40"
              @change="setDates(trip.start_date ?? '', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <span class="pb-2.5 text-caption text-sub">{{ trip.days.length }} 天</span>
          <span v-if="status === 'ongoing'" class="mb-2.5 rounded-tag bg-region-strong px-1.5 text-caption font-bold text-white">旅途中</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            :to="`/trips/${trip.id}/prep`"
            class="flex h-9 items-center rounded-control bg-region-strong px-3.5 text-label font-bold text-white no-underline active:translate-y-px"
          >旅前準備</RouterLink>
          <ExportButtons :title="trip.name || 'ひとめぐり 行程'" :folders="folders" :leading="['日', '順序']" />
          <button type="button" class="h-9 rounded-control border border-line bg-paper px-3 text-label text-danger hover:bg-surface" @click="del">刪除</button>
        </div>
      </div>

      <div class="flex items-center gap-3 text-label">
        <button
          type="button"
          class="border-b-2 pb-0.5"
          :class="selectedDay === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink'"
          :aria-pressed="selectedDay === null"
          @click="selectedDay = null"
        >
          全部
        </button>
      </div>

      <!-- 每一天 -->
      <section v-for="(d, i) in trip.days" :key="i" class="flex flex-col gap-1.5" :aria-label="`DAY ${i + 1}`">
        <div class="flex items-center gap-2" :data-pref="dayPref(d)">
          <button
            type="button"
            class="flex items-center gap-2 rounded-control py-1 pr-2 pl-0.5"
            :class="selectedDay === i ? 'bg-region-tint' : 'hover:bg-surface'"
            :aria-pressed="selectedDay === i"
            @click="selectedDay = selectedDay === i ? null : i"
          >
            <!-- DAY 標記（DESIGN.md §7.9）：當天主縣的顏色 -->
            <span
              class="flex size-11 shrink-0 flex-col items-center justify-center rounded-badge font-latin font-bold leading-none"
              :class="dayPref(d) ? 'bg-region text-on-region' : 'bg-placeholder text-ink'"
            >
              <span class="text-[10px]">DAY</span><span class="text-[18px]">{{ i + 1 }}</span>
            </span>
            <span v-if="dayDate(trip, i)" class="font-latin text-body-sm text-ink">{{ shortDate(dayDate(trip, i)!) }}</span>
            <span v-if="dayPref(d)" lang="ja" class="text-caption text-sub">{{ regionOf(dayPref(d))?.name.ja }}</span>
          </button>
          <button
            v-if="!hasDates && trip.days.length > 1"
            type="button"
            :aria-label="`刪除 DAY ${i + 1}`"
            class="ml-auto text-caption text-sub hover:text-ink"
            @click="removeDay(i)"
          >
            刪除這天
          </button>
        </div>
        <TripStopList
          :stops="d.stops"
          :day="i"
          :spots="byId"
          :targets="targets"
          :drop-at="dragging ? dropAt : null"
          :focus-id="focusId"
          @dragstart="(p) => (dragging = p)"
          @dragover="(p) => (dropAt = p)"
          @drop="onDrop"
          @dragend="onDragEnd"
          @move="onMove"
          @shift="onShift"
          @remove="onRemove"
          @focus="focusStop"
        />
      </section>
      <button
        v-if="!hasDates"
        type="button"
        class="h-10 w-fit rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface"
        @click="addDay"
      >
        加一天
      </button>

      <section class="flex flex-col gap-1.5 border-t border-line pt-4" aria-label="待排">
        <h2 class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub">
          待排<span class="font-latin font-normal tracking-normal">{{ trip.unscheduled.length }}</span>
        </h2>
        <TripStopList
          :stops="trip.unscheduled"
          :day="-1"
          :spots="byId"
          :targets="targets"
          :drop-at="dragging ? dropAt : null"
          :focus-id="focusId"
          @dragstart="(p) => (dragging = p)"
          @dragover="(p) => (dropAt = p)"
          @drop="onDrop"
          @dragend="onDragEnd"
          @move="onMove"
          @shift="onShift"
          @remove="onRemove"
          @focus="focusStop"
        />
      </section>
      <p v-if="loading" class="text-caption text-sub">載入中</p>
      <p v-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
    </section>

    <!-- 右：這趟的地圖 -->
    <div class="relative min-h-0 flex-1 max-lg:order-1 max-lg:h-[36dvh] max-lg:flex-none">
      <MapView :spots="mapSpots" :bounds="bounds" :route="route" :selected-id="focusId" @select="focusStop" />
    </div>
  </div>
  <section v-else class="mx-auto w-full max-w-5xl px-6 py-9">
    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <p v-else-if="trips.loaded" class="text-body-sm text-sub">找不到這個行程</p>
  </section>
</template>
