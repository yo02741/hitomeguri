<script setup lang="ts">
// 簡介：原文（維基百科、農林水產省）照原樣顯示；英文原文有中文譯文時，英文一行、中文一行。
defineProps<{
  summary: { text: string; lang: 'zh' | 'en' | 'ja'; text_zh?: string }
  /** 每段最多幾行（卡片用），不給則全文 */
  clamp?: 2 | 3 | 4
}>()

const CLAMP = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' } as const
</script>

<template>
  <div class="flex flex-col gap-1.5 text-body-sm leading-[1.75]">
    <p :lang="summary.lang === 'zh' ? undefined : summary.lang" :class="[clamp && CLAMP[clamp], summary.text_zh && 'text-sub']">
      {{ summary.text }}
    </p>
    <p v-if="summary.text_zh" :class="clamp && CLAMP[clamp]">{{ summary.text_zh }}</p>
  </div>
</template>
