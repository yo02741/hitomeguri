<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { dateText, type MapPageData, SEASON_LABEL, TIME_LABEL } from '../../../game/ui/notebook'

import { useRows } from './rows'

// 手帳「地圖」：現在在哪、遊戲的日期與時段；P2 再加上兩縣的鎮（北到南；去過的、現在在的）。
const props = defineProps<{ data: MapPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
defineExpose({ focusFirst: rows.focusFirst, press: (b: Button) => rows.move(b) })
const groups = computed(() => props.data.prefs ?? (props.data.towns.length ? [{ pref: '', title: null, towns: props.data.towns }] : []))
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
.map-pref {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
}
.map-h {
  margin: 0;
  font-size: 1em;
  font-weight: 700;
}
.map-towns {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.15em;
}
.map-towns li {
  display: flex;
  align-items: baseline;
  gap: 0.3em;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
.map-towns li:focus-visible {
  background: var(--color-px-paper);
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
