<script setup lang="ts">
import { computed } from 'vue'

import { regionOf } from '../data/regions'
import { useExploreStore } from '../stores/explore'

// 「只看○○」（UX-FLOW.md §1.3）：開著是專心模式（地圖鎖在這個縣、只畫這個縣的點），
// 關掉可以拖到別縣、縣跟著地圖換。桌機在地圖上方的列、手機在 chip 軌道最前面；樣式和「收藏」同一套膠囊
const props = defineProps<{ pref: string; pill: string }>()
const explore = useExploreStore()
const name = computed(() => regionOf(props.pref)?.name.ja ?? '')
</script>

<template>
  <span :class="[pill, explore.focusLock ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-surface']">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path v-if="explore.focusLock" d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path v-else d="M8 11V8a4 4 0 0 1 7.6-1.7" />
    </svg>
    <span>只看{{ name }}</span>
  </span>
</template>
