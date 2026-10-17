<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { kmText } from '../../../game/systems/data'
import type { GameSystems } from '../../../game/systems/install'
import type { TravelDest, TravelMode } from '../../../game/systems/types'
import type { Panel } from '../../../game/systems/ui'
import { rove } from '../../../game/ui/rove'

import DepartBoard from './DepartBoard.vue'
import FlightLine from './FlightLine.vue'

// 目的地（規格 §8.2、§8.8）：剪票口、巴士站、機場的櫃台。鎮名＋交通方式＋「鐵路約 n km」或「直線約 n km」；
// 不寫時刻、分鐘、路線名、航空公司。選了交給 world 的 travel（淡出、車窗、到那一鎮的車站）。
// P4：台灣與日本之間的飛機（回台灣）寫航空公司與每週班次（国土交通省的表），不寫 km，列表下面寫出處；
// 台灣的出發大廳是出發看板（DepartBoard，自己有出處與下面的鈕）；新遊戲選出發的城市（origin：遊戲裡直飛得到的機場）。
// 「想去的地方」（出發看板記下的鎮）排在最前面。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const d = computed(() => (props.panel.kind === 'travel' ? props.panel.data : null))
const boardRef = ref<{ press(b: Button): boolean; focusFirst(): boolean; mode(): string } | null>(null)
/** 新遊戲：出發的城市（台北、台中、高雄） */
const origin = computed(() => d.value?.origin ?? null)
const count = computed(() => (origin.value ? origin.value.cities.length : (d.value?.dests.length ?? 0)))
const cur = ref(0)
const els = ref<HTMLButtonElement[]>([])

const MODE: Record<TravelMode, string> = { rail: '鐵路', monorail: '單軌', bus: '巴士', plane: '飛機', ferry: '渡輪' }
const TITLE: Record<TravelMode, string> = { rail: '剪票口', monorail: '剪票口', bus: '巴士站', plane: '出發', ferry: '碼頭' }
const title = computed(() => {
  const x = d.value
  if (!x) return ''
  if (x.origin) return '出發的城市'
  if (x.board) return `出發　${x.board.city}`
  if (x.abroad?.kind === 'intl') return '回台灣'
  return TITLE[x.mode]
})
/** 航線的出處（国土交通省的表）：有飛機的列（回台灣）或出發的城市時才寫 */
const source = computed(() => {
  const x = d.value
  if (!x?.source || x.board) return null
  return x.origin || x.dests.some((y) => y.flight) ? x.source : null
})

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
 * 新遊戲的出發城市：一開始誰都沒選好（不能反悔，點第一列也要點兩下或按「決定」；鍵盤的 A、Enter 照樣一下）。
 */
let armed = origin.value ? -1 : 0
/** 用點的時候 focus 不換列（跟 ShopPanel 一樣，等 click）；Tab 移過去照舊跟著換，點一下就出發的那一列也跟著換 */
let pointing = false
const setPointing = (on: boolean) => {
  pointing = on
}
function onRowFocus(i: number) {
  if (pointing) return
  cur.value = i
  // 出發的城市：打開時聚焦在第一列（focusFirst）不算選好
  if (!origin.value) armed = i
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
  if (!d.value) return
  const o = origin.value?.cities[i]
  if (o) {
    props.systems.sfx('confirm')
    props.systems.closePanel({ town: `tw:${o.id}`, name: o.name, km: 0, kmKind: 'straight', mode: 'plane', fromTown: d.value.fromTown })
    return
  }
  const x = d.value.dests[i]
  if (!x) return
  props.systems.sfx('confirm')
  props.systems.closePanel({ ...x, mode: x.mode ?? d.value.mode, fromTown: d.value.fromTown })
}
/** 出發看板選了一個（飛機、或飛機＋電車） */
function chooseBoard(x: TravelDest) {
  if (!d.value) return
  props.systems.closePanel({ ...x, mode: x.mode ?? d.value.mode, fromTown: d.value.fromTown })
}
function press(b: Button): boolean {
  if (d.value?.board) return boardRef.value?.press(b) ?? false
  const n = count.value
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
  // 新遊戲的出發城市：一定要選一個（B、START 不關；沒有「不去了」）
  if (origin.value && (b === 'B' || b === 'START')) return true
  return b === 'left' || b === 'right'
}
/** 按鍵提示（PlayView 的提示列）：出發的城市、出發看板（看板自己的那一層）、一般的目的地 */
const mode = () => (origin.value ? 'origin' : d.value?.board ? (boardRef.value?.mode() ?? 'board') : 'list')
defineExpose({ press, focusFirst: () => (d.value?.board ? (boardRef.value?.focusFirst() ?? false) : (focusAt(cur.value), true)), mode })
</script>

<template>
  <div v-if="d" class="gba-box sys-box" :class="{ 'is-board': !!d.board }" role="dialog" aria-labelledby="tr-title">
    <header class="sys-head">
      <h2 id="tr-title" class="sys-title">{{ title }}</h2>
    </header>
    <div v-if="d.board" class="sys-body tr-board">
      <DepartBoard ref="boardRef" :systems="systems" :board="d.board" @choose="chooseBoard" />
    </div>
    <div v-else class="sys-body">
      <ul v-if="origin" class="sys-list" aria-label="出發的城市">
        <li v-for="(c, i) in origin.cities" :key="c.id">
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
              <span>{{ c.name }}</span>
              <span v-if="c.to.length" class="nb-sub">直飛 <span lang="ja">{{ c.to.join('、') }}</span></span>
            </span>
          </button>
        </li>
      </ul>
      <ul v-else class="sys-list" aria-label="目的地">
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
              <span lang="ja">{{ x.name }}<span v-if="x.area" class="nb-sub">　{{ x.area }}</span><span v-if="x.planned" class="nb-sub">　想去的地方</span></span>
              <span v-if="x.flight" class="nb-sub"><FlightLine :airlines="x.flight.airlines" :weekly="x.flight.weekly" /></span>
              <span v-else class="nb-sub">{{ howText(x.mode ?? d.mode, x.km, x.kmKind) }}</span>
              <span v-if="viaText(x)" class="nb-sub" lang="ja">{{ viaText(x) }}</span>
            </span>
          </button>
        </li>
      </ul>
      <p v-if="source" class="nb-sub tr-src">
        <a :href="source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`航線的出處：${source.label}（開新分頁）`">出處</a>
        {{ source.label }}<template v-if="source.season">　<span lang="ja">{{ source.season }}</span></template>
      </p>
    </div>
    <footer v-if="!d.board" class="sys-foot">
      <button type="button" class="nb-btn" @click="choose(cur)">{{ origin ? '決定' : '出發' }}</button>
      <button v-if="!origin" type="button" class="nb-btn" @click="systems.closePanel()">不去了</button>
    </footer>
  </div>
</template>

<style scoped>
.tr-board {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tr-src {
  margin: 0.8em 0 0;
}
</style>
