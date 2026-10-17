<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { loadThumb } from '../../../game/systems/photoStore'
import type { ItemCardData } from '../../../game/systems/inventory'
import { LANG_LABEL } from '../../../game/systems/summary'
import { yenText } from '../../../game/systems/wallet'

import PixelIcon from './PixelIcon.vue'

// 品項卡（規格 §8.5）：真名（日文、假名、中文）、類別、簡介第一句（有中文用中文，沒有就原文並標語言）、
// 出處網址、授權；像素小圖依類別套模板。老舖寫店名與創業（資料有才寫，附出處）。遊戲自己的東西只有名字與類別。
const props = defineProps<{ card: ItemCardData; price?: boolean }>()
const photo = ref<string | null>(null)
async function load() {
  photo.value = props.card.photo ? await loadThumb(props.card.photo) : null
}
onMounted(load)
watch(() => props.card.photo, load)
</script>

<template>
  <article class="card" :aria-label="card.name.ja">
    <div class="card-head">
      <PixelIcon :icon="card.icon" :size="3" />
      <div class="card-names">
        <p class="card-ja" lang="ja">{{ card.name.ja }}</p>
        <p v-if="card.name.kana" class="nb-sub" lang="ja">{{ card.name.kana }}</p>
        <p v-if="card.name.zh && card.name.zh !== card.name.ja" class="card-zh">{{ card.name.zh }}</p>
        <p class="nb-sub">
          {{ card.kind }}<template v-if="price && card.price">　{{ yenText(card.price) }}</template>
        </p>
      </div>
    </div>
    <img v-if="photo" :src="photo" class="card-photo" alt="" width="240" height="160" />
    <p v-if="card.summary" class="card-sum" :lang="card.summary.lang === 'zh' ? 'zh-Hant' : card.summary.lang">
      {{ card.summary.text }}
      <span v-if="card.summary.lang !== 'zh'" class="card-tag" lang="zh-Hant">{{ LANG_LABEL[card.summary.lang] }}</span>
      <span v-else-if="card.summary.translated" class="card-tag" lang="zh-Hant">譯</span>
    </p>
    <p v-if="card.shop" class="nb-sub card-shop">
      <span lang="ja">{{ card.shop.name }}</span>
      <template v-if="card.shop.founded">
        　創業 {{ card.shop.founded }}
        <a v-if="card.shop.source" :href="card.shop.source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`創業的出處：${card.shop.source.label}（開新分頁）`">出處</a>
      </template>
    </p>
    <p v-if="card.source" class="nb-sub card-src">
      <a :href="card.source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`出處：${card.source.label}（開新分頁）`">{{ card.source.label }}</a>
      <template v-if="card.license">　{{ card.license }}</template>
    </p>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 0.45em;
  min-width: 0;
}
.card p {
  margin: 0;
}
.card-head {
  display: flex;
  gap: 0.7em;
  align-items: flex-start;
}
.card-names {
  display: flex;
  flex-direction: column;
  gap: 0.1em;
  min-width: 0;
}
.card-ja {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.card-zh {
  font-size: 0.9em;
}
.card-photo {
  width: 100%;
  max-width: 14em;
  height: auto;
  image-rendering: pixelated;
  border: 2px solid var(--color-px-ink);
}
.card-sum {
  font-size: 0.9em;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.card-tag {
  display: inline-block;
  margin-left: 0.4em;
  padding: 0 0.35em;
  font-size: 0.75em;
  line-height: 1.5;
  color: var(--color-px-stone-3);
  border: 1px solid var(--color-px-stone-2);
  border-radius: 3px;
  vertical-align: 0.1em;
}
.card-shop,
.card-src {
  overflow-wrap: anywhere;
}
</style>
