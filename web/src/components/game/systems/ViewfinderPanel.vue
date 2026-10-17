<script setup lang="ts">
import { computed, ref } from 'vue'

import type { GameSystems } from '../../../game/systems/install'
import type { Panel } from '../../../game/systems/ui'

// 取景框（規格 §8.4）：框本身是 canvas 畫的（game.setOverlay），這裡只有拍攝點的名字與三個按鈕
// （拍照＝A、變焦＝相機鍵、收起＝B），給滑鼠與讀屏用。十字鍵移框（放大時）。
// 不擋構圖：名字在左上角出現一下就淡掉（讀屏從對話框的名字讀）；按鈕桌機在右下角、手機看不見（有實體的 A、B、相機鍵），
// 只留給讀屏與鍵盤（鍵盤聚焦時才出來）。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const shootEl = ref<HTMLButtonElement | null>(null)
const root = ref<HTMLDivElement | null>(null)
const name = computed(() => (props.panel.kind === 'viewfinder' ? props.panel.name : null))
// ui.tick：相機換變焦時 +1
const zoom = computed(() => {
  void props.systems.ui.tick
  return props.systems.camera.zoom
})

function shoot() {
  void props.systems.camera.shoot()
}
function toggleZoom() {
  props.systems.camera.setZoom(props.systems.camera.zoom === 1 ? 2 : 1)
}
function close() {
  props.systems.sfx('cancel')
  props.systems.camera.stop()
}

defineExpose({
  // 按鍵由 systems 的相機處理
  press: () => false,
  // 手機（觸控的版面）：焦點放在取景框本身，按鈕列不出來（程式移過去的焦點在有的瀏覽器也算 :focus-visible）；
  // 鍵盤按 Tab 進按鈕列時才出來
  focusFirst: () => {
    const el = root.value?.closest('.lay-portrait, .lay-landscape') ? root.value : shootEl.value
    el?.focus({ preventScroll: true })
    return true
  },
})
</script>

<template>
  <div ref="root" class="vf" role="dialog" tabindex="-1" :aria-label="name ? `取景框：${name}` : '取景框'">
    <p v-if="name" class="gba-box vf-name" lang="ja" aria-hidden="true">{{ name }}</p>
    <div class="vf-bar">
      <button ref="shootEl" type="button" class="nb-btn" @click="shoot">拍照</button>
      <button type="button" class="nb-btn" :aria-pressed="zoom === 2" @click="toggleZoom">變焦</button>
      <button type="button" class="nb-btn" @click="close">收起</button>
    </div>
  </div>
</template>

<style scoped>
.vf {
  position: absolute;
  inset: 0;
}
/* 取景框本身拿到焦點（手機）：框是 canvas 畫的，不另外畫焦點框 */
.vf:focus {
  outline: none;
}
.vf-name {
  position: absolute;
  left: calc(var(--u) * 4);
  top: calc(var(--u) * 4);
  margin: 0;
  padding: 0 calc(var(--u) * 4);
  font-size: max(11px, calc(var(--u) * 5.5));
  line-height: calc(var(--u) * 11);
  max-width: 50%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: vf-fade 0.4s ease 1.2s both;
}
@keyframes vf-fade {
  to {
    opacity: 0;
    visibility: hidden;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vf-name {
    animation-duration: 0.01s;
  }
}
/* 桌機：右下角，小一點（框的正中、下緣留給構圖） */
.vf-bar {
  position: absolute;
  right: calc(var(--u) * 4);
  bottom: calc(var(--u) * 4);
  display: flex;
  gap: calc(var(--u) * 2);
  pointer-events: auto;
  font-size: max(11px, calc(var(--u) * 5));
  opacity: 0.9;
}
</style>

<!-- 版面的 class 在 PlayView 的根上（scoped 的 :global() 會把整個選擇器換掉，這幾條不放 scoped） -->
<style>
/* 手機：看不見（有實體的 A、B、相機鍵），讀屏與鍵盤照樣用得到；聚焦時才出來 */
.lay-portrait .vf-bar,
.lay-landscape .vf-bar {
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.lay-portrait .vf-bar:has(:focus-visible),
.lay-landscape .vf-bar:has(:focus-visible) {
  clip-path: none;
  width: auto;
  height: auto;
  overflow: visible;
}
</style>
