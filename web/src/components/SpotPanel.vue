<script setup lang="ts">
import { computed } from 'vue'

import type { Spot } from '../services/bundles'
import { canSpeak, speakJa } from '../services/tts'

const props = defineProps<{ spot: Spot | null; loading?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const image = computed(() => props.spot?.images[0])
const category = computed(() => props.spot?.tags.filter((t) => !t.startsWith('guide-')) ?? [])
const station = computed(() => props.spot?.nearest_stations?.[0])
const showZh = computed(() => props.spot && props.spot.name.zh_tw !== props.spot.name.ja)
const mapsUrl = computed(() => {
  if (!props.spot) return ''
  const { lat, lng } = props.spot.location
  const q = encodeURIComponent(`${props.spot.name.ja} ${lat},${lng}`)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
})

function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('wikidata')) return 'Wikidata'
    if (host.includes('openstreetmap')) return 'OpenStreetMap'
    return host
  } catch {
    return url
  }
}

function distance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}
</script>

<template>
  <section
    v-if="spot"
    :data-pref="spot.prefecture"
    class="flex h-full flex-col overflow-y-auto bg-paper text-ink"
    aria-label="景點"
  >
    <div class="relative h-[170px] shrink-0 bg-placeholder">
      <img
        v-if="image"
        :src="image.url"
        :alt="spot.name.ja"
        class="size-full object-cover"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <a
        v-if="image"
        :href="image.source_url"
        target="_blank"
        rel="noopener"
        class="absolute right-2 bottom-2 max-w-[85%] truncate rounded-tag bg-ink/50 px-1.5 text-[11px] text-white no-underline"
      >{{ image.author }} / {{ image.license }}</a>
      <button
        type="button"
        aria-label="關閉"
        class="absolute top-2 right-2 grid size-tap place-items-center rounded-full bg-paper/90 text-ink"
        @click="emit('close')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-3.5 bg-region px-5 py-4 text-on-region">
      <div class="flex min-w-0 flex-col gap-px">
        <span v-if="spot.name.kana" lang="ja" class="text-caption tracking-kana opacity-85">{{ spot.name.kana }}</span>
        <h2 lang="ja" class="text-h2 font-black tracking-name">{{ spot.name.ja }}</h2>
        <span v-if="spot.name.romaji" class="font-latin text-base font-semibold tracking-romaji uppercase">{{ spot.name.romaji }}</span>
      </div>
      <button
        v-if="canSpeak()"
        type="button"
        :aria-label="`播放 ${spot.name.ja}`"
        class="ml-auto grid size-tap shrink-0 place-items-center rounded-full border-[1.5px] border-on-region bg-transparent text-on-region"
        @click="speakJa(spot.name.kana || spot.name.ja)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
    </div>

    <div class="flex flex-col px-5 pt-0.5">
      <div v-if="showZh" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">中文</span><span>{{ spot.name.zh_tw }}</span>
      </div>
      <div v-if="station" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span lang="ja" class="w-[72px] shrink-0 text-sub">最寄駅</span>
        <span class="flex flex-wrap items-baseline gap-x-2">
          <span lang="ja">{{ station.name.ja }}</span>
          <span v-if="station.name.kana" lang="ja" class="text-caption text-sub">{{ station.name.kana }}</span>
          <span class="font-latin text-caption text-sub">{{ distance(station.distance_m) }}</span>
        </span>
      </div>
      <div v-if="category.length" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">分類</span><span>{{ category.join('　') }}</span>
      </div>
    </div>

    <p v-if="spot.summary_zh" class="mx-5 mt-3.5 text-body-sm leading-[1.8]">{{ spot.summary_zh }}</p>

    <div class="mx-5 mt-2 flex flex-wrap gap-x-3 text-caption text-sub">
      <span>來源</span>
      <a v-for="s in spot.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener" class="text-sub">{{ sourceLabel(s.url) }}</a>
    </div>

    <div class="mt-auto flex gap-2 border-t border-line px-5 pt-3.5 pb-5">
      <a
        :href="mapsUrl"
        target="_blank"
        rel="noopener"
        class="flex h-11 grow items-center justify-center rounded-control bg-region-strong px-4 text-body-sm font-bold text-white no-underline active:translate-y-px"
      >在 Google Maps 開啟</a>
    </div>
  </section>
  <section v-else-if="loading" class="grid h-full place-items-center bg-paper text-body-sm text-sub">載入中</section>
</template>
