<script setup lang="ts">
import { computed, ref } from 'vue'

import { offlineReadyAt, type OfflineProgress, prepareOffline } from '../services/offline'
import type { Trip } from '../services/trip'
import { useCatalogStore } from '../stores/catalog'

// 行程頁的「離線用」：把這趟用得到的資料、照片、停留點附近的地圖先存到這台裝置（DESIGN.md §7.20）
const props = defineProps<{ trip: Trip }>()
const catalog = useCatalogStore()
const progress = ref<OfflineProgress | null>(null)
const readyAt = ref(offlineReadyAt(props.trip.id))
const failed = ref(false)
const percent = computed(() => (progress.value ? Math.floor((progress.value.done / Math.max(1, progress.value.total)) * 100) : 0))

async function run() {
  if (progress.value) return
  failed.value = false
  progress.value = { done: 0, total: 1 }
  try {
    await prepareOffline(props.trip, catalog, (p) => (progress.value = p))
    readyAt.value = offlineReadyAt(props.trip.id)
  } catch {
    failed.value = true
  } finally {
    progress.value = null
  }
}
</script>

<template>
  <button
    type="button"
    class="relative flex h-9 items-center gap-1.5 overflow-hidden rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-wait"
    :disabled="Boolean(progress)"
    :title="readyAt && !progress ? `${readyAt} 存到這台裝置` : undefined"
    @click="run"
  >
    <span
      v-if="progress"
      class="absolute inset-y-0 left-0 bg-region-tint transition-[width] duration-300"
      :style="{ width: `${percent}%` }"
      aria-hidden="true"
    ></span>
    <svg class="relative" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path v-if="readyAt && !progress" d="M5 12.5l4.5 4.5L19 7.5" />
      <path v-else d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </svg>
    <span class="relative">
      <template v-if="progress">離線用 <span class="font-latin">{{ percent }}%</span></template>
      <template v-else-if="failed">離線用（部分失敗）</template>
      <template v-else-if="readyAt">已存離線</template>
      <template v-else>離線用</template>
    </span>
  </button>
</template>
