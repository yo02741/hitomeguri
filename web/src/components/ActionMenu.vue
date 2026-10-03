<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'

import { useFloating } from '../composables/floating'

// 一顆鈕打開的動作選單（停留點的「⋯」、行程頁的「更多」）。
// 寫法照 UserMenu：role=menu、方向鍵移動、Esc 收起並把焦點還給觸發鈕。面板 Teleport 到 body，避開外層的捲動區；
// 項目多時面板自己捲（最高 70dvh）。group 不同的項目之間畫一條線。
export interface MenuAction {
  key: string
  label: string
  /** 右邊的小字（日期…） */
  hint?: string
  disabled?: boolean
  danger?: boolean
  group?: number
  /** 選了之後觸發鈕會跟著消失（移除、移到別天）：焦點不還給它，由呼叫端處理 */
  leaves?: boolean
}
const props = defineProps<{ label: string; items: MenuAction[]; disabled?: boolean; triggerClass?: string }>()
const emit = defineEmits<{ select: [key: string] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const { open, style, pref, side, origin } = useFloating(trigger, menu, { align: 'end' })
const id = useId()

function enabled(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
}
async function show(focus: 'first' | 'last' = 'first') {
  open.value = true
  await nextTick()
  const list = enabled()
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
  const list = enabled()
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
function run(a: MenuAction) {
  hide(!a.leaves)
  emit('select', a.key)
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    :class="triggerClass"
    :disabled="disabled"
    :aria-label="label"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-controls="open ? id : undefined"
    @click="open ? hide(false) : show()"
    @keydown="onTriggerKey"
  >
    <slot />
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      :id="id"
      ref="menu"
      role="menu"
      :aria-label="props.label"
      :data-pref="pref"
      data-floating
      data-reduce="fade"
      class="scroll-quiet fixed z-[80] flex max-h-[70dvh] min-w-40 flex-col overflow-y-auto overscroll-contain rounded-card bg-paper p-1.5 shadow-float"
      :class="side === 'top' ? 'animate-pop-up' : 'animate-pop-in'"
      :style="{ ...style, transformOrigin: origin }"
      @keydown="onMenuKey"
    >
      <template v-for="(a, i) in items" :key="a.key">
        <div v-if="i > 0 && (a.group ?? 0) !== (items[i - 1]!.group ?? 0)" class="mx-1 my-1 shrink-0 border-t border-line-soft" role="none"></div>
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          :disabled="a.disabled"
          class="flex min-h-tap shrink-0 items-center gap-3 rounded-control px-3 text-left text-body-sm whitespace-nowrap hover:not-disabled:bg-surface focus-visible:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:bg-surface"
          :class="a.danger ? 'text-danger' : 'text-ink'"
          @click="run(a)"
        >
          <span class="flex-1">{{ a.label }}</span>
          <span v-if="a.hint" class="font-latin text-caption text-sub">{{ a.hint }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>
