<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { useModal } from '../composables/modal'

// 規則說明書的外框（旅人、收集冊、成就的規則與成就的詳細）：使用者自己點才打開，不是 onboarding。
// 原生 <dialog>（composables/modal.ts）：Esc、點外面、「關閉」收起；打開時焦點在「關閉」，後面的頁面摸不到。
defineProps<{ title: string }>()
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
    aria-labelledby="rules-title"
    @cancel="cancel"
    @close="closed"
  >
    <div class="grid size-full place-items-center p-4" @click.self="emit('close')">
      <section data-reduce="fade" class="scroll-quiet flex max-h-full w-full max-w-[520px] animate-modal-in flex-col gap-5 overflow-y-auto overscroll-contain rounded-card bg-paper p-6 text-ink shadow-float max-sm:p-5">
        <header class="flex items-center">
          <h2 id="rules-title" class="text-h3 font-black tracking-title">{{ title }}</h2>
          <button ref="closeBtn" type="button" class="ml-auto h-9 rounded-control px-3 text-label font-bold text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px" @click="emit('close')">關閉</button>
        </header>
        <slot />
      </section>
    </div>
  </dialog>
</template>
