<script setup lang="ts">
import { computed } from 'vue'

// 簡介：原文（維基百科、農林水產省）照原樣保存；有中文譯文時畫面只放中文，原文收在「原文」裡（original 才顯示）。
const props = defineProps<{
  summary: { text: string; lang: 'zh' | 'en' | 'ja'; text_zh?: string }
  /** 最多幾行（卡片用），不給則全文 */
  clamp?: 2 | 3 | 4
  /** 有譯文時，下面放可展開的「原文」 */
  original?: boolean
}>()

const CLAMP = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' } as const
const translated = computed(() => !!props.summary.text_zh)
const langOf = (l: 'zh' | 'en' | 'ja') => (l === 'zh' ? undefined : l)
</script>

<template>
  <div class="flex flex-col gap-2" :class="clamp ? 'text-body-sm leading-[1.75]' : 'text-body'">
    <p :lang="translated ? undefined : langOf(summary.lang)" class="text-pretty" :class="clamp && CLAMP[clamp]">
      {{ summary.text_zh || summary.text }}
    </p>
    <details v-if="original && translated" class="group text-body-sm text-sub">
      <summary class="w-fit cursor-pointer py-1 font-bold hover:text-ink pointer-coarse:py-3">原文</summary>
      <p :lang="langOf(summary.lang)" class="mt-1 text-pretty">{{ summary.text }}</p>
    </details>
  </div>
</template>
