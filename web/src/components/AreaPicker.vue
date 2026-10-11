<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useFloating } from '../composables/floating'
import type { AreaGroup } from '../services/areas'

// 景點清單的「地區」（DESIGN.md §7.5d，UX-FLOW.md A2b）：縣內的市区町村，有景點的才列，依代碼；
// 政令指定都市的區排在市名底下。選了清單只留那一區、地圖移到那一區。和下拉選單（§7.23）同一套：
// 面板 Teleport（useFloating），↑↓ 移動、Enter／Space 選、Esc 關。
// variant：row 是桌機清單卡裡的一整列；inline 是手機類型索引列最前面的小鈕。
const props = withDefaults(
  defineProps<{
    groups: AreaGroup[]
    modelValue: string | null
    /** 這個縣全部的景點數（「不限」的件數） */
    total: number
    variant?: 'row' | 'inline'
  }>(),
  { variant: 'row' },
)
const emit = defineEmits<{ 'update:modelValue': [code: string | null] }>()

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { open, style, pref, side, origin, host } = useFloating(trigger, panel)
const id = `area-${Math.random().toString(36).slice(2, 8)}`

interface Row {
  code: string | null
  name: string
  kana?: string
  count: number
  /** 政令指定都市的區：往右縮一格 */
  ward: boolean
  /** 政令指定都市的第一個區：上面放市名 */
  city?: string
}
// 鍵盤移動用的攤平清單（第一列「不限」）
const rows = computed<Row[]>(() => [
  { code: null, name: '不限', count: props.total, ward: false },
  ...props.groups.flatMap((g) =>
    g.areas.map((a, i) => ({ code: a.code, name: a.name, kana: a.kana, count: a.count, ward: Boolean(g.city), city: i === 0 ? g.city : undefined })),
  ),
])
const index = (code: string | null) => rows.value.findIndex((r) => r.code === code)
const current = computed(() => rows.value.find((r) => r.code === props.modelValue) ?? null)
const active = ref(0)

async function show() {
  active.value = Math.max(0, index(props.modelValue))
  open.value = true
  await nextTick()
  const p = panel.value
  p?.focus()
  // 選中的那一列捲到面板中間（只捲面板自己）
  const el = p?.querySelector<HTMLElement>('[data-active="true"]')
  if (p && el) p.scrollTop = el.offsetTop - (p.clientHeight - el.offsetHeight) / 2
}
function pick(i: number) {
  const r = rows.value[i]
  if (r && r.code !== props.modelValue) emit('update:modelValue', r.code)
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
  const n = rows.value.length
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
watch(active, async () => {
  await nextTick()
  panel.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div class="flex min-w-0 items-center" :class="variant === 'row' ? 'gap-1' : 'gap-0.5'">
    <button
      ref="trigger"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="id"
      class="flex min-w-0 items-center gap-1.5 rounded-control border text-left text-ink active:not-disabled:translate-y-px"
      :class="[
        variant === 'row' ? 'h-9 flex-1 pr-2 pl-2.5 text-body-sm pointer-coarse:h-tap' : 'h-8 shrink-0 pr-1.5 pl-2.5 text-body-sm',
        modelValue ? 'border-region-strong bg-region-tint' : 'border-line bg-paper hover:bg-surface',
      ]"
      @click="open ? (open = false) : show()"
      @keydown="onTriggerKey"
    >
      <span class="shrink-0" :class="modelValue ? 'sr-only' : variant === 'row' ? 'text-caption text-sub' : ''">地區</span>
      <template v-if="current && modelValue">
        <span lang="ja" class="min-w-0 truncate font-bold">{{ current.name }}</span>
        <span class="shrink-0 font-num text-caption text-sub">{{ current.count }}</span>
      </template>
      <span v-else-if="variant === 'row'" class="min-w-0 flex-1 truncate">不限</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="ml-auto shrink-0 text-sub" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <button
      v-if="modelValue"
      type="button"
      aria-label="地區不限"
      class="grid shrink-0 place-items-center rounded-full text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:size-tap"
      :class="variant === 'row' ? 'size-9' : 'size-8'"
      @click="emit('update:modelValue', null)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
  <Teleport :to="host">
    <div
      v-if="open"
      :id="id"
      ref="panel"
      role="listbox"
      aria-label="地區"
      :aria-activedescendant="`${id}-${active}`"
      tabindex="-1"
      :data-pref="pref"
      data-floating
      data-reduce="fade"
      class="scroll-quiet fixed z-[80] flex max-h-[min(26rem,60dvh)] w-64 flex-col overflow-y-auto overscroll-contain rounded-card bg-paper p-1 shadow-float outline-none"
      :class="side === 'top' ? 'animate-pop-up' : 'animate-pop-in'"
      :style="{ ...style, transformOrigin: origin, minWidth: variant === 'row' && trigger ? `${trigger.offsetWidth}px` : undefined }"
      @keydown="onPanelKey"
    >
      <template v-for="(r, i) in rows" :key="r.code ?? ''">
        <!-- 政令指定都市：第一個區的上面放市名（不能選） -->
        <div v-if="r.city" lang="ja" role="presentation" class="shrink-0 px-2.5 pt-2.5 pb-1 text-caption font-bold tracking-section text-sub">
          {{ r.city }}
        </div>
        <button
          :id="`${id}-${i}`"
          type="button"
          role="option"
          tabindex="-1"
          :aria-selected="r.code === modelValue"
          :data-active="i === active"
          class="flex min-h-tap shrink-0 items-center gap-2 rounded-control pr-2.5 text-left text-body-sm text-ink"
          :class="[i === active ? 'bg-surface' : 'active:bg-surface', r.ward ? 'pl-5' : 'pl-2.5']"
          @pointermove="active = i"
          @click="pick(i)"
        >
          <span class="w-3.5 shrink-0 text-region-strong" aria-hidden="true">
            <svg v-if="r.code === modelValue" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <span class="flex min-w-0 flex-1 items-baseline gap-2">
            <span :lang="r.code ? 'ja' : undefined" class="shrink-0" :class="r.code === modelValue ? 'font-bold' : ''">{{ r.name }}</span>
            <span v-if="r.kana" lang="ja" class="min-w-0 truncate text-caption tracking-kana text-sub">{{ r.kana }}</span>
          </span>
          <span class="shrink-0 font-num text-caption text-sub">{{ r.count }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>
