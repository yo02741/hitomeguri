<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { usePackChips } from '../composables/packChips'
import { useExploreStore } from '../stores/explore'
import PackSettings from './PackSettings.vue'
import RollingNumber from './RollingNumber.vue'

// 地圖左側、地區標籤下方的擴充包列（UX-FLOW.md A4）：一次開一個；件數跟著目前的縣，首頁為全國。
// 最右邊的圖示打開設定，勾選要顯示哪些擴充包（存在這台瀏覽器）。手機用 ChipRail。
const props = defineProps<{ pref?: string | null }>()
const explore = useExploreStore()
const { shown, count, empty } = usePackChips(() => props.pref)

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (menuOpen.value && root.value && !root.value.contains(e.target as Node)) menuOpen.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

const chip = 'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-bold shadow-float active:not-disabled:translate-y-px'
</script>

<template>
  <!-- contents：擴充包鈕和外層的其他鈕（收藏）排在同一列、一起換行 -->
  <div ref="root" class="contents">
    <button
      v-for="p in shown"
      :key="p.key"
      type="button"
      :class="[
        chip,
        explore.pack === p.key ? 'bg-(--pack) text-white' : 'bg-paper text-ink hover:bg-surface',
        empty(p.key) ? 'pointer-events-none opacity-50' : '',
      ]"
      :style="{ '--pack': `var(--color-t-${p.color})` }"
      :aria-pressed="explore.pack === p.key"
      :disabled="empty(p.key)"
      @click="explore.togglePack(p.key)"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="explore.pack === p.key ? '' : 'text-(--pack)'"
        aria-hidden="true"
      >
        <path :d="p.icon" />
      </svg>
      {{ p.label }}
      <RollingNumber v-if="count(p.key) !== null" :value="count(p.key) ?? 0" class="font-latin font-semibold" />
    </button>

    <div class="relative">
      <button
        type="button"
        aria-label="選擇擴充包"
        :aria-expanded="menuOpen"
        class="grid size-9 place-items-center rounded-full bg-paper text-ink shadow-float hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:size-tap"
        @click="menuOpen = !menuOpen"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </button>
      <PackSettings v-if="menuOpen" class="absolute top-11 left-0 z-20 origin-top-left" />
    </div>
  </div>
</template>
