<script setup lang="ts">
import { computed } from 'vue'

import { NATIONAL_PATTERN, PATTERN_BY_AREA } from '../data/patterns'
import { regionOf } from '../data/regions'

// 海報區的裝飾圓（DESIGN.md §3.6、§7.5）：地區 accent 色的正圓，裡面是依地方分配的和風紋樣，
// 紋樣以地區 base 色畫出。不會動、不加漸層；純裝飾，對輔助技術隱藏。
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
  <span class="overflow-hidden rounded-full bg-region-accent" aria-hidden="true">
    <span class="wa-pattern absolute inset-0 bg-region" :class="CLASS[pattern.key]"></span>
  </span>
</template>
