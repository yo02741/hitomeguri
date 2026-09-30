<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CardViewer from '../components/CardViewer.vue'
import RegionMotif from '../components/RegionMotif.vue'
import SpotCard from '../components/SpotCard.vue'
import { type CollectionCard, useCollection } from '../composables/collection'
import { useVisitedEntries } from '../composables/visited'
import { type Region, regions } from '../data/regions'
import { cardFromSpot } from '../services/card'
import { useCatalogStore } from '../stores/catalog'
import { useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 收集冊（DESIGN.md §7.19）：去過的景點做成收集卡，依縣（JIS 順）排列，縣內依卡號（分數）。
// 放大檢視時才載入該縣的詳細資料，換上簡介與照片出處。
const userStore = useUserStore()
const marks = useMarksStore()
const catalog = useCatalogStore()
const { entries } = useVisitedEntries()

const { cards, pendingByPref, castleTotal, castleDone, prefDone } = useCollection(() => entries.value)

// 篩選：依屬性（一張卡可以同時是名城和國寶）
type FilterKey = 'all' | 'heritage' | 'castle' | 'treasure'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'heritage', label: '世界遺產' },
  { key: 'castle', label: '名城' },
  { key: 'treasure', label: '國寶・特別史跡・特別名勝' },
]
const matches: Record<FilterKey, (e: CollectionCard) => boolean> = {
  all: () => true,
  heritage: (e) => e.face.designation === '世界遺產',
  castle: (e) => e.castle,
  treasure: (e) => Boolean(e.face.designation && e.face.designation !== '世界遺產'),
}
const filter = ref<FilterKey>('all')
const counts = computed(() => Object.fromEntries(FILTERS.map((f) => [f.key, cards.value.filter(matches[f.key]).length])) as Record<FilterKey, number>)

interface Group {
  region: Region
  items: CollectionCard[]
  pending: number
}
const groups = computed<Group[]>(() => {
  const by = new Map<string, CollectionCard[]>()
  for (const e of cards.value) {
    if (!matches[filter.value](e)) continue
    const list = by.get(e.face.pref) ?? []
    list.push(e)
    by.set(e.face.pref, list)
  }
  return regions.flatMap((r) => {
    const items = (by.get(r.prefecture) ?? []).sort((a, b) => b.score - a.score || a.face.id.localeCompare(b.face.id))
    const pending = filter.value === 'all' ? (pendingByPref.value.get(r.prefecture) ?? 0) : 0
    return items.length || pending ? [{ region: r, items, pending }] : []
  })
})
const flat = computed(() => groups.value.flatMap((g) => g.items))

// 放大檢視：依目前的篩選左右切換；打開時載入該縣的詳細資料換上簡介與照片出處
const openId = ref<string | null>(null)
const openIndex = computed(() => flat.value.findIndex((e) => e.face.id === openId.value))
const opened = computed(() => (openIndex.value >= 0 ? flat.value[openIndex.value] : null))
watch(opened, (e) => {
  if (e) void catalog.loadDetail(e.face.pref)
})
const openedFace = computed(() => {
  const e = opened.value
  const d = e ? catalog.details[e.face.pref]?.[e.face.id] : undefined
  return d ? cardFromSpot(d) : e?.face
})
function step(delta: -1 | 1) {
  const e = flat.value[openIndex.value + delta]
  if (e) openId.value = e.face.id
}
function onCardKey(e: KeyboardEvent, id: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openId.value = id
  }
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 py-9 max-sm:px-4">
    <header class="paper-grain relative flex flex-col gap-4 overflow-hidden rounded-card bg-region p-6 text-on-region max-sm:p-5">
      <RegionMotif class="absolute -top-16 -right-14 size-[260px] max-sm:size-[200px]" />
      <RouterLink to="/log" class="relative flex w-fit items-center gap-1 text-label font-bold text-on-region no-underline hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        紀錄
      </RouterLink>
      <h1 class="relative flex items-baseline gap-3 text-h1 font-black tracking-[4px]">
        收集冊<span class="font-latin text-h3 font-semibold tracking-normal">{{ cards.length }}</span>
      </h1>
      <div class="relative flex max-w-[640px] flex-col gap-1.5">
        <p class="flex items-baseline gap-2 text-label font-bold">
          都道府縣<span class="font-latin text-body-sm">{{ prefDone.size }} / 47</span>
        </p>
        <ol class="grid grid-cols-[repeat(47,minmax(0,1fr))] gap-[2px]" aria-hidden="true">
          <li
            v-for="r in regions"
            :key="r.prefecture"
            :data-pref="r.prefecture"
            :title="r.name.ja"
            class="h-3.5 rounded-[2px]"
            :class="prefDone.has(r.prefecture) ? 'bg-region-strong' : 'bg-paper/55'"
          ></li>
        </ol>
      </div>
      <div v-if="castleTotal" class="relative flex max-w-[640px] flex-col gap-1.5">
        <p class="flex items-baseline gap-2 text-label font-bold">
          日本100名城・続日本100名城<span class="font-latin text-body-sm">{{ castleDone }} / {{ castleTotal }}</span>
        </p>
        <div class="h-3.5 overflow-hidden rounded-[2px] bg-paper/55" aria-hidden="true">
          <div class="h-full rounded-[2px] bg-t-castle" :style="{ width: `${(castleDone / castleTotal) * 100}%` }"></div>
        </div>
      </div>
    </header>

    <template v-if="userStore.user">
      <div role="group" aria-label="篩選" class="flex flex-wrap gap-2">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="flex h-9 items-center gap-2 rounded-full border px-3.5 text-label"
          :class="filter === f.key ? 'border-ink bg-ink font-bold text-paper' : 'border-line bg-paper text-ink hover:bg-surface'"
          :aria-pressed="filter === f.key"
          @click="filter = f.key"
        >
          <span v-if="f.key !== 'all'" class="swatch size-3 rounded-full" :class="`swatch-${f.key}`" aria-hidden="true"></span>
          {{ f.label }}
          <span class="font-latin">{{ counts[f.key] }}</span>
        </button>
      </div>

      <section v-for="g in groups" :key="g.region.prefecture" :data-pref="g.region.prefecture" class="flex flex-col gap-4" :aria-label="g.region.name.ja">
        <h2 class="flex items-center gap-2.5">
          <span class="h-5 w-1.5 rounded-full bg-region-strong" aria-hidden="true"></span>
          <span lang="ja" class="text-h3 font-black tracking-[2px]">{{ g.region.name.ja }}</span>
          <span class="font-latin text-label font-semibold tracking-[0.2em] text-sub uppercase">{{ g.region.name.romaji }}</span>
          <span class="ml-auto font-latin text-body-sm text-sub">{{ g.items.length || g.pending }}</span>
        </h2>
        <ul class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <li v-for="(e, i) in g.items" :key="e.face.id" class="deal @container" :style="{ '--i': Math.min(i, 12) }">
            <div
              role="button"
              tabindex="0"
              class="rounded-[5cqi] outline-offset-4"
              :aria-label="[e.face.name.ja, e.label, e.number].filter(Boolean).join('・')"
              @click="openId = e.face.id"
              @keydown="onCardKey($event, e.face.id)"
            >
              <SpotCard :card="e.face" :rarity="e.rarity" :label="e.label" :number="e.number" visited :visited-on="e.visitedOn" size="fluid" />
            </div>
          </li>
          <li v-for="n in g.pending" :key="`p${n}`" class="skeleton aspect-[5/7] rounded-[10px]" aria-hidden="true"></li>
        </ul>
      </section>

      <p v-if="marks.loaded && !entries.length" class="text-body-sm text-sub">還沒有去過的地方</p>
      <p v-else-if="cards.length && !groups.length" class="text-body-sm text-sub">沒有符合的卡片</p>
      <p v-if="cards.length" class="text-caption text-sub">照片：Wikimedia Commons，作者與授權在卡片背面。</p>
    </template>
    <p v-else class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>

    <CardViewer
      v-if="opened && openedFace"
      :card="openedFace"
      :rarity="opened.rarity"
      :label="opened.label"
      :number="opened.number"
      visited
      :visited-on="opened.visitedOn"
      :position="{ index: openIndex, total: flat.length }"
      :to="{ path: `/map/${opened.face.pref}`, query: { spot: opened.face.id } }"
      @step="step"
      @close="openId = null"
    />
  </section>
</template>

<style scoped>
/* 發牌：卡片依序從下方翻上來 */
.deal {
  animation: deal-in 0.5s var(--ease-out-soft) both;
  animation-delay: calc(var(--i) * 45ms);
}
@keyframes deal-in {
  from {
    opacity: 0;
    transform: translateY(18px) rotate(-2deg) scale(0.96);
  }
}
/* 篩選鈕的小色票：與卡片箔片同色 */
.swatch-heritage {
  background: conic-gradient(var(--color-foil-1), var(--color-foil-2), var(--color-foil-3), var(--color-foil-4), var(--color-foil-5), var(--color-foil-1));
}
.swatch-castle {
  background: var(--color-t-castle);
}
.swatch-treasure {
  background: linear-gradient(135deg, var(--color-gold-1), var(--color-gold-2), var(--color-gold-3));
}
</style>
