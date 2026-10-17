<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { GameSystems } from '../../../game/systems/install'
import type { Panel } from '../../../game/systems/ui'
import { notebookData } from '../../../game/ui/notebook'
import StampsPage from '../notebook/StampsPage.vue'

// 房間桌上的印帳（規格 §8.6）：跟手帳的「印帳」同一本。
const props = defineProps<{ systems: GameSystems; panel?: Panel }>()
const data = computed(() => {
  void props.systems.ui.tick
  return notebookData(props.systems.game, null).stamps
})
const page = ref<InstanceType<typeof StampsPage> | null>(null)
const btn = ref<HTMLButtonElement | null>(null)
function press(b: Button): boolean {
  return page.value?.press(b) ?? false
}
defineExpose({ press, focusFirst: () => page.value?.focusFirst() || (btn.value?.focus({ preventScroll: true }), true) })
</script>

<template>
  <div class="gba-box sys-box" role="dialog" aria-labelledby="book-title">
    <header class="sys-head">
      <h2 id="book-title" class="sys-title">印帳</h2>
    </header>
    <div class="sys-body">
      <StampsPage ref="page" :data="data" />
    </div>
    <footer class="sys-foot">
      <button ref="btn" type="button" class="nb-btn" @click="systems.closePanel()">闔上</button>
    </footer>
  </div>
</template>
