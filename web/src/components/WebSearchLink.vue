<script setup lang="ts">
import { computed } from 'vue'

// 名稱只有日文、看不懂時，直接用 Google 搜尋（介面語言設為繁體中文）。
// query 用日文名＋縣名，避免同名的別處料理、祭典。
const props = defineProps<{ name: string; context?: string }>()

const href = computed(() => {
  const q = [props.name, props.context].filter(Boolean).join(' ')
  return `https://www.google.com/search?${new URLSearchParams({ q, hl: 'zh-TW' })}`
})
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener"
    :aria-label="`在 Google 搜尋「${name}」`"
    :title="`在 Google 搜尋「${name}」`"
    class="grid size-8 shrink-0 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
    </svg>
  </a>
</template>
