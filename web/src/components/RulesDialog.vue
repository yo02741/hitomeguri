<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

// 規則說明書的外框（旅人、收集冊、成就）：使用者自己點「規則」才打開，不是 onboarding。
// Esc、點外面、「關閉」收起；打開時焦點在「關閉」，Tab 在框裡繞（aria-modal：後面的頁面摸不到）。
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const closeBtn = ref<HTMLButtonElement | null>(null)
const box = ref<HTMLElement | null>(null)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'Tab' && box.value) {
    const els = [...box.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
    if (!els.length) return
    const first = els[0]!
    const last = els[els.length - 1]!
    const cur = document.activeElement
    const inside = cur instanceof Node && box.value.contains(cur)
    const edge = e.shiftKey ? first : last
    if (!inside || cur === edge) {
      e.preventDefault()
      const to = e.shiftKey ? last : first
      to.focus()
    }
  }
}
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  closeBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 z-[70] grid place-items-center bg-ink/60 p-4" @click.self="emit('close')">
    <section ref="box" class="rules scroll-quiet flex max-h-full w-full max-w-[520px] flex-col gap-5 overflow-y-auto overscroll-contain rounded-card bg-paper p-6 text-ink shadow-float max-sm:p-5" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <header class="flex items-center">
        <h2 id="rules-title" class="text-h3 font-black tracking-[2px]">{{ title }}</h2>
        <button ref="closeBtn" type="button" class="ml-auto h-9 rounded-control px-3 text-label font-bold text-sub hover:bg-surface hover:text-ink" @click="emit('close')">關閉</button>
      </header>
      <slot />
    </section>
  </div>
</template>

<style scoped>
.rules {
  animation: rules-in 0.2s var(--ease-out-soft) both;
}
@keyframes rules-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rules {
    animation: none;
  }
}
</style>
