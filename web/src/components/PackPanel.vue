<script setup lang="ts">
import { computed } from 'vue'

import { packByKey } from '../data/packs'
import { prefectureFullName, regionOf } from '../data/regions'
import type { PackItem } from '../services/bundles'
import VisitedToggle from './VisitedToggle.vue'

// 擴充包的點（人孔蓋、寶可夢中心、城、老舖…）的卡片。不放圖片（著作權），只連到官方頁面或維基。
// 城已經是景點的，可以打開景點卡片；「去過」記在景點上（沒有對到景點的記在這個點）。
const props = defineProps<{ item: PackItem; pack: string }>()
const emit = defineEmits<{ close: []; openSpot: [id: string] }>()
const visitRef = computed(() => ({ id: props.item.s ?? props.item.id, pref: props.item.p, name: props.item.n }))

const def = computed(() => packByKey.get(props.pack))
const group = computed(() => def.value?.groups.find((g) => g.key === props.item.g)?.label ?? '')
const isLid = computed(() => props.item.g === 'lid')
const mapsUrl = computed(() => {
  const it = props.item
  // 人孔蓋在路上，用座標；店家用名稱＋縣名搜尋，對到地點頁
  const q = isLid.value ? `${it.lat},${it.lng}` : `${it.n} ${prefectureFullName(it.p)}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
})
const sourceLabel = computed(() => {
  try {
    const host = new URL(props.item.u).hostname.replace(/^www\./, '')
    if (host === 'local.pokemon.jp') return '官方頁面'
    if (host.includes('openstreetmap')) return 'OpenStreetMap'
    if (host.endsWith('wikipedia.org')) return '維基百科'
    return '官方網站'
  } catch {
    return '來源'
  }
})
</script>

<template>
  <section
    :data-pref="item.p"
    class="flex h-full flex-col overflow-y-auto overscroll-contain bg-paper text-ink max-lg:max-h-[60dvh] land:max-h-none"
    :style="{ '--pack': `var(--color-t-${def?.color ?? 'major'})` }"
    aria-label="擴充包"
  >
    <!-- 手機打橫的左側欄只有兩百多 px 高：名稱帶（含關閉）固定在上面，下面的內容捲動 -->
    <div class="paper-grain flex shrink-0 items-start gap-3 bg-region px-5 pt-4 pb-4 text-on-region land:sticky land:top-0 land:z-[1]">
      <div class="flex min-w-0 flex-col gap-1">
        <span class="flex items-center gap-1.5 text-caption font-bold">
          <span class="size-2.5 rounded-full border-[1.5px] border-on-region bg-(--pack)" aria-hidden="true"></span>
          {{ def?.label }}・{{ group }}
        </span>
        <span v-if="item.h" lang="ja" class="text-caption tracking-kana">{{ item.h }}</span>
        <h2 lang="ja" class="text-h3 font-black tracking-name">{{ item.n }}</h2>
        <span v-if="item.z" class="text-body-sm">{{ item.z }}</span>
      </div>
      <button
        type="button"
        aria-label="關閉"
        class="ml-auto grid size-tap shrink-0 place-items-center rounded-full bg-paper/90 text-ink active:not-disabled:translate-y-px"
        @click="emit('close')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div class="flex flex-col px-5 pt-0.5">
      <div v-if="item.no" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">名城番號</span>
        <span><span class="font-latin font-semibold">No.{{ item.no }}</span><span lang="ja" class="ml-2 text-sub">{{ group }}</span></span>
      </div>
      <div v-if="item.st?.length" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">スタンプ</span>
        <ul lang="ja" class="flex min-w-0 flex-col gap-0.5">
          <li v-for="place in item.st" :key="place">{{ place }}</li>
        </ul>
      </div>
      <div v-if="item.f" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">創業</span><span class="font-latin">{{ item.f }}</span>
      </div>
      <div class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">地區</span><span lang="ja">{{ regionOf(item.p)?.name.ja }}</span>
      </div>
      <div v-if="item.pk?.length" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">寶可夢</span>
        <span class="flex flex-wrap gap-x-3 gap-y-1">
          <span v-for="[no, name] in item.pk" :key="no" class="flex items-baseline gap-1">
            <span lang="ja">{{ name }}</span><span class="font-latin text-caption text-sub">No.{{ no }}</span>
          </span>
        </span>
      </div>
      <div v-if="item.a" class="flex border-b border-line-soft py-2.5 text-body-sm">
        <span class="w-[72px] shrink-0 text-sub">地址</span><span lang="ja">{{ item.a }}</span>
      </div>
      <button
        v-if="item.s"
        type="button"
        class="flex min-h-tap items-center justify-between border-b border-line-soft py-2.5 text-left text-body-sm font-bold text-ink hover:text-sub active:text-sub"
        @click="emit('openSpot', item.s)"
      >
        景點介紹
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <a
        v-if="item.w && item.w !== item.u"
        :href="item.w"
        target="_blank"
        rel="noopener"
        class="flex min-h-tap items-center border-b border-line-soft py-2.5 text-body-sm text-ink no-underline hover:text-sub active:text-sub"
      >維基百科</a>
    </div>

    <!-- 字寬的年代字型放不下一行時，Google Maps 換到下一行撐滿 -->
    <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-line px-5 pt-3.5 pb-5">
      <VisitedToggle :spot="visitRef" class="border border-line" />
      <a
        :href="item.u"
        target="_blank"
        rel="noopener"
        class="flex h-11 items-center justify-center rounded-control border border-line px-4 text-body-sm font-bold whitespace-nowrap text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px"
      >{{ sourceLabel }}</a>
      <a
        :href="mapsUrl"
        target="_blank"
        rel="noopener"
        class="flex h-11 grow basis-44 items-center justify-center rounded-control bg-region-strong px-4 text-body-sm font-bold whitespace-nowrap text-white no-underline active:translate-y-px"
      >在 Google Maps 開啟</a>
    </div>
  </section>
</template>
