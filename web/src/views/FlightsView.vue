<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BackLink from '../components/BackLink.vue'
import CollapseChevron from '../components/CollapseChevron.vue'
import DatePicker from '../components/DatePicker.vue'
import Dropdown from '../components/Dropdown.vue'
import { regions } from '../data/regions'
import {
  type FlightDirectory,
  type FlightOrigin,
  type FlightSchedule,
  type ScheduledFlight,
  fetchIndex,
  fetchFlightDirectory,
  fetchFlightSchedule,
} from '../services/bundles'

const route = useRoute()
const router = useRouter()
const origins: FlightOrigin[] = ['TPE', 'TSA', 'RMQ', 'KHH']
const areas = [...new Map(regions.map((r) => [r.area, r.area_name]))]
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date())
const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const directory = shallowRef<FlightDirectory>()
const schedules = shallowRef<Partial<Record<FlightOrigin, FlightSchedule>>>({})
const directoryError = ref(false)
const scheduleError = ref(false)

const options = computed(() => origins.filter((code) => directory.value?.[code]))
const hasArea = (code: FlightOrigin, area: string) =>
  Object.values(directory.value?.[code]?.destinations ?? {}).some((destination) => destination.area === area)
const origin = computed(() => {
  const requested = options.value.find((code) => code === route.query.from)
  const area = route.query.area
  return requested ?? options.value.find((code) => typeof area === 'string' && hasArea(code, area)) ?? options.value[0]
})
const originMeta = computed(() => origin.value ? directory.value?.[origin.value] : undefined)
const areaOptions = computed(() => areas.filter(([code]) => origin.value && hasArea(origin.value, code)))
const area = computed(() => areaOptions.value.find(([code]) => code === route.query.area)?.[0] ?? '')
const originChoices = computed(() =>
  options.value.map((code) => ({ value: code, label: `${directory.value![code]!.name} ${code}` })),
)
const areaChoices = computed(() => [
  { value: '', label: '全部地區' },
  ...areaOptions.value.map(([value, label]) => ({ value, label, lang: 'ja' })),
])
const destinations = computed(() =>
  Object.entries(originMeta.value?.destinations ?? {})
    .filter(([, destination]) => !area.value || destination.area === area.value)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'zh-Hant')),
)
const destination = computed(() =>
  destinations.value.find(([code]) => code === route.query.to)?.[0] ?? '',
)
const destinationChoices = computed(() => [
  { value: '', label: '全部航點' },
  ...destinations.value.map(([value, airport]) => ({ value, label: `${airport.name} ${value}` })),
])
const date = computed(() => {
  const value = route.query.date
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return today
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? today : value
})
const schedule = computed(() => origin.value ? schedules.value[origin.value] : undefined)
const coverage = computed(() => schedule.value?.coverage ?? [])
const weekly = computed(() => schedule.value?.origin === 'TSA')
const covered = computed(() => coverage.value.some(({ start, end }) => start <= date.value && date.value <= end))
const weekday = computed(() => new Date(date.value).getUTCDay() || 7)
const byDestination = computed(() => {
  const grouped: Record<string, ScheduledFlight[]> = {}
  for (const flight of schedule.value?.flights ?? []) {
    const flies = weekly.value ? flight.weekdays?.includes(weekday.value) : covered.value && flight.dates?.includes(date.value)
    if (flies) (grouped[flight.destination] ??= []).push(flight)
  }
  return grouped
})
const results = computed(() =>
  destinations.value
    .filter(([code]) => !destination.value || code === destination.value)
    .map(([code, airport]) => {
      const flights = byDestination.value[code] ?? []
      const count = new Set(flights.map((flight) => flight.number)).size
      return {
        code,
        name: airport.name,
        flights,
        count,
      }
    }),
)

function change(key: 'area' | 'from' | 'to' | 'date', value: string) {
  const query = { ...route.query, [key]: value || undefined }
  if (key === 'area') {
    query.from = origin.value
    const selected = originMeta.value?.destinations[destination.value]
    query.to = selected && (!value || selected.area === value) ? destination.value : undefined
  }
  if (key === 'from') {
    const next = options.value.find((code) => code === value)
    query.to = next && directory.value?.[next]?.destinations[destination.value] ? destination.value : undefined
    query.area = next && hasArea(next, area.value) ? area.value : undefined
  }
  void router.replace({ name: 'flights', query })
}

async function loadDirectory() {
  directoryError.value = false
  try {
    const index = await fetchIndex()
    if (!index.flight_routes) throw new Error('flight-routes')
    directory.value = await fetchFlightDirectory(index.flight_routes)
  } catch {
    directoryError.value = true
  }
}

async function loadSchedule(code: FlightOrigin) {
  const version = directory.value?.[code]?.version
  if (!version || schedules.value[code]) return
  scheduleError.value = false
  try {
    const loaded = await fetchFlightSchedule(code, version)
    schedules.value = { ...schedules.value, [code]: loaded }
  } catch {
    if (origin.value === code && !schedules.value[code]) scheduleError.value = true
  }
}

onMounted(() => void loadDirectory())
watch(origin, (code) => {
  scheduleError.value = false
  if (code) void loadSchedule(code)
})
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pt-7 pb-20 sm:px-6 sm:pt-9">
    <header class="flex flex-col gap-2">
      <BackLink to="/">探索</BackLink>
      <h1 class="text-h2 font-black tracking-title">直飛日本</h1>
      <p class="text-body-sm text-sub">定期出發班表 · 時刻皆為當地時間</p>
    </header>

    <p v-if="directoryError" class="text-body-sm" role="alert">
      班表載入失敗。<button type="button" class="font-bold underline active:text-ink" @click="loadDirectory">重試</button>
    </p>
    <p v-else-if="!directory" class="text-body-sm text-sub" role="status">載入航點中</p>
    <template v-else>
      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-3 gap-y-4 border-b border-line pb-4 sm:grid-cols-2 md:grid-cols-4" role="group" aria-label="航班篩選">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-caption font-bold text-sub" aria-hidden="true">出發機場</span>
          <Dropdown label="出發機場" :model-value="origin ?? ''" :options="originChoices" :disabled="!origin" class="min-w-0 pointer-coarse:h-tap" @update:model-value="change('from', $event)" />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-caption font-bold text-sub" aria-hidden="true">日本地區</span>
          <Dropdown label="日本地區" :model-value="area" :options="areaChoices" :disabled="!areaOptions.length" class="min-w-0 pointer-coarse:h-tap" @update:model-value="change('area', $event)" />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-caption font-bold text-sub" aria-hidden="true">抵達機場</span>
          <Dropdown label="抵達機場" :model-value="destination" :options="destinationChoices" :disabled="!destinations.length" class="min-w-0 pointer-coarse:h-tap" @update:model-value="change('to', $event)" />
        </div>
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-caption font-bold text-sub" aria-hidden="true">出發日期</span>
          <DatePicker label="出發日期" :model-value="date" :today="today" :clearable="false" align="end" class="min-w-0" @update:model-value="change('date', $event)" />
        </div>
      </div>

      <p v-if="!origin" class="text-body-sm text-sub" role="status">目前沒有收錄航點。</p>
      <template v-else>
        <div class="flex min-h-24 flex-col gap-1 text-body-sm text-sub sm:min-h-20" aria-live="polite">
          <p v-if="scheduleError" role="alert">
            班表載入失敗。<button type="button" class="font-bold underline active:text-ink" @click="loadSchedule(origin)">重試</button>
          </p>
          <p v-else-if="!schedule" role="status">載入航班中</p>
          <p v-else-if="weekly">松山機場提供每週班表，實際班次以機場公告為準。</p>
          <p v-else-if="!covered" class="font-bold text-ink">目前沒有這天的班表資料。</p>
          <p v-if="coverage.length">
            已收錄
            <span v-for="(span, i) in coverage" :key="span.start" class="inline-block font-num">
              {{ i ? '、' : '' }}{{ span.start }} – {{ span.end }}
            </span>
          </p>
          <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span v-if="schedule">班表更新 <time class="font-num" :datetime="schedule.updated_at">{{ schedule.updated_at }}</time></span>
            <a :href="originMeta?.source" target="_blank" rel="noopener noreferrer" class="underline decoration-line underline-offset-4 hover:decoration-ink">{{ originMeta?.name }}機場官方班表</a>
          </p>
        </div>
        <div class="flex flex-col divide-y divide-line border-y border-line" role="group" :aria-label="`${date} 航班查詢結果`" :aria-busy="!schedule && !scheduleError">
          <details v-for="result in results" :key="`${origin}-${result.code}`" :open="destination === result.code || undefined" class="group">
            <summary class="flex min-h-tap cursor-pointer list-none items-center gap-2.5 rounded-control px-2.5 py-2 hover:bg-surface active:bg-surface sm:px-3.5 [&::-webkit-details-marker]:hidden">
              <span class="w-9 shrink-0 font-latin text-body-sm font-bold text-region-strong">{{ result.code }}</span>
              <span class="text-body-sm font-bold sm:text-body">{{ result.name }}</span>
              <span v-if="schedule" class="ml-auto shrink-0 text-caption text-sub sm:text-body-sm">
                <template v-if="covered || weekly">
                  <span v-if="result.count" class="font-num">{{ result.count }} 班</span>
                  <template v-else>當日未列班次</template>
                </template>
                <template v-else>日期未收錄</template>
              </span>
              <CollapseChevron :open="false" class="text-sub group-open:-translate-y-[2px] group-open:rotate-45" :class="schedule ? '' : 'ml-auto'" />
            </summary>
            <p v-if="result.count !== result.flights.length" class="px-3.5 pt-2 text-caption text-sub">同一班號列有不同時刻，以航空公司公告為準。</p>
            <ul v-if="result.flights.length" class="divide-y divide-line-soft border-t border-line-soft">
              <li v-for="flight in result.flights" :key="`${flight.number}-${flight.departure}`" class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="font-num text-body font-bold">{{ flight.number }}</span>
                  <span class="text-body-sm text-sub">{{ flight.airline }}</span>
                </div>
                <div class="flex items-center gap-1.5 font-num text-body font-bold">
                  <span><span class="sr-only">出發 </span>{{ flight.departure }}</span><span aria-hidden="true" class="text-sub">→</span>
                  <span><span class="sr-only">抵達 </span>{{ flight.arrival ?? '未列' }}</span>
                </div>
                <p v-if="flight.weekdays?.length" class="col-span-2 text-caption text-sub">
                  {{ flight.weekdays.length === 7 ? '每天' : `每週${flight.weekdays.map((day) => weekDays[day - 1]).join('、')}` }}
                </p>
                <p v-if="flight.codeshares?.length" class="col-span-2 text-caption text-sub">共掛 {{ flight.codeshares.join('、') }}</p>
              </li>
            </ul>
            <p v-else-if="schedule" class="border-t border-line-soft px-3.5 py-2 text-body-sm text-sub">
              {{ covered || weekly ? '官方班表沒有列出這天的班次。' : '這天超出目前收錄的日期。' }}
            </p>
          </details>
        </div>
      </template>
    </template>
  </section>
</template>
