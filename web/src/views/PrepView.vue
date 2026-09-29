<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import PhraseRow from '../components/PhraseRow.vue'
import RegionChip from '../components/RegionChip.vue'
import SpeakButton from '../components/SpeakButton.vue'
import TimedList from '../components/TimedList.vue'
import { usePrep } from '../composables/prep'
import { type Phrase, type PrepPlace, SITUATION_LABEL } from '../services/prep'
import { overlapping } from '../services/timed'
import { dayDate, shortDate } from '../services/trip'
import { useCatalogStore } from '../stores/catalog'
import { useUserStore } from '../stores/user'

// 旅前準備（UX-FLOW.md D1、D2、D4）：這趟會遇到的日文。地名與車站 → 聽 → 說 → 讀 → 地區特色。
// 旅途中（ongoing）頂部先列今天的地名。
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const { trip, prefs, places, phrases, words, loading, todayIndex } = usePrep(() => props.id)

// 期間限定（行程日期內、所在縣）：例如出發時已經觀測到的紅葉
const catalog = useCatalogStore()
onMounted(() => void catalog.loadTimed())
const timed = computed(() => {
  const t = trip.value
  if (!t?.start_date) return []
  return overlapping(catalog.timed ?? [], t.start_date, t.end_date ?? t.start_date, prefs.value)
})

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
</script>

<template>
  <div v-if="trip" :data-pref="prefs[0]" class="flex flex-col">
    <header class="bg-region text-on-region">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 pt-5 pb-6">
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
          <label class="flex cursor-pointer items-center gap-2 text-body-sm">
            <input v-model="onlyMust" type="checkbox" class="size-4 accent-(--region-on)" />
            只看必備
          </label>
        </div>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 pt-8 pb-16">
      <p v-if="loading" class="text-body-sm text-sub">載入中</p>

      <section v-if="todayPlaces.length" class="flex flex-col gap-2" aria-labelledby="today-title">
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

      <section class="flex flex-col gap-2" aria-labelledby="places-title">
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

      <section v-for="t in groups" :key="t.key" class="flex flex-col gap-4" :aria-labelledby="`${t.key}-title`">
        <h2 :id="`${t.key}-title`" class="flex items-baseline gap-2 text-h3 font-black tracking-[2px]">
          {{ t.label }}<span class="text-body-sm font-normal tracking-normal text-sub">{{ t.sub }}</span>
        </h2>
        <div v-for="g in t.groups" :key="g.situation" class="flex flex-col">
          <h3 class="flex items-center gap-2 text-label font-bold tracking-section">
            {{ SITUATION_LABEL[g.situation] ?? g.situation }}
            <span class="h-px flex-1 bg-line" aria-hidden="true"></span>
          </h3>
          <ul class="flex flex-col">
            <PhraseRow v-for="p in g.items" :key="p.id" :phrase="p" />
          </ul>
        </div>
      </section>

      <section v-if="timed.length && !onlyMust" class="flex flex-col gap-2" aria-labelledby="timed-title">
        <h2 id="timed-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
          期間限定<span class="font-latin text-body font-normal tracking-normal text-sub">{{ timed.length }}</span>
        </h2>
        <TimedList :items="timed" detailed />
      </section>

      <section v-if="words.length && !onlyMust" class="flex flex-col gap-2" aria-labelledby="words-title">
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

      <p class="text-caption text-sub">地名念法取自 Wikidata、OpenStreetMap、維基百科；會話為編輯整理，尚待校對。</p>
    </main>
  </div>
  <section v-else class="mx-auto w-full max-w-3xl px-6 py-9">
    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>
