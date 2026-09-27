<script setup lang="ts">
import { computed } from 'vue'

import type { MapSpot } from '../services/bundles'
import { useExploreStore } from '../stores/explore'
import RegionHero from './RegionHero.vue'

const props = defineProps<{ pref: string; spots: MapSpot[]; selectedId?: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const explore = useExploreStore()

const featured = computed(() => props.spots.filter((s) => s.f === 1).sort((a, b) => b.s - a.s))
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <RegionHero :pref="pref" class="max-lg:hidden" />
    <div class="flex flex-col px-5 pt-2.5 pl-6">
      <span class="mt-1 mb-0.5 text-caption tracking-section text-sub">主題</span>
      <label class="flex h-10 items-center gap-3 border-b border-line-soft">
        <span class="grid size-[26px] shrink-0 place-items-center rounded-badge bg-t-major text-paper shadow-marker" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
          </svg>
        </span>
        <span class="text-body-sm font-bold">大點</span>
        <span class="ml-auto text-caption text-sub">{{ spots.length }}</span>
      </label>
      <label class="flex h-10 items-center gap-3 border-b border-line-soft">
        <span class="text-body-sm">只看精選</span>
        <input
          v-model="explore.featuredOnly"
          type="checkbox"
          class="ml-auto size-5 accent-[var(--region-strong)]"
        />
      </label>
    </div>
    <div class="flex min-h-0 flex-col overflow-y-auto px-5 pb-4 pl-6">
      <span class="mt-4 mb-1 text-caption tracking-section text-sub">精選</span>
      <button
        v-for="s in featured"
        :key="s.id"
        type="button"
        class="flex min-h-tap items-center gap-3 border-b border-line-soft py-2 text-left"
        :class="s.id === selectedId ? 'font-bold text-ink' : 'text-ink'"
        :aria-current="s.id === selectedId ? 'true' : undefined"
        @click="emit('select', s.id)"
      >
        <span class="flex min-w-0 flex-col">
          <span v-if="s.h" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ s.h }}</span>
          <span lang="ja" class="truncate text-body-sm font-bold">{{ s.n }}</span>
        </span>
        <span v-if="s.c" class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
      </button>
      <p v-if="!featured.length" class="py-3 text-body-sm text-sub">資料準備中。</p>
    </div>
  </div>
</template>
