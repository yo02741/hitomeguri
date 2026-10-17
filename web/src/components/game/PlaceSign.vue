<script setup lang="ts">
import type { MapName } from '../../game/engine/types'

// 地名牌（規格 §4）：進到新的地方時從左上一格一格滑下來（steps，像 GBA），3 秒後收回去。
// 減少動態時不滑，直接出現、時間到就收。讀屏由 PlayView 的 aria-live 讀地名，這裡 aria-hidden。
// PlayView 用 :key 換一個新的牌子，3 秒後 v-if 拿掉。
defineProps<{ name: MapName; scale: number }>()
</script>

<template>
  <p class="gba-box place-sign" :style="{ '--u': `${scale}px` }" aria-hidden="true">
    <span lang="ja" class="place-ja">{{ name.ja }}</span>
    <span v-if="name.romaji" class="font-latin place-romaji">{{ name.romaji }}</span>
  </p>
</template>

<style scoped>
.place-sign {
  position: absolute;
  top: calc(var(--u) * 4);
  left: calc(var(--u) * 4);
  margin: 0;
  display: flex;
  flex-direction: column;
  padding: calc(var(--u) * 3) calc(var(--u) * 8) calc(var(--u) * 3);
  pointer-events: none;
  animation: sign-in 3s steps(1, end) both;
}
.place-ja {
  font-family: var(--font-game-ja);
  font-size: max(13px, calc(var(--u) * 8));
  line-height: 1.4;
  letter-spacing: 0.08em;
}
.place-romaji {
  font-size: max(10px, calc(var(--u) * 4.5));
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  line-height: 1.3;
  color: var(--color-px-ink-2);
}
/* 一格一格：上面藏著 → 三段落下 → 停 → 三段收回 */
@keyframes sign-in {
  0% {
    transform: translateY(-150%);
  }
  4% {
    transform: translateY(-100%);
  }
  8% {
    transform: translateY(-45%);
  }
  12%,
  88% {
    transform: none;
  }
  92% {
    transform: translateY(-45%);
  }
  96% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(-150%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .place-sign {
    animation: none;
  }
}
</style>
