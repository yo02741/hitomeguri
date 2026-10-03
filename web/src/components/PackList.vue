<script setup lang="ts">
import { computed, watch } from 'vue'

import { packByKey } from '../data/packs'
import { regions } from '../data/regions'
import type { PackItem } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import { spotRef, useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'
import CollapseChevron from './CollapseChevron.vue'
import SkeletonRows from './SkeletonRows.vue'
import VisitedToggle from './VisitedToggle.vue'

// 擴充包清單：開啟擴充包時取代左側的景點清單（UX-FLOW.md A4）。
// 地區頁依組別分段；首頁（全國）依縣分段。組別列同時篩選清單與地圖。
const props = defineProps<{ pref?: string | null; selectedId?: string | null }>()
const emit = defineEmits<{ select: [id: string]; highlight: [id: string | null] }>()
const catalog = useCatalogStore()
const explore = useExploreStore()
const marks = useMarksStore()
const userStore = useUserStore()

const def = computed(() => (explore.pack ? packByKey.get(explore.pack) : undefined))
const all = computed(() => (explore.pack ? (catalog.packs[explore.pack] ?? []) : []))
const inPref = computed(() => (props.pref ? all.value.filter((it) => it.p === props.pref) : all.value))
const groups = computed(() => (def.value?.groups ?? []).filter((g) => inPref.value.some((it) => it.g === g.key)))
watch(groups, (list) => {
  if (explore.packGroup && !list.some((g) => g.key === explore.packGroup)) explore.packGroup = null
})
const rows = computed(() => inPref.value.filter((it) => !explore.packGroup || it.g === explore.packGroup))
const groupLabel = computed(() => new Map((def.value?.groups ?? []).map((g) => [g.key, g.label])))

const sections = computed<{ key: string; label: string; rows: PackItem[] }[]>(() => {
  if (props.pref) {
    return groups.value
      .map((g) => ({ key: g.key, label: g.label, rows: rows.value.filter((it) => it.g === g.key) }))
      .filter((s) => s.rows.length)
  }
  return regions
    .map((r) => ({ key: r.prefecture, label: r.name.ja, rows: rows.value.filter((it) => it.p === r.prefecture) }))
    .filter((s) => s.rows.length)
})

const isOpen = (key: string) => !explore.collapsed.includes(`pack:${key}`)

/** 第二行：人孔蓋列出寶可夢，城是名城番號，老舖是創業，其他列出地址 */
function detail(it: PackItem): string {
  if (it.pk?.length) return it.pk.map(([, name]) => name).join('・')
  if (it.no) return `No.${it.no}`
  if (it.f) return `創業 ${it.f}`
  return it.a ?? ''
}

// 名城選取後打開的是對到的景點
const isSelected = (it: PackItem) => !!props.selectedId && (it.id === props.selectedId || it.s === props.selectedId)

// 「去過」記在對到的景點上（城），沒有的記在這個點
const visitRef = (it: PackItem) => spotRef(it.s ?? it.id, it.p, it.n)
const visitedCount = computed(() => rows.value.filter((it) => marks.markOf(it.s ?? it.id)?.visited).length)
</script>

<template>
  <section
    v-if="def"
    class="flex min-h-0 flex-col rounded-card bg-paper p-1.5 shadow-float"
    :style="{ '--pack': `var(--color-t-${def.color})` }"
  >
    <div class="flex h-9 shrink-0 items-center gap-2 px-1 pointer-coarse:h-tap">
      <button
        type="button"
        class="flex h-8 items-center gap-1 rounded-control px-1.5 text-label text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap"
        @click="explore.pack = null"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        景點
      </button>
      <span class="ml-auto flex items-center gap-1.5 pr-1.5 text-label font-bold text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-(--pack)" aria-hidden="true">
          <path :d="def.icon" />
        </svg>
        {{ def.label }}<span class="font-latin font-semibold">{{ inPref.length }}</span>
        <span v-if="userStore.user && visitedCount" class="font-normal text-sub">去過 <span class="font-latin">{{ visitedCount }}</span></span>
      </span>
    </div>

    <nav
      v-if="groups.length > 1"
      class="flex shrink-0 flex-wrap gap-x-3.5 gap-y-1 border-b border-line-soft px-2.5 pt-2 pb-2 pointer-coarse:gap-x-0.5 pointer-coarse:gap-y-0 pointer-coarse:px-1 pointer-coarse:py-0"
      aria-label="類別"
    >
      <button
        type="button"
        class="text-label pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="explore.packGroup === null ? 'border-(--pack) font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="explore.packGroup === null"
        @click="explore.packGroup = null"
      >
        <span class="block border-b-2 border-inherit pb-0.5">不限</span>
      </button>
      <button
        v-for="g in groups"
        :key="g.key"
        type="button"
        class="text-label pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="explore.packGroup === g.key ? 'border-(--pack) font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="explore.packGroup === g.key"
        @click="explore.packGroup = explore.packGroup === g.key ? null : g.key"
      >
        <span class="block border-b-2 border-inherit pb-0.5">{{ g.label }}</span>
      </button>
    </nav>

    <div class="scroll-quiet flex min-h-0 flex-col overflow-y-auto overscroll-contain pr-3 pb-1 pl-1.5" @mouseleave="emit('highlight', null)">
      <template v-for="s in sections" :key="s.key">
        <h3 class="sticky top-0 z-[1] shrink-0 bg-paper">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-1.5 pt-2.5 pb-1 text-left text-caption font-bold tracking-section text-sub hover:text-ink active:text-ink"
            :aria-expanded="isOpen(s.key)"
            @click="explore.toggleCollapsed(`pack:${s.key}`)"
          >
            <CollapseChevron :open="isOpen(s.key)" />
            <span :lang="pref ? undefined : 'ja'">{{ s.label }}</span><span class="font-latin font-normal tracking-normal">{{ s.rows.length }}</span>
          </button>
        </h3>
        <div
          v-for="it in isOpen(s.key) ? s.rows : []"
          :key="it.id"
          class="flex shrink-0 items-center rounded-control"
          :class="isSelected(it) ? 'bg-region-tint' : 'hover:bg-surface active:bg-surface'"
        >
          <button
            type="button"
            class="flex min-h-tap min-w-0 flex-1 items-start gap-3 px-1.5 py-1.5 text-left text-ink"
            :aria-current="isSelected(it) ? 'true' : undefined"
            @mouseenter="emit('highlight', it.id)"
            @focus="emit('highlight', it.id)"
            @click="emit('select', it.id)"
          >
            <span class="mt-1.5 size-2.5 shrink-0 rounded-full bg-(--pack)" aria-hidden="true"></span>
            <span class="flex min-w-0 flex-col">
              <span lang="ja" class="line-clamp-2 text-body-sm font-bold break-words">{{ it.n }}</span>
              <span v-if="detail(it)" lang="ja" class="truncate text-caption text-sub">{{ detail(it) }}</span>
            </span>
            <!-- 首頁依縣分段，組別標在右側；地區頁已依組別分段 -->
            <span v-if="!pref" class="ml-auto shrink-0 text-caption text-sub">{{ groupLabel.get(it.g) }}</span>
          </button>
          <VisitedToggle :spot="visitRef(it)" />
        </div>
      </template>
      <p v-if="!sections.length && catalog.packs[explore.pack ?? '']" class="px-1.5 py-3 text-body-sm text-sub">這個地區沒有資料。</p>
      <SkeletonRows v-else-if="!sections.length" :rows="5" />
    </div>
  </section>
</template>
