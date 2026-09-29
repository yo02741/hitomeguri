<script setup lang="ts">
import type { MarkedSpot } from '../composables/markedSpots'
import { download, toCsv, toKml } from '../services/export'

// 匯出：KML（可匯入 Google My Maps）、CSV
const props = defineProps<{ title: string; rows: MarkedSpot[] }>()
</script>

<template>
  <div class="flex gap-2">
    <button
      type="button"
      class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="!rows.length"
      @click="download(props.title, 'kml', toKml(props.title, props.rows))"
    >
      匯出 KML
    </button>
    <button
      type="button"
      class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="!rows.length"
      @click="download(props.title, 'csv', toCsv(props.rows))"
    >
      匯出 CSV
    </button>
  </div>
</template>
