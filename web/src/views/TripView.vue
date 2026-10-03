<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ActionMenu, { type MenuAction } from '../components/ActionMenu.vue'
import BackLink from '../components/BackLink.vue'
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
import { useOnline } from '../composables/online'
import { regionOf } from '../data/regions'
import type { MapSpot } from '../services/bundles'
import { confirmDialog } from '../services/confirm'
import { download, type ExportFolder, type ExportRow, toCsv, toKml } from '../services/export'
import { drawTripRecap } from '../services/shareImage'
import { showToast } from '../services/toast'
import { wide } from '../services/viewport'
import {
  addDays,
  allStops,
  dayCount,
  dayDate,
  dayIndexOn,
  dayPref,
  edgeTarget,
  findStop,
  insertStop,
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
// 手機（<1024，決定事項 F3）：整頁一起捲，沒有內層捲動；sticky 天數條（DAY 1…／待排＋「地圖」）一次只顯示一天，
// 地圖預設收起，打開是天數條下面 40dvh、只顯示選中的那天。旅途中進頁就選今天、打開地圖。
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

// 離線時行程不能修改（寫入用交易，要連得到才能讀最新的一份）：編輯的按鈕停用，標題下標「離線中」
const online = useOnline()
const locked = computed(() => !online.value)

// 每個修改都在最新的一份上套用（共編時對方可能剛改過，UX-FLOW.md C7）
function mutate(fn: (t: Trip) => Partial<TripContent> | null) {
  if (locked.value) return
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
  if (locked.value) {
    nameDraft.value = trip.value?.name ?? ''
    return
  }
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

// 手機上加了一天就換到那一天（天數條一次只顯示一天，否則看不到加在哪裡）
let addPending = false
function addDay() {
  addPending = !wide.value
  mutate((t) => (t.days.length < MAX_DAYS ? resizeDays(t, t.days.length + 1) : null))
}
function removeDay(i: number) {
  if (!wide.value && selectedDay.value === i) selectedDay.value = Math.max(0, i - 1)
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
// 觸控的「⋯」選單：移到這天（或待排）的最前、最後
function onEdge(from: StopPos, where: 'first' | 'last') {
  moveSpot(spotAt(from), (t, cur) => edgeTarget(t, cur, where))
}
// 移除停留點後底部出現「復原」（決定事項 L）：放回原本那一天的原本位置
function onRemove(at: StopPos) {
  const t0 = trip.value
  const stop = t0 ? stopAt(t0, at) : undefined
  if (!stop || locked.value) return
  mutate((t) => {
    const cur = findStop(t, stop.spot_id)
    return cur ? removeStop(t, cur) : null
  })
  showToast('已從行程移除', () => mutate((t) => insertStop(t, at, stop)))
}

const targets = computed(() => {
  const t = trip.value
  return [
    { value: -1, label: '待排' },
    ...(t?.days ?? []).map((_, i) => {
      const date = t && dayDate(t, i)
      return { value: i, label: `DAY ${i + 1}`, hint: date ? monthDay(date) : undefined }
    }),
  ]
})

/** 10/3 */
function monthDay(d: string): string {
  const [, m, day] = d.split('-').map(Number)
  return `${m}/${day}`
}

// 旅途中的今天是第幾天（DAY 標記下的「今日」）
const todayIdx = computed(() => {
  const t = trip.value
  return t && status.value === 'ongoing' ? dayIndexOn(t, trips.today) : null
})

// 地圖：全部或某一天。selectedDay 的 null 是全部（只有桌機有）、-1 是待排（只有手機的天數條有）；
// 手機沒選過時是 DAY 1。
const selectedDay = ref<number | null>(null)
const activeDay = computed<number | null>(() => {
  const d = selectedDay.value
  if (wide.value) return d === -1 ? null : d
  return d ?? 0
})
watch(
  () => trip.value?.days.length,
  (n, old) => {
    const len = n ?? 0
    if (addPending && old !== undefined && len > old) selectedDay.value = len - 1
    addPending = false
    if (selectedDay.value !== null && len <= selectedDay.value) selectedDay.value = wide.value ? null : Math.max(0, len - 1)
  },
)
const shownStops = computed<Stop[]>(() => {
  const t = trip.value
  const d = activeDay.value
  if (!t) return []
  if (d === null) return allStops(t)
  return d === -1 ? t.unscheduled : (t.days[d]?.stops ?? [])
})
const mapSpots = computed<MapSpot[]>(() => shownStops.value.flatMap((s) => byId.value.get(s.spot_id) ?? []))
const route = computed<[number, number][] | null>(() =>
  activeDay.value === null || activeDay.value === -1 ? null : mapSpots.value.map((s) => [s.lng, s.lat] as [number, number]),
)

// 手機的地圖切換；天數條（sticky）與它上面的定位點，用來在換天時把天數條留在畫面頂端
const mapOpen = ref(false)
const column = ref<HTMLElement | null>(null)
const anchor = ref<HTMLElement | null>(null)
const bar = ref<HTMLElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const appMain = () => document.getElementById('app-main')
/** 天數條在 <main> 裡原本的位置（沒有黏住時的 scrollTop） */
function barTop(): number | null {
  const main = appMain()
  if (!main || !anchor.value) return null
  return anchor.value.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
}
function selectDay(i: number) {
  selectedDay.value = i
  // 往下捲過、天數條黏在頂端時，換天後從那天的第一個點看起
  const main = appMain()
  const top = barTop()
  if (main && top !== null && main.scrollTop > top) main.scrollTop = top
}
// 天數條橫向捲動：選中的那一格捲進來
function revealChip(i: number) {
  const s = strip.value
  const chip = s?.querySelector<HTMLElement>(`[data-day="${i}"]`)
  if (!s || !chip) return
  if (chip.offsetLeft < s.scrollLeft || chip.offsetLeft + chip.offsetWidth > s.scrollLeft + s.clientWidth) {
    s.scrollLeft = chip.offsetLeft - 20
  }
}
watch(activeDay, async (d) => {
  if (wide.value || d === null) return
  await nextTick()
  revealChip(d)
})

// 旅途中進頁就選今天（決定事項 F3、第二階段 12）：桌機左欄捲到 DAY n；手機打開地圖，
// 頁面捲到天數條黏在頂端（返回時回到原本的位置，就不捲）
let initFor = ''
watch(
  () => [props.id, Boolean(trip.value)] as const,
  async ([id, has]) => {
    if (!has || initFor === id) return
    // 從一趟行程直接換到另一趟時元件不會重建：左欄的捲動位置不要沿用
    if (initFor && column.value) column.value.scrollTop = 0
    initFor = id
    selectedDay.value = null
    mapOpen.value = false
    const i = todayIdx.value
    if (i === null) return
    selectedDay.value = i
    mapOpen.value = true
    await nextTick()
    await new Promise((r) => requestAnimationFrame(r))
    if (wide.value) {
      const col = column.value
      const el = col?.querySelector<HTMLElement>(`[data-day="${i}"]`)
      if (!col || !el) return
      const top = el.getBoundingClientRect().top - col.getBoundingClientRect().top
      if (top > col.clientHeight / 2) col.scrollTop += top - 16
      return
    }
    revealChip(i)
    const main = appMain()
    const top = barTop()
    if (main && top !== null && main.scrollTop === 0) main.scrollTop = top
  },
  { immediate: true },
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
  const el = document.getElementById(`stop-${id}`)
  if (!el) return
  if (wide.value) {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    return
  }
  // 手機整頁捲動：不要捲到天數條與地圖（sticky）底下
  const main = appMain()
  if (!main || !bar.value) return
  const r = el.getBoundingClientRect()
  const top = bar.value.getBoundingClientRect().bottom
  const bottom = main.getBoundingClientRect().bottom
  if (r.top < top) main.scrollBy({ top: r.top - top - 8, behavior: 'smooth' })
  else if (r.bottom > bottom) main.scrollBy({ top: r.bottom - bottom + 8, behavior: 'smooth' })
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

// 手機的「更多」（決定事項 D2）：匯出、回顧圖、刪除收在這裡，按鈕列只留一列
const moreItems = computed<MenuAction[]>(() => {
  const hasRows = folders.value.some((f) => f.rows.length)
  const out: MenuAction[] = [
    { key: 'kml', label: '匯出 KML', disabled: !hasRows },
    { key: 'csv', label: '匯出 CSV', disabled: !hasRows },
    { key: 'recap', label: '回顧圖', disabled: !trip.value?.days.some((d) => d.stops.length) },
  ]
  if (isOwner.value) out.push({ key: 'delete', label: '刪除行程', danger: true, disabled: locked.value, group: 1 })
  return out
})
function onMore(key: string) {
  const title = trip.value?.name || 'ひとめぐり 行程'
  if (key === 'kml') download(title, 'kml', toKml(title, folders.value))
  else if (key === 'csv') download(title, 'csv', toCsv(folders.value.flatMap((f) => f.rows), ['日', '順序']))
  else if (key === 'recap') recapOpen.value = true
  else if (key === 'delete') void del()
}

async function del() {
  const t = trip.value
  const others = t ? t.members.length - 1 : 0
  if (!t) return
  const ok = await confirmDialog({
    title: `刪除行程「${t.name || '未命名行程'}」？`,
    body: others ? `共編的 ${others} 位成員也會看不到。` : undefined,
    ok: '刪除',
    danger: true,
  })
  if (!ok) return
  await trips.remove(t.id)
  await router.push(status.value === 'done' ? '/log' : '/trips')
}
</script>

<template>
  <div v-if="trip" class="flex flex-1 max-lg:flex-col lg:min-h-0">
    <!-- 左：行程內容（手機沒有內層捲動，整頁一起捲） -->
    <section ref="column" class="flex flex-col gap-5 border-line px-5 pt-6 pb-24 lg:min-h-0 lg:w-[460px] lg:shrink-0 lg:overflow-y-auto lg:border-r">
      <BackLink :to="status === 'done' ? '/log' : '/trips'">{{ status === 'done' ? '紀錄' : '行程' }}</BackLink>

      <div class="flex flex-col gap-3">
        <input
          v-model="nameDraft"
          type="text"
          :maxlength="TRIP_NAME_MAX"
          placeholder="未命名行程"
          aria-label="行程名稱"
          :readonly="locked"
          class="h-12 rounded-control border border-transparent bg-transparent px-1 text-h3 font-black tracking-title text-ink outline-none placeholder:text-sub hover:border-line focus:border-region-strong"
          @blur="saveName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <div class="flex flex-wrap items-center gap-2.5">
          <DateRangePicker
            label="日期"
            :start="trip.start_date ?? ''"
            :end="trip.end_date ?? ''"
            :disabled="locked"
            @change="setDates"
          />
          <span class="text-caption text-sub">{{ trip.days.length }} 天</span>
          <span v-if="status === 'ongoing'" class="rounded-tag bg-region-strong px-1.5 text-caption font-bold text-white">旅途中</span>
          <span v-else-if="until !== null" class="flex items-center gap-1 text-caption text-sub">還有<SplitFlap :value="String(until)" class="text-title" />天</span>
        </div>
        <p v-if="locked" class="w-fit rounded-tag bg-ink px-1.5 text-caption font-bold text-paper" role="status">離線中・行程不能修改</p>
        <p v-else-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
        <TripMembers :trip="trip" />
        <!-- 手機窄螢幕（<640）內距與間距縮一點，旅前準備、旅前小書、離線用、更多排得進一列 -->
        <div class="flex flex-wrap gap-2 max-sm:gap-1.5">
          <button
            v-if="status === 'done'"
            type="button"
            class="relative flex h-9 items-center rounded-control bg-region-strong px-3.5 text-label font-bold text-white active:translate-y-px pointer-coarse:h-tap max-sm:px-2.5"
            @click="packOpen = true"
          >
            開卡包
            <span v-if="!opened" class="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-paper bg-danger" aria-label="還沒開"></span>
          </button>
          <!-- 一個畫面只有一個 Primary（DESIGN §7.1）：結束後「開卡包」是 Primary，「旅前準備」退成 Secondary -->
          <RouterLink
            :to="`/trips/${trip.id}/prep`"
            class="flex h-9 items-center rounded-control px-3.5 text-label no-underline active:translate-y-px pointer-coarse:h-tap max-sm:px-2.5"
            :class="status === 'done' ? 'border border-line bg-paper text-ink hover:bg-surface' : 'bg-region-strong font-bold text-white'"
          >旅前準備</RouterLink>
          <RouterLink
            :to="`/trips/${trip.id}/book`"
            class="flex h-9 items-center rounded-control border border-line bg-paper px-3 text-label text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap max-sm:px-2.5"
          >旅前小書</RouterLink>
          <ExportButtons class="max-lg:hidden" :title="trip.name || 'ひとめぐり 行程'" :folders="folders" :leading="['日', '順序']" />
          <OfflineButton :trip="trip" class="max-sm:px-2.5" />
          <button
            type="button"
            class="h-9 rounded-control max-lg:hidden border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
            :disabled="!trip.days.some((d) => d.stops.length)"
            @click="recapOpen = true"
          >回顧圖</button>
          <button
            v-if="isOwner"
            type="button"
            :disabled="locked"
            class="h-9 rounded-control border border-line bg-paper px-3 text-label text-danger max-lg:hidden hover:not-disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
            @click="del"
          >刪除</button>
          <!-- 手機：匯出、回顧圖、刪除收進「更多」（決定事項 D2） -->
          <span class="contents lg:hidden">
            <ActionMenu
              label="更多"
              :items="moreItems"
              trigger-class="flex h-9 items-center gap-1 rounded-control border border-line bg-paper pr-2 pl-3 text-label max-sm:pr-1.5 max-sm:pl-2.5 text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
              @select="onMore"
            >
              更多
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="text-sub" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </ActionMenu>
          </span>
        </div>
        <!-- 這趟達成的初訪章與成就（DESIGN.md §7.25） -->
        <AchvRow v-if="status === 'done'" :trip="trip" :size="40" />
      </div>

      <div v-if="wide" class="flex items-center gap-3 text-label pointer-coarse:-mx-1.5 pointer-coarse:-my-2.5">
        <button
          type="button"
          class="pointer-coarse:px-1.5 pointer-coarse:py-2.5"
          :class="selectedDay === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
          :aria-pressed="selectedDay === null"
          @click="selectedDay = null"
        >
          <span class="block border-b-2 border-inherit pb-0.5">全部</span>
        </button>
      </div>

      <!-- 手機：sticky 天數條＋地圖（決定事項 F3）。定位點記下天數條原本的位置；-mt-5 抵掉定位點多出來的間距 -->
      <div v-if="!wide" ref="anchor" class="h-0" aria-hidden="true"></div>
      <div v-if="!wide" ref="bar" class="sticky top-0 z-10 -mx-5 -mt-5 flex flex-col bg-paper">
        <div class="flex items-center gap-2 border-b border-line-soft py-1.5 pr-5">
          <div ref="strip" class="scroll-quiet flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain pr-1 pl-5" role="group" aria-label="天數">
            <button
              v-for="(d, i) in trip.days"
              :key="i"
              type="button"
              :data-day="i"
              :data-pref="dayPref(d)"
              class="flex h-tap min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-control px-2.5 leading-none active:translate-y-px"
              :class="activeDay === i ? (dayPref(d) ? 'bg-region text-on-region' : 'bg-ink text-paper') : 'bg-surface text-ink'"
              :aria-pressed="activeDay === i"
              @click="selectDay(i)"
            >
              <span class="font-latin text-label font-bold">DAY {{ i + 1 }}</span>
              <span v-if="i === todayIdx" class="text-micro font-bold">今日</span>
              <span v-else-if="dayDate(trip, i)" class="font-latin text-micro">{{ monthDay(dayDate(trip, i)!) }}</span>
            </button>
            <button
              type="button"
              data-day="-1"
              class="flex h-tap min-w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-control px-2.5 leading-none active:translate-y-px"
              :class="activeDay === -1 ? 'bg-ink text-paper' : 'bg-surface text-ink'"
              :aria-pressed="activeDay === -1"
              @click="selectDay(-1)"
            >
              <span class="text-label font-bold">待排</span>
              <span class="font-latin text-micro">{{ trip.unscheduled.length }}</span>
            </button>
          </div>
          <button
            type="button"
            class="flex h-tap shrink-0 items-center gap-1.5 rounded-control border px-3 text-label font-bold active:translate-y-px"
            :class="mapOpen ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink'"
            :aria-expanded="mapOpen"
            :aria-controls="mapOpen ? 'trip-map' : undefined"
            @click="mapOpen = !mapOpen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" /></svg>
            地圖
          </button>
        </div>
        <div v-if="mapOpen" id="trip-map" class="relative h-[40dvh] border-b border-line-soft">
          <MapView :spots="mapSpots" :bounds="bounds" :route="route" :selected-id="focusId" @select="focusStop" />
        </div>
      </div>

      <!-- 每一天（手機一次只顯示天數條選中的那天） -->
      <section v-for="(d, i) in trip.days" v-show="wide || activeDay === i" :key="i" :data-day="i" class="flex flex-col gap-1.5" :aria-label="`DAY ${i + 1}`">
        <div class="flex items-center gap-2" :data-pref="dayPref(d)">
          <!-- 桌機點 DAY 標記切換地圖只顯示這天；手機由天數條切換，這裡只是標頭 -->
          <component
            :is="wide ? 'button' : 'div'"
            v-bind="wide ? { type: 'button', 'aria-pressed': selectedDay === i } : {}"
            class="flex items-center gap-2 rounded-control py-1 pr-2 pl-0.5"
            :class="wide ? ['active:not-disabled:translate-y-px', selectedDay === i ? 'bg-region-tint' : 'hover:bg-surface'] : ''"
            @click="wide && (selectedDay = selectedDay === i ? null : i)"
          >
            <!-- DAY 標記（DESIGN.md §7.9）：當天主縣的顏色；旅途中的今天下面加「今日」 -->
            <span class="flex shrink-0 flex-col items-center gap-1">
              <span
                class="flex size-11 shrink-0 flex-col items-center justify-center rounded-badge font-latin font-bold leading-none"
                :class="dayPref(d) ? 'bg-region text-on-region' : 'bg-placeholder text-ink'"
              >
                <span class="text-micro leading-none">DAY</span><span class="text-[18px]">{{ i + 1 }}</span>
              </span>
              <span v-if="i === todayIdx" class="rounded-tag bg-region-strong px-1.5 text-caption font-bold text-white">今日</span>
            </span>
            <span v-if="dayDate(trip, i)" class="font-latin text-body-sm text-ink">{{ shortDate(dayDate(trip, i)!) }}</span>
            <span v-if="dayPref(d)" lang="ja" class="text-caption text-sub">{{ regionOf(dayPref(d))?.name.ja }}</span>
          </component>
          <button
            v-if="!hasDates && trip.days.length > 1"
            type="button"
            :aria-label="`刪除 DAY ${i + 1}`"
            :disabled="locked"
            class="ml-auto text-caption text-sub hover:not-disabled:text-ink disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:text-ink"
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
          :locked="locked"
          @dragstart="(p) => (dragging = p)"
          @dragover="(p) => (dropAt = p)"
          @drop="onDrop"
          @dragend="onDragEnd"
          @move="onMove"
          @shift="onShift"
          @edge="onEdge"
          @remove="onRemove"
          @focus="focusStop"
        />
      </section>
      <button
        v-if="!hasDates && activeDay !== -1"
        type="button"
        :disabled="locked"
        class="h-10 w-fit rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:not-disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
        @click="addDay"
      >
        加一天
      </button>

      <section v-show="wide || activeDay === -1" class="flex flex-col gap-1.5 lg:border-t lg:border-line lg:pt-4" aria-label="待排">
        <h2 class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub max-lg:sr-only">
          待排<span class="font-latin font-normal tracking-normal">{{ trip.unscheduled.length }}</span>
        </h2>
        <TripStopList
          :stops="trip.unscheduled"
          :day="-1"
          :spots="byId"
          :targets="targets"
          :drop-at="dragging ? dropAt : null"
          :focus-id="focusId"
          :locked="locked"
          @dragstart="(p) => (dragging = p)"
          @dragover="(p) => (dropAt = p)"
          @drop="onDrop"
          @dragend="onDragEnd"
          @move="onMove"
          @shift="onShift"
          @edge="onEdge"
          @remove="onRemove"
          @focus="focusStop"
        />
      </section>
      <SkeletonRows v-if="loading" :rows="3" thumb />
    </section>

    <!-- 右：這趟的地圖 -->
    <div v-if="wide" class="relative min-h-0 flex-1">
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
