<script setup lang="ts">
import type { MarkedSpot } from '../composables/markedSpots'
import { regionOf } from '../data/regions'
import RegionChip from './RegionChip.vue'
import SkeletonRows from './SkeletonRows.vue'
import VisitedToggle from './VisitedToggle.vue'

// 收藏、清單、去過的景點列：點了回到地圖選取這個景點。
// removeLabel 有值時右側放移除鈕；visitToggle 時右側放「去過」快捷鈕；
// selected 有值時左側是勾選框（紀錄頁批次補日期）。
defineProps<{
  rows: MarkedSpot[]
  loading?: boolean
  removeLabel?: string
  showDate?: boolean
  visitToggle?: boolean
  selected?: Set<string> | null
}>()
const emit = defineEmits<{ remove: [row: MarkedSpot]; toggle: [row: MarkedSpot] }>()
</script>

<template>
  <ul class="flex flex-col">
    <li v-for="r in rows" :key="r.id" class="flex items-center gap-1 border-b border-line-soft last:border-b-0">
      <label v-if="selected" class="grid size-tap shrink-0 cursor-pointer place-items-center">
        <input
          type="checkbox"
          class="size-4 accent-(--region-strong)"
          :checked="selected.has(r.id)"
          :aria-label="`選取：${r.name}`"
          @change="emit('toggle', r)"
        />
      </label>
      <RouterLink
        :to="{ path: `/map/${r.pref}`, query: { spot: r.id } }"
        class="flex min-h-tap min-w-0 flex-1 items-start gap-3 rounded-control px-2 py-2 text-ink no-underline hover:bg-surface active:bg-surface"
      >
        <RegionChip :pref="r.pref" :size="14" class="mt-0.5" />
        <span class="flex min-w-0 flex-col">
          <span v-if="r.kana" lang="ja" class="truncate text-caption tracking-kana text-sub" :title="r.kana">{{ r.kana }}</span>
          <span class="line-clamp-2 text-body-sm break-words">
            <span lang="ja" class="font-bold">{{ r.name }}</span>
            <span v-if="r.zh" class="ml-1.5 text-caption text-sub">{{ r.zh }}</span>
          </span>
        </span>
        <span class="ml-auto flex shrink-0 flex-col items-end text-caption text-sub">
          <span lang="ja">{{ regionOf(r.pref)?.name.ja }}</span>
          <template v-if="showDate">
            <span v-if="r.mark.visited_on" class="font-latin">{{ r.mark.visited_on }}</span>
            <span v-else>沒有日期</span>
          </template>
          <span v-if="r.missing">已不在目錄</span>
        </span>
      </RouterLink>
      <VisitedToggle v-if="visitToggle" :spot="{ id: r.id, pref: r.pref, name: r.name }" />
      <button
        v-if="removeLabel"
        type="button"
        :aria-label="`${removeLabel}：${r.name}`"
        class="grid size-tap shrink-0 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px"
        @click="emit('remove', r)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
    <li v-if="loading && !rows.length"><SkeletonRows :rows="3" /></li>
  </ul>
</template>
