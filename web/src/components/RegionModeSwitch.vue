<script setup lang="ts">
// 同一個地區的兩種看法：地圖（/map/:pref）與深度探索（/region/:pref）。
// 地圖頁的地區標籤與深度探索頁的標頭共用，兩邊來回切換（使用者決定）。
// floating：地圖左下的小切換（paper 底，目前那格地區強調色）
defineProps<{ pref: string; active: 'map' | 'explore'; floating?: boolean }>()

const tabs = [
  { key: 'map', label: '地圖', to: (p: string) => `/map/${p}` },
  { key: 'explore', label: '深度探索', to: (p: string) => `/region/${p}` },
] as const
</script>

<template>
  <nav
    class="grid grid-cols-2 gap-0.5 p-0.5"
    :class="floating ? 'rounded-full bg-paper shadow-float' : 'rounded-control bg-region-accent'"
    aria-label="地區"
  >
    <RouterLink
      v-for="t in tabs"
      :key="t.key"
      :to="t.to(pref)"
      class="flex items-center justify-center font-bold no-underline"
      :class="[
        floating ? 'h-7 rounded-full px-3 text-caption' : 'h-8 rounded-[6px] text-label',
        t.key === active
          ? floating
            ? 'bg-region-strong text-white'
            : 'bg-paper text-ink shadow-float'
          : floating
            ? 'text-sub hover:text-ink'
            : 'text-on-region hover:bg-paper/40',
      ]"
      :aria-current="t.key === active ? 'page' : undefined"
    >
      {{ t.label }}
    </RouterLink>
  </nav>
</template>
