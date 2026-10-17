<script setup lang="ts">
import { computed } from 'vue'

import { type Minimap, miniWindow } from '../../game/engine/minimap'
import type { Dir, MapName } from '../../game/engine/types'

import MapCanvas from './MapCanvas.vue'

// 畫面右上角的小地圖（P4，像《楓之谷》）：這張地圖的簡化樣子、自己的位置與面向、下面一行地名。
// 一格 tile 一個點（跟遊戲畫面同一個放大倍數），最多 view.w×view.h 格，自己在中間、到地圖邊停。
// 點一下（或 M 鍵、設定）收起成一個小鈕，再點打開。室內、取景框、坐車時 PlayView 不放這個元件。
// 顏色只用 --color-px-*；讀屏不讀圖（aria-hidden 的 canvas），按鈕有名字。
const props = defineProps<{
  mini: Minimap
  player: { x: number; y: number; dir: Dir }
  name: MapName | null
  open: boolean
  /** 一個邏輯像素是幾 CSS px（--u） */
  scale: number
  /** 最多看得到幾格 */
  view: { w: number; h: number }
}>()
const emit = defineEmits<{ toggle: [] }>()

const win = computed(() => miniWindow(props.mini, props.player.x, props.player.y, props.view.w, props.view.h))
</script>

<template>
  <button
    v-if="open"
    type="button"
    class="mini mini-open"
    :style="{ '--u': `${scale}px` }"
    :aria-label="name ? `小地圖：${name.ja}。收起` : '收起小地圖'"
    aria-expanded="true"
    @pointerdown.stop
    @click.stop="emit('toggle')"
  >
    <MapCanvas :mini="mini" :win="win" :px="scale" :player="player" />
    <span v-if="name" class="mini-name" lang="ja" aria-hidden="true">{{ name.ja }}</span>
  </button>
  <button
    v-else
    type="button"
    class="mini mini-shut"
    :style="{ '--u': `${scale}px` }"
    aria-label="打開小地圖"
    aria-expanded="false"
    @pointerdown.stop
    @click.stop="emit('toggle')"
  >
    <svg viewBox="0 0 7 7" aria-hidden="true" shape-rendering="crispEdges">
      <path d="M0 0h7v1H0zM0 6h7v1H0zM0 1h1v5H0zM6 1h1v5H6zM3 2h1v1H3zM2 3h3v1H2z" fill="currentColor" />
    </svg>
  </button>
</template>

<style scoped>
/* 小框：外面一圈墨色、裡面一圈白（GBA 的框縮小版），不擋畫面太多 */
.mini {
  position: absolute;
  top: calc(var(--u) * 4);
  right: calc(var(--u) * 4);
  margin: 0;
  padding: max(1px, var(--u));
  font: inherit;
  color: var(--color-px-ink);
  background: var(--color-px-white);
  border: max(1px, var(--u)) solid var(--color-px-ink);
  border-radius: max(1px, var(--u));
  box-shadow: 0 max(1px, var(--u)) 0 color-mix(in oklab, var(--color-px-ink) 40%, transparent);
  cursor: pointer;
  pointer-events: auto;
}
.mini-open {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.mini-name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: calc(var(--u) * 1) calc(var(--u) * 1) 0;
  font-family: var(--font-game-ja);
  font-size: max(10px, calc(var(--u) * 5));
  line-height: calc(var(--u) * 6);
  text-align: center;
  letter-spacing: 0.04em;
}
.mini-shut {
  display: grid;
  place-items: center;
  width: calc(var(--u) * 12);
  height: calc(var(--u) * 12);
  padding: 0;
}
.mini-shut svg {
  width: calc(var(--u) * 7);
  height: calc(var(--u) * 7);
}
/* 觸控：點的範圍撐到 44px（框本身大小不變） */
@media (pointer: coarse) {
  .mini-shut::before {
    content: '';
    position: absolute;
    inset: calc((44px - var(--u) * 12) / -2);
  }
}
.mini:focus-visible {
  outline: 2px solid var(--color-px-gold-1);
  outline-offset: 1px;
}
</style>
