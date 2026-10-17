<script setup lang="ts">
import { computed } from 'vue'

import { type PlaceName, placeSub } from '../../game/engine/places'
import { NOTICE_SHOW_MS } from '../../game/ui/nearby'

// 走近地標時，畫面上方中間淡淡浮出的地名（P4）：日文，下面一行小字（中文，沒有就念法或羅馬字）。
// 幾秒後淡出（steps，像 GBA）；減少動態時直接出現、直接消失（時間到 PlayView 拿掉）。
// 讀屏由 PlayView 的 aria-live 讀，這裡 aria-hidden。PlayView 用 :key 換新的一個。
// left（邏輯像素）：直拿的手機上方中間放不下（右上有小地圖）時靠左上（那時左上的地名牌已經收起來了）。
const props = defineProps<{ name: PlaceName; scale: number; top: number; maxWidth: number; left?: number }>()
const sub = computed(() => placeSub(props.name))
/** 小字的語言（字型照語言挑）：中文、假名、羅馬字 */
const subLang = computed(() => (sub.value === props.name.zh ? 'zh-Hant' : sub.value === props.name.kana ? 'ja' : 'en'))
</script>

<template>
  <p
    class="toast"
    :class="{ 'is-start': left !== undefined }"
    :style="{
      '--u': `${scale}px`,
      top: `calc(var(--u) * ${top})`,
      left: left !== undefined ? `calc(var(--u) * ${left})` : undefined,
      maxWidth: `${maxWidth}px`,
      animationDuration: `${NOTICE_SHOW_MS}ms`,
    }"
    aria-hidden="true"
  >
    <span lang="ja" class="toast-ja">{{ name.ja }}</span>
    <span v-if="sub" class="toast-sub" :lang="subLang">{{ sub }}</span>
  </p>
</template>

<style scoped>
.toast {
  position: absolute;
  left: 50%;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(var(--u) * 2) calc(var(--u) * 7) calc(var(--u) * 2.5);
  color: var(--color-px-ink);
  background: color-mix(in oklab, var(--color-px-white) 86%, transparent);
  border: max(1px, var(--u)) solid color-mix(in oklab, var(--color-px-ink-2) 70%, transparent);
  border-radius: max(2px, var(--u));
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
  animation-name: toast;
  animation-timing-function: steps(1, end);
  animation-fill-mode: both;
}
.toast.is-start {
  align-items: flex-start;
  transform: none;
}
.toast-ja,
.toast-sub {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast-ja {
  font-family: var(--font-game-ja);
  font-size: max(13px, calc(var(--u) * 7));
  line-height: 1.35;
  letter-spacing: 0.08em;
}
.toast-sub {
  font-size: max(10px, calc(var(--u) * 4.5));
  line-height: 1.3;
  color: var(--color-px-ink-2);
  letter-spacing: 0.06em;
}
/* 淡淡浮出：四段淡入、停著、四段淡出（整段 NOTICE_SHOW_MS） */
@keyframes toast {
  0% {
    opacity: 0;
  }
  3% {
    opacity: 0.3;
  }
  6% {
    opacity: 0.6;
  }
  9%,
  82% {
    opacity: 0.94;
  }
  86% {
    opacity: 0.7;
  }
  90% {
    opacity: 0.45;
  }
  94% {
    opacity: 0.2;
  }
  98%,
  100% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
    opacity: 0.94;
  }
}
</style>
