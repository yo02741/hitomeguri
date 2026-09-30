<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { PACKS } from '../data/packs'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'

// 地圖上方的擴充包列（UX-FLOW.md A4）：一次開一個；件數跟著目前的縣，首頁為全國。
// 最右邊的圖示打開設定，勾選要顯示哪些擴充包（存在這台瀏覽器）。
const props = defineProps<{ pref?: string | null }>()
const catalog = useCatalogStore()
const explore = useExploreStore()

// 還沒有 bundle 的擴充包不顯示
const shown = computed(() =>
  PACKS.filter((p) => explore.enabledPacks.includes(p.key) && catalog.index?.packs?.[p.key]),
)
function count(key: string): number | null {
  const items = catalog.packs[key]
  if (!items) return null
  return props.pref ? items.filter((it) => it.p === props.pref).length : items.length
}

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

const chip = 'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label font-bold shadow-float'
</script>

<template>
  <div ref="root" class="flex flex-wrap items-start justify-end gap-2">
    <button
      v-for="p in shown"
      :key="p.key"
      type="button"
      :class="[
        chip,
        explore.pack === p.key ? 'bg-(--pack) text-white' : 'bg-paper text-ink hover:bg-surface',
        count(p.key) === 0 && explore.pack !== p.key ? 'pointer-events-none opacity-50' : '',
      ]"
      :style="{ '--pack': `var(--color-t-${p.color})` }"
      :aria-pressed="explore.pack === p.key"
      :disabled="count(p.key) === 0 && explore.pack !== p.key"
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
      <span v-if="count(p.key) !== null" class="font-latin font-semibold">{{ count(p.key) }}</span>
    </button>

    <div class="relative">
      <button
        type="button"
        aria-label="選擇擴充包"
        :aria-expanded="menuOpen"
        class="grid size-9 place-items-center rounded-full bg-paper text-ink shadow-float hover:bg-surface"
        @click="menuOpen = !menuOpen"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </button>
      <div
        v-if="menuOpen"
        class="absolute top-11 right-0 z-20 flex w-72 flex-col rounded-card bg-paper p-1.5 shadow-float"
        role="menu"
      >
        <span class="px-2.5 pt-1.5 pb-1 text-caption font-bold tracking-section text-sub">擴充包</span>
        <label
          v-for="p in PACKS"
          :key="p.key"
          class="flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-body-sm hover:bg-surface"
          role="menuitemcheckbox"
          :aria-checked="explore.enabledPacks.includes(p.key)"
          :style="{ '--pack': `var(--color-t-${p.color})` }"
        >
          <input
            type="checkbox"
            class="size-4 accent-(--pack)"
            :checked="explore.enabledPacks.includes(p.key)"
            @change="explore.setPackEnabled(p.key, ($event.target as HTMLInputElement).checked)"
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-(--pack)" aria-hidden="true">
            <path :d="p.icon" />
          </svg>
          <span class="flex min-w-0 flex-col py-1.5">
            <span class="font-bold">{{ p.label }}</span>
            <span class="truncate text-caption text-sub">{{ p.groups.map((g) => g.label).join('・') }}</span>
          </span>
        </label>
      </div>
    </div>
  </div>
</template>
