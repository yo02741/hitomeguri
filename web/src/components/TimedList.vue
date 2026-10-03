<script setup lang="ts">
import { computed } from 'vue'

import { regionOf } from '../data/regions'
import type { TimedItem } from '../services/bundles'
import { dateRange } from '../services/timed'

// 期間限定列（DESIGN.md §7.8）：左名稱，右日期範圍與「來源・範圍」。detailed 時多一行摘要。
// 最下面列出出典（氣象廳的公共データ利用規約要求標示）。
const props = defineProps<{ items: TimedItem[]; detailed?: boolean }>()

function scope(t: TimedItem): string {
  if (t.scope === 'national') return '全國'
  return (t.prefectures ?? []).map((p) => regionOf(p)?.name.ja).filter(Boolean).join('・')
}
const sources = computed(() => {
  const out = new Map<string, string>()
  for (const t of props.items) if (t.source_label && !out.has(t.source_label)) out.set(t.source_label, t.source_url)
  return [...out.entries()]
})
</script>

<template>
  <div class="flex flex-col">
    <ul class="flex flex-col">
      <li v-for="t in items" :key="t.id" class="flex items-start gap-3 border-b border-line-soft py-2 text-body-sm last:border-b-0">
        <a :href="t.source_url" target="_blank" rel="noopener" class="flex min-w-0 flex-1 flex-col text-ink no-underline hover:underline active:underline">
          <span lang="ja" class="font-bold">{{ t.title.ja }}</span>
          <span class="text-caption text-sub">{{ t.title.zh_tw }}</span>
          <span v-if="detailed && t.summary_zh" class="mt-0.5 text-caption text-ink-2">{{ t.summary_zh }}</span>
        </a>
        <span class="flex shrink-0 flex-col items-end text-caption text-sub">
          <span class="font-latin">{{ dateRange(t) }}</span>
          <span lang="ja">{{ [t.brand, scope(t)].filter(Boolean).join('・') }}</span>
        </span>
      </li>
    </ul>
    <p v-for="[label, url] in sources" :key="label" class="mt-1.5 text-caption text-sub">
      <a :href="url" target="_blank" rel="noopener" lang="ja" class="text-sub pointer-coarse:py-4">{{ label }}</a>
    </p>
  </div>
</template>
