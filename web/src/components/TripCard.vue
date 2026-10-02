<script setup lang="ts">
import { computed } from 'vue'

import { regionOf } from '../data/regions'
import { allStops, dayPref, daysUntil, shortDate, type Trip, tripPrefs, tripStatus } from '../services/trip'
import { todayIso } from '../services/userdb'
import MemberAvatar from './MemberAvatar.vue'
import SplitFlap from './SplitFlap.vue'

// 行程卡片（/trips、/log）：封面是經過的縣的分段色帶（UX-FLOW.md §2.4），下面是名稱、日期、天數、地點數。
const props = defineProps<{ trip: Trip }>()

const prefs = computed(() => tripPrefs(props.trip))
const status = computed(() => tripStatus(props.trip, todayIso()))
const dates = computed(() => {
  const { start_date: s, end_date: e } = props.trip
  if (!s) return ''
  return e && e !== s ? `${shortDate(s)} – ${shortDate(e)}` : shortDate(s)
})
// 出發倒數：發車標的翻牌
const until = computed(() => (status.value === 'planning' ? daysUntil(props.trip, todayIso()) : null))
const count = computed(() => allStops(props.trip).length)
const band = computed(() => {
  const w = new Map<string, number>()
  for (const d of props.trip.days) {
    const p = dayPref(d)
    if (p) w.set(p, (w.get(p) ?? 0) + 1)
  }
  // 還沒排進天數的縣（只在待排）也給一小段
  for (const p of prefs.value) if (!w.has(p)) w.set(p, 0.5)
  return [...w.entries()].map(([pref, weight]) => ({ pref, weight }))
})
</script>

<template>
  <RouterLink
    :to="`/trips/${trip.id}`"
    class="flex flex-col overflow-hidden rounded-card border border-line bg-paper text-ink no-underline hover:bg-surface"
  >
    <!-- 分段色帶（DESIGN.md §7.9）：每個縣一段，長度依那個縣的天數 -->
    <span class="flex h-2.5 w-full bg-placeholder" aria-hidden="true">
      <span v-for="b in band" :key="b.pref" :data-pref="b.pref" class="h-full bg-region" :style="{ flexGrow: b.weight }"></span>
    </span>
    <span class="flex flex-col gap-1 px-4 pt-3 pb-4">
      <span class="flex items-baseline gap-2">
        <span class="min-w-0 truncate text-body font-bold">{{ trip.name || '未命名行程' }}</span>
        <span v-if="status === 'ongoing'" class="shrink-0 rounded-tag bg-region-strong px-1.5 text-caption font-bold text-white">旅途中</span>
        <span v-else-if="until !== null" class="ml-auto flex shrink-0 items-center gap-1 text-caption text-sub">
          還有<SplitFlap :value="String(until)" class="text-body" />天
        </span>
      </span>
      <span class="flex flex-wrap gap-x-3 text-caption text-sub">
        <span v-if="dates" class="font-latin">{{ dates }}</span>
        <span>{{ trip.days.length }} 天</span>
        <span>{{ count }} 個地點</span>
      </span>
      <span v-if="prefs.length" lang="ja" class="truncate text-caption text-sub">{{ prefs.map((p) => regionOf(p)?.name.ja).join('・') }}</span>
      <!-- 共編：成員頭像 -->
      <span v-if="trip.members.length > 1" class="mt-1 flex items-center gap-2 text-caption text-sub">
        <span class="flex -space-x-1.5">
          <MemberAvatar v-for="m in trip.members.slice(0, 5)" :key="m" :member="trip.member_info[m]" :size="20" class="ring-2 ring-paper" />
        </span>
        共編 <span class="font-latin">{{ trip.members.length }}</span> 人
      </span>
    </span>
  </RouterLink>
</template>
