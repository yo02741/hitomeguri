<script setup lang="ts">
import RulesDialog from './RulesDialog.vue'
import SummaryText from './SummaryText.vue'

// 地區特色、祭典的卡片只放幾行簡介；點了打開這一張看全文、原文與出處。
defineProps<{
  name: { ja: string; kana?: string; zh_tw?: string; en?: string }
  summary?: { text: string; lang: 'zh' | 'en' | 'ja'; text_zh?: string; license?: string }
  /** 舊資料的中文簡介 */
  summaryZh?: string
  image?: { url: string; author?: string; license?: string }
  sources: Array<{ label: string; url: string }>
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <RulesDialog :title="name.ja" @close="emit('close')">
    <div class="-mt-3 flex flex-col gap-0.5">
      <span v-if="name.kana" lang="ja" class="text-caption tracking-kana text-sub">{{ name.kana }}</span>
      <span v-if="name.zh_tw && name.zh_tw !== name.ja" class="text-body-sm text-sub">{{ name.zh_tw }}</span>
      <span v-if="name.en" lang="en" class="text-body-sm text-sub">{{ name.en }}</span>
    </div>
    <figure v-if="image" class="flex flex-col gap-1">
      <img :src="image.url" :alt="name.ja" referrerpolicy="no-referrer" class="aspect-[16/10] w-full rounded-control bg-placeholder object-cover" />
      <figcaption v-if="image.author" class="text-caption text-sub">{{ image.author }}<template v-if="image.license"> ／ {{ image.license }}</template></figcaption>
    </figure>
    <SummaryText v-if="summary" :summary="summary" original />
    <p v-else-if="summaryZh" class="text-body text-pretty">{{ summaryZh }}</p>
    <slot />
    <footer class="flex flex-wrap gap-x-3 border-t border-line-soft pt-3 text-caption text-sub">
      <span v-if="summary?.license">{{ summary.license }}</span>
      <a v-for="s in sources" :key="s.url" :href="s.url" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-3">{{ s.label }}</a>
    </footer>
  </RulesDialog>
</template>
