<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Dropdown from './Dropdown.vue'

import { useDismiss } from '../composables/floating'
import { useStampPress } from '../composables/stampPress'
import { dayDate, findStop, hasSpot, hasSpotOn, insertStop, moveStop, placesOf, removeStop, shortDate, TRIP_NAME_MAX, tripStatus } from '../services/trip'
import { showToast } from '../services/toast'
import { todayIso } from '../services/userdb'
import { LIST_NAME_MAX, type SpotRef, useMarksStore } from '../stores/marks'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'
import DatePicker from './DatePicker.vue'

// 景點卡片的收藏、去過、清單（UX-FLOW.md B4、§3）。未登入時按下去先登入，登入後完成動作。
const props = defineProps<{ spot: SpotRef }>()
// 自己按下去過、狀態變成去過時（景點卡片接著播新卡入手）
const emit = defineEmits<{ stamped: [] }>()
const marks = useMarksStore()
const trips = useTripsStore()
const userStore = useUserStore()

const mark = computed(() => marks.markOf(props.spot.id))
const disabled = computed(() => !userStore.canSignIn)

// 去過（UX-FLOW.md §3）：自己標的，或在已結束的行程裡（日期取那一天，自己填的優先）。
// 只由行程來的去過在這裡取消不了（從行程移除才會），「去過」按了不動；日期照樣可以改（改了就變成自己標的）。
const viaTrip = computed(() => (mark.value?.visited ? undefined : trips.doneVisits.get(props.spot.id)))
const visited = computed(() => Boolean(mark.value?.visited) || Boolean(viaTrip.value))
const visitedOn = computed(() => mark.value?.visited_on ?? viaTrip.value?.date)

// 按下去過時蓋章、按下收藏時星星彈一下（DESIGN.md §9）
const { pressing, key: stampKey, arm } = useStampPress(() => visited.value, () => props.spot.id)
watch(pressing, (p) => {
  if (p) emit('stamped')
})
function toggleVisited() {
  if (viaTrip.value) return
  arm()
  void marks.toggleVisited(props.spot)
}
const star = useStampPress(() => Boolean(mark.value?.favorite), () => props.spot.id)
const starPop = star.pressing
const starKey = star.key
function toggleFavorite() {
  star.arm()
  void marks.toggleFavorite(props.spot)
}

// 清單、行程的選單（一次開一個）
const open = ref<'lists' | 'trips' | null>(null)
const root = ref<HTMLElement | null>(null)
const newName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const newTrip = ref('')
const tripInput = ref<HTMLInputElement | null>(null)

const listsBtn = ref<HTMLButtonElement | null>(null)
const tripsBtn = ref<HTMLButtonElement | null>(null)
// Esc、點外面關閉；Esc 時焦點回到打開它的那顆鈕
useDismiss(
  root,
  open,
  () => (open.value = null),
  () => (open.value === 'lists' ? listsBtn.value : tripsBtn.value),
)
watch(
  () => props.spot.id,
  () => {
    open.value = null
    newName.value = ''
    newTrip.value = ''
  },
)

async function toggle(which: 'lists' | 'trips') {
  if (open.value === which) {
    open.value = null
    return
  }
  // 未登入：先登入再打開
  if (!userStore.user) {
    try {
      await userStore.signIn()
    } catch {
      return
    }
  }
  open.value = which
  await nextTick()
  if (which === 'lists' && !marks.lists.length) nameInput.value?.focus()
  if (which === 'trips' && !tripList.value.length) tripInput.value?.focus()
}

// 加入行程（UX-FLOW.md C2）：全部的行程，已結束的排在後面、上方標「已結束」（回填以前的旅行）；
// 選「待排」或某一天
const tripList = computed(() => trips.sorted.map((t) => ({ t, done: tripStatus(t, todayIso()) === 'done' })))
const firstDone = computed(() => tripList.value.findIndex((x) => x.done))
const inTrips = computed(() => trips.sorted.filter((t) => hasSpot(t, props.spot.id)).length)
const target = ref<Record<string, string>>({})
function dayLabel(t: (typeof trips.sorted)[number], i: number): string {
  const d = dayDate(t, i)
  return `DAY ${i + 1}${d ? `　${shortDate(d)}` : ''}`
}
type TripT = (typeof trips.sorted)[number]
const dayOption = (t: TripT, i: number) => ({ value: String(i), label: dayLabel(t, i) })
async function addTo(tripId: string, fallback = '') {
  const v = target.value[tripId] ?? fallback
  await trips.addStop(tripId, props.spot, v === '' ? null : Number(v))
}
// 已經加入的：每個排的地方照樣可以換天（加錯天馬上改）、移除（底部可以復原）。
// 同一個景點可以再排進別天（機場：來跟回），同一天最多一次
function moveOptions(t: TripT, day: number) {
  const ok = (d: number) => d === day || !hasSpotOn(t, d, props.spot.id)
  return [...(ok(-1) ? [{ value: '', label: '待排' }] : []), ...t.days.flatMap((_, i) => (ok(i) ? [dayOption(t, i)] : []))]
}
/** 還可以再排的天（不含待排）；預設選最後一天（回程）。只在待排時是換天，不是再排一次：不列 */
function againOptions(t: TripT) {
  if (!placesOf(t, props.spot.id).some((d) => d >= 0)) return []
  return t.days.flatMap((_, i) => (hasSpotOn(t, i, props.spot.id) ? [] : [dayOption(t, i)]))
}
const placeKey = (day: number) => (day === -1 ? '' : String(day))
function moveTo(tripId: string, fromDay: number, v: string) {
  const day = v === '' ? -1 : Number(v)
  void trips.mutate(tripId, (t) => {
    const from = findStop(t, props.spot.id, fromDay)
    if (!from || from.day === day || hasSpotOn(t, day, props.spot.id)) return null
    const len = day === -1 ? t.unscheduled.length : t.days[day]?.stops.length
    return len === undefined ? null : moveStop(t, from, { day, idx: len })
  })
}
function removeFrom(tripId: string, day: number) {
  const t0 = trips.get(tripId)
  const at = t0 && findStop(t0, props.spot.id, day)
  const stop = at && (at.day === -1 ? t0.unscheduled[at.idx] : t0.days[at.day]?.stops[at.idx])
  if (!at || !stop) return
  void trips.mutate(tripId, (t) => {
    const cur = findStop(t, props.spot.id, day)
    return cur ? removeStop(t, cur) : null
  })
  showToast('已從行程移除', () => trips.mutate(tripId, (t) => insertStop(t, at, stop)))
}
async function addTrip() {
  const name = newTrip.value.trim()
  if (!name) return
  newTrip.value = ''
  await trips.create({ name }, props.spot)
}

async function addList() {
  const name = newName.value.trim()
  if (!name) return
  newName.value = ''
  await marks.createList(name, props.spot)
}

const inLists = computed(() => mark.value?.lists?.length ?? 0)
const today = todayIso()
// 今年的只寫月日
const visitedShort = computed(() => {
  const d = visitedOn.value
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return y === Number(today.slice(0, 4)) ? `${m}/${day}` : `${y}/${m}/${day}`
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- 桌機 2×2；手機（<1024）是 sheet 底部工作列的一排四顆：圖示在上、字在下 -->
    <div ref="root" class="relative grid grid-cols-2 gap-2 max-lg:flex max-lg:gap-1.5">
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 max-lg:h-tap max-lg:min-w-0 max-lg:flex-1 max-lg:basis-0 max-lg:flex-col max-lg:gap-0.5 max-lg:text-caption"
        :class="
          mark?.favorite
            ? 'border-[1.5px] border-region-strong bg-region-tint font-bold text-ink'
            : 'border border-line bg-paper text-ink hover:bg-surface'
        "
        :aria-pressed="Boolean(mark?.favorite)"
        :disabled="disabled"
        @click="toggleFavorite"
      >
        <svg
          :key="starKey"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          :fill="mark?.favorite ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
          aria-hidden="true"
          :class="starPop ? 'animate-star-pop' : ''"
        >
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
        收藏
      </button>
      <!-- 去過：標了之後右半邊是日期（點開月曆補填）；手機的工作列不放箭頭，「去過」才不會被日期擠成直排 -->
      <div
        class="flex h-11 overflow-hidden rounded-control text-body-sm max-lg:h-tap max-lg:min-w-0 max-lg:flex-[1.5] max-lg:basis-0 max-lg:text-caption"
        :class="
          visited
            ? 'border-[1.5px] border-visited bg-visited-tint font-bold text-visited'
            : 'border border-line bg-paper text-ink'
        "
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 max-lg:flex-col max-lg:gap-0.5"
          :class="[visited ? '' : 'hover:bg-surface', viaTrip ? 'cursor-default active:translate-y-0' : '']"
          :aria-pressed="visited"
          :aria-disabled="viaTrip ? true : undefined"
          :title="viaTrip ? `去過・${viaTrip.trip || '未命名行程'}` : undefined"
          :disabled="disabled"
          @click="toggleVisited"
        >
          <span v-if="visited" :key="stampKey" class="grid size-4 place-items-center rounded-full" :class="pressing ? 'stamp-ring' : ''">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" :class="pressing ? 'animate-stamp-press' : ''">
              <circle cx="12" cy="12" r="9.5" fill="currentColor" />
              <path d="M8.3 12.3l2.5 2.5 4.9-5.1" fill="none" class="stroke-white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
          </svg>
          去過
        </button>
        <DatePicker
          v-if="visited"
          bare
          align="end"
          label="去過日期"
          :model-value="visitedOn ?? ''"
          :max="today"
          class="flex shrink-0 items-center gap-1 border-l border-visited/30 px-2.5 font-num text-body-sm font-normal max-lg:text-caption hover:bg-visited/10 max-lg:px-1.5"
          @update:model-value="marks.setVisitedOn(spot, $event)"
        >
          <template #default>
            <span v-if="visitedOn">{{ visitedShort }}</span>
            <span v-else class="font-sans">日期</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="max-lg:hidden" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </template>
        </DatePicker>
      </div>
      <button
        ref="listsBtn"
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 max-lg:h-tap max-lg:min-w-0 max-lg:flex-1 max-lg:basis-0 max-lg:flex-col max-lg:gap-0.5 max-lg:text-caption"
        :class="inLists ? 'border-[1.5px] border-ink bg-surface font-bold text-ink' : 'border border-line bg-paper text-ink hover:bg-surface'"
        aria-haspopup="true"
        :aria-expanded="open === 'lists'"
        :disabled="disabled"
        @click="toggle('lists')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
        </svg>
        <span class="flex items-center gap-1.5 whitespace-nowrap max-lg:gap-1">清單<span v-if="inLists" class="font-num">{{ inLists }}</span></span>
      </button>
      <button
        ref="tripsBtn"
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 max-lg:h-tap max-lg:min-w-0 max-lg:flex-1 max-lg:basis-0 max-lg:flex-col max-lg:gap-0.5 max-lg:text-caption"
        :class="inTrips ? 'border-[1.5px] border-ink bg-surface font-bold text-ink' : 'border border-line bg-paper text-ink hover:bg-surface'"
        aria-haspopup="true"
        :aria-expanded="open === 'trips'"
        :disabled="disabled"
        @click="toggle('trips')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4" />
        </svg>
        <span class="flex items-center gap-1.5 whitespace-nowrap max-lg:gap-1">加入行程<span v-if="inTrips" class="font-num">{{ inTrips }}</span></span>
      </button>

      <!-- 行程選單：每個行程選「待排」或某一天後加入；最下面新增行程 -->
      <div
        v-if="open === 'trips'"
        data-reduce="fade"
        class="absolute right-0 bottom-full left-0 z-30 mb-2 flex max-h-[50dvh] max-lg:max-h-[min(50dvh,calc(60dvh-5rem))] origin-bottom animate-pop-up flex-col rounded-card bg-paper p-1.5 shadow-float"
        role="group"
        aria-label="加入行程"
      >
        <div class="scroll-quiet flex flex-col overflow-y-auto overscroll-contain">
          <template v-for="({ t }, i) in tripList" :key="t.id">
            <p v-if="i === firstDone" class="px-2.5 pt-2 pb-1 text-caption text-sub" :class="i > 0 ? 'mt-1 border-t border-line-soft' : ''">已結束</p>
            <div class="flex min-h-tap items-center gap-2 rounded-control px-2.5">
              <span class="flex min-w-0 flex-1 items-center gap-1.5 text-body-sm">
                <svg v-if="hasSpot(t, spot.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-label="已加入"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                <span class="truncate">{{ t.name || '未命名行程' }}</span>
              </span>
              <template v-if="hasSpot(t, spot.id)">
                <Dropdown
                  :model-value="placeKey(placesOf(t, spot.id)[0]!)"
                  :options="moveOptions(t, placesOf(t, spot.id)[0]!)"
                  :label="`在「${t.name || '未命名行程'}」的哪一天`"
                  size="sm"
                  @update:model-value="moveTo(t.id, placesOf(t, spot.id)[0]!, $event)"
                />
                <button
                  type="button"
                  class="h-9 shrink-0 rounded-control px-2.5 text-caption text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap"
                  @click="removeFrom(t.id, placesOf(t, spot.id)[0]!)"
                >
                  移除
                </button>
              </template>
              <template v-else>
                <Dropdown
                  :model-value="target[t.id] ?? ''"
                  :options="[{ value: '', label: '待排' }, ...t.days.map((_, i) => ({ value: String(i), label: dayLabel(t, i) }))]"
                  :label="`加入「${t.name || '未命名行程'}」的哪一天`"
                  size="sm"
                  @update:model-value="target = { ...target, [t.id]: $event }"
                />
                <button
                  type="button"
                  class="h-9 shrink-0 rounded-control border border-line bg-paper px-2.5 text-caption text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
                  @click="addTo(t.id)"
                >
                  加入
                </button>
              </template>
            </div>
            <template v-if="hasSpot(t, spot.id)">
              <div v-for="day in placesOf(t, spot.id).slice(1)" :key="day" class="flex min-h-tap items-center justify-end gap-2 rounded-control px-2.5">
                <Dropdown
                  :model-value="placeKey(day)"
                  :options="moveOptions(t, day)"
                  :label="`在「${t.name || '未命名行程'}」的哪一天`"
                  size="sm"
                  @update:model-value="moveTo(t.id, day, $event)"
                />
                <button
                  type="button"
                  class="h-9 shrink-0 rounded-control px-2.5 text-caption text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap"
                  @click="removeFrom(t.id, day)"
                >
                  移除
                </button>
              </div>
              <div v-if="againOptions(t).length" class="flex min-h-tap items-center justify-end gap-2 rounded-control px-2.5">
                <Dropdown
                  :model-value="target[t.id] ?? againOptions(t).at(-1)!.value"
                  :options="againOptions(t)"
                  :label="`再排進「${t.name || '未命名行程'}」的哪一天`"
                  size="sm"
                  @update:model-value="target = { ...target, [t.id]: $event }"
                />
                <button
                  type="button"
                  class="h-9 shrink-0 rounded-control border border-line bg-paper px-2.5 text-caption text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
                  @click="addTo(t.id, againOptions(t).at(-1)!.value)"
                >
                  再加入
                </button>
              </div>
            </template>
          </template>
        </div>
        <form class="mt-1 flex gap-1.5 border-t border-line-soft px-1 pt-2" @submit.prevent="addTrip">
          <input
            ref="tripInput"
            v-model="newTrip"
            type="text"
            :maxlength="TRIP_NAME_MAX"
            placeholder="新行程名稱"
            aria-label="新行程名稱"
            enterkeyhint="done"
            class="h-10 min-w-0 flex-1 rounded-control border border-line bg-paper px-2.5 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong pointer-coarse:h-tap"
          />
          <button
            type="submit"
            class="h-10 shrink-0 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
            :disabled="!newTrip.trim()"
          >
            新增
          </button>
        </form>
      </div>

      <!-- 清單選單：勾選加入或移出；最下面新增清單 -->
      <div
        v-if="open === 'lists'"
        data-reduce="fade"
        class="absolute right-0 bottom-full left-0 z-30 mb-2 flex max-h-[50dvh] max-lg:max-h-[min(50dvh,calc(60dvh-5rem))] origin-bottom animate-pop-up flex-col rounded-card bg-paper p-1.5 shadow-float"
        role="group"
        aria-label="加入清單"
      >
        <div class="scroll-quiet flex flex-col overflow-y-auto overscroll-contain">
          <label
            v-for="l in marks.lists"
            :key="l.id"
            class="flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-body-sm hover:bg-surface"
          >
            <input
              type="checkbox"
              class="size-4 accent-(--region-strong)"
              :checked="mark?.lists?.includes(l.id) ?? false"
              @change="marks.toggleInList(spot, l.id)"
            />
            <span class="min-w-0 truncate">{{ l.name }}</span>
          </label>
        </div>
        <form class="mt-1 flex gap-1.5 border-t border-line-soft px-1 pt-2" @submit.prevent="addList">
          <input
            ref="nameInput"
            v-model="newName"
            type="text"
            :maxlength="LIST_NAME_MAX"
            placeholder="新清單名稱"
            aria-label="新清單名稱"
            enterkeyhint="done"
            class="h-10 min-w-0 flex-1 rounded-control border border-line bg-paper px-2.5 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong pointer-coarse:h-tap"
          />
          <button
            type="submit"
            class="h-10 shrink-0 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
            :disabled="!newName.trim()"
          >
            新增
          </button>
        </form>
      </div>
    </div>

    <p v-if="marks.error" class="text-caption text-danger" role="alert">{{ marks.error }}</p>
  </div>
</template>
