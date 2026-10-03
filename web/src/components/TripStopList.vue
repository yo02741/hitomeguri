<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { regionOf } from '../data/regions'
import type { MapSpot } from '../services/bundles'
import { type Stop, type StopPos, transitUrl } from '../services/trip'
import Dropdown from './Dropdown.vue'
import StopMenu from './StopMenu.vue'

// 行程某一天（或「待排」）的停留點。拖曳排序／換天，另有「移到」選單與上下移動（觸控、鍵盤用）。
// 觸控裝置上，往前、往後、移除收進「⋯」選單（StopMenu）：24px 的小鈕手指點不到，兩顆 44px 又會擠掉名稱。
// 天與天之間的相鄰停留點放 Google Maps 大眾運輸路線連結。
const props = defineProps<{
  stops: Stop[]
  /** -1 為待排 */
  day: number
  spots: Map<string, MapSpot>
  /** 「移到」選單的選項：值為天的索引（-1 待排） */
  targets: { value: number; label: string }[]
  dropAt: StopPos | null
  focusId?: string | null
  /** 離線時不能修改：拖曳、移到、往前往後、移除都停用 */
  locked?: boolean
}>()
const emit = defineEmits<{
  dragstart: [pos: StopPos]
  dragover: [pos: StopPos]
  drop: []
  dragend: []
  move: [from: StopPos, toDay: number]
  shift: [from: StopPos, delta: -1 | 1]
  remove: [pos: StopPos]
  focus: [spotId: string]
}>()

function onStart(idx: number, e: DragEvent) {
  e.dataTransfer?.setData('text/plain', props.stops[idx]?.name ?? '')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  emit('dragstart', { day: props.day, idx })
}
function onOverRow(idx: number, e: DragEvent) {
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  emit('dragover', { day: props.day, idx: e.clientY < r.top + r.height / 2 ? idx : idx + 1 })
}
function onOverList(e: DragEvent) {
  e.preventDefault()
  if (e.target === e.currentTarget) emit('dragover', { day: props.day, idx: props.stops.length })
}
// 移除後讀屏器讀出「已移除 ○○」（列表項目直接消失，沒有別的提示）；同一句再出現時先清空才會再唸
const announce = ref('')
// 焦點移到下一個（沒有就上一個）停留點的名稱，按鈕跟著整列消失時才不會掉到 <body>；
// 這天移空了，等寫入回來、出現「這天還沒有地點」再移過去
const list = ref<{ $el: HTMLElement } | null>(null)
const focusEmpty = ref(false)
function focusName(spotId: string) {
  list.value?.$el.querySelector<HTMLElement>(`[data-stop="${CSS.escape(spotId)}"]`)?.focus()
}
async function remove(i: number) {
  const name = props.stops[i]?.name ?? ''
  const near = props.stops[i + 1] ?? props.stops[i - 1]
  if (near) focusName(near.spot_id)
  else focusEmpty.value = true
  emit('remove', { day: props.day, idx: i })
  announce.value = ''
  await nextTick()
  announce.value = `已移除 ${name}`
}
watch(
  () => props.stops.length,
  (n) => {
    if (!focusEmpty.value) return
    focusEmpty.value = false
    if (n === 0) list.value?.$el.querySelector<HTMLElement>('[data-empty]')?.focus()
  },
  { flush: 'post' },
)
const isDrop = (idx: number) => props.dropAt?.day === props.day && props.dropAt.idx === idx
</script>

<template>
  <!-- 排序、換天時停留點滑到新的位置（DESIGN.md §9） -->
  <TransitionGroup
    ref="list"
    tag="ol"
    name="stop"
    class="flex min-h-12 flex-col rounded-control"
    :class="dropAt?.day === day ? 'bg-surface' : ''"
    @dragover="onOverList"
    @drop.prevent="emit('drop')"
  >
    <template v-for="(s, i) in stops" :key="s.spot_id">
      <li
        v-if="day >= 0 && i > 0"
        class="flex items-center gap-2 py-0.5 pl-9 text-caption text-sub"
        @dragover="onOverRow(i - 1, $event)"
      >
        <a :href="transitUrl(stops[i - 1]!, s)" target="_blank" rel="noopener" class="flex items-center gap-1 text-sub hover:text-ink active:text-ink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
          轉乘路線
        </a>
      </li>
      <li
        :id="`stop-${s.spot_id}`"
        :draggable="!locked"
        class="group flex items-center gap-2 rounded-control border-t-2 py-1.5 pr-1 pl-1"
        :class="[isDrop(i) ? 'border-region-strong' : 'border-transparent', focusId === s.spot_id ? 'bg-region-tint' : 'hover:bg-surface active:bg-surface']"
        @dragstart="onStart(i, $event)"
        @dragover="onOverRow(i, $event)"
        @dragend="emit('dragend')"
      >
        <span class="grid w-7 shrink-0 place-items-center text-sub" :class="locked ? 'opacity-40' : 'cursor-grab'" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
        </span>
        <span v-if="day >= 0" class="grid size-6 shrink-0 place-items-center rounded-full bg-ink font-latin text-caption font-bold text-paper">{{ i + 1 }}</span>
        <button type="button" :data-stop="s.spot_id" class="flex min-w-0 flex-1 flex-col text-left active:not-disabled:translate-y-px" @click="emit('focus', s.spot_id)">
          <span v-if="spots.get(s.spot_id)?.h" lang="ja" class="truncate text-caption tracking-kana text-sub" :title="spots.get(s.spot_id)?.h">{{ spots.get(s.spot_id)?.h }}</span>
          <span class="line-clamp-2 text-body-sm break-words">
            <span lang="ja" class="font-bold">{{ s.name }}</span>
            <span lang="ja" class="ml-1.5 text-caption whitespace-nowrap text-sub">{{ regionOf(s.pref)?.name.ja }}</span>
          </span>
        </button>
        <Dropdown
          :model-value="String(day)"
          :options="targets.map((t) => ({ value: String(t.value), label: t.label }))"
          :label="`${s.name} 移到`"
          size="sm"
          align="end"
          :disabled="locked"
          class="w-[5.5rem]"
          @update:model-value="emit('move', { day, idx: i }, Number($event))"
        />
        <span class="flex shrink-0 flex-col pointer-coarse:hidden">
          <button type="button" :aria-label="`${s.name} 往前`" :disabled="locked || i === 0" class="grid h-4 w-6 place-items-center text-sub hover:text-ink disabled:opacity-30 active:not-disabled:translate-y-px" @click="emit('shift', { day, idx: i }, -1)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
          </button>
          <button type="button" :aria-label="`${s.name} 往後`" :disabled="locked || i === stops.length - 1" class="grid h-4 w-6 place-items-center text-sub hover:text-ink disabled:opacity-30 active:not-disabled:translate-y-px" @click="emit('shift', { day, idx: i }, 1)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </span>
        <button type="button" :aria-label="`從行程移除：${s.name}`" :disabled="locked" class="grid size-8 shrink-0 place-items-center rounded-control text-sub hover:not-disabled:bg-surface hover:not-disabled:text-ink disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:hidden active:not-disabled:translate-y-px" @click="remove(i)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <span class="hidden pointer-coarse:contents">
          <StopMenu :name="s.name" :disabled="locked" :first="i === 0" :last="i === stops.length - 1" @shift="emit('shift', { day, idx: i }, $event)" @remove="remove(i)" />
        </span>
      </li>
    </template>
    <li
      v-if="!stops.length"
      key="empty"
      data-empty
      tabindex="-1"
      class="px-2 py-3 text-caption text-sub"
      :class="isDrop(0) ? 'border-t-2 border-region-strong' : ''"
      @dragover.prevent="emit('dragover', { day, idx: 0 })"
    >
      {{ day >= 0 ? '這天還沒有地點' : '沒有待排的地點' }}
    </li>
    <li v-else-if="isDrop(stops.length)" key="drop-end" class="h-0 border-t-2 border-region-strong" aria-hidden="true"></li>
  </TransitionGroup>
  <p class="sr-only" aria-live="polite">{{ announce }}</p>
</template>

<style scoped>
.stop-move {
  transition: transform 0.25s var(--ease-out-soft);
}
.stop-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s var(--ease-out-soft);
}
.stop-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
/* 離開不做動畫：換天時直接從這天拿掉 */
.stop-leave-active {
  display: none;
}
</style>
