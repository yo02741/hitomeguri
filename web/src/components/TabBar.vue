<script setup lang="ts">
import { useRoute } from 'vue-router'

// 手機底部分頁（UX-FLOW.md §1.1）：探索／行程／紀錄；「我的」在頂部右側頭像。
const route = useRoute()

const tabs = [
  { to: '/', label: '探索', match: ['home', 'explore', 'map'], icon: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z' },
  { to: '/trips', label: '行程', match: ['trips', 'trip', 'prep', 'practice', 'book'], icon: 'M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4' },
  { to: '/log', label: '紀錄', match: ['log', 'cards'], icon: 'M5 4h11l3 3v13H5z M9 11h7 M9 15h7' },
]
</script>

<template>
  <nav
    class="flex h-14 shrink-0 border-t border-line bg-header pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    aria-label="主要"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="flex flex-1 flex-col items-center justify-center gap-0.5 text-caption no-underline"
      :class="tab.match.includes(String(route.name)) ? 'font-bold text-ink' : 'text-sub'"
      :aria-current="tab.match.includes(String(route.name)) ? 'page' : undefined"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="tab.icon" />
      </svg>
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>
