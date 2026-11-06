<script setup lang="ts">
import { computed } from 'vue'

import { NATIONAL_PATTERN, PATTERN_BY_AREA } from '../data/patterns'
import { regionOf } from '../data/regions'

// 沒有照片時的照片框：地區淡色底＋依地方分配的和風紋樣（同 RegionMotif），讓卡片高度一致。純裝飾。
const props = defineProps<{ pref?: string | null }>()
const pattern = computed(() => {
  const area = props.pref ? regionOf(props.pref)?.area : undefined
  return (area && PATTERN_BY_AREA[area]) || NATIONAL_PATTERN
})
// Tailwind 需要看到完整的 class 名稱
const CLASS: Record<string, string> = {
  seigaiha: 'wa-seigaiha',
  asanoha: 'wa-asanoha',
  kikko: 'wa-kikko',
  ichimatsu: 'wa-ichimatsu',
  uroko: 'wa-uroko',
  shippo: 'wa-shippo',
  yagasuri: 'wa-yagasuri',
  hishi: 'wa-hishi',
}
</script>

<template>
  <span class="absolute inset-0 bg-region-tint" aria-hidden="true">
    <span class="wa-pattern absolute inset-0 bg-region-accent" :class="CLASS[pattern.key]"></span>
  </span>
</template>
