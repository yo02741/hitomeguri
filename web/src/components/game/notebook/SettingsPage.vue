<script setup lang="ts">
import { computed, inject, nextTick, reactive, ref } from 'vue'

import type { AudioBus } from '../../../game/audio/settings'
import type { Button } from '../../../game/engine/input'
import { GAME_UI } from '../../../game/ui/context'
import { rove } from '../../../game/ui/rove'
import { TEXT_SPEED_LABEL, TEXT_SPEEDS, type TextSpeed } from '../../../game/ui/text'

import { useRows } from './rows'

// 手帳「設定」：音樂、效果音的音量（最左一格是「關」，各自靜音）、打字聲、文字速度（慢、一般、快、立即）、一直跑。
// 十字鍵上下選一列、左右改；滑鼠點格子也可以。聲音的設定存在聲音那邊，文字速度與一直跑存在介面的設定（都在這台裝置）。
// 最下面一行小字列出鍵盤的鍵位（只有鍵盤的裝置才列）。
const ui = inject(GAME_UI)!
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)

const a = reactive(ui.audioSettings())
const LEVELS = 10
const level = (bus: AudioBus) => (a[bus].muted ? 0 : Math.round(a[bus].volume * LEVELS))
const levelText = (bus: AudioBus) => (level(bus) ? String(level(bus)) : '關')

function setLevel(bus: AudioBus, l: number) {
  const v = Math.max(0, Math.min(LEVELS, l))
  if (v === level(bus)) return
  if (v === 0) {
    a[bus].muted = true
    ui.setMuted(bus, true)
  } else {
    a[bus].muted = false
    a[bus].volume = v / LEVELS
    ui.setMuted(bus, false)
    ui.setVolume(bus, v / LEVELS)
  }
  ui.sfx('cursor')
}
/** 點音量的格子；按住左右拖也可以 */
function levelAt(el: HTMLElement, x: number): number | null {
  const r = el.getBoundingClientRect()
  const seg = document.elementFromPoint(Math.max(r.left + 1, Math.min(r.right - 1, x)), r.top + r.height / 2)?.closest<HTMLElement>('[data-level]')
  return seg && el.contains(seg) ? Number(seg.dataset.level) : null
}
function onSlider(e: PointerEvent, bus: AudioBus) {
  const el = e.currentTarget as HTMLElement
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    // 沒有 capture 就只算點的那一下
  }
  const l = levelAt(el, e.clientX)
  if (l !== null) setLevel(bus, l)
}
function onSliderMove(e: PointerEvent, bus: AudioBus) {
  const el = e.currentTarget as HTMLElement
  if (!el.hasPointerCapture?.(e.pointerId)) return
  const l = levelAt(el, e.clientX)
  if (l !== null) setLevel(bus, l)
}

function setTyping(on: boolean) {
  if (a.typing === on) return
  a.typing = on
  ui.setTyping(on)
  ui.sfx('cursor')
}
function setRun(on: boolean) {
  if (ui.ui.alwaysRun === on) return
  ui.setUi({ alwaysRun: on })
  ui.sfx('cursor')
}
const speedEls = ref<HTMLButtonElement[]>([])
function setSpeed(s: TextSpeed, focus = false) {
  if (ui.ui.textSpeed !== s) {
    ui.setUi({ textSpeed: s })
    ui.sfx('cursor')
  }
  if (focus) void nextTick(() => speedEls.value[TEXT_SPEEDS.indexOf(s)]?.focus({ preventScroll: true }))
}

function press(b: Button): boolean {
  if (rows.move(b)) return true
  const row = rows.current()
  const lr = b === 'left' || b === 'right'
  const d = b === 'left' ? -1 : 1
  if (row === 'bgm' || row === 'sfx') {
    if (!lr) return b === 'A'
    setLevel(row, level(row) + d)
    return true
  }
  if (row === 'typing' && (lr || b === 'A')) {
    setTyping(b === 'A' ? !a.typing : b === 'right')
    return true
  }
  if (row === 'run' && (lr || b === 'A')) {
    setRun(b === 'A' ? !ui.ui.alwaysRun : b === 'right')
    return true
  }
  if (row === 'speed' && lr) {
    const i = TEXT_SPEEDS.indexOf(ui.ui.textSpeed)
    setSpeed(TEXT_SPEEDS[rove(i, b, TEXT_SPEEDS.length, { orientation: 'horizontal', wrap: false })]!, true)
    return true
  }
  return b === 'A' && row !== null
}
defineExpose({ focusFirst: rows.focusFirst, press })

const touch = computed(() => ui.touch())
const BUSES: Array<{ bus: AudioBus; label: string }> = [
  { bus: 'bgm', label: '音樂' },
  { bus: 'sfx', label: '效果音' },
]
</script>

<template>
  <div ref="root" class="nb-page set">
    <div v-for="x in BUSES" :key="x.bus" class="set-row" :data-row="x.bus">
      <span :id="`set-${x.bus}`" class="set-label">{{ x.label }}</span>
      <div
        role="slider"
        tabindex="0"
        class="set-slider"
        :aria-labelledby="`set-${x.bus}`"
        aria-valuemin="0"
        :aria-valuemax="LEVELS"
        :aria-valuenow="level(x.bus)"
        :aria-valuetext="levelText(x.bus)"
        @pointerdown="onSlider($event, x.bus)"
        @pointermove="onSliderMove($event, x.bus)"
      >
        <span class="set-off" :class="{ 'is-on': level(x.bus) === 0 }" data-level="0">關</span>
        <span v-for="k in LEVELS" :key="k" class="set-seg" :class="{ 'is-on': k <= level(x.bus) }" :data-level="k" aria-hidden="true"></span>
      </div>
    </div>

    <div class="set-row" data-row="typing">
      <span id="set-typing" class="set-label">打字聲</span>
      <button type="button" role="switch" class="set-switch" :aria-checked="a.typing" aria-labelledby="set-typing" @click="setTyping(!a.typing)">
        {{ a.typing ? '開' : '關' }}
      </button>
    </div>

    <div class="set-row" data-row="speed">
      <span id="set-speed" class="set-label">文字速度</span>
      <div role="radiogroup" class="set-radios" aria-labelledby="set-speed">
        <button
          v-for="(s, i) in TEXT_SPEEDS"
          :key="s"
          :ref="(el) => (speedEls[i] = el as HTMLButtonElement)"
          type="button"
          role="radio"
          class="set-radio"
          :aria-checked="ui.ui.textSpeed === s"
          :tabindex="ui.ui.textSpeed === s ? 0 : -1"
          @click="setSpeed(s)"
        >
          {{ TEXT_SPEED_LABEL[s] }}
        </button>
      </div>
    </div>

    <div class="set-row" data-row="run">
      <span id="set-run" class="set-label">一直跑</span>
      <button type="button" role="switch" class="set-switch" :aria-checked="ui.ui.alwaysRun" aria-labelledby="set-run" @click="setRun(!ui.ui.alwaysRun)">
        {{ ui.ui.alwaysRun ? '開' : '關' }}
      </button>
    </div>

    <p v-if="!touch" class="nb-sub set-keys">方向鍵 走　Z 確定　X 取消／按住跑　C 相機　Esc 旅人手帳　P 暫停</p>
  </div>
</template>

<style scoped>
.set {
  gap: 0.5em;
}
.set-row {
  display: grid;
  grid-template-columns: 5.5em minmax(0, 1fr);
  align-items: center;
  gap: 0.8em;
  min-height: 2.2em;
}
@media (pointer: coarse) {
  .set-row {
    min-height: 44px;
  }
}
/* 手機直拿：手帳窄，名稱放在上面一行 */
@media (max-width: 559.98px) {
  .set {
    gap: 0.9em;
  }
  .set-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2em;
  }
}
.set-slider {
  display: flex;
  align-items: center;
  gap: 0.18em;
  padding: 0.3em 0.2em;
  cursor: pointer;
  touch-action: none;
}
.set-off {
  margin-right: 0.3em;
  padding: 0 0.25em;
  color: var(--color-px-stone-3);
}
.set-off.is-on {
  color: var(--color-px-white);
  background: var(--color-px-ink);
}
.set-seg {
  width: 0.55em;
  height: 1.1em;
  background: var(--color-px-stone-1);
  border: 1px solid var(--color-px-stone-3);
}
@media (pointer: coarse) {
  .set-slider {
    min-height: 44px;
  }
  .set-seg {
    width: 0.85em;
    height: 1.7em;
  }
}
.set-seg.is-on {
  background: var(--color-px-sea-2);
  border-color: var(--color-px-sea-3);
}
.set-switch,
.set-radio {
  min-height: 2em;
  min-width: 3em;
  padding: 0 0.6em;
  font: inherit;
  color: var(--color-px-ink);
  background: var(--color-px-white);
  border: 2px solid var(--color-px-stone-2);
  border-radius: 4px;
}
@media (pointer: coarse) {
  .set-switch,
  .set-radio {
    min-height: 44px;
  }
}
.set-switch {
  justify-self: start;
}
.set-switch[aria-checked='true'],
.set-radio[aria-checked='true'] {
  color: var(--color-px-white);
  background: var(--color-px-ink);
  border-color: var(--color-px-ink);
}
.set-radios {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em;
}
.set-keys {
  margin: 0.6em 0 0;
  line-height: 1.6;
}
</style>
