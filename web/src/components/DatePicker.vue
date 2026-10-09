<script setup lang="ts">
import { computed, ref } from 'vue'

import { useFloating } from '../composables/floating'
import { isIsoDate, longDate } from '../services/calendar'
import { todayIso } from '../services/userdb'
import CalendarPanel from './CalendarPanel.vue'

// 單一日期（DESIGN.md §7.16）。觸發鈕看起來像輸入框；bare 時只留功能，外觀由呼叫端的 class 決定、內容用 slot。
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    min?: string
    max?: string
    placeholder?: string
    clearable?: boolean
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    align?: 'start' | 'end'
    bare?: boolean
  }>(),
  { placeholder: '選擇日期', clearable: true, size: 'md', align: 'start' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style, pref, side, origin, host } = useFloating(trigger, panel, { align: props.align })

const text = computed(() => (isIsoDate(props.modelValue) ? longDate(props.modelValue) : ''))
const today = todayIso()
const todayOk = computed(() => !(props.min && today < props.min) && !(props.max && today > props.max))
const HEIGHT = { sm: 'h-9 pointer-coarse:h-tap', md: 'h-10 pointer-coarse:h-tap', lg: 'h-11' }

function set(v: string) {
  emit('update:modelValue', v)
  close()
}
function close() {
  open.value = false
  trigger.value?.focus()
}
// Tab 離開面板就收起
function onFocusOut(e: FocusEvent) {
  const n = e.relatedTarget as Node | null
  if (n && !panel.value?.contains(n) && n !== trigger.value) open.value = false
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    v-bind="$attrs"
    :disabled="disabled"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-label="`${label}：${text || '未選'}`"
    :class="
      bare
        ? ''
        : [
            'flex items-center gap-2 rounded-control border bg-paper px-2.5 text-left text-body-sm hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px',
            HEIGHT[size],
            open ? 'border-region-strong' : 'border-line',
          ]
    "
    @click="open = !open"
    @keydown.down.prevent="open = true"
  >
    <slot :text="text">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-sub" aria-hidden="true">
        <path d="M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4" />
      </svg>
      <span v-if="text" class="font-num whitespace-nowrap text-ink">{{ text }}</span>
      <span v-else class="whitespace-nowrap text-sub">{{ placeholder }}</span>
    </slot>
  </button>
  <Teleport :to="host">
    <div
      v-if="open"
      ref="panel"
      :data-pref="pref"
      data-floating
      data-reduce="fade"
      class="fixed z-50"
      :class="side === 'top' ? 'animate-pop-up' : 'animate-pop-in'"
      :style="{ ...style, transformOrigin: origin }"
      role="dialog"
      :aria-label="label"
      @keydown.esc.stop.prevent="close"
      @focusout="onFocusOut"
    >
      <CalendarPanel :value="modelValue" :min="min" :max="max" @pick="set">
        <template #footer>
          <div class="flex items-center gap-2 border-t border-line-soft pt-2">
            <button
              v-if="todayOk"
              type="button"
              class="h-9 rounded-control px-3 text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
              @click="set(today)"
            >
              今天
            </button>
            <button
              v-if="clearable && modelValue"
              type="button"
              class="ml-auto h-9 rounded-control px-3 text-body-sm text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap"
              @click="set('')"
            >
              清除
            </button>
          </div>
        </template>
      </CalendarPanel>
    </div>
  </Teleport>
</template>
