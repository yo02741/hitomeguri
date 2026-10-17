<script setup lang="ts">
import { ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { RoomPageData } from '../../../game/ui/notebook'

import { useRows } from './rows'

// 手帳「房間」：你的房間（京都的旅館、沖繩的民宿進去都是同一間）。擺設在房間裡用 A 拿起、放下；這裡只列有幾樣。
defineProps<{ data: RoomPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
defineExpose({ focusFirst: rows.focusFirst, press: (b: Button) => rows.move(b) })
</script>

<template>
  <div ref="root" class="nb-page">
    <p v-if="!data.name" class="nb-empty">還沒有住的地方。</p>
    <dl v-else class="nb-dl">
      <dt>住的地方</dt>
      <dd lang="ja">{{ data.name.ja }}</dd>
      <dt>擺著的東西</dt>
      <dd>{{ data.placed }} / {{ data.slots }}</dd>
    </dl>
  </div>
</template>
