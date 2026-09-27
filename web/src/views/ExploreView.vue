<script setup lang="ts">
import { watch } from 'vue'

import MapView from '../components/MapView.vue'
import { useExploreStore } from '../stores/explore'

const props = defineProps<{ pref?: string }>()
const explore = useExploreStore()

// /map/:pref 進來時整頁切成該縣的地區色；其他探索路由用全國色（UX-FLOW.md §1.3）。
watch(
  () => props.pref,
  (pref) => explore.setActivePref(pref ?? null),
  { immediate: true },
)
</script>

<template>
  <div class="relative flex-1 min-h-0">
    <MapView />
  </div>
</template>
