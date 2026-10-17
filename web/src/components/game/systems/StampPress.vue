<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { GameSystems } from '../../../game/systems/install'
import type { Panel } from '../../../game/systems/ui'
import { dateText } from '../../../game/ui/notebook'

import StampMark from './StampMark.vue'

// 蓋章（規格 §8.6）：章從上面蓋下來、停住（減少動態時直接出現）。印面只寫資料裡有的（站名的羅馬字、日本100名城 No.53），
// 下面是名字、蓋章地點（名城）、遊戲的日期。蓋好之前已經存檔了（systems 做）。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const v = computed(() => (props.panel.kind === 'stamp' ? props.panel.view : null))
const btn = ref<HTMLButtonElement | null>(null)
const KIND = { station: '站章', sanpai: '參拜印', castle: '名城的章' } as const

function close() {
  props.systems.sfx('confirm')
  props.systems.closePanel()
}
function press(b: Button): boolean {
  if (b === 'A' || b === 'B' || b === 'START') {
    close()
    return true
  }
  return true
}
defineExpose({ press, focusFirst: () => (btn.value?.focus({ preventScroll: true }), true) })
</script>

<template>
  <div v-if="v" class="gba-box sys-box sp" role="dialog" aria-labelledby="sp-title" :class="{ 'is-still': systems.ui.reduced }">
    <div class="sys-body sp-body">
      <div class="sp-paper">
        <span class="sp-mark">
          <StampMark :art="v.art" :name="v.name.ja" :size="3" />
        </span>
      </div>
      <div class="sp-info">
        <p class="nb-sub">{{ KIND[v.kind] }}</p>
        <h2 id="sp-title" class="sys-title" lang="ja">{{ v.name.ja }}</h2>
        <p v-if="v.name.zh" class="nb-sub">{{ v.name.zh }}</p>
        <p v-if="v.face && v.kind !== 'sanpai'" lang="ja">{{ v.face }}</p>
        <p v-if="v.where" class="nb-sub" lang="ja">蓋章地點　{{ v.where }}</p>
        <p v-if="v.date" class="nb-sub">{{ dateText(v.date) }}</p>
        <p v-if="v.source" class="nb-sub">
          <a :href="v.source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`出處：${v.source.label}（開新分頁）`">出處</a>
        </p>
      </div>
    </div>
    <footer class="sys-foot">
      <button ref="btn" type="button" class="nb-btn" @click="close">收起</button>
    </footer>
  </div>
</template>

<style scoped>
.sp-body {
  display: flex;
  gap: 1.2em;
  align-items: center;
  /* 手機直式（面板滿版、換行成兩排）：兩排靠在一起放在中間，章與名字之間不空一大段 */
  align-content: center;
  justify-content: center;
  flex-wrap: wrap;
}
.sp-paper {
  display: grid;
  place-items: center;
  padding: 1em 1.4em;
  background: var(--color-px-paper);
  border: 2px solid var(--color-px-paper-2);
  border-radius: 2px;
}
.sp-mark {
  display: block;
  animation: press 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
}
.sp-info {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  min-width: 0;
}
.sp-info p {
  margin: 0;
}
@keyframes press {
  0% {
    opacity: 0;
    transform: translateY(-40%) scale(1.5);
  }
  55% {
    opacity: 1;
    transform: translateY(0) scale(0.92);
  }
  100% {
    transform: scale(1) rotate(-3deg);
  }
}
.is-still .sp-mark {
  animation: none;
  transform: rotate(-3deg);
}
@media (prefers-reduced-motion: reduce) {
  .sp-mark {
    animation: none;
    transform: rotate(-3deg);
  }
}
</style>
