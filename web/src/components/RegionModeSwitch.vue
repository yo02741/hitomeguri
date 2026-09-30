<script setup lang="ts">
// 同一個地區的兩種看法：地圖（/map/:pref）與深度探索（/region/:pref）。
// 地圖頁的地區標籤與深度探索頁的標頭共用，兩邊來回切換（使用者決定）。
defineProps<{ pref: string; active: 'map' | 'explore' }>()

const tabs = [
  { key: 'map', label: '地圖', to: (p: string) => `/map/${p}` },
  { key: 'explore', label: '深度探索', to: (p: string) => `/region/${p}` },
] as const
</script>

<template>
  <nav class="relative grid grid-cols-2 gap-0.5 rounded-control bg-region-accent p-0.5" aria-label="地區">
    <RouterLink
      v-for="t in tabs"
      :key="t.key"
      :to="t.to(pref)"
      class="flex h-8 items-center justify-center rounded-[6px] text-label font-bold no-underline"
      :class="t.key === active ? 'bg-paper text-ink shadow-float' : 'text-on-region hover:bg-paper/40'"
      :aria-current="t.key === active ? 'page' : undefined"
    >
      {{ t.label }}
    </RouterLink>
  </nav>
</template>
