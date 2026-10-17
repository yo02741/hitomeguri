<script setup lang="ts">
import { type Component, computed, inject, nextTick, onMounted, ref } from 'vue'

import type { Button } from '../../game/engine/input'
import { GAME_UI, type NotebookPage } from '../../game/ui/context'
import { NOTEBOOK_PAGES, type NotebookData, type NotebookPageId } from '../../game/ui/notebook'
import { rove } from '../../game/ui/rove'

import AlbumPage from './notebook/AlbumPage.vue'
import BagPage from './notebook/BagPage.vue'
import HeardPage from './notebook/HeardPage.vue'
import MapPage from './notebook/MapPage.vue'
import QuestsPage from './notebook/QuestsPage.vue'
import RoomPage from './notebook/RoomPage.vue'
import SavePage from './notebook/SavePage.vue'
import SettingsPage from './notebook/SettingsPage.vue'
import StampsPage from './notebook/StampsPage.vue'

// 旅人手帳（START 選單，規格 §4）：左邊一排頁籤（地圖、印帳、相簿、行李、聽來的、委託、房間、存檔、設定），右邊是那一頁。
// 打開時世界停住（PlayView 讓 Game 停在 'menu'）。焦點在頁籤上：上下換頁、右或 A 進到那一頁、B 或 START 關上；
// 在頁裡：上下一列一列、B 或左回到頁籤。Tab 只在手帳裡繞，Escape（＝START）關上。
// 遊戲的按鍵（鍵盤、十字鍵、手把）由 PlayView 交給 press()；Enter／Space 在按鈕上照瀏覽器的 click。
const props = defineProps<{ data: NotebookData; start?: NotebookPageId }>()
const emit = defineEmits<{ close: []; page: [id: NotebookPageId] }>()
const ui = inject(GAME_UI)

/** 每一頁的元件（加新的一頁：NOTEBOOK_PAGES 加 id，這裡對上元件） */
const PAGE_COMPONENTS: Record<NotebookPageId, Component> = {
  map: MapPage,
  stamps: StampsPage,
  album: AlbumPage,
  bag: BagPage,
  heard: HeardPage,
  quests: QuestsPage,
  room: RoomPage,
  save: SavePage,
  settings: SettingsPage,
}

const root = ref<HTMLElement | null>(null)
const tablist = ref<HTMLElement | null>(null)
const tabEls = ref<HTMLButtonElement[]>([])
const page = ref<NotebookPage | null>(null)
const cur = ref(Math.max(0, NOTEBOOK_PAGES.findIndex((p) => p.id === props.start)))
const id = computed(() => NOTEBOOK_PAGES[cur.value]!.id)
const pageProps = computed(() => (id.value === 'settings' ? {} : { data: props.data[id.value as keyof NotebookData] }))

function focusTab() {
  const el = tabEls.value[cur.value]
  el?.focus({ preventScroll: true })
  // 打橫的手機頁籤放不下時會捲：選到的那一個捲進來
  el?.scrollIntoView?.({ block: 'nearest' })
}
function select(i: number) {
  if (i === cur.value) return
  cur.value = i
  emit('page', NOTEBOOK_PAGES[i]!.id)
  void nextTick(focusTab)
}
function onTabClick(i: number) {
  select(i)
  ui?.sfx('cursor')
}

function close() {
  emit('close')
}

function inTabs(): boolean {
  const a = document.activeElement
  return !a || !root.value?.contains(a) || !!tablist.value?.contains(a)
}

/** 遊戲的按鍵 */
function press(b: Button): boolean {
  if (b === 'START') {
    close()
    return true
  }
  if (b === 'PAUSE' || b === 'CAMERA') return true
  if (!inTabs()) {
    if (page.value?.press(b)) return true
    if (b === 'B' || b === 'left') {
      ui?.sfx('cancel')
      focusTab()
    }
    return true
  }
  if (b === 'up' || b === 'down') {
    const j = rove(cur.value, b, NOTEBOOK_PAGES.length)
    if (j !== cur.value) {
      select(j)
      ui?.sfx('cursor')
    } else focusTab()
    return true
  }
  if (b === 'right' || b === 'A') {
    if (page.value?.focusFirst()) ui?.sfx('confirm')
    return true
  }
  if (b === 'B') close()
  return true
}

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), a[href], [tabindex="0"]'
/** Tab 只在手帳裡繞；頁籤上 Home／End */
function onKey(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    const els = Array.from(root.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null)
    if (!els.length) return
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.shiftKey && i <= 0) {
      e.preventDefault()
      els[els.length - 1]!.focus()
    } else if (!e.shiftKey && i === els.length - 1) {
      e.preventDefault()
      els[0]!.focus()
    }
    return
  }
  if ((e.key === 'Home' || e.key === 'End') && inTabs()) {
    e.preventDefault()
    select(rove(cur.value, e.key === 'Home' ? 'home' : 'end', NOTEBOOK_PAGES.length))
  }
}

defineExpose({ press, state: () => ({ page: id.value, inTabs: inTabs() }) })
onMounted(focusTab)
</script>

<template>
  <div ref="root" class="gba-box nb" role="dialog" aria-modal="true" aria-labelledby="nb-title" @keydown="onKey">
    <header class="nb-head">
      <h2 id="nb-title" class="nb-title">旅人手帳</h2>
      <button type="button" class="nb-btn nb-close" aria-label="關上旅人手帳" @click="close">關上</button>
    </header>
    <div class="nb-body">
      <div ref="tablist" class="nb-tabs" role="tablist" aria-orientation="vertical" aria-label="旅人手帳">
        <button
          v-for="(p, i) in NOTEBOOK_PAGES"
          :id="`nb-tab-${p.id}`"
          :key="p.id"
          :ref="(el) => (tabEls[i] = el as HTMLButtonElement)"
          type="button"
          role="tab"
          class="nb-tab"
          :aria-selected="i === cur"
          aria-controls="nb-panel"
          :tabindex="i === cur ? 0 : -1"
          @click="onTabClick(i)"
        >
          <svg class="nb-caret" :class="{ 'is-on': i === cur }" viewBox="0 0 5 7" aria-hidden="true" shape-rendering="crispEdges">
            <path d="M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z" fill="currentColor" />
          </svg>
          <span>{{ p.label }}</span>
        </button>
      </div>
      <section id="nb-panel" class="nb-panel" role="tabpanel" :aria-labelledby="`nb-tab-${id}`">
        <component :is="PAGE_COMPONENTS[id]" :key="id" ref="page" v-bind="pageProps" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.nb {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  font-family: var(--font-game);
  font-size: clamp(14px, calc(var(--u) * 7), 22px);
  line-height: 1.5;
  overflow: hidden;
  /* 內容放在雙線框裡面 */
  padding: max(2px, calc(var(--u) * 2));
}
.nb :deep(:lang(ja)) {
  font-family: var(--font-game-ja);
}
.nb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1em;
  padding: 0.6em 0.9em 0.5em 1.1em;
  border-bottom: 2px solid var(--color-px-stone-1);
}
.nb-title {
  margin: 0;
  font-size: 1.05em;
  font-weight: 400;
  letter-spacing: 0.12em;
}
.nb-close {
  font-size: 0.85em;
}
.nb-body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}
.nb-tabs {
  display: flex;
  flex-direction: column;
  padding: 0.5em 0.3em 0.5em 0.6em;
  border-right: 2px solid var(--color-px-stone-1);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.nb-tab {
  display: flex;
  align-items: center;
  gap: 0.35em;
  min-height: 1.9em;
  padding: 0 0.7em 0 0.2em;
  font: inherit;
  color: inherit;
  text-align: left;
  white-space: nowrap;
  background: none;
  border: 0;
  border-radius: 3px;
}
@media (pointer: coarse) {
  .nb-tab {
    min-height: 44px;
  }
}
/* 打橫的手機（矮）：9 個頁籤一排放不下，排成兩欄（5 列）；頁籤小一點但還是好按 */
@media (pointer: coarse) and (max-height: 480px) {
  .nb-tabs {
    display: grid;
    grid-template-columns: repeat(2, auto);
    grid-auto-rows: min-content;
    align-content: start;
    column-gap: 0.2em;
    padding: 0.3em 0.3em 0.3em 0.4em;
  }
  .nb-tab {
    min-height: 40px;
    padding: 0 0.5em 0 0.15em;
  }
}
.nb-tab[aria-selected='true'] {
  background: var(--color-px-paper);
}
.nb-caret {
  width: 0.36em;
  height: 0.5em;
  visibility: hidden;
}
.nb-caret.is-on {
  visibility: visible;
}
.nb-panel {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.8em 1.1em 1em;
}
</style>
