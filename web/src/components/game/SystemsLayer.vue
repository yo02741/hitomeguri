<script setup lang="ts">
import { type Component, computed, inject, nextTick, ref, watch } from 'vue'

import type { Button } from '../../game/engine/input'
import type { GameSystems } from '../../game/systems/install'
import { GAME_UI } from '../../game/ui/context'

import BookPanel from './systems/BookPanel.vue'
import CardPanel from './systems/CardPanel.vue'
import PhotoResult from './systems/PhotoResult.vue'
import RoomPanel from './systems/RoomPanel.vue'
import ShopPanel from './systems/ShopPanel.vue'
import StampPress from './systems/StampPress.vue'
import TravelPanel from './systems/TravelPanel.vue'
import ViewfinderPanel from './systems/ViewfinderPanel.vue'

// 遊戲裡的面板（規格 §8.4–§8.7）：取景框、拍好的照片、店、目的地、蓋章、房間的擺設、桌上的印帳、品項卡，
// 以及站在拍攝點上時右上角的「拍照」。放在 PlayView 的 .play-screen 裡：
//   <SystemsLayer :systems="systems" :scale="scale" :width="width" :layout="layout" />
// 面板打開時世界停住（systems 讓 Game 停在 'systems'），遊戲的按鍵（鍵盤、十字鍵、手把）經 systems.press 交給面板。
// 手機（layout 不是 desktop）時，店、房間、印帳、目的地蓋住整個畫面與控制區（字與按鈕才夠大），取景框留在畫面上。
const props = defineProps<{ systems: GameSystems; scale: number; width: number; layout?: 'desktop' | 'portrait' | 'landscape'; busy?: boolean }>()
const ui = inject(GAME_UI, null)

interface PanelApi {
  press(b: Button): boolean
  focusFirst?(): boolean
}

const PANELS: Record<string, Component> = {
  viewfinder: ViewfinderPanel,
  photo: PhotoResult,
  shop: ShopPanel,
  travel: TravelPanel,
  stamp: StampPress,
  room: RoomPanel,
  book: BookPanel,
  card: CardPanel,
}
/** 手機上蓋住整個畫面的（蓋章也是：印與站名、日期在直拿的畫面裡放不下） */
const BIG = new Set(['shop', 'travel', 'room', 'book', 'card', 'stamp'])

const root = ref<HTMLElement | null>(null)
const panelRef = ref<PanelApi | null>(null)
const panel = computed(() => props.systems.ui.panel)
const kind = computed(() => panel.value?.kind ?? null)
// 對話、腳本進行中（busy：PlayView 的對話框開著）不出「拍照」：按一次 A 不會同時拍照又翻頁
const hint = computed(() => (panel.value || props.busy ? null : props.systems.ui.hint))

function desktop(): boolean {
  if (props.layout) return props.layout === 'desktop'
  return !!root.value?.closest('.play-root')?.classList.contains('lay-desktop') || !root.value?.closest('.play-root')
}
const full = ref(false)

/**
 * 殘影的點擊：手機上點櫃台、人（pointerdown）就打開面板，同一下的 click 在手指放開後才來，
 * 落在剛蓋上來的面板上（點到某一列）。面板打開之後沒有在面板裡按下去過的 click 不算（鍵盤的 click detail 是 0，照舊）。
 */
let downInside = false
function onLayerDown() {
  downInside = true
}
function onLayerClick(e: MouseEvent) {
  if (e.detail > 0 && !downInside) {
    e.stopPropagation()
    e.preventDefault()
  }
}
/** 殘影的 mousedown（手指放開後瀏覽器補發的）也擋：不然焦點移到手指下面那一列，看起來「選著」的不是那一列 */
function onLayerMouseDown(e: MouseEvent) {
  if (!downInside) e.preventDefault()
}

watch(
  kind,
  (k, old) => {
    if (k !== old) downInside = false
    full.value = !!k && BIG.has(k) && !desktop()
    props.systems.bindPanel(k ? (b) => panelRef.value?.press(b) ?? false : null)
    if (k && k !== old) void nextTick(() => panelRef.value?.focusFirst?.())
    if (!k && old) focusCanvas()
  },
  { flush: 'post' },
)

function focusCanvas() {
  void nextTick(() => root.value?.closest('.play-screen')?.querySelector<HTMLCanvasElement>('canvas')?.focus({ preventScroll: true }))
}

function shoot() {
  const h = hint.value
  if (!h || !props.systems.canShoot()) return
  ui?.sfx('confirm')
  props.systems.openCamera(h.spot)
}

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), a[href], [tabindex="0"]'
/** Tab 只在面板裡繞 */
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  const box = (e.currentTarget as HTMLElement | null) ?? null
  const els = Array.from(box?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null)
  if (!els.length) return
  const i = els.indexOf(document.activeElement as HTMLElement)
  if (e.shiftKey && i <= 0) {
    e.preventDefault()
    els[els.length - 1]!.focus()
  } else if (!e.shiftKey && i === els.length - 1) {
    e.preventDefault()
    els[0]!.focus()
  }
}
</script>

<template>
  <div ref="root" class="sys-root" :style="{ '--u': `${scale}px` }">
    <button v-if="hint" type="button" class="gba-box sys-hint" :aria-label="hint.name ? `拍照：${hint.name}` : '拍照'" @pointerdown.stop @click.stop="shoot">
      <svg viewBox="0 0 9 7" aria-hidden="true" shape-rendering="crispEdges">
        <path d="M3 0h3v1h3v6H0V1h3zM4 2h1v1h1v2H5v1H4V5H3V3h1z" fill="currentColor" fill-rule="evenodd" />
      </svg>
      <span>拍照</span>
    </button>
    <Teleport to=".play-root" :disabled="!full">
      <div v-if="panel" class="sys-layer" :class="[`is-${panel.kind}`, { 'is-full': full }]" :style="{ '--u': `${scale}px` }" @keydown="onKey" @pointerdown.stop="onLayerDown" @mousedown.capture="onLayerMouseDown" @click.capture="onLayerClick">
        <component :is="PANELS[panel.kind]" :key="`${panel.kind}:${'id' in panel ? panel.id : ''}`" ref="panelRef" :systems="systems" :panel="panel" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sys-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: var(--font-game);
}
.sys-root :deep(:lang(ja)),
.sys-layer :deep(:lang(ja)) {
  font-family: var(--font-game-ja);
}
.sys-hint {
  position: absolute;
  top: calc(var(--u) * 4);
  right: calc(var(--u) * 4);
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 2);
  min-height: calc(var(--u) * 14);
  padding: 0 calc(var(--u) * 5);
  font: inherit;
  font-size: max(12px, calc(var(--u) * 6.5));
  pointer-events: auto;
  cursor: pointer;
}
@media (pointer: coarse) {
  .sys-hint {
    min-height: 44px;
  }
}
.sys-hint svg {
  width: calc(var(--u) * 9);
  height: calc(var(--u) * 7);
}
.sys-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: auto;
  font-family: var(--font-game);
  font-size: clamp(14px, calc(var(--u) * 7), 22px);
  line-height: 1.5;
}
/* 取景框：畫面上的框是 canvas 畫的，這一層只放按鈕，透明 */
.sys-layer.is-viewfinder {
  pointer-events: none;
}
.sys-layer.is-full {
  z-index: 3;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  background: var(--color-px-ink);
}
</style>
