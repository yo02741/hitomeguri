<script setup lang="ts">
import { computed } from 'vue'

import { themeByKey } from '../data/themes'

// 主題符號 badge（DESIGN.md §6.2）：白底、主題色外框與符號；大點是墨色實心。
const props = defineProps<{ theme: string; size?: number }>()
const def = computed(() => themeByKey.get(props.theme))
const px = computed(() => props.size ?? 26)
</script>

<template>
  <span
    v-if="theme === 'major'"
    class="grid shrink-0 place-items-center rounded-badge bg-t-major text-paper shadow-marker"
    :style="{ width: `${px}px`, height: `${px}px` }"
    aria-hidden="true"
  >
    <svg :width="px * 0.62" :height="px * 0.62" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
    </svg>
  </span>
  <span
    v-else-if="def"
    class="grid shrink-0 place-items-center rounded-badge border-2 bg-paper shadow-marker"
    :style="{ width: `${px}px`, height: `${px}px`, borderColor: `var(--color-t-${theme})`, color: `var(--color-t-${theme})` }"
    aria-hidden="true"
  >
    <svg :width="px * 0.62" :height="px * 0.62" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path :d="def.icon" />
    </svg>
  </span>
</template>
