<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { regionOf } from '../data/regions'
import type { MapSpot } from '../services/bundles'
import { type Band, BANDS, type Destination, foldName, kmLabel } from '../services/daytrip'
import { findStop, type Trip } from '../services/trip'
import { type SpotRef, spotRef } from '../stores/marks'
import { useCatalogStore } from '../stores/catalog'
import CollapseChevron from './CollapseChevron.vue'
import SkeletonRows from './SkeletonRows.vue'

// 單日來回（UX-FLOW.md C8，DESIGN.md §7.9c）：住的車站沿鐵路到得了的地方，分三段（60 km 內、60–150 km、新幹線），
// 一次看一段、依距離排序；也可以打地名、景點找。點一個地方展開它的景點，加到這一天或待排。
// 桌機在行程地圖左上的浮動面板裡（地圖畫出目的地），手機在下方的對話框裡（只有清單）。
const props = defineProps<{
  trip: Trip
  day: number
  list: Destination[]
  state: 'idle' | 'loading' | 'ready' | 'failed'
  /** 景點的最近車站 → 鐵路 km（到不了是 null） */
  kmTo: (st: string | null | undefined) => number | null
  band: Band
  /** 展開的地方（Destination.key） */
  selected: string | null
  /** 分段前面畫地圖上的記號（桌機有地圖時） */
  legend?: boolean
  locked?: boolean
}>()
const emit = defineEmits<{
  'update:band': [band: Band]
  'update:selected': [key: string | null]
  retry: []
  add: [spot: SpotRef, day: number | null]
}>()

const catalog = useCatalogStore()

const counts = computed(() => BANDS.map(({ band }) => props.list.filter((d) => d.band === band).length))

// 找地方：地名、區名、縣名、前幾名的景點；繁體字（金澤、靜岡）也找得到
const q = ref('')
function matches(d: Destination, text: string): boolean {
  const region = regionOf(d.pref)
  return [d.name, region?.name.ja, region?.name.zh_tw, ...d.spots.map((s) => s.name), ...Object.values(d.areaNames)].some(
    (s) => s && foldName(s).includes(text),
  )
}
const shown = computed(() => {
  const text = foldName(q.value.trim())
  return text ? props.list.filter((d) => matches(d, text)) : props.list.filter((d) => d.band === props.band)
})

// 展開的地方：那一縣的景點（地圖 bundle）裡屬於這幾區的，依分數；先列 8 個
const SHOW = 8
const showAll = ref(false)
const open = computed(() => props.list.find((d) => d.key === props.selected) ?? null)
watch(
  open,
  (d) => {
    showAll.value = false
    if (d) void catalog.loadMap(d.pref).catch(() => {})
  },
  { immediate: true },
)
interface Row {
  id: string
  name: string
  zh?: string
  kind?: string
  area?: string
  st: string | null
}
const spots = computed<Row[]>(() => {
  const d = open.value
  if (!d) return []
  const all = catalog.mapSpots[d.pref]
  // 地圖 bundle 還沒到：先列 daytrip.json 裡的前幾名
  if (!all) return d.spots.map((s) => ({ id: s.id, name: s.name, area: d.codes.length > 1 ? s.area : undefined, st: s.st }))
  const many = d.codes.length > 1
  return all
    .filter((s: MapSpot) => s.m && s.m in d.areaNames)
    .sort((a, b) => b.s - a.s)
    .map((s) => ({ id: s.id, name: s.n, zh: s.z && s.z !== s.n ? s.z : undefined, kind: s.c, area: many ? d.areaNames[s.m!] : undefined, st: s.st ?? null }))
})
const visible = computed(() => (showAll.value ? spots.value : spots.value.slice(0, SHOW)))

function toggle(d: Destination) {
  emit('update:selected', props.selected === d.key ? null : d.key)
}

/** 這個景點在這趟的哪裡：DAY n、待排；還沒加是 null */
function placeOf(id: string): string | null {
  const at = findStop(props.trip, id)
  if (!at) return null
  return at.day === -1 ? '待排' : `DAY ${at.day + 1}`
}

function add(d: Destination, r: Row, day: number | null) {
  emit('add', spotRef(r.id, d.pref, r.name), day)
}

// 地圖上點了地方：換到它的分段、捲到那一列
const root = ref<HTMLElement | null>(null)
watch(
  () => props.selected,
  async (key) => {
    if (!key) return
    await nextTick()
    root.value?.querySelector<HTMLElement>(`[data-dest="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest' })
  },
)
</script>

<template>
  <div ref="root" class="flex flex-col">
    <div class="flex border-b border-line" role="group" aria-label="距離">
      <button
        v-for="(b, i) in BANDS"
        :key="b.band"
        type="button"
        class="-mb-px flex min-h-tap flex-1 items-center justify-center gap-1.5 border-b-3 px-1 text-body-sm active:text-ink"
        :class="!q.trim() && band === b.band ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink'"
        :aria-pressed="!q.trim() && band === b.band"
        @click="((q = ''), emit('update:band', b.band))"
      >
        <!-- 地圖上的記號：60 km 內強調色實心、60–150 km 淺色、新幹線白底雙圈 -->
        <span
          v-if="legend"
          class="relative grid size-2.5 shrink-0 place-items-center rounded-full"
          :class="b.band === 0 ? 'bg-region-strong' : b.band === 1 ? 'border-[1.5px] border-region-strong bg-region' : 'border-[1.5px] border-ink bg-paper'"
          aria-hidden="true"
        ><span v-if="b.band === 2" class="size-1 rounded-full bg-ink"></span></span>
        <span class="whitespace-nowrap">{{ b.label }}</span>
        <span class="font-num text-caption font-normal text-sub">{{ counts[i] }}</span>
      </button>
    </div>
    <input
      v-model="q"
      type="search"
      placeholder="地名、景點"
      aria-label="找地方"
      enterkeyhint="search"
      class="mt-3 mb-1 h-10 w-full rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong pointer-coarse:h-tap"
    />

    <SkeletonRows v-if="state === 'loading' || state === 'idle'" :rows="4" />
    <p v-else-if="state === 'failed'" class="flex items-center gap-3 py-6 text-body-sm text-sub">
      讀不到鐵路資料
      <button type="button" class="min-h-tap rounded-control px-2 font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px" @click="emit('retry')">重試</button>
    </p>
    <p v-else-if="!shown.length" class="py-6 text-center text-body-sm text-sub">{{ q.trim() ? '找不到' : '沒有收錄的地方' }}</p>
    <ul v-else class="flex flex-col">
      <li v-for="d in shown" :key="d.key" :data-dest="d.key" class="border-b border-line-soft last:border-b-0">
        <button
          type="button"
          class="flex min-h-tap w-full items-start gap-2.5 rounded-control px-2 py-2.5 text-left text-ink"
          :class="selected === d.key ? 'bg-region-tint' : 'hover:bg-surface active:bg-surface'"
          :aria-expanded="selected === d.key"
          @click="toggle(d)"
        >
          <span class="mt-1.5 text-sub"><CollapseChevron :open="selected === d.key" /></span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex min-w-0 items-baseline gap-1.5">
              <span lang="ja" class="truncate text-body-sm font-bold">{{ d.name }}</span>
              <span lang="ja" class="shrink-0 text-caption text-sub">{{ regionOf(d.pref)?.name.ja }}</span>
            </span>
            <span lang="ja" class="truncate text-caption text-sub">{{ d.spots.map((s) => s.name).join('・') }}</span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-0.5 pt-px">
            <span class="text-body-sm whitespace-nowrap">鐵路約 <span class="font-num">{{ kmLabel(d.km) }}</span> km</span>
            <span v-if="d.shinkansen && (q.trim() || d.band !== 2)" class="rounded-tag bg-ink px-1 text-micro font-bold text-paper">新幹線</span>
          </span>
        </button>
        <!-- 展開：這個地方的景點，加到這一天或待排 -->
        <div v-if="selected === d.key" class="pb-2 pl-6">
          <ul class="flex flex-col">
            <li v-for="r in visible" :key="r.id" class="flex min-h-tap items-center gap-2 border-t border-line-soft py-1.5 pl-1">
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-body-sm">
                  <span lang="ja" class="font-bold">{{ r.name }}</span>
                  <span v-if="r.zh" class="ml-1.5 text-caption text-sub">{{ r.zh }}</span>
                </span>
                <span class="truncate text-caption text-sub">
                  <template v-if="r.kind">{{ r.kind }}</template>
                  <template v-if="r.area"><template v-if="r.kind">・</template><span lang="ja">{{ r.area }}</span></template>
                  <template v-if="kmTo(r.st) !== null"><template v-if="r.kind || r.area">・</template>鐵路約 <span class="font-num">{{ kmLabel(kmTo(r.st)!) }}</span> km</template>
                </span>
              </span>
              <span v-if="placeOf(r.id)" class="shrink-0 rounded-tag bg-surface px-1.5 text-caption text-sub">已在 {{ placeOf(r.id) }}</span>
              <template v-else>
                <button
                  type="button"
                  class="h-8 shrink-0 rounded-control px-2 text-body-sm text-sub hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
                  :disabled="locked"
                  :aria-label="`加到待排：${r.name}`"
                  @click="add(d, r, null)"
                >
                  待排
                </button>
                <button
                  type="button"
                  class="flex h-8 shrink-0 items-center gap-1 rounded-control border border-line bg-paper pr-2.5 pl-2 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
                  :disabled="locked"
                  :aria-label="`加到 DAY ${day + 1}：${r.name}`"
                  @click="add(d, r, day)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  <span class="font-latin font-bold">DAY {{ day + 1 }}</span>
                </button>
              </template>
            </li>
          </ul>
          <button
            v-if="spots.length > SHOW && !showAll"
            type="button"
            class="mt-1 min-h-tap rounded-control px-2 text-body-sm font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px"
            @click="showAll = true"
          >
            全部 <span class="font-num">{{ spots.length }}</span> 個
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
