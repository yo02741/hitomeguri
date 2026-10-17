<script setup lang="ts">
import { inject, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import { GAME_UI } from '../../../game/ui/context'
import { dateText, type SavePageData, savedText } from '../../../game/ui/notebook'

import { useRows } from './rows'

// 手帳「存檔」：現在的地方、遊戲日期、旅費、印與照片的數量、上次存檔的時間，按「存檔」存一次。
// 換地圖時本來就會自動存；存到 localStorage（50 KB 以內），存不了（私密瀏覽、容量滿）就說沒有存到。
defineProps<{ data: SavePageData }>()
const ui = inject(GAME_UI)
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
const status = ref('')
let n = 0

function save() {
  if (!ui) return
  const r = ui.save()
  n++
  status.value = r.ok ? '存好了。' : '這次沒有存到。'
  ui.sfx(r.ok ? 'saved' : 'error')
}

function press(b: Button): boolean {
  if (rows.move(b)) return true
  if (b === 'A' && rows.current() === 'save') {
    save()
    return true
  }
  return false
}
defineExpose({ focusFirst: rows.focusFirst, press })
</script>

<template>
  <div ref="root" class="nb-page">
    <dl class="nb-dl">
      <dt>地方</dt>
      <dd><span v-if="data.here" lang="ja">{{ data.here.ja }}</span></dd>
      <dt>日期</dt>
      <dd>{{ dateText(data.now.date) }}　{{ data.now.hhmm }}</dd>
      <dt>旅費</dt>
      <dd>{{ data.money.toLocaleString('ja-JP') }} 文</dd>
      <dt>印</dt>
      <dd>{{ data.stamps }}</dd>
      <dt>照片</dt>
      <dd>{{ data.photos }}</dd>
      <dt>上次存檔</dt>
      <dd>{{ data.savedAt ? savedText(data.savedAt) : '還沒有存過' }}</dd>
    </dl>
    <div class="save-row" data-row="save">
      <button type="button" class="nb-btn" @click="save">存檔</button>
      <p :key="n" class="save-status" role="status">{{ status }}</p>
    </div>
  </div>
</template>

<style scoped>
.save-row {
  display: flex;
  align-items: center;
  gap: 1em;
  flex-wrap: wrap;
}
.save-status {
  margin: 0;
}
</style>
