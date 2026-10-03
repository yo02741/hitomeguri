<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useSwipe } from '../composables/swipe'
import { confirmDialog } from '../services/confirm'
import { type Find, useFindsStore } from '../stores/finds'
import { useTripsStore } from '../stores/trips'
import FindEditor from './FindEditor.vue'

// 截圖 gallery（DESIGN.md §7.17）：瀑布流（CSS columns），每張依原圖比例，太長的截圖只露上半部。
// 點開看原圖（長截圖可以捲動）、編輯、刪除；←／→ 或左右滑換上一張、下一張，點外面關閉。
// 手機（<768）的框依圖片高度，短的截圖不留空白；最高到畫面高減 32px，再長就在框裡捲。
const props = defineProps<{ finds: Find[]; tripId?: string; columns?: 'narrow' | 'wide' }>()
const store = useFindsStore()
const trips = useTripsStore()

const viewing = ref<number | null>(null)
const current = computed(() => (viewing.value === null ? null : (props.finds[viewing.value] ?? null)))
const full = ref<string | null>(null)
const viewer = ref<HTMLDialogElement | null>(null)
const editorOpen = ref(false)
const editing = ref<Find | null>(null)

function tripName(id?: string): string {
  if (!id) return ''
  const t = trips.get(id)
  return t ? t.name || '未命名行程' : ''
}

async function show(i: number) {
  enterFrom.value = null
  viewing.value = i
  await nextTick()
  if (!viewer.value?.open) viewer.value?.showModal()
}
function hide() {
  viewer.value?.close()
  viewing.value = null
}
// 滑動換張時新的圖從那一側進來（按鈕、方向鍵照舊直接換）
const enterFrom = ref<'left' | 'right' | null>(null)
function step(n: -1 | 1, animate = false) {
  if (viewing.value === null || !props.finds.length) return
  enterFrom.value = animate ? (n > 0 ? 'right' : 'left') : null
  viewing.value = (viewing.value + n + props.finds.length) % props.finds.length
}
// 左右滑（和卡片檢視同一套，composables/swipe.ts）：頭尾相接，只有一張時拉了會彈回
const frame = ref<HTMLElement | null>(null)
const swipe = useSwipe({
  el: () => frame.value,
  canStep: () => props.finds.length > 1,
  step: (d) => step(d, true),
})
// 點對話框外面（::backdrop 的點擊落在 <dialog> 本身）關閉；在框裡按下、拖到外面放開不算
let downOnBackdrop = false
function onDialogPointerDown(e: PointerEvent) {
  downOnBackdrop = e.target === viewer.value
}
function onDialogClick(e: MouseEvent) {
  if (downOnBackdrop && e.target === viewer.value) hide()
  downOnBackdrop = false
}
watch(
  current,
  async (f) => {
    full.value = null
    if (!f) return
    const data = await store.image(f.id)
    if (current.value?.id === f.id) full.value = data
  },
)
// 刪掉最後一張時關掉
watch(
  () => props.finds.length,
  (n) => {
    if (viewing.value !== null && viewing.value >= n) n ? (viewing.value = n - 1) : hide()
  },
)

function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).closest('input, textarea, select')) return
  if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}

function add() {
  editing.value = null
  editorOpen.value = true
}
function edit(f: Find) {
  editing.value = f
  editorOpen.value = true
}
async function del(f: Find) {
  if (!(await confirmDialog({ title: `刪除這張截圖${f.item ? `「${f.item}」` : ''}？`, ok: '刪除', danger: true }))) return
  await store.remove(f.id)
}

defineExpose({ add })
</script>

<template>
  <div>
    <ul
      v-if="finds.length"
      class="gap-3"
      :class="columns === 'narrow' ? 'columns-2 sm:columns-3' : 'columns-2 sm:columns-3 lg:columns-4'"
    >
      <li v-for="(f, i) in finds" :key="f.id" class="mb-3 break-inside-avoid">
        <button
          type="button"
          class="flex w-full flex-col overflow-hidden rounded-card border border-line bg-paper text-left hover:shadow-float active:not-disabled:translate-y-px"
          @click="show(i)"
        >
          <img
            :src="f.thumb"
            :alt="f.item || f.brand || '截圖'"
            :style="{ aspectRatio: `${f.w} / ${f.h}` }"
            class="block max-h-[360px] w-full bg-surface object-cover object-top"
          />
          <span v-if="f.brand || f.item || f.note" class="flex flex-col gap-0.5 px-3 py-2.5">
            <span v-if="f.brand" class="text-caption text-sub">{{ f.brand }}</span>
            <span v-if="f.item" class="text-body-sm font-bold">{{ f.item }}</span>
            <span v-if="f.note" class="line-clamp-2 text-caption text-ink-2">{{ f.note }}</span>
          </span>
        </button>
      </li>
    </ul>

    <dialog
      ref="viewer"
      class="m-auto h-[calc(100dvh-32px)] w-[min(1040px,calc(100vw-32px))] overflow-hidden rounded-card bg-paper p-0 text-ink shadow-float backdrop:bg-ink/60 max-md:h-fit max-md:max-h-[calc(100dvh-32px)] max-md:open:flex max-md:open:flex-col"
      aria-label="截圖"
      @cancel="viewing = null"
      @close="viewing = null"
      @keydown="onKey"
      @pointerdown="onDialogPointerDown"
      @click="onDialogClick"
    >
      <div v-if="current" class="flex h-full max-md:contents">
        <div
          :key="current.id"
          ref="frame"
          data-reduce="fade"
          class="shot scroll-quiet relative min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-x-hidden overflow-y-auto bg-surface max-md:flex-initial"
          :class="enterFrom ? `from-${enterFrom}` : ''"
          @pointerdown="swipe.onPointerDown"
          @pointermove="swipe.onPointerMove"
          @pointerup="swipe.onPointerUp"
          @pointercancel="swipe.onPointerCancel"
        >
          <img
            :src="full ?? current.thumb"
            :alt="current.item || current.brand || '截圖'"
            draggable="false"
            class="mx-auto block h-auto w-auto max-w-full"
            :style="{ aspectRatio: `${current.w} / ${current.h}` }"
          />
        </div>
        <div class="flex shrink-0 flex-col gap-3 border-line p-5 md:w-[300px] md:border-l max-md:max-h-[40dvh] max-md:overflow-y-auto max-md:border-t">
          <div class="flex items-center gap-1">
            <button type="button" class="grid size-9 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:size-tap" aria-label="上一張" @click="step(-1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <span class="font-latin text-body-sm text-sub">{{ (viewing ?? 0) + 1 }} / {{ finds.length }}</span>
            <button type="button" class="grid size-9 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:size-tap" aria-label="下一張" @click="step(1)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
            <button type="button" class="ml-auto grid size-9 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:size-tap" aria-label="關閉" @click="hide">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <div class="flex flex-col gap-1">
            <span v-if="current.brand" class="text-label text-sub">{{ current.brand }}</span>
            <span v-if="current.item" class="text-title font-black">{{ current.item }}</span>
            <p v-if="current.note" class="text-body-sm whitespace-pre-line text-ink-2">{{ current.note }}</p>
            <RouterLink
              v-if="tripName(current.trip_id)"
              :to="`/trips/${current.trip_id}`"
              class="mt-1 w-fit text-caption text-sub active:text-ink"
            >{{ tripName(current.trip_id) }}</RouterLink>
          </div>
          <div class="mt-auto flex gap-2">
            <button type="button" class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="edit(current)">
              編輯
            </button>
            <button type="button" class="h-9 rounded-control border border-line bg-paper px-3 text-label text-danger hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="del(current)">
              刪除
            </button>
          </div>
        </div>
      </div>
    </dialog>

    <FindEditor v-model:open="editorOpen" :find="editing" :trip-id="tripId" />
  </div>
</template>

<style scoped>
.shot.from-right {
  animation: shot-from-right 0.28s var(--ease-out-soft) both;
}
.shot.from-left {
  animation: shot-from-left 0.28s var(--ease-out-soft) both;
}
@keyframes shot-from-right {
  from {
    opacity: 0;
    transform: translateX(48px);
  }
}
@keyframes shot-from-left {
  from {
    opacity: 0;
    transform: translateX(-48px);
  }
}
</style>
