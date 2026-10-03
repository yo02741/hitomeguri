<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { useModal } from '../composables/modal'

// 手機從下方出現的對話框（共編）：原生 <dialog>（composables/modal.ts），在最上層，不會被底部分頁列蓋住，
// 後面的頁面摸不到。Esc、點上面的遮罩、「關閉」收起；Android 的返回鍵由 <dialog> 自己處理。
// 打開時焦點在「關閉」。
const props = defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
const { cancel, closed } = useModal(() => emit('close'))

const closeBtn = ref<HTMLButtonElement | null>(null)
onMounted(async () => {
  await nextTick()
  closeBtn.value?.focus()
})
</script>

<template>
  <dialog
    ref="dlg"
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:animate-scrim-in backdrop:bg-ink/60"
    :aria-label="props.title"
    @cancel="cancel"
    @close="closed"
  >
    <div class="flex size-full flex-col justify-end pt-12" @click.self="emit('close')">
      <section
        data-reduce="fade"
        class="scroll-quiet mx-auto flex max-h-full w-full max-w-[560px] animate-sheet-in flex-col overflow-y-auto overscroll-contain rounded-t-sheet bg-paper px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-sheet"
      >
        <header class="sticky top-0 z-10 -mx-5 flex items-center gap-3 bg-paper px-5 pt-3 pb-2">
          <h2 class="text-body font-bold">{{ props.title }}</h2>
          <button ref="closeBtn" type="button" class="-mr-3 ml-auto min-h-tap rounded-control px-3 text-body-sm font-bold text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px" @click="emit('close')">關閉</button>
        </header>
        <slot />
      </section>
    </div>
  </dialog>
</template>
