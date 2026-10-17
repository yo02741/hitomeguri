<script setup lang="ts">
import { ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { dateText, type HeardPageData } from '../../../game/ui/notebook'

import { useRows } from './rows'

// 手帳「聽來的」：路上聽到的每一句事實與出處（只有資料裡有出處的才會進來）。P2 由事實樣板的系統填。
// 每一列的「出處」可以用十字鍵上下選、A 打開（新分頁）。
defineProps<{ data: HeardPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)

function press(b: Button): boolean {
  if (rows.move(b)) return true
  if (b === 'A') {
    const a = document.activeElement
    if (a instanceof HTMLAnchorElement && root.value?.contains(a)) {
      a.click()
      return true
    }
  }
  return false
}
defineExpose({ focusFirst: rows.focusFirst, press })
</script>

<template>
  <div ref="root" class="nb-page">
    <p v-if="data.pending" class="nb-sub heard-wait" role="status">讀取中</p>
    <p v-if="!data.facts.length && !data.pending" class="nb-empty">還沒有聽來的事。</p>
    <ul v-else class="heard">
      <li v-for="f in data.facts" :key="f.id" class="heard-row">
        <p class="heard-text">{{ f.text }}</p>
        <p class="nb-sub heard-meta">
          <span v-if="f.where" lang="ja">{{ f.where.ja }}　</span>
          <span v-if="f.date">{{ dateText(f.date) }}　</span>
          <a :href="f.source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`出處：${f.source.label}（開新分頁）`" data-row>出處</a>
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.heard {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7em;
}
.heard-text,
.heard-meta {
  margin: 0;
}
.heard-wait {
  margin: 0 0 0.7em;
}
</style>
