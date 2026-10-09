<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useFloating } from '../composables/floating'
import { isIsoDate, longDate } from '../services/calendar'
import { dayCount } from '../services/trip'
import CalendarPanel from './CalendarPanel.vue'

// 出發到回程（DESIGN.md §7.16）：先點出發、再點回程；回程早於出發時改當新的出發。
// 只點了出發就關掉時回傳（出發, ''），由呼叫端決定回程（例：行程沿用原本的天數）。
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    start: string
    end: string
    label: string
    min?: string
    max?: string
    placeholder?: string
    /** 還沒選日期時月曆先打開的日期（CalendarPanel 的 initial） */
    initial?: string
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
  }>(),
  { placeholder: '出發 → 回程', size: 'md' },
)
const emit = defineEmits<{ change: [start: string, end: string] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style, pref, side, origin } = useFloating(trigger, panel)

// 面板開著時的草稿；關閉時才送出
const draftStart = ref('')
const draftEnd = ref('')
let committed = false
watch(open, (o) => {
  if (o) {
    draftStart.value = props.start
    draftEnd.value = props.end
    committed = false
    return
  }
  if (!committed && draftStart.value !== props.start) emit('change', draftStart.value, '')
})

function pick(d: string) {
  if (!draftStart.value || draftEnd.value || d < draftStart.value) {
    draftStart.value = d
    draftEnd.value = ''
    return
  }
  draftEnd.value = d
  committed = true
  emit('change', draftStart.value, d)
  close()
}
function clear() {
  committed = true
  emit('change', '', '')
  close()
}
function close() {
  open.value = false
  trigger.value?.focus()
}
function onFocusOut(e: FocusEvent) {
  const n = e.relatedTarget as Node | null
  if (n && !panel.value?.contains(n) && n !== trigger.value) open.value = false
}

const HEIGHT = { sm: 'h-9 pointer-coarse:h-tap', md: 'h-10 pointer-coarse:h-tap', lg: 'h-11' }
const text = computed(() => {
  if (!isIsoDate(props.start)) return ''
  const e = isIsoDate(props.end) && props.end !== props.start ? props.end : ''
  return e ? `${longDate(props.start)} → ${longDate(e).slice(5)}` : longDate(props.start)
})
const days = computed(() => dayCount(draftStart.value || undefined, (draftEnd.value || draftStart.value) || undefined))
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
    class="flex items-center gap-2 rounded-control border bg-paper px-2.5 text-left text-body-sm hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px"
    :class="[HEIGHT[size], open ? 'border-region-strong' : 'border-line']"
    @click="open = !open"
    @keydown.down.prevent="open = true"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-sub" aria-hidden="true">
      <path d="M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4" />
    </svg>
    <span v-if="text" class="font-num whitespace-nowrap text-ink">{{ text }}</span>
    <span v-else class="whitespace-nowrap text-sub">{{ placeholder }}</span>
  </button>
  <Teleport to="body">
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
      <CalendarPanel :start="draftStart" :end="draftEnd" range :min="min" :max="max" :initial="initial" @pick="pick">
        <template #footer>
          <div class="flex min-h-9 items-center gap-2 border-t border-line-soft pt-2 text-body-sm">
            <span class="px-1 text-sub" aria-live="polite">
              <template v-if="!draftStart">出發</template>
              <template v-else-if="!draftEnd">
                <span class="font-num text-ink">{{ longDate(draftStart).slice(5) }}</span> → 回程
              </template>
              <template v-else><span class="font-num text-ink">{{ days }}</span> 天</template>
            </span>
            <button
              v-if="start || draftStart"
              type="button"
              class="ml-auto h-9 rounded-control px-3 text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap"
              @click="clear"
            >
              清除
            </button>
          </div>
        </template>
      </CalendarPanel>
    </div>
  </Teleport>
</template>
