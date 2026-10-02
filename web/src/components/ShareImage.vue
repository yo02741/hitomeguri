<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { useModal } from '../composables/modal'

// 分享圖（旅行回顧、經縣值，DESIGN.md §7.22）：畫在 canvas 上預覽，可以下載 PNG，手機可以直接分享。
// 原生 <dialog>（composables/modal.ts）；圖畫好之後焦點移到「分享」或「下載」。
const props = defineProps<{
  title: string
  fileName: string
  render: (canvas: HTMLCanvasElement) => Promise<void>
}>()
const emit = defineEmits<{ close: [] }>()
const { cancel, closed } = useModal(() => emit('close'))

const canvas = ref<HTMLCanvasElement | null>(null)
const primary = ref<HTMLButtonElement | null>(null)
const ready = ref(false)
const failed = ref(false)
const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

onMounted(async () => {
  if (!canvas.value) return
  try {
    await props.render(canvas.value)
    ready.value = true
    await nextTick()
    primary.value?.focus()
  } catch {
    failed.value = true
  }
})

function blob(): Promise<Blob | null> {
  return new Promise((resolve) => canvas.value?.toBlob((b) => resolve(b), 'image/png') ?? resolve(null))
}
async function save() {
  const b = await blob()
  if (!b) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = `${props.fileName}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
async function share() {
  const b = await blob()
  if (!b) return
  const file = new File([b], `${props.fileName}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: props.title }).catch(() => {})
  } else {
    await save()
  }
}
</script>

<template>
  <dialog
    ref="dlg"
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:animate-scrim-in backdrop:bg-ink/70 print:hidden"
    :aria-label="title"
    @cancel="cancel"
    @close="closed"
  >
    <div class="flex size-full items-center justify-center p-4" @click.self="emit('close')">
      <div data-reduce="fade" class="flex max-h-full w-full max-w-[440px] animate-modal-in flex-col gap-3 rounded-card bg-paper p-3 shadow-float">
        <div class="relative min-h-0 overflow-auto rounded-[6px] bg-surface">
          <canvas ref="canvas" class="block h-auto w-full" :class="ready ? '' : 'opacity-0'"></canvas>
          <div v-if="!ready && !failed" class="skeleton absolute inset-0" aria-hidden="true"></div>
          <p v-if="failed" class="absolute inset-0 grid place-items-center text-body-sm text-sub">圖片做不出來</p>
        </div>
        <div class="flex gap-2">
          <button ref="primary" type="button" class="h-11 flex-1 rounded-control bg-region-strong text-body-sm font-bold text-white disabled:opacity-40 active:not-disabled:translate-y-px" :disabled="!ready" @click="canShare ? share() : save()">
            {{ canShare ? '分享' : '下載' }}
          </button>
          <button v-if="canShare" type="button" class="h-11 rounded-control border border-line px-4 text-body-sm hover:bg-surface disabled:opacity-40 active:not-disabled:translate-y-px" :disabled="!ready" @click="save">下載</button>
          <button type="button" class="h-11 rounded-control border border-line px-4 text-body-sm hover:bg-surface active:not-disabled:translate-y-px" @click="emit('close')">關閉</button>
        </div>
      </div>
    </div>
  </dialog>
</template>
