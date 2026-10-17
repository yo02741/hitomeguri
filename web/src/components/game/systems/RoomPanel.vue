<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { ItemCardData } from '../../../game/systems/inventory'
import type { GameSystems } from '../../../game/systems/install'
import { loadThumb } from '../../../game/systems/photoStore'
import { get, moveSlot, placeFromBag, placePhoto, type SlotRef, takeBack } from '../../../game/systems/room'
import { FRAME_SLOTS, roomOf, SHELF_COLS, SHELF_ROWS } from '../../../game/systems/state'
import type { Panel } from '../../../game/systems/ui'
import { rove } from '../../../game/ui/rove'

import ItemCard from './ItemCard.vue'
import PixelIcon from './PixelIcon.vue'

// 你的房間的擺設（規格 §8.6）：牆上 4 個相框、架子 6×3。游標在格子上，A 拿起、十字鍵移、A 放下（放到有東西的格子就交換）；
// 有東西的格子按 A 可以拿起、看看（品項卡）、收回行李；空的格子按 A 從行李（架子）或相簿（相框）挑一樣放上去。也可以點。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const sys = props.systems
const g = sys.game

const focus = ref<SlotRef>(props.panel.kind === 'room' && props.panel.focus ? { ...props.panel.focus } : { area: 'shelf', i: 0 })
const hold = ref<SlotRef | null>(null)
type Mode = 'grid' | 'menu' | 'pick' | 'view'
const mode = ref<Mode>('grid')
const sub = ref(0)
const status = ref('')
const tick = computed(() => sys.ui.tick)

const layout = computed(() => {
  void tick.value
  const r = roomOf(g)
  return { shelf: [...r.shelf], frames: [...r.frames] }
})
const valueAt = (s: SlotRef) => (s.area === 'shelf' ? layout.value.shelf[s.i] : layout.value.frames[s.i]) ?? null
const card = (key: string | null): ItemCardData | null => (key ? sys.card(key) : null)
const focused = computed(() => valueAt(focus.value))

// 相框的照片縮圖
const thumbs = ref<Record<string, string | null>>({})
watchEffect(() => {
  const ids = [...layout.value.frames, ...g.state.album].filter((x): x is string => !!x)
  for (const id of ids) if (!(id in thumbs.value)) void loadThumb(id).then((u) => (thumbs.value = { ...thumbs.value, [id]: u }))
})

// 挑一樣放上去：架子＝行李裡帶得走的；相框＝相簿的照片
const choices = computed(() => {
  void tick.value
  if (focus.value.area === 'frame') return g.state.album.map((id) => ({ key: id, label: sys.save.photos[id]?.name.ja ?? '', photo: id }))
  return Object.entries(g.state.items)
    .filter(([k, n]) => n > 0 && k !== 'game:room-key' && !k.startsWith('quest:'))
    .map(([k, n]) => ({ key: k, label: card(k)?.name.ja ?? k, n, card: card(k) }))
    .filter((x) => x.card?.keep)
})
const menu = computed(() => ['拿起', focus.value.area === 'shelf' ? '看看' : '放大看', focus.value.area === 'shelf' ? '收回行李' : '拿下來'])

const cellEls = ref<Record<string, HTMLButtonElement | null>>({})
const subEls = ref<HTMLButtonElement[]>([])
const cellKey = (s: SlotRef) => `${s.area}:${s.i}`

function focusNow() {
  void nextTick(() => {
    const el = mode.value === 'grid' ? cellEls.value[cellKey(focus.value)] : subEls.value[sub.value]
    el?.focus({ preventScroll: true })
    el?.scrollIntoView?.({ block: 'nearest' })
  })
}

/** 格子之間移動：相框一排 4 格在上面，架子三排 6 格 */
function moveGrid(b: 'up' | 'down' | 'left' | 'right'): boolean {
  const f = focus.value
  if (f.area === 'frame') {
    if (b === 'left' || b === 'right') focus.value = { area: 'frame', i: rove(f.i, b, FRAME_SLOTS, { orientation: 'horizontal', wrap: false }) }
    else if (b === 'down') focus.value = { area: 'shelf', i: Math.round((f.i * (SHELF_COLS - 1)) / (FRAME_SLOTS - 1)) }
    else return false
  } else {
    const row = Math.floor(f.i / SHELF_COLS)
    const col = f.i % SHELF_COLS
    if (b === 'up' && row === 0) focus.value = { area: 'frame', i: Math.round((col * (FRAME_SLOTS - 1)) / (SHELF_COLS - 1)) }
    else focus.value = { area: 'shelf', i: rove(f.i, b, SHELF_COLS * SHELF_ROWS, { orientation: 'grid', cols: SHELF_COLS, wrap: false }) }
  }
  sys.sfx('cursor')
  return true
}

function done(msg: string) {
  status.value = msg
  sys.refreshRoom()
}

function activate() {
  const f = focus.value
  if (hold.value) {
    const from = hold.value
    if (from.area !== f.area) {
      sys.sfx('error')
      status.value = f.area === 'frame' ? '相框只放照片。' : '照片放在相框裡。'
      return
    }
    hold.value = null
    if (from.i !== f.i) moveSlot(g, from, f)
    sys.sfx('confirm')
    done('放好了。')
    return
  }
  if (get(roomOf(g), f)) {
    mode.value = 'menu'
    sub.value = 0
  } else {
    if (!choices.value.length) {
      sys.sfx('error')
      status.value = f.area === 'frame' ? '還沒有照片。' : '行李裡沒有可以擺的東西。'
      return
    }
    mode.value = 'pick'
    sub.value = 0
  }
  sys.sfx('confirm')
  focusNow()
}

function choose(i: number) {
  const f = focus.value
  if (mode.value === 'menu') {
    if (i === 0) {
      hold.value = { ...f }
      mode.value = 'grid'
      status.value = '拿起來了。'
    } else if (i === 1) {
      mode.value = 'view'
    } else {
      takeBack(g, f)
      mode.value = 'grid'
      done(f.area === 'shelf' ? '收回行李了。' : '拿下來了。')
    }
    sys.sfx('confirm')
    focusNow()
    return
  }
  if (mode.value === 'pick') {
    const c = choices.value[i]
    if (!c) return
    const ok = f.area === 'frame' ? placePhoto(g, f, c.key) : placeFromBag(g, f, c.key)
    sys.sfx(ok ? 'confirm' : 'error')
    mode.value = 'grid'
    done(ok ? '擺上去了。' : '')
    focusNow()
  }
}

function onCell(s: SlotRef) {
  focus.value = s
  if (mode.value !== 'grid') mode.value = 'grid'
  activate()
}

function press(b: Button): boolean {
  if (mode.value === 'grid') {
    if (b === 'up' || b === 'down' || b === 'left' || b === 'right') {
      moveGrid(b)
      focusNow()
      return true
    }
    if (b === 'A') {
      activate()
      return true
    }
    if (b === 'B' && hold.value) {
      hold.value = null
      sys.sfx('cancel')
      status.value = '放回去了。'
      return true
    }
    return false
  }
  if (mode.value === 'view') {
    if (b === 'A' || b === 'B') {
      mode.value = 'menu'
      sys.sfx('cancel')
      focusNow()
    }
    return true
  }
  const n = mode.value === 'menu' ? menu.value.length : choices.value.length
  if (b === 'up' || b === 'down') {
    sub.value = rove(sub.value, b, n, { wrap: false })
    sys.sfx('cursor')
    focusNow()
    return true
  }
  if (b === 'A') {
    choose(sub.value)
    return true
  }
  if (b === 'B') {
    mode.value = 'grid'
    sys.sfx('cancel')
    focusNow()
    return true
  }
  return true
}
defineExpose({ press, focusFirst: () => (focusNow(), true) })

const shelfRows = Array.from({ length: SHELF_ROWS }, (_, r) => Array.from({ length: SHELF_COLS }, (_, c) => r * SHELF_COLS + c))
const isFocus = (s: SlotRef) => focus.value.area === s.area && focus.value.i === s.i
const isHeld = (s: SlotRef) => !!hold.value && hold.value.area === s.area && hold.value.i === s.i
const cellLabel = (s: SlotRef) => {
  const v = valueAt(s)
  const where = s.area === 'frame' ? `相框 ${s.i + 1}` : `架子 第 ${Math.floor(s.i / SHELF_COLS) + 1} 層 第 ${(s.i % SHELF_COLS) + 1} 格`
  const what = !v ? '空的' : s.area === 'frame' ? (sys.save.photos[v]?.name.ja ?? '照片') : (card(v)?.name.ja ?? '')
  return `${where}：${what}${isHeld(s) ? '（拿起來了）' : ''}`
}
</script>

<template>
  <div class="gba-box sys-box room" role="dialog" aria-labelledby="room-title">
    <header class="sys-head">
      <h2 id="room-title" class="sys-title">擺設</h2>
      <p v-if="hold" class="nb-sub room-hold" lang="ja">拿著　{{ valueAt(hold) ? (hold.area === 'frame' ? sys.save.photos[valueAt(hold)!]?.name.ja : card(valueAt(hold))?.name.ja) : '' }}</p>
    </header>
    <div class="sys-body room-body">
      <div class="room-wall" role="group" aria-label="牆上的相框">
        <button
          v-for="i in FRAME_SLOTS"
          :key="`f${i}`"
          :ref="(el) => (cellEls[`frame:${i - 1}`] = el as HTMLButtonElement)"
          type="button"
          class="room-cell room-frame"
          :class="{ 'is-on': isFocus({ area: 'frame', i: i - 1 }), 'is-held': isHeld({ area: 'frame', i: i - 1 }) }"
          :tabindex="isFocus({ area: 'frame', i: i - 1 }) ? 0 : -1"
          :aria-label="cellLabel({ area: 'frame', i: i - 1 })"
          @click="onCell({ area: 'frame', i: i - 1 })"
        >
          <img v-if="layout.frames[i - 1] && thumbs[layout.frames[i - 1]!]" :src="thumbs[layout.frames[i - 1]!]!" alt="" class="room-photo" width="240" height="160" />
        </button>
      </div>
      <div class="room-shelf" role="group" aria-label="架子">
        <div v-for="(row, r) in shelfRows" :key="`r${r}`" class="room-board">
          <button
            v-for="i in row"
            :key="`s${i}`"
            :ref="(el) => (cellEls[`shelf:${i}`] = el as HTMLButtonElement)"
            type="button"
            class="room-cell"
            :class="{ 'is-on': isFocus({ area: 'shelf', i }), 'is-held': isHeld({ area: 'shelf', i }), 'is-filled': !!layout.shelf[i] }"
            :tabindex="isFocus({ area: 'shelf', i }) ? 0 : -1"
            :aria-label="cellLabel({ area: 'shelf', i })"
            @click="onCell({ area: 'shelf', i })"
          >
            <PixelIcon v-if="layout.shelf[i] && card(layout.shelf[i]!)" :icon="card(layout.shelf[i]!)!.icon" :size="2" />
          </button>
        </div>
      </div>

      <div v-if="mode === 'menu'" class="room-sub">
        <p class="room-sub-title" lang="ja">{{ focus.area === 'frame' ? sys.save.photos[focused ?? '']?.name.ja : card(focused)?.name.ja }}</p>
        <ul class="sys-list">
          <li v-for="(m, i) in menu" :key="m">
            <button :ref="(el) => (subEls[i] = el as HTMLButtonElement)" type="button" class="sys-row" :aria-current="sub === i ? 'true' : undefined" @focus="sub = i" @click="choose(i)">{{ m }}</button>
          </li>
        </ul>
      </div>
      <div v-else-if="mode === 'pick'" class="room-sub">
        <p class="room-sub-title">{{ focus.area === 'frame' ? '放哪一張照片' : '擺哪一樣' }}</p>
        <ul class="sys-list">
          <li v-for="(c, i) in choices" :key="c.key">
            <button :ref="(el) => (subEls[i] = el as HTMLButtonElement)" type="button" class="sys-row" :aria-current="sub === i ? 'true' : undefined" @focus="sub = i" @click="choose(i)">
              <img v-if="'photo' in c && thumbs[c.key]" :src="thumbs[c.key]!" alt="" class="room-thumb" width="48" height="32" />
              <PixelIcon v-else-if="'card' in c && c.card" :icon="c.card.icon" :size="2" />
              <span class="sys-row-main" lang="ja">{{ c.label }}</span>
              <span v-if="'n' in c" class="sys-row-end">× {{ c.n }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div v-else-if="mode === 'view'" class="room-sub">
        <ItemCard v-if="focus.area === 'shelf' && card(focused)" :card="card(focused)!" />
        <img v-else-if="focused && thumbs[focused]" :src="thumbs[focused]!" alt="" class="room-big" width="240" height="160" />
      </div>
    </div>
    <footer class="sys-foot">
      <button type="button" class="nb-btn" @click="systems.closePanel()">收起</button>
      <p class="sys-status" role="status">{{ status }}</p>
    </footer>
  </div>
</template>

<style scoped>
.room-hold {
  margin: 0;
}
.room-body {
  display: flex;
  flex-direction: column;
  gap: 0.8em;
}
.room-wall {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6em;
  padding: 0.5em;
  background: var(--color-px-paper);
  border-radius: 3px;
}
.room-shelf {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
}
.room-board {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.3em;
  padding: 0.3em 0.3em 0;
  background: var(--color-px-wood-1);
  border-bottom: 0.35em solid var(--color-px-wood-3);
  border-radius: 2px;
}
.room-cell {
  display: grid;
  place-items: center;
  min-height: 2.3em;
  padding: 0.15em;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 2px dashed var(--color-px-wood-2);
  border-radius: 3px;
  cursor: pointer;
}
.room-cell.is-filled {
  border-style: solid;
  border-color: transparent;
}
@media (pointer: coarse) {
  .room-cell {
    min-height: 44px;
  }
}
.room-frame {
  aspect-ratio: 3 / 2;
  min-height: 0;
  overflow: hidden;
  background: var(--color-px-white);
  border: 3px solid var(--color-px-wood-2);
  border-radius: 0;
}
/* 相框裡的照片：框的比例照著格子（手機上比較窄），照片裁進框裡，不超出去 */
.room-frame .room-photo {
  height: 100%;
  object-fit: cover;
}
.room-cell.is-on {
  border-style: solid;
  border-color: var(--color-px-ink);
}
.room-frame.is-on {
  outline: 2px solid var(--color-px-ink);
  outline-offset: 1px;
}
.room-cell.is-held {
  border-style: dashed;
  border-color: var(--color-px-shu-2);
}
.room-photo,
.room-big,
.room-thumb {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: pixelated;
}
.room-thumb {
  width: 3em;
  border: 1px solid var(--color-px-ink);
}
.room-big {
  max-width: 16em;
  border: 2px solid var(--color-px-ink);
}
.room-sub {
  padding: 0.5em 0.6em;
  border: 2px dashed var(--color-px-stone-1);
  border-radius: 4px;
}
.room-sub-title {
  margin: 0 0 0.3em;
}
</style>
