<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { MarkedSpot } from '../composables/markedSpots'
import { regionOf } from '../data/regions'
import { spotRef } from '../stores/marks'
import RegionChip from './RegionChip.vue'
import SkeletonRows from './SkeletonRows.vue'
import VisitedToggle from './VisitedToggle.vue'

// 收藏、清單、去過的景點列：點了回到地圖選取這個景點。
// removeLabel 有值時右側放移除鈕；visitToggle 時右側放「去過」快捷鈕；兩個都有時中間隔一條線；
// selected 有值時整列是勾選框（紀錄頁批次補日期），點了選取，不回地圖。
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
      <!-- 批次選取時整列是勾選框的 label（點列不會離開頁面），選中的列底色 region-tint -->
      <component
        :is="selected ? 'label' : RouterLink"
        v-bind="selected ? {} : { to: { path: `/map/${r.pref}`, query: { spot: r.id } } }"
        class="flex min-h-tap min-w-0 flex-1 items-start gap-3 rounded-control px-2 py-2 text-ink no-underline"
        :class="[selected ? 'cursor-pointer' : '', selected?.has(r.id) ? 'bg-region-tint' : 'hover:bg-surface active:bg-surface']"
      >
        <span v-if="selected" class="-my-2 -ml-2 grid size-tap shrink-0 cursor-pointer place-items-center self-center">
          <input
            type="checkbox"
            class="size-4 cursor-pointer accent-(--region-strong)"
            :checked="selected.has(r.id)"
            :aria-label="`選取：${r.name}`"
            @change="emit('toggle', r)"
          />
        </span>
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
            <span v-if="r.mark.visited_on" class="font-num">{{ r.mark.visited_on }}</span>
            <span v-else>沒有日期</span>
          </template>
          <span v-if="r.missing">已不在目錄</span>
        </span>
      </component>
      <VisitedToggle v-if="visitToggle" :spot="spotRef(r.id, r.pref, r.name)" />
      <!-- 去過與移除之間隔開並加一條分隔線，不會一不小心點到移除（移除後底部可以復原） -->
      <span v-if="visitToggle && removeLabel" class="mx-1.5 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
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
