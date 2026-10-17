<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { GameSystems } from '../../../game/systems/install'
import { loadThumb } from '../../../game/systems/photoStore'
import type { StockEntry } from '../../../game/systems/shop'
import type { Panel } from '../../../game/systems/ui'
import { rove } from '../../../game/ui/rove'

import ItemCard from './ItemCard.vue'
import PixelIcon from './PixelIcon.vue'

// 店（規格 §8.5）：車站的賣店、老舖、食堂、茶屋。左邊是今天架上的東西（名字、價錢），右邊是選到的那一樣的品項卡
// （窄的時候在下面：選列時列的位置不動，同一個地方點第二下就是同一列）。
// A 買（食堂是吃、茶屋可以坐下來喝茶）；明信片可以選用自己拍的照片。B 離開。買、吃完自動存檔（systems 做）。
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const p = computed(() => (props.panel.kind === 'shop' ? props.panel : null))
const eating = computed(() => p.value?.mode === 'eat')

type Row = { kind: 'sit'; price: number } | { kind: 'item'; e: StockEntry }
const rows = computed<Row[]>(() => {
  const s = p.value?.stock
  if (!s) return []
  return [...(s.sit ? [{ kind: 'sit' as const, price: s.sit }] : []), ...s.entries.map((e) => ({ kind: 'item' as const, e }))]
})
const cur = ref(0)
const sel = computed(() => rows.value[cur.value] ?? null)
const status = ref('')
const money = computed(() => {
  void props.systems.ui.tick
  return props.systems.game.state.money
})
/** 老舖：店名與創業（品項卡上的） */
const shop = computed(() => p.value?.stock.entries.find((e) => e.card.shop)?.card.shop ?? null)

// 明信片：選照片
const picking = ref(false)
const photos = ref<Array<{ id: string; url: string | null; name: string }>>([])
const pickCur = ref(0)

const rowEls = ref<HTMLButtonElement[]>([])
const pickEls = ref<HTMLButtonElement[]>([])

function focusRow(i: number) {
  void nextTick(() => {
    const el = (picking.value ? pickEls.value : rowEls.value)[i]
    el?.focus({ preventScroll: true })
    el?.scrollIntoView?.({ block: 'nearest' })
  })
}

/**
 * 點列：點一下先選（看品項卡），選著的那一列再點一下（或按「買」）才買，手機上不會一點就買下去。
 * armed 是上一次點選（或用方向鍵移到）的那一列，一開始是第一列（它的品項卡已經看得到）；
 * 鍵盤的 Enter／Space（click 的 detail 是 0）照舊直接買。
 */
let armed = 0
/**
 * 用點的時候 focus 先不換 cur：手機上品項卡在列的上面，換了 cur 卡片的高度跟著變、列會跳，
 * click 就落到別的列上。cur 等 click 才換；Tab 移過去（沒有 pointerdown）照舊跟著 focus 換。
 */
let pointing = false
const setPointing = (on: boolean) => {
  pointing = on
}
function onRowFocus(i: number) {
  if (pointing) return
  cur.value = i
  armed = i
}
function onRowClick(i: number, e: MouseEvent) {
  pointing = false
  if (e.detail > 0 && armed !== i) {
    if (cur.value !== i) props.systems.sfx('cursor')
    cur.value = i
    armed = i
    return
  }
  act(i)
}

function act(i = cur.value) {
  const r = rows.value[i]
  if (!r) return
  cur.value = i
  if (r.kind === 'sit') {
    props.systems.sfx('confirm')
    props.systems.closePanel('sit')
    return
  }
  if (eating.value) {
    const res = props.systems.eat(r.e)
    status.value = res === 'ok' ? `吃了${r.e.card.name.ja}。` : '旅費不夠。'
    return
  }
  if (r.e.key === 'game:postcard' && props.systems.game.state.album.length) return void openPick()
  buy(r.e)
}

function buy(e: StockEntry, photo?: string) {
  const res = props.systems.buy(e, photo)
  status.value = res === 'ok' ? `買了${e.card.name.ja}。` : res === 'money' ? '旅費不夠。' : ''
}

async function openPick() {
  props.systems.sfx('confirm')
  const s = props.systems.save
  const ids = [...props.systems.game.state.album].reverse().slice(0, 8)
  photos.value = ids.map((id) => ({ id, url: null, name: s.photos[id]?.name.ja ?? '' }))
  picking.value = true
  pickCur.value = 0
  focusRow(0)
  for (const ph of photos.value) ph.url = await loadThumb(ph.id)
}
function pick(i: number) {
  const r = sel.value
  if (r?.kind !== 'item') return
  buy(r.e, i === 0 ? undefined : photos.value[i - 1]?.id)
  picking.value = false
  focusRow(cur.value)
}

function press(b: Button): boolean {
  const n = picking.value ? photos.value.length + 1 : rows.value.length
  if (b === 'up' || b === 'down' || b === 'left' || b === 'right') {
    if (b === 'left' || b === 'right') return true
    const i = picking.value ? pickCur.value : cur.value
    const j = rove(i, b, n, { wrap: false })
    if (j !== i) props.systems.sfx('cursor')
    if (picking.value) pickCur.value = j
    else cur.value = armed = j
    focusRow(j)
    return true
  }
  if (b === 'A') {
    if (picking.value) pick(pickCur.value)
    else act()
    return true
  }
  if (b === 'B' && picking.value) {
    props.systems.sfx('cancel')
    picking.value = false
    focusRow(cur.value)
    return true
  }
  return false
}

watch(cur, () => (status.value = ''))
defineExpose({ press, focusFirst: () => (focusRow(cur.value), true) })

const MODE_LABEL = { buy: '買', eat: '吃' } as const
</script>

<template>
  <div v-if="p" class="gba-box sys-box shop" role="dialog" aria-labelledby="shop-title">
    <header class="sys-head">
      <h2 id="shop-title" class="sys-title" lang="ja">{{ p.stock.name }}</h2>
      <p class="shop-money">旅費 {{ money.toLocaleString('ja-JP') }} 文</p>
    </header>
    <p v-if="shop?.founded" class="nb-sub shop-founded">
      <span lang="ja">{{ shop.name }}</span>　創業 {{ shop.founded }}
      <a v-if="shop.source" :href="shop.source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`創業的出處：${shop.source.label}（開新分頁）`">出處</a>
    </p>
    <div class="sys-body shop-body">
      <div class="shop-grid">
      <ul v-if="!picking" class="sys-list shop-list" :aria-label="eating ? '今天的菜單' : '今天架上的東西'">
        <li v-for="(r, i) in rows" :key="r.kind === 'sit' ? 'sit' : r.e.key">
          <button
            :ref="(el) => (rowEls[i] = el as HTMLButtonElement)"
            type="button"
            class="sys-row"
            :aria-current="i === cur ? 'true' : undefined"
            :tabindex="i === cur ? 0 : -1"
            @focus="onRowFocus(i)"
            @pointerdown="setPointing(true)"
            @pointercancel="setPointing(false)"
            @click="onRowClick(i, $event)"
          >
            <template v-if="r.kind === 'sit'">
              <span class="sys-row-main">坐下來喝茶</span>
              <span class="sys-row-end">{{ r.price.toLocaleString('ja-JP') }} 文</span>
            </template>
            <template v-else>
              <PixelIcon :icon="r.e.card.icon" :size="2" />
              <span class="sys-row-main">
                <span lang="ja">{{ r.e.card.name.ja }}</span>
                <span v-if="r.e.card.name.zh && r.e.card.name.zh !== r.e.card.name.ja" class="nb-sub">{{ r.e.card.name.zh }}</span>
              </span>
              <span class="sys-row-end">{{ r.e.price.toLocaleString('ja-JP') }} 文</span>
            </template>
          </button>
        </li>
      </ul>
      <div v-else class="shop-pick">
        <p class="shop-pick-title">明信片的圖案</p>
        <ul class="sys-list">
          <li>
            <button :ref="(el) => (pickEls[0] = el as HTMLButtonElement)" type="button" class="sys-row" :aria-current="pickCur === 0 ? 'true' : undefined" @focus="pickCur = 0" @click="pick(0)">
              <PixelIcon icon="postcard" :size="2" />
              <span class="sys-row-main">印好的</span>
            </button>
          </li>
          <li v-for="(ph, i) in photos" :key="ph.id">
            <button
              :ref="(el) => (pickEls[i + 1] = el as HTMLButtonElement)"
              type="button"
              class="sys-row"
              :aria-current="pickCur === i + 1 ? 'true' : undefined"
              @focus="pickCur = i + 1"
              @click="pick(i + 1)"
            >
              <img v-if="ph.url" :src="ph.url" class="shop-thumb" alt="" width="48" height="32" />
              <span v-else class="shop-thumb" aria-hidden="true"></span>
              <span class="sys-row-main" lang="ja">{{ ph.name }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div v-if="sel && sel.kind === 'item'" class="shop-card">
        <ItemCard :card="sel.e.card" />
      </div>
      </div>
    </div>
    <footer class="sys-foot">
      <button v-if="!picking && sel" type="button" class="nb-btn" @click="act()">{{ sel.kind === 'sit' ? '坐下來' : MODE_LABEL[p.mode] }}</button>
      <button type="button" class="nb-btn" @click="picking ? (picking = false) : systems.closePanel()">{{ picking ? '回去' : '離開' }}</button>
      <p class="sys-status" role="status">{{ status }}</p>
    </footer>
  </div>
</template>

<style scoped>
.shop-money {
  margin: 0;
  white-space: nowrap;
  font-size: 0.9em;
}
.shop-founded {
  margin: 0;
  padding: 0.3em 1em 0;
}
.shop-body {
  container-type: inline-size;
}
/* 寬的時候左右兩欄（架上的東西｜品項卡）；窄的時候品項卡在下面（選列時卡片高度變了，列也不會跳） */
.shop-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.8em 1.2em;
  align-content: start;
}
@container (min-width: 30em) {
  .shop-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
.shop-card {
  padding: 0.6em 0.7em;
  border: 2px dashed var(--color-px-stone-1);
  border-radius: 4px;
  align-self: start;
}
.shop-pick-title {
  margin: 0 0 0.3em;
}
.shop-thumb {
  display: block;
  width: 3em;
  height: 2em;
  object-fit: cover;
  image-rendering: pixelated;
  border: 1px solid var(--color-px-ink);
  background: var(--color-px-paper);
}
</style>
