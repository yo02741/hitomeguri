<script setup lang="ts">
import { computed } from 'vue'

import { download, type ExportFolder, type ExportRow, foldersByPref, toCsv, toKml } from '../services/export'

// 匯出：KML（可匯入 Google My Maps）、CSV。只給 rows 時依縣分 folder。
const props = defineProps<{ title: string; rows?: ExportRow[]; folders?: ExportFolder[]; leading?: string[] }>()

const folders = computed(() => props.folders ?? foldersByPref(props.rows ?? []))
const rows = computed(() => folders.value.flatMap((f) => f.rows))
</script>

<template>
  <div class="flex gap-2">
    <button
      type="button"
      class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px"
      :disabled="!rows.length"
      @click="download(title, 'kml', toKml(title, folders))"
    >
      匯出 KML
    </button>
    <button
      type="button"
      class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px"
      :disabled="!rows.length"
      @click="download(title, 'csv', toCsv(rows, leading))"
    >
      匯出 CSV
    </button>
  </div>
</template>
