<script setup lang="ts">
import { PACKS } from '../data/packs'
import { useExploreStore } from '../stores/explore'

// 擴充包的設定選單：勾選要顯示哪些擴充包（存在這台瀏覽器）。位置由外層的 class 決定（PackBar、ChipRail）
const explore = useExploreStore()
</script>

<template>
  <div data-reduce="fade" class="flex w-72 animate-pop-in flex-col rounded-card bg-paper p-1.5 shadow-float" role="menu">
    <span class="px-2.5 pt-1.5 pb-1 text-caption font-bold tracking-section text-sub">擴充包</span>
    <label
      v-for="p in PACKS"
      :key="p.key"
      class="flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-body-sm hover:bg-surface"
      role="menuitemcheckbox"
      :aria-checked="explore.enabledPacks.includes(p.key)"
      :style="{ '--pack': `var(--color-t-${p.color})` }"
    >
      <input
        type="checkbox"
        class="size-4 accent-(--pack)"
        :checked="explore.enabledPacks.includes(p.key)"
        @change="explore.setPackEnabled(p.key, ($event.target as HTMLInputElement).checked)"
      />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-(--pack)" aria-hidden="true">
        <path :d="p.icon" />
      </svg>
      <span class="flex min-w-0 flex-col py-1.5">
        <span class="font-bold">{{ p.label }}</span>
        <span class="truncate text-caption text-sub">{{ p.groups.map((g) => g.label).join('・') }}</span>
      </span>
    </label>
  </div>
</template>
