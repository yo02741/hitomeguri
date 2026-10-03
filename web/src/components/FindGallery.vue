<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { confirmDialog } from '../services/confirm'
import { type Find, useFindsStore } from '../stores/finds'
import { useTripsStore } from '../stores/trips'
import FindEditor from './FindEditor.vue'

// 截圖 gallery（DESIGN.md §7.17）：瀑布流（CSS columns），每張依原圖比例，太長的截圖只露上半部。
// 點開看原圖（長截圖可以捲動）、編輯、刪除；←／→ 換上一張、下一張。
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
  viewing.value = i
  await nextTick()
  if (!viewer.value?.open) viewer.value?.showModal()
}
function hide() {
  viewer.value?.close()
  viewing.value = null
}
function step(n: number) {
  if (viewing.value === null || !props.finds.length) return
  viewing.value = (viewing.value + n + props.finds.length) % props.finds.length
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
      class="m-auto h-[calc(100dvh-32px)] w-[min(1040px,calc(100vw-32px))] overflow-hidden rounded-card bg-paper p-0 text-ink shadow-float backdrop:bg-ink/60"
      aria-label="截圖"
      @cancel="viewing = null"
      @close="viewing = null"
      @keydown="onKey"
    >
      <div v-if="current" class="flex h-full max-md:flex-col">
        <div class="scroll-quiet relative min-h-0 flex-1 overflow-y-auto bg-surface">
          <img
            :src="full ?? current.thumb"
            :alt="current.item || current.brand || '截圖'"
            class="mx-auto block h-auto w-auto max-w-full"
            :style="{ aspectRatio: `${current.w} / ${current.h}` }"
          />
        </div>
        <div class="flex shrink-0 flex-col gap-3 border-line p-5 md:w-[300px] md:border-l max-md:max-h-[40%] max-md:overflow-y-auto max-md:border-t">
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
