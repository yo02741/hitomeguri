<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

import { useModal } from '../composables/modal'
import type { ConfirmRequest } from '../services/confirm'

// 站內確認框（services/confirm.ts、DESIGN.md §7.26）：原生 <dialog>，Esc、點外面、「取消」都算取消。
// 打開時焦點在「取消」：不能復原的動作，Enter 不會直接做下去。
// 從選單裡打開（共編選單）：data-floating 讓點框裡不算點到選單外面，Esc 不往外傳，只關確認框。
const props = defineProps<{ req: ConfirmRequest }>()
const { cancel, closed } = useModal(() => props.req.resolve(false))

const cancelBtn = ref<HTMLButtonElement | null>(null)
onMounted(async () => {
  await nextTick()
  cancelBtn.value?.focus()
})
</script>

<template>
  <dialog
    ref="dlg"
    data-floating
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:animate-scrim-in backdrop:bg-ink/60"
    aria-labelledby="confirm-title"
    :aria-describedby="req.body ? 'confirm-body' : undefined"
    @keydown.esc.stop
    @cancel="cancel"
    @close="closed"
  >
    <div class="grid size-full place-items-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" @click.self="req.resolve(false)">
      <section data-reduce="fade" class="flex w-full max-w-[400px] animate-modal-in flex-col gap-2 rounded-card bg-paper p-6 text-ink shadow-float max-sm:p-5">
        <h2 id="confirm-title" class="text-body font-bold break-words">{{ req.title }}</h2>
        <p v-if="req.body" id="confirm-body" class="text-body-sm text-sub">{{ req.body }}</p>
        <div class="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button
            ref="cancelBtn"
            type="button"
            class="h-11 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px"
            @click="req.resolve(false)"
          >
            取消
          </button>
          <button
            type="button"
            class="h-11 rounded-control px-4 text-body-sm font-bold text-white active:not-disabled:translate-y-px"
            :class="req.danger ? 'bg-danger' : 'bg-region-strong'"
            @click="req.resolve(true)"
          >
            {{ req.ok }}
          </button>
        </div>
      </section>
    </div>
  </dialog>
</template>
