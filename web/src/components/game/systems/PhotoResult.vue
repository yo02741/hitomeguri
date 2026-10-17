<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { GameSystems } from '../../../game/systems/install'
import { downloadPhoto } from '../../../game/systems/photoStore'
import { SLOT_LABEL } from '../../../game/systems/state'
import type { Panel } from '../../../game/systems/ui'
import { dateText, TIME_LABEL } from '../../../game/ui/notebook'
import { rove } from '../../../game/ui/rove'

// 拍好的照片（規格 §8.4）：照片、資料裡的地名、遊戲日期與時段、相簿的哪一格、構圖分數（數字）。
// 這一格原本有照片時問要不要換；存成 PNG 下載。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const r = computed(() => (props.panel.kind === 'photo' ? props.panel.result : null))
const decided = ref(false)
const status = ref('')
const btns = ref<HTMLButtonElement[]>([])
const asking = computed(() => !!r.value?.replace && !decided.value)
const parts = computed(() => (r.value?.score.parts ?? []).filter((p) => p.label !== '拍照'))

function keep() {
  props.systems.keepPhoto()
  props.systems.sfx('confirm')
  decided.value = true
  status.value = '換上了。'
  focusAt(0)
}
function skip() {
  props.systems.discardPhoto()
  props.systems.sfx('cancel')
  props.systems.closePanel()
}
function close() {
  props.systems.sfx('cancel')
  props.systems.closePanel()
}
async function save() {
  const x = r.value
  if (!x) return
  const ok = await downloadPhoto(x.id, `${x.name.ja}-${x.date.y}${String(x.date.m).padStart(2, '0')}${String(x.date.d).padStart(2, '0')}`)
  props.systems.sfx(ok ? 'saved' : 'error')
  status.value = ok ? '存好了。' : '這次沒有存到。'
}

function focusAt(i: number) {
  queueMicrotask(() => btns.value[Math.max(0, Math.min(btns.value.length - 1, i))]?.focus({ preventScroll: true }))
}
function cur(): number {
  return btns.value.findIndex((b) => b === document.activeElement)
}

function press(b: Button): boolean {
  if (b === 'left' || b === 'right' || b === 'up' || b === 'down') {
    const n = btns.value.length
    const j = rove(Math.max(0, cur()), b === 'up' ? 'left' : b === 'down' ? 'right' : b, n, { orientation: 'horizontal', wrap: false })
    if (j !== cur()) props.systems.sfx('cursor')
    focusAt(j)
    return true
  }
  if (b === 'A') {
    const el = btns.value[cur()] ?? btns.value[0]
    el?.click()
    return true
  }
  if (b === 'B' || b === 'START') {
    if (asking.value) skip()
    else close()
    return true
  }
  return true
}
defineExpose({ press, focusFirst: () => (focusAt(0), true) })
</script>

<template>
  <div v-if="r" class="gba-box sys-box pr" role="dialog" aria-labelledby="pr-title">
    <div class="sys-body pr-body">
      <div class="pr-frame">
        <img v-if="r.url" :src="r.url" class="pr-img" :alt="r.name.ja" width="240" height="160" />
        <div v-else class="pr-img pr-empty" aria-hidden="true"></div>
      </div>
      <div class="pr-info">
        <h2 id="pr-title" class="sys-title" lang="ja">{{ r.name.ja }}</h2>
        <p v-if="r.name.zh" class="nb-sub">{{ r.name.zh }}</p>
        <p class="nb-sub">{{ dateText(r.date) }}・{{ TIME_LABEL[r.time] }}・{{ SLOT_LABEL[r.slot] }}</p>
        <p class="pr-score">構圖分數 <strong>{{ r.score.score }}</strong></p>
        <p v-if="parts.length" class="nb-sub">
          <span v-for="(p, i) in parts" :key="p.label">{{ i ? '・' : '' }}{{ p.label }} {{ p.points > 0 ? '+' : '' }}{{ p.points }}</span>
        </p>
        <p v-if="r.quest" class="nb-sub">委託的照片</p>
        <p v-if="asking" class="pr-ask">這一格已經有一張（{{ r.replace!.score }} 分）。</p>
        <p class="sys-status" role="status">{{ status }}</p>
      </div>
    </div>
    <div class="sys-foot">
      <template v-if="asking">
        <button :ref="(el) => (btns[0] = el as HTMLButtonElement)" type="button" class="nb-btn" @click="keep">換上這一張</button>
        <button :ref="(el) => (btns[1] = el as HTMLButtonElement)" type="button" class="nb-btn" @click="skip">留著原本的</button>
      </template>
      <template v-else>
        <button :ref="(el) => (btns[0] = el as HTMLButtonElement)" type="button" class="nb-btn" @click="close">收起</button>
        <button :ref="(el) => (btns[1] = el as HTMLButtonElement)" type="button" class="nb-btn" @click="save">存成 PNG</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pr-body {
  display: flex;
  gap: 1em;
  align-items: flex-start;
}
.pr-frame {
  flex: 0 0 48%;
  padding: 0.35em;
  background: var(--color-px-white);
  border: 2px solid var(--color-px-ink);
  box-shadow: 0 2px 0 var(--color-px-stone-2);
}
.pr-img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: contain;
  image-rendering: pixelated;
  background: var(--color-px-paper);
}
.pr-info {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  min-width: 0;
}
.pr-info p {
  margin: 0;
}
.pr-score strong {
  font-size: 1.4em;
  font-weight: 400;
}
</style>
