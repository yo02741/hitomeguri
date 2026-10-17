<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Button } from '../../../game/engine/input'
import type { GameSystems } from '../../../game/systems/install'
import type { Panel } from '../../../game/systems/ui'

import ItemCard from './ItemCard.vue'

// 一張品項卡（房間的架子上的東西按 A、其他想給玩家看一樣東西的時候）
const props = defineProps<{ systems: GameSystems; panel: Panel }>()
const card = computed(() => (props.panel.kind === 'card' ? props.panel.card : null))
const btn = ref<HTMLButtonElement | null>(null)
function press(b: Button): boolean {
  if (b === 'A') {
    props.systems.closePanel()
    return true
  }
  return false
}
defineExpose({ press, focusFirst: () => (btn.value?.focus({ preventScroll: true }), true) })
</script>

<template>
  <div v-if="card" class="gba-box sys-box" role="dialog" :aria-label="card.name.ja">
    <div class="sys-body"><ItemCard :card="card" /></div>
    <footer class="sys-foot">
      <button ref="btn" type="button" class="nb-btn" @click="systems.closePanel()">收起</button>
    </footer>
  </div>
</template>
