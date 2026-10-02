<script setup lang="ts">
import { ref } from 'vue'

import { canSpeak, speakJa } from '../services/tts'

// 播放鈕（DESIGN.md §7.10）：瀏覽器內建的日文語音念出 text；播放中改地區淡色底。
const props = defineProps<{ text: string; label: string }>()
const playing = ref(false)
function play() {
  speakJa(props.text)
  playing.value = true
  setTimeout(() => (playing.value = false), 1200)
}
</script>

<template>
  <button
    v-if="canSpeak()"
    type="button"
    :aria-label="`播放 ${label}`"
    class="grid size-tap shrink-0 place-items-center rounded-full border border-line text-ink active:not-disabled:translate-y-px"
    :class="playing ? 'bg-region-tint' : 'bg-paper hover:bg-surface'"
    @click="play"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  </button>
</template>
