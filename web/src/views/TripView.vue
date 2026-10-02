<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import DateRangePicker from '../components/DateRangePicker.vue'
import ExportButtons from '../components/ExportButtons.vue'
import OfflineButton from '../components/OfflineButton.vue'
import MapView from '../components/MapView.vue'
import AchvRow from '../components/AchvRow.vue'
import PackOpening, { packOpened } from '../components/PackOpening.vue'
import ShareImage from '../components/ShareImage.vue'
import SplitFlap from '../components/SplitFlap.vue'
import SkeletonRows from '../components/SkeletonRows.vue'
import TripMembers from '../components/TripMembers.vue'
import TripStopList from '../components/TripStopList.vue'
import { useCatalogSpots } from '../composables/catalogSpots'
import { regionOf } from '../data/regions'
import type { MapSpot } from '../services/bundles'
import type { ExportFolder, ExportRow } from '../services/export'
import { drawTripRecap } from '../services/shareImage'
import {
  addDays,
  allStops,
  dayCount,
  dayDate,
  dayPref,
  findStop,
  MAX_DAYS,
  moveStop,
  removeStop,
  resizeDays,
  shortDate,
  type Stop,
  stopAt,
  type StopPos,
  type Trip,
  type TripContent,
  TRIP_NAME_MAX,
  daysUntil,
  tripStatus,
} from '../services/trip'
import { useCatalogStore } from '../stores/catalog'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 行程編輯（UX-FLOW.md C1–C5）：左側每天的停留點（拖曳排序、換天）與待排，右側地圖只顯示這趟的點；
// 點某一天時地圖只顯示當天並依順序連線。每段相鄰停留點有 Google Maps 轉乘連結；整趟可匯出 KML / CSV。
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const trips = useTripsStore()
const router = useRouter()

const trip = computed(() => trips.get(props.id))
// 開卡包（DESIGN.md §7.19）：結束的行程；這台裝置還沒開過的加紅點
const packOpen = ref(false)
const opened = ref(packOpened(props.id))
function closePack() {
  packOpen.value = false
  opened.value = packOpened(props.id)
}

// 旅行回顧圖（DESIGN.md §7.22）
const catalog = useCatalogStore()
const recapOpen = ref(false)
async function renderRecap(canvas: HTMLCanvasElement) {
  if (trip.value) await drawTripRecap(canvas, trip.value, catalog)
}
const until = computed(() => (trip.value && status.value === 'planning' ? daysUntil(trip.value, trips.today) : null))
const isOwner = computed(() => Boolean(trip.value && trip.value.owner === userStore.user?.uid))
const status = computed(() => (trip.value ? tripStatus(trip.value, trips.today) : 'planning'))
const { byId, loading } = useCatalogSpots(() => (trip.value ? allStops(trip.value).map((s) => ({ id: s.spot_id, pref: s.pref })) : []))

// 每個修改都在最新的一份上套用（共編時對方可能剛改過，UX-FLOW.md C7）
function mutate(fn: (t: Trip) => Partial<TripContent> | null) {
  void trips.mutate(props.id, fn)
}

// 名稱
const nameDraft = ref('')
watch(
  () => trip.value?.name,
  (n) => (nameDraft.value = n ?? ''),
  { immediate: true },
)
function saveName() {
  const name = nameDraft.value.trim()
  if (trip.value && name !== trip.value.name) mutate(() => ({ name }))
}

// 日期：起訖都有時天數跟著日期；只填出發日時回程預設同一天
function setDates(start: string, end: string) {
  mutate((t) => {
    const s = start || undefined
    let e = end || undefined
    if (s && (!e || e < s)) e = addDays(s, Math.max(t.days.length, 1) - 1)
    if (!s) e = undefined
    const n = dayCount(s, e)
    return { start_date: s, end_date: e, ...(n ? resizeDays(t, n) : {}) }
  })
}
const hasDates = computed(() => Boolean(trip.value?.start_date && trip.value?.end_date))

function addDay() {
  mutate((t) => (t.days.length < MAX_DAYS ? resizeDays(t, t.days.length + 1) : null))
}
function removeDay(i: number) {
  mutate((t) => {
    if (t.days.length <= 1 || !t.days[i]) return null
    const days = t.days.filter((_, j) => j !== i).map((d) => ({ stops: [...d.stops] }))
    return { days, unscheduled: [...t.unscheduled, ...t.days[i]!.stops] }
  })
}

/** 畫面上的位置 → 景點 id；寫入時再到最新的一份裡找它現在的位置 */
function spotAt(at: StopPos): string | undefined {
  return trip.value ? stopAt(trip.value, at)?.spot_id : undefined
}
function moveSpot(spotId: string | undefined, to: (t: Trip, from: StopPos) => StopPos | null) {
  if (!spotId) return
  mutate((t) => {
    const from = findStop(t, spotId)
    const dest = from && to(t, from)
    return from && dest ? moveStop(t, from, dest) : null
  })
}

// 拖曳
const dragging = ref<StopPos | null>(null)
const dropAt = ref<StopPos | null>(null)
function onDrop() {
  const at = dropAt.value
  if (dragging.value && at) moveSpot(spotAt(dragging.value), () => at)
  dragging.value = null
  dropAt.value = null
}
function onDragEnd() {
  dragging.value = null
  dropAt.value = null
}
function onMove(from: StopPos, toDay: number) {
  if (toDay === from.day) return
  moveSpot(spotAt(from), (t, cur) => {
    if (cur.day === toDay) return null
    const len = toDay === -1 ? t.unscheduled.length : t.days[toDay]?.stops.length
    return len === undefined ? null : { day: toDay, idx: len }
  })
}
function onShift(from: StopPos, delta: -1 | 1) {
  moveSpot(spotAt(from), (_, cur) => ({ day: cur.day, idx: cur.idx + (delta === 1 ? 2 : -1) }))
}
function onRemove(at: StopPos) {
  const spotId = spotAt(at)
  if (!spotId) return
  mutate((t) => {
    const cur = findStop(t, spotId)
    return cur ? removeStop(t, cur) : null
  })
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
  const others = t ? t.members.length - 1 : 0
  const msg = `刪除行程「${t?.name || '未命名行程'}」？${others ? `共編的 ${others} 位成員也會看不到。` : ''}`
  if (!t || !window.confirm(msg)) return
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
        <div class="flex flex-wrap items-center gap-2.5">
          <DateRangePicker
            label="日期"
            :start="trip.start_date ?? ''"
            :end="trip.end_date ?? ''"
            @change="setDates"
          />
          <span class="text-caption text-sub">{{ trip.days.length }} 天</span>
          <span v-if="status === 'ongoing'" class="rounded-tag bg-region-strong px-1.5 text-caption font-bold text-white">旅途中</span>
          <span v-else-if="until !== null" class="flex items-center gap-1 text-caption text-sub">還有<SplitFlap :value="String(until)" class="text-title" />天</span>
        </div>
        <TripMembers :trip="trip" />
        <div class="flex flex-wrap gap-2">
          <button
            v-if="status === 'done'"
            type="button"
            class="relative flex h-9 items-center rounded-control bg-region-strong px-3.5 text-label font-bold text-white active:translate-y-px"
            @click="packOpen = true"
          >
            開卡包
            <span v-if="!opened" class="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-paper bg-danger" aria-label="還沒開"></span>
          </button>
          <RouterLink
            :to="`/trips/${trip.id}/prep`"
            class="flex h-9 items-center rounded-control bg-region-strong px-3.5 text-label font-bold text-white no-underline active:translate-y-px"
          >旅前準備</RouterLink>
          <RouterLink
            :to="`/trips/${trip.id}/book`"
            class="flex h-9 items-center rounded-control border border-line bg-paper px-3 text-label text-ink no-underline hover:bg-surface"
          >旅前小書</RouterLink>
          <ExportButtons :title="trip.name || 'ひとめぐり 行程'" :folders="folders" :leading="['日', '順序']" />
          <OfflineButton :trip="trip" />
          <button
            type="button"
            class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!trip.days.some((d) => d.stops.length)"
            @click="recapOpen = true"
          >回顧圖</button>
          <button
            v-if="isOwner"
            type="button"
            class="h-9 rounded-control border border-line bg-paper px-3 text-label text-danger hover:bg-surface"
            @click="del"
          >刪除</button>
        </div>
        <!-- 這趟達成的初訪章與成就（DESIGN.md §7.25） -->
        <AchvRow v-if="status === 'done'" :trip="trip" :size="40" />
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
      <SkeletonRows v-if="loading" :rows="3" thumb />
      <p v-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
    </section>

    <!-- 右：這趟的地圖 -->
    <div class="relative min-h-0 flex-1 max-lg:order-1 max-lg:h-[36dvh] max-lg:flex-none">
      <MapView :spots="mapSpots" :bounds="bounds" :route="route" :selected-id="focusId" @select="focusStop" />
    </div>
    <PackOpening v-if="packOpen" :trip="trip" @close="closePack" />
    <ShareImage v-if="recapOpen" title="旅行回顧" :file-name="`ひとめぐり ${trip.name || '行程'}`" :render="renderRecap" @close="recapOpen = false" />
  </div>
  <section v-else class="mx-auto w-full max-w-5xl px-6 py-9">
    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <p v-else-if="trips.loaded" class="text-body-sm text-sub">找不到這個行程</p>
  </section>
</template>
