<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { kmText } from '../../../game/systems/data'
import type { GameSystems } from '../../../game/systems/install'
import type { TravelDest, TravelMode } from '../../../game/systems/types'
import type { Panel } from '../../../game/systems/ui'
import { rove } from '../../../game/ui/rove'

// 目的地（規格 §8.2、§8.8）：剪票口、巴士站、機場的櫃台。鎮名＋交通方式＋「鐵路約 n km」或「直線約 n km」；
// 不寫時刻、分鐘、路線名、航空公司。選了交給 world 的 travel（淡出、車窗、到那一鎮的車站）。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const d = computed(() => (props.panel.kind === 'travel' ? props.panel.data : null))
const cur = ref(0)
const els = ref<HTMLButtonElement[]>([])

const MODE: Record<TravelMode, string> = { rail: '鐵路', monorail: '單軌', bus: '巴士', plane: '飛機', ferry: '渡輪' }
const TITLE: Record<TravelMode, string> = { rail: '剪票口', monorail: '剪票口', bus: '巴士站', plane: '出發', ferry: '碼頭' }

/** 交通方式＋距離：坐鐵路、量鐵路的距離時只寫「鐵路約 n km」 */
function howText(mode: TravelMode, km: number, kind: 'rail' | 'straight'): string {
  return mode === 'rail' && kind === 'rail' ? kmText(km, kind) : `${MODE[mode]}　${kmText(km, kind)}`
}
function viaText(x: TravelDest): string | null {
  const v = x.via
  if (!v) return null
  if (typeof v === 'string') return `經 ${v}`
  return `經 ${v.name}（${howText(v.mode, v.km, v.kmKind)}）`
}

function focusAt(i: number) {
  void nextTick(() => els.value[i]?.focus({ preventScroll: true }))
}
/**
 * 點列：點一下先選，選著的那一列再點一下（或按「出發」）才出發，手機上不會一點就坐上車。
 * armed 是上一次點選（或用方向鍵移到）的那一列，一開始是第一列；鍵盤的 Enter／Space（click 的 detail 是 0）直接出發。
 */
let armed = 0
/** 用點的時候 focus 不換列（跟 ShopPanel 一樣，等 click）；Tab 移過去照舊跟著換，點一下就出發的那一列也跟著換 */
let pointing = false
const setPointing = (on: boolean) => {
  pointing = on
}
function onRowFocus(i: number) {
  if (pointing) return
  cur.value = i
  armed = i
}
function onRowClick(i: number, e: MouseEvent) {
  pointing = false
  if (e.detail > 0 && armed !== i) {
    if (cur.value !== i) props.systems.sfx('cursor')
    cur.value = i
    armed = i
    return
  }
  choose(i)
}
function choose(i: number) {
  const x = d.value?.dests[i]
  if (!x || !d.value) return
  props.systems.sfx('confirm')
  props.systems.closePanel({ ...x, mode: x.mode ?? d.value.mode, fromTown: d.value.fromTown })
}
function press(b: Button): boolean {
  const n = d.value?.dests.length ?? 0
  if (b === 'up' || b === 'down') {
    const j = rove(cur.value, b, n, { wrap: false })
    if (j !== cur.value) props.systems.sfx('cursor')
    cur.value = armed = j
    focusAt(j)
    return true
  }
  if (b === 'A') {
    choose(cur.value)
    return true
  }
  return b === 'left' || b === 'right'
}
defineExpose({ press, focusFirst: () => (focusAt(cur.value), true) })
</script>

<template>
  <div v-if="d" class="gba-box sys-box" role="dialog" aria-labelledby="tr-title">
    <header class="sys-head">
      <h2 id="tr-title" class="sys-title">{{ TITLE[d.mode] }}</h2>
    </header>
    <div class="sys-body">
      <ul class="sys-list" aria-label="目的地">
        <li v-for="(x, i) in d.dests" :key="`${x.town}:${i}`">
          <button
            :ref="(el) => (els[i] = el as HTMLButtonElement)"
            type="button"
            class="sys-row"
            :aria-current="i === cur ? 'true' : undefined"
            :tabindex="i === cur ? 0 : -1"
            @focus="onRowFocus(i)"
            @pointerdown="setPointing(true)"
            @pointercancel="setPointing(false)"
            @click="onRowClick(i, $event)"
          >
            <span class="sys-row-main">
              <span lang="ja">{{ x.name }}<span v-if="x.area" class="nb-sub">　{{ x.area }}</span></span>
              <span class="nb-sub">{{ howText(x.mode ?? d.mode, x.km, x.kmKind) }}</span>
              <span v-if="viaText(x)" class="nb-sub" lang="ja">{{ viaText(x) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
    <footer class="sys-foot">
      <button type="button" class="nb-btn" @click="choose(cur)">出發</button>
      <button type="button" class="nb-btn" @click="systems.closePanel()">不去了</button>
    </footer>
  </div>
</template>
