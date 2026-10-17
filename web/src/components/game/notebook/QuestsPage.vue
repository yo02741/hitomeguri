<script setup lang="ts">
import { ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { dateText, type QuestsPageData } from '../../../game/ui/notebook'

import { useRows } from './rows'

// 手帳「委託」（規格 §8.5）：進行中的委託（說法是遊戲寫的，東西與地名是資料）、在哪一鎮接的、做完給的旅費。
// 拍到了、找到了的寫「回去找委託的人」。做完的不列。期限過了還沒做好的會自己取消（systems 的 pruneQuests）。
defineProps<{ data: QuestsPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
defineExpose({ focusFirst: rows.focusFirst, press: (b: Button) => rows.move(b) })
</script>

<template>
  <div ref="root" class="nb-page">
    <p v-if="!data.quests.length" class="nb-empty">沒有進行中的委託。</p>
    <ul v-else class="quests">
      <li v-for="q in data.quests" :key="q.id" class="quest" tabindex="0" data-row>
        <p class="quest-text">{{ q.text }}</p>
        <p class="nb-sub quest-meta">
          <span v-if="q.from" lang="ja">{{ q.from.ja }}　</span>
          <span v-if="q.date">{{ dateText(q.date) }}　</span>
          <span>{{ q.reward.toLocaleString('ja-JP') }} 文</span>
        </p>
        <p v-if="q.until" class="nb-sub quest-meta">期限 {{ dateText(q.until) }}</p>
        <p v-if="q.ready" class="quest-ready">回去找委託的人</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.quests {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7em;
}
.quest {
  padding: 0.3em 0.4em;
  border-radius: 3px;
}
.quest:focus-visible {
  background: var(--color-px-paper);
}
.quest p {
  margin: 0;
}
.quest-ready {
  color: var(--color-px-shu-2);
  font-size: 0.85em;
}
</style>
