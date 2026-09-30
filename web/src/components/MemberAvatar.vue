<script setup lang="ts">
import { ref } from 'vue'

import type { Member } from '../services/trip'

// 成員頭像：Google 大頭貼，沒有或載入失敗時用名字的第一個字。
defineProps<{ member?: Member; size?: number }>()
const failed = ref(false)
</script>

<template>
  <span
    class="grid shrink-0 place-items-center overflow-hidden rounded-full bg-region-tint text-caption font-bold text-ink"
    :style="{ width: `${size ?? 28}px`, height: `${size ?? 28}px` }"
    :title="member?.name"
  >
    <img
      v-if="member?.photo && !failed"
      :src="member.photo"
      alt=""
      referrerpolicy="no-referrer"
      class="size-full object-cover"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ (member?.name || '?').slice(0, 1) }}</span>
  </span>
</template>
