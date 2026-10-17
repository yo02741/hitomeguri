<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { MARK_INK } from '../../../game/engine/minimap'
import { placeSub } from '../../../game/engine/places'
import { dateText, type MapPageData, SEASON_LABEL, TIME_LABEL } from '../../../game/ui/notebook'
import MapCanvas from '../MapCanvas.vue'

import { useRows } from './rows'

// 手帳「地圖」：現在在哪、遊戲的日期與時段；P4 這一鎮的大張地圖（小地圖的整張：路、建築、水、地標的點、門、自己），
// 下面列出地圖上有名字的地方（選著的那一個在地圖上框起來）；P2 起再列各縣的鎮（北到南；去過的、現在在的）。
// 在室內時是那一鎮的戶外，自己在進來的那個門。你的房間沒有鎮，不畫地圖。
const props = defineProps<{ data: MapPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
defineExpose({ focusFirst: rows.focusFirst, press: (b: Button) => rows.move(b) })
const groups = computed(() => props.data.prefs ?? (props.data.towns.length ? [{ pref: '', title: null, towns: props.data.towns }] : []))

const chart = computed(() => props.data.chart ?? null)
/** 列表裡選著（聚焦、滑鼠移過去）的地方 */
const focusId = ref<string | null>(null)
const focus = computed(() => {
  const p = chart.value?.places.find((x) => x.id === focusId.value)
  return p ? { x: p.x, y: p.y } : null
})

// 地圖的放大倍數：放得進這一頁的寬（2–6 倍，一格一個點）
const box = ref<HTMLElement | null>(null)
const boxW = ref(0)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!box.value) return
  boxW.value = box.value.clientWidth
  ro = new ResizeObserver(() => (boxW.value = box.value?.clientWidth ?? 0))
  ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())
const px = computed(() => {
  const c = chart.value
  if (!c || !boxW.value) return 3
  return Math.max(2, Math.min(6, Math.floor(boxW.value / c.mini.w)))
})
const KIND_LABEL = { landmark: '地標', station: '車站', shop: '店', door: '店' } as const
const dotColor = (k: keyof typeof MARK_INK) => `var(--color-px-${MARK_INK[k]})`
</script>

<template>
  <div ref="root" class="nb-page">
    <dl class="nb-dl">
      <dt>現在</dt>
      <dd>
        <template v-if="data.here">
          <span lang="ja">{{ data.here.ja }}</span>
          <span v-if="data.here.zh && data.here.zh !== data.here.ja" class="nb-sub">　{{ data.here.zh }}</span>
        </template>
      </dd>
      <dt>日期</dt>
      <dd>{{ dateText(data.now.date) }}</dd>
      <dt>時間</dt>
      <dd><span>{{ data.now.hhmm }}</span>　{{ TIME_LABEL[data.now.time] }}・{{ SEASON_LABEL[data.now.season] }}</dd>
    </dl>

    <section v-if="chart" class="map-chart" :aria-label="`${chart.name.ja}的地圖`">
      <h3 class="map-h">
        <span lang="ja">{{ chart.name.ja }}</span>
        <span v-if="chart.name.zh && chart.name.zh !== chart.name.ja" class="nb-sub">　{{ chart.name.zh }}</span>
      </h3>
      <div ref="box" class="map-box">
        <div class="map-frame">
          <MapCanvas :mini="chart.mini" :px="px" :player="chart.here" :focus="focus" />
        </div>
      </div>
      <ul v-if="chart.places.length" class="map-places">
        <li
          v-for="p in chart.places"
          :key="p.id"
          tabindex="0"
          data-row
          :class="{ 'is-on': focusId === p.id }"
          @focus="focusId = p.id"
          @blur="focusId === p.id && (focusId = null)"
          @mouseenter="focusId = p.id"
          @mouseleave="focusId === p.id && (focusId = null)"
        >
          <span class="map-mark" :class="`is-${p.kind}`" :style="{ background: dotColor(p.kind) }" aria-hidden="true"></span>
          <span lang="ja">{{ p.name.ja }}</span>
          <span v-if="placeSub(p.name)" class="nb-sub">　{{ placeSub(p.name) }}</span>
          <span class="nb-sub map-state">{{ KIND_LABEL[p.kind] }}</span>
        </li>
      </ul>
    </section>

    <section v-for="g in groups" :key="g.pref" class="map-pref" :aria-label="g.title?.ja">
      <h3 v-if="g.title" class="map-h">
        <span lang="ja">{{ g.title.ja }}</span>
        <span class="nb-sub">　去過 {{ g.towns.filter((t) => t.visited).length }} / {{ g.towns.length }}</span>
      </h3>
      <ul class="map-towns">
        <li v-for="t in g.towns" :key="t.id" :class="{ 'is-here': t.here, 'is-new': !t.visited }" tabindex="0" data-row>
          <span class="map-dot" aria-hidden="true">{{ t.here ? '●' : t.visited ? '○' : '・' }}</span>
          <span lang="ja">{{ t.name.ja }}</span>
          <span v-if="t.name.zh && t.name.zh !== t.name.ja" class="nb-sub">　{{ t.name.zh }}</span>
          <span class="nb-sub map-state">{{ t.here ? '現在在這裡' : t.visited ? '去過' : '還沒去' }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.map-pref,
.map-chart {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}
.map-h {
  margin: 0;
  font-size: 1em;
  font-weight: 700;
}
.map-box {
  width: 100%;
}
/* 地圖的框：墨色一圈、白一圈（跟畫面上的小地圖一樣） */
.map-frame {
  width: fit-content;
  max-width: 100%;
  padding: 2px;
  background: var(--color-px-white);
  border: 2px solid var(--color-px-ink);
  border-radius: 3px;
  overflow: hidden;
}
.map-towns,
.map-places {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.15em;
}
.map-towns li,
.map-places li {
  display: flex;
  align-items: baseline;
  gap: 0.3em;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
.map-towns li:focus-visible,
.map-places li:focus-visible,
.map-places li.is-on {
  background: var(--color-px-paper);
}
.map-mark {
  flex-shrink: 0;
  width: 0.5em;
  height: 0.5em;
  margin: 0 0.25em;
  align-self: center;
}
/* 門（茶屋、食堂、旅館）：小一點的點 */
.map-mark.is-door {
  width: 0.3em;
  height: 0.3em;
  margin: 0 0.35em;
}
.map-dot {
  width: 1em;
  color: var(--color-px-shu-2);
}
.map-state {
  margin-left: auto;
  padding-left: 1em;
}
.map-towns .is-new {
  color: var(--color-px-stone-3);
}
.map-towns .is-here {
  font-weight: 700;
}
</style>
