<script setup lang="ts">
import { type Hint, KEY_NAME } from '../../game/ui/hints'

// 按鍵提示列（P4，使用者要的；桌機才有）：畫面正下方一條很小的按鍵列，像遊戲的按鍵說明，依情境換內容
// （game/ui/hints.ts）。靠左排：走路（5 個鍵）→ 對話（1 個）→ 走路時第一個 Z 留在原地，整條不縮到中間又展開。鍵是小小的鍵帽，後面一個動詞；這個情境的重點（拍攝點上的「拍照」、面前有人的「說話」）亮一點。
// 不放驚嘆號、不放說明句；設定可以關。讀屏：PlayView 把同樣的內容放在畫面的 aria-describedby（這一條 aria-hidden）。
defineProps<{ hints: readonly Hint[] }>()
</script>

<template>
  <ul class="hints" aria-hidden="true">
    <li v-for="h in hints" :key="`${h.key}:${h.label}`" class="hint" :class="{ 'is-hot': h.hot }">
      <span v-if="h.hold" class="hint-pre">按住</span>
      <kbd class="hint-key" :class="{ 'is-wide': KEY_NAME[h.key].length > 1 }">{{ KEY_NAME[h.key] }}</kbd>
      <span class="hint-label">{{ h.label }}</span>
    </li>
  </ul>
</template>

<style scoped>
.hints {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-game);
  font-size: 12px;
  line-height: 18px;
  color: var(--color-px-stone-1);
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
.hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.hint-pre {
  color: var(--color-px-stone-2);
}
/* 鍵帽：墨色底、細的石色框、紙色的字（像 GBA 說明書裡的按鍵圖） */
.hint-key {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 16px;
  padding: 0 3px;
  font-family: var(--font-latin);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-px-paper);
  background: var(--color-px-ink-2);
  border: 1px solid var(--color-px-stone-3);
  border-radius: 3px;
  box-shadow: 0 1px 0 var(--color-px-stone-4);
}
.hint-key.is-wide {
  font-family: var(--font-game);
  font-weight: 400;
  letter-spacing: -0.04em;
}
.is-hot .hint-key {
  color: var(--color-px-ink);
  background: var(--color-px-gold-1);
  border-color: var(--color-px-gold-2);
}
.is-hot .hint-label {
  color: var(--color-px-white);
}
</style>
