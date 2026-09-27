<script setup lang="ts">
import { computed } from 'vue'

import { regionOf } from '../data/regions'

// 地區海報區（DESIGN.md §7.5）：整塊是回到首頁日本地圖的按鈕。
const props = defineProps<{ pref: string }>()
const region = computed(() => regionOf(props.pref))
</script>

<template>
  <RouterLink
    v-if="region"
    to="/"
    aria-label="切換地區"
    :data-pref="pref"
    class="relative flex h-hero shrink-0 flex-col overflow-hidden bg-region px-6 py-5 text-on-region no-underline"
  >
    <span class="absolute -top-[50px] -right-[60px] size-[220px] rounded-full bg-region-accent"></span>
    <span lang="ja" class="relative text-label tracking-kana opacity-85">{{ region.name.kana }}</span>
    <span lang="ja" class="relative text-display font-black tracking-name">{{ region.name.ja }}</span>
    <span class="relative font-latin text-xl font-bold tracking-[0.4em] uppercase">{{ region.name.romaji }}</span>
    <span class="relative mt-auto text-label font-bold">{{ region.area_name }}</span>
  </RouterLink>
</template>
