<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { addMonths, clampDate, monthCells, monthOf, spokenDate, weekday, WEEKDAYS } from '../services/calendar'
import { addDays } from '../services/trip'
import { todayIso } from '../services/userdb'

// 月曆面板（DatePicker、DateRangePicker 共用）：日 → 月 → 年三層，點標題往上一層。
// 星期日紅字、星期六藍字（日本月曆的習慣）。鍵盤：方向鍵移動、PageUp/PageDown 換月（加 Shift 換年）、Enter 選取。
// range 模式：start 有值而 end 沒有時，滑過的日期預覽區間。
const props = defineProps<{
  value?: string
  start?: string
  end?: string
  range?: boolean
  min?: string
  max?: string
  /** 還沒選日期時先打開的那一天所在的月（例：補登旅行開在上個月）；預設今天 */
  initial?: string
}>()
const emit = defineEmits<{ pick: [date: string] }>()

const today = todayIso()
const initial = clampDate(props.value || props.end || props.start || props.initial || today, props.min, props.max)
const view = ref<'days' | 'months' | 'years'>('days')
const month = ref(monthOf(initial))
/** 鍵盤焦點所在的日期 */
const active = ref(initial)
const hover = ref<string | null>(null)
const grid = ref<HTMLElement | null>(null)

const year = computed(() => Number(month.value.slice(0, 4)))
const cells = computed(() => monthCells(month.value))
const title = computed(() => `${year.value}年${Number(month.value.slice(5))}月`)
const decade = computed(() => Math.floor(year.value / 12) * 12)

const disabled = (d: string) => Boolean((props.min && d < props.min) || (props.max && d > props.max))
const monthDisabled = (ym: string) =>
  Boolean((props.min && ym < monthOf(props.min)) || (props.max && ym > monthOf(props.max)))
const yearDisabled = (y: number) =>
  Boolean((props.min && y < Number(props.min.slice(0, 4))) || (props.max && y > Number(props.max.slice(0, 4))))

// 區間：已選好的，或選了出發、滑過回程時的預覽
const band = computed<[string, string] | null>(() => {
  if (!props.range || !props.start) return null
  const e = props.end || (hover.value && hover.value >= props.start ? hover.value : null)
  return e ? [props.start, e] : null
})
function isEdge(d: string): boolean {
  return props.range ? d === props.start || d === (band.value?.[1] ?? '') : d === props.value
}
function inBand(d: string): boolean {
  return Boolean(band.value && d >= band.value[0] && d <= band.value[1] && band.value[0] !== band.value[1])
}
function bandClass(d: string): string {
  if (!inBand(d)) return ''
  const b = band.value!
  const col = weekday(d)
  const left = d === b[0] || col === 0
  const right = d === b[1] || col === 6
  return ['bg-region-tint', left ? 'rounded-l-control' : '', right ? 'rounded-r-control' : ''].join(' ')
}
function dayClass(d: string): string {
  if (disabled(d)) return 'cursor-not-allowed text-line'
  if (isEdge(d)) return 'bg-region-strong font-bold text-white'
  const out = d.slice(0, 7) !== month.value
  const col = weekday(d)
  const tone = out ? 'text-sub/50' : col === 0 ? 'text-danger' : col === 6 ? 'text-visited' : 'text-ink'
  return `${tone} hover:bg-surface`
}

function pick(d: string) {
  if (disabled(d)) return
  active.value = d
  emit('pick', d)
}

async function focusActive() {
  await nextTick()
  grid.value?.querySelector<HTMLElement>(`[data-date="${active.value}"]`)?.focus({ preventScroll: true })
}

function moveActive(d: string) {
  active.value = clampDate(d, props.min, props.max)
  if (monthOf(active.value) !== month.value) month.value = monthOf(active.value)
  void focusActive()
}

function onGridKey(e: KeyboardEvent) {
  const a = active.value
  const shift: Record<string, () => string> = {
    ArrowLeft: () => addDays(a, -1),
    ArrowRight: () => addDays(a, 1),
    ArrowUp: () => addDays(a, -7),
    ArrowDown: () => addDays(a, 7),
    Home: () => addDays(a, -weekday(a)),
    End: () => addDays(a, 6 - weekday(a)),
    PageUp: () => shiftMonth(a, e.shiftKey ? -12 : -1),
    PageDown: () => shiftMonth(a, e.shiftKey ? 12 : 1),
  }
  const f = shift[e.key]
  if (!f) return
  e.preventDefault()
  moveActive(f())
}

/** 換月時保留日；該月沒有那一天（例 31 日）就用月底 */
function shiftMonth(d: string, n: number): string {
  const ym = addMonths(monthOf(d), n)
  const last = addDays(`${addMonths(ym, 1)}-01`, -1)
  const day = `${ym}-${d.slice(8)}`
  return day > last ? last : day
}

function go(n: number) {
  if (view.value === 'days') month.value = addMonths(month.value, n)
  else if (view.value === 'months') month.value = addMonths(month.value, n * 12)
  else month.value = addMonths(month.value, n * 144)
}
function up() {
  view.value = view.value === 'days' ? 'months' : 'years'
}
function pickMonth(m: number) {
  month.value = `${year.value}-${String(m).padStart(2, '0')}`
  view.value = 'days'
  if (monthOf(active.value) !== month.value) active.value = clampDate(`${month.value}-01`, props.min, props.max)
  void focusActive()
}
function pickYear(y: number) {
  month.value = `${y}-${month.value.slice(5)}`
  view.value = 'months'
}

const prevDisabled = computed(() => {
  if (!props.min) return false
  if (view.value === 'days') return month.value <= monthOf(props.min)
  if (view.value === 'months') return year.value <= Number(props.min.slice(0, 4))
  return decade.value <= Number(props.min.slice(0, 4))
})
const nextDisabled = computed(() => {
  if (!props.max) return false
  if (view.value === 'days') return month.value >= monthOf(props.max)
  if (view.value === 'months') return year.value >= Number(props.max.slice(0, 4))
  return decade.value + 11 >= Number(props.max.slice(0, 4))
})

watch(
  () => props.value,
  (v) => {
    if (v) {
      active.value = v
      month.value = monthOf(v)
    }
  },
)

onMounted(() => void focusActive())
defineExpose({ focus: focusActive })
</script>

<template>
  <div class="flex w-[304px] flex-col gap-2 rounded-card bg-paper p-3 text-ink shadow-float">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="grid size-9 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:size-tap"
        :disabled="prevDisabled"
        :aria-label="view === 'days' ? '上個月' : view === 'months' ? '前一年' : '前 12 年'"
        @click="go(-1)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <button
        type="button"
        class="flex h-9 flex-1 items-center justify-center gap-1 rounded-control font-latin text-body font-bold hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent active:not-disabled:translate-y-px pointer-coarse:h-tap"
        :disabled="view === 'years'"
        :aria-label="view === 'days' ? `${title}，選月份` : view === 'months' ? `${year}年，選年份` : undefined"
        aria-live="polite"
        @click="up"
      >
        <template v-if="view === 'days'">{{ title }}</template>
        <template v-else-if="view === 'months'">{{ year }}年</template>
        <template v-else>{{ decade }}–{{ decade + 11 }}</template>
        <svg v-if="view !== 'years'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="text-sub" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:size-tap"
        :disabled="nextDisabled"
        :aria-label="view === 'days' ? '下個月' : view === 'months' ? '後一年' : '後 12 年'"
        @click="go(1)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>

    <div v-if="view === 'days'" ref="grid" role="grid" :aria-label="title" @keydown="onGridKey" @mouseleave="hover = null">
      <div class="grid grid-cols-7 pb-1" role="row">
        <span
          v-for="(w, i) in WEEKDAYS"
          :key="w"
          role="columnheader"
          class="grid h-7 place-items-center text-caption"
          :class="i === 0 ? 'text-danger' : i === 6 ? 'text-visited' : 'text-sub'"
        >{{ w }}</span>
      </div>
      <div class="grid grid-cols-7 gap-y-0.5">
        <div v-for="d in cells" :key="d" role="gridcell" class="relative" :class="bandClass(d)">
          <button
            type="button"
            :data-date="d"
            :tabindex="d === active ? 0 : -1"
            :aria-label="spokenDate(d)"
            :aria-pressed="isEdge(d)"
            :aria-current="d === today ? 'date' : undefined"
            :aria-disabled="disabled(d) || undefined"
            class="relative mx-auto grid size-10 place-items-center rounded-control font-latin text-body-sm active:not-disabled:translate-y-px"
            :class="dayClass(d)"
            @click="pick(d)"
            @mouseenter="hover = d"
            @focus="active = d"
          >
            {{ Number(d.slice(8)) }}
            <span
              v-if="d === today"
              class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full"
              :class="isEdge(d) ? 'bg-white' : 'bg-region-strong'"
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="view === 'months'" class="grid grid-cols-3 gap-1.5">
      <button
        v-for="m in 12"
        :key="m"
        type="button"
        class="h-12 rounded-control text-body-sm disabled:cursor-not-allowed disabled:text-line active:not-disabled:translate-y-px"
        :class="
          `${year}-${String(m).padStart(2, '0')}` === monthOf(value || end || start || '')
            ? 'bg-region-strong font-bold text-white'
            : 'hover:bg-surface'
        "
        :disabled="monthDisabled(`${year}-${String(m).padStart(2, '0')}`)"
        @click="pickMonth(m)"
      >
        <span class="font-latin">{{ m }}</span>月
      </button>
    </div>

    <div v-else class="grid grid-cols-3 gap-1.5">
      <button
        v-for="y in 12"
        :key="y"
        type="button"
        class="h-12 rounded-control font-latin text-body-sm disabled:cursor-not-allowed disabled:text-line active:not-disabled:translate-y-px"
        :class="decade + y - 1 === year ? 'bg-region-strong font-bold text-white' : 'hover:bg-surface'"
        :disabled="yearDisabled(decade + y - 1)"
        @click="pickYear(decade + y - 1)"
      >
        {{ decade + y - 1 }}
      </button>
    </div>

    <slot name="footer" />
  </div>
</template>
