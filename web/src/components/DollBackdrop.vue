<script setup lang="ts">
import { computed } from 'vue'

import { artOf } from '../composables/bgArt'
import { BG_H, BG_W } from '../data/backgrounds/kit'
import { outfitById } from '../data/outfits'

// 換上的地區背景（DESIGN.md §7.24b）：帳號選單的半身像、頭像小卡片、紀錄頁的旅人卡片用。
// 放在 relative 的框裡、娃娃前面：整張風景貼齊下緣鋪滿，上面一層紙紋；沒換背景時什麼都不畫（框照舊是 region-tint）。
// 背景的畫等第一次要畫時才下載（composables/bgArt）。
const props = defineProps<{ id?: string | null }>()
const svg = computed(() => {
  const o = props.id ? outfitById.get(props.id) : undefined
  return o && o.slot === 'bg' ? artOf(o) : ''
})
</script>

<template>
  <template v-if="svg">
    <svg :viewBox="`0 0 ${BG_W} ${BG_H}`" preserveAspectRatio="xMidYMax slice" class="pointer-events-none absolute inset-0 size-full" aria-hidden="true" v-html="svg"></svg>
    <span class="paper-grain pointer-events-none absolute inset-0 opacity-70 mix-blend-multiply" aria-hidden="true"></span>
  </template>
</template>
