<script setup lang="ts">
import { computed } from 'vue'

import ActionMenu, { type MenuAction } from './ActionMenu.vue'

// 行程停留點在觸控裝置上的「⋯」選單（TripStopList）：觸控時沒有拖曳把手與「移到」下拉，
// 排序、換天、移除都在這裡：移到最前／往前／往後／移到最後、移到別的一天或待排、從行程移除。
const props = defineProps<{
  name: string
  first: boolean
  last: boolean
  disabled?: boolean
  /** 這個停留點目前在哪一天（-1 待排） */
  day: number
  /** 可以移過去的天（-1 待排） */
  targets: { value: number; label: string; hint?: string }[]
}>()
const emit = defineEmits<{ shift: [delta: -1 | 1]; edge: [where: 'first' | 'last']; move: [toDay: number]; remove: [] }>()

const items = computed<MenuAction[]>(() => [
  { key: 'first', label: '移到最前', disabled: props.first },
  { key: 'up', label: '往前', disabled: props.first },
  { key: 'down', label: '往後', disabled: props.last },
  { key: 'last', label: '移到最後', disabled: props.last },
  ...props.targets
    .filter((t) => t.value !== props.day)
    .map((t) => ({ key: `to:${t.value}`, label: `移到 ${t.label}`, hint: t.hint, group: 1, leaves: true })),
  { key: 'remove', label: '從行程移除', group: 2, leaves: true },
])

function select(key: string) {
  if (key === 'first' || key === 'last') emit('edge', key)
  else if (key === 'up') emit('shift', -1)
  else if (key === 'down') emit('shift', 1)
  else if (key === 'remove') emit('remove')
  else if (key.startsWith('to:')) emit('move', Number(key.slice(3)))
}
</script>

<template>
  <ActionMenu
    :label="`${name} 的操作`"
    :items="items"
    :disabled="disabled"
    trigger-class="grid size-tap shrink-0 place-items-center rounded-control text-sub hover:not-disabled:bg-surface hover:not-disabled:text-ink disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px"
    @select="select"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18.5" cy="12" r="1.8" /></svg>
  </ActionMenu>
</template>
