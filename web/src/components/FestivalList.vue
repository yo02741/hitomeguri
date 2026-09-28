<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Festival } from '../services/bundles'
import CollapseChevron from './CollapseChevron.vue'

// 深度探索「祭典」：依舉行月份分組（跨月的放在第一個月），組內依日文維基瀏覽量。
// 月份列可篩選；沒有月份的放最後「月份未載」。
const props = defineProps<{ festivals: Festival[] }>()

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const thisMonth = new Date().getMonth() + 1
const FIRST = 6

const groups = computed(() => {
  const sorted = [...props.festivals].sort((a, b) => b.views - a.views)
  const out = MONTHS.map((m) => ({
    key: String(m),
    label: `${m}月`,
    items: sorted.filter((f) => f.months?.[0] === m),
  }))
  out.push({ key: 'none', label: '月份未載', items: sorted.filter((f) => !f.months?.length) })
  return out.filter((g) => g.items.length)
})
const hasMonth = computed(() => new Set(groups.value.map((g) => g.key)))

const month = ref<string | null>(null)
const expanded = ref(new Set<string>())
watch(
  () => props.festivals,
  () => {
    month.value = null
    expanded.value = new Set()
  },
)
const shown = computed(() => (month.value ? groups.value.filter((g) => g.key === month.value) : groups.value))

function monthsText(f: Festival): string {
  const ms = f.months ?? []
  if (ms.length < 2) return ''
  // 連續的月份寫成範圍（7–8月），否則列出（1・7月）
  const consecutive = ms.every((m, i) => i === 0 || m === ms[i - 1]! + 1)
  return consecutive ? `${ms[0]}–${ms[ms.length - 1]}月` : `${ms.join('・')}月`
}

const failed = ref(new Set<string>())
function image(f: Festival) {
  const img = f.images?.[0]
  return img && !failed.value.has(img.url) ? img : undefined
}
function mapUrl(f: Festival): string {
  return `https://www.google.com/maps/search/?api=1&query=${f.location!.lat},${f.location!.lng}`
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- 月份：文字索引列，選中的加底線；沒有祭典的月份不能選 -->
    <nav class="flex flex-wrap gap-x-3.5 gap-y-1" aria-label="月份">
      <button
        type="button"
        class="border-b-2 pb-0.5 text-label"
        :class="month === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink'"
        :aria-pressed="month === null"
        @click="month = null"
      >
        不限
      </button>
      <button
        v-for="m in MONTHS"
        :key="m"
        type="button"
        class="border-b-2 pb-0.5 font-latin text-label disabled:opacity-40"
        :class="[
          month === String(m) ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink',
          m === thisMonth && month !== String(m) ? 'text-ink' : '',
        ]"
        :disabled="!hasMonth.has(String(m))"
        :aria-pressed="month === String(m)"
        @click="month = month === String(m) ? null : String(m)"
      >
        {{ m }}月
      </button>
    </nav>

    <div v-for="g in shown" :key="g.key" class="flex flex-col gap-3">
      <h3 class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub">
        {{ g.label }}<span class="font-latin font-normal tracking-normal">{{ g.items.length }}</span>
      </h3>
      <ul class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <li
          v-for="f in expanded.has(g.key) || month ? g.items : g.items.slice(0, FIRST)"
          :key="f.id"
          class="flex gap-3 rounded-card border border-line bg-paper p-3"
        >
          <div v-if="f.images?.length" class="size-24 shrink-0 overflow-hidden rounded-control bg-placeholder">
            <img
              v-if="image(f)"
              :src="image(f)!.url"
              :alt="f.name.ja"
              loading="lazy"
              referrerpolicy="no-referrer"
              class="size-full object-cover"
              @error="failed = new Set(failed).add(image(f)!.url)"
            />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="flex flex-col">
              <span v-if="f.name.kana" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ f.name.kana }}</span>
              <span class="flex flex-wrap items-baseline gap-x-2">
                <span lang="ja" class="text-body font-bold">{{ f.name.ja }}</span>
                <span v-if="f.name.zh_tw && f.name.zh_tw !== f.name.ja" class="text-body-sm text-sub">{{ f.name.zh_tw }}</span>
                <span v-if="monthsText(f)" class="font-latin text-caption font-bold">{{ monthsText(f) }}</span>
              </span>
            </div>
            <p
              v-if="f.summary"
              :lang="f.summary.lang === 'ja' ? 'ja' : undefined"
              class="line-clamp-3 text-body-sm leading-[1.75]"
            >{{ f.summary.text }}</p>
            <div class="mt-auto flex flex-wrap gap-x-3 text-caption text-sub">
              <span v-if="f.summary">{{ f.summary.license }}</span>
              <a :href="f.summary?.source_url ?? f.sources[0]!.url" target="_blank" rel="noopener" class="text-sub">維基百科</a>
              <a v-if="f.location" :href="mapUrl(f)" target="_blank" rel="noopener" class="text-sub">地圖</a>
            </div>
          </div>
        </li>
      </ul>
      <button
        v-if="!month && g.items.length > FIRST && !expanded.has(g.key)"
        type="button"
        class="flex h-10 w-fit items-center gap-2 rounded-control border border-line px-4 text-label font-bold text-ink hover:bg-surface"
        @click="expanded = new Set(expanded).add(g.key)"
      >
        <CollapseChevron :open="true" />
        全部 <span class="font-latin">{{ g.items.length }}</span> 項
      </button>
    </div>
  </div>
</template>
