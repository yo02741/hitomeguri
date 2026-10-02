<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'

import { useFloating } from '../composables/floating'

// 行程停留點在觸控裝置上的「⋯」選單（TripStopList）：往前、往後、從行程移除。
// 寫法照 UserMenu：role=menu、方向鍵移動、Esc 收起並把焦點還給「⋯」鈕。面板 Teleport 到 body，避開行程欄的捲動區。
const props = defineProps<{ name: string; first: boolean; last: boolean }>()
const emit = defineEmits<{ shift: [delta: -1 | 1]; remove: [] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const { open, style, pref, side, origin } = useFloating(trigger, menu, { align: 'end' })
const id = useId()

function items(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
}
async function show(focus: 'first' | 'last' = 'first') {
  open.value = true
  await nextTick()
  const list = items()
  ;(focus === 'first' ? list[0] : list[list.length - 1])?.focus()
}
function hide(returnFocus = true) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}
function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    void show(e.key === 'ArrowDown' ? 'first' : 'last')
  }
}
function onMenuKey(e: KeyboardEvent) {
  const list = items()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') list[(i + 1) % list.length]?.focus()
  else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]?.focus()
  else if (e.key === 'Home') list[0]?.focus()
  else if (e.key === 'End') list[list.length - 1]?.focus()
  else if (e.key === 'Escape') hide()
  else if (e.key === 'Tab') hide(false)
  else return
  e.preventDefault()
}
function run(fn: () => void) {
  hide()
  fn()
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="grid size-tap shrink-0 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:translate-y-px"
    :aria-label="`${props.name} 的操作`"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="open ? id : undefined"
    @click="open ? hide(false) : show()"
    @keydown="onTriggerKey"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18.5" cy="12" r="1.8" /></svg>
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      :id="id"
      ref="menu"
      role="menu"
      :aria-label="`${props.name} 的操作`"
      :data-pref="pref"
      data-floating
      data-reduce="fade"
      class="fixed z-[80] flex min-w-40 flex-col rounded-card bg-paper p-1.5 shadow-float"
      :class="side === 'top' ? 'animate-pop-up' : 'animate-pop-in'"
      :style="{ ...style, transformOrigin: origin }"
      @keydown="onMenuKey"
    >
      <button type="button" role="menuitem" tabindex="-1" :disabled="first" class="flex min-h-tap items-center rounded-control px-3 text-left text-body-sm text-ink hover:bg-surface focus-visible:bg-surface disabled:opacity-40 active:bg-surface" @click="run(() => emit('shift', -1))">往前</button>
      <button type="button" role="menuitem" tabindex="-1" :disabled="last" class="flex min-h-tap items-center rounded-control px-3 text-left text-body-sm text-ink hover:bg-surface focus-visible:bg-surface disabled:opacity-40 active:bg-surface" @click="run(() => emit('shift', 1))">往後</button>
      <div class="mx-1 my-1 border-t border-line-soft" role="none"></div>
      <button type="button" role="menuitem" tabindex="-1" class="flex min-h-tap items-center rounded-control px-3 text-left text-body-sm text-ink hover:bg-surface focus-visible:bg-surface active:bg-surface" @click="run(() => emit('remove'))">從行程移除</button>
    </div>
  </Teleport>
</template>
