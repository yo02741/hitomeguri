<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { NavItem } from '../composables/scrollSpy'

// 頁內段落目錄（DESIGN.md §7.2a）。side：桌機左側直列，目前段落的子段落展開；
// bar：手機頂部橫列，目前段落捲到中間。每一項都是 #錨點連結。
const props = defineProps<{ items: NavItem[]; active: string | null; variant: 'side' | 'bar' }>()
const emit = defineEmits<{ go: [id: string] }>()

/** 目前所在的第一層段落（捲到子段落時是它的上層） */
const activeTop = computed(
  () => props.items.find((it) => it.id === props.active || it.children?.some((c) => c.id === props.active))?.id ?? null,
)

const bar = ref<HTMLElement | null>(null)
watch(activeTop, async (id) => {
  if (props.variant !== 'bar' || !id) return
  await nextTick()
  const el = bar.value?.querySelector<HTMLElement>(`[data-id="${id}"]`)
  if (el && bar.value) bar.value.scrollTo({ left: el.offsetLeft - (bar.value.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
})
</script>

<template>
  <nav v-if="variant === 'side'" aria-label="段落" class="flex flex-col text-body-sm">
    <template v-for="it in items" :key="it.id">
      <a
        :href="`#${it.id}`"
        class="flex items-baseline gap-1.5 border-l-2 py-1.5 pl-3.5 no-underline"
        :class="activeTop === it.id ? 'border-region-strong font-bold text-ink' : 'border-line text-sub hover:text-ink'"
        :aria-current="activeTop === it.id ? 'location' : undefined"
        @click.prevent="emit('go', it.id)"
      >
        {{ it.label }}<span v-if="it.count" class="font-latin text-caption font-normal text-sub">{{ it.count }}</span>
      </a>
      <div v-if="it.children?.length && activeTop === it.id" class="flex flex-col border-l-2 border-region-strong pb-1">
        <a
          v-for="c in it.children"
          :key="c.id"
          :href="`#${c.id}`"
          class="py-1 pl-6 text-caption no-underline"
          :class="active === c.id ? 'font-bold text-ink' : 'text-sub hover:text-ink'"
          :aria-current="active === c.id ? 'location' : undefined"
          @click.prevent="emit('go', c.id)"
        >
          {{ c.label }}
        </a>
      </div>
    </template>
  </nav>
  <nav v-else ref="bar" aria-label="段落" class="scroll-quiet flex gap-1 overflow-x-auto">
    <a
      v-for="it in items"
      :key="it.id"
      :data-id="it.id"
      :href="`#${it.id}`"
      class="flex h-8 shrink-0 items-center rounded-full px-3 text-label no-underline"
      :class="activeTop === it.id ? 'bg-region-strong font-bold text-white' : 'text-sub hover:bg-surface hover:text-ink'"
      :aria-current="activeTop === it.id ? 'location' : undefined"
      @click.prevent="emit('go', it.id)"
    >
      {{ it.label }}
    </a>
  </nav>
</template>
