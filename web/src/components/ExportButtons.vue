<script setup lang="ts">
import { computed } from 'vue'

import { download, type ExportFolder, type ExportRow, foldersByPref, shareOrDownload, toCsv, toKml } from '../services/export'
import { coarse, wide } from '../services/viewport'
import ActionMenu, { type MenuAction } from './ActionMenu.vue'

// 匯出：KML（可匯入 Google My Maps）、CSV。只給 rows 時依縣分 folder。
// 桌機兩顆鈕、直接下載；手機（<1024）收成一顆「匯出 ▾」，能分享檔案時走系統分享（決定事項 P2）。
// more 是同一個選單裡的其他動作（清單頁的改名、刪除），選了由呼叫端處理（select）。
const props = defineProps<{ title: string; rows?: ExportRow[]; folders?: ExportFolder[]; leading?: string[]; more?: MenuAction[] }>()
const emit = defineEmits<{ select: [key: string] }>()

const folders = computed(() => props.folders ?? foldersByPref(props.rows ?? []))
const rows = computed(() => folders.value.flatMap((f) => f.rows))

const items = computed<MenuAction[]>(() => [
  { key: 'kml', label: 'KML', disabled: !rows.value.length },
  { key: 'csv', label: 'CSV', disabled: !rows.value.length },
  ...(props.more ?? []).map((a) => ({ ...a, group: (a.group ?? 0) + 1 })),
])

function run(ext: 'kml' | 'csv') {
  const content = ext === 'kml' ? toKml(props.title, folders.value) : toCsv(rows.value, props.leading)
  // 觸控或窄螢幕才走系統分享；桌機維持下載
  if (coarse.value || !wide.value) void shareOrDownload(props.title, ext, content)
  else download(props.title, ext, content)
}
function onSelect(key: string) {
  if (key === 'kml' || key === 'csv') run(key)
  else emit('select', key)
}
</script>

<template>
  <div class="flex gap-2">
    <span class="contents max-lg:hidden">
      <button
        type="button"
        class="h-9 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
        :disabled="!rows.length"
        @click="run('kml')"
      >
        匯出 KML
      </button>
      <button
        type="button"
        class="h-9 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
        :disabled="!rows.length"
        @click="run('csv')"
      >
        匯出 CSV
      </button>
    </span>
    <span class="contents lg:hidden">
      <ActionMenu
        label="匯出"
        :items="items"
        trigger-class="flex h-9 items-center gap-1 rounded-control border border-line bg-paper pr-2 pl-3 text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
        @select="onSelect"
      >
        匯出
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="text-sub" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </ActionMenu>
    </span>
  </div>
</template>
