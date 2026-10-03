<script setup lang="ts">
import { ACHV_RULES } from '../data/achvRules'
import NewTag from './NewTag.vue'
import RulesDialog from './RulesDialog.vue'
import TicketTable from './TicketTable.vue'

// 成就的規則（DESIGN.md §7.25）：成就頁「規則」打開的說明書。文案在 data/achvRules.ts 的 ACHV_RULES（測試會檢查）。
const emit = defineEmits<{ close: [] }>()

/** 記號那段：「NEW：新達成、還沒看過。」→ 記號＋說明 */
function mark(item: string): [string, string] {
  const [k = '', d = ''] = item.split('：')
  return [k, d.replace(/。$/, '')]
}
</script>

<template>
  <RulesDialog title="成就的規則" @close="emit('close')">
    <section v-for="(r, i) in ACHV_RULES" :key="r.title" class="flex flex-col gap-2" :aria-labelledby="`a-rule-${i}`">
      <h3 :id="`a-rule-${i}`" class="text-body-sm font-bold text-sub">{{ r.title }}</h3>
      <dl v-if="r.title === '記號'" class="grid grid-cols-[3rem_1fr] items-center gap-x-3 gap-y-2 text-body-sm">
        <template v-for="item in r.items" :key="item">
          <dt>
            <NewTag v-if="mark(item)[0] === 'NEW'" />
            <span v-else class="block size-7 rounded-full border-2 border-dashed border-line" role="img" aria-label="虛線"></span>
          </dt>
          <dd>{{ mark(item)[1] }}</dd>
        </template>
      </dl>
      <ul v-else class="flex flex-col gap-1.5 text-body-sm leading-relaxed">
        <li v-for="item in r.items" :key="item">{{ item }}</li>
      </ul>
      <TicketTable v-if="r.title === '抽獎券'" />
    </section>
  </RulesDialog>
</template>
