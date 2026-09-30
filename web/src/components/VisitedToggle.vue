<script setup lang="ts">
import { computed } from 'vue'

import { useStampPress } from '../composables/stampPress'
import { type SpotRef, useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 清單列右側的「去過」快捷鈕（像按愛心）：只切換去過，日期之後在紀錄頁補（UX-FLOW.md E6）。
const props = defineProps<{ spot: SpotRef }>()
const marks = useMarksStore()
const userStore = useUserStore()
const on = computed(() => Boolean(marks.markOf(props.spot.id)?.visited))
// 按下去過時蓋章（DESIGN.md §9）
const { pressing, key: stampKey, arm } = useStampPress(() => on.value, () => props.spot.id)
function toggle() {
  arm()
  void marks.toggleVisited(props.spot)
}
</script>

<template>
  <button
    v-if="userStore.canSignIn"
    type="button"
    class="grid size-tap shrink-0 place-items-center rounded-control active:translate-y-px"
    :class="on ? 'text-visited' : 'text-line hover:bg-surface hover:text-sub'"
    :aria-pressed="on"
    :aria-label="`去過：${spot.name}`"
    :title="on ? '去過' : undefined"
    @click.stop="toggle"
  >
    <span v-if="on" :key="stampKey" class="grid size-5 place-items-center rounded-full" :class="pressing ? 'stamp-ring' : ''">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" :class="pressing ? 'animate-stamp-press' : ''">
        <circle cx="12" cy="12" r="9.5" fill="currentColor" />
        <path d="M8.3 12.3l2.5 2.5 4.9-5.1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
    </svg>
  </button>
</template>
