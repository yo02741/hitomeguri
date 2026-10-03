<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Festival } from '../services/bundles'
import { FESTIVAL_FIRST as FIRST, FESTIVAL_MONTHS as MONTHS, festivalAnchor, festivalGroups } from '../services/festivals'
import { prefectureFullName } from '../data/regions'
import CollapseChevron from './CollapseChevron.vue'
import WebSearchLink from './WebSearchLink.vue'
import SummaryText from './SummaryText.vue'

// 深度探索「祭典」：依舉行月份分組（跨月的放在第一個月），1 到 12 月，組內依日文維基瀏覽量。
// 月份列可篩選；沒有月份的放最後「月份未載」。
// 月份篩選與展開的組由深度探索頁保管（段落列第二列也能換月份；去地圖再回來時還原，DESIGN.md §7.5c）。
const props = defineProps<{ festivals: Festival[] }>()
const month = defineModel<string | null>('month', { default: null })
const expanded = defineModel<Set<string>>('expanded', { default: () => new Set<string>() })
// 「在地圖上看」：頁面先記下這張卡再換頁
const emit = defineEmits<{ map: [f: Festival] }>()

const thisMonth = new Date().getMonth() + 1

const groups = computed(() => festivalGroups(props.festivals))
const hasMonth = computed(() => new Set(groups.value.map((g) => g.key)))
const shown = computed(() => (month.value ? groups.value.filter((g) => g.key === month.value) : groups.value))

function monthsText(f: Festival): string {
  const ms = f.months ?? []
  if (ms.length < 2) return ''
  // 連續的月份寫成範圍（7–8月），否則列出（1・7月）
  const consecutive = ms.every((m, i) => i === 0 || m === ms[i - 1]! + 1)
  return consecutive ? `${ms[0]}–${ms[ms.length - 1]}月` : `${ms.join('・')}月`
}

const failed = ref(new Set<string>())
// 圖片載入失敗時改用底色；error 可能觸發不只一次，用原始網址記錄
function markFailed(f: Festival) {
  const url = f.images?.[0]?.url
  if (url && !failed.value.has(url)) failed.value = new Set(failed.value).add(url)
}
function image(f: Festival) {
  const img = f.images?.[0]
  return img && !failed.value.has(img.url) ? img : undefined
}
// 在我們的地圖上標出位置（縣的地圖頁＋地點標記）
function mapLink(f: Festival) {
  return { path: `/map/${f.prefecture}`, query: { at: `${f.location!.lat},${f.location!.lng}`, label: f.name.ja } }
}
// 一般點擊交給頁面；按著修飾鍵（開新分頁）照瀏覽器預設
function onMap(e: MouseEvent, f: Festival) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  emit('map', f)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- 月份：文字索引列，選中的加底線；沒有祭典的月份不能選 -->
    <nav class="flex flex-wrap gap-x-3.5 gap-y-1 pointer-coarse:-mx-1.5 pointer-coarse:-my-2.5 pointer-coarse:gap-x-0.5 pointer-coarse:gap-y-0" aria-label="月份">
      <button
        type="button"
        class="text-label pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="month === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="month === null"
        @click="month = null"
      >
        <span class="block border-b-2 border-inherit pb-0.5">不限</span>
      </button>
      <button
        v-for="m in MONTHS"
        :key="m"
        type="button"
        class="font-latin text-label disabled:opacity-40 pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="[
          month === String(m) ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink',
          m === thisMonth && month !== String(m) ? 'text-ink' : '',
        ]"
        :disabled="!hasMonth.has(String(m))"
        :aria-pressed="month === String(m)"
        @click="month = month === String(m) ? null : String(m)"
      >
        <span class="block border-b-2 border-inherit pb-0.5">{{ m }}月</span>
      </button>
    </nav>

    <!-- 畫面外的月份先不畫（content-visibility），高度先用估計值，畫過一次就記住實際高度 -->
    <div v-for="g in shown" :key="g.key" class="flex flex-col gap-3 cv-auto [contain-intrinsic-size:auto_480px]">
      <h3 class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub">
        {{ g.label }}<span class="font-latin font-normal tracking-normal">{{ g.items.length }}</span>
      </h3>
      <ul class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <li
          v-for="f in expanded.has(g.key) || month ? g.items : g.items.slice(0, FIRST)"
          :id="festivalAnchor(f.id)"
          :key="f.id"
          class="flex scroll-mt-24 gap-3 rounded-card border border-line bg-paper p-3 lg:scroll-mt-8"
        >
          <div v-if="f.images?.length" class="size-24 shrink-0 overflow-hidden rounded-control bg-placeholder">
            <img
              v-if="image(f)"
              data-photo
              :src="image(f)!.url"
              :alt="f.name.ja"
              loading="lazy"
              referrerpolicy="no-referrer"
              class="size-full object-cover"
              @error="markFailed(f)"
            />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="flex items-start gap-2">
              <div class="flex min-w-0 flex-1 flex-col">
                <span v-if="f.name.kana" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ f.name.kana }}</span>
                <span class="flex flex-wrap items-baseline gap-x-2">
                  <span lang="ja" class="text-body font-bold">{{ f.name.ja }}</span>
                  <span v-if="f.name.zh_tw && f.name.zh_tw !== f.name.ja" class="text-body-sm text-sub">{{ f.name.zh_tw }}</span>
                  <!-- 沒有中文名時放英文名（取自 Wikidata） -->
                  <span v-else-if="f.name.en" lang="en" class="text-body-sm text-sub">{{ f.name.en }}</span>
                  <span v-if="monthsText(f)" class="font-latin text-caption font-bold">{{ monthsText(f) }}</span>
                </span>
              </div>
              <WebSearchLink :name="f.name.ja" :context="prefectureFullName(f.prefecture)" class="-mt-1 -mr-1" />
            </div>
            <SummaryText v-if="f.summary" :summary="f.summary" :clamp="f.summary.text_zh ? 2 : 3" />
            <div class="mt-auto flex flex-wrap gap-x-3 text-caption text-sub pointer-coarse:-my-3.5 pointer-coarse:items-center">
              <span v-if="f.summary">{{ f.summary.license }}</span>
              <a :href="f.summary?.source_url ?? f.sources[0]!.url" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-3.5">維基百科</a>
              <RouterLink v-if="f.location" v-slot="{ href }" :to="mapLink(f)" custom>
                <a :href="href" class="text-sub pointer-coarse:py-3.5" @click="onMap($event, f)">在地圖上看</a>
              </RouterLink>
            </div>
          </div>
        </li>
      </ul>
      <button
        v-if="!month && g.items.length > FIRST && !expanded.has(g.key)"
        type="button"
        class="flex h-10 w-fit items-center gap-2 rounded-control border border-line px-4 text-label font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
        @click="expanded = new Set(expanded).add(g.key)"
      >
        <CollapseChevron :open="true" />
        全部 <span class="font-latin">{{ g.items.length }}</span> 項
      </button>
    </div>
  </div>
</template>
