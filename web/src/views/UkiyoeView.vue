<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import BackLink from '../components/BackLink.vue'
import PrintViewer from '../components/PrintViewer.vue'
import { useVisitedEntries } from '../composables/visited'
import { regions } from '../data/regions'
import { fetchUkiyoe, type UkiyoeSpot } from '../services/bundles'
import { flattenPrints, groupUkiyoe, printUrl, workMeta } from '../services/ukiyoe'
import { useCatalogStore } from '../stores/catalog'
import { useUserStore } from '../stores/user'

// 浮世繪裡的景點（DESIGN.md §7.19c）：描繪我們景點的浮世繪（Wikidata 的作品、Commons 的圖，公有領域或 CC），
// 依縣北到南排。去過的地方全彩、蓋去過的日期；沒去過的褪色，仍然點得開。不是收集卡，不用抽。
const userStore = useUserStore()
const catalog = useCatalogStore()
const { entries } = useVisitedEntries()

const spots = ref<UkiyoeSpot[] | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  try {
    const index = await catalog.loadIndex()
    spots.value = await fetchUkiyoe(index.extras?.ukiyoe)
  } catch {
    failed.value = true
  }
}
onMounted(load)

/** 去過的景點 → 日期（沒有日期是空字串） */
const visited = computed(() => new Map(entries.value.map(([id, m]) => [id, m.visited_on ?? ''])))
const groups = computed(() => groupUkiyoe(spots.value ?? [], regions))
const prints = computed(() => flattenPrints(groups.value))
const total = computed(() => spots.value?.length ?? 0)
const done = computed(() => (spots.value ?? []).filter((s) => visited.value.has(s.s)).length)
const doneIn = (list: UkiyoeSpot[]) => list.filter((s) => visited.value.has(s.s)).length
const dateText = (d: string) => d.replaceAll('-', '.')

// 海報右邊的一幅：最近去過的地方的第一幅，沒有就是第一個縣分數最高的地方
const hero = computed(() => {
  const list = groups.value.flatMap((g) => g.spots)
  const seen = list.filter((s) => visited.value.has(s.s)).sort((a, b) => (visited.value.get(b.s) ?? '').localeCompare(visited.value.get(a.s) ?? ''))
  const s = seen[0] ?? list[0]
  return s?.w[0] ? { spot: s, work: s.w[0] } : null
})

// 一個地方先排 6 幅，多的按「全部 n 幅」展開
const LIMIT = 6
const expanded = ref(new Set<string>())
function toggle(id: string) {
  const next = new Set(expanded.value)
  if (!next.delete(id)) next.add(id)
  expanded.value = next
}
const shown = (s: UkiyoeSpot) => (expanded.value.has(s.s) ? s.w : s.w.slice(0, LIMIT))

// 放大檢視：依頁面順序左右切換；關閉後焦點回到最後看的那幅（Safari 點按鈕不會給焦點，由這裡歸還）
const openAt = ref<number | null>(null)
const printKey = (spot: string, work: string) => `${spot}|${work}`
function open(spot: UkiyoeSpot, workId: string) {
  openAt.value = prints.value.findIndex((p) => p.spot.s === spot.s && p.work.i === workId)
}
async function close() {
  const p = openAt.value == null ? null : prints.value[openAt.value]
  openAt.value = null
  await nextTick()
  if (p) document.querySelector<HTMLElement>(`[data-print="${CSS.escape(printKey(p.spot.s, p.work.i))}"]`)?.focus()
}
function step(delta: -1 | 1) {
  if (openAt.value == null) return
  const i = openAt.value + delta
  if (i < 0 || i >= prints.value.length) return
  openAt.value = i
  // 換到收起來的那幾幅時先展開，關閉後焦點回得去
  const p = prints.value[i]!
  if (!shown(p.spot).includes(p.work)) toggle(p.spot.s)
}
// 縮圖的寬高比：放大時圖還沒載入也先排好大小
const ratios = new Map<string, number>()
function measure(id: string, e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) ratios.set(id, img.naturalWidth / img.naturalHeight)
}
// 讀不到的圖不顯示破圖示，只留紙
const hideBroken = (e: Event) => ((e.target as HTMLElement).style.visibility = 'hidden')
const openedVisit = computed(() => (openAt.value == null ? undefined : visited.value.get(prints.value[openAt.value]!.spot.s)))
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 pt-9 pb-24 max-lg:gap-5 max-lg:pt-3 max-sm:px-4">
    <header class="paper-grain relative overflow-hidden rounded-card bg-region p-6 text-on-region max-lg:px-5 max-lg:py-3.5">
      <div class="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:gap-8">
        <div class="flex min-w-0 flex-col gap-4 max-lg:gap-1.5">
          <BackLink to="/log/cards" on-region>收集冊</BackLink>
          <h1 class="text-h1 font-black tracking-title max-lg:text-h2">浮世繪裡的景點</h1>
          <p class="flex items-baseline gap-2 text-body-sm font-bold">
            去過<span class="whitespace-nowrap font-num text-body-sm">{{ done }} / {{ total || '–' }}</span>
          </p>
        </div>
        <figure v-if="hero" class="paper-grain w-[148px] rounded-[3px] bg-paper p-2 shadow-float max-lg:w-[84px] max-lg:p-1.5 max-sm:hidden" aria-hidden="true">
          <div class="relative aspect-[5/4]">
            <img :src="printUrl(hero.work.f, 500)" alt="" class="absolute inset-0 size-full object-contain" />
          </div>
        </figure>
      </div>
    </header>

    <p v-if="!userStore.user" class="-mt-2 text-body-sm text-sub">去過的紀錄需要登入。</p>

    <p v-if="failed" class="flex flex-wrap items-center gap-x-3 text-body-sm text-sub">
      讀不到資料
      <button type="button" class="inline-flex min-h-tap items-center font-bold text-region-strong active:not-disabled:translate-y-px" @click="load">重新讀取</button>
    </p>
    <div v-else-if="!spots" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      <div v-for="n in 8" :key="n" class="skeleton aspect-[5/4] rounded-[4px]"></div>
    </div>

    <section
      v-for="g in groups"
      :key="g.region.prefecture"
      :data-pref="g.region.prefecture"
      class="flex flex-col gap-4"
      :aria-labelledby="`uk-${g.region.prefecture}`"
    >
      <h2 :id="`uk-${g.region.prefecture}`" class="flex items-center gap-2.5">
        <span class="h-5 w-1.5 rounded-full bg-region-strong" aria-hidden="true"></span>
        <span lang="ja" class="text-h3 font-black tracking-[2px]">{{ g.region.name.ja }}</span>
        <span class="font-latin text-body-sm font-semibold tracking-[0.2em] text-sub uppercase">{{ g.region.name.romaji }}</span>
        <span class="ml-auto font-num text-body-sm text-sub">{{ doneIn(g.spots) }} / {{ g.spots.length }}</span>
      </h2>

      <article
        v-for="s in g.spots"
        :key="s.s"
        class="flex flex-col gap-3 border-t border-line-soft pt-3 first-of-type:border-t-0 first-of-type:pt-0"
        :class="visited.has(s.s) ? 'is-visited' : 'is-away'"
      >
        <header class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 class="flex items-baseline gap-2">
            <span lang="ja" class="text-title font-black tracking-name">{{ s.n }}</span>
            <span v-if="s.z" class="text-caption text-sub">{{ s.z }}</span>
          </h3>
          <span
            v-if="visited.has(s.s)"
            class="stamp inline-flex h-7 items-center gap-1.5 rounded-full border-2 border-visited px-2.5 text-caption font-bold text-visited"
          >
            去過<span v-if="visited.get(s.s)" class="font-latin">{{ dateText(visited.get(s.s)!) }}</span>
          </span>
          <span class="ml-auto font-num text-caption text-sub">{{ s.w.length }} 幅</span>
        </header>
        <ul class="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <li v-for="w in shown(s)" :key="w.i" class="flex min-w-0 flex-col gap-2">
            <button
              type="button"
              class="mat paper-grain relative block aspect-[5/4] w-full overflow-hidden rounded-[3px] border border-line bg-paper hover:border-ink/40 active:not-disabled:translate-y-px"
              aria-haspopup="dialog"
              :aria-label="[w.t, w.c, s.n].filter(Boolean).join('・')"
              :data-print="printKey(s.s, w.i)"
              @click="open(s, w.i)"
            >
              <img :src="printUrl(w.f, 500)" alt="" loading="lazy" decoding="async" @load="measure(w.i, $event)" @error="hideBroken" class="print absolute inset-2.5 size-[calc(100%-1.25rem)] object-contain" />
            </button>
            <div class="flex flex-col gap-0.5 px-0.5 text-caption">
              <p v-if="w.t" lang="ja" class="line-clamp-2 font-bold text-ink">{{ w.t }}</p>
              <p v-if="workMeta(w)" lang="ja" class="line-clamp-2 text-sub">{{ workMeta(w) }}</p>
              <p v-if="w.c" lang="ja" class="text-sub">{{ w.c }}</p>
              <p class="truncate text-micro text-sub">
                <template v-if="w.l">{{ w.l }}・</template><a :href="w.u" target="_blank" rel="noopener" class="underline decoration-line underline-offset-2 hover:text-ink">Commons</a>
              </p>
            </div>
          </li>
        </ul>
        <button
          v-if="s.w.length > LIMIT"
          type="button"
          class="inline-flex min-h-tap w-fit items-center gap-1.5 text-body-sm font-bold text-sub hover:text-ink active:not-disabled:translate-y-px"
          :aria-expanded="expanded.has(s.s)"
          @click="toggle(s.s)"
        >
          {{ expanded.has(s.s) ? '收起' : `全部 ${s.w.length} 幅` }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="transition-transform" :class="expanded.has(s.s) ? 'rotate-180' : ''" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </article>
    </section>

    <p v-if="spots && spots.length" class="text-caption text-sub">圖：Wikimedia Commons。題名、系列、年份、作者：Wikidata。</p>

    <PrintViewer v-if="openAt != null && prints[openAt]" :prints="prints" :index="openAt" :visited-on="openedVisit" :ratios="ratios" @step="step" @close="close" />
  </section>
</template>

<style scoped>
/* 沒去過的地方：褪色，名稱照常可讀；滑過、聚焦時稍微回來一點 */
.is-away .print {
  filter: grayscale(1) contrast(0.9);
  opacity: 0.5;
  transition:
    filter 0.25s var(--ease-out-soft),
    opacity 0.25s var(--ease-out-soft);
}
.is-away .mat {
  background-color: var(--color-surface);
}
.is-away .mat:hover .print,
.is-away .mat:focus-visible .print {
  filter: grayscale(0.6);
  opacity: 0.8;
}
.stamp {
  transform: rotate(-4deg);
}
</style>
