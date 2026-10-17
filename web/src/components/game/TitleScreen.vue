<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { SfxName } from '../../game/audio/sfx'
import type { Button } from '../../game/engine/input'
import { rove } from '../../game/ui/rove'
import { RESTART_ASK, RESTART_OPTIONS, type TitleChoice, titleOptions } from '../../game/ui/title'

// 標題畫面（規格 §5）：「ひとめぐり 番外篇」；有存檔時「繼續」「重新開始」（重新開始再問一次），沒有存檔時「開始」。
// 後面的畫面是遊戲自己在走（PlayView），這裡只疊字與選單。按鍵：上下選、A／點一下決定、B 回上一步。
// 資料還在讀（status，沒有選項）或讀不到（status＋「再試一次」）時，選單的框裡只有那一行。
const props = defineProps<{ hasSave: boolean; scale: number; status?: string | null; retry?: boolean }>()
const emit = defineEmits<{ choose: [c: TitleChoice]; retry: []; sfx: [name: SfxName] }>()

const confirming = ref(false)
const idx = ref(0)
const RETRY = { id: 'retry', label: '再試一次' } as const
const options = computed<Array<{ id: TitleChoice | 'retry'; label: string }>>(() =>
  props.status ? (props.retry ? [RETRY] : []) : titleOptions(props.hasSave),
)
const labels = computed(() => (confirming.value ? [...RESTART_OPTIONS] : options.value.map((o) => o.label)))
const els = ref<HTMLButtonElement[]>([])

function focusCur() {
  void nextTick(() => els.value[idx.value]?.focus({ preventScroll: true }))
}

function choose(i: number) {
  if (confirming.value) {
    if (i === 0) {
      emit('sfx', 'confirm')
      emit('choose', 'restart')
    } else back()
    return
  }
  const o = options.value[i]
  if (!o) return
  if (o.id === 'retry') {
    emit('sfx', 'confirm')
    emit('retry')
    return
  }
  if (o.id === 'restart') {
    emit('sfx', 'confirm')
    confirming.value = true
    idx.value = 1
    focusCur()
    return
  }
  emit('sfx', 'confirm')
  emit('choose', o.id)
}
function back() {
  if (!confirming.value) return
  emit('sfx', 'cancel')
  confirming.value = false
  idx.value = options.value.findIndex((o) => o.id === 'restart')
  focusCur()
}

function press(b: Button): boolean {
  if (!labels.value.length) return true
  if (b === 'up' || b === 'down') {
    const n = labels.value.length
    const j = rove(idx.value, b, n)
    if (j !== idx.value) {
      idx.value = j
      emit('sfx', 'cursor')
      focusCur()
    }
    return true
  }
  if (b === 'A' || b === 'START') {
    choose(idx.value)
    return true
  }
  if (b === 'B') {
    back()
    return true
  }
  return false
}
defineExpose({ press, state: () => ({ confirming: confirming.value, idx: idx.value, labels: labels.value }) })

onMounted(focusCur)
// 讀完資料（或讀不到）：選項換了，游標回到第一個
watch(
  () => [props.status, props.retry],
  () => {
    confirming.value = false
    idx.value = 0
    focusCur()
  },
)
</script>

<template>
  <div class="title-root" :style="{ '--u': `${scale}px` }">
    <h1 class="title-logo">
      <span lang="ja" class="logo-ja">ひとめぐり</span>
      <span class="logo-sub">番外篇</span>
    </h1>
    <div class="gba-box title-menu">
      <p v-if="status" class="title-status" role="status">{{ status }}</p>
      <p v-if="confirming" class="title-ask">{{ RESTART_ASK }}</p>
      <div v-if="labels.length" class="title-opts" role="group" :aria-label="confirming ? RESTART_ASK : 'ひとめぐり 番外篇'">
        <button
          v-for="(l, i) in labels"
          :key="`${confirming}-${i}`"
          :ref="(el) => (els[i] = el as HTMLButtonElement)"
          type="button"
          class="title-opt"
          @focus="idx = i"
          @click="choose(i)"
        >
          <svg class="title-caret" :class="{ 'is-on': i === idx }" viewBox="0 0 5 7" aria-hidden="true" shape-rendering="crispEdges">
            <path d="M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z" fill="currentColor" />
          </svg>
          <span>{{ l }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-root {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--u) * 18) calc(var(--u) * 8) calc(var(--u) * 10);
  font-family: var(--font-game);
}
/* 標題：後面的大廳（站務員、剪票口）很雜，字的後面墊一條 50% 的墨色抖色帶（跟暫停一樣的棋盤） */
.title-logo {
  margin: 0;
  align-self: stretch;
  margin-inline: calc(var(--u) * -8);
  padding: calc(var(--u) * 4) 0 calc(var(--u) * 5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--u) * 2);
  background-image: conic-gradient(var(--color-px-ink) 90deg, transparent 90deg 180deg, var(--color-px-ink) 180deg 270deg, transparent 270deg);
  background-size: calc(var(--u) * 2) calc(var(--u) * 2);
  color: var(--color-px-white);
  font-weight: 400;
  /* 墨色的 1 格外框（GBA 的標題字） */
  text-shadow:
    calc(var(--u) * 1) 0 0 var(--color-px-ink),
    calc(var(--u) * -1) 0 0 var(--color-px-ink),
    0 calc(var(--u) * 1) 0 var(--color-px-ink),
    0 calc(var(--u) * -1) 0 var(--color-px-ink),
    calc(var(--u) * 1) calc(var(--u) * 1) 0 var(--color-px-ink),
    calc(var(--u) * -1) calc(var(--u) * 1) 0 var(--color-px-ink),
    calc(var(--u) * 1) calc(var(--u) * -1) 0 var(--color-px-ink),
    calc(var(--u) * -1) calc(var(--u) * -1) 0 var(--color-px-ink),
    0 calc(var(--u) * 3) 0 var(--color-px-ink-2);
}
.logo-ja {
  font-family: var(--font-game-ja);
  font-size: max(28px, calc(var(--u) * 20));
  line-height: 1.1;
  letter-spacing: 0.06em;
}
.logo-sub {
  font-size: max(15px, calc(var(--u) * 9));
  line-height: 1.2;
  letter-spacing: 0.4em;
  padding-left: 0.4em;
  color: var(--color-px-gold-1);
  /* 黃字的外框加粗一格（底下是墨色帶，看得清楚） */
  text-shadow:
    calc(var(--u) * 2) 0 0 var(--color-px-ink),
    calc(var(--u) * -2) 0 0 var(--color-px-ink),
    0 calc(var(--u) * 2) 0 var(--color-px-ink),
    0 calc(var(--u) * -2) 0 var(--color-px-ink),
    calc(var(--u) * 1) calc(var(--u) * 1) 0 var(--color-px-ink),
    calc(var(--u) * -1) calc(var(--u) * 1) 0 var(--color-px-ink),
    calc(var(--u) * 1) calc(var(--u) * -1) 0 var(--color-px-ink),
    calc(var(--u) * -1) calc(var(--u) * -1) 0 var(--color-px-ink);
}
.title-menu {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: calc(var(--u) * 2);
  max-width: 100%;
  padding: calc(var(--u) * 4) calc(var(--u) * 10) calc(var(--u) * 4) calc(var(--u) * 6);
  font-size: max(14px, calc(var(--u) * 8));
  line-height: 1.4;
}
.title-status {
  margin: 0 calc(var(--u) * 2);
  max-width: calc(var(--u) * 150);
}
.title-ask {
  margin: 0 0 calc(var(--u) * 2) calc(var(--u) * 2);
  max-width: calc(var(--u) * 150);
}
.title-opts {
  display: flex;
  flex-direction: column;
}
.title-opt {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  min-height: max(36px, calc(var(--u) * 14));
  padding: 0 calc(var(--u) * 2);
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
}
@media (pointer: coarse) {
  .title-opt {
    min-height: 44px;
  }
}
.title-opt:focus-visible {
  outline: 2px solid var(--color-px-ink);
  outline-offset: 1px;
}
.title-caret {
  width: calc(var(--u) * 5);
  height: calc(var(--u) * 7);
  visibility: hidden;
}
.title-caret.is-on {
  visibility: visible;
}
</style>
