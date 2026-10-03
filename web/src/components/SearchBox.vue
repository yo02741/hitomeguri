<script setup lang="ts">
import { computed, ref, shallowRef, useId, watch } from 'vue'

import RegionChip from './RegionChip.vue'
import { regionOf } from '../data/regions'
import type { SearchHit } from '../services/search'
import { typing } from '../services/keyboard'
import { useCatalogStore } from '../stores/catalog'
import SkeletonRows from './SkeletonRows.vue'

// header 右側的景點搜尋（全國）。第一次聚焦時才下載索引。
// 結果先列縣名，再列景點（完全相同 > 開頭相同 > 包含，同級依分數）。
// full：手機 header 展開的搜尋列（DESIGN.md §7.3），佔滿寬度，結果鋪滿 header 與底部分頁列之間
// （打字時分頁列收起，結果鋪到底，services/keyboard.ts）。
defineProps<{ full?: boolean }>()
const emit = defineEmits<{ pick: [hit: SearchHit] }>()
const catalog = useCatalogStore()
const uid = useId()
const input = ref<HTMLInputElement | null>(null)

const query = ref('')
const open = ref(false)
const active = ref(0)
const hits = shallowRef<SearchHit[]>([])
let searchFn: ((q: string) => SearchHit[]) | null = null

async function prepare() {
  open.value = true
  if (searchFn) return
  await catalog.loadSearch()
  searchFn = (await import('../services/search')).search
  run()
}

function run() {
  hits.value = searchFn ? searchFn(query.value) : []
  active.value = 0
}
watch(query, run)

// header 的搜尋列一直掛著（AppHeader），在點擊當下聚焦、收起時清空
defineExpose({
  focus: () => input.value?.focus(),
  clear: () => {
    query.value = ''
    open.value = false
  },
})

const showList = computed(() => open.value && query.value.trim() !== '')

function pick(hit: SearchHit | undefined) {
  if (!hit) return
  emit('pick', hit)
  query.value = ''
  open.value = false
  ;(document.activeElement as HTMLElement | null)?.blur()
}

function onKey(e: KeyboardEvent) {
  if (e.isComposing) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    active.value = e.key === 'ArrowDown' ? Math.min(active.value + 1, hits.value.length - 1) : Math.max(active.value - 1, 0)
    e.preventDefault()
    document.getElementById(`${uid}-${active.value}`)?.scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    pick(hits.value[active.value])
  } else if (e.key === 'Escape') {
    query.value = ''
    open.value = false
  }
}
</script>

<template>
  <div class="relative" :class="full ? 'w-full min-w-0' : 'w-72 shrink-0'" @focusout="(e) => !($el as HTMLElement).contains(e.relatedTarget as Node) && (open = false)">
    <label class="flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-3.5 text-sub focus-within:border-region-strong focus-within:text-ink pointer-coarse:h-tap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
      </svg>
      <input
        ref="input"
        v-model="query"
        type="search"
        placeholder="搜尋景點、地區"
        aria-label="搜尋景點、地區"
        role="combobox"
        :aria-expanded="showList"
        :aria-controls="`${uid}-list`"
        :aria-activedescendant="showList && hits.length ? `${uid}-${active}` : undefined"
        autocomplete="off"
        enterkeyhint="search"
        class="min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-sub [&::-webkit-search-cancel-button]:appearance-none"
        @focus="prepare"
        @keydown="onKey"
      />
    </label>
    <p class="sr-only" aria-live="polite">{{ showList && catalog.index ? `${hits.length} 筆` : '' }}</p>
    <ul
      v-if="showList"
      :id="`${uid}-list`"
      role="listbox"
      aria-label="搜尋結果"
      data-reduce="fade"
      class="scroll-quiet z-30 flex origin-top animate-pop-in flex-col overflow-y-auto overscroll-contain bg-paper p-1.5"
      :class="
        full
          ? ['fixed inset-x-0 top-header border-t border-line', typing ? 'bottom-0' : 'bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))]']
          : 'absolute top-12 right-0 max-h-[60dvh] w-full rounded-card shadow-float'
      "
    >
      <li
        v-for="(h, i) in hits"
        :id="`${uid}-${i}`"
        :key="h.kind + h.id"
        role="option"
        :aria-selected="i === active"
        tabindex="-1"
        class="flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-2 py-1"
        :class="i === active ? 'bg-surface' : ''"
        @mouseenter="active = i"
        @mousedown.prevent="pick(h)"
      >
        <RegionChip :pref="h.pref" :size="14" class="shrink-0" />
        <span class="flex min-w-0 flex-col">
          <span v-if="h.kana" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ h.kana }}</span>
          <span class="truncate text-body-sm">
            <span lang="ja" class="font-bold text-ink">{{ h.name }}</span>
            <span v-if="h.zh" class="ml-1.5 text-caption text-sub">{{ h.zh }}</span>
          </span>
        </span>
        <span lang="ja" class="ml-auto shrink-0 text-caption text-sub">
          {{ h.kind === 'pref' ? '地區' : regionOf(h.pref)?.name.ja }}
        </span>
      </li>
      <li v-if="!hits.length && catalog.index" class="px-2 py-2.5 text-body-sm text-sub">找不到符合的景點</li>
      <li v-else-if="!hits.length"><SkeletonRows :rows="3" /></li>
    </ul>
  </div>
</template>
