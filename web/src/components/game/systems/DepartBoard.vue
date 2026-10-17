<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { Button } from '../../../game/engine/input'
import { weeklyText } from '../../../game/systems/abroad'
import { kmText } from '../../../game/systems/data'
import type { GameSystems } from '../../../game/systems/install'
import type { AirlineView, BoardRowView, BoardView, PlanRouteView, PlanTownView, TravelDest, TravelMode } from '../../../game/systems/types'
import { rove } from '../../../game/ui/rove'

import FlightLine from './FlightLine.vue'

// 台灣的機場出發大廳的出發看板（P4，規格 §13 第 4 點）：
// - 出發看板：這個城市有直飛、遊戲裡去得了的日本機場（機場名、所在縣、航空公司與每週班次；国土交通省的表）。
//   沒有大廳的機場（成田、中部）寫飛到之後坐什麼到哪裡。接不到遊戲的鎮的機場不列。
// - 想去的地方：選遊戲裡的一鎮，列出從這個城市去得了的路線（飛到哪個機場＋電車或巴士），日本這一段近的在前。
// 不寫時刻、票價；飛機那一段不寫 km（台灣那一邊沒有座標資料，台北也不分桃園、松山）。
// 航空公司寫那家公司繁體中文網站上的名字，選著的那一個機場也列表上的日文名（出處的寫法）。
// 鍵盤：上下選；左右換頁（出發看板在左、想去的地方在右，到邊就不動）；想去的地方：A 看路線、在路線裡 B 或左回到鎮；
// A 出發、B 不去了。觸控：點一下選、選著的再點一下出發。
// 版面：寬的時候兩欄（列表｜選著的那一個）；窄的時候一欄，選著的那一列直接展開各家航空公司（不放另一張卡）；
// 矮的時候（手機橫拿）一列一行（機場、縣、每週班次），航空公司與飛到之後在右邊的卡。
const props = defineProps<{ systems: GameSystems; board: BoardView }>()
const emit = defineEmits<{ choose: [dest: TravelDest] }>()

type Tab = 'board' | 'plan'
const tab = ref<Tab>('board')
const cur = ref(0)
const level = ref<'town' | 'route'>('town')
const flatTowns = computed(() => props.board.prefs.flatMap((p) => p.towns.map((t) => ({ pref: p, town: t }))))
const townCur = ref(Math.max(0, flatTowns.value.findIndex((x) => x.town.id === props.board.plan)))
const routeCur = ref(0)
const selRow = computed<BoardRowView | null>(() => props.board.rows[cur.value] ?? null)
const selTown = computed<PlanTownView | null>(() => flatTowns.value[townCur.value]?.town ?? null)
const selPref = computed(() => flatTowns.value[townCur.value]?.pref.name ?? '')
const routes = computed<PlanRouteView[]>(() => selTown.value?.routes ?? [])
const townIndex = (id: string) => flatTowns.value.findIndex((x) => x.town.id === id)
watch(townCur, () => (routeCur.value = 0))

const rowEls = ref<HTMLButtonElement[]>([])
const townEls = ref<HTMLButtonElement[]>([])
const routeEls = ref<HTMLButtonElement[]>([])
const tabEls = ref<Record<Tab, HTMLButtonElement | null>>({ board: null, plan: null })

const MODE: Record<TravelMode, string> = { rail: '鐵路', monorail: '單軌', bus: '巴士', plane: '飛機', ferry: '渡輪' }
function howText(mode: TravelMode, km: number, kind: 'rail' | 'straight'): string {
  return mode === 'rail' && kind === 'rail' ? kmText(km, kind) : `${MODE[mode]}　${kmText(km, kind)}`
}
/** 繁體中文網站上的名字跟表上的不一樣時，表上的日文名寫在後面（小字） */
const jaOf = (a: AirlineView) => (a.zh && a.zh !== a.name ? a.name : null)

function focusNow() {
  void nextTick(() => {
    const el = tab.value === 'board' ? rowEls.value[cur.value] : level.value === 'route' ? routeEls.value[routeCur.value] : townEls.value[townCur.value]
    el?.focus({ preventScroll: true })
    el?.scrollIntoView?.({ block: 'nearest' })
  })
}

function setTab(t: Tab) {
  if (tab.value === t) return
  props.systems.sfx('cursor')
  tab.value = t
  level.value = 'town'
  focusNow()
}

// 點列：點一下先選，選著的那一列再點一下（或按「出發」）才出發；鍵盤的 Enter／Space（click 的 detail 是 0）直接出發
let pointing = false
const setPointing = (on: boolean) => {
  pointing = on
}
let armedRow = cur.value
let armedRoute = -1
function onRowFocus(i: number) {
  if (pointing) return
  cur.value = armedRow = i
}
function onRowClick(i: number, e: MouseEvent) {
  pointing = false
  if (e.detail > 0 && armedRow !== i) {
    if (cur.value !== i) props.systems.sfx('cursor')
    cur.value = armedRow = i
    return
  }
  goRow(i)
}
function goRow(i: number) {
  const r = props.board.rows[i]
  if (!r) {
    props.systems.sfx('error')
    return
  }
  props.systems.sfx('confirm')
  emit('choose', r.dest)
}
function onTownFocus(i: number) {
  if (pointing) return
  townCur.value = i
}
function onTownClick(i: number) {
  pointing = false
  if (townCur.value !== i) props.systems.sfx('cursor')
  townCur.value = i
  level.value = 'town'
  armedRoute = -1
}
function onRouteFocus(i: number) {
  if (pointing) return
  routeCur.value = armedRoute = i
  level.value = 'route'
}
function onRouteClick(i: number, e: MouseEvent) {
  pointing = false
  level.value = 'route'
  if (e.detail > 0 && armedRoute !== i) {
    if (routeCur.value !== i) props.systems.sfx('cursor')
    routeCur.value = armedRoute = i
    return
  }
  goRoute(i)
}
function goRoute(i: number) {
  const r = routes.value[i]
  if (!r) {
    props.systems.sfx('error')
    return
  }
  props.systems.sfx('confirm')
  emit('choose', r.dest)
}

/** 下面的鈕：出發看板、路線是「出發」；想去的地方選鎮的時候是「看路線」 */
function go() {
  if (tab.value === 'board') return goRow(cur.value)
  if (level.value === 'route') return goRoute(routeCur.value)
  if (routes.value.length) {
    props.systems.sfx('confirm')
    level.value = 'route'
    routeCur.value = 0
    focusNow()
  } else props.systems.sfx('error')
}
const goLabel = computed(() => (tab.value === 'plan' && level.value === 'town' ? '看路線' : '出發'))
/** 選的那一鎮從這個城市去不了：「看路線」按不了（提示列也不列 A） */
const goOff = computed(() => tab.value === 'plan' && level.value === 'town' && !routes.value.length)

function press(b: Button): boolean {
  if (tab.value === 'board') {
    if (b === 'up' || b === 'down') {
      const j = rove(cur.value, b, props.board.rows.length, { wrap: false })
      if (j !== cur.value) props.systems.sfx('cursor')
      cur.value = armedRow = j
      focusNow()
      return true
    }
    if (b === 'right') {
      setTab('plan')
      return true
    }
    if (b === 'A') {
      goRow(cur.value)
      return true
    }
    // 出發看板是左邊的那一頁：左不動
    return b === 'left'
  }
  if (level.value === 'town') {
    if (b === 'up' || b === 'down') {
      const j = rove(townCur.value, b, flatTowns.value.length, { wrap: false })
      if (j !== townCur.value) props.systems.sfx('cursor')
      townCur.value = j
      focusNow()
      return true
    }
    if (b === 'left') {
      setTab('board')
      return true
    }
    if (b === 'A') {
      go()
      return true
    }
    // 想去的地方是右邊的那一頁：右不動（看路線只用 A，提示列寫的「←→ 換頁」才是真的）
    return b === 'right'
  }
  if (b === 'up' || b === 'down') {
    const j = rove(routeCur.value, b, routes.value.length, { wrap: false })
    if (j !== routeCur.value) props.systems.sfx('cursor')
    routeCur.value = armedRoute = j
    focusNow()
    return true
  }
  if (b === 'A') {
    goRoute(routeCur.value)
    return true
  }
  if (b === 'left' || b === 'B') {
    props.systems.sfx('cancel')
    level.value = 'town'
    focusNow()
    return true
  }
  return b === 'right'
}

/** 按鍵提示（PlayView 的提示列）：出發看板、想去的地方的鎮（去不了的鎮：town-none）、路線 */
const mode = () => (tab.value === 'board' ? 'board' : level.value === 'route' ? 'route' : routes.value.length ? 'town' : 'town-none')
defineExpose({ press, focusFirst: () => (focusNow(), true), mode })
</script>

<template>
  <div class="dep">
    <div class="dep-tabs" role="tablist" aria-label="出發看板">
      <button
        :ref="(el) => (tabEls.board = el as HTMLButtonElement)"
        type="button"
        role="tab"
        class="dep-tab"
        :aria-selected="tab === 'board'"
        :tabindex="tab === 'board' ? 0 : -1"
        @click="setTab('board')"
      >
        出發看板
      </button>
      <button
        :ref="(el) => (tabEls.plan = el as HTMLButtonElement)"
        type="button"
        role="tab"
        class="dep-tab"
        :aria-selected="tab === 'plan'"
        :tabindex="tab === 'plan' ? 0 : -1"
        @click="setTab('plan')"
      >
        想去的地方
      </button>
    </div>

    <div v-if="tab === 'board'" class="dep-grid is-board">
      <ul class="sys-list dep-list" aria-label="直飛的機場">
        <li v-for="(r, i) in board.rows" :key="r.airport">
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
            <span class="sys-row-main">
              <span class="dep-head">
                <span class="dep-ap" lang="ja">{{ r.name }}<span class="nb-sub">　{{ r.prefName }}</span></span>
                <span class="nb-sub dep-wk-end">{{ weeklyText(r.weekly) }}</span>
              </span>
              <span class="nb-sub dep-line dep-sum"><FlightLine :airlines="r.airlines" :weekly="r.weekly" /></span>
              <span v-if="i === cur" class="nb-sub dep-each">
                <span v-for="a in r.airlines" :key="a.name" class="dep-al">
                  <span class="dep-al-name">
                    <span :lang="a.zh ? undefined : 'ja'">{{ a.zh ?? a.name }}</span>
                    <span v-if="jaOf(a)" lang="ja" class="dep-al-ja">{{ jaOf(a) }}</span>
                  </span>
                  <span class="dep-al-wk">{{ weeklyText(a.weekly) }}</span>
                </span>
              </span>
              <span v-if="r.then?.length" class="nb-sub dep-line">
                <template v-for="(l, k) in r.then" :key="k">→ <span lang="ja">{{ l.to }}</span>　{{ howText(l.mode, l.km, l.kmKind) }}<template v-if="l.area">　{{ l.area }}</template></template>
              </span>
            </span>
          </button>
        </li>
      </ul>
      <div v-if="selRow" class="dep-card" aria-live="polite">
        <p class="dep-name" lang="ja">{{ selRow.name }}</p>
        <p class="nb-sub">{{ selRow.prefName }}</p>
        <ul class="dep-airlines">
          <li v-for="a in selRow.airlines" :key="a.name" class="dep-al">
            <span class="dep-al-name">
              <span :lang="a.zh ? undefined : 'ja'">{{ a.zh ?? a.name }}</span>
              <span v-if="jaOf(a)" lang="ja" class="nb-sub dep-al-ja">{{ jaOf(a) }}</span>
            </span>
            <span class="nb-sub dep-al-wk">{{ weeklyText(a.weekly) }}</span>
          </li>
        </ul>
        <p v-if="selRow.then?.length" class="dep-then">
          飛到之後
          <template v-for="(l, k) in selRow.then" :key="k">
            <br />{{ howText(l.mode, l.km, l.kmKind) }} → <span lang="ja">{{ l.to }}</span><template v-if="l.area">　{{ l.area }}</template>
          </template>
        </p>
      </div>
    </div>

    <div v-else class="dep-grid is-plan">
      <ul class="sys-list dep-towns" aria-label="想去的地方">
        <template v-for="p in board.prefs" :key="p.pref">
          <li class="dep-pref" aria-hidden="true">{{ p.name }}</li>
          <li v-for="t in p.towns" :key="t.id">
            <button
              :ref="(el) => (townEls[townIndex(t.id)] = el as HTMLButtonElement)"
              type="button"
              class="sys-row"
              :class="{ 'is-off': !t.routes.length }"
              :aria-current="selTown?.id === t.id ? 'true' : undefined"
              :tabindex="selTown?.id === t.id ? 0 : -1"
              @focus="onTownFocus(townIndex(t.id))"
              @pointerdown="setPointing(true)"
              @pointercancel="setPointing(false)"
              @click="onTownClick(townIndex(t.id))"
            >
              <span class="sys-row-main">
                <!-- 同名的鎮（中央区、北区…）：讀屏也要聽得出是哪一縣 -->
                <span><span lang="ja">{{ t.name.ja }}</span><span class="sr-only">　{{ p.name }}</span></span>
              </span>
            </button>
          </li>
        </template>
      </ul>
      <div class="dep-routes">
        <p v-if="selTown" class="dep-name"><span lang="ja">{{ selTown.name.ja }}</span><span class="nb-sub">　{{ selPref }}</span></p>
        <p v-if="selTown && !routes.length" class="nb-empty">從{{ board.city }}直飛到不了這裡。</p>
        <ul v-else class="sys-list" aria-label="路線">
          <li v-for="(r, i) in routes" :key="r.airport">
            <button
              :ref="(el) => (routeEls[i] = el as HTMLButtonElement)"
              type="button"
              class="sys-row"
              :aria-current="level === 'route' && i === routeCur ? 'true' : undefined"
              :tabindex="level === 'route' && i === routeCur ? 0 : -1"
              @focus="onRouteFocus(i)"
              @pointerdown="setPointing(true)"
              @pointercancel="setPointing(false)"
              @click="onRouteClick(i, $event)"
            >
              <span class="sys-row-main">
                <span lang="ja">{{ r.name }}<span class="nb-sub">　{{ r.prefName }}</span></span>
                <span class="nb-sub">
                  <template v-if="!r.legs.length">降在這一鎮</template>
                  <template v-for="(l, k) in r.legs" v-else :key="k"><template v-if="k">、</template>{{ howText(l.mode, l.km, l.kmKind) }} → <span lang="ja">{{ l.to }}</span></template>
                </span>
                <span class="nb-sub"><FlightLine :airlines="r.airlines" :weekly="r.weekly" /></span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="dep-foot">
      <p class="nb-sub dep-src">
        <a :href="board.source.url" target="_blank" rel="noopener noreferrer" class="nb-src" :aria-label="`航線的出處：${board.source.label}（開新分頁）`">出處</a>
        {{ board.source.label }}<template v-if="board.source.season">　<span lang="ja">{{ board.source.season }}</span></template>
      </p>
      <div class="dep-btns">
        <button type="button" class="nb-btn" :disabled="goOff" @click="go">{{ goLabel }}</button>
        <button type="button" class="nb-btn" @click="systems.closePanel()">不去了</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dep {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  min-height: 0;
  flex: 1;
}
.dep-tabs {
  display: flex;
  gap: 0.4em;
  padding: 0 0.2em;
}
.dep-tab {
  font: inherit;
  padding: 0.15em 0.8em;
  border: 2px solid var(--color-px-ink);
  background: var(--color-px-paper);
  color: var(--color-px-ink);
  cursor: pointer;
  min-height: 2em;
}
.dep-tab[aria-selected='true'] {
  background: var(--color-px-ink);
  color: var(--color-px-white);
}
@media (pointer: coarse) {
  .dep-tab {
    min-height: 44px;
  }
}
/*
 * 出發看板：窄的時候一欄（選著的那一列展開各家航空公司，不放卡），整欄一起捲；寬的時候兩欄各自捲。
 * 想去的地方：窄的時候路線在上面（最多一半高）、鎮在下面；寬的時候鎮｜路線兩欄各自捲。
 */
.dep-grid {
  display: grid;
  gap: 0.6em 1em;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
}
.dep-grid.is-board {
  overflow-y: auto;
  align-content: start;
}
.dep-grid.is-plan {
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: 'routes' 'towns';
  overflow: hidden;
}
.is-plan .dep-towns {
  grid-area: towns;
  overflow-y: auto;
  min-height: 0;
  /* 選著的鎮捲進來時不躲在停住的縣名下面 */
  scroll-padding-top: 1.8em;
}
.is-plan .dep-routes {
  grid-area: routes;
  overflow-y: auto;
  max-height: 45vh;
}
.dep-card {
  display: none;
}
.dep-each {
  display: grid;
  gap: 0.1em;
  margin-top: 0.2em;
}
.sys-row[aria-current='true'] .dep-sum {
  display: none;
}
@media (min-width: 640px) {
  .dep-grid.is-board {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
  }
  .is-board .dep-list,
  .is-board .dep-card {
    overflow-y: auto;
    max-height: 100%;
  }
  /* 放不下時下緣淡出（還有東西，往下捲）；放得下時淡出的只是下面的留白 */
  .dep-card {
    display: block;
    padding-bottom: 1.4em;
    mask-image: linear-gradient(to bottom, var(--color-px-ink) calc(100% - 1.4em), transparent);
  }
  .dep-each {
    display: none;
  }
  .sys-row[aria-current='true'] .dep-sum {
    display: inline;
  }
  .dep-grid.is-plan {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: 'towns routes';
  }
  .is-plan .dep-routes {
    max-height: 100%;
  }
}
.dep-head {
  display: flex;
  align-items: baseline;
  gap: 0.8em;
  min-width: 0;
}
.dep-ap {
  min-width: 0;
}
.dep-wk-end {
  display: none;
  margin-left: auto;
  white-space: nowrap;
}
.sys-row.is-off {
  color: var(--color-px-stone-2);
}
.sys-row.is-off .nb-sub {
  color: var(--color-px-stone-2);
}
.dep-card,
.dep-routes {
  padding: 0.5em 0.7em;
  border: 2px dashed var(--color-px-stone-1);
  border-radius: 4px;
  align-self: start;
}
.dep-name {
  margin: 0;
}
.dep-airlines {
  list-style: none;
  margin: 0.4em 0 0;
  padding: 0;
  display: grid;
  gap: 0.1em;
}
/* 航空公司｜每週班次：兩欄，班次靠右對齊 */
.dep-al {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  column-gap: 0.8em;
}
/* 表上的日文名：放不下時整個換到下一行（不從中間斷開；比整欄還長才截掉） */
.dep-al-ja {
  display: inline-block;
  max-width: 100%;
  margin-left: 0.5em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.dep-al-wk {
  justify-self: end;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.dep-then {
  margin: 0.5em 0 0;
}
/* 縣名：捲動時停在上面（同名的鎮：中央区、北区…看得出是哪一縣） */
.dep-pref {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0.4em 0 0.1em;
  padding: 0.1em 0;
  font-size: 0.85em;
  color: var(--color-px-stone-3);
  background: var(--color-px-white);
}
.dep-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5em 0.8em;
  padding-top: 0.5em;
  border-top: 2px solid var(--color-px-stone-1);
}
.dep-src {
  flex: 1 1 16em;
  margin: 0;
}
.dep-btns {
  display: flex;
  gap: 0.6em;
  margin-left: auto;
}
.dep-btns .nb-btn:disabled {
  color: var(--color-px-stone-2);
  border-color: var(--color-px-stone-2);
  box-shadow: none;
}
/*
 * 矮的畫面（手機橫拿，高 480 以下）：頁籤不加高、一列一行（機場、縣、每週班次靠右），航空公司與飛到之後在右邊的卡。
 */
@media (max-height: 480px) {
  .dep {
    gap: 0.35em;
  }
  .dep-tab {
    min-height: 2em;
  }
  .is-board .sys-row .dep-line,
  .is-board .sys-row[aria-current='true'] .dep-line {
    display: none;
  }
  .dep-wk-end {
    display: inline;
  }
  .dep-ap {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .is-board .sys-row {
    min-height: 2.4em;
  }
  .dep-foot {
    padding-top: 0.35em;
  }
}
</style>
