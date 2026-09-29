<script setup lang="ts">
import type { Phrase } from '../services/prep'
import SpeakButton from './SpeakButton.vue'

// 片語列（DESIGN.md §7.11）：假名 → 日文 → 中文；「聽」的建議回答放外框 chip。
defineProps<{ phrase: Phrase }>()
</script>

<template>
  <li class="flex items-start gap-3 border-b border-line-soft py-3 last:border-b-0">
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span lang="ja" class="text-caption tracking-kana text-sub">{{ phrase.kana }}</span>
      <span lang="ja" class="text-title font-bold">{{ phrase.ja }}</span>
      <span class="text-body-sm text-ink-2">{{ phrase.zh_tw }}</span>
      <span v-if="phrase.answer_hint" class="mt-1.5 flex w-fit flex-wrap items-baseline gap-x-2 rounded-tag border border-ink px-2.5 py-1 text-label">
        <span lang="ja">{{ phrase.answer_hint.ja }}</span>
        <span class="text-sub">{{ phrase.answer_hint.zh_tw }}</span>
      </span>
      <span v-if="phrase.note_zh" class="mt-1 text-caption text-sub">{{ phrase.note_zh }}</span>
    </div>
    <span v-if="phrase.priority === 1" class="mt-1 shrink-0 text-caption text-sub">必備</span>
    <SpeakButton :text="phrase.kana.includes('／') ? phrase.ja : phrase.kana" :label="phrase.ja" />
  </li>
</template>
