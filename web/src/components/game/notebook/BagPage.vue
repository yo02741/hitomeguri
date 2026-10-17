<script setup lang="ts">
import { ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { type BagEntry, type BagPageData, dateText } from '../../../game/ui/notebook'
import ItemCard from '../systems/ItemCard.vue'
import PixelIcon from '../systems/PixelIcon.vue'

import { useRows } from './rows'

// 手帳「行李」（規格 §8.5）：旅費、帶著的東西、吃過的（郷土料理）。品名是資料裡的真名；
// 一列按 A（或點）打開品項卡（類別、簡介第一句、出處、授權），再按一次收起。
defineProps<{ data: BagPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
const open = ref<string | null>(null)

function toggle(e: BagEntry, group: string) {
  const k = `${group}:${e.id}`
  open.value = open.value === k ? null : k
}

function press(b: Button): boolean {
  if (rows.move(b)) return true
  if (b === 'A') {
    const a = document.activeElement
    if (a instanceof HTMLButtonElement && root.value?.contains(a)) a.click()
    return true
  }
  if (b === 'B' && open.value) {
    open.value = null
    return true
  }
  return false
}
defineExpose({ focusFirst: rows.focusFirst, press })
</script>

<template>
  <div ref="root" class="nb-page">
    <dl class="nb-dl">
      <dt>旅費</dt>
      <dd>{{ data.money.toLocaleString('ja-JP') }} 文</dd>
    </dl>
    <p v-if="!data.items.length" class="nb-empty">行李是空的。</p>
    <ul v-else class="bag">
      <li v-for="it in data.items" :key="it.id" class="bag-item">
        <button type="button" class="bag-row" data-row :aria-expanded="open === `i:${it.id}`" @click="toggle(it, 'i')">
          <PixelIcon v-if="it.card" :icon="it.card.icon" :size="2" />
          <span class="bag-name">
            <span lang="ja">{{ it.name.ja }}</span>
            <span v-if="it.name.zh && it.name.zh !== it.name.ja" class="nb-sub">{{ it.name.zh }}</span>
          </span>
          <span class="bag-n">× {{ it.count }}</span>
        </button>
        <div v-if="open === `i:${it.id}` && it.card" class="bag-card"><ItemCard :card="it.card" /></div>
      </li>
    </ul>
    <template v-if="data.eaten.length">
      <h3 class="bag-h">吃過的</h3>
      <ul class="bag">
        <li v-for="it in data.eaten" :key="it.id" class="bag-item">
          <button type="button" class="bag-row" data-row :aria-expanded="open === `e:${it.id}`" @click="toggle(it, 'e')">
            <PixelIcon v-if="it.card" :icon="it.card.icon" :size="2" />
            <span class="bag-name">
              <span lang="ja">{{ it.name.ja }}</span>
              <span v-if="it.date" class="nb-sub">{{ dateText(it.date) }}</span>
            </span>
            <span v-if="it.count > 1" class="bag-n">{{ it.count }} 次</span>
          </button>
          <div v-if="open === `e:${it.id}` && it.card" class="bag-card"><ItemCard :card="it.card" /></div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.bag {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2em;
}
.bag-row {
  display: flex;
  align-items: center;
  gap: 0.6em;
  width: 100%;
  min-height: 2.2em;
  padding: 0.15em 0.4em;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.bag-row[aria-expanded='true'],
.bag-row:focus-visible {
  background: var(--color-px-paper);
}
@media (pointer: coarse) {
  .bag-row {
    min-height: 44px;
  }
}
.bag-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.bag-n {
  margin-left: auto;
  padding-left: 1em;
  white-space: nowrap;
}
.bag-card {
  margin: 0.3em 0 0.5em 2.6em;
  padding: 0.5em 0.6em;
  border: 2px dashed var(--color-px-stone-1);
  border-radius: 4px;
}
.bag-h {
  margin: 0.4em 0 0;
  font-size: 1em;
  font-weight: 700;
}
</style>
