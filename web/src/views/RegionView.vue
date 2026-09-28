<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { regionOf } from '../data/regions'
import { SPECIALTY_GROUPS, specialtyGroup } from '../data/specialties'
import type { Specialty } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import CollapseChevron from '../components/CollapseChevron.vue'
import FestivalList from '../components/FestivalList.vue'
import SeasonCalendar from '../components/SeasonCalendar.vue'

// 深度探索（UX-FLOW.md A8）：一個縣的季節、祭典、地區特色、期間限定。
// 地圖頁負責「去哪」，這一頁負責「這個地方有什麼、什麼時候去」。沒有資料的段落不顯示。
const props = defineProps<{ pref: string }>()
const catalog = useCatalogStore()
const explore = useExploreStore()
const region = computed(() => regionOf(props.pref))

watch(
  () => props.pref,
  (p) => {
    explore.setActivePref(regionOf(p) ? p : null)
    if (regionOf(p)) void catalog.loadFestivals(p)
  },
  { immediate: true },
)
onMounted(() => catalog.loadExtras())

// 有照片、有簡介的排前面（資料比較完整），其餘依名稱
function richness(s: Specialty): number {
  return (s.images?.length ? 2 : 0) + (s.summary || s.summary_zh ? 1 : 0)
}
const specialties = computed(() =>
  catalog.specialties
    .filter((s) => s.prefecture === props.pref)
    .sort((a, b) => richness(b) - richness(a) || a.name.ja.localeCompare(b.name.ja, 'ja')),
)
const groups = computed(() =>
  SPECIALTY_GROUPS.map((g) => ({ ...g, items: specialties.value.filter((s) => specialtyGroup(s.category) === g.key) })).filter(
    (g) => g.items.length,
  ),
)
// 每組先顯示幾項，其餘展開
const FIRST = 9
const expanded = ref(new Set<string>())
watch(
  () => props.pref,
  () => (expanded.value = new Set()),
)

const festivals = computed(() => catalog.festivals[props.pref] ?? [])

// 季節：這個縣的觀測站（有平年值的），代表站在前
const stations = computed(() => catalog.seasons?.stations.filter((s) => s.prefecture === props.pref) ?? [])

const sections = computed(() =>
  [
    { id: 'seasons', label: '季節', show: stations.value.length > 0 },
    { id: 'festivals', label: '祭典', show: festivals.value.length > 0 },
    { id: 'specialties', label: '地區特色', show: groups.value.length > 0 },
  ].filter((s) => s.show),
)

const failed = ref(new Set<string>())
function image(s: Specialty) {
  const img = s.images?.[0]
  return img && !failed.value.has(img.url) ? img : undefined
}
function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('wikidata')) return 'Wikidata'
    if (host === 'ja.wikipedia.org') return '維基百科（日文）'
    if (host === 'zh.wikipedia.org') return '維基百科（中文）'
    if (host === 'maff.go.jp') return '農林水產省'
    return host
  } catch {
    return url
  }
}
</script>

<template>
  <div v-if="region" :data-pref="pref" class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-paper text-ink">
    <!-- 海報區：地區色、正圓裝飾，只用正圓（DESIGN.md §7.5） -->
    <header class="relative shrink-0 overflow-hidden bg-region text-on-region">
      <span class="absolute -top-24 -right-16 size-[320px] rounded-full bg-region-accent" aria-hidden="true"></span>
      <div class="relative mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 pt-5 pb-8">
        <RouterLink
          :to="`/map/${pref}`"
          class="flex h-9 w-fit items-center gap-1 rounded-control pr-2.5 pl-1.5 text-label font-bold text-on-region no-underline hover:bg-region-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          地圖
        </RouterLink>
        <div class="flex flex-wrap items-end gap-x-6 gap-y-1">
          <div class="flex flex-col">
            <span lang="ja" class="text-body tracking-kana opacity-85">{{ region.name.kana }}</span>
            <h1 lang="ja" class="text-display font-black tracking-name">{{ region.name.ja }}</h1>
          </div>
          <div class="flex flex-col pb-2">
            <span class="font-latin text-body font-bold tracking-[0.4em] uppercase">{{ region.name.romaji }}</span>
            <span class="text-body-sm font-bold">{{ region.area_name }}</span>
          </div>
        </div>
        <nav v-if="sections.length > 1" class="flex gap-4" aria-label="段落">
          <a v-for="s in sections" :key="s.id" :href="`#${s.id}`" class="text-label font-bold text-on-region">{{ s.label }}</a>
        </nav>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pt-8 pb-16">
      <section v-if="stations.length" id="seasons" class="flex flex-col gap-4" aria-labelledby="seasons-title">
        <h2 id="seasons-title" class="text-h3 font-black tracking-[2px]">季節</h2>
        <SeasonCalendar :stations="stations" :source-url="catalog.seasons!.source.url" />
      </section>

      <section v-if="festivals.length" id="festivals" class="flex flex-col gap-4" aria-labelledby="festivals-title">
        <h2 id="festivals-title" class="text-h3 font-black tracking-[2px]">祭典</h2>
        <FestivalList :festivals="festivals" />
      </section>

      <section v-if="groups.length" id="specialties" class="flex flex-col gap-6" aria-labelledby="specialties-title">
        <h2 id="specialties-title" class="text-h3 font-black tracking-[2px]">地區特色</h2>
        <div v-for="g in groups" :key="g.key" class="flex flex-col gap-3">
          <h3 class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub">
            {{ g.label }}<span class="font-latin font-normal tracking-normal">{{ g.items.length }}</span>
          </h3>
          <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="s in expanded.has(g.key) ? g.items : g.items.slice(0, FIRST)" :key="s.id" class="flex flex-col overflow-hidden rounded-card border border-line bg-paper">
              <!-- 沒有照片就不留空白圖框 -->
              <div v-if="s.images?.length" class="aspect-[16/10] shrink-0 bg-placeholder">
                <img
                  v-if="image(s)"
                  :src="image(s)!.url"
                  :alt="s.name.ja"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="size-full object-cover"
                  @error="failed = new Set(failed).add(image(s)!.url)"
                />
              </div>
              <div class="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <div class="flex flex-col">
                  <span v-if="s.name.kana" lang="ja" class="text-caption tracking-kana text-sub">{{ s.name.kana }}</span>
                  <span class="flex flex-wrap items-baseline gap-x-2">
                    <span lang="ja" class="text-body font-bold">{{ s.name.ja }}</span>
                    <span v-if="s.name.zh_tw && s.name.zh_tw !== s.name.ja" class="text-body-sm text-sub">{{ s.name.zh_tw }}</span>
                  </span>
                </div>
                <p
                  v-if="s.summary"
                  :lang="s.summary.lang === 'ja' ? 'ja' : undefined"
                  class="line-clamp-4 text-body-sm leading-[1.75]"
                >{{ s.summary.text }}</p>
                <p v-else-if="s.summary_zh" class="line-clamp-4 text-body-sm leading-[1.75]">{{ s.summary_zh }}</p>
                <div class="mt-auto flex flex-wrap gap-x-3 pt-1 text-caption text-sub">
                  <span v-if="s.summary">{{ s.summary.license }}</span>
                  <a v-for="src in s.sources" :key="src.url" :href="src.url" target="_blank" rel="noopener" class="text-sub">{{
                    sourceLabel(src.url)
                  }}</a>
                </div>
              </div>
            </li>
          </ul>
          <button
            v-if="g.items.length > FIRST && !expanded.has(g.key)"
            type="button"
            class="flex h-10 w-fit items-center gap-2 rounded-control border border-line px-4 text-label font-bold text-ink hover:bg-surface"
            @click="expanded = new Set(expanded).add(g.key)"
          >
            <CollapseChevron :open="true" />
            全部 <span class="font-latin">{{ g.items.length }}</span> 項
          </button>
        </div>
      </section>

      <p v-if="!sections.length" class="text-body-sm text-sub">資料準備中。</p>
    </main>
  </div>
</template>
