<script setup lang="ts">
import { weeklyText } from '../../../game/systems/abroad'
import type { AirlineView } from '../../../game/systems/types'

// 台灣與日本之間的飛機的一行（出發看板、想去的地方的路線、回台灣）：航空公司前兩家，多的寫「等 n 家」，後面是每週班次。
// 航空公司寫那家公司繁體中文網站上的名字（中華航空）；沒有的照国土交通省的表（日文，lang="ja"）。
// 「每週 n 班」不拆開換行（要換行就換在航空公司與班次之間）。
defineProps<{ airlines: readonly AirlineView[]; weekly: number }>()
</script>

<template>
  <span class="fl">
    <span class="fl-al">
      <template v-for="(a, k) in airlines.slice(0, 2)" :key="k">
        <template v-if="k">、</template>
        <span :lang="a.zh ? undefined : 'ja'">{{ a.zh ?? a.name }}</span>
      </template>
      <template v-if="airlines.length > 2"> 等 {{ airlines.length }} 家</template>
    </span>
    <span class="fl-wk">{{ weeklyText(weekly) }}</span>
  </span>
</template>

<style scoped>
.fl {
  display: inline-flex;
  flex-wrap: wrap;
  column-gap: 1em;
  min-width: 0;
}
.fl-al {
  min-width: 0;
}
.fl-wk {
  white-space: nowrap;
}
</style>
