<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import ChainSearch from '../components/ChainSearch.vue'
import FindGallery from '../components/FindGallery.vue'
import PhraseRow from '../components/PhraseRow.vue'
import RegionChip from '../components/RegionChip.vue'
import SectionNav from '../components/SectionNav.vue'
import SpeakButton from '../components/SpeakButton.vue'
import TimedList from '../components/TimedList.vue'
import { usePrep } from '../composables/prep'
import { type NavItem, useScrollSpy } from '../composables/scrollSpy'
import { type Phrase, type PrepPlace, SITUATION_LABEL } from '../services/prep'
import { overlapping } from '../services/timed'
import { dayDate, shortDate } from '../services/trip'
import { useCatalogStore } from '../stores/catalog'
import { useFindsStore } from '../stores/finds'
import { useUserStore } from '../stores/user'

// 旅前準備（UX-FLOW.md D1、D2、D4、D5）：這趟會遇到的日文。地名與車站 → 聽 → 說 → 讀 → 地區特色 → 期間限定。
// 旅途中（ongoing）頂部先列今天的地名。一頁式，左側（手機在頂部）是段落目錄，跟著捲動標出目前段落。
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const route = useRoute()
const { trip, prefs, places, phrases, words, loading, todayIndex } = usePrep(() => props.id)

// 期間限定：行程日期內、所在縣的觀測（例：出發時已經觀測到的紅葉），和掛在這趟的截圖
const catalog = useCatalogStore()
const finds = useFindsStore()
onMounted(() => void catalog.loadTimed())
const timed = computed(() => {
  const t = trip.value
  if (!t?.start_date) return []
  return overlapping(catalog.timed ?? [], t.start_date, t.end_date ?? t.start_date, prefs.value)
})
const tripFinds = computed(() => finds.forTrip(props.id))
const gallery = ref<InstanceType<typeof FindGallery> | null>(null)

const onlyMust = ref(false)
const shownPhrases = computed(() => phrases.value.filter((p) => !onlyMust.value || p.priority === 1))

const TABS = [
  { key: 'hear', label: '聽', sub: '會聽到的' },
  { key: 'say', label: '說', sub: '要開口說的' },
  { key: 'read', label: '讀', sub: '招牌、包裝、站牌' },
] as const

/** 依情境分組（保留第一次出現的順序） */
function bySituation(list: Phrase[]): { situation: string; items: Phrase[] }[] {
  const out = new Map<string, Phrase[]>()
  for (const p of list) out.set(p.context.situation, [...(out.get(p.context.situation) ?? []), p])
  const order = Object.keys(SITUATION_LABEL)
  const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length)
  return [...out.entries()]
    .map(([situation, items]) => ({ situation, items }))
    .sort((a, b) => rank(a.situation) - rank(b.situation))
}
const groups = computed(() =>
  TABS.map((t) => ({ ...t, groups: bySituation(shownPhrases.value.filter((p) => p.direction === t.key)) })),
)

const todayPlaces = computed(() => (todayIndex.value === null ? [] : places.value.filter((p) => p.day === todayIndex.value)))
function dayLabel(p: PrepPlace): string {
  if (p.day === undefined || !trip.value) return '待排'
  const d = dayDate(trip.value, p.day)
  return `DAY ${p.day + 1}${d ? ` ${shortDate(d)}` : ''}`
}

// 段落目錄（順序與下方段落相同）
const nav = computed<NavItem[]>(() => [
  ...(todayPlaces.value.length ? [{ id: 'today', label: '今天', count: todayPlaces.value.length }] : []),
  { id: 'places', label: '地名與車站', count: places.value.length },
  ...groups.value.map((t) => ({
    id: t.key,
    label: t.label,
    count: t.groups.reduce((n, g) => n + g.items.length, 0),
    children: t.groups.map((g) => ({ id: `${t.key}-${g.situation}`, label: SITUATION_LABEL[g.situation] ?? g.situation })),
  })),
  ...(words.value.length && !onlyMust.value ? [{ id: 'words', label: '地區特色', count: words.value.length }] : []),
  ...(!onlyMust.value ? [{ id: 'limited', label: '期間限定', count: timed.value.length + tripFinds.value.length }] : []),
])
const root = ref<HTMLElement | null>(null)
const { active, go, refresh } = useScrollSpy(root, () => nav.value.flatMap((it) => [it.id, ...(it.children ?? []).map((c) => c.id)]))
watch(nav, () => requestAnimationFrame(refresh), { flush: 'post' })

// 網址帶 #段落 時，資料載入後捲過去
let jumped = false
watch(
  () => [loading.value, trip.value?.id] as const,
  ([l, t]) => {
    if (jumped || l || !t || !route.hash) return
    jumped = true
    requestAnimationFrame(() => go(route.hash.slice(1), false))
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <div v-if="trip" ref="root" :data-pref="prefs[0]" class="flex flex-col">
    <header class="paper-grain bg-region text-on-region">
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 pt-5 pb-6">
        <RouterLink :to="`/trips/${trip.id}`" class="flex w-fit items-center gap-1 text-label font-bold text-on-region no-underline">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          {{ trip.name || '未命名行程' }}
        </RouterLink>
        <h1 class="text-h2 font-black tracking-[2px]">旅前準備</h1>
        <div class="flex flex-wrap items-center gap-3">
          <RouterLink
            :to="`/trips/${trip.id}/prep/practice`"
            class="flex h-10 items-center rounded-control bg-paper px-4 text-body-sm font-bold text-ink no-underline active:translate-y-px"
          >開始練習</RouterLink>
          <RouterLink
            :to="`/trips/${trip.id}/book`"
            class="flex h-10 items-center rounded-control border-[1.5px] border-on-region px-4 text-body-sm font-bold text-on-region no-underline active:translate-y-px"
          >旅前小書</RouterLink>
          <label class="flex cursor-pointer items-center gap-2 text-body-sm">
            <input v-model="onlyMust" type="checkbox" class="size-4 accent-(--region-on)" />
            只看必備
          </label>
        </div>
      </div>
    </header>

    <div class="sticky top-0 z-10 border-b border-line bg-paper px-4 py-2 lg:hidden">
      <SectionNav :items="nav" :active="active" variant="bar" @go="go" />
    </div>

    <div class="mx-auto grid w-full max-w-5xl gap-10 px-6 pt-8 pb-16 lg:grid-cols-[168px_minmax(0,1fr)]">
      <aside class="max-lg:hidden">
        <div class="scroll-quiet sticky top-8 max-h-[calc(100dvh-var(--spacing-header)-64px)] overflow-y-auto">
          <SectionNav :items="nav" :active="active" variant="side" @go="go" />
        </div>
      </aside>

      <div class="flex min-w-0 flex-col gap-10">
        <p v-if="loading" class="text-body-sm text-sub">載入中</p>

        <section v-if="todayPlaces.length" id="today" class="flex scroll-mt-16 flex-col gap-2 lg:scroll-mt-8" aria-labelledby="today-title">
          <h2 id="today-title" class="text-h3 font-black tracking-[2px]">今天</h2>
          <ul class="flex flex-col">
            <li v-for="p in todayPlaces" :key="p.key" class="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
              <RegionChip :pref="p.pref" :size="10" class="rounded-full" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span v-if="p.kana" lang="ja" class="text-caption tracking-kana text-sub">{{ p.kana }}</span>
                <span class="flex flex-wrap items-baseline gap-x-2">
                  <span lang="ja" class="text-title font-black">{{ p.ja }}</span>
                  <span v-if="p.kind === 'station'" class="text-caption text-sub">車站・{{ p.near }}</span>
                </span>
              </span>
              <span v-if="p.romaji" class="shrink-0 font-latin text-body-sm text-sub">{{ p.romaji }}</span>
              <SpeakButton :text="p.kana || p.ja" :label="p.ja" />
            </li>
          </ul>
        </section>

        <section id="places" class="flex scroll-mt-16 flex-col gap-2 lg:scroll-mt-8" aria-labelledby="places-title">
          <h2 id="places-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
            地名與車站<span class="font-latin text-body font-normal tracking-normal text-sub">{{ places.length }}</span>
          </h2>
          <ul class="flex flex-col">
            <li v-for="p in places" :key="p.key" class="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
              <RegionChip :pref="p.pref" :size="10" class="rounded-full" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span v-if="p.kana" lang="ja" class="text-caption tracking-kana text-sub">{{ p.kana }}</span>
                <span class="flex flex-wrap items-baseline gap-x-2">
                  <span lang="ja" class="text-title font-black">{{ p.ja }}</span>
                  <span v-if="p.kind === 'station'" class="text-caption text-sub">車站・{{ p.near }}</span>
                  <span v-else-if="p.zh" class="text-caption text-sub">{{ p.zh }}</span>
                </span>
                <span class="text-caption text-sub">{{ dayLabel(p) }}<template v-if="p.en">・{{ p.en }}</template></span>
              </span>
              <span v-if="p.romaji" class="shrink-0 font-latin text-body-sm text-sub max-sm:hidden">{{ p.romaji }}</span>
              <SpeakButton :text="p.kana || p.ja" :label="p.ja" />
            </li>
            <li v-if="!places.length && !loading" class="py-2.5 text-body-sm text-sub">行程裡還沒有景點</li>
          </ul>
        </section>

        <section
          v-for="t in groups"
          :id="t.key"
          :key="t.key"
          class="flex scroll-mt-16 flex-col gap-4 lg:scroll-mt-8"
          :aria-labelledby="`${t.key}-title`"
        >
          <h2 :id="`${t.key}-title`" class="flex items-baseline gap-2 text-h3 font-black tracking-[2px]">
            {{ t.label }}<span class="text-body-sm font-normal tracking-normal text-sub">{{ t.sub }}</span>
          </h2>
          <div v-for="g in t.groups" :id="`${t.key}-${g.situation}`" :key="g.situation" class="flex scroll-mt-16 flex-col lg:scroll-mt-8">
            <h3 class="flex items-center gap-2 text-label font-bold tracking-section">
              {{ SITUATION_LABEL[g.situation] ?? g.situation }}
              <span class="h-px flex-1 bg-line" aria-hidden="true"></span>
            </h3>
            <ul class="flex flex-col">
              <PhraseRow v-for="p in g.items" :key="p.id" :phrase="p" />
            </ul>
          </div>
        </section>

        <section v-if="words.length && !onlyMust" id="words" class="flex scroll-mt-16 flex-col gap-2 lg:scroll-mt-8" aria-labelledby="words-title">
          <h2 id="words-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
            地區特色<span class="font-latin text-body font-normal tracking-normal text-sub">{{ words.length }}</span>
          </h2>
          <ul class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <li v-for="w in words" :key="w.key" class="flex items-center gap-3 border-b border-line-soft py-2.5">
              <RegionChip :pref="w.pref" :size="10" class="rounded-full" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span lang="ja" class="text-caption tracking-kana text-sub">{{ w.kana }}</span>
                <span lang="ja" class="truncate text-body font-bold">{{ w.ja }}</span>
                <span v-if="w.zh" class="truncate text-caption text-sub">{{ w.zh }}</span>
              </span>
              <SpeakButton :text="w.kana || w.ja" :label="w.ja" />
            </li>
          </ul>
        </section>

        <section v-if="!onlyMust" id="limited" class="flex scroll-mt-16 flex-col gap-5 lg:scroll-mt-8" aria-labelledby="limited-title">
          <h2 id="limited-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
            期間限定<span v-if="timed.length + tripFinds.length" class="font-latin text-body font-normal tracking-normal text-sub">{{ timed.length + tripFinds.length }}</span>
          </h2>
          <TimedList v-if="timed.length" :items="timed" detailed />
          <div class="flex flex-col gap-3">
            <h3 class="flex items-center gap-2 text-label font-bold tracking-section">
              截圖
              <span class="h-px flex-1 bg-line" aria-hidden="true"></span>
              <button
                type="button"
                class="h-8 rounded-control border border-line bg-paper px-3 text-caption font-normal tracking-normal text-ink hover:bg-surface"
                @click="gallery?.add()"
              >新增</button>
              <RouterLink v-if="finds.finds.length" to="/limited" class="text-caption font-normal tracking-normal text-sub">全部</RouterLink>
            </h3>
            <FindGallery ref="gallery" :finds="tripFinds" :trip-id="trip.id" columns="narrow" />
          </div>
          <div class="flex flex-col gap-3">
            <h3 class="flex items-center gap-2 text-label font-bold tracking-section">
              連鎖店<span class="h-px flex-1 bg-line" aria-hidden="true"></span>
            </h3>
            <ChainSearch />
          </div>
        </section>

        <p class="text-caption text-sub">地名念法取自 Wikidata、OpenStreetMap、維基百科；會話為編輯整理，尚待校對。</p>
      </div>
    </div>
  </div>
  <section v-else class="mx-auto w-full max-w-3xl px-6 py-9">
    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>
