<script setup lang="ts">
import { ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { StampsPageData } from '../../../game/ui/notebook'
import StampMark from '../systems/StampMark.vue'

import { useRows } from './rows'

// 手帳「印帳」（規格 §8.6）：一縣一本蛇腹帳（一折一個章，橫著拉開），跟網站的紀念章帳分得開。
// 章是遊戲自製的圖案；印面只寫資料裡有的東西（站名的羅馬字、日本100名城 No.53），下面是名字、蓋章地點、蓋的日期（遊戲的）。
// 十字鍵左右、上下一折一折移動；到最左邊再按左回到頁籤。
defineProps<{ data: StampsPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
const KIND = { station: '站章', sanpai: '參拜印', castle: '名城' } as const

function press(b: Button): boolean {
  if (b === 'left') return rows.move('up')
  if (b === 'right') return rows.move('down') || true
  if (rows.move(b)) return true
  // A：這一個章的出處（開新分頁）
  if (b === 'A') {
    const a = rows.rows()[rows.index()]?.querySelector<HTMLAnchorElement>('a[href]')
    a?.click()
    return true
  }
  return false
}
defineExpose({ focusFirst: rows.focusFirst, press })
</script>

<template>
  <div ref="root" class="nb-page">
    <p v-if="!data.books.length" class="nb-empty">還沒有蓋過章。</p>
    <section v-for="b in data.books" :key="b.pref" class="book" :aria-labelledby="`book-${b.pref}`">
      <h3 :id="`book-${b.pref}`" class="book-title">
        <span lang="ja">{{ b.title.ja }}</span>
        <span class="nb-sub">　{{ b.stamps.length }}<template v-if="b.total"> / {{ b.total }}</template></span>
      </h3>
      <p v-if="!b.stamps.length" class="nb-empty">還沒有蓋過章。</p>
      <ol v-else class="book-folds">
        <li v-for="(s, i) in b.stamps" :key="s.id" class="fold" :class="i % 2 ? 'is-back' : 'is-front'" tabindex="0" data-row :aria-label="`${KIND[s.kind]}　${s.name.ja}`">
          <span class="fold-kind nb-sub">{{ KIND[s.kind] }}</span>
          <StampMark v-if="s.art" class="fold-mark" :art="s.art" :name="s.name.ja" :size="2" />
          <span class="fold-name" lang="ja">{{ s.name.ja }}</span>
          <span v-if="s.face && s.kind === 'castle'" class="nb-sub" lang="ja">{{ s.face }}</span>
          <span v-if="s.where" class="nb-sub" lang="ja">{{ s.where }}</span>
          <!-- 日期：窄的一折放不下時只在年和月之間換行 -->
          <span v-if="s.date" class="nb-sub fold-date"><span>{{ s.date.y }} 年</span> <span>{{ s.date.m }} 月 {{ s.date.d }} 日</span></span>
          <a v-if="s.source" :href="s.source.url" target="_blank" rel="noopener noreferrer" class="nb-src nb-sub" tabindex="-1" :aria-label="`出處：${s.source.label}（開新分頁）`">出處</a>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.book {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}
.book-title {
  margin: 0;
  font-size: 1em;
  font-weight: 700;
}
/* 蛇腹：紙一折一折接著，折線那一邊深一點 */
.book-folds {
  display: flex;
  margin: 0;
  padding: 0.4em 0.2em 0.6em;
  list-style: none;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
}
.fold {
  flex: 0 0 8.4em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25em;
  min-height: 11.5em;
  padding: 0.6em 0.4em 0.7em;
  text-align: center;
  background: var(--color-px-paper);
  border-top: 2px solid var(--color-px-paper-2);
  border-bottom: 2px solid var(--color-px-paper-2);
  scroll-snap-align: start;
}
.fold.is-front {
  border-left: 2px solid var(--color-px-paper-2);
  box-shadow: inset -0.35em 0 0 -0.2em var(--color-px-paper-2);
}
.fold.is-back {
  background: var(--color-px-white);
  border-right: 2px solid var(--color-px-paper-2);
}
.fold:last-child {
  border-right: 2px solid var(--color-px-paper-2);
}
.fold:focus-visible {
  outline: 2px solid var(--color-px-ink);
  outline-offset: -2px;
}
.fold-kind {
  align-self: flex-start;
}
.fold-mark {
  margin: 0.2em 0;
  transform: rotate(-3deg);
}
.fold-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.fold-date > span {
  white-space: nowrap;
}
</style>
