<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { useStampPress } from '../composables/stampPress'
import { dayDate, hasSpot, shortDate, TRIP_NAME_MAX, tripStatus } from '../services/trip'
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

// 按下去過時蓋章、按下收藏時星星彈一下（DESIGN.md §9）
const { pressing, key: stampKey, arm } = useStampPress(() => Boolean(mark.value?.visited), () => props.spot.id)
watch(pressing, (p) => {
  if (p) emit('stamped')
})
function toggleVisited() {
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

function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = null
}
watch(open, (o) => {
  if (o) document.addEventListener('pointerdown', onPointerDown)
  else document.removeEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
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
  if (which === 'trips' && !openTrips.value.length) tripInput.value?.focus()
}

// 加入行程（UX-FLOW.md C2）：還沒結束的行程；選「待排」或某一天
const openTrips = computed(() => trips.sorted.filter((t) => tripStatus(t, todayIso()) !== 'done'))
const inTrips = computed(() => openTrips.value.filter((t) => hasSpot(t, props.spot.id)).length)
const target = ref<Record<string, string>>({})
function dayLabel(t: (typeof openTrips.value)[number], i: number): string {
  const d = dayDate(t, i)
  return `DAY ${i + 1}${d ? `　${shortDate(d)}` : ''}`
}
async function addTo(tripId: string) {
  const v = target.value[tripId] ?? ''
  await trips.addStop(tripId, props.spot, v === '' ? null : Number(v))
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
  const d = mark.value?.visited_on
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return y === Number(today.slice(0, 4)) ? `${m}/${day}` : `${y}/${m}/${day}`
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div ref="root" class="relative grid grid-cols-2 gap-2">
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
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
      <!-- 去過：標了之後右半邊是日期（點開月曆補填） -->
      <div
        class="flex h-11 overflow-hidden rounded-control text-body-sm"
        :class="
          mark?.visited
            ? 'border-[1.5px] border-visited bg-visited-tint font-bold text-visited'
            : 'border border-line bg-paper text-ink'
        "
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center justify-center gap-1.5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          :class="mark?.visited ? '' : 'hover:bg-surface'"
          :aria-pressed="Boolean(mark?.visited)"
          :disabled="disabled"
          @click="toggleVisited"
        >
          <span v-if="mark?.visited" :key="stampKey" class="grid size-4 place-items-center rounded-full" :class="pressing ? 'stamp-ring' : ''">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" :class="pressing ? 'animate-stamp-press' : ''">
              <circle cx="12" cy="12" r="9.5" fill="currentColor" />
              <path d="M8.3 12.3l2.5 2.5 4.9-5.1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
          </svg>
          去過
        </button>
        <DatePicker
          v-if="mark?.visited"
          bare
          align="end"
          label="去過日期"
          :model-value="mark.visited_on ?? ''"
          :max="today"
          class="flex shrink-0 items-center gap-1 border-l border-visited/30 px-2.5 font-latin text-label font-normal hover:bg-visited/10"
          @update:model-value="marks.setVisitedOn(spot, $event)"
        >
          <template #default>
            <span v-if="mark.visited_on">{{ visitedShort }}</span>
            <span v-else class="font-sans">日期</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </template>
        </DatePicker>
      </div>
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :class="inLists ? 'border-[1.5px] border-ink bg-surface font-bold text-ink' : 'border border-line bg-paper text-ink hover:bg-surface'"
        aria-haspopup="true"
        :aria-expanded="open === 'lists'"
        :disabled="disabled"
        @click="toggle('lists')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
        </svg>
        清單<span v-if="inLists" class="font-latin">{{ inLists }}</span>
      </button>
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :class="inTrips ? 'border-[1.5px] border-ink bg-surface font-bold text-ink' : 'border border-line bg-paper text-ink hover:bg-surface'"
        aria-haspopup="true"
        :aria-expanded="open === 'trips'"
        :disabled="disabled"
        @click="toggle('trips')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4" />
        </svg>
        加入行程<span v-if="inTrips" class="font-latin">{{ inTrips }}</span>
      </button>

      <!-- 行程選單：每個行程選「待排」或某一天後加入；最下面新增行程 -->
      <div
        v-if="open === 'trips'"
        class="absolute right-0 bottom-full left-0 z-30 mb-2 flex max-h-[50dvh] origin-bottom animate-pop-up flex-col rounded-card bg-paper p-1.5 shadow-float"
        role="group"
        aria-label="加入行程"
      >
        <div class="scroll-quiet flex flex-col overflow-y-auto">
          <div v-for="t in openTrips" :key="t.id" class="flex min-h-tap items-center gap-2 rounded-control px-2.5">
            <span class="min-w-0 flex-1 truncate text-body-sm">{{ t.name || '未命名行程' }}</span>
            <template v-if="hasSpot(t, spot.id)">
              <span class="shrink-0 text-caption text-sub">已加入</span>
            </template>
            <template v-else>
              <select
                :value="target[t.id] ?? ''"
                :aria-label="`加入「${t.name || '未命名行程'}」的哪一天`"
                class="h-9 shrink-0 rounded-control border border-line bg-paper px-1.5 text-caption text-ink"
                @change="target = { ...target, [t.id]: ($event.target as HTMLSelectElement).value }"
              >
                <option value="">待排</option>
                <option v-for="(_, i) in t.days" :key="i" :value="String(i)">{{ dayLabel(t, i) }}</option>
              </select>
              <button
                type="button"
                class="h-9 shrink-0 rounded-control border border-line bg-paper px-2.5 text-caption text-ink hover:bg-surface"
                @click="addTo(t.id)"
              >
                加入
              </button>
            </template>
          </div>
        </div>
        <form class="mt-1 flex gap-1.5 border-t border-line-soft px-1 pt-2" @submit.prevent="addTrip">
          <input
            ref="tripInput"
            v-model="newTrip"
            type="text"
            :maxlength="TRIP_NAME_MAX"
            placeholder="新行程名稱"
            aria-label="新行程名稱"
            class="h-10 min-w-0 flex-1 rounded-control border border-line bg-paper px-2.5 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
          />
          <button
            type="submit"
            class="h-10 shrink-0 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!newTrip.trim()"
          >
            新增
          </button>
        </form>
      </div>

      <!-- 清單選單：勾選加入或移出；最下面新增清單 -->
      <div
        v-if="open === 'lists'"
        class="absolute right-0 bottom-full left-0 z-30 mb-2 flex max-h-[50dvh] origin-bottom animate-pop-up flex-col rounded-card bg-paper p-1.5 shadow-float"
        role="group"
        aria-label="加入清單"
      >
        <div class="scroll-quiet flex flex-col overflow-y-auto">
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
            class="h-10 min-w-0 flex-1 rounded-control border border-line bg-paper px-2.5 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
          />
          <button
            type="submit"
            class="h-10 shrink-0 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
