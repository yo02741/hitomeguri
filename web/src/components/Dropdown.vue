<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useFloating } from '../composables/floating'

// 下拉選單（DESIGN.md §7.23）：取代原生 <select>，樣式用 token。
// 觸發鈕顯示目前的選項；面板 Teleport 到 body（useFloating），下方放不下就翻到上方。
// 鍵盤：↑↓ 移動、Enter／Space 選、Esc 關、Home／End 到頭尾。
export interface DropdownOption {
  value: string
  label: string
}
const props = withDefaults(
  defineProps<{
    modelValue: string
    options: DropdownOption[]
    /** 給螢幕閱讀器的名稱（觸發鈕與清單） */
    label: string
    size?: 'sm' | 'md'
    align?: 'start' | 'end'
    disabled?: boolean
  }>(),
  { size: 'md', align: 'start' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style, pref, side, origin } = useFloating(trigger, panel, { align: props.align })
const id = `dd-${Math.random().toString(36).slice(2, 8)}`
const current = computed(() => props.options.find((o) => o.value === props.modelValue) ?? props.options[0])
const active = ref(0)

async function show() {
  active.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue))
  open.value = true
  await nextTick()
  panel.value?.focus()
}
function pick(i: number) {
  const o = props.options[i]
  if (o && o.value !== props.modelValue) emit('update:modelValue', o.value)
  open.value = false
  trigger.value?.focus()
}
function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    void show()
  }
}
function onPanelKey(e: KeyboardEvent) {
  const n = props.options.length
  if (e.key === 'ArrowDown') active.value = (active.value + 1) % n
  else if (e.key === 'ArrowUp') active.value = (active.value - 1 + n) % n
  else if (e.key === 'Home') active.value = 0
  else if (e.key === 'End') active.value = n - 1
  else if (e.key === 'Enter' || e.key === ' ') pick(active.value)
  else if (e.key === 'Escape' || e.key === 'Tab') {
    open.value = false
    trigger.value?.focus()
  } else return
  e.preventDefault()
}
// 鍵盤移到的選項捲進視野
watch(active, async () => {
  await nextTick()
  panel.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <button
    ref="trigger"
    type="button"
    :aria-label="label"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-controls="id"
    :disabled="disabled"
    class="inline-flex shrink-0 items-center gap-1 rounded-control border border-line bg-paper text-left text-ink hover:not-disabled:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px"
    :class="size === 'sm' ? 'h-8 pr-1.5 pl-2 text-caption pointer-coarse:h-tap' : 'h-10 pr-2 pl-3 text-body-sm'"
    @click="open ? (open = false) : show()"
    @keydown="onTriggerKey"
  >
    <span class="min-w-0 flex-1 truncate">{{ current?.label }}</span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-sub" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      :id="id"
      ref="panel"
      role="listbox"
      :aria-label="label"
      :aria-activedescendant="`${id}-${active}`"
      tabindex="-1"
      :data-pref="pref"
      data-floating
      data-reduce="fade"
      class="scroll-quiet fixed z-[80] flex max-h-72 min-w-32 flex-col overflow-y-auto overscroll-contain rounded-card bg-paper p-1 shadow-float outline-none"
      :class="side === 'top' ? 'animate-pop-up' : 'animate-pop-in'"
      :style="{ ...style, transformOrigin: origin }"
      @keydown="onPanelKey"
    >
      <button
        v-for="(o, i) in options"
        :id="`${id}-${i}`"
        :key="o.value"
        type="button"
        role="option"
        tabindex="-1"
        :aria-selected="o.value === modelValue"
        :data-active="i === active"
        class="flex min-h-tap items-center gap-2 rounded-control px-2.5 text-left text-body-sm whitespace-nowrap text-ink"
        :class="i === active ? 'bg-surface' : 'active:bg-surface'"
        @pointermove="active = i"
        @click="pick(i)"
      >
        <span class="w-3.5 shrink-0 text-region-strong" aria-hidden="true">
          <svg v-if="o.value === modelValue" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
        </span>
        <span :class="o.value === modelValue ? 'font-bold' : ''">{{ o.label }}</span>
      </button>
    </div>
  </Teleport>
</template>
