<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
const area = computed(() => areas.find(([code]) => code === route.query.area)?.[0] ?? '')
const originOptions = computed(() => options.value.filter((code) =>
  !area.value || Object.values(directory.value![code]!.destinations).some((d) => d.area === area.value),
))
const origin = computed(() =>
  originOptions.value.find((code) => code === route.query.from) ?? originOptions.value[0],
)
const originMeta = computed(() => origin.value ? directory.value?.[origin.value] : undefined)
const destinations = computed(() =>
  Object.entries(originMeta.value?.destinations ?? {})
    .filter(([, destination]) => !area.value || destination.area === area.value)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'zh-Hant')),
)
const destination = computed(() =>
  destinations.value.find(([code]) => code === route.query.to)?.[0] ?? '',
)
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
      return {
        code,
        name: airport.name,
        flights,
        alternateTimes: new Set(flights.map((flight) => flight.number)).size !== flights.length,
      }
    }),
)

function change(key: 'area' | 'from' | 'to' | 'date', event: Event) {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  const query = { ...route.query, [key]: value || undefined }
  if (key === 'area' || key === 'from') query.to = undefined
  if (key === 'area') query.from = undefined
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
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-7 pb-20 sm:px-6 sm:pt-9">
    <header class="flex flex-col gap-1">
      <h1 class="text-h2 font-black tracking-title">直飛日本</h1>
      <p class="text-body-sm text-sub">定期出發班表 · 時刻皆為當地時間</p>
    </header>

    <p v-if="directoryError" class="text-body-sm" role="alert">
      班表載入失敗。<button type="button" class="font-bold underline" @click="loadDirectory">重試</button>
    </p>
    <p v-else-if="!directory" class="text-body-sm text-sub" role="status">載入航點中</p>
    <template v-else>
      <div class="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface p-3 md:grid-cols-4 md:p-4">
        <label class="flex min-w-0 flex-col gap-1 text-body-sm font-bold">
          出發機場
          <select :value="origin ?? ''" :disabled="!originOptions.length" class="h-tap min-w-0 rounded-control border border-line bg-paper px-2 font-normal text-ink" @change="change('from', $event)">
            <option v-if="!originOptions.length" value="">無</option>
            <option v-for="code in originOptions" :key="code" :value="code">{{ directory[code]!.name }} {{ code }}</option>
          </select>
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-body-sm font-bold">
          日本地區
          <select :value="area" class="h-tap min-w-0 rounded-control border border-line bg-paper px-2 font-normal text-ink" @change="change('area', $event)">
            <option value="">全部地區</option>
            <option v-for="[code, name] in areas" :key="code" :value="code">{{ name }}</option>
          </select>
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-body-sm font-bold">
          抵達機場
          <select :value="destination" :disabled="!destinations.length" class="h-tap min-w-0 rounded-control border border-line bg-paper px-2 font-normal text-ink" @change="change('to', $event)">
            <option value="">全部航點</option>
            <option v-for="[code, airport] in destinations" :key="code" :value="code">{{ airport.name }} {{ code }}</option>
          </select>
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-body-sm font-bold">
          出發日期
          <input type="date" :value="date" required class="h-tap min-w-0 rounded-control border border-line bg-paper px-2 font-num font-normal text-ink" @change="change('date', $event)" />
        </label>
      </div>

      <p v-if="!origin" class="text-body-sm text-sub" role="status">目前的班表沒有飛往這個地區的航點。</p>
      <p v-else-if="scheduleError" class="text-body-sm" role="alert">
        這個機場的班表載入失敗。<button type="button" class="font-bold underline" @click="loadSchedule(origin)">重試</button>
      </p>
      <p v-else-if="!schedule" class="text-body-sm text-sub" role="status">載入航班中</p>
      <template v-else>
        <div class="flex flex-col gap-1 text-body-sm text-sub" aria-live="polite">
          <p v-if="weekly">松山機場提供每週班表。以下依所選日期的星期顯示，實際日期以機場公告為準。</p>
          <p v-else-if="!covered" class="font-bold text-ink">目前沒有這天的班表資料。</p>
          <p v-if="coverage.length">
            已收錄
            <span v-for="(span, i) in coverage" :key="span.start" class="inline-block font-num">
              {{ i ? '、' : '' }}{{ span.start }} – {{ span.end }}
            </span>
          </p>
          <p>
            班表更新 <time class="font-num" :datetime="schedule.updated_at">{{ schedule.updated_at }}</time> ·
            <a :href="originMeta?.source" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2">{{ originMeta?.name }}機場官方班表</a>
          </p>
        </div>
        <div class="flex flex-col gap-2" :aria-label="`${date} 航班查詢結果`">
          <details v-for="result in results" :key="`${origin}-${result.code}`" :open="destination === result.code || undefined" class="rounded-card border border-line bg-paper">
            <summary class="flex min-h-tap cursor-pointer list-none items-center gap-3 rounded-card px-3 py-2 hover:bg-surface sm:px-4 [&::-webkit-details-marker]:hidden">
              <span class="font-latin text-body-sm font-bold tracking-[.09em] text-region-strong">{{ result.code }}</span>
              <span class="text-body font-bold">{{ result.name }}</span>
              <span v-if="covered || weekly" class="ml-auto text-body-sm text-sub">
                {{ result.flights.length ? `${new Set(result.flights.map((f) => f.number)).size} 班` : '當日無列出班次' }}
              </span>
              <span v-else class="ml-auto text-body-sm text-sub">日期未收錄</span>
              <span aria-hidden="true" class="font-bold text-sub">⌄</span>
            </summary>
            <p v-if="result.alternateTimes" class="border-t border-line px-4 py-2 text-body-sm text-sub">同一班號在來源中有不同時刻，以航空公司公告為準。</p>
            <ul v-if="result.flights.length" class="divide-y divide-line border-t border-line">
              <li v-for="flight in result.flights" :key="`${flight.number}-${flight.departure}`" class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4">
                <div class="flex flex-wrap items-baseline gap-x-2">
                  <span class="font-latin text-body font-bold">{{ flight.number }}</span>
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
            <p v-else class="border-t border-line px-4 py-2 text-body-sm text-sub">
              {{ covered || weekly ? '官方班表沒有列出這天的班次。' : '這天超出目前收錄的日期。' }}
            </p>
          </details>
        </div>
      </template>
    </template>
  </section>
</template>
