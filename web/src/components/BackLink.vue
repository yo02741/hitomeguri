<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

// 頁面上方的返回連結（DESIGN.md §7.1）：箭頭＋上一層的名字，一律粗體。
// 觸控裝置用上下內距撐到 44px 高，負邊距抵掉，版面不變（DESIGN.md §5.2）。
// onRegion：放在地區色的頁首上（收集冊、成就、經縣值、旅前準備）
defineProps<{ to: RouteLocationRaw; onRegion?: boolean }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="flex w-fit items-center gap-1 text-label font-bold no-underline active:not-disabled:translate-y-px pointer-coarse:-my-3 pointer-coarse:py-3"
    :class="onRegion ? 'text-on-region hover:underline' : 'text-sub hover:text-ink'"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    <slot />
  </RouterLink>
</template>
